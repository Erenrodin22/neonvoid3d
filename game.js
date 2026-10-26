// NEON VOID - a top-down wave survival shooter. Vanilla JS + Canvas, zero dependencies.
(() => {
'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W, H;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// ---------- Input ----------
const keys = {}, mouse = { x: 0, y: 0, down: false };
let state = 'menu';
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (state === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pickUpgrade(+e.code[5] - 1);
  if ((state === 'menu' || state === 'over') && e.code === 'Enter') start();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mousedown', e => {
  mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
  if (state === 'menu' || state === 'over') start();
  else if (state === 'upgrade') {
    cardRects().forEach((r, i) => {
      if (mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h) pickUpgrade(i);
    });
  }
});
addEventListener('mouseup', () => mouse.down = false);

// ---------- Audio (procedural, no assets) ----------
let ac = null;
function ensureAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }
function sfx(f, d, type = 'square', v = 0.04, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
}

// ---------- Game state ----------
let best = +localStorage.getItem('neonvoid_best') || 0;
let P, bullets, eb, en, parts, picks, wave, score, combo, comboT, queue, spawnT, shake, upOpts = [], banner = 0, time = 0;

const UPGRADES = [
  { n: 'Overcharge',   d: 'Bullet damage +30%',        f: p => p.dmg *= 1.3 },
  { n: 'Rapid Fire',   d: 'Fire rate +25%',            f: p => p.rate *= 0.8 },
  { n: 'Multishot',    d: '+1 projectile per shot',    f: p => p.multi++ },
  { n: 'Thrusters',    d: 'Move speed +12%',           f: p => p.spd *= 1.12 },
  { n: 'Hull Plating', d: 'Max HP +2 and full repair', f: p => { p.max += 2; p.hp = p.max; } },
  { n: 'Piercing',     d: 'Bullets pierce +1 enemy',   f: p => p.pierce++ },
  { n: 'Phase Drive',  d: 'Dash cooldown -25%',        f: p => p.dashCd *= 0.75 },
  { n: 'Magnet',       d: 'Pickup pull range +80',     f: p => p.magnet += 80 },
];

function reset() {
  P = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 12, hp: 5, max: 5, spd: 260, dmg: 1, rate: 0.18, cd: 0,
        multi: 1, pierce: 0, dashCd: 1.6, dashT: 0, inv: 0, ang: 0, magnet: 80 };
  bullets = []; eb = []; en = []; parts = []; picks = [];
  wave = 0; score = 0; combo = 1; comboT = 0; queue = 0; spawnT = 0; shake = 0;
}
function start() { ensureAudio(); reset(); nextWave(); state = 'play'; sfx(440, 0.3, 'sine', 0.06, 440); }
reset();

function nextWave() {
  wave++; banner = 2.2; queue = 4 + wave * 3;
  if (wave % 5 === 0) { spawn('boss'); queue = Math.floor(queue / 2); }
}

// ---------- Spawning ----------
function spawn(type) {
  const side = Math.floor(Math.random() * 4), m = 40;
  let x = Math.random() * W, y = Math.random() * H;
  if (side === 0) y = -m; else if (side === 1) y = H + m; else if (side === 2) x = -m; else x = W + m;
  const s = 1 + wave * 0.08;
  const T = {
    chaser:  { r: 12, hp: 2 * s,        spd: 110 + wave * 4, col: '#ff3366', pts: 10 },
    shooter: { r: 14, hp: 4 * s,        spd: 70,             col: '#ffb020', pts: 25 },
    tank:    { r: 24, hp: 14 + wave * 1.5, spd: 55,          col: '#a855ff', pts: 50 },
    boss:    { r: 52, hp: 80 + wave * 12,  spd: 45,          col: '#00ffa3', pts: 500 },
  }[type];
  en.push({ x, y, type, hp: T.hp, max: T.hp, r: T.r, spd: T.spd, col: T.col, pts: T.pts, cd: 1 + Math.random(), cd2: 4, rot: 0, flash: 0 });
}
function spawnRoll() {
  const r = Math.random();
  if (wave >= 3 && r < 0.12) return 'tank';
  if (wave >= 2 && r < 0.32) return 'shooter';
  return 'chaser';
}

