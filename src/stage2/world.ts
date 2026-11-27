import { STAGE2 as C } from '../config/stage2';
import { STAGE2_TEXT as TX } from '../copy/stage2';
import { Actor, DIRS, Dir, DIR_LIST, ShelterShape, World } from '../stage1/world';

/**
 * 第二关「天雷已废废」的规则。复用第一关的网格、砖墙、庇护所闭合判断、举放物资，
 * 关掉狂风 / 灵泉 / 物资刷新，加上：天雷、阴暗奶鸡（下蛋、攻击）、伙伴小奶蛙、奶三角、奶蛋炸弹。
 * 和第一关一样不依赖 Phaser，玩家只用 setWantDir / face / act 操作。
 */

export type Role = 'player' | 'buddy' | 'darkFrog' | 'chicken';

export interface Creature {
  role: Role;
  /** 伙伴：已经和你手拉手 */
  joined: boolean;
  /** 你：被天雷劈中的次数 */
  hits: number;
  /** 被阴暗生物连续攻击了多久（秒），跑开或被撞开就清零 */
  attackT: number;
  /** 奶鸡：已经下了几颗蛋、上次下蛋时刻、是否被天雷劈过（劈过就不下蛋了） */
  laid: number;
  lastLay: number;
  thunderHit: boolean;
  /** 阴暗生物：下次思考的时刻、正在走的路径 */
  thinkAt: number;
  path: number[];
  /** 被奶三角撞过之后的冷却 */
  hitCdUntil: number;
  /** 奶三角里绕着你转时的实际位置（格，浮点），画面用 */
  orbitX: number;
  orbitY: number;
}

export interface Thunder {
  id: number;
  cx: number;
  cy: number;
  strikeAt: number;
}

export type Stage2Event =
  | { type: 'strike'; cx: number; cy: number }
  /** 抓手伸出去：grab = 把蛋抓回来，put = 把蛋放进庇护所 */
  | { type: 'claw'; kind: 'grab' | 'put'; cx: number; cy: number }
  | { type: 'explode'; cx: number; cy: number }
  | { type: 'thunderWave' }
  | { type: 'triangle' };

export type Outcome = { win: boolean; reason: string } | null;

export class Stage2World extends World {
  creatures = new Map<number, Creature>();
  thunders: Thunder[] = [];
  /** 被炸弹炸毁的格子：变成焦土，不能再放砖 */
  scorched = new Set<number>();
  /** 第二关特有的事件（天雷落下、爆炸等），画面层取走后清空 */
  events2: Stage2Event[] = [];
  outcome: Outcome = null;
  /** 奶三角的旋转角度 */
  spin = 0;

  private nextWave: number = C.thunder.firstAt;
  /** 抓手下次能用的时刻 */
  private grabReadyAt = 0;
  /** 下次补充伙伴的时刻 */
  private nextBuddy: number = C.buddies.respawnEvery;
  /** 放好庇护所、正式开始了吗（开始前只能走动，不计时、不落天雷） */
  started = false;
  private seq = 0;

  constructor() {
    super({ duration: C.duration, wind: false, spring: false, refresh: false });
  }

  get player() {
    return this.actors.find((a) => a.human)!;
  }

  role(a: Actor) {
    return this.creatures.get(a.id)!;
  }

  addCreature(role: Role, name: string, cx: number, cy: number, speed: number) {
    const a = this.addActor({ id: this.actors.length, name, human: role === 'player', cx, cy, speed });
    this.creatures.set(a.id, {
      role,
      joined: false,
      hits: 0,
      attackT: 0,
      laid: 0,
      lastLay: 0,
      thunderHit: false,
      thinkAt: 0,
      path: [],
      hitCdUntil: 0,
      orbitX: cx,
      orbitY: cy,
    });
    return a;
  }

  isDark(a: Actor) {
    const r = this.role(a).role;
    return r === 'chicken' || r === 'darkFrog';
  }

  alive(a: Actor) {
    return !a.gone;
  }

  joinedBuddies() {
    return this.actors.filter((a) => this.alive(a) && this.role(a).role === 'buddy' && this.role(a).joined);
  }

  /** 奶三角：你 + 2 只手拉手的伙伴 */
  get triangle() {
    return this.joinedBuddies().length >= 2;
  }

