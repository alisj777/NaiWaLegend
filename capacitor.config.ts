import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 安卓包配置（Capacitor 把网页版 dist/ 包成安卓 App）。
 * 打包：npm run android（构建网页 → 同步到 android/ → 用 Gradle 出 APK）
 */
const config: CapacitorConfig = {
  appId: 'com.naiwafamily.game',
  appName: '奶蛙家族',
  webDir: 'dist',
  android: {
    // 游戏里不需要网页那种长按选择、缩放
    allowMixedContent: false,
  },
};

export default config;
