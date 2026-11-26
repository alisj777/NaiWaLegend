import Phaser from 'phaser';
import { STAGE1 as C } from '../config/stage1';
import { STAGE1_TEXT as TX } from '../copy/stage1';
import { currentSkin } from '../skins';
import * as art from '../battle/art';
import { Button, THEME, bodyText, creamPanel, label, outlineText, pill, scrollPanel, titleText } from '../battle/ui';
import { fitScreen, fullBg, screenEdges, screenExtra } from '../battle/layout';
import { playBgm } from '../battle/music';
import { showGuide } from '../battle/guide';
import { platform } from '../platform';
import { addToStash } from '../progress';
import { RoundButton, VirtualJoystick } from '../battle/touch';
import { AIController } from '../stage1/ai';
import { Actor, Dir, DIRS, Item, World, itemName } from '../stage1/world';
import { Stage1ImageKey, stage1Key } from '../assets';

/*
 * 布局：场地放大（每格 C.grid.viewTile 像素），比屏幕大，镜头跟着你移动（场地镜头）；
 * 文字信息、摇杆、按键固定在屏幕上（界面镜头），放在画面四角：
 *   左上：关卡名 + 剩余时间      右上：物资排名
 *   左下：我的状态（摇杆浮在左半屏）  右下：举起键
 *   顶部正中：狂风 / 灵泉倒计时；底部正中：提示消息
 * 场地上的东西都要用 this.W() 放进场地层，否则只会出现在界面镜头里。
 */
let T: number = C.grid.viewTile;
const OX = 0;
const OY = 0;
let FW = C.grid.cols * T;
let FH = C.grid.rows * T;
/** 当前每格边长（给需要默认参数的函数用） */
const TILE = () => T;
/** 相对原来 32 像素一格的缩放倍数，角色和物资的大小都按它放大 */
const S = () => T / 32;

/** 场地大小：每格固定边长，场地放在场地层的 (0, 0) */
function layoutField() {
  T = C.grid.viewTile;
  FW = C.grid.cols * T;
  FH = C.grid.rows * T;
}

/** 把一个对象（以及容器里的所有子对象）重新设为"所有镜头可见"，放进场地层后用 */
function clearCameraFilter(obj: Phaser.GameObjects.GameObject) {
  obj.cameraFilter = 0;
  if (obj instanceof Phaser.GameObjects.Container) obj.list.forEach(clearCameraFilter);
}

/** 摇杆半径 */
const STICK_R = 74;
/** 右下按键区：主键「举起」，旁边预留两个技能键位，以后各阶段的新技能放这里（相对主键的偏移） */
const KEYS = { r: 72, slots: [{ dx: -132, dy: 44, r: 44 }, { dx: -72, dy: -106, r: 44 }] };

/** 对手奶蛋的家（庇护所位置）。全场 3 个奶蛋：你 + 2 个对手，3 进 2 */
const RIVAL_HOMES = [
  [4, 3],
  [20, 9],
] as const;

interface ActorView {
  box: Phaser.GameObjects.Container;
  /** 奶蛋图片（有素材时），按朝向换图 */
  body: Phaser.GameObjects.Image | null;
  carry: Phaser.GameObjects.Graphics;
  carryImg: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Graphics;
  tag: Phaser.GameObjects.Text;
  carryKey: string;
}

const px = (x: number) => OX + x * T + T / 2;
const py = (y: number) => OY + y * T + T / 2;

/** 第一关的图片素材在 src/assets.ts，由启动加载页统一预载；缺哪张就退回代码画的样子 */
type ImgKey = Stage1ImageKey;
const K = stage1Key;

/** 物资对应的图片，以及在一格里显示的高度（像素） */
function itemImage(it: Item): { key: ImgKey; h: number } {
  if (it.kind === 'brick') return { key: 'brick', h: 18 * S() };
  if (it.kind === 'shovel') return { key: 'shovel', h: 28 * S() };
  return { key: it.fill === 'empty' ? 'bottle_empty' : it.fill === 'tea' ? 'bottle_tea' : 'bottle_milk', h: 27 * S() };
}

/**
 * 墙（俯视图，代码画）：
 *   没闭合 → 4 块零散的小砖，砖缝间露出草地，颜色偏浅
 *   闭合   → 连成一片的实心砖墙，深红色 + 奶油色砖缝 + 顶部高光，一眼能看出"封好了"
 */
function drawWall(g: Phaser.GameObjects.Graphics, x: number, y: number, closed: boolean, T: number = TILE()) {
  if (closed) {
    g.fillStyle(0x8e3f2a).fillRect(x, y, T, T);
    g.fillStyle(0xc0603e).fillRect(x, y, T, T * 0.14);
    g.fillStyle(0x5e2618).fillRect(x, y + T * 0.9, T, T * 0.1);
    g.lineStyle(Math.max(1, T / 24), 0xf3dfae, 0.9);
    for (const fy of [1 / 3, 2 / 3]) g.lineBetween(x, y + T * fy, x + T, y + T * fy);
    g.lineBetween(x + T / 2, y, x + T / 2, y + T / 3).lineBetween(x + T / 4, y + T / 3, x + T / 4, y + (2 * T) / 3);
    g.lineBetween(x + (3 * T) / 4, y + T / 3, x + (3 * T) / 4, y + (2 * T) / 3).lineBetween(x + T / 2, y + (2 * T) / 3, x + T / 2, y + T);
  } else {
    const p = T * 0.08;
    const bw = (T - p * 3) / 2;
    const bh = (T - p * 3) / 2;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const bx = x + p + cx * (bw + p) + (cy ? T * 0.05 : 0);
      const by = y + p + cy * (bh + p);
      g.fillStyle(0xd88a64).fillRoundedRect(bx, by, bw, bh, T * 0.08);
      g.lineStyle(Math.max(1, T / 28), 0x7a3522, 0.9).strokeRoundedRect(bx, by, bw, bh, T * 0.08);
    }
  }
}

/**
 * 开发模式：记录一帧里各部分花了多少毫秒。某一帧超过 50ms（明显卡顿）时，在屏幕顶部显示明细，
 * 并标出是不是在狂风期间，方便手机上截图排查。正式版不运行。
 */
