import { STAGE3 as C } from '../config/stage3';
import { STAGE3_TEXT as TX } from '../copy/stage3';
import { Actor, DIRS, DIR_LIST, Dir, ShelterShape, World } from '../stage1/world';

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
 * 暗派 3 人时正好一类一个。每队最多 C.maxPerTeam 里规定的数量（奶粉只能有 1 个）。
 */
export function buildTeam(size: number, fixed: RoleId[] = []): RoleId[] {
  const team = [...fixed];
  const allowed = (r: RoleId) => team.filter((x) => x === r).length < (C.maxPerTeam[r as keyof typeof C.maxPerTeam] ?? Infinity);
  for (const cls of Object.keys(C.classes) as RoleClass[]) {
    if (team.length >= size) break;
    if (!team.some((r) => classOf(r) === cls)) team.push(pick((C.classes[cls] as readonly RoleId[]).filter(allowed)));
  }
  while (team.length < size) team.push(pick(ROLE_IDS.filter(allowed)));
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
  /** 奶鼠：偷金币的冷却（偷奶仆用 readyAt） */
  goldReadyAt: number;
  /** 奶鼠：正在啃的砖（格子编号）和啃完的时刻 */
  gnaw: { i: number; until: number } | null;
}

/** 奶仆：奶家队的奶鸡下的蛋，跟着己方奶蛙（主人），给主人补血；不受保护被攻击会感染，然后爆炸 */
export interface Servant {
  id: number;
  team: Team;
  /** 位置（格，浮点，平滑跟随） */
  x: number;
  y: number;
  /** 被攻击了多久；离主人够近就清零 */
  attackT: number;
  /** 感染的时刻，-1 = 没感染 */
  infectedAt: number;
  /** 下次补血的时刻 */
  healAt: number;
  /** 被天雷劈中的次数 */
  hits: number;
  /** 放进庇护所了：存放的格子编号，-1 = 在外面跟着主人 */
  storedAt: number;
  /** 成长阶段：0 奶蛋 → 1 小奶蛙 → 2 奶蛙（替身）。只在庇护所里长 */
  stage: 0 | 1 | 2;
  /** 想喝奶（喝到才开始长） */
  thirsty: boolean;
  /** 长到下一阶段的时刻，-1 = 没在长 */
  growAt: number;
  /** 下次试着喝奶的时刻；没奶喝时只提示一次 */
  drinkTryAt: number;
  toldNoMilk: boolean;
}

/** 天雷：预警 warnTime 秒后落下 */
export interface Thunder {
  id: number;
  x: number;
  y: number;
  at: number;
}

/** 炸弹蛋：暗派的奶鸡下的，到时间爆炸，只伤下蛋一方的敌人 */
export interface Bomb {
  id: number;
  x: number;
  y: number;
  at: number;
  by: number;
}

/** 奶屎：没有阵营，谁捡到算谁的（拉屎的奶狗自己不能捡，只能在掉血时吃掉回血） */
export interface Poop {
  id: number;
  x: number;
  y: number;
  by: number;
}

export type Stage3Event =
  | { type: 'kick'; id: number; hit: boolean }
  | { type: 'hurt'; id: number; dmg: number }
  | { type: 'down'; id: number; by: number }
  | { type: 'respawn'; id: number }
  | { type: 'lay'; id: number; bomb: boolean }
  | { type: 'poop'; id: number }
  | { type: 'eat'; id: number }
  | { type: 'collect'; id: number; gold: boolean }
  | { type: 'stun'; id: number; n: number }
  | { type: 'steal'; id: number; what: 'servant' | 'gold'; from: number }
  | { type: 'heal'; id: number }
  | { type: 'infected'; x: number; y: number }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'thunderWave' }
  | { type: 'strike'; x: number; y: number }
  | { type: 'thunderHit'; id: number; hits: number }
  | { type: 'turned'; id: number }
  | { type: 'stored'; sid: number; team: Team }
  | { type: 'thirsty'; sid: number; team: Team; stage: 0 | 1 }
  | { type: 'drank'; sid: number; team: Team; ok: boolean }
  | { type: 'grew'; sid: number; team: Team; stage: 1 | 2 }
  | { type: 'standIn'; id: number }
  | { type: 'gnawed'; id: number; i: number };

export type Outcome = { winner: Team; reason: string } | null;

