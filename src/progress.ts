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

/** 第一关存下的庇护所形状（按闭合先后顺序），第二关开局依次放置 */
export interface SavedShelter {
  walls: [number, number][];
  inner: [number, number][];
}
const SHELTER_KEY = 'naiwa.shelters.v1';
const LEVEL_KEY = 'naiwa.level.v1';

export function saveShelters(list: SavedShelter[]) {
  platform.save(SHELTER_KEY, list);
}

/** 读不到（比如看广告跳过了第一关、或者一个庇护所都没盖）时，给一个 4 块砖围一格的最小庇护所 */
export function loadShelters(): SavedShelter[] {
  const list = platform.load<SavedShelter[]>(SHELTER_KEY, []);
  return list.length ? list : [{ walls: [[1, 0], [0, 1], [2, 1], [1, 2]], inner: [[1, 1]] }];
}

/** 玩家等级：第一关 Lv.1 奶蛋，过关后 Lv.2 小奶蛙 */
export function loadLevel(): number {
  return platform.load<number>(LEVEL_KEY, 1);
}
export function saveLevel(lv: number) {
  platform.save(LEVEL_KEY, Math.max(lv, loadLevel()));
}
