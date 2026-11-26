/**
 * 第一关「狂风夜」的数值配置。调平衡只改这里。
 * 标注【补充】的是策划没规定、实现时先定的值，测试后再调。
 */
export const STAGE1 = {
  /** 一局时长（秒），暂定 2 分钟 */
  duration: 120,
  /** 结束时按分数排名，淘汰最后几名。全场 3 个奶蛋（你 + 2 个对手），3 进 2 */
  eliminate: 1,
  grid: { cols: 27, rows: 14, tile: 32 }, // 【补充】一格约等于一个奶蛋的身体
  /** 移动速度：每秒走几格 【补充】 */
  moveTilesPerSec: 6,
  /**
   * 玩家站着不动时换方向：先只转身，推住超过这么多秒才开始走。
   * 所以短推一下摇杆 / 轻点一下方向键 = 原地转身，方便连续放砖 【补充】
   */
  turnHold: 0.15,
  actionCooldown: 0.25, // 【补充】
  score: { emptyBottle: 1, fullBottle: 3 },

  /** 物资：开局数量 / 每次刷新补充 / 场上上限 【补充】 */
  refreshInterval: 20,
  items: {
    // 3 个奶蛋，物资按人数相应减少
    brick: { initial: 20, perRefresh: 10, cap: 30 },
    bottle: { initial: 7, perRefresh: 4, cap: 10 },
    shovel: { initial: 1, perRefresh: 1, cap: 2 },
  },

  wind: {
    firstAt: 10,
    /** 之后每隔多少秒再来一波 【补充】（策划只写了第 10 秒那一波） */
    interval: 30,
    gustsPerWave: 3,
    duration: 3,
    warnTime: 1.5, // 【补充】落地前的预警，给玩家躲闪
    radius: 2.2, // 【补充】单位：格
    drift: 1.5, // 【补充】狂风移动速度（格/秒）
    /** 被卷起后扔出场外的概率。被卷出场外的奶蛋无法返回，直接出局 【补充】 */
    outChance: 0.12,
    flyTime: 0.8,
  },

  spring: {
    firstAt: 20,
    interval: 30, // 第 20、50、80、110 秒各出现一次
    duration: 10,
    /** 装出来是奶茶还是奶瓶，各一半 */
    teaChance: 0.5,
  },

  ai: {
    /** 多久想一次下一步做什么（秒）【补充】 */
    thinkInterval: 0.45,
    /** AI 移动速度是玩家的几倍 【补充】 */
    speedFactor: 0.6,
    /** 走到位后先停顿多久再捡 / 放 / 挖（秒），看起来不那么机械 【补充】 */
    actDelay: 0.4,
    /** 庇护所建好后，有铁锹可拿时去抢劫的概率（每次决策） 【补充】 */
    raidChance: 0.25,
    raidMinScore: 3,
  },
} as const;
