// "The World in One Day" — make.fun news-image-20261117 entry.
// A program that draws one image summing up Tuesday 17 November 2026's
// world news as a newspaper front page, and writes it to /output/entry.png.
// Pure TypeScript, standard library only. No network, no files read, no
// randomness: two runs write byte-identical output.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

const PAPER: RGB = [246, 241, 227];
const INK: RGB = [25, 25, 25];
const WHITE: RGB = [255, 255, 255];
const NAVY: RGB = [27, 47, 74];
const RED: RGB = [179, 39, 30];
const SKY: RGB = [216, 230, 240];
const SEA: RGB = [46, 107, 158];
const STEEL: RGB = [70, 76, 84];
const SMOKE: RGB = [138, 138, 138];
const ORANGE: RGB = [224, 122, 26];
const YELLOW: RGB = [240, 196, 60];
const TEAL: RGB = [31, 122, 109];
const OCHRE: RGB = [192, 122, 26];
const GREEN: RGB = [46, 125, 50];
const PURPLE: RGB = [91, 75, 138];
const GREY: RGB = [90, 90, 90];

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}

function frame(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let i = 0; i < t; i++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setPx(x, y + i, c);
  }
}

function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let i = 0; i < t; i++) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) setPx(x + i, y, c);
  }
}

// Bresenham line, thickness t (square brush).
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPx(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  const n = 48;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t);
}

// Even-odd scanline polygon fill.
function poly(pts: [number, number][], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) setPx(x, y, c);
    }
  }
}

function polyOutline(pts: [number, number][], c: RGB, t = 2): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1], c, t);
  }
}

// ---------------------------------------------------------------- font
// A hand-written 5x7 bitmap font (uppercase only; all labels are set in
// capitals, as a newspaper front page would). Each glyph is 7 rows of
// 5 bits, written as strings so the shapes are visible in the source.

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '*': ['00000', '10101', '01110', '10101', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const ADVANCE = 6; // glyph + 1px gap, in font units

function textWidth(s: string, scale: number, spacing = 0): number {
  return s.length * (ADVANCE + spacing) * scale - spacing * scale;
}

interface TextOpts {
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  spacing?: number; // extra font units between characters
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB, opts: TextOpts = {}): void {
  const { align = 'left', bold = false, spacing = 0 } = opts;
  const w = textWidth(s, scale, spacing);
  let cx = x;
  if (align === 'center') cx = x - Math.floor(w / 2);
  if (align === 'right') cx = x - w;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (g[row][col] === '1') {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          if (bold) fillRect(cx + col * scale + 1, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += (ADVANCE + spacing) * scale;
  }
}

// Greedy word wrap; returns lines that fit maxW pixels at the given scale.
function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur === '' ? word : cur + ' ' + word;
    if (textWidth(trial, scale) <= maxW || cur === '') {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- PNG
// Minimal whole-PNG writer: IHDR + one IDAT (zlib deflate, level 9) + IEND.
// Deterministic: zlib output depends only on the input bytes and level.

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- icons
// Small clean vector pictograms, each drawn inside a ~64px box centred
// on (cx, cy). They label the story at a glance; the words carry the facts.

function iconRadar(cx: number, cy: number): void {
  circleOutline(cx, cy, 28, INK, 3);
  circleOutline(cx, cy, 17, INK, 2);
  fillCircle(cx, cy, 3, RED);
  line(cx, cy, cx + 20, cy - 20, RED, 3);
  fillCircle(cx + 12, cy + 10, 3, NAVY);
  fillCircle(cx - 12, cy - 6, 3, NAVY);
  line(cx - 28, cy, cx - 34, cy, INK, 2);
  line(cx + 28, cy, cx + 34, cy, INK, 2);
}

function iconGlobe(cx: number, cy: number): void {
  circleOutline(cx, cy, 28, NAVY, 3);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    pts.push([Math.round(cx + 12 * Math.cos(a)), Math.round(cy + 28 * Math.sin(a))]);
  }
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], NAVY, 2);
  hline(cx - 27, cx + 27, cy - 9, NAVY, 2);
  hline(cx - 27, cx + 27, cy + 9, NAVY, 2);
  // small plane flying over the globe
  poly([[cx + 8, cy - 34], [cx + 30, cy - 28], [cx + 10, cy - 26], [cx + 16, cy - 20], [cx + 4, cy - 24]], RED);
}

