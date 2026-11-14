// 存档：localStorage 单槽。世界由种子重建，只记录与初始生成不同的部分（差量）+ 后来新增的物体
import type { Game } from './game';
import type { ObjKind, WObj } from './entities';
import type { Stack } from './inventory';
import type { Slot } from './items';

const KEY = 'jinye.save.v1';
const VER = 1;

interface ObjDiff { i: number; rm?: 1; pk?: 1; rg?: number; hp?: number; f?: string; r?: number; fu?: number; sp?: number[]; rs?: number }
interface ObjFull { k: ObjKind; s: string; x: number; z: number; f: string; r: number; hp: number; mhp: number; fu: number; mfu: number; sr: number; sh: number; sw: number; pk?: 1; rg?: number }
export interface SaveData {
  v: number; savedAt: number;
  seed: number; easy: boolean; gen: number;
  day: { n: number; t: number };
  p: { x: number; z: number; hp: number; hu: number; sa: number; facing: string; flip: boolean };
  inv: (Stack | null)[]; equip: Record<Slot, Stack | null>;
  learned: string[]; hints: string[]; stats: { chopped: number; spiders: number; crafted: number };
  diffs: ObjDiff[]; extra: ObjFull[]; decor: [string, number, number][];
  drops: { id: string; n: number; dur?: number; x: number; z: number }[];
  respawn: { kind: string; x: number; z: number; t: number; frame: string }[];
  spiders: { x: number; z: number; hp: number }[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function hasSave(): SaveData | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const d = JSON.parse(s) as SaveData;
    return d && d.v === VER ? d : null;
  } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* 隐私模式 */ } }

export function writeSave(g: Game): boolean {
  const diffs: ObjDiff[] = [], extra: ObjFull[] = [];
  g.objs.forEach((o, i) => {
    if (o === g.menuFire) return;
    if (i < g.genCount) {
      const gi = g.genInfo[i];
      const d: ObjDiff = { i };
      let ch = false;
      if (o.removed) { d.rm = 1; diffs.push(d); return; }
      if (o.picked) { d.pk = 1; ch = true; }
      if (o.regrow > 0) { d.rg = r2(o.regrow); ch = true; }
      if (o.hp !== gi.hp) { d.hp = o.hp; ch = true; }
      if (o.frame !== gi.frame) { d.f = o.frame; ch = true; }
      if (o.r !== gi.r) { d.r = o.r; ch = true; }
      if (o.kind === 'den') {
        const sp = o.spiders.map((s) => (s.state === 'dead' ? 0 : 1));
        if (sp.some((x) => !x) || o.spiders.length !== o.maxSpiders || o.respawn > 0) { d.sp = sp; d.rs = r2(o.respawn); ch = true; }
      }
      if (ch) diffs.push(d);
      return;
    }
    if (o.removed) return;
    extra.push({ k: o.kind, s: o.sub, x: r2(o.x), z: r2(o.z), f: o.frame, r: o.r, hp: o.hp, mhp: o.maxHp, fu: r2(o.fuel), mfu: o.maxFuel, sr: o.shadowR, sh: o.shadowH, sw: o.sway, ...(o.picked ? { pk: 1 as const } : {}), ...(o.regrow > 0 ? { rg: r2(o.regrow) } : {}) });
  });
  const data: SaveData = {
    v: VER, savedAt: Date.now(), seed: g.seed, easy: g.easy, gen: g.genCount,
    day: { n: g.day.day, t: r2(g.day.t) },
    p: { x: r2(g.px), z: r2(g.pz), hp: r2(g.hp), hu: r2(g.hunger), sa: r2(g.sanity), facing: g.facing, flip: g.flip },
    inv: g.inv.slots.map((s) => (s ? { ...s } : null)), equip: { ...g.inv.equip },
    learned: [...g.learned], hints: [...g.hints], stats: { ...g.stats },
    diffs, extra, decor: g.decorLog.slice(),
    drops: g.drops.map((d) => ({ id: d.id, n: d.n, ...(d.dur !== undefined ? { dur: d.dur } : {}), x: r2(d.x), z: r2(d.z) })),
    respawn: g.respawnQueue.map((q) => ({ ...q })),
    spiders: g.spiders.filter((s) => s.state !== 'dead').map((s) => ({ x: r2(s.x), z: r2(s.z), hp: s.hp })),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

/** 在已按 data.seed 重建的世界上套用存档 */
export function applySave(g: Game, d: SaveData) {
  if (g.genCount !== d.gen) console.warn('[save] 生成物数量不一致', g.genCount, d.gen);
  for (const df of d.diffs) {
    const o: WObj | undefined = g.objs[df.i];
    if (!o) continue;
    if (df.rm) { g.removeObj(o); continue; }
    if (df.pk) o.picked = true;
    if (df.rg !== undefined) o.regrow = df.rg;
    if (df.hp !== undefined) o.hp = df.hp;
    if (df.r !== undefined) o.r = df.r;
    if (df.f) {
      g.setObjFrame(o, df.f);
      if (o.kind === 'tree' && o.picked && o.shadow >= 0) g.shadowsStatic.set(o.shadow, o.x, o.z, 0.5, 0.5, 1);
    }
    if (df.sp && o.kind === 'den') {
      df.sp.forEach((alive, k) => { const s = o.spiders[k]; if (s && !alive) { s.state = 'dead'; s.dead = 99; } });
      o.respawn = df.rs ?? 0;
    }
  }
  for (const e of d.extra) {
    const o = g.addObj(e.k, e.s, e.x, e.z, e.f, { r: e.r, hp: e.hp, maxHp: e.mhp, fuel: e.fu, maxFuel: e.mfu, shadowR: e.sr, shadowH: e.sh, sway: e.sw, picked: !!e.pk, regrow: e.rg ?? 0 });
    if (o.kind === 'tree' && o.picked && o.shadow >= 0) g.shadowsStatic.set(o.shadow, o.x, o.z, 0.5, 0.5, 1);
  }
  for (const [f, x, z] of d.decor) g.decor(f, x, z);
  g.statics.commit(); g.shadowsStatic.commit();
  for (const dr of d.drops) g.drops.push({ id: dr.id, n: dr.n, dur: dr.dur, x: dr.x, z: dr.z, y: g.world.height(dr.x, dr.z), vx: 0, vz: 0, vy: 0, age: 1, bounce: 3 });
  g.respawnQueue = d.respawn.map((q) => ({ ...q }));
  for (const s of d.spiders) { const sp = g.makeSpider(null, s.x, s.z); sp.hp = s.hp; g.spiders.push(sp); }
  g.px = d.p.x; g.pz = d.p.z; g.py = g.world.height(g.px, g.pz);
  g.camX = g.px; g.camZ = g.pz;
  g.hp = d.p.hp; g.hunger = d.p.hu; g.sanity = d.p.sa;
  g.facing = (d.p.facing as typeof g.facing) ?? 'down'; g.flip = !!d.p.flip;
  for (let i = 0; i < g.inv.slots.length; i++) g.inv.slots[i] = d.inv[i] ? { ...d.inv[i]! } : null;
  for (const k of Object.keys(g.inv.equip) as Slot[]) g.inv.equip[k] = d.equip[k] ? { ...d.equip[k]! } : null;
  g.learned = new Set(d.learned); g.hints = new Set(d.hints);
  g.stats = { ...d.stats };
  g.day.day = d.day.n; g.day.t = d.day.t;
}

export function describeSave(d: SaveData): string {
  const dt = new Date(d.savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `第 ${d.day.n} 天 · ${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
