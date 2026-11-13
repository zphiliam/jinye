import * as P from './art/props';
import * as S from './art/structures';
import * as CR from './art/creatures';
import { itemSprite, ICON_IDS } from './art/items';
import { PlayerArt } from './art/player';
import type { Sprite } from './art/sprite';

export function gallery() {
  document.body.style.cssText = 'margin:0;background:#cdbb94;display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;padding:8px';
  const add = (s: Sprite | HTMLCanvasElement, label: string, scale = 1) => {
    const c = 'canvas' in s ? s.canvas : s;
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;font:11px sans-serif;color:#222';
    c.style.width = c.width * scale + 'px';
    d.appendChild(c); d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(label));
    document.body.appendChild(d);
  };
  const g = new URLSearchParams(location.search).get('gallery');
  if (g === '1') {
    add(P.drawPine(1), 'pine'); add(P.drawPine(2), 'pine2'); add(P.drawBirch(3), 'birch'); add(P.drawBirch(4), 'birch2'); add(P.drawDeadTree(5), 'dead');
    add(P.drawStump(1, 'pine'), 'stump'); add(P.drawBoulder(1), 'boulder'); add(P.drawBoulder(2), 'boulder2');
    add(P.drawBerryBush(1, true), 'bush'); add(P.drawBerryBush(1, false), 'bush0'); add(P.drawGrassTuft(1, false), 'grass'); add(P.drawGrassTuft(1, true), 'grass0');
    add(P.drawSapling(1, false), 'sapling'); add(P.drawSapling(1, true), 'sap0'); add(P.drawFlower(1, 0), 'fl'); add(P.drawFlower(2, 1), 'fl'); add(P.drawFlower(3, 2), 'fl');
    add(P.drawCarrotPlant(1), 'carrot'); add(P.drawReeds(1, false), 'reeds'); add(P.drawFern(1), 'fern'); add(P.drawMushrooms(1), 'mush'); add(P.drawPebbles(1), 'peb'); add(P.drawBones(1), 'bones'); add(P.drawTuft(1, false), 'tuft'); add(P.drawFlintGround(1), 'flint');
  } else if (g === '2') {
    add(S.drawCampfire(1, false, false), 'fire'); add(S.drawCampfire(1, true, false), 'pit'); add(S.drawCampfire(1, false, true), 'burnt');
    for (let i = 0; i < 3; i++) add(S.drawFlame(i, 6), 'flame');
    add(S.drawBench(1), 'bench'); add(S.drawDen(1, false), 'den'); add(S.drawDen(2, true), 'den2');
    for (const p of ['walk0', 'walk1', 'walk2', 'windup', 'bite', 'dead', 'sleep'] as CR.SpiderPose[]) add(CR.drawSpider(p), p);
    add(CR.drawSpider('walk0', true), 'warrior');
    for (const p of ['stand', 'peck', 'fly0', 'fly1'] as CR.CrowPose[]) add(CR.drawCrow(p), p);
    add(CR.drawEyes(1), 'eyes');
  } else if (g === '3') {
    for (const id of ICON_IDS) add(itemSprite(id), id);
  } else {
    const poses: [string, Partial<import('./art/player').PlayerPose>][] = [
      ['down', {}], ['walk', { moving: true, walk: 1.2 }], ['side', { facing: 'side' }], ['sidewalk', { facing: 'side', moving: true, walk: 1.5, held: 'axe' }],
      ['up', { facing: 'up', back: 'backpack' }], ['chop', { facing: 'side', action: 'chop', actionT: 0.4, held: 'axe' }], ['chop2', { facing: 'side', action: 'chop', actionT: 0.7, held: 'axe' }],
      ['torch', { held: 'torch' }], ['shiver', { shiver: 1 }], ['eat', { action: 'eat', actionT: 0.5 }], ['armor', { armor: 'armor_wood', head: 'garland', held: 'spear' }], ['dead', { dead: true }],
    ];
    for (const [n, o] of poses) {
      const pa = new PlayerArt();
      pa.draw({ t: 1, facing: 'down', flip: false, walk: 0, moving: false, action: 'none', actionT: 0, held: null, armor: null, head: null, back: null, shiver: 0, dead: false, ...o });
      add(pa.canvas, n, 0.8);
    }
  }
}
