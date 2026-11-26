# 微信小游戏迁移清单

目标：网页版（Phaser）验证完玩法后，迁到 Cocos Creator，发布为**微信小游戏**（注意不是“小程序”类目）。

## 代码分层（已完成）

| 层 | 位置 | 迁移时 |
| --- | --- | --- |
| 规则逻辑 | `src/stage1/world.ts`、`src/stage1/ai.ts`、`src/battle/logic/battle.ts` | **原样复用**，不依赖任何引擎 |
| 数值配置 | `src/config/` | 原样复用 |
| 文案 | `src/copy/` | 原样复用 |
| 平台功能 | `src/platform/index.ts` | 新增 wechat 实现（见下） |
| 画面与输入 | `src/scenes/`、`src/battle/art.ts`、`ui.ts`、`touch.ts`、`tutorial.ts` | 用 Cocos 重写 |

规则逻辑层通过“指令进、事件出”和画面层通信：

- 第一关：`setWantDir / face / act` → `world.events`
- 对战：`moveTo / playCard / buyTea …` → `world.events`

以后做真人联机，规则逻辑可以直接放到 Node.js 服务器上跑。

## 平台层需要的微信实现

| 接口 | 网页 | 微信小游戏 |
| --- | --- | --- |
| `getQuery` | `location.search` | `wx.getLaunchOptionsSync().query` |
| `load / save` | `localStorage` | `wx.getStorageSync / wx.setStorageSync` |
| `canRequestFullscreen` | 触屏且支持全屏 | 返回 `false`（小游戏本身全屏） |
| `vibrate` | `navigator.vibrate` | `wx.vibrateShort` |
| `share` | 空 | `wx.shareAppMessage` |

## 网页专属、迁移时要替换的东西

- `index.html` 里的竖屏提示和 viewport 设置：小游戏改用 `game.json` 里的 `"deviceOrientation": "landscape"`
- 剧情素材路径（`src/scenes/StoryScene.ts` 顶部的 `ASSETS`）：大图和音频建议放 CDN 按需加载

## 上线前要查的（以微信官方最新规定为准）

- [ ] 注册小游戏账号，确认个人还是企业主体（两者能开的功能不同）
- [ ] 主包大小限制（官方文档写的是 4MB），图片压缩、按需分包
- [ ] 游戏版号、软件著作权：要接广告或内购赚钱的，一般需要版号
- [ ] 联机服务器：域名要备案，并配置为小游戏后台的合法域名（wss）
- [ ] 隐私协议：用到登录、存档、分享时，要在后台填写用户隐私保护指引
