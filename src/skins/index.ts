import { platform } from '../platform';

/**
 * 皮肤包：角色名字和配色全部放在这里，与玩法代码解耦。
 * 想做别的版本，就新增一个 Skin 对象并加入 SKINS，然后用 ?skin=<id> 切换。
 * 当前所有形象都是代码绘制的原创几何图形，不使用任何外部图片。
 */
export interface Skin {
  id: string;
  title: string;
  heroNames: { light: string[]; dark: string[]; deepDark: string };
  units: Record<'egg' | 'darkEgg' | 'dog' | 'mouse' | 'powder' | 'chicken' | 'chaos' | 'fortress', string>;
  friends: string[];
  colors: {
    light: number;
    dark: number;
    deepDark: number;
    neutral: number;
    poop: number;
    field: number;
    fieldLine: number;
    panel: number;
  };
}

const naiwa: Skin = {
  id: 'naiwa',
  title: '奶蛙家族',
  heroNames: {
    // 设计文档里的进化线图没有导出，Lv2/Lv3 名字是暂定的
    light: ['奶蛋', '奶蝌蚪', '小奶蛙', '奶蛙', '西格玛奶蛙'],
    dark: ['暗奶蛋', '暗奶蝌蚪', '暗小奶蛙', '暗奶蛙', '西格玛奶暗蛙'],
    deepDark: '暗中过暗奶蛙',
  },
  units: {
    egg: '仆人蛋',
    darkEgg: '暗奶蛋',
    dog: '奶狗',
    mouse: '奶鼠',
    powder: '奶粉',
    chicken: '奶鸡',
    chaos: '混沌奶蛋',
    fortress: '奶屎堡垒',
  },
  friends: ['奶猫', '奶兔', '奶鱼'],
  colors: {
    light: 0x6ea8ff,
    dark: 0xff9a3c,
    deepDark: 0xd9483b,
    neutral: 0xe8dcc0,
    poop: 0x8b5a2b,
    field: 0x7fb069,
    fieldLine: 0x6a9a56,
    panel: 0x232a38,
  },
};

export const SKINS: Record<string, Skin> = { naiwa };

export function currentSkin(): Skin {
  const id = platform.getQuery('skin') ?? 'naiwa';
  return SKINS[id] ?? naiwa;
}
