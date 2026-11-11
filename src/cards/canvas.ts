import type { CardData } from './types';
import { fitSize, wrapLines, type Measure } from './layout';
import type { FindingStatus } from '../types';

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  navy: '#11172A', deep: '#0A0E1A', white: '#F3EFE4', yellow: '#EBCB55', pink: '#E9AFC0', red: '#D4262E',
  green: '#2F8F5B', amber: '#D98B2B', slate: '#8A93A8', ink: '#1A1A1A', brass: '#B8935A', brassHi: '#E2C38A',
};
const ON_PAPER: Record<string, string> = { KEPT: '#23704A', WATCH: '#8F5611', BREACHED: '#B01E25', UNVERIFIABLE: '#565E72', PENDING: '#565E72', RENEWED: '#23704A', EVICTED: '#B01E25', ACTIVE: '#6B4A14' };
const FONT = {
  display: '"Archivo Black", Impact, sans-serif',
  body: '"Courier Prime", "Courier New", monospace',
  data: '"IBM Plex Mono", ui-monospace, monospace',
  sign: '"Homemade Apple", cursive',
};

async function loadFonts() {
  await Promise.all([
    document.fonts.load(`40px "Archivo Black"`), document.fonts.load(`20px "Courier Prime"`),
    document.fonts.load(`italic 20px "Courier Prime"`), document.fonts.load(`20px "IBM Plex Mono"`),
    document.fonts.load(`20px "Homemade Apple"`),
  ]).catch(() => {});
  await document.fonts.ready;
}

type G = CanvasRenderingContext2D;

function measurer(g: G, family: string): Measure {
  return (t, s) => { g.font = `${s}px ${family}`; return g.measureText(t).width; };
}

