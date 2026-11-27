import { STAGE3 as C } from '../config/stage3';
import { STAGE3_TEXT as TX } from '../copy/stage3';
import { Button, THEME, bodyText, titleText } from '../battle/ui';
import { saveLevel } from '../progress';
import { Actor } from '../stage1/world';
import { ROLE_IDS, RoleId, Stage3World, Team, randomTeam } from '../stage3/world';
import { ImgKey, K, T, Stage1Scene, px, py } from './Stage1Scene';

/** 两队的颜色：脚下的圈、血条 */
const TEAM_COLOR: Record<Team, number> = { good: 0x7dff9a, dark: 0xb57aff };

/** 进场景时带的参数：分到哪队、选了什么角色；没选角色时先弹选角色 */
export interface Stage3Data {
  team?: Team;
  role?: RoleId;
  /** 再来一局时跳过开场引导 */
  skipIntro?: boolean;
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

  constructor() {
    super('Stage3');
  }

  init(data?: Stage3Data) {
    super.init();
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
  }

  protected onAction() {
    if (this.running) this.w3.act(this.me);
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
      this.scene.restart({ team, role, skipIntro: this.data3.skipIntro } satisfies Stage3Data);
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
  }

  protected render() {
    super.render();
    const w = this.w3;
    const ov = this.over;
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
    for (const e of w.events3) {
      const a = w.actor(e.id);
      if (e.type === 'hurt') this.floatText(px(a.cx), py(a.cy) - T * 0.9, `-${e.dmg}`, '#ff6a5a');
      else if (e.type === 'kick' && e.hit && (a === this.me || e.id === this.me.id)) this.cameras.main.shake(80, 0.003);
      else if (e.type === 'down') {
        if (a === this.me) this.toast(TX.toast.youDown(C.respawn), '#ff8a80');
        else this.toast(TX.toast.down(a.name), w.f(a).team === w.f(this.me).team ? '#ffb0a0' : '#c8f0c8');
      } else if (e.type === 'respawn' && a === this.me) this.toast(TX.toast.youRespawn, '#7dff9a');
    }
    w.events3.length = 0;
    super.drainEvents();
  }

  protected renderHud() {
    const w = this.w3;
    const H = TX.hud;
    const left = Math.max(0, C.duration - w.t);
    this.timerText.setText(H.timeLeft(left)).setColor(left < 20 ? '#ff8a80' : '#ffffff');
    this.eventText.setText(H.gold(w.gold.good, w.gold.dark));
    const mine = w.f(this.me).team;
    (['good', 'dark'] as Team[]).forEach((team, k) => {
      const all = w.actors.filter((a) => w.f(a).team === team).length;
      this.boardRows[k].setText(H.teamRow(TX.teams[team], w.gold[team], w.standing(team).length, all)).setColor(team === mine ? '#c0601a' : THEME.text);
    });
    const f = w.f(this.me);
    const lines = [H.me(TX.roles[f.role].name, TX.teams[f.team])];
    if (f.downUntil) lines.push(H.down(Math.ceil(f.downUntil - w.t)));
    else lines.push(H.hp(f.hp, f.maxHp), w.isStunned(this.me) ? H.stunned : '');
    this.statusText.setText(lines.join('\n'));
    this.actionBtn.setLabel(w.actionLabel(this.me));
  }

  // ───────── 主循环与结算 ─────────

  update(t: number, dtMs: number) {
    super.update(t, dtMs);
    if (this.w3.outcome && !this.finished) this.finish();
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
    const layer = this.modal(400);
    layer.add(titleText(this, 640, 190, R.win(TX.teams[o.winner]), 44).setOrigin(0.5).setColor(o.winner === 'good' ? THEME.title : '#8a5ad0'));
    layer.add(bodyText(this, 640, 258, won ? R.youWin : R.youLose, 24).setOrigin(0.5).setColor(won ? '#2e7d32' : '#c0392b'));
    layer.add(bodyText(this, 640, 300, o.reason, 18).setOrigin(0.5));
    // 再来一局：重新随机分阵营、重新选角色，跳过引导
    const btns = [
      new Button(this, 440, 380, 190, 60, R.again, () => this.scene.restart({ skipIntro: true } satisfies Stage3Data), THEME.orange),
      new Button(this, 650, 380, 190, 60, R.menu, () => this.scene.start('Menu'), THEME.blue),
    ];
    btns.forEach((b) => b.setDepth(101));
  }
}
