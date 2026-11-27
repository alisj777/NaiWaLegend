import Phaser from 'phaser';
import { STAGE4 as C } from '../config/stage4';
import { STAGE4_TEXT as TX } from '../copy/stage4';
import { Button, THEME, bodyText, outlineText, pill, scrollPanel, titleText } from '../battle/ui';
import { coverImage, fitScreen, fullBg, screenEdges } from '../battle/layout';
import { playBgm, playJingle } from '../battle/music';
import { showGuide } from '../battle/guide';
import { AchievementId, showAchievements } from '../battle/achievements';
import { Ch3Result, loadCh3Result, unlockAchievement } from '../progress';
import { Stage1ImageKey, stage1Key } from '../assets';
import { Duel, Side } from '../stage4/duel';
import { STAGE3_TEXT } from '../copy/stage3';
import { dashedRect } from './Stage1Scene';

const K = stage1Key;

/** 奶家军（发射方）站在左边，暗派（扭腰方）站在右边。坐标按 1280×720 设计区域 */
const SHOOTER = { x: 300, bottom: 690, h: 460 };
const DODGER = { x: 880, bottom: 690, h: 480 };
/** 肚脐虚线框边长（像素）= 规则里的 1 个单位 */
const U = 56;
/** 各张图里肚脐的位置（相对图片宽高）；扭腰图朝右扭，朝左时左右翻转 */
const NAVEL: Record<string, { x: number; y: number }> = {
  dark_sigma_idle: { x: 0.5, y: 0.505 },
  dark_sigma_twist: { x: 0.63, y: 0.51 },
  dark_sigma_hit: { x: 0.5, y: 0.52 },
};
/** 西格玛吹针管口的位置（相对图片宽高） */
const MOUTH = { x: 0.68, y: 0.17 };
/** 暗派站立时肚脐在屏幕上的高度 */
const NAVEL_Y = DODGER.bottom - DODGER.h + NAVEL.dark_sigma_idle.y * DODGER.h;

export interface Stage4Data {
  /** 开发测试时直接指定身份（不看第三章存档） */
  role?: Ch3Result;
}

/**
 * 第四章「终极决斗」：1 对 1。你在哪边由第三章的结果决定（规则在 src/stage4/duel.ts）。
 *   奶家军：点屏幕发射解毒针，瞄准对面肚脐（黄色虚线框），要预判它扭到哪
 *   暗派：拖动下方滑杆（或 ← →）左右扭腰躲针；串子要故意被射中
 * 文案在 src/copy/stage4.ts，数值在 src/config/stage4.ts。
 */
export class Stage4Scene extends Phaser.Scene {
  private duel!: Duel;
  private role: Ch3Result = 'good';
  private running = false;
  private finished = false;
  private shooter!: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private dodger!: Phaser.GameObjects.Image | null;
  private dodgerFallback?: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private needleImgs = new Map<number, Phaser.GameObjects.GameObject>();
  private hud!: { time: Phaser.GameObjects.Text; needles: Phaser.GameObjects.Text; hits: Phaser.GameObjects.Text };
  private aim = { x: 0, y: 0, on: false };
  private slider?: { knob: Phaser.GameObjects.Arc; x0: number; x1: number; y: number; value: number; dragging: boolean };
  private keys?: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() {
    super('Stage4');
  }

  init(data?: Stage4Data) {
    this.running = false;
    this.finished = false;
    this.needleImgs = new Map();
    this.slider = undefined;
    this.role = data?.role ?? loadCh3Result() ?? 'good';
    this.pendingPick = !data?.role && !loadCh3Result() && import.meta.env.DEV;
  }
  private pendingPick = false;

  private get side(): Side {
    return this.role === 'good' ? 'good' : 'dark';
  }

  private has(k: Stage1ImageKey) {
    return this.textures.exists(K(k));
  }

