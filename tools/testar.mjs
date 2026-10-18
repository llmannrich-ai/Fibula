#!/usr/bin/env node
/* Harness de teste headless do Fibula.
 *
 * Automatiza o roteiro manual da seção "Como testar" do CLAUDE.md: checa a
 * sintaxe de cada módulo de src/, roda a simulação (src/sim/) direto no Node,
 * sem navegador, monta uma CÓPIA do jogo (index.html, src/, conteúdo e arte)
 * para cada caso de teste e roda cada cópia no Edge headless, servida por HTTP
 * em 127.0.0.1. O jogo de verdade nunca é tocado.
 *
 * Cada cópia recebe, injetado em volta do módulo do jogo:
 *   - o atalho de requestAnimationFrame (sem ele o laço nunca roda no headless
 *     e o teste leria só os placeholders estáticos do markup);
 *   - um capturador que acumula erros de janela num atributo data-errs no <html>;
 *   - Math.random semeado, para mapa, spawns e loot serem iguais toda vez;
 *   - o save semeado no localStorage;
 *   - um roteiro que clica nos botões, grava o resultado em atributos data-* e
 *     devolve tudo para este script.
 *
 * Por que não --dump-dom: o Edge 155 aceita a opção e não escreve nada (a
 * opção saiu do headless novo e só existe no chrome-headless-shell, que não
 * vem instalado). Em vez dela, este script sobe um servidor HTTP em 127.0.0.1,
 * que entrega as cópias (módulo ES não carrega de file://) e recebe o POST do
 * resultado no fim do roteiro. O DOM final vem no mesmo
 * pacote e é gravado em dump.html, para inspeção igual à do roteiro manual.
 *
 * Uso:
 *   node tools/testar.mjs            roda todos os casos
 *   node tools/testar.mjs --lista    lista os casos
 *   node tools/testar.mjs mercador   roda só os casos cujo nome casa
 *
 * As cópias e os dumps de cada caso ficam na pasta de trabalho até a execução
 * seguinte; --manter só imprime onde elas estão.
 *
 * Variáveis de ambiente: FIBULA_EDGE (binário do navegador), FIBULA_SAIDA
 * (pasta de trabalho), FIBULA_JOGO (index.html de outra cópia do jogo, com o
 * src/ ao lado). Sai com código diferente de zero se a sintaxe falhar,
 * se algum caso registrar erro de janela ou se qualquer asserção falhar.
 */

import {execFileSync, spawn, spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* FIBULA_JOGO serve para apontar uma cópia propositalmente quebrada e conferir
   que o portão realmente falha; no uso normal é sempre o index.html da raiz */
const JOGO = process.env.FIBULA_JOGO || join(RAIZ, 'index.html');
const BASE = dirname(JOGO);
const SAIDA = process.env.FIBULA_SAIDA || join(tmpdir(), 'fibula-harness');

/* Na máquina do Leonardo é o Edge; na nuvem não existe Edge, então procura
   também o Chromium do Playwright e o que estiver no PATH. */
const CANDIDATOS = [
  process.env.FIBULA_EDGE,
  process.env.CHROME,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);
const NOMES_NO_PATH = ['chromium', 'chromium-browser', 'google-chrome', 'chrome', 'msedge'];

/* ---------- fontes e portão de sintaxe ---------- */
/* O jogo é o index.html e os módulos de src/. Todos são lidos para um mapa
   caminho → texto, que é o que os patches mexem e o que vai para cada cópia. */
const MODULO = '<script type="module" src="src/main.js"></script>';
function listaJs(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...listaJs(p));
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}
function leFontes() {
  const f = {'index.html': readFileSync(JOGO, 'utf8')};
  if (!f['index.html'].includes(MODULO)) throw new Error(`o index.html não carrega o jogo com ${MODULO}`);
  for (const arq of listaJs(join(BASE, 'src'))) f[relative(BASE, arq).replace(/\\/g, '/')] = readFileSync(arq, 'utf8');
  return f;
}

/* Um erro de sintaxe em qualquer módulo derruba o jogo inteiro: o navegador
   não executa nada de um grafo de módulos com um arquivo quebrado. */
function verificaSintaxe(fontes, trabalho) {
  const dir = join(trabalho, 'sintaxe');
  for (const [nome, txt] of Object.entries(fontes)) {
    if (!nome.endsWith('.js')) continue;
    /* .mjs para o node ler como módulo sem depender de package.json */
    const arq = join(dir, nome.replace(/\.js$/, '.mjs'));
    mkdirSync(dirname(arq), {recursive: true});
    writeFileSync(arq, txt, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', arq], {stdio: 'pipe'});
    } catch (e) {
      return `${nome}: ${String(e.stderr || e.message).trim()}`;
    }
  }
  return null;
}

/* ---------- patches na cópia ---------- */
/* Cada patch é uma substituição exata, procurada em todas as fontes, que
   estoura se não casar em nenhuma: se o código mudar, o harness falha alto em
   vez de testar coisa nenhuma. */
function patch(fontes, de, para, nome) {
  const onde = Object.keys(fontes).filter((k) => fontes[k].includes(de));
  if (!onde.length) throw new Error(`patch "${nome}" não casou: o jogo mudou, ajuste tools/testar.mjs`);
  for (const k of onde) fontes[k] = fontes[k].split(de).join(para);
  return fontes;
}

const P = {
  /* encurta a incursão: sem isso um caso de ponta a ponta levaria 6 minutos */
  tempo: (run, portal) => (h) => patch(h, 'RUN=360,PORTAL_AT=90', `RUN=${run},PORTAL_AT=${portal}`, 'tempo da incursão'),
  /* o saco entra semeado para a aritmética do cofre ficar determinística */
  saco: (h) => patch(h, 't:0,bag:{},bagVal:0,', 't:0,bag:{ouro:200},bagVal:200,', 'saco semeado'),
  /* o mesmo saco com uma espada (20): equipamento vai para o cofre como peça */
  sacoEquip: (h) => patch(h, 't:0,bag:{},bagVal:0,', 't:0,bag:{ouro:200,espada:1},bagVal:220,', 'saco semeado com espada'),
  /* portal na sala de entrada: no headless não há quem arraste o joystick até
     a sala do Guardião, e o que está sob teste é a extração, não a caminhada */
  portalNaEntrada: (h) => patch(h, 'portal:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false,ch:0}',
    'portal:{x:(s.cx+.5)*T,y:(s.cy+.5)*T,open:false,ch:0}', 'portal na entrada'),
  /* deixa a sala de entrada receber monstros, para haver combate e morte */
  spawnNaEntrada: (h) => patch(h, 'if(r===s)continue;', 'if(false)continue;', 'spawn na entrada'),
  /* põe um Supabase de mentira na frente do fetch do jogo (a chave real fica,
     mas nada sai para a rede). Imita as funções do login simples
     (tools/supabase/002_login_simples.sql): window.__nuvem.dados é o save do
     jogador (null = sem save), contas guarda usuário → senha, e cada leitura,
     gravação e login fica contado para o roteiro conferir. O token válido é
     sempre 'tk1', do jogador 'u1'. */
  nuvem: (remoto, contas) => (h) => patch(h,
    MODULO,
    `<script>
window.__nuvem={dados:${JSON.stringify(remoto ?? null)},contas:${JSON.stringify(contas || {})},gets:0,posts:0,token:'',login:'',saiu:0};
{const f0=window.fetch;window.fetch=function(u,o){u=String(u);o=o||{};if(u.indexOf('supabase.co')<0)return f0(u,o);
  const N=window.__nuvem,b=JSON.parse(o.body||'{}'),r=(st,x)=>Promise.resolve({ok:st<300,status:st,json:()=>Promise.resolve(x)}),
    erro=m=>r(400,{code:'P0001',message:m}),fn=u.split('/rpc/')[1];
  if(fn==='save_ler'){N.gets++;N.token=b.p_token;return b.p_token==='tk1'?r(200,N.dados):erro('sessao')}
  if(fn==='save_gravar'){N.token=b.p_token;if(b.p_token!=='tk1')return erro('sessao');N.posts++;N.dados=b.p_dados;return r(204,null)}
  if(fn==='conta_entrar'){N.login=b.p_usuario;return N.contas[b.p_usuario.toLowerCase()]===b.p_senha?r(200,{token:'tk1',id:'u1',usuario:b.p_usuario}):erro('credenciais')}
  if(fn==='conta_criar'){N.login=b.p_usuario;if(b.p_usuario.toLowerCase() in N.contas)return erro('usuario_existe');
    N.contas[b.p_usuario.toLowerCase()]=b.p_senha;return r(200,{token:'tk1',id:'u1',usuario:b.p_usuario})}
  if(fn==='conta_sair'){N.saiu++;return r(204,null)}
  return r(404,{})}}
</script>
${MODULO}`, 'Supabase falso'),
};

/* Ajustes no conteúdo que o prelúdio entrega à cópia. As tabelas saíram do
   index.html para o content.json, então o que antes era patch de texto agora
   muda o objeto — e estoura do mesmo jeito se o campo esperado não estiver lá. */
function ajusta(c, caminho, esperado, novo, nome) {
  const ch = caminho.split('.'), k = ch.pop();
  const o = ch.reduce((a, p) => a && a[p], c);
  if (!o || JSON.stringify(o[k]) !== JSON.stringify(esperado))
    throw new Error(`ajuste "${nome}" não casou em ${caminho}: o content.json mudou, ajuste tools/testar.mjs`);
  o[k] = novo;
}

