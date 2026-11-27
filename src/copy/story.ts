/**
 * 序章文案。改剧情只改这里：title 是标题，text 是逐字打出的正文（\n 换行）；
 * text 也可以写成数组，分成几段，点一下对话框换下一段。
 * 每页的插画在 src/scenes/StoryScene.ts 里按 id 对应，增删页面时告诉程序同步改插画。
 */
export const STORY = {
  skip: '跳过剧情',
  next: '继续',
  finish: '进入第一关',
  panels: [
    {
      id: 'village',
      title: '奶家村',
      text: '在遥远的奶家村，生活着幸福的奶家人，大笑是奶家村幸福的秘诀。',
    },
    {
      id: 'growth',
      title: '成长之路',
      text: '你就在这片土地上一天天长大：从一颗小奶蛋、小奶蛙，最后长成了奶蛙。\n小奶蛋们总爱围着你转，一口一个“劳大！”',
    },
    {
      id: 'split',
      title: '分化',
      text: '成年那天，大家各自分化：你成了奶蛙，朋友们分化成了奶鸡、奶狗、奶兔、奶鼠和奶粉。',
    },
    {
      id: 'doom',
      title: '末世',
      text: '然而，末世来临。在极寒气温中，奶家村陷入了漫长的寒冬。又有阴暗病毒伴随天雷来袭，很多族人感染了，奶家村失去了欢笑。',
    },
    {
      id: 'winter',
      title: '寒冬',
      text: '在一个冰冷的冬日，你不幸也感染了，在冷风中你闭上了眼睛……',
    },
    {
      id: 'rebirth',
      title: '重生',
      // 写成数组：一段放不下时分成几段，点一下对话框换下一段。第 2 段开始时系统飘进来
      text: [
        '一睁眼，你重生了。\n你又变回了一颗刚出生的奶蛋——时间回到了末世降临的前一夜。',
        '你的眼前出现了一个系统，系统告诉你：\n完成拯救奶家村，恢复奶家村众宾欢也的场景，系统奖励奶运之子大礼包：获得1亿奖金！',
        '这一次，你决定拯救奶家村，得到奶运！',
      ],
    },
  ],
  /** 插画里出现的文字 */
  art: {
    familyPhoto: '奶蛙家族全家福',
    laugh: '呱哈哈哈～',
    boss: '老大！',
    friends: ['奶鸡', '奶狗', '奶兔', '奶鼠', '奶粉'],
    rebirthNight: '天雷降临前一夜',
  },
} as const;

/**
 * 第二章开头的剧情（第一关过关后播放），播完进入第二关「天雷已废废」。
 * 写法和序章一样：title 标题，text 正文（可以写成数组分段）。
 */
export const STORY_CH2 = {
  finish: '进入第二关',
  panels: [
    {
      id: 'ch2_school',
      title: '奶家学院',
      text: '阴暗天雷来了！\n这一世，天雷来得比上一世更早……',
    },
    {
      id: 'ch2_strike',
      title: '天雷降临',
      text: '天雷劈中了村民，奶鸡和小奶蛙一个个被感染，\n身上慢慢泛起暗紫色……',
    },
    {
      id: 'ch2_madness',
      title: '阴暗病毒',
      text: '感染阴暗病毒的村民变得郁郁寡欢，或者非常暴躁，\n有的甚至产生幻觉，开始攻击同类。',
    },
    {
      id: 'ch2_think',
      title: '苟住',
      text: '但此时你的力量太小。\n先苟住，躲开天雷，然后想办法……',
    },
  ],
} as const;

/** 第四章结局：奶家军赢 */
export const STORY_END_GOOD = {
  finish: '返回菜单',
  panels: [
    { id: 'end_reward', title: '系统', text: '拯救奶家村！\n系统奖励到账！' },
    { id: 'end_celebrate', title: '拯救奶家村', text: '奶家村恢复了往日的风光，众宾欢也。' },
    { id: 'end_eyes', title: '……', text: '但是在欢笑声中，\n你总感觉有一双眼睛，在暗处盯着你……' },
  ],
} as const;

/** 第四章结局：暗派赢 */
export const STORY_END_DARK = {
  finish: '返回菜单',
  panels: [
    { id: 'end_occupied', title: '奶家村沦陷', text: '整个村子被占领了……' },
    { id: 'end_jiejie', title: '很会扭啊', text: '众宾桀桀桀——' },
  ],
} as const;

export type StoryPanelId =
  | (typeof STORY.panels)[number]['id']
  | (typeof STORY_CH2.panels)[number]['id']
  | (typeof STORY_END_GOOD.panels)[number]['id']
  | (typeof STORY_END_DARK.panels)[number]['id'];
