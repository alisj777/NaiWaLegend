import Phaser from 'phaser';

/** 所有形象用代码绘制的原创几何图形，美术风格定下来后替换这里即可。 */

/** 游戏字体：跟随系统，保证好认（标题的描边、渐变效果在 ui.ts 的 titleText 里做） */
export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
/** 标题字体：阿里妈妈方圆体（public/fonts/title.ttf），缺字或没加载到时退回系统字体 */
export const TITLE_FONT = `"TitleFont",${FONT}`;

type G = Phaser.GameObjects.Graphics;

function eyes(g: G, dx: number, y: number, r: number, sigma = false) {
  g.fillStyle(0xffffff).fillCircle(-dx, y, r).fillCircle(dx, y, r);
  g.fillStyle(0x222222).fillCircle(-dx + r * 0.25, y, r * 0.5).fillCircle(dx + r * 0.25, y, r * 0.5);
  if (sigma) {
    // 西格玛形态：墨镜
    g.fillStyle(0x111111).fillRoundedRect(-dx - r * 1.3, y - r * 0.7, dx * 2 + r * 2.6, r * 1.3, 4);
  }
}

/** 主角：按等级从蛋 → 蝌蚪 → 小蛙 → 蛙 → 西格玛，体积越小等级越低 */
export function drawHero(g: G, level: number, color: number) {
  g.clear();
  const s = 14 + level * 5;
  if (level === 1) {
    g.fillStyle(color).fillEllipse(0, 0, s * 1.6, s * 2.1);
    g.fillStyle(0xffffff, 0.5).fillEllipse(-s * 0.3, -s * 0.4, s * 0.4, s * 0.6);
    eyes(g, s * 0.3, -s * 0.1, s * 0.18);
  } else if (level === 2) {
    g.fillStyle(color).fillTriangle(s * 0.6, 0, s * 1.9, -s * 0.5, s * 1.9, s * 0.5);
    g.fillStyle(color).fillCircle(0, 0, s);
    eyes(g, s * 0.35, -s * 0.25, s * 0.25);
  } else {
    // 蛙形
    g.fillStyle(color).fillEllipse(-s * 0.75, s * 0.7, s * 0.9, s * 0.5).fillEllipse(s * 0.75, s * 0.7, s * 0.9, s * 0.5);
    g.fillStyle(color).fillEllipse(0, 0, s * 2.2, s * 1.6);
    g.fillStyle(color).fillCircle(-s * 0.5, -s * 0.65, s * 0.38).fillCircle(s * 0.5, -s * 0.65, s * 0.38);
    eyes(g, s * 0.5, -s * 0.68, s * 0.26, level === 5);
    g.fillStyle(0xffffff, 0.35).fillEllipse(0, s * 0.25, s * 1.3, s * 0.8);
    g.lineStyle(2, 0x333333).beginPath().arc(0, -s * 0.05, s * 0.4, 0.2, Math.PI - 0.2).strokePath();
    // 肚脐眼（决斗靶心）
    g.fillStyle(0x333333).fillCircle(0, s * 0.35, 2.5);
  }
}

export function drawEgg(g: G, color: number, size = 11) {
  g.clear();
  g.fillStyle(color).fillEllipse(0, 0, size * 1.6, size * 2.1);
  g.fillStyle(0xffffff, 0.45).fillEllipse(-size * 0.3, -size * 0.4, size * 0.4, size * 0.6);
}

export function drawDog(g: G, color: number) {
  g.clear();
  g.fillStyle(0xd8b48a).fillRoundedRect(-18, -8, 36, 20, 8);
  g.fillStyle(0xd8b48a).fillCircle(16, -10, 11);
  g.fillStyle(0x8a5a32).fillEllipse(10, -18, 7, 13).fillEllipse(22, -18, 7, 13);
  g.fillStyle(0x222222).fillCircle(19, -11, 2).fillCircle(26, -8, 2.5);
  g.lineStyle(3, color).strokeCircle(0, 2, 22);
}

export function drawMouse(g: G, color: number) {
  g.clear();
  g.lineStyle(2, 0xbbbbbb).beginPath().moveTo(-10, 4).lineTo(-24, 0).strokePath();
  g.fillStyle(0xc9c9d1).fillEllipse(0, 3, 24, 16);
  g.fillStyle(0xe8b4c8).fillCircle(4, -8, 7).fillCircle(14, -6, 7);
  g.fillStyle(0x222222).fillCircle(12, 1, 1.8);
  g.lineStyle(3, color).strokeCircle(0, 0, 18);
}

export function drawPowder(g: G, color: number) {
  g.clear();
  g.fillStyle(0xfafafa).fillRoundedRect(-11, -15, 22, 30, 4);
  g.fillStyle(0x9ec5ff).fillRect(-11, -4, 22, 9);
  g.fillStyle(0xdddddd).fillRect(-12, -18, 24, 5);
  g.lineStyle(3, color).strokeCircle(0, 0, 20);
}

export function drawChicken(g: G, color: number) {
  g.clear();
  g.fillStyle(0xfdfdf6).fillEllipse(0, 2, 30, 26);
  g.fillStyle(0xfdfdf6).fillCircle(10, -10, 9);
  g.fillStyle(0xe74c3c).fillTriangle(6, -19, 10, -25, 14, -18);
  g.fillStyle(0xf39c12).fillTriangle(18, -11, 25, -8, 18, -6);
  g.fillStyle(0x222222).fillCircle(12, -11, 1.8);
  g.lineStyle(3, color).strokeCircle(0, 0, 21);
}

