import Phaser from 'phaser';
import { STAGE2 as C } from '../config/stage2';
import { STAGE2_TEXT as TX } from '../copy/stage2';
import { Button, THEME, bodyText, titleText } from '../battle/ui';
import { showGuide } from '../battle/guide';
import { loadShelters, loadStash, saveEggs, saveLevel } from '../progress';
import { Actor, itemName } from '../stage1/world';
import { Stage2World } from '../stage2/world';
import { TRIANGLE_ANIM } from '../assets';
import { ImgKey, K, S, T, Stage1Scene, dashedRect, px, py } from './Stage1Scene';

/** 阴暗生物的紫色 */
const DARK_TINT = 0xa47ad8;

/**
 * 第二关「天雷已废废」：继承第一关的场景（双镜头、四角信息、摇杆、开场引导、举放物资），换掉：
 *   开局：按第一关的闭合顺序依次放置继承来的庇护所（黄色虚线框预览，按「放下」）
 *   玩法：天雷、阴暗奶鸡、伙伴手拉手、奶三角、奶蛋炸弹（规则在 src/stage2/world.ts）
 *   右上角：天雷次数、同伴、救下的奶蛋、剩余阴暗奶鸡
 * 文案在 src/copy/stage2.ts，数值在 src/config/stage2.ts。
 */
