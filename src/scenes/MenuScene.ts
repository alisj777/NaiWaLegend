import Phaser from 'phaser';
import { MENU_TEXT as TX } from '../copy/menu';
import { Button, THEME, outlineText, scrollPanel, titleText } from '../battle/ui';
import { coverImage, fitScreen, fullBg, matchPageColorToImage, screenEdges } from '../battle/layout';
import { platform } from '../platform';
import { playBgm } from '../battle/music';
import { loadLevel } from '../progress';

/**
 * 首页：村子背景铺满屏幕，大标题，右边大笑的奶蛙、左边奶蛋，中间三个胶囊按钮。
 * 文案在 src/copy/menu.ts。
 */
export class MenuScene extends Phaser.Scene {
  private fsBtn?: Button;

  constructor() {
    super('Menu');
  }

  create() {
    this.fsBtn = undefined;
    fitScreen(this, () => this.placeEdges());
    fullBg(this, 0x9ccf7a);
    playBgm(this, 'happy');
    if (this.textures.exists('menu-village')) {
      coverImage(this, 'menu-village');
      matchPageColorToImage(this, 'menu-village');
    }
    // 底部一层淡淡的暖色渐变，让按钮区更突出，背景仍然明亮
    this.add.graphics().fillGradientStyle(0x5a3a22, 0x5a3a22, 0x5a3a22, 0x5a3a22, 0, 0, 0.4, 0.4).fillRect(-1280, 300, 3840, 800);

    // 角色立绘：轻轻上下浮动
    if (this.textures.exists('menu-egg')) {
      const egg = this.add.image(250, 690, 'menu-egg').setOrigin(0.5, 1);
      egg.setScale(220 / egg.height);
      this.tweens.add({ targets: egg, y: 676, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    }
    if (this.textures.exists('menu-frog')) {
      const frog = this.add.image(1040, 712, 'menu-frog').setOrigin(0.5, 1);
      frog.setScale(470 / frog.height);
      this.tweens.add({ targets: frog, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
    }

    // 标题
    const title = titleText(this, 640, 140, TX.title, 96).setOrigin(0.5);
    // 标题太长时按宽度缩小，避免超出屏幕
    if (title.width > 1120) title.setScale(1120 / title.width);
    this.tweens.add({ targets: title, y: 150, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' });
    outlineText(this, 640, 232, TX.subtitle, 24).setOrigin(0.5);

    // 按钮放在一个面板里（以后换成卷轴风格的 UI 框素材）。对战模式暂时不放出来
    const bw = 320;
    const bh = 68;
    const x = 640 - bw / 2;
    const panel = this.add.container(0, 0).setAlpha(0.96);
    // 上下两根横轴的卷轴，按钮放在中间的纸面上
    // 通过第一关（等级 ≥ 2）后多出第二关入口，卷轴跟着变高
    // 通过第二关（等级 ≥ 3）后多出第三章入口；开发时总是显示，方便测试
    const has2 = loadLevel() >= 2 || import.meta.env.DEV;
    const has3 = loadLevel() >= 3 || import.meta.env.DEV;
    // 四个按钮时按钮矮一点、挨近一点，卷轴不超出屏幕
    const h = has3 ? 60 : bh;
    const gap = has3 ? 74 : 88;
    const y0 = has3 ? 318 : 330;
    panel.add(scrollPanel(this, x - 70, 250, bw + 140, has3 ? 410 : has2 ? 400 : 320, 'tall'));
    new Button(this, x, y0, bw, h, TX.start, () => this.scene.start('Story'), THEME.orange);
    new Button(this, x, y0 + gap, bw, h, TX.stage1, () => this.scene.start('Stage1'), THEME.green);
    if (has2) new Button(this, x, y0 + gap * 2, bw, h, TX.stage2, () => this.scene.start('Story', { chapter: 'ch2' }), THEME.blue);
    if (has3) new Button(this, x, y0 + gap * 3, bw, h, TX.stage3, () => this.scene.start('Stage3'), THEME.orange);

    // 手机网页：全屏并锁定横屏（安卓支持；iPhone 的 Safari 不支持网页全屏，可以"添加到主屏幕"后打开）
    if (platform.canRequestFullscreen()) {
      this.fsBtn = new Button(this, 0, 20, 150, 48, TX.fullscreen, () => platform.requestFullscreenLandscape(), THEME.grey);
    }
    this.placeEdges();
  }

  /** 贴屏幕右上角的东西，屏幕宽度变化时重新摆放 */
  private placeEdges() {
    this.fsBtn?.setX(screenEdges(this).right - 150 - 24);
  }
}
