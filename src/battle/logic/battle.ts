import { BALANCE as B } from '../../config/balance';
import type { Skin } from '../../skins';

/**
 * 主战斗的规则逻辑，不依赖 Phaser：只维护数据、推进时间、产生事件。
 * 画面（BattleScene）每帧读取这里的状态来画，并把 events 里的事件变成飘字、闪光、切场景等表现。
 * 迁移到别的引擎（如 Cocos Creator）或放到联机服务器上时，这个文件可以原样复用。
 */

export type Faction = 'light' | 'dark';
export type SideId = 'player' | 'ai';
export type UnitKind = 'hero' | 'egg' | 'dog' | 'mouse' | 'powder' | 'chicken' | 'friend' | 'chaos' | 'fortress';
export type CardId = 'dog' | 'mouse' | 'powder' | 'chicken' | 'poop';
export type ShopKey = keyof typeof B.unlock.shop;

export const FIELD = { x: 20, y: 80, w: 1240, h: 420 };
export const CARDS: CardId[] = ['dog', 'mouse', 'powder', 'chicken', 'poop'];
export const SHOP_NAMES: Record<ShopKey, string> = { bottle: '奶瓶', card: '买卡', sell: '卖蛋', chaos: '混沌奶蛋', tea: '奶茶', needle: '解毒针', infect: '主动感染' };
export const unlockedCards = (level: number) => CARDS.filter((c) => B.unlock.cards[c] <= level);
export const other = (s: SideId): SideId => (s === 'player' ? 'ai' : 'player');

// ───────── 小工具（代替 Phaser.Math） ─────────

type XY = { x: number; y: number };
export const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function clampToField(o: XY) {
  o.x = clamp(o.x, FIELD.x + 16, FIELD.x + FIELD.w - 16);
  o.y = clamp(o.y, FIELD.y + 16, FIELD.y + FIELD.h - 16);
}

export function randomFieldPoint(xMin = FIELD.x + 30, xMax = FIELD.x + FIELD.w - 30) {
  return { x: rand(xMin, xMax), y: rand(FIELD.y + 30, FIELD.y + FIELD.h - 30) };
}

// ───────── 数据结构 ─────────

let seq = 0;

export class Unit {
  readonly id = ++seq;
  alive = true;
  poison = 0;
  moveTarget: XY | null = null;
  followTarget: Unit | null = null;
  followGap = 34;
  speed = 80;
  radius = 18;
  dance: { cx: number; cy: number; angle: number; until: number } | null = null;
  /** 奶狗吃屎冷却、奶鸡产蛋计时、混沌奶蛋动画等通用计时器 */
  timer = 0;
  friendIndex = -1;

  constructor(
    public kind: UnitKind,
    public owner: SideId,
    public faction: Faction,
    public x: number,
    public y: number,
    public name: string,
  ) {}

  dist(o: XY) {
    return distance(this, o);
  }

  stepToward(tx: number, ty: number, dt: number, stopAt = 2) {
    const d = distance(this, { x: tx, y: ty });
    if (d <= stopAt) return true;
    const step = Math.min(d - stopAt, this.speed * dt);
    this.x += ((tx - this.x) / d) * step;
    this.y += ((ty - this.y) / d) * step;
    clampToField(this);
    return false;
  }

  destroy() {
    this.alive = false;
  }
}

export class Hero extends Unit {
  level = 1;
  hp: number = B.hero.startHp;
  growth = 0;
  deepDark = false;
  antidoteHits = 0;
  attackTimer = 1;

  constructor(owner: SideId, faction: Faction, x: number, y: number, private skin: Skin) {
    super('hero', owner, faction, x, y, '');
    this.speed = B.hero.moveSpeed;
    this.refresh();
  }

  get title() {
    const n = this.skin.heroNames;
    if (this.faction === 'dark' && this.deepDark && this.level === 4) return n.deepDark;
    return (this.faction === 'light' ? n.light : n.dark)[this.level - 1];
  }

  /** 等级或阵营变化后更新体型和名字 */
  refresh() {
    this.radius = 14 + this.level * 5;
    this.name = `${this.owner === 'player' ? '你' : 'AI'}·${this.title} Lv${this.level}`;
  }
}

