// 开发用：把行者骨骼动画的各阶段画成联系表（不参与构建）
import { loadArtPack } from './art/pack';
import { HeroRig } from './art/rig';
import type { PlayerPose, Action } from './art/player';

const q = new URLSearchParams(location.search);
const scale = Number(q.get('s') ?? 0.8);
for (const h of (q.get('hide') ?? '').split(',').filter(Boolean)) HeroRig.hide.add(h);
(async () => {
  const pack = await loadArtPack('art/');
  if (!pack || !HeroRig.usable(pack)) { document.body.textContent = 'rig 不可用'; return; }
  const rows: { label: string; n: number; pose: (i: number, n: number) => Partial<PlayerPose>; vel?: [number, number] }[] = [
    { label: '待机（2.4 秒内采样）', n: 8, pose: (i) => ({ t: 10 + i * 0.3 }) },
    { label: '行走（一个周期）', n: 10, pose: (i, n) => ({ moving: true, walk: (i / n) * 2.2 * 2.1, t: 5 + i / 20 }) },
    { label: '行走 持斧', n: 10, pose: (i, n) => ({ moving: true, walk: (i / n) * 2.2 * 2.1, t: 5 + i / 20, held: 'axe' }) },
    { label: '行走 火把', n: 10, pose: (i, n) => ({ moving: true, walk: (i / n) * 2.2 * 2.1, t: 5 + i / 20, held: 'torch' }) },
    { label: '砍伐', n: 10, pose: (i, n) => ({ action: 'chop' as Action, actionT: i / (n - 1), held: 'axe', t: 3 + i * 0.05 }) },
    { label: '长矛攻击', n: 10, pose: (i, n) => ({ action: 'attack' as Action, actionT: i / (n - 1), held: 'spear', t: 3 + i * 0.04 }) },
    { label: '斧攻击 / 空手 / 拾取', n: 10, pose: (i, n) => i < 5 ? ({ action: 'attack' as Action, actionT: i / 4, held: 'axe' }) : i < 8 ? ({ action: 'attack' as Action, actionT: (i - 5) / 2 * 0.46, held: null }) : ({ action: 'pickup' as Action, actionT: 0.5 }) },
    { label: '朝镜头走（下） / 远离（上）', n: 10, vel: [0, 1], pose: (i, n) => ({ moving: true, walk: ((i % 5) / 5) * 2.2 * 2.1, t: 5 + i / 20 }) },
  ];
  const cw = 460 * scale, ch = 420 * scale;
  const cv = document.getElementById('c') as HTMLCanvasElement;
  cv.width = cw * 10; cv.height = rows.length * (ch + 18);
  const g = cv.getContext('2d')!;
  g.fillStyle = '#e9dfca'; g.fillRect(0, 0, cv.width, cv.height);
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const rig = new HeroRig(pack);
      if (row.vel) rig.setVelocity(row.vel[0], i < 5 ? row.vel[1] : -row.vel[1], 5);
      else rig.setVelocity(-1, 0, 5);
      const base: PlayerPose = { t: 1, facing: 'side', flip: true, walk: 0, moving: false, action: 'none', actionT: 0, held: null, armor: null, head: null, back: null, shiver: 0, dead: false };
      const pz = { ...base, ...row.pose(i, row.n) } as PlayerPose;
      // 预热平滑：同一姿态画若干帧
      for (let k = 0; k < 30; k++) rig.draw({ ...pz, t: pz.t - (30 - k) / 60, walk: pz.walk });
      rig.draw(pz);
      const x = i * cw, y = ri * (ch + 18) + 18;
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(x, y + ch - rig.pad * scale); g.lineTo(x + cw, y + ch - rig.pad * scale); g.stroke();
      g.drawImage(rig.canvas, x, y, cw, ch);
    }
    g.fillStyle = '#5a1a10'; g.font = '14px sans-serif'; g.fillText(row.label, 6, ri * (ch + 18) + 14);
  });
  document.title = 'ready';
})();
