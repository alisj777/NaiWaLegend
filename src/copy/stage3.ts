import { STAGE3 as C } from '../config/stage3';

/**
 * 第三章「分化」的全部文案。改字只改这里。
 * 带 (x) => ... 的是模板，${} 里是程序填进去的数字或名字，保留它们、只改周围的字即可。
 */
export const STAGE3_TEXT = {
  title: '第三章 · 分化',
  levelTag: 'Lv.3 分化期',

  roles: {
    frog: { name: '奶蛙', cls: '攻击', desc: `一只脚走路，一只脚踢人：${C.roles.frog.kick.range} 格内都踢得到，伤害 ${C.roles.frog.kick.damage}（暗派 ${C.roles.frog.kick.darkDamage}），把对方踢退 ${C.roles.frog.kick.push} 格` },
    chicken: { name: '奶鸡', cls: '奶', desc: '下蛋孵出奶仆，跟着奶蛙叫主人，给主人补血。暗派的奶鸡下的是炸弹蛋' },
    dog: { name: '奶狗', cls: '奶', desc: `拉奶屎、吃奶屎回血；${C.roles.dog.poopPerGold} 个奶屎换 1 个金币，谁捡到算谁的` },
    powder: { name: '奶粉', cls: '辅助', desc: `迷惑：贴身让身边的对方眩晕 ${C.roles.powder.stun.duration} 秒，不能动也不能放技能` },
    mouse: { name: '奶鼠', cls: '攻击', desc: '跑得快，能从墙下钻进庇护所，偷蛋、偷奶屎、偷金币，还能啃砖' },
  },

  teams: { good: '奶家队', dark: '暗派' },

  names: {
    player: '你',
    /** 暗派的电脑名字前面加这个，比如"暗·奶蛙" */
    darkPrefix: '暗·',
  },

  /** 技能键上的字（冷却中后面会带剩余秒数） */
  action: {
    frog: '踢',
    chicken: '下蛋',
    /** 暗派的奶鸡 */
    bomb: '下炸弹',
    dog: '拉屎',
    powder: '迷惑',
    mouse: '偷',
    gnawing: '啃砖中…',
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
        text: `天雷还在落，每 ${C.thunder.interval} 秒一波！奶家队的人被劈中 ${C.hitsToTurn} 次就会黑化，加入暗派；\n全队累计被劈 ${C.teamHitsToTurn} 次，你也会黑化。躲进闭合的庇护所就劈不到。\n奶屎没有阵营，谁捡到都能换金币。`,
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
    teamRow: (team: string, gold: number, up: number, all: number, poop: number) => `${team}　金币 ${gold}\n   站着 ${up}/${all} · 奶屎 ${poop}/${C.roles.dog.poopPerGold}`,
    me: (role: string, team: string) => `${team} · ${role}`,
    down: (sec: number) => `倒下中，${sec} 秒后复活`,
    hp: (n: number, max: number) => `血量 ${n}/${max}`,
    gold: (good: number, dark: number) => `金币 奶家队 ${good} : ${dark} 暗派`,
    hits: (n: number, team: number) => `天雷 你 ${n}/${C.hitsToTurn} · 全队 ${team}/${C.teamHitsToTurn}`,
    poop: (n: number) => `奶屎 ${n}/${C.roles.dog.poopPerGold}`,
    stunned: '眩晕中',
    thunderIn: (sec: number) => `天雷 ${sec} 秒后落下`,
    thunderNow: '天雷来了！',
  },

  toast: {
    start: '开打！按右下角的技能键使用技能',
    thunderComing: '天雷要来了！看清预警范围，快躲开',
    youThunder: (n: number) => `你被天雷劈中了！（${n}/${C.hitsToTurn}）`,
    inherited: (n: number) => `第二关救下的 ${n} 颗奶蛋跟来了，成了你们的奶仆`,
    cooling: '技能还在冷却',
    occupied: '这一格已经有东西了，换个地方',
    tooManyPoops: '场上的奶屎太多了，先捡一捡',
    noTarget: '附近没有敌人',
    nothingToSteal: '贴近敌人、敌人的奶仆才能偷，贴着对面的砖可以啃',
    noGold: '对面已经没有金币可偷了',
    laid: '下了一颗蛋，奶仆会跟着奶蛙叫主人',
    laidBomb: '炸弹蛋放好了，快跑开',
    stunned: (n: number) => `迷惑了 ${n} 个敌人！`,
    youStunned: '你被迷惑了，暂时不能动',
    stoleServant: (name: string) => `${name}偷走了一只奶仆！`,
    stoleGold: (name: string) => `${name}偷走了 1 个金币！`,
    servantInfected: '一只奶仆离主人太远被攻击，感染了！快躲开',
    goldFromPoop: (name: string) => `${name}凑齐奶屎，换到 1 个金币`,
    youDown: (sec: number) => `你倒下了，${sec} 秒后在自家复活`,
    down: (name: string) => `${name}倒下了`,
    youRespawn: '你复活了！',
    turned: (name: string) => `${name}被天雷劈中太多次，黑化了！`,
    youTurned: '你被天雷劈中太多次，黑化了……新的一轮开始，这次你在暗派',
    turnedTitle: '你黑化了',
    nextRound: '进入新一轮',
    /** 庇护所育儿：不写进引导页，玩到了才弹 */
    eggThirsty: '庇护所里的奶蛋想喝奶！需要一瓶奶才能长大',
    eggDrank: '奶蛋喝到奶了，开始长大',
    noMilk: '库存里没有奶瓶也没有奶茶了，奶蛋长不大……（第一关可以攒）',
    stored: '奶蛋放进庇护所了，在这里不会被攻击',
    tapServant: '点一下自己的奶仆，再点庇护所里的空格（绿框），就能把它放进去',
    gnawed: (name: string) => `${name}啃掉了一块砖！`,
    froglet: '奶蛋长成了小奶蛙！再喝一瓶奶就能长成奶蛙',
    grownFrog: '小奶蛙长成了奶蛙！主人倒下时，它会成为主人的替身',
    standIn: '替身奶蛙顶上了！主人原地复活',
  },

  /** 成就 */
  achievements: {
    /** share：转发时的标题（只有带卡牌的成就能转发） */
    sigma: { name: '成长为西格玛奶蛙', desc: '开局在奶家队，带领大家获胜', share: '' },
    selfTorment: { name: '自我折磨', desc: '身在暗派，暗派获胜', share: '' },
    superMole: { name: '超能串子', desc: '身在暗派，一下都没伤到奶家队，暗中帮奶家队获胜', share: '我在奶家村当上了超能串子！' },
    cantHold: { name: '无法绷住', desc: `一局里复活 ${C.achieve.cantHold} 次以上`, share: '我在奶家村彻底绷不住了！' },
    breaker: { name: '破绷者', desc: `一局里造成 ${C.achieve.breaker} 点以上伤害`, share: '我是奶家村的破绷者！' },
    // 第四章的成就（和第三章的放在一起，成就页统一列出）
    saveVillage: { name: '拯救奶家村', desc: '终极决斗中奶家军获胜', share: '我拯救了奶家村！' },
    goodTwist: { name: '很会扭啊', desc: '终极决斗中暗派获胜', share: '' },
    superMoleX3: { name: '超级串子', desc: '终极决斗里继续当串子，让奶家军获胜', share: '我是奶家村的超级串子，串子长了三倍！' },
    unlocked: '解锁成就',
    /** 超能串子就是隐藏彩蛋 */
    hiddenEgg: '恭喜你解锁隐藏彩蛋！',
    share: '转发卡牌',
    shareMole: '转发超能串子卡牌',
    shared: '已转发（网页版暂不支持，微信小游戏里可用）',
    close: '收下',
    closePage: '关闭',
    page: '成就',
    locked: '未解锁',
    got: '已解锁',
    tapToView: '点已解锁的成就可以查看',
  },

  result: {
    win: (team: string) => `${team}获胜！`,
    youWin: '你们赢了！',
    youLose: '你们输了……',
    wiped: (team: string) => `${team}全员倒下`,
    byGold: (good: number, dark: number) => `时间到，金币 奶家队 ${good} : ${dark} 暗派`,
    revived: (n: number) => `你一共复活了 ${n} 次`,
    damage: (n: number) => `成功造成了 ${n} 点伤害`,
    unlock: (name: string) => `解锁成就：${name}`,
    again: '再来一局',
    menu: '返回菜单',
  },
} as const;
