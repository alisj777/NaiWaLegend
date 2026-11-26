import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { DuelScene } from './scenes/DuelScene';
import { ResultScene } from './scenes/ResultScene';
import { StoryScene } from './scenes/StoryScene';
import { Stage1Scene } from './scenes/Stage1Scene';

import { fitGameToScreen } from './battle/layout';

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
  scene: [BootScene, MenuScene, StoryScene, Stage1Scene, BattleScene, DuelScene, ResultScene],
});
fitGameToScreen(game);
