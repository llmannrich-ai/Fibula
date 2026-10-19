#!/usr/bin/env node
/*
 * tools/otbm.mjs — a ponte entre os mapas de caça e o Remere's Map Editor.
 *
 *   node tools/otbm.mjs exporta <lugar> [pasta]   hunts.<lugar>.mapa → <pasta>/<lugar>.otbm
 *                                                 e <lugar>-spawn.xml (pasta padrão: mapas-rme/)
 *   node tools/otbm.mjs importa <lugar> [arquivo] o .otbm salvo no editor → hunts.<lugar>.mapa
 *   node tools/otbm.mjs rme <pasta>               monta a pasta de dados do editor para o OTSP,
 *                                                 com os monstros do Fibula na paleta
 *   node tools/otbm.mjs tabela                    refaz tools/otsp-itens.json a partir do pacote
 *
 * O mapa do jogo é fixo e mora no content.json (src/sim/mapa.js, leMapa); o
 * .otbm é o arquivo de trabalho do editor, que se exporta, edita e importa de
 * volta. O passo a passo está em docs/rme.md.
 *
 * O formato OTBM (árvore de nós entre 0xFE e 0xFF, 0xFD escapa) segue o da
 * The Forgotten Server e do OTBM2JSON (Inconcessus, MIT). No OTSP o id do
 * servidor é o mesmo do cliente, então o id do .otbm é o id do sprite.
 *
 * O mapa ocupa a área de 64×64 a partir de ORIGEM (x 1000, y 1000, andar 7);
 * a porta é o waypoint "entrada"; cada monstro do spawn.xml é um ponto fixo.
 * O que é sólido, chão e luz sai de tools/otsp-itens.json (refeito do
 * items.otb do pacote por "tabela"), para o import não depender do pacote.
 *
 * Sem dependência: só node:fs e node:path.
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve, basename} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTEUDO = join(RAIZ, 'data', 'game', 'content.json');
const TABELA = join(RAIZ, 'tools', 'otsp-itens.json');
const V = (readFileSync(join(RAIZ, 'index.html'), 'utf8').match(/src\/main\.js\?v=([\d.]+)/) || [])[1];
const {MW, MH} = await import(pathToFileURL(join(RAIZ, 'src', 'sim', 'base.js')).href + '?v=' + V);
const {leMapa} = await import(pathToFileURL(join(RAIZ, 'src', 'sim', 'mapa.js')).href + '?v=' + V);
const {codifica, pilhaDe, tabela} = await import(pathToFileURL(join(RAIZ, 'tools', 'mapas.mjs')).href);

export const ORIGEM = {x: 1000, y: 1000, z: 7};
/* o cabeçalho do otsp.otbm do pacote: OTBM 2, items.otb 3.55 (cliente 10.41) */
const VERSAO = {otbm: 2, maior: 3, menor: 55, lado: 2048};
const N = {RAIZ: 0, MAPA: 2, AREA: 4, SQM: 5, ITEM: 6, CIDADES: 12, CASA_SQM: 14, PONTOS: 15, PONTO: 16};
const A = {DESC: 1, FLAGS: 3, ITEM: 9, SPAWN: 11, CASAS: 13};

/* ---------- a árvore de nós ---------- */
export function leArvore(buf) {
  let p = 4;
  const no = () => {
    if (buf[p] !== 0xFE) throw new Error(`.otbm corrompido: esperava início de nó no byte ${p}`);
    p++;
    const tipo = buf[p++], dados = [], filhos = [];
    for (;;) {
      const b = buf[p];
      if (b === 0xFD) { dados.push(buf[p + 1]); p += 2; }
      else if (b === 0xFE) filhos.push(no());
      else if (b === 0xFF) { p++; return {tipo, dados: Buffer.from(dados), filhos}; }
      else if (b === undefined) throw new Error('.otbm cortado no meio');
      else { dados.push(b); p++; }
    }
  };
  return no();
}
class Escrita {
  constructor() { this.b = [0, 0, 0, 0]; }
  abre(tipo) { this.b.push(0xFE, tipo); return this; }
  fecha() { this.b.push(0xFF); return this; }
  byte(v) { if (v === 0xFD || v === 0xFE || v === 0xFF) this.b.push(0xFD); this.b.push(v & 255); return this; }
  u16(v) { return this.byte(v & 255).byte(v >> 8 & 255); }
  u32(v) { return this.u16(v & 0xFFFF).u16(v >>> 16 & 0xFFFF); }
  txt(s) { const t = Buffer.from(s, 'latin1'); this.u16(t.length); for (const c of t) this.byte(c); return this; }
}
const leitor = (d) => { let p = 0; return {
  u8: () => d[p++], u16: () => { const v = d.readUInt16LE(p); p += 2; return v; }, u32: () => { const v = d.readUInt32LE(p); p += 4; return v; },
  txt: () => { const n = d.readUInt16LE(p); p += 2; const s = d.toString('latin1', p, p + n); p += n; return s; }, fim: () => p >= d.length }; };

