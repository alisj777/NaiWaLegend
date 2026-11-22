import Phaser from 'phaser';
import { Button, label } from '../battle/ui';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: { win: boolean; reason: string; elapsed: number }) {
    this.add.rectangle(0, 0, 1280, 720, data.win ? 0x1f3326 : 0x33201f).setOrigin(0);
    label(this, 640, 220, data.win ? '胜利！' : '失败', 72, data.win ? '#fff27a' : '#ff8a80').setOrigin(0.5);
    label(this, 640, 320, data.reason, 24).setOrigin(0.5);
    label(this, 640, 365, `用时 ${Math.round(data.elapsed)} 秒`, 18, '#9aa4b8').setOrigin(0.5);
    new Button(this, 430, 450, 200, 60, '再来一局', () => this.scene.start('Battle'), 0x3b6e9b);
    new Button(this, 650, 450, 200, 60, '返回菜单', () => this.scene.start('Menu'));
  }
}
