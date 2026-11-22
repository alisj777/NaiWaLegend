/**
 * 数值配置：所有平衡参数集中在这里，调平衡只改这个文件。
 * 标注【补充】的是设计文档里没写、实现时必须补上的值。
 */
export const BALANCE = {
  hero: {
    startHp: 30,
    maxHp: 30,
    maxLevel: 5,
    levelInterval: 20, // 光奶蛋每 20 秒一级
    midHpMin: 10, // 血量 10 到 20 时成长 0.8 倍
    midHpMax: 20,
    midHpSpeed: 0.8,
    comebackHp: 10, // 血量低于 10 触发绝地反弹，直接升一级
    comebackCooldown: 20, // 绝地反弹 20 秒内只触发一次
    darkSpeed: 2, // 暗奶蛋、暗奶蛙
    deepDarkSpeed: 4, // 暗中过暗奶蛙 = 普通暗奶蛙的 2 倍
    moveSpeed: 170, // 【补充】像素/秒
    attackInterval: 2, // 【补充】自动攻击间隔（秒）
    attackDamageByLevel: [1, 1, 2, 2, 3], // 【补充】Lv1~Lv5 每发伤害
    projectileSpeed: 360, // 【补充】
    activeChoiceLevel: 4, // 长到奶蛙（Lv4）后可以主动感染
  },
  thunder: {
    startAt: 10,
    interval: 5,
    warnTime: 0.9, // 【补充】落雷前的预警时间，给玩家躲闪
    radius: 75, // 【补充】
    poisonHero: 1,
    poisonFriend: 0.5,
    poisonEgg: 2,
    fallAt: 5,
  },
  economy: {
    startCoins: 2, // 【补充】
    startCards: 3, // 【补充】开局手牌
    maxHand: 8, // 【补充】
    eggsPerCoin: 3,
    cardPrice: 2,
    freeCardsPerLevel: 3,
    teaPrice: 1,
    bottlePrice: 1,
    needlePrice: 2,
    infectPrice: 5,
  },
  chicken: { layInterval: 20 },
  chaos: { eggsNeeded: 7, speed: 70 /* 【补充】 */ },
  poop: {
    mergeCount: 3,
    maxLevel: 3,
    eatHeal: 1,
    pickupRange: 70, // 【补充】
  },
  dog: { speed: 60 /* 【补充】 */, eatRange: 24 },
  debuff: { pollution: 3, dance: 3 },
  tea: {
    // 【补充】抽取权重
    outcomes: [
      { id: 'sugar3', label: '3 分糖', weight: 20, heal: 1 },
      { id: 'sugar5', label: '5 分糖', weight: 18, heal: 2 },
      { id: 'sugar7', label: '7 分糖', weight: 14, heal: 3 },
      { id: 'sugarFull', label: '满糖！', weight: 5, heal: 5 },
      { id: 'ice3', label: '3 分冰', weight: 20, freeze: 1 },
      { id: 'ice5', label: '5 分冰', weight: 15, freeze: 3 },
      { id: 'iceFull', label: '满冰！冰冰冰', weight: 8, poops: 3 },
    ],
  },
  bottle: { capacity: 5, healPerClick: 0.2 },
  needle: {
    speed: 420, // 【补充】
    deepDarkDose: 4,
    missesToInfect: 3,
  },
  friends: {
    hp: 10,
    lossPenalty: 3,
    protectReward: 3,
    sellPrice: 1,
  },
  duel: {
    hitsToWin: 2,
    arrowSpeed: 520, // 【补充】
    twistTime: 0.45, // 【补充】扭腰持续时间
    playerCooldown: 0.6, // 【补充】
    aiFireMin: 1.0, // 【补充】
    aiFireMax: 2.0,
    aiDodgeChance: 0.45, // 【补充】
  },
  ai: { thinkInterval: 0.8 /* 【补充】 */ },
} as const;