export function drawFriend(g: G, index: number, color: number) {
  g.clear();
  if (index === 0) {
    // 猫
    g.fillStyle(0xf2c27b).fillTriangle(-12, -8, -6, -20, 0, -8).fillTriangle(0, -8, 6, -20, 12, -8);
    g.fillStyle(0xf2c27b).fillCircle(0, 0, 13);
  } else if (index === 1) {
    // 兔
    g.fillStyle(0xf4f4f4).fillEllipse(-5, -18, 6, 20).fillEllipse(5, -18, 6, 20);
    g.fillStyle(0xf4f4f4).fillCircle(0, 0, 13);
  } else {
    // 鱼
    g.fillStyle(0x7fd3e6).fillTriangle(10, 0, 22, -9, 22, 9);
    g.fillStyle(0x7fd3e6).fillEllipse(0, 0, 28, 18);
  }
  g.fillStyle(0x222222).fillCircle(-4, -2, 1.8).fillCircle(4, -2, 1.8);
  g.lineStyle(3, color).strokeCircle(0, 0, 19);
}

export function drawChaos(g: G, t: number) {
  g.clear();
  g.fillStyle(0x4a2a6a).fillEllipse(0, 0, 44, 56);
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + (i * Math.PI * 2) / 3;
    g.fillStyle([0x6ea8ff, 0xff9a3c, 0xd96bff][i], 0.8).fillCircle(Math.cos(a) * 10, Math.sin(a) * 14, 7);
  }
  g.lineStyle(2, 0xd96bff).strokeEllipse(0, 0, 50, 62);
}

export function drawPoop(g: G, level: number, color: number) {
  g.clear();
  const s = 5 + level * 3;
  g.fillStyle(color).fillEllipse(0, s * 0.6, s * 2.6, s * 1.1);
  g.fillStyle(color).fillEllipse(0, 0, s * 2, s);
  g.fillStyle(color).fillEllipse(0, -s * 0.6, s * 1.3, s * 0.8);
  g.fillStyle(0xffffff, 0.35).fillCircle(-s * 0.3, -s * 0.2, s * 0.25);
}

export function drawFortress(g: G, color: number) {
  g.clear();
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      g.fillStyle(color).fillCircle(-16 + row * 8 + i * 16, 10 - row * 12, 9);
    }
  }
  g.lineStyle(2, 0xffe08a).strokeRoundedRect(-28, -22, 56, 44, 10);
}

export function drawBow(g: G) {
  g.clear();
  g.fillStyle(0xff7eb6).fillTriangle(0, 0, -9, -6, -9, 6).fillTriangle(0, 0, 9, -6, 9, 6);
  g.fillStyle(0xff4f9a).fillCircle(0, 0, 2.5);
}

/** 牛马村的牛（剧情用） */
export function drawCow(g: G, dizzy = false) {
  g.clear();
  g.fillStyle(0xf5f5f0).fillRoundedRect(-40, -20, 80, 44, 16);
  g.fillStyle(0x333333).fillEllipse(-14, -4, 22, 16).fillEllipse(18, 10, 16, 12);
  g.fillStyle(0xf5f5f0).fillRect(-34, 18, 10, 22).fillRect(24, 18, 10, 22);
  g.fillStyle(0xf5f5f0).fillCircle(44, -22, 18);
  g.fillStyle(0xf2b8c6).fillEllipse(54, -16, 18, 12);
  g.fillStyle(0xd9c7a0).fillTriangle(34, -38, 38, -50, 42, -38).fillTriangle(48, -38, 52, -50, 56, -38);
  if (dizzy) {
    g.lineStyle(2, 0x222222).strokeCircle(42, -26, 4).strokeCircle(52, -26, 4);
  } else {
    g.fillStyle(0x222222).fillCircle(42, -26, 2.5).fillCircle(52, -26, 2.5);
  }
}

/** 牛马村的马（剧情用） */
export function drawHorse(g: G, dizzy = false) {
  g.clear();
  g.fillStyle(0xa86b3c).fillRoundedRect(-38, -16, 76, 38, 16);
  g.fillStyle(0xa86b3c).fillRect(-32, 18, 9, 24).fillRect(24, 18, 9, 24);
  g.fillStyle(0xa86b3c).fillTriangle(26, -10, 40, -48, 52, -40);
  g.fillStyle(0xa86b3c).fillEllipse(54, -44, 30, 18);
  g.fillStyle(0x4a2e18).fillTriangle(24, -14, 34, -50, 30, -12);
  g.fillStyle(0x4a2e18).fillRect(-44, -12, 8, 26);
  if (dizzy) g.lineStyle(2, 0x222222).strokeCircle(54, -48, 4);
  else g.fillStyle(0x222222).fillCircle(54, -48, 2.5);
}

export function drawBolt(g: G, x: number, y1: number, y2: number) {
  g.lineStyle(6, 0xfff27a);
  g.beginPath().moveTo(x, y1);
  let cx = x;
  for (let y = y1 + 30; y < y2; y += 30) {
    cx += y % 60 === 0 ? 18 : -18;
    g.lineTo(cx, y);
  }
  g.lineTo(x, y2).strokePath();
}
