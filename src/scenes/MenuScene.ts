import Phaser from 'phaser';
import { BALANCE as B } from '../config/balance';
import { currentSkin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';
import { platform } from '../platform';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload() {
    // 村子母版（由 tools/prepare_assets.py 生成）；缺图时用纯色背景
    this.load.image('menu-village', 'assets/menu/village.jpg');
  }

  create() {
    const skin = currentSkin();
    this.add.rectangle(0, 0, 1280, 720, 0x1d2330).setOrigin(0);
    if (this.textures.exists('menu-village')) {
      this.add.image(640, 360, 'menu-village').setDisplaySize(1280, 720);
      // 压暗一层，保证上面的文字和进化线看得清
      this.add.rectangle(0, 0, 1280, 720, 0x10141c, 0.55).setOrigin(0);
    }
    label(this, 640, 60, skin.title, 56, '#fff27a').setOrigin(0.5).setStroke('#3a2a10', 6);
    label(this, 640, 120, '即时卡牌 RPG · 从奶蛋长成西格玛', 20, '#9aa4b8').setOrigin(0.5);

    // 进化线展示
    skin.heroNames.light.forEach((n, i) => {
      const x = 260 + i * 190;
      const g = this.add.graphics({ x, y: 230 });
      art.drawHero(g, i + 1, skin.colors.light);
      label(this, x, 285, `Lv${i + 1} ${n}`, 15, '#9cc4ff').setOrigin(0.5);
      const d = this.add.graphics({ x, y: 360 });
      art.drawHero(d, i + 1, skin.colors.dark);
      label(this, x, 415, i === 3 ? `${skin.heroNames.dark[i]} / ${skin.heroNames.deepDark}` : skin.heroNames.dark[i], 15, '#ffbd80').setOrigin(0.5);
    });

    const rules = [
      `· 双方主角各 ${B.hero.startHp} 血，自动互相攻击，打到 0 就赢。点击场地移动，躲开攻击和天雷`,
      `· 开场 ${B.thunder.startAt} 秒后每 ${B.thunder.interval} 秒落一道天雷，光派被劈 ${B.thunder.fallAt} 次就堕入暗面`,
      `· 每升一级送 ${B.economy.freeCardsPerLevel} 张卡并解锁新卡牌；奶鸡下蛋，${B.economy.eggsPerCoin} 颗蛋换 1 金币，${B.chaos.eggsNeeded} 颗同阵营蛋合成混沌奶蛋`,
      '· 暗线长到 Lv5 成为全场之主，场上有奶蛋就会进化出西格玛奶蛙与它决斗',
    ];
    label(this, 640, 470, rules.join('\n'), 16, '#dddddd').setOrigin(0.5, 0).setLineSpacing(8);

    new Button(this, 310, 610, 220, 60, '开始游戏\n（序章剧情）', () => this.scene.start('Story'), 0x3b6e9b);
    new Button(this, 550, 610, 200, 60, '第一关\n狂风夜', () => this.scene.start('Stage1'), 0x9b6a3b);
    new Button(this, 770, 610, 200, 60, '对战\n（跳过引导）', () => this.scene.start('Battle', { tutorial: false }));

    // 手机网页：全屏并锁定横屏（安卓支持；iPhone 的 Safari 不支持网页全屏，可以“添加到主屏幕”后打开）
    if (platform.canRequestFullscreen()) {
      new Button(this, 1100, 20, 160, 44, '全屏横屏', () => platform.requestFullscreenLandscape(), 0x555555);
    }
  }
}