function iconJet(cx: number, cy: number): void {
  // side-profile fighter jet, nose to the right
  poly(
    [
      [cx + 34, cy],
      [cx + 10, cy - 7],
      [cx - 20, cy - 6],
      [cx - 28, cy - 16],
      [cx - 34, cy - 16],
      [cx - 26, cy - 4],
      [cx - 30, cy + 4],
      [cx - 20, cy + 6],
      [cx + 10, cy + 7],
    ],
    NAVY,
  );
  poly([[cx - 2, cy - 6], [cx - 16, cy - 24], [cx - 24, cy - 24], [cx - 12, cy - 6]], NAVY);
  poly([[cx - 6, cy + 6], [cx - 18, cy + 20], [cx - 24, cy + 20], [cx - 14, cy + 6]], NAVY);
  fillCircle(cx + 16, cy - 3, 3, SKY);
  // speed lines
  hline(cx - 44, cx - 36, cy - 10, GREY, 2);
  hline(cx - 44, cx - 38, cy + 2, GREY, 2);
  hline(cx - 44, cx - 36, cy + 12, GREY, 2);
}

function iconTruck(cx: number, cy: number): void {
  // aid truck: cargo box with a cross, cab, wheels
  fillRect(cx - 34, cy - 18, 44, 32, WHITE);
  frame(cx - 34, cy - 18, 44, 32, INK, 2);
  fillRect(cx - 20, cy - 12, 8, 20, RED);
  fillRect(cx - 26, cy - 6, 20, 8, RED);
  fillRect(cx + 12, cy - 10, 20, 24, NAVY);
  fillRect(cx + 18, cy - 6, 10, 8, SKY);
  fillCircle(cx - 20, cy + 18, 8, INK);
  fillCircle(cx - 20, cy + 18, 3, WHITE);
  fillCircle(cx + 20, cy + 18, 8, INK);
  fillCircle(cx + 20, cy + 18, 3, WHITE);
}

function iconChip(cx: number, cy: number): void {
  fillRect(cx - 26, cy - 26, 52, 52, NAVY);
  for (let i = -1; i <= 1; i++) {
    fillRect(cx + i * 16 - 3, cy - 34, 6, 8, INK);
    fillRect(cx + i * 16 - 3, cy + 26, 6, 8, INK);
    fillRect(cx - 34, cy + i * 16 - 3, 8, 6, INK);
    fillRect(cx + 26, cy + i * 16 - 3, 8, 6, INK);
  }
  fillRect(cx - 14, cy - 14, 28, 28, TEAL);
  drawText('AI', cx, cy - 7, 2, WHITE, { align: 'center', bold: true });
}

function iconVirus(cx: number, cy: number): void {
  // measles virus: spiked ball
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x1 = Math.round(cx + 18 * Math.cos(a));
    const y1 = Math.round(cy + 18 * Math.sin(a));
    const x2 = Math.round(cx + 30 * Math.cos(a));
    const y2 = Math.round(cy + 30 * Math.sin(a));
    line(x1, y1, x2, y2, PURPLE, 3);
    fillCircle(x2, y2, 4, PURPLE);
  }
  fillCircle(cx, cy, 18, PURPLE);
  fillCircle(cx - 6, cy - 5, 4, WHITE);
  fillCircle(cx + 6, cy + 6, 3, WHITE);
}

// ---------------------------------------------------------------- layout

function star(cx: number, cy: number, rOuter: number, rInner: number, points: number, c: RGB): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  poly(pts, c);
}

function drawMasthead(): void {
  fillRect(0, 0, W, 104, NAVY);
  fillRect(0, 104, W, 6, RED);
  drawText('THE WORLD IN ONE DAY', W / 2, 16, 3, WHITE, { align: 'center', spacing: 1 });
  drawText('TUESDAY, 17 NOVEMBER 2026', W / 2, 48, 5, WHITE, { align: 'center', bold: true });
}

