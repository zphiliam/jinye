// 开发用：代码生成美术 vs 手绘 PNG 对照样张（不参与构建）。?only=tree|fire|hero|walk|parts|props|closeup|icons|creatures|act-gather|act-chop|act-mine 只画一部分
import { loadArtPack, ArtPack } from './art/pack';
import { applyCodeArt } from './art/gen/pack-adapter';
import { HeroRig } from './art/rig';
import { drawFlame } from './art/structures';
import { genPine, PINE_VARIANTS } from './art/gen/assets/pine';
import type { PlayerPose, Action } from './art/player';

const q = new URLSearchParams(location.search);
const only = q.get('only');

function clonePack(p: ArtPack): ArtPack {
  const j = JSON.parse(JSON.stringify({ ...p, images: undefined }));
  return { ...j, images: new Map(p.images) } as ArtPack;
}
type Img = CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
const dims = (i: Img) => [(i as HTMLImageElement).naturalWidth || (i as HTMLCanvasElement).width, (i as HTMLImageElement).naturalHeight || (i as HTMLCanvasElement).height];

(async () => {
  const painted = await loadArtPack('art/');
  if (!painted) { document.body.textContent = '资源包不可用'; return; }
  const code = clonePack(painted);
  const rep = applyCodeArt(code);
  console.log('[codeart] 生成', rep.count, '项，用时', rep.ms.toFixed(0), 'ms', JSON.stringify(rep.perAsset));
  (window as unknown as { __codeArt: unknown }).__codeArt = rep;

  const cv = document.getElementById('c') as HTMLCanvasElement;
  const W = 2400;
  type Section = { title: string; h: number; draw: (g: CanvasRenderingContext2D, y: number) => void };
  const S: Section[] = [];
  const label = (g: CanvasRenderingContext2D, t: string, x: number, y: number, size = 22, col = '#3a2c20') => { g.fillStyle = col; g.font = `${size}px "Noto Sans CJK SC", sans-serif`; g.fillText(t, x, y); };
  /** 按资源包规格（每单位像素）统一缩放，脚底对齐基线 */
  const put = (g: CanvasRenderingContext2D, pack: ArtPack, src: string, x: number, base: number, ppuOut: number, specU: number, kind: 'h' | 'w') => {
    const img = pack.images.get(src)! as unknown as Img, sp = pack.sprites[src];
    const [w, h] = dims(img);
    const ppu = kind === 'h' ? (sp.pivot[1] * h) / specU : w / specU, k = ppuOut / ppu;
    g.drawImage(img, x - sp.pivot[0] * w * k, base - sp.pivot[1] * h * k, w * k, h * k);
  };
  const ground = (g: CanvasRenderingContext2D, y: number, h: number, night = false) => {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    if (night) { gr.addColorStop(0, '#1b1d1c'); gr.addColorStop(1, '#0e0f0f'); } else { gr.addColorStop(0, '#d9cfb8'); gr.addColorStop(1, '#bfb193'); }
    g.fillStyle = gr; g.fillRect(0, y, W, h);
  };

  const trees = ['pine_old', 'pine_dense', 'pine_young', 'pine_windbent'], spec = [7.6, 7.0, 5.4, 6.8];
  if (!only || only === 'tree') S.push({ title: '松树：上 = 手绘 PNG，下 = 代码生成（同尺度）', h: 1260, draw: (g, y) => {
    ground(g, y, 1260);
    const ppu = 70;
    [[painted, '手绘'], [code, '代码']].forEach(([pk, nm], row) => {
      const base = y + 600 + row * 620;
      label(g, nm as string, 20, base - 520);
      trees.forEach((t, i) => put(g, pk as ArtPack, t, 330 + i * 520, base, ppu, spec[i], 'h'));
    });
  } });
  if (!only || only === 'tree') S.push({ title: '代码松树：同一配置，换种子 → 不同个体（云片松 ×3 · 针叶塔 ×3）', h: 640, draw: (g, y) => {
    ground(g, y, 640);
    const cfgs = [PINE_VARIANTS.pine_old, PINE_VARIANTS.pine_old, PINE_VARIANTS.pine_windbent, PINE_VARIANTS.pine_dense, PINE_VARIANTS.pine_dense, PINE_VARIANTS.pine_young];
    cfgs.forEach((c, i) => {
      const o = genPine(c, 1000 + i * 77), k = 0.75 * 70 / ((o.pivot[1] * o.canvas.height) / c.h);
      g.drawImage(o.canvas, 210 + i * 370 - o.pivot[0] * o.canvas.width * k, y + 610 - o.pivot[1] * o.canvas.height * k, o.canvas.width * k, o.canvas.height * k);
    });
  } });

  const fireDraw = (g: CanvasRenderingContext2D, pk: ArtPack, kind: string, x: number, base: number, lit: boolean, burnt: boolean, ppu: number) => {
    const specU = kind === 'campfire' ? 2.1 : 2.5;
    put(g, pk, burnt ? kind + '_burnt' : kind + '_base', x, base, ppu, specU, 'w');
    if (lit) {
      const center = (pk as unknown as { fire: Record<string, { center: number }> }).fire[kind].center;
      const fl = drawFlame(2, 6), sc = 0.8 * ppu / fl.ppu;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.drawImage(fl.canvas, x - fl.canvas.width * sc / 2, base - (center - 0.1) * ppu - (fl.canvas.height - fl.foot * fl.ppu) * sc, fl.canvas.width * sc, fl.canvas.height * sc);
      g.restore();
      put(g, pk, kind + '_base_front', x, base, ppu, specU, 'w');
    }
  };
  if (!only || only === 'fire') S.push({ title: '火堆 / 火塘：左 = 手绘，右 = 代码（未点燃 · 点燃 · 熄灭；下排为夜色背景）', h: 900, draw: (g, y) => {
    ground(g, y, 450); ground(g, y + 450, 450, true);
    const ppu = 130;
    [false, true].forEach((night, row) => {
      const base = y + 360 + row * 450;
      [[painted, 0], [code, 1]].forEach(([pk, col]) => {
        const x0 = 40 + (col as number) * 1200;
        label(g, col ? '代码' : '手绘', x0, base - 300, 22, night ? '#cbb' : '#3a2c20');
        fireDraw(g, pk as ArtPack, 'campfire', x0 + 170, base, false, false, ppu);
        fireDraw(g, pk as ArtPack, 'campfire', x0 + 480, base, true, false, ppu);
        fireDraw(g, pk as ArtPack, 'campfire', x0 + 760, base, false, true, ppu);
        fireDraw(g, pk as ArtPack, 'firepit', x0 + 1020, base, night, false, ppu * 0.8);
      });
    });
  } });

  // 行者
  const base0: PlayerPose = { t: 1, facing: 'side', flip: true, walk: 0, moving: false, action: 'none', actionT: 0, held: null, armor: null, head: null, back: null, shiver: 0, dead: false };
  const rigFrame = (pk: ArtPack, pz: Partial<PlayerPose>, vel: [number, number] = [-1, 0]) => {
    const rig = new HeroRig(pk); rig.setVelocity(vel[0], vel[1], 5);
    const p = { ...base0, ...pz } as PlayerPose;
    for (let k = 0; k < 30; k++) rig.draw({ ...p, t: p.t - (30 - k) / 60 });
    rig.draw(p);
    return rig.canvas;
  };
  const heroRows: { label: string; n: number; pose: (i: number, n: number) => Partial<PlayerPose> }[] = [
    { label: '待机', n: 3, pose: (i) => ({ t: 10 + i * 0.7 }) },
    { label: '行走', n: 8, pose: (i, n) => ({ moving: true, walk: (i / n) * 4.62, t: 5 + i / 20 }) },
    { label: '砍伐', n: 6, pose: (i, n) => ({ action: 'chop' as Action, actionT: i / (n - 1), held: 'axe', t: 3 + i * 0.05 }) },
  ];
  const codeHero = HeroRig.usable(code);
  if ((!only || only === 'hero') && codeHero) S.push({ title: '行者：上 = 手绘部件，下 = 代码部件（同一套骨骼动画：待机 · 行走 · 砍伐 · 正面 · 背面）', h: 1000, draw: (g, y) => {
    ground(g, y, 1000);
    const frames: [Partial<PlayerPose>, [number, number]?][] = [
      [{ t: 10 }],
      ...[0, 2, 4, 6].map((i) => [{ moving: true, walk: (i / 8) * 4.62, t: 5 + i / 20 }] as [Partial<PlayerPose>]),
      ...[0.15, 0.45, 0.8].map((k) => [{ action: 'chop' as Action, actionT: k, held: 'axe', t: 3 }] as [Partial<PlayerPose>]),
      [{ facing: 'down', moving: true, walk: 1.2, t: 5 }, [0, 1]],
      [{ facing: 'up', moving: true, walk: 1.2, t: 5 }, [0, -1]],
    ];
    const sc = 1.05, cw = 236;
    [[painted, '手绘'], [code, '代码']].forEach(([pk, nm], row) => {
      const yy = y + 20 + row * 490;
      label(g, nm as string, 16, yy + 30);
      frames.forEach(([pz, vel], i) => {
        const c = rigFrame(pk as ArtPack, pz, vel);
        g.drawImage(c, 90, 0, 280, 420, 10 + i * cw, yy, 280 * sc, 420 * sc);
      });
    });
  } });
  if ((only === 'walk') && codeHero) S.push({ title: '代码行者：行走一周期 8 帧 · 砍伐 6 帧 · 朝镜头 / 背向镜头行走', h: 1960, draw: (g, y) => {
    ground(g, y, 1960);
    for (let i = 0; i < 8; i++) { const c = rigFrame(code, { facing: 'down', moving: true, walk: (i / 8) * 4.62, t: 5 + i / 20 }, [0, 1]); g.drawImage(c, -60 + i * 300, y + 960, c.width * 1.1, c.height * 1.1); }
    for (let i = 0; i < 8; i++) { const c = rigFrame(code, { facing: 'up', moving: true, walk: (i / 8) * 4.62, t: 5 + i / 20 }, [0, -1]); g.drawImage(c, -60 + i * 300, y + 1440, c.width * 1.1, c.height * 1.1); }
    for (let i = 0; i < 8; i++) { const c = rigFrame(code, { moving: true, walk: (i / 8) * 4.62, t: 5 + i / 20 }); g.drawImage(c, -60 + i * 300, y - 20, c.width * 1.1, c.height * 1.1); }
    for (let i = 0; i < 6; i++) { const c = rigFrame(code, { action: 'chop' as Action, actionT: i / 5, held: 'axe', t: 3 + i * 0.05 }); g.drawImage(c, -60 + i * 400, y + 480, c.width * 1.1, c.height * 1.1); }
  } });

  if (only === 'closeup' && codeHero) S.push({ title: '行者特写（2.4×）：手绘侧面 · 代码侧面 · 代码正面 · 代码行走（围巾分缕飘动）', h: 1180, draw: (g, y) => {
    ground(g, y, 1180);
    g.imageSmoothingQuality = 'high';
    const shots: [ArtPack, Partial<PlayerPose>, [number, number]?][] = [
      [painted, { t: 10 }], [code, { t: 10 }], [code, { facing: 'down', t: 10 }, [0, 1]], [code, { moving: true, walk: 1.7, t: 5.3 }],
    ];
    shots.forEach(([pk, pz, vel], i) => {
      const c = rigFrame(pk, pz, vel), k = 2.4;
      g.drawImage(c, 110, 20, 240, 440, 20 + i * 595, y + 20, 240 * k, 440 * k);
    });
  } });
  if (only === 'parts') S.push({ title: '代码部件（3×）上 · 手绘部件（3×）下', h: 820, draw: (g, y) => {
    ground(g, y, 820);
    const names = ['head', 'hat', 'torso', 'skirt', 'scarf', 'upperN', 'foreN', 'upperF', 'foreF', 'thighN', 'shinN', 'thighF', 'shinF'];
    [code, painted].forEach((pk, row) => {
      let x = 10;
      g.imageSmoothingEnabled = false;
      for (const n of names) { const im = pk.images.get('rig_' + n)! as unknown as Img; const [w, h] = dims(im); g.drawImage(im, x, y + 10 + row * 400, w * 3 * 0.6, h * 3 * 0.6); x += w * 1.8 + 8; }
    });
  } });
  // 道具：每格左 = 手绘、右 = 代码，按资源包规格同尺度
  const PROPS = ['birch_a', 'birch_fork', 'tree_dead', 'tree_swamp', 'stump_pine', 'stump_birch', 'boulder_a', 'boulder_b', 'berrybush', 'berrybush_picked', 'grass_tuft', 'grass_cut', 'twig_bush', 'twig_cut', 'flower_red', 'flower_yellow', 'flower_blue', 'carrot_plant', 'reeds', 'reeds_cut', 'fern', 'mushrooms', 'pebbles', 'stones_moss', 'bones', 'tuft_a', 'tuft_b', 'tuft_swamp', 'flint_ground', 'bench'];
  const specOf = (src: string) => { const k = Object.values(painted.keys).find((kk) => kk.src === src)!; return k.spec as ['h' | 'w', number]; };
  const propRow = (title: string, list: string[], ppu: number, cell: number, rowH: number) => S.push({ title, h: rowH, draw: (g, y) => {
    ground(g, y, rowH);
    list.forEach((src, i) => {
      const [kind, val] = specOf(src), x = 20 + i * cell, base = y + rowH - 40;
      put(g, painted, src, x + cell * 0.27, base, ppu, val, kind);
      put(g, code, src, x + cell * 0.73, base, ppu, val, kind);
      label(g, src, x + 8, y + 22, 16);
    });
  } });
  if (!only || only === 'props') {
    propRow('树木道具（每格：左 手绘 · 右 代码）', PROPS.slice(0, 4), 62, 590, 520);
    propRow('树桩 · 石头 · 灌木', PROPS.slice(4, 10), 84, 395, 300);
    propRow('草 · 树苗 · 花', PROPS.slice(10, 17), 110, 340, 260);
    propRow('胡萝卜 · 芦苇 · 蕨 · 蘑菇 · 石子', PROPS.slice(17, 24), 110, 340, 300);
    propRow('骨头 · 草丛 · 燧石 · 研究台', PROPS.slice(24), 88, 385, 340);
  }
  // 图标：每格左 手绘 · 右 代码（放进 120px 方框）；下方一排按背包实际尺寸（40px）
  const ICONS = Object.keys(painted.sprites).filter((n) => n.startsWith('icon_'));
  const fitPut = (g: CanvasRenderingContext2D, pk: ArtPack, src: string, x: number, y: number, box: number) => {
    const img = pk.images.get(src)! as unknown as Img, [w, h] = dims(img), k = box / Math.max(w, h);
    g.drawImage(img, x + (box - w * k) / 2, y + (box - h * k) / 2, w * k, h * k);
  };
  if (!only || only === 'icons') S.push({ title: '物品图标（每格：左 手绘 · 右 代码；底部两排为背包实际尺寸 40px：上 手绘 · 下 代码）', h: 1180, draw: (g, y) => {
    ground(g, y, 1180);
    ICONS.forEach((src, i) => {
      const x = 20 + (i % 8) * 296, yy = y + 16 + Math.floor(i / 8) * 236;
      g.fillStyle = 'rgba(40,30,20,0.08)'; g.fillRect(x, yy, 280, 210);
      fitPut(g, painted, src, x + 12, yy + 40, 120); fitPut(g, code, src, x + 148, yy + 40, 120);
      label(g, src.replace('icon_', ''), x + 8, yy + 24, 16);
    });
    const sy = y + 980;
    ICONS.forEach((src, i) => {
      const x = 20 + i * 80;
      for (const [row, pk] of [[0, painted], [1, code]] as [number, ArtPack][]) {
        g.fillStyle = '#2a221a'; g.fillRect(x, sy + row * 86, 70, 70); g.strokeStyle = '#7a6448'; g.lineWidth = 2; g.strokeRect(x + 1, sy + row * 86 + 1, 68, 68);
        fitPut(g, pk, src, x + 15, sy + row * 86 + 15, 40);
      }
    });
  } });
  // 生物
  if (!only || only === 'creatures') {
    propRow('蜘蛛巢 · 蜘蛛（待机 · 行走 · 立起 · 扑咬 · 死亡）（每格：左 手绘 · 右 代码）', ['spider_den', 'spider', 'spider_walk'], 120, 790, 460);
    propRow('蜘蛛（续）', ['spider_rear', 'spider_lunge', 'spider_dead'], 120, 790, 400);
    propRow('乌鸦（站 · 啄 · 振翅上 · 振翅下）· 影怪', ['crow_stand', 'crow_peck', 'crow_fly0', 'crow_fly1', 'shade'], 150, 470, 560);
  }
  // 动作逐帧条：按游戏时长以 60fps 连续播放（含关节平滑），等间隔取 N 帧。?only=act-gather|act-chop|act-mine
  if (only?.startsWith('act-') && codeHero) {
    type Row = { nm: string; pz: Partial<PlayerPose>; dur: number; vel?: [number, number] };
    const strip = (pk: ArtPack, r: Row, n: number) => {
      const rig = new HeroRig(pk); rig.setVelocity(...(r.vel ?? [-1, 0]), 0);
      const p0 = { ...base0, ...r.pz, action: 'none' as Action, actionT: 0 } as PlayerPose;
      let t = 2; for (let k = 0; k < 40; k++) { rig.draw({ ...p0, t }); t += 1 / 60; }
      const out: HTMLCanvasElement[] = [];
      const steps = Math.round(r.dur * 240);
      const want = Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * steps));
      for (let s = 0; s <= steps; s++) {
        rig.draw({ ...base0, ...r.pz, t, actionT: s / steps } as PlayerPose); t += 1 / 240;
        if (want.includes(s)) { const c = document.createElement('canvas'); c.width = rig.canvas.width; c.height = rig.canvas.height; c.getContext('2d')!.drawImage(rig.canvas, 0, 0); out.push(c); }
      }
      return out;
    };
    const facings: [string, Partial<PlayerPose>, [number, number]][] = [
      ['朝左', { facing: 'side', flip: true }, [-1, 0]], ['朝右', { facing: 'side', flip: false }, [1, 0]],
      ['朝镜头', { facing: 'down', flip: true }, [0, 1]], ['背向', { facing: 'up', flip: false }, [0, -1]],
    ];
    const rowsFor = (nm: string, a: Action, dur: number, held: string | null, fs = facings) => fs.map(([fn, fz, vel]) => ({ nm: `${nm} · ${fn}`, pz: { ...fz, action: a, held }, dur, vel }) as Row);
    const set: Row[] = only === 'act-gather' ? rowsFor('采集', 'pickup', 0.5, null)
      : only === 'act-chop' ? rowsFor('砍伐', 'chop', 0.52, 'axe')
      : [...rowsFor('开凿', 'mine', 0.6, 'pickaxe', facings.slice(0, 2)), ...rowsFor('斧劈', 'attack', 0.42, 'axe', facings.slice(0, 1)), ...rowsFor('矛刺', 'attack', 0.42, 'spear', facings.slice(0, 1)), ...rowsFor('空手', 'attack', 0.42, null, facings.slice(0, 1))];
    const N = only === 'act-gather' ? 9 : 10, sc = 0.66;
    for (const [pk, pn] of [[painted, '手绘'], [code, '代码']] as [ArtPack, string][]) {
      for (const r of set) {
        S.push({ title: `${pn} · ${r.nm}（${r.dur}s，等分 ${N} 帧；红箭头 = 目标方向）`, h: 250, draw: (g, y) => {
          ground(g, y, 250);
          const fr = strip(pk, r, N);
          fr.forEach((c, i) => {
            const cw = c.width * sc, x = 30 + i * (W - 60) / N;
            g.drawImage(c, x, y + 240 - c.height * sc, cw, c.height * sc);
            g.strokeStyle = 'rgba(60,40,20,0.25)'; g.beginPath(); g.moveTo(x, y + 240 - r_pad(c) ); g.lineTo(x + cw, y + 240 - r_pad(c)); g.stroke();
            const f = r.pz.facing, left = f === 'side' ? r.pz.flip : null;
            g.fillStyle = '#b8321e'; g.beginPath();
            const ax = left === null ? x + cw / 2 : left ? x + 8 : x + cw - 8, ay = y + 236;
            if (left === true) { g.moveTo(ax - 8, ay - 6); g.lineTo(ax + 6, ay - 12); g.lineTo(ax + 6, ay); }
            else if (left === false) { g.moveTo(ax + 8, ay - 6); g.lineTo(ax - 6, ay - 12); g.lineTo(ax - 6, ay); }
            else if (f === 'down') { g.moveTo(ax - 7, ay - 10); g.lineTo(ax + 7, ay - 10); g.lineTo(ax, ay); }
            else { g.moveTo(ax - 7, ay); g.lineTo(ax + 7, ay); g.lineTo(ax, ay - 10); }
            g.fill();
            label(g, `${Math.round(i / (N - 1) * 100)}%`, x + 4, y + 18, 15);
          });
        } });
      }
    }
  }
  function r_pad(c: HTMLCanvasElement) { void c; return 14 * 0.66; }
  cv.width = W; cv.height = S.reduce((a, s) => a + s.h + 40, 0);
  const g = cv.getContext('2d')!;
  g.fillStyle = '#1d1a17'; g.fillRect(0, 0, cv.width, cv.height);
  let y = 0;
  for (const s of S) { label(g, s.title, 20, y + 28, 24, '#e8dcc4'); s.draw(g, y + 40); y += s.h + 40; }
  label(g, `代码资产 ${rep.count} 项 · 生成用时 ${rep.ms.toFixed(0)} ms`, W - 520, 28, 22, '#e8dcc4');
  document.title = 'ready';
})();
