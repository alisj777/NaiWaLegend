import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { DuelScene } from './scenes/DuelScene';
import { ResultScene } from './scenes/ResultScene';
import { StoryScene } from './scenes/StoryScene';
import { Stage1Scene } from './scenes/Stage1Scene';
import { Stage2Scene } from './scenes/Stage2Scene';
import { Stage3Scene } from './scenes/Stage3Scene';

import { fitGameToScreen } from './battle/layout';

// 开发模式下：手机浏览器看不到控制台，把运行错误直接显示在屏幕顶部，方便截图排查（打包后的正式版不显示）
if (import.meta.env.DEV) {
  const show = (msg: string) => {
    let box = document.getElementById('dev-error');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'dev-error';
      box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;margin:0;padding:8px 12px;max-height:40vh;overflow:auto;background:rgba(160,20,20,.92);color:#fff;font:12px/1.5 monospace;white-space:pre-wrap';
      document.body.appendChild(box);
    }
    box.textContent += msg + '\n';
  };
  window.addEventListener('error', (e) => show(`错误：${e.message}\n  ${e.filename ?? ''}:${e.lineno ?? ''}`));
  window.addEventListener('unhandledrejection', (e) => show(`错误：${String(e.reason?.stack ?? e.reason)}`));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1d2330',
  // 铺满屏幕：游戏画布的宽高比随屏幕变化（见 fitGameToScreen），再用 FIT 等比填满，
  // 1280×720 的设计区域始终完整可见，多出来的部分由各场景用背景补满（见 src/battle/layout.ts）
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // 手机上要能一只手按方向键、另一只手同时按举起
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, StoryScene, Stage1Scene, Stage2Scene, Stage3Scene, BattleScene, DuelScene, ResultScene],
});
fitGameToScreen(game);
