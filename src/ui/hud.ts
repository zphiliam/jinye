// 界面：手作 SVG 仪表、卷轴物品栏、制作面板、提示、飘字、覆盖层
import './style.css';
import { ITEMS, RECIPES, TABS, Tab, Recipe, Slot } from '../game/items';
import { Inventory, BASE_SLOTS, PACK_SLOTS } from '../game/inventory';
import { itemSprite } from '../art/items';
import { slotBg, scrollBg, parchment, meterSvg, clockSvg, medallion, titleFilterDefs, brushStroke } from './svg';

const iconCache = new Map<string, string>();
let iconProvider: ((id: string) => string | null) | null = null;
/** 设置物品图标来源（手绘资源包的图集区域）；取不到时退回程序化图标 */
export function setIconProvider(fn: (id: string) => string | null) { iconProvider = fn; iconCache.clear(); }
export function icon(id: string): string {
  let u = iconCache.get(id);
  if (!u) { u = iconProvider?.(id) ?? itemSprite(id).canvas.toDataURL(); iconCache.set(id, u); }
  return u;
}

export interface HudHost {
  inv: Inventory;
  useSlot(i: number): void;
  secondarySlot(i: number): void;
  dropSlot(i: number): void;
  swapSlots(a: number, b: number): void;
  unequip(s: Slot): void;
  craft(id: string): void;
  recipeState(r: Recipe): { can: boolean; locked: boolean; learned: boolean };
  slotHelp(i: number): string;
  nearBench(): boolean;
  activeSlot(): number;
  sfxUi(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Hud {
  root: HTMLElement;
  private meters: Record<string, { el: HTMLElement; liquid: SVGGElement; num: SVGTextElement; arrow: HTMLElement; last: number }> = {};
  private clockHand!: SVGGElement; private dayNum!: SVGTextElement; private phaseEl!: HTMLElement;
  private slotEls: HTMLElement[] = [];
  private equipEls: Record<Slot, HTMLElement> = {} as Record<Slot, HTMLElement>;
  private packWrap!: HTMLElement; private packSep!: HTMLElement;
  private tabEls: Record<string, HTMLElement> = {};
  private panel!: HTMLElement;
  openTab: Tab | null = null;
  private tooltip!: HTMLElement;
  private hover!: HTMLElement;
  private hint!: HTMLElement; private hintTimer = 0;
  private toasts!: HTMLElement;
  private floaters!: HTMLElement;
  private banner!: HTMLElement;
  private vmsg!: HTMLElement;
  private fps!: HTMLElement;
  placeTip!: HTMLElement;
  private drag: { from: number; moved: boolean; x: number; y: number } | null = null;
  private lastInvKey = '';
  private wavePhase = 0;

  constructor(private host: HudHost) {
    document.body.insertAdjacentHTML('beforeend', titleFilterDefs());
    document.documentElement.style.setProperty('--brush-red', brushStroke('#8e2b1f'));
    document.documentElement.style.setProperty('--brush-dark', brushStroke('#2a2119'));
    this.root = el('div'); this.root.id = 'ui';
    document.body.appendChild(this.root);
    this.buildStats();
    this.buildHotbar();
    this.buildCraft();
    this.tooltip = el('div', 'hidden'); this.tooltip.id = 'tooltip'; this.tooltip.style.backgroundImage = parchment(280, 160);
    this.hover = el('div'); this.hover.id = 'hover';
    this.hint = el('div'); this.hint.id = 'hint'; this.hint.style.backgroundImage = parchment(680, 90);
    this.toasts = el('div'); this.toasts.id = 'toasts';
    this.floaters = el('div'); this.floaters.id = 'floaters';
    this.banner = el('div'); this.banner.id = 'banner';
    this.vmsg = el('div'); this.vmsg.id = 'vignette-msg';
    this.fps = el('div'); this.fps.id = 'fps';
    this.placeTip = el('div', 'hidden'); this.placeTip.id = 'place-tip';
    this.root.append(this.floaters, this.hover, this.hint, this.toasts, this.banner, this.vmsg, this.fps, this.placeTip, this.tooltip);
    window.addEventListener('mouseup', (e) => this.endDrag(e));
    window.addEventListener('mousemove', (e) => {
      if (!this.tooltip.classList.contains('hidden')) this.placeTooltip(e.clientX, e.clientY);
      if (this.drag && (Math.abs(e.clientX - this.drag.x) + Math.abs(e.clientY - this.drag.y) > 6)) {
        this.drag.moved = true;
        this.slotEls[this.drag.from]?.classList.add('dragging');
      }
    });
  }

  setVisible(v: boolean) { this.root.style.display = v ? '' : 'none'; }

  /* ---------- 仪表 ---------- */
  private buildStats() {
    const wrap = el('div'); wrap.id = 'stats';
    const clock = el('div'); clock.id = 'clock';
    clock.innerHTML = clockSvg(0.5, 0.1875);
    this.clockHand = clock.querySelector('.hand') as SVGGElement;
    this.dayNum = clock.querySelector('.day-num') as SVGTextElement;
    this.phaseEl = el('div'); this.phaseEl.id = 'phase';
    wrap.append(clock, this.phaseEl);
    const defs: [string, string, string, string, string][] = [
      ['health', '#bd4a30', '#561611', '命', '生命'], ['hunger', '#cfa95e', '#6e5223', '食', '饱腹'], ['sanity', '#86ab95', '#26413a', '神', '理智'],
    ];
    for (const [id, c, d, g, nm] of defs) {
      const m = el('div', 'meter pe'); m.id = 'm-' + id;
      m.innerHTML = meterSvg('mt' + id, c, d, g);
      const arrow = el('div', 'arrow', '▼'); m.appendChild(arrow);
      m.addEventListener('mouseenter', (e) => this.showTip(`<b>${nm}</b><div class="stat">${id === 'health' ? '归零即死亡。进食熟食与止血膏可恢复。' : id === 'hunger' ? '时刻在消耗。饿到见底会持续掉血。' : '黑夜、黑暗与怪物会侵蚀心神；火光、花与熟食能安抚。'}</div>`, e.clientX, e.clientY));
      m.addEventListener('mouseleave', () => this.hideTip());
      wrap.appendChild(m);
      this.meters[id] = { el: m, liquid: m.querySelector('.liquid') as SVGGElement, num: m.querySelector('.num') as SVGTextElement, arrow, last: -1 };
    }
    this.root.appendChild(wrap);
  }

  setStats(hp: number, hpMax: number, hu: number, huMax: number, sa: number, saMax: number, rates: { hp: number; hu: number; sa: number }, dt: number) {
    this.wavePhase += dt * 30;
    const upd = (id: string, v: number, max: number, rate: number) => {
      const m = this.meters[id];
      const f = Math.max(0, Math.min(1, v / max));
      const y = 84 - f * 68;
      m.liquid.setAttribute('transform', `translate(${(-(this.wavePhase % 30)).toFixed(1)} ${y.toFixed(1)})`);
      const iv = Math.ceil(v);
      if (iv !== m.last) {
        if (m.last >= 0) {
          const diff = iv - m.last;
          if (Math.abs(diff) >= 3) { m.el.classList.remove('bump', 'drop'); void m.el.offsetWidth; m.el.classList.add(diff > 0 ? 'bump' : 'drop'); }
        }
        m.num.textContent = `${iv}/${max}`;
        m.last = iv;
      }
      m.el.classList.toggle('low', f < 0.25);
      const on = Math.abs(rate) > (id === 'hunger' ? 0.5 : 0.05);
      m.arrow.classList.toggle('on', on && id !== 'hunger' || (id === 'hunger' && false));
      m.arrow.textContent = rate > 0 ? '▲' : '▼';
      m.arrow.classList.toggle('up', rate > 0);
    };
    upd('health', hp, hpMax, rates.hp);
    upd('hunger', hu, huMax, rates.hu);
    upd('sanity', sa, saMax, rates.sa);
  }

  setClock(frac: number, day: number, phase: string) {
    this.clockHand.setAttribute('transform', `rotate(${(frac * 360).toFixed(2)} 60 60)`);
    this.dayNum.textContent = String(day);
    const name = phase === 'day' ? '白 昼' : phase === 'dusk' ? '黄 昏' : '长 夜';
    if (this.phaseEl.textContent !== name) { this.phaseEl.textContent = name; this.phaseEl.className = phase; }
  }
  rebuildClock(dayF: number, duskF: number) {
    const c = document.getElementById('clock')!;
    c.innerHTML = clockSvg(dayF, duskF);
    this.clockHand = c.querySelector('.hand') as SVGGElement;
    this.dayNum = c.querySelector('.day-num') as SVGTextElement;
  }

  /* ---------- 物品栏 ---------- */
  private buildHotbar() {
    const bar = el('div', 'pe'); bar.id = 'hotbar';
    const main = el('div', 'slots');
    const keyName = (i: number) => (i < 9 ? String(i + 1) : i === 9 ? '0' : i === 10 ? '-' : '=');
    const mkSlot = (i: number, variant: 'normal' | 'pack') => {
      const s = el('div', 'slot');
      s.style.backgroundImage = slotBg(variant);
      if (i < 12) s.appendChild(el('span', 'key', keyName(i)));
      s.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.button === 0) this.drag = { from: i, moved: false, x: e.clientX, y: e.clientY };
      });
      s.addEventListener('contextmenu', (e) => { e.preventDefault(); this.host.secondarySlot(i); });
      s.addEventListener('mouseenter', (e) => {
        if (this.drag) s.classList.add('drop-target');
        const st = this.host.inv.slots[i];
        if (st) this.showTip(this.host.slotHelp(i), e.clientX, e.clientY);
      });
      s.addEventListener('mouseleave', () => { s.classList.remove('drop-target'); this.hideTip(); });
      s.dataset.idx = String(i);
      this.slotEls[i] = s;
      return s;
    };
    for (let i = 0; i < BASE_SLOTS; i++) main.appendChild(mkSlot(i, 'normal'));
    this.packSep = el('div', 'sep hidden');
    this.packWrap = el('div', 'slots hidden');
    for (let i = 0; i < PACK_SLOTS; i++) this.packWrap.appendChild(mkSlot(BASE_SLOTS + i, 'pack'));
    const eq = el('div', 'slots');
    const eqDefs: [Slot, string][] = [['hand', '手'], ['body', '身'], ['head', '首'], ['back', '背']];
    for (const [sl, label] of eqDefs) {
      const s = el('div', 'slot');
      s.style.backgroundImage = slotBg('equip');
      s.appendChild(el('span', 'lbl', label));
      s.addEventListener('mousedown', (e) => { e.preventDefault(); if (e.button === 0 || e.button === 2) this.host.unequip(sl); });
      s.addEventListener('contextmenu', (e) => e.preventDefault());
      s.addEventListener('mouseenter', (e) => {
        const st = this.host.inv.equip[sl];
        if (st) this.showTip(`<b>${ITEMS[st.id].name}</b><div>${ITEMS[st.id].desc}</div><div class="act">点击：卸下</div>`, e.clientX, e.clientY);
      });
      s.addEventListener('mouseleave', () => this.hideTip());
      this.equipEls[sl] = s;
      eq.appendChild(s);
    }
    const sep2 = el('div', 'sep');
    bar.append(main, this.packSep, this.packWrap, sep2, eq);
    this.root.appendChild(bar);
    const resize = () => { bar.style.backgroundImage = scrollBg(bar.offsetWidth || 1000, bar.offsetHeight || 86); };
    requestAnimationFrame(resize);
    this.resizeBar = resize;
  }
  private resizeBar: () => void = () => {};

  private endDrag(e: MouseEvent) {
    const d = this.drag; this.drag = null;
    this.slotEls.forEach((s) => s.classList.remove('dragging', 'drop-target'));
    if (!d) return;
    if (!d.moved) {
      if (e.shiftKey) this.host.dropSlot(d.from); else this.host.useSlot(d.from);
      return;
    }
    const t = (e.target as HTMLElement)?.closest?.('.slot') as HTMLElement | null;
    if (t && t.dataset.idx !== undefined) this.host.swapSlots(d.from, Number(t.dataset.idx));
    else if (!(e.target as HTMLElement)?.closest?.('#hotbar')) this.host.dropSlot(d.from);
  }

  renderInventory(popIds: string[] = []) {
    const inv = this.host.inv;
    const hasPack = !!inv.equip.back;
    this.packWrap.classList.toggle('hidden', !hasPack);
    this.packSep.classList.toggle('hidden', !hasPack);
    const fill = (s: HTMLElement, st: { id: string; n: number; dur?: number } | null, keep = 2) => {
      while (s.children.length > keep) s.removeChild(s.lastChild!);
      if (!st) return;
      const img = el('img'); img.src = icon(st.id); s.appendChild(img);
      if (st.n > 1) s.appendChild(el('span', 'n', String(st.n)));
      const def = ITEMS[st.id];
      if (def.dur && st.dur !== undefined) {
        const f = st.dur / def.dur;
        const b = el('div', 'dur'); const i = el('i', f < 0.25 ? 'low' : ''); i.style.width = `${Math.max(0, f * 100)}%`; b.appendChild(i); s.appendChild(b);
      }
      if (popIds.includes(st.id)) { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }
    };
    const act = this.host.activeSlot();
    for (let i = 0; i < BASE_SLOTS + PACK_SLOTS; i++) {
      const s = this.slotEls[i];
      const keep = i < 12 ? 1 : 0;
      while (s.children.length > keep) s.removeChild(s.lastChild!);
      fill(s, inv.slots[i], keep);
      s.classList.toggle('active', i === act);
    }
    for (const sl of ['hand', 'body', 'head', 'back'] as Slot[]) {
      const s = this.equipEls[sl];
      while (s.children.length > 1) s.removeChild(s.lastChild!);
      (s.firstChild as HTMLElement).style.display = inv.equip[sl] ? 'none' : '';
      fill(s, inv.equip[sl], 1);
    }
    requestAnimationFrame(this.resizeBar);
    this.renderCraft();
  }

  /** 每帧轻量刷新耐久条 */
  refreshDurability() {
    const inv = this.host.inv;
    const key = JSON.stringify([inv.equip.hand?.dur, inv.equip.head?.dur, inv.equip.body?.dur].map((v) => (v === undefined ? -1 : Math.ceil(v))));
    if (key !== this.lastInvKey) { this.lastInvKey = key; this.renderInventory(); }
  }

  /* ---------- 制作 ---------- */
  private buildCraft() {
    const tabs = el('div', 'pe'); tabs.id = 'craft-tabs';
    for (const t of TABS) {
      const b = el('div', 'ctab');
      b.style.backgroundImage = medallion();
      const img = el('img'); img.src = icon(t.icon); b.appendChild(img);
      b.appendChild(el('span', 'tip', t.name));
      b.addEventListener('mousedown', (e) => { e.preventDefault(); this.toggleTab(t.id); });
      tabs.appendChild(b);
      this.tabEls[t.id] = b;
    }
    this.panel = el('div', 'pe closed'); this.panel.id = 'craft-panel';
    this.panel.style.backgroundImage = parchment(372, 600);
    this.root.append(tabs, this.panel);
  }

  toggleTab(t: Tab | null) {
    this.openTab = this.openTab === t ? null : t;
    this.host.sfxUi();
    this.renderCraft();
  }
  toggleCraft() { this.toggleTab(this.openTab ? null : 'tools'); }
  cycleTab() {
    const i = TABS.findIndex((t) => t.id === this.openTab);
    this.openTab = TABS[(i + 1) % TABS.length].id;
    this.host.sfxUi();
    this.renderCraft();
  }

  renderCraft() {
    for (const t of TABS) {
      const b = this.tabEls[t.id];
      b.classList.toggle('on', this.openTab === t.id);
      const any = RECIPES.some((r) => r.tab === t.id && this.host.recipeState(r).can);
      const badge = b.querySelector('.badge');
      if (any && !badge) b.appendChild(el('span', 'badge')); else if (!any && badge) badge.remove();
    }
    if (!this.openTab) { this.panel.classList.add('closed'); return; }
    this.panel.classList.remove('closed');
    const tab = TABS.find((t) => t.id === this.openTab)!;
    const bench = this.host.nearBench();
    let html = `<h3>${tab.name}</h3><div class="sub ${bench ? 'lit' : ''}">${bench ? '✦ 研机台就在身旁：可研制二阶器物' : '靠近「研机台」可解锁二阶配方'}</div>`;
    const list = RECIPES.filter((r) => r.tab === this.openTab);
    html += list.map((r) => {
      const st = this.host.recipeState(r);
      const def = ITEMS[r.id];
      const cost = r.cost.map(([id, n]) => {
        const have = this.host.inv.count(id) + (this.host.inv.equip.hand?.id === id ? 1 : 0);
        return `<span class="${have >= n ? '' : 'short'}"><img src="${icon(id)}">${ITEMS[id].name} ${Math.min(have, 99)}/${n}</span>`;
      }).join('');
      return `<div class="recipe ${st.locked ? 'locked' : ''}" data-id="${r.id}">
        <div class="ic" style="background-image:${slotBg('normal').replace(/"/g, "'")}"><img src="${icon(r.id)}"></div>
        <div class="mid"><div class="nm">${def.name}${r.tier ? `<em>${st.learned ? '已习得' : '二阶'}</em>` : ''}</div><div class="ds">${r.desc}</div><div class="cost">${cost}</div></div>
        ${st.locked ? '<div class="lock">需靠近<br>研机台</div>' : `<button class="go" ${st.can ? '' : 'disabled'}>${r.place ? '安放' : '制作'}</button>`}
      </div>`;
    }).join('');
    this.panel.innerHTML = html;
    this.panel.querySelectorAll('.recipe .go').forEach((b) => {
      b.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = (b.closest('.recipe') as HTMLElement).dataset.id!;
        this.host.craft(id);
      });
    });
  }
  flashRecipe(id: string) {
    const r = this.panel.querySelector(`.recipe[data-id="${id}"]`);
    if (r) { r.classList.remove('flash'); void (r as HTMLElement).offsetWidth; r.classList.add('flash'); }
  }

  /* ---------- 提示与反馈 ---------- */
  showTip(html: string, x: number, y: number) {
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    this.placeTooltip(x, y);
  }
  private placeTooltip(x: number, y: number) {
    const w = this.tooltip.offsetWidth, h = this.tooltip.offsetHeight;
    let tx = x + 18, ty = y - h - 12;
    if (tx + w > innerWidth - 8) tx = x - w - 18;
    if (ty < 8) ty = y + 20;
    this.tooltip.style.left = tx + 'px'; this.tooltip.style.top = ty + 'px';
  }
  hideTip() { this.tooltip.classList.add('hidden'); }

  setHover(html: string | null, x = 0, y = 0) {
    if (!html) { this.hover.style.display = 'none'; return; }
    this.hover.style.display = '';
    if (this.hover.innerHTML !== html) this.hover.innerHTML = html;
    this.hover.style.left = x + 'px'; this.hover.style.top = (y - 18) + 'px';
  }

  showHint(html: string, secs = 7) {
    this.hint.innerHTML = html;
    this.hint.classList.add('on');
    this.hintTimer = secs;
  }
  tick(dt: number) {
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.hint.classList.remove('on'); }
  }
  toast(id: string | null, text: string) {
    const t = el('div', 'toast');
    if (id) { const img = el('img'); img.src = icon(id); t.appendChild(img); }
    t.appendChild(document.createTextNode(text));
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 5) this.toasts.removeChild(this.toasts.firstChild!);
    setTimeout(() => t.remove(), 2300);
  }
  /** 屏幕坐标飘字 */
  float(x: number, y: number, text: string, cls: string) {
    const f = el('div', 'fl ' + cls, text);
    f.style.left = x + 'px'; f.style.top = y + 'px';
    this.floaters.appendChild(f);
    const vx = (Math.random() - 0.5) * 40;
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 1000;
      if (t > 1.1) { f.remove(); return; }
      const s = t < 0.12 ? 0.6 + t / 0.12 * 0.7 : 1.3 - Math.min(0.3, (t - 0.12) * 1.2);
      f.style.transform = `translate(calc(-50% + ${vx * t}px), calc(-50% - ${t * 60 - 30 * t * t}px)) scale(${s})`;
      f.style.opacity = String(t > 0.7 ? 1 - (t - 0.7) / 0.4 : 1);
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }
  showBanner(title: string, sub: string, secs = 3.5) {
    this.banner.innerHTML = `<div class="bt">${title}</div><small>${sub}</small>`;
    this.banner.classList.add('on');
    setTimeout(() => this.banner.classList.remove('on'), secs * 1000);
  }
  setVMsg(text: string | null) {
    if (text) { this.vmsg.textContent = text; this.vmsg.classList.add('on'); } else this.vmsg.classList.remove('on');
  }
  setFps(t: string) { this.fps.textContent = t; }
}

