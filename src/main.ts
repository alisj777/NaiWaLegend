import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { DuelScene } from './scenes/DuelScene';
import { ResultScene } from './scenes/ResultScene';
import { StoryScene } from './scenes/StoryScene';
import { Stage1Scene } from './scenes/Stage1Scene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1d2330',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // 手机上要能一只手按方向键、另一只手同时按举起
  input: { activePointers: 3 },
  scene: [MenuScene, StoryScene, Stage1Scene, BattleScene, DuelScene, ResultScene],
});
