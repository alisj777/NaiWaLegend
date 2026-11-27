import Phaser from 'phaser';
import { STAGE3 as C } from '../config/stage3';
import { STAGE3_TEXT as TX } from '../copy/stage3';
import { Button, THEME, bodyText, titleText } from '../battle/ui';
import { Ch3Result, drinkBottle, loadEggs, loadShelters, saveCh3Result, saveLevel, unlockAchievement } from '../progress';
import { STAGE4_TEXT } from '../copy/stage4';
import { AchievementId, showAchievements } from '../battle/achievements';
import { playJingle } from '../battle/music';
import { Actor } from '../stage1/world';
import { ROLE_IDS, RoleId, Servant, Stage3World, Team, randomTeam } from '../stage3/world';
import { ImgKey, K, T, Stage1Scene, dashedRect, px, py } from './Stage1Scene';

/** 两队的颜色：脚下的圈、血条 */
const TEAM_COLOR: Record<Team, number> = { good: 0x7dff9a, dark: 0xb57aff };

/** 进场景时带的参数：分到哪队、选了什么角色；没选角色时先弹选角色 */
export interface Stage3Data {
  team?: Team;
  role?: RoleId;
  /** 再来一局时跳过开场引导 */
  skipIntro?: boolean;
  /** 这一轮是因为你被天雷劈黑化才开始的（成就判断用） */
  turned?: boolean;
}

/**
 * 第三章「分化」：继承第一关的场景（双镜头、四角信息、摇杆、开场引导），换掉：
 *   开局：随机分阵营 → 选角色（随机或自选）→ 引导 → 开打
 *   玩法：奶家队 5 vs 暗派 3，奶蛙踢人，倒下后复活，比金币（规则在 src/stage3/world.ts）
 * 文案在 src/copy/stage3.ts，数值在 src/config/stage3.ts。
 */
export class Stage3Scene extends Stage1Scene {
  private w3!: Stage3World;
  private data3: Stage3Data = {};
  /** 奶仆、炸弹蛋、奶屎的图片，按编号复用；眩晕星星按角色编号 */
  private propImgs = new Map<string, Phaser.GameObjects.Image>();
  /** 点选中的奶仆（再点庇护所空格放进去） */
  private picked: Servant | null = null;
  private toldTap = false;

  constructor() {
    super('Stage3');
  }

  init(data?: Stage3Data) {
    super.init();
    this.propImgs = new Map();
    this.picked = null;
    this.toldTap = false;
    this.data3 = { ...(data ?? {}) };
    this.data3.team ??= randomTeam();
  }

  // ───────── 覆盖第一关的设定 ─────────

  protected hudTitle() {
    return TX.title;
  }
  protected hudLevel() {
    return TX.levelTag;
  }
  protected boardTitle() {
    return TX.hud.board;
  }
  protected boardCount() {
    return 2;
  }
  protected bgm() {
    return 'doom' as const;
  }
  protected introPages() {
    return TX.intro.pages;
  }

  protected createWorld() {
    const w = (this.w3 = new Stage3World());
    this.world = w;
    // 还没选角色时先按奶蛙摆一个场面，选好后带着选择重开场景
    w.setup(this.data3.team!, this.data3.role ?? 'frog');
    // 两队都放上第一关存下的庇护所；第二关救下的奶蛋开局就是你这一队的奶仆
    w.placeShelters(loadShelters());
    w.inheritEggs(loadEggs());
    w.drink = drinkBottle;
    this.me = w.player;
  }

  protected showIntro() {
    if (!this.data3.role) return this.showPick();
    if (this.data3.skipIntro) return this.onIntroDone();
    super.showIntro();
  }

  protected onIntroDone() {
    this.running = true;
    this.toast(TX.toast.start, '#7dff9a');
    const n = this.w3.servants.length;
    if (n) this.toast(TX.toast.inherited(n), '#ffe08a');
  }

  protected onAction() {
    if (this.running) this.w3.act(this.me);
  }

  // ───────── 点奶仆放进庇护所 ─────────

