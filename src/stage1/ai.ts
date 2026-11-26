import { STAGE1 as C } from '../config/stage1';
import { Actor, DIR_LIST, DIRS, Dir, World } from './world';

interface Goal {
  /** 要站到的格子 */
  stand: number;
  /** 到了之后面朝哪边再按举起，不填就直接按 */
  face?: Dir;
  act: boolean;
}

/**
 * 电脑奶蛋：选一块 2×2 的空地，用 8 块砖围成庇护所，再去捡瓶子、去灵泉装满、
 * 偶尔拿铁锹去挖别人的庇护所。和玩家一样只用 setWantDir / face / act 操作。
 */
export class AIController {
  private interiorTiles: number[] = [];
  private ring: number[] = [];
  private thinkTimer = Math.random() * C.ai.thinkInterval;
  private path: number[] = [];
  private goal: Goal | null = null;
  private dug = false;
  /** 到达目标位置的时刻（停顿 actDelay 秒后才动手） */
  private arrivedAt = -1;
  /** 是否在抢劫模式，每隔一段时间重新决定一次，避免每次决策都掷骰子 */
  private raiding = false;
  private raidRollAt = 0;

  constructor(private w: World, readonly actor: Actor, homeX: number, homeY: number) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) this.interiorTiles.push(w.idx(homeX + dx, homeY + dy));
    const ringXY = [
      [homeX, homeY - 1], [homeX + 1, homeY - 1],
      [homeX, homeY + 2], [homeX + 1, homeY + 2],
      [homeX - 1, homeY], [homeX - 1, homeY + 1],
      [homeX + 2, homeY], [homeX + 2, homeY + 1],
    ];
    this.ring = ringXY.filter(([x, y]) => w.inBounds(x, y)).map(([x, y]) => w.idx(x, y));
    for (const i of [...this.ring, ...this.interiorTiles]) w.reserved.add(i);
  }

  update(dt: number) {
    const w = this.w;
    const a = this.actor;
    if (w.isBusy(a)) {
      this.path = [];
      this.goal = null;
      return;
    }
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0 || !this.goal) {
      this.thinkTimer = C.ai.thinkInterval;
      this.plan();
    }
    this.follow();
  }

  // ───────── 执行：沿路径走，到了就转身、按键 ─────────

  private follow() {
    const w = this.w;
    const a = this.actor;
    const g = this.goal;
    if (!g) return w.setWantDir(a, null);
    const here = w.idx(a.cx, a.cy);
    if (here === g.stand) {
      w.setWantDir(a, null);
      if (a.moveT < 1) return;
      if (g.face) w.face(a, g.face);
      // 到位后先停顿一下再动手
      if (this.arrivedAt < 0) this.arrivedAt = w.t;
      if (w.t - this.arrivedAt < C.ai.actDelay) return;
      // 空手去捡脚下的东西，但东西已经被别人拿走了：重新规划，免得误把面前自己的墙举起来
      if (g.act && !g.face && !a.carry && !w.items[here]) {
        this.goal = null;
        this.thinkTimer = 0;
        return;
      }
      const digging = !!g.face && a.carry?.kind === 'shovel';
      if (g.act && w.act(a)) {
        if (digging) this.dug = true;
        this.goal = null;
        this.thinkTimer = 0;
      }
      return;
    }
    this.arrivedAt = -1;
    while (this.path.length && this.path[0] === here) this.path.shift();
    const next = this.path[0];
    if (next === undefined) return w.setWantDir(a, null);
    const nx = next % w.cols;
    const ny = (next / w.cols) | 0;
    const d = DIR_LIST.find((k) => a.cx + DIRS[k][0] === nx && a.cy + DIRS[k][1] === ny);
    w.setWantDir(a, d ?? null);
  }

  // ───────── 决策 ─────────

  private plan() {
    const w = this.w;
    const a = this.actor;
    const { dist, prev } = this.bfs();
    const reach = (i: number) => dist[i] >= 0;
    const best = (cands: Goal[]) => {
      let pick: Goal | null = null;
      for (const c of cands) if (reach(c.stand) && (!pick || dist[c.stand] < dist[pick.stand])) pick = c;
      return pick;
    };
    const missing = this.ring.filter((i) => w.walls[i] !== a.id);
    const carry = a.carry;
    let goal: Goal | null = null;
    const captor = w.prisoners.get(a.id);

    if (captor !== undefined && !this.dug) {
      // 被囚禁了（彩蛋）：有铁锹就挖墙出去，没有就先找铁锹
      const shovelInside: Goal[] = [];
      w.items.forEach((it, i) => it?.kind === 'shovel' && shovelInside.push({ stand: i, act: true }));
      if (carry?.kind === 'shovel') goal = best(this.wallGoals((o) => o === captor, (stand) => w.interior[stand] === captor));
      else if (!carry) goal = best(shovelInside);
      else if (best(shovelInside)) goal = this.dropHere();
    } else if (carry?.kind === 'brick') {
      // 找一块还没放砖的位置，站在它旁边、面朝它放砖
      const cands: Goal[] = [];
      for (const r of missing) {
        const rx = r % w.cols;
        const ry = (r / w.cols) | 0;
        if (!w.free(rx, ry, true)) continue;
        for (const d of DIR_LIST) {
          const sx = rx - DIRS[d][0];
          const sy = ry - DIRS[d][1];
          if (w.inBounds(sx, sy)) cands.push({ stand: w.idx(sx, sy), face: d, act: true });
        }
      }
      // 暂时没地方放就先拿着，不原地放下（否则会放下又捡起来来回循环）
      goal = best(cands);
    } else if (carry?.kind === 'bottle') {
      const sp = w.spring;
      if (carry.fill === 'empty' && sp) {
        const cands: Goal[] = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && w.inBounds(sp.cx + dx, sp.cy + dy)) cands.push({ stand: w.idx(sp.cx + dx, sp.cy + dy), act: false });
        const g = best(cands);
        const timeLeft = sp.until - w.t;
        if (g && dist[g.stand] / (C.moveTilesPerSec * a.speed) < timeLeft) goal = g;
      }
      if (!goal) goal = best(this.interiorTiles.filter((i) => !w.items[i]).map((i) => ({ stand: i, act: true })));
    } else if (carry?.kind === 'shovel') {
      if (this.dug) {
        this.dug = false;
        this.raiding = false;
        goal = this.dropHere();
      } else {
        goal = this.raidTarget(best);
        if (!goal) {
          this.raiding = false;
          goal = this.dropHere();
        }
      }
    } else {
      // 空手：先清掉挡在砖位上的物资，再捡砖把庇护所围起来，然后捡瓶子
      const blocked = missing.filter((i) => w.items[i]);
      const itemGoals = (pred: (i: number) => boolean) => {
        const out: Goal[] = [];
        w.items.forEach((it, i) => it && pred(i) && out.push({ stand: i, act: true }));
        return out;
      };
      if (blocked.length) goal = best(blocked.map((i) => ({ stand: i, act: true })));
      if (!goal && missing.length) goal = best(itemGoals((i) => w.items[i]!.kind === 'brick' && !this.interiorTiles.includes(i)));
      // 地上没砖了：去拆别人没闭合的墙
      if (!goal && missing.length) goal = best(this.wallGoals((o) => o !== a.id && !w.closed.has(o), () => true));
      if (w.t >= this.raidRollAt) {
        this.raidRollAt = w.t + 8;
        this.raiding = Math.random() < C.ai.raidChance;
      }
      if (!goal && !missing.length && this.raiding && this.richestRival() !== null)
        goal = best(itemGoals((i) => w.items[i]!.kind === 'shovel'));
      if (!goal) goal = best(itemGoals((i) => w.items[i]!.kind === 'bottle' && !this.interiorTiles.includes(i)));
      if (!goal && !this.interiorTiles.includes(w.idx(a.cx, a.cy))) goal = best(this.interiorTiles.map((i) => ({ stand: i, act: false })));
    }

    this.goal = goal;
    this.path = goal ? this.trace(prev, goal.stand) : [];
  }

  /** 站在墙旁边、面朝墙按键的所有位置。owner 过滤墙的主人，standOk 过滤站的位置 */
  private wallGoals(owner: (o: number) => boolean, standOk: (stand: number) => boolean): Goal[] {
    const w = this.w;
    const out: Goal[] = [];
    w.walls.forEach((o, i) => {
      if (o === -1 || !owner(o)) return;
      const x = i % w.cols;
      const y = (i / w.cols) | 0;
      for (const d of DIR_LIST) {
        const sx = x - DIRS[d][0];
        const sy = y - DIRS[d][1];
        if (w.inBounds(sx, sy) && standOk(w.idx(sx, sy))) out.push({ stand: w.idx(sx, sy), face: d, act: true });
      }
    });
    return out;
  }

  private dropHere(): Goal {
    return { stand: this.w.idx(this.actor.cx, this.actor.cy), act: true };
  }

  private richestRival() {
    const w = this.w;
    let pick: number | null = null;
    let top: number = C.ai.raidMinScore - 1;
    for (const o of w.closed) {
      if (o === this.actor.id) continue;
      const s = w.score(o);
      if (s > top) (top = s), (pick = o);
    }
    return pick;
  }

  /** 拿着铁锹：找分数最高的对手，站在它庇护所外面挖一块墙 */
  private raidTarget(best: (c: Goal[]) => Goal | null): Goal | null {
    const victim = this.richestRival();
    if (victim === null) return null;
    return best(this.wallGoals((o) => o === victim, (stand) => this.w.interior[stand] !== victim));
  }

  // ───────── 寻路（网格 BFS） ─────────

  private bfs() {
    const w = this.w;
    const a = this.actor;
    const n = w.cols * w.rows;
    const dist = new Int16Array(n).fill(-1);
    const prev = new Int16Array(n).fill(-1);
    const start = w.idx(a.cx, a.cy);
    dist[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % w.cols;
      const y = (i / w.cols) | 0;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx;
        const ny = y + dy;
        if (!w.passable(a, nx, ny)) continue;
        const j = w.idx(nx, ny);
        if (dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        prev[j] = i;
        q.push(j);
      }
    }
    return { dist, prev };
  }

  private trace(prev: Int16Array, to: number) {
    const out: number[] = [];
    for (let i = to; i !== -1; i = prev[i]) out.unshift(i);
    return out;
  }
}
