#!/usr/bin/env node
/*
 * tools/sprites.mjs — monta o atlas de sprites do Fibula a partir do
 * OpenTibia Sprite Pack (OTSP, CC BY 4.0).
 *
 *   node tools/sprites.mjs                 baixa o OTSP no commit fixado e gera
 *   node tools/sprites.mjs <pasta-do-otsp> usa um checkout que você já tem
 *   node tools/sprites.mjs --catalogo      além do atlas, grava folhas de
 *                                          consulta (todas as criaturas, itens,
 *                                          efeitos e projéteis) na pasta de
 *                                          trabalho, para escolher sprites novos
 *
 * Saída, sempre a mesma para a mesma entrada:
 *   assets/otsp/atlas.png   só os sprites que o jogo usa, num PNG só
 *   assets/otsp/atlas.json  onde cada um está: {nome:{x,y,w,h,d,f,ox,oy}}
 *   assets/otsp/LICENSE.txt e AUTHORS.md, copiados do pacote
 *
 * Por que ler o otsp.dat/otsp.spr e não recortar as folhas PNG: as folhas são
 * um despejo do .spr em ordem de id, sem dizer qual pedaço de 32 px pertence a
 * qual criatura, direção ou quadro. O .dat diz isso, e a criatura de 64 px sai
 * montada certa sem ninguém recortar nada à mão. O .spr já guarda transparência
 * de verdade (o magenta das folhas é só o fundo delas), então não há cor a
 * converter. O resultado é o mesmo pixel do pacote, só reorganizado.
 *
 * Trocar a arte de alguma coisa do jogo é editar a tabela ARTE abaixo e rodar
 * de novo. O nome à esquerda é o que o index.html procura; o id à direita é do
 * pacote (descubra com --catalogo).
 *
 * Sem dependência: só node:fs, node:zlib e git para baixar o pacote.
 */
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'assets', 'otsp');
const OTSP_GIT = 'https://github.com/peonso/opentibia_sprite_pack.git';
const OTSP_COMMIT = 'ae88e1828671b349e729dd21177dde15ea41e123';

/* ---------- o que o jogo usa ----------
   tipo: o = criatura (4 direções × quadros de caminhada), i = item,
   e = efeito de magia (quadros), m = projétil (8 direções).
   tom: gira o matiz (graus) para criar a variante de outro elemento a partir
   de um efeito do pacote, que tem poucos. */
