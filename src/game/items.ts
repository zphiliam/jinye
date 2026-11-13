// 物品与配方数据
export type ItemKind = 'mat' | 'food' | 'tool' | 'weapon' | 'light' | 'armor' | 'head' | 'back' | 'heal' | 'place';
export type Slot = 'hand' | 'body' | 'head' | 'back';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  stack: number;
  slot?: Slot;
  dur?: number;            // 耐久（次数或秒）
  durTime?: boolean;       // 耐久按时间流逝
  dmg?: number;
  tool?: 'axe' | 'pick';
  light?: number;          // 光照半径
  armor?: number;          // 减伤比例
  food?: { hunger: number; health: number; sanity: number; cook?: string };
  fuel?: number;           // 作为燃料的秒数
  sanityAura?: number;     // 每秒理智
}

export const ITEMS: Record<string, ItemDef> = {
  grass: { id: 'grass', name: '干草', desc: '韧而易燃。编绳、引火都用得上。', kind: 'mat', stack: 40, fuel: 12 },
  twig: { id: 'twig', name: '树枝', desc: '细枝条，工具的骨架。', kind: 'mat', stack: 40, fuel: 10 },
  flint: { id: 'flint', name: '燧石', desc: '锋利的黑色石片。', kind: 'mat', stack: 40 },
  stone: { id: 'stone', name: '石块', desc: '沉甸甸的灰石。', kind: 'mat', stack: 40 },
  log: { id: 'log', name: '木头', desc: '耐烧的柴火，也是好木料。', kind: 'mat', stack: 20, fuel: 40 },
  rope: { id: 'rope', name: '草绳', desc: '用干草搓成的绳子。', kind: 'mat', stack: 20, fuel: 8 },
  reed: { id: 'reed', name: '芦苇', desc: '沼泽里的空心苇秆。', kind: 'mat', stack: 40, fuel: 8 },
  petals: { id: 'petals', name: '花瓣', desc: '夜铃花的花瓣，闻着让人安心。', kind: 'food', stack: 40, food: { hunger: 1, health: 1, sanity: 2 } },
  silk: { id: 'silk', name: '蛛丝', desc: '墨蛛吐出的冷丝，异常坚韧。', kind: 'mat', stack: 40 },
  gland: { id: 'gland', name: '墨腺', desc: '墨蛛体内的腺囊，能止血。', kind: 'mat', stack: 20 },
  berry: { id: 'berry', name: '赤莓', desc: '酸涩的野莓。生吃能垫肚子。', kind: 'food', stack: 40, food: { hunger: 9, health: 0, sanity: 0, cook: 'berry_cooked' } },
  berry_cooked: { id: 'berry_cooked', name: '烤赤莓', desc: '烤过后甜了许多。', kind: 'food', stack: 40, food: { hunger: 12, health: 1, sanity: 1 } },
  carrot: { id: 'carrot', name: '野萝卜', desc: '脆生生的根茎。', kind: 'food', stack: 40, food: { hunger: 12, health: 1, sanity: 0, cook: 'carrot_cooked' } },
  carrot_cooked: { id: 'carrot_cooked', name: '烤萝卜', desc: '焦香软糯，暖到心里。', kind: 'food', stack: 40, food: { hunger: 16, health: 3, sanity: 2 } },
  mushroom: { id: 'mushroom', name: '赤伞菇', desc: '生吃会闹肚子。', kind: 'food', stack: 40, food: { hunger: 6, health: -6, sanity: -2, cook: 'mushroom_cooked' } },
  mushroom_cooked: { id: 'mushroom_cooked', name: '炙伞菇', desc: '烤熟后有股奇妙的安神香气。', kind: 'food', stack: 40, food: { hunger: 5, health: 1, sanity: 10 } },
  meat: { id: 'meat', name: '蛛肉', desc: '腥冷的怪肉，生吃令人作呕。', kind: 'food', stack: 20, food: { hunger: 18, health: -4, sanity: -12, cook: 'meat_cooked' } },
  meat_cooked: { id: 'meat_cooked', name: '炙蛛肉', desc: '烤熟了，勉强能下咽。', kind: 'food', stack: 20, food: { hunger: 22, health: 2, sanity: -4 } },
  axe: { id: 'axe', name: '燧石斧', desc: '砍树用。', kind: 'tool', stack: 1, slot: 'hand', dur: 80, tool: 'axe', dmg: 14 },
  pickaxe: { id: 'pickaxe', name: '鹤嘴镐', desc: '凿开巨石。', kind: 'tool', stack: 1, slot: 'hand', dur: 40, tool: 'pick', dmg: 14 },
  torch: { id: 'torch', name: '火把', desc: '握在手里的一团光。会烧尽。', kind: 'light', stack: 1, slot: 'hand', dur: 100, durTime: true, light: 7.5, dmg: 10 },
  spear: { id: 'spear', name: '长矛', desc: '燧石矛头，可以保持距离。', kind: 'weapon', stack: 1, slot: 'hand', dur: 150, dmg: 26 },
  spear2: { id: 'spear2', name: '蛛牙长矛', desc: '缠了蛛丝的锋利长矛。', kind: 'weapon', stack: 1, slot: 'hand', dur: 200, dmg: 38 },
  lantern: { id: 'lantern', name: '提灯', desc: '蛛丝灯罩，光更稳、更久。', kind: 'light', stack: 1, slot: 'hand', dur: 420, durTime: true, light: 9, dmg: 8 },
  backpack: { id: 'backpack', name: '草编背囊', desc: '多出八格背包。', kind: 'back', stack: 1, slot: 'back' },
  armor_grass: { id: 'armor_grass', name: '蓑衣甲', desc: '吸收 50% 伤害。', kind: 'armor', stack: 1, slot: 'body', dur: 150, armor: 0.5 },
  armor_wood: { id: 'armor_wood', name: '木片甲', desc: '吸收 75% 伤害。', kind: 'armor', stack: 1, slot: 'body', dur: 300, armor: 0.75 },
  garland: { id: 'garland', name: '花冠', desc: '戴着它，心神缓缓安定。', kind: 'head', stack: 1, slot: 'head', dur: 360, durTime: true, sanityAura: 0.045 },
  salve: { id: 'salve', name: '止血膏', desc: '恢复 30 点生命。', kind: 'heal', stack: 20 },
  campfire: { id: 'campfire', name: '营火', desc: '', kind: 'place', stack: 1 },
  firepit: { id: 'firepit', name: '石砌火坑', desc: '', kind: 'place', stack: 1 },
  bench: { id: 'bench', name: '研机台', desc: '', kind: 'place', stack: 1 },
};

