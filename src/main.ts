// 「烬野 · Ember Wilds」入口：加载（程序化生成全部素材）→ 主菜单 → 游戏
import './ui/style.css';
import { titleFilterDefs } from './ui/svg';
import { helpHtml, setIconProvider } from './ui/hud';
import { parchment } from './ui/svg';

const params = new URLSearchParams(location.search);

function favicon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="10" fill="#8e2b1f"/><path d="M32 12c4 10 14 14 12 28-1 9-7 13-12 13s-11-4-12-13c-1-8 4-12 6-18 2 6 6 7 6 7s-2-9 0-17z" fill="#eaa23a" stroke="#16110d" stroke-width="3" stroke-linejoin="round"/><path d="M32 34c3 4 4 8 2 12-1 2-3 3-4 3s-4-2-4-5c0-4 3-6 6-10z" fill="#ebdfc4"/></svg>`;
  const l = document.getElementById('favicon') as HTMLLinkElement | null;
  if (l) l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function boot() {
  favicon();
  if (params.has('gallery')) { const { gallery } = await import('./gallery'); gallery(); return; }
  document.body.insertAdjacentHTML('beforeend', titleFilterDefs());
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.innerHTML = `<div class="t">烬野</div><div class="bar"><i></i></div><div class="lb">研墨中……</div>`;
  document.body.appendChild(loading);
  const bar = loading.querySelector('.bar i') as HTMLElement, lb = loading.querySelector('.lb') as HTMLElement;
  await new Promise((r) => setTimeout(r, 30));
  const { buildAtlas } = await import('./art/atlas');
  const { loadArtPack } = await import('./art/pack');
  // 手绘资源包（public/art/）；?art=proc 可强制使用旧的全程序化素材
  const pack = params.get('art') === 'proc' ? null : await loadArtPack('art/', (p, label) => { bar.style.width = `${Math.round(p * 40)}%`; lb.textContent = `取画：${label}`; });
  const atlas = await buildAtlas((p, label) => { bar.style.width = `${Math.round(40 + p * 45)}%`; lb.textContent = `刻版：${label}`; }, pack);
  if (pack) setIconProvider((id) => atlas.iconURL(id));
  lb.textContent = '开垦烬野……'; bar.style.width = '90%';
  await new Promise((r) => setTimeout(r, 20));
  atlas.finalize();
  const { Game } = await import('./game/game');
  const { hasSave, describeSave } = await import('./game/save');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  document.body.prepend(canvas);
  const seed = params.has('seed') ? Number(params.get('seed')) | 0 : (Math.random() * 1e9) | 0;
  const easy = params.get('easy') === '1';
  const game = new Game(canvas, atlas, { seed, easy });
  (window as unknown as { game: unknown }).game = game;
  bar.style.width = '100%';

  let last = performance.now();
  const loop = (now: number) => {
    const dt = (now - last) / 1000; last = now;
    if (!(window as unknown as { __freeze?: boolean }).__freeze) { try { game.update(dt); } catch (e) { console.error(e); } }
    requestAnimationFrame(loop);
  };

  const save = hasSave();
  const begin = (cont = false) => {
    menu?.classList.add('fade');
    setTimeout(() => menu?.remove(), 1200);
    if (cont && save) game.continueGame(save); else game.start();
  };
  // 关闭/刷新页面时顺手存档（死亡后不会存）
  window.addEventListener('pagehide', () => { if (game.mode === 'play') game.saveGame(); });

  let menu: HTMLElement | null = null;
  if (params.get('continue') === '1' && save) {
    game.continueGame(save);
  } else if (params.get('autostart') === '1') {
    game.mode = 'play';
    game.start();
  } else {
    game.enterMenu();
    menu = document.createElement('div');
    menu.id = 'menu';
    menu.innerHTML = `
      <h1 class="title">烬野<span class="seal">荒原<br>求生</span></h1>
      <div class="sub">EMBER WILDS</div>
      <div class="tag">一片被墨色吞没的荒原。白昼短暂，黄昏如血。<br>采集、制作、生火——别让火熄灭，别在黑暗里久留。</div>
      ${save ? `<button class="btn primary" data-a="continue">继续旅程 <span class="k">Enter</span><small class="save-info">${describeSave(save)}${save.easy ? ' · 宽容' : ''}</small></button>` : ''}
      <button class="btn ${save ? 'ghost' : 'primary'}" data-a="start">${save ? '新的旅程' : '开始游戏 <span class="k">Enter</span>'}</button>
      <button class="btn ghost" data-a="easy">${easy ? '标准模式' : '宽容模式'}</button>
      <button class="btn ghost" data-a="help">操作说明</button>
      <div class="foot">${pack ? '手绘美术资源 · 音效由代码实时合成' : '程序化美术（?art=proc）· 音效由代码实时合成'} · 种子 ${seed}${easy ? ' · 宽容模式' : ''}</div>`;
    document.body.appendChild(menu);
    const showHelp = () => {
      const o = document.createElement('div');
      o.className = 'overlay'; o.id = 'help';
      o.innerHTML = `<div class="sheet"><h2>操作说明</h2><div class="lead">在烬野活下去：别饿死、别发疯、别待在黑暗里</div>${helpHtml()}<div class="row"><button class="btn primary">知道了</button></div></div>`;
      (o.firstElementChild as HTMLElement).style.backgroundImage = parchment(840, 620);
      o.querySelector('button')!.addEventListener('click', () => o.remove());
      document.body.appendChild(o);
    };
    menu.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'continue') begin(true);
      else if (a === 'start') begin();
      else if (a === 'help') showHelp();
      else if (a === 'easy') {
        const u = new URL(location.href);
        if (easy) u.searchParams.delete('easy'); else u.searchParams.set('easy', '1');
        u.searchParams.set('seed', String(seed));
        location.href = u.toString();
      }
    });
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' && game.mode === 'menu' && !document.getElementById('help')) { window.removeEventListener('keydown', onKey); begin(!!save); } };
    window.addEventListener('keydown', onKey);
  }
  requestAnimationFrame((t) => { last = t; loop(t); });
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 1000);
}

boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#eaa23a;padding:20px">启动失败：${String(e)}</pre>`); });
