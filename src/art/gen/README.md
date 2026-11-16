# 代码美术资产工厂（src/art/gen）

目标：最终所有美术在启动时由代码生成（纯 TS + Canvas 2D，无 PNG 入库；PNG 只作调试导出）。
分批推进。默认游戏仍用手绘 PNG；加 `?art=code` 才替换已转换的资产，未转换的继续用 PNG；
`?art=proc` 旧程序化素材保持不变。

**进度：108 / 113**（第 2 批）
- 行者：侧面 13 个 + 正/背面 15 个骨骼部件（28）
- 松树 4、火堆 / 火塘 6（含前排石头层）
- 场景道具 30：白桦 ×2、枯树、沼泽树、树桩 ×2、浆果丛 ×2、草 ×2、树苗 ×2、花 ×3、胡萝卜、芦苇 ×2、蕨、蘑菇、
  草丛 ×3、巨石 ×2、石子、苔石、燧石、骨头、研究台
- 物品图标 29（统一画风，40px 背包尺寸可读；斧 / 镐 / 火把 / 矛 / 提灯的握点与头部由图标生成器给出，行者手持工具直接用这些图标）
- 鸟兽 11：蛛巢、蜘蛛 ×5（待机 / 行走 / 立起 / 扑咬 / 死亡）、乌鸦 ×4、噬影
- 第 2 批同时重做：云片松（更多更小的云片、暖绿、露出红褐枝）、行者衣物磨损 + 草鞋、枯树 / 沼泽树扭曲树干 + 沼泽根团、草丛、燧石
- 尚未转换：行者整身姿势图 5（仅作骨骼缺失时的回退，正常游戏不显示）

## 结构

```
gen/
  noise.ts         种子随机数、值噪声、fbm
  brush.ts         笔形工具：平滑闭合 / 开放曲线、手抖轮廓 wobble、渐细笔触 taper、椭圆点列
  wash.ts          水墨晕染合成器（风格核心，见下）；canvas() 在页面用 <canvas>，在 Worker 用 OffscreenCanvas
  kit.ts           道具通用工具：stage / finish、石头、叶团、草叶、递归枝条
  registry.ts      注册表：register / generate / listDefs + cropAlpha
  names.ts         已转换资产的静态名单（主线程据此跳过 PNG 下载，不引入生成器）
  apply.ts         把生成结果写入 ArtPack（与 PNG 资源包同一数据结构）
  pack-adapter.ts  主线程同步生成（对照页 / 回退路径），并核对 names.ts 与注册表
  worker.ts        Worker：OffscreenCanvas 生成 + IndexedDB 缓存
  runtime.ts       游戏入口 loadCodeArt()：Worker 优先，失败回退主线程
  assets/
    pine.ts        松树：云片松（pad，枝梢成组小云片 + 密针纹 + 松果）与针叶塔（spire，毛刺轮廓）
    campfire.ts    火堆 / 火塘
    hero.ts        行者骨骼部件（毛边下摆、布褶、分缕围巾、帽影里的眼光）
    trees.ts       白桦、枯树、沼泽树（垂苔在水墨合成后再画）、树桩
    props.ts       灌木、草、花、芦苇、蕨、蘑菇、草丛、石头、燧石、骨头、研究台
    icons.ts       物品图标 29（材料 / 食物 / 工具 / 装备；工具附带 handle / head 握点）
    creatures.ts   蛛巢、蜘蛛、乌鸦、噬影（蛛网细丝、烟缕和眼光在合成后再画）
    index.ts       引入全部生成器（触发注册）
```

## 设计

- **一个资产 = 一个纯函数** `gen(seed) → { canvas, pivot, points?, meta? }`，按 `(kind, name)` 注册。
  `kind = 'sprite'`（name 与资源包图片名相同）或 `'rig'`（骨骼部件名，points 含 `joint` 等关节点）。
- **来源无关**：`applyItems(pack, items)` 把结果写进 `pack.sprites / images / rig.parts / fire`，
  之后 `buildAtlas`、`HeroRig`、火焰定位等代码完全照旧。枢轴 / 尺寸规格沿用 manifest 的 keys，
  所以摆放、碰撞、交互范围不受影响。
- **风格统一靠合成器**：生成器只画“剪影 + 2–3 阶平涂色块 + 少量墨线”，`wash()` 统一追加
  墨边晕开、湿边积色、背光体积压暗、迎光轮廓光、颜料浓淡、纸纹。`finish(..., post)` 可在合成后补画细丝（垂苔）。
- **确定性**：同一 seed 每次输出相同像素；换 seed 得到同一配置下的不同个体。

## 启动路径与缓存

```
main.ts (?art=code)
  ├─ names.ts → loadArtPack 跳过已转换资产的 PNG
  └─ runtime.loadCodeArt()
       └─ worker.ts
            ├─ IndexedDB 命中（键 = 生成器版本哈希 + 分组）→ PNG Blob → createImageBitmap → 主线程
            └─ 未命中 → OffscreenCanvas 现场生成 → ImageBitmap 先转交主线程
                         → 后台 convertToBlob(PNG，无损) 写入 IndexedDB（同时清掉旧版本）
```

- **版本哈希**：`vite.config.ts` 的 `codeart-hash` 插件对 `src/art/gen/**/*.ts` 做内容哈希，
  以虚拟模块 `virtual:codeart-hash` 提供；任何生成器改动都会让旧缓存失效（开发时热更新也会重算）。
- 回退：不支持 Worker / OffscreenCanvas，或 Worker 报错时，主线程同步生成（结果相同）。
- 调试参数：`?nocache=1` 跳过缓存（测冷启动）；`?cgworker=0` 强制主线程生成。
- 计时：`window.__boot`（自导航起的毫秒：pack / codeArt / atlas / game / firstFrame），
  `window.__codeArt = { ms, count, source: 'cache'|'worker'|'main', phases, hash }`，控制台同时打印。
  无头测量脚本：`/workspace/shot-tools/boot.mjs <url>`。

## 新增资产

1. 在 `assets/` 写 `genXxx(seed)`：`stage()` 作画 → `finish()`（wash + 裁边 + 枢轴）。
2. `register({ name, kind, group, seed, gen })`，在 `assets/index.ts` 引入，并把名字加进 `names.ts`。
3. 在 `codeart.html` 对照页加一栏，与手绘版并排检查。

## 调试

- `codeart.html`：手绘 vs 代码并排（`?only=tree|fire|hero|walk|parts|props|closeup`）。
