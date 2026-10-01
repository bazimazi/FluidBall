import type { Camera } from './camera';

/** Procedural art: stable world-space seeds keep scenery from popping while the camera moves. */
export interface Palette {
  sky: string;
  horizon: string;
  haze: string;
  ridge: string;
  near: string;
  light: string;
  grass: string;
}

const origin: Palette = { sky: '#071923', horizon: '#35696a', haze: '#80c9b4', ridge: '#244c55', near: '#153b43', light: '#b6f3d0', grass: '#72c5a4' };
export const PALETTES: Record<string, Palette> = {
  'The Origin': origin,
  'The Deep': { sky: '#041426', horizon: '#175c78', haze: '#55bad2', ridge: '#164455', near: '#0a3048', light: '#9ceaff', grass: '#50aec4' },
  'The Slipper': { sky: '#17112b', horizon: '#665080', haze: '#b299d9', ridge: '#463653', near: '#2e2745', light: '#e1bdff', grass: '#bc88dc' },
  'The Core': { sky: '#200e20', horizon: '#a54a3d', haze: '#eea66b', ridge: '#633343', near: '#3d2434', light: '#ffd598', grass: '#e59868' },
  'The Void': { sky: '#070d20', horizon: '#343766', haze: '#8f99da', ridge: '#222942', near: '#171f36', light: '#a1eaff', grass: '#798bd2' },
  'The Sinking Lands': { sky: '#121e21', horizon: '#637252', haze: '#b2c090', ridge: '#394e42', near: '#243b34', light: '#e0e9ae', grass: '#9fad6c' },
  'The Sky': { sky: '#153a59', horizon: '#91babe', haze: '#dceaca', ridge: '#56838b', near: '#386775', light: '#f2f4cf', grass: '#a6d7c4' },
  Laboratory: origin,
};

