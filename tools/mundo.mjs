#!/usr/bin/env node
/*
 * tools/mundo.mjs — gera o mapa do mundo em volta da cidade (city.mapa).
 *
 *   node tools/mundo.mjs          grava city.mapa e city.regioes no content.json
 *
 * O mapa da cidade virou o mapa do mundo (decisão do Leonardo em 19/10/2026):
 * a cidade de antes, cercada por muralha, com quatro portões abertos (porta,
 * não portal mágico), e fora dela estradas, vilas, matas, um rio, um lago, a
 * costa e lugares vazios onde vão ficar as entradas dos mapas de caça que
 * vierem. Por enquanto sem monstro nenhum: anda-se, descobre-se o caminho.
 *
 * A cidade é desenhada à mão e não é tocada: o script lê o retângulo dela
 * (city.mundo.cidade) do mapa atual e gera só o que fica fora. Na primeira
 * vez (city.mapa ainda do tamanho da cidade) ele também põe a muralha e os
 * portões e desloca as peças do chão (city.chao). Tudo sai de uma semente
 * (city.mundo.semente): a mesma semente dá o mesmo mundo, letra por letra.
 * Editar o mundo à mão e rodar de novo apaga a edição de fora dos muros.
 *
 * As regiões (city.regioes, retângulos com nome) são o que o jogo anuncia ao
 * entrar nelas. Sem dependência: só node:fs.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTEUDO = join(RAIZ, 'data', 'game', 'content.json');
const c = JSON.parse(readFileSync(CONTEUDO, 'utf8')), ci = c.city;

/* ---------- o tamanho e a cidade ---------- */
const W = 240, H = 180, SEMENTE = (ci.mundo && ci.mundo.semente) || 1910;
const primeira = !ci.mundo;
const cid = primeira ? {x: 93, y: 71, w: ci.mapa[0].length, h: ci.mapa.length} : ci.mundo.cidade;
let bloco = primeira ? ci.mapa.map((l) => l.split('')) : ci.mapa.slice(cid.y, cid.y + cid.h).map((l) => l.slice(cid.x, cid.x + cid.w).split(''));
/* os portões, em coordenadas da cidade: norte, sul, oeste e leste */
const PORTOES = [[33, 0], [26, cid.h - 1], [0, 20], [cid.w - 1, 11]];
if (primeira) {
  /* a muralha: a borda da cidade vira parede; a água do rio passa por baixo */
  for (let y = 0; y < cid.h; y++) for (let x = 0; x < cid.w; x++)
    if ((x === 0 || y === 0 || x === cid.w - 1 || y === cid.h - 1) && bloco[y][x] !== '~') bloco[y][x] = '#';
  for (const [x, y] of PORTOES) bloco[y][x] = 'P';
  /* as ruas chegam aos portões */
  bloco[20][1] = '.';
  for (let x = 49; x < cid.w - 1; x++) bloco[11][x] = '.';
  for (let y = 1; y <= 10; y++) bloco[y][33] = '.';
  ci.chao = ci.chao.map((q) => ({...q, x: q.x + cid.x, y: q.y + cid.y}));
}

/* ---------- sorteio e ruído, da semente ---------- */
let s0 = SEMENTE >>> 0;
const rnd = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const hash = (x, y, k) => {
  let h = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(k + 7, 83492791) ^ SEMENTE) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/* ruído de valor suave, de 0 a 1, com células de lado l */
const ruido = (x, y, l, k) => {
  const gx = Math.floor(x / l), gy = Math.floor(y / l), fx = x / l - gx, fy = y / l - gy, s = (t) => t * t * (3 - 2 * t);
  const a = hash(gx, gy, k), b = hash(gx + 1, gy, k), d = hash(gx, gy + 1, k), e = hash(gx + 1, gy + 1, k);
  return (a + (b - a) * s(fx)) * (1 - s(fy)) + (d + (e - d) * s(fx)) * s(fy);
};