const ARTE = {
  /* personagens, um por classe */
  cls_feiticeiro: {o: 15}, cls_druida: {o: 33}, cls_cacador: {o: 19}, cls_cavaleiro: {o: 3},
  /* monstros: as chaves de enemies no content.json */
  mon_rato: {o: 6}, mon_aranha: {o: 8}, mon_esqueleto: {o: 22}, mon_orc: {o: 7},
  mon_xama: {o: 4}, mon_guardiao: {o: 46},
  /* monstros dos outros mapas de caça: Esgoto, Ilha da Enseada e Cripta */
  mon_morcego: {o: 9}, mon_barata: {o: 24}, mon_lesma: {o: 29}, mon_centopeia: {o: 13},
  mon_vespa: {o: 14}, mon_lagarta: {o: 30}, mon_leao: {o: 11}, mon_troll: {o: 12}, mon_dragao: {o: 25},
  mon_fantasma: {o: 40}, mon_mumia: {o: 23, tom: 25}, mon_necromante: {o: 34}, mon_sombra: {o: 2},
  /* cadáveres: ficam no chão onde o monstro caiu */
  cad_rato: {i: 2228}, cad_aranha: {i: 2237}, cad_esqueleto: {i: 2233}, cad_orc: {i: 2234},
  cad_xama: {i: 2227}, cad_guardiao: {i: 2231},
  cad_morcego: {i: 2228}, cad_barata: {i: 2237}, cad_lesma: {i: 2237}, cad_centopeia: {i: 2237},
  cad_vespa: {i: 2237}, cad_lagarta: {i: 2237}, cad_leao: {i: 2228}, cad_troll: {i: 2234}, cad_dragao: {i: 2231},
  cad_fantasma: {i: 2233}, cad_mumia: {i: 2233}, cad_necromante: {i: 2227}, cad_sombra: {i: 2231},
  cad_feiticeiro: {i: 2246}, cad_druida: {i: 2703}, cad_cacador: {i: 2227}, cad_cavaleiro: {i: 2227},
  /* masmorra: chão, pedrinhas e o conjunto de parede de pedra */
  chao: {i: 140}, cascalho: {i: 1614}, cascalho2: {i: 1617},
  par_v: {i: 534}, par_h: {i: 535}, par_poste: {i: 536}, par_canto: {i: 537},
  tocha: {i: 1253}, portal: {i: 1122},
  /* chão e parede de cada mapa de caça (hunts.<k>.arte no content.json):
     o Esgoto de laje e pedra com musgo, a Ilha de areia e arenito, a Cripta
     de pedra escura e pedra rolada */
  chao_esg: {i: 165}, esg_v: {i: 723}, esg_h: {i: 724}, esg_poste: {i: 725}, esg_canto: {i: 726},
  chao_ilha: {i: 128}, ilha_v: {i: 552}, ilha_h: {i: 553}, ilha_poste: {i: 554}, ilha_canto: {i: 555},
  chao_cripta: {i: 160}, cripta_v: {i: 542}, cripta_h: {i: 543}, cripta_poste: {i: 544}, cripta_canto: {i: 545},
  /* cidade: chão de grama, rua de pedra, assoalho das casas, água, árvores e
     os NPCs das casas (as chaves de city.npcs no content.json) */
  grama: {i: 107}, grama2: {i: 108}, rua: {i: 154}, assoalho: {i: 172}, agua: {i: 2260},
  arvore: {i: 1507}, arvore2: {i: 1504},
  npc_mercador: {o: 26}, npc_banqueiro: {o: 18}, npc_guia: {o: 16}, npc_corretor: {o: 45}, npc_gordon: {o: 21},
  npc_quitandeira: {o: 17}, npc_boticaria: {o: 44}, npc_mago: {o: 10},
  npc_capitao: {o: 36},
  /* um lugar da cidade (lugar: true), não uma pessoa: a grade do esgoto */
  npc_grade: {i: 999},
  /* cidade: chão da praça, ponte, terra da horta, o que cresce por cima
     (flores e horta, por onde se anda) e os objetos sólidos (OBJETOS em
     src/sim/dados.js, obj_<nome>) */
  praca: {i: 155}, ponte: {i: 173}, terra: {i: 135},
  flor1: {i: 1386}, flor2: {i: 1387}, flor3: {i: 1400}, flor4: {i: 1406}, horta: {i: 1381}, horta2: {i: 1384},
  obj_fonte: {i: 1151}, obj_poco: {i: 1154}, obj_barril: {i: 1186}, obj_caixote: {i: 1115},
  obj_estatua: {i: 1155}, obj_arbusto: {i: 1479}, obj_arbusto2: {i: 1480},
  obj_cerejeira: {i: 1530}, obj_frutifera: {i: 1561}, obj_forno: {i: 1207}, obj_estante: {i: 1209},
  obj_banca: {i: 1197}, obj_lenha: {i: 1140},
  /* o que as lojas da cidade vendem: as chaves de supplies no content.json */
  sup_frutas: {i: 2177}, sup_queijo: {i: 2183}, sup_presunto: {i: 2187}, sup_ensopado: {i: 2701},
  sup_pocao: {i: 2129}, sup_pressa: {i: 2124},
  sup_runa_pedra: {i: 2696}, sup_runa_furia: {i: 2697}, sup_runa_aguia: {i: 2698},
  /* sacos de loot por raridade e itens (as chaves de items no content.json) */
  saco0: {i: 2101}, saco1: {i: 2099}, saco2: {i: 2102},
  it_ouro: {i: 2196}, it_dente: {i: 2175}, it_seda: {i: 2170}, it_osso: {i: 2166},
  it_espada: {i: 1712}, it_machado: {i: 1830}, it_erva: {i: 1423}, it_amuleto: {i: 2139},
  it_gema: {i: 2211}, it_coroa: {i: 1984}, it_couraca: {i: 1998}, it_cota: {i: 2034}, pocao: {i: 2129},
  it_maca: {i: 1811}, it_gibao: {i: 2010}, it_machadoguerra: {i: 1844}, it_placas: {i: 2053},
  /* efeitos de impacto por elemento */
  ef_fisico: {e: 1}, ef_fogo: {e: 6}, ef_gelo: {e: 7}, ef_cura: {e: 2},
  ef_energia: {e: 2, tom: 120}, ef_sagrado: {e: 2, tom: -140}, ef_terra: {e: 3, tom: -170},
  ef_explosao: {e: 13}, ef_poeira: {e: 9}, ef_faisca: {e: 4},
  /* projéteis por elemento */
  mi_fogo: {m: 4}, mi_gelo: {m: 13}, mi_terra: {m: 5}, mi_fisico: {m: 2}, mi_lanca: {m: 1},
  mi_energia: {m: 8, tom: 60}, mi_sagrado: {m: 8, tom: -150}, mi_xama: {m: 10},
};