export type Tab = 'tools' | 'light' | 'survival' | 'fight' | 'build';
export const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'tools', name: '工具', icon: 'axe' },
  { id: 'light', name: '光与火', icon: 'torch' },
  { id: 'survival', name: '生存', icon: 'backpack' },
  { id: 'fight', name: '战斗', icon: 'spear' },
  { id: 'build', name: '营建', icon: 'bench' },
];

export interface Recipe {
  id: string;            // 产物
  count?: number;
  tab: Tab;
  cost: [string, number][];
  tier: 0 | 1;           // 1 = 需靠近研机台
  desc: string;
  place?: boolean;
}

export const RECIPES: Recipe[] = [
  { id: 'axe', tab: 'tools', tier: 0, cost: [['twig', 1], ['flint', 1]], desc: '砍伐树木，获得木头。' },
  { id: 'pickaxe', tab: 'tools', tier: 0, cost: [['twig', 2], ['flint', 2]], desc: '凿开燧岩，获得石块与燧石。' },
  { id: 'rope', tab: 'tools', tier: 0, cost: [['grass', 3]], desc: '许多配方的基础材料。' },
  { id: 'torch', tab: 'light', tier: 0, cost: [['grass', 2], ['twig', 2]], desc: '手持光源，约 100 秒。黑夜里的救命稻草。' },
  { id: 'campfire', tab: 'light', tier: 0, cost: [['grass', 3], ['log', 2]], desc: '安放一堆营火。可添柴，可烤食物。', place: true },
  { id: 'backpack', tab: 'survival', tier: 0, cost: [['grass', 4], ['twig', 4]], desc: '背在身后，多出 8 格。' },
  { id: 'spear', tab: 'fight', tier: 0, cost: [['twig', 2], ['rope', 1], ['flint', 1]], desc: '伤害 26。攻击距离更远。' },
  { id: 'bench', tab: 'build', tier: 0, cost: [['log', 4], ['stone', 4], ['twig', 2]], desc: '靠近它可研制更精良的器物。', place: true },
  { id: 'firepit', tab: 'light', tier: 1, cost: [['stone', 8], ['log', 2]], desc: '石砌的火坑，燃得更久、照得更远。', place: true },
  { id: 'lantern', tab: 'light', tier: 1, cost: [['silk', 2], ['reed', 3], ['rope', 1]], desc: '光照更广，可燃约 7 分钟。' },
  { id: 'garland', tab: 'survival', tier: 1, cost: [['petals', 8]], desc: '戴在头上，持续恢复理智。' },
  { id: 'salve', tab: 'survival', tier: 1, cost: [['gland', 1], ['petals', 2]], desc: '立刻恢复 30 点生命。' },
  { id: 'armor_grass', tab: 'fight', tier: 1, cost: [['grass', 10], ['rope', 2]], desc: '吸收一半伤害。' },
  { id: 'armor_wood', tab: 'fight', tier: 1, cost: [['log', 8], ['rope', 2]], desc: '吸收四分之三伤害。' },
  { id: 'spear2', tab: 'fight', tier: 1, cost: [['spear', 1], ['silk', 3], ['flint', 2]], desc: '伤害 38，更耐用。' },
];
