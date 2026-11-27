/**
 * 全部图片和音频素材清单。启动加载页（BootScene）按这里一次性预载并显示进度，
 * 各场景只用 key 取图；缺哪张图，场景会自动退回代码画的样子。
 * 图片由 tools/prepare_assets.py 从 art/reference 处理生成到 public/assets/。
 */

/** 菜单 */
export const MENU_IMAGES = {
  'menu-village': 'assets/menu/village.jpg',
  'menu-frog': 'assets/menu/frog.png', // 首页大笑的奶蛙
  'menu-egg': 'assets/menu/egg.png', // 首页的奶蛋
  // 界面素材：卷轴、按钮、名字标签（九宫格拉伸，见 src/battle/ui.ts 的 SLICES）
  'ui-scroll-wide': 'assets/ui/scroll_wide.png', // 横向卷轴：左右两根竖轴（对话框、说明框、弹窗）
  'ui-scroll-tall': 'assets/ui/scroll_tall.png', // 上下两根横轴的卷轴（首页按钮面板）
  'ui-button': 'assets/ui/button.png', // 木质按钮
  'ui-tag': 'assets/ui/name_tag.png', // 红色缎带名字标签
};

/** 序章插画 */
export const STORY_IMAGES = {
  village: 'assets/story/village.jpg', // 奶家村（序章开场先出现）
  family: 'assets/story/family.jpg', // 奶蛙家族全家福
  growth: 'assets/story/growth.jpg', // 成长之路：奶蛋 → 小奶蛙 → 奶蛙
  doom: 'assets/story/doom.jpg', // 末世：花草枯萎、病毒紫雾、天雷
  winter: 'assets/story/winter.jpg', // 寒冬的村子
  dying: 'assets/story/dying.jpg', // 奄奄一息的奶蛙
  split: 'assets/story/split.jpg', // 分化：大家长大成人（穿西装）
  rebirth: 'assets/story/rebirth.jpg', // 重生
  system: 'assets/story/system.png', // 引导角色「系统」：半透明蓝色幽灵（透明底）
  // 第二章剧情（素材到了以后由 tools/prepare_assets.py 生成；没有时用代码画的占位）
  ch2_school: 'assets/story/ch2_school.jpg', // 小奶蛙拿着奶茶走在奶家学院，回头望见天雷
  ch2_strike: 'assets/story/ch2_strike.jpg', // 天雷劈中村民，奶鸡和小奶蛙变暗紫色
  ch2_madness: 'assets/story/ch2_madness.jpg', // 感染的村民郁郁寡欢、暴躁、互相攻击
  ch2_think: 'assets/story/ch2_think.jpg', // 小奶蛙握拳思考
  end_celebrate: 'assets/story/end_celebrate.jpg', // 结局（奶家军赢）：奶家村恢复往日风光，众宾欢也
  end_eyes: 'assets/story/end_eyes.jpg', // 结局（奶家军赢）：奶蛙望向一边，暗处有一双眼睛
  end_occupied: 'assets/story/end_occupied.jpg', // 结局（暗派赢）：整个村子被占领
  end_jiejie: 'assets/story/end_jiejie.jpg', // 结局（暗派赢）：众宾桀桀桀
};
export type StoryImageKey = keyof typeof STORY_IMAGES;
export const storyKey = (k: string) => `story-${k}`;

/** 序章音频 */
export const STORY_SOUNDS = {
  laugh: 'audio/sfx_laugh_group.mp3', // 多人大笑（全家福那一页播放）
  jiejie: 'audio/sfx_jiejie.mp3', // 桀桀桀（暗派结局）
};