class FrameProfiler {
  private t0 = performance.now();
  private last = this.t0;
  private parts: string[] = [];
  constructor(private dtMs: number) {}
  mark(name: string) {
    const now = performance.now();
    this.parts.push(`${name} ${(now - this.last).toFixed(1)}`);
    this.last = now;
  }
  /** 上次往网页写诊断信息的时间：最多每秒写一次，避免卡顿时每帧改网页、越写越卡 */
  static lastWrite = 0;
  done(gameT: number, windy: boolean) {
    if (this.dtMs < 100) return;
    const now = performance.now();
    if (now - FrameProfiler.lastWrite < 1000) return;
    FrameProfiler.lastWrite = now;
    let el = document.getElementById('dev-hitch');
    if (!el) {
      el = document.createElement('pre');
      el.id = 'dev-hitch';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:0;z-index:98;margin:0;padding:4px 8px;background:rgba(0,0,0,.7);color:#ff0;font:11px/1.4 monospace;pointer-events:none;max-height:30vh;overflow:hidden';
      document.body.appendChild(el);
    }
    const line = `卡顿 ${this.dtMs.toFixed(0)}ms @${gameT.toFixed(1)}s${windy ? ' [狂风中]' : ''} | ${this.parts.join(' | ')} (ms)`;
    el.textContent = (line + '\n' + el.textContent).split('\n').slice(0, 6).join('\n');
  }
}

/** 黄色虚线框（瞄准框），虚线会慢慢流动，提示"砖会放在这里" */
function dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number, lw: number, t: number) {
  const dash = Math.max(5, w / 6);
  const gap = dash * 0.6;
  const step = dash + gap;
  const off = (t * 30) % step;
  g.lineStyle(lw, color, alpha);
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    for (let d = -off; d < len; d += step) {
      const a = Math.max(0, d);
      const b = Math.min(len, d + dash);
      if (b > a) g.lineBetween(x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b);
    }
  };
  seg(x, y, x + w, y);
  seg(x + w, y, x + w, y + h);
  seg(x + w, y + h, x, y + h);
  seg(x, y + h, x, y);
  g.fillStyle(color, alpha * 0.15).fillRect(x, y, w, h);
}

/** 画一件物资（砖块 / 瓶子 / 铁锹），以 (x, y) 为中心 */
function drawItem(g: Phaser.GameObjects.Graphics, it: Item, x: number, y: number, s = 1) {
  if (it.kind === 'brick') {
    g.fillStyle(0xc9734f).fillRect(x - 12 * s, y - 7 * s, 24 * s, 14 * s);
    g.lineStyle(1.5, 0x7a3522).strokeRect(x - 12 * s, y - 7 * s, 24 * s, 14 * s);
    g.lineBetween(x - 12 * s, y, x + 12 * s, y).lineBetween(x, y - 7 * s, x, y).lineBetween(x - 6 * s, y, x - 6 * s, y + 7 * s);
  } else if (it.kind === 'shovel') {
    g.lineStyle(4 * s, 0x8a5a32).lineBetween(x - 10 * s, y - 12 * s, x + 4 * s, y + 4 * s);
    g.fillStyle(0xb8c2cc).fillTriangle(x + 1 * s, y + 1 * s, x + 14 * s, y + 4 * s, x + 6 * s, y + 14 * s);
  } else {
    if (it.fill !== 'empty') g.fillStyle(it.fill === 'tea' ? 0xc68b59 : 0xfdfcf5).fillRoundedRect(x - 7 * s, y - 4 * s, 14 * s, 15 * s, 3 * s);
    g.lineStyle(2, 0xe8f4ff).strokeRoundedRect(x - 7 * s, y - 8 * s, 14 * s, 19 * s, 4 * s);
    g.fillStyle(0x9ec5ff).fillRect(x - 4 * s, y - 13 * s, 8 * s, 5 * s);
  }
}

export class Stage1Scene extends Phaser.Scene {
  private world!: World;
  private me!: Actor;
  private ais: AIController[] = [];
  private views = new Map<number, ActorView>();
  private dyn!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private running = false;
  private finished = false;
  private eggColor = 0x6ea8ff;

  private timerText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private boardRows: Phaser.GameObjects.Text[] = [];
  private actionBtn!: RoundButton;
  private springText!: Phaser.GameObjects.Text;
  /** 庇护所图标：每个闭合区域一个（一个人可以有多个庇护所），按"主人:区域左上角格子"区分 */
  private shelterTags = new Map<string, Phaser.GameObjects.Container>();
  /** 图片对象池：地上的物资按格子编号复用，避免每帧新建 */
  private itemSprites = new Map<number, Phaser.GameObjects.Image>();
  private springImg: Phaser.GameObjects.Image | null = null;
  /** 每股狂风一张旋转的漩涡图（有素材时） */
  private gustImgs = new Map<number, Phaser.GameObjects.Image>();
  /** 画在砖块上面的一层（自己的墙的白框、灵泉的颜色提示） */
  private over!: Phaser.GameObjects.Graphics;
  private toasts: Phaser.GameObjects.Text[] = [];
  private toastAt = new Map<Phaser.GameObjects.Text, number>();
  /** 灵泉方向箭头（灵泉在屏幕外时出现在屏幕边缘） */
  private springArrow?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

  private stick!: VirtualJoystick;
  /** 场地层（场地镜头拍它，跟着你移动）和界面镜头（固定在屏幕上，拍四角信息、摇杆、按键、弹窗） */
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private slotGfx: Phaser.GameObjects.Graphics[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Stage1');
  }

  init() {
    this.ais = [];
    this.views = new Map();
    this.running = false;
    this.finished = false;
    this.boardRows = [];
    this.shelterTags = new Map();
    this.itemSprites = new Map();
    this.springImg = null;
    this.gustImgs = new Map();
    this.toasts = [];
    this.toastAt = new Map();
    this.springArrow = undefined;
  }

  private has(k: ImgKey) {
    return this.textures.exists(K(k));
  }

  /** 放进场地层：场地镜头拍得到、界面镜头拍不到 */
  private W<O extends Phaser.GameObjects.GameObject>(obj: O): O {
    this.worldLayer.add(obj);
    clearCameraFilter(obj);
    return obj;
  }

