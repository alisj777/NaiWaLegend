import { STAGE1 as C } from '../config/stage1';
import { STAGE1_TEXT as TX } from '../copy/stage1';

/**
 * 第一关的玩法逻辑，不依赖 Phaser，只做网格上的规则计算。
 * 玩家和 AI 都只通过 setWantDir / face / act 三个指令操作，
 * 以后接入真人联机时，把指令换成网络消息即可。
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right'];

export type ItemKind = 'brick' | 'bottle' | 'shovel';
export type Fill = 'empty' | 'tea' | 'milk';
export interface Item {
  kind: ItemKind;
  fill: Fill;
}

export interface Actor {
  id: number;
  name: string;
  human: boolean;
  /** 逻辑位置（格） */
  cx: number;
  cy: number;
  /** 上一格，用来画移动动画 */
  fx: number;
  fy: number;
  /** 0~1 的移动进度，1 表示站定 */
  moveT: number;
  speed: number;
  facing: Dir;
  wantDir: Dir | null;
  carry: Item | null;
  /** 被狂风卷在空中，直到这个时间 */
  flyUntil: number;
  /** 被扔出场外的时刻起为 Infinity：无法返回，直接出局 */
  outUntil: number;
  /** 被狂风卷出场外、出局了 */
  gone: boolean;
  /** 最近一次原地转身的时刻（转身后要推住 turnHold 秒才开始走） */
  turnAt: number;
  /** 最近一次走完一格的时刻，用来判断是"站定后换方向"还是"边走边拐弯" */
  stepEndAt: number;
  actionReadyAt: number;
}

export interface Gust {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  activeAt: number;
  until: number;
  hit: Set<number>;
}

export interface Spring {
  cx: number;
  cy: number;
  fill: 'tea' | 'milk';
  until: number;
}

export type WorldEvent =
  | { type: 'toast'; text: string; actor?: number }
  /** 只给某个角色看的提示（比如按键没反应的原因） */
  | { type: 'hint'; text: string; actor: number }
  | { type: 'float'; x: number; y: number; text: string; color: string }
  | { type: 'wind' }
  | { type: 'spring'; fill: 'tea' | 'milk' }
  | { type: 'refresh' }
  | { type: 'prison'; prisoner: number; captor: number }
  | { type: 'free'; prisoner: number };

export const itemName = (it: Item) => (it.kind === 'bottle' ? TX.items[it.fill] : TX.items[it.kind]);

export class World {
  readonly cols = C.grid.cols;
  readonly rows = C.grid.rows;
  t = 0;
  ended = false;
  actors: Actor[] = [];
  /** 每格的墙，值为主人 id，-1 表示没有 */
  walls: Int16Array;
  items: (Item | null)[];
  /** 每格属于谁的闭合庇护所内部，-1 表示不属于任何人 */
  interior: Int16Array;
  /** 已闭合的庇护所主人（至少有一个闭合庇护所的人） */
  closed = new Set<number>();
  /**
   * 每块墙是不是"庇护所的墙"：紧挨着（上下左右或斜角）它主人的闭合庇护所内部才算。
   * 散落在外面的砖就算主人有别的闭合庇护所，也不算：显示成松散的样子、会被狂风吹走、别人可以直接捡走。
   */
  wallClosed: Uint8Array;
  /** 彩蛋：被关在别人闭合庇护所里的角色 → 关住他的人 */
  prisoners = new Map<number, number>();
  gusts: Gust[] = [];
  spring: Spring | null = null;
  /** AI 规划要盖庇护所的格子，刷新物资时避开 */
  reserved = new Set<number>();
  events: WorldEvent[] = [];

  private nextRefresh = C.refreshInterval;
  private nextWind = C.wind.firstAt;
  private nextSpring = C.spring.firstAt;
  private gustSeq = 0;
  /** 同分时的固定随机顺序（每局定一次，避免排行榜每帧跳动） */
  private tieBreak = new Map<number, number>();
  private dirty = true;

  constructor() {
    const n = this.cols * this.rows;
    this.walls = new Int16Array(n).fill(-1);
    this.items = new Array(n).fill(null);
    this.interior = new Int16Array(n).fill(-1);
    this.wallClosed = new Uint8Array(n);
  }

  // ───────── 基础工具 ─────────