// ---------- Effects ----------
function burst(x, y, col, n = 14, sp = 220, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = Math.random() * sp;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.4 + Math.random() * 0.6), max: life, col, sz: 1.5 + Math.random() * 2.5 });
  }
}
function hurt() {
  if (P.inv > 0 || state !== 'play') return;
  P.hp--; P.inv = 1; shake = 16; combo = 1; comboT = 0;
  burst(P.x, P.y, '#ff3366', 24, 300);
  sfx(160, 0.35, 'sawtooth', 0.07, -100);
  if (P.hp <= 0) {
    state = 'over'; burst(P.x, P.y, '#00e5ff', 60, 450, 1.2); sfx(120, 0.8, 'sawtooth', 0.08, -90);
    if (score > best) { best = Math.floor(score); try { localStorage.setItem('neonvoid_best', best); } catch (e) {} }
  }
}
function kill(e) {
  e.dead = true;
  burst(e.x, e.y, e.col, e.type === 'boss' ? 80 : 18, e.type === 'boss' ? 500 : 240);
  shake = Math.max(shake, e.type === 'boss' ? 28 : 5);
  score += e.pts * combo; combo = Math.min(combo + 0.1, 8); comboT = 2.5;
  sfx(300 + Math.random() * 100, 0.15, 'triangle', 0.05, -200);
  if (Math.random() < 0.1 || e.type === 'boss') picks.push({ x: e.x, y: e.y });
  if (e.type === 'boss') for (let i = 0; i < 3; i++) picks.push({ x: e.x + (Math.random() - 0.5) * 80, y: e.y + (Math.random() - 0.5) * 80 });
}

// ---------- Upgrades ----------
function cardRects() {
  const w = Math.min(230, (W - 80) / 3), g = 22, tot = w * 3 + g * 2, x0 = W / 2 - tot / 2;
  return [0, 1, 2].map(i => ({ x: x0 + i * (w + g), y: H / 2 - 110, w, h: 220 }));
}
function openUpgrades() {
  state = 'upgrade';
  upOpts = UPGRADES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  if (P.hp < P.max) P.hp++;
}
function pickUpgrade(i) {
  if (!upOpts[i]) return;
  upOpts[i].f(P); sfx(660, 0.25, 'sine', 0.06, 300);
  P.inv = 1.2; state = 'play'; nextWave();
}

