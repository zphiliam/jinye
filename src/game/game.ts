// 「烬野」主循环：世界、渲染、角色、生存数值、采集、制作、烹饪、战斗、昼夜与黑暗
import * as THREE from 'three';
import { Atlas, Frame } from '../art/atlas';
import { PlayerArt, PLAYER_PPU, Action, Facing } from '../art/player';
import { HeroArt } from '../art/hero';
import { World, Biome, HALF } from '../world/worldgen';
import { Terrain } from '../world/terrain';
import { U, MAX_LIGHTS } from '../render/shared';
import { SpriteBatch, makeSpriteMaterial, FLAG_EMISSIVE, FLAG_FLIP, FLAG_GHOST, SpriteInst } from '../render/sprites';
import { ShadowLayer } from '../render/shadows';
import { ParticleSystem, PT_GLOW, PT_SMOKE, PT_LEAF, PT_SPARK, PT_CHIP, PT_MOTE } from '../render/particles';
import { Post } from '../render/post';
import { DayCycle, Phase } from '../render/daycycle';
import { Audio } from '../audio/audio';
import { Input } from './input';
import { Inventory } from './inventory';
import { ITEMS, RECIPES, Recipe, Slot } from './items';
import { Grid, WObj, ObjKind, Spider, Drop, Crow } from './entities';
import { Hud, HudHost, helpHtml } from '../ui/hud';
import { parchment } from '../ui/svg';
import { mulberry32, RNG, clamp } from '../util/rng';

export const HP_MAX = 150, HUNGER_MAX = 150, SANITY_MAX = 200;
const SPEED = 5.2;

export type Target = { t: 'obj'; o: WObj } | { t: 'drop'; d: Drop } | { t: 'spider'; s: Spider } | { t: 'ground'; x: number; z: number };
type Verb = 'chop' | 'mine' | 'pick' | 'attack' | 'pickup' | 'fuel' | 'none' | 'walk';
interface ActInfo { verb: Verb; label: string; ok: boolean; reason?: string; range: number }
interface LightSrc { x: number; y: number; z: number; r: number; c: [number, number, number]; i: number; fire?: boolean }

const OBJ_NAMES: Record<string, string> = {
  pine: '墨松', birch: '骨桦', dead: '沼柳', sapling: '枝苗', grass: '蓑草', bush: '赤莓丛', flower: '夜铃花', carrot: '野萝卜',
  boulder: '燧岩', flint: '燧石', reeds: '芦苇', mushroom: '赤伞菇', den: '蛛巢', campfire: '营火', firepit: '石砌火坑', bench: '研机台',
};

export class Game implements HudHost {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  post: Post;
  atlas: Atlas;
  world!: World;
  terrain!: Terrain;
  statics!: SpriteBatch;
  dyn!: SpriteBatch;
  playerBatch!: SpriteBatch;
  shadowsStatic!: ShadowLayer;
  shadowsDyn!: ShadowLayer;
  fxAdd!: ParticleSystem;
  fxNorm!: ParticleSystem;
  spriteMat: THREE.ShaderMaterial;
  playerMat!: THREE.ShaderMaterial;
  playerTex!: THREE.CanvasTexture;
  playerArt: PlayerArt | HeroArt;
  day: DayCycle;
  audio = new Audio();
  input: Input;
  hud: Hud;
  inv = new Inventory();
  grid = new Grid();
  objs: WObj[] = [];
  spiders: Spider[] = [];
  drops: Drop[] = [];
  crows: Crow[] = [];
  easy: boolean;
  seed: number;
  mode: 'menu' | 'play' | 'dead' = 'menu';
  paused = false;
  overlay: HTMLElement | null = null;
  rng: RNG;
  nextId = 1;
  learned = new Set<string>();
  hints = new Set<string>();

  // 玩家
  px = 0; pz = 0; py = 0;
  pvx = 0; pvz = 0;
  facing: Facing = 'down'; flip = false;
  walkPhase = 0; moving = false;
  hp = HP_MAX; hunger = HUNGER_MAX; sanity = SANITY_MAX;
  rates = { hp: 0, hu: 0, sa: 0 };
  action: { a: Action; t: number; dur: number; at: number; done: boolean; target: Target | null; verb: Verb } | null = null;
  target: Target | null = null;
  attackCd = 0;
  invuln = 0;
  hurtT = 0;
  darkT = 0; darkHitT = 0;
  /** 噬影现身的方位（每次陷入黑暗重新选取） */
  shadeA = 0;
  shiver = 0;
  deadT = 0; deathCause = '';
  stepT = 0;
  eatAnim = 0;
  placing: { recipe: Recipe; ok: boolean; x: number; z: number } | null = null;
  hitStop = 0;
  // 摄像机
  camYaw = 0; camYawT = 0; camDist = 21; camDistT = 21;
  camX = 0; camZ = 0; camShake = 0;
  camOff = new THREE.Vector3();
  // 其他
  time = 0;
  hover: Target | null = null;
  eyes: { x: number; z: number; t: number }[] = [];
  lights: LightSrc[] = [];
  menuFire: WObj | null = null;
  fpsAcc = 0; fpsN = 0;
  lastPhase: Phase = 'day';
  flicker = 0;
  playerDrawT = 0;
  q: WObj[] = [];
  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  tmpV = new THREE.Vector3();
  stats = { chopped: 0, spiders: 0, crafted: 0 };
  groundPt: [number, number] = [0, 0];
  camUpBill = new THREE.Vector3(0, 1, 0);
  respawnQueue: { kind: string; x: number; z: number; t: number; frame: string }[] = [];

  constructor(canvas: HTMLCanvasElement, atlas: Atlas, opts: { seed: number; easy: boolean }) {
    this.atlas = atlas;
    this.playerArt = HeroArt.usable(atlas.pack) ? new HeroArt(atlas.pack) : new PlayerArt();
    this.easy = opts.easy;
    this.seed = opts.seed;
    this.rng = mulberry32(opts.seed ^ 0x5bd1e995);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 400);
    const pr = this.renderer.getPixelRatio();
    this.post = new Post(this.renderer, Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
    this.day = new DayCycle(this.easy);
    this.spriteMat = makeSpriteMaterial(atlas.texture);
    this.input = new Input(canvas);
    this.hud = new Hud(this);
    this.hud.rebuildClock(this.day.lens.day / this.day.total, this.day.lens.dusk / this.day.total);
    window.addEventListener('resize', () => this.resize());
    this.buildWorld(opts.seed);
  }

  /* ======================= 世界构建 ======================= */
  buildWorld(seed: number) {
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.seed = seed;
    this.rng = mulberry32(seed ^ 0x5bd1e995);
    this.objs = []; this.spiders = []; this.drops = []; this.crows = []; this.respawnQueue = []; this.grid = new Grid();
    this.world = new World(seed);
    this.terrain = new Terrain(this.world);
    this.scene.add(this.terrain.mesh);
    this.statics = new SpriteBatch(26000, this.spriteMat);
    this.dyn = new SpriteBatch(700, this.spriteMat);
    this.playerTex = new THREE.CanvasTexture(this.playerArt.canvas);
    this.playerTex.flipY = false; this.playerTex.colorSpace = THREE.NoColorSpace;
    this.playerTex.minFilter = THREE.LinearFilter; this.playerTex.generateMipmaps = false;
    this.playerMat = makeSpriteMaterial(this.playerTex);
    this.playerBatch = new SpriteBatch(1, this.playerMat);
    this.shadowsStatic = new ShadowLayer(9000, this.terrain.heightTex, 520);
    this.shadowsDyn = new ShadowLayer(200, this.terrain.heightTex, 520);
    this.fxAdd = new ParticleSystem(1800, true, false);
    this.fxNorm = new ParticleSystem(1800, false, true);
    this.scene.add(this.statics.mesh, this.dyn.mesh, this.playerBatch.mesh, this.shadowsStatic.mesh, this.shadowsDyn.mesh, this.fxAdd.points, this.fxNorm.points);
    for (const s of this.world.spawns) this.spawnFromGen(s.kind, s.x, s.z, s.v);
    this.statics.commit();
    this.shadowsStatic.commit();
    this.px = 0; this.pz = 0; this.py = this.world.height(0, 0);
    this.camX = 0; this.camZ = 0;
    this.hp = HP_MAX; this.hunger = HUNGER_MAX; this.sanity = SANITY_MAX;
    this.inv = new Inventory();
    this.inv.onChange = () => this.hud.renderInventory();
    this.learned.clear();
    this.action = null; this.target = null; this.placing = null;
    this.darkT = 0; this.deadT = 0; this.deathCause = ''; this.eyes = [];
    this.day = new DayCycle(this.easy);
    this.stats = { chopped: 0, spiders: 0, crafted: 0 };
    this.hud.renderInventory();
  }

  addObj(kind: ObjKind, sub: string, x: number, z: number, frame: string, o: Partial<WObj> = {}): WObj {
    const y = this.world.height(x, z);
    const f = this.atlas.get(frame);
    const obj: WObj = {
      id: this.nextId++, kind, sub, x, z, y, r: 0, frame, inst: -1, shadow: -1, shadowR: 0, shadowH: 0,
      hp: 1, maxHp: 1, picked: false, regrow: 0, removed: false, fuel: 0, maxFuel: 0, spiders: [], respawn: 0, maxSpiders: 0,
      flash: 0, shake: 0, sway: 0, phase: this.rng() * 6.28, h: f.h, name: OBJ_NAMES[sub] ?? OBJ_NAMES[kind] ?? '', ...o,
    };
    obj.inst = this.statics.push({ x, y, z, frame: f, sway: obj.sway, phase: obj.phase, flags: this.objFlip(obj) ? FLAG_FLIP : 0 });
    if (obj.shadowR > 0) obj.shadow = this.shadowsStatic.push(x, z, obj.shadowR, obj.shadowH, 1);
    this.objs.push(obj);
    this.grid.add(obj);
    return obj;
  }

  decor(frame: string, x: number, z: number, sway = 0, scale = 1) {
    const f = this.atlas.get(frame);
    this.statics.push({ x, y: this.world.height(x, z), z, frame: f, sway, phase: this.rng() * 6.28, flags: this.rng() < 0.5 ? FLAG_FLIP : 0, scale });
  }

  spawnFromGen(kind: string, x: number, z: number, v: number) {
    const r = this.rng;
    switch (kind) {
      case 'pine': this.addObj('tree', 'pine', x, z, `pine${v % 4}`, { r: 0.45, hp: 6, maxHp: 6, sway: 0.05, shadowR: 1.1, shadowH: 5.5 }); break;
      case 'birch': this.addObj('tree', 'birch', x, z, `birch${v % 3}`, { r: 0.4, hp: 5, maxHp: 5, sway: 0.07, shadowR: 1.0, shadowH: 4.6 }); break;
      case 'dead': this.addObj('tree', 'dead', x, z, `dead${v % 2}`, { r: 0.45, hp: 4, maxHp: 4, sway: 0.03, shadowR: 0.9, shadowH: 4.5 }); break;
      case 'sapling': this.addObj('sapling', 'sapling', x, z, 'sapling', { sway: 0.12, shadowR: 0.35, shadowH: 0.9 }); break;
      case 'grass': this.addObj('grass', 'grass', x, z, 'grass', { sway: 0.14, shadowR: 0.35, shadowH: 0.8 }); break;
      case 'bush': this.addObj('bush', 'bush', x, z, 'bush', { r: 0.35, sway: 0.03, shadowR: 0.7, shadowH: 1.2 }); break;
      case 'flower': this.addObj('flower', 'flower', x, z, `flower${v % 3}`, { sway: 0.1, shadowR: 0.2, shadowH: 0.5 }); break;
      case 'carrot': this.addObj('carrot', 'carrot', x, z, 'carrot', { sway: 0.05 }); break;
      case 'boulder': this.addObj('boulder', 'boulder', x, z, `boulder${v % 2}`, { r: 0.95, hp: 6, maxHp: 6, shadowR: 1.1, shadowH: 1.6 }); break;
      case 'flint': this.addObj('flint', 'flint', x, z, 'flint_ground', {}); break;
      case 'reeds': this.addObj('reeds', 'reeds', x, z, 'reeds', { sway: 0.12, shadowR: 0.3, shadowH: 1.4 }); break;
      case 'mushroom': this.addObj('mushroom', 'mushroom', x, z, 'mushroom', {}); break;
      case 'den': {
        const big = v === 1;
        const d = this.addObj('den', 'den', x, z, big ? 'den1' : 'den0', { r: big ? 1.3 : 1.1, hp: big ? 260 : 180, maxHp: big ? 260 : 180, shadowR: big ? 1.5 : 1.2, shadowH: 2, maxSpiders: big ? 4 : 3 });
        for (let i = 0; i < d.maxSpiders; i++) d.spiders.push(this.makeSpider(d));
        if (r() < 0.7) this.decor('bones', x + (r() - 0.5) * 5, z + 2 + r() * 2);
        break;
      }
      case 'fern': this.decor(`fern${v % 2}`, x, z, 0.08); break;
      case 'tuft': this.decor(`tuft${v % 2}`, x, z, 0.15); break;
      case 'tuft_swamp': this.decor('tuft_swamp', x, z, 0.12); break;
      case 'pebbles': this.decor(`pebbles${v % 2}`, x, z); break;
      case 'bones': this.decor('bones', x, z); break;
    }
  }

  makeSpider(den: WObj | null, x?: number, z?: number): Spider {
    return {
      id: this.nextId++, x: x ?? den!.x, z: z ?? den!.z, vx: 0, vz: 0, hp: 80, maxHp: 80, state: den && x === undefined ? 'home' : 'wander', t: 0,
      den, face: 1, tx: 0, tz: 0, flash: 0, walk: 0, lx: 0, lz: 0, hit: false, aggro: 0, dead: 0, alertShown: false,
    };
  }

  allSpiders(): Spider[] {
    const out = this.spiders.slice();
    for (const o of this.objs) if (o.kind === 'den' && !o.removed) out.push(...o.spiders);
    return out;
  }

