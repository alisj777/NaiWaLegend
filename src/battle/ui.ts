import Phaser from 'phaser';
import { FONT } from './art';

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private txt: Phaser.GameObjects.Text;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    private onClick: () => void,
    private color = 0x3b4a66,
  ) {
    super(scene, x, y);
    this.bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(2, 0xffffff, 0.25).setOrigin(0);
    this.txt = scene.add
      .text(w / 2, h / 2, label, { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    this.add([this.bg, this.txt]);
    this.setSize(w, h);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.enabled) this.onClick();
    });
    this.bg.on('pointerover', () => this.enabled && this.bg.setFillStyle(Phaser.Display.Color.ValueToColor(this.color).lighten(15).color));
    this.bg.on('pointerout', () => this.bg.setFillStyle(this.color));
    scene.add.existing(this);
  }

  setLabel(s: string) {
    if (this.txt.text !== s) this.txt.setText(s);
    return this;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.38);
    return this;
  }
}

export function label(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = '#ffffff') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}
