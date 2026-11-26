import Phaser from 'phaser';
import { fitScreen, fullBg } from '../battle/layout';
import { BALANCE } from '../config/balance';
import { currentSkin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';

const D = BALANCE.duel;
const SCALE = 2.2;
const NAVEL_DY = (14 + 5 * 5) * 0.35 * SCALE; // 与 drawHero 的肚脐位置一致

interface Fighter {
  view: Phaser.GameObjects.Container;
  baseX: number;
  twistUntil: number;
  streak: number;
  cooldown: number;
  dots: Phaser.GameObjects.Graphics;
}

interface Arrow {
  g: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  shooter: 'player' | 'ai';
  dodgeRolled: boolean;
}

/** 决斗：西格玛奶蛙 vs 西格玛奶暗蛙，射对方肚脐眼，连续两次射中获胜 */
export class DuelScene extends Phaser.Scene {
  private player!: Fighter;
  private ai!: Fighter;
  private arrows: Arrow[] = [];
  private t = 0;
  private aiFireAt = 0;
  private over = false;
  private elapsed = 0;
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Duel');
  }

  init(data: { playerIsDark: boolean; elapsed: number }) {
    this.arrows = [];
    this.t = 0;
    this.over = false;
    this.elapsed = data.elapsed ?? 0;
    this.registry.set('duelPlayerIsDark', !!data.playerIsDark);
  }

  create() {
    const skin = currentSkin();
    const playerIsDark: boolean = this.registry.get('duelPlayerIsDark');
    fitScreen(this);
    fullBg(this, 0x161a24);
    const g = this.add.graphics();
    g.fillStyle(0x2b2140).fillEllipse(640, 360, 1100, 560);
    g.lineStyle(4, 0x5b3a7a).strokeEllipse(640, 360, 1100, 560);
    label(this, 640, 20, '决斗 · 射中对方肚脐眼，连续两次命中即获胜', 24, '#fff27a').setOrigin(0.5, 0);

    const lightName = skin.heroNames.light[4];
    const darkName = skin.heroNames.dark[4];
    const mk = (y: number, color: number, name: string, who: string): Fighter => {
      const body = this.add.graphics();
      art.drawHero(body, 5, color);
      body.setScale(SCALE);
      const t = label(this, 0, 110, `${who} · ${name}`, 18).setOrigin(0.5);
      const view = this.add.container(640, y, [body, t]);
      const dots = this.add.graphics();
      return { view, baseX: 640, twistUntil: 0, streak: 0, cooldown: 0, dots };
    };
    const c = skin.colors;
    this.ai = mk(200, playerIsDark ? c.light : c.dark, playerIsDark ? lightName : darkName, 'AI');
    this.player = mk(520, playerIsDark ? c.dark : c.light, playerIsDark ? darkName : lightName, '你');

    this.msg = label(this, 640, 330, '', 22).setOrigin(0.5);
    this.aiFireAt = 1.5;

    new Button(this, 300, 640, 160, 56, '◀ 正太扭腰', () => this.twist(this.player, -1), 0x3b6e9b);
    new Button(this, 560, 640, 160, 56, '射箭（空格）', () => this.shoot(this.player, this.ai, 'player'), 0x9b3d2e);
    new Button(this, 820, 640, 160, 56, '正太扭腰 ▶', () => this.twist(this.player, 1), 0x3b6e9b);
    label(this, 640, 700, '键盘：A / ← 左扭，D / → 右扭，空格射箭；也可以直接点上方的对手射箭', 13, '#9aa4b8').setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.shoot(this.player, this.ai, 'player'));
    kb.on('keydown-A', () => this.twist(this.player, -1));
    kb.on('keydown-LEFT', () => this.twist(this.player, -1));
    kb.on('keydown-D', () => this.twist(this.player, 1));
    kb.on('keydown-RIGHT', () => this.twist(this.player, 1));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldY < 360) this.shoot(this.player, this.ai, 'player');
    });
  }

  private navel(f: Fighter) {
    return { x: f.view.x, y: f.view.y + NAVEL_DY };
  }

  private twist(f: Fighter, dir: number) {
    if (this.over || this.t < f.twistUntil) return;
    f.twistUntil = this.t + D.twistTime;
    this.tweens.killTweensOf(f.view);
    this.tweens.add({
      targets: f.view,
      x: f.baseX + dir * 75,
      angle: dir * 12,
      duration: (D.twistTime * 1000) / 2,
      yoyo: true,
      ease: 'Sine.inOut',
    });
  }

  private shoot(from: Fighter, to: Fighter, shooter: 'player' | 'ai') {
    if (this.over || from.cooldown > this.t) return;
    from.cooldown = this.t + (shooter === 'player' ? D.playerCooldown : 0);
    const a = this.navel(from);
    const b = this.navel(to);
    const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const g = this.add.graphics();
    g.lineStyle(3, 0xffe9a8).lineBetween(-14, 0, 14, 0);
    g.fillStyle(0xffffff).fillTriangle(14, -5, 22, 0, 14, 5);
    g.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    g.setPosition(a.x, a.y);
    this.arrows.push({ g, x: a.x, y: a.y, vx: ((b.x - a.x) / d) * D.arrowSpeed, vy: ((b.y - a.y) / d) * D.arrowSpeed, targetY: b.y, shooter, dodgeRolled: false });
  }

  update(_t: number, deltaMs: number) {
    if (this.over) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.t += dt;

    // AI 射箭
    if (this.t >= this.aiFireAt) {
      this.aiFireAt = this.t + Phaser.Math.FloatBetween(D.aiFireMin, D.aiFireMax);
      this.shoot(this.ai, this.player, 'ai');
    }

    for (const a of this.arrows) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.g.setPosition(a.x, a.y);
      const target = a.shooter === 'player' ? this.ai : this.player;
      const shooterF = a.shooter === 'player' ? this.player : this.ai;
      // AI 看到箭飞来时有概率扭腰
      if (a.shooter === 'player' && !a.dodgeRolled && Math.abs(a.y - a.targetY) < 200) {
        a.dodgeRolled = true;
        if (Math.random() < D.aiDodgeChance) this.twist(this.ai, Math.random() < 0.5 ? -1 : 1);
      }
      const reached = a.vy < 0 ? a.y <= a.targetY : a.y >= a.targetY;
      if (reached) {
        const hit = Math.abs(this.navel(target).x - a.x) < 16;
        a.g.destroy();
        a.vx = NaN;
        if (hit) {
          shooterF.streak++;
          this.flashMsg(a.shooter === 'player' ? `命中！连击 ${shooterF.streak}/${D.hitsToWin}` : `被射中肚脐！对手连击 ${shooterF.streak}/${D.hitsToWin}`, a.shooter === 'player' ? '#7dff9a' : '#ff6b6b');
          this.cameras.main.shake(120, 0.006);
          if (shooterF.streak >= D.hitsToWin) return this.end(a.shooter === 'player');
        } else {
          shooterF.streak = 0;
          this.flashMsg(a.shooter === 'player' ? '没射中，连击清零' : '躲开了！对手连击清零', '#ffffff');
        }
      }
    }
    this.arrows = this.arrows.filter((a) => !Number.isNaN(a.vx));
    this.drawDots(this.player, 600);
    this.drawDots(this.ai, 100);
  }

  private drawDots(f: Fighter, y: number) {
    f.dots.clear();
    for (let i = 0; i < D.hitsToWin; i++) {
      f.dots.fillStyle(i < f.streak ? 0xfff27a : 0x444a5a).fillCircle(760 + i * 22, y, 8);
    }
  }

  private flashMsg(s: string, color: string) {
    this.msg.setText(s).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.msg);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 700, duration: 400 });
  }

  private end(win: boolean) {
    this.over = true;
    this.flashMsg(win ? '决斗胜利！' : '决斗失败……', win ? '#fff27a' : '#ff6b6b');
    this.time.delayedCall(1400, () =>
      this.scene.start('Result', { win, reason: win ? '决斗中连续两次射中对方肚脐眼' : '决斗中被对方连续射中两次', elapsed: this.elapsed + this.t }),
    );
  }
}