function drawLead(): void {
  const x0 = 24;
  const y0 = 124;
  const w = 976;
  const h = 328;
  fillRect(x0, y0, w, h, WHITE);
  frame(x0, y0, w, h, INK, 2);

  // --- bridge illustration: the Kerch Bridge, its middle span collapsed
  const ix = 40;
  const iy = 140;
  const iw = 552;
  const ih = 296;
  fillRect(ix, iy, iw, ih, SKY);
  fillRect(ix, iy + 190, iw, ih - 190, SEA); // sea from y 330
  // waves
  hline(ix + 24, ix + 120, iy + 224, WHITE, 2);
  hline(ix + 180, ix + 300, iy + 250, WHITE, 2);
  hline(ix + 380, ix + 500, iy + 220, WHITE, 2);
  hline(ix + 60, ix + 200, iy + 268, WHITE, 2);
  hline(ix + 300, ix + 460, iy + 272, WHITE, 2);
  // bridge deck, broken in the middle
  fillRect(ix + 16, iy + 160, 240, 10, STEEL);
  fillRect(ix + 296, iy + 160, 240, 10, STEEL);
  // collapsed span dipping into the water
  line(ix + 256, iy + 166, ix + 276, iy + 212, STEEL, 8);
  line(ix + 296, iy + 166, ix + 276, iy + 212, STEEL, 8);
  // towers
  fillRect(ix + 110, iy + 56, 16, 114, STEEL);
  fillRect(ix + 106, iy + 50, 24, 10, STEEL);
  fillRect(ix + 422, iy + 56, 16, 114, STEEL);
  fillRect(ix + 418, iy + 50, 24, 10, STEEL);
  // cables
  line(ix + 118, iy + 56, ix + 60, iy + 160, STEEL, 2);
  line(ix + 118, iy + 56, ix + 176, iy + 160, STEEL, 2);
  line(ix + 430, iy + 56, ix + 372, iy + 160, STEEL, 2);
  line(ix + 430, iy + 56, ix + 490, iy + 160, STEEL, 2);
  // smoke over the collapse
  fillCircle(ix + 256, iy + 112, 18, SMOKE);
  fillCircle(ix + 282, iy + 92, 24, SMOKE);
  fillCircle(ix + 310, iy + 114, 16, SMOKE);
  fillCircle(ix + 276, iy + 68, 14, SMOKE);
  // explosion at the break
  star(ix + 276, iy + 160, 26, 11, 8, ORANGE);
  star(ix + 276, iy + 160, 14, 6, 8, YELLOW);

  // --- lead text
  const tx = 616;
  drawText('LEAD STORY', tx, 150, 2, RED, { bold: true });
  drawText('KERCH BRIDGE', tx, 178, 4, INK, { bold: true });
  drawText('HIT AGAIN', tx, 212, 4, INK, { bold: true });
  const sub = wrapText(
    "Ukraine strikes the Crimea link a second night; Russia hits back at two Kyiv bridges, killing at least 2.",
    2,
    368,
  );
  sub.forEach((ln, i) => drawText(ln, tx, 262 + i * 18, 2, INK));
  hline(tx, tx + 120, 344, RED, 3);
  const sub2 = wrapText("Zelenskyy calls it an 'unprecedented' seven-stage operation.", 2, 368);
  sub2.forEach((ln, i) => drawText(ln, tx, 356 + i * 18, 2, GREY));
}

interface Panel {
  x: number;
  y: number;
  accent: RGB;
  cat: string;
  icon: (cx: number, cy: number) => void;
  head: string[];
  sub: string;
}

const PANELS: Panel[] = [
  {
    x: 24, y: 468, accent: RED, cat: 'MIDDLE EAST', icon: iconRadar,
    head: ['IRAN HITS US', 'RADAR IN BAHRAIN'],
    sub: 'Third attack in five days; a third US carrier arrives.',
  },
  {
    x: 353, y: 468, accent: NAVY, cat: 'ASIA', icon: iconGlobe,
    head: ['TRUMP OPENS', 'ASIA TRIP'],
    sub: "Manila summit, first Quad leaders' meeting, then Xi-Putin talks.",
  },
  {
    x: 682, y: 468, accent: TEAL, cat: 'JAPAN', icon: iconJet,
    head: ['JAPAN SCRAMBLES', 'FIGHTER JETS'],
    sub: 'Russian planes violate airspace near Fukuoka.',
  },
  {
    x: 24, y: 740, accent: OCHRE, cat: 'GAZA', icon: iconTruck,
    head: ['AID CALL', 'FOR GAZA'],
    sub: 'UK, Australia, Canada, Italy urge Israel to open crossings.',
  },
  {
    x: 353, y: 740, accent: GREEN, cat: 'BUSINESS', icon: iconChip,
    head: ['NVIDIA: RECORD', '$115.8B QUARTER'],
    sub: 'Net income $65.3B; new security panel; SEC opens probe.',
  },
  {
    x: 682, y: 740, accent: PURPLE, cat: 'HEALTH', icon: iconVirus,
    head: ['US LOSES MEASLES', 'FREE STATUS'],
    sub: 'PAHO ends 26-year elimination status; 5,400 cases in 2026.',
  },
];

function drawPanel(p: Panel): void {
  const w = 317;
  const h = 260;
  fillRect(p.x, p.y, w, h, WHITE);
  frame(p.x, p.y, w, h, INK, 2);
  fillRect(p.x, p.y, w, 8, p.accent);
  drawText(p.cat, p.x + 16, p.y + 20, 2, p.accent, { bold: true });
  p.icon(p.x + 158, p.y + 105);
  p.head.forEach((ln, i) => drawText(ln, p.x + 158, p.y + 148 + i * 26, 3, INK, { align: 'center', bold: true }));
  const lines = wrapText(p.sub, 2, 285);
  lines.forEach((ln, i) => drawText(ln, p.x + 158, p.y + 204 + i * 17, 2, INK, { align: 'center' }));
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  for (const p of PANELS) drawPanel(p);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
