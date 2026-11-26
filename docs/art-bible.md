# 奶蛙家族 · 美术设定

这份文档用来统一画风，并列出每张素材的尺寸和用途。提示词都是 Midjourney 用的英文模板，`[方括号]` 里的内容按需替换。

---

## 1. 原创性守则（最先看）

奶蛙必须参考**我给你的图片**

---

## 2. 画风定位

| 部分 | 风格 | 关键词 |
| --- | --- | --- |
| 角色 | 柔和 3D 软胶玩具质感，圆润、无尖角 | soft 3D vinyl toy, clay render, rounded, chubby, glossy, pastel |
| 背景 | 手绘绘本风，有前景、中景、远景的纵深 | storybook illustration, hand-painted, soft lighting, depth |
| 界面 | 深色半透明圆角面板，暖金色高光（代码里已实现） | — |

**视角**：
- **第一关**用**斜俯视（约 45°，3/4 top-down）**，从斜上方看下来。比正俯视好看，也能对齐网格。
- **剧情插画和菜单**用正常的平视或略仰视。

---

## 3. 调色板（与代码一致）

| 用途 | 颜色 | 代码位置 |
| --- | --- | --- |
| 光派主色 | `#6EA8FF` 浅蓝 | `src/skins/index.ts` → `colors.light` |
| 暗派主色 | `#FF9A3C` 橙 | `colors.dark` |
| 暗中过暗 | `#D9483B` 红 | `colors.deepDark` |
| 金色高光 / 标题 | `#FFF27A` | 界面通用 |
| 面板底色 | `#232A38` | 界面通用 |
| 砖块 | `#B5563A` / 闭合墙 `#8E3F2A` | `src/scenes/Stage1Scene.ts` |
| 奶茶 / 奶瓶 | `#C68B59` / `#FDFCF5` | 同上 |
| 草地 | `#5E7F4A` | 同上 |

角色身上可以用光派、暗派的颜色做**发光或描边点缀**，主体颜色保持奶油色系。光派和暗派是同一个角色换颜色，不要换造型。

---

## 4. 角色生成流程（从你的奶蛙参考图开始）

**第 0 步：把奶蛙图当作「角色参考图」附上。** 参考图的作用是让生成的角色和它长得一样。

不同版本附参考图的方式不一样：

| 版本 | 怎么附参考图 |
| --- | --- |
| V6 | 在提示词末尾加 `--cref 图片链接 --cw 强度` |
| V7 | 在提示词末尾加 `--oref 图片链接 --ow 强度`（Omni Reference） |
| **V8.x（你用的 8.2）** | `--cref` 和 `--oref` 都不再适用，改用新的 **Edit 模型**，最多可以附 4 张参考图。在网页版把奶蛙图拖进提示词输入框，选择用作参考或编辑；具体按钮名称以你界面上显示的为准 |

所以**下面的提示词都只写画面描述，不带参考参数**：复制提示词，再按上表用你那个版本的方式附上奶蛙图。每段提示词下面标了**参考强度**：
- **高**：要和参考图几乎一样，比如三视图、表情集。
- **中**：保留脸和配色，比如进化形态、剧情插画。
- **低**：只保留风格，比如四方向奶蛋。

V8 里怎么调参考强度、`--sref`（风格参考）和 `--tile`（无缝贴图）还能不能用，我没能从官方文档核实，**请以你界面上的选项为准**。如果某个参数报错，删掉它就行，提示词本身照样能用。

### 4.1 三视图（最重要，后面所有素材都以它为准）

```
character turnaround sheet of a cute chubby milk frog, front view, side view, back view, three-quarter view, full body, same character, consistent proportions, soft 3D vinyl toy render, cream and mint green colors, big round eyes on top of head, visible belly button, plain white background, evenly spaced, no text --ar 16:9 --no dinosaur, dragon, yellow
```

参考强度：**高**。从结果里挑一张最满意的，**以后都用这张当新的参考图**。

### 4.2 表情集

```
expression sheet of the same milk frog, 6 expressions: happy laughing, angry, scared, crying, smug with sunglasses, sleeping, head and shoulders, soft 3D vinyl toy render, plain white background, grid layout, no text --ar 3:2
```

参考强度：**高**。用在剧情对话头像、升级和被囚禁这类表情反馈上。

### 4.3 进化线（5 个形态，按顺序各生成一次）

| 等级 | 名字 | 提示词主体 |
| --- | --- | --- |
| Lv1 | 奶蛋 | `a round milk-white egg with tiny frog eyes peeking out, small crack on top` |
| Lv2 | 奶蝌蚪 | `a cute milk tadpole with a round head and short tail, same face as the frog` |
| Lv3 | 小奶蛙 | `a small baby milk frog, short legs, tadpole tail almost gone` |
| Lv4 | 奶蛙 | 就是参考图本身 |
| Lv5 | 西格玛奶蛙 | `the milk frog wearing black sunglasses, confident pose, slight golden glow` |

通用后缀：

```
..., full body, soft 3D vinyl toy render, cream and mint colors, plain white background, centered, no text --ar 1:1
```

参考强度：Lv4、Lv5 用**中**；Lv1～Lv3 和参考图差别较大，用**低**，让 AI 只保留脸部特征。

暗派版本：在提示词里加 `dark orange glow, slightly mischievous eyes`。造型不变，只改光效和眼神。

### 4.4 第一关：斜俯视的四方向奶蛋

第一关里 5 个奶蛋外观相同，只靠头上名字区分，所以只需要**一套**：

```
game sprite of a cute milk egg character with tiny frog eyes, 3/4 top-down view, facing [down / up / left / right], walking pose, soft 3D vinyl toy render, plain white background, centered, no shadow, no text --ar 1:1
```

