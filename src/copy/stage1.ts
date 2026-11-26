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
  /**
   * 开场引导：分成几页，系统陪着讲解，最后一页点「开始」。
   * icons 是这一页要展示的物资图片（对应 src/assets.ts 里 STAGE1_IMAGES 的名字）；
   * diagram 是代码画的示意图：shelter = 没闭合 vs 闭合的对比，store = 瓶子放在闭合的庇护所里。
   */
  intro: {
    pages: [
      {
        title: '末世来临',
        text: `末世来临，狂风即将席卷奶家村！\n建立你的庇护所，并囤好物资。\n${C.duration / 60} 分钟后按庇护所里的物资排名，最后 ${C.eliminate} 名淘汰。`,
        icons: [] as string[],
        diagram: undefined as 'shelter' | 'store' | undefined,
      },
      {
        title: '砖块 · 盖庇护所',
        text: '按「举起」捡砖，轻推摇杆转身，砖会放在黄色虚线框里。\n砖块必须上下左右围住，闭合了才是庇护所（出现小屋图标）。',
        icons: [] as string[],
        diagram: 'shelter',
      },
      {
        title: '狂风',
        text: `第 ${C.wind.firstAt} 秒起狂风来袭，会卷走奶蛋，吹散没闭合的砖墙。\n被卷出场地的奶蛋无法返回，直接出局！\n看到白色预警圈快躲开，闭合的庇护所里最安全。`,
        icons: ['wind'],
        diagram: undefined,
      },
      {
        title: '空瓶 · 灵泉',
        text: `举着空瓶站到灵泉旁，会装满奶茶或奶瓶。\n瓶子要放进自己闭合的庇护所里才算你的：空瓶 ${C.score.emptyBottle} 分，满瓶 ${C.score.fullBottle} 分。\n装满的瓶子会累积到后面的关卡，越攒越多！`,
        icons: ['bottle_empty', 'spring', 'bottle_tea'],
        diagram: 'store',
      },
      {
        title: '铁锹',
        text: '拿着铁锹对着别人的墙按「举起」，挖开缺口进去抢瓶子。\n小心！你的庇护所也可能被别人挖开。',
        icons: ['shovel'],
        diagram: undefined,
      },
    ],
    next: '下一页',
    prev: '上一页',
    start: '开始',
    /** 预留：看广告直接跳过本关（网页测试版点了直接过关，微信版接入激励视频广告） */
    adSkip: '看广告跳过本关',
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
    gone: '已出局',
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
    /** 被卷出场外：无法返回，直接出局 */
    blownOut: (who: string) => `${who}被狂风卷出了场外，无法返回，出局了！`,
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
    /** 被狂风卷出场外时的结算标题 */
    blownAway: '你被狂风卷走了',
    row: (rank: number, name: string, score: number, out: boolean) => `${rank}. ${name}　${score} 分　${out ? '淘汰' : '晋级'}`,
    carry: (tea: number, milk: number) => `带进下一关：奶茶 ×${tea}　奶瓶 ×${milk}`,
    next: '进入下一关',
    /** 下一章还没做好时显示 */
    comingSoon: '下一章 敬请期待',
    retry: '重新挑战',
    menu: '返回菜单',
  },
} as const;
