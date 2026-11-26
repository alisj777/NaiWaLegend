import Phaser from 'phaser';
import { BALANCE as B } from '../config/balance';
import { currentSkin, Skin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';
import { Tutorial } from '../battle/tutorial';
import { fitScreen, fullBg } from '../battle/layout';
import { stopBgm } from '../battle/music';
import { BattleEvent, BattleWorld, CardId, FIELD, Hero, Poop, SHOP_NAMES, ShopKey, SideId, Unit } from '../battle/logic/battle';

/**
 * 主战斗的画面层：规则全在 BattleWorld（src/battle/logic/battle.ts），这里只负责
 * 把状态画出来、把按钮和点击变成指令、把逻辑事件变成飘字和特效。
 */

interface SideHud {
  name: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  growFill: Phaser.GameObjects.Rectangle;
  info: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface UnitView {
  box: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  bow: Phaser.GameObjects.Graphics;
  key: string;
}

const CARD_COLORS: Record<CardId, number> = {
  dog: 0x8a5a32,
  mouse: 0x8e7cc3,
  powder: 0x4a90c2,
  chicken: 0xc0862a,
  poop: 0x6b4a2b,
};
const HP_BAR_W = 220;

export class BattleScene extends Phaser.Scene {
  private skin!: Skin;
  private w!: BattleWorld;
  private wantTutorial = false;
  /** 第一关灵泉装满带过来的道具，正式开战时交给逻辑层 */
  private carryIn = { tea: 0, milk: 0 };
  private tutorial: Tutorial | null = null;
  private leaving = false;

  // 场上物体的画面
  private unitViews = new Map<Unit, UnitView>();
  private poopViews = new Map<Poop, Phaser.GameObjects.Container>();
  private projViews = new Map<number, Phaser.GameObjects.Graphics>();
  private thunderViews = new Map<number, Phaser.GameObjects.Graphics>();

  // HUD
  private hud!: Record<SideId, SideHud>;
  private clockText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private cardButtons: Button[] = [];
  private shop: Record<string, Button> = {};
  private shopLabels: [ShopKey, string][] = [];
  private poopText!: Phaser.GameObjects.Text;
  private friendRows: { text: Phaser.GameObjects.Text; protect: Button; fight: Button; sell: Button }[] = [];
  private pollution!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Battle');
  }

  init(data: { tutorial?: boolean; carry?: { tea: number; milk: number } }) {
    // 场景重开时重置状态
    this.wantTutorial = !!data?.tutorial;
    this.carryIn = data?.carry ?? { tea: 0, milk: 0 };
    this.tutorial = null;
    this.leaving = false;
    this.unitViews = new Map();
    this.poopViews = new Map();
    this.projViews = new Map();
    this.thunderViews = new Map();
    this.logLines = [];
    this.cardButtons = [];
    this.shop = {};
    this.shopLabels = [];
    this.friendRows = [];
  }

  create() {
    this.skin = currentSkin();
    this.w = new BattleWorld(this.skin);
    fitScreen(this);
    // 对战暂时没有专属音乐，先停掉上一段的背景音乐
    stopBgm(this);
    this.drawField();
    this.buildHud();
    this.pollution = this.add.graphics().setDepth(200).setVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onFieldClick(p));
    if (this.wantTutorial) {
      this.w.tutorialActive = true;
      this.tutorial = new Tutorial(this);
    } else {
      this.startBattle();
    }
  }

  // ───────── 给新手引导用的钩子 ─────────

  get tutorialActive() {
    return this.w.tutorialActive;
  }
  get playerHero() {
    return this.w.sides.player.hero;
  }
  get playerHand() {
    return this.w.sides.player.hand;
  }
  spawnTutorialPoop(x: number, y: number) {
    return this.w.spawnPoop(x, y, 1, null);
  }
  spawnThunderAt(x: number, y: number, warnTime?: number) {
    this.w.spawnThunderAt(x, y, warnTime);
  }
  /** 卡牌位置，引导箭头用 */
  cardButtonCenter(index: number) {
    const b = this.cardButtons[index];
    return b ? { x: b.x + 46, y: b.y } : null;
  }
  /** 引导结束（或跳过）后正式开战 */
  startBattle() {
    this.tutorial = null;
    this.w.startBattle(this.carryIn);
    this.carryIn = { tea: 0, milk: 0 };
  }

  // ───────────────────────── 主循环 ─────────────────────────

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.w.update(dt);
    this.drainEvents();
    this.syncViews();
    this.tutorial?.update();
    this.refreshHud();
  }

  private drainEvents() {
    for (const e of this.w.events) this.handleEvent(e);
    this.w.events.length = 0;
  }

  private handleEvent(e: BattleEvent) {
    switch (e.type) {
      case 'toast':
        return this.toast(e.text);
      case 'log':
        return this.log(e.text);
      case 'float':
        return this.floatText(e.x, e.y, e.text, e.color);
      case 'heroHit': {
        const v = this.unitViews.get(this.w.sides[e.side].hero);
        if (v) this.tweens.add({ targets: v.box, scale: 1.15, yoyo: true, duration: 80 });
        return;
      }
      case 'strike': {
        const bolt = this.add.graphics().setDepth(150);
        bolt.lineStyle(6, 0xfffbd0);
        bolt.beginPath().moveTo(e.x + 30, 0);
        for (let y = 60; y < e.y; y += 60) bolt.lineTo(e.x + Phaser.Math.Between(-25, 25), y);
        bolt.lineTo(e.x, e.y).strokePath();
        bolt.fillStyle(0xffffff, 0.6).fillCircle(e.x, e.y, B.thunder.radius);
        this.tweens.add({ targets: bolt, alpha: 0, duration: 350, onComplete: () => bolt.destroy() });
        return;
      }
      case 'spray': {
        const g = this.add.graphics().setDepth(30);
        g.lineStyle(8, this.skin.colors.poop, 0.9).lineBetween(e.from.x, e.from.y, e.to.x, e.to.y);
        this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
        return;
      }
      case 'pollute': {
        if (e.side !== 'player') return;
        const g = this.pollution.clear();
        for (let i = 0; i < 14; i++) {
          const x = Phaser.Math.Between(FIELD.x + 30, FIELD.x + FIELD.w - 30);
          const y = Phaser.Math.Between(FIELD.y + 30, FIELD.y + FIELD.h - 30);
          g.fillStyle(this.skin.colors.poop, 0.92).fillCircle(x, y, Phaser.Math.Between(40, 95));
          g.fillStyle(0x5e3b1a, 0.9).fillCircle(x + 15, y - 10, Phaser.Math.Between(15, 35));
        }
        g.setVisible(true).setAlpha(1);
        return;
      }
      case 'eggFlash': {
        const flash = this.add.graphics().setDepth(160);
        flash.fillStyle(0xffffff, 0.9).fillCircle(e.x, e.y, 10);
        this.tweens.add({ targets: flash, scale: 30, alpha: 0, duration: 900 });
        return;
      }
      case 'duel':
        if (this.leaving) return;
        this.leaving = true;
        this.cameras.main.flash(600, 255, 255, 255);
        this.time.delayedCall(1500, () => this.scene.start('Duel', { playerIsDark: e.playerIsDark, elapsed: e.elapsed }));
        return;
      case 'end':
        if (this.leaving) return;
        this.leaving = true;
        this.time.delayedCall(1500, () => this.scene.start('Result', { win: e.win, reason: e.reason, elapsed: e.elapsed }));
        return;
      case 'tut':
        // 新手引导监听这些事件推进步骤
        if (e.name === 'card') this.events.emit('tut:card', e.card);
        else this.events.emit(`tut:${e.name}`);
        return;
    }
  }

  // ───────────────────────── 同步画面 ─────────────────────────

  private syncViews() {
    const w = this.w;

    // 角色和单位
    const alive = new Set<Unit>();
    for (const u of w.allUnits) {
      if (!u.alive) continue;
      alive.add(u);
      let v = this.unitViews.get(u);
      if (!v) v = this.makeUnitView(u);
      this.drawUnit(u, v);
    }
    for (const [u, v] of this.unitViews) {
      if (!alive.has(u)) {
        v.box.destroy();
        this.unitViews.delete(u);
      }
    }

    // 奶屎
    const poops = new Set(w.poops.filter((p) => p.alive));
    for (const p of poops) {
      if (this.poopViews.has(p)) continue;
      const g = this.add.graphics();
      art.drawPoop(g, p.level, this.skin.colors.poop);
      const box = this.add.container(p.x, p.y, [g]).setDepth(5).setScale(0);
      this.tweens.add({ targets: box, scale: 1, duration: 200, ease: 'Back.out' });
      this.poopViews.set(p, box);
    }
    for (const [p, box] of this.poopViews) {
      if (!poops.has(p) || !p.alive) {
        box.destroy();
        this.poopViews.delete(p);
      }
    }

    // 子弹和解毒针
    const projIds = new Set<number>();
    for (const p of w.projectiles) {
      projIds.add(p.id);
      let g = this.projViews.get(p.id);
      if (!g) {
        g = this.add.graphics().setDepth(20);
        if (p.kind === 'needle') {
          g.fillStyle(0xbff7c5).fillRect(-10, -2, 20, 4);
          g.fillStyle(0x2ecc71).fillTriangle(10, -4, 16, 0, 10, 4);
          g.rotation = Math.atan2(p.vy, p.vx);
        } else {
          g.fillStyle(this.heroColor(w.sides[p.from].hero)).fillCircle(0, 0, 6);
          g.lineStyle(2, 0xffffff).strokeCircle(0, 0, 6);
        }
        this.projViews.set(p.id, g);
      }
      g.setPosition(p.x, p.y);
    }
    for (const [id, g] of this.projViews) {
      if (!projIds.has(id)) {
        g.destroy();
        this.projViews.delete(id);
      }
    }

    // 天雷预警圈
    const thIds = new Set<number>();
    for (const th of w.thunders) {
      thIds.add(th.id);
      if (this.thunderViews.has(th.id)) continue;
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0xfff27a, 0.25).fillCircle(th.x, th.y, B.thunder.radius);
      g.lineStyle(3, 0xfff27a, 0.9).strokeCircle(th.x, th.y, B.thunder.radius);
      this.tweens.add({ targets: g, alpha: 0.4, yoyo: true, repeat: -1, duration: 150 });
      this.thunderViews.set(th.id, g);
    }
    for (const [id, g] of this.thunderViews) {
      if (!thIds.has(id)) {
        g.destroy();
        this.thunderViews.delete(id);
      }
    }
  }

  private makeUnitView(u: Unit): UnitView {
    const gfx = this.add.graphics();
    const name = this.add
      .text(0, 26, u.name, { fontFamily: art.FONT, fontSize: u.kind === 'hero' ? '14px' : '12px', color: '#1d2330', backgroundColor: '#ffffffaa', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 0);
    const bow = this.add.graphics().setVisible(false);
    art.drawBow(bow);
    const box = this.add.container(u.x, u.y, [gfx, name, bow]).setDepth(10);
    const v = { box, gfx, name, bow, key: '' };
    this.unitViews.set(u, v);
    return v;
  }

  private heroColor(h: Hero) {
    const c = this.skin.colors;
    return h.faction === 'light' ? c.light : h.deepDark ? c.deepDark : c.dark;
  }

  /** 位置每帧更新；外观只在阵营、等级、名字变化时重画 */
  private drawUnit(u: Unit, v: UnitView) {
    const w = this.w;
    v.box.setPosition(u.x, u.y);
    v.bow.setVisible(!!u.dance);
    const hero = u instanceof Hero ? u : null;
    if (hero) v.box.setAlpha(w.t < w.sides[hero.owner].frozenUntil ? 0.55 : 1);
    if (u.kind === 'chaos') art.drawChaos(v.gfx, u.timer);

    const key = hero ? `${hero.faction}|${hero.deepDark}|${hero.level}|${hero.name}` : `${u.faction}|${u.name}`;
    if (key === v.key) return;
    v.key = key;
    v.name.setText(u.name);
    const c = u.faction === 'light' ? this.skin.colors.light : this.skin.colors.dark;
    switch (u.kind) {
      case 'hero':
        art.drawHero(v.gfx, hero!.level, this.heroColor(hero!));
        v.name.setY(hero!.radius + 8);
        v.bow.setPosition(0, -hero!.radius - 4);
        break;
      case 'egg':
        art.drawEgg(v.gfx, c);
        break;
      case 'dog':
        art.drawDog(v.gfx, c);
        break;
      case 'mouse':
        art.drawMouse(v.gfx, c);
        break;
      case 'powder':
        art.drawPowder(v.gfx, c);
        break;
      case 'chicken':
        art.drawChicken(v.gfx, c);
        break;
      case 'friend':
        art.drawFriend(v.gfx, u.friendIndex, c);
        break;
      case 'fortress':
        art.drawFortress(v.gfx, this.skin.colors.poop);
        break;
    }
  }

  // ───────────────────────── 玩家输入 ─────────────────────────

  private onFieldClick(p: Phaser.Input.Pointer) {
    if (this.w.ended) return;
    // 世界坐标：全屏适配后镜头会平移
    const x = p.worldX;
    const y = p.worldY;
    if (y < FIELD.y || y > FIELD.y + FIELD.h || x < FIELD.x || x > FIELD.x + FIELD.w) return;
    if (this.w.moveTo(this.w.sides.player, x, y) !== 'move') return;
    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, 0xffffff, 0.8).strokeCircle(x, y, 12);
    this.tweens.add({ targets: ring, alpha: 0, scale: 1.6, duration: 400, onComplete: () => ring.destroy() });
  }

  // ───────────────────────── HUD ─────────────────────────

  private drawField() {
    const c = this.skin.colors;
    fullBg(this, 0x1d2330);
    this.add.graphics().fillStyle(c.field).fillRoundedRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h, 18).lineStyle(4, 0x5a3e24).strokeRoundedRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h, 18);
    const g = this.add.graphics();
    g.lineStyle(2, c.fieldLine, 0.6);
    for (let x = FIELD.x + 80; x < FIELD.x + FIELD.w; x += 80) g.lineBetween(x, FIELD.y + 4, x, FIELD.y + FIELD.h - 4);
    g.lineStyle(3, 0xffffff, 0.25).lineBetween(640, FIELD.y + 4, 640, FIELD.y + FIELD.h - 4);
    // 栅栏
    g.fillStyle(0xc89b62);
    for (let x = FIELD.x + 22; x < FIELD.x + FIELD.w - 16; x += 26) {
      g.fillRoundedRect(x, FIELD.y + 4, 6, 14, 3);
      g.fillRoundedRect(x, FIELD.y + FIELD.h - 18, 6, 14, 3);
    }
    this.add.graphics().fillStyle(c.panel).fillRoundedRect(0, 512, 1280, 208, { tl: 20, tr: 20, bl: 0, br: 0 });
  }

  private buildHud() {
    const w = this.w;
    const mk = (id: SideId, x: number): SideHud => {
      const color = id === 'player' ? '#9cc4ff' : '#ffbd80';
      const name = label(this, x, 6, '', 17, color);
      this.add.graphics().fillStyle(0x3a1f25).fillRoundedRect(x, 30, HP_BAR_W, 14, 7);
      const hpFill = this.add.rectangle(x, 30, HP_BAR_W, 14, 0xe74c3c).setOrigin(0);
      const hpText = label(this, x + HP_BAR_W + 8, 27, '', 14);
      this.add.graphics().fillStyle(0x333a48).fillRoundedRect(x, 48, HP_BAR_W, 6, 3);
      const growFill = this.add.rectangle(x, 48, 0, 6, 0x7dff9a).setOrigin(0);
      const info = label(this, x + 300, 8, '', 14, '#dddddd');
      const status = label(this, x + 300, 46, '', 14, '#9ee7ff');
      return { name, hpFill, hpText, growFill, info, status };
    };
    this.hud = { player: mk('player', 20), ai: mk('ai', 660) };
    this.clockText = label(this, 1150, 8, '', 15, '#fff27a');

    this.toastText = this.add
      .text(640, FIELD.y + 30, '', { fontFamily: art.FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 12, y: 6 } })
      .setOrigin(0.5, 0)
      .setDepth(300)
      .setAlpha(0);

    const p = w.sides.player;
    label(this, 20, 518, '手牌（点击打出，单位放在主角身边）', 13, '#9aa4b8');
    for (let i = 0; i < B.economy.maxHand; i++) {
      this.cardButtons.push(new Button(this, 20 + i * 98, 538, 92, 50, '', () => w.playCard(p, i)));
    }

    this.poopText = label(this, 820, 518, '', 13, '#e8dcc0');
    this.shop.eat = new Button(this, 820, 538, 100, 50, `吃 Lv3 奶屎\n+${B.poop.eatHeal} 血`, () => w.eatPoop(p), 0x6b4a2b);
    this.shop.fort = new Button(this, 926, 538, 100, 50, '堆成堡垒', () => w.buildFortress(p), 0x6b4a2b);

    const E = B.economy;
    const shopDefs: [string, string, () => void, number?][] = [
      ['card', `买卡\n${E.cardPrice} 金币`, () => w.buyCard(p)],
      ['tea', `奶茶（抽取）\n${E.teaPrice} 金币`, () => w.buyTea(p)],
      ['bottle', `奶瓶\n${E.bottlePrice} 金币`, () => w.buyBottle(p)],
      ['drink', '', () => w.drink(p), 0x2f7d5b],
      ['needle', `解毒针\n${E.needlePrice} 金币`, () => w.throwNeedle(p), 0x2e8b57],
      ['infect', `主动感染\n${E.infectPrice} 金币`, () => w.infect(p), 0x9b3d2e],
      ['sell', `卖 ${E.eggsPerCoin} 颗蛋\n换 1 金币`, () => w.sellEggs(p)],
      ['chaos', `合成混沌奶蛋\n需 ${B.chaos.eggsNeeded} 颗同阵营蛋`, () => w.makeChaos(p), 0x5b3a7a],
    ];
    shopDefs.forEach(([key, text, fn, color], i) => {
      this.shop[key] = new Button(this, 20 + i * 126, 600, 120, 52, text, fn, color);
      if (key in B.unlock.shop) this.shopLabels.push([key as ShopKey, text]);
    });

    label(this, 1040, 518, `朋友（各 ${B.friends.hp} 血）`, 13, '#9aa4b8');
    p.friends.forEach((_f, i) => {
      const y = 540 + i * 58;
      const text = label(this, 1040, y, '', 14);
      const protect = new Button(this, 1040, y + 20, 70, 28, '保护', () => w.setFriendMode(p, i, 'protect'), 0x3b6e9b);
      const fight = new Button(this, 1114, y + 20, 70, 28, '出战', () => w.setFriendMode(p, i, 'fight'), 0x9b6e3b);
      const sell = new Button(this, 1188, y + 20, 70, 28, `卖 ${B.friends.sellPrice} 金`, () => w.setFriendMode(p, i, 'sold'), 0x555555);
      this.friendRows.push({ text, protect, fight, sell });
    });

    this.logText = label(this, 20, 664, '', 13, '#c5cbd8').setLineSpacing(4);
  }

  private refreshHud() {
    const w = this.w;
    for (const s of Object.values(w.sides)) {
      const h = s.hero;
      const ui = this.hud[s.id];
      const tag = s.id === 'player' ? '你' : '电脑 AI';
      const fac = h.faction === 'light' ? '光派' : '暗派';
      ui.name.setText(`${tag} · ${h.title} Lv${h.level} · ${fac}`);
      ui.hpFill.width = (HP_BAR_W * h.hp) / B.hero.maxHp;
      ui.hpText.setText(`${h.hp.toFixed(1)} / ${B.hero.maxHp}`);
      ui.growFill.width = h.level >= B.hero.maxLevel ? HP_BAR_W : HP_BAR_W * h.growth;
      const poison = h.faction === 'light' ? `毒素 ${h.poison}/${B.thunder.fallAt}` : '免疫天雷';
      ui.info.setText(`金币 ${s.coins}   蛋 ${s.eggs.filter((e) => e.alive).length}   ${poison}\n成长 ×${w.growthMultiplier(h)}   手牌 ${s.hand.length}`);
      const st: string[] = [];
      if (w.t < s.frozenUntil) st.push(`冰冻 ${(s.frozenUntil - w.t).toFixed(1)}s`);
      if (w.t < s.pollutedUntil) st.push(`视觉污染 ${(s.pollutedUntil - w.t).toFixed(1)}s`);
      if (h.dance) st.push('跳舞中');
      if (h.deepDark && h.faction === 'dark') st.push(`解毒进度 ${h.antidoteHits}/${B.needle.deepDarkDose}`);
      if (w.bossSide === s.id) st.push('全场之主');
      ui.status.setText(st.join('   '));
    }

    const nt = w.tutorialActive ? '新手引导中' : w.thunderOff ? '天雷已消失' : `下一道天雷 ${Math.max(0, w.nextThunder - w.t).toFixed(0)}s`;
    this.clockText.setText(`${w.tutorialActive ? 0 : w.battleTime.toFixed(0)}s\n${nt}`);

    const p = w.sides.player;
    this.cardButtons.forEach((b, i) => {
      const c = p.hand[i];
      b.setVisible(!!c);
      if (c) b.setLabel(w.cardName(c)).setColor(CARD_COLORS[c]);
    });

    this.poopText.setText(`奶屎背包  Lv1×${p.poops[0]}  Lv2×${p.poops[1]}  Lv3×${p.poops[2]}`);
    this.shop.eat.setEnabled(p.poops[2] > 0);
    this.shop.fort.setEnabled(p.poops[2] > 0);
    const E = B.economy;
    // 未解锁的道具显示解锁等级
    for (const [key, text] of this.shopLabels) {
      const lv = B.unlock.shop[key];
      this.shop[key].setLabel(w.shopUnlocked(p, key) ? text : `${SHOP_NAMES[key]}\n🔒 Lv${lv} 解锁`);
    }
    this.shop.card.setEnabled(w.shopUnlocked(p, 'card') && p.coins >= E.cardPrice && p.hand.length < E.maxHand);
    if (w.freeTea > 0) this.shop.tea.setLabel(`奶茶（抽取）\n免费 ×${w.freeTea}`);
    this.shop.tea.setEnabled(w.canBuyTea(p));
    this.shop.bottle.setEnabled(w.shopUnlocked(p, 'bottle') && p.coins >= E.bottlePrice);
    this.shop.drink.setLabel(`喝奶瓶（连点）\n剩 ${p.bottle.toFixed(1)} 血`).setEnabled(p.bottle > 0);
    this.shop.needle.setEnabled(w.canNeedle(p));
    this.shop.infect.setEnabled(w.canInfect(p));
    this.shop.sell.setEnabled(p.eggs.filter((e) => e.alive).length >= E.eggsPerCoin);
    this.shop.chaos.setEnabled(!!w.chaosFaction(p));

    p.friends.forEach((f, i) => {
      const row = this.friendRows[i];
      const modeText = { protect: '受保护', fight: '出战中', sold: '已出售', dead: '已倒下', defected: '已变异叛逃' }[f.mode];
      row.text.setText(`${f.name}  ${f.hp.toFixed(1)} 血  ${modeText}`);
      const active = f.mode === 'protect' || f.mode === 'fight';
      row.protect.setEnabled(active && f.mode !== 'protect');
      row.fight.setEnabled(active && f.mode !== 'fight');
      row.sell.setEnabled(active);
    });

    if (w.t >= p.pollutedUntil && this.pollution.visible && !this.tweens.isTweening(this.pollution)) {
      this.tweens.add({ targets: this.pollution, alpha: 0, duration: 300, onComplete: () => this.pollution.setVisible(false) });
    }
  }

  // ───────────────────────── 提示 ─────────────────────────

  private floatText(x: number, y: number, s: string, color: string) {
    const t = this.add.text(x, y, s, { fontFamily: art.FONT, fontSize: '15px', color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(250);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  private toast(s: string) {
    this.log(s);
    this.toastText.setText(s).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1800, duration: 500 });
  }

  private log(s: string) {
    this.logLines.push(`[${this.w.t.toFixed(0)}s] ${s}`);
    this.logLines = this.logLines.slice(-3);
    this.logText?.setText(this.logLines.join('\n'));
  }
}