export class Stage2Scene extends Stage1Scene {
  private w2!: Stage2World;
  /** 还没放的庇护所（按第一关闭合的先后顺序） */
  private toPlace: { walls: [number, number][]; inner: [number, number][] }[] = [];
  private placeTotal = 0;
  private placing = false;
  private placeHint?: Phaser.GameObjects.Text;
  /** 奶三角转圈动画（组成奶三角时代替你和两只同伴显示） */
  private triSprite?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Stage2');
  }

  init() {
    super.init();
    this.placing = false;
    this.toPlace = [];
    this.placeHint = undefined;
    this.triSprite = undefined;
  }

  // ───────── 覆盖第一关的设定 ─────────

  protected hudTitle() {
    return TX.title;
  }
  protected hudLevel() {
    return TX.levelTag;
  }
  protected boardTitle() {
    return '小奶蛙状态';
  }
  protected boardCount() {
    return 4;
  }
  protected bgm() {
    return 'doom' as const;
  }
  protected introPages() {
    return TX.intro.pages;
  }

  protected createWorld() {
    const w = (this.w2 = new Stage2World());
    this.world = w;
    this.me = w.addCreature('player', TX.names.player, 13, 7, 1);
    this.toPlace = loadShelters().map((s) => ({ walls: [...s.walls], inner: [...s.inner] }));
    this.placeTotal = this.toPlace.length;
  }

  /** 小奶蛙用四个方向的图（你和伙伴；被感染的用紫色版），奶鸡用阴暗奶鸡图 */
  protected bodyTexture(a: Actor): ImgKey | null {
    const role = this.w2?.creatures.get(a.id)?.role;
    if (role === 'chicken') return this.has('dark_chicken') ? 'dark_chicken' : this.has('chicken') ? 'chicken' : null;
    if (role === 'darkFrog' && this.has(`dfrog_${a.facing}` as ImgKey)) return `dfrog_${a.facing}` as ImgKey;
    const k = `frog_${a.facing}` as ImgKey;
    return this.has(k) ? k : null;
  }

  /** 有专门的阴暗素材就不染色；没有时把普通的图染成紫色 */
  protected bodyTint(a: Actor) {
    const role = this.w2?.creatures.get(a.id)?.role;
    if (role === 'chicken') return this.has('dark_chicken') ? 0xffffff : DARK_TINT;
    if (role === 'darkFrog') return this.has('dfrog_down') ? 0xffffff : DARK_TINT;
    return 0xffffff;
  }

  /** 引导结束：先进入放置庇护所阶段 */
  protected onIntroDone() {
    this.placing = true;
    this.placeHint = bodyText(this, 640, 150, '', 22).setOrigin(0.5).setDepth(65).setColor('#fff6c8').setStroke('#5a3a22', 5);
    this.updatePlaceHint();
  }

  protected controlsActive() {
    return this.running || this.placing;
  }

  protected onAction() {
    if (this.placing) return this.placeCurrent();
    super.onAction();
  }

  // ───────── 放置庇护所 ─────────

  /** 当前这个庇护所放在哪里：放在你面前，离你两三格，整个形状不超出场地 */
  private ghostOrigin() {
    const shape = this.toPlace[0];
    const all = [...shape.walls, ...shape.inner];
    const sw = Math.max(...all.map((p) => p[0])) + 1;
    const sh = Math.max(...all.map((p) => p[1])) + 1;
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.me.facing];
    const gap = Math.ceil(Math.max(sw, sh) / 2) + 1;
    const cx = this.me.cx + dir[0] * gap;
    const cy = this.me.cy + dir[1] * gap;
    const ox = Math.max(0, Math.min(this.w2.cols - sw, cx - Math.floor(sw / 2)));
    const oy = Math.max(0, Math.min(this.w2.rows - sh, cy - Math.floor(sh / 2)));
    return { ox, oy };
  }

  private placeCurrent() {
    if (!this.toPlace.length) return;
    const shape = this.toPlace[0];
    const { ox, oy } = this.ghostOrigin();
    if (!this.w2.canPlace(shape, ox, oy)) {
      this.toast(TX.place.blocked, '#ffe08a');
      return;
    }
    this.w2.place(shape, ox, oy, this.me.id);
    this.toPlace.shift();
    if (this.toPlace.length) return this.updatePlaceHint();
    // 全部放好：正式开始
    this.placing = false;
    this.placeHint?.destroy();
    this.w2.begin();
    for (const a of this.w2.actors) if (!this.views.has(a.id)) this.makeView(a);
    this.running = true;
    this.toast(TX.place.done, '#7dff9a');
  }

  private updatePlaceHint() {
    this.placeHint?.setText(TX.place.hint(this.placeTotal - this.toPlace.length + 1, this.placeTotal));
  }

  // ───────── 抓手 ─────────

  protected bindInput() {
    super.bindInput();
    // 点击场地：点中能抓的蛋 / 能放的格子就用抓手，并且这次点击不再当摇杆用；没点中就照常是摇杆
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.running || this.placing || over.length) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const cx = Math.floor((wp.x - px(0)) / T + 0.5);
      const cy = Math.floor((wp.y - py(0)) / T + 0.5);
      const w = this.w2;
      if (cx < 0 || cy < 0 || cx >= w.cols || cy >= w.rows) return;
      if (w.clawAt(this.me, cy * w.cols + cx)) this.stick.cancel(p.id);
    });
  }

  /** 抓手特效：从你身上伸到目标格再收回；grab 时带着蛋回来 */
  private clawFx(kind: 'grab' | 'put', cx: number, cy: number) {
    const from = this.actorPos(this.me);
    const tx = px(cx);
    const ty = py(cy);
    const ang = Math.atan2(ty - from.y, tx - from.x);
    const dist = Math.hypot(tx - from.x, ty - from.y) / T;
    const line = this.W(this.add.graphics().setDepth(24));
    const hasImg = this.has('claw_open') && this.has('claw_closed');
    const head = hasImg
      ? this.W(this.add.image(from.x, from.y, K('claw_open')).setDepth(25).setRotation(ang + Math.PI / 2))
      : this.W(this.add.graphics({ x: from.x, y: from.y }).setDepth(25).setRotation(ang + Math.PI / 2));
    // 爪子只有半格大，靠细长的绳子够到远处；锚点在爪子中间，伸到目标时正好把蛋包住
    if (head instanceof Phaser.GameObjects.Image) head.setOrigin(0.5, 0.4).setScale((T * 0.5) / head.height);
    const drawHead = (closed: boolean) => {
      if (head instanceof Phaser.GameObjects.Image) return head.setTexture(K(closed ? 'claw_closed' : 'claw_open'));
      const g = head.clear();
      const r = T * 0.18;
      const spread = closed ? 0.25 : 0.7;
      g.lineStyle(Math.max(2, T / 18), 0xd9a441);
      for (const s of [-1, 1]) g.beginPath().moveTo(0, 0).lineTo(s * r * spread, -r * 0.7).lineTo(s * r * spread * 0.4, -r * 1.1).strokePath();
      g.fillStyle(0xfff2c4).fillCircle(0, 0, r * 0.35).lineStyle(2, 0xd9a441).strokeCircle(0, 0, r * 0.35);
    };
    drawHead(kind === 'put');
    // 放蛋：伸出去时爪子里带着蛋
    const egg = kind === 'put' && this.has('egg_down') ? this.W(this.add.image(from.x, from.y, K('egg_down')).setDepth(24.5)) : null;
    egg?.setScale((T * 0.45) / egg.height);
    const st = { k: 0 };
    const redraw = () => {
      const x = from.x + (tx - from.x) * st.k;
      const y = from.y + (ty - from.y) * st.k;
      // 细绳：深色描边 + 奶白色芯，像抓娃娃机的吊绳
      line.clear().lineStyle(Math.max(2.5, T / 22), 0x5a4020, 0.9).lineBetween(from.x, from.y, x, y);
      line.lineStyle(Math.max(1, T / 50), 0xfff2c4, 1).lineBetween(from.x, from.y, x, y);
      head.setPosition(x, y);
      egg?.setPosition(x, y);
    };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: 90 + dist * 35,
      ease: 'Quad.out',
      onUpdate: redraw,
      onComplete: () => {
        drawHead(kind === 'grab');
        egg?.destroy();
        this.tweens.add({
          targets: st,
          k: 0,
          duration: 100 + dist * 40,
          delay: 80,
          ease: 'Quad.in',
          onUpdate: redraw,
          onComplete: () => (line.destroy(), head.destroy()),
        });
      },
    });
  }

  // ───────── 主循环 ─────────

  update(t: number, dtMs: number) {
    if (this.placing) {
      const dt = Math.min(0.05, dtMs / 1000);
      this.w2.setWantDir(this.me, this.stick.dir ?? this.keyDir());
      this.w2.moveOnly(dt);
      this.render();
      this.expireToasts();
      return;
    }
    super.update(t, dtMs);
  }

  protected drainEvents() {
    // 第二关特有的画面事件：天雷落下、炸弹爆炸
    for (const e of this.w2.events2) {
      if (e.type === 'strike') this.boltFx(e.cx, e.cy);
      else if (e.type === 'explode') this.explodeFx(e.cx, e.cy);
      else if (e.type === 'triangle') this.cameras.main.flash(250, 255, 246, 200);
      else if (e.type === 'claw') this.clawFx(e.kind, e.cx, e.cy);
    }
    this.w2.events2.length = 0;
    super.drainEvents();
  }

  private boltFx(cx: number, cy: number) {
    const x = px(cx);
    const y = py(cy);
    // 有天雷素材：紫色闪电从上往下劈下来
    if (this.has('thunder')) {
      const bolt = this.W(this.add.image(x, y + T * 0.4, K('thunder')).setOrigin(0.5, 1).setDepth(40));
      bolt.setScale((T * 5) / bolt.height).setAlpha(0);
      const flash = this.W(this.add.graphics().setDepth(39));
      flash.fillStyle(0xe6d0ff, 0.5).fillRect(x - T * 1.5, y - T * 1.5, T * 3, T * 3);
      this.tweens.add({ targets: bolt, alpha: 1, duration: 60, yoyo: true, hold: 220, onComplete: () => bolt.destroy() });
      this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
      return;
    }
    const g = this.W(this.add.graphics().setDepth(40));
    g.lineStyle(6 * S() * 0.6, 0xfffbd0);
    g.beginPath().moveTo(x + T * 0.6, y - T * 6);
    for (let k = 1; k < 6; k++) g.lineTo(x + Phaser.Math.Between(-T / 3, T / 3), y - T * 6 + k * T);
    g.lineTo(x, y).strokePath();
    g.fillStyle(0xffffff, 0.55).fillRect(x - T * 1.5, y - T * 1.5, T * 3, T * 3);
    this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
  }

  private explodeFx(cx: number, cy: number) {
    const g = this.W(this.add.graphics({ x: px(cx), y: py(cy) }).setDepth(40));
    g.fillStyle(0xff8a3c, 0.85).fillCircle(0, 0, T * C.egg.blastRadius);
    g.fillStyle(0xfff2a0, 0.9).fillCircle(0, 0, T * 0.6);
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1.2, alpha: 0, duration: 500, ease: 'Cubic.out', onComplete: () => g.destroy() });
    this.cameras.main.shake(180, 0.006);
  }

  protected render() {
    // 新出现的角色（比如中途从场边跑来的伙伴）补上画面，否则绘制时找不到
    for (const a of this.w2.actors) if (!this.views.has(a.id)) this.makeView(a);
    super.render();
    const w = this.w2;
    const g = this.dyn;
    const ov = this.over;
    const fx = this.fx;
    // 焦土：被炸毁的砖墙位置，不能再放砖
    for (const i of w.scorched) {
      const x = (i % w.cols) * T;
      const y = ((i / w.cols) | 0) * T;
      g.fillStyle(0x2a1a12, 0.75).fillRoundedRect(x + 3, y + 3, T - 6, T - 6, T * 0.2);
    }
    // 天雷预警：3×3 的范围一闪一闪
    const R = C.thunder.radius;
    for (const th of w.thunders) {
      const a = 0.35 + 0.3 * Math.sin(w.t * 14);
      const x = (th.cx - R) * T;
      const y = (th.cy - R) * T;
      fx.fillStyle(0xfff27a, a * 0.5).fillRect(x, y, T * (R * 2 + 1), T * (R * 2 + 1));
      fx.lineStyle(3, 0xfff27a, 0.9).strokeRect(x, y, T * (R * 2 + 1), T * (R * 2 + 1));
    }
    // 奶三角：有转圈动画就用动画代替你和两只同伴；没有时在三个人之间连发光的线
    const useAnim = w.triangle && this.anims.exists(TRIANGLE_ANIM);
    if (useAnim) {
      if (!this.triSprite) {
        this.triSprite = this.W(this.add.sprite(0, 0, 'triangle-anim').setDepth(21));
        this.triSprite.play(TRIANGLE_ANIM);
      }
      const p = this.actorPos(this.me);
      this.triSprite.setPosition(p.x, p.y).setScale((T * (C.triangle.radius * 2 + 1.2)) / 220).setVisible(true);
    } else this.triSprite?.setVisible(false);
    if (w.triangle && !useAnim) {
      const pts = [this.me, ...w.joinedBuddies().slice(0, 2)].map((a) => this.actorPos(a));
      ov.lineStyle(5, 0xfff27a, 0.55);
      ov.strokePoints([...pts, pts[0]].map((p) => new Phaser.Geom.Point(p.x, p.y)));
      ov.lineStyle(2, 0xffffff, 0.9);
      ov.strokePoints([...pts, pts[0]].map((p) => new Phaser.Geom.Point(p.x, p.y)));
    }
    // 被攻击中：头顶画一圈红色进度
    for (const a of w.actors) {
      const r = w.creatures.get(a.id);
      if (!r || a.gone || r.attackT <= 0) continue;
      const p = this.actorPos(a);
      const k = Math.min(1, r.attackT / C.dark.frogDie);
      ov.lineStyle(4, 0xff4030, 0.9).beginPath().arc(p.x, p.y - T * 0.9, T * 0.22, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
    }
    // 抓手瞄准：空手时能抓的蛋黄色虚线框，抓着蛋时庇护所里能放的空格绿色虚线框
    if (this.running && !this.placing) {
      const put = this.me.carry?.kind === 'egg';
      for (const i of w.clawTargets(this.me)) {
        const x = (i % w.cols) * T;
        const y = ((i / w.cols) | 0) * T;
        dashedRect(ov, px(0) - T / 2 + x + 2, py(0) - T / 2 + y + 2, T - 4, T - 4, put ? 0x7dff9a : 0xffd84a, 1, Math.max(2, T / 14), w.t);
      }
    }
    // 放置阶段：黄色虚线框预览庇护所形状，放不下时变淡变红
    if (this.placing && this.toPlace.length) {
      const shape = this.toPlace[0];
      const { ox, oy } = this.ghostOrigin();
      const ok = w.canPlace(shape, ox, oy);
      for (const [dx, dy] of shape.walls) dashedRect(ov, (ox + dx) * T + 2, (oy + dy) * T + 2, T - 4, T - 4, ok ? 0xffd84a : 0xff6040, ok ? 1 : 0.6, Math.max(2, T / 14), w.t);
      for (const [dx, dy] of shape.inner) ov.fillStyle(ok ? 0xfff6c8 : 0xff6040, 0.18).fillRect((ox + dx) * T + 4, (oy + dy) * T + 4, T - 8, T - 8);
    }
  }

  /** 角色在场地上的实际位置（奶三角里的同伴用绕圈的位置） */
  private actorPos(a: Actor) {
    const r = this.w2.creatures.get(a.id);
    if (r && r.role === 'buddy' && r.joined && this.w2.triangle) return { x: px(r.orbitX), y: py(r.orbitY) };
    const v = this.views.get(a.id);
    return v ? { x: v.box.x, y: v.box.y } : { x: px(a.cx), y: py(a.cy) };
  }

  protected renderActor(a: Actor) {
    super.renderActor(a);
    const v = this.views.get(a.id);
    const r = this.w2.creatures.get(a.id);
    if (!v || !r) return;
    // 奶三角里的同伴：用平滑的绕圈位置；有转圈动画时，同伴和你的身体都由动画代替显示
    const tri = this.w2.triangle && this.anims.exists(TRIANGLE_ANIM);
    if (r.role === 'buddy' && r.joined && this.w2.triangle && !a.gone) {
      v.box.setPosition(px(r.orbitX), py(r.orbitY));
      if (tri) v.box.setVisible(false);
    }
    if (a.human) v.body?.setVisible(!tri);
    // 奶鸡图朝右，朝左走时翻转
    if (r.role === 'chicken' && v.body) v.body.setFlipX(a.facing === 'left');
  }

  protected renderHud() {
    const w = this.w2;
    const H = TX.hud;
    const left = this.placing ? C.duration : Math.max(0, C.duration - w.t);
    this.timerText.setText(`剩余 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`).setColor(left < 20 ? '#ff8a80' : '#ffffff');
    if (this.placing) {
      this.eventText.setText('');
    } else {
      const due = w.thunders.length > 0;
      const next = C.thunder.firstAt + Math.ceil(Math.max(0, w.t - C.thunder.firstAt + 0.001) / C.thunder.interval) * C.thunder.interval;
      this.eventText.setText(due ? H.thunderNow : H.thunderIn(Math.ceil(Math.max(0, next - w.t)))).setColor(due ? '#ffe08a' : '#d8ecff');
    }
    const r = w.role(this.me);
    const rows = [H.hits(r.hits, C.thunder.hitsToDie), H.buddies(w.joinedBuddies().length), H.eggs(w.savedEggs()), H.chickens(w.darkLeft())];
    rows.forEach((t, k) => this.boardRows[k]?.setText(t).setColor(k === 0 && r.hits > 0 ? '#c0392b' : THEME.text));
    const stash = loadStash();
    const hold = this.me.carry ? `举着${itemName(this.me.carry)}` : '空手';
    this.statusText.setText(`${hold}${r.attackT > 0 ? `\n${H.attacked(r.attackT)}` : ''}\n${H.bottles(stash.tea, stash.milk, stash.empty)}`);
    this.actionBtn.setLabel(this.placing ? TX.place.button : w.actionLabel(this.me));
  }

  protected finish() {
    this.finished = true;
    this.running = false;
    const o = this.w2.outcome ?? { win: !this.me.gone, reason: TX.result.survived };
    const R = TX.result;
    const layer = this.modal(420);
    layer.add(titleText(this, 640, 210, o.win ? R.win : R.lose, 46).setOrigin(0.5).setColor(o.win ? THEME.title : '#ff9a8a'));
    layer.add(bodyText(this, 640, 280, o.reason, 24).setOrigin(0.5));
    layer.add(bodyText(this, 640, 330, R.eggs(this.w2.savedEggs()), 20).setOrigin(0.5).setColor('#b5651d'));
    if (o.win) {
      saveLevel(3);
      saveEggs(this.w2.savedEggs());
      showGuide(this, 230, 330, { from: 'left', height: 200, depth: 102 });
    }
    const btns: Button[] = [];
    if (o.win) btns.push(new Button(this, 430, 400, 200, 60, R.nextChapter, () => this.scene.start('Stage3'), THEME.green));
    btns.push(new Button(this, o.win ? 645 : 440, 400, 190, 60, R.retry, () => this.scene.restart(), THEME.orange));
    btns.push(new Button(this, o.win ? 850 : 645, 400, 190, 60, R.menu, () => this.scene.start('Menu'), THEME.blue));
    btns.forEach((b) => b.setDepth(101));
  }
}

export type { ImgKey };
export { K };