/** 第一关「狂风夜」 */
export const STAGE1_IMAGES = {
  field: 'assets/stage1/field.jpg',
  brick: 'assets/stage1/brick.png',
  bottle_empty: 'assets/stage1/bottle_empty.png',
  bottle_milk: 'assets/stage1/bottle_milk.png',
  bottle_tea: 'assets/stage1/bottle_tea.png',
  shovel: 'assets/stage1/shovel.png',
  spring: 'assets/stage1/spring.png',
  shelter: 'assets/stage1/shelter.png',
  wind: 'assets/stage1/wind.png',
  arrow: 'assets/stage1/arrow.png', // 灵泉方向箭头（黄色，尾巴渐隐；黑底素材由脚本按发光方式去底）
  // 第二关：小奶蛙四个方向（玩家和伙伴）、奶鸡（阴暗奶鸡用代码染成紫色）
  frog_down: 'assets/stage1/frog_down.png',
  frog_up: 'assets/stage1/frog_up.png',
  frog_left: 'assets/stage1/frog_left.png',
  frog_right: 'assets/stage1/frog_right.png',
  chicken: 'assets/stage1/chicken.png',
  // 第二关：感染后的奶鸡、小奶蛙四个方向、奶蛋（感染 / 快爆炸）、天雷、奶三角（引导配图）
  dark_chicken: 'assets/stage1/dark_chicken.png',
  dfrog_down: 'assets/stage1/dfrog_down.png',
  dfrog_up: 'assets/stage1/dfrog_up.png',
  dfrog_left: 'assets/stage1/dfrog_left.png',
  dfrog_right: 'assets/stage1/dfrog_right.png',
  egg_infected: 'assets/stage1/egg_infected.png',
  egg_bomb: 'assets/stage1/egg_bomb.png',
  thunder: 'assets/stage1/thunder.png',
  triangle: 'assets/stage1/triangle.png',
  // 第三章：成年奶蛙 / 奶粉四视图（普通 a、阴暗 da / d）、踢腿、奶狗、奶鼠、奶屎、金币、眩晕、地洞、成就图
  afrog_down: 'assets/stage3/afrog_down.png',
  afrog_up: 'assets/stage3/afrog_up.png',
  afrog_left: 'assets/stage3/afrog_left.png',
  afrog_right: 'assets/stage3/afrog_right.png',
  dafrog_down: 'assets/stage3/dafrog_down.png',
  dafrog_up: 'assets/stage3/dafrog_up.png',
  dafrog_left: 'assets/stage3/dafrog_left.png',
  dafrog_right: 'assets/stage3/dafrog_right.png',
  powder_down: 'assets/stage3/powder_down.png',
  powder_up: 'assets/stage3/powder_up.png',
  powder_left: 'assets/stage3/powder_left.png',
  powder_right: 'assets/stage3/powder_right.png',
  dpowder_down: 'assets/stage3/dpowder_down.png',
  dpowder_up: 'assets/stage3/dpowder_up.png',
  dpowder_left: 'assets/stage3/dpowder_left.png',
  dpowder_right: 'assets/stage3/dpowder_right.png',
  afrog_kick: 'assets/stage3/afrog_kick.png',
  dafrog_kick: 'assets/stage3/dafrog_kick.png',
  dog: 'assets/stage3/dog.png',
  dark_dog: 'assets/stage3/dark_dog.png',
  mouse: 'assets/stage3/mouse.png',
  dark_mouse: 'assets/stage3/dark_mouse.png',
  dark_servant: 'assets/stage3/dark_servant.png',
  poop: 'assets/stage3/poop.png',
  coin: 'assets/stage3/coin.png',
  stun: 'assets/stage3/stun.png',
  hole: 'assets/stage3/hole.png',
  achv_torment: 'assets/stage3/achv_torment.png',
  achv_sigma: 'assets/stage3/achv_sigma.png',
  card_mole: 'assets/stage3/card_mole.jpg', // 超能串子卡牌
  card_cant_hold: 'assets/stage3/card_cant_hold.jpg', // 无法绷住卡牌
  card_breaker: 'assets/stage3/card_breaker.jpg', // 破绷者卡牌
  // 第四章：西格玛（发射）、暗西格玛（站立 / 扭腰 / 中针）、解毒针、决斗场、超级串子卡牌（细长）
  sigma_shoot: 'assets/stage4/sigma_shoot.png',
  dark_sigma_idle: 'assets/stage4/dark_sigma_idle.png',
  dark_sigma_twist: 'assets/stage4/dark_sigma_twist.png',
  dark_sigma_hit: 'assets/stage4/dark_sigma_hit.png',
  needle: 'assets/stage4/needle.png',
  duel_arena: 'assets/stage4/duel_arena.jpg',
  card_mole_x3: 'assets/stage4/card_mole_x3.jpg',
  claw_open: 'assets/stage1/claw_open.png', // 抓手（张开）：伸出去时
  claw_closed: 'assets/stage1/claw_closed.png', // 抓手（合上）：抓着蛋收回时
  egg_down: 'assets/stage1/egg_down.png',
  egg_up: 'assets/stage1/egg_up.png',
  egg_left: 'assets/stage1/egg_left.png',
  egg_right: 'assets/stage1/egg_right.png',
};
export type Stage1ImageKey = keyof typeof STAGE1_IMAGES;
export const stage1Key = (k: Stage1ImageKey) => `s1-${k}`;

