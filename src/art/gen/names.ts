/**
 * 已转为代码生成的资产名（按分组）。不引入任何生成器，主线程可零成本读取：
 * ?art=code 时 PNG 资源包据此跳过这些图片的下载与解码。
 * pack-adapter.generateAll 会核对它与注册表是否一致（不一致时控制台报警）。
 */
const RIG_SIDE = ['head', 'hat', 'torso', 'skirt', 'scarf', 'upperN', 'upperF', 'foreN', 'foreF', 'thighN', 'thighF', 'shinN', 'shinF'];
const RIG_FB = ['f_head', 'b_head', 'f_torso', 'b_torso', 'f_skirt', 'b_skirt', 'f_armL', 'f_armR', 'b_armL', 'b_armR', 'f_legL', 'f_legR', 'b_legL', 'b_legR', 'b_scarf'];
export const CODE_NAMES: Record<string, string[]> = {
  hero: [...RIG_SIDE, ...RIG_FB].map((n) => 'rig:' + n),
  pine: ['pine_old', 'pine_dense', 'pine_young', 'pine_windbent'].map((n) => 'sprite:' + n),
  campfire: ['campfire_base', 'campfire_base_front', 'campfire_burnt', 'firepit_base', 'firepit_base_front', 'firepit_burnt'].map((n) => 'sprite:' + n),
  props: ['birch_a', 'birch_fork', 'tree_dead', 'tree_swamp', 'stump_pine', 'stump_birch', 'berrybush', 'berrybush_picked', 'grass_tuft', 'grass_cut',
    'twig_bush', 'twig_cut', 'flower_red', 'flower_yellow', 'flower_blue', 'carrot_plant', 'reeds', 'reeds_cut', 'fern', 'mushrooms', 'tuft_a', 'tuft_b',
    'tuft_swamp', 'boulder_a', 'boulder_b', 'pebbles', 'stones_moss', 'flint_ground', 'bones', 'bench'].map((n) => 'sprite:' + n),
  icons: ['grass', 'twigs', 'flint', 'stone', 'log', 'rope', 'berries', 'berry_cooked', 'carrot', 'carrot_cooked', 'petals', 'silk', 'gland', 'meat',
    'meat_cooked', 'reed', 'mushroom', 'mushroom_cooked', 'axe', 'pickaxe', 'torch', 'spear', 'spear2', 'lantern', 'backpack', 'armor_grass', 'armor_wood',
    'garland', 'salve'].map((n) => 'sprite:icon_' + n),
  creatures: ['spider_den', 'spider', 'spider_walk', 'spider_rear', 'spider_lunge', 'spider_dead', 'crow_stand', 'crow_peck', 'crow_fly0', 'crow_fly1', 'shade'].map((n) => 'sprite:' + n),
};
/** ?art=code 默认替换的全部分组 */
export const DEFAULT_GROUPS = Object.keys(CODE_NAMES);
/** 资源包里对应的图片键（rig 部件为 rig_ 前缀） */
export function packImageNames(groups: string[]): Set<string> {
  const s = new Set<string>();
  for (const g of groups) for (const k of CODE_NAMES[g] ?? []) { const [kind, n] = k.split(':'); s.add(kind === 'rig' ? 'rig_' + n : n); }
  return s;
}