const A = {
  /* rato letal: mata o jogador num golpe, para exercitar finish("morreu") */
  ratoLetal: (c) => {
    ajusta(c, 'enemies.rato.spd', 72, 150, 'rato letal');
    ajusta(c, 'enemies.rato.dmg', 4, 200, 'rato letal');
    ajusta(c, 'enemies.rato.atk', 0.9, 0.3, 'rato letal');
  },
};
/* sessão já aberta do login simples: o token 'tk1' é o que o Supabase falso aceita */
const SESSAO = {tk: 'tk1', uid: 'u1', usuario: 'jogador'};
const espera = (ms) => `await new Promise(function(r){setTimeout(r,${ms})});`;

/* ---------- injeção ---------- */
/* Cada cópia leva o próprio data/game/content.json (o real, ou o ajustado pelo
   campo conteudo do caso), e o jogo o busca por fetch como no Pages, então
   validaConteudo() roda contra o conteúdo verdadeiro.
   O recuo para RAIZ existe porque FIBULA_JOGO pode apontar uma cópia quebrada
   fora do repositório, que não tem data/ ao lado. */
const CONTEUDO = (() => {
  const tentativas = [join(BASE, 'data', 'game', 'content.json'),
                      join(RAIZ, 'data', 'game', 'content.json')];
  for (const arq of tentativas) {
    if (!existsSync(arq)) continue;
    const txt = readFileSync(arq, 'utf8');
    try { JSON.parse(txt); } catch (e) {
      console.error(`FALHA: ${arq} não é JSON válido (${e.message})`);
      process.exit(2);
    }
    return txt;
  }
  console.error(`FALHA: não achei data/game/content.json (tentei ${tentativas.join(' e ')})`);
  process.exit(2);
})();

/* A arte (assets/otsp) segue o mesmo caminho: atlas.json e atlas.png são
   copiados para cada cópia. Caso com semArte:true não recebe nenhum dos dois e
   exercita o desenho em código, que é o que o jogador vê se a arte não
   carregar. */
const ARTE = (() => {
  for (const base of [BASE, RAIZ]) {
    const js = join(base, 'assets', 'otsp', 'atlas.json'), png = join(base, 'assets', 'otsp', 'atlas.png');
    if (existsSync(js) && existsSync(png)) return {json: js, png};
  }
  console.error('FALHA: não achei assets/otsp/atlas.json e atlas.png (rode node tools/sprites.mjs)');
  process.exit(2);
})();

function prelude(caso) {
  const semeadura = Object.entries(caso.save || {})
    .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(JSON.stringify(v))});`)
    .join('');
  return `<script>