function background(g: G) {
  g.fillStyle = C.navy; g.fillRect(0, 0, CARD_W, CARD_H);
  const lamp = g.createRadialGradient(180, 60, 20, 180, 60, 700);
  lamp.addColorStop(0, 'rgba(226,195,138,.28)'); lamp.addColorStop(1, 'rgba(226,195,138,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, CARD_W, CARD_H);
  // grain
  g.fillStyle = 'rgba(255,255,255,.025)';
  for (let i = 0; i < 1800; i++) g.fillRect((i * 7919) % CARD_W, (i * 104729) % CARD_H, 1.5, 1.5);
}

function logo(g: G) {
  g.save(); g.translate(40, 34); g.scale(0.11, 0.11); g.translate(-60, -120);
  g.fillStyle = C.brass;
  const ring = new Path2D('M168 140a116 116 0 1 1 0 232a116 116 0 1 1 0-232zm0 64a52 52 0 1 0 0 104a52 52 0 1 0 0-104z');
  g.fill(ring, 'evenodd');
  g.beginPath(); g.roundRect(262, 226, 186, 60, 14); g.roundRect(388, 262, 60, 110, 14); g.roundRect(320, 262, 44, 76, 12); g.fill();
  g.fillStyle = C.red; g.beginPath(); g.arc(168, 256, 20, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = C.white; g.font = `28px ${FONT.display}`; g.textBaseline = 'alphabetic';
  g.fillText('LEASE', 96, 68);
}

function footer(g: G, fp?: string) {
  g.fillStyle = C.slate; g.font = `20px ${FONT.data}`;
  const host = `${location.origin}${location.pathname}`.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const m = measurer(g, FONT.data);
  const size = fitSize(m, host, 620, 20, 12);
  g.font = `${size}px ${FONT.data}`; g.textAlign = 'left'; g.fillText(host, 40, CARD_H - 30);
  if (fp) { g.font = `20px ${FONT.data}`; g.textAlign = 'right'; g.fillText(fp, CARD_W - 40, CARD_H - 30); }
  g.textAlign = 'left';
}

function paper(g: G, x: number, y: number, w: number, h: number, rot: number, sheets = true) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  const draw = (dx: number, dy: number, r: number, fill: string) => {
    g.save(); g.rotate(r); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
    g.fillStyle = fill; g.fillRect(-w / 2 + dx, -h / 2 + dy, w, h); g.restore();
  };
  if (sheets) { draw(12, 12, 0.02, C.pink); draw(6, 6, -0.015, C.yellow); }
  draw(0, 0, 0, C.white);
  g.restore();
}

function stamp(g: G, text: string, cx: number, cy: number, color: string, size: number, rot: number, maxW = 9999) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  const m = measurer(g, FONT.display);
  const s = fitSize(m, text, maxW - size, size, 12);
  g.font = `${s}px ${FONT.display}`;
  const w = g.measureText(text).width + s * 0.9, h = s * 1.5;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = Math.max(2, s / 14);
  g.strokeRect(-w / 2, -h / 2, w, h); g.lineWidth = Math.max(1, s / 28); g.strokeRect(-w / 2 + s / 6, -h / 2 + s / 6, w - s / 3, h - s / 3);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2);
  g.restore(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

function text(g: G, str: string, x: number, y: number, o: { font: string; size: number; color: string; maxW: number; maxLines?: number; lh?: number; family: string; align?: CanvasTextAlign }) {
  const m = measurer(g, o.family);
  const lines = wrapLines(m, str, o.size, o.maxW, o.maxLines ?? 1);
  g.font = `${o.size}px ${o.family}`; g.fillStyle = o.color; g.textAlign = o.align ?? 'left';
  lines.forEach((l, i) => g.fillText(l, x, y + i * (o.lh ?? o.size * 1.3)));
  g.textAlign = 'left';
  return lines.length;
}

function fitText(g: G, str: string, x: number, y: number, maxW: number, start: number, min: number, family: string, color: string) {
  const s = fitSize(measurer(g, family), str, maxW, start, min);
  g.font = `${s}px ${family}`; g.fillStyle = color; g.fillText(str, x, y);
}

const short = (s: string) => (s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);

function drawReport(g: G, d: Extract<CardData, { kind: 'report' }>) {
  paper(g, 70, 120, 660, 420, -0.035);
  g.save(); g.translate(400, 330); g.rotate(-0.035); g.translate(-400, -330);
  fitText(g, d.ticker, 110, 215, 580, 64, 24, FONT.display, C.ink);
  g.font = `20px ${FONT.data}`; g.fillStyle = '#565E72'; g.fillText(short(d.mint), 110, 252);
  d.statuses.slice(0, 9).forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    stamp(g, s, 190 + col * 190, 320 + row * 82, ON_PAPER[s] ?? '#565E72', 22, -0.1, 175);
  });
  g.restore();
  const count = (s: FindingStatus) => d.statuses.filter((x) => x === s).length;
  const k = count('KEPT');
  stamp(g, `${k} KEPT`, 950, 300, C.green, 78, -0.1, 400);
  g.fillStyle = C.slate; g.font = `22px ${FONT.data}`;
  g.fillText(`${count('WATCH')} WATCH · ${count('BREACHED')} BREACHED · ${count('UNVERIFIABLE')} UNVERIFIABLE`.slice(0, 44), 790, 400);
  g.fillText(d.date, 790, 440);
  if (d.demo) stamp(g, 'DEMO', 950, 150, C.slate, 36, 0.1);
}

function drawLease(g: G, d: Extract<CardData, { kind: 'lease' }>) {
  paper(g, 200, 90, 800, 450, -0.012);
  fitText(g, `LEASE · ${d.ticker}`, 250, 180, 520, 52, 24, FONT.display, C.ink);
  g.font = `18px ${FONT.data}`; g.fillStyle = '#565E72'; g.fillText(`FORM L-01 · ${d.term}-day term`, 250, 212);
  const shown = d.clauses.slice(0, 6);
  shown.forEach((c, i) => text(g, `• ${c}`, 250, 262 + i * 32, { font: '', size: 22, color: C.ink, maxW: 520, family: FONT.body }));
  if (d.clauses.length > 6) text(g, `+${d.clauses.length - 6} more`, 250, 262 + 6 * 32, { font: '', size: 20, color: '#565E72', maxW: 300, family: FONT.data });
  g.font = `28px ${FONT.sign}`; g.fillStyle = '#1D2B6B'; g.fillText(short(d.dev), 620, 490, 340);
  g.fillStyle = '#565E72'; g.fillRect(620, 500, 340, 2);
  stamp(g, 'ACTIVE', 860, 190, ON_PAPER.ACTIVE!, 40, -0.14);
}

