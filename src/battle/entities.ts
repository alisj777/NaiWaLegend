import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { Skin } from '../skins';
import * as art from './art';

export type Faction = 'light' | 'dark';
export type SideId = 'player' | 'ai';
export type UnitKind = 'hero' | 'egg' | 'dog' | 'mouse' | 'powder' | 'chicken' | 'friend' | 'chaos' | 'fortress';
export type CardId = 'dog' | 'mouse' | 'powder' | 'chicken' | 'poop';

export const FIELD = { x: 20, y: 80, w: 1240, h: 420 };

export const other = (s: SideId): SideId => (s === 'player' ? 'ai' : 'player');

export class Unit {
  view: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  bow: Phaser.GameObjects.Graphics;
  alive = true;
  poison = 0;
  moveTarget: { x: number; y: number } | null = null;
  followTarget: Unit | null = null;
  followGap = 34;
  speed = 80;
  radius = 18;
  dance: { cx: number; cy: number; angle: number; until: number } | null = null;
  /** 奶狗吃屎冷却、奶鸡产蛋计时等通用计时器 */
  timer = 0;
  friendIndex = -1;

  constructor(
    public scene: Phaser.Scene,
    public kind: UnitKind,
    public owner: SideId,
    public faction: Faction,
    x: number,
    y: number,
    public name: string,
  ) {
    this.gfx = scene.add.graphics();
    this.nameText = scene.add
      .text(0, 26, name, { fontFamily: art.FONT, fontSize: '12px', color: '#1d2330', backgroundColor: '#ffffffaa', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 0);
    this.bow = scene.add.graphics().setVisible(false);
    art.drawBow(this.bow);
    this.view = scene.add.container(x, y, [this.gfx, this.nameText, this.bow]);
    this.view.setDepth(10);
  }

  get x() {
    return this.view.x;
  }
  get y() {
    return this.view.y;
  }

  setName(n: string) {
    this.name = n;
    this.nameText.setText(n);
  }

  dist(o: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(this.x, this.y, o.x, o.y);
  }

  stepToward(tx: number, ty: number, dt: number, stopAt = 2) {
    const d = Phaser.Math.Distance.Between(this.x, this.y, tx, ty);
    if (d <= stopAt) return true;
    const step = Math.min(d - stopAt, this.speed * dt);
    this.view.x += ((tx - this.x) / d) * step;
    this.view.y += ((ty - this.y) / d) * step;
    clampToField(this.view);
    return false;
  }

  destroy() {
    this.alive = false;
    this.view.destroy();
  }
}

export class Hero extends Unit {
  level = 1;
  hp: number = BALANCE.hero.startHp;
  growth = 0;
  deepDark = false;
  antidoteHits = 0;
  attackTimer = 1;

  constructor(scene: Phaser.Scene, owner: SideId, faction: Faction, x: number, y: number, private skin: Skin) {
    super(scene, 'hero', owner, faction, x, y, '');
    this.speed = BALANCE.hero.moveSpeed;
    this.nameText.setFontSize(14);
    this.redraw();
  }

  get color() {
    const c = this.skin.colors;
    return this.faction === 'light' ? c.light : this.deepDark ? c.deepDark : c.dark;
  }

  get title() {
    const n = this.skin.heroNames;
    if (this.faction === 'dark' && this.deepDark && this.level === 4) return n.deepDark;
    return (this.faction === 'light' ? n.light : n.dark)[this.level - 1];
  }

  redraw() {
    art.drawHero(this.gfx, this.level, this.color);
    this.radius = 14 + this.level * 5;
    this.nameText.setY(this.radius + 8);
    this.bow.setPosition(0, -this.radius - 4);
    const who = this.owner === 'player' ? '你' : 'AI';
    this.setName(`${who}·${this.title} Lv${this.level}`);
  }
}

export class Poop {
  view: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  alive = true;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public level: number,
    public owner: SideId | null,
    color: number,
  ) {
    this.gfx = scene.add.graphics();
    art.drawPoop(this.gfx, level, color);
    this.view = scene.add.container(x, y, [this.gfx]).setDepth(5);
  }
  get x() {
    return this.view.x;
  }
  get y() {
    return this.view.y;
  }
  destroy() {
    this.alive = false;
    this.view.destroy();
  }
}

export type FriendMode = 'protect' | 'fight' | 'sold' | 'dead' | 'defected';

export interface Friend {
  index: number;
  name: string;
  hp: number;
  mode: FriendMode;
  unit: Unit | null;
}

export interface Side {
  id: SideId;
  hero: Hero;
  coins: number;
  hand: CardId[];
  /** 奶屎背包：下标 0/1/2 对应 1/2/3 级 */
  poops: number[];
  bottle: number;
  needleMisses: number;
  eggs: Unit[];
  pollutedUntil: number;
  frozenUntil: number;
  comebackReadyAt: number;
  protectRewardGiven: boolean;
  friends: Friend[];
}

export function clampToField(o: { x: number; y: number }) {
  o.x = Phaser.Math.Clamp(o.x, FIELD.x + 16, FIELD.x + FIELD.w - 16);
  o.y = Phaser.Math.Clamp(o.y, FIELD.y + 16, FIELD.y + FIELD.h - 16);
}

export function randomFieldPoint(xMin = FIELD.x + 30, xMax = FIELD.x + FIELD.w - 30) {
  return {
    x: Phaser.Math.Between(xMin, xMax),
    y: Phaser.Math.Between(FIELD.y + 30, FIELD.y + FIELD.h - 30),
  };
}