export class Poop {
  readonly id = ++seq;
  alive = true;
  constructor(
    public x: number,
    public y: number,
    public level: number,
    public owner: SideId | null,
  ) {}
  destroy() {
    this.alive = false;
  }
}

export type FriendMode = 'protect' | 'fight' | 'sold' | 'dead' | 'defected';

export interface Friend {
  index: number;
  name: string;
  hp: number;
  mode: FriendMode;
  unit: Unit | null;
}

export interface Side {
  id: SideId;
  hero: Hero;
  coins: number;
  hand: CardId[];
  /** 奶屎背包：下标 0/1/2 对应 1/2/3 级 */
  poops: number[];
  bottle: number;
  needleMisses: number;
  eggs: Unit[];
  pollutedUntil: number;
  frozenUntil: number;
  comebackReadyAt: number;
  protectRewardGiven: boolean;
  friends: Friend[];
}

export interface Projectile {
  readonly id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  from: SideId;
  kind: 'attack' | 'needle';
  damage: number;
  travelled: number;
  max: number;
  done: boolean;
}

export interface Thunder {
  readonly id: number;
  x: number;
  y: number;
  strikeAt: number;
  done: boolean;
}

/** 逻辑层发给画面层的事件。画面层只负责表现，不改规则 */
export type BattleEvent =
  | { type: 'toast'; text: string }
  | { type: 'log'; text: string }
  | { type: 'float'; x: number; y: number; text: string; color: string }
  | { type: 'heroHit'; side: SideId }
  | { type: 'strike'; x: number; y: number }
  | { type: 'spray'; from: XY; to: XY }
  | { type: 'pollute'; side: SideId }
  | { type: 'eggFlash'; x: number; y: number }
  | { type: 'duel'; playerIsDark: boolean; elapsed: number }
  | { type: 'end'; win: boolean; reason: string; elapsed: number }
  | { type: 'tut'; name: 'move' | 'collect' | 'card' | 'thunder'; card?: CardId };

export type MoveResult = 'frozen' | 'collect' | 'pickup' | 'move';

// ───────── 战斗世界 ─────────

export class BattleWorld {
  t = 0;
  sides: Record<SideId, Side>;
  units: Unit[] = [];
  poops: Poop[] = [];
  projectiles: Projectile[] = [];
  thunders: Thunder[] = [];
  nextThunder: number = B.thunder.startAt;
  thunderOff = false;
  bossSide: SideId | null = null;
  ended = false;
  /** 新手引导进行中时，AI、成长、自动攻击、天雷投放都暂停 */
  tutorialActive = false;
  /** 免费奶茶次数（第一关带来的），不受解锁等级和金币限制 */
  freeTea = 0;
  events: BattleEvent[] = [];

  private danceUntil = 0;
  private dancing = false;
  private pickup: Record<SideId, Poop | null> = { player: null, ai: null };
  private aiThink = 1;
  private battleStart = 0;
  private timers: { at: number; fn: () => void }[] = [];

