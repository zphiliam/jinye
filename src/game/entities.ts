// 世界实体与空间网格
import { HALF, WORLD } from '../world/worldgen';

export type ObjKind = 'tree' | 'sapling' | 'grass' | 'bush' | 'flower' | 'carrot' | 'boulder' | 'flint' | 'reeds' | 'mushroom' | 'den' | 'campfire' | 'firepit' | 'bench';

export interface WObj {
  id: number;
  kind: ObjKind;
  sub: string;           // 树种 / 变体名
  x: number; z: number; y: number;
  r: number;             // 碰撞半径
  frame: string;
  inst: number;          // 静态批次索引
  shadow: number;
  shadowR: number; shadowH: number;
  hp: number; maxHp: number;
  picked: boolean; regrow: number;
  removed: boolean;
  fuel: number; maxFuel: number;
  spiders: Spider[]; respawn: number; maxSpiders: number;
  flash: number; shake: number;
  sway: number; phase: number;
  h: number;
  name: string;
}

export type SpiderState = 'home' | 'sleep' | 'wander' | 'chase' | 'windup' | 'lunge' | 'recover' | 'hurt' | 'return' | 'dead';
export interface Spider {
  id: number;
  x: number; z: number; vx: number; vz: number;
  hp: number; maxHp: number;
  state: SpiderState; t: number;
  den: WObj | null;
  face: number;
  tx: number; tz: number;
  flash: number; walk: number;
  lx: number; lz: number;   // 扑击方向
  hit: boolean;
  aggro: number;            // 被激怒的剩余时间
  dead: number;
  alertShown: boolean;
}

export interface Drop {
  id: string; n: number; dur?: number;
  x: number; z: number; y: number;
  vx: number; vz: number; vy: number;
  age: number; bounce: number;
}

export interface Crow {
  x: number; z: number; y: number;
  vx: number; vz: number; vy: number;
  state: 'idle' | 'peck' | 'fly';
  t: number; face: number; gone: boolean;
}

const CS = 4;
const N = Math.ceil(WORLD / CS);

export class Grid {
  cells: WObj[][] = Array.from({ length: N * N }, () => []);
  private key(x: number, z: number) {
    const cx = Math.max(0, Math.min(N - 1, Math.floor((x + HALF) / CS)));
    const cz = Math.max(0, Math.min(N - 1, Math.floor((z + HALF) / CS)));
    return cz * N + cx;
  }
  add(o: WObj) { this.cells[this.key(o.x, o.z)].push(o); }
  remove(o: WObj) {
    const c = this.cells[this.key(o.x, o.z)];
    const i = c.indexOf(o);
    if (i >= 0) c.splice(i, 1);
  }
  query(x: number, z: number, r: number, out: WObj[] = []): WObj[] {
    out.length = 0;
    const x0 = Math.max(0, Math.floor((x - r + HALF) / CS)), x1 = Math.min(N - 1, Math.floor((x + r + HALF) / CS));
    const z0 = Math.max(0, Math.floor((z - r + HALF) / CS)), z1 = Math.min(N - 1, Math.floor((z + r + HALF) / CS));
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.cells[cz * N + cx];
      for (let i = 0; i < c.length; i++) {
        const o = c[i];
        if (!o.removed && (o.x - x) ** 2 + (o.z - z) ** 2 <= r * r) out.push(o);
      }
    }
    return out;
  }
}
