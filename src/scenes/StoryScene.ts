import Phaser from 'phaser';
import { currentSkin, Skin } from '../skins';
import * as art from '../battle/art';
import { Button, label } from '../battle/ui';
import { STORY, StoryPanelId } from '../copy/story';

/**
 * 剧情插画：由 tools/prepare_assets.py 从 art/reference 处理生成到 public/assets/story/。
 * 缺图的页面自动用代码画的占位图。
 */
const IMAGES = {
  family: 'assets/story/family.jpg', // 奶蛙家族全家福
  growth: 'assets/story/growth.jpg', // 成长之路：奶蛋 → 小奶蛙 → 奶蛙
  doom: 'assets/story/doom.jpg', // 末世：花草枯萎、病毒紫雾、天雷
  winter: 'assets/story/winter.jpg', // 寒冬的村子
  dying: 'assets/story/dying.jpg', // 奄奄一息的奶蛙
  rebirth: 'assets/story/rebirth.jpg', // 重生
};
type ImageKey = keyof typeof IMAGES;
const SOUNDS = {
  laugh: 'story/laugh-group.mp3', // 多人大笑（全家福那一页播放）
};

/** 一页配多张图时，每张停留多久再淡入下一张（毫秒） */
const SLIDE_HOLD = 2600;
const SLIDE_FADE = 1200;

interface PanelArt {
  /** 有图就显示图片（多张会依次淡入），否则用 draw 画占位 */
  image?: ImageKey | ImageKey[];
  sound?: 'laugh';
  draw: (s: StoryScene, skin: Skin) => void;
}

const FRIEND_COLOR = 0xe8dcc0;
/** 插画区高度（1280×560），素材按 2 倍即 2560×1120 准备 */
const ART_H = 560;

