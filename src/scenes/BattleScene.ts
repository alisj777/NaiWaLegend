import Phaser from 'phaser';
import { BALANCE as B } from '../config/balance';
import { currentSkin, Skin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';
import {
  CardId,
  clampToField,
  Faction,
  FIELD,
  Friend,
  Hero,
  other,
  Poop,
  randomFieldPoint,
  Side,
  SideId,
  Unit,
} from '../battle/entities';
import { Tutorial } from '../battle/tutorial';

interface Projectile {
  view: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  from: SideId;
  kind: 'attack' | 'needle';
  damage: number;
  travelled: number;
  max: number;
}

interface Thunder {
  x: number;
  y: number;
  strikeAt: number;
  warn: Phaser.GameObjects.Graphics;
}

interface SideHud {
  name: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  growFill: Phaser.GameObjects.Rectangle;
  info: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

const CARDS: CardId[] = ['dog', 'mouse', 'powder', 'chicken', 'poop'];
type ShopKey = keyof typeof B.unlock.shop;
const unlockedCards = (level: number) => CARDS.filter((c) => B.unlock.cards[c] <= level);
const SHOP_NAMES: Record<ShopKey, string> = { bottle: '奶瓶', card: '买卡', sell: '卖蛋', chaos: '混沌奶蛋', tea: '奶茶', needle: '解毒针', infect: '主动感染' };
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
  private t = 0;
  private sides!: Record<SideId, Side>;
  private units: Unit[] = [];
  private poops: Poop[] = [];
  private projectiles: Projectile[] = [];
  private thunders: Thunder[] = [];
  private nextThunder = 0;
  private thunderOff = false;
  private danceUntil = 0;
  private dancing = false;
  private bossSide: SideId | null = null;
  private ended = false;
  private pickup: Record<SideId, Poop | null> = { player: null, ai: null };
  private aiThink = 1;
  /** 新手引导进行中时，AI、成长、自动攻击、天雷投放都暂停 */
  tutorialActive = false;
  private wantTutorial = false;
  private tutorial: Tutorial | null = null;
  /** 正式对战开始的时刻（引导结束后才开始计时） */
  private battleStart = 0;

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

  init(data: { tutorial?: boolean }) {
    // 场景重开时重置状态
    this.wantTutorial = !!data?.tutorial;
    this.tutorialActive = false;
    this.tutorial = null;
    this.battleStart = 0;
    this.t = 0;
    this.units = [];
    this.poops = [];
    this.projectiles = [];
    this.thunders = [];
    this.nextThunder = B.thunder.startAt;
    this.thunderOff = false;
    this.danceUntil = 0;
    this.dancing = false;
    this.bossSide = null;
    this.ended = false;
    this.pickup = { player: null, ai: null };
    this.aiThink = 1;
    this.logLines = [];
    this.cardButtons = [];
    this.shop = {};
    this.shopLabels = [];
    this.friendRows = [];
  }

  create() {
    this.skin = currentSkin();
    this.drawField();

    const mkSide = (id: SideId, faction: Faction, x: number): Side => ({
      id,
      hero: new Hero(this, id, faction, x, FIELD.y + FIELD.h / 2, this.skin),
      coins: B.economy.startCoins,
      hand: Array.from({ length: B.economy.startCards }, () => Phaser.Utils.Array.GetRandom(unlockedCards(1))),
      poops: [0, 0, 0],
      bottle: 0,
      needleMisses: 0,
      eggs: [],
      pollutedUntil: 0,
      frozenUntil: 0,
      comebackReadyAt: 0,
      protectRewardGiven: false,
      friends: [],
    });
    this.sides = { player: mkSide('player', 'light', 200), ai: mkSide('ai', 'dark', 1080) };
    this.sides.player.friends = this.skin.friends.map((name, index) => ({ index, name, hp: B.friends.hp, mode: 'protect', unit: null }));

    this.buildHud();
    this.pollution = this.add.graphics().setDepth(200).setVisible(false);

    // 开局手牌固定给一张奶鸡，方便引导和起步经济
    this.sides.player.hand = ['chicken', 'poop'].slice(0, B.economy.startCards) as CardId[];

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onFieldClick(p));
    if (this.wantTutorial) {
      this.tutorialActive = true;
      this.tutorial = new Tutorial(this);
    } else {
      this.startBattle();
    }
  }

  /** 引导结束（或跳过）后正式开战 */
  startBattle() {
    this.tutorialActive = false;
    this.tutorial = null;
    this.battleStart = this.t;
    this.nextThunder = this.t + B.thunder.startAt;
    this.sides.player.hero.attackTimer = 1.5;
    this.sides.ai.hero.attackTimer = 2.5;
    this.toast('对战开始！你是光奶蛋，对手是成长速度 2 倍的暗奶蛋');
  }

  private get battleTime() {
    return this.t - this.battleStart;
  }

  // ───────── 给新手引导用的钩子 ─────────

  get playerHero() {
    return this.sides.player.hero;
  }

  get playerHand() {
    return this.sides.player.hand;
  }

  spawnTutorialPoop(x: number, y: number) {
    return this.spawnPoop(x, y, 1, null);
  }

  spawnThunderAt(x: number, y: number, warnTime: number = B.thunder.warnTime) {
    const p = { x, y };
    clampToField(p);
    const warn = this.add.graphics().setDepth(4);
    warn.fillStyle(0xfff27a, 0.25).fillCircle(p.x, p.y, B.thunder.radius);
    warn.lineStyle(3, 0xfff27a, 0.9).strokeCircle(p.x, p.y, B.thunder.radius);
    this.tweens.add({ targets: warn, alpha: 0.4, yoyo: true, repeat: -1, duration: 150 });
    this.thunders.push({ ...p, strikeAt: this.t + warnTime, warn });
  }

  /** 卡牌位置，引导箭头用 */
  cardButtonCenter(index: number) {
    const b = this.cardButtons[index];
    return b ? { x: b.x + 46, y: b.y } : null;
  }

  private shopUnlocked(s: Side, key: ShopKey) {
    return s.hero.level >= B.unlock.shop[key];
  }

  // ───────────────────────── 主循环 ─────────────────────────

  update(_time: number, deltaMs: number) {
    if (this.ended) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.t += dt;

    const tut = this.tutorialActive;
    if (!tut) {
      for (const s of Object.values(this.sides)) this.updateGrowth(s, dt);
      this.updateAI(dt);
    }
    for (const s of Object.values(this.sides)) this.updateHero(s, dt);
    if (!tut) this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateThunder();
    this.updateDance(dt);
    if (!tut) {
      this.checkBossAndDuel();
      this.checkWin();
    }
    this.tutorial?.update();
    this.refreshHud();
  }

  // ───────────────────────── 成长 ─────────────────────────

  private growthMultiplier(h: Hero) {
    if (h.level >= B.hero.maxLevel) return 0;
    if (h.faction === 'dark') return h.deepDark ? B.hero.deepDarkSpeed : B.hero.darkSpeed;
    if (h.hp < B.hero.midHpMax) return B.hero.midHpSpeed;
    return 1;
  }

  private updateGrowth(s: Side, dt: number) {
    const h = s.hero;
    if (h.level >= B.hero.maxLevel) return;
    // 绝地反弹：光派血量跌破 10，直接升一级（20 秒冷却）
    if (h.faction === 'light' && h.hp < B.hero.comebackHp && h.hp > 0 && this.t >= s.comebackReadyAt) {
      s.comebackReadyAt = this.t + B.hero.comebackCooldown;
      this.log(`${this.who(s)}触发绝地反弹！`);
      this.levelUp(s);
      return;
    }
    h.growth += (dt * this.growthMultiplier(h)) / B.hero.levelInterval;
    if (h.growth >= 1) this.levelUp(s);
  }

  private levelUp(s: Side) {
    const h = s.hero;
    h.level = Math.min(B.hero.maxLevel, h.level + 1);
    h.growth = 0;
    h.redraw();
    this.floatText(h.x, h.y - 40, `升级！${h.title}`, '#fff27a');
    this.giveCards(s, B.economy.freeCardsPerLevel);
    this.log(`${this.who(s)}长成了 ${h.title}（Lv${h.level}），获得 ${B.economy.freeCardsPerLevel} 张卡。`);
    if (s.id === 'player') {
      const newCards = CARDS.filter((c) => B.unlock.cards[c] === h.level).map((c) => this.cardName(c));
      const newShop = (Object.keys(B.unlock.shop) as ShopKey[]).filter((k) => B.unlock.shop[k] === h.level).map((k) => SHOP_NAMES[k]);
      const all = [...newCards, ...newShop];
      if (all.length) this.toast(`升到 Lv${h.level}！解锁：${all.join('、')}`);
    }

    if (h.level >= B.hero.activeChoiceLevel && !s.protectRewardGiven) {
      s.protectRewardGiven = true;
      const safe = s.friends.filter((f) => f.mode === 'protect').length;
      if (safe > 0) {
        s.coins += safe * B.friends.protectReward;
        this.log(`保护奖励：${safe} 个朋友平安，获得 ${safe * B.friends.protectReward} 金币。`);
      }
    }
    if (h.level === B.hero.maxLevel && h.faction === 'dark') {
      this.toast(`${h.title} 降临，全场认它为主！`);
    }
  }

  private giveCards(s: Side, n: number) {
    const pool = unlockedCards(s.hero.level);
    for (let i = 0; i < n && s.hand.length < B.economy.maxHand; i++) s.hand.push(Phaser.Utils.Array.GetRandom(pool));
  }

  // ───────────────────────── 主角移动与攻击 ─────────────────────────

  private updateHero(s: Side, dt: number) {
    const h = s.hero;
    const frozen = this.t < s.frozenUntil;
    h.view.setAlpha(frozen ? 0.55 : 1);
    if (h.dance) return;
    if (!frozen && h.moveTarget && h.stepToward(h.moveTarget.x, h.moveTarget.y, dt)) h.moveTarget = null;

    const target = this.pickup[s.id];
    if (target) {
      if (!target.alive) this.pickup[s.id] = null;
      else if (h.dist(target) <= B.poop.pickupRange) this.collectPoop(s, target);
    }

    if (this.tutorialActive) return;
    h.attackTimer -= dt;
    if (h.attackTimer <= 0 && !frozen) {
      h.attackTimer = B.hero.attackInterval;
      const enemy = this.sides[other(s.id)].hero;
      this.fire(s.id, 'attack', h.x, h.y, enemy.x, enemy.y, B.hero.attackDamageByLevel[h.level - 1]);
    }
  }

  private fire(from: SideId, kind: Projectile['kind'], x: number, y: number, tx: number, ty: number, damage: number) {
    const speed = kind === 'needle' ? B.needle.speed : B.hero.projectileSpeed;
    const d = Math.max(1, Phaser.Math.Distance.Between(x, y, tx, ty));
    const g = this.add.graphics().setDepth(20);
    if (kind === 'needle') {
      g.fillStyle(0xbff7c5).fillRect(-10, -2, 20, 4);
      g.fillStyle(0x2ecc71).fillTriangle(10, -4, 16, 0, 10, 4);
      g.rotation = Math.atan2(ty - y, tx - x);
    } else {
      const c = this.sides[from].hero.color;
      g.fillStyle(c).fillCircle(0, 0, 6);
      g.lineStyle(2, 0xffffff).strokeCircle(0, 0, 6);
    }
    g.setPosition(x, y);
    this.projectiles.push({
      view: g,
      x,
      y,
      vx: ((tx - x) / d) * speed,
      vy: ((ty - y) / d) * speed,
      from,
      kind,
      damage,
      travelled: 0,
      max: kind === 'needle' ? d + 60 : 1500,
    });
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.travelled += Math.hypot(p.vx, p.vy) * dt;
      p.view.setPosition(p.x, p.y);
      const enemySide = this.sides[other(p.from)];
      const enemy = enemySide.hero;
      let done = false;

      if (p.kind === 'attack') {
        const fort = this.units.find((u) => u.alive && u.kind === 'fortress' && u.owner === enemySide.id && u.dist(p) < 32);
        if (fort) {
          fort.destroy();
          this.floatText(p.x, p.y, '堡垒挡下攻击', '#ffe08a');
          done = true;
        }
      }
      if (!done && enemy.dist(p) < enemy.radius + 4) {
        if (p.kind === 'attack') this.damage(enemySide, p.damage);
        else this.antidote(enemySide);
        done = true;
      }
      const outside = p.x < FIELD.x || p.x > FIELD.x + FIELD.w || p.y < FIELD.y || p.y > FIELD.y + FIELD.h;
      if (!done && (outside || p.travelled > p.max)) {
        if (p.kind === 'needle') this.needleMiss(this.sides[p.from]);
        done = true;
      }
      if (done) {
        p.view.destroy();
        p.travelled = Infinity;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.travelled !== Infinity);
  }

  private damage(s: Side, amount: number) {
    const h = s.hero;
    const fighters = s.friends.filter((f) => f.mode === 'fight' && f.unit);
    const share = amount / (1 + fighters.length);
    h.hp = Math.max(0, h.hp - share);
    this.floatText(h.x, h.y - h.radius, `-${+share.toFixed(1)}`, '#ff6b6b');
    for (const f of fighters) {
      f.hp -= share;
      this.floatText(f.unit!.x, f.unit!.y - 20, `-${+share.toFixed(1)}`, '#ff6b6b');
      if (f.hp <= 0) {
        f.hp = 0;
        f.mode = 'dead';
        f.unit!.destroy();
        f.unit = null;
        h.hp = Math.max(0, h.hp - B.friends.lossPenalty);
        this.toast(`${f.name} 倒下了！会心一击 -${B.friends.lossPenalty}`);
      }
    }
    this.tweens.add({ targets: h.view, scale: 1.15, yoyo: true, duration: 80 });
  }

  private heal(s: Side, amount: number) {
    s.hero.hp = Math.min(B.hero.maxHp, s.hero.hp + amount);
    this.floatText(s.hero.x, s.hero.y - s.hero.radius, `+${+amount.toFixed(1)}`, '#7dff9a');
  }

  // ───────────────────────── 光暗转换 ─────────────────────────

  private setFaction(s: Side, faction: Faction, deepDark = false) {
    const h = s.hero;
    h.faction = faction;
    h.deepDark = faction === 'dark' && deepDark;
    h.poison = 0;
    h.antidoteHits = 0;
    h.redraw();
    // 奶鸡随阵营
    for (const u of this.units) {
      if (u.alive && u.kind === 'chicken' && u.owner === s.id) this.recolorUnit(u, faction);
    }
    if (this.sides.player.hero.faction === 'dark' && this.sides.ai.hero.faction === 'dark' && !this.thunderOff) {
      this.thunderOff = true;
      this.thunders.forEach((th) => th.warn.destroy());
      this.thunders = [];
      this.toast('双方都已堕落，天雷消失！暗派对暗派，血量定胜负');
    }
  }

  private recolorUnit(u: Unit, faction: Faction) {
    u.faction = faction;
    const c = faction === 'light' ? this.skin.colors.light : this.skin.colors.dark;
    switch (u.kind) {
      case 'egg':
        art.drawEgg(u.gfx, c);
        u.setName(faction === 'light' ? this.skin.units.egg : this.skin.units.darkEgg);
        break;
      case 'dog':
        art.drawDog(u.gfx, c);
        break;
      case 'mouse':
        art.drawMouse(u.gfx, c);
        break;
      case 'powder':
        art.drawPowder(u.gfx, c);
        break;
      case 'chicken':
        art.drawChicken(u.gfx, c);
        break;
      case 'friend':
        art.drawFriend(u.gfx, u.friendIndex, c);
        break;
    }
  }

  private antidote(target: Side) {
    const h = target.hero;
    if (h.faction !== 'dark') return;
    if (h.deepDark) {
      h.antidoteHits++;
      if (h.antidoteHits < B.needle.deepDarkDose) {
        this.toast(`解毒针命中暗中过暗奶蛙 ${h.antidoteHits}/${B.needle.deepDarkDose}`);
        return;
      }
    }
    this.setFaction(target, 'light');
    this.toast(`解毒成功！${this.who(target)}变回光派 ${h.title}`);
  }

  private needleMiss(s: Side) {
    s.needleMisses++;
    if (s.needleMisses >= B.needle.missesToInfect) {
      s.needleMisses = 0;
      if (s.hero.faction === 'light') {
        this.setFaction(s, 'dark');
        this.toast(`${this.who(s)}解毒针累计 ${B.needle.missesToInfect} 次没投中，反被感染！`);
      }
    } else {
      this.log(`解毒针没投中（${s.needleMisses}/${B.needle.missesToInfect}）`);
    }
  }

  // ───────────────────────── 天雷 ─────────────────────────

  private updateThunder() {
    if (this.thunderOff) return;
    if (!this.tutorialActive && this.t >= this.nextThunder) {
      this.nextThunder += B.thunder.interval;
      let p = randomFieldPoint();
      // 一部分天雷瞄准光派角色附近落下
      const lights = [this.sides.player.hero, this.sides.ai.hero, ...this.units].filter((u) => u.alive && u.faction === 'light' && u.kind !== 'fortress');
      if (lights.length && Math.random() < B.thunder.aimedChance) {
        const u = Phaser.Utils.Array.GetRandom(lights);
        p = { x: u.x + Phaser.Math.Between(-60, 60), y: u.y + Phaser.Math.Between(-60, 60) };
      }
      this.spawnThunderAt(p.x, p.y);
    }
    for (const th of this.thunders) {
      if (this.t >= th.strikeAt) {
        th.warn.destroy();
        this.strike(th);
        th.strikeAt = Infinity;
      }
    }
    this.thunders = this.thunders.filter((th) => th.strikeAt !== Infinity);
  }

  private strike(th: Thunder) {
    this.events.emit('tut:thunder');
    const bolt = this.add.graphics().setDepth(150);
    bolt.lineStyle(6, 0xfffbd0);
    bolt.beginPath().moveTo(th.x + 30, 0);
    for (let y = 60; y < th.y; y += 60) bolt.lineTo(th.x + Phaser.Math.Between(-25, 25), y);
    bolt.lineTo(th.x, th.y).strokePath();
    bolt.fillStyle(0xffffff, 0.6).fillCircle(th.x, th.y, B.thunder.radius);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 350, onComplete: () => bolt.destroy() });

    const fort = this.units.find((u) => u.alive && u.kind === 'fortress' && u.dist(th) <= B.thunder.radius);
    if (fort) {
      fort.destroy();
      this.toast('奶屎堡垒挡住了天雷！');
      return;
    }
    const victims: Unit[] = [this.sides.player.hero, this.sides.ai.hero, ...this.units];
    for (const u of victims) {
      if (!u.alive || u.faction !== 'light' || u.dist(th) > B.thunder.radius) continue;
      if (u.kind === 'fortress' || u.kind === 'chaos') continue;
      const add = u.kind === 'hero' ? B.thunder.poisonHero : u.kind === 'egg' ? B.thunder.poisonEgg : B.thunder.poisonFriend;
      u.poison += add;
      this.floatText(u.x, u.y - 30, `毒素 ${u.poison}/${B.thunder.fallAt}`, '#d6a2ff');
      if (u.poison >= B.thunder.fallAt) this.fall(u);
    }
  }

  private fall(u: Unit) {
    if (u instanceof Hero) {
      const s = this.sides[u.owner];
      this.setFaction(s, 'dark');
      this.toast(`${this.who(s)}被天雷劈中 ${B.thunder.fallAt} 次，堕入暗面！`);
      return;
    }
    if (u.kind === 'friend') {
      const f = this.sides[u.owner].friends[u.friendIndex];
      f.mode = 'defected';
      f.unit = null;
      u.owner = 'ai';
      u.followTarget = this.sides.ai.hero;
      this.log(`${f.name} 被雷劈变异，投靠了暗派！`);
    }
    this.recolorUnit(u, 'dark');
  }

  // ───────────────────────── 场上单位 ─────────────────────────

  private spawnUnit(kind: Unit['kind'], owner: SideId, x: number, y: number, name: string, faction?: Faction) {
    const fac = faction ?? this.sides[owner].hero.faction;
    const u = new Unit(this, kind, owner, fac, x, y, name);
    clampToField(u.view);
    this.units.push(u);
    this.recolorUnit(u, fac);
    return u;
  }

  private spawnPoop(x: number, y: number, level: number, owner: SideId | null) {
    const p = new Poop(this, x, y, level, owner, this.skin.colors.poop);
    clampToField(p.view);
    p.view.setScale(0);
    this.tweens.add({ targets: p.view, scale: 1, duration: 200, ease: 'Back.out' });
    this.poops.push(p);
    return p;
  }

  private updateUnits(dt: number) {
    const boss = this.bossSide ? this.sides[this.bossSide].hero : null;
    for (const u of this.units) {
      if (!u.alive || u.dance) continue;
      if (u.kind === 'fortress') continue;

      // 西格玛奶暗蛙：全场角色认它为主并跟随
      if (boss && (u.kind === 'dog' || u.kind === 'mouse' || u.kind === 'powder' || u.kind === 'chicken')) {
        u.stepToward(boss.x, boss.y, dt, 70);
        continue;
      }

      switch (u.kind) {
        case 'egg':
        case 'friend':
          if (u.followTarget && u.followTarget.alive) u.stepToward(u.followTarget.x, u.followTarget.y, dt, u.followGap);
          break;
        case 'dog':
          this.updateDog(u, dt);
          break;
        case 'mouse':
        case 'powder':
          if (!u.moveTarget || u.stepToward(u.moveTarget.x, u.moveTarget.y, dt)) u.moveTarget = randomFieldPoint();
          break;
        case 'chicken':
          u.timer -= dt;
          if (u.timer <= 0) {
            u.timer = B.chicken.layInterval;
            this.layEgg(u);
          }
          break;
        case 'chaos':
          this.updateChaos(u, dt);
          break;
      }
    }
    this.units = this.units.filter((u) => u.alive);
    this.poops = this.poops.filter((p) => p.alive);
  }

  private updateDog(u: Unit, dt: number) {
    u.timer -= dt;
    const target = u.timer <= 0 ? this.nearest(this.poops, u, 260) : null;
    if (target) {
      if (u.stepToward(target.x, target.y, dt, B.dog.eatRange - 4)) this.dogEat(u, target);
      return;
    }
    if (!u.moveTarget || u.stepToward(u.moveTarget.x, u.moveTarget.y, dt)) u.moveTarget = randomFieldPoint();
  }

  private dogEat(dog: Unit, poop: Poop) {
    poop.destroy();
    dog.timer = 4;
    const ownerFaction: Faction = poop.owner ? this.sides[poop.owner].hero.faction : 'light';
    if (ownerFaction === 'light') {
      this.floatText(dog.x, dog.y - 30, '吃一个，拉一个', '#e8dcc0');
      this.time.delayedCall(1200, () => {
        if (!dog.alive || this.ended) return;
        const p = randomFieldPoint();
        this.spawnPoop(p.x, p.y, 1, dog.owner);
      });
    } else {
      const pool: Unit[] = [this.sides.player.hero, this.sides.ai.hero, ...this.units.filter((x) => x.alive && x !== dog && x.kind !== 'fortress')];
      const victim = Phaser.Utils.Array.GetRandom(pool);
      const spray = this.add.graphics().setDepth(30);
      spray.lineStyle(8, this.skin.colors.poop, 0.9).lineBetween(dog.x, dog.y, victim.x, victim.y);
      this.tweens.add({ targets: spray, alpha: 0, duration: 600, onComplete: () => spray.destroy() });
      this.pollute(victim.owner);
      this.toast(`奶狗吃了暗派的屎，腹泻喷中了 ${victim.name}！`);
    }
  }

  private layEgg(chicken: Unit) {
    const s = this.sides[chicken.owner];
    const name = chicken.faction === 'light' ? this.skin.units.egg : this.skin.units.darkEgg;
    const egg = this.spawnUnit('egg', s.id, chicken.x, chicken.y, name, chicken.faction);
    egg.speed = 150;
    egg.followGap = 30;
    s.eggs.push(egg);
    this.relinkEggs(s);
    this.floatText(chicken.x, chicken.y - 30, '咯咯！下蛋了', '#ffffff');
  }

  private relinkEggs(s: Side) {
    s.eggs = s.eggs.filter((e) => e.alive);
    s.eggs.forEach((e, i) => (e.followTarget = i === 0 ? s.hero : s.eggs[i - 1]));
  }

  private updateChaos(u: Unit, dt: number) {
    const enemySide = this.sides[other(u.owner)];
    const enemy = enemySide.hero;
    u.timer += dt;
    art.drawChaos(u.gfx, u.timer);
    // 吞噬路上的对方单位
    for (const v of this.units) {
      if (v.alive && v !== u && v.owner === enemySide.id && v.kind !== 'chaos' && u.dist(v) < 30) {
        v.destroy();
        this.floatText(u.x, u.y - 40, `吞掉了 ${v.name}`, '#d96bff');
      }
    }
    if (u.stepToward(enemy.x, enemy.y, dt, enemy.radius)) {
      this.sides[u.owner].hero.hp = Math.min(99, this.sides[u.owner].hero.hp + enemy.hp);
      enemy.hp = 0;
      this.finish(u.owner === 'player', `${this.skin.units.chaos}吞掉了对方主角`);
    }
  }

  // ───────────────────────── 奶鼠 + 奶粉：牵手跳舞 ─────────────────────────

  private tryStartDance() {
    if (this.dancing) return;
    const mouse = this.units.find((u) => u.alive && u.kind === 'mouse');
    const powder = this.units.find((u) => u.alive && u.kind === 'powder');
    if (!mouse || !powder) return;
    this.dancing = true;
    this.danceUntil = this.t + B.debuff.dance;
    const all: Unit[] = Phaser.Utils.Array.Shuffle([
      this.sides.player.hero,
      this.sides.ai.hero,
      ...this.units.filter((u) => u.alive && u.kind !== 'fortress' && u.kind !== 'chaos'),
    ]);
    for (let i = 0; i < all.length; i += 2) {
      const a = all[i];
      const b = all[i + 1] ?? a;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      a.dance = { cx, cy, angle: 0, until: this.danceUntil };
      if (b !== a) b.dance = { cx, cy, angle: Math.PI, until: this.danceUntil };
    }
    for (const u of all) {
      u.bow.setVisible(true);
      u.moveTarget = null;
    }
    this.time.delayedCall(B.debuff.dance * 1000 + 50, () => {
      mouse.destroy();
      powder.destroy();
    });
    this.toast('奶鼠 + 奶粉：全场戴上蝴蝶结，牵手跳舞！');
  }

  private updateDance(dt: number) {
    if (!this.dancing) return;
    const all: Unit[] = [this.sides.player.hero, this.sides.ai.hero, ...this.units];
    if (this.t >= this.danceUntil) {
      this.dancing = false;
      for (const u of all) {
        u.dance = null;
        if (u.alive) u.bow.setVisible(false);
      }
      return;
    }
    for (const u of all) {
      if (!u.alive || !u.dance) continue;
      // 舞伴中心也会慢慢漂移，打乱站位
      u.dance.angle += dt * 5;
      u.dance.cx += Math.sin(this.t * 2 + u.dance.cy) * 40 * dt;
      u.view.x = u.dance.cx + Math.cos(u.dance.angle) * 30;
      u.view.y = u.dance.cy + Math.sin(u.dance.angle) * 18;
      clampToField(u.view);
    }
  }

  // ───────────────────────── 西格玛与决斗 ─────────────────────────

  private checkBossAndDuel() {
    this.bossSide = null;
    for (const s of Object.values(this.sides)) {
      const h = s.hero;
      const o = this.sides[other(s.id)].hero;
      if (h.faction !== 'dark' || h.level !== B.hero.maxLevel || o.faction !== 'light') continue;
      this.bossSide = s.id;
      if (o.level === B.hero.maxLevel) return this.startDuel(s.id, `${this.who(this.sides[o.owner])}也长成了西格玛奶蛙`);
      const eggs = this.units.filter((u) => u.alive && u.kind === 'egg');
      if (eggs.length) {
        const egg = this.nearest(eggs, h, Infinity)!;
        const flash = this.add.graphics().setDepth(160);
        flash.fillStyle(0xffffff, 0.9).fillCircle(egg.x, egg.y, 10);
        this.tweens.add({ targets: flash, scale: 30, alpha: 0, duration: 900 });
        return this.startDuel(s.id, '场上的奶蛋发生变态发育，进化成西格玛奶蛙');
      }
    }
  }

  private startDuel(bossSide: SideId, reason: string) {
    this.ended = true;
    this.toast(`${reason}！决斗开始`);
    this.cameras.main.flash(600, 255, 255, 255);
    this.time.delayedCall(1500, () => this.scene.start('Duel', { playerIsDark: bossSide === 'player', elapsed: this.battleTime }));
  }

  private checkWin() {
    if (this.ended) return;
    if (this.sides.ai.hero.hp <= 0) this.finish(true, '对方主角血量归零');
    else if (this.sides.player.hero.hp <= 0) this.finish(false, '你的主角血量归零');
  }

  private finish(win: boolean, reason: string) {
    if (this.ended) return;
    this.ended = true;
    this.toast(reason);
    this.time.delayedCall(1500, () => this.scene.start('Result', { win, reason, elapsed: this.battleTime }));
  }

  // ───────────────────────── 双方共用的操作 ─────────────────────────

  playCard(s: Side, index: number) {
    const card = s.hand[index];
    if (!card) return;
    s.hand.splice(index, 1);
    const h = s.hero;
    const dir = s.id === 'player' ? 1 : -1;
    const x = h.x + dir * Phaser.Math.Between(50, 90);
    const y = h.y + Phaser.Math.Between(-60, 60);
    const names = this.skin.units;
    switch (card) {
      case 'dog': {
        const d = this.spawnUnit('dog', s.id, x, y, names.dog);
        d.speed = B.dog.speed;
        d.timer = 2;
        this.spawnPoop(x + 30, y + 10, 1, s.id); // 出场自带 1 个奶屎
        break;
      }
      case 'mouse':
      case 'powder': {
        const u = this.spawnUnit(card, s.id, x, y, names[card]);
        u.speed = 50;
        this.tryStartDance();
        break;
      }
      case 'chicken': {
        const c = this.spawnUnit('chicken', s.id, x, y, names.chicken);
        c.timer = B.chicken.layInterval;
        break;
      }
      case 'poop':
        this.spawnPoop(x, y, 1, s.id);
        break;
    }
    this.log(`${this.who(s)}打出了 ${this.cardName(card)}`);
    if (s.id === 'player') this.events.emit('tut:card', card);
  }

  buyCard(s: Side) {
    if (!this.shopUnlocked(s, 'card') || s.coins < B.economy.cardPrice || s.hand.length >= B.economy.maxHand) return;
    s.coins -= B.economy.cardPrice;
    this.giveCards(s, 1);
  }

  buyTea(s: Side) {
    if (!this.shopUnlocked(s, 'tea') || s.coins < B.economy.teaPrice) return;
    s.coins -= B.economy.teaPrice;
    const outs = B.tea.outcomes;
    let r = Math.random() * outs.reduce((a, o) => a + o.weight, 0);
    const pick = outs.find((o) => (r -= o.weight) < 0) ?? outs[0];
    const o = pick as { label: string; heal?: number; freeze?: number; poops?: number };
    let effect = '';
    if (o.heal) {
      this.heal(s, o.heal);
      effect = `回 ${o.heal} 血`;
    } else if (o.freeze) {
      const enemy = this.sides[other(s.id)];
      enemy.frozenUntil = Math.max(enemy.frozenUntil, this.t + o.freeze);
      enemy.hero.moveTarget = null;
      effect = `冰冻对方 ${o.freeze} 秒`;
    } else if (o.poops) {
      for (let i = 0; i < o.poops; i++) this.spawnPoop(s.hero.x + Phaser.Math.Between(-80, 80), s.hero.y + Phaser.Math.Between(-80, 80), 1, s.id);
      effect = `生产 ${o.poops} 个奶屎`;
    }
    this.toast(`${this.who(s)}的奶茶：${o.label} → ${effect}`);
  }

  buyBottle(s: Side) {
    if (!this.shopUnlocked(s, 'bottle') || s.coins < B.economy.bottlePrice) return;
    s.coins -= B.economy.bottlePrice;
    s.bottle += B.bottle.capacity;
  }

  drink(s: Side) {
    if (s.bottle <= 0) return;
    const amt = Math.min(B.bottle.healPerClick, s.bottle);
    s.bottle = Math.max(0, +(s.bottle - amt).toFixed(2));
    s.hero.hp = Math.min(B.hero.maxHp, s.hero.hp + amt);
    if (Math.random() < 0.3) this.floatText(s.hero.x, s.hero.y - s.hero.radius, '+0.2', '#7dff9a');
  }

  canNeedle(s: Side) {
    return (
      this.shopUnlocked(s, 'needle') &&
      s.hero.faction === 'light' &&
      s.coins >= B.economy.needlePrice &&
      this.sides[other(s.id)].hero.faction === 'dark'
    );
  }

  throwNeedle(s: Side) {
    if (!this.canNeedle(s)) return;
    s.coins -= B.economy.needlePrice;
    const e = this.sides[other(s.id)].hero;
    this.fire(s.id, 'needle', s.hero.x, s.hero.y, e.x, e.y, 0);
  }

  canInfect(s: Side) {
    return s.hero.faction === 'light' && s.hero.level >= B.hero.activeChoiceLevel && s.coins >= B.economy.infectPrice;
  }

  infect(s: Side) {
    if (!this.canInfect(s)) return;
    s.coins -= B.economy.infectPrice;
    this.setFaction(s, 'dark', true);
    this.toast(`${this.who(s)}主动感染，变成了 ${s.hero.title}！成长速度 ×${B.hero.deepDarkSpeed}`);
  }

  sellEggs(s: Side) {
    this.relinkEggs(s);
    if (s.eggs.length < B.economy.eggsPerCoin) return;
    s.eggs.splice(-B.economy.eggsPerCoin).forEach((e) => e.destroy());
    s.coins += 1;
    this.relinkEggs(s);
  }

  chaosFaction(s: Side): Faction | null {
    this.relinkEggs(s);
    for (const f of ['light', 'dark'] as Faction[]) {
      if (s.eggs.filter((e) => e.faction === f).length >= B.chaos.eggsNeeded) return f;
    }
    return null;
  }

  makeChaos(s: Side) {
    const f = this.chaosFaction(s);
    if (!f) return;
    s.eggs.filter((e) => e.faction === f).slice(0, B.chaos.eggsNeeded).forEach((e) => e.destroy());
    this.relinkEggs(s);
    const c = this.spawnUnit('chaos', s.id, s.hero.x, s.hero.y, this.skin.units.chaos);
    c.speed = B.chaos.speed;
    this.toast(`${B.chaos.eggsNeeded} 颗蛋合成了${this.skin.units.chaos}！它会去吞掉对方主角`);
  }

  collectPoop(s: Side, p: Poop) {
    p.destroy();
    this.pickup[s.id] = null;
    s.poops[p.level - 1]++;
    if (s.id === 'player') this.events.emit('tut:collect');
    this.floatText(p.x, p.y - 20, `捡到 Lv${p.level} 奶屎`, '#e8dcc0');
    for (let lv = 0; lv < B.poop.maxLevel - 1; lv++) {
      while (s.poops[lv] >= B.poop.mergeCount) {
        s.poops[lv] -= B.poop.mergeCount;
        s.poops[lv + 1]++;
        this.log(`${this.who(s)}的奶屎合成了 Lv${lv + 2}`);
      }
    }
  }

  eatPoop(s: Side) {
    if (s.poops[2] <= 0) return;
    s.poops[2]--;
    this.heal(s, B.poop.eatHeal);
  }

  buildFortress(s: Side) {
    if (s.poops[2] <= 0) return;
    s.poops[2]--;
    const dir = s.id === 'player' ? 1 : -1;
    const f = this.spawnUnit('fortress', s.id, s.hero.x + dir * 60, s.hero.y, this.skin.units.fortress);
    art.drawFortress(f.gfx, this.skin.colors.poop);
    f.nameText.setY(26);
    this.log(`${this.who(s)}堆起了奶屎堡垒（可挡 1 次攻击或天雷）`);
  }

  setFriendMode(s: Side, i: number, mode: 'protect' | 'fight' | 'sold') {
    const f: Friend = s.friends[i];
    if (f.mode !== 'protect' && f.mode !== 'fight') return;
    if (f.mode === mode) return;
    if (f.unit) {
      f.unit.destroy();
      f.unit = null;
    }
    f.mode = mode;
    if (mode === 'fight') {
      const u = this.spawnUnit('friend', s.id, s.hero.x - 40, s.hero.y + 30, f.name);
      u.friendIndex = i;
      this.recolorUnit(u, s.hero.faction === 'light' ? 'light' : 'dark');
      u.speed = 180;
      u.followTarget = s.hero;
      u.followGap = 45 + i * 15;
      f.unit = u;
      this.log(`${f.name} 共赴战斗：对方的攻击会平均分摊`);
    } else if (mode === 'sold') {
      s.coins += B.friends.sellPrice;
      this.log(`卖掉了 ${f.name}，获得 ${B.friends.sellPrice} 金币`);
    } else {
      this.log(`${f.name} 被保护起来了`);
    }
  }

  private pollute(id: SideId) {
    const s = this.sides[id];
    s.pollutedUntil = this.t + B.debuff.pollution;
    if (id === 'player') {
      const g = this.pollution;
      g.clear();
      for (let i = 0; i < 14; i++) {
        const p = randomFieldPoint();
        g.fillStyle(this.skin.colors.poop, 0.92).fillCircle(p.x, p.y, Phaser.Math.Between(40, 95));
        g.fillStyle(0x5e3b1a, 0.9).fillCircle(p.x + 15, p.y - 10, Phaser.Math.Between(15, 35));
      }
      g.setVisible(true).setAlpha(1);
    }
  }

  // ───────────────────────── 玩家输入 ─────────────────────────

  private onFieldClick(p: Phaser.Input.Pointer) {
    if (this.ended) return;
    if (p.y < FIELD.y || p.y > FIELD.y + FIELD.h) return;
    const s = this.sides.player;
    if (this.t < s.frozenUntil) return this.floatText(s.hero.x, s.hero.y - 40, '被冰冻了！', '#9ee7ff');
    const poop = this.nearest(this.poops, p, 30);
    if (poop) {
      if (s.hero.dist(poop) <= B.poop.pickupRange) return this.collectPoop(s, poop);
      this.pickup.player = poop;
      s.hero.moveTarget = { x: poop.x, y: poop.y };
      return;
    }
    this.pickup.player = null;
    s.hero.moveTarget = { x: p.x, y: p.y };
    this.events.emit('tut:move');
    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, 0xffffff, 0.8).strokeCircle(p.x, p.y, 12);
    this.tweens.add({ targets: ring, alpha: 0, scale: 1.6, duration: 400, onComplete: () => ring.destroy() });
  }

  // ───────────────────────── 电脑 AI ─────────────────────────

  private updateAI(dt: number) {
    const s = this.sides.ai;
    const h = s.hero;
    // 光派时躲天雷
    if (h.faction === 'light') {
      const danger = this.thunders.find((th) => h.dist(th) < B.thunder.radius + 25);
      if (danger) {
        const a = Math.atan2(h.y - danger.y, h.x - danger.x);
        h.moveTarget = { x: h.x + Math.cos(a) * 140, y: h.y + Math.sin(a) * 140 };
        clampToField(h.moveTarget);
        this.pickup.ai = null;
      }
    }
    this.aiThink -= dt;
    if (this.aiThink > 0 || this.t < s.pollutedUntil || this.t < s.frozenUntil) return;
    this.aiThink = B.ai.thinkInterval;
    this.aiDecide(s);
  }

  private aiDecide(s: Side) {
    const h = s.hero;
    const enemy = this.sides.player.hero;
    if (s.bottle > 0 && h.hp <= B.hero.maxHp - 2) for (let i = 0; i < 5; i++) this.drink(s);
    if (s.poops[2] > 0) h.hp <= 24 ? this.eatPoop(s) : this.buildFortress(s);
    if (s.hand.length && Math.random() < B.ai.playCardChance) this.playCard(s, 0);
    if (this.chaosFaction(s)) this.makeChaos(s);
    if (this.canNeedle(s) && h.dist(enemy) < 550 && Math.random() < 0.5) this.throwNeedle(s);
    if (this.canInfect(s)) this.infect(s);
    if (h.hp <= 20 && s.bottle <= 0 && s.coins >= 1 && Math.random() < 0.5) Math.random() < 0.5 ? this.buyTea(s) : this.buyBottle(s);
    if (s.coins >= B.economy.cardPrice && s.hand.length === 0 && Math.random() < 0.4) this.buyCard(s);
    if (s.eggs.length >= B.economy.eggsPerCoin && s.coins < 2 && Math.random() < 0.2) this.sellEggs(s);

    if (!this.pickup.ai || !this.pickup.ai.alive) {
      const p = this.nearest(this.poops, h, 450);
      this.pickup.ai = p;
      if (p) h.moveTarget = { x: p.x, y: p.y };
    }
    if (!h.moveTarget && !this.pickup.ai) h.moveTarget = randomFieldPoint(560);
  }

  // ───────────────────────── HUD ─────────────────────────

  private drawField() {
    const c = this.skin.colors;
    this.add.rectangle(0, 0, 1280, 720, 0x1d2330).setOrigin(0);
    this.add.rectangle(FIELD.x, FIELD.y, FIELD.w, FIELD.h, c.field).setOrigin(0).setStrokeStyle(4, 0x5a3e24);
    const g = this.add.graphics();
    g.lineStyle(2, c.fieldLine, 0.6);
    for (let x = FIELD.x + 80; x < FIELD.x + FIELD.w; x += 80) g.lineBetween(x, FIELD.y, x, FIELD.y + FIELD.h);
    g.lineStyle(3, 0xffffff, 0.25).lineBetween(640, FIELD.y, 640, FIELD.y + FIELD.h);
    // 栅栏
    g.fillStyle(0xc89b62);
    for (let x = FIELD.x + 10; x < FIELD.x + FIELD.w; x += 26) {
      g.fillRect(x, FIELD.y + 4, 6, 14);
      g.fillRect(x, FIELD.y + FIELD.h - 18, 6, 14);
    }
    this.add.rectangle(0, 512, 1280, 208, c.panel).setOrigin(0);
  }

  private buildHud() {
    const mk = (id: SideId, x: number): SideHud => {
      const color = id === 'player' ? '#9cc4ff' : '#ffbd80';
      const name = label(this, x, 6, '', 17, color);
      this.add.rectangle(x, 30, HP_BAR_W, 14, 0x3a1f25).setOrigin(0);
      const hpFill = this.add.rectangle(x, 30, HP_BAR_W, 14, 0xe74c3c).setOrigin(0);
      const hpText = label(this, x + HP_BAR_W + 8, 27, '', 14);
      this.add.rectangle(x, 48, HP_BAR_W, 6, 0x333a48).setOrigin(0);
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

    const p = this.sides.player;
    label(this, 20, 518, '手牌（点击打出，单位放在主角身边）', 13, '#9aa4b8');
    for (let i = 0; i < B.economy.maxHand; i++) {
      this.cardButtons.push(new Button(this, 20 + i * 98, 538, 92, 50, '', () => this.playCard(p, i)));
    }

    this.poopText = label(this, 820, 518, '', 13, '#e8dcc0');
    this.shop.eat = new Button(this, 820, 538, 100, 50, `吃 Lv3 奶屎\n+${B.poop.eatHeal} 血`, () => this.eatPoop(p), 0x6b4a2b);
    this.shop.fort = new Button(this, 926, 538, 100, 50, '堆成堡垒', () => this.buildFortress(p), 0x6b4a2b);

    const E = B.economy;
    const shopDefs: [string, string, () => void, number?][] = [
      ['card', `买卡\n${E.cardPrice} 金币`, () => this.buyCard(p)],
      ['tea', `奶茶（抽取）\n${E.teaPrice} 金币`, () => this.buyTea(p)],
      ['bottle', `奶瓶\n${E.bottlePrice} 金币`, () => this.buyBottle(p)],
      ['drink', '', () => this.drink(p), 0x2f7d5b],
      ['needle', `解毒针\n${E.needlePrice} 金币`, () => this.throwNeedle(p), 0x2e8b57],
      ['infect', `主动感染\n${E.infectPrice} 金币`, () => this.infect(p), 0x9b3d2e],
      ['sell', `卖 ${E.eggsPerCoin} 颗蛋\n换 1 金币`, () => this.sellEggs(p)],
      ['chaos', `合成混沌奶蛋\n需 ${B.chaos.eggsNeeded} 颗同阵营蛋`, () => this.makeChaos(p), 0x5b3a7a],
    ];
    shopDefs.forEach(([key, text, fn, color], i) => {
      this.shop[key] = new Button(this, 20 + i * 126, 600, 120, 52, text, fn, color);
      if (key in B.unlock.shop) this.shopLabels.push([key as ShopKey, text]);
    });

    label(this, 1040, 518, `朋友（各 ${B.friends.hp} 血）`, 13, '#9aa4b8');
    p.friends.forEach((_f, i) => {
      const y = 540 + i * 58;
      const text = label(this, 1040, y, '', 14);
      const protect = new Button(this, 1040, y + 20, 70, 28, '保护', () => this.setFriendMode(p, i, 'protect'), 0x3b6e9b);
      const fight = new Button(this, 1114, y + 20, 70, 28, '出战', () => this.setFriendMode(p, i, 'fight'), 0x9b6e3b);
      const sell = new Button(this, 1188, y + 20, 70, 28, `卖 ${B.friends.sellPrice} 金`, () => this.setFriendMode(p, i, 'sold'), 0x555555);
      this.friendRows.push({ text, protect, fight, sell });
    });

    this.logText = label(this, 20, 664, '', 13, '#c5cbd8').setLineSpacing(4);
  }

  private refreshHud() {
    for (const s of Object.values(this.sides)) {
      const h = s.hero;
      const ui = this.hud[s.id];
      const tag = s.id === 'player' ? '你' : '电脑 AI';
      const fac = h.faction === 'light' ? '光派' : '暗派';
      ui.name.setText(`${tag} · ${h.title} Lv${h.level} · ${fac}`);
      ui.hpFill.width = (HP_BAR_W * h.hp) / B.hero.maxHp;
      ui.hpText.setText(`${h.hp.toFixed(1)} / ${B.hero.maxHp}`);
      ui.growFill.width = h.level >= B.hero.maxLevel ? HP_BAR_W : HP_BAR_W * h.growth;
      const poison = h.faction === 'light' ? `毒素 ${h.poison}/${B.thunder.fallAt}` : '免疫天雷';
      ui.info.setText(`金币 ${s.coins}   蛋 ${s.eggs.filter((e) => e.alive).length}   ${poison}\n成长 ×${this.growthMultiplier(h)}   手牌 ${s.hand.length}`);
      const st: string[] = [];
      if (this.t < s.frozenUntil) st.push(`冰冻 ${(s.frozenUntil - this.t).toFixed(1)}s`);
      if (this.t < s.pollutedUntil) st.push(`视觉污染 ${(s.pollutedUntil - this.t).toFixed(1)}s`);
      if (h.dance) st.push('跳舞中');
      if (h.deepDark && h.faction === 'dark') st.push(`解毒进度 ${h.antidoteHits}/${B.needle.deepDarkDose}`);
      if (this.bossSide === s.id) st.push('全场之主');
      ui.status.setText(st.join('   '));
    }

    const nt = this.tutorialActive ? '新手引导中' : this.thunderOff ? '天雷已消失' : `下一道天雷 ${Math.max(0, this.nextThunder - this.t).toFixed(0)}s`;
    this.clockText.setText(`${this.tutorialActive ? 0 : this.battleTime.toFixed(0)}s\n${nt}`);

    const p = this.sides.player;
    this.cardButtons.forEach((b, i) => {
      const c = p.hand[i];
      b.setVisible(!!c);
      if (c) b.setLabel(this.cardName(c));
    });
    this.cardButtons.forEach((b, i) => p.hand[i] && (b.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(CARD_COLORS[p.hand[i]]));

    this.poopText.setText(`奶屎背包  Lv1×${p.poops[0]}  Lv2×${p.poops[1]}  Lv3×${p.poops[2]}`);
    this.shop.eat.setEnabled(p.poops[2] > 0);
    this.shop.fort.setEnabled(p.poops[2] > 0);
    const E = B.economy;
    // 未解锁的道具显示解锁等级
    for (const [key, text] of this.shopLabels) {
      const lv = B.unlock.shop[key];
      this.shop[key].setLabel(this.shopUnlocked(p, key) ? text : `${SHOP_NAMES[key]}\n🔒 Lv${lv} 解锁`);
    }
    this.shop.card.setEnabled(this.shopUnlocked(p, 'card') && p.coins >= E.cardPrice && p.hand.length < E.maxHand);
    this.shop.tea.setEnabled(this.shopUnlocked(p, 'tea') && p.coins >= E.teaPrice);
    this.shop.bottle.setEnabled(this.shopUnlocked(p, 'bottle') && p.coins >= E.bottlePrice);
    this.shop.drink.setLabel(`喝奶瓶（连点）\n剩 ${p.bottle.toFixed(1)} 血`).setEnabled(p.bottle > 0);
    this.shop.needle.setEnabled(this.canNeedle(p));
    this.shop.infect.setEnabled(this.canInfect(p));
    this.shop.sell.setEnabled(p.eggs.filter((e) => e.alive).length >= E.eggsPerCoin);
    this.shop.chaos.setEnabled(!!this.chaosFaction(p));

    p.friends.forEach((f, i) => {
      const row = this.friendRows[i];
      const modeText = { protect: '受保护', fight: '出战中', sold: '已出售', dead: '已倒下', defected: '已变异叛逃' }[f.mode];
      row.text.setText(`${f.name}  ${f.hp.toFixed(1)} 血  ${modeText}`);
      const active = f.mode === 'protect' || f.mode === 'fight';
      row.protect.setEnabled(active && f.mode !== 'protect');
      row.fight.setEnabled(active && f.mode !== 'fight');
      row.sell.setEnabled(active);
    });

    if (this.t >= p.pollutedUntil && this.pollution.visible && !this.tweens.isTweening(this.pollution)) {
      this.tweens.add({ targets: this.pollution, alpha: 0, duration: 300, onComplete: () => this.pollution.setVisible(false) });
    }
  }

  // ───────────────────────── 工具 ─────────────────────────

  private who(s: Side) {
    return s.id === 'player' ? '你' : 'AI';
  }

  private cardName(c: CardId) {
    return c === 'poop' ? '奶屎' : this.skin.units[c];
  }

  private nearest<T extends { x: number; y: number; alive: boolean }>(list: T[], from: { x: number; y: number }, maxDist: number): T | null {
    let best: T | null = null;
    let bd = maxDist;
    for (const o of list) {
      if (!o.alive) continue;
      const d = Phaser.Math.Distance.Between(o.x, o.y, from.x, from.y);
      if (d <= bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

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
    this.logLines.push(`[${this.t.toFixed(0)}s] ${s}`);
    this.logLines = this.logLines.slice(-3);
    this.logText?.setText(this.logLines.join('\n'));
  }
}