function drawRenewed(g: G, d: Extract<CardData, { kind: 'renewed' }>) {
  paper(g, 190, 100, 820, 430, -0.02, false);
  fitText(g, d.ticker, 250, 200, 700, 72, 28, FONT.display, C.ink);
  text(g, `Day ${d.term}/${d.term}. Every clause kept.`, 250, 270, { font: '', size: 30, color: C.ink, maxW: 700, family: FONT.body });
  stamp(g, 'RENEWED', 600, 400, C.green, 110, -0.14, 760);
}

function drawEvicted(g: G, d: Extract<CardData, { kind: 'evicted' }>) {
  g.fillStyle = '#1B2238'; g.fillRect(140, 70, 920, 500);
  g.strokeStyle = '#2A3352'; g.lineWidth = 6; g.strokeRect(140, 70, 920, 500);
  paper(g, 250, 120, 700, 400, 0.025, false);
  g.fillStyle = 'rgba(235,203,85,.6)'; g.save(); g.translate(300, 118); g.rotate(-0.12); g.fillRect(-45, -14, 90, 28); g.restore();
  g.save(); g.translate(900, 118); g.rotate(0.1); g.fillRect(-45, -14, 90, 28); g.restore();
  g.fillStyle = C.pink; g.fillRect(250, 120, 700, 400);
  fitText(g, 'EVICTION NOTICE', 300, 205, 600, 52, 24, FONT.display, C.ink);
  fitText(g, d.ticker, 300, 265, 600, 40, 20, FONT.display, '#B01E25');
  text(g, d.clause, 300, 320, { font: '', size: 26, color: C.ink, maxW: 600, maxLines: 2, family: FONT.body });
  g.font = `20px ${FONT.data}`; g.fillStyle = '#565E72'; g.fillText(d.date, 300, 410);
  stamp(g, 'EVICTED', 780, 440, C.red, 76, -0.16, 340);
}

function drawHearing(g: G, d: Extract<CardData, { kind: 'hearing' }>) {
  g.fillStyle = C.white; g.fillRect(80, 110, 500, 400); g.fillStyle = C.pink; g.fillRect(620, 110, 500, 400);
  g.fillStyle = C.ink; g.font = `16px ${FONT.data}`;
  g.fillText('THE INNOCENT READING', 110, 150); g.fillText('THE GUILTY READING', 650, 150);
  text(g, d.innocent, 110, 200, { font: '', size: 26, color: C.ink, maxW: 440, maxLines: 6, family: FONT.body });
  text(g, d.guilty, 650, 200, { font: '', size: 26, color: C.ink, maxW: 440, maxLines: 6, family: FONT.body });
  fitText(g, d.ticker, 110, 480, 300, 30, 16, FONT.display, '#565E72');
  if (d.verdict) stamp(g, d.verdict === 'fair' ? 'FAIR WEAR AND TEAR' : 'BREACH OF LEASE', 600, 320, d.verdict === 'fair' ? C.green : C.red, 44, -0.12, 700);
}

export async function renderCard(d: CardData): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W; canvas.height = CARD_H;
  const g = canvas.getContext('2d')!;
  background(g); logo(g);
  switch (d.kind) {
    case 'report': drawReport(g, d); break;
    case 'lease': drawLease(g, d); break;
    case 'renewed': drawRenewed(g, d); break;
    case 'evicted': drawEvicted(g, d); break;
    case 'hearing': drawHearing(g, d); break;
  }
  footer(g, 'fp' in d ? d.fp : undefined);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas export failed'))), 'image/png'));
}
