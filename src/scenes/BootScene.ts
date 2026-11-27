import Phaser from 'phaser';
import { SPRITESHEETS, allAssets } from '../assets';
import { FONT } from '../battle/art';
import { platform } from '../platform';
import { fitScreen, fullBg } from '../battle/layout';

/**
 * 启动加载页：预载全部图片和音频，显示百分比进度条，加载完进入菜单。
 * 某个文件加载失败不会卡住，只是对应的地方改用代码画的样子。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Phaser 已经启动，关掉引擎加载前的启动画面
    platform.hideSplash();

    const W = 560;
    const H = 22;
    const x = 640 - W / 2;
    const y = 400;
    fitScreen(this);
    fullBg(this, 0x1d2330);
    this.add.text(640, 290, '奶蛙家族', { fontFamily: FONT, fontSize: '52px', color: '#fff27a' }).setOrigin(0.5).setStroke('#3a2a10', 6);
    this.add.graphics().fillStyle(0xffffff, 0.12).fillRoundedRect(x, y, W, H, H / 2);
    const bar = this.add.graphics();
    const pct = this.add.text(640, y + 52, '加载中 0%', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    const file = this.add.text(640, y + 86, '', { fontFamily: FONT, fontSize: '13px', color: '#9aa4b8' }).setOrigin(0.5);

    const draw = (p: number) => {
      bar.clear();
      const w = Math.max(H, W * p);
      bar.fillStyle(0xf0a860).fillRoundedRect(x, y, w, H, H / 2);
      bar.fillStyle(0xffffff, 0.25).fillRoundedRect(x + 4, y + 3, Math.max(0, w - 8), H / 2 - 3, (H / 2 - 3) / 2);
      pct.setText(`加载中 ${Math.round(p * 100)}%`);
    };
    draw(0);
    this.load.on('progress', draw);
    this.load.on('fileprogress', (f: Phaser.Loader.File) => file.setText(f.src ?? ''));

    const { images, audio, sheets } = allAssets();
    for (const [k, url] of images) this.load.image(k, url);
    for (const [k, url] of audio) this.load.audio(k, url);
    for (const [k, s] of sheets) this.load.spritesheet(k, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
  }

  create() {
    // 序列帧动画只需要建一次，所有场景共用（清单在 src/assets.ts 的 SPRITESHEETS）
    for (const [key, sh] of Object.entries(SPRITESHEETS)) {
      if (this.textures.exists(key) && !this.anims.exists(sh.anim)) {
        this.anims.create({ key: sh.anim, frames: this.anims.generateFrameNumbers(key), frameRate: sh.fps, repeat: -1 });
      }
    }
    // 等标题字体就绪再进首页：Phaser 的文字创建时就画好了，字体晚到不会自动重画
    platform.waitFont('TitleFont', 3000).then(() => this.time.delayedCall(150, () => this.scene.start('Menu')));
  }
}
