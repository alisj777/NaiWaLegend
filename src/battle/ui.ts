import Phaser from 'phaser';
import { FONT, TITLE_FONT } from './art';

/**
 * 统一界面风格：配合 3D 软胶素材的暖色调——奶油色圆角面板、棕色描边、暖黄色标题、胶囊按钮。
 * 所有场景的面板、文字框、按钮都用这里的工具，改风格只改这一个文件。
 */
export const THEME = {
  cream: 0xfff4d6,
  creamDeep: 0xf3dfae,
  brown: 0x9a6a3c,
  brownDark: 0x5a3a22,
  orange: 0xf0a860,
  green: 0x8cc152,
  blue: 0x6aa9d8,
  grey: 0xb7a58c,
  /** 文字颜色 */
  text: '#5a3a22',
  textSoft: '#8a6a4a',
  title: '#ffe066',
  titleStroke: '#6a3d16',
  light: '#fffaf0',
} as const;

/** 全局圆角半径：整体风格圆润，不要尖角 */
export const RADIUS = 14;

const darken = (c: number, pct: number) => Phaser.Display.Color.ValueToColor(c).darken(pct).color;
const toCss = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** 普通文字（白色或指定颜色），用在深色背景上时建议配合 setStroke */
export function label(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = '#ffffff') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}

/**
 * 标题 / 小标题：系统最粗字重 + 浅黄到橙色的竖向渐变 + 粗棕色描边 + 投影。
 * 如果之后调用 setColor()，会改成纯色（比如失败时用红色）。
 */
export function titleText(scene: Phaser.Scene, x: number, y: number, s: string, size = 40) {
  const t = scene.add
    .text(x, y, s, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: THEME.title, padding: { x: 4, y: 4 } })
    .setStroke(THEME.titleStroke, Math.max(5, size / 5))
    .setShadow(0, Math.max(3, size / 12), '#00000077', 4, true, true);
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0, '#fff8c2');
  g.addColorStop(0.5, '#ffd84a');
  g.addColorStop(1, '#ffa628');
  t.setFill(g);
  return t;
}

/** 正文：深棕色，用在奶油色面板上 */
export function bodyText(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, wrap?: number) {
  return scene.add.text(x, y, s, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: THEME.text,
    lineSpacing: Math.round(size * 0.45),
    wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined,
  });
}

/** 浅色描边字（小标题、提示）：直接压在图片或场地上时用，保证在任何背景上都看得清 */
export function outlineText(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color: string = THEME.light) {
  return scene.add
    .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' })
    .setStroke(toCss(THEME.brownDark), Math.max(3, size / 4))
    .setShadow(0, 1, '#00000055', 2, true, true);
}

/** 奶油色圆角面板（带投影和描边），左上角为 (x, y) */
export function creamPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, r = 22) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.22).fillRoundedRect(x + 2, y + 6, w, h, r);
  g.fillStyle(THEME.cream).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(4, THEME.brown).strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5));
  return g;
}

/**
 * 九宫格切分（贴图像素）：[左, 右, 上, 下]。四个角保持原样，只拉伸中间和四条边。
 * 贴图是游戏显示尺寸的 2 倍，所以按 2 倍尺寸生成再缩小一半，角的大小正好。
 */
const SLICES: Record<string, [number, number, number?, number?]> = {
  'ui-scroll-wide': [72, 72, 56, 56], // 左右两根竖轴
  'ui-scroll-tall': [112, 112, 122, 122], // 上下两根横轴
  'ui-button': [90, 90, 56, 72], // 木质按钮（底边厚一点）
  'ui-tag': [118, 118], // 缎带：只左右切三段
};

/** 按九宫格拉伸一张界面贴图，左上角为 (x, y)，显示尺寸 w×h */
export function sliced(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, scale = 0.5) {
  const [l, r, t, b] = SLICES[key];
  const ns = t === undefined ? scene.add.nineslice(x, y, key, undefined, w / scale, h / scale, l, r) : scene.add.nineslice(x, y, key, undefined, w / scale, h / scale, l, r, t, b);
  return ns.setOrigin(0).setScale(scale);
}

/**
 * 卷轴面板：有卷轴素材就用卷轴（wide = 左右竖轴，tall = 上下横轴），没有就用奶油色圆角面板。
 * 左上角为 (x, y)。
 */
export function scrollPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: 'wide' | 'tall' = 'wide') {
  const key = kind === 'wide' ? 'ui-scroll-wide' : 'ui-scroll-tall';
  if (!scene.textures.exists(key)) return creamPanel(scene, x, y, w, h);
  return sliced(scene, key, x, y, w, h);
}