/* ---------- a grade ---------- */
const g = Array.from({length: H}, () => Array(W).fill(','));
const MAR = new Uint8Array(W * H), FIXO = new Uint8Array(W * H);
const dentro = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const naCidade = (x, y) => x >= cid.x && y >= cid.y && x < cid.x + cid.w && y < cid.y + cid.h;
const poe = (x, y, l) => { if (dentro(x, y) && !naCidade(x, y)) g[y][x] = l; };
const regioes = [{nome: ci.nome, x: cid.x, y: cid.y, w: cid.w, h: cid.h}];

/* matas: manchas de árvores com nome; fora delas, árvore solta e moita */
const MATAS = [
  {nome: 'Mata Escura', x: 42, y: 100, r: 30},
  {nome: 'Bosque Velho', x: 185, y: 32, r: 26},
  {nome: 'Mata do Sul', x: 165, y: 152, r: 22},
  {nome: 'Mata do Norte', x: 70, y: 22, r: 18},
];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let mata = 0;
  for (const m of MATAS) { const d = Math.hypot(x - m.x, y - m.y) / (m.r * (0.75 + 0.5 * ruido(x, y, 9, 3))); if (d < 1) mata = Math.max(mata, 1 - d); }
  const n = ruido(x, y, 7, 1), h = hash(x, y, 2);
  if (mata > 0) g[y][x] = h < 0.62 + mata * 0.3 ? 'A' : h < 0.7 ? 'y' : ',';
  else if (n > 0.66 ? h < 0.3 : h < 0.035) g[y][x] = 'A';
  else if (h > 0.992) g[y][x] = 'y';
  else if (ruido(x, y, 5, 4) > 0.82 && h > 0.5) g[y][x] = 'v';
}
for (const m of MATAS) regioes.push({nome: m.nome, x: Math.max(0, m.x - m.r), y: Math.max(0, m.y - m.r), w: Math.min(W, m.x + m.r) - Math.max(0, m.x - m.r), h: Math.min(H, m.y + m.r) - Math.max(0, m.y - m.r)});

/* a costa a leste: o mar, com a linha da praia ondulando */
for (let y = 0; y < H; y++) {
  const praia = 212 + Math.round((ruido(0, y, 11, 5) - 0.5) * 12);
  for (let x = praia; x < W; x++) { g[y][x] = '~'; MAR[y * W + x] = 1; }
  for (let x = praia - 3; x < praia; x++) if (g[y][x] === 'A') g[y][x] = ',';
}
regioes.push({nome: 'Costa', x: 200, y: 0, w: W - 200, h: H});

/* o rio: entra pela muralha norte da cidade e sai pela leste; fora dela, sobe
   até a borda do mundo e corre até o mar, dois sqm de largura */
const rio = (x, y) => { for (const [a, b] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) poe(a, b, '~'); };
{ let px = cid.x + 44;
  for (let y = cid.y - 1; y >= 0; y--) { const x = cid.x + 44 + Math.round(Math.sin((cid.y - y) / 12) * 5 + (ruido(0, y, 8, 6) - 0.5) * 6);
    for (let a = Math.min(px, x); a <= Math.max(px, x); a++) rio(a, y); px = x; }
  let py = cid.y + 28;
  for (let x = cid.x + cid.w; x < W; x++) { if (MAR[py * W + x]) break; const y = cid.y + 28 + Math.round(Math.sin((x - cid.x - cid.w) / 10) * 4 + (ruido(x, 0, 8, 7) - 0.5) * 4);
    for (let b = Math.min(py, y); b <= Math.max(py, y); b++) rio(x, b); py = y; } }
/* o lago, a sudoeste */
const LAGO = {x: 66, y: 150, rx: 13, ry: 8};
for (let y = LAGO.y - 12; y <= LAGO.y + 12; y++) for (let x = LAGO.x - 18; x <= LAGO.x + 18; x++) {
  const d = Math.hypot((x - LAGO.x) / LAGO.rx, (y - LAGO.y) / LAGO.ry) / (0.85 + 0.3 * ruido(x, y, 5, 8));
  if (d < 1) poe(x, y, '~'); else if (d < 1.4 && g[y][x] === 'A') poe(x, y, ',');
}
regioes.push({nome: 'Lago Raso', x: LAGO.x - 16, y: LAGO.y - 10, w: 32, h: 20});