  /**
   * 两个镜头：场地镜头（main）跟着你；界面镜头（uiCam）固定，坐标和其他场景一样按 1280×720 设计区域摆。
   * 新建的对象默认只给界面镜头拍；场地上的东西用 this.W() 放进场地层。
   */
  private setupCameras() {
    this.worldLayer = this.add.layer();
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.worldLayer);
    const onAdded = (obj: Phaser.GameObjects.GameObject) => {
      if ((obj as unknown) !== this.worldLayer) this.cameras.main.ignore(obj);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded));
  }

  create() {
    this.setupCameras();
    fitScreen(this, () => this.placeEdges());
    layoutField();
    this.eggColor = currentSkin().colors.light;
    const w = (this.world = new World());
    this.me = w.addActor({ id: 0, name: TX.playerName, human: true, cx: 13, cy: 7, speed: 1 });
    RIVAL_HOMES.forEach(([hx, hy], k) => {
      const a = w.addActor({ id: k + 1, name: TX.rivalNames[k], human: false, cx: hx, cy: hy, speed: C.ai.speedFactor });
      this.ais.push(new AIController(w, a, hx, hy));
    });
    w.spawnItems(true);

    playBgm(this, 'chapter1');
    this.drawStatic();
    this.dyn = this.W(this.add.graphics().setDepth(5));
    this.over = this.W(this.add.graphics().setDepth(7));
    this.fx = this.W(this.add.graphics().setDepth(30));
    this.springText = this.W(outlineText(this, 0, 0, '', Math.round(12 * S()), '#ffe08a').setOrigin(0.5, 1).setDepth(31).setVisible(false));
    for (const a of w.actors) this.makeView(a);
    // 场地镜头跟着你走；到场地边缘就停住，不会拍到场地外面
    const pad = T * 0.6;
    this.cameras.main.setBounds(OX - pad, OY - pad, FW + pad * 2, FH + pad * 2);
    this.cameras.main.startFollow(this.views.get(this.me.id)!.box, true, 0.12, 0.12);
    this.buildHud();
    this.bindInput();
    this.placeEdges();
    this.showIntro();
  }

  /** 摇杆和举起键贴着屏幕真正的左右边缘（屏幕比 16:9 宽时往外挪，方便拇指） */
  private placeEdges() {
    if (this.uiCam) {
      const ex = screenExtra(this);
      this.uiCam.setSize(this.scale.width, this.scale.height).setScroll(-ex.x, -ex.y);
    }
    if (!this.stick || !this.actionBtn) return;
    const e = screenEdges(this);
    const midX = (e.left + e.right) / 2;
    this.stick.setPlacement({ x: e.left + 150, y: e.bottom - 230 }, new Phaser.Geom.Rectangle(e.left, e.top + 200, midX - e.left - 60, e.bottom - e.top - 200));
    const mx = e.right - 110;
    const my = e.bottom - 120;
    this.actionBtn.setPosition(mx, my);
    KEYS.slots.forEach((k, i) => this.slotGfx[i]?.setPosition(mx + k.dx, my + k.dy));
  }

  // ───────── 场地与 HUD ─────────

  private drawStatic() {
    this.W(fullBg(this, 0x26303a).setDepth(-10));
    // 场地：圆角草地，格线用圆角遮罩裁掉，避免角上露出直角
    const R = 18;
    // 不用遮罩做圆角：手机显卡处理大面积遮罩很吃力（镜头移动时尤其卡），圆角只靠下面画的边框
    if (this.has('field')) {
      this.W(this.add.image(OX, OY, K('field')).setOrigin(0).setDisplaySize(FW, FH));
    } else {
      this.W(this.add.graphics().fillStyle(0x5e7f4a).fillRoundedRect(OX, OY, FW, FH, R));
    }
    const grid = this.W(this.add.graphics());
    // 有背景图时格线淡一些，只做走位参考
    if (this.has('field')) grid.lineStyle(1, 0x000000, 0.18);
    else grid.lineStyle(1, 0x547342, 0.8);
    for (let x = 1; x < C.grid.cols; x++) grid.lineBetween(OX + x * T, OY, OX + x * T, OY + FH);
    for (let y = 1; y < C.grid.rows; y++) grid.lineBetween(OX, OY + y * T, OX + FW, OY + y * T);
    this.W(this.add.graphics().lineStyle(4, 0xc89b62, 0.9).strokeRoundedRect(OX, OY, FW, FH, R));
  }

  private buildHud() {
    const e = screenEdges(this);
    const n = this.world.actors.length;
    // 左上：关卡名 + 剩余时间
    titleText(this, e.left + 22, e.top + 12, TX.title, 28).setDepth(60);
    this.timerText = outlineText(this, e.left + 26, e.top + 58, '', 22).setDepth(60);
    // 顶部正中：狂风 / 灵泉倒计时
    this.eventText = outlineText(this, 640, e.top + 18, '', 18, '#d8ecff').setOrigin(0.5, 0).setDepth(60);

    // 右上：物资排名
    const bw = 210;
    const bx = e.right - bw - 14;
    const boardH = 34 + n * 48;
    const board = this.add.container(0, 0).setDepth(60).setAlpha(0.92);
    board.add(creamPanel(this, bx, e.top + 22, bw, boardH, 18));
    board.add(pill(this, bx + bw / 2, e.top + 22, TX.hud.board, THEME.green, 15));
    for (let k = 0; k < n; k++) {
      const t = bodyText(this, bx + 16, e.top + 46 + k * 48, '', 14).setLineSpacing(2);
      board.add(t);
      this.boardRows.push(t);
    }

    // 左下：我的状态
    const status = this.add.container(0, 0).setDepth(60).setAlpha(0.92);
    status.add(creamPanel(this, e.left + 14, e.bottom - 118, 200, 104, 18));
    status.add(pill(this, e.left + 114, e.bottom - 118, TX.hud.myStatus, THEME.orange, 15));
    this.statusText = bodyText(this, e.left + 30, e.bottom - 92, '', 15, 170);
    status.add(this.statusText);

    // 右下：举起键 + 预留技能键位（位置在 placeEdges 里摆）
    this.actionBtn = new RoundButton(this, 0, 0, KEYS.r, TX.action.idle, () => this.running && this.world.act(this.me), 0xf0a860, 19);
    this.slotGfx = KEYS.slots.map((k) =>
      this.add.graphics().setDepth(89).lineStyle(2, 0xffffff, 0.18).strokeCircle(0, 0, k.r).fillStyle(0xffffff, 0.06).fillCircle(0, 0, k.r),
    );
    if (!this.sys.game.device.input.touch) outlineText(this, 640, e.bottom - 22, TX.hud.keyboardHint, 13, '#d0d6e0').setOrigin(0.5).setDepth(60);
  }

  private bindInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.running && this.world.act(this.me));
    kb.on('keydown-J', () => this.running && this.world.act(this.me));

    // 摇杆在界面镜头里：手指的屏幕位置 + 界面镜头的偏移 = 摇杆坐标（不能用 worldX，它可能按跟随镜头换算）
    this.stick = new VirtualJoystick(this, { x: 150, y: 490 }, new Phaser.Geom.Rectangle(0, 200, 580, 520), STICK_R, () => this.running, (p) => ({
      x: p.x + this.uiCam.scrollX,
      y: p.y + this.uiCam.scrollY,
    }));
  }

  private keyDir(): Dir | null {
    const k = this.keys;
    if (k.UP.isDown || k.W.isDown) return 'up';
    if (k.DOWN.isDown || k.S.isDown) return 'down';
    if (k.LEFT.isDown || k.A.isDown) return 'left';
    if (k.RIGHT.isDown || k.D.isDown) return 'right';
    return null;
  }

  private makeView(a: Actor) {
    // 所有奶蛋同一套皮肤，只靠头上的名字区分；玩家多一圈白色描边
    const arrow = this.add.graphics();
    const carry = this.add.graphics();
    const carryImg = this.add.image(0, -26 * S(), K('brick')).setVisible(false);
    // 有奶蛋素材就用图片，否则用代码画的蛋
    let bodyImg: Phaser.GameObjects.Image | null = null;
    let body: Phaser.GameObjects.GameObject;
    if (this.has('egg_down')) {
      bodyImg = this.add.image(0, 2, K('egg_down'));
      bodyImg.setScale((30 * S()) / bodyImg.height);
      body = bodyImg;
    } else {
      const g = this.add.graphics();
      art.drawEgg(g, this.eggColor, 11);
      g.setScale(S());
      body = g;
    }
    // 名字用描边字代替方块底色，看起来更柔和
    const fs = Math.max(12, Math.round(12 * S()));
    const name = label(this, 0, (bodyImg ? 16 : 12) * S(), a.name, fs, a.human ? '#1d3a66' : '#2b2b2b').setOrigin(0.5, 0).setStroke('#ffffff', 4);
    const tag = label(this, 0, -44 * S(), TX.prisonerTag, fs, '#ffffff').setOrigin(0.5).setStroke('#b03a2e', 5).setVisible(false);
    const box = this.add.container(px(a.cx), py(a.cy), [arrow, body, name, carry, carryImg, tag]).setDepth(10 + a.id);
    this.W(box);
    if (a.human) {
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xffffff, 0.95).strokeEllipse(0, 14 * S(), 30 * S(), 10 * S());
      box.addAt(ring, 0);
      clearCameraFilter(ring);
      box.setDepth(20);
    }
    this.views.set(a.id, { box, body: bodyImg, carry, carryImg, arrow, tag, carryKey: '' });
  }

  // ───────── 开场提示与结算 ─────────

  private modal(h: number) {
    const layer = this.add.container(0, 0).setDepth(100);
    layer.add(fullBg(this, 0x000000, 0.5).setInteractive());
    // 横向卷轴（左右两根竖轴），比纸面内容稍宽一点，给两边的轴留位置
    layer.add(scrollPanel(this, 200, 360 - h / 2, 880, h));
    return layer;
  }

  /**
   * 开场引导：分页讲解（末世背景 → 砖块 → 狂风 → 空瓶灵泉 → 铁锹），每页配物资图片，
   * 系统停在卷轴左边陪着讲，最后一页点「开始」。文案在 src/copy/stage1.ts 的 intro.pages。
   */
  private showIntro() {
    const pages = TX.intro.pages;
    const layer = this.modal(560);
    const guide = showGuide(this, 150, 260, { from: 'left', height: 230, depth: 102, delay: 300 });
    // 每页会变的内容放在 content 里，翻页时整个换掉
    let content: Phaser.GameObjects.Container | null = null;
    let page = 0;
    const btns: Button[] = [];
    const close = () => {
      layer.destroy();
      content?.destroy();
      btns.forEach((b) => b.destroy());
      guide.leave();
    };
    const render = () => {
      content?.destroy();
      const pg = pages[page];
      const c = this.add.container(0, 0).setDepth(101);
      c.add(titleText(this, 640, 128, pg.title, 36).setOrigin(0.5));
      // 物资图片一字排开（放大到 130），示意图放在图片右边或单独居中
      const icons = pg.icons.filter((k) => this.has(k as ImgKey));
      const items: { w: number; draw: (cx: number) => void }[] = icons.map((k) => ({
        w: 140,
        draw: (cx) => {
          const img = this.add.image(cx, 255, K(k as ImgKey));
          img.setScale(Math.min(130 / img.width, 130 / img.height));
          c.add(img);
        },
      }));
      if (pg.diagram) items.push({ w: pg.diagram === 'shelter' ? 420 : 200, draw: (cx) => c.add(this.introDiagram(pg.diagram!, cx, 255)) });
      const totalW = items.reduce((a, it) => a + it.w, 0);
      let cx = 640 - totalW / 2;
      for (const it of items) {
        it.draw(cx + it.w / 2);
        cx += it.w;
      }
      // 有示意图时它下面还有一行说明，正文再往下挪
      const textY = pg.diagram ? 378 : items.length ? 345 : 235;
      c.add(bodyText(this, 640, textY, pg.text, 25, 780).setOrigin(0.5, 0).setAlign('center').setLineSpacing(10));
      // 页码小圆点
      pages.forEach((_p, i) => {
        c.add(this.add.circle(640 + (i - (pages.length - 1) / 2) * 22, 510, i === page ? 7 : 5, i === page ? THEME.orange : THEME.brown, i === page ? 1 : 0.4));
      });
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 250 });
      content = c;
      const last = page === pages.length - 1;
      nextBtn.setLabel(last ? TX.intro.start : TX.intro.next);
      prevBtn.setVisible(page > 0);
    };
    const prevBtn = new Button(this, 330, 550, 170, 60, TX.intro.prev, () => {
      page = Math.max(0, page - 1);
      render();
    }, THEME.orange);
    const nextBtn = new Button(this, 555, 550, 170, 60, TX.intro.next, () => {
      if (page < pages.length - 1) {
        page++;
        render();
        return;
      }
      close();
      this.running = true;
      this.toast(TX.toast.start);
    }, THEME.orange);
    // 预留广告位：看激励视频直接跳过本关（以后上微信接入广告）
    const ad = new Button(this, 780, 550, 200, 60, TX.intro.adSkip, () => this.skipByAd(close), THEME.grey);
    btns.push(prevBtn, nextBtn, ad);
    btns.forEach((b) => b.setDepth(102));
    render();
  }

  private finish() {
    this.finished = true;
    this.running = false;
    const R = TX.result;
    const rank = this.world.ranking();
    const cut = rank.length - C.eliminate;
    // 被狂风卷出场外的直接淘汰（排名里也排在最后）
    const pass = !this.me.gone && rank.findIndex((r) => r.actor.human) < cut;

    const layer = this.modal(480);
    layer.add(titleText(this, 640, 160, pass ? R.pass : this.me.gone ? R.blownAway : R.fail, 44).setOrigin(0.5).setColor(pass ? THEME.title : '#ff9a8a'));
    rank.forEach((r, k) => {
      const out = k >= cut;
      layer.add(bodyText(this, 640, 225 + k * 40, R.row(k + 1, r.actor.name, r.score, out), 21).setOrigin(0.5).setColor(out ? '#c0392b' : r.actor.human ? '#c0601a' : THEME.text));
    });
    // 过关：所有庇护所里的瓶子都算你的，累积进存档，后面的关卡可以用
    if (pass) {
      const got = this.world.bottlesIn(this.me.id);
      const total = addToStash(got);
      layer.add(bodyText(this, 640, 405, R.collected(got.empty, got.tea, got.milk), 18).setOrigin(0.5).setColor('#b5651d'));
      layer.add(bodyText(this, 640, 435, R.total(total.empty, total.tea, total.milk), 18).setOrigin(0.5).setColor('#2e7d32').setFontStyle('bold'));
    }
    const btns: Button[] = [];
    const done = () => btns.forEach((b) => b.destroy());
    // 下一章还没做好：晋级后显示"敬请期待"；淘汰时提供看广告跳过
    if (pass) btns.push(new Button(this, 430, 500, 200, 60, R.comingSoon, () => {}, THEME.green).setEnabled(false));
    else btns.push(new Button(this, 430, 500, 200, 60, TX.intro.adSkip, () => this.skipByAd(() => (done(), layer.destroy())), THEME.grey));
    btns.push(new Button(this, 645, 500, 190, 60, R.retry, () => (done(), this.scene.restart()), THEME.orange));
    btns.push(new Button(this, 850, 500, 190, 60, R.menu, () => (done(), this.scene.start('Menu')), THEME.blue));
    btns.forEach((b) => b.setDepth(101));
  }

  /**
   * 开场引导里的示意图（代码画，和场上的砖块长得一样）：
   *   shelter：左边 3 块砖缺一块 ✗ 没闭合；右边 4 块砖上下左右围住中间 ✓ 闭合 = 庇护所
   *   store：4 块砖围成的庇护所，中间放着一个满瓶
   */
  private introDiagram(kind: 'shelter' | 'store', cx: number, cy: number) {
    const c = this.add.container(0, 0);
    const t = 38;
    const ring = (ox: number, closed: boolean, missing = -1) => {
      const g = this.add.graphics();
      // 底下铺一块草地
      g.fillStyle(0x6e9a56).fillRoundedRect(ox - t * 1.5 - 6, cy - t * 1.5 - 6, t * 3 + 12, t * 3 + 12, 10);
      g.lineStyle(1, 0x000000, 0.12);
      for (let i = 1; i < 3; i++) {
        g.lineBetween(ox - t * 1.5 + i * t, cy - t * 1.5, ox - t * 1.5 + i * t, cy + t * 1.5);
        g.lineBetween(ox - t * 1.5, cy - t * 1.5 + i * t, ox + t * 1.5, cy - t * 1.5 + i * t);
      }
      [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([dx, dy], i) => {
        if (i !== missing) drawWall(g, ox + dx * t - t / 2, cy + dy * t - t / 2, closed, t);
      });
      c.add(g);
      return g;
    };
    if (kind === 'shelter') {
      const lx = cx - 105;
      const rx = cx + 105;
      ring(lx, false, 3);
      ring(rx, true);
      if (this.has('shelter')) {
        const hut = this.add.image(rx, cy - t * 1.5 - 18, K('shelter'));
        hut.setScale(44 / hut.height);
        c.add(hut);
      }
      c.add(bodyText(this, lx, cy + t * 1.5 + 14, '✗ 没闭合', 20).setOrigin(0.5, 0).setColor('#c0392b').setFontStyle('bold'));
      c.add(bodyText(this, rx, cy + t * 1.5 + 14, '✓ 闭合 = 庇护所', 20).setOrigin(0.5, 0).setColor('#2e7d32').setFontStyle('bold'));
    } else {
      ring(cx, true);
      if (this.has('bottle_tea')) {
        const b = this.add.image(cx, cy, K('bottle_tea'));
        b.setScale((t * 0.9) / b.height);
        c.add(b);
      }
      c.add(bodyText(this, cx, cy + t * 1.5 + 14, '放进庇护所才算分', 20).setOrigin(0.5, 0).setColor('#2e7d32').setFontStyle('bold'));
    }
    return c;
  }

  /** 看广告跳过本关：看完直接算晋级（下一章做好后改成进入下一章） */
  private async skipByAd(close: () => void) {
    const ok = await platform.showRewardedAd('stage1-skip');
    if (!ok) return;
    close();
    this.running = false;
    this.finished = true;
    const layer = this.modal(300);
    layer.add(titleText(this, 640, 300, TX.result.pass, 44).setOrigin(0.5));
    layer.add(bodyText(this, 640, 370, TX.result.comingSoon, 22).setOrigin(0.5));
    new Button(this, 545, 420, 190, 60, TX.result.menu, () => this.scene.start('Menu'), THEME.blue).setDepth(101);
  }

  // ───────── 主循环 ─────────

  update(_t: number, dtMs: number) {
    const w = this.world;
    const prof = import.meta.env.DEV ? new FrameProfiler(dtMs) : null;
    if (this.running) {
      const dt = Math.min(0.05, dtMs / 1000);
      w.setWantDir(this.me, this.stick.dir ?? this.keyDir());
      for (const ai of this.ais) ai.update(dt);
      prof?.mark('AI');
      w.update(dt);
      prof?.mark('规则');
      this.drainEvents();
      prof?.mark('事件');
      // 时间到，或者你被狂风卷出场外（无法返回）都立即结算
      if ((w.ended || this.me.gone) && !this.finished) this.time.delayedCall(this.me.gone ? 1200 : 0, () => !this.finished && this.finish());
      if (this.me.gone) this.running = false;
    }
    this.render();
    prof?.mark('绘制');
    this.updateSpringArrow();
    this.expireToasts();
    prof?.done(w.t, w.gusts.length > 0);
  }

  /**
   * 灵泉方向箭头：灵泉出现、但在屏幕外时，屏幕边缘出现黄色箭头指向它（尾巴渐隐），一闪一闪；看得见灵泉时隐藏。
   * 箭头画在界面镜头里，位置用"场地坐标 → 屏幕 → 界面坐标"换算。
   */
  private updateSpringArrow() {
    const sp = this.world.spring;
    const cam = this.cameras.main;
    if (!sp || !this.running) {
      this.springArrow?.setVisible(false);
      return;
    }
    const sx = px(sp.cx) - cam.scrollX;
    const sy = py(sp.cy) - cam.scrollY;
    const margin = T * 0.6;
    const onScreen = sx > margin && sx < cam.width - margin && sy > margin && sy < cam.height - margin;
    if (!this.springArrow) {
      if (this.has('arrow')) {
        const img = this.add.image(0, 0, K('arrow'));
        img.setScale(150 / img.width);
        this.springArrow = img;
      } else {
        // 占位：代码画的黄色箭头，尾巴逐渐透明
        const g = this.add.graphics();
        for (let i = 0; i < 12; i++) g.fillStyle(0xffd84a, 0.08 * (i + 1)).fillRect(-110 + i * 7, -7, 8, 14);
        g.fillStyle(0xffd84a).fillTriangle(-26, -24, -26, 24, 22, 0);
        g.lineStyle(3, 0x8a5a10, 0.9).strokeTriangle(-26, -24, -26, 24, 22, 0);
        this.springArrow = g;
      }
      this.springArrow.setDepth(70);
    }
    const a = this.springArrow;
    a.setVisible(!onScreen);
    if (onScreen) return;
    // 从屏幕中心指向灵泉，箭头停在屏幕边缘内侧（避开四角面板）
    const e = screenEdges(this);
    const ex = screenExtra(this);
    const cx = (e.left + e.right) / 2;
    const cy = (e.top + e.bottom) / 2;
    const tx = sx - ex.x;
    const ty = sy - ex.y;
    const ang = Math.atan2(ty - cy, tx - cx);
    const hw = (e.right - e.left) / 2 - 120;
    const hh = (e.bottom - e.top) / 2 - 90;
    const k = Math.min(Math.abs(hw / Math.cos(ang) || Infinity), Math.abs(hh / Math.sin(ang) || Infinity));
    a.setPosition(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k).setRotation(ang);
    a.setAlpha(0.65 + 0.35 * Math.sin(this.time.now / 180));
  }

  private drainEvents() {
    const w = this.world;
    const me = this.me.id;
    const T2 = TX.toast;
    for (const e of w.events) {
      if (e.type === 'toast') this.toast(e.text, e.actor === me ? '#ff8a80' : '#dddddd');
      else if (e.type === 'hint') e.actor === me && this.toast(e.text, '#ffe08a');
      else if (e.type === 'float') this.floatText(px(e.x), py(e.y) - 20, e.text, e.color);
      else if (e.type === 'wind') this.toast(T2.windComing, '#9cc4ff');
      else if (e.type === 'spring') this.toast(T2.springAppear(TX.items[e.fill]), '#ffe08a');
      else if (e.type === 'refresh') this.toast(T2.refresh, '#9aa4b8');
      else if (e.type === 'prison') {
        const prisoner = w.actor(e.prisoner).name;
        const captor = w.actor(e.captor).name;
        if (e.prisoner === me) this.toast(T2.youImprisoned(captor), '#ff8a80');
        else if (e.captor === me) this.toast(T2.imprisonedBy(prisoner, captor), '#fff27a');
        else this.toast(T2.imprisonedOther(prisoner, captor), '#dddddd');
        if (e.captor === me) this.cameras.main.flash(300, 255, 242, 122);
      } else if (e.type === 'free') this.toast(T2.released(w.actor(e.prisoner).name), '#7dff9a');
    }
    w.events.length = 0;
  }

  private render() {
    const w = this.world;
    const g = this.dyn.clear();
    const tileXY = (i: number) => [OX + (i % w.cols) * T, OY + ((i / w.cols) | 0) * T];

    const ov = this.over.clear();
    // 墙：俯视砖块，没闭合是零散小砖，闭合后是实心砖墙
    for (let i = 0; i < w.walls.length; i++) {
      const o = w.walls[i];
      if (o === -1) continue;
      const [x, y] = tileXY(i);
      drawWall(g, x, y, w.isWallClosed(i));
      // 自己的砖加白色细框，方便认出来
      if (o === this.me.id) ov.lineStyle(Math.max(1.5, T / 20), 0xffffff, 0.85).strokeRoundedRect(x + 1, y + 1, T - 2, T - 2, T * 0.15);
    }

    // 瞄准框：举着砖块时，面前那一格画黄色虚线框（放不下时变淡）；举着铁锹对着墙时也画
    if (this.running && this.me.carry && !w.isBusy(this.me)) {
      const f = w.facingTile(this.me);
      const kind = this.me.carry.kind;
      if (w.inBounds(f.x, f.y) && (kind === 'brick' || kind === 'shovel')) {
        const ok = kind === 'brick' ? w.free(f.x, f.y) : w.walls[w.idx(f.x, f.y)] !== -1;
        if (kind === 'brick' || ok) {
          const [x, y] = tileXY(w.idx(f.x, f.y));
          dashedRect(ov, x + 2, y + 2, T - 4, T - 4, 0xffd84a, ok ? 1 : 0.35, Math.max(2, T / 14), w.t);
        }
      }
    }

    // 地上的物资
    const usedItem = new Set<number>();
    w.items.forEach((it, i) => {
      if (!it) return;
      const { key, h } = itemImage(it);
      const cx = px(i % w.cols);
      const cy = py((i / w.cols) | 0);
      if (!this.has(key)) return drawItem(g, it, cx, cy, 0.85 * S());
      usedItem.add(i);
      let img = this.itemSprites.get(i);
      if (!img) {
        img = this.W(this.add.image(cx, cy, K(key)).setDepth(6.5));
        this.itemSprites.set(i, img);
      }
      if (img.texture.key !== K(key)) img.setTexture(K(key));
      img.setPosition(cx, cy).setScale(h / img.height).setVisible(true);
    });
    for (const [i, img] of this.itemSprites) if (!usedItem.has(i)) img.setVisible(false);

    this.renderShelterTags();

    // 灵泉：有图用图，中间一滴奶茶色或奶白色提示这次装出来的是什么
    const sp = w.spring;
    if (sp) {
      const pulse = 1 + Math.sin(w.t * 5) * 0.06;
      const cx = px(sp.cx);
      const cy = py(sp.cy);
      if (this.has('spring')) {
        if (!this.springImg) this.springImg = this.W(this.add.image(0, 0, K('spring')).setDepth(6.4));
        this.springImg.setPosition(cx, cy).setScale(((T * 3) / this.springImg.width) * pulse).setVisible(true);
      } else {
        g.fillStyle(0x7fd3e6, 0.25).fillCircle(cx, cy, T * 1.5 * pulse);
        g.lineStyle(3, 0x7fd3e6).strokeCircle(cx, cy, 14);
      }
      ov.fillStyle(sp.fill === 'tea' ? 0xc68b59 : 0xfdfcf5).fillCircle(cx, cy, 6 * S());
      ov.lineStyle(2, 0xffffff, 0.8).strokeCircle(cx, cy, 6 * S());
      this.springText.setPosition(cx, cy - T * 1.4).setText(TX.hud.springLabel(TX.items[sp.fill], Math.ceil(sp.until - w.t))).setVisible(true);
    } else {
      this.springText.setVisible(false);
      this.springImg?.setVisible(false);
    }

    // 狂风：预警圈 → 旋转的风
    const f = this.fx.clear();
    for (const gu of w.gusts) {
      const cx = OX + gu.x * T + T / 2;
      const cy = OY + gu.y * T + T / 2;
      const r = C.wind.radius * T;
      if (w.t < gu.activeAt) {
        f.lineStyle(2, 0xffffff, 0.5 + 0.4 * Math.sin(w.t * 12)).strokeCircle(cx, cy, r);
        continue;
      }
      if (this.has('wind')) {
        let img = this.gustImgs.get(gu.id);
        if (!img) {
          img = this.W(this.add.image(cx, cy, K('wind')).setDepth(29).setAlpha(0.9));
          this.gustImgs.set(gu.id, img);
        }
        img.setPosition(cx, cy).setScale((r * 2) / img.width).setAngle(w.t * 360);
        continue;
      }
      f.fillStyle(0xd8e2ea, 0.18).fillCircle(cx, cy, r);
      for (let j = 0; j < 4; j++) {
        const a0 = w.t * 6 + (j * Math.PI) / 2;
        f.lineStyle(3, 0xeef4f8, 0.7).beginPath().arc(cx, cy, r * (0.35 + j * 0.16), a0, a0 + 1.6).strokePath();
      }
    }

    // 已经结束的狂风，把漩涡图收掉
    for (const [id, img] of this.gustImgs) {
      if (!w.gusts.some((gu) => gu.id === id)) {
        img.destroy();
        this.gustImgs.delete(id);
      }
    }

    for (const a of w.actors) this.renderActor(a);
    this.renderHud();
  }

  /**
   * 闭合的庇护所：每个闭合区域都在最上面一排砖的正中挂一个小屋图标和「奶X蛋庇护所」；被挖开后图标消失。
   * 一个人可以有多个庇护所，每个都算他的。
   */
  private renderShelterTags() {
    const w = this.world;
    // 找出每一块连在一起的庇护所内部（四方向连通）
    const seen = new Uint8Array(w.interior.length);
    const regions: { owner: number; key: string; x0: number; x1: number; y0: number }[] = [];
    for (let i = 0; i < w.interior.length; i++) {
      const o = w.interior[i];
      if (o === -1 || seen[i]) continue;
      const r = { owner: o, key: `${o}:${i}`, x0: Infinity, x1: -Infinity, y0: Infinity };
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop()!;
        const x = j % w.cols;
        const y = (j / w.cols) | 0;
        r.x0 = Math.min(r.x0, x);
        r.x1 = Math.max(r.x1, x);
        r.y0 = Math.min(r.y0, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (!w.inBounds(nx, ny)) continue;
          const k = w.idx(nx, ny);
          if (!seen[k] && w.interior[k] === o) (seen[k] = 1), stack.push(k);
        }
      }
      regions.push(r);
    }
    const alive = new Set(regions.map((r) => r.key));
    for (const [k, t] of this.shelterTags) {
      if (!alive.has(k)) {
        t.destroy();
        this.shelterTags.delete(k);
      }
    }
    for (const r of regions) {
      let t = this.shelterTags.get(r.key);
      if (!t) {
        const a = w.actor(r.owner);
        const parts: Phaser.GameObjects.GameObject[] = [];
        let nameY = 0;
        if (this.has('shelter')) {
          const hut = this.add.image(0, 0, K('shelter'));
          hut.setScale((30 * S()) / hut.height);
          parts.push(hut);
          nameY = -24 * S();
        }
        parts.push(label(this, 0, nameY, TX.shelterName(a.name, a.human), Math.max(12, Math.round(12 * S())), '#ffe08a').setOrigin(0.5).setStroke('#3a1a10', 4));
        t = this.W(this.add.container(0, 0, parts).setDepth(8));
        this.shelterTags.set(r.key, t);
        // 刚闭合时弹一下
        t.setScale(0);
        this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.out' });
      }
      t.setPosition((px(r.x0) + px(r.x1)) / 2, py(r.y0 - 1) - 4);
    }
  }

  private renderActor(a: Actor) {
    const w = this.world;
    const v = this.views.get(a.id)!;
    const out = w.t < a.outUntil && w.t >= a.flyUntil;
    v.box.setVisible(!out);
    if (out) return;
    if (w.t < a.flyUntil) {
      // 被风卷起：抛物线飞行 + 旋转
      const k = 1 - (a.flyUntil - w.t) / C.wind.flyTime;
      const lands = w.t < a.outUntil;
      const tx = lands ? a.fx + (a.fx < w.cols / 2 ? -4 : 4) : a.cx;
      const ty = lands ? a.fy : a.cy;
      v.box.setPosition(px(a.fx + (tx - a.fx) * k), py(a.fy + (ty - a.fy) * k) - Math.sin(k * Math.PI) * 80);
      v.box.setAngle(k * 720).setScale(1 + Math.sin(k * Math.PI) * 0.5);
    } else {
      const k = Phaser.Math.Easing.Sine.InOut(a.moveT);
      // 奶蛋没有脚，走路时一跳一跳
      const hop = a.moveT < 1 ? Math.sin(a.moveT * Math.PI) * 5 * S() : 0;
      v.box.setPosition(px(a.fx + (a.cx - a.fx) * k), py(a.fy + (a.cy - a.fy) * k) - hop).setAngle(0).setScale(1);
    }
    if (v.body) {
      const key = K(`egg_${a.facing}` as ImgKey);
      if (v.body.texture.key !== key && this.textures.exists(key)) v.body.setTexture(key);
    }
    const [dx, dy] = DIRS[a.facing];
    const a1 = 19 * S();
    const a2 = 26 * S();
    const aw = 5 * S();
    v.arrow.clear().fillStyle(0xffffff, 0.8).fillTriangle(dx * a1 - dy * aw, dy * a1 - dx * aw, dx * a1 + dy * aw, dy * a1 + dx * aw, dx * a2, dy * a2);
    v.tag.setVisible(w.prisoners.has(a.id));
    const key = a.carry ? `${a.carry.kind}:${a.carry.fill}` : '';
    if (key !== v.carryKey) {
      v.carryKey = key;
      v.carry.clear();
      v.carryImg.setVisible(false);
      if (a.carry) {
        const { key: ik, h } = itemImage(a.carry);
        if (this.has(ik)) v.carryImg.setTexture(K(ik)).setScale((h * 0.8) / v.carryImg.height).setPosition(0, -26 * S()).setVisible(true);
        else drawItem(v.carry, a.carry, 0, -24 * S(), 0.7 * S());
      }
    }
  }

  private renderHud() {
    const w = this.world;
    const H = TX.hud;
    const left = Math.max(0, C.duration - w.t);
    this.timerText.setText(H.timeLeft(Math.floor(left / 60), String(Math.floor(left % 60)).padStart(2, '0'))).setColor(left < 20 ? '#ff8a80' : '#ffffff');

    const next = (first: number, every: number) => (w.t < first ? first : first + Math.ceil((w.t - first + 0.001) / every) * every);
    const nextWind = next(C.wind.firstAt, C.wind.interval);
    const nextSpring = next(C.spring.firstAt, C.spring.interval);
    const parts: string[] = [];
    if (w.gusts.length) parts.push(H.windNow);
    else if (nextWind < C.duration) parts.push(H.windIn(Math.ceil(nextWind - w.t)));
    if (w.spring) parts.push(H.springNow);
    else if (nextSpring < C.duration) parts.push(H.springIn(Math.ceil(nextSpring - w.t)));
    this.eventText.setText(parts.join('　·　'));

    const status = (a: Actor) => (a.gone ? H.gone : w.prisoners.has(a.id) ? H.imprisoned : w.closed.has(a.id) ? H.shelterClosed : H.shelterOpen);
    const hold = (a: Actor) => (a.carry ? H.holding(itemName(a.carry)) : H.emptyHand);
    w.ranking().forEach((r, k) => {
      const a = r.actor;
      this.boardRows[k].setText(`${H.boardRow(k + 1, a.name, r.score)}\n   ${status(a)}`).setColor(a.human ? '#c0601a' : THEME.text);
    });
    this.statusText.setText(`${hold(this.me)}\n${status(this.me)}\n${H.myScore(w.score(this.me.id))}`);

    this.actionBtn.setLabel(w.actionLabel(this.me));
  }

  // ───────── 提示 ─────────

  /**
   * 提示消息：底部正中，最多 3 行，最新的在最下面。
   * 文字对象开局建好、之后复用（不在狂风这种瞬间连续新建，避免手机上卡一下）。
   */
  private toast(text: string, color = '#dddddd') {
    const bottom = screenEdges(this).bottom;
    if (!this.toasts.length) {
      for (let k = 0; k < 3; k++) this.toasts.push(outlineText(this, 640, 0, '', 16).setOrigin(0.5, 1).setDepth(61).setVisible(false));
    }
    // 最旧的那一行拿来显示新消息，挪到最前面
    const t = this.toasts.pop()!;
    this.toasts.unshift(t);
    t.setText(text).setColor(color).setVisible(true);
    this.toastAt.set(t, this.time.now);
    this.toasts.forEach((x, k) => x.setY(bottom - 34 - k * 26).setAlpha(1 - k * 0.3));
  }

  /** 每帧：6 秒前的提示消息隐藏 */
  private expireToasts() {
    for (const t of this.toasts) if (t.visible && this.time.now - (this.toastAt.get(t) ?? 0) > 6000) t.setVisible(false);
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.W(outlineText(this, x, y, text, Math.round(15 * S()), color).setOrigin(0.5).setDepth(60));
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
}