export const seed = (n: number): number => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, opacity = 1): void {
  ctx.save();
  ctx.globalAlpha *= opacity;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function drawScenery(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, region: string, time: number, reduced: boolean): void {
  const p = PALETTES[region] ?? origin;
  const t = reduced ? 0 : time;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, p.sky);
  sky.addColorStop(0.65, p.horizon);
  sky.addColorStop(1, p.near);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // A distant eclipsed moon and its fine orbital halo.
  const mx = w * 0.73 - cam.pos.x * 0.012;
  const my = h * 0.25 - cam.pos.y * 0.015;
  const mr = Math.min(w, h) * 0.087;
  glow(ctx, mx, my, mr * 3.7, p.light, 0.17);
  ctx.save();
  ctx.fillStyle = p.light;
  ctx.globalAlpha = 0.67;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.horizon;
  ctx.beginPath(); ctx.arc(mx + mr * 0.38, my - mr * 0.22, mr * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = p.light;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.17;
  ctx.beginPath(); ctx.ellipse(mx, my, mr * 1.7, mr * 1.3, -0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  for (let i = 0; i < (reduced ? 24 : 65); i++) {
    const x = ((seed(i) * (w + 60) - cam.pos.x * 0.025) % (w + 60) + w + 60) % (w + 60);
    const y = seed(i + 120) * h * 0.65;
    ctx.globalAlpha = (0.15 + seed(i + 9) * 0.45) * (0.8 + Math.sin(t + i) * 0.2);
    ctx.fillStyle = p.light;
    ctx.fillRect(x, y, seed(i + 3) > 0.92 ? 2 : 1, seed(i + 3) > 0.92 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // Each region has its own atmosphere in addition to its palette.
  ctx.save();
  if (region === 'The Sky') {
    for (let i = 0; i < 7; i++) {
      const x = ((seed(i + 700) * (w + 400) - cam.pos.x * 0.09 + t * 3) % (w + 400) + w + 400) % (w + 400) - 200;
      const y = h * (0.18 + seed(i + 720) * 0.55);
      ctx.fillStyle = p.light; ctx.globalAlpha = 0.07;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath(); ctx.ellipse(x + j * 46, y - Math.sin(j) * 14, 76, 16 + seed(i + j) * 12, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (region === 'The Void' || region === 'The Slipper') {
    for (let i = 0; i < 9; i++) {
      const x = ((seed(i + 500) * (w + 100) - cam.pos.x * 0.12) % (w + 100) + w + 100) % (w + 100);
      const y = h * (0.15 + seed(i + 510) * 0.6) + Math.sin(t * 0.4 + i) * 8;
      const size = 10 + seed(i + 520) * 26;
      ctx.fillStyle = p.ridge; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * 0.4, y); ctx.lineTo(x, y + size * 1.3); ctx.lineTo(x - size * 0.3, y); ctx.fill();
      ctx.strokeStyle = p.light; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
    }
  } else if (region === 'The Deep') {
    for (let i = 0; i < 6; i++) {
      const x = ((seed(i + 610) * (w + 100) - cam.pos.x * 0.14) % (w + 100) + w + 100) % (w + 100);
      const y = h * (0.22 + seed(i + 640) * 0.5) + Math.sin(t * 0.6 + i) * 12;
      ctx.globalAlpha = 0.1; ctx.fillStyle = p.light; ctx.strokeStyle = p.light; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, 14, 10, 0, Math.PI, Math.PI * 2); ctx.fill();
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath(); ctx.moveTo(x + j * 6, y); ctx.bezierCurveTo(x + j * 6 + 7, y + 10, x + j * 6 - 7, y + 16, x + j * 6 + Math.sin(t + i) * 5, y + 29); ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Long, translucent curtains of light.
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + i * 0.24) + Math.sin(t * 0.08 + i) * 30;
    const light = ctx.createLinearGradient(x, 0, x - 180, h);
    light.addColorStop(0, p.light + '00');
    light.addColorStop(0.45, p.light + '09');
    light.addColorStop(1, p.light + '00');
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 65, 0); ctx.lineTo(x - 120, h); ctx.lineTo(x - 320, h); ctx.fill();
  }
  ctx.restore();

  for (let layer = 0; layer < 3; layer++) {
    const spacing = 160 - layer * 20;
    const scroll = cam.pos.x * (0.08 + layer * 0.075);
    const baseline = h * (0.57 + layer * 0.14) - cam.pos.y * (0.025 + layer * 0.025);
    ctx.fillStyle = [p.ridge, p.near, p.sky][layer];
    ctx.globalAlpha = [0.55, 0.65, 0.45][layer];
    ctx.beginPath(); ctx.moveTo(-spacing, h);
    for (let i = Math.floor(scroll / spacing) - 2; i < (scroll + w) / spacing + 2; i++) {
      const x = i * spacing - scroll;
      const y = baseline - seed(i + layer * 40) * h * (0.15 + layer * 0.035);
      ctx.lineTo(x, y);
      ctx.lineTo(x + spacing * 0.3, y - seed(i + 31) * 65);
      ctx.lineTo(x + spacing * 0.65, y + 28);
    }
    ctx.lineTo(w + spacing, h); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Broken monoliths, small enough in contrast to stay behind gameplay.
  const scroll = cam.pos.x * 0.19;
  for (let i = Math.floor(scroll / 360) - 1; i < (scroll + w) / 360 + 1; i++) {
    const x = i * 360 - scroll + seed(i) * 80;
    const y = h * 0.74 - cam.pos.y * 0.04;
    const tall = 70 + seed(i + 71) * 140;
    ctx.fillStyle = p.near; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 10, y - tall);
    ctx.lineTo(x + 4, y - tall - 9); ctx.lineTo(x + 19, y - tall + 5); ctx.lineTo(x + 23, y); ctx.fill();
    ctx.fillStyle = p.light; ctx.globalAlpha = 0.22;
    ctx.fillRect(x + 3, y - tall + 20, 2, 24);
  }
  ctx.globalAlpha = 1;

  if (!reduced) {
    for (let i = 0; i < 24; i++) {
      const x = ((seed(i + 300) * w - cam.pos.x * 0.4 + Math.sin(t * 0.22 + i) * 28) % w + w) % w;
      const y = region === 'The Core'
        ? h - ((seed(i + 320) * h + t * (15 + seed(i) * 20)) % h)
        : h * (0.3 + seed(i + 320) * 0.65) + Math.sin(t * 0.4 + i * 2) * 16;
      glow(ctx, x, y, 9, p.light, 0.09 + Math.sin(t * 1.2 + i) * 0.06);
      ctx.fillStyle = p.light + '80';
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  vignette.addColorStop(0, '#020b1200'); vignette.addColorStop(1, '#020b1280');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
}

/** Small living silhouettes rooted to the actual terrain. */
export function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, p: Palette): void {
  const height = 10 + seed(s) * 27;
  const bend = Math.sin(t * 1.4 + s) * 3;
  ctx.strokeStyle = p.grass + '90'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend, y - height * 0.6, x + bend + 3, y - height); ctx.stroke();
  for (let j = 0; j < 3; j++) {
    const yy = y - height * (0.25 + j * 0.22);
    const side = j % 2 ? -1 : 1;
    ctx.fillStyle = p.grass + (j === 2 ? 'bc' : '60');
    ctx.beginPath(); ctx.ellipse(x + side * 4 + bend * 0.5, yy, 6, 2, side * -0.6, 0, Math.PI * 2); ctx.fill();
  }
  if (seed(s + 12) > 0.65) {
    glow(ctx, x + bend + 3, y - height, 12, p.light, 0.22);
    ctx.fillStyle = p.light;
    ctx.beginPath(); ctx.arc(x + bend + 3, y - height, 2, 0, Math.PI * 2); ctx.fill();
  }
}
