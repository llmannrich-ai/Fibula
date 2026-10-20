#!/usr/bin/env node
/*
 * tools/mapas.mjs — gera o RASCUNHO do mapa fixo de um lugar de caça.
 *
 *   node tools/mapas.mjs <lugar>          grava hunts.<lugar>.mapa no content.json
 *   node tools/mapas.mjs <lugar> --forca  idem, por cima de um mapa que já existe
 *   node tools/mapas.mjs --todos --forca  os quatro lugares
 *
 * O mapa do jogo é fixo (pilar 2, decisão do Leonardo em 19/10/2026): o mesmo
 * em toda caçada, para todo jogador. Este script só faz o primeiro desenho, a
 * partir de hunts.<lugar>.rascunho: salas e corredores (genMap, com a semente
 * do rascunho), os objetos sólidos que não fecham caminho, as paredes, as
 * tochas, a variante do chão, os detalhes, a mata da Ilha e um monstro por
 * ponto de spawn (pelas bands e pelo boss do lugar). Depois disso o mapa se
 * edita no Remere's Map Editor (tools/otbm.mjs exporta e importa; o passo a
 * passo está em docs/rme.md) — e gerar de novo apaga essa edição, por isso o
 * --forca.
 *
 * Sem dependência: importa a simulação de src/sim/ (base.js e mapa.js) com o
 * mesmo ?v= dos imports do jogo.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTEUDO = join(RAIZ, 'data', 'game', 'content.json');
const V = (readFileSync(join(RAIZ, 'index.html'), 'utf8').match(/src\/main\.js\?v=([\d.]+)/) || [])[1];
const sim = (f) => import(pathToFileURL(join(RAIZ, 'src', 'sim', f)).href + '?v=' + V);
const {MW, MH, semeia, sorte, ri} = await sim('base.js');
const {genMap, pecas, ALFA, leMapa} = await sim('mapa.js');

/* hash do sqm: o enfeite não gasta o sorteio, que fica para os monstros */
const hash = (x, y, k, s) => {
  let h = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(k + 7, 83492791) ^ s) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const um = (l, r) => l[Math.min(l.length - 1, r * l.length | 0)];

/* o que cada item do OTSP é (tools/otsp-itens.json, refeito por
   "node tools/otbm.mjs tabela"): o tipo da pilha sai dele, aqui e no import
   do editor, para o mapa gerado e o desenhado no editor seguirem a mesma regra */
const deFaixas = (t) => { const s = new Set(); for (const f of t.split(' ').filter(Boolean)) { const [a, b] = f.split('-').map(Number); for (let i = a; i <= (b || a); i++) s.add(i); } return s; };
let TAB = null;
export function tabela() {
  if (TAB) return TAB;
  const t = JSON.parse(readFileSync(join(RAIZ, 'tools', 'otsp-itens.json'), 'utf8'));
  return TAB = {chao: deFaixas(t.chao), solido: deFaixas(t.solido), luz: deFaixas(t.luz), parede: deFaixas(t.parede)};
}
/* "<k> <chão> <itens>": v sem nada; c se nada bloqueia; p se o próprio chão
   bloqueia (água), se não há chão ou se o que bloqueia é parede; o se é
   objeto sobre chão; l a mais quando algo dá luz */
export function pilhaDe(chao, itens) {
  const T = tabela(), ids = chao ? [chao, ...itens] : itens;
  if (!ids.length) return 'v 0';
  const sol = ids.some((i) => T.solido.has(i)), luz = ids.some((i) => T.luz.has(i)) ? 'l' : '';
  const k = !sol ? (chao ? 'c' : 'v') : chao && !T.solido.has(chao) && !itens.some((i) => T.parede.has(i)) ? 'o' : 'p';
  return `${k}${luz} ${chao}` + (itens.length ? ' ' + itens.join(' ') : '');
}