  protected bindInput() {
    super.bindInput();
    // 点场地：点自己的奶仆选中它，再点自己庇护所里的空格放进去；点庇护所里的奶仆把它放出来。点中了这次点击就不当摇杆用
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.running || over.length) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const fx = (wp.x - px(0)) / T;
      const fy = (wp.y - py(0)) / T;
      if (this.tapField(fx, fy)) this.stick.cancel(p.id);
    });
  }

  private tapField(fx: number, fy: number) {
    const w = this.w3;
    const team = w.f(this.me).team;
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    if (this.picked && w.inBounds(cx, cy)) {
      const i = w.idx(cx, cy);
      if (w.store(this.me, this.picked, i)) {
        this.picked = null;
        return true;
      }
    }
    const s = w.servantNear(fx, fy);
    if (s && s.team === team && s.infectedAt < 0) {
      if (s.storedAt >= 0) {
        w.release(s);
        this.picked = null;
        return true;
      }
      if (Math.hypot(s.x - this.me.cx, s.y - this.me.cy) <= C.nursery.storeRange) {
        this.picked = this.picked === s ? null : s;
        return true;
      }
    }
    return false;
  }

  /** 你黑化了：这一轮结束，进入新一轮（你在暗派，重新选角色） */
  private showTurned() {
    this.finished = true;
    this.running = false;
    const layer = this.modal(480);
    layer.add(titleText(this, 640, 170, TX.toast.turnedTitle, 44).setOrigin(0.5).setColor('#8a5ad0'));
    layer.add(bodyText(this, 640, 236, TX.toast.youTurned, 20, 700).setOrigin(0.5).setAlign('center'));
    this.addStats(layer, 290);
    this.popAchievements();
    new Button(this, 545, 495, 190, 60, TX.toast.nextRound, () => this.scene.restart({ team: 'dark', skipIntro: true, turned: true } satisfies Stage3Data), THEME.orange).setDepth(101);
    this.cameras.main.flash(500, 180, 120, 255);
  }

  // ───────── 选角色 ─────────

  /** 角色在某一队的图（选角色卡片和场上共用） */
  private roleImage(role: RoleId, team: Team, facing = 'down'): ImgKey | null {
    const dark = team === 'dark';
    const k = ((): string => {
      switch (role) {
        case 'frog':
          return `${dark ? 'dafrog' : 'afrog'}_${facing}`;
        case 'powder':
          return `${dark ? 'dpowder' : 'powder'}_${facing}`;
        case 'chicken':
          return dark ? 'dark_chicken' : 'chicken';
        case 'dog':
          return dark ? 'dark_dog' : 'dog';
        case 'mouse':
          return dark ? 'dark_mouse' : 'mouse';
      }
    })();
    return this.has(k as ImgKey) ? (k as ImgKey) : null;
  }

  /**
   * 选角色：顶部恭喜升级、你被分到哪队；五张角色卡（点一下看说明），「随机」直接随机一个开打，「开始」用选中的。
   * 选好后带着选择重开场景（这样场上的角色按选择重新摆）。
   */
  private showPick() {
    const P = TX.pick;
    const team = this.data3.team!;
    const layer = this.modal(560);
    const c = this.add.container(0, 0).setDepth(101);
    c.add(titleText(this, 640, 122, P.title, 34).setOrigin(0.5));
    c.add(bodyText(this, 640, 168, P.sub, 18).setOrigin(0.5));
    c.add(
      bodyText(this, 640, 202, P.youAre(TX.teams[team]), 20)
        .setOrigin(0.5)
        .setColor(team === 'good' ? '#2e7d32' : '#6a3ea1')
        .setFontStyle('bold'),
    );
    const desc = bodyText(this, 640, 455, '', 17, 700).setOrigin(0.5, 0).setAlign('center');
    c.add(desc);
    const frames = this.add.graphics();
    c.add(frames);
    let chosen: RoleId | null = null;
    const btns: Button[] = [];
    const go = (role: RoleId) => {
      btns.forEach((b) => b.destroy());
      layer.destroy();
      c.destroy();
      this.scene.restart({ team, role, skipIntro: this.data3.skipIntro, turned: this.data3.turned } satisfies Stage3Data);
    };
    const cw = 140;
    const x0 = 640 - (ROLE_IDS.length * cw + (ROLE_IDS.length - 1) * 12) / 2;
    const select = (k: number) => {
      chosen = ROLE_IDS[k];
      const r = TX.roles[chosen];
      desc.setText(`${r.name}（${r.cls}）：${r.desc}`);
      frames.clear().lineStyle(4, 0xe0902a, 1).strokeRoundedRect(x0 + k * (cw + 12), 228, cw, 214, 16);
      start.setEnabled(true);
    };
    ROLE_IDS.forEach((role, k) => {
      const x = x0 + k * (cw + 12);
      const card = this.add.rectangle(x, 228, cw, 214, 0xfff6e0, 0.7).setOrigin(0).setStrokeStyle(2, 0xd8b98a).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => select(k));
      c.add(card);
      const img = this.roleImage(role, team);
      if (img) {
        const im = this.add.image(x + cw / 2, 310, K(img));
        im.setScale(Math.min(130 / im.height, 120 / im.width));
        c.add(im);
      }
      c.add(bodyText(this, x + cw / 2, 384, TX.roles[role].name, 20).setOrigin(0.5).setFontStyle('bold'));
      c.add(bodyText(this, x + cw / 2, 414, TX.roles[role].cls, 15).setOrigin(0.5).setColor('#8a6a40'));
    });
    btns.push(new Button(this, 440, 528, 190, 60, P.random, () => go(ROLE_IDS[(Math.random() * ROLE_IDS.length) | 0]), THEME.blue));
    const start = new Button(this, 650, 528, 190, 60, P.start, () => chosen && go(chosen), THEME.orange);
    start.setEnabled(false);
    btns.push(start);
    btns.forEach((b) => b.setDepth(101));
  }

  // ───────── 角色画面 ─────────

  protected bodyTexture(a: Actor): ImgKey | null {
    const w = this.w3;
    if (!w) return null;
    const f = w.f(a);
    // 奶蛙踢腿时换成踢腿图
    if (f.role === 'frog' && w.t < f.kickUntil) {
      const k = (f.team === 'dark' ? 'dafrog_kick' : 'afrog_kick') as ImgKey;
      if (this.has(k)) return k;
    }
    return this.roleImage(f.role, f.team, a.facing);
  }

  /** 各角色在场上的身高（相对格子） */
  private bodyHeight(role: RoleId, kicking: boolean) {
    const h = { frog: 1.25, powder: 1.15, chicken: 1.0, dog: 0.95, mouse: 0.9 }[role];
    return T * (kicking ? h * 1.05 : h);
  }

  protected renderActor(a: Actor) {
    super.renderActor(a);
    const v = this.views.get(a.id);
    if (!v?.body) return;
    const f = this.w3.f(a);
    const kicking = f.role === 'frog' && this.w3.t < f.kickUntil;
    v.body.setScale(this.bodyHeight(f.role, kicking) / v.body.height).setOrigin(0.5, 0.75);
    // 单张图的角色按左右翻转：奶鸡图朝右，奶狗朝左；踢腿图朝右
    const facesRight = f.role === 'chicken' || kicking;
    const facesLeft = f.role === 'dog';
    v.body.setFlipX((facesRight && a.facing === 'left') || (facesLeft && a.facing === 'right'));
    // 眩晕时变灰一点
    v.body.setTint(this.w3.isStunned(a) ? 0xb0b0b0 : 0xffffff);
    // 第三章里队友站在自己队的庇护所里很正常，不显示第一关的"被囚禁"
    v.tag.setVisible(false);
  }

  /** 取一张场地上的图片（没有就新建），这一帧用到的记进 used */
  private prop(id: string, key: ImgKey, used: Set<string>) {
    used.add(id);
    let img = this.propImgs.get(id);
    if (!img) {
      img = this.W(this.add.image(0, 0, K(key)).setDepth(8));
      this.propImgs.set(id, img);
    } else if (img.texture.key !== K(key)) img.setTexture(K(key));
    return img.setVisible(true);
  }

  /** 奶仆、炸弹蛋、奶屎、眩晕星星 */
  private renderProps() {
    const w = this.w3;
    const used = new Set<string>();
    const blink = (left: number) => left < 1.5 && Math.floor(w.t * 8) % 2 === 0;
    for (const p of w.poops) {
      if (!this.has('poop')) break;
      const img = this.prop(`p${p.id}`, 'poop', used);
      img.setPosition(px(p.x), py(p.y) + T * 0.1).setScale((T * 0.5) / img.height).setDepth(6);
    }
    for (const b of w.bombs) {
      if (!this.has('egg_bomb')) break;
      const img = this.prop(`b${b.id}`, 'egg_bomb', used);
      img.setPosition(px(b.x), py(b.y)).setScale((T * 0.62) / img.height).setDepth(8).setAlpha(blink(b.at - w.t) ? 0.4 : 1);
    }
    for (const s of w.servants) {
      const infected = s.infectedAt >= 0;
      const dark = s.team === 'dark';
      // 庇护所里长大：奶蛋 → 小奶蛙 → 奶蛙
      const grown: ImgKey[] = dark ? ['dark_servant', 'dfrog_down', 'dafrog_down'] : ['egg_down', 'frog_down', 'afrog_down'];
      const key: ImgKey = infected ? (w.t - s.infectedAt > C.servant.bombAfter - 1.5 ? 'egg_bomb' : 'egg_infected') : grown[s.stage];
      if (!this.has(key)) continue;
      const img = this.prop(`s${s.id}`, key, used);
      const hop = infected || s.storedAt >= 0 ? 0 : Math.abs(Math.sin(w.t * 6 + s.id)) * T * 0.06;
      const size = [0.5, 0.65, 0.85][s.stage];
      img.setPosition(px(s.x), py(s.y) - hop).setScale((T * size) / img.height).setDepth(9);
      img.setAlpha(infected && blink(s.infectedAt + C.servant.bombAfter - w.t) ? 0.4 : 1);
      // 想喝奶：头上一闪一闪的奶瓶
      if (s.thirsty && this.has('bottle_milk')) {
        const b = this.prop(`m${s.id}`, 'bottle_milk', used);
        b.setPosition(px(s.x), py(s.y) - T * (size * 0.5 + 0.35)).setScale((T * 0.35) / b.height).setDepth(31).setAlpha(Math.floor(w.t * 3) % 2 ? 1 : 0.45);
      }
    }
    for (const a of w.actors) {
      if (!w.isStunned(a) || w.isDown(a) || !this.has('stun')) continue;
      const v = this.views.get(a.id);
      if (!v) continue;
      const img = this.prop(`z${a.id}`, 'stun', used);
      img.setPosition(v.box.x, v.box.y - this.bodyHeight(w.f(a).role, false) * 0.85).setScale((T * 0.7) / img.width).setDepth(31).setAngle(w.t * 120);
    }
    for (const [id, img] of this.propImgs) {
      if (used.has(id)) continue;
      img.destroy();
      this.propImgs.delete(id);
    }
  }

  protected render() {
    super.render();
    this.renderProps();
    const w = this.w3;
    const ov = this.over;
    // 天雷预警：3×3 的范围一闪一闪
    const R = C.thunder.radius;
    for (const th of w.thunders) {
      const al = 0.35 + 0.3 * Math.sin(w.t * 14);
      const x = (th.x - R) * T + px(0) - T / 2;
      const y = (th.y - R) * T + py(0) - T / 2;
      this.fx.fillStyle(0xfff27a, al * 0.5).fillRect(x, y, T * (R * 2 + 1), T * (R * 2 + 1));
      this.fx.lineStyle(3, 0xfff27a, 0.9).strokeRect(x, y, T * (R * 2 + 1), T * (R * 2 + 1));
    }
    // 放奶仆：身边能点的自己的奶仆画黄框；选中后，庇护所里能放的空格画绿框
    if (this.running) {
      const team = w.f(this.me).team;
      const sz = T * 0.62;
      for (const sv of w.servants) {
        if (sv.team !== team || sv.infectedAt >= 0 || sv.storedAt >= 0 || Math.hypot(sv.x - this.me.cx, sv.y - this.me.cy) > C.nursery.storeRange) continue;
        const on = sv === this.picked;
        dashedRect(ov, px(sv.x) - sz / 2, py(sv.y) - sz / 2, sz, sz, 0xffd84a, on ? 1 : 0.55, Math.max(2, T / (on ? 10 : 16)), w.t);
      }
      if (this.picked) {
        for (const i of w.storeTargets(this.me, this.picked)) {
          dashedRect(ov, px(i % w.cols) - T / 2 + 2, py((i / w.cols) | 0) - T / 2 + 2, T - 4, T - 4, 0x7dff9a, 1, Math.max(2, T / 14), w.t);
        }
      }
      // 奶仆长大的进度圈
      for (const sv of w.servants) {
        if (sv.storedAt < 0 || sv.growAt < 0) continue;
        const total = sv.stage === 0 ? C.nursery.toFroglet : C.nursery.toFrog;
        const k = 1 - (sv.growAt - w.t) / total;
        ov.lineStyle(3, 0x7dff9a, 0.9).beginPath().arc(px(sv.x), py(sv.y) - T * 0.55, T * 0.16, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
      }
    }
    // 奶鼠啃砖的进度圈
    for (const a of w.actors) {
      const g = w.f(a).gnaw;
      if (!g) continue;
      const k = 1 - (g.until - w.t) / C.roles.mouse.gnaw;
      ov.lineStyle(4, 0xffb060, 0.95).beginPath().arc(px(g.i % w.cols), py((g.i / w.cols) | 0), T * 0.3, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
    }
    for (const a of w.actors) {
      if (w.isDown(a)) continue;
      const v = this.views.get(a.id);
      if (!v) continue;
      const f = w.f(a);
      const x = v.box.x;
      const y = v.box.y;
      // 脚下的队伍圈
      ov.lineStyle(Math.max(2, T / 26), TEAM_COLOR[f.team], 0.9).strokeEllipse(x, y + T * 0.32, T * 0.8, T * 0.26);
      // 头顶血条
      const bw = T * 0.8;
      const bh = Math.max(4, T * 0.08);
      const bx = x - bw / 2;
      const by = y - this.bodyHeight(f.role, false) * 0.8 - bh * 2;
      ov.fillStyle(0x000000, 0.45).fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, bh / 2);
      ov.fillStyle(f.team === 'good' ? 0x6fdc7f : 0xb57aff, 1).fillRoundedRect(bx, by, Math.max(bh, (bw * f.hp) / f.maxHp), bh, bh / 2);
    }
  }

  protected drainEvents() {
    const w = this.w3;
    const T3 = TX.toast;
    const myTeam = w.f(this.me).team;
    for (const e of w.events3) {
      if (e.type === 'explode') {
        this.explodeFx(e.x, e.y, e.r);
        continue;
      }
      if (e.type === 'infected') {
        this.toast(T3.servantInfected, '#ff8a80');
        continue;
      }
      if (e.type === 'thunderWave') {
        if (w.f(this.me).team === 'good') this.toast(T3.thunderComing, '#fff27a');
        continue;
      }
      if (e.type === 'strike') {
        this.boltFx(e.x, e.y);
        continue;
      }
      if (e.type === 'stored' || e.type === 'thirsty' || e.type === 'drank' || e.type === 'grew') {
        // 庇护所育儿的提示：只提示你这一队的
        if (e.team !== myTeam) continue;
        if (e.type === 'stored') this.toast(T3.stored, '#7dff9a');
        else if (e.type === 'thirsty') e.stage === 0 && this.toast(T3.eggThirsty, '#ffe08a');
        else if (e.type === 'drank') this.toast(e.ok ? T3.eggDrank : T3.noMilk, e.ok ? '#7dff9a' : '#ff8a80');
        else this.toast(e.stage === 1 ? T3.froglet : T3.grownFrog, '#ffe08a');
        continue;
      }
      const a = w.actor(e.id);
      const mine = a === this.me;
      if (e.type === 'turned') {
        if (!mine) this.toast(T3.turned(a.name), w.f(this.me).team === 'good' ? '#ff8a80' : '#c8a8ff');
        continue;
      }
      if (e.type === 'standIn') {
        this.toast(T3.standIn, '#ffe08a');
        this.floatText(px(a.cx), py(a.cy) - T, T3.standIn.slice(0, 6), '#ffe08a');
        continue;
      }
      if (e.type === 'gnawed') {
        this.toast(T3.gnawed(a.name), w.f(a).team === myTeam ? '#7dff9a' : '#ff8a80');
        continue;
      }
      if (e.type === 'lay') mine && this.toast(e.bomb ? T3.laidBomb : T3.laid, '#ffe08a');
      else if (e.type === 'stun') {
        this.floatText(px(a.cx), py(a.cy) - T, T3.stunned(e.n), '#ff9ad8');
        if (w.isStunned(this.me) && w.f(a).team !== myTeam && w.f(this.me).stunUntil - w.t > C.roles.powder.stun.duration - 0.1) this.toast(T3.youStunned, '#ff9ad8');
      } else if (e.type === 'steal') this.toast(e.what === 'servant' ? T3.stoleServant(a.name) : T3.stoleGold(a.name), w.f(a).team === myTeam ? '#7dff9a' : '#ff8a80');
      else if (e.type === 'thunderHit') mine && this.toast(T3.youThunder(e.hits), '#fff27a');
      else if (e.type === 'heal' || e.type === 'eat') this.floatText(px(a.cx), py(a.cy) - T * 0.9, '+1', '#7dff9a');
      else if (e.type === 'collect') {
        this.floatText(px(a.cx), py(a.cy) - T * 0.7, e.gold ? '+1 金币' : '奶屎 +1', e.gold ? '#ffd84a' : '#e8d29a');
        if (e.gold) this.toast(T3.goldFromPoop(a.name), w.f(a).team === myTeam ? '#ffd84a' : '#dddddd');
      } else if (e.type === 'hurt') this.floatText(px(a.cx), py(a.cy) - T * 0.9, `-${e.dmg}`, '#ff6a5a');
      else if (e.type === 'kick' && e.hit && (a === this.me || e.id === this.me.id)) this.cameras.main.shake(80, 0.003);
      else if (e.type === 'down') {
        if (a === this.me) this.toast(TX.toast.youDown(w.f(a).team === 'dark' ? C.darkRespawn : C.respawn), '#ff8a80');
        else this.toast(TX.toast.down(a.name), w.f(a).team === w.f(this.me).team ? '#ffb0a0' : '#c8f0c8');
      } else if (e.type === 'respawn' && a === this.me) this.toast(TX.toast.youRespawn, '#7dff9a');
    }
    w.events3.length = 0;
    super.drainEvents();
  }

  /** 天雷落下：有素材用紫色闪电图，没有就画一道折线 */
  private boltFx(cx: number, cy: number) {
    const x = px(cx);
    const y = py(cy);
    const R = C.thunder.radius;
    const flash = this.W(this.add.graphics().setDepth(39));
    flash.fillStyle(0xe6d0ff, 0.5).fillRect(x - T * (R + 0.5), y - T * (R + 0.5), T * (R * 2 + 1), T * (R * 2 + 1));
    this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
    if (this.has('thunder')) {
      const bolt = this.W(this.add.image(x, y + T * 0.4, K('thunder')).setOrigin(0.5, 1).setDepth(40));
      bolt.setScale((T * 5) / bolt.height).setAlpha(0);
      this.tweens.add({ targets: bolt, alpha: 1, duration: 60, yoyo: true, hold: 220, onComplete: () => bolt.destroy() });
      return;
    }
    const g = this.W(this.add.graphics().setDepth(40));
    g.lineStyle(Math.max(3, T / 14), 0xfffbd0);
    g.beginPath().moveTo(x + T * 0.6, y - T * 6);
    for (let k = 1; k < 6; k++) g.lineTo(x + Phaser.Math.Between(-T / 3, T / 3), y - T * 6 + k * T);
    g.lineTo(x, y).strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
  }

  private explodeFx(x: number, y: number, r: number) {
    const g = this.W(this.add.graphics({ x: px(x), y: py(y) }).setDepth(40));
    g.fillStyle(0xff8a3c, 0.85).fillCircle(0, 0, T * r);
    g.fillStyle(0xfff2a0, 0.9).fillCircle(0, 0, T * 0.6);
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1.2, alpha: 0, duration: 500, ease: 'Cubic.out', onComplete: () => g.destroy() });
    this.cameras.main.shake(150, 0.005);
  }

  protected renderHud() {
    const w = this.w3;
    const H = TX.hud;
    const left = Math.max(0, C.duration - w.t);
    this.timerText.setText(H.timeLeft(left)).setColor(left < 20 ? '#ff8a80' : '#ffffff');
    const thunder = w.thunders.length ? H.thunderNow : w.nextWave < C.duration ? H.thunderIn(Math.ceil(w.nextWave - w.t)) : '';
    this.eventText.setText([H.gold(w.gold.good, w.gold.dark), thunder].filter(Boolean).join('　·　'));
    const mine = w.f(this.me).team;
    (['good', 'dark'] as Team[]).forEach((team, k) => {
      const all = w.actors.filter((a) => w.f(a).team === team).length;
      this.boardRows[k].setText(H.teamRow(TX.teams[team], w.gold[team], w.standing(team).length, all, w.poopCount[team])).setColor(team === mine ? '#c0601a' : THEME.text);
    });
    const f = w.f(this.me);
    const lines = [H.me(TX.roles[f.role].name, TX.teams[f.team])];
    if (f.downUntil) lines.push(H.down(Math.ceil(f.downUntil - w.t)));
    else lines.push(H.hp(f.hp, f.maxHp), w.isStunned(this.me) ? H.stunned : f.team === 'good' ? H.hits(f.hits, w.teamHits) : '');
    this.statusText.setText(lines.join('\n'));
    this.actionBtn.setLabel(w.actionLabel(this.me));
  }

  // ───────── 主循环与结算 ─────────

  update(t: number, dtMs: number) {
    super.update(t, dtMs);
    if (this.w3.playerTurned && !this.finished) this.showTurned();
    else if (this.w3.outcome && !this.finished) this.finish();
    // 第一次有自己的奶仆时，提示怎么把它放进庇护所
    if (!this.toldTap && this.running && this.w3.servants.some((sv) => sv.team === this.w3.f(this.me).team)) {
      this.toldTap = true;
      this.toast(TX.toast.tapServant, '#ffe08a');
    }
    // 选中的奶仆没了（被偷、感染、爆炸）就取消选中
    if (this.picked && (!this.w3.servants.includes(this.picked) || this.picked.team !== this.w3.f(this.me).team || this.picked.infectedAt >= 0)) this.picked = null;
  }

  /** 这一轮新解锁的成就（第一次达成才算，并存档） */
  private newAchievements: AchievementId[] = [];

  /**
   * 判断这一轮的成就：复活次数、伤害；打完时再看输赢——
   *   开局就在奶家队（不是黑化过来的）且奶家队赢 → 西格玛奶蛙
   *   你在暗派、暗派赢 → 自我折磨
   *   你在暗派、奶家队赢、这一轮没伤到奶家队 → 超能串子（隐藏彩蛋）
   */
  private roundAchievements() {
    const w = this.w3;
    const ids: AchievementId[] = [];
    const o = w.outcome;
    const team = w.f(this.me).team;
    if (o && !w.playerTurned) {
      if (team === 'good' && !this.data3.turned && o.winner === 'good') ids.push('sigma');
      if (team === 'dark' && o.winner === 'dark') ids.push('selfTorment');
      if (team === 'dark' && o.winner === 'good' && !w.playerHurtGood) ids.push('superMole');
    }
    if (w.playerRespawns >= C.achieve.cantHold) ids.push('cantHold');
    if (w.playerDamage >= C.achieve.breaker) ids.push('breaker');
    this.newAchievements = ids.filter((id) => unlockAchievement(id));
    return this.newAchievements.map((id) => TX.achievements[id].name);
  }

  /** 结算弹窗出来后，依次弹出新成就的卡牌（超能串子是隐藏彩蛋，排第一个） */
  private popAchievements() {
    const list = [...this.newAchievements].sort((a, b) => (a === 'superMole' ? -1 : b === 'superMole' ? 1 : 0));
    if (!list.length) return;
    this.time.delayedCall(700, () => {
      // 第一次解锁隐藏彩蛋（超能串子）：放「串子第一次结算」
      if (list.includes('superMole')) playJingle(this, 'mole1');
      showAchievements(this, list.map((id) => ({ id, hidden: id === 'superMole' })));
    });
  }

  /** 结算里的统计和解锁的成就，从 y 往下排 */
  private addStats(layer: Phaser.GameObjects.Container, y: number) {
    const w = this.w3;
    const R = TX.result;
    layer.add(bodyText(this, 640, y, R.revived(w.playerRespawns), 19).setOrigin(0.5));
    layer.add(bodyText(this, 640, y + 32, R.damage(w.playerDamage), 19).setOrigin(0.5));
    this.roundAchievements().forEach((name, k) => {
      layer.add(bodyText(this, 640, y + 76 + k * 34, R.unlock(name), 22).setOrigin(0.5).setColor('#c0601a').setFontStyle('bold'));
    });
  }

  protected finish() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    const o = this.w3.outcome!;
    const R = TX.result;
    const mine = this.w3.f(this.me).team;
    const won = o.winner === mine;
    saveLevel(3);
    const layer = this.modal(500);
    layer.add(titleText(this, 640, 160, R.win(TX.teams[o.winner]), 44).setOrigin(0.5).setColor(o.winner === 'good' ? THEME.title : '#8a5ad0'));
    layer.add(bodyText(this, 640, 220, won ? R.youWin : R.youLose, 24).setOrigin(0.5).setColor(won ? '#2e7d32' : '#c0392b'));
    layer.add(bodyText(this, 640, 256, o.reason, 18).setOrigin(0.5));
    this.addStats(layer, 300);
    this.popAchievements();
    // 解锁第四章：奶家队赢（开局就在奶家队）、暗派赢、超能串子
    const ch4: Ch3Result | null =
      mine === 'good' && !this.data3.turned && o.winner === 'good' ? 'good' : mine === 'dark' && o.winner === 'dark' ? 'dark' : mine === 'dark' && !this.w3.playerHurtGood ? 'mole' : null;
    if (ch4) {
      saveCh3Result(ch4);
      saveLevel(4);
      layer.add(bodyText(this, 640, 450, STAGE4_TEXT.unlock, 20).setOrigin(0.5).setColor('#7a4ab0').setFontStyle('bold'));
    }
    // 再来一局：重新随机分阵营、重新选角色，跳过引导
    const btns = [
      new Button(this, ch4 ? 335 : 440, 505, 190, 60, R.again, () => this.scene.restart({ skipIntro: true } satisfies Stage3Data), THEME.orange),
      new Button(this, ch4 ? 545 : 650, 505, 190, 60, R.menu, () => this.scene.start('Menu'), THEME.blue),
    ];
    if (ch4) btns.push(new Button(this, 755, 505, 190, 60, STAGE4_TEXT.enter, () => this.scene.start('Stage4'), THEME.green));
    btns.forEach((b) => b.setDepth(101));
  }
}