/* a borda do mundo é mata fechada; em volta da muralha, campo aberto */
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if ((x < 2 || y < 2 || x >= W - 2 || y >= H - 2) && g[y][x] !== '~') g[y][x] = 'A';
  if (!naCidade(x, y) && x >= cid.x - 4 && y >= cid.y - 4 && x < cid.x + cid.w + 4 && y < cid.y + cid.h + 4 && g[y][x] !== '~') g[y][x] = ',';
}

/* ---------- vilas, ruínas e clareiras ---------- */
const limpa = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
  if (dentro(x, y) && !MAR[y * W + x] && Math.hypot(x - cx, y - cy) <= r && g[y][x] !== '~') { g[y][x] = ','; FIXO[y * W + x] = 0; } };
const fixa = (x, y, l) => { poe(x, y, l); if (dentro(x, y)) FIXO[y * W + x] = 1; };
/* uma casa: parede, assoalho, a porta virada para o centro da vila, e dentro
   um ou dois móveis longe da porta */
function casa(x, y, w, h, lado) {
  for (let b = y; b < y + h; b++) for (let a = x; a < x + w; a++) fixa(a, b, a === x || b === y || a === x + w - 1 || b === y + h - 1 ? '#' : '_');
  const mx = x + (w >> 1), my = y + (h >> 1);
  const [px, py] = lado === 'n' ? [mx, y] : lado === 's' ? [mx, y + h - 1] : lado === 'o' ? [x, my] : [x + w - 1, my];
  fixa(px, py, '_');
  /* a soleira de fora fica livre */
  const [fx, fy] = lado === 'n' ? [px, py - 1] : lado === 's' ? [px, py + 1] : lado === 'o' ? [px - 1, py] : [px + 1, py];
  fixa(fx, fy, '.');
  const moveis = ['b', 'c', 's', 'n', 'w'], cantos = [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]];
  for (const [a, b] of cantos) if (Math.abs(a - px) + Math.abs(b - py) > 2 && rnd() < 0.55) fixa(a, b, moveis[ri(0, moveis.length - 1)]);
}
/* uma vila: o poço no meio, terreiro de terra batida em volta, casas nos
   quatro lados, horta e árvores de fruta */
function vila(nome, cx, cy, n) {
  limpa(cx, cy, 15);
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) fixa(x, y, '.');
  fixa(cx, cy, 'p');
  /* onde cada casa fica em volta do terreiro, e para que lado abre a porta */
  const lugares = [['s', -4], ['n', -4], ['e', 0], ['s', 6], ['n', 6], ['o', 0]];
  for (let i = 0; i < n; i++) {
    const [lado, d] = lugares[i], w = ri(6, 8), h = ri(5, 6);
    const x = lado === 'e' ? cx - 5 - w : lado === 'o' ? cx + 6 : cx + d - (w >> 1);
    const y = lado === 's' ? cy - 4 - h : lado === 'n' ? cy + 5 : cy - (h >> 1);
    casa(x, y, w, h, lado);
  }
  /* horta e pomar, onde ainda é grama */
  const hx = cx + (rnd() < 0.5 ? -12 : 7), hy = cy + (rnd() < 0.5 ? -12 : 8);
  for (let y = hy; y < hy + 3; y++) for (let x = hx; x < hx + 6; x++) if (g[y] && g[y][x] === ',' && !FIXO[y * W + x]) fixa(x, y, 'h');
  for (let k = 0; k < 4; k++) { const x = cx + ri(-13, 13), y = cy + ri(-13, 13); if (g[y] && g[y][x] === ',' && !FIXO[y * W + x] && Math.abs(x - cx) > 3 && Math.abs(y - cy) > 3) fixa(x, y, rnd() < 0.5 ? 'q' : 'r'); }
  regioes.push({nome, x: cx - 15, y: cy - 15, w: 31, h: 31});
}
/* ruínas: um muro velho e quebrado em volta de um piso de pedra, com estátuas */
function ruinas(nome, cx, cy) {
  limpa(cx, cy, 13);
  const x0 = cx - 9, y0 = cy - 6, w = 19, h = 13;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const borda = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
    fixa(x, y, borda ? (hash(x, y, 9) < 0.35 ? ':' : '#') : hash(x, y, 10) < 0.12 ? ',' : ':');
  }
  for (const [x, y] of [[cx - 5, cy - 3], [cx + 5, cy - 3], [cx - 5, cy + 3], [cx + 5, cy + 3]]) fixa(x, y, 'e');
  fixa(cx, cy + 6, ':'); fixa(x0 + w - 1, cy, ':');
  regioes.push({nome, x: cx - 13, y: cy - 13, w: 27, h: 27});
}
/* clareira: um círculo de grama no meio da mata, onde um mapa de caça vai ter
   a entrada; por enquanto, só o lugar */