export function rascunho(h, prog) {
  if (h.arena && h.rascunho.aberta) return arenaAberta(h, prog);
  const R = h.rascunho, s = R.semente >>> 0;
  semeia(s);
  const {g, rooms, obj} = genMap(R), P = pecas(g), hs = (x, y, k) => hash(x, y, k, s);
  const chao = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && g[y * MW + x] === 0;
  const par = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && g[y * MW + x] === 1;
  const variante = (x, y) => { let r = hs(x, y, 4); for (const [id, f] of R.chao.slice(1)) { if (r < f) return id; r -= f; } return R.chao[0][0]; };
  const pilha = new Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (g[i] === 1) {
      /* lugar aberto (a Ilha): sem parede, a rocha vira mato; a árvore só
         falta longe do chão, para parecer mato e não fileira */
      if (R.borda) {
        pilha[i] = pilhaDe(um(R.borda.fundo, hs(x, y, 1)), [um(R.borda.arvores, hs(x, y, 3))]);
      } else if (P[i]) {
        const tocha = R.tocha && P[i] === 2 && chao(x, y + 1) && hs(x, y, 6) < 1 / 19;
        pilha[i] = pilhaDe(0, tocha ? [R.parede[P[i] - 1], R.tocha] : [R.parede[P[i] - 1]]);
      } else pilha[i] = 'v 0';
      continue;
    }
    const c = variante(x, y);
    if (g[i] === 2) { const o = R.objetos[obj[i] - 1]; pilha[i] = pilhaDe(c, [um(o.ids, hs(x, y, 5))]); continue; }
    const pn = par(x, y - 1), pw = par(x - 1, y), pp = pn || pw || par(x + 1, y) || par(x, y + 1);
    let det = 0;
    R.detalhes.forEach((d, k) => {
      if (det || (d.onde === 'canto' ? !(pn && pw) : d.onde === 'parede' ? !pp : false)) return;
      if (hs(x, y, 10 + k) < d.p) det = um(d.ids, hs(x, y, 40 + k));
    });
    pilha[i] = pilhaDe(c, det ? [det] : []);
  }
  /* o que a regra decidiu (genMap: chão, parede, objeto) tem de bater com o
     que os itens dizem: item sólido usado como detalhe fecharia caminho */
  for (let i = 0; i < MW * MH; i++) if ((pilha[i][0] === 'c') !== (g[i] === 0))
    throw new Error(`o sqm ${i % MW},${i / MW | 0} é ${g[i] ? 'sólido' : 'chão'} na regra, mas a pilha "${pilha[i]}" diz o contrário: troque o item no rascunho`);
  /* os monstros: cada sala ganha os dela num sqm livre do miolo, pela banda
     da profundidade; o chefe e um da escolta na sala mais longe. Sorteados
     uma vez, aqui; no jogo o ponto é fixo */
  if (h.arena) return arena(h, prog, g, rooms, pilha);
  const s0 = rooms[0], bands = h.bands || prog.bands, boss = h.boss || prog.boss, pr = prog.perRoom;
  let md = 1, fundo = s0;
  for (const r of rooms) { r.d = Math.hypot(r.cx - s0.cx, r.cy - s0.cy); if (r.d > md) { md = r.d; fundo = r; } }
  const tipo = (d) => { const b = bands.find((b) => d < b.untilDepth) || bands[bands.length - 1]; let r = sorte();
    for (const [k, w] of Object.entries(b.weights)) { if (r < w) return k; r -= w; } return Object.keys(b.weights).pop(); };
  const usado = new Set(), spawn = [];
  const poe = (k, x, y) => { const i = y * MW + x; if (g[i] !== 0 || usado.has(i)) return false; usado.add(i); spawn.push(`${x} ${y} ${k}`); return true; };
  for (const r of rooms) {
    if (r === s0) continue;
    const n = ri(pr.min, pr.max) + (r.w * r.h > pr.largeRoomArea ? pr.largeRoomBonus : 0), d = r.d / md;
    for (let k = 0; k < n; k++) poe(tipo(d), r.x + 1 + ri(0, Math.max(0, r.w - 3)), r.y + 1 + ri(0, Math.max(0, r.h - 3)));
  }
  const livre = (r, k) => { let bd = 1e9, b = null;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const d = (x - r.cx) ** 2 + (y - r.cy + 1) ** 2; if (g[y * MW + x] === 0 && !usado.has(y * MW + x) && d < bd) { bd = d; b = [x, y]; } }
    if (b) poe(k, b[0], b[1]); };
  livre(fundo, boss.type); livre(fundo, boss.escort[ri(0, boss.escort.length - 1)]);
  return codifica(pilha, `${s0.cx} ${s0.cy}`, spawn);
}

