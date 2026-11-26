"""
标题字体瘦身：阿里妈妈方圆体（可变字体，7MB+）→ 固定成最粗、最圆的样式，只保留游戏里用到的字，
生成 public/fonts/title.ttf，只用于标题、大标题（正文仍用系统字体）。

用法：python3 tools/subset_font.py
改了文案（src 里新增了汉字）后要重新跑一次，否则新字会退回系统字体。
"""
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "reference" / "menu" / "阿里妈妈方圆体.ttf"
OUT = ROOT / "public" / "fonts" / "title.ttf"
# 可变字体的轴：wght 字重 200~700，BEVL 圆角程度 1~100
AXES = {"wght": 700, "BEVL": 100}


def used_chars() -> str:
    chars = set()
    for p in (ROOT / "src").rglob("*.ts"):
        chars.update(re.findall(r"[　-鿿＀-￯]", p.read_text(encoding="utf-8")))
    chars.update(chr(c) for c in range(0x20, 0x7F))
    chars.update("…—·「」『』《》【】、。，！？：；“”‘’（）%")
    return "".join(sorted(chars))


def main():
    font = TTFont(str(SRC))
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, AXES)
    text = used_chars()
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(OUT))
    print(f"保留 {len(text)} 个字符 → {OUT.relative_to(ROOT)}  {OUT.stat().st_size // 1024} KB（原文件 {SRC.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