/* ---------- leitura do pacote ---------- */
function otspDir() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return resolve(arg);
  const dir = join(tmpdir(), 'fibula-otsp-' + OTSP_COMMIT.slice(0, 7));
  if (!existsSync(join(dir, 'client_files', 'otsp.dat'))) {
    console.log(`baixando o OTSP em ${dir}`);
    execFileSync('git', ['clone', '--quiet', OTSP_GIT, dir], {stdio: 'inherit'});
  }
  execFileSync('git', ['-C', dir, 'checkout', '--quiet', OTSP_COMMIT], {stdio: 'inherit'});
  return dir;
}

/* formato 10.41 com spr estendido (ids de 32 bits), sem grupos de quadros —
   é o que diz o client_files/otsp.otfi do pacote */
function leDat(buf) {
  let p = 4;
  const u8 = () => buf[p++], u16 = () => { const v = buf.readUInt16LE(p); p += 2; return v; };
  const u32 = () => { const v = buf.readUInt32LE(p); p += 4; return v; };
  const nI = u16(), nO = u16(), nE = u16(), nM = u16();
  const SEM = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10,
    0x11, 0x12, 0x13, 0x14, 0x15, 0x17, 0x18, 0x1B, 0x1C, 0x1F, 0x20, 0x24, 0x25, 0x26, 0xFE]);
  const coisa = () => {
    const a = {};
    for (let f = u8(); f !== 0xFF; f = u8()) {
      if ([0x00, 0x08, 0x09, 0x1A, 0x1D, 0x1E, 0x21, 0x23].includes(f)) a[f] = u16();
      else if (f === 0x16 || f === 0x19) a[f] = [u16(), u16()];
      else if (f === 0x22) { u16(); u16(); u16(); p += u16(); u16(); u16(); a[f] = 1; }
      else if (SEM.has(f)) a[f] = 1;
      else throw new Error(`atributo desconhecido 0x${f.toString(16)} no byte ${p}`);
    }
    const w = u8(), h = u8();
    if (w > 1 || h > 1) u8();
    const L = u8(), px = u8(), py = u8(), pz = u8(), fr = u8();
    const ids = new Array(w * h * L * px * py * pz * fr);
    for (let i = 0; i < ids.length; i++) ids[i] = u32();
    return {a, w, h, L, px, py, pz, fr, ids};
  };
  const t = {i: {}, o: {}, e: {}, m: {}};
  for (let i = 100; i <= nI; i++) t.i[i] = coisa();
  for (let i = 1; i <= nO; i++) t.o[i] = coisa();
  for (let i = 1; i <= nE; i++) t.e[i] = coisa();
  for (let i = 1; i <= nM; i++) t.m[i] = coisa();
  if (p !== buf.length) throw new Error(`otsp.dat lido até ${p} de ${buf.length} bytes: formato inesperado`);
  return t;
}

