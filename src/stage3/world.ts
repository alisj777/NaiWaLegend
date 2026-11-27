import { STAGE3 as C } from '../config/stage3';
import { STAGE3_TEXT as TX } from '../copy/stage3';
import { Actor, DIRS, DIR_LIST, Dir, World } from '../stage1/world';

/**
 * 第三章「分化」的规则。复用第一关的网格和走路，关掉狂风 / 灵泉 / 物资刷新，加上：
 *   分阵营（奶家队 5 : 暗派 3，两边都有攻击 / 奶 / 辅助）、五种角色、血量、倒下与复活、金币、胜负。
 * 第 1 步只做了奶蛙的踢；其他角色的技能、天雷黑化、庇护所育儿、成就在后面几步加。
 * 和前两关一样不依赖 Phaser，玩家只用 setWantDir / act 操作。
 */

export type RoleId = 'frog' | 'chicken' | 'dog' | 'powder' | 'mouse';
export type Team = 'good' | 'dark';
export type RoleClass = keyof typeof C.classes;
export const ROLE_IDS: RoleId[] = ['frog', 'chicken', 'dog', 'powder', 'mouse'];

export function classOf(r: RoleId): RoleClass {
  return (Object.keys(C.classes) as RoleClass[]).find((k) => (C.classes[k] as readonly string[]).includes(r))!;
}

const pick = <T>(arr: readonly T[]) => arr[(Math.random() * arr.length) | 0];

/**
 * 凑一队：先放 fixed 里的角色（你选的），再给还缺的分类（攻击 / 奶 / 辅助）各补一个，剩下的位置随机。
 * 暗派 3 人时正好一类一个。
 */
export function buildTeam(size: number, fixed: RoleId[] = []): RoleId[] {
  const team = [...fixed];
  for (const cls of Object.keys(C.classes) as RoleClass[]) {
    if (team.length >= size) break;
    if (!team.some((r) => classOf(r) === cls)) team.push(pick(C.classes[cls] as readonly RoleId[]));
  }
  while (team.length < size) team.push(pick(ROLE_IDS));
  return team;
}

/** 随机分阵营：按人数比例（5/8 在奶家队） */
export function randomTeam(): Team {
  return Math.random() < C.teams.good / (C.teams.good + C.teams.dark) ? 'good' : 'dark';
}

export interface Fighter {
  role: RoleId;
  team: Team;
  hp: number;
  maxHp: number;
  /** 技能下次能用的时刻 */
  readyAt: number;
  /** 奶蛙：踢腿动作显示到这个时刻 */
  kickUntil: number;
  /** 倒下了：到这个时刻在自家复活；0 = 没倒下 */
  downUntil: number;
  /** 眩晕到这个时刻（奶粉的技能，第 2 步） */
  stunUntil: number;
  /** 被天雷劈中的次数（第 3 步） */
  hits: number;
  /** 电脑：下次思考的时刻、正在走的路径 */
  thinkAt: number;
  path: number[];
  /** 电脑：闲逛的目标点 */
  roam: { x: number; y: number } | null;
}

export type Stage3Event =
  | { type: 'kick'; id: number; hit: boolean }
  | { type: 'hurt'; id: number; dmg: number }
  | { type: 'down'; id: number; by: number }
  | { type: 'respawn'; id: number };

export type Outcome = { winner: Team; reason: string } | null;

export class Stage3World extends World {
  fighters = new Map<number, Fighter>();
  gold: Record<Team, number> = { good: C.startGold, dark: C.startGold };
  events3: Stage3Event[] = [];
  outcome: Outcome = null;
  /** 你这一轮有没有伤到过奶家队的人（判断"超能串子"用） */
  playerHurtGood = false;

  constructor() {
    super({ duration: C.duration, wind: false, spring: false, refresh: false });
  }

  get player() {
    return this.actors.find((a) => a.human)!;
  }
  f(a: Actor) {
    return this.fighters.get(a.id)!;
  }

  /** 两队出生的区域：奶家队在左边，暗派在右边 */
  homeX(team: Team) {
    return team === 'good' ? 3 : this.cols - 4;
  }

  /** 摆好两队：你在 playerTeam、角色 playerRole，其余是电脑 */
  setup(playerTeam: Team, playerRole: RoleId) {
    const teams: Record<Team, RoleId[]> = {
      good: buildTeam(C.teams.good, playerTeam === 'good' ? [playerRole] : []),
      dark: buildTeam(C.teams.dark, playerTeam === 'dark' ? [playerRole] : []),
    };
    for (const team of ['good', 'dark'] as Team[]) {
      const roles = teams[team];
      roles.forEach((role, k) => {
        const human = team === playerTeam && k === 0;
        const y = Math.round(((k + 1) * this.rows) / (roles.length + 1));
        const x = this.homeX(team) + (k % 2 ? (team === 'good' ? 1 : -1) : 0);
        const name = human ? TX.names.player : `${team === 'dark' ? TX.names.darkPrefix : ''}${TX.roles[role].name}`;
        const a = this.addActor({ id: this.actors.length, name, human, cx: x, cy: y, speed: C.roles[role].speed * (human ? 1 : C.ai.speed) });
        a.facing = team === 'good' ? 'right' : 'left';
        const hp = C.roles[role].hp;
        this.fighters.set(a.id, { role, team, hp, maxHp: hp, readyAt: 0, kickUntil: 0, downUntil: 0, stunUntil: 0, hits: 0, thinkAt: Math.random() * 0.5, path: [], roam: null });
      });
    }
  }

