import Phaser from 'phaser';
import { BgmKey, bgmKey } from '../assets';

/**
 * 背景音乐：全游戏共用一条，切场景时淡出旧曲、淡入新曲；同一首就接着放，不会从头开始。
 * 音乐文件放在 public/audio/（见 src/assets.ts 的 BGM），缺文件时静默不放。
 */
let current: Phaser.Sound.BaseSound | null = null;
let currentKey: BgmKey | null = null;
const VOLUME = 0.45;

export function playBgm(scene: Phaser.Scene, key: BgmKey) {
  if (currentKey === key && current?.isPlaying) return;
  const old = current;
  if (old) {
    scene.tweens.add({ targets: old, volume: 0, duration: 600, onComplete: () => old.destroy() });
  }
  current = null;
  currentKey = key;
  if (!scene.cache.audio.exists(bgmKey(key))) return;
  const snd = scene.sound.add(bgmKey(key), { loop: true, volume: 0 });
  snd.play();
  scene.tweens.add({ targets: snd, volume: VOLUME, duration: 800 });
  current = snd;
}

export function stopBgm(scene: Phaser.Scene) {
  const old = current;
  current = null;
  currentKey = null;
  if (old) scene.tweens.add({ targets: old, volume: 0, duration: 600, onComplete: () => old.destroy() });
}

/** 放音效时把背景音乐压低一点，放完再恢复（比如全家福的大笑） */
export function duckBgm(scene: Phaser.Scene, ms: number) {
  const snd = current;
  if (!snd) return;
  scene.tweens.add({ targets: snd, volume: VOLUME * 0.35, duration: 300 });
  scene.time.delayedCall(ms, () => snd === current && scene.tweens.add({ targets: snd, volume: VOLUME, duration: 600 }));
}
