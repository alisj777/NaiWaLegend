import Phaser from 'phaser';
import { SYSTEM_ANIM, storyKey } from '../assets';

/**
 * 引导角色「系统」：每一章开场时从画面一侧飘进来，停在引导文字旁边，之后轻轻上下浮动。
 * 有序列帧动画就播放动画，没有就用静态图，再没有就用代码画的小幽灵。
 *
 *   const guide = showGuide(this, 180, 240, { from: 'left', depth: 101 });
 *   guide.leave();   // 引导结束时飘走
 */
export interface Guide {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;
  leave(): void;
}

export function showGuide(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { from?: 'left' | 'right'; height?: number; depth?: number; delay?: number } = {},
): Guide {
  const { from = 'right', height = 210, depth = 50, delay = 0 } = opts;
  let obj: Guide['obj'];
  if (scene.textures.exists('system-anim') && scene.anims.exists(SYSTEM_ANIM)) {
    const sp = scene.add.sprite(x, y, 'system-anim');
    sp.play(SYSTEM_ANIM);
    sp.setScale(height / sp.height);
    obj = sp;
  } else if (scene.textures.exists(storyKey('system'))) {
    const img = scene.add.image(x, y, storyKey('system'));
    img.setScale(height / img.height);
    obj = img;
  } else {
    obj = ghostPlaceholder(scene, x, y, height);
  }
  obj.setDepth(depth).setAlpha(0);

  // 从侧面飘进来
  const dx = from === 'left' ? -280 : 280;
  obj.setX(x + dx).setY(y + 30);
  scene.tweens.add({ targets: obj, x, y, alpha: 1, duration: 900, delay, ease: 'Back.out' });
  // 到位后轻轻上下浮动
  scene.tweens.add({ targets: obj, y: y - 12, yoyo: true, repeat: -1, duration: 1500, delay: delay + 900, ease: 'Sine.inOut' });

  return {
    obj,
    leave() {
      scene.tweens.killTweensOf(obj);
      scene.tweens.add({ targets: obj, x: obj.x - dx * 0.6, y: obj.y - 60, alpha: 0, duration: 600, ease: 'Sine.in', onComplete: () => obj.destroy() });
    },
  };
}

/** 没有系统素材时的占位：代码画的半透明蓝色小幽灵 */
function ghostPlaceholder(scene: Phaser.Scene, x: number, y: number, height: number) {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x6ec6ff, 0.25).fillCircle(0, 0, 150);
  g.fillStyle(0x8fd3ff, 0.75).fillEllipse(0, -20, 200, 230);
  g.fillTriangle(-100, 40, -60, 40, -80, 130).fillTriangle(-40, 60, 0, 60, -20, 140).fillTriangle(20, 60, 60, 60, 40, 130).fillTriangle(70, 40, 100, 40, 85, 110);
  g.fillStyle(0xffffff, 0.9).fillCircle(-38, -50, 16).fillCircle(38, -50, 16);
  g.fillStyle(0x1f6f3f).fillCircle(-36, -50, 9).fillCircle(40, -50, 9);
  g.lineStyle(4, 0x2a4a6a, 0.9).lineBetween(-28, -10, 28, -10);
  g.setScale(height / 300);
  return g;
}
