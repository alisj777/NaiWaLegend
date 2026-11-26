/**
 * 第一关「狂风夜」的数值配置。调平衡只改这里。
 * 标注【补充】的是策划没规定、实现时先定的值，测试后再调。
 */
export const STAGE1 = {
  /** 一局时长（秒），暂定 2 分钟 */
  duration: 120,
  /** 结束时按分数排名，淘汰最后几名 */
  eliminate: 2,
  grid: { cols: 27, rows: 14, tile: 32 }, // 【补充】一格约等于一个奶蛋的身体
  /** 移动速度：每秒走几格 【补充】 */
  moveTilesPerSec: 6,
  actionCooldown: 0.25, // 【补充】
  score: { emptyBottle: 1, fullBottle: 3 },

  /** 物资：开局数量 / 每次刷新补充 / 场上上限 【补充】 */
  refreshInterval: 20,
  items: {
    brick: { initial: 30, perRefresh: 15, cap: 45 },
    bottle: { initial: 10, perRefresh: 6, cap: 14 },
    shovel: { initial: 2, perRefresh: 1, cap: 3 },
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
    /** 被卷起后扔出场外（物资丢失）的概率 【补充】 */
    outChance: 0.3,
    flyTime: 0.8,
    outRespawn: 1.5, // 【补充】扔出场外后多久回到场边
  },

  spring: {
    firstAt: 20,
    interval: 30, // 第 20、50、80、110 秒各出现一次
    duration: 10,
    /** 装出来是奶茶还是奶瓶，各一半 */
    teaChance: 0.5,
  },

  ai: {
    thinkInterval: 0.3, // 【补充】
    speedFactor: 0.8, // 【补充】AI 走得比玩家慢一点
    /** 庇护所建好后，有铁锹可拿时去抢劫的概率（每次决策） 【补充】 */
    raidChance: 0.25,
    raidMinScore: 3,
  },
} as const;
