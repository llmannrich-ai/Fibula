#!/usr/bin/env node
/* Confere o jogo no ar: o GitHub Pages está servindo exatamente o que está
 * neste checkout?
 *
 * A CI verde prova que o código passa nos testes; não prova que o Pages
 * publicou, nem que o que o jogador baixa é o que foi comitado. Este script
 * lê a versão do index.html no ar e compara, byte a byte, o index.html, todo
 * módulo de src/ (no endereço com ?v=, que é o que o navegador pede), o
 * content.json e o atlas.json com os arquivos deste checkout.
 *
 * Usa o curl (existe no Windows, no Linux da CI e na nuvem, e respeita o
 * proxy do ambiente), não o fetch do Node, que ignora o proxy.
 *
 * Uso:
 *   node tools/no-ar.mjs              confere uma vez
 *   node tools/no-ar.mjs --espera 20  tenta por até 20 min (o Pages leva de
 *                                     1 a mais de 10, com a fila do Actions)
 * Sai 0 com NO_AR_OK; 1 com NO_AR_FALHOU e o que diverge.
 */
import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.FIBULA_SITE || 'https://llmannrich-ai.github.io/Fibula/';
const baixa = (url) => execFileSync('curl', ['-sSfL', '--max-time', '30', url], {maxBuffer: 64 << 20});
const versaoDe = (html) => (/src\/main\.js\?v=([\w.]+)/.exec(html) || [])[1] || null;
const listaJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? listaJs(p) : n.endsWith('.js') ? [p] : []; });

function confere() {
  const local = readFileSync(join(RAIZ, 'index.html'));
  const v = versaoDe(local.toString('utf8'));
  let html;
  try { html = baixa(`${SITE}index.html?t=${Date.now()}`); } catch (e) { return [`o site não respondeu: ${String(e.message).split('\n')[0]}`]; }
  const vNoAr = versaoDe(html.toString('utf8'));
  if (vNoAr !== v) return [`no ar está a ${vNoAr}, este checkout é a ${v}`];
  const dif = [];
  if (!html.equals(local)) dif.push('index.html');
  const arqs = [...listaJs(join(RAIZ, 'src')).map((p) => [p, `?v=${v}`]),
    [join(RAIZ, 'data', 'game', 'content.json'), `?t=${Date.now()}`], [join(RAIZ, 'assets', 'otsp', 'atlas.json'), `?t=${Date.now()}`]];
  for (const [p, q] of arqs) {
    const rel = relative(RAIZ, p).split('\\').join('/');
    try { if (!baixa(SITE + rel + q).equals(readFileSync(p))) dif.push(rel); } catch (e) { dif.push(`${rel} (não baixou)`); }
  }
  return dif.length ? [`diferente do checkout: ${dif.join(', ')}`] : [];
}

const i = process.argv.indexOf('--espera');
const ate = Date.now() + (i > 0 ? Number(process.argv[i + 1] || 10) : 0) * 60000;
let r = confere();
while (r.length && Date.now() < ate) {
  execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},20000)']);
  r = confere();
}
console.log(r.length ? `NO_AR_FALHOU: ${r.join('; ')}` : `NO_AR_OK (${SITE}, igual a este checkout)`);
process.exit(r.length ? 1 : 0);
