import Phaser from 'phaser';
import { STAGE1 as C } from '../config/stage1';
import { STAGE1_TEXT as TX } from '../copy/stage1';
import { currentSkin } from '../skins';
import * as art from '../battle/art';
import { Button, label, roundPanel } from '../battle/ui';
import { RoundButton, VirtualJoystick } from '../battle/touch';
import { AIController } from '../stage1/ai';
import { Actor, Dir, DIRS, Item, World, itemName } from '../stage1/world';

/*
 * 布局（1280×720，手机横屏时整体等比缩放）：
 *   左栏：我的状态；左下是浮动摇杆（左手拇指按在左半屏任意位置都能拖）
 *   中间：场地，下面是提示消息
 *   右栏：排行榜；右下是圆形按键区（右手拇指）
 * 摇杆和按键都是半透明的，压在场地上也看得见底下的东西。
 */
const T = C.grid.tile;
const OX = 208;
const OY = 66;
const FW = C.grid.cols * T;
const FH = C.grid.rows * T;
/** 摇杆默认位置和可触发区域（左下半屏） */
const STICK = { home: { x: 120, y: 590 }, zone: new Phaser.Geom.Rectangle(0, 300, 600, 420), radius: 74 };
/** 右下按键区：主键「举起」，旁边预留两个技能键位，以后各阶段的新技能放这里 */
const KEYS = { main: { x: 1172, y: 606, r: 72 }, slots: [{ x: 1040, y: 650, r: 44 }, { x: 1100, y: 500, r: 44 }] };
const RX = 1086;