/** 兼容旧接口：半透明圆角面板 */
export function roundPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, _color = 0, _alpha = 1, _stroke = 0) {
  return creamPanel(scene, x, y, w, h);
}

/**
 * 小标签，比如剧情页标题、"第 1/6 页"。默认（橙色）用红色缎带素材；指定其他颜色（如系统的蓝色）时用胶囊形。
 */
export function pill(scene: Phaser.Scene, x: number, y: number, s: string, color: number = THEME.orange, size = 17) {
  if (color === THEME.orange && scene.textures.exists('ui-tag')) {
    const t = scene.add.text(0, -2, s, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: '#ffffff' }).setOrigin(0.5);
    t.setStroke('#8a2a1a', 4);
    const h = size * 2.3;
    const w = t.width + h * 2.6;
    const bg = sliced(scene, 'ui-tag', -w / 2, -h / 2, w, h);
    return scene.add.container(x, y, [bg, t]);
  }
  const t = scene.add.text(0, 0, s, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  t.setStroke(toCss(darken(color, 40)), 4);
  const w = t.width + size * 1.6;
  const h = size * 1.9;
  const g = scene.add.graphics();
  g.fillStyle(darken(color, 25)).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
  g.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.lineStyle(2, 0xffffff, 0.6).strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
  return scene.add.container(x, y, [g, t]);
}

/** 胶囊按钮：左上角为 (x, y)。按下有下沉效果；接口和原来的按钮一样 */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  /** 有木质按钮素材时用贴图（九宫格拉伸），按颜色轻微染色 */
  private img?: Phaser.GameObjects.NineSlice;
  private txt: Phaser.GameObjects.Text;
  private hover = false;
  private down = false;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private bw: number,
    private bh: number,
    label: string,
    private onClick: () => void,
    private color: number = THEME.orange,
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    const hit = scene.add.rectangle(0, 0, bw, bh, 0xffffff, 0.001).setOrigin(0);
    const size = Math.min(18, Math.max(13, Math.round(bh * 0.3)));
    this.txt = scene.add
      .text(bw / 2, bh / 2 - 2, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', align: 'center', fontStyle: 'bold' })
      .setOrigin(0.5);
    if (scene.textures.exists('ui-button')) this.img = sliced(scene, 'ui-button', 0, 0, bw, bh);
    this.add(this.img ? [this.bg, this.img, hit, this.txt] : [this.bg, hit, this.txt]);
    this.setSize(bw, bh);
    this.draw();
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!this.enabled) return;
      this.down = true;
      this.draw();
      scene.time.delayedCall(90, () => ((this.down = false), this.draw()));
      this.onClick();
    });
    hit.on('pointerover', () => ((this.hover = true), this.draw()));
    hit.on('pointerout', () => ((this.hover = false), (this.down = false), this.draw()));
    scene.add.existing(this);
  }

  private draw() {
    if (this.img) {
      // 木质按钮：所有按钮都保持原木色，不染色；按下时下沉、稍微变暗
      const sink = this.down ? 3 : 0;
      this.img.setY(sink).setTint(this.down ? 0xd9d9d9 : 0xffffff);
      this.txt.setY(this.bh * 0.44 + sink).setStroke('#5a3a22', 5);
      return;
    }
    const r = Math.min(this.bh / 2, 22);
    const edge = 4;
    const sink = this.down ? edge - 1 : 0;
    const base = this.hover && this.enabled ? Phaser.Display.Color.ValueToColor(this.color).lighten(8).color : this.color;
    const g = this.bg.clear();
    // 底部深色边，形成"可以按下去"的实体感
    g.fillStyle(darken(this.color, 28)).fillRoundedRect(0, edge, this.bw, this.bh - edge, r);
    g.fillStyle(base).fillRoundedRect(0, sink, this.bw, this.bh - edge, r);
    // 上半部柔光
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(4, sink + 3, this.bw - 8, (this.bh - edge) / 2 - 3, Math.max(4, r - 4));
    g.lineStyle(2, darken(this.color, 35), 0.9).strokeRoundedRect(0, sink, this.bw, this.bh - edge, r);
    this.txt.setY((this.bh - edge) / 2 + sink).setStroke(toCss(darken(this.color, 45)), 4);
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
    this.setAlpha(on ? 1 : 0.45);
    this.draw();
    return this;
  }
}