/* a Arena: rooms[0] é o centro, as R.entradas últimas salas são as entradas
   dos times (sem monstro). A profundidade é a proximidade do centro: os
   monstros fortes ficam no meio, onde estão as saídas, e os chefes nascem
   na partida (arena.fases), não no spawn. Grava os pontos em arena.pontos */
function arena(h, prog, g, rooms, pilha) {
  const R = h.rascunho, c0 = rooms[0], ne = R.entradas, ents = rooms.slice(rooms.length - ne), pr = prog.perRoom;
  const usado = new Set(), spawn = [], chao = (x, y) => g[y * MW + x] === 0;
  const poe = (k, x, y) => { const i = y * MW + x; if (!chao(x, y) || usado.has(i)) return false; usado.add(i); spawn.push(`${x} ${y} ${k}`); return true; };
  /* as saídas: três sqm do centro, que nenhum monstro ocupa */
  const saidas = [[-3, 0], [3, 0], [0, 3]].map(([i, j]) => [c0.cx + i, c0.cy + j]).filter(([x, y]) => chao(x, y));
  for (const [x, y] of saidas) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) usado.add((y + j) * MW + x + i);
  let md = 1; for (const r of rooms) { r.d = Math.hypot(r.cx - c0.cx, r.cy - c0.cy); md = Math.max(md, r.d); }
  const tipo = (d) => { const b = h.bands.find((b) => d < b.untilDepth) || h.bands[h.bands.length - 1]; let r = sorte();
    for (const [k, w] of Object.entries(b.weights)) { if (r < w) return k; r -= w; } return Object.keys(b.weights).pop(); };
  for (const r of rooms) {
    if (ents.includes(r)) continue;
    const n = ri(pr.min, pr.max) + (r.w * r.h > pr.largeRoomArea ? pr.largeRoomBonus : 0), d = 1 - r.d / md;
    for (let k = 0; k < n; k++) poe(tipo(d), r.x + 1 + ri(0, Math.max(0, r.w - 3)), r.y + 1 + ri(0, Math.max(0, r.h - 3)));
  }
  h.arena.pontos = {centro: `${c0.cx} ${c0.cy}`, entradas: ents.map((r) => `${r.cx} ${r.cy}`), saidas: saidas.map(([x, y]) => `${x} ${y}`)};
  return codifica(pilha, h.arena.pontos.entradas[0], spawn);
}

/* a Arena ao ar livre (rascunho.aberta): mata, um rio com pontes e as ruínas
   no centro, onde ficam as saídas. Sem salas: o chão é aberto, e a mata
   fecha só onde o ruído do sqm manda (mais densa perto da borda). Tudo sai do
   hash do sqm (a mesma semente dá o mesmo mapa); só o tipo de cada monstro
   gasta o sorteio. Ninguém fica preso: o que a porta não alcança vira mata,
   e cada entrada ganha um caminho até o centro se precisar */