  darkLeft() {
    return this.actors.filter((a) => this.alive(a) && this.role(a).role === 'chicken').length;
  }

  // ───────── 开局：放置继承的庇护所 ─────────

  /** 放置阶段：只让角色走动，不计时、不跑第二关规则 */
  moveOnly(dt: number) {
    this.t += dt;
    for (const a of this.actors) this.updateActor(a, dt);
  }

  /** 庇护所都放好了：放出阴暗奶鸡和伙伴，时间从 0 开始算 */
  begin() {
    this.spawnCreatures();
    this.t = 0;
    for (const a of this.actors) {
      a.stepEndAt = -1;
      a.turnAt = -1;
      a.actionReadyAt = 0;
    }
    this.nextWave = C.thunder.firstAt;
    this.nextBuddy = C.buddies.respawnEvery;
    this.started = true;
  }

  /** 这个形状能不能放在 (ox, oy)（左上角）：全部在场内，墙格空着、不是焦土、没人站着 */
  canPlace(shape: ShelterShape, ox: number, oy: number) {
    for (const [dx, dy] of [...shape.walls, ...shape.inner]) {
      const x = ox + dx;
      const y = oy + dy;
      if (!this.inBounds(x, y)) return false;
      const i = this.idx(x, y);
      if (this.walls[i] !== -1 || this.items[i] || this.scorched.has(i)) return false;
    }
    for (const [dx, dy] of shape.walls) if (this.actorAt(ox + dx, oy + dy)) return false;
    return true;
  }

  place(shape: ShelterShape, ox: number, oy: number, owner: number) {
    for (const [dx, dy] of shape.walls) this.walls[this.idx(ox + dx, oy + dy)] = owner;
    this.wallsChanged();
    this.recomputeInteriors();
  }

  /** 放好庇护所后，在离你和庇护所远一点的地方放出阴暗奶鸡和伙伴小奶蛙 */
  spawnCreatures() {
    const p = this.player;
    const ok = (x: number, y: number) => {
      const i = this.idx(x, y);
      return this.free(x, y) && this.interior[i] === -1 && Math.hypot(x - p.cx, y - p.cy) >= 5;
    };
    for (let k = 0; k < C.chickens.count; k++) {
      const t = this.randomTile(ok);
      if (t) this.addCreature('chicken', TX.names.chicken, t.x, t.y, C.chickens.speed);
    }
    for (let k = 0; k < C.buddies.count; k++) {
      const t = this.randomTile((x, y) => ok(x, y) && Math.hypot(x - p.cx, y - p.cy) <= 12);
      if (t) this.addCreature('buddy', TX.names.buddy, t.x, t.y, C.buddies.wanderSpeed);
    }
  }

  // ───────── 玩家指令：手拉手 ─────────

