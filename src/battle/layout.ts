import Phaser from 'phaser';
import { platform } from '../platform';

/**
 * 全屏适配：游戏按 1280×720 设计，画布宽高比跟随屏幕（fitGameToScreen）。
 * 屏幕比 16:9 更宽（如 iPhone 横屏约 19.5:9）时，画布会变宽；
 * 这里把镜头移到设计区域正中，左右多出来的部分用背景补满，不再有黑边。
 *
 * 用法：每个场景 create() 一开始调用 fitScreen(this)，全屏背景用 fullBg()。
 * 需要贴着屏幕真正边缘的东西（摇杆、按键）用 screenEdges() 取左右边界。
 */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/**
 * 让游戏画布的宽高比始终和屏幕一致：高度固定 720（屏幕比 16:9 更方时宽度固定 1280），
 * 再由 FIT 模式等比填满，所以画布正好铺满浏览器的可用区域，没有黑边。
 * iPhone 转屏 / 地址栏伸缩后报的尺寸会晚到，所以变化后再延迟检查两次。
 */
export function fitGameToScreen(game: Phaser.Game) {
  const apply = () => {
    // 按游戏容器（#game，铺满整个屏幕，包括刘海区域）的实际大小算比例，画布才能正好贴满，没有黑边
    const parent = game.scale.parent as HTMLElement | null;
    const rect = parent?.getBoundingClientRect();
    const vw = rect?.width || window.innerWidth;
    const vh = rect?.height || window.innerHeight;
    if (!vw || !vh) return;
    const aspect = vw / vh;
    const w = aspect >= DESIGN_W / DESIGN_H ? Math.round(DESIGN_H * aspect) : DESIGN_W;
    const h = aspect >= DESIGN_W / DESIGN_H ? DESIGN_H : Math.round(DESIGN_W / aspect);
    cssToGame = w / vw;
    readSafeArea();
    // FIT 模式要用 setGameSize：它会同时更新画布分辨率和显示比例（resize 只改分辨率，画面会被拉变形）
    if (w !== game.scale.width || h !== game.scale.height) game.scale.setGameSize(w, h);
    else game.scale.refresh();
  };
  const later = () => {
    apply();
    setTimeout(apply, 150);
    setTimeout(apply, 600);
  };
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  window.visualViewport?.addEventListener('resize', later);
  game.events.once(Phaser.Core.Events.READY, later);
}

/**
 * 安全区（iPhone 刘海、圆角、底部横条）：背景可以铺进去，但按钮、文字、场地要避开。
 * 用 index.html 里的 #safe-probe（padding 设成 env(safe-area-inset-*)）读出 CSS 像素，再换算成游戏坐标。
 */
let cssToGame = 1;
const safe = { left: 0, right: 0, top: 0, bottom: 0 };
function readSafeArea() {
  const probe = document.getElementById('safe-probe');
  if (!probe) return;
  const st = getComputedStyle(probe);
  safe.left = (parseFloat(st.paddingLeft) || 0) * cssToGame;
  safe.right = (parseFloat(st.paddingRight) || 0) * cssToGame;
  safe.top = (parseFloat(st.paddingTop) || 0) * cssToGame;
  safe.bottom = (parseFloat(st.paddingBottom) || 0) * cssToGame;
}

/** 设计区域之外，左右 / 上下各多出来多少（世界坐标） */
export function screenExtra(scene: Phaser.Scene) {
  return {
    x: Math.max(0, (scene.scale.width - DESIGN_W) / 2),
    y: Math.max(0, (scene.scale.height - DESIGN_H) / 2),
  };
}

/**
 * 屏幕可见范围的左右上下边界（世界坐标）。
 * 默认扣掉安全区（刘海等），给按钮、文字、场地摆位置用；背景图要铺满整个屏幕时传 safe = false。
 */
export function screenEdges(scene: Phaser.Scene, useSafe = true) {
  const e = screenExtra(scene);
  const s = useSafe ? safe : { left: 0, right: 0, top: 0, bottom: 0 };
  return { left: -e.x + s.left, right: DESIGN_W + e.x - s.right, top: -e.y + s.top, bottom: DESIGN_H + e.y - s.bottom };
}

/** 把镜头对准设计区域正中；屏幕旋转或尺寸变化时自动重新对准，并通知场景重新摆放贴边元素 */
export function fitScreen(scene: Phaser.Scene, onResize?: () => void) {
  const apply = () => {
    const e = screenExtra(scene);
    scene.cameras.main.setScroll(-e.x, -e.y);
    onResize?.();
  };
  apply();
  scene.scale.on('resize', apply);
  scene.events.once('shutdown', () => scene.scale.off('resize', apply));
}

/** 取一张图左右边缘的平均颜色，设成网页底色（背景是图片时用，刘海和底部区域就和图片边缘接近） */
export function matchPageColorToImage(scene: Phaser.Scene, key: string) {
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const w = src.width;
  const h = src.height;
  if (!w || !h) return;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const x of [2, w - 3]) {
    for (let i = 1; i < 10; i++) {
      const c = scene.textures.getPixel(x, Math.floor((h * i) / 10), key);
      if (!c) continue;
      r += c.red;
      g += c.green;
      b += c.blue;
      n++;
    }
  }
  if (n) platform.setPageColor((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n));
}

/** 铺满整个屏幕（包括设计区域外）的纯色背景；不透明时顺便把网页底色设成同一个颜色（刘海、底部区域就不会是黑的） */
export function fullBg(scene: Phaser.Scene, color: number, alpha = 1) {
  if (alpha >= 1) platform.setPageColor(color);
  return scene.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W * 3, DESIGN_H * 3, color, alpha);
}

/** 背景图按"铺满屏幕"缩放（多出来的部分裁掉），始终覆盖可见范围 */
export function coverImage(scene: Phaser.Scene, key: string) {
  const img = scene.add.image(DESIGN_W / 2, DESIGN_H / 2, key);
  const fit = () => {
    const e = screenExtra(scene);
    const w = DESIGN_W + e.x * 2;
    const h = DESIGN_H + e.y * 2;
    img.setScale(Math.max(w / img.width, h / img.height));
  };
  fit();
  scene.scale.on('resize', fit);
  scene.events.once('shutdown', () => scene.scale.off('resize', fit));
  return img;
}