  isDown(a: Actor) {
    return this.f(a).downUntil > 0;
  }
  isStunned(a: Actor) {
    return this.t < this.f(a).stunUntil;
  }
  /** 场上还站着的人 */
  standing(team?: Team) {
    return this.actors.filter((a) => !this.isDown(a) && (!team || this.f(a).team === team));
  }
  enemies(a: Actor) {
    const team = this.f(a).team;
    return this.actors.filter((b) => b !== a && !this.isDown(b) && this.f(b).team !== team);
  }

  // ───────── 操作 ─────────

  actionLabel(a: Actor): string {
    const r = this.f(a).role;
    return r === 'frog' ? TX.action.kick : TX.action.soon;
  }

  act(a: Actor) {
    if (this.isDown(a) || this.isStunned(a) || this.isBusy(a)) return false;
    const f = this.f(a);
    if (f.role === 'frog') return this.kick(a), true;
    if (a.human) this.events.push({ type: 'hint', text: TX.toast.skillSoon, actor: a.id });
    return false;
  }

  /** 奶蛙踢人：身边一格内（含斜角）最近的敌人，没人也会踢空 */
  private kick(a: Actor) {
    const f = this.f(a);
    const K = C.roles.frog.kick;
    if (this.t < f.readyAt) return;
    f.readyAt = this.t + K.cooldown;
    f.kickUntil = this.t + 0.3;
    const near = this.enemies(a)
      .filter((b) => Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cy - a.cy)) <= K.range)
      .sort((p, q) => this.facingBias(a, p) - this.facingBias(a, q));
    const target = near[0];
    if (!target) return this.events3.push({ type: 'kick', id: a.id, hit: false });
    const dx = target.cx - a.cx;
    const dy = target.cy - a.cy;
    // 转向被踢的人（斜角时按横向转）
    if (dx || dy) a.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.events3.push({ type: 'kick', id: a.id, hit: true });
    this.push(target, dx, dy, K.push);
    this.damage(target, K.damage, a);
  }

  /** 选踢谁：正前方的优先 */
  private facingBias(a: Actor, b: Actor) {
    const [fx, fy] = DIRS[a.facing];
    return (b.cx - a.cx === fx && b.cy - a.cy === fy ? 0 : 1) + Math.hypot(b.cx - a.cx, b.cy - a.cy) * 0.1;
  }

  /** 把人往 (dx, dy) 方向推 n 格；碰到墙或场地边就停（第三章不会被推出场外） */
  private push(b: Actor, dx: number, dy: number, n: number) {
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    if (!sx && !sy) return;
    let x = b.cx;
    let y = b.cy;
    for (let s = 0; s < n; s++) {
      if (!this.passable(b, x + sx, y + sy)) break;
      x += sx;
      y += sy;
    }
    b.fx = b.cx;
    b.fy = b.cy;
    b.cx = x;
    b.cy = y;
    b.moveT = 0;
    b.wantDir = null;
    this.f(b).path = [];
  }

  damage(b: Actor, dmg: number, by: Actor | null) {
    const f = this.f(b);
    if (f.downUntil) return;
    if (by?.human && f.team === 'good' && this.f(by).team === 'dark') this.playerHurtGood = true;
    f.hp = Math.max(0, f.hp - dmg);
    this.events3.push({ type: 'hurt', id: b.id, dmg });
    if (f.hp > 0) return;
    // 倒下：一段时间后在自家复活；打倒的一方得金币
    f.downUntil = this.t + C.respawn;
    b.outUntil = f.downUntil;
    b.wantDir = null;
    b.carry = null;
    if (by) this.gold[this.f(by).team] += C.killGold;
    this.events3.push({ type: 'down', id: b.id, by: by?.id ?? -1 });
  }

  // ───────── 主循环 ─────────

  protected updateActor(a: Actor, dt: number) {
    const f = this.f(a);
    if (f.downUntil) {
      if (this.t < f.downUntil) return;
      this.respawn(a);
    }
    if (this.isStunned(a)) return;
    super.updateActor(a, dt);
  }

  private respawn(a: Actor) {
    const f = this.f(a);
    const hx = this.homeX(f.team);
    const p = this.randomTile((x, y) => Math.abs(x - hx) <= 1 && this.passable(a, x, y) && !this.actorAt(x, y)) ?? { x: hx, y: (this.rows / 2) | 0 };
    f.downUntil = 0;
    f.hp = f.maxHp;
    f.path = [];
    a.outUntil = 0;
    a.cx = a.fx = p.x;
    a.cy = a.fy = p.y;
    a.moveT = 1;
    this.events3.push({ type: 'respawn', id: a.id });
  }

  protected step(_dt: number) {
    for (const a of this.actors) if (!a.human) this.think(a);
    this.checkOutcome();
  }

  update(dt: number) {
    if (this.outcome) return;
    super.update(dt);
  }

  private checkOutcome() {
    if (this.outcome) return;
    // 一方全部同时倒下：另一方提前获胜
    for (const team of C.wipeWin ? (['good', 'dark'] as Team[]) : []) {
      if (!this.standing(team).length) {
        const other: Team = team === 'good' ? 'dark' : 'good';
        this.outcome = { winner: other, reason: TX.result.wiped(TX.teams[team]) };
        return;
      }
    }
    if (this.t >= C.duration) {
      // 时间到：金币多的赢；一样多算奶家队守住了 【补充】
      const winner: Team = this.gold.dark > this.gold.good ? 'dark' : 'good';
      this.outcome = { winner, reason: TX.result.byGold(this.gold.good, this.gold.dark) };
    }
  }

  // ───────── 电脑 ─────────

  /**
   * 第 1 步的电脑：
   *   奶蛙：追最近的敌人，贴身就踢
   *   其他：跟在自己队的奶蛙附近；敌方奶蛙靠近就跑开；没有奶蛙时在自家半场闲逛
   */
  private think(a: Actor) {
    const f = this.f(a);
    if (f.downUntil || this.isStunned(a) || this.isBusy(a)) return;
    if (this.t < f.thinkAt && f.path.length) return this.walkPath(a, f);
    f.thinkAt = this.t + C.ai.think;
    const foes = this.enemies(a);
    const dist = (b: Actor) => Math.hypot(b.cx - a.cx, b.cy - a.cy);

    if (f.role === 'frog') {
      const target = foes.sort((p, q) => dist(p) - dist(q))[0];
      if (!target) return this.roam(a, f);
      if (Math.max(Math.abs(target.cx - a.cx), Math.abs(target.cy - a.cy)) <= C.roles.frog.kick.range) {
        a.wantDir = null;
        f.path = [];
        if (this.t >= f.readyAt) this.kick(a);
        return;
      }
      if (dist(target) > C.ai.chase) return this.roam(a, f);
      f.path = this.pathTo(a, target.cx, target.cy);
      return this.walkPath(a, f);
    }

    const threat = foes.filter((b) => this.f(b).role === 'frog' && dist(b) <= C.ai.flee).sort((p, q) => dist(p) - dist(q))[0];
    if (threat) return this.flee(a, threat);
    const leader = this.actors.find((b) => b !== a && !this.isDown(b) && this.f(b).team === f.team && this.f(b).role === 'frog');
    if (leader) {
      if (Math.max(Math.abs(leader.cx - a.cx), Math.abs(leader.cy - a.cy)) <= 2) return (a.wantDir = null), void (f.path = []);
      f.path = this.pathTo(a, leader.cx, leader.cy);
      return this.walkPath(a, f);
    }
    this.roam(a, f);
  }

  /** 在自家半场闲逛 */
  private roam(a: Actor, f: Fighter) {
    if (!f.roam || (a.cx === f.roam.x && a.cy === f.roam.y) || Math.random() < 0.05) {
      const half = this.cols / 2;
      f.roam = this.randomTile((x, y) => (f.team === 'good' ? x < half : x >= half) && this.passable(a, x, y));
    }
    if (!f.roam) return (a.wantDir = null);
    f.path = this.pathTo(a, f.roam.x, f.roam.y);
    this.walkPath(a, f);
  }

  /** 往离威胁更远的方向走一格 */
  private flee(a: Actor, from: Actor) {
    const f = this.f(a);
    f.path = [];
    let best: Dir | null = null;
    let bestD = Math.hypot(a.cx - from.cx, a.cy - from.cy);
    for (const d of DIR_LIST) {
      const [dx, dy] = DIRS[d];
      if (!this.passable(a, a.cx + dx, a.cy + dy)) continue;
      const nd = Math.hypot(a.cx + dx - from.cx, a.cy + dy - from.cy);
      if (nd > bestD) (bestD = nd), (best = d);
    }
    a.wantDir = best;
  }

  private walkPath(a: Actor, f: Fighter) {
    const here = this.idx(a.cx, a.cy);
    while (f.path.length && f.path[0] === here) f.path.shift();
    const next = f.path[0];
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
}