/* ---------- a tabela de itens do OTSP ---------- */
const faixas = (ids) => { const r = []; for (const i of ids) { const u = r[r.length - 1]; if (u && u[1] === i - 1) u[1] = i; else r.push([i, i]); } return r.map(([a, b]) => a === b ? `${a}` : `${a}-${b}`).join(' '); };
function otspDir() {
  const d = join(tmpdir(), 'fibula-otsp-ae88e18');
  if (!existsSync(join(d, 'rme_files'))) throw new Error(`o pacote OTSP não está em ${d}: rode antes "node tools/sprites.mjs", que o baixa`);
  return d;
}
function refazTabela() {
  const d = otspDir(), r = leArvore(readFileSync(join(d, 'rme_files', 'items.otb'))), chao = [], solido = [], luz = [];
  for (const it of r.filhos) {
    const flags = it.dados.readUInt32LE(0), at = {};
    for (let q = 4; q < it.dados.length;) { const a = it.dados[q], n = it.dados.readUInt16LE(q + 1); at[a] = it.dados.subarray(q + 3, q + 3 + n); q += 3 + n; }
    const id = at[0x10] && at[0x10].readUInt16LE(0);
    if (!id) continue;
    if (it.tipo === 1) chao.push(id);
    if (flags & 1) solido.push(id);
    if (at[0x2A] && at[0x2A].readUInt16LE(0) > 0) luz.push(id);
  }
  /* paredes: o que o items.xml do pacote chama de wall (o resto sólido é objeto) */
  const parede = [];
  for (const m of readFileSync(join(d, 'rme_files', 'items.xml'), 'utf8').matchAll(/<item\s+(?:id="(\d+)"|fromid="(\d+)"\s+toid="(\d+)")[^>]*name="([^"]*)"/g)) {
    if (!/wall|mountain/i.test(m[4])) continue;
    const a = +(m[1] || m[2]), b = +(m[3] || m[1]); for (let i = a; i <= b; i++) parede.push(i);
  }
  const ord = (l) => faixas([...new Set(l)].sort((a, b) => a - b));
  writeFileSync(TABELA, JSON.stringify({_nota: 'Gerado por "node tools/otbm.mjs tabela" a partir do items.otb e do items.xml do OTSP (CC BY 4.0). chao: itens de chão; solido: bloqueiam a passagem; luz: dão luz; parede: o que o pacote chama de wall ou mountain.',
    chao: ord(chao), solido: ord(solido), luz: ord(luz), parede: ord(parede)}, null, 2) + '\n');
  console.log(`tabela: ${chao.length} chãos, ${solido.length} sólidos, ${luz.length} com luz, ${parede.length} paredes → ${TABELA}`);
}

/* ---------- exportar ---------- */
/* o nome do monstro no editor vai sem acento: o editor pode gravar o
   spawn.xml noutra codificação, e "Mumia" volta igual de qualquer jeito */
