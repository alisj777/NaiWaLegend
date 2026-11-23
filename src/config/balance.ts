/**
 * 数值配置：所有平衡参数集中在这里，调平衡只改这个文件。
 * 标注【补充】的是设计文档里没写、实现时必须补上的值。
 */
export const BALANCE = {
  hero: {
    startHp: 30,
    maxHp: 30,
    maxLevel: 5,
    levelInterval: 90, // 光奶蛋每 90 秒一级（文档原值 20，放慢节奏）
    midHpMin: 10, // 血量 10 到 20 时成长 0.8 倍
    midHpMax: 20,
    midHpSpeed: 0.8,
    comebackHp: 10, // 血量低于 10 触发绝地反弹，直接升一级
    comebackCooldown: 60, // 绝地反弹冷却（文档原值 20）
    darkSpeed: 2, // 暗奶蛋、暗奶蛙
    deepDarkSpeed: 4, // 暗中过暗奶蛙 = 普通暗奶蛙的 2 倍
    moveSpeed: 170, // 【补充】像素/秒
    attackInterval: 3.5, // 【补充】自动攻击间隔（秒）
    attackDamageByLevel: [1, 1, 1, 2, 2], // 【补充】Lv1~Lv5 每发伤害
    projectileSpeed: 360, // 【补充】
    activeChoiceLevel: 4, // 长到奶蛙（Lv4）后可以主动感染
  },
  thunder: {
    startAt: 20, // 文档原值 10
    interval: 8, // 文档原值 5
    warnTime: 1.3, // 【补充】落雷前的预警时间，给玩家躲闪
    aimedChance: 0.4, // 【补充】有一定概率落在光派角色附近，否则全场随机几乎劈不中
    radius: 75, // 【补充】
    poisonHero: 1,
    poisonFriend: 0.5,
    poisonEgg: 2,
    fallAt: 5,
  },
  economy: {
    startCoins: 2, // 【补充】
    startCards: 2, // 【补充】开局手牌
    maxHand: 6, // 【补充】
    eggsPerCoin: 3,
    cardPrice: 2,
    freeCardsPerLevel: 1, // 文档原值 3，放慢出卡
    teaPrice: 1,
    bottlePrice: 1,
    needlePrice: 2,
    infectPrice: 5,
  },
  chicken: { layInterval: 40 /* 文档原值 20 */ },
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
  ai: { thinkInterval: 1.5, playCardChance: 0.35 /* 【补充】 */ },
  /** 解锁等级：卡牌和商店道具要主角长到对应等级才能获得或使用 */
  unlock: {
    cards: { poop: 1, chicken: 1, dog: 2, mouse: 3, powder: 3 },
    shop: { bottle: 1, card: 1, sell: 1, chaos: 1, tea: 2, needle: 2, infect: 4 },
  },
} as const;