/** 每页插画，按 id 对应 src/copy/story.ts 里的文案 */
const ART: Record<StoryPanelId, PanelArt> = {
  village: {
    image: 'family',
    sound: 'laugh',
    draw: (s, skin) => {
      // 占位：奶蛙家族全家福
      s.ground();
      const frame = s.add.graphics();
      frame.fillStyle(0xf6ecd2).fillRoundedRect(300, 60, 680, 400, 12);
      frame.lineStyle(10, 0xc89b62).strokeRoundedRect(300, 60, 680, 400, 12);
      s.layer.add(frame);
      s.layer.add(label(s, 640, 95, STORY.art.familyPhoto, 22, '#8a5a32').setOrigin(0.5));
      s.put((g) => art.drawHero(g, 4, skin.colors.light), 640, 250, 2.4);
      s.put((g) => art.drawChicken(g, FRIEND_COLOR), 420, 300, 1.5);
      s.put((g) => art.drawDog(g, FRIEND_COLOR), 860, 310, 1.4);
      s.put((g) => art.drawFriend(g, 1, FRIEND_COLOR), 480, 400, 1.3);
      s.put((g) => art.drawMouse(g, FRIEND_COLOR), 640, 410, 1.4);
      s.put((g) => art.drawPowder(g, FRIEND_COLOR), 800, 400, 1.3);
      [520, 580, 700, 760].forEach((x) => s.put((g) => art.drawEgg(g, skin.colors.light, 10), x, 340, 1.2));
      s.layer.add(label(s, 640, 160, STORY.art.laugh, 20, '#3b6e9b').setOrigin(0.5));
    },
  },
  growth: {
    image: 'growth',
    draw: (s, skin) => {
      s.ground();
      [1, 2, 3, 4].forEach((lv, i) => {
        s.put((g) => art.drawHero(g, lv, skin.colors.light), 200 + i * 170, 380, 1.4);
        if (i < 3) s.layer.add(label(s, 285 + i * 170, 370, '→', 28, '#fff27a').setOrigin(0.5));
      });
      s.put((g) => art.drawHero(g, 4, skin.colors.light), 1000, 250, 1.8);
      [[880, 330], [960, 380], [1060, 380], [1130, 320]].forEach(([x, y]) => {
        s.put((g) => art.drawEgg(g, skin.colors.light, 10), x, y, 1.3);
        s.layer.add(label(s, x, y - 40, STORY.art.boss, 15, '#ffffff').setOrigin(0.5).setBackgroundColor('#3b6e9bcc').setPadding(4, 2, 4, 2));
      });
    },
  },
  split: {
    draw: (s, skin) => {
      s.ground();
      s.put((g) => art.drawHero(g, 4, skin.colors.light), 640, 250, 2.2);
      const friends: ((g: Phaser.GameObjects.Graphics) => void)[] = [
        (g) => art.drawChicken(g, FRIEND_COLOR),
        (g) => art.drawDog(g, FRIEND_COLOR),
        (g) => art.drawFriend(g, 1, FRIEND_COLOR),
        (g) => art.drawMouse(g, FRIEND_COLOR),
        (g) => art.drawPowder(g, FRIEND_COLOR),
      ];
      friends.forEach((fn, i) => {
        const n = STORY.art.friends[i] ?? '';
        const x = 240 + i * 200;
        s.put(fn, x, 390, 1.6);
        s.layer.add(label(s, x, 440, n, 16, '#ffffff').setOrigin(0.5));
      });
    },
  },
  doom: {
    image: 'doom',
    draw: (s, skin) => {
      s.ground(0x2e3b2a);
      s.sky(0x10131c);
      const g = s.add.graphics();
      art.drawBolt(g, 330, 0, 300);
      art.drawBolt(g, 950, 0, 300);
      s.layer.add(g);
      s.put((gg) => art.drawChicken(gg, skin.colors.dark), 330, 380, 1.6);
      s.put((gg) => art.drawDog(gg, skin.colors.dark), 950, 390, 1.5);
      s.put((gg) => art.drawHero(gg, 4, skin.colors.deepDark), 640, 380, 1.8);
      s.virus(640, 320, 16);
    },
  },
  winter: {
    // 先是冰封的村子，再淡入奄奄一息的奶蛙（"在冷风中你闭上了眼睛"）
    image: ['winter', 'dying'],
    draw: (s, skin) => {
      s.ground(0xdfe8ef);
      s.sky(0x141a26);
      s.put((g) => art.drawHero(g, 4, skin.colors.light), 640, 400, 1.8).setAlpha(0.45).setAngle(90);
      s.snow(70);
    },
  },
  rebirth: {
    image: 'rebirth',
    draw: (s, skin) => {
      // 占位：重生画面
      s.layer.add(s.add.rectangle(0, 0, 1280, ART_H, 0x0e1220).setOrigin(0));
      const glow = s.add.graphics({ x: 640, y: 260 });
      for (let r = 220; r > 0; r -= 20) glow.fillStyle(0xfff27a, 0.05).fillCircle(0, 0, r);
      s.layer.add(glow);
      s.tweens.add({ targets: glow, scale: 1.15, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
      s.put((g) => art.drawHero(g, 1, skin.colors.light), 640, 260, 3);
      s.layer.add(label(s, 640, 440, STORY.art.rebirthNight, 20, '#9cc4ff').setOrigin(0.5));
    },
  },
};

/** 序章：奶家村 → 成长 → 分化 → 末世 → 寒冬 → 重生。逐字打出，点击继续。 */
const PANELS = STORY.panels.map((p) => ({ ...p, ...ART[p.id] }));

export class StoryScene extends Phaser.Scene {
  private index = 0;
  layer!: Phaser.GameObjects.Container;
  private textObj!: Phaser.GameObjects.Text;
  private titleObj!: Phaser.GameObjects.Text;
  private full = '';
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private slideTimer?: Phaser.Time.TimerEvent;
  private nextBtn!: Button;

  constructor() {
    super('Story');
  }

  preload() {
    for (const [k, url] of Object.entries(IMAGES)) this.load.image(`story-${k}`, url);
    for (const [k, url] of Object.entries(SOUNDS)) this.load.audio(`story-${k}`, url);
  }

  create() {
    this.index = 0;
    this.add.rectangle(0, 0, 1280, 720, 0x1d2330).setOrigin(0);
    this.layer = this.add.container(0, 0);
    // 上面 0~560 是插画区，下面 160 像素是文字框
    this.add.graphics().fillStyle(0x10141c, 0.95).fillRoundedRect(0, ART_H, 1280, 720 - ART_H, { tl: 20, tr: 20, bl: 0, br: 0 });
    this.titleObj = label(this, 60, ART_H + 12, '', 22, '#fff27a');
    this.textObj = this.add.text(60, ART_H + 46, '', {
      fontFamily: art.FONT,
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: 1000 },
      lineSpacing: 8,
    });
    this.nextBtn = new Button(this, 1100, 650, 140, 50, STORY.next, () => this.onNext(), 0x3b6e9b);
    new Button(this, 1100, 20, 140, 40, STORY.skip, () => this.goBattle(), 0x555555);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => p.y < ART_H && this.onNext());
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
    this.layer.add(this.add.rectangle(0, 280, 1280, ART_H - 280, color).setOrigin(0));
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

  snow(n: number) {
    for (let i = 0; i < n; i++) {
      const f = this.add.circle(Phaser.Math.Between(0, 1280), Phaser.Math.Between(-500, 0), Phaser.Math.Between(2, 4), 0xffffff, 0.85);
      this.layer.add(f);
      this.tweens.add({ targets: f, y: 520, x: f.x + Phaser.Math.Between(-60, 60), duration: Phaser.Math.Between(3000, 6000), repeat: -1, delay: Phaser.Math.Between(0, 3000) });
    }
  }

  // ───────── 翻页与逐字显示 ─────────

  private show() {
    this.layer.each((o: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(o));
    this.layer.removeAll(true);
    const p = PANELS[this.index];
    this.slideTimer?.remove();
    const keys = (p.image ? ([] as ImageKey[]).concat(p.image) : []).map((k) => `story-${k}`).filter((k) => this.textures.exists(k));
    if (keys.length) {
      const imgs = keys.map((k, i) => {
        const img = this.add.image(640, ART_H / 2, k).setAlpha(i === 0 ? 1 : 0);
        const base = Math.max(1280 / img.width, ART_H / img.height);
        img.setScale(base);
        // 镜头缓慢推进，让静态图有点生气
        this.tweens.add({ targets: img, scale: base * 1.05, duration: 9000, ease: 'Sine.out' });
        this.layer.add(img);
        return img;
      });
      // 多张图：依次淡入
      let next = 1;
      if (imgs.length > 1) {
        this.slideTimer = this.time.addEvent({
          delay: SLIDE_HOLD,
          repeat: imgs.length - 2,
          callback: () => this.tweens.add({ targets: imgs[next++], alpha: 1, duration: SLIDE_FADE }),
        });
      }
    } else {
      p.draw(this, currentSkin());
    }
    // 翻页时停掉上一页的声音
    this.sound.stopAll();
    if (p.sound && this.cache.audio.exists(`story-${p.sound}`)) this.sound.play(`story-${p.sound}`);
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
    this.nextBtn.setLabel(this.index === PANELS.length - 1 ? STORY.finish : STORY.next);
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
    this.sound.stopAll();
    this.scene.start('Stage1');
  }
}
