/* Preview tab content renderer */

import { icon } from '../icons.js';
import { subscribe, getState } from '../state.js';
import { getTypography, subscribeTypography } from '../typography-state.js';
import { buildScaleData, buildTypographyCSS, SCALE_METHODS } from '../generators/type-scale.js';

const PREVIEWS = { ui: marketing, forms, components, typography: typographyPreview };
let currentTab = 'ui';
let canvasEl;
let _lastSig = null;   // structural signature of the currently-mounted DOM

export function initPreviews() {
  canvasEl = document.getElementById('preview-canvas');

  document.querySelectorAll('.preview-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preview-tab').forEach(b => {
        b.classList.remove('preview-tab--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('preview-tab--active');
      btn.setAttribute('aria-selected', 'true');
      currentTab = btn.dataset.preview;
      render();
    });
  });

  /*
   * Colors and theme flow through CSS custom properties (--accent,
   * --color-brand-500, --surface-card, --mkt-dark-bg, …) set on :root by
   * applyCSS(). The preview DOM references those vars, so a pure color or
   * theme change updates the rendered output automatically — no rebuild
   * needed. We only rebuild the DOM when *structural* state changes:
   *   - active tab
   *   - secondary / tertiary brand visibility (adds/removes elements)
   *   - typography, but only on the Typography tab (it prints JS-computed
   *     px values & font names; other tabs use --font-* / --type-* vars)
   * This eliminates the full-DOM rebuild (and flicker) that previously
   * ran on every palette-change — including dozens per second while
   * dragging the color wheel.
   */
  subscribe('palette-change', render);
  subscribe('theme-change',   render);
  subscribe('init',           () => render(true));
  subscribeTypography(() => render());
  render(true);
}

/* A signature capturing everything that requires a DOM rebuild */
function _signature() {
  const s = getState();
  let sig = `${currentTab}|${s.showSecondaryBrand ? 1 : 0}|${s.showTertiaryBrand ? 1 : 0}`;
  if (currentTab === 'typography') {
    const t = getTypography();
    sig += `|${t.heading}|${t.body}|${t.scaleMethod}|${t.baseSize}|${t.steps}|${t.baseStep}`;
  }
  return sig;
}

function render(force = false) {
  if (!canvasEl) return;
  const sig = _signature();
  if (!force && sig === _lastSig) return;  // structural state unchanged → CSS vars handle the rest
  _lastSig = sig;
  canvasEl.innerHTML = '';
  const state = getState();
  const fn = PREVIEWS[currentTab];
  if (fn) canvasEl.appendChild(fn(state));
}

/* ─── Dashboard ─── */
function dashboard(state = {}) {
  const hasS = !!state.showSecondaryBrand;
  const hasT = !!state.showTertiaryBrand;
  const root = div('');

  // KPI row
  const kpiRow = div('dash-kpi-row');
  const kpis = [
    { label: 'Total Revenue', value: '$142,891', trend: '+12.4%', up: true,  variant: 'kpi-card--accent',    sparkColor: 'var(--accent)' },
    { label: 'Active Users',  value: '28,349',   trend: '+8.1%',  up: true,  variant: 'kpi-card--secondary', sparkColor: 'var(--secondary)' },
    { label: 'Conversion',    value: '3.62%',    trend: '-0.4%',  up: false, variant: 'kpi-card--tertiary',  sparkColor: 'var(--tertiary)' },
    { label: 'Avg Session',   value: '4m 28s',   trend: '+0.7%',  up: true },
  ];
  kpis.forEach(k => kpiRow.appendChild(kpiCard(k)));
  root.appendChild(kpiRow);

  // Charts row
  const chartsRow = div('dash-charts-row');
  chartsRow.appendChild(barChartCard(hasS, hasT));
  chartsRow.appendChild(donutCard(hasS, hasT));
  root.appendChild(chartsRow);

  // Activity + secondary row
  const bottomRow = div('preview-grid preview-grid--2');
  bottomRow.style.gap = '14px';
  bottomRow.appendChild(activityCard());
  bottomRow.appendChild(statusSummaryCard());
  root.appendChild(bottomRow);

  return root;
}

function kpiCard({ label, value, trend, up, variant = '', sparkColor = '' }) {
  const sc = sparkColor || (up ? 'var(--color-success-500)' : 'var(--color-error-500)');
  const card = div('kpi-card' + (variant ? ` ${variant}` : ''));
  card.innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-trend kpi-trend--${up ? 'up' : 'down'}">
      ${up ? arrowUp() : arrowDown()}
      ${trend} vs last month
    </div>
    <svg class="kpi-sparkline" width="80" height="24" viewBox="0 0 80 24" fill="none">
      <polyline points="${sparklinePoints(up)}" stroke="${sc}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  return card;
}

function sparklinePoints(up) {
  const base = up
    ? [20,16, 28,12, 38,14, 48,10, 58,8, 68,6, 78,4]
    : [20,8,  28,10, 38,7,  48,12, 58,14, 68,12, 78,16];
  return base.join(',');
}

