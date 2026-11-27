import { STAGE3 as C } from '../config/stage3';

/**
 * 第三章「分化」的全部文案。改字只改这里。
 * 带 (x) => ... 的是模板，${} 里是程序填进去的数字或名字，保留它们、只改周围的字即可。
 */
export const STAGE3_TEXT = {
  title: '第三章 · 分化',
  levelTag: 'Lv.3 分化期',

  roles: {
    frog: { name: '奶蛙', cls: '攻击', desc: `一只脚走路，一只脚踢人：伤害 ${C.roles.frog.kick.damage}，把对方踢退 ${C.roles.frog.kick.push} 格` },
    chicken: { name: '奶鸡', cls: '奶', desc: '下蛋孵出奶仆，跟着奶蛙叫主人，给主人补血。暗派的奶鸡下的是炸弹蛋' },
    dog: { name: '奶狗', cls: '奶', desc: `拉奶屎、吃奶屎回血；${C.roles.dog.poopPerGold} 个奶屎换 1 个金币，谁捡到算谁的` },
    powder: { name: '奶粉', cls: '辅助', desc: `迷惑：让 ${C.roles.powder.stun.range} 格内的对方眩晕 ${C.roles.powder.stun.duration} 秒，不能动也不能放技能` },
    mouse: { name: '奶鼠', cls: '攻击', desc: '跑得快，能从墙下钻进庇护所，偷蛋、偷奶屎、偷金币，还能啃砖' },
  },

  teams: { good: '奶家队', dark: '暗派' },

  names: {
    player: '你',
    /** 暗派的电脑名字前面加这个，比如"暗·奶蛙" */
    darkPrefix: '暗·',
  },

  action: {
    kick: '踢',
    /** 其他角色的技能第 2 步才做 */
    soon: '技能',
  },

  /** 选角色 */
  pick: {
    title: '恭喜你，成长到了 Lv.3 分化期',
    sub: '可以选择随机角色，也可以自主选择',
    random: '随机',
    youAre: (team: string) => `你被分到了：${team}`,
    start: '开始',
  },

  /** 系统引导：分页讲解，最后一页点「开始」 */
  intro: {
    pages: [
      {
        title: '分化',
        text: `成年的你已经具备和阴暗战斗的能力！你和你的朋友组成了奶家队。\n奶家队 ${C.teams.good} 人，暗派 ${C.teams.dark} 人，两边都有攻击、奶和辅助。\n每队开局 ${C.startGold} 个金币，${C.duration / 60} 分钟结束时金币多的一方获胜。`,
      },
      {
        title: '天雷 · 黑化',
        icons: ['thunder'],
        text: `天雷还在落！奶家队的人被劈中 ${C.hitsToTurn} 次就会黑化，加入暗派。\n奶屎没有阵营，谁捡到都能换金币。`,
      },
      {
        title: '隐藏彩蛋',
        text: '这一章藏着一个隐藏彩蛋，等你自己发现……',
      },
    ],
  },

  hud: {
    board: '金币',
    timeLeft: (s: number) => `剩余 ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`,
    teamRow: (team: string, gold: number, up: number, all: number) => `${team}　金币 ${gold}\n   站着 ${up}/${all}`,
    me: (role: string, team: string) => `${team} · ${role}`,
    down: (sec: number) => `倒下中，${sec} 秒后复活`,
    hp: (n: number, max: number) => `血量 ${n}/${max}`,
    gold: (good: number, dark: number) => `金币 奶家队 ${good} : ${dark} 暗派`,
    hits: (n: number) => `天雷 ${n}/${C.hitsToTurn}`,
    poop: (n: number) => `奶屎 ${n}/${C.roles.dog.poopPerGold}`,
    stunned: '眩晕中',
  },

  toast: {
    skillSoon: '这个角色的技能还在路上，下一步开放',
    start: '开打！奶蛙贴近敌人按「踢」',
    youDown: (sec: number) => `你倒下了，${sec} 秒后在自家复活`,
    down: (name: string) => `${name}倒下了`,
    youRespawn: '你复活了！',
    turned: (name: string) => `${name}被天雷劈中太多次，黑化了！`,
    youTurned: '你被天雷劈中太多次，黑化了……新的一轮开始，这次你在暗派',
    /** 庇护所育儿：不写进引导页，玩到了才弹 */
    eggThirsty: '庇护所里的奶蛋想喝奶！需要一瓶奶才能长大',
    eggDrank: '奶蛋喝到奶了，开始长大',
    froglet: '奶蛋长成了小奶蛙！再喝一瓶奶就能长成奶蛙',
    grownFrog: '小奶蛙长成了奶蛙！主人倒下时，它会成为主人的替身',
    standIn: '替身奶蛙顶上了！主人原地复活',
  },

  /** 成就 */
  achievements: {
    sigma: { name: '成长为西格玛奶蛙', desc: '在奶家队带领大家获胜' },
    selfTorment: { name: '自我折磨', desc: '在暗派获胜' },
    superMole: { name: '超能串子', desc: '身在暗派，暗中帮奶家队获胜' },
    unlocked: '解锁成就',
    /** 超能串子就是隐藏彩蛋 */
    hiddenEgg: '恭喜你解锁隐藏彩蛋！',
    shareMole: '转发超能串子卡牌',
    shareTitle: '我在奶家村当上了超能串子！',
  },

  result: {
    win: (team: string) => `${team}获胜！`,
    youWin: '你们赢了！',
    youLose: '你们输了……',
    wiped: (team: string) => `${team}全员倒下`,
    byGold: (good: number, dark: number) => `时间到，金币 奶家队 ${good} : ${dark} 暗派`,
    again: '再来一局',
    menu: '返回菜单',
  },
} as const;