参考强度：**低**（奶蛋和奶蛙差别大，只保留眼睛和配色）。四个方向各生成一张。想要走路动画的话，每个方向再生成 2 张不同的迈步姿势。

---

## 5. 素材清单

**尺寸规则**：
- 下表是**交付尺寸**，已经是游戏里显示尺寸的 2 倍，这样在高清手机屏上不会糊。
- 角色和道具要**透明背景的 PNG**。背景图可以用 JPG。
- Midjourney 生成后，按第 6 节处理，再按「文件名」放进 `public/assets/` 对应的文件夹。

### 5.1 序章（`public/story/`）

| 文件名 | 尺寸 | 内容 |
| --- | --- | --- |
| `family.jpg` | 2560×1000 | 奶蛙家族全家福 |
| `rebirth.jpg` | 2560×1000 | 重生画面 |

```
warm family portrait of cute pastel farm characters in a cozy village: a milk frog in the center, a chicken, a puppy, a bunny, a little mouse, a cute milk powder can mascot, several small milk eggs in front, everyone laughing, golden hour light, storybook illustration, soft 3D characters --ar 5:2
```

```
a tiny glowing milk egg in darkness, soft golden light bursting from it, snowy night village silhouette in the background, hopeful mood, rebirth, storybook illustration --ar 5:2
```

### 5.2 第一关 · 狂风夜（`public/assets/stage1/`）

| 文件名 | 尺寸 | 内容 |
| --- | --- | --- |
| `field.jpg` | 1728×896 | 整块场地背景（27×14 格），草地为主，**中间不要有物件**，否则会挡住网格玩法 |
| `egg_down/up/left/right.png` | 64×64 | 四方向奶蛋（见 4.4） |
| `brick.png` | 64×64 | 地上的单块砖（可捡的物资） |
| `wall_loose.png` | 64×64 | 没闭合的墙（松散砖块） |
| `wall_closed.png` | 64×64 | 闭合后的墙（实心砖墙，要能左右上下无缝拼接） |
| `bottle_empty.png` / `bottle_tea.png` / `bottle_milk.png` | 64×64 | 空瓶 / 奶茶 / 奶瓶 |
| `shovel.png` | 64×64 | 铁锹 |
| `spring.png` | 192×192 | 灵泉 |
| `wind.png` | 320×320 | 狂风漩涡（半透明白色） |

场地：

```
top-down 3/4 view of a grassy farm field at windy night, soft moonlight, hand-painted storybook style, uniform grass with subtle variation, small flowers only at the edges, wooden fence border, empty center, no characters, no text --ar 27:14
```

道具图标（替换 `[物品]`；想和角色风格统一，可以把三视图当风格参考附上）：

```
game item icon, [a red clay brick / an empty glass milk bottle / a glass bottle filled with milk tea / a glass baby bottle filled with milk / a small wooden shovel], 3/4 top-down view, soft 3D render, rounded shapes, plain white background, centered, no text --ar 1:1
```

墙块（`--tile` 用来生成可无缝拼接的贴图，V8 里能不能用请以界面为准；不能用的话，生成后在图片编辑软件里手动修接缝）：

```
seamless brick wall texture, top-down view, warm red clay bricks, soft 3D render, rounded edges --tile --ar 1:1
```

### 5.3 对战（`public/assets/battle/`）

| 文件名 | 尺寸 | 内容 |
| --- | --- | --- |
| `field.jpg` | 2480×840 | 对战场地，中间有一条淡淡的分界线 |
| `hero_light_1~5.png` | 160×160 | 光派 5 个形态（见 4.3） |
| `hero_dark_1~5.png` | 160×160 | 暗派 5 个形态 |
| `hero_deepdark.png` | 160×160 | 暗中过暗奶蛙 |
| `dog.png` `mouse.png` `powder.png` `chicken.png` | 96×96 | 卡牌单位 |
| `friend_cat.png` `friend_rabbit.png` `friend_fish.png` | 96×96 | 朋友 |
| `poop_1~3.png` | 64×64 | 三个等级的奶屎（越来越大、越来越闪） |
| `fortress.png` | 128×128 | 奶屎堡垒 |
| `chaos.png` | 128×128 | 混沌奶蛋（紫色，内部有光暗漩涡） |

### 5.4 界面（`public/assets/ui/`，可选）

摇杆、圆形按键和面板现在是代码画的，效果已经接近参考图，**可以最后再做**。要换的话：

| 文件名 | 尺寸 | 内容 |
| --- | --- | --- |
| `stick_base.png` / `stick_knob.png` | 296×296 / 124×124 | 摇杆底座 / 摇杆小球（半透明） |
| `btn_main.png` | 288×288 | 举起键 |
| `logo.png` | 1200×400 | 游戏标题字 |

---

## 6. 生成后的处理

1. **去背景**：Midjourney 生成的图没有透明背景，需要抠图。可以用 remove.bg、Canva 的去背景功能，或者 Photoshop。
2. **裁切对齐**：角色居中，四周留一点空白。同一组素材（比如四方向奶蛋）里角色大小要一致。
3. **缩放到交付尺寸**：按第 5 节的尺寸导出。
4. **压缩**：用 TinyPNG 或 Squoosh 压缩，每张小图控制在 50KB 以内，背景图控制在 300KB 以内。微信小游戏主包有大小限制。
5. **命名**：严格按清单里的文件名命名，放进对应的文件夹，然后告诉我，我来接进游戏。缺的素材会继续用代码画的占位，不影响运行。

---

## 7. 建议顺序

1. 三视图（4.1）：先定下角色，后面都以它为准
2. 序章两张图：你本来就在准备
3. 第一关素材：玩家最先看到的关卡
4. 进化线和对战素材
5. 界面素材（可选）
