import Phaser from 'phaser';
import { STAGE3_TEXT } from '../copy/stage3';
import { stage1Key, storyKey } from '../assets';
import { platform } from '../platform';
import { loadAchievements } from '../progress';
import { Button, THEME, bodyText, titleText } from './ui';
import { fullBg } from './layout';

const A = STAGE3_TEXT.achievements;

export type AchievementId = 'sigma' | 'selfTorment' | 'superMole' | 'cantHold' | 'breaker' | 'saveVillage' | 'goodTwist' | 'superMoleX3';

/**
 * 成就列表（成就页按这个顺序排）：
 *   key = 图片（贴图名）；card = 金框卡牌（名字写在底部横幅上），banner = 横幅中心在卡面高度的哪里；
 *   wide = 横图（结局插图），按宽度缩放
 */
export const ACHIEVEMENTS: { id: AchievementId; key: string; card: boolean; banner?: number; wide?: boolean }[] = [
  { id: 'sigma', key: stage1Key('achv_sigma'), card: false },
  { id: 'selfTorment', key: stage1Key('achv_torment'), card: false },
  { id: 'superMole', key: stage1Key('card_mole'), card: true, banner: 0.905 },
  { id: 'cantHold', key: stage1Key('card_cant_hold'), card: true, banner: 0.905 },
  { id: 'breaker', key: stage1Key('card_breaker'), card: true, banner: 0.905 },
  { id: 'saveVillage', key: storyKey('end_celebrate'), card: false, wide: true },
  { id: 'goodTwist', key: storyKey('end_jiejie'), card: false, wide: true },
  { id: 'superMoleX3', key: stage1Key('card_mole_x3'), card: true, banner: 0.945 },
];

/** 成就图在成就页小图标里用的贴图（结局插图没到时用西格玛 / 阴暗奶蛙代替） */
export function achievementKey(scene: Phaser.Scene, id: AchievementId) {
  const meta = ACHIEVEMENTS.find((a) => a.id === id)!;
  if (scene.textures.exists(meta.key)) return meta.key;
  return id === 'goodTwist' ? stage1Key('dark_sigma_twist') : stage1Key('sigma_shoot');
}

export function isUnlocked(id: AchievementId) {
  return loadAchievements().includes(id);
}

/**
 * 成就弹窗：半透明黑底 + 卡牌（或立绘）+ 名字 + 说明，下面「转发卡牌」「收下」。
 * hidden = 隐藏彩蛋（超能串子），顶部多一行「恭喜你解锁隐藏彩蛋！」。坐标按 1280×720 设计区域。
 */
export function showAchievement(scene: Phaser.Scene, id: AchievementId, opts: { hidden?: boolean; fresh?: boolean; depth?: number; onClose?: () => void } = {}) {
  const meta = ACHIEVEMENTS.find((a) => a.id === id)!;
  const info = A[id];
  const depth = opts.depth ?? 200;
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(fullBg(scene, 0x000000, 0.72).setInteractive());
  const top = opts.hidden ? A.hiddenEgg : opts.fresh ? A.unlocked : '';
  if (top) layer.add(titleText(scene, 640, 46, top, 34).setOrigin(0.5, 0));

  const key = achievementKey(scene, id);
  const cx = 470;
  const cy = 380;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(cx, cy, key);
    // 卡牌和立绘按高度缩放；横的结局插图按宽度
    const wide = meta.wide && scene.textures.exists(meta.key);
    const scale = wide ? 560 / img.width : (meta.card ? 520 : 440) / img.height;
    const h = img.height * scale;
    layer.add(img);
    // 卡牌：名字写在底部横幅上
    if (meta.card) layer.add(titleText(scene, cx, cy - h / 2 + h * (meta.banner ?? 0.905), info.name, 30).setOrigin(0.5));
    // 弹出动画
    img.setScale(scale * 0.6).setAlpha(0);
    scene.tweens.add({ targets: img, scale, alpha: 1, duration: 380, ease: 'Back.out' });
  }
  if (!meta.card) layer.add(titleText(scene, 860, 260, info.name, 34).setOrigin(0.5));
  layer.add(bodyText(scene, 860, meta.card ? 300 : 320, info.desc, 20, 360).setOrigin(0.5).setAlign('center').setColor('#fff6e0'));

  const btns: Button[] = [];
  const close = () => {
    btns.forEach((b) => b.destroy());
    layer.destroy();
    opts.onClose?.();
  };
  if (meta.card && info.share) {
    let told = false;
    btns.push(
      new Button(scene, 760, 420, 210, 60, id === 'superMole' ? A.shareMole : A.share, () => {
        platform.share(info.share);
        // 网页版还不能真的转发，提示一下（只提示一次）
        if (platform.name === 'web' && !told) layer.add(bodyText(scene, 860, 500, A.shared, 15, 360).setOrigin(0.5).setColor('#d8d0c0'));
        told = true;
      }, THEME.green),
    );
  }
  btns.push(new Button(scene, 760, meta.card && info.share ? 520 : 420, 210, 60, A.close, close, THEME.orange));
  btns.forEach((b) => b.setDepth(depth + 1));
  return layer;
}

/** 依次弹出多个成就（收下一个再弹下一个） */
export function showAchievements(scene: Phaser.Scene, list: { id: AchievementId; hidden?: boolean }[], onDone?: () => void) {
  const next = (k: number) => {
    if (k >= list.length) return onDone?.();
    showAchievement(scene, list[k].id, { hidden: list[k].hidden, fresh: true, onClose: () => next(k + 1) });
  };
  next(0);
}