/* harness de tools/testar.mjs — nada disto existe no index.html */
(function(){
  var H=document.documentElement,E=[];
  /* o nome do atributo é montado em duas partes de propósito: assim o literal
     não aparece no código do harness dentro do DOM, e procurar por ele no
     dump não dá o falso positivo documentado no CLAUDE.md */
  var ATR='data-'+'errs';
  window.__erros=function(){return H.getAttribute(ATR)};
  function anota(m){E.push(String(m));H.setAttribute(ATR,E.join(' | ').slice(0,3000))}
  addEventListener('error',function(e){anota((e.message||'erro')+' @ '+String(e.filename||'?').split('/').pop()+':'+(e.lineno||0))});
  addEventListener('unhandledrejection',function(e){anota('promessa rejeitada: '+((e.reason&&e.reason.message)||e.reason))});
  var ce=console.error.bind(console);
  console.error=function(){anota('console.error: '+Array.prototype.join.call(arguments,' '));ce.apply(null,arguments)};
  /* Sem este atalho o requestAnimationFrame nunca dispara no Edge headless: o
     laço do jogo não roda e o teste leria só os placeholders do markup.
     O timestamp é sintético e anda 50 ms por quadro — o dt máximo que o jogo
     aceita — então cada quadro avança o tempo de jogo no passo cheio sem
     precisar esperar 50 ms de verdade: uma incursão de 20 s roda em segundos. */
  /* O relógio sintético começa no primeiro quadro pedido, não na carga do
     prelúdio: os módulos do jogo carregam depois, e numa máquina lenta (a CI)
     o laço nascia com o relógio atrás do performance.now() do jogo. */
  var q=0,vt=0;
  window.__quadros=function(){return q};
  window.requestAnimationFrame=function(cb){if(!vt)vt=performance.now();return setTimeout(function(){q++;vt+=50;cb(vt)},0)};
  window.cancelAnimationFrame=function(id){clearTimeout(id)};
  /* Math.random semeado: mapa, corredores, spawns e loot ficam iguais em toda
     execução, então um caso que passa hoje passa amanhã */
  var s=${(caso.semente || 1) >>> 0};
  Math.random=function(){s=(s+0x6D2B79F5)|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  try{localStorage.clear();${semeadura}}catch(e){anota('localStorage: '+e.message)}
  ${caso.bloqueiaSave ? "Storage.prototype.setItem=function(){throw new DOMException('bloqueado pelo teste','QuotaExceededError')};" : ''}
  /* nenhum caso fala com o Supabase de verdade; quem quer nuvem usa P.nuvem.
     O resto (conteúdo, arte, o POST do resultado) vai ao servidor do harness */
  var fr=window.fetch.bind(window);
  window.fetch=function(u,o){
    if(/supabase.co/.test(String(u)))return Promise.reject(new Error('rede real bloqueada no teste'));
    return fr(u,o)};
})();
</script>
`;
}

function conteudoDoCaso(caso) {
  if (!caso.conteudo) return CONTEUDO;
  const c = JSON.parse(CONTEUDO);
  for (const a of caso.conteudo) a(c);
  return JSON.stringify(c);
}

/* O roteiro é um módulo que importa o do jogo: só começa depois que o
   src/main.js terminou de carregar o conteúdo e abriu a primeira tela. */
function epilogo(caso, alvo) {
  return `<script type="module">
/* harness de tools/testar.mjs — roteiro do caso ${caso.nome} */
import './src/main.js';
(async function(){
  var H=document.documentElement;
  var $=function(s){return document.querySelector(s)};
  var todos=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  var checks=[];
  var ok=function(nome,cond,obs){checks.push({nome:nome,ok:!!cond,obs:obs===undefined||obs===null?'':String(obs)})};
  var quadro=function(){return new Promise(function(r){requestAnimationFrame(r)})};
  var quadros=async function(n){for(var i=0;i<n;i++)await quadro()};
  var ate=async function(cond,max){for(var i=0;i<(max||1500);i++){if(cond())return true;await quadro()}return false};
  var txt=function(s){var e=$(s);return e?e.textContent.trim():null};
  var visivel=function(s){var e=$(s);return !!e&&!e.hidden};
  var sv=function(){try{return JSON.parse(localStorage.getItem('masmorra-runas-v2')||'null')}catch(e){return null}};
  var clica=function(e){if(!e)throw new Error('elemento ausente para clicar');e.click()};
  var tecla=function(tipo,code){dispatchEvent(new KeyboardEvent(tipo,{code:code,bubbles:true}))};
  try{
${caso.roteiro}
  }catch(e){ok('roteiro sem excecao',false,(e&&e.stack)||e)}
  /* alguns quadros a mais para render() e os temporizadores soltarem o que
     tiverem de erro antes de fechar a conta */
  await quadros(8);
  H.setAttribute('data-done','1');
  var carga={caso:${JSON.stringify(caso.nome)},quadros:window.__quadros(),errs:window.__erros(),checks:checks,dom:'<!doctype html>\\n'+H.outerHTML};
  try{await fetch(${JSON.stringify(alvo)},{method:'POST',mode:'no-cors',body:JSON.stringify(carga)})}catch(e){}
  setTimeout(function(){try{window.close()}catch(e){}},150);
})();
</script>
`;
}

/* Grava a cópia do caso em dir: fontes com os patches, prelúdio antes de
   tudo (no fim do <head>), roteiro logo depois do módulo do jogo, conteúdo e
   arte ao lado. */
function monta(caso, fontes, dir, alvo) {
  const f = Object.assign({}, fontes);
  for (const p of caso.patches || []) p(f);
  let h = f['index.html'];
  if (!h.includes('</head>')) throw new Error('o index.html não tem </head>');
  h = h.replace('</head>', prelude(caso) + '</head>');
  /* o último <script type="module" src="src/main.js"> é o do jogo; P.nuvem
     põe o Supabase falso logo antes dele */
  const k = h.lastIndexOf(MODULO);
  f['index.html'] = h.slice(0, k + MODULO.length) + '\n' + epilogo(caso, alvo) + h.slice(k + MODULO.length);
  for (const [nome, txt] of Object.entries(f)) {
    mkdirSync(dirname(join(dir, nome)), {recursive: true});
    writeFileSync(join(dir, nome), txt, 'utf8');
  }
  mkdirSync(join(dir, 'data', 'game'), {recursive: true});
  writeFileSync(join(dir, 'data', 'game', 'content.json'), conteudoDoCaso(caso), 'utf8');
  if (!caso.semArte) {
    mkdirSync(join(dir, 'assets', 'otsp'), {recursive: true});
    copyFileSync(ARTE.json, join(dir, 'assets', 'otsp', 'atlas.json'));
    copyFileSync(ARTE.png, join(dir, 'assets', 'otsp', 'atlas.png'));
  }
}

/* ---------- coletor e navegador ---------- */
function achaNavegador() {
  for (const c of CANDIDATOS) if (existsSync(c)) return c;
  /* Chromium do Playwright, que é o que existe nas execuções de nuvem */
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of readdirSync(base)) {
      if (!/^chromium(-\d+)?$/.test(d)) continue;
      for (const p of [join(base, d), join(base, d, 'chrome-linux', 'chrome')]) {
        try { if (statSync(p).isFile()) return p; } catch (e) { /* segue */ }
      }
    }
  } catch (e) { /* pasta não existe */ }
  for (const n of NOMES_NO_PATH) {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [n], {encoding: 'utf8'});
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('não achei navegador. Aponte o binário em FIBULA_EDGE (ou CHROME).');
}

/* Um servidor só: GET entrega os arquivos das cópias (a pasta de trabalho),
   POST recebe o resultado do roteiro. */
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png'};
async function abreColetor() {
  const pendentes = new Map();
  const srv = createServer((req, res) => {
    if (req.method === 'GET') {
      const arq = join(SAIDA, decodeURIComponent(req.url.split('?')[0]));
      if (!arq.startsWith(SAIDA) || !existsSync(arq) || !statSync(arq).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'content-type': TIPOS[extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store'});
      res.end(readFileSync(arq));
      return;
    }
    let corpo = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      res.writeHead(204, {'access-control-allow-origin': '*'});
      res.end();
      let carga = null;
      try { carga = JSON.parse(corpo); } catch (e) { carga = null; }
      const nome = carga && carga.caso;
      const p = nome && pendentes.get(nome);
      if (p) { pendentes.delete(nome); p(carga); }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    porta: srv.address().port,
    fecha: () => new Promise((r) => srv.close(r)),
    espera: (nome, ms) => new Promise((resolve, reject) => {
      pendentes.set(nome, resolve);
      setTimeout(() => {
        if (pendentes.delete(nome)) reject(new Error(`o roteiro não reportou em ${ms} ms`));
      }, ms).unref();
    }),
  };
}

function abreNavegador(edge, url, perfil) {
  const p = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    /* o Chromium das execuções de nuvem roda em contêiner, onde o sandbox não sobe */
    ...(process.platform === 'win32' ? [] : ['--no-sandbox']),
    '--disable-extensions', '--mute-audio', '--window-size=420,860',
    /* nada de rede a não ser o coletor: a folha do Google Fonts degrada e o
       teste fica hermético */
    '--host-resolver-rules=MAP * ~NOTFOUND,EXCLUDE 127.0.0.1',
    /* o perfil é sempre temporário, para não tocar no perfil real do usuário */
    `--user-data-dir=${perfil}`,
    url,
  ], {stdio: 'ignore', windowsHide: true});
  p.on('error', () => {});
  return p;
}

function mata(p) {
  if (!p || p.exitCode !== null) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], {stdio: 'ignore'});
    else p.kill('SIGKILL');
  } catch (e) { /* já morreu */ }
}

/* ---------- a simulação no Node ----------
   src/sim/ é a regra do jogo sem DOM, a que o servidor da F2 vai rodar. Este
   passo prova sem navegador: nenhum arquivo de src/sim/ cita DOM ou
   armazenamento do navegador, uma incursão inteira roda no Node, e o sorteio
   com semente cumpre o que promete (ver o bloco "sorteio com semente" de
   src/sim/base.js):
   - o gerador é o mulberry32 de sempre (sequência presa: trocar o algoritmo
     mudaria a masmorra de todas as sementes);
   - a simulação não usa Math.random: ele é sabotado durante a incursão;
   - mesma semente, mesma masmorra (mapa, monstros) e mesmo resultado;
   - sementes diferentes, masmorras diferentes;
   - o sorteio dos efeitos não mexe no da regra, nem os efeitos gastam o dela;
   - sem semente, cada incursão sorteia a sua. */
async function testaSimulacao() {
  const falhas = [];
  const dirSim = join(BASE, 'src', 'sim');
  const proibido = /\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame|matchMedia|setTimeout|performance)\b/;
  for (const arq of listaJs(dirSim)) {
    const sem = readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const m = proibido.exec(sem);
    if (m) falhas.push(`${relative(BASE, arq)} usa ${m[1]}: src/sim/ não pode depender do navegador`);
    /* Math.random só pode aparecer em novaSemente(), a escolha da semente */
    const usos = (sem.match(/Math\.random/g) || []).length, deSemente = (sem.match(/novaSemente=\(\)=>[^\n]*Math\.random/g) || []).length;
    if (usos > deSemente) falhas.push(`${relative(BASE, arq)} usa Math.random: a sorte da simulação vem de src/sim/base.js`);
    /* efeito visual (G.fx.push) sorteia com frr(), nunca com o sorteio da regra */
    for (const linha of sem.split('\n')) {
      if (/G\.fx\.push/.test(linha) && /(^|[^f\w])(rr|ri|rnd|sorte)\(/.test(linha))
        falhas.push(`${relative(BASE, arq)}: efeito visual usando o sorteio da regra — ${linha.trim().slice(0, 90)}`);
    }
  }
  const url = (n) => pathToFileURL(join(dirSim, n)).href;
  const B = await import(url('base.js'));
  const {saida} = B;
  const {carrega} = await import(url('dados.js'));
  const P = await import(url('progresso.js'));
  const I = await import(url('incursao.js'));
  carrega(JSON.parse(CONTEUDO));

  /* sequência presa do mulberry32 (confere com a implementação de referência) */
  const u32 = (v) => Math.floor(v * 4294967296);
  B.semeia(1);
  const seq = [B.sorte(), B.sorte(), B.sorte()].map(u32).join(',');
  if (seq !== '2693262067,11749833,2265367787') falhas.push(`o gerador mudou: semente 1 deu ${seq}`);
  if (B.sementeDe('123') !== 123 || B.sementeDe(' Leo ') !== B.sementeDe('leo') || B.sementeDe('leo') === B.sementeDe('leo2'))
    falhas.push('sementeDe() não converte texto em semente de forma estável');

  const fnv = (arr) => { let h = 0x811C9DC5; for (let i = 0; i < arr.length; i++) h = Math.imul(h ^ arr[i], 0x01000193); return h >>> 0; };
  const novoSave = () => { const sv = P.SAVE0(); sv.classe = 'feiticeiro'; sv.chars.feiticeiro = P.novoChar('feiticeiro'); P.setSave(sv); };
  /* o retrato da masmorra recém-gerada: mapa, monstros e portal */
  const retrato = () => `${fnv(I.G.g)}|${I.G.mons.map((m) => `${m.k}@${Math.round(m.x)},${Math.round(m.y)}:${m.hp}`).join(';')}|${I.G.portal.x},${I.G.portal.y}`;
  /* extra: quantos sorteios de efeito "a tela" gasta por quadro, para provar
     que eles não mudam a regra */
  const roda = (semente, extra) => {
    novoSave();
    let fim = null; saida.fim = (k) => { fim = k; };
    I.newRun(semente); I.G.active = true;
    const foto = retrato();
    const ent = {x: 0, y: 0, held: [true, false, false, false]};
    let q = 0;
    while (!I.G.over && q < 20000) { I.update(0.05, ent); for (let i = 0; i < (extra || 0); i++) B.frr(0, 1); q++; }
    return {foto, r: {fim, q, kills: I.G.kills, xp: I.G.xpGain, saco: I.G.bagVal, mons: I.G.mons.length, semente: I.G.semente}};
  };
  const rnd0 = Math.random;
  let a, b, c, d;
  try {
    Math.random = () => { throw new Error('Math.random chamado dentro da simulação'); };
    a = roda(7); b = roda(7); c = roda(8); d = roda(7, 37);
  } catch (e) { falhas.push('a incursão quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  finally { Math.random = rnd0; for (const k of Object.keys(saida)) saida[k] = () => {}; }
  if (a) {
    if (a.r.semente !== 7) falhas.push(`a incursão não guardou a semente (G.semente=${a.r.semente})`);
    if (a.foto !== b.foto) falhas.push('mesma semente, masmorras diferentes');
    if (JSON.stringify(a.r) !== JSON.stringify(b.r)) falhas.push(`mesma semente, resultados diferentes: ${JSON.stringify(a.r)} / ${JSON.stringify(b.r)}`);
    if (a.foto.split('|')[0] === c.foto.split('|')[0]) falhas.push('sementes 7 e 8 deram o mesmo mapa');
    if (JSON.stringify(a.r) !== JSON.stringify(d.r)) falhas.push(`os efeitos mexeram na regra: ${JSON.stringify(a.r)} / ${JSON.stringify(d.r)}`);
  }
  /* sonda direta: produzir efeitos (número de dano, faíscas) não pode gastar
     nenhum sorteio da regra — o próximo sorteio da regra tem de ser o mesmo
     com ou sem efeitos no meio */
  try {
    novoSave(); I.newRun(5);
    B.semeia(99); const limpo = [B.sorte(), B.sorte()].join();
    B.semeia(99);
    for (let i = 0; i < 10; i++) { I.num(0, 0, 1, '#fff'); I.spark(0, 0, '#fff'); I.shake(3); }
    const sujo = [B.sorte(), B.sorte()].join();
    if (limpo !== sujo) falhas.push('num(), spark() ou shake() gastaram sorteio da regra: efeito tem de usar frr()');
  } catch (e) { falhas.push('a sonda dos efeitos quebrou: ' + e.message); }
  try {
    novoSave(); I.newRun(); const s1 = I.G.semente; I.newRun(); const s2 = I.G.semente;
    if (s1 === s2) falhas.push(`sem semente, duas incursões seguidas sortearam a mesma (${s1})`);
  } catch (e) { falhas.push('newRun() sem semente quebrou: ' + e.message); }
  try {
    const sv = P.SAVE0(); sv.classe = 'cavaleiro'; sv.chars.cavaleiro = P.novoChar('cavaleiro'); P.setSave(sv);
    const r = P.guardaSaco({ouro: 50, dente: 2, cota: 1});
    if (r.ouro !== 56 || r.pecas !== 1 || sv.cofre !== 56 || sv.itens.cota !== 1) falhas.push(`guardaSaco: ${JSON.stringify(r)} / ${JSON.stringify(sv)}`);
    const red0 = P.eqBonus('red');
    if (!P.equipar('cota') || sv.chars.cavaleiro.equip.armadura !== 'cota' || sv.itens.cota || P.eqBonus('red') - red0 !== 0.08) falhas.push('equipar a cota não vestiu nem somou a defesa');
    if (P.vender('cota')) falhas.push('vendeu uma peça que não estava no cofre');
    if (!P.desequipar('armadura') || !P.vender('cota') || sv.cofre !== 146) falhas.push(`devolver e vender a cota: cofre ${sv.cofre}`);
  } catch (e) { falhas.push('o cofre quebrou no Node: ' + e.message); }
  if (a) {
    if (a.r.fim !== 'desabou') falhas.push(`a incursão parada devia acabar soterrada, acabou em ${a.r.fim} após ${a.r.q} quadros`);
    if (!(a.r.kills >= 1)) falhas.push(`nenhum monstro abatido no Node (${JSON.stringify(a.r)})`);
  }
  return {falhas, a: a && a.r};
}

/* ---------- os casos ---------- */
const CASOS = [
  {
    nome: 'menu-mercador',
    o_que: 'menu abre, Mercador debita o cofre e a melhoria aparece em stats()',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 1000, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    ok('o acampamento abriu', visivel('#menu'));
    ok('o cofre semeado aparece no menu', txt('#sCofre')==='1000', txt('#sCofre'));
    clica($('#toShop'));
    ok('o Mercador abriu', visivel('#shop'));
    ok('o Mercador mostra o cofre', txt('#shopGold')==='1000', txt('#shopGold'));
    var linha=function(nome){return todos('#shopList li.up').filter(function(li){return li.querySelector('h3').textContent===nome})[0]};
    var botao=function(nome){return linha(nome).querySelector('button')};
    ok('as cinco melhorias estão na lista', todos('#shopList li.up').length===5, todos('#shopList li.up').length);
    ok('o Selo de resguardo custa 300', botao('Selo de resguardo').textContent==='300 ouro', botao('Selo de resguardo').textContent);
    ok('Vigor custa 120 no primeiro nível', botao('Vigor').textContent==='120 ouro', botao('Vigor').textContent);
    clica(botao('Vigor'));
    ok('o cofre debitou 120', txt('#shopGold')==='880', txt('#shopGold'));
    ok('Vigor custa 185 no segundo nível', botao('Vigor').textContent==='185 ouro', botao('Vigor').textContent);
    clica(botao('Vigor'));
    ok('o cofre debitou 305 no total', txt('#shopGold')==='695', txt('#shopGold'));
    ok('dois pips de Vigor acesos', linha('Vigor').querySelectorAll('.pips i.on').length===2, linha('Vigor').querySelectorAll('.pips i.on').length);
    ok('o cofre foi persistido', sv()&&sv().cofre===695, sv()&&sv().cofre);
    ok('a melhoria foi persistida', sv()&&sv().up.vigor===2, sv()&&sv().up.vigor);
    clica($('#shopBack'));
    ok('voltou ao acampamento', visivel('#menu'));
    ok('o acampamento mostra o cofre novo', txt('#sCofre')==='695', txt('#sCofre'));
    clica($('#play'));
    await quadros(4);
    ok('o laço do jogo rodou de verdade', window.__quadros()>=4, window.__quadros());
    ok('Vigor x2 chegou em stats(): 85+30 de vida', txt('#hpT')==='115/115', txt('#hpT'));
    ok('a mana base do Feiticeiro está intacta', txt('#mpT')==='95/95', txt('#mpT'));
    ok('a primeira habilidade foi para o botão grande', $('#s0').querySelector('.nm').textContent==='Faísca', $('#s0').querySelector('.nm').textContent);
    ok('o botão de habilidade tem rótulo acessível', $('#s0').getAttribute('aria-label')==='Faísca — 5 de mana (J)', $('#s0').getAttribute('aria-label'));
    ok('a incursão contou no save', sv()&&sv().runs===1, sv()&&sv().runs);
`,
  },
  {
    nome: 'equipamento',
    o_que: 'cofre da conta com peças: vestir, trocar, devolver e vender; cada personagem com o seu equipamento; bônus em stats()',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 100, itens: {espada: 1, machado: 1, amuleto: 1, cota: 1, sumiu: 2}, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      /* saves de antes do equipamento não têm equip: o cavaleiro prova a mescla */
      chars: {
        feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]},
        cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]},
      },
    }},
    roteiro: `
    var linha=function(nome){return todos('#eqList li.sp').filter(function(li){return li.querySelector('h3').textContent.indexOf(nome)===0})[0]};
    var bt=function(nome,i){return linha(nome).querySelectorAll('.btns button')[i]};
    var espaco=function(i){return todos('#eqSlots button')[i]};
    clica($('#toEquip'));
    ok('a tela de equipamento abriu', visivel('#equip'));
    ok('três espaços, todos vazios', todos('#eqSlots button').length===3&&todos('#eqSlots button.full').length===0, todos('#eqSlots button').length);
    ok('o cofre lista as quatro peças (o item que não existe mais sumiu)', todos('#eqList li.sp').length===4, todos('#eqList li.sp').length);
    ok('o ouro do cofre aparece', txt('#eqGold')==='100', txt('#eqGold'));
    ok('a peça diz o espaço e o bônus', linha('machado').querySelector('p').textContent==='Arma · +10% de dano', linha('machado').querySelector('p').textContent);
    clica(bt('espada',0));
    ok('a espada foi vestida', espaco(0).classList.contains('full')&&espaco(0).textContent.indexOf('espada enferrujada')>=0, espaco(0).textContent);
    ok('a espada saiu do cofre', !linha('espada'), todos('#eqList li.sp').length);
    ok('o machado agora oferece troca', bt('machado',0).textContent==='trocar', bt('machado',0).textContent);
    clica(bt('machado',0));
    ok('o machado entrou no lugar da espada', sv().chars.feiticeiro.equip.arma==='machado', JSON.stringify(sv().chars.feiticeiro.equip));
    ok('a espada voltou ao cofre', sv().itens.espada===1&&!!linha('espada'), JSON.stringify(sv().itens));
    clica(bt('amuleto',0));
    ok('o total vestido aparece', txt('#eqTot')==='Vestido: +10% de dano, +15 de vida, +15 de mana. Vida 100 · Mana 110', txt('#eqTot'));
    clica(bt('cota',1));
    ok('vender a cota creditou 90 de ouro', txt('#eqGold')==='190'&&sv().cofre===190, txt('#eqGold'));
    ok('a cota saiu do cofre', !sv().itens.cota, JSON.stringify(sv().itens));
    clica(espaco(2));
    ok('tocar no espaço devolve o amuleto ao cofre', sv().chars.feiticeiro.equip.amuleto===null&&sv().itens.amuleto===1, JSON.stringify(sv().chars.feiticeiro.equip));
    clica(bt('amuleto',0));
    clica($('#eqBack'));
    clica($('#toPick'));
    var cav=todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Cavaleiro'})[0];
    clica(cav);
    clica($('#toEquip'));
    ok('o Cavaleiro tem os próprios espaços, vazios', todos('#eqSlots button.full').length===0, todos('#eqSlots button.full').length);
    ok('o cofre é o mesmo da conta', !!linha('espada')&&txt('#eqGold')==='190', todos('#eqList li.sp').length+' / '+txt('#eqGold'));
    clica(bt('espada',0));
    ok('a espada foi para o Cavaleiro', sv().chars.cavaleiro.equip.arma==='espada', JSON.stringify(sv().chars.cavaleiro.equip));
    ok('o cofre ficou vazio e diz isso', todos('#eqList li.vazio').length===1, todos('#eqList li').length);
    clica($('#eqBack'));
    clica($('#toPick'));
    var fei=todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Feiticeiro'})[0];
    clica(fei);
    ok('o Feiticeiro manteve o que vestia', sv().chars.feiticeiro.equip.arma==='machado'&&sv().chars.feiticeiro.equip.amuleto==='amuleto', JSON.stringify(sv().chars.feiticeiro.equip));
    clica($('#play'));
    await quadros(4);
    ok('o amuleto chegou em stats(): 85+15 de vida', txt('#hpT')==='100/100', txt('#hpT'));
    ok('o amuleto chegou em stats(): 95+15 de mana', txt('#mpT')==='110/110', txt('#mpT'));
`,
  },
  {
    nome: 'incursao-extracao',
    o_que: 'incursão de ponta a ponta: combate, portal, extração, cofre creditado e equipamento guardado como peça',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.sacoEquip, P.portalNaEntrada, P.spawnNaEntrada],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    clica($('#play'));
    await quadros(2);
    ok('a incursão começou', $('#app').classList.contains('playing'));
    ok('o relógio foi encurtado para 20 s', txt('#timeT')==='0:20', txt('#timeT'));
    ok('o saco entrou semeado', txt('#bagT')==='220', txt('#bagT'));
    ok('o portal ainda está fechado', (txt('#portalT')||'').indexOf('Portal em')===0, txt('#portalT'));
    tecla('keydown','KeyJ');
    var abriu=await ate(function(){return txt('#portalT')==='Portal aberto'},600);
    ok('o portal abriu no tempo marcado', abriu, txt('#portalT'));
    ok('a bússola aparece com o portal aberto', !$('#compass').hidden);
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('a incursão chegou ao fim', acabou);
    ok('saiu pelo portal', txt('#endTitle')==='Extraído!', txt('#endTitle')+' / '+txt('#endText'));
    var m=/^([0-9]+) ouro · (\\S+)$/.exec(txt('#eLoot')||'');
    ok('o saco foi guardado', !!m&&m[2]==='guardado', txt('#eLoot'));
    var loot=m?+m[1]:-1;
    ok('o saco semeado veio junto', loot>=220, loot);
    var VAL={espada:20,machado:28,amuleto:60,couraca:30,cota:90},pecas=0;
    for(var k in (sv()&&sv().itens)||{})pecas+=VAL[k]*sv().itens[k];
    ok('a espada foi para o cofre como peça, não como ouro', sv()&&sv().itens&&sv().itens.espada>=1, sv()&&JSON.stringify(sv().itens));
    ok('ouro no cofre + peças no cofre = valor do saco', sv()&&sv().cofre+pecas===loot, sv()&&(sv().cofre+' + '+pecas+' de '+loot));
    ok('a tela final mostra o mesmo cofre', txt('#eCofre')===sv().cofre+' ouro', txt('#eCofre'));
    ok('a tela final avisa das peças no cofre', /peças? de equipamento/.test(txt('#endText')||''), txt('#endText'));
    ok('a espada aparece marcada como arma', todos('#endItems li small').some(function(x){return x.textContent==='arma'}), todos('#endItems li small').length);
    ok('o recorde foi atualizado', sv()&&sv().best===loot, sv()&&sv().best);
    ok('uma saída foi contada', sv()&&sv().ext===1, sv()&&sv().ext);
    ok('uma incursão foi contada', sv()&&sv().runs===1, sv()&&sv().runs);
    ok('nenhuma morte foi contada', sv()&&sv().deaths===0, sv()&&sv().deaths);
    ok('houve combate: ao menos um monstro abatido', +txt('#eKills')>=1, txt('#eKills'));
    ok('houve experiência ganha', /^\\+[1-9]/.test(txt('#eXp')||''), txt('#eXp'));
    ok('a experiência foi persistida', sv()&&(sv().chars.feiticeiro.xp>0||sv().chars.feiticeiro.lvl>1), sv()&&JSON.stringify(sv().chars.feiticeiro));
    ok('o treino foi registrado', (txt('#eTrain')||'').length>0, txt('#eTrain'));
    ok('o tempo na masmorra foi registrado', (txt('#eTime')||'')!=='', txt('#eTime'));
    ok('o selo não aparece em extração', $('#eSeal').hidden);
    ok('o saco foi detalhado item por item', todos('#endItems li').length>=1, todos('#endItems li').length);