  /** 身边有没有能手拉手的伙伴（上下左右或斜角相邻、还没加入） */
  private buddyNearby(a: Actor) {
    if (this.joinedBuddies().length >= 2) return null;
    return (
      this.actors.find(
        (b) => this.alive(b) && !this.isBusy(b) && this.role(b).role === 'buddy' && !this.role(b).joined && Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cy - a.cy)) <= 1,
      ) ?? null
    );
  }

  actionLabel(a: Actor): string {
    if (!a.carry && !this.items[this.idx(a.cx, a.cy)] && this.buddyNearby(a)) return TX.action.holdHands;
    return super.actionLabel(a);
  }

  act(a: Actor) {
    const b = !a.carry && !this.items[this.idx(a.cx, a.cy)] ? this.buddyNearby(a) : null;
    if (b) {
      const r = this.role(b);
      r.joined = true;
      r.path = [];
      b.speed = C.buddies.followSpeed;
      if (this.triangle) {
        this.events.push({ type: 'toast', text: TX.toast.triangle, actor: a.id });
        this.events2.push({ type: 'triangle' });
      } else {
        this.events.push({ type: 'toast', text: TX.toast.joined, actor: a.id });
      }
      return true;
    }
    return super.act(a);
  }

  /** 伙伴手拉手后能穿过你的墙，进出你的庇护所 */
  passable(a: Actor, x: number, y: number) {
    if (super.passable(a, x, y)) return true;
    const c = this.creatures.get(a.id);
    if (!c || c.role !== 'buddy' || !c.joined || !this.inBounds(x, y)) return false;
    return this.walls[this.idx(x, y)] === this.player.id;
  }

  // ───────── 每帧 ─────────

  protected step(dt: number) {
    if (this.outcome || !this.started) return;
    this.layEggs();
    this.reinforceBuddies();
    this.updateThunder();
    this.moveCreatures(dt);
    this.updateTriangle(dt);
    this.updateAttacks(dt);
    this.updateEggs();
    this.checkOutcome();
  }

  update(dt: number) {
    super.update(dt);
    if (this.ended && !this.outcome && !this.player.gone) this.outcome = { win: true, reason: TX.result.survived };
  }

  private checkOutcome() {
    const p = this.player;
    const r = this.role(p);
    if (p.gone) this.lose(TX.result.blownAway);
    else if (r.hits >= C.thunder.hitsToDie) this.lose(TX.result.thunder);
    else if (r.attackT >= C.dark.frogDie) this.lose(TX.result.attacked);
    else if (this.darkLeft() === 0 && this.actors.some((a) => this.role(a).role === 'chicken')) this.win(TX.result.cleared);
  }

  private lose(reason: string) {
    this.outcome = { win: false, reason };
    this.ended = true;
  }

  private win(reason: string) {
    this.outcome = { win: true, reason };
    this.ended = true;
  }

  // ───────── 抓手 ─────────

  private inGrabRange(a: Actor, i: number) {
    const x = i % this.cols;
    const y = (i / this.cols) | 0;
    return Math.hypot(x - a.cx, y - a.cy) <= C.grab.range;
  }

  /** 这一格的蛋能不能用抓手抓回来：空手、在范围内、冷却好了 */
  canGrab(a: Actor, i: number) {
    // 已经放进自己庇护所的蛋不再标出来（否则会被反复抓出来）
    return this.started && !a.carry && !this.isBusy(a) && this.items[i]?.kind === 'egg' && this.interior[i] !== a.id && this.inGrabRange(a, i) && this.t >= this.grabReadyAt;
  }

  /** 抓着健康的蛋时，这一格能不能放：自己闭合庇护所里的空格、在范围内、冷却好了 */
  canPut(a: Actor, i: number) {
    const egg = a.carry;
    if (!this.started || egg?.kind !== 'egg' || this.isBusy(a) || this.t < this.grabReadyAt) return false;
    return !this.items[i] && this.walls[i] === -1 && this.interior[i] === a.id && this.inGrabRange(a, i) && !this.actorAt(i % this.cols, (i / this.cols) | 0);
  }

  /** 点击场地上的一格：能抓就抓，能放就放；返回是否执行了（没执行时画面照常把这次点击当摇杆） */
  clawAt(a: Actor, i: number) {
    if (this.canGrab(a, i)) {
      a.carry = this.items[i];
      this.items[i] = null;
      this.grabReadyAt = this.t + C.grab.cooldown;
      this.events2.push({ type: 'claw', kind: 'grab', cx: i % this.cols, cy: (i / this.cols) | 0 });
      return true;
    }
    if (a.carry?.kind === 'egg' && (a.carry.infectedAt ?? -1) >= 0 && this.interior[i] === a.id) {
      this.events.push({ type: 'hint', text: TX.toast.infectedNoPut, actor: a.id });
      return true;
    }
    if (this.canPut(a, i)) {
      this.items[i] = a.carry;
      a.carry = null;
      this.grabReadyAt = this.t + C.grab.cooldown;
      this.events2.push({ type: 'claw', kind: 'put', cx: i % this.cols, cy: (i / this.cols) | 0 });
      return true;
    }
    if (this.items[i]?.kind === 'egg' && !this.inGrabRange(a, i)) {
      this.events.push({ type: 'hint', text: TX.toast.tooFar, actor: a.id });
      return true;
    }
    return false;
  }

  /** 瞄准用：现在能抓的蛋 / 能放的格子 */
  clawTargets(a: Actor): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.items.length; i++) if (this.canGrab(a, i) || this.canPut(a, i)) out.push(i);
    return out;
  }

  // ───────── 补充伙伴 ─────────

  /** 场上没加入的伙伴太少时，定时从场边走进来一只新的（避免最后只剩你一只） */
  private reinforceBuddies() {
    if (this.t < this.nextBuddy) return;
    this.nextBuddy = this.t + C.buddies.respawnEvery;
    const buddies = this.actors.filter((a) => !a.gone && this.role(a).role === 'buddy');
    const free = buddies.filter((a) => !this.role(a).joined).length;
    if (free >= C.buddies.minFree || buddies.length >= C.buddies.maxAlive) return;
    const edge = (x: number, y: number) => (x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1) && this.free(x, y) && this.interior[this.idx(x, y)] === -1;
    const n = Math.min(free <= 1 ? 2 : 1, C.buddies.maxAlive - buddies.length);
    for (let k = 0; k < n; k++) {
      const t = this.randomTile(edge);
      if (t) this.addCreature('buddy', TX.names.buddy, t.x, t.y, C.buddies.wanderSpeed);
    }
    this.events.push({ type: 'toast', text: TX.toast.buddyArrived });
  }

  // ───────── 奶鸡下蛋 ─────────

  private layEggs() {
    if (this.t > C.chickens.layUntil + 0.01) return;
    for (const a of this.actors) {
      const r = this.role(a);
      if (r.role !== 'chicken' || a.gone || r.thunderHit) continue;
      if (this.t - r.lastLay < C.chickens.layEvery) continue;
      r.lastLay = this.t;
      // 下在脚下，脚下有东西就下在旁边
      const spots = [[0, 0], ...Object.values(DIRS)].map(([dx, dy]) => ({ x: a.cx + dx, y: a.cy + dy }));
      const s = spots.find((p) => this.inBounds(p.x, p.y) && !this.items[this.idx(p.x, p.y)] && this.walls[this.idx(p.x, p.y)] === -1);
      if (!s) continue;
      this.items[this.idx(s.x, s.y)] = { kind: 'egg', fill: 'empty', infectedAt: -1, attackT: 0 };
      r.laid++;
      this.events.push({ type: 'float', x: s.x, y: s.y, text: TX.toast.laid, color: '#fff6c8' });
    }
  }

  // ───────── 天雷 ─────────

  private updateThunder() {
    const T = C.thunder;
    if (this.t >= this.nextWave) {
      this.nextWave += T.interval;
      const p = this.player;
      for (let k = 0; k < T.perWave; k++) {
        let tile: { x: number; y: number } | null;
        if (Math.random() < T.aimedChance) {
          const x = Math.max(0, Math.min(this.cols - 1, p.cx + Math.round((Math.random() - 0.5) * 6)));
          const y = Math.max(0, Math.min(this.rows - 1, p.cy + Math.round((Math.random() - 0.5) * 6)));
          tile = { x, y };
        } else {
          tile = this.randomTile(() => true);
        }
        if (tile) this.thunders.push({ id: this.seq++, cx: tile.x, cy: tile.y, strikeAt: this.t + T.warnTime });
      }
      this.events2.push({ type: 'thunderWave' });
      this.events.push({ type: 'toast', text: TX.toast.thunderComing });
    }
    const due = this.thunders.filter((th) => this.t >= th.strikeAt);
    this.thunders = this.thunders.filter((th) => this.t < th.strikeAt);
    for (const th of due) this.strike(th);
  }

  /** 天雷落下：落点周围一圈（3×3）内，不在闭合庇护所里的都会被劈中 */
  private strike(th: Thunder) {
    this.events2.push({ type: 'strike', cx: th.cx, cy: th.cy });
    const R = C.thunder.radius;
    const inArea = (x: number, y: number) => Math.abs(x - th.cx) <= R && Math.abs(y - th.cy) <= R && this.inBounds(x, y) && this.interior[this.idx(x, y)] === -1;
    for (const a of this.actors) {
      if (a.gone || this.isBusy(a) || !inArea(a.cx, a.cy)) continue;
      const r = this.role(a);
      if (r.role === 'player') {
        r.hits++;
        this.events.push({ type: 'toast', text: TX.toast.youHit(r.hits, C.thunder.hitsToDie), actor: a.id });
      } else if (r.role === 'buddy') {
        // 伙伴被劈中：感染成阴暗小奶蛙，离开奶三角
        r.role = 'darkFrog';
        r.joined = false;
        a.speed = C.dark.frogSpeed;
        a.name = TX.names.darkFrog;
        this.events.push({ type: 'toast', text: TX.toast.buddyInfected });
      } else if (r.role === 'chicken' && !r.thunderHit) {
        r.thunderHit = true;
      }
    }
    for (let y = th.cy - R; y <= th.cy + R; y++)
      for (let x = th.cx - R; x <= th.cx + R; x++) {
        if (!inArea(x, y)) continue;
        const it = this.items[this.idx(x, y)];
        if (it?.kind === 'egg' && (it.infectedAt ?? -1) < 0) this.infectEgg(it, x, y);
      }
  }

  // ───────── 生物移动 ─────────

  private moveCreatures(_dt: number) {
    const p = this.player;
    for (const a of this.actors) {
      if (a.human || a.gone || this.isBusy(a)) continue;
      const r = this.role(a);
      if (r.role === 'buddy' && r.joined) {
        if (this.triangle) {
          a.wantDir = null;
          continue;
        }
        // 只有 1 只伙伴：跟在你身后
        this.followTo(a, r, p.cx, p.cy, 1);
        continue;
      }
      if (r.role === 'buddy') {
        // 还没加入的伙伴：慢慢闲逛
        if (this.t >= r.thinkAt) {
          r.thinkAt = this.t + 1 + Math.random() * 2;
          a.wantDir = Math.random() < 0.6 ? DIR_LIST[(Math.random() * 4) | 0] : null;
        }
        continue;
      }
      // 阴暗生物：追最近的、没被感染的目标（你、伙伴、地上的奶蛋）
      if (this.t >= r.thinkAt) {
        r.thinkAt = this.t + C.dark.thinkInterval;
        const target = this.nearestPrey(a);
        r.path = target ? this.pathTo(a, target.x, target.y) : [];
        if (!target && Math.random() < 0.5) r.path = [];
        if (!target) a.wantDir = Math.random() < 0.5 ? DIR_LIST[(Math.random() * 4) | 0] : null;
      }
      if (r.path.length) this.walkPath(a, r);
    }
  }

  /** 阴暗生物的猎物：不在庇护所里的你、伙伴、地上的健康奶蛋 */
  private preyList() {
    const out: { x: number; y: number }[] = [];
    for (const b of this.actors) {
      if (b.gone || this.isBusy(b)) continue;
      const rr = this.role(b).role;
      if ((rr === 'player' || rr === 'buddy') && this.interior[this.idx(b.cx, b.cy)] === -1) out.push({ x: b.cx, y: b.cy });
    }
    this.items.forEach((it, i) => {
      if (it?.kind === 'egg' && (it.infectedAt ?? -1) < 0 && this.interior[i] === -1) out.push({ x: i % this.cols, y: (i / this.cols) | 0 });
    });
    return out;
  }

  private nearestPrey(a: Actor) {
    let best: { x: number; y: number } | null = null;
    let bd: number = C.dark.chaseRange;
    for (const p of this.preyList()) {
      const d = Math.hypot(p.x - a.cx, p.y - a.cy);
      if (d < bd) (bd = d), (best = p);
    }
    return best;
  }

  private followTo(a: Actor, r: Creature, tx: number, ty: number, keep: number) {
    if (Math.max(Math.abs(a.cx - tx), Math.abs(a.cy - ty)) <= keep) {
      a.wantDir = null;
      r.path = [];
      return;
    }
    if (this.t >= r.thinkAt || !r.path.length) {
      r.thinkAt = this.t + 0.3;
      r.path = this.pathTo(a, tx, ty);
    }
    this.walkPath(a, r);
  }

  private walkPath(a: Actor, r: Creature) {
    const here = this.idx(a.cx, a.cy);
    while (r.path.length && r.path[0] === here) r.path.shift();
    const next = r.path[0];
    if (next === undefined) return (a.wantDir = null);
    const nx = next % this.cols;
    const ny = (next / this.cols) | 0;
    a.wantDir = DIR_LIST.find((d) => a.cx + DIRS[d][0] === nx && a.cy + DIRS[d][1] === ny) ?? null;
  }

  /** 网格寻路（BFS），走到目标旁边为止 */
  private pathTo(a: Actor, tx: number, ty: number) {
    const n = this.cols * this.rows;
    const prev = new Int32Array(n).fill(-2);
    const start = this.idx(a.cx, a.cy);
    prev[start] = -1;
    const q = [start];
    let found = -1;
    for (let h = 0; h < q.length && h < 600; h++) {
      const i = q[h];
      const x = i % this.cols;
      const y = (i / this.cols) | 0;
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1) {
        found = i;
        break;
      }
      for (const [dx, dy] of Object.values(DIRS)) {
        if (!this.passable(a, x + dx, y + dy)) continue;
        const j = this.idx(x + dx, y + dy);
        if (prev[j] !== -2) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    if (found < 0) return [];
    const path: number[] = [];
    for (let i = found; i !== -1; i = prev[i]) path.unshift(i);
    return path;
  }

  // ───────── 奶三角 ─────────

  private updateTriangle(dt: number) {
    const buddies = this.joinedBuddies();
    if (buddies.length < 2) return;
    const p = this.player;
    this.spin += dt * C.triangle.spin;
    // 两只伙伴和你组成三角，绕着你转
    buddies.slice(0, 2).forEach((b, k) => {
      const ang = this.spin + (k + 1) * ((Math.PI * 2) / 3);
      const r = this.role(b);
      r.orbitX = p.cx + Math.cos(ang) * C.triangle.radius;
      r.orbitY = p.cy + Math.sin(ang) * C.triangle.radius;
      const tx = Math.max(0, Math.min(this.cols - 1, Math.round(r.orbitX)));
      const ty = Math.max(0, Math.min(this.rows - 1, Math.round(r.orbitY)));
      b.fx = b.cx = tx;
      b.fy = b.cy = ty;
      b.moveT = 1;
    });
    // 撞飞靠近的阴暗生物：小奶蛙 4 格，奶鸡只飞一半
    for (const d of this.actors) {
      if (d.gone || this.isBusy(d) || !this.isDark(d)) continue;
      const r = this.role(d);
      if (this.t < r.hitCdUntil) continue;
      const dist = Math.hypot(d.cx - p.cx, d.cy - p.cy);
      if (dist > C.triangle.hitRange) continue;
      r.hitCdUntil = this.t + C.triangle.hitCooldown;
      const push = r.role === 'chicken' ? C.triangle.pushChicken : C.triangle.pushFrog;
      const gone = this.knock(d, d.cx - p.cx, d.cy - p.cy, push);
      if (gone && r.role === 'chicken') this.events.push({ type: 'toast', text: TX.toast.chickenOut(this.darkLeft()) });
    }
  }

  /** 把一个角色沿 (dx, dy) 方向撞飞 dist 格；撞墙停下；飞出场外就出局（返回 true） */
  private knock(a: Actor, dx: number, dy: number, dist: number) {
    let len = Math.hypot(dx, dy);
    if (len < 0.01) ((dx = Math.random() - 0.5), (dy = Math.random() - 0.5), (len = Math.hypot(dx, dy)));
    const ux = dx / len;
    const uy = dy / len;
    a.fx = a.cx;
    a.fy = a.cy;
    let cx = a.cx;
    let cy = a.cy;
    let out = false;
    for (let s = 1; s <= dist; s++) {
      const x = Math.round(a.fx + ux * s);
      const y = Math.round(a.fy + uy * s);
      if (!this.inBounds(x, y)) {
        out = true;
        break;
      }
      if (!this.passable(a, x, y)) break;
      cx = x;
      cy = y;
    }
    a.wantDir = null;
    a.moveT = 1;
    a.flyUntil = this.t + 0.4;
    this.role(a).attackT = 0;
    this.role(a).path = [];
    if (out) {
      a.gone = true;
      a.carry = null;
      a.outUntil = Infinity;
      return true;
    }
    a.cx = cx;
    a.cy = cy;
    return false;
  }

  // ───────── 阴暗生物的攻击 ─────────

  private updateAttacks(dt: number) {
    const darks = this.actors.filter((d) => !d.gone && !this.isBusy(d) && this.isDark(d));
    const near = (x: number, y: number) => darks.some((d) => Math.hypot(d.cx - x, d.cy - y) <= C.dark.attackRange);
    // 你和伙伴：连续被攻击 5 秒夭折；跑开或被撞开（离开攻击范围）就重新计时；躲在闭合庇护所里不会被攻击
    for (const a of this.actors) {
      if (a.gone) continue;
      const r = this.role(a);
      if (r.role !== 'player' && r.role !== 'buddy') continue;
      const safe = this.interior[this.idx(a.cx, a.cy)] !== -1;
      if (!safe && !this.isBusy(a) && near(a.cx, a.cy)) {
        r.attackT += dt;
        if (r.role === 'buddy' && r.attackT >= C.dark.frogDie) {
          a.gone = true;
          a.outUntil = Infinity;
          this.events.push({ type: 'toast', text: TX.toast.buddyDied });
        }
      } else {
        r.attackT = 0;
      }
    }
    // 地上的奶蛋：连续被攻击 2 秒感染
    this.items.forEach((it, i) => {
      if (it?.kind !== 'egg' || (it.infectedAt ?? -1) >= 0) return;
      const x = i % this.cols;
      const y = (i / this.cols) | 0;
      if (this.interior[i] === -1 && near(x, y)) {
        it.attackT = (it.attackT ?? 0) + dt;
        if (it.attackT >= C.dark.eggInfect) this.infectEgg(it, x, y);
      } else {
        it.attackT = 0;
      }
    });
  }

  // ───────── 奶蛋炸弹 ─────────

  private infectEgg(it: { infectedAt?: number }, x: number, y: number) {
    it.infectedAt = this.t;
    this.events.push({ type: 'float', x, y, text: TX.toast.eggInfected, color: '#d6a2ff' });
  }

  private updateEggs() {
    // 地上的，以及被人举着的奶蛋都会按时爆炸
    const bombs: { x: number; y: number; clear: () => void }[] = [];
    this.items.forEach((it, i) => {
      if (it?.kind === 'egg' && (it.infectedAt ?? -1) >= 0 && this.t >= it.infectedAt! + C.egg.bombAfter) {
        bombs.push({ x: i % this.cols, y: (i / this.cols) | 0, clear: () => (this.items[i] = null) });
      }
    });
    for (const a of this.actors) {
      const it = a.carry;
      if (it?.kind === 'egg' && (it.infectedAt ?? -1) >= 0 && this.t >= it.infectedAt! + C.egg.bombAfter) {
        bombs.push({ x: a.cx, y: a.cy, clear: () => (a.carry = null) });
      }
    }
    for (const b of bombs) {
      b.clear();
      this.explode(b.x, b.y);
    }
  }

  /** 爆炸：范围内的人物被炸飞，砖墙被炸毁变焦土（不能再放砖），其他奶蛋也被炸没 */
  private explode(cx: number, cy: number) {
    const R = C.egg.blastRadius;
    this.events2.push({ type: 'explode', cx, cy });
    this.events.push({ type: 'toast', text: TX.toast.bomb });
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        if (!this.inBounds(x, y) || Math.hypot(x - cx, y - cy) > R) continue;
        const i = this.idx(x, y);
        if (this.walls[i] !== -1) {
          this.walls[i] = -1;
          this.scorched.add(i);
          this.wallsChanged();
        }
        if (this.items[i]?.kind === 'egg') this.items[i] = null;
      }
    for (const a of this.actors) {
      if (a.gone || this.isBusy(a)) continue;
      if (Math.hypot(a.cx - cx, a.cy - cy) > R) continue;
      const out = this.knock(a, a.cx - cx, a.cy - cy, C.egg.blastPush);
      if (out && a.human) this.lose(TX.result.blownAway);
    }
  }

  /** 救下的奶蛋：在你闭合庇护所里的健康奶蛋 */
  savedEggs() {
    let n = 0;
    this.items.forEach((it, i) => {
      if (it?.kind === 'egg' && (it.infectedAt ?? -1) < 0 && this.interior[i] === this.player.id) n++;
    });
    return n;
  }
}

export type { Dir };