function barChartCard(hasS, hasT) {
  const card = div('chart-card');
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const allSeries = [
    { data: [55, 72, 60, 85, 68, 90], cls: 'bar--brand',      label: 'Brand',     color: 'var(--accent)' },
    { data: [40, 55, 48, 62, 50, 75], cls: 'bar--secondary',  label: 'Secondary', color: 'var(--secondary)' },
    { data: [28, 38, 32, 44, 37, 55], cls: 'bar--tertiary',   label: 'Tertiary',  color: 'var(--tertiary)' },
  ];
  const series = allSeries.filter((_, i) => i === 0 || (i === 1 && hasS) || (i === 2 && hasT));
  const maxH = 100;

  let bars = '';
  months.forEach((m, i) => {
    const groupBars = series.map(s => {
      const h = Math.round((s.data[i] / 100) * maxH);
      return `<div class="bar ${s.cls}" style="height:${h}px"></div>`;
    }).join('');
    bars += `<div class="bar-group">${groupBars}</div>`;
  });

  const subtitle = series.map(s => s.label).join(' · ') + ' channels';
  const legend = series.map(s =>
    `<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">
      <span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block"></span>${s.label}
    </span>`
  ).join('');

  card.innerHTML = `
    <div class="chart-title">Monthly Revenue</div>
    <div class="chart-subtitle">${subtitle}</div>
    <div class="bar-chart">${bars}</div>
    <div class="bar-chart-labels">
      ${months.map(m => `<div class="bar-chart-label">${m}</div>`).join('')}
    </div>
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">${legend}</div>`;
  return card;
}

function donutCard(hasS, hasT) {
  const card = div('chart-card');
  // When secondary/tertiary aren't active, fall back to semantic colors
  const segments = [
    { pct: 38, color: 'var(--accent)',                                      label: 'Direct',   val: '38%' },
    { pct: 26, color: hasS ? 'var(--secondary)' : 'var(--color-info-500)', label: 'Organic',  val: '26%' },
    { pct: 22, color: hasT ? 'var(--tertiary)'  : 'var(--color-success-500)', label: 'Referral', val: '22%' },
    { pct: 14, color: 'var(--color-warning-500)',                           label: 'Paid',     val: '14%' },
  ];

  const r = 40, cx = 50, cy = 50;
  let cumulative = 0;
  const paths = segments.map(s => {
    const startAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    cumulative += s.pct;
    const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = s.pct > 50 ? 1 : 0;
    return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${s.color}" opacity="0.9"/>`;
  }).join('');

  card.innerHTML = `
    <div class="chart-title">Traffic Sources</div>
    <div class="chart-subtitle">Last 30 days</div>
    <div class="donut-wrap">
      <svg class="donut-svg" width="100" height="100" viewBox="0 0 100 100">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="24" fill="var(--surface-card)"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="var(--text-primary)">79%</text>
      </svg>
      <div class="donut-legend">
        ${segments.map(s => `
          <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background:${s.color}"></span>
            <span>${s.label}</span>
            <span style="margin-left:auto;font-weight:600;color:var(--text-primary)">${s.val}</span>
          </div>`).join('')}
      </div>
    </div>`;
  return card;
}

function activityCard() {
  const card = div('chart-card');
  card.innerHTML = `
    <div class="chart-title">Recent Activity</div>
    <div class="chart-subtitle">Team updates</div>
    <div class="activity-list">
      ${[
        { initials:'AJ', bg:'var(--color-brand-500)',   fg:'var(--accent-fg)',         name:'Alex Johnson', desc:'Deployed v2.4 to production', time:'2m ago',  badge:'success', badgeText:'Deployed' },
        { initials:'SK', bg:'var(--color-info-500)',    fg:'var(--info-fg,#fff)',       name:'Sara Kim',     desc:'3 new sign-ups from campaign', time:'14m ago', badge:'info',    badgeText:'New users' },
        { initials:'MR', bg:'var(--color-warning-500)', fg:'var(--warning-fg,#111)',   name:'Mike Ross',    desc:'API latency spike detected',   time:'1h ago',  badge:'warning', badgeText:'Alert' },
        { initials:'LP', bg:'var(--color-success-500)', fg:'var(--success-fg,#fff)',   name:'Lisa Park',    desc:'Payment integration live',     time:'3h ago',  badge:'success', badgeText:'Live' },
        { initials:'TW', bg:'var(--color-error-500)',   fg:'var(--error-fg,#fff)',     name:'Tom Wu',       desc:'Auth service rollback needed', time:'5h ago',  badge:'error',   badgeText:'Critical' },
      ].map(a => `
        <div class="activity-item">
          <div class="activity-avatar" style="background:${a.bg};color:${a.fg}">${a.initials}</div>
          <div class="activity-body">
            <div class="activity-name">${a.name}</div>
            <div class="activity-desc">${a.desc}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="badge badge--${a.badge}">${a.badgeText}</span>
            <span class="activity-time">${a.time}</span>
          </div>
        </div>`).join('')}
    </div>`;
  return card;
}

