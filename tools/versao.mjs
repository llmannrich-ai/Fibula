#!/usr/bin/env node
/* Troca a versão do jogo em todos os endereços de uma vez.
 *
 * O GitHub Pages manda o navegador guardar cada arquivo por 10 minutos
 * (cache-control: max-age=600). Com o jogo em módulos, quem recarrega logo
 * depois de um deploy pode receber o index.html novo com módulos velhos do
 * cache — e um import que não existe mais deixa a tela preta. Por isso todo
 * módulo é pedido com ?v=<versão>: versão nova, endereços novos, nada do cache
 * antigo se mistura.
 *
 * A versão mora num lugar só, a linha <script type="module"
 * src="src/main.js?v=..."> do index.html; o menu do jogo lê de lá
 * (import.meta.url). Este script reescreve essa linha e todo import relativo
 * de src/. Todos precisam ter a MESMA versão: o mesmo arquivo com dois ?v
 * diferentes vira dois módulos, com dois estados. O tools/testar.mjs barra
 * qualquer import sem a versão do index.html.
 *
 * Uso:
 *   node tools/versao.mjs           mostra a versão atual
 *   node tools/versao.mjs 0.6.0     troca para 0.6.0
 *
 * Esquema: 0.<etapa>.<correção>. Sobe o segundo número quando muda o que o
 * jogador vê ou o formato do jogo; o terceiro para correção. Toda versão nova
 * ganha uma linha na tabela "Versões" do README.md.
 */
import {readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(RAIZ, 'index.html');
const TAG = /<script type="module" src="src\/main\.js(?:\?v=([^"]*))?"><\/script>/;
const IMPORT = /(from\s+'(?:\.{1,2}\/)[^'?]+\.js)(?:\?v=[^']*)?'/g;

function listaJs(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...listaJs(p));
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}

const html = readFileSync(INDEX, 'utf8');
const m = TAG.exec(html);
if (!m) { console.error('não achei <script type="module" src="src/main.js..."> no index.html'); process.exit(2); }
const nova = process.argv[2];
if (!nova) { console.log(m[1] || '(sem versão)'); process.exit(0); }
if (!/^\d+\.\d+\.\d+$/.test(nova)) { console.error(`versão "${nova}" fora do formato 0.5.0`); process.exit(2); }

writeFileSync(INDEX, html.replace(TAG, `<script type="module" src="src/main.js?v=${nova}"></script>`), 'utf8');
let n = 0;
for (const arq of listaJs(join(RAIZ, 'src'))) {
  const txt = readFileSync(arq, 'utf8');
  const novo = txt.replace(IMPORT, (_, ini) => { n++; return `${ini}?v=${nova}'`; });
  if (novo !== txt) writeFileSync(arq, novo, 'utf8');
}
console.log(`versão ${m[1] || '(nenhuma)'} → ${nova}: index.html e ${n} imports de src/`);