function arenaAberta(h, prog) {
  const R = h.rascunho, A = R.aberta, s = R.semente >>> 0; semeia(s);
  const hs = (x, y, k) => hash(x, y, k, s), N = MW * MH, cx = MW >> 1, cy = MH >> 1;
  const t = new Uint8Array(N); /* 0 chão, 1 mata, 2 água, 3 ponte, 4 ruína, 5 chão das ruínas */
  const I = (x, y) => y * MW + x, cheb = (x, y, a, b) => Math.max(Math.abs(x - a), Math.abs(y - b));
  /* o ruído: valores do hash numa grade de 6 sqm, interpolados */
  const v = (gx, gy) => hs(gx, gy, 90);
  const ruido = (x, y) => { const gx = x / 6, gy = y / 6, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx, b = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx; return a * (1 - fy) + b * fy; };
  const ents = A.entradas.map(([x, y]) => [x, y]), saidas = [[-3, 0], [3, 0], [0, 3]].map(([i, j]) => [cx + i, cy + j]);
  const livreDe = (x, y) => ents.some(([a, b]) => cheb(x, y, a, b) <= 4) || cheb(x, y, cx, cy) <= A.ruinas;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y), borda = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (borda < 2) { t[i] = 1; continue; }
    /* a mata: mais fechada longe do centro, nunca nas entradas nem nas ruínas */
    const d = cheb(x, y, cx, cy) / 32;
    if (!livreDe(x, y) && ruido(x, y) > A.mata - d * 0.18) t[i] = 1;
  }
  /* o rio: de norte a sul, a oeste das ruínas, com as pontes de A.pontes */
  for (let y = 0; y < MH; y++) { const xr = Math.round(A.rio + 4 * Math.sin(y / 7));
    for (let k = -1; k <= 1; k++) { const x = xr + k; if (x < 2 || x >= MW - 2) continue; t[I(x, y)] = A.pontes.some((py) => Math.abs(y - py) <= 1) ? 3 : 2; } }
  /* as ruínas: um muro quebrado em volta do centro, aberto nos quatro lados */
  for (let y = cy - A.ruinas; y <= cy + A.ruinas; y++) for (let x = cx - A.ruinas; x <= cx + A.ruinas; x++) {
    const d = cheb(x, y, cx, cy), i = I(x, y);
    if (d < A.ruinas - 1) t[i] = 5;
    else if (d === A.ruinas - 1) t[i] = Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1 || hs(x, y, 91) < 0.3 ? 5 : 4;
    else t[i] = 0;
  }
  for (const [x, y] of saidas) t[I(x, y)] = 5;
  /* as saídas antecipadas: uma em cada diagonal, no anel do meio, com o chão
     em volta limpo (abrem no começo e fecham quando esse anel desaba) */
  const antes = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => [cx + i * A.antecipadas, cy + j * A.antecipadas]);
  for (const [x, y] of antes) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const k = I(x + i, y + j); if (t[k] !== 2 && t[k] !== 3) t[k] = 0; }
  /* os pilares tombados dentro das ruínas */
  for (let y = cy - A.ruinas + 2; y <= cy + A.ruinas - 2; y++) for (let x = cx - A.ruinas + 2; x <= cx + A.ruinas - 2; x++)
    if (t[I(x, y)] === 5 && cheb(x, y, cx, cy) > 3 && hs(x, y, 92) < 0.05) t[I(x, y)] = 4;
  const anda = (k) => k === 0 || k === 3 || k === 5, Q = new Int32Array(N);
  const alcance = () => { const m = new Uint8Array(N); let a = 0, b = 0; const e = I(ents[0][0], ents[0][1]); m[e] = 1; Q[b++] = e;
    while (a < b) { const c = Q[a++], x = c % MW; for (const dd of [x > 0 ? -1 : 0, x < MW - 1 ? 1 : 0, -MW, MW]) { const k = c + dd; if (dd && k >= 0 && k < N && !m[k] && anda(t[k])) { m[k] = 1; Q[b++] = k; } } } return m; };
  /* cada entrada e o centro precisam se alcançar: senão, um caminho reto
     até o centro (a mata sai, a água vira ponte) */
  for (const [ex, ey] of [...ents, ...antes]) { if (alcance()[I(cx, cy)] && alcance()[I(ex, ey)]) continue;
    let x = ex, y = ey; while (x !== cx || y !== cy) { if (x !== cx) x += Math.sign(cx - x); else y += Math.sign(cy - y);
      for (const [i, j] of [[0, 0], [0, 1]]) { const k = I(x + i, y + j); if (t[k] === 1 || t[k] === 4) t[k] = 0; else if (t[k] === 2) t[k] = 3; } } }
  const m = alcance();
  for (let i = 0; i < N; i++) if (anda(t[i]) && !m[i]) t[i] = 1;
  /* as pilhas */
  const g = new Uint8Array(N); for (let i = 0; i < N; i++) g[i] = anda(t[i]) ? 0 : 1;
  const ru = new Uint8Array(N); for (let i = 0; i < N; i++) ru[i] = t[i] === 4 ? 1 : 0;
  const P = pecas(ru), pilha = new Array(N);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y), k = t[i], grama = um(A.grama, hs(x, y, 4));
    if (k === 1) pilha[i] = pilhaDe(grama, [um(A.arvores, hs(x, y, 3))]);
    else if (k === 2) pilha[i] = pilhaDe(A.agua, []);
    else if (k === 3) pilha[i] = pilhaDe(A.ponte, []);
    else if (k === 4) pilha[i] = pilhaDe(grama, [P[i] ? R.parede[P[i] - 1] : A.pilar]);
    else if (k === 5) pilha[i] = pilhaDe(A.pedra, hs(x, y, 5) < 0.06 ? [um(A.restos, hs(x, y, 6))] : []);
    else pilha[i] = pilhaDe(grama, hs(x, y, 7) < A.flores ? [um(A.detalhes, hs(x, y, 8))] : []);
  }
  for (let i = 0; i < N; i++) if ((pilha[i][0] === 'c') !== (g[i] === 0))
    throw new Error(`arena aberta: o sqm ${i % MW},${i / MW | 0} não bate com a pilha "${pilha[i]}"`);
  /* os monstros: pontos espalhados pelo chão alcançável, mais fortes perto do centro */
  const usado = new Set(), spawn = [], md = Math.hypot(cx, cy);
  for (const [x, y] of [...saidas, ...antes]) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) usado.add(I(x + i, y + j));
  for (const [x, y] of antes) if (!m[I(x, y)]) throw new Error(`arena aberta: a saída antecipada ${x},${y} ficou fora do alcance; mude rascunho.aberta.antecipadas`);
  const tipo = (d) => { const b = h.bands.find((b) => d < b.untilDepth) || h.bands[h.bands.length - 1]; let r = sorte();
    for (const [k, w] of Object.entries(b.weights)) { if (r < w) return k; r -= w; } return Object.keys(b.weights).pop(); };
  let livres = 0; for (let i = 0; i < N; i++) if (m[i] && t[i] !== 3) livres++;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y); if (!m[i] || t[i] === 3 || usado.has(i) || ents.some(([a, b]) => cheb(x, y, a, b) <= 6)) continue;
    if (hs(x, y, 93) >= A.monstros / livres) continue;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) usado.add(I(x + k, y + j));
    spawn.push(`${x} ${y} ${tipo(1 - Math.hypot(x - cx, y - cy) / md)}`);
  }
  h.arena.pontos = {centro: `${cx} ${cy}`, entradas: ents.map(([x, y]) => `${x} ${y}`), saidas: saidas.map(([x, y]) => `${x} ${y}`), antecipadas: antes.map(([x, y]) => `${x} ${y}`)};
  return codifica(pilha, h.arena.pontos.entradas[0], spawn);
}