  create() {
    fitScreen(this, () => this.placeHud());
    fullBg(this, 0x2a2238);
    if (this.has('duel_arena')) coverImage(this, K('duel_arena'));
    else if (this.textures.exists('menu-village')) coverImage(this, 'menu-village');
    this.add.rectangle(640, 360, 3840, 2160, 0x1a1028, 0.35);
    playBgm(this, 'sigma');
    // 开发时没有第三章存档：先选身份
    if (this.pendingPick) return this.devPick();

    this.duel = new Duel(this.side);
    // 奶家军（发射方）：西格玛奶蛙
    if (this.has('sigma_shoot')) {
      const im = this.add.image(SHOOTER.x, SHOOTER.bottom, K('sigma_shoot')).setOrigin(0.5, 1);
      im.setScale(SHOOTER.h / im.height);
      this.shooter = im;
    } else {
      this.shooter = this.add.graphics().fillStyle(0xf2c94c).fillRoundedRect(SHOOTER.x - 110, SHOOTER.bottom - SHOOTER.h, 220, SHOOTER.h, 60);
    }
    // 暗派（扭腰方）：暗西格玛奶蛙，以肚脐为原点摆放
    if (this.has('dark_sigma_idle')) {
      this.dodger = this.add.image(DODGER.x, NAVEL_Y, K('dark_sigma_idle'));
    } else {
      this.dodger = null;
      this.dodgerFallback = this.add.graphics();
    }
    this.over = this.add.graphics().setDepth(20);
    // 名字牌：你这边标「你」
    const you = this.side === 'good' ? SHOOTER : DODGER;
    pill(this, you.x, you.bottom - you.h - 18, TX.hud.you(TX.sides[this.side]), this.side === 'good' ? THEME.green : 0x7a4ab0, 16).setDepth(21);

    this.buildHud();
    this.bindInput();
    this.showIntro();
  }

  // ───────── 开发：选身份 ─────────

  private devPick() {
    const P = TX.devPick;
    this.add.existing(scrollPanel(this, 340, 200, 600, 320));
    titleText(this, 640, 270, P.title, 26).setOrigin(0.5);
    (['good', 'dark', 'mole'] as Ch3Result[]).forEach((r, k) => {
      new Button(this, 385 + k * 175, 360, 160, 60, P[r], () => this.scene.restart({ role: r } satisfies Stage4Data), [THEME.green, 0x7a4ab0, THEME.orange][k]);
    });
  }

  // ───────── 界面 ─────────

  private buildHud() {
    const e = screenEdges(this);
    titleText(this, e.left + 22, e.top + 12, TX.title, 28).setDepth(30);
    this.hud = {
      time: outlineText(this, 640, e.top + 16, '', 24).setOrigin(0.5, 0).setDepth(30),
      needles: outlineText(this, e.right - 24, e.top + 16, '', 20, '#e8f6ff').setOrigin(1, 0).setDepth(30),
      hits: outlineText(this, e.right - 24, e.top + 46, '', 20, '#ffe08a').setOrigin(1, 0).setDepth(30),
    };
    outlineText(this, 640, e.top + 52, this.side === 'good' ? TX.hud.tapToFire : TX.hud.dragToTwist, 17, '#d8d0f0').setOrigin(0.5, 0).setDepth(30);
    if (this.side === 'dark') this.buildSlider();
  }

  private placeHud() {
    // 屏幕尺寸变化时简单起见重开场景外的元素不动；右上角数字跟着右边缘
    if (!this.hud) return;
    const e = screenEdges(this);
    this.hud.needles.setX(e.right - 24);
    this.hud.hits.setX(e.right - 24);
  }

