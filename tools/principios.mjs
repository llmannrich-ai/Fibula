#!/usr/bin/env node
/* Assinatura dos princípios do Fibula (Parte 1 do CLAUDE.md).
 *
 * A Parte 1 é do Leonardo: nenhum agente a muda. Este script calcula o sha256
 * do texto dela e compara com docs/agentes/principios.sha256. O
 * tools/testar.mjs roda a conferência em toda execução, então uma Parte 1
 * mudada sem assinatura nova deixa a CI vermelha.
 *
 * As linhas "Estado hoje" de cada pilar ficam fora da conta: são fato, que
 * quem implementa o pilar atualiza junto do código, não princípio.
 *
 * Uso:
 *   node tools/principios.mjs            confere (sai 1 se não bate)
 *   node tools/principios.mjs --assina   grava a assinatura (só o Leonardo)
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ARQ = join(RAIZ, 'docs', 'agentes', 'principios.sha256');

/* o texto da Parte 1, sem as linhas "Estado hoje" e com fim de linha normalizado */
export function parte1(guia = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8')) {
  const ls = guia.replace(/\r\n/g, '\n').split('\n');
  const ini = ls.findIndex((l) => /^## 1\. /.test(l)), fim = ls.findIndex((l) => /^## 2\. /.test(l));
  if (ini < 0 || fim < ini) return null;
  const r = [];
  let estado = false;
  for (const l of ls.slice(ini, fim)) {
    if (/^- \*\*Estado hoje/.test(l)) { estado = true; continue; }
    if (estado && /^  \S/.test(l)) continue;
    estado = false;
    r.push(l.replace(/\s+$/, ''));
  }
  return r.join('\n').trim() + '\n';
}
export const hash = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

/* null se bate; senão, o motivo */
export function confere() {
  const t = parte1();
  if (!t) return 'a Parte 1 não foi encontrada no CLAUDE.md (títulos "## 1." e "## 2.")';
  let gravado = '';
  try { gravado = readFileSync(ARQ, 'utf8').trim().split(/\s+/)[0]; } catch (e) { return `falta ${ARQ}`; }
  return gravado === hash(t) ? null : 'a Parte 1 do CLAUDE.md (os princípios) mudou sem assinatura do dono';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--assina')) {
    const t = parte1();
    if (!t) { console.error('Parte 1 não encontrada'); process.exit(1); }
    writeFileSync(ARQ, `${hash(t)}  Parte 1 do CLAUDE.md, sem as linhas "Estado hoje"\n`);
    console.log(`PRINCIPIOS assinados: ${hash(t).slice(0, 12)}`);
  } else {
    const m = confere();
    console.log(m ? `PRINCIPIOS_FALHOU: ${m}` : 'PRINCIPIOS_OK');
    process.exit(m ? 1 : 0);
  }
}
