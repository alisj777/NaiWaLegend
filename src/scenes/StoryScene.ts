import Phaser from 'phaser';
import { currentSkin, Skin } from '../skins';
import * as art from '../battle/art';
import { Button, THEME, bodyText, label, pill, scrollPanel } from '../battle/ui';
import { fitScreen, fullBg, screenEdges } from '../battle/layout';
import { duckBgm, playBgm } from '../battle/music';
import { Guide, showGuide } from '../battle/guide';
import { STORY, StoryPanelId } from '../copy/story';
import { BgmKey, STORY_IMAGES, StoryImageKey, storyKey } from '../assets';

/** 剧情插画和音频在 src/assets.ts，由启动加载页统一预载；缺图的页面自动用代码画的占位图 */
type ImageKey = StoryImageKey;

/** 一页配多张图时：文字打完后再停多久淡入下一张、淡入用多久（毫秒） */
const SLIDE_AFTER_TEXT = 900;
const SLIDE_FADE = 1200;
/** 文字框（浮在画面下方的奶油色对话框） */
const BOX = { x: 70, y: 548, w: 1140, h: 156 };

interface PanelArt {
  /** 有图就显示图片（多张时，文字打完后依次淡入下一张），否则用 draw 画占位 */
  image?: ImageKey | ImageKey[];
  /** 某张图出现时播放的声音 */
  sound?: { on: ImageKey; key: 'laugh' };
  /** 引导角色「系统」在第几段文字开始时飘进来（从 0 算）；不填表示这一页没有系统 */
  systemAtPart?: number;
  /** 角色说话页：名字标签显示 title（蓝色，不带页码） */
  speaker?: boolean;
  /** 这一页文字框重新从下方浮上来（和角色一起登场） */
  entrance?: boolean;
  /** 这一页的背景音乐（和上一页相同就接着放，不同就淡入淡出切换） */
  bgm: BgmKey;
  draw: (s: StoryScene, skin: Skin) => void;
}

const FRIEND_COLOR = 0xe8dcc0;
/** 插画区高度（1280×560），素材按 2 倍即 2560×1120 准备 */
const ART_H = 560;

