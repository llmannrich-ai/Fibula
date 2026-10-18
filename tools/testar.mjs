#!/usr/bin/env node
/* Harness de teste headless do Fibula.
 *
 * Automatiza o roteiro manual da seção "Como testar" do CLAUDE.md: checa a
 * sintaxe do bloco <script>, monta uma CÓPIA do index.html para cada caso de
 * teste e roda cada cópia no Edge headless. O index.html nunca é tocado.
 *
 * Cada cópia recebe, injetado em volta do <script> do jogo:
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
 * vem instalado). Em vez dela, este script sobe um coletor HTTP em 127.0.0.1 e
 * a cópia faz POST do resultado no fim do roteiro. O DOM final vem no mesmo
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
 * (pasta de trabalho). Sai com código diferente de zero se a sintaxe falhar,
 * se algum caso registrar erro de janela ou se qualquer asserção falhar.
 */

import {execFileSync, spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* FIBULA_JOGO serve para apontar uma cópia propositalmente quebrada e conferir
   que o portão realmente falha; no uso normal é sempre o index.html da raiz */
const JOGO = process.env.FIBULA_JOGO || join(RAIZ, 'index.html');
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

/* ---------- portão de sintaxe ---------- */
/* Mesmo gesto do CLAUDE.md: recorta o bloco <script> e passa no node --check.
   Um erro de sintaxe aqui derruba o jogo inteiro, porque é um arquivo só. */
function corpoDoScript(html) {
  /* o index.html é salvo com CRLF, então o marcador tolera os dois finais */
  /* o laço virou (async()=>{ quando o conteúdo passou a vir por fetch */
  const m = /<script>\r?\n\((?:async)?\(\)=>\{/.exec(html);
  if (!m) throw new Error('não achei o <script> do jogo no index.html');
  const ini = m.index;
  const fim = html.indexOf('</script>', ini);
  if (fim < 0) throw new Error('o <script> do jogo não fecha');
  return {ini, fim: fim + '</script>'.length, js: html.slice(ini + '<script>'.length, fim)};
}

function verificaSintaxe(html, trabalho) {
  const arq = join(trabalho, 'sintaxe.js');
  writeFileSync(arq, corpoDoScript(html).js, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', arq], {stdio: 'pipe'});
    return null;
  } catch (e) {
    return String(e.stderr || e.message).trim();
  }
}

/* ---------- patches na cópia ---------- */
/* Cada patch é uma substituição exata que estoura se não casar: se o
   index.html mudar, o harness falha alto em vez de testar coisa nenhuma. */
function patch(html, de, para, nome) {
  if (!html.includes(de)) throw new Error(`patch "${nome}" não casou: o index.html mudou, ajuste tools/testar.mjs`);
  return html.split(de).join(para);
}

const P = {
  /* encurta a incursão: sem isso um caso de ponta a ponta levaria 6 minutos */
  tempo: (run, portal) => (h) => patch(h, 'RUN=360,PORTAL_AT=90', `RUN=${run},PORTAL_AT=${portal}`, 'tempo da incursão'),
  /* o saco entra semeado para a aritmética do cofre ficar determinística */
  saco: (h) => patch(h, 't:0,bag:{},bagVal:0,', 't:0,bag:{ouro:200},bagVal:200,', 'saco semeado'),
  /* portal na sala de entrada: no headless não há quem arraste o joystick até
     a sala do Guardião, e o que está sob teste é a extração, não a caminhada */
  portalNaEntrada: (h) => patch(h, 'portal:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false,ch:0}',
    'portal:{x:(s.cx+.5)*T,y:(s.cy+.5)*T,open:false,ch:0}', 'portal na entrada'),
  /* deixa a sala de entrada receber monstros, para haver combate e morte */
  spawnNaEntrada: (h) => patch(h, 'if(r===s)continue;', 'if(false)continue;', 'spawn na entrada'),
  /* põe um Supabase de mentira na frente do fetch do jogo (a chave real fica,
     mas nada sai para a rede): a tabela saves vive em window.__nuvem (dados = a linha do jogador,
     null = sem linha), e cada GET e POST fica contado para o roteiro conferir */
  nuvem: (remoto) => (h) => patch(h,
    "'use strict';",
    `'use strict';
window.__nuvem={dados:${JSON.stringify(remoto ?? null)},gets:0,posts:0,auth:'',otp:''};
{const f0=window.fetch;window.fetch=function(u,o){u=String(u);o=o||{};if(u.indexOf('supabase.co')<0)return f0(u,o);
  const N=window.__nuvem,r=(st,b)=>Promise.resolve({ok:st<300,status:st,json:()=>Promise.resolve(b)});
  if(u.indexOf('/rest/v1/saves')>=0){N.auth=(o.headers||{}).Authorization||'';
    if((o.method||'GET')==='GET'){N.gets++;return r(200,N.dados?[{dados:N.dados}]:[])}
    N.posts++;N.dados=JSON.parse(o.body).dados;return r(201,null)}
  if(u.indexOf('/auth/v1/otp')>=0){N.otp=JSON.parse(o.body).email;return r(200,{})}
  return r(404,{})}}`, 'Supabase falso'),
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
/* sessão já aberta, com validade longe o bastante para nunca pedir renovação */
const SESSAO = {at: 'x.eyJzdWIiOiJ1MSJ9.y', rt: 'r1', exp: 9e15, uid: 'u1', email: 'jogador@exemplo.com'};
const espera = (ms) => `await new Promise(function(r){setTimeout(r,${ms})});`;

/* ---------- injeção ---------- */
/* O jogo carrega data/game/content.json por fetch, e fetch é bloqueado em
   file://, de onde o harness abre as cópias — mesmo com
   --allow-file-access-from-files. Subir um servidor para a página não resolveria
   de graça: o coletor já ocupa 127.0.0.1 e a cópia vive em outro diretório. Em
   vez disso o prelúdio devolve o arquivo real, lido aqui ao montar a cópia,
   então validaConteudo() continua rodando contra o conteúdo verdadeiro.
   O recuo para RAIZ existe porque FIBULA_JOGO pode apontar uma cópia quebrada
   fora do repositório, que não tem data/ ao lado. */
const CONTEUDO = (() => {
  const tentativas = [join(dirname(JOGO), 'data', 'game', 'content.json'),
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
  var q=0,vt=performance.now();
  window.__quadros=function(){return q};
  window.requestAnimationFrame=function(cb){return setTimeout(function(){q++;vt+=50;cb(vt)},0)};
  window.cancelAnimationFrame=function(id){clearTimeout(id)};
  /* Math.random semeado: mapa, corredores, spawns e loot ficam iguais em toda
     execução, então um caso que passa hoje passa amanhã */
  var s=${(caso.semente || 1) >>> 0};
  Math.random=function(){s=(s+0x6D2B79F5)|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  try{localStorage.clear();${semeadura}}catch(e){anota('localStorage: '+e.message)}
  ${caso.bloqueiaSave ? "Storage.prototype.setItem=function(){throw new DOMException('bloqueado pelo teste','QuotaExceededError')};" : ''}
  /* conteúdo do jogo: fetch não funciona em file://, então devolvemos o
     data/game/content.json real, embutido por tools/testar.mjs. Só essa URL é
     interceptada: o POST do resultado para o coletor precisa do fetch real */
  var CT=${conteudoDoCaso(caso)};
  var fr=window.fetch.bind(window);
  window.fetch=function(u,o){
    /* nenhum caso fala com o Supabase de verdade; quem quer nuvem usa P.nuvem */
    if(/supabase.co/.test(String(u)))return Promise.reject(new Error('rede real bloqueada no teste'));
    if(!/content\.json/.test(String(u)))return fr(u,o);
    return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(CT)}})};
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

function epilogo(caso, alvo) {
  return `<script>
/* harness de tools/testar.mjs — roteiro do caso ${caso.nome} */
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

function monta(caso, html, alvo) {
  let h = html;
  for (const p of caso.patches || []) h = p(h);
  const {ini, fim} = corpoDoScript(h);
  return h.slice(0, ini) + prelude(caso) + h.slice(ini, fim) + epilogo(caso, alvo) + h.slice(fim);
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

async function abreColetor() {
  const pendentes = new Map();
  const srv = createServer((req, res) => {
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

function abreNavegador(edge, arquivo, perfil) {
  const url = 'file:///' + arquivo.replace(/\\/g, '/').replace(/^\/+/, '');
  const p = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    /* o Chromium das execuções de nuvem roda em contêiner, onde o sandbox não sobe */
    ...(process.platform === 'win32' ? [] : ['--no-sandbox']),
    '--disable-extensions', '--mute-audio', '--window-size=420,860',
    /* nada de rede a não ser o coletor: a folha do Google Fonts degrada e o
       teste fica hermético */
    '--host-resolver-rules=MAP * ~NOTFOUND,EXCLUDE 127.0.0.1',
    /* o perfil é sempre temporário, para não tocar no perfil real do usuário */
    `--user-data-dir=${perfil}`, '--allow-file-access-from-files',
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
    nome: 'incursao-extracao',
    o_que: 'incursão de ponta a ponta: combate, portal, extração e cofre creditado',
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
    clica($('#play'));
    await quadros(2);
    ok('a incursão começou', $('#app').classList.contains('playing'));
    ok('o relógio foi encurtado para 20 s', txt('#timeT')==='0:20', txt('#timeT'));
    ok('o saco entrou semeado', txt('#bagT')==='200', txt('#bagT'));
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
    ok('o saco semeado veio junto', loot>=200, loot);
    ok('o cofre foi creditado com o saco', sv()&&sv().cofre===loot, sv()&&sv().cofre);
    ok('a tela final mostra o mesmo cofre', txt('#eCofre')===loot+' ouro', txt('#eCofre'));
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
    nome: 'morte',
    o_que: 'morte: tela final, perda do saco e Selo de resguardo devolvendo 40%',
    semente: 3,
    patches: [P.tempo(12, 3), P.saco, P.spawnNaEntrada],
    conteudo: [A.ratoLetal],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 2},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
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
    o_que: 'sem sessão a caixa de conta aparece e pede o link mágico por e-mail',
    semente: 41,
    patches: [P.nuvem(null)],
    save: {'masmorra-runas-v2': {
      cofre: 10, runs: 1, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    await quadros(4);
    ok('a caixa de conta aparece', visivel('#mConta'));
    ok('o formulário de e-mail aparece', visivel('#contaF'));
    ok('o botão de sair fica escondido', !visivel('#contaSair'));
    ok('sem sessão nada é lido da nuvem', window.__nuvem.gets===0, window.__nuvem.gets);
    $('#contaE').value='jogador@exemplo.com';
    $('#contaF').dispatchEvent(new Event('submit',{cancelable:true}));
    var pediu=await ate(function(){return /Enviamos um link/.test(txt('#contaT')||'')},200);
    ok('o pedido de link chegou ao Supabase', window.__nuvem.otp==='jogador@exemplo.com', window.__nuvem.otp);
    ok('o jogador vê que o link foi enviado', pediu, txt('#contaT'));
    clica($('#play'));
    ${espera(1800)}
    ok('sem sessão nada é gravado na nuvem', window.__nuvem.posts===0, window.__nuvem.posts);
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
    ok('a caixa mostra a conta', /salvo na nuvem · jogador@exemplo\\.com/.test(txt('#contaT')||''), txt('#contaT'));
    ok('o formulário some com a sessão aberta', !visivel('#contaF')&&visivel('#contaSair'));
    clica($('#play'));
    ${espera(1800)}
    ok('a incursão nova foi gravada na nuvem', window.__nuvem.posts>=1&&window.__nuvem.dados.runs===6, window.__nuvem.posts+' / '+(window.__nuvem.dados&&window.__nuvem.dados.runs));
    ok('a gravação foi com o token da sessão', window.__nuvem.auth==='Bearer x.eyJzdWIiOiJ1MSJ9.y', window.__nuvem.auth);
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

  const html = readFileSync(JOGO, 'utf8');

  const erroSintaxe = verificaSintaxe(html, SAIDA);
  if (erroSintaxe) {
    console.error('SINTAXE FALHOU no bloco <script> do index.html:\n' + erroSintaxe);
    return 1;
  }
  console.log('SINTAXE_OK  (node --check no bloco <script>)');

  const edge = achaNavegador();
  const coletor = await abreColetor();
  console.log(`navegador    ${edge}`);
  console.log(`coletor      http://127.0.0.1:${coletor.porta}`);
  console.log(`trabalho     ${SAIDA}\n`);

  let falhas = 0;
  for (const caso of casos) {
    const dir = join(SAIDA, caso.nome);
    mkdirSync(dir, {recursive: true});
    const arquivo = join(dir, 'harness.html');
    const alvo = `http://127.0.0.1:${coletor.porta}/${caso.nome}`;

    let carga = null, erro = null, nav = null;
    try {
      writeFileSync(arquivo, monta(caso, html, alvo), 'utf8');
      const aguarda = coletor.espera(caso.nome, caso.limite || 45000);
      nav = abreNavegador(edge, arquivo, join(dir, 'perfil'));
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
  console.log(`\n${casos.length - falhas}/${casos.length} casos passaram.`);
  if (manter) console.log(`cópias e dumps guardados em ${SAIDA}`);
  return falhas ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => {
  console.error('harness quebrou: ' + (e.stack || e.message));
  process.exit(2);
});