/**
 * 背景音乐：原始文件在 music/，由 tools/prepare_assets.py 压缩转码到 public/audio/。
 * 新增一首：放进 music/，在脚本的 AUDIO_JOBS 和这里各加一行。
 */
export const BGM = {
  happy: 'audio/bgm_happy.mp3', // 欢快：首页 + 序章温馨段（奶家村、成长之路、分化）
  doom: 'audio/bgm_doom.mp3', // 末世来临：序章末世、寒冬
  rebirth: 'audio/bgm_rebirth.mp3', // 重生：序章重生、系统登场
  chapter1: 'audio/bgm_chapter1.mp3', // 第一关狂风夜
  sigma: 'audio/bgm_sigma.mp3', // 第四章 sigma 对决
};

/** 结算音乐：只放一遍（8～10 秒），放的时候背景音乐压低 */
export const JINGLES = {
  goodWin: 'audio/jingle_good_win.mp3', // 第四章奶家军胜利结算
  mole1: 'audio/jingle_mole1.mp3', // 串子第一次结算（第三章解锁隐藏彩蛋：超能串子）
  mole2: 'audio/jingle_mole2.mp3', // 串子第二次结算（第四章解锁超级串子）
};
export type JingleKey = keyof typeof JINGLES;
export const jingleKey = (k: JingleKey) => `jingle-${k}`;
export type BgmKey = keyof typeof BGM;
export const bgmKey = (k: BgmKey) => `bgm-${k}`;

/**
 * 序列帧动画（由 tools/prepare_assets.py 从黑底视频生成）。frameWidth/frameHeight 要和脚本 SHEET_JOBS 里的边长一致。
 */
export const SPRITESHEETS = {
  // 引导角色「系统」：挥手、转身、飘动，循环播放
  'system-anim': { url: 'assets/story/system_anim.png', frameWidth: 200, frameHeight: 200, fps: 10, anim: 'system-float' },
  // 奶三角：三只小奶蛙手拉手转圈
  'triangle-anim': { url: 'assets/stage1/triangle_anim.png', frameWidth: 220, frameHeight: 220, fps: 10, anim: 'triangle-spin' },
};
export const SYSTEM_ANIM = 'system-float';
export const TRIANGLE_ANIM = 'triangle-spin';

/** 启动时要预载的全部素材 */
export function allAssets() {
  const images: [string, string][] = [
    ...Object.entries(MENU_IMAGES),
    ...Object.entries(STORY_IMAGES).map(([k, u]) => [storyKey(k), u] as [string, string]),
    ...Object.entries(STAGE1_IMAGES).map(([k, u]) => [stage1Key(k as Stage1ImageKey), u] as [string, string]),
  ];
  const audio: [string, string][] = [
    ...Object.entries(STORY_SOUNDS).map(([k, u]) => [storyKey(k), u] as [string, string]),
    ...Object.entries(BGM).map(([k, u]) => [bgmKey(k as BgmKey), u] as [string, string]),
    ...Object.entries(JINGLES).map(([k, u]) => [jingleKey(k as JingleKey), u] as [string, string]),
  ];
  return { images, audio, sheets: Object.entries(SPRITESHEETS) };
}
