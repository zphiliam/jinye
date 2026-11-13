// 手作 SVG 界面件：木刻边框、圆形仪表、昼夜钟、卷轴底板
const INK = '#16110d', PAPER = '#ebdfc4', PAPER2 = '#d9c7a1', BLOOD = '#8e2b1f', EMBER = '#eaa23a', COPPER = '#4c7566', BONE = '#e8dec6', BARK = '#3d2b1f', OCHRE = '#a68240';

export const rough = (id: string, scale = 2.2, freq = 0.04) =>
  `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;

const grainFilter = (id: string) =>
  `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 -2.2 1.25" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>`;

export const svgUrl = (s: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}")`;

/** 物品格：刻木方框 */
export function slotBg(variant: 'normal' | 'equip' | 'pack' = 'normal'): string {
  const fill = variant === 'equip' ? '#2a2119' : variant === 'pack' ? '#3a2c1c' : '#2b231a';
  const rim = variant === 'equip' ? COPPER : OCHRE;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${rough('r', 2.4, 0.06)}
  <radialGradient id="in" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${fill}" stop-opacity="0.8"/><stop offset="1" stop-color="#0d0a07" stop-opacity="0.95"/></radialGradient></defs>
  <g filter="url(#r)"><path d="M4 6 L58 3.5 L60.5 58 L5.5 60.5 Z" fill="${INK}"/>
  <path d="M8 9 L55.5 7.5 L56.5 55 L8.5 56.5 Z" fill="url(#in)" stroke="${rim}" stroke-width="1.6" stroke-opacity="0.55"/>
  <path d="M9 10 L30 9.2" stroke="${PAPER}" stroke-opacity="0.35" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M10 53 L54 52" stroke="#000" stroke-opacity="0.5" stroke-width="2"/></g>
  ${variant === 'equip' ? `<circle cx="32" cy="32" r="16" fill="none" stroke="${COPPER}" stroke-opacity="0.25" stroke-width="1.2" stroke-dasharray="3 3"/>` : ''}
  </svg>`);
}

/** 卷轴底板（物品栏背景） */
export function scrollBg(w: number, h: number): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${rough('r', 3, 0.03)}
  <linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4430"/><stop offset="0.5" stop-color="#3b2b1e"/><stop offset="1" stop-color="#251a12"/></linearGradient>
  <linearGradient id="rod" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${BARK}"/><stop offset="0.4" stop-color="#7a5636"/><stop offset="1" stop-color="#1c130c"/></linearGradient></defs>
  <g filter="url(#r)">
   <rect x="14" y="6" width="${w - 28}" height="${h - 12}" fill="${INK}"/>
   <rect x="18" y="10" width="${w - 36}" height="${h - 20}" fill="url(#p)"/>
   <path d="M22 14 H${w - 22}" stroke="${OCHRE}" stroke-opacity="0.5" stroke-width="1.5"/>
   <path d="M22 ${h - 14} H${w - 22}" stroke="${OCHRE}" stroke-opacity="0.35" stroke-width="1.5"/>
   <rect x="2" y="0" width="16" height="${h}" rx="6" fill="${INK}"/><rect x="5" y="3" width="10" height="${h - 6}" rx="4" fill="url(#rod)"/>
   <rect x="${w - 18}" y="0" width="16" height="${h}" rx="6" fill="${INK}"/><rect x="${w - 15}" y="3" width="10" height="${h - 6}" rx="4" fill="url(#rod)"/>
   <circle cx="10" cy="${h / 2}" r="4" fill="${BLOOD}"/><circle cx="${w - 10}" cy="${h / 2}" r="4" fill="${BLOOD}"/>
  </g></svg>`);
}

/** 羊皮纸面板 */
export function parchment(w: number, h: number, dark = false): string {
  const c0 = dark ? '#2c241b' : PAPER, c1 = dark ? '#16110d' : PAPER2;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${rough('r', 5, 0.02)}${grainFilter('g')}
  <radialGradient id="p" cx="45%" cy="40%" r="75%"><stop offset="0" stop-color="${c0}"/><stop offset="0.8" stop-color="${c1}"/><stop offset="1" stop-color="${dark ? '#0b0806' : '#a88f63'}"/></radialGradient></defs>
  <g filter="url(#r)"><rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="${INK}"/><rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="url(#p)" filter="url(#g)"/>
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="none" stroke="${dark ? OCHRE : BLOOD}" stroke-opacity="0.5" stroke-width="1.5"/></g></svg>`);
}

/** 笔刷按钮底 */
export function brushStroke(color: string): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" preserveAspectRatio="none"><defs>${rough('r', 8, 0.03)}</defs>
  <g filter="url(#r)"><path d="M6 32 C 20 12, 60 10, 120 12 S 220 8, 234 22 C 238 34, 226 50, 200 50 S 90 54, 40 52 S 2 46, 6 32 Z" fill="${color}"/>
  <path d="M20 20 C 80 14, 160 14, 220 18" stroke="#fff" stroke-opacity="0.12" stroke-width="3" fill="none"/>
  <path d="M30 46 C 100 50, 170 48, 215 42" stroke="#000" stroke-opacity="0.25" stroke-width="4" fill="none"/></g></svg>`);
}

