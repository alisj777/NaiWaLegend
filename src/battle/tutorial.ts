import Phaser from 'phaser';
import { BALANCE as B } from '../config/balance';
import { currentSkin } from '../skins';
import type { BattleScene } from '../scenes/BattleScene';
import { FONT } from './art';
import { Button, THEME, bodyText, scrollPanel } from './ui';
import { Guide, showGuide } from './guide';
import { FIELD, Poop } from './logic/battle';

type Wait = 'move' | 'collect' | 'card:chicken' | 'thunder' | 'next';

interface Step {
  title: string;
  text: string;
  wait: Wait;
  enter?: () => void;
  /** 引导箭头指向的位置 */
  arrow?: () => { x: number; y: number } | null;
}

/**
 * 新手引导：在正式对战前一步步教操作。
 * 引导期间 BattleScene 会暂停 AI、成长、自动攻击和随机天雷，只保留玩家的操作。
 */
export class Tutorial {
  private steps: Step[];
  private index = -1;
  private panel: Phaser.GameObjects.Container;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private nextBtn: Button;
  private arrow: Phaser.GameObjects.Graphics;
  private poop: Poop | null = null;
  private moveTarget: { x: number; y: number } | null = null;
  private done = false;
  /** 引导角色「系统」，停在说明框左边 */
  private guide: Guide;

  constructor(private scene: BattleScene) {
    const skin = currentSkin();
    const names = skin.units;
    const lockCards = (lv: number) =>
      (Object.entries(B.unlock.cards) as [string, number][])
        .filter(([, l]) => l === lv)
        .map(([c]) => (c === 'poop' ? '奶屎' : names[c as keyof typeof names]))
        .join('、');

    this.steps = [
      {
        title: '第 1 步 · 走路',
        text: '点击草地上的任意位置，你的奶蛋就会走过去。\n试试走到箭头指的地方。',
        wait: 'move',
        enter: () => {
          const h = scene.playerHero;
          this.moveTarget = { x: h.x + 260, y: h.y };
        },
        arrow: () => this.moveTarget,
      },
      {
        title: '第 2 步 · 捡奶屎',
        text: '地上出现了一坨奶屎。点击它，走到旁边就能捡起来。\n3 个同级奶屎会合成更高一级，Lv3 奶屎可以吃掉回血，或者堆成堡垒挡天雷。',
        wait: 'collect',
        enter: () => {
          const h = scene.playerHero;
          this.poop = scene.spawnTutorialPoop(h.x + 220, h.y - 110);
        },
        arrow: () => (this.poop && this.poop.alive ? { x: this.poop.x, y: this.poop.y - 10 } : null),
      },
      {
        title: '第 3 步 · 打出卡牌',
        text: `点击下方手牌里的「${names.chicken}」，把它放到场上。\n${names.chicken}每 ${B.chicken.layInterval} 秒下一颗蛋，蛋会排成一队跟着你。${B.economy.eggsPerCoin} 颗蛋能换 1 金币，${B.chaos.eggsNeeded} 颗同阵营的蛋能合成隐藏 Boss。`,
        wait: 'card:chicken',
        enter: () => {
          if (!scene.playerHand.includes('chicken')) scene.playerHand.unshift('chicken');
        },
        arrow: () => scene.cardButtonCenter(scene.playerHand.indexOf('chicken')),
      },
      {
        title: '第 4 步 · 躲天雷',
        text: `黄色圆圈是天雷预警，快点击别处躲开！\n天雷不扣血，但光派被劈中 ${B.thunder.fallAt} 次就会变异，堕入暗面。暗派免疫天雷。`,
        wait: 'thunder',
        enter: () => {
          const h = scene.playerHero;
          scene.spawnThunderAt(h.x, h.y, 3);
        },
      },
      {
        title: '第 5 步 · 战斗',
        text: '正式开战后，你会自动向对手射击，把对手的血量打到 0 就赢。\n对手的子弹是直线飞的，及时走位就能躲开。被冰冻时不能移动也不能攻击。',
        wait: 'next',
      },
      {
        title: '第 6 步 · 成长与解锁',
        text:
          `奶蛋会随时间自动长大，每升一级送 ${B.economy.freeCardsPerLevel} 张卡，并解锁新东西：\n` +
          `Lv2 解锁 ${lockCards(2)}、奶茶、解毒针 · Lv3 解锁 ${lockCards(3)} · Lv4 长成奶蛙，可以主动感染。\n` +
          `对手是成长速度 2 倍的暗奶蛋，它长到 Lv5 会成为全场之主，到时场上有奶蛋就会进化出西格玛奶蛙与它决斗。`,
        wait: 'next',
      },
    ];

    const w = 820;
    const h = 120;
    const x = 640 - w / 2;
    const y = FIELD.y + 8;
    // 奶油色说明框，和全游戏统一风格
    const frame = scrollPanel(scene, -30, 0, w + 60, h);
    const bg = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setOrigin(0);
    // 点在面板上不触发场地移动
    bg.setInteractive().on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => e.stopPropagation());
    this.titleText = scene.add.text(20, 12, '', { fontFamily: FONT, fontSize: '19px', color: '#b5501d', fontStyle: 'bold' });
    this.bodyText = bodyText(scene, 20, 40, '', 14, w - 160);
    this.nextBtn = new Button(scene, w - 124, 12, 108, 46, '下一步', () => this.current?.wait === 'next' && this.advance(), THEME.orange);
    const skip = new Button(scene, w - 124, 64, 108, 44, '跳过引导', () => this.finish(), THEME.grey);
    this.panel = scene.add.container(x, y, [frame, bg, this.titleText, this.bodyText, this.nextBtn, skip]).setDepth(400);
    this.guide = showGuide(scene, x - 70, y + 70, { from: 'left', height: 170, depth: 401, delay: 200 });
    this.arrow = scene.add.graphics().setDepth(390);
    this.arrow.fillStyle(0xfff27a).fillTriangle(-14, -30, 14, -30, 0, -6);
    this.arrow.fillStyle(0xfff27a).fillRect(-5, -52, 10, 24);
    scene.tweens.add({ targets: this.arrow, scaleY: 0.85, yoyo: true, repeat: -1, duration: 350 });

