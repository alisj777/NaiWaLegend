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
};

function detect(): Platform {
  // 以后：if (typeof wx !== 'undefined') return wechat;
  return web;
}

export const platform: Platform = detect();
