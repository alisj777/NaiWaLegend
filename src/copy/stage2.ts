import { STAGE2 as C } from '../config/stage2';

/**
 * 第二关「天雷已废废」的全部文案。改字只改这里。
 * 带 (x) => ... 的是模板，${} 里是程序填进去的数字或名字，保留它们、只改周围的字即可。
 */
export const STAGE2_TEXT = {
  title: '第二关 · 天雷已废废',
  levelTag: 'Lv.2 小奶蛙',

  names: {
    player: '你',
    buddy: '小奶蛙',
    darkFrog: '阴暗小奶蛙',
    chicken: '阴暗奶鸡',
  },

  /** 开场：先把上一关的庇护所按闭合顺序一个个放好 */
  place: {
    hint: (k: number, n: number) => `放置你的庇护所（${k}/${n}）：走到想放的位置，按「放下」`,
    button: '放下庇护所',
    blocked: '这里放不下，换个空地方',
    done: '庇护所都放好了！',
  },

  /** 系统引导：分页讲解，最后一页点「开始」 */
  intro: {
    pages: [
      {
        title: '天雷已废废',
        text: `不幸的是，你所在区域的奶鸡全部感染了！\n你的任务：保护同伴，联合同伴击退阴暗化的奶鸡。\n坚持 ${C.duration / 60} 分钟，或者把所有阴暗奶鸡撞出场外，就能过关。`,
      },
      {
        title: '天雷',
        icons: ['thunder'],
        text: `每隔 ${C.thunder.interval} 秒落下一波天雷，一次 ${C.thunder.perWave} 道，比狂风密得多！\n躲进闭合的庇护所里才完全安全。\n被天雷累计劈中 ${C.thunder.hitsToDie} 次，小奶蛙就会夭折。`,
      },
      {
        title: '手拉手 · 奶三角',
        icons: ['frog_down', 'triangle'],
        text: '场上有没被感染的小奶蛙，走到它身边按「手拉手」。\n凑齐 2 只同伴，你们三个就组成奶三角，旋转着撞飞阴暗生物。\n阴暗小奶蛙会被撞得很远，奶鸡更重，只能撞飞一半距离。',
      },
      {
        title: '奶蛋 · 炸弹',
        icons: ['egg_down', 'egg_infected', 'egg_bomb'],
        text: `开场 ${C.chickens.layUntil} 秒内，奶鸡每 ${C.chickens.layEvery} 秒下一颗奶蛋，被攻击或被天雷劈中就会感染，${C.egg.bombAfter} 秒后爆炸！\n用抓手救蛋：点击 ${C.grab.range} 格内的奶蛋（黄色虚线框）把它抓回来，\n再点击自己庇护所里的空格（绿色虚线框）放进去。每颗蛋占一格。`,
      },
      {
        title: '阴暗攻击',
        icons: ['dark_chicken', 'dfrog_down'],
        text: `阴暗生物会攻击身边没被感染的同伴。\n被连续攻击 ${C.dark.frogDie} 秒，小奶蛙就会夭折；跑开或者被撞开就重新计时。\n炸弹会把人炸飞、炸毁庇护所，飞出场地就回不来了！`,
      },
    ],
  },

  hud: {
    hits: (n: number, max: number) => `天雷 ${n}/${max}`,
    attacked: (t: number) => `被攻击中 ${t.toFixed(1)}s`,
    buddies: (n: number) => `同伴 ${n}/2${n >= 2 ? ' · 奶三角' : ''}`,
    eggs: (n: number) => `救下奶蛋 ${n}`,
    chickens: (n: number) => `阴暗奶鸡 剩 ${n}`,
    bottles: (tea: number, milk: number, empty: number) => `库存：奶茶 ${tea} · 奶瓶 ${milk} · 空瓶 ${empty}`,
    thunderIn: (sec: number) => `天雷 ${sec} 秒后落下`,
    thunderNow: '天雷来了！快躲进庇护所',
  },

  action: {
    holdHands: '手拉手',
  },

  toast: {
    joined: '和一只小奶蛙手拉手了！再找一只就能组成奶三角',
    triangle: '奶三角组成了！靠近阴暗生物就能把它们撞飞',
    thunderComing: '天雷要来了！看清预警圈，躲进庇护所',
    youHit: (n: number, max: number) => `你被天雷劈中了！（${n}/${max}）`,
    buddyInfected: '一只同伴被天雷劈中，变成了阴暗小奶蛙！',
    buddyDied: '一只同伴被阴暗生物攻击，夭折了……',
    buddyArrived: '又有一只小奶蛙从场边跑来了！快去手拉手',
    tooFar: '太远了，抓手够不着，走近一点',
    infectedNoPut: '感染的蛋不能放进庇护所，会在里面爆炸！快扔远一点',
    laid: '下蛋了！',
    eggInfected: '奶蛋被感染了！',
    bomb: '奶蛋炸弹爆炸了！',
    chickenOut: (left: number) => (left > 0 ? `撞飞了一只阴暗奶鸡！还剩 ${left} 只` : '所有阴暗奶鸡都被撞出去了！'),
  },

  result: {
    win: '过关！',
    lose: '小奶蛙夭折了',
    survived: '你坚持到了最后！',
    cleared: '所有阴暗奶鸡都被撞出了场外！',
    thunder: '被天雷劈中太多次',
    attacked: '被阴暗生物攻击太久',
    blownAway: '被炸出了场外',
    eggs: (n: number) => `救下的奶蛋：${n} 颗`,
    retry: '重新挑战',
    menu: '返回菜单',
    comingSoon: '下一章 敬请期待',
  },
} as const;