export class Stage3World extends World {
  fighters = new Map<number, Fighter>();
  gold: Record<Team, number> = { good: C.startGold, dark: C.startGold };
  events3: Stage3Event[] = [];
  outcome: Outcome = null;
  /** 你这一轮有没有伤到过奶家队的人（判断"超能串子"用） */
  playerHurtGood = false;
  servants: Servant[] = [];
  bombs: Bomb[] = [];
  poops: Poop[] = [];
  thunders: Thunder[] = [];
  /** 庇护所属于哪一队（按砖的主人编号）；开局定好，主人黑化也不变 */
  shelterTeam = new Map<number, Team>();
  /** 每队庇护所的主人（你这一队就是你） */
  shelterOwner: Partial<Record<Team, number>> = {};
  /** 你被天雷劈到黑化了：这一轮到此为止，画面开始新的一轮（你在暗派） */
  playerTurned = false;
  /** 奶家队全队累计被天雷劈中的次数 */
  teamHits = 0;
  /** 结算用：你这一局复活了几次（含替身）、造成了多少伤害 */
  playerRespawns = 0;
  playerDamage = 0;
  /** 庇护所里的奶蛋喝奶：画面层接到库存上（喝掉一瓶），规则层不碰存档 */
  drink: () => 'milk' | 'tea' | null = () => null;
  nextWave: number = C.thunder.firstAt;
  /** 每队攒的奶屎（满 poopPerGold 个换 1 金币） */
  poopCount: Record<Team, number> = { good: 0, dark: 0 };
  private seq = 0;

  constructor() {
    super({ duration: C.duration, wind: false, spring: false, refresh: false });
  }