/* imagem RGBA simples: {w,h,d:Uint8Array} */
const novaImg = (w, h) => ({w, h, d: new Uint8Array(w * h * 4)});
function leSpr(buf) {
  const cache = new Map();
  return (id) => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    const off = buf.readUInt32LE(8 + (id - 1) * 4);
    let img = null;
    if (off) {
      img = novaImg(32, 32);
      let o = off + 3;
      const fim = o + 2 + buf.readUInt16LE(o);
      o += 2;
      for (let k = 0; o < fim;) {
        k += buf.readUInt16LE(o);
        const n = buf.readUInt16LE(o + 2);
        o += 4;
        for (let j = 0; j < n; j++, k++, o += 3) img.d.set([buf[o], buf[o + 1], buf[o + 2], 255], k * 4);
      }
    }
    cache.set(id, img);
    return img;
  };
}

function cola(dst, src, x, y) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const s = (j * src.w + i) * 4;
    if (!src.d[s + 3]) continue;
    const X = x + i, Y = y + j;
    if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    dst.d.set(src.d.subarray(s, s + 4), (Y * dst.w + X) * 4);
  }
}

/* um quadro montado: as peças de 32 px se encaixam para cima e para a esquerda
   a partir do canto inferior direito, como o cliente do Tibia desenha */
function quadro(spr, c, {x = 0, y = 0, z = 0, f = 0, l = 0} = {}) {
  const img = novaImg(c.w * 32, c.h * 32);
  for (let hy = 0; hy < c.h; hy++) for (let wx = 0; wx < c.w; wx++) {
    const k = ((((((f * c.pz + z) * c.py + y) * c.px + x) * c.L + l) * c.h + hy) * c.w + wx);
    const s = spr(c.ids[k]);
    if (s) cola(img, s, img.w - 32 - wx * 32, img.h - 32 - hy * 32);
  }
  return img;
}

function giraMatiz(img, graus) {
  for (let k = 0; k < img.d.length; k += 4) {
    if (!img.d[k + 3]) continue;
    const r = img.d[k] / 255, g = img.d[k + 1] / 255, b = img.d[k + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    let h = 0;
    if (dl) h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
    h = ((h * 60 + graus) % 360 + 360) % 360;
    const c = mx * (mx ? dl / mx : 0), X = c * (1 - Math.abs((h / 60) % 2 - 1)), m = mx - c;
    const [R, G, B] = h < 60 ? [c, X, 0] : h < 120 ? [X, c, 0] : h < 180 ? [0, c, X] : h < 240 ? [0, X, c] : h < 300 ? [X, 0, c] : [c, 0, X];
    img.d[k] = Math.round((R + m) * 255); img.d[k + 1] = Math.round((G + m) * 255); img.d[k + 2] = Math.round((B + m) * 255);
  }
  return img;
}

/* as oito direções do projétil, em ordem de ângulo a partir do leste no
   sentido horário (y para baixo): o jogo escolhe com round(ângulo/45°) */
const DIR8 = [[2, 1], [2, 2], [1, 2], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0]];

/* devolve as linhas (direções) de quadros de um sprite da tabela ARTE */
function quadros(t, spr, def) {
  const tipo = 'oiem'.split('').find((k) => def[k] !== undefined), c = t[tipo][def[tipo]];
  if (!c) throw new Error(`${tipo}${def[tipo]} não existe no pacote`);
  let linhas;
  if (tipo === 'o') {
    /* 0 parado, 1 e 2 andando; o Tibia guarda norte, leste, sul, oeste */
    const nf = Math.min(3, c.fr);
    linhas = [0, 1, 2, 3].map((x) => Array.from({length: nf}, (_, f) => quadro(spr, c, {x, f})));
  } else if (tipo === 'm') linhas = DIR8.map(([x, y]) => [quadro(spr, c, {x, y})]);
  /* efeitos grandes do pacote começam com quadros vazios: saem do atlas */
  else linhas = [Array.from({length: c.fr}, (_, f) => quadro(spr, c, {f})).filter((q) => q.d.some((v, k) => k % 4 === 3 && v))];
  if (def.tom) for (const l of linhas) for (const q of l) giraMatiz(q, def.tom);
  const [ox, oy] = c.a[0x19] || [0, 0];
  return {linhas, ox, oy};
}