// ---------- Update ----------
function update(dt) {
  time += dt;
  if (state === 'play') {
    // movement
    let ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let ay = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    const k = Math.min(1, 10 * dt);
    P.vx += (ax * P.spd - P.vx) * k; P.vy += (ay * P.spd - P.vy) * k;
    if (keys.Space && P.dashT <= 0 && (ax || ay)) {
      P.vx = ax * 950; P.vy = ay * 950; P.dashT = P.dashCd; P.inv = Math.max(P.inv, 0.25);
      burst(P.x, P.y, '#00e5ff', 16, 160, 0.4); sfx(220, 0.2, 'sine', 0.06, 500);
    }
    P.dashT -= dt; P.inv -= dt;
    P.x = Math.max(P.r, Math.min(W - P.r, P.x + P.vx * dt));
    P.y = Math.max(P.r, Math.min(H - P.r, P.y + P.vy * dt));
    P.ang = Math.atan2(mouse.y - P.y, mouse.x - P.x);

    // shooting
    P.cd -= dt;
    if ((mouse.down || keys.KeyJ) && P.cd <= 0) {
      P.cd = P.rate;
      for (let i = 0; i < P.multi; i++) {
        const a = P.ang + (i - (P.multi - 1) / 2) * 0.14;
        bullets.push({ x: P.x + Math.cos(a) * 16, y: P.y + Math.sin(a) * 16, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 1.1, pierce: P.pierce, dmg: P.dmg, hit: new Set() });
      }
      sfx(700 + Math.random() * 80, 0.07, 'square', 0.015, -400);
    }

    // spawning & wave flow
    banner -= dt; spawnT -= dt;
    if (queue > 0 && spawnT <= 0) { spawn(spawnRoll()); queue--; spawnT = Math.max(0.22, 0.9 - wave * 0.04); }
    if (queue <= 0 && en.length === 0 && banner < 0.5) openUpgrades();
    comboT -= dt; if (comboT <= 0) combo = Math.max(1, combo - dt * 1.5);
  }

  // bullets
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of en) {
      if (e.dead || b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 4) {
        b.hit.add(e); e.hp -= b.dmg; e.flash = 0.08; sfx(200, 0.05, 'square', 0.015);
        burst(b.x, b.y, e.col, 3, 120, 0.3);
        if (e.hp <= 0) kill(e);
        if (b.pierce-- <= 0) { b.life = 0; break; }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

  // enemies
  for (const e of en) {
    if (e.dead) continue;
    e.flash -= dt; e.rot += dt;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (state !== 'play') continue;
    if (e.type === 'shooter') {
      const dir = d > 280 ? 1 : d < 200 ? -1 : 0;
      e.x += ux * e.spd * dir * dt; e.y += uy * e.spd * dir * dt;
      if ((e.cd -= dt) <= 0) { e.cd = 1.8; eb.push({ x: e.x, y: e.y, vx: ux * 260, vy: uy * 260 }); }
    } else if (e.type === 'boss') {
      if (d > 320) { e.x += ux * e.spd * dt; e.y += uy * e.spd * dt; }
      if ((e.cd -= dt) <= 0) {
        e.cd = 1.5; const n = 14, off = e.rot * 2;
        for (let i = 0; i < n; i++) { const a = off + i / n * 6.283; eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 }); }
        sfx(120, 0.25, 'sawtooth', 0.05, 80);
      }
      if ((e.cd2 -= dt) <= 0) { e.cd2 = 5; for (let i = 0; i < 3; i++) { spawn('chaser'); const c = en[en.length - 1]; c.x = e.x; c.y = e.y; } }
    } else { e.x += ux * e.spd * dt; e.y += uy * e.spd * dt; }
    if (d < e.r + P.r) { hurt(); P.vx -= ux * 300; P.vy -= uy * 300; }
  }
  en = en.filter(e => !e.dead);

  // enemy bullets
  for (const b of eb) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (state === 'play' && Math.hypot(P.x - b.x, P.y - b.y) < P.r + 5) { hurt(); b.dead = true; }
  }
  eb = eb.filter(b => !b.dead && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);

  // pickups
  for (const p of picks) {
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
    if (state === 'play' && d < P.magnet) { p.x += dx / d * 320 * dt; p.y += dy / d * 320 * dt; }
    if (state === 'play' && d < 20) { p.dead = true; if (P.hp < P.max) P.hp++; score += 50; sfx(880, 0.2, 'sine', 0.05, 400); burst(p.x, p.y, '#4dff88', 10, 150); }
  }
  picks = picks.filter(p => !p.dead);

  // particles
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  shake = Math.max(0, shake - 60 * dt);
}