  /** 暗派的滑杆：底部正中一条横杆，拖动圆钮左右扭腰 */
  private buildSlider() {
    const y = 668;
    const x0 = 420;
    const x1 = 860;
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x0 - 30, y - 22, x1 - x0 + 60, 44, 22);
    g.lineStyle(6, 0xffffff, 0.5).lineBetween(x0, y, x1, y);
    g.fillStyle(0xffffff, 0.8).fillCircle(x0, y, 5).fillCircle(x1, y, 5).fillCircle((x0 + x1) / 2, y, 4);
    const knob = this.add.circle((x0 + x1) / 2, y, 26, 0xb57aff, 0.95).setStrokeStyle(4, 0xffffff).setDepth(31).setInteractive({ draggable: true, useHandCursor: true });
    this.slider = { knob, x0, x1, y, value: 0, dragging: false };
    knob.on('dragstart', () => this.slider && (this.slider.dragging = true));
    knob.on('dragend', () => this.slider && (this.slider.dragging = false));
    knob.on('drag', (_p: Phaser.Input.Pointer, dx: number) => this.setSlider(((dx - x0) / (x1 - x0)) * 2 - 1));
    // 点杆上任何位置也能直接跳过去
    const hit = this.add.rectangle((x0 + x1) / 2, y, x1 - x0 + 60, 60, 0xffffff, 0.001).setDepth(29).setInteractive();
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.setSlider(((p.worldX - x0) / (x1 - x0)) * 2 - 1));
  }

  private setSlider(v: number) {
    const s = this.slider;
    if (!s) return;
    s.value = Phaser.Math.Clamp(v, -1, 1);
    s.knob.setX(s.x0 + ((s.value + 1) / 2) * (s.x1 - s.x0));
  }

  private bindInput() {
    const kb = this.input.keyboard;
    if (kb) this.keys = { left: kb.addKey('LEFT'), right: kb.addKey('RIGHT') };
    if (this.side !== 'good') return;
    // 奶家军：点哪射哪（点在按钮上不算）
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.aim = { x: p.worldX, y: p.worldY, on: true };
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.running || over.length) return;
      this.aim = { x: p.worldX, y: p.worldY, on: true };
      this.duel.fire((p.worldX - DODGER.x) / U, (p.worldY - NAVEL_Y) / U);
    });
  }

  // ───────── 引导 ─────────

  private showIntro() {
    const pages = [...TX.intro[this.side], ...(this.role === 'mole' ? [TX.intro.mole] : [])];
    const layer = this.add.container(0, 0).setDepth(100);
    layer.add(fullBg(this, 0x000000, 0.5).setInteractive());
    layer.add(scrollPanel(this, 200, 150, 880, 420));
    const guide = showGuide(this, 150, 300, { from: 'left', height: 230, depth: 102, delay: 300 });
    let page = 0;
    let content: Phaser.GameObjects.Container | null = null;
    const btn = new Button(this, 545, 470, 190, 60, '', () => {
      page++;
      if (page < pages.length) return render();
      btn.destroy();
      content?.destroy();
      layer.destroy();
      guide.leave();
      this.start();
    }, THEME.orange).setDepth(101);
    const render = () => {
      content?.destroy();
      content = this.add.container(0, 0).setDepth(101);
      content.add(titleText(this, 640, 230, pages[page].title, 36).setOrigin(0.5));
      content.add(bodyText(this, 640, 330, pages[page].text, 19, 720).setOrigin(0.5).setAlign('center').setLineSpacing(8));
      btn.setLabel(page === pages.length - 1 ? TX.intro.start : '下一页');
    };
    render();
  }

  private start() {
    this.running = true;
    // 开局一句提示：奶家军「以奶味净化雷霆之力！」，暗派「还好我是正太」
    const t = titleText(this, 640, 300, TX.tagline[this.side], 46).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 280, duration: 400, hold: 1200, yoyo: true, onComplete: () => t.destroy() });
  }

  // ───────── 主循环 ─────────

  update(_t: number, dtMs: number) {
    if (!this.duel) return;
    const d = this.duel;
    if (this.running) {
      if (this.side === 'dark') {
        // 方向键按住时扭到底，松开回到滑杆的位置
        const k = this.keys;
        if (k?.left.isDown) this.setSlider(-1);
        else if (k?.right.isDown) this.setSlider(1);
        d.twistTarget = this.slider?.value ?? 0;
      }
      d.update(Math.min(0.05, dtMs / 1000));
      this.drainEvents();
      if (d.winner && !this.finished) this.time.delayedCall(700, () => this.finish());
      if (d.winner) this.running = false;
    }
    this.render();
  }

  /** 解毒针飞行起点：西格玛的吹针管口 */
  private mouth() {
    const top = SHOOTER.bottom - SHOOTER.h;
    const w = this.shooter instanceof Phaser.GameObjects.Image ? this.shooter.displayWidth : 220;
    return { x: SHOOTER.x - w / 2 + MOUTH.x * w, y: top + MOUTH.y * SHOOTER.h };
  }

  private drainEvents() {
    const d = this.duel;
    for (const e of d.events) {
      const n = d.needles.find((q) => q.id === e.id);
      if (e.type === 'fire' && n) {
        const from = this.mouth();
        const tx = DODGER.x + n.x * U;
        const ty = NAVEL_Y + n.y * U;
        const ang = Math.atan2(ty - from.y, tx - from.x);
        const img = this.has('needle')
          ? this.add.image(from.x, from.y, K('needle')).setScale(0.6).setRotation(ang).setDepth(25)
          : this.add.rectangle(from.x, from.y, 40, 6, 0xfdfcf5).setRotation(ang).setDepth(25);
        this.needleImgs.set(n.id, img);
        this.tweens.add({ targets: img, x: tx, y: ty, duration: C.needleFlight * 1000, ease: 'Linear' });
      } else if (e.type === 'hit' || e.type === 'miss') {
        const img = this.needleImgs.get(e.id) as Phaser.GameObjects.Image | undefined;
        this.needleImgs.delete(e.id);
        const x = img?.x ?? DODGER.x;
        const y = img?.y ?? NAVEL_Y;
        if (e.type === 'hit') {
          this.float(x, y - 40, TX.float.hit, '#fff6a0');
          this.cameras.main.flash(180, 255, 250, 230);
          // 中针：针插在肚脐上一会儿再消失
          if (img) this.tweens.add({ targets: img, alpha: 0, delay: 500, duration: 300, onComplete: () => img.destroy() });
        } else {
          this.float(x, y - 40, TX.float.miss, '#d8c8ff');
          if (img) this.tweens.add({ targets: img, alpha: 0, x: img.x + 80, duration: 300, onComplete: () => img.destroy() });
        }
      }
    }
    d.events.length = 0;
  }

  private float(x: number, y: number, text: string, color: string) {
    const t = outlineText(this, x, y, text, 22, color).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
  }

  private render() {
    const d = this.duel;
    const nx = DODGER.x + d.navelX() * U;
    // 暗西格玛：中针后换中针图，扭得多换扭腰图（朝左时翻转），否则站立图；以肚脐对齐
    const key = d.t - d.lastHitAt < 0.6 ? 'dark_sigma_hit' : Math.abs(d.twist) > 0.3 ? 'dark_sigma_twist' : 'dark_sigma_idle';
    if (this.dodger) {
      const im = this.dodger;
      if (im.texture.key !== K(key as Stage1ImageKey) && this.has(key as Stage1ImageKey)) im.setTexture(K(key as Stage1ImageKey));
      const flip = key === 'dark_sigma_twist' && d.twist < 0;
      const nv = NAVEL[key] ?? NAVEL.dark_sigma_idle;
      im.setScale(DODGER.h / im.height).setFlipX(flip).setOrigin(flip ? 1 - nv.x : nv.x, nv.y).setPosition(nx, NAVEL_Y);
    } else if (this.dodgerFallback) {
      this.dodgerFallback.clear().fillStyle(0x5a3a8a).fillRoundedRect(nx - 110, NAVEL_Y - DODGER.h / 2, 220, DODGER.h, 60);
    }
    const ov = this.over.clear();
    // 肚脐虚线框
    dashedRect(ov, nx - U / 2, NAVEL_Y - U / 2, U, U, 0xffd84a, 1, 3, d.t);
    // 奶家军：准星跟着手指 / 鼠标
    if (this.side === 'good' && this.aim.on && this.running) {
      const ready = d.canFire();
      ov.lineStyle(3, ready ? 0xffffff : 0x999999, 0.9).strokeCircle(this.aim.x, this.aim.y, 18);
      ov.lineBetween(this.aim.x - 26, this.aim.y, this.aim.x - 10, this.aim.y).lineBetween(this.aim.x + 10, this.aim.y, this.aim.x + 26, this.aim.y);
      ov.lineBetween(this.aim.x, this.aim.y - 26, this.aim.x, this.aim.y - 10).lineBetween(this.aim.x, this.aim.y + 10, this.aim.x, this.aim.y + 26);
    }
    this.hud.time.setText(TX.hud.timeLeft(Math.max(0, C.duration - d.t)));
    this.hud.needles.setText(TX.hud.needles(d.needlesLeft));
    this.hud.hits.setText(TX.hud.hits(d.hits));
  }

  // ───────── 结算 ─────────

  private finish() {
    if (this.finished) return;
    this.finished = true;
    const d = this.duel;
    const R = TX.result;
    const won = d.winner === this.side;
    // 成就：奶家军赢 → 拯救奶家村（串子让奶家军赢 → 再加超级串子）；暗派赢、你在暗派 → 很会扭啊
    const ids: AchievementId[] = [];
    if (d.winner === 'good' && (this.role === 'good' || this.role === 'mole')) ids.push('saveVillage');
    if (d.winner === 'good' && this.role === 'mole') ids.push('superMoleX3');
    if (d.winner === 'dark' && this.side === 'dark') ids.push('goodTwist');
    const fresh = ids.filter((id) => unlockAchievement(id));

    const layer = this.add.container(0, 0).setDepth(100);
    layer.add(fullBg(this, 0x000000, 0.5).setInteractive());
    layer.add(scrollPanel(this, 200, 150, 880, 420));
    layer.add(titleText(this, 640, 220, d.winner === 'good' ? R.goodWin : R.darkWin, 44).setOrigin(0.5).setColor(d.winner === 'good' ? THEME.title : '#8a5ad0'));
    const sub = this.role === 'mole' ? (d.winner === 'good' ? R.moleWin : R.moleFail) : won ? R.youWin : R.youLose;
    const good = this.role === 'mole' ? d.winner === 'good' : won;
    layer.add(bodyText(this, 640, 285, sub, 24).setOrigin(0.5).setColor(good ? '#2e7d32' : '#c0392b'));
    layer.add(bodyText(this, 640, 325, TX.hud.hits(d.hits), 19).setOrigin(0.5));
    fresh.forEach((id, k) => layer.add(bodyText(this, 640, 365 + k * 32, `解锁成就：${this.achvName(id)}`, 21).setOrigin(0.5).setColor('#c0601a').setFontStyle('bold')));
    const ending = d.winner === 'good' ? 'end_good' : 'end_dark';
    const btns = [
      new Button(this, 330, 470, 200, 60, R.ending, () => this.scene.start('Story', { chapter: ending }), THEME.green),
      new Button(this, 545, 470, 190, 60, R.retry, () => this.scene.restart({ role: this.role } satisfies Stage4Data), THEME.orange),
      new Button(this, 750, 470, 190, 60, R.menu, () => this.scene.start('Menu'), THEME.blue),
    ];
    btns.forEach((b) => b.setDepth(101));
    // 结算音乐：第一次解锁超级串子放「串子第二次结算」；你是奶家军并赢了放「奶家军胜利结算」
    if (!fresh.includes('superMoleX3') && d.winner === 'good' && this.role === 'good') playJingle(this, 'goodWin');
    if (fresh.length)
      this.time.delayedCall(700, () => {
        if (fresh.includes('superMoleX3')) playJingle(this, 'mole2');
        showAchievements(this, fresh.map((id) => ({ id, hidden: id === 'superMoleX3' })));
      });
  }

  private achvName(id: AchievementId) {
    return STAGE3_TEXT.achievements[id].name;
  }
}