/** 圆形仪表（生命/饥饿/理智） */
export function meterSvg(id: string, color: string, deep: string, glyph: string): string {
  const notches = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 41, y1 = 50 + Math.sin(a) * 41, x2 = 50 + Math.cos(a) * 46, y2 = 50 + Math.sin(a) * 46;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 4 === 0 ? BLOOD : OCHRE}" stroke-width="${i % 4 === 0 ? 3 : 1.6}" stroke-linecap="round"/>`;
  }).join('');
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 360 + 22.5;
    return `<path d="M50 1 Q55 7 50 11 Q45 7 50 1Z" fill="${i % 2 ? BLOOD : OCHRE}" stroke="${INK}" stroke-width="1.4" transform="rotate(${a} 50 50)"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="meter-svg"><defs>${rough(id + 'r', 1.8, 0.05)}
  <clipPath id="${id}c"><circle cx="50" cy="50" r="33"/></clipPath>
  <radialGradient id="${id}g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${deep}"/></radialGradient>
  <radialGradient id="${id}s" cx="50%" cy="45%" r="55%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient></defs>
  <g filter="url(#${id}r)">
   ${petals}
   <circle cx="50" cy="50" r="47" fill="${INK}"/>
   ${notches}
   <circle cx="50" cy="50" r="38" fill="#2a2018" stroke="${OCHRE}" stroke-width="1.5" stroke-opacity="0.7"/>
   <circle cx="50" cy="50" r="34" fill="#120d0a"/>
  </g>
  <g clip-path="url(#${id}c)">
   <g class="liquid"><path class="wave" d="M-40 0 Q-25 -4 -10 0 T20 0 T50 0 T80 0 T110 0 T140 0 V120 H-40 Z" fill="url(#${id}g)"/>
   <path class="wave2" d="M-40 0 Q-25 3 -10 0 T20 0 T50 0 T80 0 T110 0 T140 0" fill="none" stroke="${BONE}" stroke-opacity="0.55" stroke-width="1.5"/></g>
   <g opacity="0.22">${Array.from({ length: 10 }, (_, i) => `<line x1="${12 + i * 9}" y1="10" x2="${2 + i * 9}" y2="90" stroke="#000" stroke-width="1.6"/>`).join('')}</g>
   <circle cx="50" cy="50" r="34" fill="url(#${id}s)"/>
  </g>
  <path d="M30 30 Q38 22 50 21" stroke="${PAPER}" stroke-opacity="0.35" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <text x="50" y="59" text-anchor="middle" class="glyph">${glyph}</text>
  <text x="50" y="77" text-anchor="middle" class="num">0</text>
  </svg>`;
}

/** 昼夜钟 */
export function clockSvg(dayF: number, duskF: number): string {
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const p = (a: number, r: number) => `${(60 + Math.cos(a) * r).toFixed(2)} ${(60 + Math.sin(a) * r).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${p(a0, r1)} A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)} L${p(a1, r0)} A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
  };
  const start = -Math.PI / 2;
  const A = (f: number) => start + f * Math.PI * 2;
  const segs: string[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const f0 = i / n, f1 = (i + 1) / n;
    const mid = (f0 + f1) / 2;
    const col = mid < dayF ? OCHRE : mid < dayF + duskF ? BLOOD : '#1d2228';
    segs.push(`<path d="${arc(A(f0) + 0.025, A(f1) - 0.025, 30, 46)}" fill="${col}" stroke="${INK}" stroke-width="1.5"/>`);
  }
  return `<svg viewBox="0 0 120 120" class="clock-svg"><defs>${rough('ckr', 2, 0.05)}</defs>
   <g filter="url(#ckr)">
    <circle cx="60" cy="60" r="57" fill="${INK}"/>
    ${Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return `<circle cx="${(60 + Math.cos(a) * 52).toFixed(1)}" cy="${(60 + Math.sin(a) * 52).toFixed(1)}" r="${i % 6 === 0 ? 2.6 : 1.2}" fill="${OCHRE}"/>`; }).join('')}
    ${segs.join('')}
    <circle cx="60" cy="60" r="28" fill="#1a130e" stroke="${OCHRE}" stroke-width="1.5"/>
   </g>
   <g class="hand"><path d="M60 60 L57 24 L60 13 L63 24 Z" fill="${BONE}" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="15" r="3.5" fill="${EMBER}" stroke="${INK}" stroke-width="1.5"/></g>
   <circle cx="60" cy="60" r="20" fill="#1a130e"/>
   <text x="60" y="56" text-anchor="middle" class="day-label">第 · 天</text>
   <text x="60" y="73" text-anchor="middle" class="day-num">1</text>
  </svg>`;
}

/** 制作页签徽章 */
export function medallion(): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${rough('r', 2, 0.06)}</defs><g filter="url(#r)">
  <circle cx="32" cy="32" r="29" fill="${INK}"/><circle cx="32" cy="32" r="25" fill="#3a2c1e" stroke="${OCHRE}" stroke-width="1.5"/>
  <circle cx="32" cy="32" r="21" fill="#211810"/></g></svg>`);
}

/** 标题字的墨迹滤镜 */
export function titleFilterDefs(): string {
  return `<svg width="0" height="0" style="position:absolute"><defs>
   <filter id="inkTitle" x="-5%" y="-20%" width="110%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.15" result="ga"/>
    <feComposite in="d" in2="ga" operator="in"/>
   </filter>
   <filter id="inkSoft"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>
  </defs></svg>`;
}
export const UI_COLORS = { INK, PAPER, PAPER2, BLOOD, EMBER, COPPER, BONE, BARK, OCHRE };
