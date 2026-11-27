import { STAGE4 as C } from '../config/stage4';

/**
 * 第四章「终极决斗」的规则（不依赖 Phaser）。
 * 一边是奶家军（发射解毒针），一边是暗派（扭腰躲）。你在哪边由第三章的结果决定，另一边是电脑。
 * 坐标：以暗派站立时的肚脐为原点，单位 = 肚脐虚线框边长；x 向右、y 向下。扭腰只改变肚脐的 x。
 */
export type Side = 'good' | 'dark';

export interface Needle {
  id: number;
  /** 瞄准的落点 */
  x: number;
  y: number;
  firedAt: number;
  arriveAt: number;
}

export type DuelEvent = { type: 'fire'; id: number } | { type: 'hit'; id: number } | { type: 'miss'; id: number };

export class Duel {
  t = 0;
  needlesLeft: number = C.needles;
  hits = 0;
  /** 现在扭到哪（-1 左 ～ 1 右），目标扭到哪（玩家的滑杆或电脑决定） */
  twist = 0;
  twistTarget = 0;
  needles: Needle[] = [];
  events: DuelEvent[] = [];
  winner: Side | null = null;
  /** 最近一次中针的时刻（画面换中针图用） */
  lastHitAt = -9;
  private readyAt = 0;
  private seq = 0;
  private aiFireAt = 1.5;
  private aiSwayAt = 0;
  private aiDodgeAt = -1;
  private aiDodgeTo = 0;
  /** 肚脐移动速度（电脑奶家军预判用） */
  private navelV = 0;

  /** player：你在哪边（另一边是电脑） */
  constructor(readonly player: Side) {}

  /** 肚脐现在的位置 */
  navelX() {
    return this.twist * C.twist.max;
  }

  canFire() {
    return !this.winner && this.needlesLeft > 0 && this.t >= this.readyAt;
  }

  /** 奶家军发射：瞄准 (x, y) */
  fire(x: number, y: number) {
    if (!this.canFire()) return false;
    this.needlesLeft--;
    this.readyAt = this.t + C.fireCooldown;
    const n = { id: ++this.seq, x, y, firedAt: this.t, arriveAt: this.t + C.needleFlight };
    this.needles.push(n);
    this.events.push({ type: 'fire', id: n.id });
    // 电脑暗派看到针飞来：过一会儿往远离落点的方向扭（不一定躲）
    if (this.player === 'good' && Math.random() < C.ai.dodgeChance) {
      this.aiDodgeAt = this.t + C.ai.dodgeReact * (0.6 + Math.random() * 0.8);
      this.aiDodgeTo = x >= this.navelX() ? -1 : 1;
      // 已经扭到边上了就往另一边
      if (Math.abs(this.twist - this.aiDodgeTo) < 0.3) this.aiDodgeTo = -this.aiDodgeTo;
    }
    return true;
  }

  update(dt: number) {
    if (this.winner) return;
    this.t += dt;
    if (this.player === 'good') this.aiDodge();
    else this.aiShoot();
    // 扭腰：朝目标移动
    const d = this.twistTarget - this.twist;
    const step = C.twist.speed * dt;
    const before = this.navelX();
    this.twist = Math.abs(d) <= step ? this.twistTarget : this.twist + Math.sign(d) * step;
    this.navelV = this.navelV * 0.8 + ((this.navelX() - before) / Math.max(dt, 1e-3)) * 0.2;
    // 针到了：落点在肚脐范围内算射中
    for (const n of [...this.needles]) {
      if (this.t < n.arriveAt) continue;
      this.needles.splice(this.needles.indexOf(n), 1);
      const hit = Math.hypot(n.x - this.navelX(), n.y) <= C.navelRadius;
      if (hit) {
        this.hits++;
        this.lastHitAt = this.t;
      }
      this.events.push({ type: hit ? 'hit' : 'miss', id: n.id });
    }
    if (this.hits >= C.hitsToWin) this.winner = 'good';
    else if ((this.needlesLeft === 0 && !this.needles.length) || this.t >= C.duration) this.winner = 'dark';
  }

  /** 电脑暗派：平时随便扭一扭，针来了按 fire 里定好的方向躲 */
  private aiDodge() {
    if (this.aiDodgeAt >= 0 && this.t >= this.aiDodgeAt) {
      this.twistTarget = this.aiDodgeTo * (0.7 + Math.random() * 0.3);
      this.aiDodgeAt = -1;
      this.aiSwayAt = this.t + C.ai.swayEvery;
    } else if (this.t >= this.aiSwayAt) {
      this.twistTarget = (Math.random() * 2 - 1) * 0.8;
      this.aiSwayAt = this.t + C.ai.swayEvery * (0.6 + Math.random() * 0.8);
    }
  }

  /** 电脑奶家军：隔一会儿射一针，按你扭的速度预判针到的时候肚脐在哪（有一部分不预判），带误差 */
  private aiShoot() {
    if (this.t < this.aiFireAt || !this.canFire()) return;
    const err = () => (Math.random() * 2 - 1) * C.ai.aimError;
    const lead = Math.random() < C.ai.leadChance ? this.navelV * C.needleFlight : 0;
    const x = Math.max(-C.twist.max, Math.min(C.twist.max, this.navelX() + lead));
    this.fire(x + err(), err());
    this.aiFireAt = this.t + C.fireCooldown + Math.random() * C.ai.fireJitter;
  }
}
