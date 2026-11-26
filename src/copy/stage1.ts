import { STAGE1 as C } from '../config/stage1';

/**
 * 第一关「狂风夜」的全部文案。改字只改这里。
 * 带 (name) => ... 的是模板，${} 里是程序填进去的名字或数字，保留它们、只改周围的字即可。
 */
export const STAGE1_TEXT = {
  title: '第一关 · 狂风夜',

  // ───────── 角色 ─────────
  playerName: '你',
  rivalNames: ['奶1蛋', '奶2蛋', '奶3蛋', '奶4蛋'],
  /** 闭合庇护所砖块上的字 */
  shelterName: (owner: string, isPlayer: boolean) => (isPlayer ? '你的庇护所' : `${owner}庇护所`),
  prisonerTag: '被囚禁',

  items: { brick: '砖块', shovel: '铁锹', empty: '空瓶', tea: '奶茶', milk: '奶瓶' },

  // ───────── 开场提示 ─────────
  intro: {
    headline: '你需要使用砖块建立庇护所，\n并且尽可能多地捡瓶子！',
    rules: [
      '· 走到物资旁按「举起」，走回庇护所再按一次放下。举着砖块按键，会把砖放在面前那一格',
      '· 用砖围成一圈就是闭合的庇护所：自己能穿墙进出，别人进不来。自己的砖随时可以举起来挪位置',
      '· 别人没闭合的砖可以直接捡走；闭合的庇护所要用铁锹挖开缺口才能进去抢瓶子',
      `· ${C.wind.firstAt} 秒后狂风来袭，会把人卷走；卷出场外，手上的物资就丢了。没闭合的庇护所也会被吹散`,
      `· 第 ${C.spring.firstAt} 秒起灵泉每 ${C.spring.interval} 秒出现一次，举着空瓶站到旁边就能装满奶茶或奶瓶`,
      `· ${C.duration / 60} 分钟后结算：庇护所里空瓶 ${C.score.emptyBottle} 分、满瓶 ${C.score.fullBottle} 分，最后 ${C.eliminate} 名淘汰`,
    ],
    start: '开始',
  },

  // ───────── 界面 ─────────
  hud: {
    timeLeft: (m: number, s: string) => `剩余 ${m}:${s}`,
    windNow: '狂风正在肆虐！',
    windIn: (sec: number) => `狂风 ${sec} 秒后来袭`,
    springNow: '灵泉开放中',
    springIn: (sec: number) => `灵泉 ${sec} 秒后出现`,
    board: '物资排名',
    boardRow: (rank: number, name: string, score: number) => `${rank}. ${name}  ${score} 分`,
    shelterClosed: '庇护所 ✓',
    shelterOpen: '庇护所 未闭合',
    imprisoned: '被囚禁中',
    holding: (item: string) => `举着${item}`,
    emptyHand: '空手',
    myStatus: '我的状态',
    myScore: (score: number) => `庇护所里 ${score} 分`,
    springLabel: (item: string, sec: number) => `灵泉·${item} ${sec}s`,
    keyboardHint: '键盘：方向键 / WASD 移动，空格 举起 / 放下',
  },

  /** 举起键上显示的字 */
  action: {
    flying: '飞走了…',
    pickUp: (item: string) => `举起${item}`,
    idle: '举起',
    takeBackBrick: '举起自己的砖',
    takeBrick: '捡走砖块',
    placeBrick: '放砖',
    dropBrick: '放下砖块',
    dig: '挖墙',
    dropShovel: '放下铁锹',
    drop: (item: string) => `放下${item}`,
  },

  // ───────── 场上提示 ─────────
  toast: {
    start: `物资已投放！快去捡砖块盖庇护所，${C.wind.firstAt} 秒后狂风就来了`,
    windComing: '狂风要来了！看清预警圈，躲进闭合的庇护所',
    springAppear: (item: string) => `灵泉出现了！举着空瓶去装满${item}`,
    refresh: '新一批物资刷新了',
    filled: (item: string) => `装满${item}！`,
    stole: (thief: string, victim: string, item: string) => `${thief}从${victim}的庇护所抢走了一个${item}！`,
    dug: (who: string, victim: string) => `${who}用铁锹挖开了${victim}的庇护所！`,
    blownOut: (who: string) => `${who}被狂风卷出了场外！`,
    blownOutLost: (who: string, item: string) => `${who}被狂风卷出场外，${item}丢了！`,
    blownAway: (who: string) => `${who}被狂风卷到了别处！`,
    needShovel: '这是闭合的庇护所，要用铁锹才能挖开',
    // 彩蛋：囚禁
    /** 你关住了别人（彩蛋触发） */
    imprisonedBy: (prisoner: string, captor: string) => `彩蛋！${captor}把${prisoner}关进了庇护所！没有铁锹就出不去了`,
    /** 电脑之间互相关住 */
    imprisonedOther: (prisoner: string, captor: string) => `${prisoner}被关在了${captor}的庇护所里`,
    youImprisoned: (captor: string) => `你被${captor}关起来了！找把铁锹才能挖出去`,
    released: (who: string) => `${who}重获自由！`,
  },

  // ───────── 结算 ─────────
  result: {
    pass: '晋级！',
    fail: '你被淘汰了',
    row: (rank: number, name: string, score: number, out: boolean) => `${rank}. ${name}　${score} 分　${out ? '淘汰' : '晋级'}`,
    carry: (tea: number, milk: number) => `带进下一关：奶茶 ×${tea}　奶瓶 ×${milk}`,
    next: '进入下一关',
    retry: '重新挑战',
    menu: '返回菜单',
  },
} as const;