/** 每页插画，按 id 对应 src/copy/story.ts 里的文案 */
const ART: Record<StoryPanelId, PanelArt> = {
  village: {
    // 先只有奶家村，文字框浮出、字打完后，全家福淡入并大笑
    image: ['village', 'family'],
    sound: { on: 'family', key: 'laugh' },
    bgm: 'happy',
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
    bgm: 'happy',
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
    image: 'split',
    bgm: 'happy',
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
    // 先是极寒冰封的村子，再切到病毒和天雷肆虐的末世
    image: ['winter', 'doom'],
    bgm: 'doom',
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
    // 上一世死去的那一刻：一进来就是奄奄一息的奶蛙（"在冷风中你闭上了眼睛"）
    image: 'dying',
    bgm: 'doom',
    draw: (s, skin) => {
      s.ground(0xdfe8ef);
      s.sky(0x141a26);
      s.put((g) => art.drawHero(g, 4, skin.colors.light), 640, 400, 1.8).setAlpha(0.45).setAngle(90);
      s.snow(70);
    },
  },
  rebirth: {
    // 重生 + 系统登场合并成一页：第 2 段"你的眼前出现了一个系统"时，系统从右边飘进来
    image: 'rebirth',
    bgm: 'rebirth',
    systemAtPart: 1,
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
  private box!: Phaser.GameObjects.Container;
  private textObj!: Phaser.GameObjects.Text;
  private tag?: Phaser.GameObjects.Container;
  private full = '';
  /** 当前页分成的几段文字，以及正在显示第几段 */
  private parts: string[] = [];
  private partIndex = 0;
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private slides: { img: Phaser.GameObjects.Image; key: ImageKey }[] = [];
  private slideIndex = 0;
  private slideTimer?: Phaser.Time.TimerEvent;
  private nextBtn!: Button;
  private skipBtn!: Button;
  /** 引导角色「系统」（出现在对话框右上方） */
  private guide?: Guide;
  /** 当前页的音效（比如大笑），翻页时只停它，不停背景音乐 */
  private sfx?: Phaser.Sound.BaseSound;
  /** 正在补加载缺失的插画，期间不响应翻页 */
  private loadingMissing = false;

  constructor() {
    super('Story');
  }

  create() {
    this.index = 0;
    this.slides = [];
    this.loadingMissing = false;
    fitScreen(this, () => this.placeEdges());
    fullBg(this, 0x1d2330);
    this.layer = this.add.container(0, 0);

    // 文字框：卷轴风格（左右两根竖轴），浮在画面下方；没有卷轴素材时是奶油色圆角框
    const panel = scrollPanel(this, BOX.x - 20, BOX.y - 6, BOX.w + 40, BOX.h + 12);
    this.textObj = bodyText(this, BOX.x + 56, BOX.y + 34, '', 22, BOX.w - 280);
    this.nextBtn = new Button(this, BOX.x + BOX.w - 200, BOX.y + BOX.h - 84, 160, 60, STORY.next, () => this.onNext(), THEME.orange);
    this.box = this.add.container(0, 0, [panel, this.textObj, this.nextBtn]).setDepth(10);

    this.skipBtn = new Button(this, 0, 20, 140, 48, STORY.skip, () => this.goNext(), THEME.grey).setDepth(11);
    this.placeEdges();

    // 点画面任意处（文字框以外）也能翻页
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => p.worldY < BOX.y && this.onNext());
    this.input.keyboard?.on('keydown-SPACE', () => this.onNext());

    // 开场：先只露出画面，文字框稍后从下方浮上来
    this.box.setY(220).setAlpha(0);
    this.show(false);
    this.time.delayedCall(900, () => {
      this.tweens.add({ targets: this.box, y: 0, alpha: 1, duration: 600, ease: 'Back.out', onComplete: () => this.startTyping() });
    });
  }

  private placeEdges() {
    this.skipBtn?.setX(screenEdges(this).right - 140 - 24);
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

  /** 显示当前页。typeNow=false 时只换画面，打字由调用方稍后开始（开场文字框浮出动画用） */
  private show(typeNow = true) {
    const p = PANELS[this.index];
    const wanted = p.image ? ([] as ImageKey[]).concat(p.image) : [];
    // 有图没加载到（网络慢或偶发失败）：当场补加载，加载完再显示；补不回来就用占位图
    const missing = wanted.filter((k) => !this.textures.exists(storyKey(k)));
    if (missing.length && !this.loadingMissing) {
      this.loadingMissing = true;
      for (const k of missing) this.load.image(storyKey(k), STORY_IMAGES[k]);
      this.load.once('complete', () => {
        this.loadingMissing = false;
        this.show(typeNow);
      });
      this.load.start();
      return;
    }

    this.layer.each((o: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(o));
    this.layer.removeAll(true);
    this.slideTimer?.remove();
    this.slideTimer = undefined;
    this.sfx?.stop();
    playBgm(this, p.bgm);
    this.slides = [];
    this.slideIndex = 0;

    const keys = wanted.filter((k) => this.textures.exists(storyKey(k)));
    if (keys.length) {
      const edges = screenEdges(this);
      const vw = edges.right - edges.left;
      this.slides = keys.map((k, i) => {
        // 图片铺满屏幕宽度，从顶部开始；下方被文字框盖住一部分
        const img = this.add.image(640, edges.top, storyKey(k)).setOrigin(0.5, 0).setAlpha(i === 0 ? 1 : 0);
        const base = Math.max(vw / img.width, (BOX.y + 40 - edges.top) / img.height);
        img.setScale(base);
        if (i === 0) this.tweens.add({ targets: img, scale: base * 1.05, duration: 9000, ease: 'Sine.out' });
        this.layer.add(img);
        return { img, key: k };
      });
      this.playSoundFor(keys[0]);
    } else {
      p.draw(this, currentSkin());
    }
    this.layer.setAlpha(0);
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 400 });

    // 引导角色「系统」：翻页时收起，到指定的那段文字再飘进来
    this.guide?.obj.destroy();
    this.guide = undefined;
    if (p.systemAtPart === 0) this.showSystem();

    this.tag?.destroy();
    this.tag = p.speaker
      ? pill(this, BOX.x + 80, BOX.y, p.title, THEME.blue, 20)
      : pill(this, BOX.x + 110, BOX.y, `${p.title}  ${this.index + 1}/${PANELS.length}`, THEME.orange, 18);
    this.box.add(this.tag);
    this.nextBtn.setLabel(this.index === PANELS.length - 1 ? STORY.finish : STORY.next);
    this.parts = ([] as string[]).concat(p.text);
    this.partIndex = 0;
    this.full = this.parts[0];
    this.shown = 0;
    this.textObj.setText('');
    this.typing?.remove();
    if (p.entrance) {
      // 文字框沉下去，再和角色一起浮上来
      this.box.setY(220).setAlpha(0);
      this.time.delayedCall(500, () => {
        this.tweens.add({ targets: this.box, y: 0, alpha: 1, duration: 600, ease: 'Back.out', onComplete: () => this.startTyping() });
      });
    } else if (typeNow) this.startTyping();
  }

  /** 系统从右侧飘进来，停在对话框右上方 */
  private showSystem() {
    if (this.guide) return;
    this.guide = showGuide(this, 1060, 410, { from: 'right', height: 270, depth: 9 });
  }

  private startTyping() {
    this.typing?.remove();
    this.typing = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        this.shown++;
        this.textObj.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.onTextDone();
      },
    });
  }

  /** 字打完：如果这一页还有下一张图，稍等一下再淡入 */
  private onTextDone() {
    this.typing?.remove();
    if (this.slideIndex + 1 >= this.slides.length || this.slideTimer) return;
    this.slideTimer = this.time.delayedCall(SLIDE_AFTER_TEXT, () => this.nextSlide());
  }

  private nextSlide() {
    this.slideTimer = undefined;
    const s = this.slides[++this.slideIndex];
    if (!s) return;
    this.tweens.add({ targets: s.img, alpha: 1, duration: SLIDE_FADE });
    this.tweens.add({ targets: s.img, scale: s.img.scale * 1.05, duration: 9000, ease: 'Sine.out' });
    this.playSoundFor(s.key);
    if (this.slideIndex + 1 < this.slides.length) this.slideTimer = this.time.delayedCall(SLIDE_FADE + 1800, () => this.nextSlide());
  }

  private playSoundFor(k: ImageKey) {
    const snd = PANELS[this.index].sound;
    if (!snd || snd.on !== k || !this.cache.audio.exists(storyKey(snd.key))) return;
    this.sfx?.destroy();
    this.sfx = this.sound.add(storyKey(snd.key));
    this.sfx.play();
    duckBgm(this, ((this.sfx as Phaser.Sound.WebAudioSound).duration || 4) * 1000);
  }

  private onNext() {
    if (this.loadingMissing || this.box.alpha < 1) return;
    // 文字还没打完时，第一下点击先显示全文
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.textObj.setText(this.full);
      this.onTextDone();
      return;
    }
    // 这一页还有图没出来（比如全家福），先把图放出来，不急着翻页
    if (this.slideIndex + 1 < this.slides.length) {
      this.slideTimer?.remove();
      this.nextSlide();
      return;
    }
    // 这一页还有下一段文字：换段，不翻页
    if (this.partIndex + 1 < this.parts.length) {
      this.partIndex++;
      this.full = this.parts[this.partIndex];
      this.shown = 0;
      this.textObj.setText('');
      if (PANELS[this.index].systemAtPart === this.partIndex) this.showSystem();
      this.startTyping();
      return;
    }
    this.index++;
    if (this.index >= PANELS.length) return this.goNext();
    this.show();
  }

  private goNext() {
    this.typing?.remove();
    this.slideTimer?.remove();
    this.sfx?.stop();
    this.scene.start('Stage1');
  }
}
