/**
 * 平台层：所有"浏览器才有、微信小游戏里没有"的功能都只在这里出现。
 * 游戏代码只调用 platform.xxx，不直接碰 location / localStorage / document / screen。
 * 迁移到微信小游戏时，新增一个 wechat 实现（wx.getLaunchOptionsSync、wx.setStorageSync、
 * wx.vibrateShort、wx.shareAppMessage 等），在下面 detect() 里切换即可。
 */
export interface Platform {
  readonly name: 'web' | 'wechat';
  /** 启动参数（网页是 ?key=value，小游戏是 query） */
  getQuery(key: string): string | null;
  /** 本地存档（网页 localStorage，小游戏 wx.setStorageSync） */
  load<T>(key: string, fallback: T): T;
  save(key: string, value: unknown): void;
  /** 是否需要显示"全屏横屏"按钮（小游戏本身就是全屏横屏，不需要） */
  canRequestFullscreen(): boolean;
  requestFullscreenLandscape(): void;
  /** 短震动反馈（不支持的平台静默忽略） */
  vibrate(ms?: number): void;
  /** 分享（网页暂不实现，小游戏用 wx.shareAppMessage） */
  share(title: string): void;
  /**
   * 激励视频广告：看完返回 true，中途关闭返回 false。
   * 网页版没有广告，直接返回 true 方便测试；微信版改用 wx.createRewardedVideoAd。
   */
  showRewardedAd(placement: string): Promise<boolean>;
  /** 游戏引擎启动后，关掉引擎加载前显示的启动画面（网页是 index.html 里的 #splash） */
  hideSplash(): void;
  /**
   * 设置网页底色。iPhone Safari 有时不让画面铺进刘海和底部横条区域，那里露出的是网页底色，
   * 让它跟着场景背景色变，看起来就和画面连成一片。小游戏不需要。
   */
  setPageColor(color: number): void;
  /** 等字体加载好（最多等 timeout 毫秒）；小游戏用 wx.loadFont */
  waitFont(family: string, timeout: number): Promise<void>;
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

const web: Platform = {
  name: 'web',
  getQuery: (key) => new URLSearchParams(location.search).get(key),
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 隐私模式等情况下存不了，忽略
    }
  },
  canRequestFullscreen: () => 'ontouchstart' in window && !!document.fullscreenEnabled,
  requestFullscreenLandscape() {
    document.documentElement
      .requestFullscreen?.()
      .then(() => (screen.orientation as LockableOrientation).lock?.('landscape'))
      .catch(() => {});
  },
  vibrate: (ms = 15) => navigator.vibrate?.(ms),
  share: () => {},
  hideSplash: () => document.getElementById('splash')?.remove(),
  setPageColor: (color) => {
    const css = `#${color.toString(16).padStart(6, '0')}`;
    document.documentElement.style.background = css;
    document.body.style.background = css;
    const game = document.getElementById('game');
    if (game) game.style.background = css;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', css);
  },
  waitFont: (family, timeout) =>
    Promise.race([
      document.fonts?.load(`40px "${family}"`, '奶').then(() => undefined) ?? Promise.resolve(),
      new Promise<void>((r) => setTimeout(r, timeout)),
    ]).catch(() => undefined),
  showRewardedAd: async (placement) => {
    console.info(`[广告位] ${placement}：网页版没有广告，直接视为看完`);
    return true;
  },
};

function detect(): Platform {
  // 以后：if (typeof wx !== 'undefined') return wechat;
  return web;
}

export const platform: Platform = detect();