  constructor(private skin: Skin) {
    const mkSide = (id: SideId, faction: Faction, x: number): Side => ({
      id,
      hero: new Hero(id, faction, x, FIELD.y + FIELD.h / 2, skin),
      coins: B.economy.startCoins,
      hand: Array.from({ length: B.economy.startCards }, () => pick(unlockedCards(1))),
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
    this.sides.player.friends = skin.friends.map((name, index) => ({ index, name, hp: B.friends.hp, mode: 'protect', unit: null }));
    // 开局手牌固定给一张奶鸡，方便引导和起步经济
    this.sides.player.hand = (['chicken', 'poop'] as CardId[]).slice(0, B.economy.startCards);
  }

  /** 引导结束（或跳过）后正式开战；carry 是第一关灵泉装满带过来的道具 */
  startBattle(carry: { tea: number; milk: number }) {
    this.tutorialActive = false;
    this.battleStart = this.t;
    this.nextThunder = this.t + B.thunder.startAt;
    this.sides.player.hero.attackTimer = 1.5;
    this.sides.ai.hero.attackTimer = 2.5;
    this.toast('对战开始！你是光奶蛋，对手是成长速度 2 倍的暗奶蛋');
    if (carry.tea || carry.milk) {
      this.freeTea += carry.tea;
      this.sides.player.bottle += carry.milk * B.bottle.capacity;
      this.log(`你带着第一关的灵泉道具：免费奶茶 ×${carry.tea}，奶瓶 ×${carry.milk}。`);
    }
  }

  get battleTime() {
    return this.t - this.battleStart;
  }

  get allUnits(): Unit[] {
    return [this.sides.player.hero, this.sides.ai.hero, ...this.units];
  }

  shopUnlocked(s: Side, key: ShopKey) {
    return s.hero.level >= B.unlock.shop[key];
  }

  growthMultiplier(h: Hero) {
    if (h.level >= B.hero.maxLevel) return 0;
    if (h.faction === 'dark') return h.deepDark ? B.hero.deepDarkSpeed : B.hero.darkSpeed;
    if (h.hp < B.hero.midHpMax) return B.hero.midHpSpeed;
    return 1;
  }

  cardName(c: CardId) {
    return c === 'poop' ? '奶屎' : this.skin.units[c];
  }

  who(s: Side) {
    return s.id === 'player' ? '你' : 'AI';
  }

  private later(sec: number, fn: () => void) {
    this.timers.push({ at: this.t + sec, fn });
  }

  private toast(text: string) {
    this.events.push({ type: 'toast', text });
  }
  private log(text: string) {
    this.events.push({ type: 'log', text });
  }
  private float(x: number, y: number, text: string, color: string) {
    this.events.push({ type: 'float', x, y, text, color });
  }

  // ───────────────────────── 主循环 ─────────────────────────

  update(dt: number) {
    if (this.ended) return;
    this.t += dt;

    const due = this.timers.filter((tm) => this.t >= tm.at);
    this.timers = this.timers.filter((tm) => this.t < tm.at);
    for (const tm of due) tm.fn();

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
  }

  // ───────────────────────── 成长 ─────────────────────────

  private updateGrowth(s: Side, dt: number) {
    const h = s.hero;
    if (h.level >= B.hero.maxLevel) return;
    // 绝地反弹：光派血量跌破 10，直接升一级（有冷却）
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
    h.refresh();
    this.float(h.x, h.y - 40, `升级！${h.title}`, '#fff27a');
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
    for (let i = 0; i < n && s.hand.length < B.economy.maxHand; i++) s.hand.push(pick(pool));
  }

  // ───────────────────────── 主角移动与攻击 ─────────────────────────

  private updateHero(s: Side, dt: number) {
    const h = s.hero;
    const frozen = this.t < s.frozenUntil;
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
    const d = Math.max(1, distance({ x, y }, { x: tx, y: ty }));
    this.projectiles.push({
      id: ++seq,
      x,
      y,
      vx: ((tx - x) / d) * speed,
      vy: ((ty - y) / d) * speed,
      from,
      kind,
      damage,
      travelled: 0,
      max: kind === 'needle' ? d + 60 : 1500,
      done: false,
    });
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.travelled += Math.hypot(p.vx, p.vy) * dt;
      const enemySide = this.sides[other(p.from)];
      const enemy = enemySide.hero;

      if (p.kind === 'attack') {
        const fort = this.units.find((u) => u.alive && u.kind === 'fortress' && u.owner === enemySide.id && u.dist(p) < 32);
        if (fort) {
          fort.destroy();
          this.float(p.x, p.y, '堡垒挡下攻击', '#ffe08a');
          p.done = true;
        }
      }
      if (!p.done && enemy.dist(p) < enemy.radius + 4) {
        if (p.kind === 'attack') this.damage(enemySide, p.damage);
        else this.antidote(enemySide);
        p.done = true;
      }
      const outside = p.x < FIELD.x || p.x > FIELD.x + FIELD.w || p.y < FIELD.y || p.y > FIELD.y + FIELD.h;
      if (!p.done && (outside || p.travelled > p.max)) {
        if (p.kind === 'needle') this.needleMiss(this.sides[p.from]);
        p.done = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  private damage(s: Side, amount: number) {
    const h = s.hero;
    const fighters = s.friends.filter((f) => f.mode === 'fight' && f.unit);
    const share = amount / (1 + fighters.length);
    h.hp = Math.max(0, h.hp - share);
    this.float(h.x, h.y - h.radius, `-${+share.toFixed(1)}`, '#ff6b6b');
    for (const f of fighters) {
      f.hp -= share;
      this.float(f.unit!.x, f.unit!.y - 20, `-${+share.toFixed(1)}`, '#ff6b6b');
      if (f.hp <= 0) {
        f.hp = 0;
        f.mode = 'dead';
        f.unit!.destroy();
        f.unit = null;
        h.hp = Math.max(0, h.hp - B.friends.lossPenalty);
        this.toast(`${f.name} 倒下了！会心一击 -${B.friends.lossPenalty}`);
      }
    }
    this.events.push({ type: 'heroHit', side: s.id });
  }

  private heal(s: Side, amount: number) {
    s.hero.hp = Math.min(B.hero.maxHp, s.hero.hp + amount);
    this.float(s.hero.x, s.hero.y - s.hero.radius, `+${+amount.toFixed(1)}`, '#7dff9a');
  }

  // ───────────────────────── 光暗转换 ─────────────────────────

  private setFaction(s: Side, faction: Faction, deepDark = false) {
    const h = s.hero;
    h.faction = faction;
    h.deepDark = faction === 'dark' && deepDark;
    h.poison = 0;
    h.antidoteHits = 0;
    h.refresh();
    // 奶鸡随阵营
    for (const u of this.units) {
      if (u.alive && u.kind === 'chicken' && u.owner === s.id) this.recolorUnit(u, faction);
    }
    if (this.sides.player.hero.faction === 'dark' && this.sides.ai.hero.faction === 'dark' && !this.thunderOff) {
      this.thunderOff = true;
      this.thunders = [];
      this.toast('双方都已堕落，天雷消失！暗派对暗派，血量定胜负');
    }
  }

  /** 改阵营（画面会根据阵营自动换颜色）；奶蛋换阵营还要改名 */
  private recolorUnit(u: Unit, faction: Faction) {
    u.faction = faction;
    if (u.kind === 'egg') u.name = faction === 'light' ? this.skin.units.egg : this.skin.units.darkEgg;
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

  spawnThunderAt(x: number, y: number, warnTime: number = B.thunder.warnTime) {
    const p = { x, y };
    clampToField(p);
    this.thunders.push({ id: ++seq, ...p, strikeAt: this.t + warnTime, done: false });
  }

  private updateThunder() {
    if (this.thunderOff) return;
    if (!this.tutorialActive && this.t >= this.nextThunder) {
      this.nextThunder += B.thunder.interval;
      let p = randomFieldPoint();
      // 一部分天雷瞄准光派角色附近落下
      const lights = this.allUnits.filter((u) => u.alive && u.faction === 'light' && u.kind !== 'fortress');
      if (lights.length && Math.random() < B.thunder.aimedChance) {
        const u = pick(lights);
        p = { x: u.x + rand(-60, 60), y: u.y + rand(-60, 60) };
      }
      this.spawnThunderAt(p.x, p.y);
    }
    for (const th of this.thunders) {
      if (this.t >= th.strikeAt) {
        th.done = true;
        this.strike(th);
      }
    }
    this.thunders = this.thunders.filter((th) => !th.done);
  }

  private strike(th: Thunder) {
    this.events.push({ type: 'tut', name: 'thunder' });
    this.events.push({ type: 'strike', x: th.x, y: th.y });

    const fort = this.units.find((u) => u.alive && u.kind === 'fortress' && u.dist(th) <= B.thunder.radius);
    if (fort) {
      fort.destroy();
      this.toast('奶屎堡垒挡住了天雷！');
      return;
    }
    for (const u of this.allUnits) {
      if (!u.alive || u.faction !== 'light' || u.dist(th) > B.thunder.radius) continue;
      if (u.kind === 'fortress' || u.kind === 'chaos') continue;
      const add = u.kind === 'hero' ? B.thunder.poisonHero : u.kind === 'egg' ? B.thunder.poisonEgg : B.thunder.poisonFriend;
      u.poison += add;
      this.float(u.x, u.y - 30, `毒素 ${u.poison}/${B.thunder.fallAt}`, '#d6a2ff');
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

  private spawnUnit(kind: UnitKind, owner: SideId, x: number, y: number, name: string, faction?: Faction) {
    const fac = faction ?? this.sides[owner].hero.faction;
    const u = new Unit(kind, owner, fac, x, y, name);
    clampToField(u);
    this.units.push(u);
    this.recolorUnit(u, fac);
    return u;
  }

  spawnPoop(x: number, y: number, level: number, owner: SideId | null) {
    const p = new Poop(x, y, level, owner);
    clampToField(p);
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
      this.float(dog.x, dog.y - 30, '吃一个，拉一个', '#e8dcc0');
      this.later(1.2, () => {
        if (!dog.alive || this.ended) return;
        const p = randomFieldPoint();
        this.spawnPoop(p.x, p.y, 1, dog.owner);
      });
    } else {
      const pool: Unit[] = [this.sides.player.hero, this.sides.ai.hero, ...this.units.filter((x) => x.alive && x !== dog && x.kind !== 'fortress')];
      const victim = pick(pool);
      this.events.push({ type: 'spray', from: { x: dog.x, y: dog.y }, to: { x: victim.x, y: victim.y } });
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
    this.float(chicken.x, chicken.y - 30, '咯咯！下蛋了', '#ffffff');
  }

  private relinkEggs(s: Side) {
    s.eggs = s.eggs.filter((e) => e.alive);
    s.eggs.forEach((e, i) => (e.followTarget = i === 0 ? s.hero : s.eggs[i - 1]));
  }

  private updateChaos(u: Unit, dt: number) {
    const enemySide = this.sides[other(u.owner)];
    const enemy = enemySide.hero;
    u.timer += dt;
    // 吞噬路上的对方单位
    for (const v of this.units) {
      if (v.alive && v !== u && v.owner === enemySide.id && v.kind !== 'chaos' && u.dist(v) < 30) {
        v.destroy();
        this.float(u.x, u.y - 40, `吞掉了 ${v.name}`, '#d96bff');
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
    const all = shuffle([this.sides.player.hero, this.sides.ai.hero, ...this.units.filter((u) => u.alive && u.kind !== 'fortress' && u.kind !== 'chaos')]);
    for (let i = 0; i < all.length; i += 2) {
      const a = all[i];
      const b = all[i + 1] ?? a;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      a.dance = { cx, cy, angle: 0, until: this.danceUntil };
      if (b !== a) b.dance = { cx, cy, angle: Math.PI, until: this.danceUntil };
    }
    for (const u of all) u.moveTarget = null;
    this.later(B.debuff.dance + 0.05, () => {
      mouse.destroy();
      powder.destroy();
    });
    this.toast('奶鼠 + 奶粉：全场戴上蝴蝶结，牵手跳舞！');
  }

  private updateDance(dt: number) {
    if (!this.dancing) return;
    const all = this.allUnits;
    if (this.t >= this.danceUntil) {
      this.dancing = false;
      for (const u of all) u.dance = null;
      return;
    }
    for (const u of all) {
      if (!u.alive || !u.dance) continue;
      // 舞伴中心也会慢慢漂移，打乱站位
      u.dance.angle += dt * 5;
      u.dance.cx += Math.sin(this.t * 2 + u.dance.cy) * 40 * dt;
      u.x = u.dance.cx + Math.cos(u.dance.angle) * 30;
      u.y = u.dance.cy + Math.sin(u.dance.angle) * 18;
      clampToField(u);
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
        this.events.push({ type: 'eggFlash', x: egg.x, y: egg.y });
        return this.startDuel(s.id, '场上的奶蛋发生变态发育，进化成西格玛奶蛙');
      }
    }
  }

  private startDuel(bossSide: SideId, reason: string) {
    this.ended = true;
    this.toast(`${reason}！决斗开始`);
    this.events.push({ type: 'duel', playerIsDark: bossSide === 'player', elapsed: this.battleTime });
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
    this.events.push({ type: 'end', win, reason, elapsed: this.battleTime });
  }

  // ───────────────────────── 双方共用的操作（玩家按钮和 AI 都调这些） ─────────────────────────

  /** 点击场地：去捡奶屎，或者走过去 */
  moveTo(s: Side, x: number, y: number): MoveResult {
    if (this.t < s.frozenUntil) {
      this.float(s.hero.x, s.hero.y - 40, '被冰冻了！', '#9ee7ff');
      return 'frozen';
    }
    const poop = this.nearest(this.poops, { x, y }, 30);
    if (poop) {
      if (s.hero.dist(poop) <= B.poop.pickupRange) {
        this.collectPoop(s, poop);
        return 'collect';
      }
      this.pickup[s.id] = poop;
      s.hero.moveTarget = { x: poop.x, y: poop.y };
      return 'pickup';
    }
    this.pickup[s.id] = null;
    s.hero.moveTarget = { x, y };
    if (s.id === 'player') this.events.push({ type: 'tut', name: 'move' });
    return 'move';
  }

  playCard(s: Side, index: number) {
    const card = s.hand[index];
    if (!card) return;
    s.hand.splice(index, 1);
    const h = s.hero;
    const dir = s.id === 'player' ? 1 : -1;
    const x = h.x + dir * rand(50, 90);
    const y = h.y + rand(-60, 60);
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
    if (s.id === 'player') this.events.push({ type: 'tut', name: 'card', card });
  }

  buyCard(s: Side) {
    if (!this.shopUnlocked(s, 'card') || s.coins < B.economy.cardPrice || s.hand.length >= B.economy.maxHand) return;
    s.coins -= B.economy.cardPrice;
    this.giveCards(s, 1);
  }

  canBuyTea(s: Side) {
    return (s.id === 'player' && this.freeTea > 0) || (this.shopUnlocked(s, 'tea') && s.coins >= B.economy.teaPrice);
  }

  buyTea(s: Side) {
    if (s.id === 'player' && this.freeTea > 0) {
      this.freeTea--;
    } else {
      if (!this.shopUnlocked(s, 'tea') || s.coins < B.economy.teaPrice) return;
      s.coins -= B.economy.teaPrice;
    }
    const outs = B.tea.outcomes;
    let r = Math.random() * outs.reduce((a, o) => a + o.weight, 0);
    const o = (outs.find((x) => (r -= x.weight) < 0) ?? outs[0]) as { label: string; heal?: number; freeze?: number; poops?: number };
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
      for (let i = 0; i < o.poops; i++) this.spawnPoop(s.hero.x + rand(-80, 80), s.hero.y + rand(-80, 80), 1, s.id);
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
    if (Math.random() < 0.3) this.float(s.hero.x, s.hero.y - s.hero.radius, '+0.2', '#7dff9a');
  }

  canNeedle(s: Side) {
    return this.shopUnlocked(s, 'needle') && s.hero.faction === 'light' && s.coins >= B.economy.needlePrice && this.sides[other(s.id)].hero.faction === 'dark';
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
    if (s.id === 'player') this.events.push({ type: 'tut', name: 'collect' });
    this.float(p.x, p.y - 20, `捡到 Lv${p.level} 奶屎`, '#e8dcc0');
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
    this.spawnUnit('fortress', s.id, s.hero.x + dir * 60, s.hero.y, this.skin.units.fortress);
    this.log(`${this.who(s)}堆起了奶屎堡垒（可挡 1 次攻击或天雷）`);
  }

  setFriendMode(s: Side, i: number, mode: 'protect' | 'fight' | 'sold') {
    const f = s.friends[i];
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
      this.recolorUnit(u, s.hero.faction);
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
    this.sides[id].pollutedUntil = this.t + B.debuff.pollution;
    this.events.push({ type: 'pollute', side: id });
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

  // ───────────────────────── 工具 ─────────────────────────

  private nearest<T extends { x: number; y: number; alive: boolean }>(list: T[], from: XY, maxDist: number): T | null {
    let best: T | null = null;
    let bd = maxDist;
    for (const o of list) {
      if (!o.alive) continue;
      const d = distance(o, from);
      if (d <= bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
}
