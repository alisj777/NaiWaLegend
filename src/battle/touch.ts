import Phaser from 'phaser';
import { FONT } from './art';
import { platform } from '../platform';

export type Dir4 = 'up' | 'down' | 'left' | 'right';

/**
 * 浮动虚拟摇杆：手指按在 zone 区域内任意位置，摇杆底座就出现在那里，拖动小圆球控制方向。
 * 松手后底座回到默认位置并变淡。网格移动只需要 4 个方向，所以按主轴取方向，
 * 并带一点"粘滞"：斜着推时不会在两个方向之间来回跳。
 */
export class VirtualJoystick {
  dir: Dir4 | null = null;
  private pointerId = -1;
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;
  private cx: number;
  private cy: number;

  constructor(
    scene: Phaser.Scene,
    private home: { x: number; y: number },
    private zone: Phaser.Geom.Rectangle,
    private radius = 72,
    private enabled: () => boolean = () => true,
    /**
     * 把手指位置换算成摇杆所在的坐标系。默认用 Phaser 的 worldX/worldY；
     * 场景有多个镜头时（如第一关的场地镜头 + 界面镜头）必须传入，否则手指位置会被按错误的镜头换算。
     */
    private toLocal: (p: Phaser.Input.Pointer) => { x: number; y: number } = (p) => ({ x: p.worldX, y: p.worldY }),
  ) {
    this.cx = home.x;
    this.cy = home.y;
    this.base = scene.add.graphics().setDepth(90);
    this.knob = scene.add.graphics().setDepth(91);
    this.draw(false);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // 用世界坐标：全屏适配后镜头会平移，屏幕坐标和场景坐标不一致
      const l = this.toLocal(p);
      if (this.pointerId !== -1 || !this.enabled() || !this.zone.contains(l.x, l.y)) return;
      this.pointerId = p.id;
      // 底座跟着手指落点走，但不能贴出屏幕
      this.cx = Phaser.Math.Clamp(l.x, this.zone.x + radius, this.zone.right - radius * 0.4);
      this.cy = Phaser.Math.Clamp(l.y, this.zone.y + radius * 0.4, this.zone.bottom - radius);
      this.move(p);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      // 防卡死：卡顿时"松手"事件可能丢失，手指其实已经离开屏幕就直接松开
      if (!p.isDown) return this.release();
      this.move(p);
    });
    // 每帧再检查一次：记录的那根手指已经不在屏幕上了，就松开（否则摇杆会一直以为被按着，后面的触摸全被忽略）
    const check = () => {
      if (this.pointerId === -1) return;
      const p = scene.input.manager.pointers.find((q) => q.id === this.pointerId);
      if (!p || !p.isDown) this.release();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, check);
    // 场景关闭（比如"重新挑战"）时移除，否则旧摇杆的检查会留下来、操作已经销毁的图形
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, check));
    const up = (p: Phaser.Input.Pointer) => p.id === this.pointerId && this.release();
    scene.input.on('pointerup', up);
    scene.input.on('pointerupoutside', up);
    scene.input.on('gameout', () => this.release());
  }

  /** 屏幕尺寸变化时重新摆放：默认位置和可触发区域 */
  setPlacement(home: { x: number; y: number }, zone: Phaser.Geom.Rectangle) {
    this.home = home;
    this.zone = zone;
    if (this.pointerId === -1) this.release();
  }

  release() {
    this.pointerId = -1;
    this.dir = null;
    this.cx = this.home.x;
    this.cy = this.home.y;
    this.draw(false);
  }

  private move(p: Phaser.Input.Pointer) {
    const l = this.toLocal(p);
    let dx = l.x - this.cx;
    let dy = l.y - this.cy;
    const len = Math.hypot(dx, dy);
    const max = this.radius * 0.7;
    if (len > max) (dx *= max / len), (dy *= max / len);

    if (len < this.radius * 0.25) {
      this.dir = null; // 死区：轻轻碰一下不动
    } else {
      const horiz = Math.abs(dx) > Math.abs(dy);
      const next: Dir4 = horiz ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      // 粘滞：除非新方向明显占优（主轴超过副轴 1.3 倍），否则保持原方向
      const keep = this.dir && this.dir !== next && Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(Math.abs(dx), Math.abs(dy)) * 1.3;
      if (!keep) this.dir = next;
    }
    this.draw(true, dx, dy);
  }

  private draw(active: boolean, kx = 0, ky = 0) {
    const r = this.radius;
    const b = this.base.clear().setPosition(this.cx, this.cy);
    b.fillStyle(0xffffff, active ? 0.14 : 0.08).fillCircle(0, 0, r);
    b.lineStyle(3, 0xffffff, active ? 0.35 : 0.2).strokeCircle(0, 0, r);
    // 四个方向的小圆点提示，当前方向高亮成一段柔和的弧
    const dirs: [Dir4, number][] = [['right', 0], ['down', Math.PI / 2], ['left', Math.PI], ['up', -Math.PI / 2]];
    for (const [d, a] of dirs) {
      const on = active && this.dir === d;
      if (on) b.lineStyle(8, 0xfff27a, 0.55).beginPath().arc(0, 0, r - 6, a - 0.5, a + 0.5).strokePath();
      b.fillStyle(0xffffff, on ? 0.7 : 0.3).fillCircle(Math.cos(a) * (r - 18), Math.sin(a) * (r - 18), 5);
    }
    const k = this.knob.clear().setPosition(this.cx + kx, this.cy + ky);
    k.fillStyle(0xffffff, active ? 0.42 : 0.22).fillCircle(0, 0, r * 0.42);
    k.lineStyle(2, 0xffffff, 0.5).strokeCircle(0, 0, r * 0.42);
  }
}

/**
 * 半透明圆形按键（举起 / 技能等）。按下会缩一下，支持多指同时按。
 */
export class RoundButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private r: number,
    label: string,
    private onPress: () => void,
    private color = 0xf0a860,
    fontSize = 18,
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.txt = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.txt.setShadow(0, 1, '#00000088', 3);
    this.add([this.bg, this.txt]);
    this.draw(false);
    const hit = scene.add.circle(0, 0, r, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    this.addAt(hit, 0);
    hit.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!this.enabled) return;
      this.draw(true);
      platform.vibrate();
      scene.tweens.add({ targets: this, scale: 0.9, duration: 60, yoyo: true });
      this.onPress();
    });
    const up = () => this.draw(false);
    hit.on('pointerup', up);
    hit.on('pointerout', up);
    this.setDepth(90);
    scene.add.existing(this);
  }

  private draw(pressed: boolean) {
    const r = this.r;
    this.bg.clear();
    this.bg.fillStyle(this.color, pressed ? 0.6 : 0.38).fillCircle(0, 0, r);
    this.bg.lineStyle(3, 0xffffff, pressed ? 0.6 : 0.35).strokeCircle(0, 0, r);
    // 上半部一层柔光，让按键看起来圆润
    this.bg.fillStyle(0xffffff, 0.1).fillEllipse(0, -r * 0.35, r * 1.3, r * 0.8);
  }

  setLabel(s: string) {
    if (this.txt.text !== s) this.txt.setText(s);
    return this;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.4);
    return this;
  }
}