const semAcento = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export function exporta(h, nomeSpawn) {
  const M = leMapa(h.mapa), w = new Escrita(), {x: X, y: Y, z: Z} = ORIGEM;
  w.abre(N.RAIZ).u32(VERSAO.otbm).u16(VERSAO.lado).u16(VERSAO.lado).u32(VERSAO.maior).u32(VERSAO.menor);
  w.abre(N.MAPA).byte(A.DESC).txt(`Fibula - ${semAcento(h.nome)}`).byte(A.SPAWN).txt(nomeSpawn).byte(A.CASAS).txt(nomeSpawn.replace('-spawn', '-house'));
  /* o OTBM agrupa os sqm em áreas de 256×256 (x e y & 0xFF00) */
  const areas = new Map();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const P = M.pilhas[M.pi[y * MW + x]];
    if (P.k === 'v' && !P.chao && !P.itens.length) continue;
    const ax = (X + x) & 0xFF00, ay = (Y + y) & 0xFF00, k = ax + ',' + ay;
    if (!areas.has(k)) areas.set(k, []);
    areas.get(k).push([x, y, P]);
  }
  for (const [k, sqms] of areas) {
    const [ax, ay] = k.split(',').map(Number);
    w.abre(N.AREA).u16(ax).u16(ay).byte(Z);
    for (const [x, y, P] of sqms) {
      w.abre(N.SQM).byte((X + x) & 255).byte((Y + y) & 255);
      if (P.chao) w.byte(A.ITEM).u16(P.chao);
      for (const id of P.itens) w.abre(N.ITEM).u16(id).fecha();
      w.fecha();
    }
    w.fecha();
  }
  w.abre(N.CIDADES).fecha();
  w.abre(N.PONTOS).abre(N.PONTO).txt('entrada').u16(X + M.entrada.x).u16(Y + M.entrada.y).byte(Z).fecha().fecha();
  w.fecha().fecha();
  return Buffer.from(w.b);
}
export function spawnXml(h, MT) {
  const M = leMapa(h.mapa), {x: X, y: Y, z: Z} = ORIGEM;
  return '<?xml version="1.0"?>\n<spawns>\n' + M.pontos.map((q) =>
    `\t<spawn centerx="${X + q.x}" centery="${Y + q.y}" centerz="${Z}" radius="1">\n\t\t<monster name="${xml(semAcento(MT[q.k].nome))}" x="0" y="0" z="${Z}" spawntime="60" />\n\t</spawn>`).join('\n') + '\n</spawns>\n';
}

/* ---------- importar ---------- */
export function importa(buf, spawn, MT) {
  const T = tabela(), r = leArvore(buf), {x: X, y: Y, z: Z} = ORIGEM, pilha = new Array(MW * MH).fill('v 0');
  let entrada = null;
  const fora = [];
  const mapa = r.filhos.find((n) => n.tipo === N.MAPA);
  if (!mapa) throw new Error('.otbm sem os dados do mapa');
  for (const a of mapa.filhos) {
    if (a.tipo === N.AREA) {
      const l = leitor(a.dados), ax = l.u16(), ay = l.u16(), az = l.u8();
      for (const s of a.filhos) {
        if (s.tipo !== N.SQM && s.tipo !== N.CASA_SQM) continue;
        const q = leitor(s.dados), x = ax + q.u8() - X, y = ay + q.u8() - Y, ids = [];
        if (s.tipo === N.CASA_SQM) q.u32();
        while (!q.fim()) { const at = q.u8(); if (at === A.FLAGS) q.u32(); else if (at === A.ITEM) ids.push(q.u16()); else break; }
        for (const it of s.filhos) if (it.tipo === N.ITEM) ids.push(it.dados.readUInt16LE(0));
        if (az !== Z || !ids.length) continue;
        if (x < 0 || y < 0 || x >= MW || y >= MH) { fora.push(`${x + X},${y + Y}`); continue; }
        const chao = T.chao.has(ids[0]) ? ids[0] : 0;
        pilha[y * MW + x] = pilhaDe(chao, chao ? ids.slice(1) : ids);
      }
    } else if (a.tipo === N.PONTOS) {
      for (const p of a.filhos) { const l = leitor(p.dados), nome = l.txt(), x = l.u16() - X, y = l.u16() - Y; if (/^entrada$/i.test(nome)) entrada = `${x} ${y}`; }
    }
  }
  if (fora.length) throw new Error(`há ${fora.length} sqm fora da área do mapa (x ${X}..${X + MW - 1}, y ${Y}..${Y + MH - 1}), por exemplo ${fora[0]}`);
  if (!entrada) throw new Error('o mapa precisa de um waypoint chamado "entrada", onde fica a porta');
  /* monstros: o nome do editor é o nome do monstro no jogo (ou a chave) */
  const porNome = new Map(Object.entries(MT).flatMap(([k, m]) => [[k.toLowerCase(), k], [semAcento(m.nome).toLowerCase(), k]]));
  const pontos = [];
  for (const s of spawn.matchAll(/<spawn\b([^>]*)>([\s\S]*?)<\/spawn>/g)) {
    const at = (t, n) => +((t.match(new RegExp(n + '="(-?\\d+)"')) || [])[1]);
    const cx = at(s[1], 'centerx'), cy = at(s[1], 'centery');
    for (const m of s[2].matchAll(/<monster\b([^>]*)\/?>/g)) {
      const nome = (m[1].match(/name="([^"]*)"/) || [])[1] || '', k = porNome.get(semAcento(nome).toLowerCase());
      if (!k) throw new Error(`o spawn tem um monstro que o jogo não conhece: "${nome}"`);
      if (at(m[1], 'z') !== Z) continue;
      pontos.push(`${cx + at(m[1], 'x') - X} ${cy + at(m[1], 'y') - Y} ${k}`);
    }
  }
  return codifica(pilha, entrada, pontos);
}