/* ---------- PNG sem biblioteca ---------- */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function png(img) {
  const bloco = (tipo, dados) => {
    const t = Buffer.from(tipo, 'ascii'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(dados.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
    return Buffer.concat([len, t, dados, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const cru = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) Buffer.from(img.d.buffer, y * img.w * 4, img.w * 4).copy(cru, y * (img.w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(cru, {level: 9})), bloco('IEND', Buffer.alloc(0))]);
}

/* ---------- atlas ---------- */
function atlas(t, spr) {
  const LARG = 1024;
  const itens = Object.entries(ARTE).map(([nome, def]) => {
    const {linhas, ox, oy} = quadros(t, spr, def), q = linhas[0][0];
    return {nome, linhas, ox, oy, w: q.w, h: q.h, W: q.w * linhas[0].length, H: q.h * linhas.length};
  });
  /* prateleiras, do mais alto para o mais baixo; o nome desempata para a ordem
     não depender de nada além da tabela */
  const ord = [...itens].sort((a, b) => b.H - a.H || b.W - a.W || a.nome.localeCompare(b.nome));
  let x = 0, y = 0, alt = 0;
  for (const it of ord) {
    if (it.W > LARG) throw new Error(`${it.nome} tem ${it.W} px, mais largo que o atlas`);
    if (x + it.W > LARG) { x = 0; y += alt; alt = 0; }
    it.x = x; it.y = y; x += it.W; alt = Math.max(alt, it.H);
  }
  const img = novaImg(LARG, y + alt), mapa = {};
  for (const it of itens) {
    it.linhas.forEach((l, d) => l.forEach((q, f) => cola(img, q, it.x + f * it.w, it.y + d * it.h)));
    mapa[it.nome] = {x: it.x, y: it.y, w: it.w, h: it.h, d: it.linhas.length, f: it.linhas[0].length, ox: it.ox, oy: it.oy};
  }
  return {img, mapa};
}

/* folhas de consulta para escolher sprites: id escrito embaixo de cada um */
function catalogo(t, spr, pasta) {
  mkdirSync(pasta, {recursive: true});
  for (const [tipo, nome] of [['o', 'criaturas'], ['i', 'itens'], ['e', 'efeitos'], ['m', 'projeteis']]) {
    const ids = Object.keys(t[tipo]).map(Number), cols = 16, cel = 68;
    const img = novaImg(cols * cel, Math.ceil(ids.length / cols) * cel);
    img.d.fill(64);
    ids.forEach((id, n) => {
      const c = t[tipo][id], q = quadro(spr, c, {x: c.px > 2 ? 2 : 0});
      cola(img, q, (n % cols) * cel + cel - q.w - 2, Math.floor(n / cols) * cel + cel - q.h - 2);
    });
    writeFileSync(join(pasta, nome + '.png'), png(img));
    writeFileSync(join(pasta, nome + '.txt'), ids.map((id, n) => `${id}\tlinha ${Math.floor(n / cols)}, coluna ${n % cols}`).join('\n'));
  }
  console.log(`catálogo em ${pasta} (o .txt diz linha e coluna de cada id)`);
}

const dir = otspDir();
const t = leDat(readFileSync(join(dir, 'client_files', 'otsp.dat')));
const spr = leSpr(readFileSync(join(dir, 'client_files', 'otsp.spr')));
const {img, mapa} = atlas(t, spr);
mkdirSync(DESTINO, {recursive: true});
writeFileSync(join(DESTINO, 'atlas.png'), png(img));
writeFileSync(join(DESTINO, 'atlas.json'), JSON.stringify({
  _meta: {fonte: 'OpenTibia Sprite Pack', commit: OTSP_COMMIT, licenca: 'CC BY 4.0', gerado_por: 'tools/sprites.mjs'},
  sprites: mapa,
}, null, 0).replace(/\},"/g, '},\n"') + '\n');
for (const f of ['LICENSE.txt', 'AUTHORS.md']) copyFileSync(join(dir, f), join(DESTINO, f));
console.log(`atlas ${img.w}×${img.h}, ${Object.keys(mapa).length} sprites → ${DESTINO}`);
if (process.argv.includes('--catalogo')) catalogo(t, spr, join(tmpdir(), 'fibula-otsp-catalogo'));
