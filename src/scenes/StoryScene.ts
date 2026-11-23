import Phaser from 'phaser';
import { currentSkin, Skin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';

interface Panel {
  title: string;
  text: string;
  draw: (s: StoryScene, skin: Skin) => void;
}

/** 开场剧情：牛马村 → 天雷 → 变异病毒 → 暗奶蛋 → 你的使命。逐字打出，点击继续。 */
const PANELS: Panel[] = [
  {
    title: '牛马村',
    text: '在牛马村的农场上，生活着一群快乐的奶家族：会下蛋的奶鸡、到处乱跑的奶狗、奶猫、奶兔和奶鱼，还有每天埋头干活的牛和马。\n这天清晨，奶鸡生下了一颗圆滚滚的小奶蛋——那就是你。',
    draw: (s, skin) => {
      s.ground();
      s.put(art.drawCow, 260, 330, 1.2);
      s.put(art.drawHorse, 1010, 330, 1.2);
      s.put((g) => art.drawChicken(g, skin.colors.neutral), 520, 380, 2);
      s.put((g) => art.drawDog(g, skin.colors.neutral), 800, 390, 1.6);
      s.put((g) => art.drawHero(g, 1, skin.colors.light), 650, 400, 1.8);
      [0, 1, 2].forEach((i) => s.put((g) => art.drawFriend(g, i, skin.colors.neutral), 420 + i * 220, 250, 1.3));
    },
  },
  {
    title: '天雷',
    text: '平静没有持续太久。一天夜里，农场上空乌云翻滚，一道道天雷劈了下来。\n牛和马被劈晕在地，醒来后，身上多了一种奇怪的东西——变异病毒。',
    draw: (s) => {
      s.ground(0x2e3b2a);
      s.sky(0x10131c);
      const g = s.add.graphics();
      art.drawBolt(g, 380, 0, 300);
      art.drawBolt(g, 900, 0, 300);
      s.put((gg) => art.drawCow(gg, true), 380, 350, 1.3);
      s.put((gg) => art.drawHorse(gg, true), 900, 350, 1.3);
      s.virus(640, 300, 18);
    },
  },
  {
    title: '变异病毒',
    text: '病毒在农场里悄悄蔓延，传染给了奶鸡。被感染的奶鸡开始生下暗奶蛋。\n暗奶蛋长得飞快，成长速度是普通光奶蛋的整整两倍。',
    draw: (s, skin) => {
      s.ground(0x4a5a3a);
      s.put((g) => art.drawChicken(g, skin.colors.dark), 500, 360, 2.2);
      s.virus(500, 300, 10);
      s.put((g) => art.drawEgg(g, skin.colors.dark, 16), 680, 400, 1.6);
      s.put((g) => art.drawEgg(g, skin.colors.dark, 16), 760, 410, 1.6);
      s.put((g) => art.drawEgg(g, skin.colors.dark, 16), 840, 400, 1.6);
    },
  },
  {
    title: '光与暗',
    text: '天雷没有停，还在农场上随机落下。它不会伤到谁，却会让毒素一点点积累——\n光派被劈中太多次，也会变异，堕入暗面。',
    draw: (s, skin) => {
      s.ground(0x3a4a34);
      s.sky(0x1a1f2b);
      const g = s.add.graphics();
      art.drawBolt(g, 640, 0, 330);
      s.put((gg) => art.drawHero(gg, 1, skin.colors.light), 470, 400, 2.2);
      label(s, 640, 400, '→', 60, '#fff27a').setOrigin(0.5);
      s.put((gg) => art.drawHero(gg, 1, skin.colors.dark), 810, 400, 2.2);
    },
  },
  {
    title: '你的使命',
    text: '现在，一颗暗奶蛋盯上了你。\n躲开天雷，收集奶屎，用卡牌和朋友们一起战斗——从一颗小奶蛋，长成传说中的西格玛奶蛙！',
    draw: (s, skin) => {
      s.ground();
      s.put((g) => art.drawHero(g, 1, skin.colors.light), 360, 400, 2.4);
      s.put((g) => art.drawHero(g, 1, skin.colors.dark), 920, 400, 2.4);
      label(s, 640, 390, 'VS', 64, '#fff27a').setOrigin(0.5);
      s.put((g) => art.drawHero(g, 5, skin.colors.light), 640, 230, 1.6).setAlpha(0.35);
    },
  },
];

export class StoryScene extends Phaser.Scene {
  private index = 0;
  private layer!: Phaser.GameObjects.Container;
  private textObj!: Phaser.GameObjects.Text;
  private titleObj!: Phaser.GameObjects.Text;
  private full = '';
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private nextBtn!: Button;

  constructor() {
    super('Story');
  }

  create() {
    this.index = 0;
    this.add.rectangle(0, 0, 1280, 720, 0x1d2330).setOrigin(0);
    this.layer = this.add.container(0, 0);
    this.add.rectangle(0, 500, 1280, 220, 0x10141c, 0.95).setOrigin(0);
    this.titleObj = label(this, 60, 520, '', 24, '#fff27a');
    this.textObj = this.add.text(60, 562, '', {
      fontFamily: art.FONT,
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: 1000 },
      lineSpacing: 8,
    });
    this.nextBtn = new Button(this, 1100, 640, 140, 50, '继续', () => this.onNext(), 0x3b6e9b);
    new Button(this, 1100, 20, 140, 40, '跳过剧情', () => this.goBattle(), 0x555555);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => p.y < 500 && this.onNext());
    this.input.keyboard?.on('keydown-SPACE', () => this.onNext());
    this.show();
  }

  // ───────── 给各页插画用的小工具 ─────────

  put(fn: (g: Phaser.GameObjects.Graphics) => void, x: number, y: number, scale = 1) {
    const g = this.add.graphics({ x, y });
    fn(g);
    g.setScale(scale);
    this.layer.add(g);
    // 轻微上下浮动，让画面有点生气
    this.tweens.add({ targets: g, y: y - 6, yoyo: true, repeat: -1, duration: 900 + Math.random() * 500, ease: 'Sine.inOut' });
    return g;
  }

  ground(color = 0x7fb069) {
    this.layer.add(this.add.rectangle(0, 280, 1280, 220, color).setOrigin(0));
    const fence = this.add.graphics();
    fence.fillStyle(0xc89b62);
    for (let x = 10; x < 1280; x += 36) fence.fillRect(x, 262, 8, 30);
    fence.fillRect(0, 270, 1280, 6);
    this.layer.add(fence);
  }

  sky(color: number) {
    const r = this.add.rectangle(0, 0, 1280, 280, color).setOrigin(0);
    this.layer.addAt(r, 0);
    for (let i = 0; i < 5; i++) {
      const c = this.add.graphics();
      c.fillStyle(0x3a3f4f).fillEllipse(0, 0, 220, 70).fillEllipse(60, -20, 160, 60);
      c.setPosition(120 + i * 260, 50 + (i % 2) * 30);
      this.layer.add(c);
    }
  }

  virus(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics({ x: x + Phaser.Math.Between(-160, 160), y: y + Phaser.Math.Between(-90, 60) });
      g.fillStyle(0x9b59b6, 0.85).fillCircle(0, 0, 7);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        g.fillStyle(0x9b59b6).fillCircle(Math.cos(a) * 10, Math.sin(a) * 10, 2.5);
      }
      this.layer.add(g);
      this.tweens.add({ targets: g, x: g.x + Phaser.Math.Between(-30, 30), y: g.y - 20, alpha: 0.4, yoyo: true, repeat: -1, duration: 1200 + i * 60 });
    }
  }

  // ───────── 翻页与逐字显示 ─────────

  private show() {
    this.layer.each((o: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(o));
    this.layer.removeAll(true);
    const p = PANELS[this.index];
    p.draw(this, currentSkin());
    this.layer.setAlpha(0);
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 400 });
    this.titleObj.setText(`${p.title}  ${this.index + 1}/${PANELS.length}`);
    this.full = p.text;
    this.shown = 0;
    this.textObj.setText('');
    this.typing?.remove();
    this.typing = this.time.addEvent({
      delay: 35,
      loop: true,
      callback: () => {
        this.shown++;
        this.textObj.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.typing?.remove();
      },
    });
    this.nextBtn.setLabel(this.index === PANELS.length - 1 ? '开始新手引导' : '继续');
  }

  private onNext() {
    // 文字还没打完时，第一下点击先显示全文
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.typing?.remove();
      this.textObj.setText(this.full);
      return;
    }
    this.index++;
    if (this.index >= PANELS.length) return this.goBattle();
    this.show();
  }

  private goBattle() {
    this.typing?.remove();
    this.scene.start('Battle', { tutorial: true });
  }
}
