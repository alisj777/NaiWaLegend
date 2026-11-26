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
};
export type StoryImageKey = keyof typeof STORY_IMAGES;
export const storyKey = (k: string) => `story-${k}`;

/** 序章音频 */
export const STORY_SOUNDS = {
  laugh: 'audio/sfx_laugh_group.mp3', // 多人大笑（全家福那一页播放）
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
};
export type BgmKey = keyof typeof BGM;
export const bgmKey = (k: BgmKey) => `bgm-${k}`;

/**
 * 序列帧动画（由 tools/prepare_assets.py 从黑底视频生成）。frameWidth/frameHeight 要和脚本 SHEET_JOBS 里的边长一致。
 */
export const SPRITESHEETS = {
  // 引导角色「系统」：挥手、转身、飘动，循环播放
  'system-anim': { url: 'assets/story/system_anim.png', frameWidth: 200, frameHeight: 200, fps: 10 },
};
export const SYSTEM_ANIM = 'system-float';

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
  ];
  return { images, audio, sheets: Object.entries(SPRITESHEETS) };
}