  /* ======================= 流程 ======================= */
  enterMenu() {
    this.mode = 'menu';
    this.day.setPhaseTime('dusk', 0.45);
    this.menuFire = this.addObj('campfire', 'campfire', 2.2, 1.4, 'campfire', { r: 0.6, fuel: 9999, maxFuel: 120, shadowR: 0.8, shadowH: 0.6 });
    // 菜单场景：篝火周围一圈墨松
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.62 + (this.rng() - 0.5) * 0.3, d = 6.5 + this.rng() * 3.5;
      const x = 2.2 + Math.cos(a) * d, z = 1.4 - Math.abs(Math.sin(a)) * d * 0.9 - 1;
      if (this.grid.query(x, z, 1.5, this.q).length) continue;
      this.addObj('tree', 'pine', x, z, `pine${i % 4}`, { r: 0.45, hp: 6, maxHp: 6, sway: 0.05, shadowR: 1.1, shadowH: 5.5 });
    }
    this.statics.commit(); this.shadowsStatic.commit();
    this.px = 0.3; this.pz = 0.6; this.facing = 'side'; this.flip = false;
    this.hud.setVisible(false);
  }

  start() {
    if (navigator.userActivation?.isActive) this.audio.init();
    if (!this.audioHooked) {
      this.audioHooked = true;
      const wake = () => { this.audio.init(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
      window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
    }
    if (this.menuFire) { this.removeObj(this.menuFire); this.menuFire = null; this.statics.commit(); }
    this.mode = 'play';
    this.day = new DayCycle(this.easy);
    this.day.setPhaseTime('day', 0.04);
    this.lastPhase = 'day';
    this.px = 0; this.pz = 0;
    this.camDistT = 19;
    this.hud.setVisible(true);
    this.hud.rebuildClock(this.day.lens.day / this.day.total, this.day.lens.dusk / this.day.total);
    this.hud.renderInventory();
    this.hud.showBanner('第 一 天', '在烬野活下去', 4);
    setTimeout(() => this.hintOnce('start', '采集<b>蓑草</b>与<b>枝苗</b>，捡起地上的<b>燧石</b>。按 <span class="k">Tab</span> 打开制作，先做一把<b>燧石斧</b>。', 9), 2500);
  }

  audioHooked = false;
  restart() {
    this.closeOverlay();
    const seed = (Math.random() * 1e9) | 0;
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    url.searchParams.set('autostart', '1');
    history.replaceState(null, '', url.toString());
    this.hints.clear();
    this.buildWorld(seed);
    this.start();
  }

  resize() {
    const pr = this.renderer.getPixelRatio();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  }

  /* ======================= HudHost ======================= */
  activeSlot() { return -1; }
  sfxUi() { this.audio.ui(); }
  nearBench(): boolean { return this.grid.query(this.px, this.pz, 6, []).some((o) => o.kind === 'bench'); }
  nearFire(): WObj | null {
    let best: WObj | null = null, bd = 1e9;
    for (const o of this.grid.query(this.px, this.pz, 5, [])) {
      if ((o.kind === 'campfire' || o.kind === 'firepit') && o.fuel > 0) {
        const d = Math.hypot(o.x - this.px, o.z - this.pz);
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }
  nearFirePit(): WObj | null {
    let best: WObj | null = null, bd = 1e9;
    for (const o of this.grid.query(this.px, this.pz, 4, [])) {
      if (o.kind === 'campfire' || o.kind === 'firepit') { const d = Math.hypot(o.x - this.px, o.z - this.pz); if (d < bd) { bd = d; best = o; } }
    }
    return best;
  }
  recipeState(r: Recipe) {
    const learned = this.learned.has(r.id);
    const locked = r.tier === 1 && !learned && !this.nearBench();
    return { can: !locked && this.inv.canCraft(r), locked, learned };
  }
  slotHelp(i: number): string {
    const st = this.inv.slots[i]; if (!st) return '';
    const d = ITEMS[st.id];
    const fire = this.nearFire(), pit = this.nearFirePit();
    let left = '', right = '丢弃';
    if (d.kind === 'food') { left = '食用'; if (d.food?.cook && fire) right = '烤制'; }
    else if (d.slot) left = '装备';
    else if (d.kind === 'heal') left = '使用';
    if (d.fuel && pit && !(d.food?.cook && fire)) right = '添柴';
    const stat = d.food ? `<div class="stat">饱腹 ${fmt(d.food.hunger)} · 生命 ${fmt(d.food.health)} · 理智 ${fmt(d.food.sanity)}</div>` : '';
    const dur = d.dur && st.dur !== undefined ? `<div class="stat">耐久 ${Math.ceil(st.dur)}${d.durTime ? ' 秒' : ' 次'}</div>` : '';
    return `<b>${d.name}</b><div>${d.desc}</div>${stat}${dur}<div class="act">${left ? '左键：' + left + ' · ' : ''}右键：${right}</div>`;
  }

  useSlot(i: number) {
    if (this.mode !== 'play' || this.paused) return;
    const st = this.inv.slots[i]; if (!st) return;
    const d = ITEMS[st.id];
    if (d.kind === 'food') { this.eat(i); return; }
    if (d.kind === 'heal') {
      this.inv.takeOne(i);
      this.hp = Math.min(HP_MAX, this.hp + 30);
      this.floatAtPlayer('+30', 'gain');
      this.audio.eat();
      this.eatAnim = 0.7;
      return;
    }
    if (d.slot) {
      const slot = d.slot;
      const prev = this.inv.equip[slot];
      this.inv.slots[i] = prev;
      this.inv.equip[slot] = st;
      if (slot === 'back' && !this.inv.equip.back) this.dropOverflow();
      this.audio.equip();
      if (st.id === 'torch' || st.id === 'lantern') { this.audio.ignite(); this.hintOnce('torch', '火把会慢慢烧尽（看物品栏上的耐久条）。<b>入夜前</b>再点燃最划算。', 6); }
      this.inv.onChange();
    }
  }
  secondarySlot(i: number) {
    if (this.mode !== 'play' || this.paused) return;
    const st = this.inv.slots[i]; if (!st) return;
    const d = ITEMS[st.id];
    const fire = this.nearFire();
    if (d.food?.cook && fire) {
      this.inv.takeOne(i);
      const cooked = d.food.cook;
      this.startAnim('craft', 0.5);
      this.audio.ignite();
      for (let k = 0; k < 10; k++) this.fxAdd.emit({ x: fire.x + (Math.random() - 0.5) * 0.5, y: fire.y + 0.6, z: fire.z + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 0.8, size: 0.25, color: [1, 0.6, 0.2], type: PT_SPARK, grav: 2 });
      setTimeout(() => { this.give(cooked, 1); this.hud.toast(cooked, `烤好了：${ITEMS[cooked].name}`); this.audio.pop(); }, 450);
      this.hintOnce('cooked', '熟食回复更多，有的还能<b>安神</b>。', 6);
      return;
    }
    const pit = this.nearFirePit();
    if (d.fuel && pit) {
      this.inv.takeOne(i);
      this.addFuel(pit, d.fuel);
      return;
    }
    this.dropSlot(i);
  }
  dropSlot(i: number) {
    const st = this.inv.slots[i]; if (!st) return;
    this.inv.slots[i] = null;
    this.spawnDrop(st.id, st.n, this.px + (Math.random() - 0.5), this.pz + 0.8, st.dur, 0.5);
    this.inv.onChange();
  }
  swapSlots(a: number, b: number) {
    if (a === b) return;
    const cap = this.inv.capacity;
    if (a >= cap || b >= cap) return;
    const A = this.inv.slots[a], B = this.inv.slots[b];
    if (A && B && A.id === B.id && ITEMS[A.id].stack > 1) {
      const k = Math.min(ITEMS[A.id].stack - B.n, A.n);
      B.n += k; A.n -= k; if (A.n <= 0) this.inv.slots[a] = null;
    } else { this.inv.slots[a] = B; this.inv.slots[b] = A; }
    this.audio.ui();
    this.inv.onChange();
  }
  unequip(s: Slot) {
    const st = this.inv.equip[s]; if (!st) return;
    this.inv.equip[s] = null;
    if (s === 'back') this.dropOverflow();
    const left = this.inv.add(st.id, st.n, st.dur);
    if (left) this.spawnDrop(st.id, left, this.px, this.pz + 0.8, st.dur, 0.5);
    this.audio.equip();
    this.inv.onChange();
  }
  dropOverflow() {
    for (const s of this.inv.overflow()) this.spawnDrop(s.id, s.n, this.px + (Math.random() - 0.5) * 1.2, this.pz + 0.8, s.dur, 0.5);
  }

  craft(id: string) {
    if (this.mode !== 'play') return;
    const r = RECIPES.find((x) => x.id === id)!;
    if (!this.recipeState(r).can) return;
    if (r.place) {
      this.placing = { recipe: r, ok: false, x: this.px, z: this.pz };
      this.hud.placeTip.classList.remove('hidden');
      this.hud.placeTip.innerHTML = `左键安放「${ITEMS[r.id].name}」 · 右键 / Esc 取消`;
      this.audio.uiOpen();
      return;
    }
    this.inv.consume(r);
    if (r.tier === 1) this.learned.add(r.id);
    const left = this.inv.add(r.id, r.count ?? 1);
    if (left) this.spawnDrop(r.id, left, this.px, this.pz + 0.8, undefined, 0.5);
    this.afterCraft(r);
  }
  afterCraft(r: Recipe) {
    this.audio.craft();
    this.startAnim('craft', 0.55);
    this.hud.flashRecipe(r.id);
    this.hud.toast(r.id, `制成：${ITEMS[r.id].name}`);
    this.hud.renderInventory([r.id]);
    this.stats.crafted++;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      this.fxAdd.emit({ x: this.px, y: this.py + 1.0, z: this.pz, vx: Math.cos(a) * 2.2, vy: 1.5 + Math.random(), vz: Math.sin(a) * 2.2, life: 0.9, size: 0.22, color: [1, 0.75, 0.35], type: PT_GLOW, drag: 2.5, grav: 1 });
    }
    if (this.stats.crafted === 1) this.hintOnce('firstcraft', '做得好！点击物品栏里的器物，或按对应<b>数字键</b>即可装备。', 7);
    if (r.id === 'axe') setTimeout(() => this.hintOnce('axe', '装备斧头后点击<b>墨松</b>或<b>骨桦</b>砍伐，会自动连砍。', 7), 2500);
  }

  /* ======================= 物品与掉落 ======================= */
  give(id: string, n: number, dur?: number) {
    const left = this.inv.add(id, n, dur);
    if (left > 0) { this.spawnDrop(id, left, this.px, this.pz + 0.8, dur, 0.4); this.hud.toast(null, '背包满了'); }
    this.hud.renderInventory([id]);
  }
  spawnDrop(id: string, n: number, x: number, z: number, dur?: number, up = 1) {
    const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
    this.drops.push({ id, n, dur, x, z, y: this.world.height(x, z) + 0.8 * up, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * 0.7 + 0.6, vy: 3.5 * up + Math.random(), age: 0, bounce: 0 });
  }
  pickupDrop(d: Drop) {
    const i = this.drops.indexOf(d); if (i < 0) return;
    const left = this.inv.add(d.id, d.n, d.dur);
    if (left === d.n) { this.hud.toast(null, '背包满了'); return; }
    const got = d.n - left;
    if (left > 0) d.n = left; else this.drops.splice(i, 1);
    this.audio.pop();
    this.hud.toast(d.id, `+${got} ${ITEMS[d.id].name}`);
    this.hud.renderInventory([d.id]);
    this.popFx(d.x, d.y + 0.3, d.z, [1, 0.85, 0.5]);
  }
  popFx(x: number, y: number, z: number, c: [number, number, number]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.fxAdd.emit({ x, y, z, vx: Math.cos(a) * 1.6, vy: 1 + Math.random(), vz: Math.sin(a) * 1.6, life: 0.45, size: 0.18, color: c, type: PT_GLOW, drag: 4 });
    }
  }
  gain(id: string, n: number, x: number, z: number) {
    const left = this.inv.add(id, n);
    if (left) this.spawnDrop(id, left, x, z);
    this.hud.toast(id, `+${n} ${ITEMS[id].name}`);
    this.hud.renderInventory([id]);
    const s = this.toScreen(x, this.world.height(x, z) + 1.2, z);
    if (s) this.hud.float(s.x, s.y, `+${n}`, 'gain');
    this.audio.pop();
    this.popFx(x, this.world.height(x, z) + 0.6, z, [1, 0.85, 0.5]);
  }

  eat(i: number) {
    const st = this.inv.slots[i]; if (!st) return;
    const f = ITEMS[st.id].food!;
    this.inv.takeOne(i);
    this.hunger = Math.min(HUNGER_MAX, this.hunger + f.hunger);
    this.hp = Math.min(HP_MAX, this.hp + f.health);
    this.sanity = clamp(this.sanity + f.sanity, 0, SANITY_MAX);
    this.audio.eat();
    this.eatAnim = 0.7;
    if (f.health < 0) { this.floatAtPlayer(String(f.health), 'hurt'); this.hurtFx(0.3); if (this.hp <= 0) this.die(`吃了生的${ITEMS[st.id].name}`); }
    else if (f.hunger > 0) this.floatAtPlayer(`饱腹 +${f.hunger}`, 'gain');
    if (f.sanity < 0) this.floatAtPlayer(`理智 ${f.sanity}`, 'warn');
    if (f.sanity > 2) setTimeout(() => this.floatAtPlayer(`理智 +${f.sanity}`, 'gain'), 250);
  }

  floatAtPlayer(text: string, cls: string) {
    const s = this.toScreen(this.px, this.py + 2.4, this.pz);
    if (s) this.hud.float(s.x, s.y, text, cls);
  }

  objFlip(o: WObj) { return (o.id & 1) === 1 && o.kind !== 'bench' && o.kind !== 'den'; }

  removeObj(o: WObj) {
    if (o.removed) return;
    o.removed = true;
    this.statics.hide(o.inst);
    if (o.shadow >= 0) { this.shadowsStatic.set(o.shadow, o.x, o.z, 0, 0, 0); this.shadowsStatic.commit(); }
    this.grid.remove(o);
  }
  setObjFrame(o: WObj, frame: string) {
    o.frame = frame;
    const f = this.atlas.get(frame);
    o.h = f.h;
    this.statics.set(o.inst, { x: o.x, y: o.y, z: o.z, frame: f, sway: o.sway, phase: o.phase, flags: this.objFlip(o) ? FLAG_FLIP : 0 });
  }

  /* ======================= 拾取（像素级） ======================= */
  billAxes() {
    const R = new THREE.Vector3(U.uCamRight.value.x, 0, U.uCamRight.value.z).normalize();
    const Up = new THREE.Vector3(0, 1, 0).lerp(U.uCamUp.value, 0.55).normalize();
    return { R, Up };
  }
  /** 鼠标射线与竖立广告牌求交，返回 [t, fx, fy] */
  hitBillboard(ray: THREE.Ray, x: number, y: number, z: number, f: Frame, flip: boolean, R: THREE.Vector3, Up: THREE.Vector3, scale = 1): [number, number, number] | null {
    const n = this.tmpV.crossVectors(R, Up);
    const denom = ray.direction.dot(n);
    if (Math.abs(denom) < 1e-5) return null;
    const px = x - ray.origin.x, py = y - ray.origin.y, pz = z - ray.origin.z;
    const t = (px * n.x + py * n.y + pz * n.z) / denom;
    if (t <= 0) return null;
    const hx = ray.origin.x + ray.direction.x * t - x, hy = ray.origin.y + ray.direction.y * t - y, hz = ray.origin.z + ray.direction.z * t - z;
    const lx = hx * R.x + hy * R.y + hz * R.z;
    const ly = hx * Up.x + hy * Up.y + hz * Up.z;
    let fx = lx / (f.w * scale) + 0.5;
    if (flip) fx = 1 - fx;
    const fy = (ly + f.foot * scale) / (f.h * scale);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return [t, fx, fy];
  }
  pick(): Target | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((this.input.mouseX - rect.left) / rect.width) * 2 - 1, -((this.input.mouseY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;
    // 地面交点（步进）
    let gx = this.px, gz = this.pz;
    {
      let t = 0, prevAbove = true;
      for (let i = 0; i < 200; i++) {
        t += 0.5;
        const x = ray.origin.x + ray.direction.x * t, y = ray.origin.y + ray.direction.y * t, z = ray.origin.z + ray.direction.z * t;
        const h = this.world.height(x, z);
        if (y < h) {
          let a = t - 0.5, b = t;
          for (let k = 0; k < 8; k++) { const m = (a + b) / 2; const yy = ray.origin.y + ray.direction.y * m; const xx = ray.origin.x + ray.direction.x * m, zz = ray.origin.z + ray.direction.z * m; if (yy < this.world.height(xx, zz)) b = m; else a = m; }
          gx = ray.origin.x + ray.direction.x * b; gz = ray.origin.z + ray.direction.z * b; prevAbove = false;
          break;
        }
      }
      if (prevAbove) { gx = this.px; gz = this.pz; }
    }
    this.groundPt = [gx, gz];
    const { R, Up } = this.billAxes();
    let best: Target | null = null, bt = 1e9;
    for (const d of this.drops) {
      if (Math.hypot(d.x - gx, d.z - gz) > 3) continue;
      const f = this.atlas.get('item_' + d.id);
      const h = this.hitBillboard(ray, d.x, d.y, d.z, f, false, R, Up, 0.55);
      if (h && h[0] < bt) { bt = h[0] - 0.5; best = { t: 'drop', d }; }
    }
    for (const s of this.allSpiders()) {
      if (s.state === 'home' || s.state === 'dead') continue;
      if (Math.hypot(s.x - gx, s.z - gz) > 5) continue;
      const f = this.atlas.get('spider_walk0');
      const h = this.hitBillboard(ray, s.x, this.world.height(s.x, s.z), s.z, f, s.face < 0, R, Up);
      if (h && h[0] < bt + 0.3) { bt = h[0] - 0.3; best = { t: 'spider', s }; }
    }
    for (const o of this.grid.query(gx, gz, 9, this.q)) {
      const f = this.atlas.get(o.frame);
      const h = this.hitBillboard(ray, o.x, o.y, o.z, f, this.objFlip(o), R, Up);
      if (h && h[0] < bt && this.atlas.solidAt(o.frame, h[1], h[2])) { bt = h[0]; best = { t: 'obj', o }; }
    }
    if (!best) {
      // 宽松兜底：地面点附近的小物件
      let bd = 0.9;
      for (const d of this.drops) { const dd = Math.hypot(d.x - gx, d.z - gz); if (dd < bd) { bd = dd; best = { t: 'drop', d }; } }
      for (const o of this.grid.query(gx, gz, 1.1, this.q)) { const dd = Math.hypot(o.x - gx, o.z - gz); if (dd < bd) { bd = dd; best = { t: 'obj', o }; } }
    }
    return best;
  }

  hand() { return this.inv.equip.hand; }
  handDef() { const h = this.inv.equip.hand; return h ? ITEMS[h.id] : null; }

  actInfo(t: Target): ActInfo {
    const hd = this.handDef();
    const reach = hd && (hd.id === 'spear' || hd.id === 'spear2') ? 2.7 : 2.0;
    if (t.t === 'drop') return { verb: 'pickup', label: '拾起', ok: true, range: 1.1 };
    if (t.t === 'spider') return { verb: 'attack', label: '攻击', ok: true, range: reach };
    if (t.t === 'ground') return { verb: 'walk', label: '', ok: true, range: 0.2 };
    const o = t.o;
    switch (o.kind) {
      case 'tree':
        if (o.picked) return { verb: 'none', label: '树桩', ok: false, range: 0 };
        return hd?.tool === 'axe' ? { verb: 'chop', label: '砍伐', ok: true, range: 1.5 + o.r } : { verb: 'chop', label: '砍伐', ok: false, reason: '需要装备「燧石斧」', range: 0 };
      case 'boulder':
        return hd?.tool === 'pick' ? { verb: 'mine', label: '开凿', ok: true, range: 1.4 + o.r } : { verb: 'mine', label: '开凿', ok: false, reason: '需要装备「鹤嘴镐」', range: 0 };
      case 'grass': case 'sapling': case 'bush': case 'reeds':
        if (o.picked) return { verb: 'none', label: '正在重新生长…', ok: false, range: 0 };
        return { verb: 'pick', label: o.kind === 'bush' ? '采摘' : '采集', ok: true, range: 1.2 + o.r };
      case 'flower': case 'carrot': case 'mushroom': case 'flint':
        return { verb: 'pick', label: o.kind === 'carrot' ? '拔起' : '采集', ok: true, range: 1.2 };
      case 'den': return { verb: 'attack', label: '捣毁', ok: true, range: reach + o.r };
      case 'campfire': case 'firepit': {
        const has = this.bestFuel();
        return has ? { verb: 'fuel', label: `添柴（${ITEMS[has].name}）`, ok: true, range: 1.8 } : { verb: 'fuel', label: '添柴', ok: false, reason: o.fuel > 0 ? `火还能烧 ${Math.ceil(o.fuel)} 秒 · 没有燃料` : '火已熄灭 · 需要燃料', range: 0 };
      }
      case 'bench': return { verb: 'none', label: '靠近时可研制二阶配方', ok: false, range: 0 };
    }
    return { verb: 'none', label: '', ok: false, range: 0 };
  }
  bestFuel(): string | null {
    for (const id of ['log', 'twig', 'grass', 'reed', 'rope']) if (this.inv.count(id) > 0) return id;
    return null;
  }
  targetPos(t: Target): [number, number] {
    switch (t.t) {
      case 'obj': return [t.o.x, t.o.z];
      case 'drop': return [t.d.x, t.d.z];
      case 'spider': return [t.s.x, t.s.z];
      case 'ground': return [t.x, t.z];
    }
  }
  targetValid(t: Target): boolean {
    switch (t.t) {
      case 'obj': return !t.o.removed;
      case 'drop': return this.drops.includes(t.d);
      case 'spider': return t.s.state !== 'dead' && t.s.state !== 'home';
      case 'ground': return true;
    }
  }
  targetName(t: Target): string {
    switch (t.t) {
      case 'obj': return t.o.picked && t.o.kind === 'tree' ? '树桩' : t.o.name;
      case 'drop': return ITEMS[t.d.id].name + (t.d.n > 1 ? ` ×${t.d.n}` : '');
      case 'spider': return '墨蛛';
      case 'ground': return '';
    }
  }

  /** 发起交互：走过去然后执行 */
  interact(t: Target) {
    if (t.t !== 'ground') {
      const info = this.actInfo(t);
      if (!info.ok) {
        if (info.reason) { this.hud.toast(null, info.reason); this.audio.ui(); }
        return;
      }
    }
    this.target = t;
  }

  startAnim(a: Action, dur: number, at = 0.5, target: Target | null = null, verb: Verb = 'none') {
    this.action = { a, t: 0, dur, at, done: false, target, verb };
  }

  faceTo(x: number, z: number) {
    // 把世界方向换算到屏幕：右向量 / 前向量
    const dx = x - this.px, dz = z - this.pz;
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const sx = dx * rx + dz * rz;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const sy = dx * fx + dz * fz;
    if (Math.abs(sx) > Math.abs(sy) * 0.8) { this.facing = 'side'; this.flip = sx < 0; }
    else this.facing = sy > 0 ? 'up' : 'down';
  }

  updateTarget(dt: number) {
    const t = this.target;
    if (!t || this.action) return;
    if (!this.targetValid(t)) { this.target = null; return; }
    const [tx, tz] = this.targetPos(t);
    const info = this.actInfo(t);
    if (t.t !== 'ground' && !info.ok) { this.target = null; return; }
    const d = Math.hypot(tx - this.px, tz - this.pz);
    if (d > info.range) {
      this.moveToward(tx, tz, dt);
      if (t.t === 'ground' && d < 0.3) this.target = null;
      return;
    }
    if (t.t === 'ground') { this.target = null; return; }
    this.faceTo(tx, tz);
    switch (info.verb) {
      case 'chop': this.startAnim('chop', 0.52, 0.55, t, 'chop'); break;
      case 'mine': this.startAnim('mine', 0.6, 0.55, t, 'mine'); break;
      case 'attack':
        if (this.attackCd > 0) return;
        this.startAnim('attack', 0.42, 0.45, t, 'attack'); this.audio.swing(); this.attackCd = 0.5; break;
      case 'pick': this.startAnim('pickup', 0.38, 0.6, t, 'pick'); this.audio.pick(); break;
      case 'pickup': this.startAnim('pickup', 0.26, 0.5, t, 'pickup'); break;
      case 'fuel': this.startAnim('pickup', 0.32, 0.5, t, 'fuel'); break;
      default: this.target = null;
    }
  }

  moveToward(tx: number, tz: number, dt: number) {
    const dx = tx - this.px, dz = tz - this.pz, d = Math.hypot(dx, dz);
    if (d < 1e-3) return;
    const sp = SPEED * this.speedMul();
    this.pvx = (dx / d) * sp; this.pvz = (dz / d) * sp;
    this.moving = true;
  }
  speedMul() { return this.inv.equip.body?.id === 'armor_wood' ? 0.9 : 1; }

  /* ======================= 动作结算 ======================= */
  useDurability(n = 1) {
    const h = this.inv.equip.hand; if (!h || h.dur === undefined) return;
    h.dur -= n;
    if (h.dur <= 0) {
      this.inv.equip.hand = null;
      this.hud.toast(h.id, `${ITEMS[h.id].name} 坏掉了`);
      this.audio.rockBreak();
      // 自动换上同类
      for (let i = 0; i < this.inv.capacity; i++) { const s = this.inv.slots[i]; if (s && s.id === h.id) { this.useSlot(i); break; } }
      this.inv.onChange();
    } else this.hud.refreshDurability();
  }

  resolveAction() {
    const A = this.action!; const t = A.target; if (!t || !this.targetValid(t)) return;
    switch (A.verb) {
      case 'chop': if (t.t === 'obj') this.chop(t.o); break;
      case 'mine': if (t.t === 'obj') this.mine(t.o); break;
      case 'pick': if (t.t === 'obj') this.harvest(t.o); break;
      case 'pickup': if (t.t === 'drop') this.pickupDrop(t.d); this.target = null; break;
      case 'fuel': if (t.t === 'obj') { const id = this.bestFuel(); if (id) { this.inv.remove(id, 1); this.addFuel(t.o, ITEMS[id].fuel!); } } this.target = null; break;
      case 'attack':
        if (t.t === 'spider') this.hitSpider(t.s);
        else if (t.t === 'obj' && t.o.kind === 'den') this.hitDen(t.o);
        break;
    }
  }

  chop(o: WObj) {
    o.hp--; o.shake = 1; o.flash = 0.5;
    this.audio.chop();
    this.useDurability();
    const y = o.y + 1.2;
    for (let k = 0; k < 7; k++) this.fxNorm.emit({ x: o.x, y, z: o.z + 0.2, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.2) * 3, life: 0.8, size: 0.16, color: [0.75, 0.6, 0.42], type: PT_CHIP, grav: 9, rotV: 10 });
    const leaf: [number, number, number] = o.sub === 'birch' ? [0.72, 0.6, 0.3] : o.sub === 'dead' ? [0.35, 0.33, 0.25] : [0.2, 0.28, 0.2];
    for (let k = 0; k < 5; k++) this.fxNorm.emit({ x: o.x + (Math.random() - 0.5) * 2, y: o.y + 3 + Math.random() * 2, z: o.z, vx: (Math.random() - 0.5), vy: -0.5, vz: 0, life: 3, size: 0.28, color: leaf, type: PT_LEAF, grav: 0.4, flutter: 2.5, drag: 1 });
    this.camShake = Math.max(this.camShake, 0.08);
    if (o.hp > 0) return;
    // 倒下
    this.audio.treeFall();
    this.camShake = 0.35;
    this.hitStop = 0.05;
    this.stats.chopped++;
    o.picked = true; o.r = 0.3;
    this.setObjFrame(o, o.sub === 'birch' ? 'stump_birch' : o.sub === 'dead' ? 'stump_dead' : 'stump_pine');
    if (o.shadow >= 0) { this.shadowsStatic.set(o.shadow, o.x, o.z, 0.5, 0.5, 1); this.shadowsStatic.commit(); }
    const logs = o.sub === 'pine' ? 2 + (Math.random() < 0.5 ? 1 : 0) : o.sub === 'birch' ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < logs; i++) this.spawnDrop('log', 1, o.x + (Math.random() - 0.5), o.z + 0.4);
    if (o.sub === 'dead' && Math.random() < 0.6) this.spawnDrop('twig', 1, o.x, o.z + 0.4);
    for (let k = 0; k < 26; k++) this.fxNorm.emit({ x: o.x + (Math.random() - 0.5) * 3, y: o.y + 1.5 + Math.random() * 4, z: o.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 3.5, size: 0.3, color: leaf, type: PT_LEAF, grav: 0.6, flutter: 3, drag: 1 });
    for (let k = 0; k < 10; k++) this.fxNorm.emit({ x: o.x + (Math.random() - 0.5) * 2, y: o.y + 0.3, z: o.z, vx: (Math.random() - 0.5) * 2, vy: 0.6, vz: (Math.random() - 0.5) * 2, life: 1.6, size: 0.9, grow: 1, color: [0.55, 0.48, 0.4], a: 0.5, type: PT_SMOKE, drag: 2 });
    this.target = null;
    if (this.stats.chopped === 1) this.hintOnce('wood', '木头可以做<b>营火</b>的燃料。天黑前一定要在身边生一堆火。', 7);
  }

  mine(o: WObj) {
    o.hp--; o.shake = 1; o.flash = 0.6;
    this.audio.mine();
    this.useDurability();
    for (let k = 0; k < 10; k++) this.fxAdd.emit({ x: o.x, y: o.y + 0.8, z: o.z + 0.5, vx: (Math.random() - 0.5) * 6, vy: 1 + Math.random() * 4, vz: Math.random() * 3, life: 0.35, size: 0.12, color: [1, 0.75, 0.4], type: PT_SPARK, grav: 12 });
    for (let k = 0; k < 6; k++) this.fxNorm.emit({ x: o.x, y: o.y + 0.8, z: o.z + 0.5, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 2, vz: Math.random() * 2, life: 0.9, size: 0.17, color: [0.55, 0.53, 0.5], type: PT_CHIP, grav: 10, rotV: 8 });
    this.camShake = Math.max(this.camShake, 0.1);
    if (o.hp === 3) { this.spawnDrop('flint', 1, o.x, o.z + 0.6); }
    if (o.hp > 0) return;
    this.audio.rockBreak();
    this.camShake = 0.3;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) this.spawnDrop('stone', 1, o.x + (Math.random() - 0.5), o.z + 0.5);
    this.spawnDrop('flint', 1, o.x, o.z + 0.5);
    for (let k = 0; k < 14; k++) this.fxNorm.emit({ x: o.x + (Math.random() - 0.5) * 1.5, y: o.y + 0.4, z: o.z, vx: (Math.random() - 0.5) * 2, vy: 0.8, vz: (Math.random() - 0.5) * 2, life: 1.8, size: 1, grow: 1.2, color: [0.6, 0.57, 0.52], a: 0.5, type: PT_SMOKE, drag: 2 });
    this.decor('pebbles0', o.x, o.z); this.statics.commit();
    this.removeObj(o);
    this.target = null;
  }

  harvest(o: WObj) {
    const regrow = (frame: string, secs: number) => { o.picked = true; o.regrow = secs * (0.8 + Math.random() * 0.4); this.setObjFrame(o, frame); };
    switch (o.kind) {
      case 'grass': this.gain('grass', 1, o.x, o.z); regrow('grass_picked', 120); break;
      case 'sapling': this.gain('twig', 2, o.x, o.z); regrow('sapling_picked', 100); break;
      case 'bush': this.gain('berry', Math.random() < 0.4 ? 2 : 1, o.x, o.z); regrow('bush_empty', 150); break;
      case 'reeds': this.gain('reed', 1, o.x, o.z); regrow('reeds_picked', 160); break;
      case 'flower':
        this.gain('petals', 1, o.x, o.z); this.sanity = Math.min(SANITY_MAX, this.sanity + 5);
        this.respawnQueue.push({ kind: 'flower', x: o.x, z: o.z, t: 200, frame: o.frame }); this.removeObj(o); break;
      case 'carrot': this.gain('carrot', 1, o.x, o.z); this.removeObj(o); break;
      case 'mushroom': this.gain('mushroom', 1, o.x, o.z); this.respawnQueue.push({ kind: 'mushroom', x: o.x, z: o.z, t: 240, frame: 'mushroom' }); this.removeObj(o); break;
      case 'flint': this.gain('flint', 1, o.x, o.z); this.removeObj(o); break;
    }
    this.statics.commit();
    for (let k = 0; k < 6; k++) this.fxNorm.emit({ x: o.x, y: o.y + 0.4, z: o.z, vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 1.2, size: 0.18, color: o.kind === 'bush' ? [0.55, 0.12, 0.1] : [0.5, 0.48, 0.3], type: PT_LEAF, grav: 2, flutter: 1.5 });
    this.target = null;
    // 连采：自动找下一株同类
    if (this.input.down('Space')) return;
  }

  addFuel(o: WObj, secs: number) {
    const was = o.fuel;
    o.fuel = Math.min(o.maxFuel, o.fuel + secs);
    if (was <= 0) { this.setObjFrame(o, o.kind === 'firepit' ? 'firepit' : 'campfire'); this.statics.commit(); }
    this.audio.ignite();
    for (let k = 0; k < 24; k++) this.fxAdd.emit({ x: o.x + (Math.random() - 0.5) * 0.6, y: o.y + 0.4, z: o.z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 3, life: 1.0 + Math.random(), size: 0.18, color: [1, 0.6, 0.2], type: PT_SPARK, grav: 1.5, drag: 1 });
    o.flash = 0.6;
    this.hud.toast(null, `火焰旺了起来（可烧 ${Math.ceil(o.fuel)} 秒）`);
  }

  /* ======================= 战斗 ======================= */
  weaponDmg() { const d = this.handDef(); return d?.dmg ?? 8; }

  hitSpider(s: Spider) {
    const dmg = this.weaponDmg() * (0.9 + Math.random() * 0.2);
    s.hp -= dmg;
    s.flash = 1;
    s.aggro = 25;
    const dx = s.x - this.px, dz = s.z - this.pz, d = Math.hypot(dx, dz) || 1;
    s.vx = (dx / d) * 7; s.vz = (dz / d) * 7;
    this.audio.hit();
    this.hitStop = 0.06;
    this.camShake = Math.max(this.camShake, 0.18);
    this.useDurability();
    const sc = this.toScreen(s.x, this.world.height(s.x, s.z) + 1.2, s.z);
    if (sc) this.hud.float(sc.x, sc.y, String(Math.round(dmg)), dmg > 30 ? 'dmg big' : 'dmg');
    for (let k = 0; k < 12; k++) this.fxNorm.emit({ x: s.x, y: this.world.height(s.x, s.z) + 0.6, z: s.z, vx: (dx / d) * 3 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (dz / d) * 3 + (Math.random() - 0.5) * 3, life: 0.7, size: 0.15, color: [0.08, 0.06, 0.08], type: PT_CHIP, grav: 9 });
    for (let k = 0; k < 6; k++) this.fxAdd.emit({ x: s.x, y: this.world.height(s.x, s.z) + 0.6, z: s.z, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 5, life: 0.25, size: 0.25, color: [1, 0.85, 0.6], type: PT_GLOW, drag: 6 });
    if (s.hp <= 0) this.killSpider(s);
    else { s.state = 'hurt'; s.t = 0.28; this.audio.spiderHiss(); }
    // 同巢的伙伴被惊动
    if (s.den) for (const o of s.den.spiders) if (o !== s && o.state !== 'dead' && Math.hypot(o.x - s.x, o.z - s.z) < 14) { o.aggro = 20; if (o.state === 'home' || o.state === 'sleep') { this.emerge(o); } }
    this.hintOnce('fight', '墨蛛扑击前会<b>蜷身蓄力</b>（身体发红颤抖）——这时<b>后退</b>躲开，然后反击！', 8);
  }

  killSpider(s: Spider) {
    s.state = 'dead'; s.dead = 0; s.vx *= 0.3; s.vz *= 0.3;
    this.audio.spiderDie();
    this.stats.spiders++;
    this.camShake = Math.max(this.camShake, 0.25);
    this.hitStop = 0.09;
    if (Math.random() < 0.6) this.spawnDrop('meat', 1, s.x, s.z);
    if (Math.random() < 0.5) this.spawnDrop('silk', 1, s.x, s.z);
    if (Math.random() < 0.3) this.spawnDrop('gland', 1, s.x, s.z);
    const y = this.world.height(s.x, s.z);
    for (let k = 0; k < 16; k++) this.fxNorm.emit({ x: s.x, y: y + 0.5, z: s.z, vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 1.4, size: 0.8, grow: 0.8, color: [0.08, 0.07, 0.09], a: 0.6, type: PT_SMOKE, drag: 2 });
    if (s.den) s.den.respawn = Math.max(s.den.respawn, 90);
    if (this.target && this.target.t === 'spider' && this.target.s === s) this.target = null;
  }

  hitDen(o: WObj) {
    const dmg = this.weaponDmg();
    o.hp -= dmg; o.shake = 1; o.flash = 0.7;
    this.audio.hit(); this.useDurability();
    this.camShake = Math.max(this.camShake, 0.15);
    const sc = this.toScreen(o.x, o.y + 2, o.z);
    if (sc) this.hud.float(sc.x, sc.y, String(Math.round(dmg)), 'dmg');
    for (let k = 0; k < 10; k++) this.fxNorm.emit({ x: o.x, y: o.y + 1, z: o.z + 0.6, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: Math.random() * 2, life: 2, size: 0.2, color: [0.85, 0.85, 0.8], type: PT_LEAF, grav: 1, flutter: 2 });
    for (const s of o.spiders) { s.aggro = 30; if (s.state === 'home' || s.state === 'sleep') this.emerge(s); }
    this.audio.spiderHiss();
    if (o.hp > 0) return;
    this.audio.rockBreak(); this.camShake = 0.4;
    for (let i = 0; i < 4; i++) this.spawnDrop('silk', 1, o.x, o.z + 0.3);
    for (let i = 0; i < 2; i++) this.spawnDrop('gland', 1, o.x, o.z + 0.3);
    for (const s of o.spiders) if (s.state !== 'dead') { s.den = null; this.spiders.push(s); }
    o.spiders = [];
    this.decor('bones', o.x, o.z); this.statics.commit();
    this.removeObj(o);
    this.target = null;
    this.hud.toast(null, '蛛巢被捣毁了');
  }

  emerge(s: Spider) {
    if (!s.den) return;
    const a = Math.random() * Math.PI * 2;
    s.x = s.den.x + Math.cos(a) * 1.2; s.z = s.den.z + Math.sin(a) * 1.2 + 0.5;
    s.state = 'wander'; s.t = 0; s.tx = s.x; s.tz = s.z; s.hp = s.maxHp;
    s.vx = Math.cos(a) * 3; s.vz = Math.sin(a) * 3;
  }

  damagePlayer(amount: number, cause: string, fx: number, fz: number) {
    if (this.mode !== 'play' || this.invuln > 0) return;
    let dmg = amount;
    const body = this.inv.equip.body;
    if (body) {
      const ar = ITEMS[body.id].armor ?? 0;
      const absorbed = dmg * ar;
      dmg -= absorbed;
      body.dur = (body.dur ?? 0) - absorbed;
      if ((body.dur ?? 0) <= 0) { this.inv.equip.body = null; this.hud.toast(body.id, `${ITEMS[body.id].name} 碎了`); this.inv.onChange(); }
      else this.hud.refreshDurability();
    }
    this.hp -= dmg;
    this.invuln = 0.55;
    this.hurtT = 1;
    const dx = this.px - fx, dz = this.pz - fz, d = Math.hypot(dx, dz) || 1;
    this.pvx = (dx / d) * 9; this.pvz = (dz / d) * 9;
    this.knock = 0.18;
    this.hitStop = 0.08;
    this.camShake = Math.max(this.camShake, 0.4);
    this.audio.hurt();
    this.floatAtPlayer(`-${Math.round(dmg)}`, 'hurt');
    if (!this.action || this.action.a !== 'attack') this.startAnim('hurt', 0.3, 2);
    this.target = null;
    for (let k = 0; k < 10; k++) this.fxNorm.emit({ x: this.px, y: this.py + 1, z: this.pz, vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 4, life: 0.6, size: 0.14, color: [0.55, 0.08, 0.06], type: PT_CHIP, grav: 9 });
    if (this.hp <= 0) this.die(cause);
  }
  knock = 0;
  hurtFx(v: number) { this.hurtT = Math.max(this.hurtT, v); }

  /* ======================= 主更新 ======================= */
  update(rawDt: number) {
    const dt0 = Math.min(rawDt, 0.05);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.hud.setFps(`${Math.round(this.fpsN / this.fpsAcc)} fps`); this.fpsAcc = 0; this.fpsN = 0; }
    this.handleGlobalKeys();
    let dt = this.paused || this.overlay ? 0 : dt0;
    if (this.hitStop > 0) { this.hitStop -= dt0; dt *= 0.08; }
    this.time += dt;
    U.uTime.value = this.time;
    if (this.mode === 'menu') this.updateMenu(dt0);
    else this.logic(dt);
    this.updateCamera(dt0);
    this.updateLights(dt);
    this.updateAmbientFx(dt);
    this.fxAdd.update(dt, U.uWind.value);
    this.fxNorm.update(dt, U.uWind.value);
    this.renderDynamic(dt);
    this.updateHudFrame(dt0);
    this.day.apply(this.post);
    this.applyPost(dt0);
    this.post.final.uniforms.uTime.value = this.time;
    this.renderer.setClearColor(this.day.clearColor);
    this.post.render(this.scene, this.camera);
    this.input.endFrame();
  }

  logic(dt: number) {
    if (dt > 0) {
      if (this.mode === 'play') this.updatePlay(dt);
      else if (this.mode === 'dead') { this.deadT += dt; this.post.final.uniforms.uFade.value = Math.min(0.55, this.deadT * 0.3); }
      this.updateWorld(dt);
      this.updateSpiders(dt);
    }
    this.updateDrops(dt);
    this.updateCrows(dt);
  }
  /** 测试用：不渲染、快速推进游戏逻辑 */
  simulate(sec: number, step = 1 / 30) {
    for (let t = 0; t < sec; t += step) { this.time += step; this.updateLights(step); this.logic(step); this.fxAdd.update(step, 1); this.fxNorm.update(step, 1); }
  }

  handleGlobalKeys() {
    const I = this.input;
    if (this.mode !== 'play') return;
    if (I.hit('Escape') || I.hit('KeyP')) {
      if (this.placing) { this.cancelPlace(); }
      else if (this.overlay) this.closeOverlay();
      else if (this.hud.openTab) this.hud.toggleTab(null);
      else this.showPause();
    }
    if (I.hit('KeyH')) { if (this.overlay?.id === 'help') this.closeOverlay(); else this.showHelp(); }
    if (I.hit('KeyM')) { if (this.overlay?.id === 'map') this.closeOverlay(); else this.showMap(); }
    if (I.hit('KeyN')) { this.audio.setMuted(!this.audio.muted); this.hud.toast(null, this.audio.muted ? '已静音' : '声音已开启'); }
    if (this.overlay) return;
    if (I.hit('Tab') || I.hit('KeyC')) { this.hud.toggleCraft(); this.audio.uiOpen(); }
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
    keys.forEach((k, i) => { if (I.hit(k)) this.useSlot(i); });
  }

  updateMenu(dt: number) {
    this.time += 0; // 时间已在 update 中推进
    this.day.t += dt * 0.0; // 菜单场景定格在黄昏
    this.moving = false;
    this.facing = 'side'; this.flip = false;
    this.camYaw += dt * 0.035;
    this.camDistT = 13.5;
    this.camX = this.px + 0.8; this.camZ = this.pz + 0.3;
    this.playerDrawT += dt;
  }

  updatePlay(dt: number) {
    const I = this.input;
    // 昼夜
    const newDay = this.day.update(dt);
    const ph = this.day.phase;
    if (ph !== this.lastPhase) this.onPhase(ph, newDay);
    this.lastPhase = ph;
    // 计时器
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 1.6);
    this.eatAnim = Math.max(0, this.eatAnim - dt);
    // —— 移动输入 ——
    let ix = 0, iz = 0;
    if (I.down('KeyW') || I.down('ArrowUp')) iz -= 1;
    if (I.down('KeyS') || I.down('ArrowDown')) iz += 1;
    if (I.down('KeyA') || I.down('ArrowLeft')) ix -= 1;
    if (I.down('KeyD') || I.down('ArrowRight')) ix += 1;
    if (I.hit('KeyQ')) this.camYawT += Math.PI / 4;
    if (I.hit('KeyR')) this.camYawT -= Math.PI / 4;
    if (I.wheel) this.camDistT = clamp(this.camDistT + I.wheel * 2, 11, 34);
    this.moving = false;
    if (this.knock > 0) { this.knock -= dt; }
    else if (ix || iz) {
      const l = Math.hypot(ix, iz); ix /= l; iz /= l;
      const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw);
      // 屏幕右 = (c,0,-s)，屏幕下(朝镜头) = (s,0,c)
      const wx = ix * c + iz * s, wz = -ix * s + iz * c;
      const sp = SPEED * this.speedMul();
      this.pvx = wx * sp; this.pvz = wz * sp;
      this.moving = true;
      this.target = null;
      if (this.action && this.action.a !== 'hurt' && this.action.t < this.action.dur * this.action.at) this.action = null;
      if (Math.abs(ix) > Math.abs(iz) * 0.8) { this.facing = 'side'; this.flip = ix < 0; } else this.facing = iz < 0 ? 'up' : 'down';
    } else this.pvx = this.pvz = 0;
    // 放置模式
    if (this.placing) this.updatePlacing();
    else {
      // 鼠标
      this.hover = I.overUI ? null : this.pick();
      if (I.clicked && !I.overUI) {
        if (this.hover) this.interact(this.hover);
        else this.interact({ t: 'ground', x: this.groundPt[0], z: this.groundPt[1] });
      } else if (I.mouseDown && !I.overUI && !this.target && !this.action && this.hover && this.hover.t !== 'drop') {
        const v = this.actInfo(this.hover).verb;
        if (v === 'chop' || v === 'mine' || v === 'attack') this.interact(this.hover);
      }
      if (I.rightClicked) { this.target = null; }
      // 快捷键
      if (I.hit('Space') || (I.down('Space') && !this.target && !this.action)) this.autoTarget(false);
      if (I.hit('KeyE')) this.autoTarget(true);
      if (I.hit('KeyF')) this.autoAttack();
    }
    // 动作
    if (this.action) {
      const A = this.action;
      A.t += dt;
      if (!A.done && A.t >= A.dur * A.at) { A.done = true; this.resolveAction(); }
      if (A.t >= A.dur) {
        this.action = null;
        // 连续砍/凿/攻击
        if (A.target && (A.verb === 'chop' || A.verb === 'mine' || A.verb === 'attack') && this.targetValid(A.target) && !this.moving) this.target = A.target;
      }
      if (A.a !== 'hurt') { this.pvx *= 0; this.pvz *= 0; }
    } else this.updateTarget(dt);
    // 积分与碰撞
    const nx = this.px + this.pvx * dt, nz = this.pz + this.pvz * dt;
    if (this.world.inside(nx, nz, 2.5)) { this.px = nx; this.pz = nz; }
    else this.target = null;
    for (const o of this.grid.query(this.px, this.pz, 2.5, this.q)) {
      if (o.r <= 0) continue;
      const dx = this.px - o.x, dz = this.pz - o.z, d = Math.hypot(dx, dz), m = o.r + 0.35;
      if (d < m && d > 1e-4) { this.px = o.x + (dx / d) * m; this.pz = o.z + (dz / d) * m; }
    }
    this.py = this.world.height(this.px, this.pz);
    const spd = Math.hypot(this.pvx, this.pvz);
    if (this.moving && spd > 0.1) {
      this.walkPhase += dt * spd * 2.1;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.36;
        const b = this.world.biomeAt(this.px, this.pz);
        this.audio.footstep(this.world.pathAt(this.px, this.pz) > 0.5 ? 4 : b);
        if (b === Biome.Swamp || b === Biome.Rocky || this.world.pathAt(this.px, this.pz) > 0.5) this.fxNorm.emit({ x: this.px, y: this.py + 0.05, z: this.pz, vx: (Math.random() - 0.5) * 0.6, vy: 0.4, vz: 0, life: 0.8, size: 0.35, grow: 0.5, color: b === Biome.Swamp ? [0.25, 0.3, 0.25] : [0.55, 0.47, 0.38], a: 0.35, type: PT_SMOKE, drag: 3 });
      }
    }
    this.playerDrawT += dt;
    this.updateSurvival(dt);
  }

  autoTarget(pickupOnly: boolean) {
    let best: Target | null = null, bd = pickupOnly ? 5 : 9;
    for (const d of this.drops) { const dd = Math.hypot(d.x - this.px, d.z - this.pz); if (dd < bd) { bd = dd; best = { t: 'drop', d }; } }
    if (!pickupOnly || !best) {
      for (const o of this.grid.query(this.px, this.pz, pickupOnly ? 3 : 9, this.q)) {
        const info = this.actInfo({ t: 'obj', o });
        if (!info.ok || info.verb === 'fuel' || info.verb === 'attack') continue;
        if (pickupOnly && info.verb !== 'pick') continue;
        const dd = Math.hypot(o.x - this.px, o.z - this.pz) + (info.verb === 'pick' ? 0 : 1.5);
        if (dd < bd) { bd = dd; best = { t: 'obj', o }; }
      }
    }
    if (best) this.interact(best);
  }
  autoAttack() {
    let best: Spider | null = null, bd = 8;
    for (const s of this.allSpiders()) {
      if (s.state === 'home' || s.state === 'dead' || s.state === 'sleep') continue;
      const d = Math.hypot(s.x - this.px, s.z - this.pz);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) this.interact({ t: 'spider', s: best });
  }

  onPhase(ph: Phase, newDay: boolean) {
    if (ph === 'dusk') {
      this.audio.duskStinger();
      this.hud.setVMsg('黄昏降临……天就要黑了');
      setTimeout(() => this.hud.setVMsg(null), 4000);
      this.hintOnce('dusk', '<b>黄昏</b>了！天黑后没有光就会被黑暗吞噬。准备好<b>营火</b>（Tab → 光与火）或<b>火把</b>。', 9);
    } else if (ph === 'night') {
      this.audio.nightStinger();
      this.hud.setVMsg('夜，来了');
      setTimeout(() => this.hud.setVMsg(null), 3500);
    } else if (ph === 'day') {
      this.audio.dawn();
      this.hud.showBanner(`第 ${cnNum(this.day.day)} 天`, newDay ? '你又熬过了一夜' : '', 4);
      this.hud.rebuildClock(this.day.lens.day / this.day.total, this.day.lens.dusk / this.day.total);
    }
  }

  lightAt(x: number, z: number): number {
    let v = 1 - this.day.darkness;
    for (const L of this.lights) {
      const d = Math.hypot(L.x - x, L.z - z);
      const t = clamp(1 - d / L.r);
      v = Math.max(v, Math.min(1, t * 1.6) * Math.min(1, L.i));
    }
    return v;
  }

  updateSurvival(dt: number) {
    const e = this.easy;
    const r = { hp: 0, hu: 0, sa: 0 };
    // 饥饿
    r.hu = -(e ? 0.11 : 0.14);
    this.hunger += r.hu * dt;
    if (this.hunger <= 0) {
      this.hunger = 0;
      r.hp -= 1;
      this.hintOnce('starve', '你在<b>挨饿</b>！快吃点东西——赤莓、萝卜，烤熟更顶饱。', 7);
    } else if (this.hunger > HUNGER_MAX * 0.5 && this.hp < HP_MAX) r.hp += 0.06;
    if (this.hunger < HUNGER_MAX * 0.25) this.hintOnce('hungry', '肚子饿了。点击物品栏里的<b>食物</b>吃掉，站在火旁<b>右键</b>可以烤熟。', 7);
    // 理智
    const ph = this.day.phase;
    const light = this.lightAt(this.px, this.pz);
    if (ph === 'dusk') r.sa -= 0.05;
    if (ph === 'night') r.sa -= light > 0.3 ? 0.06 : 0.12;
    if (light < 0.15 && this.day.darkness > 0.5) r.sa -= 0.35;
    const fire = this.nearFire();
    if (fire && ph !== 'day') r.sa += 0.07;
    for (const s of this.allSpiders()) if (s.state !== 'home' && s.state !== 'dead' && Math.hypot(s.x - this.px, s.z - this.pz) < 7) r.sa -= 0.12;
    const head = this.inv.equip.head;
    if (head) r.sa += ITEMS[head.id].sanityAura ?? 0;
    if (ph === 'day' && this.world.biomeAt(this.px, this.pz) === Biome.Clearing) r.sa += 0.02;
    if (ph === 'day' && this.sanity < SANITY_MAX * 0.4) this.hintOnce('sanity', '<b>理智</b>在下降。戴<b>花冠</b>、采花、吃<b>炙伞菇</b>，或在火边休息都能安神。', 8);
    this.sanity = clamp(this.sanity + r.sa * dt, 0, SANITY_MAX);
    // 黑暗中的噬影
    if (this.day.darkness > 0.6 && light < 0.13) {
      this.darkT += dt;
      if (this.darkT > 0.8 && this.eyes.length < 3 && Math.random() < dt * 2) {
        const a = Math.random() * Math.PI * 2, d = 3.2 + Math.random() * 2.3;
        this.eyes.push({ x: this.px + Math.cos(a) * d, z: this.pz + Math.sin(a) * d, t: 0 });
      }
      if (this.darkT > 1.0) { this.hud.setVMsg('黑暗里有东西在看着你……快找光！'); this.hintOnce('dark', '漆黑之中<b>噬影</b>会攻击你！立刻点燃<b>火把</b>或生起<b>营火</b>。', 8); }
      if (this.darkT > 3.2) {
        this.darkHitT -= dt;
        if (this.darkHitT <= 0) {
          this.darkHitT = 2.4;
          this.audio.shadowStrike();
          const a = Math.random() * Math.PI * 2;
          this.invuln = 0;
          this.damagePlayer(e ? 14 : 20, '黑暗中的噬影', this.px + Math.cos(a), this.pz + Math.sin(a));
          this.sanity = Math.max(0, this.sanity - 10);
          this.post.final.uniforms.uFlicker.value = 1;
        }
      }
    } else {
      if (this.darkT > 1.0) this.hud.setVMsg(null);
      this.darkT = Math.max(0, this.darkT - dt * 2.5);
      this.darkHitT = 0.6;
    }
    for (const ey of this.eyes) ey.t += dt;
    this.eyes = this.eyes.filter((ey) => ey.t < 4 && this.darkT > 0.5);
    this.shiver = clamp(this.darkT / 2 + (1 - this.sanity / SANITY_MAX) * 0.5 - 0.25);
    this.hp = Math.min(HP_MAX, this.hp + r.hp * dt);
    this.rates = r;
    if (this.hp <= 0 && this.mode === 'play') this.die(this.hunger <= 0 ? '饥饿' : '伤重不治');
    // 手持光源与花冠的时间耐久
    for (const slot of ['hand', 'head'] as Slot[]) {
      const st = this.inv.equip[slot];
      if (st && ITEMS[st.id].durTime && st.dur !== undefined) {
        st.dur -= dt;
        if (st.dur <= 0) {
          this.inv.equip[slot] = null;
          this.hud.toast(st.id, `${ITEMS[st.id].name} ${slot === 'hand' ? '燃尽了' : '枯萎了'}`);
          this.inv.onChange();
        }
      }
    }
    this.durT = (this.durT ?? 0) + dt;
    if (this.durT > 0.5) { this.durT = 0; this.hud.refreshDurability(); }
  }
  durT = 0;

  /* ======================= 世界更新 ======================= */
  fxObjs = new Set<WObj>();
  regrowT = 0;
  faded = new Map<WObj, number>();
  updateOcclusion(dt: number) {
    // 挡住主角的树木渐隐（朝镜头一侧、横向接近）
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw); // 镜头前向（水平）
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const want = new Set<WObj>();
    for (const o of this.grid.query(this.px, this.pz, 6, this.q)) {
      if (o.kind !== 'tree' || o.picked) continue;
      const dx = o.x - this.px, dz = o.z - this.pz;
      const fwd = dx * fx + dz * fz, lat = Math.abs(dx * rx + dz * rz);
      if (fwd < -0.2 && fwd > -5.5 && lat < 1.5) want.add(o);
    }
    for (const o of want) if (!this.faded.has(o)) this.faded.set(o, 0);
    let dirty = false;
    for (const [o, v] of this.faded) {
      const tgt = want.has(o) ? 0.6 : 0;
      const nv = v + (tgt - v) * (1 - Math.exp(-dt * 8));
      if (o.removed) { this.faded.delete(o); continue; }
      this.statics.setFade(o.inst, nv); dirty = true;
      if (tgt === 0 && nv < 0.01) { this.statics.setFade(o.inst, 0); this.faded.delete(o); } else this.faded.set(o, nv);
    }
    if (dirty) this.statics.commit();
  }
  updateWorld(dt: number) {
    this.updateOcclusion(dt);
    // 再生（低频扫描）
    this.regrowT += dt;
    if (this.regrowT > 1) {
      const step = this.regrowT; this.regrowT = 0;
      let dirty = false;
      for (const o of this.objs) {
        if (o.removed || !o.picked || o.kind === 'tree') continue;
        o.regrow -= step;
        if (o.regrow <= 0) {
          o.picked = false;
          this.setObjFrame(o, o.kind === 'grass' ? 'grass' : o.kind === 'sapling' ? 'sapling' : o.kind === 'bush' ? 'bush' : 'reeds');
          dirty = true;
        }
      }
      for (const q of this.respawnQueue) {
        q.t -= step;
        if (q.t <= 0) {
          const a = Math.random() * 6.28, x = q.x + Math.cos(a) * 3, z = q.z + Math.sin(a) * 3;
          if (this.world.inside(x, z, 4) && Math.hypot(x - this.px, z - this.pz) > 12) {
            this.addObj(q.kind as ObjKind, q.kind, x, z, q.frame, { sway: 0.1, shadowR: 0, shadowH: 0 }); dirty = true;
          } else q.t = 20;
        }
      }
      this.respawnQueue = this.respawnQueue.filter((q) => q.t > 0);
      // 巢穴补充
      for (const o of this.objs) {
        if (o.kind !== 'den' || o.removed) continue;
        if (o.respawn > 0) {
          o.respawn -= step;
          if (o.respawn <= 0) {
            const dead = o.spiders.find((s) => s.state === 'dead');
            if (dead) { Object.assign(dead, this.makeSpider(o)); dead.state = 'home'; if (o.spiders.some((s) => s.state === 'dead')) o.respawn = 90; }
          }
        }
        o.hp = Math.min(o.maxHp, o.hp + step * 0.5);
      }
      if (dirty) this.statics.commit();
    }
    // 火
    for (const o of this.grid.query(this.camX, this.camZ, 60, this.q)) {
      if ((o.kind === 'campfire' || o.kind === 'firepit') && o.fuel > 0) {
        if (o !== this.menuFire) o.fuel -= dt;
        if (o.fuel <= 0) {
          o.fuel = 0;
          this.setObjFrame(o, o.kind === 'firepit' ? 'firepit_burnt' : 'campfire_burnt');
          this.statics.commit();
          for (let k = 0; k < 12; k++) this.fxNorm.emit({ x: o.x, y: o.y + 0.3, z: o.z, vx: (Math.random() - 0.5), vy: 1 + Math.random(), vz: (Math.random() - 0.5), life: 3, size: 0.6, grow: 0.8, color: [0.3, 0.28, 0.27], a: 0.5, type: PT_SMOKE, drag: 1 });
        } else if (o.fuel < 20 && Math.hypot(o.x - this.px, o.z - this.pz) < 8) this.hintOnce('lowfire', '火快灭了！点击火堆或在物品栏<b>右键</b>木头/干草来<b>添柴</b>。', 7);
      }
      if (o.flash > 0 || o.shake > 0) this.fxObjs.add(o);
    }
    for (const o of this.fxObjs) {
      o.flash = Math.max(0, o.flash - dt * 4);
      o.shake = Math.max(0, o.shake - dt * 4);
      if (!o.removed) this.statics.setFx(o.inst, o.flash * 0.6, o.shake * 0.08);
      if (o.flash <= 0 && o.shake <= 0) this.fxObjs.delete(o);
    }
    if (this.fxObjs.size) this.statics.commit();
  }

  /* ======================= 墨蛛 AI ======================= */
  updateSpiders(dt: number) {
    const ph = this.day.phase;
    const night = ph !== 'day';
    const all = this.allSpiders();
    const spChase = this.easy ? 3.8 : 4.3;
    const bite = this.easy ? 9 : 12;
    const playerAlive = this.mode === 'play';
    const pLight = this.lightAt(this.px, this.pz);
    for (const s of all) {
      s.flash = Math.max(0, s.flash - dt * 5);
      if (s.state === 'home') {
        if (!s.den) { s.state = 'wander'; continue; }
        const dPlayer = Math.hypot(s.den.x - this.px, s.den.z - this.pz);
        if ((night && Math.random() < dt * 0.15) || (dPlayer < 5 && playerAlive && Math.random() < dt * (night ? 2 : 0.4))) { this.emerge(s); if (dPlayer < 6) s.aggro = 10; }
        continue;
      }
      if (s.state === 'dead') { s.dead += dt; s.x += s.vx * dt; s.z += s.vz * dt; s.vx *= 0.9; s.vz *= 0.9; continue; }
      s.aggro = Math.max(0, s.aggro - dt);
      s.t -= dt;
      const dx = this.px - s.x, dz = this.pz - s.z, d = Math.hypot(dx, dz);
      const homeX = s.den ? s.den.x : s.tx, homeZ = s.den ? s.den.z : s.tz;
      let want = 0, wx = 0, wz = 0;
      const notice = playerAlive && (s.aggro > 0 ? d < 16 : night ? d < 7.5 + pLight * 2 : d < 3.5);
      switch (s.state) {
        case 'sleep': case 'wander':
          if (notice) { s.state = 'chase'; if (!s.alertShown) { this.audio.spiderHiss(); s.alertShown = true; } s.flash = 0.6; break; }
          if (!night && s.aggro <= 0 && s.den) { s.state = 'return'; break; }
          if (s.t <= 0) {
            s.t = 2 + Math.random() * 3;
            const a = Math.random() * 6.28, r = 2 + Math.random() * 7;
            s.tx = homeX + Math.cos(a) * r; s.tz = homeZ + Math.sin(a) * r;
            if (s.den) { s.tx = s.den.x + Math.cos(a) * r; s.tz = s.den.z + Math.sin(a) * r; }
          }
          wx = s.tx - s.x; wz = s.tz - s.z; want = Math.hypot(wx, wz) > 0.5 ? 1.5 : 0;
          break;
        case 'chase':
          if (!playerAlive || (d > 18 && s.aggro <= 0) || (!night && s.aggro <= 0 && d > 6)) { s.state = s.den ? 'return' : 'wander'; s.alertShown = false; break; }
          if (d < 2.3 && this.invuln <= 0.2) { s.state = 'windup'; s.t = 0.55; this.audio.spiderHiss(); break; }
          wx = dx; wz = dz; want = spChase;
          // 绕着火光打转：明亮处稍慢
          if (pLight > 0.6 && night) want *= 0.85;
          break;
        case 'windup':
          s.face = dx < 0 ? -1 : 1;
          if (s.t <= 0) { s.state = 'lunge'; s.t = 0.24; s.lx = dx / (d || 1); s.lz = dz / (d || 1); s.hit = false; }
          break;
        case 'lunge':
          s.vx = s.lx * 8.5; s.vz = s.lz * 8.5;
          if (!s.hit && d < 1.0) { s.hit = true; this.damagePlayer(bite, '墨蛛的毒牙', s.x, s.z); }
          if (s.t <= 0) { s.state = 'recover'; s.t = 0.85; }
          break;
        case 'recover':
          s.vx *= Math.exp(-dt * 8); s.vz *= Math.exp(-dt * 8);
          if (s.t <= 0) s.state = 'chase';
          break;
        case 'hurt':
          s.vx *= Math.exp(-dt * 6); s.vz *= Math.exp(-dt * 6);
          if (s.t <= 0) s.state = 'chase';
          break;
        case 'return':
          if (notice && s.aggro > 0) { s.state = 'chase'; break; }
          if (!s.den) { s.state = 'wander'; break; }
          wx = s.den.x - s.x; wz = s.den.z - s.z; want = 2.4;
          if (Math.hypot(wx, wz) < 0.8) { s.state = 'home'; s.hp = s.maxHp; s.alertShown = false; }
          break;
      }
      if (s.state === 'wander' || s.state === 'chase' || s.state === 'return' || s.state === 'sleep') {
        const l = Math.hypot(wx, wz);
        const tvx = l > 1e-3 ? (wx / l) * want : 0, tvz = l > 1e-3 ? (wz / l) * want : 0;
        const k = 1 - Math.exp(-dt * 6);
        s.vx += (tvx - s.vx) * k; s.vz += (tvz - s.vz) * k;
      } else if (s.state === 'windup') { s.vx *= 0.8; s.vz *= 0.8; }
      // 彼此分开
      for (const o of all) {
        if (o === s || o.state === 'home' || o.state === 'dead') continue;
        const ox = s.x - o.x, oz = s.z - o.z, od = Math.hypot(ox, oz);
        if (od < 1.1 && od > 1e-3) { s.x += (ox / od) * (1.1 - od) * 0.5; s.z += (oz / od) * (1.1 - od) * 0.5; }
      }
      const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
      if (this.world.inside(nx, nz, 2)) { s.x = nx; s.z = nz; }
      for (const o of this.grid.query(s.x, s.z, 2, this.q)) {
        if (o.r <= 0 || o.kind === 'den') continue;
        const ox = s.x - o.x, oz = s.z - o.z, od = Math.hypot(ox, oz), m = o.r + 0.4;
        if (od < m && od > 1e-4) { s.x = o.x + (ox / od) * m; s.z = o.z + (oz / od) * m; }
      }
      const sp = Math.hypot(s.vx, s.vz);
      s.walk += dt * sp * 3.2;
      if (Math.abs(s.vx) > 0.3 && s.state !== 'windup') s.face = s.vx < 0 ? -1 : 1;
    }
    // 清理已散去的无巢尸体
    this.spiders = this.spiders.filter((s) => !(s.state === 'dead' && s.dead > 4));
  }

  /* ======================= 掉落物 ======================= */
  updateDrops(dt: number) {
    for (const d of this.drops) {
      d.age += dt;
      const g = this.world.height(d.x, d.z);
      if (d.y > g + 0.001 || d.vy > 0) {
        d.vy -= 22 * dt;
        d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt;
        if (d.y <= g) {
          d.y = g;
          if (Math.abs(d.vy) > 2 && d.bounce < 2) { d.vy = -d.vy * 0.35; d.vx *= 0.5; d.vz *= 0.5; d.bounce++; }
          else { d.vy = 0; d.vx = 0; d.vz = 0; }
        }
      } else d.y = g;
    }
    // 自动吸附近处掉落
    if (this.mode === 'play' && !this.action) {
      for (const d of this.drops) {
        if (d.age > 0.6 && Math.hypot(d.x - this.px, d.z - this.pz) < 0.7) { this.pickupDrop(d); break; }
      }
    }
  }

  /* ======================= 乌鸦 ======================= */
  crowT = 0;
  updateCrows(dt: number) {
    if (dt <= 0) return;
    this.crowT -= dt;
    if (this.crowT <= 0 && this.day.phase === 'day' && this.crows.length < 4 && this.mode !== 'dead') {
      this.crowT = 6 + Math.random() * 8;
      const a = Math.random() * 6.28, r = 9 + Math.random() * 9;
      const x = this.px + Math.cos(a) * r, z = this.pz + Math.sin(a) * r;
      if (this.world.inside(x, z, 5) && this.world.biomeAt(x, z) !== Biome.Swamp) this.crows.push({ x, z, y: 0, vx: 0, vz: 0, vy: 0, state: 'idle', t: Math.random() * 2, face: Math.random() < 0.5 ? 1 : -1, gone: false });
    }
    for (const c of this.crows) {
      c.t -= dt;
      const d = Math.hypot(c.x - this.px, c.z - this.pz);
      if (c.state !== 'fly') {
        if (d < 4 || this.day.phase === 'night' || (this.allSpiders().some((s) => s.state === 'chase' && Math.hypot(s.x - c.x, s.z - c.z) < 5))) {
          c.state = 'fly';
          const ax = (c.x - this.px) / (d || 1), az = (c.z - this.pz) / (d || 1);
          c.vx = ax * 6 + (Math.random() - 0.5) * 2; c.vz = az * 6; c.vy = 4; c.face = c.vx < 0 ? -1 : 1; c.t = 5;
        } else if (c.t <= 0) {
          c.state = c.state === 'idle' ? 'peck' : 'idle'; c.t = c.state === 'peck' ? 0.5 + Math.random() * 0.6 : 1 + Math.random() * 2.5;
          if (c.state === 'idle' && Math.random() < 0.4) { c.face *= -1; c.x += c.face * 0.3; }
        }
      } else {
        c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt; c.vy += 1.5 * dt;
        if (c.t <= 0) c.gone = true;
      }
      if (d > 45) c.gone = true;
    }
    this.crows = this.crows.filter((c) => !c.gone);
  }

  /* ======================= 摄像机 ======================= */
  updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 6);
    this.camYaw += (this.camYawT - this.camYaw) * (1 - Math.exp(-dt * 8));
    if (this.mode === 'menu') this.camYawT = this.camYaw;
    this.camDist += (this.camDistT - this.camDist) * (1 - Math.exp(-dt * 5));
    if (this.mode !== 'menu') {
      const lx = this.px + this.pvx * 0.35, lz = this.pz + this.pvz * 0.35;
      const kk = 1 - Math.exp(-dt * 3.2);
      this.camX += (lx - this.camX) * kk; this.camZ += (lz - this.camZ) * kk;
    }
    const pitch = 0.86 + clamp((this.camDist - 11) / 23) * 0.18;
    const ty = this.world.height(this.camX, this.camZ) + 1.1;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    this.camShake = Math.max(0, this.camShake - dt * 1.8);
    const sh = this.camShake * this.camShake * 0.9;
    const jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    this.camera.position.set(this.camX + Math.sin(this.camYaw) * cp * this.camDist + jx, ty + sp * this.camDist + jy, this.camZ + Math.cos(this.camYaw) * cp * this.camDist);
    this.camera.lookAt(this.camX + jx * 0.5, ty, this.camZ);
    this.camera.updateMatrixWorld();
    const m = this.camera.matrixWorld.elements;
    U.uCamPos.value.copy(this.camera.position);
    U.uCamRight.value.set(m[0], m[1], m[2]);
    U.uCamUp.value.set(m[4], m[5], m[6]);
    const pxs = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.fxAdd.material.uniforms.uPxScale.value = pxs;
    this.fxNorm.material.uniforms.uPxScale.value = pxs;
    void k;
  }

  /* ======================= 光源 ======================= */
  updateLights(dt: number) {
    const L: LightSrc[] = [];
    const t = this.time;
    for (const o of this.grid.query(this.camX, this.camZ, 55, this.q)) {
      if ((o.kind !== 'campfire' && o.kind !== 'firepit') || o.fuel <= 0) continue;
      const f = Math.min(1, o.fuel / 60);
      const fl = 1 + Math.sin(t * 13 + o.id) * 0.06 + Math.sin(t * 23.7 + o.id * 3) * 0.05 + (Math.random() - 0.5) * 0.06;
      L.push({ x: o.x, y: o.y + 1.1, z: o.z, r: (4.5 + 8 * f + (o.kind === 'firepit' ? 1.5 : 0)) * fl, c: [1.0, 0.52, 0.2], i: (1.5 + 0.5 * f) * fl, fire: true });
    }
    const h = this.inv.equip.hand;
    if (h && ITEMS[h.id].light && this.mode !== 'menu') {
      const lant = h.id === 'lantern';
      const fl = lant ? 1 + Math.sin(t * 7) * 0.02 : 1 + Math.sin(t * 17) * 0.06 + (Math.random() - 0.5) * 0.08;
      const { R } = this.billAxes();
      const hx = this.px + R.x * this.playerArt.hand.x * (this.flip ? -1 : 1), hz = this.pz + R.z * this.playerArt.hand.x * (this.flip ? -1 : 1);
      L.push({ x: hx, y: this.py + 1.5, z: hz, r: ITEMS[h.id].light! * fl, c: lant ? [1, 0.72, 0.42] : [1, 0.56, 0.24], i: 1.35 * fl });
    }
    L.sort((a, b) => Math.hypot(a.x - this.camX, a.z - this.camZ) - Math.hypot(b.x - this.camX, b.z - this.camZ));
    this.lights = L;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const p = U.uLightPos.value[i], c = U.uLightCol.value[i];
      const l = L[i];
      if (l) { p.set(l.x, l.y, l.z, l.r); c.set(l.c[0], l.c[1], l.c[2], l.i); }
      else { p.set(0, -100, 0, 1); c.set(0, 0, 0, 0); }
    }
    // 音频
    let fireNear = 0;
    for (const l of L) fireNear = Math.max(fireNear, clamp(1 - Math.hypot(l.x - this.px, l.z - this.pz) / 9));
    this.audio.fireLevel = fireNear;
    void dt;
  }

  /* ======================= 环境粒子 ======================= */
  updateAmbientFx(dt: number) {
    if (dt <= 0) return;
    const ph = this.day.phase, dark = this.day.darkness;
    const cx = this.camX, cz = this.camZ;
    const rnd = (r: number) => (Math.random() - 0.5) * r;
    // 日间尘埃 / 花粉
    if (dark < 0.6 && Math.random() < dt * 14) {
      const x = cx + rnd(30), z = cz + rnd(24);
      this.fxAdd.emit({ x, y: this.world.height(x, z) + 0.5 + Math.random() * 3, z, vx: rnd(0.3) + 0.2, vy: rnd(0.15), vz: rnd(0.3), life: 6, size: 0.07, color: dark > 0.2 ? [1, 0.6, 0.3] : [1, 0.95, 0.75], a: 0.5, type: PT_MOTE, flutter: 0.6, fadeIn: 0.3 });
    }
    // 森林落叶
    if (Math.random() < dt * 5) {
      const x = cx + rnd(30), z = cz + rnd(24);
      const b = this.world.biomeAt(x, z);
      if (b === Biome.Forest || b === Biome.Swamp) this.fxNorm.emit({ x, y: this.world.height(x, z) + 5 + Math.random() * 2, z, vx: 0.4, vy: -0.6, vz: rnd(0.3), life: 8, size: 0.24, color: b === Biome.Forest ? [0.35, 0.3, 0.16] : [0.3, 0.32, 0.22], type: PT_LEAF, flutter: 2.4, drag: 0.6, grav: 0.05, rotV: 2 });
    }
    // 夜里沼泽萤火
    if (dark > 0.5 && Math.random() < dt * 8) {
      const x = cx + rnd(30), z = cz + rnd(24);
      const b = this.world.biomeAt(x, z);
      if (b === Biome.Swamp || b === Biome.Clearing) this.fxAdd.emit({ x, y: this.world.height(x, z) + 0.4 + Math.random() * 1.5, z, vx: rnd(0.4), vy: rnd(0.2), vz: rnd(0.4), life: 4, size: 0.1, color: [0.7, 0.95, 0.45], a: 0.9, type: PT_GLOW, flutter: 1.2, fadeIn: 0.4 });
    }
    // 火堆：火星、烟、热光
    for (const l of this.lights) {
      if (!l.fire) continue;
      if (Math.random() < dt * 9) this.fxAdd.emit({ x: l.x + rnd(0.5), y: l.y - 0.2, z: l.z + rnd(0.5), vx: rnd(0.8), vy: 1.8 + Math.random() * 1.8, vz: rnd(0.8), life: 1.4 + Math.random(), size: 0.09, color: [1, 0.62, 0.25], type: PT_SPARK, flutter: 3, drag: 0.4 });
      if (Math.random() < dt * 4) this.fxNorm.emit({ x: l.x + rnd(0.3), y: l.y + 0.6, z: l.z + rnd(0.3), vx: 0.25, vy: 1.1, vz: rnd(0.2), life: 3.5, size: 0.5, grow: 0.7, color: [0.2, 0.18, 0.17], a: 0.35, type: PT_SMOKE, drag: 0.3, fadeIn: 0.2 });
    }
    // 手持火把
    const h = this.inv.equip.hand;
    if (h?.id === 'torch' && this.mode === 'play' && Math.random() < dt * 22) {
      const { R } = this.billAxes();
      const s = this.flip ? -1 : 1;
      const hx = this.px + R.x * this.playerArt.hand.x * s, hz = this.pz + R.z * this.playerArt.hand.x * s;
      this.fxAdd.emit({ x: hx + rnd(0.1), y: this.py + this.playerArt.hand.y + 0.45, z: hz + rnd(0.1), vx: rnd(0.3) - this.pvx * 0.3, vy: 1.1 + Math.random(), vz: rnd(0.3) - this.pvz * 0.3, life: 0.45, size: 0.22, grow: -0.3, color: [1, 0.55, 0.18], type: PT_GLOW });
      if (Math.random() < 0.25) this.fxAdd.emit({ x: hx, y: this.py + this.playerArt.hand.y + 0.6, z: hz, vx: rnd(0.6), vy: 1.5 + Math.random() * 1.5, vz: rnd(0.6), life: 1, size: 0.06, color: [1, 0.7, 0.3], type: PT_SPARK, flutter: 2 });
    }
    // 低理智：墨色游丝
    const ins = 1 - this.sanity / SANITY_MAX;
    if (this.mode === 'play' && ins > 0.55 && Math.random() < dt * 10 * ins) {
      const a = Math.random() * 6.28, r = 2 + Math.random() * 5;
      const x = this.px + Math.cos(a) * r, z = this.pz + Math.sin(a) * r;
      this.fxNorm.emit({ x, y: this.world.height(x, z) + 0.3, z, vx: -Math.cos(a) * 0.4, vy: 0.5, vz: -Math.sin(a) * 0.4, life: 2.5, size: 0.7, grow: 0.5, color: [0.02, 0.01, 0.03], a: 0.55, type: PT_SMOKE, flutter: 1.5, fadeIn: 0.3 });
    }
    U.uWind.value = 0.8 + Math.sin(this.time * 0.13) * 0.4 + Math.sin(this.time * 0.37) * 0.2;
    this.audio.windLevel = U.uWind.value * 0.6;
    void ph;
  }

  /* ======================= 动态渲染 ======================= */
  playerFrame(): Frame {
    const c = this.playerArt.canvas;
    return { u0: 0, v0: 1, u1: 1, v1: 0, w: c.width / PLAYER_PPU, h: c.height / PLAYER_PPU, foot: this.playerArt.pad / PLAYER_PPU };
  }
  renderDynamic(dt: number) {
    const D = this.dyn, S = this.shadowsDyn;
    D.clear(); S.count = 0;
    const t = this.time;
    const view = (x: number, z: number, r = 42) => Math.abs(x - this.camX) < r && Math.abs(z - this.camZ) < r;
    // 火焰
    for (const o of this.grid.query(this.camX, this.camZ, 50, this.q)) {
      if ((o.kind === 'campfire' || o.kind === 'firepit') && o.fuel > 0) {
        const f = Math.min(1, o.fuel / 70);
        const fr = Math.floor(t * 12 + o.id * 1.7) % 6;
        const sc = (0.55 + 0.6 * f) * (o.kind === 'firepit' ? 1.1 : 1) * (1 + Math.sin(t * 9 + o.id) * 0.04);
        D.push({ x: o.x, y: o.y + 0.12, z: o.z + 0.05, frame: this.atlas.get(`flame${fr}`), flags: FLAG_EMISSIVE | ((fr & 1) ? FLAG_FLIP : 0), scale: sc, sway: 0.04, phase: o.id });
      }
    }
    // 墨蛛
    for (const s of this.allSpiders()) {
      if (s.state === 'home' || !view(s.x, s.z)) continue;
      const y = this.world.height(s.x, s.z);
      let fr = `spider_walk${Math.floor(s.walk) % 4}`, shake = 0, fade = 0, flash = s.flash;
      const sp = Math.hypot(s.vx, s.vz);
      if (s.state === 'dead') { fr = 'spider_dead'; fade = clamp((s.dead - 2.5) / 1.5); }
      else if (s.state === 'windup') { fr = 'spider_windup'; shake = 0.08; flash = Math.max(flash, 0.25 + 0.25 * Math.sin(t * 40)); }
      else if (s.state === 'lunge') fr = 'spider_bite';
      else if (s.state === 'hurt') fr = 'spider_hurt';
      else if (sp < 0.2) fr = 'spider_walk0';
      D.push({ x: s.x, y, z: s.z, frame: this.atlas.get(fr), flags: s.face < 0 ? FLAG_FLIP : 0, flash, shake, fade });
      if (s.state !== 'dead' || fade < 0.5) S.push(s.x, s.z, 0.75, 0.7, 1 - fade);
    }
    // 掉落物
    for (const d of this.drops) {
      if (!view(d.x, d.z)) continue;
      const rest = d.vy === 0 && d.y <= this.world.height(d.x, d.z) + 0.01;
      const bob = rest ? 0.06 + Math.sin(t * 3 + d.x * 3) * 0.05 : 0;
      D.push({ x: d.x, y: d.y + bob, z: d.z, frame: this.atlas.get('item_' + d.id), scale: 0.55, flash: d.age < 0.15 ? 0.6 : 0 });
      S.push(d.x, d.z, 0.28, 0.2, 0.8);
    }
    // 乌鸦
    for (const c of this.crows) {
      const y = this.world.height(c.x, c.z) + c.y;
      const fr = c.state === 'fly' ? `crow_fly${Math.floor(t * 10) % 2}` : c.state === 'peck' ? (Math.floor(t * 6) % 2 ? 'crow_peck' : 'crow_stand') : 'crow_stand';
      D.push({ x: c.x, y, z: c.z, frame: this.atlas.get(fr), flags: c.face < 0 ? FLAG_FLIP : 0 });
      S.push(c.x, c.z, 0.25, 0.3, clamp(1 - c.y / 6));
    }
    // 黑暗中的眼睛
    for (const e of this.eyes) {
      const blink = Math.sin(e.t * 3 + e.x) > 0.93;
      D.push({ x: e.x, y: this.world.height(e.x, e.z) + 0.6 + Math.sin(e.t * 1.3) * 0.15, z: e.z, frame: this.atlas.get(blink ? 'eyes0' : 'eyes1'), flags: FLAG_EMISSIVE, fade: 1 - clamp(e.t * 1.5) * clamp((4 - e.t) * 2) });
    }
    // 噬影现身：黑暗持续时从暗处逼近，出手瞬间扑到身前（纯表现，伤害逻辑不变）
    if (this.darkT < 1) this.shadeA = (this.px * 1.7 + this.pz * 2.3 + Math.floor(t / 6)) % (Math.PI * 2);
    else if (this.darkT > 2.0 && this.mode !== 'dead' && this.atlas.frames.has('shade')) {
      const k = clamp((this.darkT - 2.0) / 1.2);
      const strike = this.darkT > 3.2 ? clamp(1 - Math.abs(this.darkHitT - 2.15) / 0.3) : 0;
      const a = this.shadeA + Math.sin(t * 0.7) * 0.25;
      const d = 4.3 - 2.4 * k - 1.0 * strike;
      const sx = this.px + Math.cos(a) * d, sz = this.pz + Math.sin(a) * d;
      D.push({ x: sx, y: this.world.height(sx, sz) + 0.1 + Math.sin(t * 1.7) * 0.12, z: sz, frame: this.atlas.get('shade'), flags: FLAG_EMISSIVE | (sx < this.px ? FLAG_FLIP : 0), fade: 1 - (0.3 + 0.55 * k + 0.15 * strike), sway: 0.06, phase: 3, scale: 0.9 + 0.15 * strike });
    }
    // 放置虚影
    if (this.placing) {
      const p = this.placing;
      D.push({ x: p.x, y: this.world.height(p.x, p.z), z: p.z, frame: this.atlas.get(p.recipe.id), flags: FLAG_GHOST, dark: p.ok ? 0 : 1, flash: p.ok ? 0.15 : 0 });
    }
    D.commit();
    // 主角
    this.drawPlayer();
    S.push(this.px, this.pz, 0.5, 2.0, 1);
    S.commit();
    void dt;
  }

  drawPlayer() {
    const A = this.action;
    let action: Action = 'none', actionT = 0;
    if (A) { action = A.a; actionT = clamp(A.t / A.dur); }
    else if (this.eatAnim > 0) { action = 'eat'; actionT = 1 - this.eatAnim / 0.7; }
    const e = this.inv.equip;
    this.playerArt.draw({
      t: this.playerDrawT, facing: this.facing, flip: this.flip, walk: this.walkPhase, moving: this.moving,
      action, actionT, held: e.hand?.id ?? null, armor: e.body?.id ?? null, head: e.head?.id ?? null, back: e.back?.id ?? null,
      shiver: this.shiver, dead: this.mode === 'dead',
    });
    this.playerTex.needsUpdate = true;
    const B = this.playerBatch;
    B.clear();
    B.push({ x: this.px, y: this.py, z: this.pz, frame: this.playerFrame(), flash: this.invuln > 0.4 ? (this.invuln - 0.4) * 1.6 : 0 });
    B.commit();
  }

  /* ======================= HUD / 后期 ======================= */
  updateHudFrame(dt: number) {
    if (this.mode === 'menu') return;
    this.hud.setStats(this.hp, HP_MAX, this.hunger, HUNGER_MAX, this.sanity, SANITY_MAX, this.rates, dt);
    this.hud.setClock(this.day.t / this.day.total, this.day.day, this.day.phase);
    this.hud.tick(dt);
    if (this.mode === 'play' && this.hover && !this.placing && !this.overlay) {
      const info = this.actInfo(this.hover);
      const name = this.targetName(this.hover);
      const verb = info.ok ? `<span class="v">左键 · ${info.label}</span>` : info.reason ? `<span class="v bad">${info.reason}</span>` : info.label ? `<span class="v dim">${info.label}</span>` : '';
      this.hud.setHover(`<b>${name}</b>${verb}`, this.input.mouseX, this.input.mouseY);
    } else this.hud.setHover(null);
    const near = this.nearBench();
    if (near !== this.wasNearBench) { this.wasNearBench = near; this.hud.renderCraft(); if (near) this.hintOnce('bench', '靠近<b>研机台</b>时，可以研制<b>二阶配方</b>（提灯、护甲、止血膏…）。制作过一次后就学会了。', 8); }
    this.craftRefreshT += dt;
    if (this.craftRefreshT > 0.6) { this.craftRefreshT = 0; if (this.hud.openTab) this.hud.renderCraft(); }
    const ph = this.day.phase;
    this.audio.nightLevel = ph === 'night' ? 1 : ph === 'dusk' ? 0.35 : 0;
    this.audio.whisperLevel = clamp((0.6 - this.sanity / SANITY_MAX) / 0.6) + clamp(this.darkT / 3);
    this.audio.update(dt, ph, clamp(this.darkT / 3));
  }
  wasNearBench = false;
  craftRefreshT = 0;

  applyPost(dt: number) {
    const f = this.post.final.uniforms;
    const ins = this.mode === 'menu' ? 0 : clamp((0.6 - this.sanity / SANITY_MAX) / 0.6);
    f.uInsane.value += (ins - f.uInsane.value) * (1 - Math.exp(-dt * 2));
    f.uHurt.value = Math.max(this.hurtT, this.mode === 'play' ? clamp((0.3 - this.hp / HP_MAX) / 0.3) * (0.5 + 0.5 * Math.sin(this.time * 5)) * 0.6 : 0);
    f.uDark.value = clamp(this.darkT / 3.2);
    f.uFlicker.value = Math.max(0, f.uFlicker.value - dt * 2.5);
    if (ins > 0.6 && Math.random() < dt * 0.3) f.uFlicker.value = 0.6;
    f.uExposure.value = 1.0 + this.day.darkness * 0.2;
    if (this.mode !== 'dead') f.uFade.value = Math.max(0, f.uFade.value - dt);
  }

  /* ======================= 放置 ======================= */
  updatePlacing() {
    const p = this.placing!;
    if (!this.input.overUI) this.pick();
    const [gx, gz] = this.groundPt;
    p.x = gx; p.z = gz;
    let ok = this.world.inside(gx, gz, 3) && Math.hypot(gx - this.px, gz - this.pz) < 9;
    if (ok) for (const o of this.grid.query(gx, gz, 1.8, this.q)) if (o.r > 0 || o.kind === 'campfire' || o.kind === 'firepit' || o.kind === 'bench') { ok = false; break; }
    p.ok = ok;
    if (this.input.clicked && !this.input.overUI) {
      if (!ok) { this.hud.toast(null, '这里不能放置'); this.audio.ui(); return; }
      this.place(p.recipe, gx, gz);
    }
    if (this.input.rightClicked) this.cancelPlace();
  }
  cancelPlace() { this.placing = null; this.hud.placeTip.classList.add('hidden'); }
  place(r: Recipe, x: number, z: number) {
    if (!this.inv.canCraft(r)) { this.cancelPlace(); return; }
    this.inv.consume(r);
    if (r.tier === 1) this.learned.add(r.id);
    this.cancelPlace();
    if (r.id === 'campfire') this.addObj('campfire', 'campfire', x, z, 'campfire', { r: 0.55, fuel: 75, maxFuel: 130, shadowR: 0.7, shadowH: 0.5 });
    else if (r.id === 'firepit') this.addObj('firepit', 'firepit', x, z, 'firepit', { r: 0.7, fuel: 110, maxFuel: 230, shadowR: 0.85, shadowH: 0.6 });
    else if (r.id === 'bench') this.addObj('bench', 'bench', x, z, 'bench', { r: 0.8, shadowR: 1.0, shadowH: 1.6 });
    this.statics.commit(); this.shadowsStatic.commit();
    this.faceTo(x, z);
    if (r.id !== 'bench') this.audio.ignite();
    for (let k = 0; k < 16; k++) this.fxNorm.emit({ x: x + (Math.random() - 0.5) * 1.5, y: this.world.height(x, z) + 0.2, z: z + (Math.random() - 0.5) * 1.5, vx: (Math.random() - 0.5) * 2, vy: 0.6, vz: (Math.random() - 0.5) * 2, life: 1.5, size: 0.8, grow: 0.8, color: [0.55, 0.5, 0.42], a: 0.45, type: PT_SMOKE, drag: 2 });
    this.afterCraft(r);
    if (r.id === 'campfire') this.hintOnce('fire', '营火会慢慢烧尽。<b>点击火堆</b>可以添柴；站在火旁<b>右键</b>食物可以烤熟。', 8);
  }

  /* ======================= 覆盖层 ======================= */
  openOverlay(id: string, html: string, w = 840, h = 620): HTMLElement {
    this.closeOverlay();
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = id;
    o.innerHTML = `<div class="sheet">${html}</div>`;
    (o.firstElementChild as HTMLElement).style.backgroundImage = parchment(w, h);
    document.body.appendChild(o);
    o.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (!act) return;
      this.audio.ui();
      if (act === 'close') this.closeOverlay();
      else if (act === 'restart') this.restart();
      else if (act === 'help') this.showHelp();
    });
    this.overlay = o;
    this.hud.setHover(null);
    return o;
  }
  closeOverlay() { if (this.overlay) { this.overlay.remove(); this.overlay = null; } }
  showPause() {
    this.audio.uiOpen();
    this.openOverlay('pause', `<h2>暂停</h2><div class="lead">第 ${this.day.day} 天 · ${({ day: '白昼', dusk: '黄昏', night: '夜' } as const)[this.day.phase]}</div>${helpHtml()}<div class="row"><button class="btn primary" data-act="close">继续</button><button class="btn ghost" data-act="restart">重新开始</button></div>`);
  }
  showHelp() {
    this.audio.uiOpen();
    this.openOverlay('help', `<h2>操作说明</h2><div class="lead">在烬野活下去：别饿死、别发疯、别待在黑暗里</div>${helpHtml()}<div class="row"><button class="btn primary" data-act="close">知道了</button></div>`);
  }
  showMap() {
    this.audio.uiOpen();
    const o = this.openOverlay('map', `<h2>烬野舆图</h2><div class="lead">红点为你所在 · 骷髅为蛛巢</div><canvas></canvas><div class="row"><button class="btn primary" data-act="close">合上</button></div>`, 660, 720);
    const cv = o.querySelector('canvas')!;
    const src = this.world.mapCanvas(256);
    cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, 512, 512);
    const toM = (x: number, z: number) => [((x + HALF) / (HALF * 2)) * 512, ((z + HALF) / (HALF * 2)) * 512];
    for (const d of this.objs) {
      if (d.kind === 'den' && !d.removed) { const [mx, my] = toM(d.x, d.z); g.fillStyle = '#16110d'; g.beginPath(); g.arc(mx, my, 4, 0, 6.28); g.fill(); g.strokeStyle = '#e9dcc0'; g.lineWidth = 1; g.stroke(); }
      if ((d.kind === 'campfire' || d.kind === 'firepit') && !d.removed && d !== this.menuFire) { const [mx, my] = toM(d.x, d.z); g.fillStyle = '#eaa23a'; g.beginPath(); g.arc(mx, my, 3.5, 0, 6.28); g.fill(); }
    }
    const [mx, my] = toM(this.px, this.pz);
    g.fillStyle = '#b3261e'; g.strokeStyle = '#16110d'; g.lineWidth = 2;
    g.beginPath(); g.arc(mx, my, 7, 0, 6.28); g.fill(); g.stroke();
  }

  die(cause: string) {
    if (this.mode !== 'play') return;
    this.mode = 'dead'; this.hp = Math.max(0, this.hp);
    this.deathCause = cause;
    this.action = null; this.target = null; this.deadT = 0;
    this.cancelPlace();
    this.hud.toggleTab(null);
    this.hud.setVMsg(null);
    this.audio.death();
    this.camShake = 0.5;
    const epitaphs = ['火灭了，夜便来了。', '烬野不记得任何人的名字。', '下一次，记得在天黑前生火。', '墨蛛在巢里低语，说你很好吃。', '草会重新长出来，你也会。'];
    const day = this.day.day;
    setTimeout(() => {
      this.openOverlay('death', `<h2>你 死 了</h2><div class="cause">死因：<b>${cause}</b></div><div class="days">在烬野坚持了 ${day} 天 · 砍倒 ${this.stats.chopped} 棵树 · 击杀 ${this.stats.spiders} 只墨蛛 · 制作 ${this.stats.crafted} 件器物</div><div class="epitaph">「${epitaphs[Math.floor(Math.random() * epitaphs.length)]}」</div><div class="row"><button class="btn primary" data-act="restart">再来一次</button></div>`, 580, 420);
    }, 1800);
  }

  hintOnce(key: string, html: string, secs = 7) {
    if (this.hints.has(key) || this.mode !== 'play') return;
    this.hints.add(key);
    this.hud.showHint(html, secs);
  }

  toScreen(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = this.tmpV.set(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) * 0.5 * innerWidth, y: (1 - v.y) * 0.5 * innerHeight };
  }

  /* ======================= 调试接口（截图/测试用） ======================= */
  debugSetTime(phase: Phase, frac: number) { this.day.setPhaseTime(phase, frac); this.lastPhase = phase; }
  debugSpider(n = 1, dist = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      const s = this.makeSpider(null, this.px + Math.cos(a) * dist, this.pz + Math.sin(a) * dist);
      s.tx = s.x; s.tz = s.z; s.aggro = 30; s.state = 'chase';
      this.spiders.push(s);
    }
  }
  debugFire(dx = 1.8, dz = -0.6) {
    const o = this.addObj('campfire', 'campfire', this.px + dx, this.pz + dz, 'campfire', { r: 0.55, fuel: 130, maxFuel: 130, shadowR: 0.7, shadowH: 0.5 });
    this.statics.commit(); this.shadowsStatic.commit();
    return o;
  }
  debugBench(dx = -2.2, dz = -1) {
    this.addObj('bench', 'bench', this.px + dx, this.pz + dz, 'bench', { r: 0.8, shadowR: 1.0, shadowH: 1.6 });
    this.statics.commit(); this.shadowsStatic.commit();
  }
  debugGive(id: string, n = 1) { this.inv.add(id, n); this.hud.renderInventory([id]); }
  debugStats(hp?: number, hunger?: number, sanity?: number) {
    if (hp !== undefined) this.hp = hp;
    if (hunger !== undefined) this.hunger = hunger;
    if (sanity !== undefined) this.sanity = sanity;
  }
  debugTeleport(biome: Biome) {
    for (let r = 30; r < 200; r += 3) for (let a = 0; a < 6.28; a += 0.3) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.world.biomeAt(x, z) === biome && this.world.inside(x, z, 8) && [0, 1.57, 3.14, 4.71].every((b) => this.world.biomeAt(x + Math.cos(b) * 9, z + Math.sin(b) * 9) === biome)) { this.px = x; this.pz = z; this.camX = x; this.camZ = z; return; }
    }
  }
}

function fmt(n: number) { return (n > 0 ? '+' : '') + n; }
function cnNum(n: number): string {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  return String(n);
}
