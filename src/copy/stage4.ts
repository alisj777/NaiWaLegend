import { STAGE4 as C } from '../config/stage4';

/**
 * 第四章「终极决斗」的全部文案。改字只改这里。
 * 带 (x) => ... 的是模板，${} 里是程序填进去的数字，保留它们、只改周围的字即可。
 */
export const STAGE4_TEXT = {
  title: '第四章 · 终极决斗',
  levelTag: '西格玛斗士',

  sides: { good: '奶家军', dark: '暗派' },
  names: { good: '西格玛奶蛙', dark: '暗西格玛奶蛙' },

  /** 解锁时（第三章结算里） */
  unlock: '解锁终极决斗！获得西格玛皮肤',
  enter: '进入第四章',

  /** 开局一句提示：暗派 / 奶家军各一句 */
  tagline: { good: '以奶味净化雷霆之力！', dark: '还好我是正太' },

  /** 章节引导：按你在哪边显示不同的页 */
  intro: {
    good: [
      { title: '终极决斗', text: '西格玛的决斗！\n你是奶家军，要向暗西格玛奶蛙发射解毒针，用奶味净化雷霆之力。' },
      {
        title: '瞄准肚脐',
        text: `对面肚脐上有一个黄色虚线框。点屏幕上的位置发射解毒针，针飞过去要一点时间，\n对面会扭腰躲开——要预判它扭到哪！${C.duration} 秒、${C.needles} 根针，射中肚脐 ${C.hitsToWin} 次就赢。`,
      },
    ],
    dark: [
      { title: '终极决斗', text: '西格玛的决斗……还好我是正太。\n你是阴暗西格玛，奶家军会向你发射解毒针，瞄准的是你的肚脐！' },
      {
        title: '扭腰躲针',
        text: `拖动下面的滑杆左右扭腰（电脑上也可以按 ← →），躲开飞来的解毒针。\n撑过 ${C.duration} 秒，或者让对方 ${C.needles} 根针用完时被射中不到 ${C.hitsToWin} 次，你就赢。`,
      },
    ],
    /** 串子：在暗派继续串，这一页只有串子看得到 */
    mole: { title: '继续串', text: '你是串子。这一次，也要让奶家军赢……\n别躲得太明显哦。' },
    start: '开始决斗',
  },

  hud: {
    timeLeft: (s: number) => `剩余 ${Math.ceil(s)} 秒`,
    needles: (n: number) => `解毒针 ${n}/${C.needles}`,
    hits: (n: number) => `射中肚脐 ${n}/${C.hitsToWin}`,
    you: (side: string) => `你：${side}`,
    tapToFire: '点屏幕发射解毒针，瞄准肚脐！',
    dragToTwist: '拖动滑杆扭腰躲针',
  },

  float: { hit: '命中肚脐！', miss: '躲开了', purified: '被奶味净化！' },

  result: {
    goodWin: '奶家军获胜！',
    darkWin: '暗派获胜！',
    youWin: '你赢了！',
    youLose: '你输了……',
    moleWin: '串子串成功了！',
    moleFail: '串子……躲得太好了',
    ending: '观看结局',
    retry: '重新决斗',
    menu: '返回菜单',
  },

  /** 开发时没有第三章存档：选一边测试 */
  devPick: { title: '（开发）选择第四章的身份', good: '奶家军', dark: '暗派', mole: '串子' },
} as const;
