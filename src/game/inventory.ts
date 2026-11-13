import { ITEMS, Slot, Recipe } from './items';

export interface Stack { id: string; n: number; dur?: number }

export const BASE_SLOTS = 12;
export const PACK_SLOTS = 8;

export class Inventory {
  slots: (Stack | null)[] = Array(BASE_SLOTS + PACK_SLOTS).fill(null);
  equip: Record<Slot, Stack | null> = { hand: null, body: null, head: null, back: null };
  onChange: () => void = () => {};

  get capacity() { return BASE_SLOTS + (this.equip.back ? PACK_SLOTS : 0); }

  make(id: string, n = 1): Stack {
    const d = ITEMS[id];
    return d.dur ? { id, n, dur: d.dur } : { id, n };
  }

  /** 返回未能放入的数量 */
  add(id: string, n: number, dur?: number): number {
    const def = ITEMS[id];
    let left = n;
    if (def.stack > 1) {
      for (let i = 0; i < this.capacity && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.n < def.stack) {
          const k = Math.min(def.stack - s.n, left);
          s.n += k; left -= k;
        }
      }
    }
    for (let i = 0; i < this.capacity && left > 0; i++) {
      if (!this.slots[i]) {
        const k = Math.min(def.stack, left);
        this.slots[i] = { id, n: k, ...(def.dur ? { dur: dur ?? def.dur } : {}) };
        left -= k;
      }
    }
    this.onChange();
    return left;
  }

  count(id: string): number {
    let c = 0;
    for (let i = 0; i < this.capacity; i++) { const s = this.slots[i]; if (s && s.id === id) c += s.n; }
    return c;
  }

  remove(id: string, n: number): boolean {
    if (this.count(id) < n) return false;
    let left = n;
    for (let i = this.capacity - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const k = Math.min(s.n, left);
        s.n -= k; left -= k;
        if (s.n <= 0) this.slots[i] = null;
      }
    }
    this.onChange();
    return true;
  }

  takeOne(i: number): Stack | null {
    const s = this.slots[i];
    if (!s) return null;
    s.n--;
    const one: Stack = { id: s.id, n: 1, ...(s.dur !== undefined ? { dur: s.dur } : {}) };
    if (s.n <= 0) this.slots[i] = null;
    this.onChange();
    return one;
  }

  canCraft(r: Recipe): boolean {
    return r.cost.every(([id, n]) => this.count(id) + (this.equip.hand?.id === id ? 1 : 0) >= n);
  }

  consume(r: Recipe) {
    for (const [id, n] of r.cost) {
      let need = n;
      const have = this.count(id);
      if (have < need && this.equip.hand?.id === id) { this.equip.hand = null; need--; }
      if (need > 0) this.remove(id, need);
    }
    this.onChange();
  }

  hasFree(): boolean {
    for (let i = 0; i < this.capacity; i++) if (!this.slots[i]) return true;
    return false;
  }

  /** 卸下背囊时，把背包格里的东西挤回主格或返回溢出 */
  overflow(): Stack[] {
    const out: Stack[] = [];
    if (this.equip.back) return out;
    for (let i = BASE_SLOTS; i < BASE_SLOTS + PACK_SLOTS; i++) {
      const s = this.slots[i];
      if (s) { this.slots[i] = null; const left = this.add(s.id, s.n, s.dur); if (left) out.push({ ...s, n: left }); }
    }
    return out;
  }
}