const RIVAL_HOMES = [
  [3, 2],
  [21, 2],
  [3, 10],
  [21, 10],
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

/**
 * 第一关的图片素材（由 tools/prepare_assets.py 从 art/reference 处理生成）。
 * 有图就用图，缺哪张就退回代码画的样子，不影响运行。
 */
const IMG = {
  field: 'assets/stage1/field.jpg',
  brick: 'assets/stage1/brick.png',
  bottle_empty: 'assets/stage1/bottle_empty.png',
  bottle_milk: 'assets/stage1/bottle_milk.png',
  bottle_tea: 'assets/stage1/bottle_tea.png',
  shovel: 'assets/stage1/shovel.png',
  spring: 'assets/stage1/spring.png',
  shelter: 'assets/stage1/shelter.png',
  wind: 'assets/stage1/wind.png',
  egg_down: 'assets/stage1/egg_down.png',
  egg_up: 'assets/stage1/egg_up.png',
  egg_left: 'assets/stage1/egg_left.png',
  egg_right: 'assets/stage1/egg_right.png',
} as const;
type ImgKey = keyof typeof IMG;
const K = (k: ImgKey) => `s1-${k}`;

/** 物资对应的图片，以及在一格里显示的高度（像素） */
function itemImage(it: Item): { key: ImgKey; h: number } {
  if (it.kind === 'brick') return { key: 'brick', h: 18 };
  if (it.kind === 'shovel') return { key: 'shovel', h: 28 };
  return { key: it.fill === 'empty' ? 'bottle_empty' : it.fill === 'tea' ? 'bottle_tea' : 'bottle_milk', h: 27 };
}

/** 墙：每格用 3 块砖随意错开堆起来（按格子编号取固定的错位，避免每帧抖动） */
function wallBricks(i: number) {
  const r = (n: number) => (((i * 9301 + n * 49297) % 233280) / 233280) * 2 - 1;
  return [
    { dx: r(1) * 2, dy: 7, rot: r(2) * 6 },
    { dx: r(3) * 3, dy: 0, rot: r(4) * 8 },
    { dx: r(5) * 3, dy: -7, rot: r(6) * 10 },
  ];
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
  private shelterTags = new Map<number, Phaser.GameObjects.Container>();
  /** 图片对象池：地上的物资按格子编号、墙砖按「格子:第几块」复用，避免每帧新建 */
  private itemSprites = new Map<number, Phaser.GameObjects.Image>();
  private wallSprites = new Map<string, Phaser.GameObjects.Image>();
  private springImg: Phaser.GameObjects.Image | null = null;
  /** 每股狂风一张旋转的漩涡图（有素材时） */
  private gustImgs = new Map<number, Phaser.GameObjects.Image>();
  /** 画在砖块上面的一层（自己的墙的白框、灵泉的颜色提示） */
  private over!: Phaser.GameObjects.Graphics;
  private toasts: Phaser.GameObjects.Text[] = [];
  private shook = new Set<number>();

  private stick!: VirtualJoystick;
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
    this.wallSprites = new Map();
    this.springImg = null;
    this.gustImgs = new Map();
    this.toasts = [];
    this.shook = new Set();
  }

  preload() {
    // 缺图时只在控制台报一条加载失败，游戏照常用代码画的样子
    for (const [k, url] of Object.entries(IMG)) this.load.image(K(k as ImgKey), url);
  }

  private has(k: ImgKey) {
    return this.textures.exists(K(k));
  }

  create() {
    this.eggColor = currentSkin().colors.light;
    const w = (this.world = new World());
    this.me = w.addActor({ id: 0, name: TX.playerName, human: true, cx: 13, cy: 7, speed: 1 });
    RIVAL_HOMES.forEach(([hx, hy], k) => {
      const a = w.addActor({ id: k + 1, name: TX.rivalNames[k], human: false, cx: hx, cy: hy, speed: C.ai.speedFactor });
      this.ais.push(new AIController(w, a, hx, hy));
    });
    w.spawnItems(true);

    this.drawStatic();
    this.dyn = this.add.graphics().setDepth(5);
    this.over = this.add.graphics().setDepth(7);
    this.fx = this.add.graphics().setDepth(30);
    this.springText = label(this, 0, 0, '', 12, '#ffe08a').setOrigin(0.5, 1).setDepth(31).setVisible(false);
    for (const a of w.actors) this.makeView(a);
    this.buildHud();
    this.bindInput();
    this.showIntro();
  }

  // ───────── 场地与 HUD ─────────

  private drawStatic() {
    this.add.rectangle(0, 0, 1280, 720, 0x1d2330).setOrigin(0);
    // 场地：圆角草地，格线用圆角遮罩裁掉，避免角上露出直角
    const R = 18;
    const maskShape = this.make.graphics({}, false).fillStyle(0xffffff).fillRoundedRect(OX, OY, FW, FH, R);
    const roundMask = maskShape.createGeometryMask();
    if (this.has('field')) {
      this.add.image(OX, OY, K('field')).setOrigin(0).setDisplaySize(FW, FH).setMask(roundMask);
    } else {
      this.add.graphics().fillStyle(0x5e7f4a).fillRoundedRect(OX, OY, FW, FH, R);
    }
    const grid = this.add.graphics();
    // 有背景图时格线淡一些，只做走位参考
    if (this.has('field')) grid.lineStyle(1, 0x000000, 0.18);
    else grid.lineStyle(1, 0x547342, 0.8);
    for (let x = 1; x < C.grid.cols; x++) grid.lineBetween(OX + x * T, OY, OX + x * T, OY + FH);
    for (let y = 1; y < C.grid.rows; y++) grid.lineBetween(OX, OY + y * T, OX + FW, OY + y * T);
    grid.setMask(roundMask);
    this.add.graphics().lineStyle(4, 0xc89b62, 0.9).strokeRoundedRect(OX, OY, FW, FH, R);
    label(this, 20, 16, TX.title, 26, '#fff27a');
  }

  private buildHud() {
    this.timerText = label(this, 330, 18, '', 22, '#ffffff');
    this.eventText = label(this, 500, 22, '', 17, '#9cc4ff');

    label(this, 16, 74, TX.hud.myStatus, 17, '#fff27a');
    this.statusText = label(this, 16, 104, '', 15, '#ffffff').setLineSpacing(6).setWordWrapWidth(180);

    label(this, RX, 74, TX.hud.board, 17, '#fff27a');
    for (let k = 0; k < 5; k++) this.boardRows.push(label(this, RX, 104 + k * 54, '', 14, '#ffffff').setLineSpacing(3));

    this.actionBtn = new RoundButton(this, KEYS.main.x, KEYS.main.y, KEYS.main.r, TX.action.idle, () => this.running && this.world.act(this.me), 0xf0a860, 19);
    // 预留技能键位：现在只画淡淡的空槽，提示以后会解锁
    for (const k of KEYS.slots) {
      this.add.graphics().setDepth(89).lineStyle(2, 0xffffff, 0.14).strokeCircle(k.x, k.y, k.r).fillStyle(0xffffff, 0.04).fillCircle(k.x, k.y, k.r);
    }
    if (!this.sys.game.device.input.touch) label(this, 640, 700, TX.hud.keyboardHint, 13, '#9aa4b8').setOrigin(0.5);
  }

  private bindInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.running && this.world.act(this.me));
    kb.on('keydown-J', () => this.running && this.world.act(this.me));

    this.stick = new VirtualJoystick(this, STICK.home, STICK.zone, STICK.radius, () => this.running);
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
    const carryImg = this.add.image(0, -26, K('brick')).setVisible(false);
    // 有奶蛋素材就用图片，否则用代码画的蛋
    let bodyImg: Phaser.GameObjects.Image | null = null;
    let body: Phaser.GameObjects.GameObject;
    if (this.has('egg_down')) {
      bodyImg = this.add.image(0, 2, K('egg_down'));
      bodyImg.setScale(30 / bodyImg.height);
      body = bodyImg;
    } else {
      const g = this.add.graphics();
      art.drawEgg(g, this.eggColor, 11);
      body = g;
    }
    // 名字用描边字代替方块底色，看起来更柔和
    const name = label(this, 0, bodyImg ? 16 : 12, a.name, 12, a.human ? '#1d3a66' : '#2b2b2b').setOrigin(0.5, 0).setStroke('#ffffff', 4);
    const tag = label(this, 0, -44, TX.prisonerTag, 12, '#ffffff').setOrigin(0.5).setStroke('#b03a2e', 5).setVisible(false);
    const box = this.add.container(px(a.cx), py(a.cy), [arrow, body, name, carry, carryImg, tag]).setDepth(10 + a.id);
    if (a.human) {
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xffffff, 0.95).strokeEllipse(0, 14, 30, 10);
      box.addAt(ring, 0);
      box.setDepth(20);
    }
    this.views.set(a.id, { box, body: bodyImg, carry, carryImg, arrow, tag, carryKey: '' });
  }

  // ───────── 开场提示与结算 ─────────

  private modal(h: number) {
    const layer = this.add.container(0, 0).setDepth(100);
    layer.add(this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.6).setOrigin(0).setInteractive());
    layer.add(roundPanel(this, 240, 360 - h / 2, 800, h, 0x232a38, 0.96, 0xfff27a));
    return layer;
  }

  private showIntro() {
    const layer = this.modal(560);
    layer.add(label(this, 640, 120, TX.title, 32, '#fff27a').setOrigin(0.5));
    layer.add(label(this, 640, 178, TX.intro.headline, 24, '#ffffff').setOrigin(0.5).setAlign('center').setLineSpacing(6));
    layer.add(label(this, 270, 240, TX.intro.rules.join('\n'), 15, '#dddddd').setLineSpacing(9).setWordWrapWidth(740));
    const btn = new Button(this, 550, 560, 180, 60, TX.intro.start, () => {
      layer.destroy();
      btn.destroy();
      this.running = true;
      this.toast(TX.toast.start);
    }, 0x3b6e9b);
    btn.setDepth(101);
  }

  private finish() {
    this.finished = true;
    this.running = false;
    const R = TX.result;
    const rank = this.world.ranking();
    const cut = rank.length - C.eliminate;
    const pass = rank.findIndex((r) => r.actor.human) < cut;

    const layer = this.modal(480);
    layer.add(label(this, 640, 160, pass ? R.pass : R.fail, 40, pass ? '#fff27a' : '#ff8a80').setOrigin(0.5));
    rank.forEach((r, k) => {
      const out = k >= cut;
      layer.add(label(this, 640, 225 + k * 40, R.row(k + 1, r.actor.name, r.score, out), 21, out ? '#ff8a80' : r.actor.human ? '#9cc4ff' : '#ffffff').setOrigin(0.5));
    });
    const carry = this.world.fullBottles(this.me.id);
    if (pass && (carry.tea || carry.milk)) layer.add(label(this, 640, 440, R.carry(carry.tea, carry.milk), 17, '#ffe08a').setOrigin(0.5));
    const btns: Button[] = [];
    const done = () => btns.forEach((b) => b.destroy());
    if (pass) btns.push(new Button(this, 440, 500, 190, 60, R.next, () => (done(), this.scene.start('Battle', { tutorial: true, carry })), 0x3b6e9b));
    btns.push(new Button(this, pass ? 645 : 440, 500, 190, 60, R.retry, () => (done(), this.scene.restart())));
    btns.push(new Button(this, pass ? 850 : 645, 500, 190, 60, R.menu, () => (done(), this.scene.start('Menu'))));
    btns.forEach((b) => b.setDepth(101));
  }

  // ───────── 主循环 ─────────

  update(_t: number, dtMs: number) {
    const w = this.world;
    if (this.running) {
      const dt = Math.min(0.05, dtMs / 1000);
      w.setWantDir(this.me, this.stick.dir ?? this.keyDir());
      for (const ai of this.ais) ai.update(dt);
      w.update(dt);
      this.drainEvents();
      if (w.ended && !this.finished) this.finish();
    }
    this.render();
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
    const useImg = this.has('brick');

    // 墙：闭合前后都是同一种砖堆起来的样子；闭合后只多一个庇护所图标（见 renderShelterTags）
    const usedWall = new Set<string>();
    for (let i = 0; i < w.walls.length; i++) {
      const o = w.walls[i];
      if (o === -1) continue;
      const [x, y] = tileXY(i);
      if (useImg) {
        wallBricks(i).forEach((b, k) => {
          const id = `${i}:${k}`;
          usedWall.add(id);
          let img = this.wallSprites.get(id);
          if (!img) {
            img = this.add.image(0, 0, K('brick')).setDepth(6 + k * 0.01);
            img.setScale(T / img.width);
            this.wallSprites.set(id, img);
          }
          img.setPosition(x + T / 2 + b.dx, y + T / 2 + b.dy).setAngle(b.rot).setVisible(true);
        });
      } else {
        g.fillStyle(0xc9734f, 0.9).fillRoundedRect(x + 3, y + 3, T - 6, T - 6, 3);
        g.lineStyle(1, 0x7a3522, 0.8).strokeRoundedRect(x + 3, y + 3, T - 6, T - 6, 3);
        g.lineBetween(x + 3, y + T / 2, x + T - 3, y + T / 2);
      }
      // 自己的砖加白色细框，方便认出来
      if (o === this.me.id) ov.lineStyle(1.5, 0xffffff, 0.8).strokeRoundedRect(x + 1, y + 1, T - 2, T - 2, 5);
    }
    for (const [id, img] of this.wallSprites) if (!usedWall.has(id)) img.setVisible(false);

    // 地上的物资
    const usedItem = new Set<number>();
    w.items.forEach((it, i) => {
      if (!it) return;
      const { key, h } = itemImage(it);
      const cx = px(i % w.cols);
      const cy = py((i / w.cols) | 0);
      if (!this.has(key)) return drawItem(g, it, cx, cy, 0.85);
      usedItem.add(i);
      let img = this.itemSprites.get(i);
      if (!img) {
        img = this.add.image(cx, cy, K(key)).setDepth(6.5);
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
        if (!this.springImg) this.springImg = this.add.image(0, 0, K('spring')).setDepth(6.4);
        this.springImg.setPosition(cx, cy).setScale(((T * 3) / this.springImg.width) * pulse).setVisible(true);
      } else {
        g.fillStyle(0x7fd3e6, 0.25).fillCircle(cx, cy, T * 1.5 * pulse);
        g.lineStyle(3, 0x7fd3e6).strokeCircle(cx, cy, 14);
      }
      ov.fillStyle(sp.fill === 'tea' ? 0xc68b59 : 0xfdfcf5).fillCircle(cx, cy, 6);
      ov.lineStyle(2, 0xffffff, 0.8).strokeCircle(cx, cy, 6);
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
      if (!this.shook.has(gu.id)) {
        this.shook.add(gu.id);
        this.cameras.main.shake(250, 0.004);
      }
      if (this.has('wind')) {
        let img = this.gustImgs.get(gu.id);
        if (!img) {
          img = this.add.image(cx, cy, K('wind')).setDepth(29).setAlpha(0.9);
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

  /** 闭合的庇护所：在最上面一排砖的正中挂一个小屋图标和「奶X蛋庇护所」；被挖开后图标消失 */
  private renderShelterTags() {
    const w = this.world;
    const box = new Map<number, { x0: number; x1: number; y0: number }>();
    for (let i = 0; i < w.interior.length; i++) {
      const o = w.interior[i];
      if (o === -1) continue;
      const x = i % w.cols;
      const y = (i / w.cols) | 0;
      const b = box.get(o);
      if (!b) box.set(o, { x0: x, x1: x, y0: y });
      else (b.x0 = Math.min(b.x0, x)), (b.x1 = Math.max(b.x1, x)), (b.y0 = Math.min(b.y0, y));
    }
    for (const [o, t] of this.shelterTags) if (!box.has(o)) t.setVisible(false);
    for (const [o, b] of box) {
      let t = this.shelterTags.get(o);
      if (!t) {
        const a = w.actor(o);
        const parts: Phaser.GameObjects.GameObject[] = [];
        let nameY = 0;
        if (this.has('shelter')) {
          const hut = this.add.image(0, 0, K('shelter'));
          hut.setScale(30 / hut.height);
          parts.push(hut);
          nameY = -24;
        }
        parts.push(label(this, 0, nameY, TX.shelterName(a.name, a.human), 12, '#ffe08a').setOrigin(0.5).setStroke('#3a1a10', 4));
        t = this.add.container(0, 0, parts).setDepth(8);
        this.shelterTags.set(o, t);
        // 刚闭合时弹一下
        t.setScale(0);
        this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.out' });
      }
      t.setPosition((px(b.x0) + px(b.x1)) / 2, py(b.y0 - 1) - 4).setVisible(true);
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
      const hop = a.moveT < 1 ? Math.sin(a.moveT * Math.PI) * 5 : 0;
      v.box.setPosition(px(a.fx + (a.cx - a.fx) * k), py(a.fy + (a.cy - a.fy) * k) - hop).setAngle(0).setScale(1);
    }
    if (v.body) {
      const key = K(`egg_${a.facing}` as ImgKey);
      if (v.body.texture.key !== key && this.textures.exists(key)) v.body.setTexture(key);
    }
    const [dx, dy] = DIRS[a.facing];
    v.arrow.clear().fillStyle(0xffffff, 0.8).fillTriangle(dx * 19 - dy * 5, dy * 19 - dx * 5, dx * 19 + dy * 5, dy * 19 + dx * 5, dx * 26, dy * 26);
    v.tag.setVisible(w.prisoners.has(a.id));
    const key = a.carry ? `${a.carry.kind}:${a.carry.fill}` : '';
    if (key !== v.carryKey) {
      v.carryKey = key;
      v.carry.clear();
      v.carryImg.setVisible(false);
      if (a.carry) {
        const { key: ik, h } = itemImage(a.carry);
        if (this.has(ik)) v.carryImg.setTexture(K(ik)).setScale((h * 0.8) / v.carryImg.height).setPosition(0, -26).setVisible(true);
        else drawItem(v.carry, a.carry, 0, -24, 0.7);
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

    const status = (a: Actor) => (w.prisoners.has(a.id) ? H.imprisoned : w.closed.has(a.id) ? H.shelterClosed : H.shelterOpen);
    const hold = (a: Actor) => (a.carry ? H.holding(itemName(a.carry)) : H.emptyHand);
    w.ranking().forEach((r, k) => {
      const a = r.actor;
      this.boardRows[k].setText(`${H.boardRow(k + 1, a.name, r.score)}\n   ${status(a)}`).setColor(a.human ? '#9cc4ff' : '#ffffff');
    });
    this.statusText.setText(`${hold(this.me)}\n${status(this.me)}\n${H.myScore(w.score(this.me.id))}`);

    this.actionBtn.setLabel(w.actionLabel(this.me));
  }

  // ───────── 提示 ─────────

  private toast(text: string, color = '#dddddd') {
    const t = label(this, OX, 0, text, 15, color).setDepth(50).setWordWrapWidth(FW);
    this.toasts.unshift(t);
    while (this.toasts.length > 3) this.toasts.pop()!.destroy();
    this.toasts.forEach((x, k) => x.setY(524 + k * 24).setAlpha(1 - k * 0.3));
    this.time.delayedCall(6000, () => {
      const i = this.toasts.indexOf(t);
      if (i >= 0) this.toasts.splice(i, 1);
      t.destroy();
    });
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = label(this, x, y, text, 15, color).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
}