`,
  },
  {
    nome: 'arte',
    o_que: 'os sprites do OTSP chegam e a incursão roda desenhada com eles: combate, cadáver, efeitos e ícones',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.saco, P.portalNaEntrada, P.spawnNaEntrada],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    var chegou=await ate(function(){return $('#app').dataset.arte==='1'},400);
    ok('o atlas carregou', chegou);
    clica($('#toPick'));
    ok('a escolha de personagem mostra o retrato de cada classe', todos('#pickList .cls .ico').length===4, todos('#pickList .cls .ico').length);
    clica($('#pickBack'));
    clica($('#play'));
    await quadros(2);
    ok('o botão da poção ganhou o ícone', !!$('#bPot .ico'));
    tecla('keydown','KeyJ');
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('a incursão desenhada com sprites chegou ao fim', acabou, txt('#endTitle'));
    ok('saiu pelo portal', txt('#endTitle')==='Extraído!', txt('#endTitle'));
    ok('houve combate com os sprites', +txt('#eKills')>=1, txt('#eKills'));
    ok('os itens da tela final têm ícone', todos('#endItems li .ico').length>=1, todos('#endItems li .ico').length);
`,
  },
  {
    nome: 'sem-arte',
    o_que: 'sem o atlas a incursão continua jogável com o desenho em código',
    semente: 11,
    limite: 90000,
    semArte: true,
    patches: [P.tempo(20, 10), P.saco, P.portalNaEntrada, P.spawnNaEntrada],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    await quadros(20);
    ok('a arte não foi marcada como carregada', !$('#app').dataset.arte);
    clica($('#play'));
    tecla('keydown','KeyJ');
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('a incursão chegou ao fim sem a arte', acabou, txt('#endTitle'));
    ok('o botão da poção ficou sem ícone', !$('#bPot .ico'));
`,
  },
  {
    nome: 'morte',
    o_que: 'morte: tela final, perda do saco e Selo de resguardo devolvendo 40%',
    semente: 3,
    patches: [P.tempo(12, 3), P.saco, P.spawnNaEntrada],
    conteudo: [A.ratoLetal],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 2},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null], equip: {arma: 'machado', armadura: null, amuleto: null}}},
    }},
    roteiro: `
    clica($('#play'));
    await quadros(2);
    ok('a incursão começou', $('#app').classList.contains('playing'));
    ok('o Feiticeiro entra com 85 de vida', txt('#hpT')==='85/85', txt('#hpT'));
    ok('o saco entrou semeado', txt('#bagT')==='200', txt('#bagT'));
    var acabou=await ate(function(){return visivel('#end')},1500);
    ok('a incursão chegou ao fim', acabou);
    ok('morreu de verdade, não foi o tempo', txt('#endTitle')==='Você morreu', txt('#endTitle')+' / '+txt('#endText'));
    ok('o saco foi perdido', txt('#eLoot')==='200 ouro · perdido', txt('#eLoot'));
    ok('uma morte foi contada', sv()&&sv().deaths===1, sv()&&sv().deaths);
    ok('nenhuma saída foi contada', sv()&&sv().ext===0, sv()&&sv().ext);
    ok('o recorde não sobe com morte', sv()&&sv().best===0, sv()&&sv().best);
    ok('o selo de resguardo apareceu', !$('#eSeal').hidden&&!$('#eSealDt').hidden);
    ok('o selo devolveu 40% de 200', txt('#eSeal')==='+80 ouro (40%)', txt('#eSeal'));
    ok('só o resguardado entrou no cofre', sv()&&sv().cofre===80, sv()&&sv().cofre);
    ok('a tela final mostra o cofre com o resguardo', txt('#eCofre')==='80 ouro', txt('#eCofre'));
    ok('o equipamento vestido não cai na morte', sv()&&sv().chars.feiticeiro.equip.arma==='machado', sv()&&JSON.stringify(sv().chars.feiticeiro.equip));
`,
  },
  {
    nome: 'classes',
    o_que: 'as quatro classes são selecionáveis, coexistem no save e nascem com 2 espaços',
    semente: 5,
    save: {'masmorra-runas-v2': {cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0, up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0}, classe: null, chars: {}}},
    roteiro: `
    ok('save sem classe abre a escolha de personagem', visivel('#pick'));
    var cards=function(){return todos('#pickList button.cls')};
    ok('quatro classes na lista', cards().length===4, cards().length);
    var nomes=cards().map(function(b){return b.querySelector('h3').textContent});
    ok('as quatro classes da Etapa 3, na ordem', nomes.join(',')==='Feiticeiro,Druida,Caçador,Cavaleiro', nomes.join(','));
    ok('cada classe mostra cinco barras de crescimento', cards().every(function(b){return b.querySelectorAll('.bars > div').length===5}), cards().map(function(b){return b.querySelectorAll('.bars > div').length}).join(','));
    ok('sem classe escolhida não há como voltar', $('#pickBack').hidden);
    var vida={'Feiticeiro':'85/85','Druida':'92/92','Caçador':'110/110','Cavaleiro':'135/135'};
    for(var i=0;i<nomes.length;i++){
      var n=nomes[i];
      clica(cards().filter(function(b){return b.querySelector('h3').textContent===n})[0]);
      ok('escolher '+n+' leva ao acampamento', visivel('#menu'));
      ok('o acampamento identifica '+n, (txt('#mEye')||'').slice(-n.length)===n, txt('#mEye'));
      ok(n+' nasce no nível 1', txt('#sLvl')==='1', txt('#sLvl'));
      ok(n+' nasce com 2 espaços', txt('#sSlots')==='2', txt('#sSlots'));
      clica($('#play'));
      await quadros(3);
      ok(n+' entra com a vida da classe', txt('#hpT')===vida[n], txt('#hpT'));
      ok(n+' leva ao menos uma habilidade', !$('#s0').hidden);
      ok('o nome da classe aparece no HUD de '+n, txt('#clsT')===n, txt('#clsT'));
      ok('o rótulo acessível de '+n+' diz o custo certo', ($('#s0').getAttribute('aria-label')||'').indexOf(n==='Cavaleiro'?'sem mana':'de mana')>=0, $('#s0').getAttribute('aria-label'));
      clica($('#toMenu'));
      ok('voltou ao acampamento depois da incursão', visivel('#menu'));
      clica($('#toPick'));
      ok('a escolha de personagem reabriu', visivel('#pick'));
      ok('com classe escolhida já há como voltar', !$('#pickBack').hidden);
    }
    var s=sv();
    ok('os quatro personagens coexistem no save', s&&Object.keys(s.chars).sort().join(',')==='cacador,cavaleiro,druida,feiticeiro', s&&Object.keys(s.chars).sort().join(','));
    ok('cada personagem guarda os próprios espaços', s&&Object.keys(s.chars).every(function(k){return Array.isArray(s.chars[k].slots)&&s.chars[k].slots.length===4}), s&&JSON.stringify(s.chars));
    clica(cards().filter(function(b){return b.querySelector('h3').textContent==='Cavaleiro'})[0]);
    clica($('#toGrim'));
    ok('o grimório abriu', visivel('#grim'));
    ok('o cabeçalho do grimório no nível 1', txt('#grimEye')==='Cavaleiro · Nível 1 · 2 espaços', txt('#grimEye'));
    var slots=todos('#grimSlots button');
    ok('quatro espaços desenhados', slots.length===4, slots.length);
    ok('dois espaços abertos no nível 1', slots.filter(function(b){return !b.disabled}).length===2, slots.filter(function(b){return !b.disabled}).length);
    ok('o terceiro espaço só abre no nível 8', slots[2].textContent.indexOf('nível 8')>=0, slots[2].textContent);
    ok('o quarto espaço só abre no nível 18', slots[3].textContent.indexOf('nível 18')>=0, slots[3].textContent);
    var sps=todos('#grimList li.sp');
    ok('seis habilidades do Cavaleiro listadas', sps.length===6, sps.length);
    ok('só a de nível 1 está liberada', sps.filter(function(li){return !li.classList.contains('locked')}).length===1, sps.filter(function(li){return !li.classList.contains('locked')}).length);
    ok('as trancadas mostram o nível que falta', sps.filter(function(li){return li.classList.contains('locked')}).every(function(li){return li.querySelector('button').disabled&&li.querySelector('button').textContent.indexOf('nível ')===0}));
`,
  },
  {
    nome: 'grimorio',
    o_que: 'grimório no nível 18: habilidades liberadas por nível e os quatro espaços preenchíveis',
    semente: 13,
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cacador',
      chars: {cacador: {lvl: 18, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: [null, null, null, null]}},
    }},
    roteiro: `
    ok('o acampamento abriu com o Caçador', visivel('#menu'));
    ok('o nível semeado aparece no menu', txt('#sLvl')==='18', txt('#sLvl'));
    ok('quatro espaços no nível 18', txt('#sSlots')==='4', txt('#sSlots'));
    clica($('#toGrim'));
    ok('o cabeçalho do grimório', txt('#grimEye')==='Caçador · Nível 18 · 4 espaços', txt('#grimEye'));
    ok('as três barras de progressão estão desenhadas', todos('#grimProg .pr').length===3, todos('#grimProg .pr').length);
    var rotulos=todos('#grimProg .pr b').map(function(b){return b.textContent});
    ok('as três moedas de progressão aparecem', rotulos.join(' | ')==='Nível 18 | Magia 0 | Perícia 10', rotulos.join(' | '));
    var sps=function(){return todos('#grimList li.sp')};
    var bot=function(li){return li.querySelector('button')};
    ok('seis habilidades do Caçador', sps().length===6, sps().length);
    ok('quatro liberadas até o nível 18', sps().filter(function(li){return !li.classList.contains('locked')}).length===4, sps().filter(function(li){return !li.classList.contains('locked')}).length);
    var trancadas=sps().filter(function(li){return li.classList.contains('locked')}).map(function(li){return li.querySelector('h3').firstChild.textContent});
    ok('Caldeira (24) e Atirador (32) seguem trancadas', trancadas.join(', ')==='Caldeira Divina, Atirador de Elite', trancadas.join(', '));
    var slots=function(){return todos('#grimSlots button')};
    ok('os quatro espaços começam vazios', slots().filter(function(b){return b.className==='full'}).length===0, slots().map(function(b){return b.textContent}).join(' | '));
    for(var i=0;i<4;i++){
      var livre=sps().map(bot).filter(function(b){return b.textContent==='equipar'})[0];
      ok('há habilidade para o espaço '+(i+1), !!livre);
      if(livre)clica(livre);
    }
    ok('os quatro espaços ficaram cheios', slots().filter(function(b){return b.className==='full'}).length===4, slots().map(function(b){return b.textContent}).join(' | '));
    ok('nenhuma liberada sobrou com botão equipar', sps().map(bot).filter(function(b){return b.textContent==='equipar'}).length===0);
    ok('os espaços foram persistidos', sv()&&sv().chars.cacador.slots.filter(Boolean).length===4, sv()&&JSON.stringify(sv().chars.cacador.slots));
    var guarda=sps().map(bot).filter(function(b){return b.textContent==='guardar'})[0];
    ok('a equipada oferece guardar', !!guarda);
    clica(guarda);
    ok('guardar esvaziou um espaço', slots().filter(function(b){return b.className==='full'}).length===3, slots().map(function(b){return b.textContent}).join(' | '));
    ok('esvaziar foi persistido', sv()&&sv().chars.cacador.slots.filter(Boolean).length===3, sv()&&JSON.stringify(sv().chars.cacador.slots));
    clica($('#grimBack'));
    ok('voltou ao acampamento', visivel('#menu'));
    clica($('#play'));
    await quadros(3);
    var visiveis=[0,1,2,3].filter(function(i){return !$('#s'+i).hidden});
    ok('a incursão mostra só os espaços cheios', visiveis.length===3, visiveis.join(','));
    ok('o Caçador entra com 110+11*17 de vida', txt('#hpT')==='297/297', txt('#hpT'));
`,
  },
  {
    nome: 'nivel-na-incursao',
    o_que: 'subir de nível no meio da incursão: espaço novo e habilidade aprendida precisam virar botão na hora',
    semente: 23,
    limite: 90000,
    patches: [P.tempo(30, 25), P.spawnNaEntrada],
    /* xpNeed(8) é 1114: a primeira morte de rato estoura o nível 9, que é onde
       o Feiticeiro aprende Onda de Fogo e ganha o terceiro espaço */
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 8, xp: 1113, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', 'flam', null, null]}},
    }},
    roteiro: `
    clica($('#play'));
    await quadros(2);
    ok('entrou no nível 8', txt('#lvlT')==='Nv 8', txt('#lvlT'));
    ok('dois botões de ação no começo', [0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).length===2, [0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).join(','));
    tecla('keydown','KeyJ');
    var subiu=await ate(function(){return txt('#lvlT')==='Nv 9'},1200);
    tecla('keyup','KeyJ');
    ok('subiu de nível matando no meio da incursão', subiu, txt('#lvlT'));
    await quadros(4);
    var c=sv().chars.feiticeiro;
    ok('a habilidade nova foi para um espaço', c.slots[2]==='ondafogo', JSON.stringify(c.slots));
    ok('o terceiro botão de ação apareceu na hora', !$('#s2').hidden, 'visíveis: '+[0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).join(','));
    ok('o terceiro botão mostra a habilidade nova', $('#s2').querySelector('.nm').textContent==='Onda', $('#s2').querySelector('.nm').textContent);
    ok('o terceiro botão mostra o custo de mana', $('#s2').querySelector('.ct').textContent==='42 mana', $('#s2').querySelector('.ct').textContent);
`,
  },
  {
    nome: 'semente-na-url',
    o_que: '?semente= no endereço reproduz a mesma masmorra na tela, e a tela final mostra o número dela',
    semente: 51,
    query: '?semente=12345',
    limite: 60000,
    patches: [P.tempo(3, 2)],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    var arte=await ate(function(){return $('#app').dataset.arte==='1'},400);
    ok('o atlas carregou antes das fotos', arte);
    clica($('#play'));
    await quadros(2);
    ok('o log avisa que a masmorra veio do endereço', todos('#log .ln').some(function(l){return /Masmorra nº 12\.345, escolhida pelo endereço/.test(l.textContent)}), todos('#log .ln').map(function(l){return l.textContent}).join(' | '));
    var foto1=$('#c').toDataURL();
    var fim1=await ate(function(){return visivel('#end')},400);
    ok('a primeira incursão terminou', fim1);
    ok('a tela final mostra o número da masmorra', txt('#eSeed')==='nº 12.345', txt('#eSeed'));
    clica($('#again'));
    await quadros(2);
    var foto2=$('#c').toDataURL();
    ok('a mesma semente desenhou a mesma masmorra', foto1===foto2, foto1.length+' / '+foto2.length);
    await ate(function(){return visivel('#end')},400);
    ok('a segunda incursão também é a nº 12.345', txt('#eSeed')==='nº 12.345', txt('#eSeed'));
`,
  },
  {
    nome: 'semente-variada',
    o_que: 'sem semente no endereço, cada incursão sorteia uma masmorra nova',
    semente: 52,
    limite: 60000,
    patches: [P.tempo(3, 2)],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    await ate(function(){return $('#app').dataset.arte==='1'},400);
    clica($('#play'));
    await quadros(2);
    ok('sem semente no endereço o log não fala de masmorra escolhida', !todos('#log .ln').some(function(l){return /escolhida pelo endereço/.test(l.textContent)}));
    var foto1=$('#c').toDataURL();
    await ate(function(){return visivel('#end')},400);
    var n1=txt('#eSeed');
    ok('a tela final mostra um número de masmorra', /^nº [0-9.]+$/.test(n1||''), n1);
    clica($('#again'));
    await quadros(2);
    var foto2=$('#c').toDataURL();
    await ate(function(){return visivel('#end')},400);
    var n2=txt('#eSeed');
    ok('a segunda incursão é outra masmorra', n1!==n2, n1+' / '+n2);
    ok('e é desenhada diferente', foto1!==foto2);
`,
  },
  {
    nome: 'save-corrompido',
    o_que: 'save apontando para um personagem que não existe não pode deixar a tela em branco',
    semente: 29,
    save: {'masmorra-runas-v2': {
      cofre: 300, runs: 2, ext: 1, deaths: 0, best: 300,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'druida', chars: {},
    }},
    roteiro: `
    ok('alguma tela abriu, o jogo não ficou em branco', visivel('#menu')||visivel('#pick'), 'menu='+visivel('#menu')+' pick='+visivel('#pick'));
    ok('o cofre não foi perdido', sv()&&sv().cofre===300, sv()&&sv().cofre);
    if(visivel('#pick')){
      clica(todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Druida'})[0]);
      ok('dá para escolher uma classe e seguir', visivel('#menu'));
    }
    /* o cofre no acampamento prova que showMenu() correu até o fim: o markup
       traz 0 de placeholder, e era nele que o teste caía antes */
    ok('o acampamento foi desenhado de verdade', txt('#sCofre')==='300', txt('#sCofre'));
    ok('o acampamento tem um personagem para mostrar', txt('#sLvl')==='1', txt('#sLvl'));
    ok('o personagem que faltava foi criado', sv()&&sv().chars.druida&&sv().chars.druida.lvl===1, sv()&&JSON.stringify(sv().chars));
    clica($('#play'));
    await quadros(3);
    ok('a incursão roda depois de recuperado', $('#app').classList.contains('playing'));
    ok('a vida saiu da classe do save', txt('#hpT')==='92/92', txt('#hpT'));
`,
  },
  {
    nome: 'save-bloqueado',
    o_que: 'navegador que recusa gravar (aba anônima): o menu avisa; com o save normal, não avisa',
    semente: 31,
    bloqueiaSave: true,
    save: {'masmorra-runas-v2': {
      cofre: 40, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    ok('o acampamento abriu mesmo sem poder gravar', visivel('#menu'));
    ok('o aviso de save aparece', visivel('#mAviso'), $('#mAviso')&&$('#mAviso').hidden);
    ok('o aviso é lido por leitor de tela (role=status)', $('#mAviso').getAttribute('role')==='status');
    ok('o aviso diz que o progresso não é salvo', /não está sendo salvo/.test(txt('#mAviso')), txt('#mAviso'));
    ok('o cofre carregado continua aparecendo', txt('#sCofre')==='40', txt('#sCofre'));
    clica($('#play'));
    await quadros(3);
    ok('dá para jogar mesmo sem gravar', $('#app').classList.contains('playing'));
`,
  },
  {
    nome: 'save-normal-sem-aviso',
    o_que: 'com o armazenamento funcionando o aviso de save não aparece',
    semente: 32,
    save: {'masmorra-runas-v2': {
      cofre: 40, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    ok('o acampamento abriu', visivel('#menu'));
    ok('o aviso de save não aparece', !visivel('#mAviso'));
    ok('a caixa de conta aparece, com o formulário de e-mail', visivel('#mConta')&&visivel('#contaF'));
    clica($('#play'));
    await quadros(3);
    ok('a incursão gravou no save', sv()&&sv().runs===1, sv()&&sv().runs);
`,
  },
  {
    nome: 'migracao-save',
    o_que: 'save da Etapa 2 vira um Feiticeiro na v2 sem perder cofre, melhorias nem progresso',
    semente: 17,
    save: {'masmorra-runas-v1': {
      lvl: 5, xp: 30, cofre: 450, runs: 7, ext: 3, deaths: 4, best: 220,
      up: {vigor: 2, foco: 1, poder: 0, bolsa: 1, seguro: 0},
    }},
    roteiro: `
    ok('a chave v2 foi criada na carga', !!localStorage.getItem('masmorra-runas-v2'));
    ok('a chave v1 não foi apagada', !!localStorage.getItem('masmorra-runas-v1'));
    var s=sv();
    ok('o personagem migrado é um Feiticeiro', s&&s.classe==='feiticeiro', s&&s.classe);
    ok('o cofre foi preservado', s&&s.cofre===450, s&&s.cofre);
    ok('as melhorias foram preservadas', s&&s.up.vigor===2&&s.up.foco===1&&s.up.bolsa===1&&s.up.poder===0&&s.up.seguro===0, s&&JSON.stringify(s.up));
    ok('as estatísticas foram preservadas', s&&s.runs===7&&s.ext===3&&s.deaths===4&&s.best===220, s&&[s.runs,s.ext,s.deaths,s.best].join(','));
    ok('o nível foi preservado', s&&s.chars.feiticeiro.lvl===5, s&&s.chars.feiticeiro.lvl);
    ok('a experiência foi preservada', s&&s.chars.feiticeiro.xp===30, s&&s.chars.feiticeiro.xp);
    ok('Magia e Perícia nascem na base', s&&s.chars.feiticeiro.mag===0&&s.chars.feiticeiro.per===10, s&&[s.chars.feiticeiro.mag,s.chars.feiticeiro.per].join(','));
    ok('os espaços vieram coerentes com o nível 5', s&&JSON.stringify(s.chars.feiticeiro.slots)==='["faisca","flam",null,null]', s&&JSON.stringify(s.chars.feiticeiro.slots));
    ok('só o Feiticeiro existe depois da migração', s&&Object.keys(s.chars).join(',')==='feiticeiro', s&&Object.keys(s.chars).join(','));
    ok('o acampamento abriu direto, não a escolha de classe', visivel('#menu')&&$('#pick').hidden);
    ok('o acampamento mostra o cofre migrado', txt('#sCofre')==='450', txt('#sCofre'));
    ok('o acampamento mostra o nível migrado', txt('#sLvl')==='5', txt('#sLvl'));
    ok('o acampamento mostra o recorde migrado', txt('#sBest')==='220', txt('#sBest'));
    ok('dois espaços no nível 5', txt('#sSlots')==='2', txt('#sSlots'));
    clica($('#play'));
    await quadros(3);
    ok('a vida soma classe, nível e Vigor: 85+24+30', txt('#hpT')==='139/139', txt('#hpT'));
    ok('a mana soma classe, nível e Foco: 95+64+10', txt('#mpT')==='169/169', txt('#mpT'));
    ok('a Bolsa de poções migrada vale na incursão', txt('#potN')==='×4', txt('#potN'));
    ok('a incursão nova contou sobre as sete antigas', sv()&&sv().runs===8, sv()&&sv().runs);
`,
  },
  {
    nome: 'nuvem-entrar',
    o_que: 'login simples: senha errada é recusada, conta nova entra, lê a nuvem e grava a incursão seguinte',
    semente: 41,
    patches: [P.nuvem(null, {velho: 'abc'})],
    save: {'masmorra-runas-v2': {
      cofre: 10, runs: 1, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    },
    /* sessão do login por e-mail, que saiu: precisa ser descartada */
    'masmorra-runas-v2-sessao': {at: 'x.y.z', rt: 'r1', exp: 9e15, uid: 'u9', email: 'antigo@exemplo.com'}},
    roteiro: `
    await quadros(4);
    ok('a caixa de conta aparece', visivel('#mConta'));
    ok('a sessão antiga do e-mail foi descartada', visivel('#contaF')&&!visivel('#contaSair'));
    ok('sem sessão nada é lido da nuvem', window.__nuvem.gets===0, window.__nuvem.gets);
    clica($('#contaB'));
    await quadros(2);
    ok('campos vazios pedem usuário e senha', /Preencha usuário e senha/.test(txt('#contaT')||''), txt('#contaT'));
    $('#contaU').value='velho';$('#contaS').value='errada';
    clica($('#contaB'));
    var recusou=await ate(function(){return /incorretos/.test(txt('#contaT')||'')},200);
    ok('senha errada é recusada', recusou&&!localStorage.getItem('masmorra-runas-v2-sessao'), txt('#contaT'));
    $('#contaU').value='Velho';$('#contaS').value='x';
    clica($('#contaC'));
    var existe=await ate(function(){return /já existe/.test(txt('#contaT')||'')},200);
    ok('usuário repetido não cria conta (sem diferenciar maiúscula)', existe, txt('#contaT'));
    $('#contaU').value='  novato ';$('#contaS').value='1';
    clica($('#contaC'));
    var entrou=await ate(function(){return /salvo na nuvem · novato/.test(txt('#contaT')||'')},200);
    ok('conta nova entra e mostra o usuário', entrou, txt('#contaT'));
    ok('a conta foi criada com o nome sem espaços', window.__nuvem.contas.novato==='1', JSON.stringify(window.__nuvem.contas));
    ok('a sessão ficou guardada no aparelho', /tk1/.test(localStorage.getItem('masmorra-runas-v2-sessao')||''));
    ok('a senha não fica guardada no aparelho', !/"1"/.test(localStorage.getItem('masmorra-runas-v2-sessao')||'')&&$('#contaS').value==='');
    ok('a nuvem foi lida depois de entrar', window.__nuvem.gets===1, window.__nuvem.gets);
    ${espera(1800)}
    ok('o save local subiu para a conta nova', window.__nuvem.posts>=1&&window.__nuvem.dados.cofre===10, window.__nuvem.posts);
    clica($('#play'));
    ${espera(1800)}
    ok('a incursão foi gravada na nuvem com o token', window.__nuvem.posts>=1&&window.__nuvem.dados.runs===2&&window.__nuvem.token==='tk1', window.__nuvem.posts+' / '+(window.__nuvem.dados&&window.__nuvem.dados.runs)+' / '+window.__nuvem.token);
`,
  },
  {
    nome: 'nuvem-adota',
    o_que: 'primeiro login num aparelho: o save da nuvem com mais incursões substitui o local e recebe as novas',
    semente: 42,
    patches: [P.nuvem({
      cofre: 900, runs: 5, ext: 3, deaths: 1, best: 400, em: 1000,
      up: {vigor: 1, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 4, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    })],
    save: {
      'masmorra-runas-v2': {
        cofre: 50, runs: 2, ext: 0, deaths: 0, best: 0, em: 5000,
        up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
        classe: 'feiticeiro',
        chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
      },
      'masmorra-runas-v2-sessao': SESSAO,
    },
    roteiro: `
    var leu=await ate(function(){return txt('#sCofre')==='900'},200);
    ok('o save da nuvem foi lido', window.__nuvem.gets===1, window.__nuvem.gets);
    ok('o acampamento mostra o cofre da nuvem', leu, txt('#sCofre'));
    ok('o nível da nuvem chegou', txt('#sLvl')==='4', txt('#sLvl'));
    ok('o save local foi substituído', sv()&&sv().cofre===900&&sv().runs===5, sv()&&[sv().cofre,sv().runs].join(','));
    ok('o aparelho ficou ligado à conta', sv()&&sv().dono==='u1', sv()&&sv().dono);
    ok('a caixa mostra a conta', /salvo na nuvem · jogador/.test(txt('#contaT')||''), txt('#contaT'));
    ok('o formulário some com a sessão aberta', !visivel('#contaF')&&visivel('#contaSair'));
    clica($('#play'));
    ${espera(1800)}
    ok('a incursão nova foi gravada na nuvem', window.__nuvem.posts>=1&&window.__nuvem.dados.runs===6, window.__nuvem.posts+' / '+(window.__nuvem.dados&&window.__nuvem.dados.runs));
    ok('a gravação foi com o token da sessão', window.__nuvem.token==='tk1', window.__nuvem.token);
    ok('o cofre gravado é o da nuvem', window.__nuvem.dados.cofre===900, window.__nuvem.dados.cofre);
`,
  },
  {
    nome: 'nuvem-importa',
    o_que: 'conta nova sem save na nuvem recebe o save deste aparelho; aparelho ligado mantém o mais recente',
    semente: 43,
    patches: [P.nuvem({
      cofre: 1, runs: 99, ext: 0, deaths: 0, best: 0, em: 1000, dono: 'u1',
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    })],
    save: {
      'masmorra-runas-v2': {
        cofre: 120, runs: 3, ext: 1, deaths: 0, best: 120, em: 2000, dono: 'u1',
        up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
        classe: 'feiticeiro',
        chars: {feiticeiro: {lvl: 2, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
      },
      'masmorra-runas-v2-sessao': SESSAO,
    },
    roteiro: `
    await ate(function(){return window.__nuvem.gets>0},200);
    ${espera(1800)}
    ok('o save local, mais recente, não foi trocado', sv()&&sv().cofre===120&&sv().runs===3, sv()&&[sv().cofre,sv().runs].join(','));
    ok('o acampamento mostra o cofre local', txt('#sCofre')==='120', txt('#sCofre'));
    ok('o save local subiu para a nuvem', window.__nuvem.posts>=1&&window.__nuvem.dados.cofre===120, window.__nuvem.posts+' / '+(window.__nuvem.dados&&window.__nuvem.dados.cofre));
    clica($('#contaSair'));
    await quadros(4);
    ok('sair da conta mostra o formulário de novo', visivel('#contaF')&&!visivel('#contaSair'));
    ok('a sessão foi apagada do aparelho', !localStorage.getItem('masmorra-runas-v2-sessao'));
    ok('o banco foi avisado da saída', window.__nuvem.saiu===1, window.__nuvem.saiu);
    ok('sair da conta não apaga o progresso local', sv()&&sv().cofre===120, sv()&&sv().cofre);
`,
  },
  {
    nome: 'nuvem-outra-conta',
    o_que: 'aparelho que era de outra conta: entrar com a segunda não sobrescreve o save dela com o da primeira',
    semente: 44,
    patches: [P.nuvem({
      cofre: 30, runs: 2, ext: 1, deaths: 0, best: 30, em: 1000, dono: 'u1',
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'druida',
      chars: {druida: {lvl: 2, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: [null, null, null, null]}},
    })],
    save: {
      'masmorra-runas-v2': {
        cofre: 777, runs: 10, ext: 4, deaths: 2, best: 300, em: 9000, dono: 'u0',
        up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
        classe: 'feiticeiro',
        chars: {feiticeiro: {lvl: 5, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
      },
      'masmorra-runas-v2-sessao': SESSAO,
    },
    roteiro: `
    await ate(function(){return window.__nuvem.gets>0},200);
    ${espera(1800)}
    ok('o save da nuvem da conta nova não foi sobrescrito', window.__nuvem.dados&&window.__nuvem.dados.cofre===30, window.__nuvem.dados&&window.__nuvem.dados.cofre);
    ok('o aparelho passou a mostrar o save da conta nova', sv()&&sv().cofre===30&&sv().dono==='u1', sv()&&[sv().cofre,sv().dono].join(','));
    ok('o acampamento mostra o cofre da conta nova', txt('#sCofre')==='30', txt('#sCofre'));
`,
  },
];

/* ---------- relatório ---------- */
async function main() {
  const argv = process.argv.slice(2);
  const manter = argv.includes('--manter');
  const filtros = argv.filter((a) => !a.startsWith('--'));

  if (argv.includes('--lista')) {
    for (const c of CASOS) console.log(`${c.nome.padEnd(20)} ${c.o_que}`);
    return 0;
  }

  const casos = filtros.length ? CASOS.filter((c) => filtros.some((f) => c.nome.includes(f))) : CASOS;
  if (!casos.length) {
    console.error(`nenhum caso casa com ${filtros.join(', ')}. Use --lista.`);
    return 2;
  }

  if (existsSync(SAIDA)) rmSync(SAIDA, {recursive: true, force: true});
  mkdirSync(SAIDA, {recursive: true});

  const fontes = leFontes();

  const erroSintaxe = verificaSintaxe(fontes, SAIDA);
  if (erroSintaxe) {
    console.error('SINTAXE FALHOU em src/:\n' + erroSintaxe);
    return 1;
  }
  console.log(`SINTAXE_OK  (node --check em ${Object.keys(fontes).length - 1} módulos de src/)`);

  const sim = await testaSimulacao();
  if (sim.falhas.length) {
    console.log('\u2717 simulação no Node');
    for (const f of sim.falhas) console.log(`    falhou: ${f}`);
  } else {
    console.log(`\u2713 simulação no Node — incursão inteira sem navegador: ${sim.a.q} quadros, ${sim.a.kills} abates; sorteio com semente: mesma masmorra, efeitos isolados, sem Math.random`);
  }

  const edge = achaNavegador();
  const coletor = await abreColetor();
  console.log(`navegador    ${edge}`);
  console.log(`coletor      http://127.0.0.1:${coletor.porta}`);
  console.log(`trabalho     ${SAIDA}\n`);

  let falhas = sim.falhas.length ? 1 : 0;
  for (const caso of casos) {
    const dir = join(SAIDA, caso.nome);
    mkdirSync(dir, {recursive: true});
    const alvo = `http://127.0.0.1:${coletor.porta}/${caso.nome}`;

    let carga = null, erro = null, nav = null;
    try {
      monta(caso, fontes, dir, alvo);
      const aguarda = coletor.espera(caso.nome, caso.limite || 45000);
      nav = abreNavegador(edge, `${alvo}/index.html${caso.query || ''}`, join(dir, 'perfil'));
      carga = await aguarda;
    } catch (e) {
      erro = String(e.message).split('\n')[0];
    } finally {
      mata(nav);
    }

    if (carga && carga.dom) writeFileSync(join(dir, 'dump.html'), carga.dom, 'utf8');

    const ruins = carga ? carga.checks.filter((c) => !c.ok) : [];
    const bom = !erro && carga && !carga.errs && !ruins.length;
    if (!bom) falhas++;

    console.log(`${bom ? '\u2713' : '\u2717'} ${caso.nome} — ${caso.o_que}`);
    if (carga) console.log(`    ${carga.checks.length - ruins.length}/${carga.checks.length} asserções, ${carga.quadros} quadros de jogo`);
    if (erro) console.log(`    não rodou: ${erro}`);
    if (carga && carga.errs) console.log(`    erro de janela: ${carga.errs}`);
    for (const c of ruins) console.log(`    falhou: ${c.nome}${c.obs ? ` — leu: ${c.obs}` : ''}`);
    if (!bom) console.log(`    cópia e dump em ${dir}`);
  }

  await coletor.fecha();
  const total = casos.length + 1;
  console.log(`\n${total - falhas}/${total} casos passaram (a simulação no Node conta como um).`);
  if (manter) console.log(`cópias e dumps guardados em ${SAIDA}`);
  return falhas ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => {
  console.error('harness quebrou: ' + (e.stack || e.message));
  process.exit(2);
});