// ---------- Rendering ----------
function poly(x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i / n * 6.283; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
function glow(col, blur = 16) { ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.strokeStyle = col; ctx.fillStyle = col; }
function text(s, x, y, size, col = '#fff', align = 'center') {
  ctx.shadowBlur = 0; ctx.fillStyle = col; ctx.textAlign = align;
  ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`; ctx.fillText(s, x, y);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // grid
  const gs = 60, ox = (-P.x * 0.06) % gs, oy = (-P.y * 0.06) % gs;
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(80,100,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = ox; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // pickups
  for (const p of picks) { glow('#4dff88', 18); ctx.lineWidth = 2; const s = 7 + Math.sin(time * 6) * 1.5;
    ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke(); }

  // particles
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 8; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
  ctx.globalAlpha = 1;

  // enemies
  ctx.lineWidth = 2.5;
  for (const e of en) {
    glow(e.flash > 0 ? '#ffffff' : e.col, 18);
    if (e.type === 'chaser') poly(e.x, e.y, e.r, 3, Math.atan2(P.y - e.y, P.x - e.x));
    else if (e.type === 'shooter') poly(e.x, e.y, e.r, 4, e.rot);
    else if (e.type === 'tank') poly(e.x, e.y, e.r, 6, e.rot * 0.5);
    else { poly(e.x, e.y, e.r, 8, e.rot); ctx.stroke(); poly(e.x, e.y, e.r * 0.55, 4, -e.rot * 2); }
    ctx.stroke();
    if (e.max > 3) { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
      ctx.fillStyle = e.col; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * Math.max(0, e.hp / e.max), 4); }
  }

  // enemy bullets
  glow('#ff5577', 14);
  for (const b of eb) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 6.283); ctx.fill(); }

  // player bullets
  glow('#00e5ff', 14); ctx.lineWidth = 3;
  for (const b of bullets) { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); ctx.stroke(); }

  // player
  if (state !== 'over' && !(P.inv > 0 && Math.floor(time * 20) % 2)) {
    glow('#00e5ff', 22); ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(P.x + Math.cos(P.ang) * 18, P.y + Math.sin(P.ang) * 18);
    ctx.lineTo(P.x + Math.cos(P.ang + 2.5) * 14, P.y + Math.sin(P.ang + 2.5) * 14);
    ctx.lineTo(P.x + Math.cos(P.ang - 2.5) * 14, P.y + Math.sin(P.ang - 2.5) * 14);
    ctx.closePath(); ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.shadowBlur = 0;

  // crosshair
  if (state === 'play') { ctx.strokeStyle = 'rgba(0,229,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, 6.283); ctx.stroke(); }

  // HUD
  if (state === 'play' || state === 'upgrade') {
    for (let i = 0; i < P.max; i++) { glow(i < P.hp ? '#ff3366' : '#333', i < P.hp ? 10 : 0); ctx.fillRect(20 + i * 22, 20, 16, 16); }
    ctx.shadowBlur = 0;
    text('SCORE ' + Math.floor(score), W - 20, 34, 22, '#fff', 'right');
    text('x' + combo.toFixed(1) + ' COMBO', W - 20, 58, 15, '#ffb020', 'right');
    text('WAVE ' + wave, W / 2, 34, 22, '#00e5ff');
    const r = Math.max(0, 1 - P.dashT / P.dashCd);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(20, 46, 130, 6);
    ctx.fillStyle = r >= 1 ? '#00e5ff' : '#3a6a88'; ctx.fillRect(20, 46, 130 * r, 6);
    text('DASH', 20, 70, 12, '#8aa', 'left');
    if (banner > 0 && state === 'play') {
      ctx.globalAlpha = Math.min(1, banner);
      text(wave % 5 === 0 ? 'BOSS WAVE ' + wave : 'WAVE ' + wave, W / 2, H / 2 - 120, 54, wave % 5 === 0 ? '#00ffa3' : '#fff');
      ctx.globalAlpha = 1;
    }
  }

  if (state === 'upgrade') {
    ctx.fillStyle = 'rgba(5,6,15,0.78)'; ctx.fillRect(0, 0, W, H);
    text('WAVE ' + wave + ' CLEARED', W / 2, H / 2 - 160, 40, '#00e5ff');
    text('Choose an upgrade  (click or press 1 / 2 / 3)', W / 2, H / 2 - 128, 16, '#9ab');
    cardRects().forEach((r, i) => {
      const hov = mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h;
      ctx.fillStyle = hov ? 'rgba(0,229,255,0.16)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      glow(hov ? '#00e5ff' : '#4455aa', hov ? 20 : 6); ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      text(String(i + 1), r.x + r.w / 2, r.y + 50, 36, '#00e5ff');
      text(upOpts[i].n, r.x + r.w / 2, r.y + 100, 22);
      const words = upOpts[i].d.split(' '); let line = '', y = r.y + 140;
      for (const w of words) { if ((line + w).length > 22) { text(line, r.x + r.w / 2, y, 14, '#9ab'); line = ''; y += 20; } line += w + ' '; }
      text(line, r.x + r.w / 2, y, 14, '#9ab');
    });
  }

  if (state === 'menu' || state === 'over') {
    ctx.fillStyle = 'rgba(5,6,15,0.7)'; ctx.fillRect(0, 0, W, H);
    glow('#00e5ff', 30); ctx.font = 'bold 84px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state === 'menu' ? 'NEON VOID' : 'SIGNAL LOST', W / 2, H / 2 - 70);
    if (state === 'over') text('Score ' + Math.floor(score) + '   |   Wave ' + wave, W / 2, H / 2 - 20, 26);
    text('Best: ' + best, W / 2, H / 2 + 14, 20, '#ffb020');
    text('WASD move   -   Mouse aim & shoot   -   SPACE dash (i-frames)', W / 2, H / 2 + 62, 16, '#9ab');
    ctx.globalAlpha = 0.6 + Math.sin(time * 4) * 0.4;
    text('Click or press ENTER to ' + (state === 'menu' ? 'start' : 'retry'), W / 2, H / 2 + 110, 22, '#fff');
    ctx.globalAlpha = 1;
  }
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
