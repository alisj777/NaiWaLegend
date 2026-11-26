import { platform } from './platform';

/**
 * 跨关卡的存档：每关存下来的物资会一直累积，后面的关卡读这里。
 * 存在本地（网页 localStorage，以后微信小游戏换成 wx 存储，由平台层处理）。
 */
export interface Stash {
  /** 空瓶 */
  empty: number;
  /** 奶茶（满瓶） */
  tea: number;
  /** 奶瓶（满瓶） */
  milk: number;
}

const KEY = 'naiwa.stash.v1';

export function loadStash(): Stash {
  return { empty: 0, tea: 0, milk: 0, ...platform.load<Partial<Stash>>(KEY, {}) };
}

/** 把这一关存下的物资加进累计，返回加完后的累计 */
export function addToStash(add: Stash): Stash {
  const s = loadStash();
  s.empty += add.empty;
  s.tea += add.tea;
  s.milk += add.milk;
  platform.save(KEY, s);
  return s;
}
