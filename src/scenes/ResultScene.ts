import Phaser from 'phaser';
import { Button, THEME, bodyText, scrollPanel, titleText } from '../battle/ui';
import { fitScreen, fullBg } from '../battle/layout';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: { win: boolean; reason: string; elapsed: number }) {
    fitScreen(this);
    fullBg(this, data.win ? 0x3d5a2e : 0x4a2a26);
    scrollPanel(this, 300, 150, 680, 400);
    titleText(this, 640, 230, data.win ? '胜利！' : '失败', 72).setOrigin(0.5).setColor(data.win ? THEME.title : '#ff9a8a');
    bodyText(this, 640, 320, data.reason, 24).setOrigin(0.5);
    bodyText(this, 640, 362, `用时 ${Math.round(data.elapsed)} 秒`, 18).setOrigin(0.5).setColor(THEME.textSoft);
    new Button(this, 420, 440, 200, 64, '再来一局', () => this.scene.start('Battle', { tutorial: false }), THEME.orange);
    new Button(this, 660, 440, 200, 64, '返回菜单', () => this.scene.start('Menu'), THEME.blue);
  }
}