/* ---------- 覆盖层 ---------- */
export function helpHtml(): string {
  return `<h2>操作说明</h2><div class="lead">在「烬野」活下去：吃饱、保持清醒、别待在黑暗里。</div>
  <div class="keys">
   <div><span>移动</span><kbd>W A S D</kbd></div>
   <div><span>采集 / 攻击 / 拾取目标</span><kbd>鼠标左键</kbd></div>
   <div><span>对最近的目标行动</span><kbd>空格</kbd></div>
   <div><span>拾取附近物品</span><kbd>E</kbd></div>
   <div><span>攻击最近的敌人</span><kbd>F</kbd></div>
   <div><span>使用 / 装备 物品栏</span><kbd>1–9 0 - =</kbd> 或 左键</div>
   <div><span>烤制 / 添柴（火边） / 丢弃</span><kbd>右键物品</kbd></div>
   <div><span>丢弃物品</span><kbd>Shift+左键</kbd> 或 拖出</div>
   <div><span>打开制作 / 切换页签</span><kbd>Tab</kbd> / <kbd>C</kbd></div>
   <div><span>旋转视角</span><kbd>Q</kbd> <kbd>R</kbd></div>
   <div><span>缩放视角</span><kbd>滚轮</kbd></div>
   <div><span>地图</span><kbd>M</kbd></div>
   <div><span>暂停 / 保存进度</span><kbd>Esc</kbd> / <kbd>P</kbd></div>
   <div><span>帮助</span><kbd>H</kbd></div>
   <div><span>静音</span><kbd>N</kbd></div>
   <div><span>取消安放</span><kbd>右键</kbd> / <kbd>Esc</kbd></div>
  </div>
  <div class="tips">
   <b>第一天：</b>采干草、折树枝、捡燧石 → 做斧头砍树 → 入夜前生营火或做火把。<br>
   <b>黑夜：</b>没有光的地方，<b>噬影</b>会撕咬你。营火或手持火把/提灯能划出安全的光圈。<br>
   <b>饥饿：</b>赤莓、野萝卜可生吃；在火边右键食物烤熟，回复更多，还能安神。<br>
   <b>理智：</b>入夜、黑暗、怪物会侵蚀心神。靠近火堆、采花、戴花冠、吃炙伞菇可以恢复。<br>
   <b>墨潮之夜：</b>每第三夜墨潮涌来，火烧得更快，<b>潮影</b>在火光边缘游弋伸爪——守在火堆中心，备足柴火。<br>
   <b>存档：</b>每天黎明自动存档，也可在暂停菜单里手动保存；关闭页面时会顺手保存。死亡后存档清除。<br>
   <b>墨蛛：</b>白天在巢中沉睡，入夜外出觅食。它扑击前会<b>先立起身子、双眼发亮</b>——此时后撤，扑空后反击。<br>
   <b>研机台：</b>站在旁边可研制二阶器物；研制过一次的配方，之后在哪都能做。
  </div>`;
}
