# 奶蛙家族 · 即时卡牌 RPG

<!-- TODO: 这里放 1~2 分钟演示视频 -->

网页即时卡牌对战：操控一颗光奶蛋，在天雷和暗奶蛋的夹击下长成西格玛奶蛙。

- 技术栈：Phaser 3 + TypeScript + Vite，构建产物为纯静态文件
- 运行：`npm install && npm run dev`
- 构建：`npm run build`，产物在 `dist/`，可直接部署到 GitHub Pages / Vercel

## 代码结构

| 路径 | 内容 |
| --- | --- |
| `src/config/balance.ts` | 全部数值，标注【补充】的是设计文档未规定、实现时补上的值 |
| `src/skins/` | 皮肤包：角色名与配色，`?skin=<id>` 切换 |
| `src/battle/art.ts` | 代码绘制的原创形象（无外部图片） |
| `src/scenes/BattleScene.ts` | 主战斗：成长、天雷、光暗转换、卡牌、经济、朋友、AI |
| `src/scenes/DuelScene.ts` | 西格玛决斗：射肚脐眼、扭腰躲箭 |

## 操作

- 点击场地移动；点击奶屎去捡（走到旁边自动收取）
- 底部点击手牌打出，商店按钮花金币
- 决斗：空格 / 点击射箭，A D 或 ← → 扭腰