/* ---------- a pasta do editor ---------- */
function rme(pasta, c, ARTE_O) {
  const d = otspDir(), dados = join(pasta, 'data'), cli = join(pasta, 'cliente');
  mkdirSync(dados, {recursive: true}); mkdirSync(cli, {recursive: true});
  for (const f of readdirSync(join(d, 'rme_files'))) copyFileSync(join(d, 'rme_files', f), join(dados, f));
  /* o editor procura Tibia.dat e Tibia.spr na pasta do cliente */
  copyFileSync(join(d, 'client_files', 'otsp.dat'), join(cli, 'Tibia.dat'));
  copyFileSync(join(d, 'client_files', 'otsp.spr'), join(cli, 'Tibia.spr'));
  /* os monstros do Fibula na paleta de criaturas, com o desenho do jogo */
  const nossos = Object.entries(c.enemies).filter(([k]) => ARTE_O[k]).map(([k, m]) => `\t<creature name="${xml(semAcento(m.nome))}" type="monster" looktype="${ARTE_O[k]}"/>`);
  const cr = readFileSync(join(d, 'rme_files', 'creatures.xml'), 'utf8').replace('</creatures>', '\t<!-- Fibula -->\n' + nossos.join('\n') + '\n</creatures>');
  writeFileSync(join(dados, 'creatures.xml'), cr);
  for (const f of ['LICENSE.txt', 'AUTHORS.md']) copyFileSync(join(d, f), join(pasta, f));
  console.log(`pasta do editor em ${pasta}: data/ (itens, pincéis e ${nossos.length} monstros do Fibula) e cliente/ (Tibia.dat e Tibia.spr do OTSP)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a1, a2] = process.argv.slice(2);
  const c = () => JSON.parse(readFileSync(CONTEUDO, 'utf8'));
  const lugar = (C) => { const h = C.hunts[a1]; if (!a1 || !h || a1[0] === '_') { console.error(`lugar desconhecido: ${a1} (há ${Object.keys(C.hunts).filter((k) => k[0] !== '_').join(', ')})`); process.exit(1); } return h; };
  try {
    if (cmd === 'exporta') {
      const C = c(), h = lugar(C), pasta = resolve(a2 || join(RAIZ, 'mapas-rme'));
      mkdirSync(pasta, {recursive: true});
      writeFileSync(join(pasta, a1 + '.otbm'), exporta(h, a1 + '-spawn.xml'));
      writeFileSync(join(pasta, a1 + '-spawn.xml'), spawnXml(h, C.enemies));
      writeFileSync(join(pasta, a1 + '-house.xml'), '<?xml version="1.0"?>\n<houses />\n');
      console.log(`${join(pasta, a1 + '.otbm')} e ${a1}-spawn.xml: abra no Remere's Map Editor (docs/rme.md)`);
    } else if (cmd === 'importa') {
      const C = c(), h = lugar(C), arq = resolve(a2 || join(RAIZ, 'mapas-rme', a1 + '.otbm'));
      const mapa = readFileSync(arq), nomeS = (() => { try { const r = leArvore(mapa), m = r.filhos.find((n) => n.tipo === N.MAPA), l = leitor(m.dados);
        while (!l.fim()) { const at = l.u8(); const s = l.txt(); if (at === A.SPAWN) return s; } } catch (e) { /* sem o nome no mapa */ } return basename(arq, '.otbm') + '-spawn.xml'; })();
      const sp = join(dirname(arq), nomeS);
      h.mapa = importa(mapa, existsSync(sp) ? readFileSync(sp, 'utf8') : '', C.enemies);
      writeFileSync(CONTEUDO, JSON.stringify(C, null, 2) + '\n');
      console.log(`${a1}: ${h.mapa.pilhas.length} pilhas, ${h.mapa.spawn.length} monstros, entrada ${h.mapa.entrada}. Agora: node tools/sprites.mjs e node tools/testar.mjs`);
    } else if (cmd === 'rme') {
      const src = readFileSync(join(RAIZ, 'tools', 'sprites.mjs'), 'utf8'), O = {};
      for (const m of src.matchAll(/mon_(\w+): \{o: (\d+)/g)) O[m[1]] = +m[2];
      rme(resolve(a1 || join(RAIZ, 'mapas-rme', 'editor')), c(), O);
    } else if (cmd === 'tabela') refazTabela();
    else { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 12).map((l) => l.slice(3)).join('\n')); process.exit(1); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
