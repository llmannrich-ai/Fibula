/* Monta o documento da Arena para os testadores (docs/arena-testadores.html e .pdf).
 * Os números saem do data/game/content.json (hunts.arena) e o mapa, de leMapa()
 * em src/sim/mapa.js: rodar de novo depois de mudar a Arena.
 *   node tools/arena-pdf.mjs            grava o HTML e o PDF
 *   node tools/arena-pdf.mjs --so-html  só o HTML
 * O PDF precisa do Playwright (global) e do Chromium em /opt/pw-browsers ou FIBULA_EDGE. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execSync} from 'node:child_process';
import {createRequire} from 'node:module';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSAO = /src\/main\.js\?v=([\d.]+)/.exec(readFileSync(join(BASE, 'index.html'), 'utf8'))[1];
const Mp = await import(pathToFileURL(join(BASE, 'src/sim/mapa.js')).href + '?v=' + VERSAO);
const C = JSON.parse(readFileSync(join(BASE, 'data/game/content.json'), 'utf8'));
const H = C.hunts.arena, A = H.arena, M = Mp.leMapa(H.mapa), MW = H.mapa.w || 64, MH = H.mapa.h || 64;
const npc = Object.values(C.city.npcs).find(n => n.abre === 'arena');
const MON = C.enemies;
const xy = t => t.trim().split(/\s+/).map(Number);
const [cx, cy] = xy(A.pontos.centro);
const mm = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pct = f => `${Math.round(f * 100)}%`;

/* ---------- mapa ---------- */
const S = 7, W = MW * S;
const anel = (x, y) => Math.max(Math.abs(x - cx), Math.abs(y - cy));
const aneis = [...A.aneis].sort((a, b) => a.t - b.t);
const zona = (x, y) => { const r = anel(x, y); let z = 0; for (const a of aneis) if (r > a.r) return z; else z++; return z; };
const COR = ['#d9a066', '#e8c46a', '#a9c98a', '#7fb3a3'];
let chao = '', livres = 0;
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
  if (M.g[y * MW + x] !== 0) continue; livres++;
  chao += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="${COR[zona(x, y)]}"/>`;
}
const quad = r => `<rect x="${(cx - r) * S}" y="${(cy - r) * S}" width="${(2 * r + 1) * S}" height="${(2 * r + 1) * S}" fill="none" stroke="#f4efe6" stroke-width="1.4" stroke-dasharray="5 4" opacity=".85"/>`;
const rotAnel = (r, t) => `<text x="${(cx - r) * S + 4}" y="${(cy - r) * S - 4}" class="ra">${mm(t)}</text>`;
const pontos = M.pontos.map(p => `<circle cx="${p.x * S + S / 2}" cy="${p.y * S + S / 2}" r="2.4" fill="#5b3b8c"/>`).join('');
const entradas = A.pontos.entradas.map((t, i) => { const [x, y] = xy(t);
  return `<rect x="${x * S - 5}" y="${y * S - 5}" width="${S + 10}" height="${S + 10}" fill="#1f5fa8" stroke="#fff" stroke-width="1.5"/><text x="${x * S + S / 2}" y="${y * S + S / 2 + 4}" class="ln">${i + 1}</text>`; }).join('');
const saidas = A.pontos.saidas.map(t => { const [x, y] = xy(t);
  return `<rect x="${x * S - 3}" y="${y * S - 3}" width="${S + 6}" height="${S + 6}" fill="#1e7a3c" stroke="#fff" stroke-width="1.5"/><text x="${x * S + S / 2}" y="${y * S + S / 2 + 3.5}" class="ls">S</text>`; }).join('');
const chefe = `<circle cx="${cx * S + S / 2}" cy="${cy * S + S / 2}" r="7" fill="#b3261e" stroke="#fff" stroke-width="1.5"/><text x="${cx * S + S / 2}" y="${cy * S + S / 2 + 3.5}" class="ls">C</text>`;
const svgMapa = `<svg viewBox="-6 -16 ${W + 12} ${W + 22}" class="mapa" role="img" aria-label="Mapa da Arena">
<rect x="0" y="0" width="${W}" height="${W}" fill="#2b2420"/>${chao}
${aneis.map(a => quad(a.r) + rotAnel(a.r, a.t)).join('')}${pontos}${entradas}${saidas}${chefe}</svg>`;

/* ---------- esquema dos anéis (concêntrico, fora de escala) ---------- */
const nZ = aneis.length + 1, R0 = 150;
let esq = '';
for (let z = 0; z < nZ; z++) { const lado = R0 * 2 * (nZ - z) / nZ;
  esq += `<rect x="${R0 - lado / 2}" y="${R0 - lado / 2}" width="${lado}" height="${lado}" fill="${COR[z]}" stroke="#3a2a1a" stroke-width="1.2"/>`; }
const nomesZ = ['Borda', 'Anel do meio', 'Anel interno', 'Centro'];
const fimZ = [...aneis.map(a => a.t), A.dur];
for (let z = 0; z < nZ; z++) { const lado = R0 * 2 * (nZ - z) / nZ, y = R0 - lado / 2 + 16;
  esq += z === nZ - 1 ? `<text x="${R0}" y="${R0 - 3}" class="ez">${nomesZ[z]}</text><text x="${R0}" y="${R0 + 10}" class="ez">${mm(fimZ[z])}</text>`
    : `<text x="${R0}" y="${y}" class="ez">${nomesZ[z]} · ${mm(fimZ[z])}</text>`; }
const svgEsq = `<svg viewBox="0 0 300 300" class="esq" role="img" aria-label="Anéis da Arena">${esq}</svg>`;

/* ---------- linha do tempo ---------- */
const evs = [...A.fases.map(f => ({t: f.t, chefe: f.chefe, msg: f.msg})), {t: A.dur, msg: 'Tudo desaba: quem não saiu morre. A próxima partida começa.'}].sort((a, b) => a.t - b.t);
const TW = 640, px = t => 20 + t / A.dur * (TW - 40);
let tl = `<rect x="${px(0)}" y="46" width="${px(A.entraAte) - px(0)}" height="12" fill="#1f5fa8"/>`
  + `<rect x="${px(A.entraAte)}" y="46" width="${px(A.dur) - px(A.entraAte)}" height="12" fill="#c8c0b4"/>`
  + `<rect x="${px(A.saidas)}" y="62" width="${px(A.dur) - px(A.saidas)}" height="8" fill="#1e7a3c"/>`;
aneis.forEach((a, i) => { tl += `<rect x="${px(a.t)}" y="74" width="${px(A.dur) - px(a.t)}" height="5" y2="0" fill="${['#d9a066', '#c99a3a', '#7a9a5a'][i]}" transform="translate(0 ${i * 6})"/>`; });
for (const e of evs) tl += `<line x1="${px(e.t)}" y1="30" x2="${px(e.t)}" y2="98" stroke="#3a2a1a" stroke-width="1"/><text x="${px(e.t)}" y="24" class="tt">${mm(e.t)}</text>`;
tl += `<text x="${px(0)}" y="112" class="tk" text-anchor="start">porta aberta</text><text x="${px(A.saidas)}" y="112" class="tk" text-anchor="start">saídas no centro</text>`;
const svgTL = `<svg viewBox="0 0 ${TW} 120" class="tl" role="img" aria-label="Linha do tempo">${tl}</svg>`;
const linhas = evs.map(e => `<tr><td class="h">${mm(e.t)}</td><td>${e.chefe ? e.msg.replace(MON[e.chefe].nome, `<b>${MON[e.chefe].nome}</b>`) : e.msg}</td></tr>`).join('');

/* ---------- contagens ---------- */
const porMon = {}; for (const p of M.pontos) porMon[p.k] = (porMon[p.k] || 0) + 1;
const listaMon = Object.entries(porMon).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${MON[k].nome} (${n})`).join(', ');
const chefes = A.fases.filter(f => f.chefe).map(f => `${MON[f.chefe].nome} (${mm(f.t)})`).join(' e ');
const perda = pct(C.progression.xp.deathLoss);

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arena do Fibula</title>
<style>
:root{--tinta:#2a211b;--papel:#fbf8f2;--linha:#d8cfc2;--fraco:#6d6157;--azul:#1f5fa8;--verde:#1e7a3c;--verm:#b3261e}
@page{size:A4;margin:12mm 14mm}
*{box-sizing:border-box}
html,body{background:#fff}
body{margin:0;color:var(--tinta);font:10.5pt/1.38 Verdana,"DejaVu Sans",sans-serif}
main{max-width:180mm;margin:0 auto;padding:0 16px}
h1{font:700 26pt/1.1 Palatino,"Palatino Linotype","DejaVu Serif",serif;margin:0 0 4px}
h2{font:700 16pt/1.2 Palatino,"Palatino Linotype","DejaVu Serif",serif;margin:0 0 10px;padding-bottom:4px;border-bottom:2px solid var(--tinta)}
.sub{color:var(--fraco);margin:0 0 14px}
section{margin:0 0 12px}
.pg{break-before:page}
.caixa{border:1px solid var(--linha);background:#fff;padding:10px 12px;border-radius:4px}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
td{background:transparent}
.tres div{border:1px solid var(--linha);background:#fff;padding:8px;border-radius:4px}
.tres b{display:block;font-size:15pt}
table{width:100%;border-collapse:collapse;margin:6px 0}
td,th{border-bottom:1px solid var(--linha);padding:3px 6px;text-align:left;vertical-align:top}
th{font-size:9.5pt;color:var(--fraco);font-weight:400;text-transform:uppercase;letter-spacing:.04em}
td.h{font-weight:700;white-space:nowrap;width:52px}
.mapa{width:100%;max-width:128mm;display:block;margin:0 auto}
.esq{width:36%;max-width:66mm;display:block;margin:6px auto}
.tl{width:100%;display:block;margin:6px 0 4px}
.tt{font:700 10px Verdana,sans-serif;text-anchor:middle;fill:#2a211b}
.tk{font:9px Verdana,sans-serif;fill:#6d6157}
.ra{font:700 11px Verdana,sans-serif;fill:#fff;paint-order:stroke;stroke:#3a2a1a;stroke-width:3px}
.ln{font:700 12px Verdana,sans-serif;fill:#fff;text-anchor:middle}
.ls{font:700 9px Verdana,sans-serif;fill:#fff;text-anchor:middle}
.ez{font:700 9.5px Verdana,sans-serif;text-anchor:middle;fill:#2a211b}
.leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:9.5pt;margin:8px 0}
.leg i{display:inline-block;width:12px;height:12px;vertical-align:-1px;margin-right:4px;border:1px solid #0003}
ul{margin:4px 0;padding-left:20px}li{margin:3px 0}
.aviso{border-left:4px solid var(--verm);padding:6px 10px;background:#fff}
.q{border:1px solid var(--linha);background:#fff;border-radius:4px;padding:7px 10px;margin:0 0 7px;break-inside:avoid}
.q p{margin:0 0 6px}
.marca{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:10.5pt}
.marca span::before{content:"";display:inline-block;width:13px;height:13px;border:1.5px solid var(--tinta);margin-right:6px;vertical-align:-2px}
.obs{border-bottom:1px solid var(--linha);height:16px;margin-top:4px}
.rod{color:var(--fraco);font-size:9pt;margin-top:14px}
@media (max-width:520px){body{font-size:15px}.tres{grid-template-columns:1fr}h1{font-size:26px}h2{font-size:20px}.esq{width:100%}}
</style></head><body><main>

<section>
<h1>A Arena</h1>
<p class="sub">Plano para os testadores aprovarem · Fibula ${VERSAO} · 19/10/2026</p>
<div class="caixa">
Um lugar de caça com outra dinâmica: uma partida de <b>${A.dur / 60} minutos</b> que recomeça sozinha, para até <b>${A.max} jogadores</b>.
A arena desaba da borda para o centro, os chefes e as saídas ficam no meio, e outros jogadores podem matar você.
Você entra com o seu personagem e sai com a experiência e o loot que conseguiu, como em qualquer caçada.
</div>
<div class="tres">
<div><b>${A.dur / 60} min</b>por partida, em ciclo</div>
<div><b>${A.max}</b>jogadores por partida</div>
<div><b>nível ${H.nivel}</b>recomendado (não bloqueia)</div>
</div>
<h2>Como entrar</h2>
<table>
<tr><td class="h">1</td><td>Fale com o <b>${npc.nome}</b>, no portão sul da cidade.</td></tr>
<tr><td class="h">2</td><td>Ou toque em <b>Arena</b> no menu ou na escolha de personagem.</td></tr>
<tr><td class="h">3</td><td>Se for jogar em time, digite o mesmo <b>código de time</b> que os amigos (até 8 letras e números).</td></tr>
<tr><td class="h">4</td><td>A porta só aceita entrada até <b>${mm(A.entraAte)}</b> da partida. Depois, espera-se a próxima.</td></tr>
</table>
<p class="sub">A partida é um ciclo do relógio da arena, não de quem entra: quem chega no meio tem menos tempo.</p>
</section>

<section>
<h2>As regras</h2>
<table>
<tr><th>Tema</th><th>Regra</th></tr>
<tr><td>Times</td><td>Quem digita o mesmo código nasce no mesmo canto e não se fere. Sem código, todos são adversários.</td></tr>
<tr><td>PvP</td><td>Jogador de outro time fere com <b>${pct(A.pvp)} do dano</b>. Matar jogador não dá XP; conta no placar.</td></tr>
<tr><td>Lotação</td><td>Até ${A.max} jogadores por partida.</td></tr>
<tr><td>Chefes</td><td>${chefes}, sempre no centro.</td></tr>
<tr><td>O que é seu</td><td>A experiência e o loot que você fizer e trouxer pela saída.</td></tr>
<tr><td>Morrer</td><td>Custa a <b>mochila inteira</b> e <b>${perda} do XP do nível</b> (nunca o nível). A mochila fica <b>no chão</b>, para qualquer um pegar.</td></tr>
<tr><td>Selo de resguardo</td><td><b>Não guarda nada na Arena</b>, para morrer de propósito não duplicar valor.</td></tr>
</table>
</section>


<section class="pg">
<h2>A partida, minuto a minuto</h2>
${svgTL}
<div class="leg"><span><i style="background:#1f5fa8"></i>porta aberta</span><span><i style="background:#1e7a3c"></i>saídas abertas no centro</span><span><i style="background:#d9a066"></i>anéis desabando</span></div>
<table><tr><th>Tempo</th><th>O que acontece</th></tr>${linhas}</table>

<h2>Os anéis</h2>
${svgEsq}
<table><tr><th>Zona</th><th>Distância do centro</th><th>Desaba aos</th></tr>
${nomesZ.map((n, z) => `<tr><td>${n}</td><td>${z === 0 ? `mais de ${aneis[0].r} sqm` : z < nZ - 1 ? `${aneis[z].r + 1} a ${aneis[z - 1].r} sqm` : `até ${aneis[nZ - 2].r} sqm`}</td><td>${mm(fimZ[z])}</td></tr>`).join('')}
</table>
<ul>
<li>Fora do anel que já caiu, o chão tira <b>${pct(A.desaba)} da vida máxima por segundo</b>, igual para todos.</li>
<li>Aos ${mm(A.dur)}, quem ainda está dentro morre, os monstros voltam e a partida seguinte começa.</li>
<li>Sair só pelas saídas do centro, depois de ${mm(A.saidas)}. A porta de onde se entrou não serve de saída.</li>
</ul>

</section>

<section class="pg">
<h2>O mapa</h2>
${svgMapa}
<div class="leg">
<span><i style="background:#1f5fa8"></i>entrada de cada time (1 a 4)</span>
<span><i style="background:#1e7a3c"></i>saída (S), abre aos ${mm(A.saidas)}</span>
<span><i style="background:#b3261e"></i>chefes (C)</span>
<span><i style="background:#5b3b8c;border-radius:50%"></i>monstro</span>
</div>
<div class="leg">
${nomesZ.map((n, z) => `<span><i style="background:${COR[z]}"></i>${n}: desaba aos ${mm(fimZ[z])}</span>`).join('')}
</div>
<p class="sub">Mapa real da versão ${VERSAO}: ${MW}×${MH} sqm, ${livres} sqm de chão, ${M.pontos.length} monstros fixos (${listaMon}). A linha tracejada é o limite de cada anel, com a hora em que o que está fora dela desaba. Os monstros ficam mais fortes perto do centro.</p>
</section>

<section>
<h2>Riscos conhecidos na fase de teste</h2>
<ul>
<li><b>Quem hospeda a sala calcula tudo.</b> O aparelho de um dos jogadores roda a partida, e ele pode trapacear (inclusive forjar a morte de outro) até existir servidor próprio.</li>
<li><b>Não há punição para quem mata.</b> Nenhuma marca, nenhuma perda extra para o assassino, por enquanto.</li>
<li><b>O mapa é rascunho</b>, gerado por programa. O desenho definitivo vem depois.</li>
<li><b>${A.max} jogadores ficam perto do limite</b> do plano grátis do serviço de rede. Pode haver atraso ou queda com a sala cheia.</li>
<li>O anfitrião não pode deixar o jogo em segundo plano: a partida congela para todos até outro assumir.</li>
</ul>
</section>

<section class="pg">
<h2>O que pedimos a vocês</h2>
<p class="sub">Marque uma opção em cada pergunta. Se marcar Ajustar, diga como.</p>
${[
  `A partida dura ${A.dur / 60} minutos.`,
  `A porta fecha aos ${mm(A.entraAte)}.`,
  `O PvP fere com ${pct(A.pvp)} do dano.`,
  `O Selo de resguardo não vale na Arena.`,
  `O tamanho do mapa (${MW}×${MH} sqm) para até ${A.max} jogadores.`,
  `O ritmo dos anéis (${aneis.map(a => mm(a.t)).join(', ')} e ${mm(A.dur)}).`,
  `Não haver punição para quem mata.`,
].map((q, i) => `<div class="q"><p><b>${i + 1}.</b> ${q}</p><div class="marca"><span>Aprovo</span><span>Ajustar</span><span>Não aprovo</span></div><div class="obs"></div></div>`).join('')}
<div class="q"><p><b>8.</b> Querem punição para quem mata? Qual?</p><div class="obs"></div><div class="obs"></div></div>
<div class="q"><p><b>9.</b> O que preferem jogar: Arena, caçada normal ou as duas?</p><div class="marca"><span>Arena</span><span>Caçada normal</span><span>As duas</span></div><div class="obs"></div></div>
<p class="rod">Os números deste documento saem do jogo (data/game/content.json, versão ${VERSAO}) e podem mudar com o retorno de vocês.</p>
</section>
</main></body></html>`;

const outH = join(BASE, 'docs/arena-testadores.html');
writeFileSync(outH, html);
console.log('HTML', outH);
if (process.argv.includes('--so-html')) process.exit(0);

const req = createRequire(import.meta.url);
const {chromium} = req(join(execSync('npm root -g').toString().trim(), 'playwright'));
const exe = process.env.FIBULA_EDGE || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const nav = await chromium.launch({executablePath: exe, args: ['--no-sandbox']});
const pg = await nav.newPage();
await pg.goto(pathToFileURL(outH).href);
await pg.pdf({path: join(BASE, 'docs/arena-testadores.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true});
await nav.close();
console.log('PDF', join(BASE, 'docs/arena-testadores.pdf'));