function clareira(nome, cx, cy) { limpa(cx, cy, 5); for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) fixa(x, y, ':'); regioes.push({nome, x: cx - 6, y: cy - 6, w: 13, h: 13}); }

const VILAS = [
  ['Vila da Ponte', 110, 30, 5],
  ['Pouso do Lenhador', 38, 72, 3],
  ['Aldeia do Poço', 108, 150, 6],
  ['Vila do Cais', 192, 82, 4],
];
for (const v of VILAS) vila(...v);
ruinas('Ruínas Antigas', 32, 28);
clareira('Clareira do Bosque', 190, 30);
clareira('Clareira do Sul', 168, 156);
clareira('Clareira Escura', 40, 104);
/* o cais: do terreiro da Vila do Cais até a praia, e uma ponte de tábuas
   mar adentro */
{ const y = 82; let x = 195; while (x < W && !MAR[y * W + x]) { fixa(x, y, '.'); x++; }
  for (let a = x; a < x + 6 && a < W - 1; a++) for (const b of [y, y + 1]) { g[b][a] = '='; FIXO[b * W + a] = 1; } }

/* ---------- estradas ----------
   A*, com custo: grama barata, mata cara (a estrada abre caminho), água mais
   cara ainda (vira ponte), casa e mar proibidos. Um ruído no custo faz a
   estrada curvar como estrada de verdade */
function caminho(ax, ay, bx, by) {
  const N = W * H, dist = new Float64Array(N).fill(Infinity), de = new Int32Array(N).fill(-1), aberto = [];
  const custo = (x, y) => {
    const i = y * W + x, l = g[y][x];
    if (naCidade(x, y) || MAR[i] || x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return Infinity;
    if (FIXO[i]) return l === '.' || l === ':' || l === ',' || l === '=' ? 1 : Infinity;
    const r = 0.7 + ruido(x, y, 6, 11) * 1.2;
    return l === '.' || l === '=' ? 0.6 : l === '~' ? 14 : l === 'A' ? 2.6 * r : r;
  };
  const push = (i, f) => { aberto.push([f, i]); let k = aberto.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (aberto[p][0] <= aberto[k][0]) break; [aberto[p], aberto[k]] = [aberto[k], aberto[p]]; k = p; } };
  const pop = () => { const t = aberto[0], u = aberto.pop(); if (aberto.length) { aberto[0] = u; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < aberto.length && aberto[l][0] < aberto[m][0]) m = l; if (r < aberto.length && aberto[r][0] < aberto[m][0]) m = r; if (m === k) break; [aberto[m], aberto[k]] = [aberto[k], aberto[m]]; k = m; } } return t; };
  const a = ay * W + ax, b = by * W + bx; dist[a] = 0; push(a, 0);
  while (aberto.length) {
    const [, i] = pop(); if (i === b) break;
    const x = i % W, y = i / W | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!dentro(nx, ny)) continue;
      const j = ny * W + nx, cst = j === b ? 1 : custo(nx, ny); if (cst === Infinity) continue;
      const d = dist[i] + cst; if (d < dist[j]) { dist[j] = d; de[j] = i; push(j, d + (Math.abs(nx - bx) + Math.abs(ny - by)) * 0.6); }
    }
  }
  if (de[b] < 0) throw new Error(`sem caminho de ${ax},${ay} até ${bx},${by}`);
  for (let i = b; i >= 0; i = de[i]) {
    const x = i % W, y = i / W | 0, l = g[y][x];
    if (FIXO[i] && l !== ',') continue;
    g[y][x] = l === '~' || l === '=' ? '=' : '.'; FIXO[i] = 1;
    /* a mata recua da beira da estrada */
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (dentro(nx, ny) && !FIXO[ny * W + nx] && (g[ny][nx] === 'A' || g[ny][nx] === 'y')) g[ny][nx] = ','; }
  }
}
/* fora de cada portão */
const fora = PORTOES.map(([x, y]) => [cid.x + x + (x === 0 ? -1 : x === cid.w - 1 ? 1 : 0), cid.y + y + (y === 0 ? -1 : y === cid.h - 1 ? 1 : 0)]);
const [N_, S_, O_, L_] = fora;
const ESTRADAS = [
  [N_, [110, 32]],            // portão norte → Vila da Ponte
  [[110, 28], [41, 28]],      // Vila da Ponte → Ruínas Antigas
  [O_, [40, 72]],             // portão oeste → Pouso do Lenhador
  [[38, 70], [32, 34]],       // Pouso do Lenhador → Ruínas Antigas
  [[38, 74], [40, 104]],      // Pouso do Lenhador → Clareira Escura
  [S_, [108, 148]],           // portão sul → Aldeia do Poço
  [[110, 150], [168, 156]],   // Aldeia do Poço → Clareira do Sul
  [[106, 150], [66, 140]],    // Aldeia do Poço → Lago Raso
  [L_, [190, 82]],            // portão leste → Vila do Cais
  [[192, 80], [190, 30]],     // Vila do Cais → Clareira do Bosque
  [[112, 30], [190, 30]],     // Vila da Ponte → Clareira do Bosque
];
for (const [[ax, ay], [bx, by]] of ESTRADAS) caminho(ax, ay, bx, by);