/* pilha por sqm → {pilhas, grade}: cada pilha diferente vira um número de
   dois caracteres (ALFA, base 64) */
export function codifica(pilha, entrada, spawn) {
  const idx = new Map(), pilhas = [];
  const grade = [];
  for (let y = 0; y < MH; y++) {
    let l = '';
    for (let x = 0; x < MW; x++) {
      const t = pilha[y * MW + x] || 'v 0';
      if (!idx.has(t)) { idx.set(t, pilhas.length); pilhas.push(t); }
      const n = idx.get(t);
      if (n >= 64 * 64) throw new Error('mais de 4096 pilhas diferentes num mapa');
      l += ALFA[n >> 6] + ALFA[n & 63];
    }
    grade.push(l);
  }
  return {w: MW, h: MH, entrada, pilhas, grade, spawn};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2), forca = arg.includes('--forca');
  const c = JSON.parse(readFileSync(CONTEUDO, 'utf8'));
  const lugares = arg.includes('--todos') ? Object.keys(c.hunts).filter((k) => k[0] !== '_') : arg.filter((a) => !a.startsWith('--'));
  if (!lugares.length) { console.log('uso: node tools/mapas.mjs <lugar> [--forca] | --todos --forca'); process.exit(1); }
  for (const k of lugares) {
    const h = c.hunts[k];
    if (!h || !h.rascunho) { console.error(`${k}: lugar sem rascunho no content.json`); process.exit(1); }
    if (h.mapa && !forca) { console.error(`${k} já tem mapa (talvez desenhado no editor). Use --forca para apagar e gerar de novo.`); process.exit(1); }
    h.mapa = rascunho(h, c.progression);
    const M = leMapa(h.mapa);
    console.log(`${k}: ${h.mapa.pilhas.length} pilhas, ${h.mapa.spawn.length} monstros, entrada ${h.mapa.entrada}, ${M.g.filter((v) => v === 2).length} objetos`);
  }
  writeFileSync(CONTEUDO, JSON.stringify(c, null, 2) + '\n');
  console.log('lembre: node tools/sprites.mjs (os ids novos dos mapas entram no atlas)');
}
