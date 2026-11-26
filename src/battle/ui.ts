import Phaser from 'phaser';
import { FONT } from './art';

/** 全局圆角半径：整体风格圆润，不要尖角 */
export const RADIUS = 14;

/** 画一个半透明圆角面板（弹窗、卡片底板等） */
export function roundPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = 0x232a38, alpha = 0.92, stroke = 0xffffff) {
  const g = scene.add.graphics();
  g.fillStyle(color, alpha).fillRoundedRect(x, y, w, h, RADIUS * 1.5);
  g.lineStyle(2, stroke, 0.25).strokeRoundedRect(x, y, w, h, RADIUS * 1.5);
  return g;
}

/** 圆角半透明按钮。左上角为 (x, y)，接口和原来的矩形按钮一样 */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  private hover = false;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private bw: number,
    private bh: number,
    label: string,
    private onClick: () => void,
    private color = 0x3b4a66,
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    const hit = scene.add.rectangle(0, 0, bw, bh, 0xffffff, 0.001).setOrigin(0);
    this.txt = scene.add
      .text(bw / 2, bh / 2, label, { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    this.add([this.bg, hit, this.txt]);
    this.setSize(bw, bh);
    this.draw();
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!this.enabled) return;
      scene.tweens.add({ targets: this.bg, alpha: 0.6, duration: 60, yoyo: true });
      this.onClick();
    });
    hit.on('pointerover', () => ((this.hover = true), this.draw()));
    hit.on('pointerout', () => ((this.hover = false), this.draw()));
    scene.add.existing(this);
  }

  private draw() {
    const r = Math.min(RADIUS, this.bh / 2);
    const fill = this.hover && this.enabled ? Phaser.Display.Color.ValueToColor(this.color).lighten(15).color : this.color;
    this.bg.clear();
    this.bg.fillStyle(fill, 0.78).fillRoundedRect(0, 0, this.bw, this.bh, r);
    // 上半部一层柔光
    this.bg.fillStyle(0xffffff, 0.08).fillRoundedRect(2, 2, this.bw - 4, this.bh / 2 - 2, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    this.bg.lineStyle(2, 0xffffff, 0.22).strokeRoundedRect(0, 0, this.bw, this.bh, r);
  }

  setLabel(s: string) {
    if (this.txt.text !== s) this.txt.setText(s);
    return this;
  }

  /** 换底色（比如手牌按卡牌种类着色） */
  setColor(c: number) {
    if (c !== this.color) {
      this.color = c;
      this.draw();
    }
    return this;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.38);
    this.draw();
    return this;
  }
}

export function label(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = '#ffffff') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}
