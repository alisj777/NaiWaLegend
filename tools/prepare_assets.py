"""
把 art/reference 里的定稿图处理成游戏用的素材，输出到 public/assets/。
  - 去白底：从图片四边开始找连成一片的浅色背景，变成透明（边缘做柔化）
  - 裁掉四周空白，再等比缩放到游戏需要的尺寸（游戏显示尺寸的 2 倍，高清屏不糊）
  - 背景图不去底，直接裁成需要的比例

用法：python3 tools/prepare_assets.py
新增素材：在下面 JOBS 里加一行。
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "art" / "reference"
OUT = ROOT / "public" / "assets"

# (源文件, 输出文件, 处理方式, 最大宽, 最大高[, 参数])
#   cutout = 去白底并裁边；cover = 背景图，裁成正好这个尺寸
#   参数 anchor_y（cover 用）：上下要裁掉时，从哪里裁。0 = 保留最上面，0.5 = 居中，1 = 保留最下面
#   参数 tol：判定为背景的容差，越大去得越狠（能去掉浅灰色影子，但太大会吃掉物体的浅色边缘）
#   参数 glass：玻璃等透明物体，物体内部透出的白底也变透明
#   luma = 黑底上的白色半透明效果（如狂风）：越亮越不透明，黑色完全透明
# 源图已经是透明底 PNG 时，自动只裁边缩放，不再去底；黑底图也会自动按黑色去底
JOBS = [
    # 第一关 · 狂风夜
    ("chapter1/field.png", "stage1/field.jpg", "cover", 1728, 896),
    ("chapter1/brick.png", "stage1/brick.png", "cutout", 64, 48, {"tol": 75}),
    ("chapter1/bottle_empty.png", "stage1/bottle_empty.png", "cutout", 40, 56, {"tol": 50, "glass": True}),
    ("chapter1/bottle_tea.png", "stage1/bottle_tea.png", "cutout", 40, 56, {"tol": 90}),
    # 奶瓶：源图换成黑底或透明底后直接用；还是旧的白底图时，从奶茶瓶换色生成
    ("chapter1/bottle_milk.png", "stage1/bottle_milk.png", "cutout", 40, 56, {"tol": 60, "white_bg_fallback": "milk_from_tea"}),
    ("chapter1/wind.png", "stage1/wind.png", "luma", 256, 256),
    ("chapter1/shovel.png", "stage1/shovel.png", "cutout", 48, 60, {"tol": 75}),
    ("chapter1/spring.png", "stage1/spring.png", "cutout", 192, 192),
    ("chapter1/shelter_hut.png", "stage1/shelter.png", "cutout", 96, 96, {"tol": 50}),
    # 序章（插画区 1280×560，输出 2 倍）
    # 全家福：保住奶蛙头顶和最下面一排奶蛋，只裁掉天空
    ("intro/family_photo.png", "story/family.jpg", "cover", 2560, 1120, {"anchor_y": 1.0}),
    ("chapter2/rebirth.png", "story/rebirth.jpg", "cover", 2560, 1120),
    ("intro/growth_path.png", "story/growth.jpg", "cover", 2560, 1120),
    ("intro/doom.png", "story/doom.jpg", "cover", 2560, 1120),
    ("intro/winter.png", "story/winter.jpg", "cover", 2560, 1120),
    ("intro/dying_frog.png", "story/dying.jpg", "cover", 2560, 1120),
    # 菜单背景（全屏 1280×720）
    ("menu/village.png", "menu/village.jpg", "cover", 2560, 1440),
    # 奶蛋（第一关的 5 个奶蛋都用这一套）
    ("egg/view_front.png", "stage1/egg_down.png", "cutout", 64, 72, {"tol": 75}),
    ("egg/view_back.png", "stage1/egg_up.png", "cutout", 64, 72, {"tol": 75}),
    ("egg/view_left.png", "stage1/egg_left.png", "cutout", 64, 72, {"tol": 75}),
    ("egg/view_right.png", "stage1/egg_right.png", "cutout", 64, 72, {"tol": 75}),
]


def has_transparency(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 250


def corner_brightness(img: Image.Image) -> float:
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    return float(np.mean([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]]))


def trim(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    return img.crop(bbox) if bbox else img


def luma(img: Image.Image) -> Image.Image:
    """黑底白色效果：亮度直接当透明度，颜色统一成白色"""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    lum = rgb.max(axis=2)
    alpha = np.clip((lum - 20) / (235 - 20), 0, 1) * 255
    out = np.dstack([np.full_like(lum, 250), np.full_like(lum, 252), np.full_like(lum, 255), alpha]).astype(np.uint8)
    return trim(Image.fromarray(out, "RGBA"))


def cutout(img: Image.Image, tol=42, glass=False, white_bg_fallback=None) -> Image.Image:
    if has_transparency(img):
        return trim(img.convert("RGBA"))
    tol_lo, tol_hi = 12, tol
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    # 背景色取四个角的平均
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
    bg = corners.mean(axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    candidate = dist < tol_hi
    # 从四边出发做洪水填充，只把和边缘连成一片的浅色区域当背景（物体内部的白色不会被挖掉）
    mask = Image.fromarray((candidate * 255).astype(np.uint8), "L").copy()  # copy：否则和数组共用内存，填充写不进去
    border = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    for xy in border:
        if mask.getpixel(xy) == 255:
            ImageDraw.floodfill(mask, xy, 128)
    is_bg = np.asarray(mask) == 128
    # 背景（含浅色影子）全部透明，再把边缘模糊 1 像素做柔化，避免留下发白的光晕
    hard = Image.fromarray(np.where(is_bg, 0, 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1))
    alpha = np.asarray(hard).astype(np.float32)
    if glass:
        # 玻璃：物体内部接近背景色的地方也变成半透明，只保留瓶身轮廓和高光
        ramp = np.clip((dist - tol_lo) / (tol_hi - tol_lo), 0, 1) * 255
        inner = ~is_bg & candidate
        alpha[inner] = np.maximum(ramp[inner], 70)
    out = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])
    return trim(Image.fromarray(out, "RGBA"))


def fit(img: Image.Image, mw: int, mh: int) -> Image.Image:
    img = img.copy()
    img.thumbnail((mw, mh), Image.LANCZOS)
    return img


def cover(img: Image.Image, w: int, h: int, anchor_y: float = 0.5) -> Image.Image:
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    img = img.resize((round(sw * scale), round(sh * scale)), Image.LANCZOS)
    left = (img.width - w) // 2
    top = round((img.height - h) * anchor_y)
    return img.crop((left, top, left + w, top + h))


def milk_from_tea(tea_path: Path, out_path: Path):
    """奶瓶：白色牛奶和白底分不开，直接把奶茶瓶里的茶色换成奶白色，保证两个瓶子外形一致"""
    img = np.asarray(Image.open(tea_path).convert("RGBA")).astype(np.float32)
    r, g, b, a = img[..., 0], img[..., 1], img[..., 2], img[..., 3]
    brown = (r > g + 10) & (g > b + 5)  # 茶色像素
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
    shade = 0.82 + 0.18 * np.clip(lum / max(lum[brown].max() if brown.any() else 1, 1e-3), 0, 1)
    for c, v in enumerate((252, 250, 240)):
        img[..., c] = np.where(brown, v * shade, img[..., c])
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGBA").save(out_path, optimize=True)
    print(f"{out_path.relative_to(OUT)!s:28s} 由奶茶瓶换色生成")


def main():
    for job in JOBS:
        src, dst, mode, mw, mh = job[:5]
        opt = job[5] if len(job) > 5 else {}
        s = REF / src
        if not s.exists():
            print(f"跳过（找不到源文件）：{src}")
            continue
        d = OUT / dst
        d.parent.mkdir(parents=True, exist_ok=True)
        img = Image.open(s)
        white_bg = not has_transparency(img) and corner_brightness(img) > 200
        if mode == "cover":
            cover(img.convert("RGB"), mw, mh, **opt).save(d, quality=85, optimize=True)
        elif mode == "luma":
            if white_bg:
                print(f"跳过 {dst}：源图是白底，请换成黑底或透明底的版本")
                continue
            fit(trim(img.convert("RGBA")) if has_transparency(img) else luma(img), mw, mh).save(d, optimize=True)
        elif opt.get("white_bg_fallback") == "milk_from_tea" and white_bg:
            tea = OUT / "stage1/bottle_tea.png"
            if tea.exists():
                milk_from_tea(tea, d)
            continue
        else:
            fit(cutout(img, **opt), mw, mh).save(d, optimize=True)
        print(f"{dst:28s} {Image.open(d).size}  {d.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