  idx(x: number, y: number) {
    return y * this.cols + x;
  }
  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }
  addActor(a: Pick<Actor, 'id' | 'name' | 'human' | 'cx' | 'cy' | 'speed'>) {
    const actor: Actor = { ...a, fx: a.cx, fy: a.cy, moveT: 1, facing: 'down', wantDir: null, carry: null, flyUntil: 0, outUntil: 0, gone: false, turnAt: -1, stepEndAt: -1, actionReadyAt: 0 };
    this.actors.push(actor);
    return actor;
  }
  actor(id: number) {
    return this.actors.find((a) => a.id === id)!;
  }
  isSpring(x: number, y: number) {
    return !!this.spring && this.spring.cx === x && this.spring.cy === y;
  }
  /** 这个角色能不能走进这一格：自己的墙可以穿过，别人的不行（所以被关起来就出不去，彩蛋） */
  passable(a: Actor, x: number, y: number) {
    if (!this.inBounds(x, y) || this.isSpring(x, y)) return false;
    const w = this.walls[this.idx(x, y)];
    return w === -1 || w === a.id;
  }
  isBusy(a: Actor) {
    return this.t < a.flyUntil || this.t < a.outUntil;
  }
  actorAt(x: number, y: number) {
    return this.actors.find((a) => a.outUntil <= this.t && a.cx === x && a.cy === y);
  }
  /** 一格是否空着，可以放砖或放物资 */
  free(x: number, y: number, ignoreActors = false) {
    if (!this.inBounds(x, y) || this.isSpring(x, y)) return false;
    const i = this.idx(x, y);
    if (this.walls[i] !== -1 || this.items[i]) return false;
    return ignoreActors || !this.actorAt(x, y);
  }
  facingTile(a: Actor) {
    const [dx, dy] = DIRS[a.facing];
    return { x: a.cx + dx, y: a.cy + dy };
  }
  /** 这块墙是不是闭合庇护所的一部分 */
  isWallClosed(i: number) {
    return this.walls[i] !== -1 && this.wallClosed[i] === 1;
  }

  /** 空手能不能直接把这块墙举起来：自己的随时可以，别人的只有不属于闭合庇护所时可以 */
  canLiftWall(a: Actor, i: number) {
    const o = this.walls[i];
    return o !== -1 && (o === a.id || !this.isWallClosed(i));
  }

  // ───────── 庇护所闭合判断 ─────────

  /**
   * 对每个主人：从场地边缘出发，只把他自己的墙当障碍做洪水填充，
   * 走不到、又不是墙的格子就是他闭合庇护所的内部。四方向连通，所以墙角可以不放砖。
   */
  private recomputeInteriors() {
    this.interior.fill(-1);
    this.closed.clear();
    const owners = new Set<number>();
    for (const w of this.walls) if (w !== -1) owners.add(w);
    const n = this.cols * this.rows;
    const seen = new Uint8Array(n);
    for (const o of owners) {
      seen.fill(0);
      const q: number[] = [];
      const push = (x: number, y: number) => {
        const i = this.idx(x, y);
        if (seen[i] || this.walls[i] === o) return;
        seen[i] = 1;
        q.push(i);
      };
      for (let x = 0; x < this.cols; x++) push(x, 0), push(x, this.rows - 1);
      for (let y = 0; y < this.rows; y++) push(0, y), push(this.cols - 1, y);
      while (q.length) {
        const i = q.pop()!;
        const x = i % this.cols;
        const y = (i / this.cols) | 0;
        for (const [dx, dy] of Object.values(DIRS)) if (this.inBounds(x + dx, y + dy)) push(x + dx, y + dy);
      }
      let any = false;
      for (let i = 0; i < n; i++) {
        if (!seen[i] && this.walls[i] !== o && this.interior[i] === -1) {
          this.interior[i] = o;
          any = true;
        }
      }
      if (any) this.closed.add(o);
    }
    // 逐块判断：墙的 8 个邻格里有它主人的庇护所内部，才算"庇护所的墙"
    this.wallClosed.fill(0);
    for (let i = 0; i < n; i++) {
      const o = this.walls[i];
      if (o === -1) continue;
      const x = i % this.cols;
      const y = (i / this.cols) | 0;
      for (let dy = -1; dy <= 1 && !this.wallClosed[i]; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && this.inBounds(x + dx, y + dy) && this.interior[this.idx(x + dx, y + dy)] === o) {
            this.wallClosed[i] = 1;
            break;
          }
        }
    }
    this.dirty = false;
    this.updatePrisoners();
  }

  /** 彩蛋：站在别人闭合庇护所内部的角色就是被囚禁了 */
  private updatePrisoners() {
    for (const a of this.actors) {
      const captor = a.outUntil > this.t ? -1 : this.interior[this.idx(a.cx, a.cy)];
      const was = this.prisoners.get(a.id);
      if (captor !== -1 && captor !== a.id) {
        if (was !== captor) {
          this.prisoners.set(a.id, captor);
          this.events.push({ type: 'prison', prisoner: a.id, captor });
        }
      } else if (was !== undefined) {
        this.prisoners.delete(a.id);
        this.events.push({ type: 'free', prisoner: a.id });
      }
    }
  }

  private markDirty() {
    this.dirty = true;
  }

  score(owner: number) {
    let s = 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it?.kind === 'bottle' && this.interior[i] === owner) s += it.fill === 'empty' ? C.score.emptyBottle : C.score.fullBottle;
    }
    return s;
  }

  /** 排名：出局的排最后；其余分数高在前，同分随机 */
  ranking() {
    return this.actors
      .map((a) => {
        if (!this.tieBreak.has(a.id)) this.tieBreak.set(a.id, Math.random());
        return { actor: a, score: this.score(a.id), tie: this.tieBreak.get(a.id)! };
      })
      .sort((p, q) => Number(p.actor.gone) - Number(q.actor.gone) || q.score - p.score || p.tie - q.tie);
  }

  /** 这个人所有闭合庇护所里的瓶子（空瓶 / 奶茶 / 奶瓶），过关时累积到存档 */
  bottlesIn(owner: number) {
    let empty = 0;
    let tea = 0;
    let milk = 0;
    this.items.forEach((it, i) => {
      if (it?.kind !== 'bottle' || this.interior[i] !== owner) return;
      if (it.fill === 'empty') empty++;
      else if (it.fill === 'tea') tea++;
      else milk++;
    });
    return { empty, tea, milk };
  }

  /** 庇护所里的满瓶（带进下一关当道具） */
  fullBottles(owner: number) {
    let tea = 0;
    let milk = 0;
    this.items.forEach((it, i) => {
      if (it?.kind !== 'bottle' || this.interior[i] !== owner) return;
      if (it.fill === 'tea') tea++;
      if (it.fill === 'milk') milk++;
    });
    return { tea, milk };
  }

  // ───────── 指令 ─────────

  setWantDir(a: Actor, d: Dir | null) {
    a.wantDir = d;
  }

  face(a: Actor, d: Dir) {
    if (!this.isBusy(a)) a.facing = d;
  }

  /** 举起键现在会做什么，给按钮显示用 */
  actionLabel(a: Actor): string {
    const L = TX.action;
    if (this.isBusy(a)) return L.flying;
    const f = this.facingTile(a);
    const fi = this.inBounds(f.x, f.y) ? this.idx(f.x, f.y) : -1;
    if (!a.carry) {
      const it = this.items[this.idx(a.cx, a.cy)] ?? (fi >= 0 ? this.items[fi] : null);
      if (it) return L.pickUp(itemName(it));
      if (fi >= 0 && this.canLiftWall(a, fi)) return this.walls[fi] === a.id ? L.takeBackBrick : L.takeBrick;
      return L.idle;
    }
    if (a.carry.kind === 'brick') return this.free(f.x, f.y) ? L.placeBrick : L.dropBrick;
    if (a.carry.kind === 'shovel') return fi >= 0 && this.walls[fi] !== -1 ? L.dig : L.dropShovel;
    return L.drop(itemName(a.carry));
  }

  act(a: Actor) {
    if (this.ended || this.isBusy(a) || this.t < a.actionReadyAt) return false;
    a.actionReadyAt = this.t + C.actionCooldown;
    const here = this.idx(a.cx, a.cy);
    const f = this.facingTile(a);
    const fIn = this.inBounds(f.x, f.y);
    const fi = fIn ? this.idx(f.x, f.y) : -1;

    if (!a.carry) {
      // 先捡脚下的，再捡面前的，最后试着把面前的墙举起来
      const at = this.items[here] ? here : fIn && this.items[fi] ? fi : -1;
      if (at >= 0) {
        a.carry = this.items[at];
        this.items[at] = null;
        const owner = this.interior[at];
        if (owner !== -1 && owner !== a.id && a.carry?.kind === 'bottle') {
          this.events.push({ type: 'toast', text: TX.toast.stole(a.name, this.actor(owner).name, itemName(a.carry)), actor: a.id });
        }
        return true;
      }
      if (fIn && this.canLiftWall(a, fi)) {
        this.walls[fi] = -1;
        a.carry = { kind: 'brick', fill: 'empty' };
        this.markDirty();
        return true;
      }
      if (fIn && this.walls[fi] !== -1) this.events.push({ type: 'hint', text: TX.toast.needShovel, actor: a.id });
      return false;
    }

    const item = a.carry;
    if (item.kind === 'brick' && this.free(f.x, f.y)) {
      this.walls[fi] = a.id;
      a.carry = null;
      this.markDirty();
      return true;
    }
    if (item.kind === 'shovel' && fIn && this.walls[fi] !== -1) {
      const owner = this.walls[fi];
      this.walls[fi] = -1;
      this.items[fi] = { kind: 'brick', fill: 'empty' };
      this.markDirty();
      if (owner !== a.id) this.events.push({ type: 'toast', text: TX.toast.dug(a.name, this.actor(owner).name), actor: a.id });
      return true;
    }
    // 其他情况：放在脚下，脚下有东西就放在面前
    if (!this.items[here]) {
      this.items[here] = item;
    } else if (this.free(f.x, f.y)) {
      this.items[fi] = item;
    } else {
      return false;
    }
    a.carry = null;
    return true;
  }

  // ───────── 主循环 ─────────

  update(dt: number) {
    if (this.ended) return;
    if (this.dirty) this.recomputeInteriors();
    this.t += dt;

    if (this.t >= this.nextRefresh) {
      this.nextRefresh += C.refreshInterval;
      this.spawnItems(false);
      this.events.push({ type: 'refresh' });
    }
    if (this.t >= this.nextWind) {
      this.nextWind += C.wind.interval;
      this.spawnWind();
    }
    if (this.t >= this.nextSpring && this.t < C.duration) {
      this.nextSpring += C.spring.interval;
      this.spawnSpring();
    }
    if (this.spring && this.t >= this.spring.until) this.spring = null;

    for (const a of this.actors) this.updateActor(a, dt);
    this.updateGusts(dt);
    if (this.dirty) this.recomputeInteriors();
    else this.updatePrisoners();

    if (this.t >= C.duration) this.ended = true;
  }

  private updateActor(a: Actor, dt: number) {
    if (a.outUntil > 0 && this.t >= a.outUntil) {
      // 从场边回来
      const p = this.randomTile((x, y) => (x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1) && this.passable(a, x, y) && this.interior[this.idx(x, y)] === -1);
      a.outUntil = 0;
      if (p) (a.cx = a.fx = p.x), (a.cy = a.fy = p.y);
      a.moveT = 1;
    }
    if (this.isBusy(a)) return;
    if (a.moveT < 1) {
      a.moveT = Math.min(1, a.moveT + dt * C.moveTilesPerSec * a.speed);
      if (a.moveT >= 1) a.stepEndAt = this.t;
    }
    if (a.moveT >= 1 && a.wantDir) {
      // 玩家站定后换方向：先原地转身，推住超过 turnHold 秒才走（边走边拐弯不受影响，AI 也不受影响）
      const standing = this.t - a.stepEndAt > 0.05;
      let step = true;
      if (a.human && standing && a.wantDir !== a.facing) {
        a.facing = a.wantDir;
        a.turnAt = this.t;
        step = false;
      } else if (a.human && standing && this.t - a.turnAt < C.turnHold) {
        step = false;
      }
      if (step) {
        a.facing = a.wantDir;
        const [dx, dy] = DIRS[a.wantDir];
        if (this.passable(a, a.cx + dx, a.cy + dy)) {
          a.fx = a.cx;
          a.fy = a.cy;
          a.cx += dx;
          a.cy += dy;
          a.moveT = 0;
        }
      }
    }
    // 举着空瓶站到灵泉边，自动装满
    const sp = this.spring;
    if (sp && a.carry?.kind === 'bottle' && a.carry.fill === 'empty' && Math.abs(a.cx - sp.cx) <= 1 && Math.abs(a.cy - sp.cy) <= 1) {
      a.carry.fill = sp.fill;
      this.events.push({ type: 'float', x: a.cx, y: a.cy, text: TX.toast.filled(TX.items[sp.fill]), color: '#ffe08a' });
    }
  }

  // ───────── 物资刷新 ─────────

  private randomTile(ok: (x: number, y: number) => boolean) {
    for (let k = 0; k < 400; k++) {
      const x = (Math.random() * this.cols) | 0;
      const y = (Math.random() * this.rows) | 0;
      if (ok(x, y)) return { x, y };
    }
    return null;
  }

  private spawnable = (x: number, y: number) => {
    const i = this.idx(x, y);
    return this.free(x, y) && this.interior[i] === -1 && !this.reserved.has(i);
  };

  spawnItems(initial: boolean) {
    if (this.dirty) this.recomputeInteriors();
    for (const kind of ['brick', 'bottle', 'shovel'] as ItemKind[]) {
      const cfg = C.items[kind];
      const onGround = this.items.filter((it) => it?.kind === kind).length;
      const n = Math.min(initial ? cfg.initial : cfg.perRefresh, cfg.cap - onGround);
      for (let k = 0; k < n; k++) {
        const p = this.randomTile(this.spawnable);
        if (p) this.items[this.idx(p.x, p.y)] = { kind, fill: 'empty' };
      }
    }
  }

  // ───────── 灵泉 ─────────

  private spawnSpring() {
    const p = this.randomTile((x, y) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!this.inBounds(x + dx, y + dy)) return false;
          const i = this.idx(x + dx, y + dy);
          if (this.walls[i] !== -1 || this.interior[i] !== -1) return false;
        }
      return !this.items[this.idx(x, y)] && !this.actorAt(x, y);
    });
    if (!p) return;
    const fill = Math.random() < C.spring.teaChance ? 'tea' : 'milk';
    this.spring = { cx: p.x, cy: p.y, fill, until: this.t + C.spring.duration };
    this.events.push({ type: 'spring', fill });
  }

  // ───────── 狂风 ─────────

  private spawnWind() {
    const W = C.wind;
    for (let k = 0; k < W.gustsPerWave; k++) {
      const a = Math.random() * Math.PI * 2;
      this.gusts.push({
        id: this.gustSeq++,
        x: 2 + Math.random() * (this.cols - 4),
        y: 2 + Math.random() * (this.rows - 4),
        vx: Math.cos(a) * W.drift,
        vy: Math.sin(a) * W.drift,
        activeAt: this.t + W.warnTime,
        until: this.t + W.warnTime + W.duration,
        hit: new Set(),
      });
    }
    this.events.push({ type: 'wind' });
  }

  private updateGusts(dt: number) {
    const W = C.wind;
    this.gusts = this.gusts.filter((g) => this.t < g.until);
    for (const g of this.gusts) {
      if (this.t < g.activeAt) continue;
      g.x = Math.max(0, Math.min(this.cols - 1, g.x + g.vx * dt));
      g.y = Math.max(0, Math.min(this.rows - 1, g.y + g.vy * dt));
      const near = (x: number, y: number) => (x - g.x) ** 2 + (y - g.y) ** 2 <= W.radius ** 2;

      // 没闭合的庇护所，砖块被卷走
      for (let i = 0; i < this.walls.length; i++) {
        const o = this.walls[i];
        if (o === -1 || this.isWallClosed(i)) continue;
        if (near(i % this.cols, (i / this.cols) | 0)) {
          this.walls[i] = -1;
          this.markDirty();
        }
      }

      for (const a of this.actors) {
        if (g.hit.has(a.id) || this.isBusy(a) || !near(a.cx, a.cy)) continue;
        // 躲在闭合庇护所里的人（包括被囚禁的）不会被卷走
        if (this.interior[this.idx(a.cx, a.cy)] !== -1) continue;
        g.hit.add(a.id);
        this.throwActor(a);
      }
    }
  }

  private throwActor(a: Actor) {
    const W = C.wind;
    a.fx = a.cx;
    a.fy = a.cy;
    a.moveT = 1;
    a.wantDir = null;
    if (Math.random() < W.outChance) {
      // 飘出场外：无法返回，直接出局（手上的物资也没了）
      a.carry = null;
      a.gone = true;
      a.flyUntil = this.t + W.flyTime;
      a.outUntil = Infinity;
      this.events.push({ type: 'toast', text: TX.toast.blownOut(a.name), actor: a.id });
      return;
    }
    const p = this.randomTile((x, y) => this.passable(a, x, y) && this.interior[this.idx(x, y)] === -1);
    if (p) {
      a.cx = p.x;
      a.cy = p.y;
    }
    a.flyUntil = this.t + W.flyTime;
    this.events.push({ type: 'toast', text: TX.toast.blownAway(a.name), actor: a.id });
  }
}