/* ---------- conferência e gravação ---------- */
for (let y = 0; y < cid.h; y++) g[cid.y + y].splice(cid.x, cid.w, ...bloco[y]);
const mapa = g.map((l) => l.join(''));
/* tudo que tem nome precisa ser alcançável do @ andando */
{ const PASSA = new Set(',._:=vh@P'.split('').concat(Object.values(ci.npcs).filter((n) => n.lugar).map((n) => n.letra)));
  const vis = new Uint8Array(W * H), fila = []; let ax = 0, ay = 0;
  mapa.forEach((l, y) => { const x = l.indexOf('@'); if (x >= 0) { ax = x; ay = y; } });
  vis[ay * W + ax] = 1; fila.push(ay * W + ax);
  while (fila.length) { const i = fila.pop(), x = i % W, y = i / W | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (!dentro(nx, ny) || vis[j] || !PASSA.has(mapa[ny][nx])) continue;
      if (dx && dy && (!PASSA.has(mapa[y][nx]) || !PASSA.has(mapa[ny][x]))) continue;
      vis[j] = 1; fila.push(j); } }
  for (const r of regioes) { let ok = false; for (let y = r.y; y < r.y + r.h && !ok; y++) for (let x = r.x; x < r.x + r.w; x++) if (vis[y * W + x]) { ok = true; break; }
    if (!ok) throw new Error(`${r.nome} não se alcança andando do @`); }
  let n = 0; for (const v of vis) n += v;
  console.log(`${n} sqm alcançáveis a pé, de ${W * H}`);
}
ci.mapa = mapa;
ci.mundo = {_nota: 'Gerado por node tools/mundo.mjs: semente do mundo e o retângulo da cidade desenhada à mão, que o script não toca.', semente: SEMENTE, cidade: cid};
/* a ordem importa para o jogo: a menor região que contém o jogador ganha */
ci.regioes = regioes.map((r) => ({nome: r.nome, x: Math.max(0, r.x), y: Math.max(0, r.y), w: r.w, h: r.h}));
writeFileSync(CONTEUDO, JSON.stringify(c, null, 2) + '\n');
console.log(`city.mapa: ${W}×${H}, cidade em ${cid.x},${cid.y}; ${regioes.length} regiões`);