function statusSummaryCard() {
  const card = div('chart-card');
  card.innerHTML = `
    <div class="chart-title">System Status</div>
    <div class="chart-subtitle">All services</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      ${[
        { name:'API Gateway',       status:'operational', color:'var(--color-success-500)', uptime:'99.98%' },
        { name:'Auth Service',      status:'degraded',    color:'var(--color-warning-500)', uptime:'97.2%' },
        { name:'Database Cluster',  status:'operational', color:'var(--color-success-500)', uptime:'100%' },
        { name:'CDN',               status:'operational', color:'var(--color-success-500)', uptime:'99.99%' },
        { name:'Email Service',     status:'outage',      color:'var(--color-error-500)',   uptime:'94.1%' },
      ].map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0"></span>
            <span style="font-size:13px;color:var(--text-primary)">${s.name}</span>
          </div>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${s.uptime}</span>
        </div>`).join('')}
    </div>`;
  return card;
}

/* ─── Marketing Bento helpers ─── */
function buildMktDonut(hasS, hasT) {
  const r = 33, cx = 45, cy = 45;
  const circ = 2 * Math.PI * r; // ≈ 207.35
  const gap = 5;
  const allSegs = [
    { pct: 42, color: 'var(--accent)',    label: 'Primary',   val: '42%' },
    { pct: 33, color: 'var(--secondary)', label: 'Secondary', val: '33%' },
    { pct: 25, color: 'var(--tertiary)',  label: 'Tertiary',  val: '25%' },
  ];
  // Keep only active segments, redistribute proportionally to 100%
  const active = allSegs.filter((_, i) => i === 0 || (i === 1 && hasS) || (i === 2 && hasT));
  const total  = active.reduce((s, x) => s + x.pct, 0);
  const segs   = active.map(s => ({ ...s, pct: Math.round(s.pct / total * 100) }));
  // Fix rounding so sum is exactly 100
  const diff = 100 - segs.reduce((s, x) => s + x.pct, 0);
  if (segs.length) segs[0].pct += diff;
  let pos = 0;
  const circles = segs.map(s => {
    const len = Math.max(0, circ * s.pct / 100 - gap);
    const off = (circ - pos).toFixed(2);
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}"
      stroke="${s.color}" stroke-width="8" fill="none"
      stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}"
      stroke-dashoffset="${off}"
      stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    pos += len + gap;
    return el;
  });
  const legendItems = segs.map(s =>
    `<div class="mkt-ring-legend-item">
      <div class="mkt-ring-dot" style="background:${s.color}"></div>
      <span>${s.label}</span>
      <span class="mkt-ring-val">${s.val}</span>
    </div>`
  ).join('');
  const svg = `<svg class="mkt-ring-svg" viewBox="0 0 90 90" fill="none" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" style="stroke:var(--mkt-dark-bg-raise)" stroke-width="8" fill="none"/>
    ${circles.join('')}
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--mkt-dark-text);font-family:var(--font-heading-family,sans-serif)">${segs.length}</text>
    <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="7.5" style="fill:var(--mkt-dark-muted);font-family:var(--font-body-family,sans-serif)">palette${segs.length !== 1 ? 's' : ''}</text>
  </svg>`;
  return { svg, legendItems };
}

/* ─── Marketing ─── */
function marketing(state = {}) {
  const hasS = !!state.showSecondaryBrand;
  const hasT = !!state.showTertiaryBrand;
  const root = div('');

  // Bento grid — hero + 6 data cards
  const { svg: donutSvg, legendItems } = buildMktDonut(hasS, hasT);
  const bento = div('mkt-bento');
  bento.innerHTML = `
    <!-- 1. Hero card (2col × 2row) -->
    <div class="mkt-card mkt-card--dark mkt-hero">
      <div class="mkt-hero-orb mkt-hero-orb--1"></div>
      <div class="mkt-hero-orb mkt-hero-orb--2"></div>
      <div class="mkt-hero-orb mkt-hero-orb--3"></div>
      <div class="mkt-hero-inner">
        <div class="mkt-hero-eyebrow">
          <div class="mkt-hero-eyebrow-dot"></div>Design System v3.0
        </div>
        <h2 class="mkt-hero-title">Colors that<br><em>scale precisely</em></h2>
        <p class="mkt-hero-sub">Generate perceptually uniform palettes from a single base hue. Token-ready. Production-grade.</p>
        <div class="mkt-hero-actions">
          <button class="mkt-hero-btn mkt-hero-btn--primary">Generate palette ${arrowRight()}</button>
          <button class="mkt-hero-btn mkt-hero-btn--ghost">View docs</button>
        </div>
      </div>
    </div>

    <!-- 2. Donut ring card (1col × 1row) -->
    <div class="mkt-card mkt-card--dark mkt-ring">
      <div class="mkt-ring-inner">
        ${donutSvg}
        <div class="mkt-ring-legend">${legendItems}</div>
      </div>
    </div>

    <!-- 3. Stat card (1col × 1row) -->
    <div class="mkt-card mkt-card--surface mkt-stat">
      <div class="mkt-stat-inner">
        <div class="mkt-stat-label">Active tokens</div>
        <div class="mkt-stat-value">2,840</div>
        <div class="mkt-stat-delta">
          ${icon('arrow-up', { size: 10 })}
          +18% this week
        </div>
        <svg class="mkt-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="mkt-spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--secondary)" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="var(--secondary)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0 32 L14 28 L26 24 L38 26 L50 18 L62 14 L74 9 L86 5 L100 2"
            stroke="var(--secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M0 32 L14 28 L26 24 L38 26 L50 18 L62 14 L74 9 L86 5 L100 2 L100 40 L0 40Z"
            fill="url(#mkt-spark-grad)"/>
        </svg>
      </div>
    </div>

    <!-- 4. Profile card (1col × 2rows) -->
    <div class="mkt-card mkt-card--surface mkt-profile">
      <div class="mkt-profile-inner">
        <div class="mkt-profile-avatar-wrap">
          <svg class="mkt-profile-avatar" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            <defs>
              <radialGradient id="mkt-avatar-grad" cx="38%" cy="32%" r="75%">
                <stop offset="0%"   stop-color="var(--accent)"/>
                <stop offset="55%"  stop-color="var(--secondary)"/>
                <stop offset="100%" stop-color="var(--tertiary)"/>
              </radialGradient>
            </defs>
            <circle cx="26" cy="26" r="26" fill="url(#mkt-avatar-grad)"/>
            <text x="26" y="31" text-anchor="middle" font-size="16" font-weight="700" style="fill:rgba(255,255,255,0.92);font-family:var(--font-heading-family,sans-serif)">LP</text>
          </svg>
          <div class="mkt-profile-online"></div>
        </div>
        <div class="mkt-profile-name">Luna Park</div>
        <div class="mkt-profile-role">Design System Lead</div>
        <div class="mkt-profile-stats">
          <div class="mkt-profile-stat">
            <div class="mkt-profile-stat-val mkt-profile-stat-val--accent">48</div>
            <div class="mkt-profile-stat-lbl">Palettes</div>
          </div>
          <div class="mkt-profile-stat">
            <div class="mkt-profile-stat-val ${hasS ? 'mkt-profile-stat-val--secondary' : 'mkt-profile-stat-val--accent'}">12k</div>
            <div class="mkt-profile-stat-lbl">Tokens</div>
          </div>
          <div class="mkt-profile-stat">
            <div class="mkt-profile-stat-val ${hasT ? 'mkt-profile-stat-val--tertiary' : hasS ? 'mkt-profile-stat-val--secondary' : 'mkt-profile-stat-val--accent'}">3</div>
            <div class="mkt-profile-stat-lbl">Systems</div>
          </div>
        </div>
        <div class="mkt-profile-divider"></div>
        <div class="mkt-profile-tag-row">
          <span class="mkt-profile-tag mkt-profile-tag--accent">Figma</span>
          ${hasS ? `<span class="mkt-profile-tag mkt-profile-tag--secondary">CSS</span>` : ''}
          ${hasT ? `<span class="mkt-profile-tag mkt-profile-tag--tertiary">Tokens</span>` : ''}
        </div>
      </div>
    </div>

    <!-- 5. Notifications card (1col × 1row) -->
    <div class="mkt-card mkt-card--surface mkt-notif">
      <div class="mkt-notif-inner">
        <div class="mkt-notif-header">Activity</div>
        <div class="mkt-notif-row">
          <div class="mkt-notif-dot mkt-notif-dot--accent"></div>
          <span class="mkt-notif-text">Palette exported to CSS</span>
          <span class="mkt-notif-time">2m</span>
        </div>
        ${hasS ? `<div class="mkt-notif-row">
          <div class="mkt-notif-dot mkt-notif-dot--secondary"></div>
          <span class="mkt-notif-text">Token sync complete</span>
          <span class="mkt-notif-time">8m</span>
        </div>` : ''}
        ${hasT ? `<div class="mkt-notif-row">
          <div class="mkt-notif-dot mkt-notif-dot--tertiary"></div>
          <span class="mkt-notif-text">Review requested</span>
          <span class="mkt-notif-time">1h</span>
        </div>` : ''}
      </div>
    </div>

    <!-- 6. Feature dark 2×2 grid (2col × 1row) -->
    <div class="mkt-card mkt-card--dark mkt-feat-dark">
      <div class="mkt-feat-dark-inner">
        <div class="mkt-feat-item">
          <div class="mkt-feat-icon mkt-feat-icon--accent">${sparkIcon()}</div>
          <span class="mkt-feat-label">Palette generation</span>
        </div>
        <div class="mkt-feat-item">
          <div class="mkt-feat-icon mkt-feat-icon--secondary">${eyeIcon()}</div>
          <span class="mkt-feat-label">Live preview</span>
        </div>
        <div class="mkt-feat-item">
          <div class="mkt-feat-icon mkt-feat-icon--tertiary">${exportIcon()}</div>
          <span class="mkt-feat-label">Token export</span>
        </div>
        <div class="mkt-feat-item">
          <div class="mkt-feat-icon mkt-feat-icon--accent">${checkIcon()}</div>
          <span class="mkt-feat-label">A11y checking</span>
        </div>
      </div>
    </div>

    <!-- 7. Live palette card (1col × 1row) -->
    <div class="mkt-card mkt-card--dark mkt-palette-card">
      <div class="mkt-pal-inner">
        <div class="mkt-pal-header">Live palette</div>
        <div class="mkt-pal-row">
          <div class="mkt-pal-swatch mkt-pal-swatch--accent"></div>
          <div class="mkt-pal-bar-wrap"><div class="mkt-pal-bar mkt-pal-bar--accent"></div></div>
          <div class="mkt-pal-pct">75%</div>
        </div>
        ${hasS ? `<div class="mkt-pal-row">
          <div class="mkt-pal-swatch mkt-pal-swatch--secondary"></div>
          <div class="mkt-pal-bar-wrap"><div class="mkt-pal-bar mkt-pal-bar--secondary"></div></div>
          <div class="mkt-pal-pct">56%</div>
        </div>` : ''}
        ${hasT ? `<div class="mkt-pal-row">
          <div class="mkt-pal-swatch mkt-pal-swatch--tertiary"></div>
          <div class="mkt-pal-bar-wrap"><div class="mkt-pal-bar mkt-pal-bar--tertiary"></div></div>
          <div class="mkt-pal-pct">38%</div>
        </div>` : ''}
      </div>
    </div>`;
  root.appendChild(bento);

  // Features — gradient header cards
  const features = div('features-grid');
  [
    { title: 'Instant palette generation', desc: 'Five algorithms. Every color theory model. One click to a production-ready scale.', icon: sparkIcon(),  color: 'accent' },
    { title: 'Real-time preview',          desc: 'Watch every component update as you move the color picker. No lag, no stale previews.', icon: eyeIcon(),    color: 'secondary' },
    { title: 'Export anything',            desc: 'CSS variables, Tailwind config, SCSS, design tokens. Copy and paste into any stack.', icon: exportIcon(), color: 'tertiary' },
  ].forEach(f => {
    const card = div('feature-card');
    card.innerHTML = `
      <div class="feature-card-header feature-card-header--${f.color}">
        <div class="feature-icon-badge feature-icon-badge--${f.color}">${f.icon}</div>
      </div>
      <div class="feature-content">
        <div class="feature-title">${f.title}</div>
        <div class="feature-desc">${f.desc}</div>
      </div>`;
    features.appendChild(card);
  });
  root.appendChild(features);

  // Pricing — gradient top bars
  const pricing = div('pricing-grid');
  [
    { tier:'Starter', price:'$0',  period:'Free forever', features:['5 palettes','3 export formats','Community support'],                          cta:'Get started',    featured:false },
    { tier:'Pro',     price:'$12', period:'per month',    features:['Unlimited palettes','All 5 algorithms','Priority support','Team sharing'],    cta:'Start free trial', featured:true },
    { tier:'Team',    price:'$49', period:'per month',    features:['Everything in Pro','15 team members','SSO + SAML','Dedicated CSM'],           cta:'Contact sales',  featured:false, tertiary:true },
  ].forEach(p => {
    const card = div('pricing-card' + (p.featured ? ' pricing-card--featured' : '') + (p.tertiary ? ' pricing-card--tertiary' : ''));
    card.innerHTML = `
      ${p.featured ? '<div class="pricing-badge-featured">Most popular</div>' : ''}
      ${p.tertiary ? '<div class="pricing-badge-tertiary">Enterprise</div>' : ''}
      <div class="pricing-tier">${p.tier}</div>
      <div class="pricing-price"><span>$</span>${p.price.replace('$','')}</div>
      <div class="pricing-period">${p.period}</div>
      <ul class="pricing-features">
        ${p.features.map(f => `<li class="pricing-feature"><span class="pricing-feature-check">${checkIcon()}</span>${f}</li>`).join('')}
      </ul>
      <button class="pricing-cta${p.featured ? ' pricing-cta--featured' : ''}${p.tertiary ? ' pricing-cta--tertiary' : ''}">${p.cta}</button>`;
    pricing.appendChild(card);
  });
  root.appendChild(pricing);

  // Newsletter — gradient strip
  const newsletter = div('newsletter-strip');
  newsletter.innerHTML = `
    <div class="newsletter-orb newsletter-orb--1"></div>
    <div class="newsletter-orb newsletter-orb--2"></div>
    <div class="newsletter-text">
      <h3>Stay in the loop</h3>
      <p>Get design tips, palette ideas, and new feature updates.</p>
    </div>
    <div class="newsletter-form">
      <input class="newsletter-input" type="email" placeholder="you@company.com" aria-label="Email address">
      <button class="newsletter-btn">Subscribe</button>
    </div>`;
  root.appendChild(newsletter);

  return root;
}

/* ─── Forms ─── */
function forms() {
  const root = div('form-section');

  // Input types
  const inputsCard = div('form-card');
  inputsCard.innerHTML = `
    <div class="form-section-title">Input types</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label" for="pv-name">Full name</label>
        <input class="form-input" id="pv-name" type="text" placeholder="Jane Smith">
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-email">Email address</label>
        <input class="form-input" id="pv-email" type="email" placeholder="jane@example.com">
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-pass">Password</label>
        <input class="form-input" id="pv-pass" type="password" placeholder="••••••••">
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-role">Role</label>
        <select class="form-select" id="pv-role">
          <option>Designer</option>
          <option>Developer</option>
          <option>Product Manager</option>
        </select>
      </div>
      <div class="form-group form-group--full">
        <label class="form-label" for="pv-bio">Bio</label>
        <textarea class="form-textarea" id="pv-bio" placeholder="Tell us a bit about yourself…"></textarea>
      </div>
      <div class="form-group">
        <div class="form-label" style="margin-bottom:8px">Notifications</div>
        <div class="form-checkbox-group">
          <label class="form-check-label"><input class="form-check" type="checkbox" checked> Email notifications</label>
          <label class="form-check-label"><input class="form-check" type="checkbox"> Slack integration</label>
          <label class="form-check-label"><input class="form-check" type="checkbox"> Weekly digest</label>
        </div>
      </div>
      <div class="form-group">
        <div class="form-label" style="margin-bottom:8px">Plan</div>
        <div class="form-radio-group">
          <label class="form-radio-label"><input class="form-radio" type="radio" name="plan" checked> Free tier</label>
          <label class="form-radio-label"><input class="form-radio" type="radio" name="plan"> Pro — $12/mo</label>
          <label class="form-radio-label"><input class="form-radio" type="radio" name="plan"> Team — $49/mo</label>
        </div>
      </div>
      <div class="form-group">
        <div class="form-label" style="margin-bottom:10px">Settings</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="toggle-label">
            <span class="toggle-switch"><input type="checkbox" checked><span class="toggle-track"></span></span>
            Auto-save drafts
          </label>
          <label class="toggle-label">
            <span class="toggle-switch"><input type="checkbox"><span class="toggle-track"></span></span>
            Public profile
          </label>
        </div>
      </div>
      <div class="form-group form-group--full">
        <label class="form-label" for="pv-range">Budget (slider)</label>
        <input class="form-range" id="pv-range" type="range" min="0" max="100" value="42">
      </div>
      <div class="form-group form-group--full">
        <div class="search-wrap">
          ${icon('search', { size: 15, cls: 'search-icon' })}
          <input class="form-input search-input" type="search" placeholder="Search components…">
        </div>
      </div>
      <div class="form-group form-group--full">
        <div class="file-upload" tabindex="0" role="button" aria-label="Upload file">
          ${icon('cloud-upload', { size: 24, cls: 'file-upload-icon' })}
          <div>Drop files here or <span style="color:var(--accent);font-weight:600">browse</span></div>
          <div style="font-size:11px;margin-top:4px">PNG, JPG, PDF up to 10MB</div>
        </div>
      </div>
    </div>`;
  root.appendChild(inputsCard);

  // Validation states
  const validCard = div('form-card');
  validCard.innerHTML = `
    <div class="form-section-title">Validation states</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label" for="pv-default">Default</label>
        <input class="form-input" id="pv-default" type="text" placeholder="Unfocused field">
        <span class="form-helper">Helper text goes here</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-focused">Focused</label>
        <input class="form-input" id="pv-focused" type="text" placeholder="Active field" style="border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in oklch, var(--accent) 18%, transparent)">
        <span class="form-helper">This field is focused</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-error">Error</label>
        <input class="form-input form-input--error" id="pv-error" type="email" value="not-an-email">
        <span class="form-helper form-helper--error">Please enter a valid email address</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="pv-success">Success</label>
        <input class="form-input form-input--success" id="pv-success" type="text" value="jane.smith">
        <span class="form-helper form-helper--success">Username is available!</span>
      </div>
    </div>`;
  root.appendChild(validCard);

  // Button gallery
  const btnCard = div('form-card');
  btnCard.innerHTML = `
    <div class="form-section-title">Button gallery</div>
    <div class="btn-gallery">
      <div class="btn-row">
        <button class="pvw-btn pvw-btn--primary pvw-btn--sm">Small</button>
        <button class="pvw-btn pvw-btn--primary pvw-btn--md">Medium</button>
        <button class="pvw-btn pvw-btn--primary pvw-btn--lg">Large primary</button>
      </div>
      <div class="btn-row">
        <button class="pvw-btn pvw-btn--brand2 pvw-btn--md">Secondary brand</button>
        <button class="pvw-btn pvw-btn--brand3 pvw-btn--md">Tertiary brand</button>
        <button class="pvw-btn pvw-btn--ghost pvw-btn--md">Ghost</button>
      </div>
      <div class="btn-row">
        <button class="pvw-btn pvw-btn--secondary pvw-btn--md">Outline</button>
        <button class="pvw-btn pvw-btn--destructive pvw-btn--md">Delete</button>
        <button class="pvw-btn pvw-btn--success pvw-btn--md">Approve</button>
      </div>
      <div class="btn-row">
        <button class="pvw-btn pvw-btn--primary pvw-btn--md" disabled>Disabled</button>
        <button class="pvw-btn pvw-btn--secondary pvw-btn--md" disabled>Disabled</button>
        <button class="pvw-btn pvw-btn--primary pvw-btn--md pvw-btn--loading" aria-label="Loading…" style="min-width:100px">&nbsp;</button>
      </div>
    </div>`;
  root.appendChild(btnCard);

  return root;
}

/* ─── Components (includes dashboard KPIs + charts at the top) ─── */
function components(state = {}) {
  const hasS = !!state.showSecondaryBrand;
  const hasT = !!state.showTertiaryBrand;
  const root = div('');

  // ── Dashboard: KPI row ──
  const kpiRow = div('dash-kpi-row');
  const kpis = [
    { label: 'Total Revenue', value: '$142,891', trend: '+12.4%', up: true,  variant: 'kpi-card--accent',    sparkColor: 'var(--accent)' },
    { label: 'Active Users',  value: '28,349',   trend: '+8.1%',  up: true,  variant: 'kpi-card--secondary', sparkColor: 'var(--secondary, var(--accent))' },
    { label: 'Conversion',    value: '3.62%',    trend: '-0.4%',  up: false, variant: 'kpi-card--tertiary',  sparkColor: 'var(--tertiary, var(--accent))' },
    { label: 'Avg Session',   value: '4m 28s',   trend: '+0.7%',  up: true },
  ];
  kpis.forEach(k => kpiRow.appendChild(kpiCard(k)));
  root.appendChild(kpiRow);

  // ── Dashboard: Charts row ──
  const chartsRow = div('dash-charts-row');
  chartsRow.appendChild(barChartCard(hasS, hasT));
  chartsRow.appendChild(donutCard(hasS, hasT));
  root.appendChild(chartsRow);

  // ── Dashboard: Activity + status ──
  const dashBottom = div('preview-grid preview-grid--2');
  dashBottom.style.cssText = 'gap:14px;margin-bottom:20px';
  dashBottom.appendChild(activityCard());
  dashBottom.appendChild(statusSummaryCard());
  root.appendChild(dashBottom);

  // Alerts
  const alertCard = div('card');
  alertCard.style.marginBottom = '20px';
  alertCard.innerHTML = `
    <div class="form-section-title" style="margin-bottom:12px">Alerts</div>
    <div class="alerts-section">
      <div class="alert alert--info">
        ${icon('info', { size: 16, cls: 'alert-icon alert-icon--info' })}
        <div class="alert-body"><div class="alert-title alert-title--info">System maintenance scheduled</div><div class="alert-desc">We'll be performing maintenance on Saturday, June 14 from 2–4 AM UTC. Expect brief service interruptions.</div></div>
        <button class="alert-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="alert alert--success">
        ${icon('circle-check', { size: 16, cls: 'alert-icon alert-icon--success' })}
        <div class="alert-body"><div class="alert-title alert-title--success">Deployment successful</div><div class="alert-desc">Version 3.2.1 is now live. All health checks passed with zero errors.</div></div>
        <button class="alert-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="alert alert--warning">
        ${icon('triangle-alert', { size: 16, cls: 'alert-icon alert-icon--warning' })}
        <div class="alert-body"><div class="alert-title alert-title--warning">Storage approaching limit</div><div class="alert-desc">You're using 87% of your 50GB quota. Upgrade to Pro to avoid service disruption.</div></div>
        <button class="alert-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="alert alert--error">
        ${icon('circle-x', { size: 16, cls: 'alert-icon alert-icon--error' })}
        <div class="alert-body"><div class="alert-title alert-title--error">Payment failed</div><div class="alert-desc">Your card ending in 4242 was declined. Update your billing information to continue.</div></div>
        <button class="alert-dismiss" aria-label="Dismiss">×</button>
      </div>
    </div>`;
  root.appendChild(alertCard);

  // Modal inline + Tabs
  const midRow = div('preview-grid preview-grid--2');
  midRow.style.gap = '14px';
  midRow.style.marginBottom = '20px';

  const modalCard = div('card');
  modalCard.innerHTML = `
    <div class="form-section-title" style="margin-bottom:12px">Modal preview</div>
    <div class="modal-preview-wrap">
      <div class="modal-preview-backdrop">
        <div class="modal-backdrop-orb modal-backdrop-orb--1"></div>
        <div class="modal-backdrop-orb modal-backdrop-orb--2"></div>
        <div class="modal-backdrop-orb modal-backdrop-orb--3"></div>
        <span class="modal-backdrop-text">Content behind modal</span>
      </div>
      <div class="modal-preview-overlay">
        <div class="modal-inline-card">
          <div class="modal-inline-header">
            <span class="modal-inline-title">Confirm deletion</span>
            <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;line-height:1">×</button>
          </div>
          <div class="modal-inline-body">This will permanently delete the workspace and all associated data. This action cannot be undone.</div>
          <div class="modal-inline-footer">
            <button class="pvw-btn pvw-btn--ghost pvw-btn--sm">Cancel</button>
            <button class="pvw-btn pvw-btn--destructive pvw-btn--sm">Delete workspace</button>
          </div>
        </div>
      </div>
    </div>`;
  midRow.appendChild(modalCard);

  const tabsCard = div('card');
  tabsCard.innerHTML = `
    <div class="form-section-title" style="margin-bottom:12px">Tabs</div>
    <div class="tabs-component">
      <div class="tabs-strip">
        <button class="tab-component-btn tab-component-btn--active">Overview</button>
        <button class="tab-component-btn">Analytics</button>
        <button class="tab-component-btn">Settings</button>
      </div>
      <div class="tab-component-content">
        Your workspace overview will appear here. Switch tabs to explore analytics and configuration options.
      </div>
    </div>
    <div class="form-section-title" style="margin-top:20px;margin-bottom:10px">Chips &amp; badges</div>
    <div class="chips-row">
      <button class="chip chip--active">All</button>
      <button class="chip">Design</button>
      <button class="chip">Engineering</button>
      <button class="chip">Marketing</button>
    </div>
    <div class="chips-row" style="margin-top:8px">
      <span class="badge badge--brand">Brand</span>
      <span class="badge badge--secondary">Secondary</span>
      <span class="badge badge--tertiary">Tertiary</span>
      <span class="badge badge--success">Live</span>
      <span class="badge badge--warning">Review</span>
      <span class="badge badge--error">Blocked</span>
    </div>`;
  midRow.appendChild(tabsCard);
  root.appendChild(midRow);

  // Avatar + Progress + Skeleton
  const bottomRow = div('preview-grid preview-grid--2');
  bottomRow.style.gap = '14px';

  const avatarProgressCard = div('card');
  avatarProgressCard.innerHTML = `
    <div class="form-section-title" style="margin-bottom:12px">Avatars &amp; Progress</div>
    <div class="avatar-group">
      <div class="avatar-stack">
        <div class="avatar avatar--brand">AJ</div>
        <div class="avatar avatar--secondary">SK</div>
        <div class="avatar avatar--tertiary">MR</div>
        <div class="avatar avatar--success">LP</div>
        <div class="avatar-count">+8</div>
      </div>
      <span style="font-size:12px;color:var(--text-muted)">12 team members</span>
    </div>
    <div class="progress-section">
      <div class="progress-item">
        <div class="progress-header"><span>Website rebuild</span><span>78%</span></div>
        <div class="progress-track"><div class="progress-fill progress-fill--brand" style="width:78%"></div></div>
      </div>
      <div class="progress-item">
        <div class="progress-header"><span>API migration</span><span>92%</span></div>
        <div class="progress-track"><div class="progress-fill progress-fill--secondary" style="width:92%"></div></div>
      </div>
      <div class="progress-item">
        <div class="progress-header"><span>Design audit</span><span>41%</span></div>
        <div class="progress-track"><div class="progress-fill progress-fill--tertiary" style="width:41%"></div></div>
      </div>
      <div class="progress-item">
        <div class="progress-header"><span>Auth rewrite</span><span>15%</span></div>
        <div class="progress-track"><div class="progress-fill progress-fill--error" style="width:15%"></div></div>
      </div>
    </div>`;
  bottomRow.appendChild(avatarProgressCard);

  const skeletonToastCard = div('card');
  skeletonToastCard.style.position = 'relative';
  skeletonToastCard.innerHTML = `
    <div class="form-section-title" style="margin-bottom:12px">Skeleton loaders</div>
    <div class="skeleton-section">
      ${[1,2].map(() => `
        <div class="skeleton-card">
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-lines">
              <div class="skeleton-line" style="width:75%"></div>
              <div class="skeleton-line skeleton-line--sm"></div>
            </div>
          </div>
          <div class="skeleton-line" style="width:100%;margin-bottom:6px"></div>
          <div class="skeleton-line" style="width:88%;margin-bottom:6px"></div>
          <div class="skeleton-line skeleton-line--sm"></div>
        </div>`).join('')}
    </div>
    <div class="form-section-title" style="margin-bottom:10px">Toasts</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="toast-preview toast-preview--success">
        ${icon('circle-check', { size: 14, cls: 'toast-preview-icon' })}
        Changes saved successfully
      </div>
      <div class="toast-preview toast-preview--warning">
        ${icon('triangle-alert', { size: 14, cls: 'toast-preview-icon' })}
        Free storage is almost full
      </div>
      <div class="toast-preview toast-preview--error">
        ${icon('circle-x', { size: 14, cls: 'toast-preview-icon' })}
        Network error — please retry
      </div>
      <div class="toast-preview toast-preview--info">
        ${icon('info', { size: 14, cls: 'toast-preview-icon' })}
        New version 3.3 available
      </div>
    </div>`;
  bottomRow.appendChild(skeletonToastCard);
  root.appendChild(bottomRow);

  return root;
}

/* ─── Typography preview ─── */
function typographyPreview() {
  const t     = getTypography();
  const scale = buildScaleData(t.scaleMethod, t.baseSize, t.steps, t.baseStep);
  const css   = buildTypographyCSS(t.heading, t.body, scale);
  const root  = div('typo-preview');

  /* —— Fonts + scale badge row —— */
  const header = div('typo-header');
  header.innerHTML = `
    <div class="typo-badge-row">
      <span class="typo-badge typo-badge--heading" style="font-family:'${t.heading}',serif">
        ${t.heading}
      </span>
      <span class="typo-badge-plus">+</span>
      <span class="typo-badge typo-badge--body" style="font-family:'${t.body}',sans-serif">
        ${t.body}
      </span>
    </div>
    <div class="typo-scale-badge">
      ${SCALE_METHODS[t.scaleMethod]?.name || t.scaleMethod} · ${t.baseSize}px base · ${t.steps} steps
    </div>`;
  root.appendChild(header);

  /* —— Scale ruler (largest → smallest) —— */
  const scaleSection = div('typo-scale-section');
  scaleSection.innerHTML = '<div class="typo-section-label">Type Scale</div>';
  const rows = div('typo-scale-rows');
  [...scale].reverse().forEach(step => {
    const isHeading = step.px >= t.baseSize * 1.2;
    const row = div('typo-scale-row');
    row.innerHTML = `
      <span class="typo-step-label">${step.label}</span>
      <span class="typo-step-sample" style="
        font-size: ${step.px}px;
        font-family: ${isHeading ? `'${t.heading}',serif` : `'${t.body}',sans-serif`};
        line-height: ${step.lineHeight};
        letter-spacing: ${step.letterSpacing}em;
        font-weight: ${isHeading ? 700 : 400};
      ">Aa</span>
      <span class="typo-step-meta">${step.px}px · ${step.rem}rem · lh ${step.lineHeight} · ls ${step.letterSpacing >= 0 ? '+' : ''}${step.letterSpacing}em</span>`;
    rows.appendChild(row);
  });
  scaleSection.appendChild(rows);
  root.appendChild(scaleSection);

  /* —— Heading specimen —— */
  const specimenSection = div('typo-specimen-section');
  specimenSection.innerHTML = '<div class="typo-section-label">Heading specimen</div>';
  const hSpec = div('typo-hspec');
  const headingSteps = [...scale].reverse().slice(0, Math.min(6, scale.length));
  headingSteps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = 'typo-hspec-row';
    el.innerHTML = `
      <span class="typo-hspec-tag">H${i + 1}</span>
      <span style="
        font-size: ${step.px}px;
        font-family: '${t.heading}', Georgia, serif;
        line-height: ${step.lineHeight};
        letter-spacing: ${step.letterSpacing}em;
        font-weight: ${i < 2 ? 800 : i < 4 ? 700 : 600};
        color: var(--text-primary);
      ">The quick brown fox jumps</span>`;
    hSpec.appendChild(el);
  });
  specimenSection.appendChild(hSpec);
  root.appendChild(specimenSection);

  /* —— Body specimen —— */
  const bodySection = div('typo-body-section');
  bodySection.innerHTML = '<div class="typo-section-label">Body specimen</div>';
  const baseStep = scale[t.baseStep] || scale[Math.floor(scale.length / 2)];
  const smStep   = scale[Math.max(0, t.baseStep - 1)] || baseStep;
  bodySection.innerHTML += `
    <div class="typo-body-card">
      <p class="typo-body-headline" style="
        font-family:'${t.heading}',Georgia,serif;
        font-size:${(scale[t.baseStep + 2] || headingSteps[3] || baseStep).px}px;
        font-weight:700;
        line-height:${(scale[t.baseStep + 2] || headingSteps[3] || baseStep).lineHeight};
        letter-spacing:${(scale[t.baseStep + 2] || headingSteps[3] || baseStep).letterSpacing}em;
      ">Typography shapes how ideas feel</p>
      <p class="typo-body-para" style="
        font-family:'${t.body}',system-ui,sans-serif;
        font-size:${baseStep.px}px;
        line-height:${baseStep.lineHeight};
      ">Typography is the art and technique of arranging type to make written
language legible, readable, and appealing. Good type choices establish
hierarchy and guide the eye through information effortlessly.</p>
      <p class="typo-body-caption" style="
        font-family:'${t.body}',system-ui,sans-serif;
        font-size:${smStep.px}px;
        line-height:${smStep.lineHeight};
        letter-spacing:${smStep.letterSpacing}em;
      ">Caption — supporting text, labels, metadata and secondary information
use smaller sizes with slightly increased tracking for legibility.</p>
    </div>`;
  root.appendChild(bodySection);

  /* —— CSS output —— */
  const cssSection = div('typo-css-section');
  cssSection.innerHTML = `
    <div class="typo-section-label typo-css-header">
      Generated CSS
      <button class="typo-copy-btn" id="typo-copy-btn" aria-label="Copy CSS variables">
        ${icon('copy', { size: 13 })} Copy
      </button>
    </div>
    <pre class="typo-css-code">${_escapeHtml(css)}</pre>`;
  root.appendChild(cssSection);

  /* Wire copy button */
  requestAnimationFrame(() => {
    document.getElementById('typo-copy-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(css);
        const btn = document.getElementById('typo-copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.innerHTML = `${icon('copy', { size: 13 })} Copy`; }, 1800); }
      } catch {}
    });
  });

  return root;
}

function _escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ─── Helpers ─── */
function div(cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  return d;
}
function arrowUp()    { return icon('arrow-up',       { size: 12 }); }
function arrowDown()  { return icon('arrow-down',     { size: 12 }); }
function arrowRight() { return icon('arrow-right',    { size: 14 }); }
function checkIcon()  { return icon('check',          { size: 13 }); }
function sparkIcon()  { return icon('sparkles',       { size: 18 }); }
function eyeIcon()    { return icon('eye',            { size: 18 }); }
function exportIcon() { return icon('upload',         { size: 18 }); }
