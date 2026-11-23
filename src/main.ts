import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { DuelScene } from './scenes/DuelScene';
import { ResultScene } from './scenes/ResultScene';
import { StoryScene } from './scenes/StoryScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1d2330',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, StoryScene, BattleScene, DuelScene, ResultScene],
});