    scene.events.on('tut:move', () => this.current?.wait === 'move' && this.scene.time.delayedCall(700, () => this.check('move')));
    scene.events.on('tut:collect', () => this.check('collect'));
    scene.events.on('tut:card', (c: string) => c === 'chicken' && this.check('card:chicken'));
    scene.events.on('tut:thunder', () => this.scene.time.delayedCall(600, () => this.check('thunder')));
    this.advance();
  }

  private get current() {
    return this.steps[this.index];
  }

  private check(w: Wait) {
    if (!this.done && this.current?.wait === w) this.advance();
  }

  private advance() {
    if (this.done) return;
    this.index++;
    if (this.index >= this.steps.length) return this.finish();
    const s = this.current;
    s.enter?.();
    this.titleText.setText(`${s.title}（${this.index + 1}/${this.steps.length}）`);
    this.bodyText.setText(s.text);
    const isLast = this.index === this.steps.length - 1;
    this.nextBtn.setLabel(isLast ? '开始对战' : '下一步').setEnabled(s.wait === 'next');
    this.panel.setScale(0.96);
    this.scene.tweens.add({ targets: this.panel, scale: 1, duration: 150 });
  }

  update() {
    if (this.done) return;
    const p = this.current?.arrow?.();
    this.arrow.setVisible(!!p);
    if (p) this.arrow.setPosition(p.x, p.y);
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    for (const e of ['tut:move', 'tut:collect', 'tut:card', 'tut:thunder']) this.scene.events.off(e);
    this.panel.destroy();
    this.arrow.destroy();
    this.guide.leave();
    this.scene.startBattle();
  }
}