  /** 你是哪个角色（开局定好，按编号找，不依赖 human 标记） */
  private playerId = 0;
  get player() {
    return this.actors[this.playerId];
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
        if (human) this.playerId = this.actors.length;
        const y = Math.round(((k + 1) * this.rows) / (roles.length + 1));
        const x = this.homeX(team) + (k % 2 ? (team === 'good' ? 1 : -1) : 0);
        const name = human ? TX.names.player : `${team === 'dark' ? TX.names.darkPrefix : ''}${TX.roles[role].name}`;
        const a = this.addActor({ id: this.actors.length, name, human, cx: x, cy: y, speed: C.roles[role].speed * (human ? 1 : C.ai.speed) });
        a.facing = team === 'good' ? 'right' : 'left';
        const hp = C.roles[role].hp;
        this.fighters.set(a.id, { role, team, hp, maxHp: hp, readyAt: 0, kickUntil: 0, downUntil: 0, stunUntil: 0, hits: 0, thinkAt: Math.random() * 0.5, path: [], roam: null, goldReadyAt: 0, gnaw: null });
      });
    }
  }

  // ───────── 庇护所 ─────────

  /**
   * 两队各放一套庇护所（第一关存下的形状），放在自家半场、出生点外侧一点的地方。
   * 你这一队的主人是你；另一队的主人是那一队的第一个人。
   */
  placeShelters(shapes: ShelterShape[]) {
    for (const team of ['good', 'dark'] as Team[]) {
      const owner = this.f(this.player).team === team ? this.player : this.actors.find((a) => this.f(a).team === team)!;
      this.shelterOwner[team] = owner.id;
      this.shelterTeam.set(owner.id, team);
      for (const shape of shapes) {
        const spot = this.findShelterSpot(shape, team);
        if (!spot) continue;
        for (const [dx, dy] of shape.walls) this.walls[this.idx(spot.x + dx, spot.y + dy)] = owner.id;
      }
    }
    this.recomputeInteriors();
  }

  private findShelterSpot(shape: ShelterShape, team: Team) {
    const w = Math.max(...shape.walls.map((p) => p[0])) + 1;
    const h = Math.max(...shape.walls.map((p) => p[1])) + 1;
    // 奶家队在 5～10 列，暗派对称；离别的庇护所留一格空
    const xs = team === 'good' ? [5, 10 - w + 1] : [this.cols - 11, this.cols - 5 - w];
    const free = (x: number, y: number) => {
      for (let dy = -1; dy <= h; dy++)
        for (let dx = -1; dx <= w; dx++) {
          const cx = x + dx;
          const cy = y + dy;
          if (this.inBounds(cx, cy) && this.walls[this.idx(cx, cy)] !== -1) return false;
        }
      return shape.walls.every(([dx, dy]) => this.inBounds(x + dx, y + dy) && !this.actorAt(x + dx, y + dy));
    };
    for (let k = 0; k < 200; k++) {
      const x = xs[0] + ((Math.random() * Math.max(1, xs[1] - xs[0] + 1)) | 0);
      const y = 1 + ((Math.random() * Math.max(1, this.rows - h - 1)) | 0);
      if (free(x, y)) return { x, y };
    }
    return null;
  }

  /** 墙：自己队的庇护所可以穿过，别队的不行；奶鼠能从墙下钻过去 */
  passable(a: Actor, x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    const w = this.walls[this.idx(x, y)];
    if (w === -1) return true;
    const f = this.fighters.get(a.id);
    return !f || f.role === 'mouse' || this.shelterTeam.get(w) === f.team;
  }

  /** 这一格在某一队的闭合庇护所里 */
  inShelter(team: Team, i: number) {
    const o = this.interior[i];
    return o !== -1 && this.shelterTeam.get(o) === team;
  }

  /** 点到的奶仆（按格子浮点位置，半格以内） */
  servantNear(x: number, y: number) {
    let best: Servant | null = null;
    let bd = 0.75;
    for (const s of this.servants) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) (bd = d), (best = s);
    }
    return best;
  }

  /** 能不能把这只奶仆放进 i 这一格：自己队、健康、在你身边范围内；格子是自己队庇护所里的空格 */
  canStore(a: Actor, s: Servant, i: number) {
    const team = this.f(a).team;
    const x = i % this.cols;
    const y = (i / this.cols) | 0;
    const R = C.nursery.storeRange;
    return (
      s.team === team &&
      s.infectedAt < 0 &&
      s.storedAt < 0 &&
      Math.hypot(s.x - a.cx, s.y - a.cy) <= R &&
      Math.hypot(x - a.cx, y - a.cy) <= R &&
      this.inShelter(team, i) &&
      this.walls[i] === -1 &&
      !this.servants.some((o) => o.storedAt === i) &&
      !this.actorAt(x, y)
    );
  }

  /** 自己队庇护所里能放奶仆的空格 */
  storeTargets(a: Actor, s: Servant) {
    const out: number[] = [];
    for (let i = 0; i < this.interior.length; i++) if (this.canStore(a, s, i)) out.push(i);
    return out;
  }

  /** 放进庇护所：不会被攻击、不会被天雷劈；开始想喝奶 */
  store(a: Actor, s: Servant, i: number) {
    if (!this.canStore(a, s, i)) return false;
    s.storedAt = i;
    s.x = i % this.cols;
    s.y = (i / this.cols) | 0;
    s.attackT = 0;
    this.events3.push({ type: 'stored', sid: s.id, team: s.team });
    if (s.stage < 2 && s.growAt < 0) this.wantMilk(s);
    return true;
  }

  /** 从庇护所里放出来，继续跟着主人（长到一半的停在那个阶段） */
  release(s: Servant) {
    if (s.storedAt < 0) return false;
    s.storedAt = -1;
    if (s.growAt >= 0) s.growAt = -1;
    s.thirsty = false;
    return true;
  }

  private wantMilk(s: Servant) {
    s.thirsty = true;
    s.drinkTryAt = this.t + 0.5;
    this.events3.push({ type: 'thirsty', sid: s.id, team: s.team, stage: s.stage as 0 | 1 });
  }

  /** 庇护所里的奶蛋：想喝奶 → 有瓶子就喝掉一瓶 → 1 分钟后长一阶 → 小奶蛙再想喝奶 → 再 1 分钟长成奶蛙（替身） */
  private updateNursery() {
    for (const s of this.servants) {
      if (s.storedAt < 0 || s.stage >= 2) continue;
      if (s.thirsty) {
        if (this.t < s.drinkTryAt) continue;
        // 只有你这一队的奶蛋能喝你的库存；电脑那一队默认有奶喝
        const got = s.team === this.f(this.player).team ? this.drink() : 'milk';
        s.drinkTryAt = this.t + 5;
        if (!got) {
          if (!s.toldNoMilk) this.events3.push({ type: 'drank', sid: s.id, team: s.team, ok: false });
          s.toldNoMilk = true;
          continue;
        }
        s.thirsty = false;
        s.growAt = this.t + (s.stage === 0 ? C.nursery.toFroglet : C.nursery.toFrog);
        this.events3.push({ type: 'drank', sid: s.id, team: s.team, ok: true });
        continue;
      }
      if (s.growAt >= 0 && this.t >= s.growAt) {
        s.stage = (s.stage + 1) as 1 | 2;
        s.growAt = -1;
        this.events3.push({ type: 'grew', sid: s.id, team: s.team, stage: s.stage });
        if (s.stage === 1) this.wantMilk(s);
      }
    }
  }

  // ───────── 黑化 ─────────

  /** 奶家队的人被天雷劈够次数：当场加入暗派（你自己黑化就结束这一轮） */
  private turn(a: Actor) {
    const f = this.f(a);
    if (f.team === 'dark') return;
    if (a === this.player) {
      this.playerTurned = true;
      this.events3.push({ type: 'turned', id: a.id });
      return;
    }
    f.team = 'dark';
    f.hits = 0;
    f.path = [];
    f.roam = null;
    a.name = `${TX.names.darkPrefix}${TX.roles[f.role].name}`;
    this.events3.push({ type: 'turned', id: a.id });
  }

  // ───────── 奶鼠啃砖 ─────────

  private startGnaw(a: Actor) {
    const f = this.f(a);
    for (const [dx, dy] of Object.values(DIRS)) {
      const x = a.cx + dx;
      const y = a.cy + dy;
      if (!this.inBounds(x, y)) continue;
      const i = this.idx(x, y);
      const w = this.walls[i];
      if (w === -1 || this.shelterTeam.get(w) === f.team) continue;
      f.gnaw = { i, until: this.t + C.roles.mouse.gnaw };
      if (a.human && f.team === 'dark') this.playerHurtGood = true;
      return true;
    }
    return false;
  }

  private updateGnaw() {
    for (const a of this.actors) {
      const f = this.f(a);
      const g = f.gnaw;
      if (!g) continue;
      const gx = g.i % this.cols;
      const gy = (g.i / this.cols) | 0;
      // 走开、被打倒、被迷惑、砖已经没了：不啃了
      if (f.downUntil || this.isStunned(a) || Math.abs(gx - a.cx) + Math.abs(gy - a.cy) !== 1 || this.walls[g.i] === -1 || a.moveT < 1) {
        f.gnaw = null;
        continue;
      }
      if (this.t < g.until) continue;
      this.walls[g.i] = -1;
      this.wallsChanged();
      f.gnaw = null;
      this.events3.push({ type: 'gnawed', id: a.id, i: g.i });
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

  /** 技能键上的字：技能名，冷却中带剩余秒数 */
  actionLabel(a: Actor): string {
    const f = this.f(a);
    const name = f.role === 'chicken' && f.team === 'dark' ? TX.action.bomb : TX.action[f.role];
    if (f.gnaw) return TX.action.gnawing;
    const wait = Math.ceil(f.readyAt - this.t);
    return wait > 0 && f.role !== 'frog' ? `${name} ${wait}` : name;
  }

  act(a: Actor) {
    if (this.isDown(a) || this.isStunned(a) || this.isBusy(a)) return false;
    const f = this.f(a);
    switch (f.role) {
      case 'frog':
        this.kick(a);
        return true;
      case 'chicken':
        return this.lay(a);
      case 'dog':
        return this.poop(a);
      case 'powder':
        return this.stun(a);
      case 'mouse':
        return this.steal(a);
    }
  }

  private hint(a: Actor, text: string) {
    if (a.human) this.events.push({ type: 'hint', text, actor: a.id });
    return false;
  }

  private cheb(ax: number, ay: number, bx: number, by: number) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  }

  /** 奶鸡下蛋：奶家队 → 奶仆；暗派 → 炸弹蛋。下在自己脚下 */
  private lay(a: Actor) {
    const f = this.f(a);
    const R = C.roles.chicken;
    if (this.t < f.readyAt) return this.hint(a, TX.toast.cooling);
    if (f.team === 'good') {
      this.addServant('good', a.cx, a.cy);
    } else {
      if (this.bombs.some((b) => b.x === a.cx && b.y === a.cy)) return this.hint(a, TX.toast.occupied);
      this.bombs.push({ id: ++this.seq, x: a.cx, y: a.cy, at: this.t + R.bombAfter, by: a.id });
    }
    f.readyAt = this.t + R.layEvery;
    this.events3.push({ type: 'lay', id: a.id, bomb: f.team === 'dark' });
    return true;
  }

  /** 奶狗拉奶屎：拉在自己脚下 */
  private poop(a: Actor) {
    const f = this.f(a);
    const R = C.roles.dog;
    if (this.t < f.readyAt) return this.hint(a, TX.toast.cooling);
    if (this.poops.some((p) => p.x === a.cx && p.y === a.cy)) return this.hint(a, TX.toast.occupied);
    if (this.poops.length >= R.maxPoops) return this.hint(a, TX.toast.tooManyPoops);
    this.poops.push({ id: ++this.seq, x: a.cx, y: a.cy, by: a.id });
    f.readyAt = this.t + R.poopEvery;
    this.events3.push({ type: 'poop', id: a.id });
    return true;
  }

  /** 奶粉迷惑：范围内的敌人全部眩晕 */
  private stun(a: Actor) {
    const f = this.f(a);
    const S = C.roles.powder.stun;
    if (this.t < f.readyAt) return this.hint(a, TX.toast.cooling);
    const hit = this.enemies(a).filter((b) => this.cheb(a.cx, a.cy, b.cx, b.cy) <= S.range);
    if (!hit.length) return this.hint(a, TX.toast.noTarget);
    for (const b of hit) {
      this.f(b).stunUntil = this.t + S.duration;
      b.wantDir = null;
      this.f(b).path = [];
      if (a.human && f.team === 'dark' && this.f(b).team === 'good') this.playerHurtGood = true;
    }
    f.readyAt = this.t + S.cooldown;
    this.events3.push({ type: 'stun', id: a.id, n: hit.length });
    return true;
  }

  /** 奶鼠偷：身边有敌方奶仆就偷奶仆（变成自己这边的），否则偷身边敌人那一队的金币 */
  private steal(a: Actor) {
    const f = this.f(a);
    const M = C.roles.mouse;
    const sv = this.servants.find((s) => s.team !== f.team && s.infectedAt < 0 && Math.hypot(s.x - a.cx, s.y - a.cy) <= 1.5);
    if (sv) {
      if (this.t < f.readyAt) return this.hint(a, TX.toast.cooling);
      // 偷来的奶仆跟着自己队的奶蛙走；从对面庇护所里偷出来的也一样
      this.release(sv);
      sv.team = f.team;
      sv.attackT = 0;
      sv.healAt = this.t + C.servant.healEvery;
      f.readyAt = this.t + M.stealCooldown;
      if (a.human && f.team === 'dark') this.playerHurtGood = true;
      this.events3.push({ type: 'steal', id: a.id, what: 'servant', from: -1 });
      return true;
    }
    const victim = this.enemies(a).find((b) => this.cheb(a.cx, a.cy, b.cx, b.cy) <= 1);
    if (!victim) {
      // 身边是对面的砖：开始啃
      if (!f.gnaw && this.startGnaw(a)) return true;
      return this.hint(a, TX.toast.nothingToSteal);
    }
    if (this.t < f.goldReadyAt) return this.hint(a, TX.toast.cooling);
    const other = this.f(victim).team;
    const n = Math.min(M.stealGold, this.gold[other]);
    if (!n) return this.hint(a, TX.toast.noGold);
    this.gold[other] -= n;
    this.gold[f.team] += n;
    f.goldReadyAt = this.t + M.goldCooldown;
    if (a.human && f.team === 'dark') this.playerHurtGood = true;
    this.events3.push({ type: 'steal', id: a.id, what: 'gold', from: victim.id });
    return true;
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
    this.damage(target, f.team === 'dark' ? K.darkDamage : K.damage, a);
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
    // 天雷会掉 0.5、0.7 这样的小数血，按一位小数算，避免 0.1 级的误差
    const before = f.hp;
    f.hp = Math.max(0, Math.round((f.hp - dmg) * 10) / 10);
    if (by === this.player) this.playerDamage = Math.round((this.playerDamage + before - f.hp) * 10) / 10;
    this.events3.push({ type: 'hurt', id: b.id, dmg });
    if (f.hp > 0) return;
    // 替身：自己队庇护所里有长成的奶蛙，庇护所主人倒下时它顶上，原地满血复活
    if (b.id === this.shelterOwner[f.team]) {
      const k = this.servants.findIndex((s) => s.team === f.team && s.stage === 2 && s.storedAt >= 0);
      if (k >= 0) {
        this.servants.splice(k, 1);
        f.hp = f.maxHp;
        if (b === this.player) this.playerRespawns++;
        this.events3.push({ type: 'standIn', id: b.id });
        return;
      }
    }
    // 倒下：一段时间后在自家复活；打倒的一方得金币
    f.downUntil = this.t + (f.team === 'dark' ? C.darkRespawn : C.respawn);
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
    if (a === this.player) this.playerRespawns++;
    this.events3.push({ type: 'respawn', id: a.id });
  }

  protected step(dt: number) {
    for (const a of this.actors) if (!a.human) this.think(a);
    this.updateThunder();
    this.updateServants(dt);
    this.updateNursery();
    this.updateGnaw();
    this.updateBombs();
    this.pickupPoops();
    this.checkOutcome();
  }

  // ───────── 奶仆、炸弹、奶屎 ─────────

  /** 某队离 (x, y) 最近、还站着的奶蛙（奶仆的主人） */
  masterOf(team: Team, x: number, y: number) {
    let best: Actor | null = null;
    let bd = Infinity;
    for (const a of this.standing(team)) {
      if (this.f(a).role !== 'frog') continue;
      const d = Math.hypot(a.cx - x, a.cy - y);
      if (d < bd) (bd = d), (best = a);
    }
    return best;
  }

  addServant(team: Team, x: number, y: number) {
    this.servants.push({ id: ++this.seq, team, x, y, attackT: 0, infectedAt: -1, healAt: this.t + C.servant.healEvery, hits: 0, storedAt: -1, stage: 0, thirsty: false, growAt: -1, drinkTryAt: 0, toldNoMilk: false });
  }

  /** 第二关救下的奶蛋：开局就是你这一队的奶仆，围在你身边 */
  inheritEggs(n: number) {
    const p = this.player;
    const team = this.f(p).team;
    for (let k = 0; k < Math.min(n, C.servant.inheritMax); k++) {
      const ang = (k / Math.max(1, n)) * Math.PI * 2;
      this.addServant(team, Math.max(0, Math.min(this.cols - 1, p.cx + Math.cos(ang))), Math.max(0, Math.min(this.rows - 1, p.cy + Math.sin(ang))));
    }
  }

  // ───────── 天雷 ─────────

  /** 天雷只对奶家队有作用（劈中掉血、记次数，满 3 次黑化在第 3 步） 【补充】 */
  private updateThunder() {
    const T = C.thunder;
    if (this.t >= this.nextWave) {
      this.nextWave += T.interval;
      const goods = this.standing('good');
      for (let k = 0; k < T.perWave; k++) {
        const aim = goods[(Math.random() * goods.length) | 0];
        const tile =
          aim && Math.random() < T.aimedChance
            ? { x: Math.max(0, Math.min(this.cols - 1, aim.cx + Math.round((Math.random() - 0.5) * 4))), y: Math.max(0, Math.min(this.rows - 1, aim.cy + Math.round((Math.random() - 0.5) * 4))) }
            : this.randomTile(() => true);
        if (tile) this.thunders.push({ id: ++this.seq, x: tile.x, y: tile.y, at: this.t + T.warnTime });
      }
      this.events3.push({ type: 'thunderWave' });
    }
    for (const th of this.thunders.filter((q) => this.t >= q.at)) this.strike(th);
    this.thunders = this.thunders.filter((q) => this.t < q.at);
  }

  /** 天雷落下：3×3 内、不在闭合庇护所里的奶家队角色掉血；奶家队的奶仆记一次，满 3 次感染 */
  private strike(th: Thunder) {
    const R = C.thunder.radius;
    this.events3.push({ type: 'strike', x: th.x, y: th.y });
    const inArea = (x: number, y: number) => Math.abs(x - th.x) <= R && Math.abs(y - th.y) <= R && this.interior[this.idx(x, y)] === -1;
    for (const a of this.standing('good')) {
      if (!inArea(a.cx, a.cy)) continue;
      const f = this.f(a);
      f.hits++;
      this.teamHits++;
      this.events3.push({ type: 'thunderHit', id: a.id, hits: f.hits });
      this.damage(a, C.thunder.damage[f.role], null);
      if (f.hits >= C.hitsToTurn) this.turn(a);
      // 全队累计被劈够次数：你也黑化（你在奶家队时）
      if (this.teamHits >= C.teamHitsToTurn && this.f(this.player).team === 'good') this.turn(this.player);
    }
    for (const s of this.servants) {
      if (s.team !== 'good' || s.infectedAt >= 0 || !inArea(Math.round(s.x), Math.round(s.y))) continue;
      s.hits++;
      if (s.hits >= C.servant.thunderHits) {
        s.infectedAt = this.t;
        this.events3.push({ type: 'infected', x: s.x, y: s.y });
      }
    }
  }

  private updateServants(dt: number) {
    const S = C.servant;
    for (const s of [...this.servants]) {
      if (s.infectedAt >= 0) {
        // 感染后原地不动，到时间爆炸，范围内谁都炸
        if (this.t >= s.infectedAt + S.bombAfter) {
          this.servants.splice(this.servants.indexOf(s), 1);
          this.explode(s.x, s.y, S.blastRadius, S.blastDamage, null, null);
        }
        continue;
      }
      // 放在庇护所里的：不动、不会被攻击（成长在 updateNursery）
      if (s.storedAt >= 0) continue;
      const m = this.masterOf(s.team, s.x, s.y);
      const md = m ? Math.hypot(m.cx - s.x, m.cy - s.y) : Infinity;
      // 跟着主人走，停在主人身边一格左右
      if (m && md > 1.2) {
        const step = Math.min(md - 1.1, S.followSpeed * dt);
        s.x += ((m.cx - s.x) / md) * step;
        s.y += ((m.cy - s.y) / md) * step;
      }
      // 离主人够近就安全；否则身边有敌人就在被攻击，攻击够久就感染
      const safe = md <= S.safeRange;
      const attacked = !safe && this.actors.some((b) => !this.isDown(b) && this.f(b).team !== s.team && Math.hypot(b.cx - s.x, b.cy - s.y) <= S.attackRange);
      s.attackT = attacked ? s.attackT + dt : 0;
      if (s.attackT >= S.infectAfter) {
        s.infectedAt = this.t;
        this.events3.push({ type: 'infected', x: s.x, y: s.y });
        continue;
      }
      // 给主人补血
      if (m && md <= S.safeRange && this.t >= s.healAt) {
        const mf = this.f(m);
        if (mf.hp < mf.maxHp) {
          mf.hp = Math.min(mf.maxHp, mf.hp + S.heal);
          this.events3.push({ type: 'heal', id: m.id });
        }
        s.healAt = this.t + S.healEvery;
      }
    }
  }

  private updateBombs() {
    const R = C.roles.chicken;
    for (const b of [...this.bombs]) {
      if (this.t < b.at) continue;
      this.bombs.splice(this.bombs.indexOf(b), 1);
      const by = this.actor(b.by);
      // 炸弹蛋只炸下蛋那一队的敌人
      this.explode(b.x, b.y, R.bombRadius, R.bombDamage, by, this.f(by).team === 'good' ? 'dark' : 'good');
    }
  }

  /** 爆炸：范围内（只算 onlyTeam 这一队，null = 所有人）的人掉血 */
  private explode(x: number, y: number, r: number, dmg: number, by: Actor | null, onlyTeam: Team | null) {
    this.events3.push({ type: 'explode', x, y, r });
    for (const a of this.standing()) {
      if (onlyTeam && this.f(a).team !== onlyTeam) continue;
      if (Math.hypot(a.cx - x, a.cy - y) <= r) this.damage(a, dmg, by);
    }
  }

  /** 走到奶屎上就捡起来：拉的那只奶狗自己不能捡；奶狗掉血时踩到奶屎会吃掉回血 */
  private pickupPoops() {
    const R = C.roles.dog;
    for (const a of this.standing()) {
      if (a.moveT < 1) continue;
      const k = this.poops.findIndex((p) => p.x === a.cx && p.y === a.cy);
      if (k < 0) continue;
      const p = this.poops[k];
      const f = this.f(a);
      if (f.role === 'dog' && f.hp < f.maxHp) {
        this.poops.splice(k, 1);
        f.hp = Math.min(f.maxHp, f.hp + R.eatHeal);
        this.events3.push({ type: 'eat', id: a.id });
        continue;
      }
      if (p.by === a.id) continue;
      this.poops.splice(k, 1);
      this.poopCount[f.team]++;
      const gold = this.poopCount[f.team] >= R.poopPerGold;
      if (gold) {
        this.poopCount[f.team] -= R.poopPerGold;
        this.gold[f.team]++;
      }
      this.events3.push({ type: 'collect', id: a.id, gold });
    }
  }

  update(dt: number) {
    if (this.outcome || this.playerTurned) return;
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
   * 电脑：
   *   奶蛙：追最近的敌人，贴身就踢
   *   奶鸡：奶家队在自家奶蛙身边下蛋；暗派摸到奶家队身边下炸弹
   *   奶狗：在自家奶蛙身边拉屎，顺路捡别人的奶屎
   *   奶粉：敌人进范围就迷惑，冷却好了会主动靠近敌方奶蛙
   *   奶鼠：找敌方奶仆偷，偷不到就偷金币、捡奶屎
   * 除了奶蛙，敌方奶蛙靠近时都会先跑开（奶粉技能好了时除外）
   */
  private think(a: Actor) {
    const f = this.f(a);
    if (f.downUntil || this.isStunned(a) || this.isBusy(a)) return;
    if (this.t < f.thinkAt && f.path.length) return this.walkPath(a, f);
    f.thinkAt = this.t + C.ai.think;
    const foes = this.enemies(a);
    const dist = (b: { cx: number; cy: number }) => Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const near = <T extends { cx: number; cy: number }>(list: T[]) => list.sort((p, q) => dist(p) - dist(q))[0];
    const ready = this.t >= f.readyAt;
    const leader = this.masterOf(f.team, a.cx, a.cy);
    const byLeader = leader && leader !== a && this.cheb(a.cx, a.cy, leader.cx, leader.cy) <= 2;

    if (f.role === 'frog') {
      const target = near(foes);
      if (!target) return this.roam(a, f);
      if (this.cheb(a.cx, a.cy, target.cx, target.cy) <= C.roles.frog.kick.range) {
        this.stop(a, f);
        if (ready) this.kick(a);
        return;
      }
      if (dist(target) > C.ai.chase) return this.roam(a, f);
      return this.goTo(a, f, target.cx, target.cy);
    }

    const threat = near(foes.filter((b) => this.f(b).role === 'frog' && dist(b) <= C.ai.flee));
    if (threat && !(f.role === 'powder' && ready)) return this.flee(a, threat);

    switch (f.role) {
      case 'chicken': {
        if (f.team === 'dark') {
          const prey = near(foes.filter((b) => dist(b) <= C.ai.chase));
          if (ready && prey) {
            if (this.cheb(a.cx, a.cy, prey.cx, prey.cy) <= 1) return this.stop(a, f), void this.lay(a);
            return this.goTo(a, f, prey.cx, prey.cy);
          }
          break;
        }
        // 技能好了：走到自家奶蛙身边下蛋；下完就继续满场走
        if (ready) {
          if (byLeader || !leader) return this.stop(a, f), void this.lay(a);
          return this.goTo(a, f, leader.cx, leader.cy);
        }
        break;
      }
      case 'dog': {
        // 技能好了：走到自家奶蛙身边拉屎（别拉在敌人那边）
        if (ready && (byLeader || !leader)) {
          if (this.poop(a)) return this.stop(a, f);
        } else if (ready && leader) return this.goTo(a, f, leader.cx, leader.cy);
        const p = near(this.poops.filter((q) => q.by !== a.id).map((q) => ({ cx: q.x, cy: q.y })).filter((q) => dist(q) <= 6));
        if (p) return this.goExact(a, f, p.cx, p.cy);
        break;
      }
      case 'powder': {
        if (ready) {
          if (foes.some((b) => this.cheb(a.cx, a.cy, b.cx, b.cy) <= C.roles.powder.stun.range)) return this.stop(a, f), void this.stun(a);
          const frog = near(foes.filter((b) => this.f(b).role === 'frog' && dist(b) <= 6));
          if (frog) return this.goTo(a, f, frog.cx, frog.cy);
        }
        break;
      }
      case 'mouse': {
        const sv = near(this.servants.filter((s) => s.team !== f.team && s.infectedAt < 0).map((s) => ({ cx: Math.round(s.x), cy: Math.round(s.y) })));
        if (sv && ready) {
          if (this.cheb(a.cx, a.cy, sv.cx, sv.cy) <= 1 && this.steal(a)) return this.stop(a, f);
          return this.goTo(a, f, sv.cx, sv.cy);
        }
        const other: Team = f.team === 'good' ? 'dark' : 'good';
        const mark = near(foes.filter((b) => this.f(b).role !== 'frog'));
        if (mark && this.t >= f.goldReadyAt && this.gold[other] > 0) {
          if (this.cheb(a.cx, a.cy, mark.cx, mark.cy) <= 1 && this.steal(a)) return this.stop(a, f);
          return this.goTo(a, f, mark.cx, mark.cy);
        }
        const p = near(this.poops.map((q) => ({ cx: q.x, cy: q.y })).filter((q) => dist(q) <= 8));
        if (p) return this.goExact(a, f, p.cx, p.cy);
        break;
      }
    }
    // 没事做：满场走动
    this.roam(a, f);
  }

  private stop(a: Actor, f: Fighter) {
    a.wantDir = null;
    f.path = [];
  }
  /** 走到目标旁边 */
  private goTo(a: Actor, f: Fighter, x: number, y: number) {
    f.path = this.pathTo(a, x, y);
    this.walkPath(a, f);
  }
  /** 走到目标那一格上（捡东西） */
  private goExact(a: Actor, f: Fighter, x: number, y: number) {
    f.path = this.pathTo(a, x, y, 0);
    this.walkPath(a, f);
  }

  /** 满场走动：随机挑一个离队友都有点距离的目标点走过去，到了（或偶尔）换一个 */
  private roam(a: Actor, f: Fighter) {
    if (!f.roam || this.cheb(a.cx, a.cy, f.roam.x, f.roam.y) <= 1 || Math.random() < C.ai.roamPick) {
      const mates = this.standing(f.team).filter((b) => b !== a);
      f.roam =
        this.randomTile((x, y) => this.passable(a, x, y) && Math.hypot(x - a.cx, y - a.cy) >= 5 && mates.every((b) => this.cheb(x, y, b.cx, b.cy) >= 3)) ??
        this.randomTile((x, y) => this.passable(a, x, y));
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

  /** 网格寻路（BFS），走到离目标 near 格以内为止（默认走到旁边） */
  private pathTo(a: Actor, tx: number, ty: number, near = 1) {
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
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= near) {
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
