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
/* a linha que carrega o jogo, com a versão (?v=) posta por tools/versao.mjs;
   leFontes() preenche as duas a partir do index.html */
let MODULO = '', VERSAO = '';
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
  const m = /<script type="module" src="src\/main\.js\?v=(\d+\.\d+\.\d+)"><\/script>/.exec(f['index.html']);
  if (!m) throw new Error('o index.html não carrega o jogo com <script type="module" src="src/main.js?v=X.Y.Z"> (rode node tools/versao.mjs X.Y.Z)');
  MODULO = m[0]; VERSAO = m[1];
  for (const arq of listaJs(join(BASE, 'src'))) f[relative(BASE, arq).replace(/\\/g, '/')] = readFileSync(arq, 'utf8');
  return f;
}

/* Todo import relativo de src/ leva a versão do index.html. Sem ela, um deploy
   novo pode se misturar com módulos velhos do cache do navegador; com versões
   diferentes, o mesmo arquivo vira dois módulos com dois estados. */
function verificaVersao(fontes) {
  const ruins = [];
  for (const [nome, txt] of Object.entries(fontes)) {
    if (!nome.endsWith('.js')) continue;
    for (const m of txt.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g))
      if (!m[1].endsWith(`.js?v=${VERSAO}`)) ruins.push(`${nome}: import '${m[1]}'`);
  }
  return ruins;
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
  saco: (h) => patch(h, 'pch:0,bag:{},bagVal:0,', 'pch:0,bag:{ouro:200},bagVal:200,', 'saco semeado'),
  /* o mesmo saco com uma espada (20): equipamento vai para o cofre como peça */
  sacoEquip: (h) => patch(h, 'pch:0,bag:{},bagVal:0,', 'pch:0,bag:{ouro:200,espada:1},bagVal:220,', 'saco semeado com espada'),
  /* o saco com duas sedas (8 cada): material do Gordon vai para o depósito */
  sacoMat: (h) => patch(h, 'pch:0,bag:{},bagVal:0,', 'pch:0,bag:{ouro:200,seda:2},bagVal:216,', 'saco semeado com seda'),
  /* portal na sala de entrada: no headless não há quem arraste o joystick até
     a sala do Guardião, e o que está sob teste é a extração, não a caminhada */
  portalNaEntrada: (h) => patch(h, ':{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false}',
    ':{x:(s.cx+.5)*T,y:(s.cy+.5)*T,open:false}', 'portal na entrada'),
  /* a mira é do jogador e no headless não há dedo para mirar: o jogador do
     teste mira no monstro mais perto quando aperta a tecla, como uma pessoa
     faria. Só na cópia do caso; o jogo de verdade não tem alvo automático */
  miraBot: (h) => patch(h, 'if(formaMira(s,p))p.face=Number.isFinite(ang)?ang:p.face;',
    'if(formaMira(s,p)){let b=null,bd=1e9;for(const m of G.mons){const d=hyp(m.x-p.x,m.y-p.y);if(d<bd){bd=d;b=m}}p.face=Number.isFinite(ang)?ang:b?Math.atan2(b.y-p.y,b.x-p.x):p.face}', 'mira do jogador do teste'),
  /* deixa a sala de entrada receber monstros, para haver combate e morte */
  /* a voz (src/voz.js) sem STUN: nenhum caso sai para a rede, e os dois lados
     da conexão estão no mesmo navegador */
  semStun: (h) => patch(h, "export const STUN=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];", 'export const STUN=[];', 'voz sem STUN'),
  /* monstros colados na porta (o mapa fixo não tem nenhum ali): dois
     pontos a 2 sqm da entrada, com o monstro mais fraco do lugar */
  spawnNaEntrada: (h) => patch(h, 'rooms.forEach((r,i)=>{r.i=i});', 'const k0=M.pontos.map(q=>q.k).filter(k=>!MT[k].boss).sort((a,b)=>MT[a].hp-MT[b].hp)[0];for(const[dx,dy]of[[2,0],[-2,0]]){const x=e.x+dx,y=e.y+dy;if(!g[y*MW+x])rooms.push({x,y,w:1,h:1,cx:x,cy:y,tipo:k0,prof:0,base:1,esp:0})}rooms.forEach((r,i)=>{r.i=i});', 'spawn na entrada'),
  /* põe um Supabase de mentira na frente do fetch do jogo (a chave real fica,
     mas nada sai para a rede). Imita as funções do login simples
     (tools/supabase/002_login_simples.sql): window.__nuvem.dados é o save do
     jogador (null = sem save), contas guarda usuário → senha, e cada leitura,
     gravação e login fica contado para o roteiro conferir. O token válido é
     sempre 'tk1', do jogador 'u1'.
     mk imita as funções do mercado (tools/supabase/003_mercado.sql): mk.itens
     é o livro ({item:{venda:[[preço,qtd]],compra:[…]}}), mk.minhas as ofertas
     do jogador, mk.caixa o que espera para entrar no cofre. O match é o do
     primeiro nível do outro lado, que basta para a tela; o algoritmo de
     verdade é testado no SQL. N.forcaErro faz a próxima operação falhar com
     a palavra-chave dada, e save_gravar recusa save com mkt mais velho.
     mk.lastro é a origem registrada (tools/supabase/004_origem.sql): anunciar
     exige o saldo dela, e caca_comecar, caca_fim e lastro_banco a movem.
     N.args guarda os argumentos da última chamada de cada função. */
  nuvem: (remoto, contas, mk) => (h) => patch(h,
    MODULO,
    `<script>
window.__nuvem={dados:${JSON.stringify(remoto ?? null)},contas:${JSON.stringify(contas || {})},gets:0,posts:0,token:'',login:'',saiu:0,
  mk:${JSON.stringify(Object.assign({itens: {}, minhas: [], caixa: null, seq: 100, lastro: {ouro: 0, itens: {}}, caca: 500}, mk || {}))},chamadas:[],args:{},forcaErro:''};
{const f0=window.fetch;window.fetch=function(u,o){u=String(u);o=o||{};if(u.indexOf('supabase.co')<0)return f0(u,o);
  const N=window.__nuvem,b=JSON.parse(o.body||'{}'),r=(st,x)=>Promise.resolve({ok:st<300,status:st,json:()=>Promise.resolve(x)}),
    erro=m=>r(400,{code:'P0001',message:m}),fn=u.split('/rpc/')[1];
  if(fn==='save_ler'){N.gets++;N.token=b.p_token;return b.p_token==='tk1'?r(200,N.dados):erro('sessao')}
  if(fn==='save_gravar'){N.token=b.p_token;if(b.p_token!=='tk1')return erro('sessao');
    if(N.dados&&(b.p_dados.mkt|0)<(N.dados.mkt|0))return erro('mercado');N.posts++;N.dados=b.p_dados;return r(204,null)}
  if(/^(mercado|caca|lastro)_/.test(fn)){if(b.p_token!=='tk1')return erro('sessao');N.chamadas.push(fn);N.args[fn]=b;const M=N.mk,O=M.lastro,
      poeO=(k,q)=>{O.itens[k]=(O.itens[k]|0)+q;if(O.itens[k]<=0)delete O.itens[k]};
    if(fn==='mercado_livro')return r(200,{taxa:2,itens:M.itens,minhas:M.minhas,caixa:M.caixa,lastro:O});
    if(fn==='caca_comecar')return r(200,++M.caca);
    if(fn==='caca_fim'){let n=0;const q=Object.values(b.p_saco||{}).reduce((a,x)=>a+x,0);if(b.p_desfecho==='extraiu'||q<=3)for(const k in b.p_saco){poeO(k,b.p_saco[k]);n+=b.p_saco[k]}O.ouro+=b.p_ouro;return r(200,{pecas:n,ouro:b.p_ouro})}
    if(fn==='lastro_banco'){if(O.itens[b.p_item]>0){poeO(b.p_item,-1);O.ouro+=b.p_val}return r(204,null)}
    if(!N.dados)return erro('sem_save');
    if(N.forcaErro){const m=N.forcaErro;N.forcaErro='';return erro(m)}
    const D=N.dados,it=D.itens||(D.itens={}),poe=(k,q)=>{it[k]=(it[k]|0)+q;if(it[k]<=0)delete it[k]},rec={ouro:0,itens:{}};
    if(M.caixa){rec.ouro=M.caixa.ouro;rec.itens=M.caixa.itens;D.cofre+=M.caixa.ouro;for(const k in M.caixa.itens)poe(k,M.caixa.itens[k]);M.caixa=null}
    const fim=x=>{D.mkt=(D.mkt|0)+1;D.em=Date.now();return r(200,Object.assign({cofre:D.cofre,itens:JSON.parse(JSON.stringify(it)),mkt:D.mkt,recebido:rec},x||{}))};
    if(fn==='mercado_coletar')return fim();
    if(fn==='mercado_cancelar'){const i=M.minhas.findIndex(o=>o.id===b.p_id);if(i<0)return erro('ordem');const o=M.minhas.splice(i,1)[0];
      if(o.lado==='compra'){D.cofre+=o.preco*o.resta;O.ouro+=o.preco*o.resta}else{poe(o.item,o.resta);poeO(o.item,o.resta)}return fim()}
    if(fn==='mercado_anunciar'){const k=b.p_item,pr=b.p_preco,q=b.p_qtd,compra=b.p_lado==='compra',L=M.itens[k]||{venda:[],compra:[]};
      if(compra){if(D.cofre<pr*q)return erro('sem_ouro');if(O.ouro<pr*q)return erro('sem_origem');D.cofre-=pr*q;O.ouro-=pr*q}
      else if(b.p_caca){if(b.p_caca!==M.caca)return erro('caca');if(!(b.p_saco&&b.p_saco[k]>=q))return erro('sem_peca')}
      else{if((it[k]|0)<q)return erro('sem_peca');if((O.itens[k]|0)<q)return erro('sem_origem');poe(k,-q);poeO(k,-q)}
      const op=compra?L.venda:L.compra,n0=op[0],f=n0&&(compra?n0[0]<=pr:n0[0]>=pr)?Math.min(q,n0[1]):0,tot=f?f*n0[0]:0,tx=compra?0:Math.ceil(tot*2/100);
      if(f){if(compra){poe(k,f);poeO(k,f);D.cofre+=(pr-n0[0])*f;O.ouro+=(pr-n0[0])*f}else{D.cofre+=tot-tx;O.ouro+=tot-tx}n0[1]-=f;if(!n0[1])op.shift()}
      const resta=q-f;if(resta)M.minhas.unshift({id:++M.seq,lado:b.p_lado,item:k,preco:pr,qtd:q,resta:resta});
      return fim({feitos:f,resta:resta,ouro:tot-tx,taxa:tx,ordem:resta?M.seq:null})}}
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
    ajusta(c, 'enemies.rato.spd', 134, 400, 'rato letal');
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
  /* o Realtime da cidade (src/rede.js) também não sai daqui: um WebSocket falso
     imita o canal do Supabase (entrar, presença, broadcast). O roteiro faz o
     papel dos outros jogadores com __rt.entra(), __rt.pos() e __rt.sai(), e lê
     o que o jogo mandou em __rt.enviadas */
  var RT={abertos:0,fechados:0,enviadas:[],vivos:[]};window.__rt=RT;
  function FakeWS(url){var w=this;w.url=String(url);w.readyState=0;RT.abertos++;RT.vivos.push(w);
    setTimeout(function(){if(w.readyState!==0)return;w.readyState=1;w.onopen&&w.onopen()},0)}
  FakeWS.prototype.send=function(t){var d=JSON.parse(t),w=this;RT.enviadas.push(d);w.topico=w.topico||d.topic;
    if(d.event==='phx_join'){w.chave=d.payload.config.presence.key;w.diz({event:'phx_reply',ref:d.ref,payload:{status:'ok',response:{}}});
      w.diz({event:'presence_state',payload:RT.estado()})}
    else if(d.event==='presence'&&d.payload.event==='track'){RT.meus=RT.meus||{};RT.meus[w.chave]=d.payload.payload}};
  FakeWS.prototype.diz=function(m){var w=this;m.topic=m.topic||w.topico;setTimeout(function(){if(w.readyState===1&&w.onmessage)w.onmessage({data:JSON.stringify(m)})},0)};
  FakeWS.prototype.close=function(){if(this.readyState===3)return;this.readyState=3;RT.fechados++;RT.vivos=RT.vivos.filter(function(v){return v.readyState===1||v.readyState===0});var w=this;setTimeout(function(){w.onclose&&w.onclose({})},0)};
  RT.outros={};
  RT.estado=function(){var e={};for(var k in RT.outros)e[k]={metas:[RT.outros[k]]};return e};
  RT.todos=function(m){RT.vivos.forEach(function(w){if(w.readyState===1)w.diz(JSON.parse(JSON.stringify(m)))})};
  RT.entra=function(id,meta){RT.outros[id]=meta;var j={};j[id]={metas:[meta]};RT.todos({event:'presence_diff',payload:{joins:j,leaves:{}}})};
  RT.sai=function(id){var m=RT.outros[id];delete RT.outros[id];var l={};l[id]={metas:[m]};RT.todos({event:'presence_diff',payload:{joins:{},leaves:l}})};
  /* x, y em sqm; d é a duração do passo em ms (0: aparece parado lá) */
  RT.pos=function(id,x,y,d){RT.todos({event:'broadcast',payload:{type:'broadcast',event:'pos',payload:{id:id,x:x,y:y,d:d||0}}})};
  /* a sala (src/sala.js): o roteiro faz o outro lado com RT.sala(evento,
     dados) e lê o que o jogo mandou no canal da sala com RT.salaMandadas() */
  var naSala=function(w){return w.readyState===1&&String(w.topico||'').indexOf('realtime:sala-')===0};
  RT.sala=function(ev,pl){RT.vivos.forEach(function(w){if(naSala(w))w.diz({event:'broadcast',payload:{type:'broadcast',event:ev,payload:JSON.parse(JSON.stringify(pl))}})})};
  RT.salaSai=function(id){var l={};l[id]={metas:[{}]};RT.vivos.forEach(function(w){if(naSala(w))w.diz({event:'presence_diff',payload:{joins:{},leaves:l}})})};
  RT.salaMandadas=function(ev){return RT.enviadas.filter(function(d){return String(d.topic).indexOf('realtime:sala-')===0&&d.event==='broadcast'&&(!ev||d.payload.event===ev)}).map(function(d){return d.payload.payload})};
  RT.posMandadas=function(){return RT.enviadas.filter(function(d){return d.event==='broadcast'&&d.payload.event==='pos'})};
  window.WebSocket=FakeWS;
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
import './src/main.js?v=${VERSAO}';
import * as Tl from './src/telas.js?v=${VERSAO}';
import * as Cd from './src/sim/cidade.js?v=${VERSAO}';
import * as I from './src/sim/incursao.js?v=${VERSAO}';
import * as Sa from './src/sala.js?v=${VERSAO}';
import * as Pg from './src/sim/progresso.js?v=${VERSAO}';
import * as Vz from './src/voz.js?v=${VERSAO}';
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
  /* do acampamento (ou da tela final) até a masmorra: entra na cidade, fala
     com o Guia de caça sem andar até ele e escolhe o primeiro mapa. Quem quer
     provar a caminhada na cidade é o caso cidade */
  var entrar=function(){if(visivel('#menu'))$('#play').click();if(visivel('#pick'))clica($('#pickList button.cls.on')||$('#pickList button.cls'))};
  var cacar=function(){if(visivel('#menu')||visivel('#pick'))entrar();else if(visivel('#end'))clica($('#toMenu'));Tl.abreNpc('guia');Tl.start()};
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
    /* microfone falso, sem pergunta de permissão: o caso voz-na-sala */
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
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
  /* com a mesma versão dos imports internos: sem ela seriam outros módulos */
  const url = (n) => pathToFileURL(join(dirSim, n)).href + `?v=${VERSAO}`;
  const B = await import(url('base.js'));
  const {saida} = B;
  const {carrega} = await import(url('dados.js'));
  const P = await import(url('progresso.js'));
  const I = await import(url('incursao.js'));
  const Mp = await import(url('mapa.js'));
  const OT = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'otbm.mjs')).href);
  const Cb = await import(url('combate.js'));
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
  /* quadros: a sequência de tempos de quadro (em s) que a "tela" usa, repetida;
     o passo fixo faz o resultado não depender dela */
  const roda = (semente, extra, quadros = [0.05]) => {
    novoSave();
    let fim = null; saida.fim = (k) => { fim = k; };
    /* alimentado a caçada inteira: o que se prova aqui é o relógio, não a fome */
    I.newRun(semente); I.G.active = true; I.G.ps[0].ali = 1e9;
    const foto = retrato();
    /* o jogador parado mira no monstro mais perto: a mira é lida dentro de
       cada passo da regra, então o resultado não depende do quadro */
    const maisPerto = () => { const p = I.G.ps[0]; let b = null, bd = 1e9; for (const m of I.G.mons) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; b = m; } } return b ? Math.atan2(b.y - p.y, b.x - p.x) : NaN; };
    const ent = {x: 0, y: 0, held: [true, false, false, false], mira: {get 0() { return maisPerto(); }}, alc: [1, 1, 1, 1]};
    let q = 0;
    while (!I.G.over && q < 60000) { I.passo(quadros[q % quadros.length], ent); for (let i = 0; i < (extra || 0); i++) B.frr(0, 1); q++; }
    return {foto, r: {fim, t: I.G.t, passos: Math.round(I.G.t / B.TICK), kills: I.G.kills, xp: I.G.ps[0].xpGain, saco: I.G.ps[0].bagVal, mons: I.G.mons.length, semente: I.G.semente}};
  };
  const rnd0 = Math.random;
  let a, b, c, d, e, f;
  try {
    Math.random = () => { throw new Error('Math.random chamado dentro da simulação'); };
    a = roda(7); b = roda(7); c = roda(8); d = roda(7, 37);
    e = roda(7, 0, [1 / 60]); f = roda(7, 0, [0.016, 0.017, 0.033, 0.1, 0.004]);
  } catch (e) { falhas.push('a incursão quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  finally { Math.random = rnd0; for (const k of Object.keys(saida)) saida[k] = () => {}; }
  if (a) {
    if (a.r.semente !== 7) falhas.push(`a incursão não guardou a semente (G.semente=${a.r.semente})`);
    if (a.foto !== b.foto) falhas.push('mesma semente, masmorras diferentes');
    if (JSON.stringify(a.r) !== JSON.stringify(b.r)) falhas.push(`mesma semente, resultados diferentes: ${JSON.stringify(a.r)} / ${JSON.stringify(b.r)}`);
    if (a.foto.split('|')[0] !== c.foto.split('|')[0]) falhas.push('sementes 7 e 8 deram mapas diferentes: o mapa é fixo (pilar 2)');
    if (JSON.stringify(a.r) !== JSON.stringify(d.r)) falhas.push(`os efeitos mexeram na regra: ${JSON.stringify(a.r)} / ${JSON.stringify(d.r)}`);
    /* passo fixo: 20, 60 ou quadros irregulares, a mesma incursão */
    if (JSON.stringify(a.r) !== JSON.stringify(e.r)) falhas.push(`o resultado depende do quadro (50 ms × 1/60 s): ${JSON.stringify(a.r)} / ${JSON.stringify(e.r)}`);
    if (JSON.stringify(a.r) !== JSON.stringify(f.r)) falhas.push(`o resultado depende do quadro (50 ms × irregular): ${JSON.stringify(a.r)} / ${JSON.stringify(f.r)}`);
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
  /* a morte leva 25% do XP do nível (progression.xp.deathLoss), nunca o nível;
     extrair não leva nada */
  try {
    for (const [fim, xp0, esperado] of [['morreu', 1000, 750], ['desabou', 101, 76], ['extraiu', 1000, 1000]]) {
      novoSave(); P.ch().lvl = 4; P.ch().xp = xp0; I.newRun(9); I.finish(fim);
      if (P.ch().xp !== esperado || P.ch().lvl !== 4 || I.G.ps[0].xpPerdido !== xp0 - esperado) falhas.push(`${fim} com ${xp0} de XP deixou ${P.ch().xp} no nível ${P.ch().lvl} (esperado ${esperado} no 4)`);
    }
    if (P.xpNeed(1) !== 520 || P.xpNeed(8) !== 3379) falhas.push(`a curva não veio do content.json: xpNeed(1)=${P.xpNeed(1)}, xpNeed(8)=${P.xpNeed(8)}`);
  } catch (e) { falhas.push('a perda de XP na morte quebrou: ' + e.message); }
  finally { for (const k of Object.keys(saida)) saida[k] = () => {}; }
  try {
    const sv = P.SAVE0(); sv.classe = 'cavaleiro'; sv.chars.cavaleiro = P.novoChar('cavaleiro'); P.setSave(sv);
    /* a moeda vira ouro no cofre; cota, gema e dente ficam guardados como item */
    const r = P.guardaSaco({ouro: 50, dente: 2, gema: 1, cota: 1});
    if (r.ouro !== 50 || r.pecas !== 1 || r.mats !== 3 || sv.cofre !== 50 || sv.itens.cota !== 1 || sv.mats.dente !== 2 || sv.mats.gema !== 1) falhas.push(`guardaSaco: ${JSON.stringify(r)} / ${JSON.stringify(sv)}`);
    if (P.vender('dente') || !P.vender('gema') || sv.cofre !== 170 || sv.mats.gema) falhas.push(`o Banco vende tesouro e não material: cofre ${sv.cofre}`);
    const red0 = P.eqBonus('red');
    if (!P.equipar('cota') || sv.chars.cavaleiro.equip.armadura !== 'cota' || sv.itens.cota || P.eqBonus('red') - red0 !== 0.08) falhas.push('equipar a cota não vestiu nem somou a defesa');
    if (P.vender('cota')) falhas.push('vendeu uma peça que não estava no cofre');
    if (!P.desequipar('armadura') || !P.vender('cota') || sv.cofre !== 260) falhas.push(`devolver e vender a cota: cofre ${sv.cofre}`);
  } catch (e) { falhas.push('o cofre quebrou no Node: ' + e.message); }
  /* a mochila (progression.mochila): fica com o personagem entre as caçadas,
     entra inteira na seguinte, a morte leva tudo (menos o selo), extrair não
     guarda nada sozinho, o Banco guarda e devolve, e cheia o loot fica no chão */
  try {
    novoSave(); const sv = P.save, c = P.ch(), cap = P.nEspacos();
    if (!c.mochila || Object.keys(c.mochila).length) falhas.push('personagem novo sem mochila vazia');
    c.mochila = {ouro: 30, gema: 1, espada: 2};
    if (P.ocupa(c.mochila) !== 4 || P.valMochila(c.mochila) !== 190) falhas.push(`mochila: ${P.ocupa(c.mochila)} espaços, ${P.valMochila(c.mochila)} de ouro (esperado 4 e 190)`);
    I.newRun(61); let p = I.G.ps[0];
    if (p.bagVal !== 190 || p.bag.espada !== 2 || p.bag === c.mochila) falhas.push(`a mochila não entrou na caçada como cópia: ${JSON.stringify(p.bag)} / ${p.bagVal}`);
    p.bag.ouro += 10; p.bagVal += 10; I.finish('extraiu');
    if (sv.cofre !== 0 || c.mochila.ouro !== 40 || c.mochila.espada !== 2 || sv.best !== 10) falhas.push(`extrair: cofre ${sv.cofre}, mochila ${JSON.stringify(c.mochila)}, recorde ${sv.best} (esperado 0, 40 de ouro e 10)`);
    sv.up.seguro = 1; I.newRun(62); I.finish('morreu');
    if (Object.keys(c.mochila).length || sv.cofre !== Math.round(200 * 0.2)) falhas.push(`morrer: mochila ${JSON.stringify(c.mochila)}, cofre ${sv.cofre} (esperado vazia e 40 do selo)`);
    /* o Banco */
    sv.cofre = 0; c.mochila = {ouro: 30, gema: 1, espada: 2, seda: 3};
    const g1 = P.guardaUm('espada');
    if (!g1 || g1.pecas !== 1 || c.mochila.espada !== 1 || sv.itens.espada !== 1) falhas.push(`guardar uma espada: ${JSON.stringify(c.mochila)} / ${JSON.stringify(sv.itens)}`);
    const g2 = P.guardaMochila();
    if (g2.ouro !== 30 || g2.mats !== 4 || sv.cofre !== 30 || sv.itens.espada !== 2 || sv.mats.seda !== 3 || sv.mats.gema !== 1 || Object.keys(c.mochila).length) falhas.push(`guardar tudo: ${JSON.stringify(g2)}, cofre ${sv.cofre}, mochila ${JSON.stringify(c.mochila)}`);
    if (!P.leva('espada') || c.mochila.espada !== 1 || sv.itens.espada !== 1 || !P.retira(20) || c.mochila.ouro !== 20 || sv.cofre !== 10) falhas.push(`levar do cofre: mochila ${JSON.stringify(c.mochila)}, cofre ${sv.cofre}`);
    if (!P.leva('seda') || c.mochila.seda !== 3 || sv.mats.seda) falhas.push(`levar a pilha de seda: mochila ${JSON.stringify(c.mochila)}, cofre ${JSON.stringify(sv.mats)}`);
    /* cheia: peça de equipamento ocupa um espaço cada, o resto empilha */
    c.mochila = {espada: cap - 1, ouro: 5};
    if (P.cabe(c.mochila, 'espada') || !P.cabe(c.mochila, 'ouro') || P.cabe(c.mochila, 'gema') || P.leva('espada')) falhas.push('a mochila cheia ainda aceitou peça nova');
    I.newRun(63); p = I.G.ps[0]; const d = {x: p.x, y: p.y, items: [['ouro', 3], ['gema', 1]], rar: 1, t: 99, dono: 0};
    I.G.drops.push(d); Cb.pickup(d, I.G.drops.length - 1, p);
    if (p.bag.ouro !== 8 || p.bag.gema || I.G.drops.length !== 1 || d.items.length !== 1 || d.items[0][0] !== 'gema') falhas.push(`mochila cheia: pegou ${JSON.stringify(p.bag)}, ficou no chão ${JSON.stringify(d.items)}`);
    /* save cru e ficha de fora: item que não existe some */
    const n = P.normaliza({classe: 'druida', chars: {druida: {lvl: 2, mochila: {ouro: 7, sumiu: 3, gema: -1}}}});
    if (JSON.stringify(n.chars.druida.mochila) !== '{"ouro":7}') falhas.push(`normaliza() na mochila: ${JSON.stringify(n.chars.druida.mochila)}`);
    const f = P.confereFicha({cl: 'druida', c: {lvl: 2, mochila: {coroa: 1, nada: 9}}});
    if (JSON.stringify(f.c.mochila) !== '{"coroa":1}') falhas.push(`confereFicha() na mochila: ${JSON.stringify(f.c.mochila)}`);
  } catch (e) { falhas.push('a mochila quebrou no Node: ' + e.message); }
  /* a forja do Gordon: encomenda só com o material todo, consome o que pede e
     libera a loja; venda de material barata; o save cru é limpo */
  try {
    const F = JSON.parse(CONTEUDO).forja, m0 = F.missoes[0];
    const sv = P.SAVE0(); sv.classe = 'cavaleiro'; sv.chars.cavaleiro = P.novoChar('cavaleiro'); P.setSave(sv);
    const lib1 = F.loja.find((o) => o.missao === 1);
    if (P.comprarForja(lib1.item)) falhas.push('a forja vendeu peça de encomenda não entregue');
    for (const [k, q] of Object.entries(m0.pede)) sv.mats[k] = q - 1;
    if (P.podeEntregar() || P.entregar() || sv.forja !== 0) falhas.push('a forja aceitou encomenda incompleta');
    for (const [k, q] of Object.entries(m0.pede)) sv.mats[k] = q + 2;
    if (!P.entregar() || sv.forja !== 1 || Object.keys(m0.pede).some((k) => sv.mats[k] !== 2)) falhas.push(`entregar não consumiu o pedido: ${JSON.stringify(sv.mats)} / ${sv.forja}`);
    const k0 = Object.keys(m0.pede)[0], pr = F.compra[k0];
    if (P.venderMat(k0, 5) !== 2 * pr || sv.cofre !== 2 * pr || sv.mats[k0]) falhas.push(`venderMat: cofre ${sv.cofre}, sobrou ${sv.mats[k0]}`);
    if (P.venderMat('gema', 1) || P.venderMat(k0, 1)) falhas.push('venderMat vendeu o que não é material ou não está no depósito');
    if (P.comprarForja(lib1.item)) falhas.push('a forja vendeu sem ouro');
    sv.cofre = lib1.preco;
    if (!P.comprarForja(lib1.item) || sv.cofre !== 0 || sv.itens[lib1.item] !== 1) falhas.push('comprar na forja não pôs a peça no cofre');
    const n = P.normaliza({classe: 'cavaleiro', chars: {}, mats: {seda: 3, gema: 2, cota: 1, sumiu: 4, osso: -1}, forja: 99});
    if (JSON.stringify(n.mats) !== '{"seda":3,"gema":2}' || n.forja !== F.missoes.length) falhas.push(`normaliza da forja: ${JSON.stringify(n.mats)} / ${n.forja}`);
    for (const o of F.loja) if (o.preco <= JSON.parse(CONTEUDO).items[o.item].val) falhas.push(`a forja vende ${o.item} abaixo do Banco`);
  } catch (e) { falhas.push('a forja quebrou no Node: ' + e.message); }
  if (a) {
    if (a.r.fim !== 'desabou') falhas.push(`a incursão parada devia acabar soterrada, acabou em ${a.r.fim} após ${a.r.passos} passos`);
    if (!(a.r.kills >= 1)) falhas.push(`nenhum monstro abatido no Node (${JSON.stringify(a.r)})`);
  }
  /* ---------- grupo (etapa M1 do plano do multiplayer) ----------
     Solo é um grupo de um: newRun(semente, fichas) aceita 1, 2 ou 4
     jogadores, cada um com a própria ficha e a própria entrada. Prova que:
     - a ficha do save sozinha dá a mesma incursão de newRun() sem fichas;
     - 1, 2 e 4 jogadores com entradas roteirizadas são deterministas (mesma
       semente, mesmas entradas, mesmo resultado, a 20 e a 60 quadros);
     - o mundo é igual para todos: o nível e o tamanho do grupo de quem entra
       não mudam quantos monstros nascem nem a vida deles (pilar 1);
     - o loot é único: só um jogador leva o drop, e quem causou mais dano tem
       a vez durante lootProtection;
     - a extração é de cada um, e só a ficha local mexe no cofre. */
  try {
    const CLS = ['cavaleiro', 'feiticeiro', 'cacador', 'druida'];
    const fichas = (n, lvl) => {
      novoSave();
      return Array.from({length: n}, (_, i) => i ? {cl: CLS[i], c: P.novoChar(CLS[i], lvl || 4 + i), up: {...P.UP0}} : I.fichaLocal());
    };
    /* cada jogador anda num círculo próprio e segura os espaços 1 e 2 */
    const entradas = (n, q) => Array.from({length: n}, (_, i) => { const a = q * 0.011 + i * 1.7; return {x: Math.cos(a), y: Math.sin(a * 0.8), held: [true, i % 2 === 0, false, false]}; });
    const grupo = (n, sem, quadro = 0.05) => {
      const f = fichas(n); let fim = null; saida.fim = (k) => { fim = k; };
      I.newRun(sem, f); I.G.active = true;
      const mons0 = I.G.mons.length, chefe = I.G.mons.find((m) => m.t.boss).mhp;
      let q = 0;
      /* a entrada muda a cada passo da regra, qualquer que seja o quadro */
      while (!I.G.over && q < 40000) { I.passo(quadro, entradas(n, Math.round(I.G.t / B.TICK))); q++; }
      return {fim, mons0, chefe, t: I.G.t.toFixed(2), kills: I.G.kills, ps: I.G.ps.map((p) => [p.fora, p.kills, p.xpGain, p.bagVal, Math.round(p.hp), Math.round(p.x), Math.round(p.y), p.c.lvl, p.c.xp].join(':')).join(' ')};
    };
    Math.random = () => { throw new Error('Math.random chamado dentro da simulação'); };
    /* a ficha local explícita é o solo de sempre */
    novoSave(); I.newRun(21); I.G.active = true; let q0 = 0;
    while (!I.G.over && q0 < 40000) { I.passo(0.05, entradas(1, q0)[0]); q0++; }
    const solo = [I.G.t.toFixed(2), I.G.kills, I.G.ps[0].xpGain, I.G.ps[0].bagVal].join();
    novoSave(); I.newRun(21, [I.fichaLocal()]); I.G.active = true; q0 = 0;
    while (!I.G.over && q0 < 40000) { I.passo(0.05, [entradas(1, q0)[0]]); q0++; }
    const soloF = [I.G.t.toFixed(2), I.G.kills, I.G.ps[0].xpGain, I.G.ps[0].bagVal].join();
    if (solo !== soloF) falhas.push(`a ficha do save mudou o solo: ${solo} / ${soloF}`);
    const r = {};
    for (const n of [1, 2, 4]) {
      const x = grupo(n, 21), y = grupo(n, 21), z = grupo(n, 21, 1 / 60);
      r[n] = x;
      if (JSON.stringify(x) !== JSON.stringify(y)) falhas.push(`${n} jogadores, mesma semente e mesmas entradas, resultados diferentes: ${JSON.stringify(x)} / ${JSON.stringify(y)}`);
      if (JSON.stringify(x) !== JSON.stringify(z)) falhas.push(`${n} jogadores: o resultado depende do quadro (50 ms × 1/60 s): ${JSON.stringify(x)} / ${JSON.stringify(z)}`);
      if (x.ps.split(' ').length !== n) falhas.push(`${n} jogadores pedidos, a incursão teve ${x.ps.split(' ').length}`);
      if (!x.fim) falhas.push(`${n} jogadores: a incursão não acabou (${JSON.stringify(x)})`);
    }
    const PT = JSON.parse(CONTEUDO).progression.party;
    /* o mesmo mundo para 1 ou 4 jogadores, de nível 1 ou 30: mesmos monstros, mesma vida */
    const mundo = (n, lvl) => { const f = fichas(n, lvl); for (const x of f) x.c.lvl = lvl; I.newRun(21, f); return I.G.mons.map((m) => `${m.k}:${m.tx},${m.ty}:${m.mhp}`).join(' '); };
    const m11 = mundo(1, 1);
    for (const [n, lvl] of [[1, 30], [2, 1], [4, 30]]) if (mundo(n, lvl) !== m11) falhas.push(`o mundo mudou com ${n} jogador(es) de nível ${lvl}: monstros ou vida diferentes do solo de nível 1`);
    if (!(r[1].mons0 === r[2].mons0 && r[2].mons0 === r[4].mons0)) falhas.push(`o grupo mudou quantos monstros nascem: ${r[1].mons0}, ${r[2].mons0}, ${r[4].mons0} para 1, 2 e 4`);
    if (!r[4].ps.split(' ').some((p) => +p.split(':')[1] > 0 && p !== r[4].ps.split(' ')[0])) falhas.push(`com 4 jogadores, só o primeiro abateu monstros: ${r[4].ps}`);
    /* loot único e a vez de quem causou mais dano */
    const f2 = fichas(2); I.newRun(22, f2); I.G.active = true; I.G.mons.length = 0;
    const [p0, p1] = I.G.ps, parado = {x: 0, y: 0, held: [false, false, false, false]};
    p0.x += 6 * 32;
    I.G.drops.push({x: p1.x, y: p1.y, items: [['ouro', 30]], rar: 0, t: 0, dono: 0});
    I.update(0.05, [parado, parado]);
    if (!I.G.drops.length || p1.bagVal) falhas.push('o drop de outro jogador foi pego antes de acabar a vez dele');
    I.G.drops[0].t = PT.lootProtection;
    I.update(0.05, [parado, parado]);
    if (I.G.drops.length || p1.bagVal !== 30 || p0.bagVal) falhas.push(`passada a vez, o drop não foi para quem encostou (sacos ${p0.bagVal} / ${p1.bagVal}, ${I.G.drops.length} no chão)`);
    I.G.drops.push({x: p0.x, y: p0.y, items: [['ouro', 5]], rar: 0, t: 0, dono: 0}, {x: p0.x, y: p0.y, items: [['ouro', 7]], rar: 0, t: 0, dono: 1});
    I.update(0.05, [parado, parado]);
    if (p0.bagVal !== 5 || I.G.drops.length !== 1) falhas.push(`o dono pegou ${p0.bagVal} e sobraram ${I.G.drops.length} drops (esperado 5 e 1)`);
    /* quem bateu mais é o dono do drop do monstro (até sair um drop) */
    const H = await import(url('combate.js')), rato = JSON.parse(CONTEUDO).enemies.rato;
    let dono = null;
    for (let i = 0; i < 40 && dono === null; i++) {
      const m = {k: 'rato', t: {...rato}, x: p0.x, y: p0.y, hp: 50, mhp: 50, r: 9, dn: [0, 0], xpm: 1}, n0 = I.G.drops.length;
      I.G.mons.push(m); H.hitMon(m, 10, '#fff', p0); H.hitMon(m, 30, '#fff', p1); H.hitMon(m, 15, '#fff', p0);
      if (I.G.mons.includes(m)) { falhas.push('o rato com 55 de dano em 50 de vida não morreu'); break; }
      if (I.G.drops.length > n0) dono = I.G.drops[I.G.drops.length - 1].dono;
    }
    if (dono !== 1) falhas.push(`o drop foi para o jogador ${dono}, não para quem causou mais dano (o 1: 30 contra 25 do 0, que deu o golpe final)`);
    if (!(p0.xpGain > 0 && p1.xpGain > 0)) falhas.push(`XP do abate: ${p0.xpGain} / ${p1.xpGain}, os dois bateram`);
    /* extração individual: quem sai pelo portal não acaba a sala dos outros,
       e só a ficha local mexe na conta */
    const f3 = fichas(2); I.newRun(23, f3); I.G.active = true; I.G.mons.length = 0;
    const [a0, a1] = I.G.ps, sv = P.save, cofre0 = sv.cofre, ext0 = sv.ext;
    I.G.t = 200; I.G.portal.open = true; a1.x = I.G.portal.x; a1.y = I.G.portal.y; a1.bag = {ouro: 40}; a1.bagVal = 40;
    for (let i = 0; i < 80 && !a1.fora; i++) I.update(0.05, [parado, parado]);
    if (a1.fora !== 'extraiu' || I.G.over || a0.fora) falhas.push(`a extração de um encerrou a sala ou não aconteceu (${a1.fora}, over=${I.G.over}, ${a0.fora})`);
    if (sv.cofre !== cofre0 || sv.ext !== ext0 || P.ch().mochila.ouro) falhas.push('a extração de outro jogador mexeu no cofre ou na mochila deste aparelho');
    a0.x = I.G.portal.x; a0.y = I.G.portal.y; a0.bag = {ouro: 25}; a0.bagVal = 25;
    for (let i = 0; i < 80 && !I.G.over; i++) I.update(0.05, [parado, parado]);
    if (!I.G.over || sv.cofre !== cofre0 || P.ch().mochila.ouro !== 25 || sv.ext !== ext0 + 1) falhas.push(`o último a extrair não fechou a sala ou a mochila não saiu com ele (cofre ${cofre0} → ${sv.cofre}, mochila ${JSON.stringify(P.ch().mochila)})`);
    /* o retrato da sala: o convidado que gera a mesma masmorra pela semente e
       aplica o retrato do anfitrião vê os mesmos monstros, jogadores e sacos */
    const fr = fichas(2); I.newRun(31, fr); I.G.active = true;
    for (let q = 0; q < 300 && !I.G.over; q++) I.passo(0.05, entradas(2, q));
    const host = I.G, ret = JSON.parse(JSON.stringify(I.retrato()));
    const mons = (G) => G.mons.map((m) => `${m.k}@${Math.round(m.x)},${Math.round(m.y)}:${Math.ceil(m.hp)}`).join(';');
    const esperado = mons(host), pAnf = [Math.round(host.ps[0].x), Math.round(host.ps[0].y), Math.ceil(host.ps[0].hp)].join(), nDr = host.drops.length;
    I.newRun(31, fr.map((f) => P.confereFicha({...f, c: JSON.parse(JSON.stringify(f.c))})));
    I.aplicaRetrato(ret, 1);
    if (mons(I.G) !== esperado) falhas.push('o convidado não vê os mesmos monstros que o anfitrião depois do retrato');
    if ([Math.round(I.G.ps[0].x), Math.round(I.G.ps[0].y), Math.ceil(I.G.ps[0].hp)].join() !== pAnf) falhas.push('o convidado não vê o anfitrião onde ele está');
    if (I.G.drops.length !== nDr) falhas.push(`sacos no chão: ${nDr} no anfitrião, ${I.G.drops.length} no convidado`);
    /* a herança da sala: quem assume refaz a masmorra pela semente, adota a
       herança e, com as mesmas entradas, segue exatamente como o anfitrião
       seguiria (mesmos monstros, sacos, vida e XP) — inclusive o sorteio */
    {
      const fh = fichas(3); I.newRun(51, fh, true); I.G.active = true;
      for (const p of I.G.ps) { p.mhp = p.hp = 1e6; }
      /* o grupo começa no meio do maior grupo de monstros do mapa (fixo:
         cada monstro tem o sqm dele), longe do chefe, em sqm livres */
      const perto = (r) => I.G.mons.filter((m) => !m.t.boss && Math.max(Math.abs(m.tx - r.cx), Math.abs(m.ty - r.cy)) <= 5);
      const longeDoChefe = (r) => I.G.mons.every((m) => !m.t.boss || Math.max(Math.abs(m.tx - r.cx), Math.abs(m.ty - r.cy)) > 12);
      const sl = I.G.rooms.filter((r) => r.base > 0 && longeDoChefe(r) && I.G.mons.some((m) => m.sala === r.i && !m.t.boss)).sort((a, b) => perto(b).length - perto(a).length || I.G.mons.find((m) => m.sala === a.i).mhp - I.G.mons.find((m) => m.sala === b.i).mhp)[0], livres = [];
      for (let y = sl.cy - 2; y <= sl.cy + 2 && livres.length < 3; y++) for (let x = sl.cx - 2; x <= sl.cx + 2 && livres.length < 3; x++) if (!I.solid(x, y) && !I.G.ocu[y * 64 + x]) livres.push([x, y]);
      I.G.ps.forEach((p, i) => B.poeNoSqm(p, livres[i][0], livres[i][1]));
      let q = 0;
      /* a herança sai no meio do combate: depois do primeiro abate */
      for (; (q < 100 || !I.G.kills || I.G.pend.length) && q < 4000; q++) I.update(0.05, entradas(3, q));
      const vida = () => I.G.mons.reduce((a, m) => a + m.hp, 0), vida0 = vida();
      const her = JSON.parse(JSON.stringify(I.heranca())), q0h = q;
      const foto = () => [I.G.t.toFixed(2), I.G.kills, I.G.nid, I.G.drops.length, mons(I.G), I.G.ps.map((p) => [p.tx, p.ty, Math.round(p.hp), Math.round(p.mp), p.bagVal, p.kills, p.c.lvl, p.c.xp, p.c.mag, p.c.per].join(':')).join(' ')].join('|');
      for (; q < q0h + 800; q++) I.update(0.05, entradas(3, q));
      const orig = foto(), kOrig = I.G.kills;
      if (!(I.G.kills > her.kills || vida() !== vida0)) falhas.push(`a herança não foi testada em combate: ${her.kills} → ${I.G.kills} abates, vida dos monstros sem mudar`);
      const ok1 = I.adota(her, 0, I.fichaLocal());
      if (!ok1) falhas.push('adota() recusou uma herança válida');
      else {
        if (I.G.kills !== her.kills || I.G.mons.length !== her.mons.length || !I.G.ps[0].local || I.G.ps[1].local) falhas.push('adota() não pôs a herança por cima da masmorra');
        for (q = q0h; q < q0h + 800; q++) I.update(0.05, entradas(3, q));
        const herd = foto();
        if (herd !== orig) falhas.push(`quem adota a herança não segue como o anfitrião seguiria (${kOrig} abates no original, ${I.G.kills} na herança): ${orig.slice(0, 160)} / ${herd.slice(0, 160)}`);
      }
      if (I.adota({v: 1, semente: 1, ps: [{cl: 'dragao', c: {}}], mons: []}, -1, I.fichaLocal())) falhas.push('adota() aceitou herança com classe que não existe');
      const tam = JSON.stringify(her).length;
      if (tam > 60000) falhas.push(`a herança tem ${tam} bytes: grande demais para mandar a cada segundo`);
    }
    /* o sqm contado pelo convidado: o anfitrião anda até lá um sqm por passo,
       na velocidade do nível, sem teleporte */
    I.newRun(32, fichas(2)); I.G.active = true; I.G.mons.length = 0; I.G.ocu.fill(0);
    const cv = I.G.ps[1], B0 = await import(url('base.js')); B0.poeNoSqm(cv, Math.floor(I.G.portal.x / 32), Math.floor(I.G.portal.y / 32));
    const ctx0 = cv.tx, alvo = {x: 0, y: 0, held: [false, false, false, false]}, rem = {x: 0, y: 0, held: [false, false, false, false], pos: {x: ctx0 + 30, y: cv.ty}, f: 0};
    I.update(0.05, [alvo, rem]);
    if (Math.abs(cv.tx - ctx0) > 1) falhas.push(`o convidado pulou ${cv.tx - ctx0} sqm num passo`);
    for (let k = 0; k < 20; k++) I.update(0.05, [alvo, rem]);
    if (cv.tx - ctx0 > Math.ceil(1.05 / P.durPasso(cv.c)) + 1) falhas.push(`o convidado andou ${cv.tx - ctx0} sqm em 1 s, mais que a velocidade do nível ${cv.c.lvl}`);
    /* a masmorra aberta da sala: sem tempo, porta na entrada, monstros que
       renascem como no Tibia (progression.respawn) e entrada de novo */
    {
      novoSave(); I.newRun(41, [I.fichaLocal()], true); I.G.active = true;
      const RS = JSON.parse(CONTEUDO).progression.respawn, G = I.G, pl = G.ps[0], parado = {x: 0, y: 0, held: [false, false, false, false]};
      pl.mhp = pl.hp = 1e7;
      for (let k = 0; k < 80; k++) I.update(0.05, [parado]);
      if (pl.fora) falhas.push('na porta da sala, quem acabou de entrar saiu sem querer');
      G.t = 1000; for (let k = 0; k < 10; k++) I.update(0.05, [parado]);
      if (G.over || pl.fora) falhas.push(`a masmorra da sala desabou ou tirou o jogador depois do tempo da solo (${pl.fora})`);
      const sala = G.rooms.find((r) => r.base > 0 && !r.chefe && Math.hypot(r.cx - pl.tx, r.cy - pl.ty) > RS.clearTiles + 4);
      const conta = () => G.mons.filter((m) => m.sala === sala.i).length;
      if (!sala || !(conta() > 0)) falhas.push('não achei sala com monstros longe da porta para testar o respawn');
      else {
        G.mons = G.mons.filter((m) => m.sala !== sala.i);
        for (let k = 0; k < Math.round((RS.seconds - 2) / 0.05); k++) I.update(0.05, [parado]);
        if (conta() !== 0) falhas.push(`a sala repovoou antes de ${RS.seconds} s`);
        for (let k = 0; k < Math.round(4 / 0.05); k++) I.update(0.05, [parado]);
        if (conta() < sala.base) falhas.push(`a sala não repovoou depois de ${RS.seconds} s: ${conta()} de ${sala.base}`);
        G.mons = G.mons.filter((m) => m.sala !== sala.i);
        const B1 = await import(url('base.js')); B1.poeNoSqm(pl, sala.cx, sala.cy);
        for (let k = 0; k < Math.round((RS.seconds + 4) / 0.05); k++) I.update(0.05, [parado]);
        if (conta() !== 0) falhas.push('a sala repovoou com o jogador dentro dela');
        B1.poeNoSqm(pl, Math.floor(G.portal.x / 32), Math.floor(G.portal.y / 32)); pl.longe = true; pl.bag = {ouro: 9}; pl.bagVal = 9; const cofre0 = P.save.cofre;
        for (let k = 0; k < 80 && !pl.fora; k++) I.update(0.05, [parado]);
        if (pl.fora !== 'extraiu' || P.save.cofre !== cofre0 || P.ch().mochila.ouro !== 9 || G.over) falhas.push(`sair pela porta: ${pl.fora}, cofre ${cofre0} → ${P.save.cofre}, mochila ${JSON.stringify(P.ch().mochila)}, sala acabou: ${G.over}`);
        const de = I.entra(0, I.fichaLocal());
        if (de.fora || de.bagVal !== 9 || G.ps.length !== 1 || de.longe) falhas.push(`entrar de novo pela porta não deu um jogador novo, na porta e com a mochila de antes (${de.bagVal})`);
      }
    }
    if (P.confereFicha({cl: 'dragao', c: {}}) || P.confereFicha({cl: 'druida', c: {lvl: 1e9, slots: ['golpe', 'gelo']}}).c.lvl !== 200 || P.confereFicha({cl: 'druida', c: {lvl: 2, slots: ['golpe', 'gelo']}}).c.slots[0] !== null)
      falhas.push('confereFicha() deixou passar classe inexistente, nível absurdo ou habilidade de outra classe');
  } catch (e) { falhas.push('o grupo quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  finally { Math.random = rnd0; for (const k of Object.keys(saida)) saida[k] = () => {}; }
  /* andar por sqm, como no Tibia: passo pela velocidade do nível, diagonal
     mais lenta, sem cortar quina, um monstro por sqm e bloqueio de corpo */
  try {
    novoSave();
    const W = JSON.parse(CONTEUDO).progression.walk, c = P.ch();
    c.lvl = 1; const d1 = P.durPasso(c); c.lvl = 200; const dmax = P.durPasso(c); c.lvl = 1;
    /* a fórmula do Tibia com chão 130: nível 1 (220) = 500 ms; nível 200 (618) = 250 ms; 150 (orc) = 700 ms */
    if (d1 !== 0.5 || dmax !== 0.25 || P.passoDaVel(150) !== 0.7) falhas.push(`passo do nível 1 = ${d1} s, nível 200 = ${dmax} s, velocidade 150 = ${P.passoDaVel(150)} s (esperado 0,5, 0,25 e 0,7 com chão ${W.ground})`);
    if (P.durPasso(c, 0.5) !== 0.35) falhas.push(`o buff de velocidade não encurta o passo: ${P.durPasso(c, 0.5)} (esperado 0,35)`);
    I.newRun(7); I.G.active = true;
    const p = I.G.ps[0], cx = (t) => (t + 0.5) * 32;
    if (p.x !== cx(p.tx) || p.y !== cx(p.ty)) falhas.push(`o jogador não nasce no centro de um sqm (${p.x},${p.y})`);
    /* leste por 1,8 s: 4 passos de 0,5 s começam, e ele para no centro do sqm */
    const leste = {x: 1, y: 0, held: [false, false, false, false]}, nada = {x: 0, y: 0, held: [false, false, false, false]};
    let livres = 0; while (!I.solid(p.tx + livres + 1, p.ty) && livres < 8) livres++;
    const x0 = p.tx, alvo = Math.min(4, livres);
    for (let i = 0; i < 36; i++) I.passo(0.05, leste);
    for (let i = 0; i < 12; i++) I.passo(0.05, nada);
    if (p.tx - x0 !== alvo || p.x !== cx(p.tx) || p.mv) falhas.push(`em 1,8 s andou ${p.tx - x0} sqm (esperado ${alvo}) e parou em x=${p.x}`);
    /* um monstro por sqm, nenhum no sqm de um jogador, em toda uma incursão com o jogador andando */
    I.newRun(11); I.G.active = true;
    const roteiro = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 1}];
    let choque = null;
    for (let q = 0; q < 2400 && !I.G.over && !choque; q++) {
      const r = roteiro[(q / 40 | 0) % roteiro.length];
      I.passo(0.05, {x: r.x, y: r.y, held: [true, false, false, false]});
      const vistos = new Set();
      for (const m of I.G.mons) { if (m.hp <= 0) continue; const k = m.ty * 64 + m.tx;
        if (vistos.has(k)) choque = `dois monstros no sqm ${m.tx},${m.ty}`; vistos.add(k);
        for (const j of I.G.ps) if (!j.fora && j.tx === m.tx && j.ty === m.ty) choque = `monstro no sqm do jogador (${m.tx},${m.ty})`;
        if (!m.mv && (m.x !== cx(m.tx) || m.y !== cx(m.ty))) choque = `monstro parado fora do centro do sqm (${m.x},${m.y})`; }
    }
    if (choque) falhas.push('ocupação de sqm: ' + choque);
    /* quina: na diagonal com um lado de parede, escorrega pelo eixo livre */
    I.newRun(7); I.G.active = true;
    const q = I.G.ps[0], B8 = B.DIR8;
    let canto = null;
    for (let y = 1; y < 63 && !canto; y++) for (let x = 1; x < 63 && !canto; x++)
      if (!I.solid(x, y) && I.solid(x + 1, y) && !I.solid(x, y + 1) && !I.solid(x + 1, y + 1)) canto = [x, y];
    if (canto) {
      B.poeNoSqm(q, canto[0], canto[1]);
      const j = B.passoPara(q, 1, (x, y) => !I.solid(x, y), 0.7, 0.7);
      if (j !== 2) falhas.push(`diagonal com parede a leste devia escorregar para o sul (índice 2), deu ${j}`);
    }
  } catch (e) { falhas.push('o andar por sqm quebrou: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  /* a cidade: mapa do conteúdo, paredes, NPCs sólidos, quem está perto e a
     chegada pelo portão; e o conteúdo com mapa torto é recusado */
  try {
    novoSave();
    const Cd = await import(url('cidade.js'));
    const C = Cd.entraCidade(false), M = JSON.parse(CONTEUDO).city.mapa;
    if (C.w !== M[0].length || C.h !== M.length) falhas.push(`a cidade tem ${C.w}×${C.h}, o mapa tem ${M[0].length}×${M.length}`);
    if (C.npcs.map((n) => n.k).sort().join() !== 'banqueiro,boticaria,capitao,corretor,gordon,grade,guia,mago,mercador,quitandeira') falhas.push(`NPCs da cidade: ${C.npcs.map((n) => n.k)}`);
    /* objetos (fonte, barril…) são sólidos e ficam sobre o chão do vizinho; a ponte atravessa o rio */
    const iObj = M.join('').indexOf('f'), iPonte = M.join('').indexOf('=');
    if (!(iObj >= 0 && C.obj[iObj] && C.sol[iObj] && C.t[iObj] !== 1)) falhas.push(`a fonte não virou objeto sólido sobre chão (obj ${C.obj[iObj]}, sol ${C.sol[iObj]}, chão ${C.t[iObj]})`);
    if (!(iPonte >= 0 && !C.sol[iPonte])) falhas.push('a ponte não deixa atravessar o rio');
    const parado = {x: 0, y: 0}, oeste = {x: -1, y: 0}, norte = {x: 0, y: -1};
    if (Cd.updateCidade(0.05, parado) !== null) falhas.push(`há NPC ao alcance já na chegada: ${C.perto}`);
    /* anda por sqm: oeste pela rua principal até a coluna do Mercador, parando no centro dela */
    const m = C.npcs.find((n) => n.k === 'mercador'), mx = m.x / 32 | 0;
    for (let i = 0; i < 400 && (C.p.tx > mx || C.p.mv); i++) Cd.updateCidade(0.05, C.p.tx > mx ? oeste : parado);
    /* norte pela porta até o Mercador ficar ao alcance (no ritmo do Tibia, ~0,55 s por sqm) */
    for (let i = 0; i < 200 && C.perto !== 'mercador'; i++) Cd.updateCidade(0.05, norte);
    if (C.perto !== 'mercador') falhas.push(`andar até a casa do Mercador não o deixou ao alcance (${C.perto} em ${C.p.x},${C.p.y})`);
    if (!(C.p.y > m.y + 10)) falhas.push('o jogador atravessou o Mercador');
    const C2 = Cd.entraCidade(true); Cd.updateCidade(0.05, parado);
    if (C2.perto !== 'guia') falhas.push(`voltar pelo portão não pôs o jogador ao lado do Guia (${C2.perto})`);
    const ruim = (f) => { const c = JSON.parse(CONTEUDO); f(c); try { carrega(c); return null; } catch (e) { return e.message; } finally { carrega(JSON.parse(CONTEUDO)); } };
    if (!ruim((c) => { c.city.mapa[3] += ','; })) falhas.push('mapa da cidade com linha torta foi aceito');
    if (!ruim((c) => { c.city.mapa[1] = c.city.mapa[1].replace(',', '?'); })) falhas.push('mapa da cidade com letra desconhecida foi aceito');
    if (!ruim((c) => { c.city.mapa = c.city.mapa.map((l) => l.replace('@', '.')); })) falhas.push('mapa da cidade sem @ foi aceito');
    if (!ruim((c) => { delete c.city.npcs.guia; })) falhas.push('cidade sem quem abra os mapas de caça foi aceita');
    if (!ruim((c) => { c.city.npcs.quitandeira.vende.push('nada'); })) falhas.push('loja que vende provisão inexistente foi aceita');
    if (!ruim((c) => { c.supplies.pocao.efeito = {voar: 1}; })) falhas.push('provisão com efeito desconhecido foi aceita');
    if (!ruim((c) => { delete c.supplies.pocao.max; })) falhas.push('provisão sem máximo por caçada foi aceita');
    if (!ruim((c) => { c.city.npcs.mago.letra = 'f'; })) falhas.push('NPC com a letra de um objeto foi aceito');
    if (!ruim((c) => { c.city.chao = [{x: 26, y: 17, item: 'espada'}]; })) falhas.push('peça do chão em cima da fonte foi aceita');
    if (!ruim((c) => { c.city.chao = [{x: 37, y: 6, item: 'faca', respawn: 0}]; })) falhas.push('peça do chão com respawn zero foi aceita');
    if (!ruim((c) => { c.hunts = {}; })) falhas.push('conteúdo sem mapa de caça foi aceito');
    if (!ruim((c) => { c.hunts.esgoto.npc = 'mercador'; })) falhas.push('mapa de caça levado por quem não abre cacadas foi aceito');
    if (!ruim((c) => { c.hunts.ilha.bands[0].weights = {grifo: 1}; })) falhas.push('mapa de caça com monstro inexistente foi aceito');
    if (!ruim((c) => { delete c.hunts.cripta.mapa; })) falhas.push('lugar de caça sem mapa fixo foi aceito');
    if (!ruim((c) => { c.hunts.cripta.mapa.grade[3] = c.hunts.cripta.mapa.grade[3].slice(2); })) falhas.push('mapa fixo com linha curta foi aceito');
    if (!ruim((c) => { c.hunts.cripta.mapa.spawn.push('0 0 esqueleto'); })) falhas.push('spawn fora do chão foi aceito');
    if (!ruim((c) => { c.hunts.cripta.mapa.spawn = c.hunts.cripta.mapa.spawn.filter((t) => !t.endsWith(' sombra')); })) falhas.push('mapa sem o chefe no spawn foi aceito');
    if (!ruim((c) => { c.hunts.cripta.mapa.entrada = '0 0'; })) falhas.push('entrada fora do chão foi aceita');
    if (!ruim((c) => { c.hunts.ilha.npc = 'guia'; })) falhas.push('NPC que abre cacadas sem mapa de caça nenhum foi aceito');
    const C3 = Cd.entraCidade('capitao'); Cd.updateCidade(0.05, parado);
    if (C3.perto !== 'capitao') falhas.push(`voltar da ilha não pôs o jogador ao lado do Capitão (${C3.perto})`);
    /* os mapas de caça: cada um com os monstros e o chefe dele, a mesma
       semente no mesmo mapa dá a mesma masmorra, e mapas diferentes dão
       masmorras diferentes; nome que não existe (da rede) vira a de Runas */
    const H = JSON.parse(CONTEUDO).hunts, PR = JSON.parse(CONTEUDO).progression;
    const fotos = {};
    for (const k of Object.keys(H).filter((k) => k[0] !== '_')) {
      const h = H[k], pode = new Set([...(h.bands || PR.bands).flatMap((b) => Object.keys(b.weights)), ...((h.boss || PR.boss).escort)]), chefe = (h.boss || PR.boss).type;
      novoSave(); I.newRun(51, undefined, false, k); const a = retrato();
      if (I.G.caca !== k) falhas.push(`newRun no mapa ${k} guardou ${I.G.caca}`);
      const fora = I.G.mons.filter((m) => !m.t.boss && !pode.has(m.k)).map((m) => m.k);
      if (fora.length) falhas.push(`o mapa ${k} tem monstros de outro lugar: ${[...new Set(fora)]}`);
      if (I.G.mons.filter((m) => m.t.boss).map((m) => m.k).join() !== chefe) falhas.push(`o mapa ${k} não tem o chefe dele (${chefe}) uma vez só`);
      novoSave(); I.newRun(51, undefined, false, k);
      if (retrato() !== a) falhas.push(`mesma semente no mapa ${k}, masmorras diferentes`);
      fotos[k] = a.split('|')[0];
      /* o mapa é fixo (pilar 2): outra semente dá o mesmo mapa e os mesmos
         monstros nos mesmos sqm; ninguém nasce em parede ou objeto; todo
         ponto de spawn se alcança andando da porta; e a ida e volta pelo
         formato do Remere's Map Editor (tools/otbm.mjs) devolve o mesmo mapa */
      {
        const G = I.G, mons = (g) => g.mons.map((m) => `${m.k}@${m.tx},${m.ty}:${m.mhp}`).sort().join(';');
        const m1 = mons(G), g1 = fnv(G.g);
        novoSave(); I.newRun(9876, undefined, false, k);
        if (fnv(I.G.g) !== g1) falhas.push(`no mapa ${k}, outra semente deu outro mapa`);
        if (mons(I.G) !== m1) falhas.push(`no mapa ${k}, outra semente pôs outros monstros (pilar 2)`);
        const em = I.G.mons.filter((m) => I.G.g[m.ty * 64 + m.tx] !== 0).map((m) => m.k);
        if (em.length) falhas.push(`no mapa ${k}, monstro nascido em cima de parede ou objeto: ${em}`);
        if (I.G.ps.some((q) => I.G.g[q.ty * 64 + q.tx] !== 0)) falhas.push(`no mapa ${k}, o jogador começou fora do chão`);
        const M = Mp.leMapa(h.mapa), longe = M.pontos.filter((q) => M.dist[q.y * 64 + q.x] < 0).length;
        if (longe) falhas.push(`no mapa ${k}, ${longe} ponto(s) de spawn não se alcançam da porta`);
        const m2 = OT.importa(OT.exporta(h, k + '-spawn.xml'), OT.spawnXml(h, JSON.parse(CONTEUDO).enemies), JSON.parse(CONTEUDO).enemies);
        if ((m2.entrada !== h.mapa.entrada || m2.spawn.join() !== h.mapa.spawn.join() ||
          [...Mp.leMapa(m2).pi].some((n, i) => m2.pilhas[n] !== h.mapa.pilhas[M.pi[i]]))) falhas.push(`no mapa ${k}, exportar e importar pelo .otbm mudou o mapa`);
      }
      I.G.active = true; let fim = null; saida.fim = (x) => { fim = x; };
      for (let i = 0; i < 40; i++) I.passo(0.05, {x: 0, y: 0, held: [true, true, false, false]});
      I.finish('desabou');
      if (fim !== 'desabou') falhas.push(`a incursão no mapa ${k} não terminou (${fim})`);
    }
    if (new Set(Object.values(fotos)).size !== Object.keys(fotos).length) falhas.push('mapas de caça diferentes deram o mesmo mapa');
    novoSave(); I.newRun(51, undefined, false, 'constructor');
    if (I.G.caca !== 'runas' || retrato().split('|')[0] !== fotos.runas) falhas.push(`mapa de caça que não existe não virou a Masmorra de Runas (${I.G.caca})`);
    /* sem mapa de caça, a Masmorra de Runas de sempre: o mesmo mapa da semente */
    novoSave(); I.newRun(51);
    if (I.G.caca !== 'runas' || retrato().split('|')[0] !== fotos.runas) falhas.push('newRun sem mapa de caça não deu a Masmorra de Runas');
  } catch (e) { falhas.push('a cidade quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  /* a mira é do jogador: o tiro vai para onde ele mira, não para o monstro
     mais perto. Mirar para o lado errado erra, gasta a mana e a recarga, e o
     efeito da magia aparece onde ela se desfaz */
  try {
    novoSave(); I.newRun(5); I.G.active = true;
    const p = I.G.ps[0], B2 = await import(url('base.js'));
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => [1, 2, 3, 4].every((k) => !I.solid(p.tx + dx * k, p.ty + dy * k)));
    if (!dir) falhas.push('a sonda da mira não achou corredor livre ao lado da entrada');
    else {
      const m = I.G.mons.find((o) => !o.t.boss); I.G.mons = [m]; m.hp = m.mhp = 99999;
      B2.poeNoSqm(m, p.tx + dir[0] * 3, p.ty + dir[1] * 3);
      const ang = Math.atan2(dir[1], dir[0]), solta = {x: 0, y: 0, held: [false, false, false, false]};
      const tiro = (a) => ({x: 0, y: 0, held: [true, false, false, false], mira: [a, NaN, NaN, NaN], alc: [1, 1, 1, 1]});
      const g0 = p.c.manaG; let viu = false;
      I.passo(0.05, tiro(ang + Math.PI));
      for (let i = 0; i < 20; i++) { I.passo(0.05, solta); if (I.G.fx.some((f) => f.k === 'ef' && f.n === 'ef_fogo')) viu = true; }
      if (m.hp !== m.mhp) falhas.push(`o tiro mirado para o lado oposto acertou o monstro (vida ${m.hp}/${m.mhp})`);
      if (p.c.manaG - g0 !== 5) falhas.push(`o tiro em vão não gastou a mana da Faísca (${p.c.manaG - g0})`);
      if (!viu) falhas.push('o tiro em vão não mostrou o efeito da Faísca onde se desfez');
      I.passo(0.05, tiro(Math.atan2(m.y - p.y, m.x - p.x)));
      for (let i = 0; i < 20; i++) I.passo(0.05, solta);
      if (m.hp >= m.mhp) falhas.push('o tiro mirado no monstro não acertou');
    }
  } catch (e) { falhas.push('a sonda da mira quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  /* vestir na caçada: a peça sai do saco e vale na hora, a do corpo vai para
     o saco; trocar não cura; a origem conta só o que veio desta caçada */
  try {
    novoSave(); P.ch().equip.amuleto = 'amuleto'; I.newRun(37); const p = I.G.p, vida = p.mhp;
    p.bag = {machado: 1, amuleto: 1}; p.bagVal = 0; p.hp = 40;
    if (!Cb.vesteDoSaco(p, 'machado') || P.ch().equip.arma !== 'machado' || p.bag.machado) falhas.push(`vestir o machado do saco: ${JSON.stringify(P.ch().equip)} saco ${JSON.stringify(p.bag)}`);
    if (!Cb.tiraProSaco(p, 'amuleto') || P.ch().equip.amuleto || p.bag.amuleto !== 2 || p.mhp !== vida - 15) falhas.push(`tirar o amuleto: saco ${JSON.stringify(p.bag)}, vida ${p.mhp} de ${vida}`);
    if (!Cb.vesteDoSaco(p, 'amuleto') || p.mhp !== vida || p.hp !== 40) falhas.push(`vestir de novo mudou a vida atual: ${p.hp}/${p.mhp}`);
    if (JSON.stringify(Cb.pecasDaCaca(p)) !== '{"amuleto":1,"machado":1}') falhas.push(`origem das peças da caçada: ${JSON.stringify(Cb.pecasDaCaca(p))}`);
    Cb.tiraProSaco(p, 'amuleto');
    if (JSON.stringify(Cb.pecasDaCaca(p)) !== '{"amuleto":1,"machado":1}') falhas.push(`o amuleto que já era do corpo ganhou origem: ${JSON.stringify(Cb.pecasDaCaca(p))}`);
    if (JSON.stringify(Cb.vestidasDaCaca(p)) !== '{"machado":1}') falhas.push(`na morte, a origem devia ser só a vestida do saco: ${JSON.stringify(Cb.vestidasDaCaca(p))}`);
    p.fora = 'morreu'; if (Cb.vesteDoSaco(p, 'amuleto')) falhas.push('vestiu depois de sair da caçada');
  } catch (e) { falhas.push('vestir na caçada quebrou no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  /* provisões das lojas: comprar tira do cofre e respeita o máximo; a caçada
     aplica poções e buffs do começo, o buff da provisão soma ao da habilidade
     e acaba no tempo; a comida é item: a compra vai para a mochila (se
     couber), sem comer não se regenera, comer tira da mochila e soma o tempo
     (a menor primeiro, nada passando do máximo), a regeneração é a da classe
     e para quando o tempo acaba, a comida volta com a mochila extraindo e
     cai com ela morrendo, o Banco a guarda no cofre (em mats), os animais a
     derrubam, e a comida da 0.29.0 (em prov) vai para o cofre; e só start()
     (o cliente) gasta o estoque */
  try {
    novoSave(); const sv = P.save; sv.cofre = 1000;
    const C0 = JSON.parse(CONTEUDO).supplies;
    if (!P.compra('pocao') || !P.compra('pocao') || sv.prov.pocao !== 2 || sv.cofre !== 1000 - 2 * C0.pocao.preco) falhas.push(`comprar duas poções: prov ${JSON.stringify(sv.prov)}, cofre ${sv.cofre}`);
    for (let i = 0; i < 9; i++) P.compra('pocao');
    if (sv.prov.pocao !== C0.pocao.max || P.podeComprar('pocao') !== 'max') falhas.push(`a poção passou do máximo: ${sv.prov.pocao}`);
    if (!P.compra('queijo') || !P.compra('presunto') || P.ch().mochila.queijo !== 1 || P.ch().mochila.presunto !== 1 || sv.prov.queijo || sv.prov.presunto) falhas.push(`a comida comprada não foi para a mochila: mochila ${JSON.stringify(P.ch().mochila)}, prov ${JSON.stringify(sv.prov)}`);
    const mo0 = P.ch().mochila; P.ch().mochila = {espada: JSON.parse(CONTEUDO).progression.mochila.espacos};
    if (P.podeComprar('frutas') !== 'cheia' || P.compra('frutas')) falhas.push('comprou comida com a mochila cheia');
    P.ch().mochila = mo0;
    const mig = P.normaliza({prov: {presunto: 2, pocao: 1}, mats: {presunto: 1}});
    if (mig.mats.presunto !== 3 || JSON.stringify(mig.prov) !== '{"pocao":1}') falhas.push(`a comida da 0.29.0 não foi para o cofre: ${JSON.stringify(mig.mats)}, prov ${JSON.stringify(mig.prov)}`);
    if (!JSON.parse(CONTEUDO).loot.rato.some(l => l[0] === 'queijo') || !JSON.parse(CONTEUDO).loot.leao.some(l => l[0] === 'carne')) falhas.push('os animais não derrubam comida');
    P.compra('runa_pedra'); P.compra('pressa');
    sv.cofre = 0; if (P.podeComprar('frutas') === '' ) falhas.push('comprou sem ouro');
    if (JSON.stringify(P.normaliza(JSON.parse(JSON.stringify(sv))).prov) !== JSON.stringify(sv.prov)) falhas.push('o save não guarda as provisões');
    if (P.normaliza({prov: {pocao: 99, sumiu: 2}}).prov.pocao !== C0.pocao.max || 'sumiu' in P.normaliza({prov: {sumiu: 2}}).prov) falhas.push('save com provisão demais ou inexistente não foi aparado');
    I.newRun(31); const p = I.G.p, K = JSON.parse(CONTEUDO).classes.feiticeiro;
    if (p.pot !== 3 + C0.pocao.max) falhas.push(`levou ${C0.pocao.max} poções e começou com ${p.pot}`);
    const IT = JSON.parse(CONTEUDO).items;
    if (p.bag.queijo !== 1 || p.bag.presunto !== 1 || p.ali !== 0 || I.nComida(p.bag) !== 2) falhas.push(`a comida não entrou na mochila ou ele não entrou com fome: ${JSON.stringify(p.bag)}, ${p.ali}`);
    if (!(Cb.bf('arm', p) === C0.runa_pedra.efeito.buff.arm && Cb.bf('velo', p) === C0.pressa.efeito.buff.velo)) falhas.push(`buffs do começo: arm ${Cb.bf('arm', p)}, velo ${Cb.bf('velo', p)}`);
    p.buffs.arm = {v: 0.4, left: 6};
    if (Math.abs(Cb.bf('arm', p) - 0.55) > 1e-9) falhas.push(`o Provocar trocou a runa em vez de somar: ${Cb.bf('arm', p)}`);
    delete p.buffs.arm; p.mp = 0; p.hp = p.mhp = 1e9;
    const PA = {x: 0, y: 0, held: [false, false, false, false]};
    I.G.active = true; I.passo(1, PA);
    if (p.mp !== 0) falhas.push(`com fome, a mana subiu ${p.mp} em 1 s`);
    Cb.comer(p);
    if (p.ali !== IT.queijo.comida || p.bag.queijo || p.bag.presunto !== 1) falhas.push(`comer devia comer o queijo, a menor, da mochila: ${p.ali}, ${JSON.stringify(p.bag)}`);
    I.passo(1, PA);
    if (!(p.mp >= 0.9 * K.rmp && p.mp <= 1.1 * K.rmp)) falhas.push(`alimentado, a mana subiu ${p.mp} em 1 s, esperado ${K.rmp} (o da classe)`);
    p.ali = JSON.parse(CONTEUDO).progression.comida.max - 100; p.cdCo = 0; Cb.comer(p);
    if (p.bag.presunto !== 1) falhas.push('comeu passando do máximo de alimentação');
    p.ali = 0.5; p.mp = 0; I.passo(2, PA);
    if (p.ali !== 0 || !(p.mp < K.rmp)) falhas.push(`a alimentação acabou e a regeneração seguiu: ali ${p.ali}, mana ${p.mp}`);
    for (let i = 0; i < 100; i++) I.passo(1, {x: 0, y: 0, held: [false, false, false, false]});
    if (Cb.bf('arm', p) || Cb.bf('velo', p)) falhas.push('os buffs da provisão não acabaram no tempo');
    if (sv.prov.pocao !== C0.pocao.max) falhas.push('newRun() gastou o estoque: quem gasta é o start() do cliente');
    P.gastaProv(p.prov);
    if (Object.keys(sv.prov).length) falhas.push(`depois da caçada sobrou no estoque: ${JSON.stringify(sv.prov)}`);
    I.sai(p, 'extraiu');
    if (P.ch().mochila.presunto !== 1) falhas.push(`extraindo, a comida que sobrou não ficou na mochila: ${JSON.stringify(P.ch().mochila)}`);
    I.newRun(32); I.G.active = true; I.sai(I.G.p, 'morreu');
    if (P.ch().mochila.presunto) falhas.push(`morrendo, a comida ficou na mochila: ${JSON.stringify(P.ch().mochila)}`);
    P.ch().mochila = {carne: 3, ouro: 5}; const gu = P.guardaMochila();
    if (sv.mats.carne !== 3 || Object.keys(P.ch().mochila).length) falhas.push(`o Banco não guardou a comida no cofre: ${JSON.stringify(sv.mats)}`);
    if (P.vender('carne') || !P.leva('carne') || P.ch().mochila.carne !== 3 || sv.mats.carne) falhas.push(`levar a comida do cofre (e não vendê-la): mochila ${JSON.stringify(P.ch().mochila)}, cofre ${JSON.stringify(sv.mats)}`);
    const f = P.confereFicha({cl: 'feiticeiro', c: {lvl: 3}, up: {}, prov: {pocao: 50, nada: 1}});
    if (!f || f.prov.pocao !== C0.pocao.max || 'nada' in f.prov) falhas.push(`a ficha de fora não aparou as provisões: ${f && JSON.stringify(f.prov)}`);
    /* aprender com o Mestre de magias: nível e ouro; save de antes fica com o que o nível liberava */
    novoSave(); const s2 = P.save; P.ch().lvl = 9; s2.cofre = 600;
    if (JSON.stringify(P.ch().sabe) !== '["faisca"]') falhas.push(`personagem novo devia saber só a Faísca: ${JSON.stringify(P.ch().sabe)}`);
    if (P.podeAprender('bolaenergia') !== 'nivel' || P.podeAprender('faisca') !== 'sabe' || P.podeAprender('gelo') !== 'sabe') falhas.push('aprender ignora nível, o que já sabe ou a classe');
    if (!P.aprende('ondafogo') || s2.cofre !== 100 || !P.ch().sabe.includes('ondafogo') || P.ch().slots[1] !== 'ondafogo') falhas.push(`aprender Onda de Fogo: cofre ${s2.cofre}, sabe ${JSON.stringify(P.ch().sabe)}, espaços ${JSON.stringify(P.ch().slots)}`);
    if (P.aprende('flam') || P.podeAprender('flam') !== 'ouro') falhas.push('aprendeu sem ouro');
    const velho = P.normaliza({classe: 'druida', chars: {druida: {lvl: 13, xp: 0, slots: ['gelo', 'exura', null, null]}}});
    if (velho.chars.druida.sabe.join() !== 'gelo,exura,tera,avalanche') falhas.push(`save de antes perdeu habilidade: ${velho.chars.druida.sabe}`);
    const f2 = P.confereFicha({cl: 'feiticeiro', c: {lvl: 9, slots: ['faisca', 'ondafogo', 'flam', null], sabe: ['faisca', 'flam', 'nucleo']}, up: {}});
    if (!f2 || f2.c.slots[1] !== null || f2.c.slots[2] !== 'flam' || f2.c.sabe.includes('nucleo')) falhas.push(`a ficha de fora usou habilidade que não sabe: ${f2 && JSON.stringify(f2.c)}`);
    const ruim2 = (f) => { const c = JSON.parse(CONTEUDO); f(c); try { carrega(c); return null; } catch (e) { return e.message; } finally { carrega(JSON.parse(CONTEUDO)); } };
    if (!ruim2((c) => { c.spells.faisca.preco = 10; })) falhas.push('classe sem habilidade grátis no nível 1 foi aceita');
    if (!ruim2((c) => { delete c.city.npcs.mago.ensina; })) falhas.push('habilidade com preço sem ninguém que ensine foi aceita');
  } catch (e) { falhas.push('as provisões quebraram no Node: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
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
    ok('a tela de entrada abriu', visivel('#menu'));
    ok('a tela de entrada é só a conta: sem Regras, Personagens nem personagem', visivel('#contaF')&&!$('#menu #toRegras')&&!$('#menu #toPick')&&!$('#mQuem')&&!$('#mRisco')&&!$('#menu .stats'));
    ok('sem conta, entra-se sem conta', txt('#play')==='Jogar sem conta', txt('#play'));
    ok('o Grimório não está na tela inicial, só na cidade', !$('#toGrim')&&!!$('#cGrim'));
    ok('trocar de personagem não existe na cidade', !$('#cPick'));
    var r0=$('#play').getBoundingClientRect();
    ok('Jogar aparece sem rolar a tela', r0.bottom<=innerHeight&&r0.top>=0, r0.top+'..'+r0.bottom+' de '+innerHeight);
    /* as regras: os números vêm do content.json, a versão e os créditos estão nelas */
    $('#play').click();
    ok('a tela seguinte é a escolha de personagem, com o cofre', visivel('#pick')&&txt('#sCofre')==='1000'&&txt('#sLvl')==='1', txt('#sCofre')+' / '+txt('#sLvl'));
    ok('o personagem mostra o preço da morte', txt('#pickList .cls.on .risco')==='Morrer custa a mochila (vazia) e nada de XP.', txt('#pickList .cls.on .risco'));
    var pk=$('#pick'),pl=$('#pickList');
    ok('a escolha de personagem cabe na tela, sem rolagem', pk.scrollHeight<=pk.clientHeight&&getComputedStyle(pl).overflowY==='visible', pk.scrollHeight+'/'+pk.clientHeight+' '+getComputedStyle(pl).overflowY);
    clica($('#toRegras'));
    ok('o botão Regras abre as regras', visivel('#regras')&&!visivel('#pick'));
    var CJ=await (await fetch('data/game/content.json')).json();
    ok('as regras dizem a perda de XP do content.json', txt('#rPerda')===String(Math.round(CJ.progression.xp.deathLoss*100)), txt('#rPerda'));
    ok('as regras dizem os espaços da mochila', txt('#rEsp')===String(CJ.progression.mochila.espacos), txt('#rEsp'));
    ok('as regras listam todo lugar de caça com o nível', todos('#rLugares li').length===Object.keys(CJ.hunts).filter(function(k){return k[0]!=='_'}).length&&/nível \\d+/.test(txt('#rLugares')), txt('#rLugares'));
    ok('as regras não falam do relógio que não existe mais', !/1:30|portal abre|o tempo acabar/.test(txt('#regras')), txt('#regras'));
    ok('as regras trazem a versão do jogo', /^Fibula · v\\d+\\.\\d+\\.\\d+$/.test(txt('#rVer')||''), txt('#rVer'));
    ok('as regras dão crédito ao OTSP com a licença', !!$('#regras a[href*="opentibia_sprite_pack"]')&&!!$('#regras a[href*="creativecommons.org/licenses/by/4.0"]'));
    clica($('#regrasBack'));
    ok('Voltar das regras volta à escolha de personagem', visivel('#pick'));
    clica($('#pickBack'));
    ok('Voltar da escolha de personagem volta à tela de entrada', visivel('#menu'));
    entrar();
    ok('tocar no personagem leva à cidade', $('#app').classList.contains('cidade')&&!visivel('#pick'));
    Tl.abreNpc('mercador');
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
    ok('a volta do Mercador é para a cidade', txt('#shopBack')==='Voltar à cidade', txt('#shopBack'));
    clica($('#shopBack'));
    ok('voltou à cidade', $('#app').classList.contains('cidade')&&!visivel('#shop'));
    await quadros(2);
    ok('a cidade mostra o cofre novo', txt('#cCofre')==='695', txt('#cCofre'));
    cacar();
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
    nome: 'cidade',
    o_que: 'a cidade abre pelo menu, o jogador anda até a casa do Mercador, o NPC fala e o botão abre a loja; o Guia leva à masmorra e a volta é pelo portão',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 250, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    ok('sem conta, o botão da tela de entrada é Jogar sem conta', txt('#play')==='Jogar sem conta', txt('#play'));
    entrar();
    await quadros(3);
    ok('a cidade abriu, sem nenhuma tela por cima', $('#app').classList.contains('cidade')&&todos('.screen').every(function(t){return t.hidden}));
    ok('o HUD da cidade mostra classe, nível e cofre', txt('#cCls')==='Feiticeiro'&&txt('#cLvl')==='Nv 1'&&txt('#cCofre')==='250', txt('#cCls')+' / '+txt('#cLvl')+' / '+txt('#cCofre'));
    ok('a chegada anuncia o nome da cidade', txt('#banner')==='Cidade', txt('#banner'));
    ok('ninguém ao alcance na chegada: sem botão de falar', $('#bFalar').hidden);
    ok('a chegada avisa onde está o Guia', /Guia/.test(txt('#log')||''), txt('#log'));
    /* do @ da praça até o Mercador: oeste pela rua principal, norte pela porta da casa */
    var x0=Cd.C.p.x,mc=Cd.C.npcs.filter(function(n){return n.k==='mercador'})[0],mx=mc.x/32|0,my=mc.y/32|0;
    tecla('keydown','KeyA');
    /* por sqm: o passo para a coluna da porta começa, solta a tecla e ele termina lá */
    var oeste=await ate(function(){return Cd.C.p.tx<=mx},400);
    tecla('keyup','KeyA');await ate(function(){return !Cd.C.p.mv},30);
    ok('anda para oeste pela rua', oeste&&Cd.C.p.x<x0, x0+' → '+Cd.C.p.x);
    tecla('keydown','KeyW');
    var chegou=await ate(function(){return !$('#bFalar').hidden},200);
    tecla('keyup','KeyW');
    ok('entrou pela porta e chegou ao Mercador', chegou&&Cd.C.perto==='mercador', Cd.C.perto+' em '+Math.round(Cd.C.p.x)+','+Math.round(Cd.C.p.y));
    ok('o botão diz com quem falar', txt('#falarT')==='Mercador', txt('#falarT'));
    ok('o botão de falar tem rótulo acessível', /^Falar com Mercador/.test($('#bFalar').getAttribute('aria-label')||''), $('#bFalar').getAttribute('aria-label'));
    ok('o Mercador falou no registro', /Mercador: /.test(txt('#log')||''), txt('#log'));
    tecla('keydown','KeyW');await quadros(10);tecla('keyup','KeyW');
    var y1=Cd.C.p.y;
    ok('o NPC é sólido: não se anda por cima dele', y1>=(my+1)*32, y1);
    tecla('keydown','Enter');tecla('keyup','Enter');
    ok('Enter ao lado do Mercador abre a loja', visivel('#shop'));
    clica($('#shopBack'));
    ok('a volta é para a cidade, no mesmo lugar', $('#app').classList.contains('cidade')&&Math.abs(Cd.C.p.y-y1)<8, Cd.C.p.y);
    clica($('#bFalar'));
    ok('o botão de falar abre a loja', visivel('#shop'));
    clica($('#shopBack'));
    Tl.abreNpc('banqueiro');
    ok('o Banqueiro abre o Banco', visivel('#equip')&&txt('#equip h2')==='Banco', txt('#equip h2'));
    clica($('#eqBack'));
    Tl.abreNpc('corretor');
    ok('o Corretor abre a Feira', visivel('#mkt')&&txt('#mkt h2')==='Feira', txt('#mkt h2'));
    ok('sem conta, a Feira pede para entrar e não negocia', /entre com uma conta/.test(txt('#mktMsg')||'')&&todos('#mktItens button').every(function(b){return b.disabled}), txt('#mktMsg'));
    clica($('#mktBack'));
    ok('o mapa da cidade aparece no canto', $('#cmini').width>0&&getComputedStyle($('#cmini')).display!=='none', $('#cmini').width);
    Tl.abreNpc('guia');
    ok('o Guia mostra os mapas de caça', visivel('#hunts')&&todos('#huntList li').length>=1, todos('#huntList li').length);
    ok('o mapa de caça diz o nível recomendado', /nível recomendado 1/.test(txt('#huntList .meta')||''), txt('#huntList .meta'));
    ok('o lugar de caça abre uma sala sua', txt('#huntList button')==='criar sala', txt('#huntList button'));
    clica($('#huntList button'));
    await quadros(3);
    ok('o Guia leva à masmorra, numa sala sem tempo', $('#app').classList.contains('playing')&&!$('#app').classList.contains('cidade')&&I.G.sala&&I.G.aberta&&Sa.SALA.papel==='anfitriao', Sa.SALA.papel);
    ok('a incursão contou no save', sv()&&sv().runs===1, sv()&&sv().runs);
    ok('na masmorra o botão de falar some', getComputedStyle($('#bFalar')).display==='none'||$('#bFalar').offsetParent===null);
    clica($('#toMenu'));
    await quadros(3);
    var g=Cd.C.npcs.filter(function(n){return n.k==='guia'})[0];
    ok('a volta da incursão é pelo portão, ao lado do Guia', $('#app').classList.contains('cidade')&&Cd.C.perto==='guia', Cd.C.perto+' em '+Math.round(Cd.C.p.x)+','+Math.round(Cd.C.p.y)+' / guia '+g.x+','+g.y);
    clica($('#cMenu'));
    ok('o botão Menu da cidade abre a escolha de personagem', visivel('#pick')&&!$('#app').classList.contains('cidade'));
`,
  },
  {
    nome: 'mapas-de-caca',
    o_que: 'os outros mapas de caça: a Grade do esgoto, na rua, leva ao Esgoto, o Capitão à Ilha, o Guia à Masmorra e à Cripta; cada um com os monstros dele e a volta ao lado de quem levou; a sala é de um mapa, e a porta dela fica com quem leva até lá',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    var RT=window.__rt,nomes=function(){return todos('#huntList h3').map(function(h){return h.textContent}).join(', ')};
    entrar();
    await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    Tl.abreNpc('guia');
    ok('o Guia leva à Masmorra de Runas e à Cripta', nomes()==='Masmorra de Runas, Cripta Antiga'&&txt('#hunts h2')==='Guia de caça', nomes());
    ok('cada lugar diz o que mora lá', /Guardião do Portal/.test(txt('#huntList')||'')&&/Senhora das Sombras/.test(txt('#huntList')||''), txt('#huntList .meta'));
    clica($('#huntBack'));
    var gr=Cd.C.npcs.filter(function(n){return n.k==='grade'})[0];
    ok('a grade do esgoto fica no chão: não bloqueia o caminho', gr&&!Cd.C.sol[(gr.y/32|0)*Cd.C.w+(gr.x/32|0)], gr&&JSON.stringify({x:gr.x,y:gr.y}));
    Tl.abreNpc('grade');
    ok('a Grade do esgoto leva ao Esgoto', nomes()==='Esgoto'&&txt('#hunts h2')==='Grade do esgoto'&&txt('#hunts .eyebrow')==='Rua do mercado', nomes()+' / '+txt('#hunts h2'));
    ok('fora de sala, o lugar só oferece criar a sua', todos('#huntList button').length===1&&txt('#huntList button')==='criar sala', txt('#huntList'));
    clica($('#huntList button'));await quadros(3);
    ok('criar sala no lugar já entra pela porta, sem tempo', Sa.SALA.papel==='anfitriao'&&Sa.SALA.caca==='esgoto'&&I.G.aberta&&I.G.p===I.G.ps[0]&&!I.G.p.fora&&$('#app').classList.contains('playing'), Sa.SALA.caca+' / '+(I.G.p&&I.G.p.fora));
    var tipos=I.G.mons.map(function(m){return m.k});
    ok('o Esgoto tem os bichos dele e a Centopeia-rainha', I.G.caca==='esgoto'&&tipos.indexOf('centopeia')>=0&&tipos.indexOf('orc')<0&&tipos.indexOf('guardiao')<0, I.G.caca+' / '+tipos.join());
    ok('a chegada é pela grade, e não promete relógio', /grade do esgoto/.test(txt('#log')||'')&&!/1:30/.test(txt('#log')||''), txt('#log'));
    I.finish('desabou');await ate(function(){return visivel('#end')},200);
    clica($('#toMenu'));await quadros(3);Sa.saiDaSala();
    ok('a volta do Esgoto é em cima da grade', Cd.C.perto==='grade'&&Cd.C.p.tx===(gr.x/32|0)&&Cd.C.p.ty===(gr.y/32|0)&&/subiu pela grade/.test(txt('#log')||''), Cd.C.perto+' / '+txt('#log'));
    ok('o botão diz Descer, não Falar', txt('#bFalar .nm')==='Descer'&&/^Descer: Grade do esgoto/.test($('#bFalar').getAttribute('aria-label')||''), txt('#bFalar .nm')+' / '+$('#bFalar').getAttribute('aria-label'));
    Tl.abreNpc('capitao');
    ok('o Capitão leva à Ilha da Enseada, acima do nível', nomes()==='Ilha da Enseada'&&/acima do seu/.test(txt('#huntList .meta')||''), nomes());
    /* a sala parada na cidade, sem entrar: o botão do lugar cria e entra */
    Sa.criaSala('ilha');Tl.abreNpc('capitao');var ligou=await ate(function(){return Sa.SALA.estado==='ligado'},40);
    ok('a sala criada no Capitão é da Ilha', ligou&&Sa.SALA.caca==='ilha'&&I.G.caca==='ilha'&&I.G.aberta, Sa.SALA.caca+' / '+(I.G&&I.G.caca));
    var anunc=RT.enviadas.filter(function(d){return d.event==='presence'&&d.topic.indexOf('realtime:cidade-')===0&&d.payload.payload.sala}).pop();
    ok('a sala anuncia o mapa dela na cidade', anunc&&anunc.payload.payload.sala.h==='ilha', anunc&&JSON.stringify(anunc.payload.payload.sala));
    ok('o Capitão mostra a sala e a porta dela', /Ilha da Enseada/.test(txt('#hSala')||'')&&todos('#hSala button').some(function(b){return b.textContent==='Entrar pela porta'&&!b.disabled}), txt('#hSala'));
    clica($('#huntBack'));Tl.abreNpc('guia');
    var porta=todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0];
    ok('no Guia, a porta da sala da Ilha fica fechada e ele diz onde ela está', porta&&porta.disabled&&/Capitão/.test(txt('#hSala')||''), txt('#hSala'));
    clica(todos('#hSala button').filter(function(b){return b.textContent==='Fechar sala'})[0]);await quadros(3);
    ok('fechar a sala volta tudo ao normal', Sa.SALA.papel===null&&Sa.SALA.caca===null, Sa.SALA.papel);
    clica($('#huntBack'));Tl.abreNpc('capitao');clica($('#huntList button'));await quadros(3);
    ok('a Ilha tem os bichos dela e o dragão', I.G.caca==='ilha'&&I.G.mons.some(function(m){return m.k==='dragao'})&&/navio/.test(txt('#log')||''), I.G.caca+' / '+txt('#log'));
    await quadros(20);
    I.finish('morreu');await ate(function(){return visivel('#end')},200);
    clica($('#toMenu'));await quadros(3);
    ok('o navio traz de volta ao porto, ao lado do Capitão', Cd.C.perto==='capitao'&&/navio/.test(txt('#log')||''), Cd.C.perto+' / '+txt('#log'));
    `,
  },
  {
    nome: 'sala-anfitriao',
    o_que: 'caçar junto, lado do anfitrião: a sala nasce com a masmorra dela, sem tempo; o convidado entra e sai pela porta quando quer e volta a entrar; o anfitrião também; a sala some da cidade só quando ele fecha sozinho, e com gente ela passa ao convidado mais antigo',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    var RT=window.__rt,BIA={nome:'Bia',cl:'druida',c:{lvl:2,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:['gelo',null,null,null],equip:{}},up:{}};
    var parado=function(){return {x:0,y:0,held:[false,false,false,false]}};
    entrar();
    await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    Tl.abreNpc('guia');
    var criar=todos('#huntList button').filter(function(b){return b.textContent==='criar sala'})[0];
    ok('o Guia de caça oferece criar sala em cada lugar', !!criar&&!criar.disabled, txt('#huntList'));
    /* criar sem entrar, para ver a sala parada no Guia (o botão cria e entra) */
    Sa.criaSala();Tl.abreNpc('guia');
    var ligou=await ate(function(){return Sa.SALA.estado==='ligado'},40);
    var join=RT.enviadas.filter(function(d){return d.event==='phx_join'&&d.topic.indexOf('realtime:sala-')===0})[0];
    ok('criar sala abre o canal da sala, com o id deste aparelho', ligou&&join&&join.topic.split('-').pop()===Sa.SALA.id, join&&join.topic);
    ok('a masmorra da sala nasce com ela, sem tempo e vazia', I.G&&I.G.sala&&I.G.aberta&&I.G.active&&I.G.ps[0].fora==='fora'&&I.G.portal.open, I.G&&JSON.stringify({ab:I.G.aberta,f:I.G.ps[0].fora}));
    var anunc=RT.enviadas.filter(function(d){return d.event==='presence'&&d.topic.indexOf('realtime:cidade-')===0&&d.payload.payload.sala}).pop();
    ok('a sala é anunciada na cidade, para os outros verem no Guia', anunc&&anunc.payload.payload.sala.n===1, anunc&&JSON.stringify(anunc.payload.payload));
    ok('dentro da sala, o lugar do Guia leva pela porta dela', txt('#huntList button')==='pela porta', txt('#huntList button'));
    RT.sala('quero',{id:'conv1',ficha:BIA});
    var entrou=await ate(function(){return Sa.SALA.membros.length===2},20);
    ok('o convidado fica na sala, e o Guia mostra quem está nela', entrou&&/Bia/.test(txt('#hSala')||''), txt('#hSala'));
    RT.sala('quero',{id:'mal',ficha:{nome:'Mal',cl:'dragao',c:{lvl:99}}});await quadros(3);
    ok('ficha de classe que não existe é recusada', Sa.SALA.membros.length===2, Sa.SALA.membros.length);
    RT.sala('entro',{id:'conv1',ficha:BIA});await quadros(3);
    var pt=RT.salaMandadas('porta')[0],q=I.G.ps[1];
    ok('o convidado entra pela porta: a sala responde com a semente e o lugar dele', pt&&pt.id==='conv1'&&pt.i===1&&pt.semente===I.G.semente&&q&&!q.fora&&q.cl==='druida'&&!q.local, pt&&JSON.stringify({i:pt.i,s:pt.semente}));
    RT.sala('entro',{id:'estranho',ficha:BIA});await quadros(2);
    ok('quem não está na sala não entra pela porta', RT.salaMandadas('porta').length===1&&I.G.ps.length===2, RT.salaMandadas('porta').length);
    var tx0=q.tx,e0=RT.salaMandadas('estado').length,t0=I.G.t;
    var lado=!I.solid(q.tx,q.ty+1)&&!I.solid(q.tx,q.ty+2)?1:-1;
    RT.sala('ent',{id:'conv1',x:q.tx,y:q.ty+lado,f:0,h:0,pot:0});await quadros(4);
    RT.sala('ent',{id:'conv1',x:q.tx,y:q.ty+2*lado,f:0,h:0,pot:0});
    var ty0=q.ty,chegou=await ate(function(){return q.ty===ty0+2*lado&&!q.sd},80);
    ok('o anfitrião leva o convidado até o sqm que ele conta', chegou, ty0+' → '+q.ty);
    var ne=RT.salaMandadas('estado').length-e0,dtj=I.G.t-t0;
    ok('com convidado dentro, o retrato vai a uns 10 por segundo', ne>=Math.floor(dtj/0.1)-1&&ne<=Math.ceil(dtj/0.1)+1, ne+' em '+dtj.toFixed(2)+' s');
    var r=RT.salaMandadas('estado').pop();
    ok('o retrato tem os monstros e quem está na sala, com classe e nome', r&&r.m.length===I.G.mons.length*10&&r.ps.length===2&&r.ps[1].cl==='druida'&&r.ps[1].nome==='Bia', r&&(r.m.length/10)+' / '+I.G.mons.length);
    var xa=q.tx;RT.sala('ent',{id:'conv1',x:q.tx+40,y:q.ty,f:0,h:0,pot:0});await quadros(2);
    ok('posição de fora não teletransporta: um sqm por passo', Math.abs(q.tx-xa)<=1, xa+' → '+q.tx);
    RT.sala('ent',{id:'conv1',x:q.tx,y:q.ty,f:0,h:0,pot:0});await ate(function(){return !q.sd},40);
    q.hp=10;var pots=q.pot;RT.sala('ent',{id:'conv1',x:q.tx,y:q.ty,f:0,h:0,pot:1});await quadros(2);
    ok('a poção do convidado é bebida pelo anfitrião', q.pot===pots-1&&q.hp>10, pots+' → '+q.pot+', vida '+q.hp);
    q.bag.frutas=2;q.ali=0;RT.sala('ent',{id:'conv1',x:q.tx,y:q.ty,f:0,h:0,pot:1,com:1});await quadros(3);
    var rc=RT.salaMandadas('estado').pop().ps[1];
    ok('a comida do convidado é comida pelo anfitrião, e o retrato conta a alimentação', q.bag.frutas===1&&q.ali>85&&rc.nc===1&&rc.ali>85, JSON.stringify({bag:q.bag,ali:q.ali,r:[rc.nc,rc.ali]}));
    I.G.t=400;await quadros(3);
    ok('a masmorra da sala não desaba: passou do tempo da solo e segue aberta', !I.G.over&&!q.fora&&I.G.active, I.G.t.toFixed(0)+' / '+q.fora);
    q.bag={ouro:12};q.bagVal=12;I.sai(q,'morreu');await quadros(1);
    var fim=RT.salaMandadas('fim')[0];
    ok('quem sai recebe o resultado dele, e a masmorra continua', fim&&fim.id==='conv1'&&fim.r.fora==='morreu'&&fim.r.bagVal===12&&!I.G.over, fim&&JSON.stringify(fim.r).slice(0,80));
    ok('a conta deste aparelho não mudou com a morte do convidado', Pg.save.deaths===0, Pg.save.deaths);
    RT.sala('entro',{id:'conv1',ficha:BIA});await quadros(3);
    I.G.ps[1].mhp=I.G.ps[1].hp=1e6;
    ok('quem saiu volta a entrar pela porta, com o saco vazio e no mesmo lugar da lista', RT.salaMandadas('porta').length===2&&I.G.ps.length===2&&!I.G.ps[1].fora&&I.G.ps[1].bagVal===0, I.G.ps.length+' / '+I.G.ps[1].fora);
    var porta=todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0];
    ok('o Guia oferece entrar pela porta', porta&&!porta.disabled, txt('#hSala'));
    var est0=Sa.SALA.estado;Sa.SALA.estado='sem rede';Tl.abreNpc('guia');
    var semCanal=todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0];
    ok('sem o canal da sala, o anfitrião ainda entra: a masmorra roda no aparelho dele', semCanal&&!semCanal.disabled&&/Sem conexão com a sala/.test(txt('#hSala')||''), txt('#hSala'));
    Sa.SALA.estado=est0;Tl.abreNpc('guia');porta=todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0];
    clica(porta);await quadros(3);
    ok('o anfitrião entra na masmorra que o aparelho dele já roda', $('#app').classList.contains('playing')&&I.G.p===I.G.ps[0]&&!I.G.ps[0].fora&&I.G.ps.length===2, I.G.ps[0].fora);
    ok('o HUD diz que não há tempo', txt('#timeT')==='sem tempo'&&/Porta/.test(txt('#portalT')||''), txt('#timeT')+' / '+txt('#portalT'));
    var h=I.G.p;h.bag={espada:1};h.bagVal=20;clica($('#bMochila'));clica(todos('#moGrade .cel:not(:disabled)')[0]);
    ok('na sala, o anfitrião veste do saco pela Mochila', /^(Vestir|Trocar)$/.test(txt('#moAcoes button')||''), txt('#moAcoes'));
    clica($('#moAcoes button'));
    ok('a espada saiu do saco e foi para o corpo', Pg.ch().equip.arma==='espada'&&!h.bag.espada, JSON.stringify(Pg.ch().equip));
    clica($('#moX'));
    var longe=RT.enviadas.filter(function(d){return d.event==='presence'&&d.topic.indexOf('realtime:cidade-')===0}).pop();
    ok('na masmorra, a sala continua anunciada na cidade, sem boneco', RT.vivos.some(function(w){return String(w.topico).indexOf('realtime:cidade-')===0})&&longe&&longe.payload.payload.longe&&longe.payload.payload.sala, longe&&JSON.stringify(longe.payload.payload));
    var a=I.G.ps[0],sai0=RT.salaMandadas('fim').length;
    ok('quem acabou de entrar não sai sem querer: está na porta', (await quadros(70),!a.fora), a.pch);
    a.longe=true;a.bag={ouro:30};a.bagVal=30;
    await ate(function(){return a.fora==='extraiu'},120);await ate(function(){return visivel('#end')},400);
    ok('o anfitrião sai pela porta com a mochila: tela final, e nada vai sozinho para o cofre', a.fora==='extraiu'&&visivel('#end')&&Pg.save.cofre===0&&Pg.ch().mochila.ouro===30, txt('#endTitle')+' / '+Pg.save.cofre+' / '+JSON.stringify(Pg.ch().mochila));
    ok('sair não fecha a masmorra para quem ficou', !I.G.over&&!I.G.ps[1].fora, I.G.over);
    clica($('#toMenu'));var t1=I.G.t;await quadros(6);
    ok('na cidade, o aparelho do anfitrião continua rodando a masmorra', I.G.t>t1&&$('#app').classList.contains('cidade'), t1+' → '+I.G.t);
    RT.salaSai('conv1');await quadros(3);
    ok('quem fecha o jogo lá dentro some da masmorra e da sala', Sa.SALA.membros.length===1&&I.G.ps[1].fora==='fora', Sa.SALA.membros.length+' / '+I.G.ps[1].fora);
    Tl.abreNpc('guia');
    var fecha=todos('#hSala button').filter(function(b){return b.textContent==='Fechar sala'})[0];clica(fecha);await quadros(3);
    ok('fechar a sala acaba com a masmorra e desliga o canal dela', RT.salaMandadas('fecha').length===1&&Sa.SALA.papel===null&&I.G.over&&!RT.vivos.some(function(w){return String(w.topico).indexOf('realtime:sala-')===0}), RT.salaMandadas('fecha').length);
    ok('o Guia volta a oferecer criar sala em cada lugar', todos('#huntList button').every(function(b){return b.textContent==='criar sala'&&!b.disabled}), txt('#huntList'));
    var id1=join.topic.split('-').pop();
    Sa.criaSala();await ate(function(){return Sa.SALA.estado==='ligado'},40);
    ok('a sala nova tem canal novo: quem passou a velha adiante não cai nela', Sa.SALA.id&&Sa.SALA.id!==id1, id1+' / '+Sa.SALA.id);
    var sem2=I.G.semente,anf2=Sa.SALA.anf;
    RT.sala('quero',{id:'conv2',ficha:BIA});await quadros(2);RT.sala('quero',{id:'conv3',ficha:Object.assign({},BIA,{nome:'Caio'})});
    await ate(function(){return Sa.SALA.membros.length===3},20);
    RT.sala('membros',{anf:'zz',gen:0,lista:[{id:'zz',nome:'Zé',cl:'druida',lvl:1}]});await quadros(3);
    ok('outro que se diz anfitrião, na mesma geração e de id maior, não leva a sala', Sa.SALA.papel==='anfitriao'&&Sa.SALA.anf===Sa.SALA.membros[0].id, Sa.SALA.papel);
    Tl.abreNpc('guia');var sair=todos('#hSala button').filter(function(b){return b.textContent==='Sair da sala'})[0];
    ok('com gente na sala, o anfitrião sai em vez de fechar', sair&&!todos('#hSala button').some(function(b){return b.textContent==='Fechar sala'})&&/Bia vira o anfitrião/.test(txt('#hSala')||''), txt('#hSala'));
    clica(sair);await quadros(3);
    var ps=RT.salaMandadas('passa')[0];
    ok('sair passa a sala ao convidado mais antigo, com a geração seguinte', ps&&ps.anf==='conv2'&&ps.gen===1&&ps.lista.length===2&&ps.lista[0].id==='conv2'&&ps.lista[1].id==='conv3', ps&&JSON.stringify(ps).slice(0,120));
    ok('e leva a herança da masmorra, para ela continuar no aparelho dele', ps&&ps.her&&ps.her.anf===anf2&&ps.her.h&&ps.her.h.semente===sem2&&ps.her.ids[0]&&Array.isArray(ps.her.h.mons), ps&&ps.her&&JSON.stringify(ps.her.ids));
    ok('e quem saiu fica fora da sala, com a masmorra dele acabada', Sa.SALA.papel===null&&I.G.over&&RT.salaMandadas('fecha').length===1, Sa.SALA.papel);
    `,
  },
  {
    nome: 'sala-convidado',
    o_que: 'caçar junto, lado do convidado: vê a sala no Guia, entra nela, entra pela porta quando quer, desenha o retrato, anda no próprio aparelho, grava o resultado, entra de novo, e, se o anfitrião sai ou some, a sala e a masmorra passam ao mais antigo pela herança, sem ninguém sair dela',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'druida',
      chars: {druida: {lvl: 2, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['gelo', null, null, null]}},
    }},
    roteiro: `
    var RT=window.__rt,ANA={nome:'Ana',cl:'cavaleiro',c:{lvl:5,equip:{}},up:{}};
    entrar();
    await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    RT.entra('anf1',{nome:'Ana',classe:'cavaleiro',lvl:5,sala:{n:1},longe:true});await quadros(3);
    ok('a sala de quem está na masmorra dela aparece no Guia, sem boneco na cidade', Cd.OUTROS.size===0, Cd.OUTROS.size);
    Tl.abreNpc('guia');
    var entrar=todos('#hSala li button')[0];
    ok('o Guia lista a sala aberta', entrar&&/Sala de Ana/.test(txt('#hSala')||''), txt('#hSala'));
    clica(entrar);
    await ate(function(){return RT.salaMandadas('quero').length>0},40);
    var qr=RT.salaMandadas('quero')[0],EU=qr&&qr.id;
    ok('entrar na sala manda a ficha', qr&&qr.ficha.cl==='druida'&&qr.ficha.c.lvl===2, qr&&JSON.stringify(qr.ficha).slice(0,80));
    RT.sala('membros',{lista:[{id:'anf1',nome:'Ana',cl:'cavaleiro',lvl:5,d:1},{id:EU,nome:'Druida',cl:'druida',lvl:2,d:0}]});await quadros(3);
    ok('o convidado vê quem está na sala e quem está na masmorra', /Sala de Ana · Masmorra de Runas · 2\\/4/.test(txt('#hSala')||'')&&/Ana .*lá dentro/.test(txt('#hSala')||''), txt('#hSala'));
    var porta=todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0];
    ok('a porta está aberta para ele', porta&&!porta.disabled, txt('#hSala'));
    clica(porta);await quadros(3);
    var en=RT.salaMandadas('entro')[0];
    ok('entrar pela porta pede ao anfitrião, com a ficha', en&&en.id===EU&&en.ficha.cl==='druida', en&&JSON.stringify(en).slice(0,60));
    RT.sala('porta',{id:EU,i:1,semente:77,ps:[ANA,{nome:'Druida',cl:'druida',c:{lvl:2,equip:{}},up:{}}]});
    var foi=await ate(function(){return I.G&&I.G.convidado&&$('#app').classList.contains('playing')},20);await quadros(2);
    ok('a porta abre e ele entra na masmorra da sala, sem tempo', foi&&I.G.semente===77&&I.G.aberta&&I.G.p===I.G.ps[1]&&txt('#timeT')==='sem tempo', I.G&&I.G.semente);
    var lon=I.G.rooms.reduce(function(a,b){return Math.hypot(b.cx-I.G.p.tx,b.cy-I.G.p.ty)>Math.hypot(a.cx-I.G.p.tx,a.cy-I.G.p.ty)?b:a});
    var r=I.retrato();r.m[2]+=40;r.ps[0].x+=20;r.ps[1].x=lon.cx*32+16;r.ps[1].y=lon.cy*32+16;r.ps[1].tx=lon.cx;r.ps[1].ty=lon.cy;r.t=12.5;r.ps[1].bag={queijo:2,ouro:7,nada:3};r.ps[1].bv=23;r.ps[0].bag={coroa:1};var m0=I.G.mons[0],xa=I.G.ps[0].x;
    r.ps.push({cl:'feiticeiro',nome:'Caio',eq:{},x:r.ps[0].x,y:r.ps[0].y,tx:r.ps[0].tx,ty:r.ps[0].ty,hp:50,mhp:50,mp:10,mmp:10,f:0,mv:0,fl:0,sw:0,fora:null,pch:0,bv:0,pot:3,cdC:0,cds:{},gcd:{},arm:0,c:[1,0,0,10]});
    for(var k=0;k<3;k++){RT.sala('estado',r);await quadros(2)}
    ok('o retrato do anfitrião move os monstros e o anfitrião', I.G.mons[0].id===m0.id&&Math.abs(I.G.mons[0].x-(Math.round(m0.x)+40))<1&&Math.abs(I.G.ps[0].x-(Math.round(xa)+20))<1, I.G.mons[0].x+' / '+I.G.ps[0].x);
    ok('a mochila do convidado vem no retrato (o loot que o anfitrião contou), e só a dele', I.G.p.bag.queijo===2&&I.G.p.bag.ouro===7&&!I.G.p.bag.nada&&!I.G.ps[0].bag.coroa, JSON.stringify(I.G.p.bag));
    ok('quem entrou depois aparece, com nome e classe', I.G.ps.length===3&&I.G.ps[2].nome==='Caio'&&I.G.ps[2].cl==='feiticeiro'&&!I.G.ps[2].fora, I.G.ps.length);
    ok('longe demais, o convidado volta para onde o anfitrião o vê', I.G.p.tx===lon.cx&&I.G.p.ty===lon.cy, I.G.p.tx+','+I.G.p.ty+' / '+lon.cx+','+lon.cy);
    var n0=RT.salaMandadas('ent').length,x0=I.G.p.x,rt0=I.G.rT;
    var tec=I.solid(I.G.p.tx+1,I.G.p.ty)||I.solid(I.G.p.tx+2,I.G.p.ty)?'KeyA':'KeyD';
    tecla('keydown',tec);await quadros(6);
    var antes=I.G.p.tx,xA=I.G.p.x,rtA=I.G.rT,r2=I.retrato();r2.ps[1].tx=antes+(tec==='KeyD'?-1:1);r2.ps[1].x=r2.ps[1].tx*32+16;r2.ps[1].mv=1;RT.sala('estado',r2);await quadros(1);
    ok('o retrato não puxa de volta quem está andando no próprio aparelho', tec==='KeyD'?I.G.p.x>=xA-.5:I.G.p.x<=xA+.5, xA+' → '+I.G.p.x);
    await quadros(4);tecla('keyup',tec);await quadros(8);
    var ents=RT.salaMandadas('ent').slice(n0),ult=ents[ents.length-1];
    ok('o convidado anda no próprio aparelho e conta o sqm', Math.abs(I.G.p.x-x0)>20&&ult&&ult.x===I.G.p.tx&&ult.y===I.G.p.ty&&ult.id===EU, x0+' → '+I.G.p.x+' / sqm '+(ult&&ult.x)+' de '+I.G.p.tx);
    var dtj=(rtA-rt0)+I.G.rT;
    ok('manda a entrada a uns 10 por segundo', ents.length>=Math.floor(dtj/0.1)-1&&ents.length<=Math.ceil(dtj/0.1)+1, ents.length+' em '+dtj.toFixed(2)+' s');
    tecla('keydown','KeyP');tecla('keyup','KeyP');await quadros(4);
    ok('a poção vira pedido ao anfitrião', RT.salaMandadas('ent').pop().pot===1, RT.salaMandadas('ent').pop().pot);
    tecla('keydown','KeyC');tecla('keyup','KeyC');await quadros(4);
    ok('comer vira pedido ao anfitrião', RT.salaMandadas('ent').pop().com===1, RT.salaMandadas('ent').pop().com);
    RT.sala('fim',{id:EU,r:{fora:'extraiu',bag:{ouro:40,inexistente:9,carne:2},bagVal:52,sealed:0,xpPerdido:0,kills:3,xpGain:90,magGain:1,perGain:0,c:{lvl:3,xp:15,mag:1,manaG:10,per:10,golpes:0,slots:['gelo','golpe',null,null]}}});
    await ate(function(){return visivel('#end')},400);
    ok('o resultado do anfitrião vira a tela final', visivel('#end')&&txt('#endTitle')==='Extraído!', txt('#endTitle'));
    var s=sv(),c=s&&s.chars.druida;
    ok('e vai para o save deste aparelho: mochila, extração e o personagem', s&&s.cofre===0&&c.mochila.ouro===40&&s.ext===1&&c.lvl===3&&c.xp===15&&c.mag===1, s&&JSON.stringify({cofre:s.cofre,mochila:c.mochila,ext:s.ext,lvl:c.lvl,xp:c.xp}));
    ok('item que não existe e habilidade de outra classe não entram', !c.mochila.inexistente&&c.slots[1]===null, JSON.stringify(c.slots));
    ok('a comida que sobrou volta na mochila', c.mochila.carne===2, JSON.stringify(c.mochila));
    clica($('#toMenu'));Tl.abreNpc('guia');
    ok('depois de sair, continua na sala, com a porta aberta', Sa.SALA.papel==='convidado'&&todos('#hSala button').some(function(b){return b.textContent==='Entrar pela porta'&&!b.disabled}), txt('#hSala'));
    clica(todos('#hSala button').filter(function(b){return b.textContent==='Entrar pela porta'})[0]);await quadros(2);
    ok('pode entrar de novo pela porta', RT.salaMandadas('entro').length===2, RT.salaMandadas('entro').length);
    var CAIO={id:'caio',nome:'Caio',cl:'feiticeiro',lvl:4,d:0},MIM={id:EU,nome:'Druida',cl:'druida',lvl:3,d:1};
    RT.sala('membros',{anf:'anf1',gen:0,s:77,lista:[{id:'anf1',nome:'Ana',cl:'cavaleiro',lvl:5,d:1},CAIO,MIM]});
    RT.sala('porta',{id:EU,i:1,semente:77,ps:[ANA,{nome:'Druida',cl:'druida',c:{lvl:3,equip:{}},up:{}}]});
    await ate(function(){return I.G&&I.G.active&&!I.G.over&&I.G.convidado},20);await quadros(3);
    /* a herança que o anfitrião mandaria: o estado da masmorra, com marcas
       para conferir que foi ela que o novo anfitrião adotou */
    var HER=I.heranca();HER.kills=42;HER.mons[0].hp=7;HER.ps[0].fora='fora';
    RT.sala('heranca',{anf:'anf1',ids:['anf1',EU],pot:[0,0],h:HER});await quadros(1);
    RT.sala('passa',{anf:'caio',gen:1,lista:[CAIO,MIM],her:{anf:'anf1',ids:['anf1',EU],pot:[0,0],h:HER}});await quadros(4);
    ok('o anfitrião sai e o mais antigo assume, e quem está na masmorra continua nela', $('#app').classList.contains('playing')&&I.G.convidado&&!I.G.over&&/Caio agora é o anfitrião/.test(txt('#log')||'')&&Sa.SALA.papel==='convidado'&&Sa.SALA.anf==='caio'&&Sa.SALA.gen===1&&Sa.SALA.id==='anf1', txt('#log'));
    RT.sala('membros',{anf:'anf1',gen:0,s:77,lista:[{id:'anf1',nome:'Ana',cl:'cavaleiro',lvl:5},MIM]});await quadros(3);
    ok('a lista do anfitrião velho não vale mais', Sa.SALA.anf==='caio'&&Sa.SALA.membros[0].id==='caio', Sa.SALA.anf);
    RT.sala('heranca',{anf:'caio',ids:['anf1',EU,'caio'],pot:[0,1,0],h:HER});await quadros(1);
    var tx=I.G.p.tx,ty=I.G.p.ty,eAntes=RT.salaMandadas('estado').length;
    RT.salaSai('caio');await quadros(3);
    ok('se o novo anfitrião some da rede, quem sobrou assume a mesma masmorra, sem sair dela', Sa.SALA.papel==='anfitriao'&&Sa.SALA.anf===EU&&Sa.SALA.gen===2&&Sa.SALA.id==='anf1'&&$('#app').classList.contains('playing')&&!I.G.convidado&&I.G.active&&!I.G.over&&I.G.semente===77, JSON.stringify({p:Sa.SALA.papel,a:Sa.SALA.anf,g:Sa.SALA.gen,s:I.G.semente,c:I.G.convidado}));
    ok('a masmorra é a da herança: abates, monstros, e ele no mesmo lugar e no sqm em que estava', I.G.kills===42&&I.G.mons[0].hp===7&&I.G.p===I.G.ps[1]&&I.G.p.local&&I.G.p.tx===tx&&I.G.p.ty===ty&&/a masmorra continua/.test(txt('#log')||''), JSON.stringify({k:I.G.kills,hp:I.G.mons[0].hp,tx:I.G.p.tx,ty:I.G.p.ty}));
    var t2=I.G.t;await quadros(6);
    ok('e a regra passa a rodar neste aparelho', I.G.t>t2+.2, t2+' → '+I.G.t);
    var mb=RT.salaMandadas('membros').pop();
    ok('avisa a sala com a geração nova e a mesma semente', mb&&mb.anf===EU&&mb.gen===2&&mb.s===77, mb&&JSON.stringify(mb).slice(0,80));
    var an=await ate(function(){var a=RT.enviadas.filter(function(d){return d.event==='presence'&&d.topic.indexOf('realtime:cidade-')===0&&d.payload.payload.sala}).pop();return a&&a.payload.payload.sala.id==='anf1'},60);
    ok('a sala segue anunciada na cidade, no canal de sempre', an, RT.enviadas.filter(function(d){return d.event==='presence'&&d.topic.indexOf('realtime:cidade-')===0}).map(function(d){return JSON.stringify(d.payload.payload.sala)}).join(' '));
    RT.sala('quero',{id:'novo',ficha:{nome:'Duda',cl:'cacador',c:{lvl:2},up:{}}});await quadros(2);
    RT.sala('entro',{id:'novo',ficha:{nome:'Duda',cl:'cacador',c:{lvl:2},up:{}}});await quadros(3);
    var pt=RT.salaMandadas('porta').pop();
    ok('quem chega depois entra pela porta na masmorra herdada', pt&&pt.id==='novo'&&pt.semente===77&&pt.i===2&&I.G.ps[2]&&!I.G.ps[2].fora, pt&&JSON.stringify({i:pt.i,s:pt.semente}));
    await ate(function(){var h=RT.salaMandadas('heranca').pop();return h&&h.ids[2]==='novo'},60);
    var hr=RT.salaMandadas('heranca').pop();
    ok('e o novo anfitrião passa a mandar a herança, com quem é quem', hr&&hr.anf===EU&&hr.ids[1]===EU&&hr.ids[2]==='novo'&&hr.h.semente===77&&hr.h.mons.length===I.G.mons.length, hr&&JSON.stringify(hr.ids));
    var nq=RT.salaMandadas('quero').length;
    RT.sala('membros',{anf:'aaa',gen:3,s:5,lista:[{id:'aaa',nome:'Duda',cl:'cacador',lvl:9}]});await quadros(3);
    ok('outro anfitrião de geração maior leva a sala, e este vira convidado dele', Sa.SALA.papel==='convidado'&&Sa.SALA.anf==='aaa'&&Sa.SALA.gen===3&&I.G.over&&RT.salaMandadas('quero').length===nq+1, JSON.stringify({p:Sa.SALA.papel,a:Sa.SALA.anf}));
    `,
  },
  {
    nome: 'lojas',
    o_que: 'as lojas da cidade: a Quitandeira, a Boticária e o Mestre de magias vendem provisões para a próxima caçada, a comida vai para a mochila, o Guia mostra o que se leva, a caçada gasta tudo e entra com fome, e o botão Comer come da mochila; o Mestre ensina a habilidade do nível por ouro, e ela vai para o espaço livre',
    semente: 11,
    save: {'masmorra-runas-v2': {
      cofre: 300, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 4, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null], sabe: ['golpe']}},
    }},
    roteiro: `
    entrar();
    await quadros(3);
    Tl.abreNpc('quitandeira');
    ok('a Quitandeira abre a loja dela', visivel('#loja')&&txt('#ljNome')==='Quitandeira'&&txt('#ljCasa')==='Quitanda', txt('#ljNome')+' / '+txt('#ljCasa'));
    ok('a loja lista o que ela vende, com preço', todos('#ljList li').length===4&&/ouro$/.test(txt('#ljList .buy')), todos('#ljList li').length+' / '+txt('#ljList .buy'));
    ok('nada guardado ainda', /Nada guardado/.test(txt('#ljLeva')), txt('#ljLeva'));
    clica(todos('#ljList .buy')[2]);
    ok('comprar o presunto tira do cofre e põe na mochila', txt('#ljGold')==='260'&&sv().cofre===260&&sv().chars.cavaleiro.mochila.presunto===1&&!sv().prov.presunto, txt('#ljGold')+' / '+JSON.stringify(sv().chars.cavaleiro.mochila));
    ok('a loja diz quanto há na mochila e não trava as outras', todos('#ljList .buy').filter(function(b){return b.disabled}).length===0&&/Na mochila: 1/.test(txt('#ljList')), txt('#ljList'));
    ok('a Quitandeira avisa que sem comer não se regenera', /sem comer não se regenera/.test(txt('#ljFala')), txt('#ljFala'));
    clica($('#ljBack'));
    ok('a volta da loja é para a cidade', $('#app').classList.contains('cidade')&&!visivel('#loja'));
    Tl.abreNpc('boticaria');
    ok('a Boticária vende poção e elixir', txt('#ljNome')==='Boticária'&&todos('#ljList li').length===2, txt('#ljList'));
    clica($('#ljList .buy'));clica($('#ljList .buy'));
    ok('duas poções guardadas', sv().prov.pocao===2&&/Guardadas: 2 de 5/.test(txt('#ljList')), JSON.stringify(sv().prov));
    clica($('#ljBack'));
    Tl.abreNpc('mago');
    ok('o Mestre de magias vende runas', txt('#ljNome')==='Mestre de magias'&&todos('#ljList li').length===3, txt('#ljList'));
    clica(todos('#ljList .buy')[0]);
    ok('a runa da pele de pedra fica guardada', sv().prov.runa_pedra===1&&todos('#ljList .buy')[0].disabled, JSON.stringify(sv().prov));
    ok('o Mestre lista as habilidades da classe', visivel('#ljHab')&&todos('#ljHab li').length===6, todos('#ljHab li').length);
    var hb=todos('#ljHab .buy');
    ok('a de nível 1 já é sabida, a do nível 4 tem preço, a do 10 pede nível', hb[0].textContent==='sabe'&&hb[1].textContent==='150 ouro'&&!hb[1].disabled&&hb[2].disabled&&hb[2].textContent==='nível 10', hb.map(function(b){return b.textContent}).join(' | '));
    Tl.abreNpc('quitandeira');
    ok('a loja que não ensina não mostra habilidades', $('#ljHab').hidden&&$('#ljHabT').hidden);
    Tl.abreNpc('mago');
    clica(todos('#ljHab .buy')[1]);
    var cv=sv().chars.cavaleiro;
    ok('aprender tira do cofre e é para sempre', sv().cofre===0&&cv.sabe.indexOf('brutal')>=0&&todos('#ljHab .buy')[1].textContent==='sabe', sv().cofre+' / '+JSON.stringify(cv.sabe));
    ok('a habilidade aprendida vai para o espaço livre', cv.slots[1]==='brutal', JSON.stringify(cv.slots));
    clica($('#ljBack'));
    Tl.abreNpc('guia');
    ok('o Guia diz o que vai na caçada', /2 × Poção de vida/.test(txt('#hProv')), txt('#hProv'));
    clica($('#huntList button'));
    await quadros(3);
    ok('a caçada começa com as poções a mais', I.G.p.pot===5&&txt('#potN')==='×5', I.G.p.pot+' / '+txt('#potN'));
    ok('o presunto entra na mochila, ele entra com fome, e a runa protege desde a entrada', I.G.p.bag.presunto===1&&I.G.p.ali===0&&$('#bCom').classList.contains('fome')&&txt('#comT')==='Fome'&&I.G.p.sup.arm&&I.G.p.sup.arm.v===0.15, JSON.stringify({bag:I.G.p.bag,ali:I.G.p.ali,sup:I.G.p.sup})+' / '+txt('#comT'));
    ok('o registro avisa da fome', /com fome: toque em Comer/.test(txt('#log')||''), txt('#log'));
    I.G.p.mp=0;await quadros(10);
    ok('com fome a mana não sobe', I.G.p.mp===0, I.G.p.mp);
    $('#bCom').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7}));
    await quadros(10);
    ok('o botão Comer come o presunto e a mana volta a subir', I.G.p.ali>290&&I.G.p.ali<=300&&!I.G.p.bag.presunto&&I.G.p.mp>0&&!$('#bCom').classList.contains('fome')&&/^[45]:[0-9][0-9]$/.test(txt('#comT'))&&txt('#comN')==='×0', JSON.stringify({ali:I.G.p.ali,bag:I.G.p.bag,mp:I.G.p.mp})+' / '+txt('#comT')+' '+txt('#comN'));
    ok('o registro diz o que foi levado', /Você levou .*Runa da pele de pedra/.test(txt('#log')||''), txt('#log'));
    ok('o estoque foi gasto ao entrar', sv()&&Object.keys(sv().prov).length===0, JSON.stringify(sv()&&sv().prov));
`,
  },
  {
    nome: 'voz-na-sala',
    o_que: 'voz na sala: o botão só aparece com sala, o toque liga o microfone, a apresentação passa pelo canal da sala, o áudio liga direto (WebRTC de verdade, os dois lados neste navegador), segurar fala, mostra quem fala, e sair da sala desliga',
    semente: 7,
    patches: [P.semStun],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    var RT=window.__rt,BIA={nome:'Bia',cl:'druida',c:{lvl:2,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:['gelo',null,null,null],equip:{}},up:{}};
    /* microfone e WebRTC andam no relógio, não nos quadros: com a suíte em paralelo, 200 quadros podem não bastar */
    var relogio=async function(cond,ms){var t0=performance.now();while(performance.now()-t0<ms){if(cond())return true;await new Promise(function(r){setTimeout(r,30)})}return cond()};
    var aperta=function(e,tipo){e.dispatchEvent(new PointerEvent(tipo,{bubbles:true,pointerId:7}))};
    entrar();
    await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    ok('sem sala, não há botão de voz', $('#bVoz').hidden);
    Sa.criaSala();Tl.abreNpc('guia');
    await ate(function(){return Sa.SALA.estado==='ligado'},40);
    RT.sala('quero',{id:'zz1',ficha:BIA});RT.sala('quero',{id:'000',ficha:{nome:'Caio',cl:'cacador',c:{lvl:2,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:[null,null,null,null],equip:{}},up:{}}});
    var tres=await ate(function(){return Sa.SALA.membros.length===3},20);
    ok('dois convidados na sala', tres, Sa.SALA.membros.length);
    ok('o Guia oferece ligar a voz da sala', todos('#hSala button').some(function(b){return b.textContent==='Ligar voz'}), txt('#hSala'));
    clica($('#huntBack'));await quadros(3);
    ok('com sala, o botão Voz aparece na cidade', !$('#bVoz').hidden&&txt('#vozT')==='ligar', txt('#bVoz'));
    aperta($('#bVoz'),'pointerdown');aperta($('#bVoz'),'pointerup');
    var ligou=await relogio(function(){return Vz.VOZ.ligada},10000);await quadros(2);
    ok('o toque liga o microfone, mudo até segurar', ligou&&!Vz.VOZ.falando&&txt('#bVoz .nm')==='Falar', txt('#bVoz')+' / '+txt('#log'));
    var oi=await ate(function(){return RT.salaMandadas('voz').some(function(v){return v.t==='oi'})},40);
    ok('quem liga a voz se apresenta na sala', oi, JSON.stringify(RT.salaMandadas('voz')));
    /* Bia (id maior) diz oi: este aparelho, de id menor, oferece */
    RT.sala('voz',{de:'zz1',t:'oi'});
    var of=null;await relogio(function(){of=RT.salaMandadas('voz').filter(function(v){return v.t==='oferta'&&v.para==='zz1'})[0];return !!of},10000);
    ok('ao oi de id maior, este aparelho manda a oferta, com os candidatos', of&&/m=audio/.test(of.sdp)&&/a=candidate/.test(of.sdp), of&&of.sdp.length);
    /* o lado da Bia: uma conexão de verdade, com o microfone falso dela */
    /* o microfone da Bia é um tom do WebAudio: o falso do Chromium só alimenta uma captura por vez */
    var ac=new AudioContext(),osc=ac.createOscillator(),dst=ac.createMediaStreamDestination();osc.connect(dst);osc.start();ac.resume();var mic=dst.stream;
    var pc=new RTCPeerConnection({iceServers:[]});pc.addTrack(mic.getAudioTracks()[0],mic);
    /* o som que chega só é medido se alguém o toca */
    pc.ontrack=function(e){var a=document.createElement('audio');a.srcObject=e.streams[0];a.play().catch(function(){});document.body.appendChild(a)};
    await pc.setRemoteDescription({type:'offer',sdp:of.sdp});await pc.setLocalDescription(await pc.createAnswer());
    await relogio(function(){return pc.iceGatheringState==='complete'},10000);
    RT.sala('voz',{de:'zz1',t:'resposta',para:of.de,sdp:pc.localDescription.sdp});
    /* a Bia segue dizendo oi, como o jogo dela faria; sem isso o par some (o tempo do jogo corre mais que o do relógio aqui) */
    var oiBia=setInterval(function(){RT.sala('voz',{de:'zz1',t:'oi'})},150);
    var lig=await relogio(function(){return Vz.VOZ.n===1&&pc.connectionState==='connected'},10000);
    ok('o áudio liga direto entre os dois aparelhos', lig&&/Voz ligada com Bia/.test(txt('#log')||''), Vz.VOZ.n+' / '+pc.connectionState+' / '+txt('#log'));
    var fala=await relogio(function(){return Vz.VOZ.quem==='Bia'&&txt('#vozT')==='Bia'},10000);
    ok('quem fala aparece no botão', fala, Vz.VOZ.quem+' / '+txt('#vozT'));
    /* o microfone falso apita de tempos em tempos: mede o maior nível em 2,5 s */
    var tx=function(){var s=pc.getReceivers()[0].getSynchronizationSources()[0];return s?s.audioLevel:0};
    var pico=async function(){var m=0,t0=performance.now();while(performance.now()-t0<2500){m=Math.max(m,tx());await new Promise(function(r){setTimeout(r,40)})}return m};
    var mudo=await pico();
    ok('sem segurar, a sala não ouve nada', mudo<.01, mudo);
    aperta($('#bVoz'),'pointerdown');await quadros(2);
    var no_ar=txt('#vozT'),alto=await pico();
    ok('segurando Falar, a sala ouve', alto>.03&&Vz.VOZ.falando&&no_ar==='no ar', alto+' / '+no_ar);
    aperta($('#bVoz'),'pointerup');
    ok('soltou, o microfone cala', !Vz.VOZ.falando&&mic&&true, Vz.VOZ.falando);
    tecla('keydown','KeyV');await quadros(1);var v1=Vz.VOZ.falando;tecla('keyup','KeyV');await quadros(1);
    ok('V no teclado também fala enquanto segura', v1&&!Vz.VOZ.falando, v1+' / '+Vz.VOZ.falando);
    /* Caio (id menor) oferece: este aparelho responde */
    var pc2=new RTCPeerConnection({iceServers:[]});pc2.addTrack(mic.getAudioTracks()[0],mic);
    await pc2.setLocalDescription(await pc2.createOffer());await relogio(function(){return pc2.iceGatheringState==='complete'},10000);
    RT.sala('voz',{de:'000',t:'oferta',para:of.de,sdp:pc2.localDescription.sdp});
    var re=null;await relogio(function(){re=RT.salaMandadas('voz').filter(function(v){return v.t==='resposta'&&v.para==='000'})[0];return !!re},10000);
    ok('à oferta de id menor, este aparelho responde', re&&/m=audio/.test(re.sdp), re&&re.sdp.length);
    RT.sala('voz',{de:'estranho',t:'oferta',para:of.de,sdp:pc2.localDescription.sdp});await quadros(5);
    ok('quem não está na sala não liga voz', !RT.salaMandadas('voz').some(function(v){return v.para==='estranho'}));
    pc2.close();
    clearInterval(oiBia);RT.sala('voz',{de:'zz1',t:'tchau'});
    await ate(function(){return Vz.VOZ.n===0},40);
    ok('tchau fecha a voz com quem saiu', Vz.VOZ.n===0, Vz.VOZ.n);
    Tl.abreNpc('guia');
    ok('o Guia oferece desligar a voz', todos('#hSala button').some(function(b){return b.textContent==='Desligar voz'}), txt('#hSala'));
    clica(todos('#hSala button').filter(function(b){return b.textContent==='Fechar sala'||b.textContent==='Sair da sala'})[0]);
    await ate(function(){return !Vz.VOZ.ligada},20);clica($('#huntBack'));await quadros(3);
    ok('fechar a sala desliga a voz e o botão some', !Vz.VOZ.ligada&&$('#bVoz').hidden&&RT.salaMandadas('voz').some(function(v){return v.t==='tchau'}), Vz.VOZ.ligada);
    pc.close();osc.stop();ac.close();
    `,
  },
  {
    nome: 'cidade-compartilhada',
    o_que: 'multiplayer na cidade: liga ao entrar, vê quem chega, anda e sai, confere dado de fora, e desliga ao ir caçar ou ao menu',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    var RT=window.__rt;
    ok('no acampamento não há conexão', RT.abertos===0, RT.abertos);
    entrar();
    var ligou=await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    ok('entrar na cidade liga ao canal da cidade', ligou&&RT.abertos===1&&RT.vivos[0].url.indexOf('/realtime/v1/websocket')>0, RT.abertos+' / '+txt('#cRede'));
    var join=RT.enviadas.filter(function(d){return d.event==='phx_join'})[0];
    ok('o canal é o da versão do jogo', join&&join.topic==='realtime:cidade-'+document.querySelector('script[src*="main.js"]').src.split('v=')[1].split('.').slice(0,2).join('.'), join&&join.topic);
    var tr=RT.enviadas.filter(function(d){return d.event==='presence'})[0];
    ok('anuncia nome, classe e nível (sem conta, o nome da classe)', tr&&tr.payload.payload.nome==='Feiticeiro'&&tr.payload.payload.classe==='feiticeiro'&&tr.payload.payload.lvl===3, tr&&JSON.stringify(tr.payload.payload));
    ok('conta onde está ao chegar', RT.posMandadas().length===1, RT.posMandadas().length);
    RT.entra('ana1',{nome:'Ana',classe:'cavaleiro',lvl:7});RT.pos('ana1',9,9);
    await quadros(4);
    var a=Cd.OUTROS.get('ana1');
    ok('quem chega aparece, com o nome e a classe dela', a&&a.vis&&a.nome==='Ana'&&a.classe==='cavaleiro'&&a.tx===9&&a.x===9.5*32, a&&JSON.stringify({n:a.nome,c:a.classe,x:a.x,v:a.vis}));
    ok('o HUD conta duas pessoas', txt('#cRede')==='2 na cidade', txt('#cRede'));
    ok('o registro avisa a chegada', /Ana chegou à cidade/.test(txt('#log')||''), txt('#log'));
    ok('quem chega fica sabendo onde estou', RT.posMandadas().length===2, RT.posMandadas().length);
    RT.pos('ana1',10,9,400);await ate(function(){return a.tx===10},10);await quadros(2);
    var meio=a.x;await quadros(16);
    ok('o boneco dela anda o passo inteiro, um sqm, sem saltar', meio>9.5*32&&meio<10.5*32&&a.x===10.5*32&&!a.mv, meio+' → '+a.x);
    RT.pos('ana1',30,9,400);await quadros(2);
    var lx=Math.min(30,Cd.C.w-1);
    ok('passo de mais de 3 sqm (mensagem perdida) salta direto', a.tx===lx&&a.x===(lx+.5)*32, a.tx+' / '+a.x);
    /* dado de fora: posição fora do mapa, classe que não existe, nome comprido com controle */
    RT.entra('mal',{nome:'\u0007'+'x'.repeat(50),classe:'dragao',lvl:'9'});RT.pos('mal',1e9,-50,1e9);
    await quadros(3);
    var m=Cd.OUTROS.get('mal');
    ok('dado de fora é conferido: posição presa ao mapa, classe válida, nome curto', m&&m.tx===Cd.C.w-1&&m.ty===0&&m.classe==='feiticeiro'&&m.nome.length===16&&m.nome.charCodeAt(0)===120, m&&JSON.stringify({x:m.x,y:m.y,c:m.classe,n:m.nome}));
    RT.sai('mal');
    var n0=RT.posMandadas().length,x0=Cd.C.p.tx;
    tecla('keydown','KeyD');await quadros(24);tecla('keyup','KeyD');await ate(function(){return !Cd.C.p.mv},40);await quadros(2);
    var n1=RT.posMandadas().length-n0,andou=Cd.C.p.tx-x0;
    ok('andando, manda uma mensagem por passo e nada parado', andou>=2&&n1===andou, n1+' mensagens, '+andou+' sqm');
    var ult=RT.posMandadas()[RT.posMandadas().length-1].payload.payload;
    ok('a última posição mandada é o sqm onde parei', ult.x===Cd.C.p.tx&&ult.y===Cd.C.p.ty&&!Cd.C.p.mv, JSON.stringify(ult)+' / '+Cd.C.p.tx+','+Cd.C.p.ty);
    ok('cada mensagem é um passo de um sqm, com a duração dele', RT.posMandadas().slice(n0).every(function(q){return q.payload.payload.d>=250&&q.payload.payload.d<=800}), JSON.stringify(RT.posMandadas().slice(n0).map(function(q){return q.payload.payload})));
    RT.sai('ana1');await quadros(3);
    ok('quem sai some, e o registro avisa', !Cd.OUTROS.has('ana1')&&/Ana saiu da cidade/.test(txt('#log')||''), Cd.OUTROS.size);
    ok('sem ninguém, o HUD volta a só você', txt('#cRede')==='Só você na cidade', txt('#cRede'));
    Tl.abreNpc('mercador');await quadros(3);
    ok('numa loja da cidade continua conectado', RT.fechados===0, RT.fechados);
    clica($('#shopBack'));
    RT.entra('bia',{nome:'Bia',classe:'druida',lvl:2});RT.pos('bia',6,6);await quadros(3);
    /* fora de sala (a incursão direta, que o Guia não oferece mais) */
    Tl.abreNpc('guia');Tl.start();await quadros(4);
    ok('ir caçar sai da cidade: desliga e esquece os outros', RT.fechados===1&&Cd.OUTROS.size===0, RT.fechados+' / '+Cd.OUTROS.size);
    ok('a caçada é sozinha: nada de rede na masmorra', RT.vivos.length===0, RT.vivos.length);
    clica($('#toMenu'));
    var religou=await ate(function(){return RT.abertos===2&&Cd.OUTROS.has('bia')},40);
    ok('voltar à cidade religa e recebe quem já estava lá', religou, RT.abertos+' / '+Cd.OUTROS.size);
    RT.pos('bia',7,6,300);await quadros(2);
    RT.vivos[0].close();await quadros(2);
    ok('se a conexão cai, avisa e esquece os outros', txt('#cRede')==='Sem rede: só você'&&Cd.OUTROS.size===0, txt('#cRede'));
    var voltou=await ate(function(){return RT.abertos===3&&txt('#cRede')==='2 na cidade'},60);
    ok('e religa sozinha', voltou, RT.abertos+' / '+txt('#cRede'));
    /* o Supabase tira do canal quem manda demais, sem fechar o socket */
    RT.todos({event:'system',payload:{message:'Too many messages per second',status:'error',extension:'system'}});
    var expulsou=await ate(function(){return RT.abertos===4&&txt('#cRede')==='2 na cidade'},80);
    ok('expulso do canal pelo servidor, percebe e religa', expulsou, RT.abertos+' / '+txt('#cRede'));
    clica($('#cMenu'));await quadros(3);
    ok('o menu sai da cidade e desliga', RT.vivos.length===0, RT.vivos.length);
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
    entrar();
    Tl.abreNpc('banqueiro');
    ok('o Banco abriu', visivel('#equip'));
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
    clica($('#cMenu'));
    var cav=todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Cavaleiro'})[0];
    clica(cav);
    ok('o personagem se troca pelo Menu, e a escolha entra na cidade', $('#app').classList.contains('cidade')&&sv().classe==='cavaleiro', sv().classe);
    entrar();
    Tl.abreNpc('banqueiro');
    ok('o Cavaleiro tem os próprios espaços, vazios', todos('#eqSlots button.full').length===0, todos('#eqSlots button.full').length);
    ok('o cofre é o mesmo da conta', !!linha('espada')&&txt('#eqGold')==='190', todos('#eqList li.sp').length+' / '+txt('#eqGold'));
    clica(bt('espada',0));
    ok('a espada foi para o Cavaleiro', sv().chars.cavaleiro.equip.arma==='espada', JSON.stringify(sv().chars.cavaleiro.equip));
    ok('o cofre ficou vazio e diz isso', todos('#eqList li.vazio').length===1, todos('#eqList li').length);
    clica($('#eqBack'));
    clica($('#cMenu'));
    var fei=todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Feiticeiro'})[0];
    clica(fei);
    ok('o Feiticeiro manteve o que vestia', sv().chars.feiticeiro.equip.arma==='machado'&&sv().chars.feiticeiro.equip.amuleto==='amuleto', JSON.stringify(sv().chars.feiticeiro.equip));
    cacar();
    await quadros(4);
    ok('o amuleto chegou em stats(): 85+15 de vida', txt('#hpT')==='100/100', txt('#hpT'));
    ok('o amuleto chegou em stats(): 95+15 de mana', txt('#mpT')==='110/110', txt('#mpT'));
`,
  },
  {
    nome: 'mochila',
    o_que: 'botão Mochila na cidade e na masmorra: corpo vestido, a mochila em grade de 20 espaços com o risco da morte, sem pausar o jogo',
    semente: 7,
    patches: [P.tempo(8, 3), P.sacoEquip],
    save: {'masmorra-runas-v2': {
      cofre: 0, itens: {}, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 1},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null], equip: {arma: 'machado', armadura: null, amuleto: null}}},
    }},
    roteiro: `
    var bt=$('#bMochila'),aberta=function(){return visivel('#mochila')};
    var cheias=function(){return todos('#moGrade .cel:not(:disabled)')};
    entrar();
    ok('o botão Mochila aparece na cidade', getComputedStyle(bt).display!=='none');
    clica(bt);
    ok('a mochila abre na cidade', aberta()&&bt.getAttribute('aria-expanded')==='true');
    var arma=$('#moDoll .s-arma');
    ok('o corpo mostra a arma vestida', (arma.getAttribute('aria-label')||'').indexOf('Arma: machado rachado')===0, arma.getAttribute('aria-label'));
    ok('o corpo mostra os espaços vazios', todos('#moDoll .cel').filter(function(b){return / vazio$/.test(b.getAttribute('aria-label')||'')}).length===2, todos('#moDoll .cel').map(function(b){return b.getAttribute('aria-label')}).join(' | '));
    ok('o corpo tem o desenho do Tibia: três colunas, as casas que o jogo não tem apagadas', todos('#moDoll > div').length===3&&todos('#moDoll .trava').length===6&&$('#moDoll > div:first-child .s-amuleto')&&$('#moDoll > div:nth-child(2) .s-armadura')&&$('#moDoll > div:last-child .s-saco'), todos('#moDoll > div').map(function(c){return c.children.length}).join(','));
    ok('o boneco vestido aparece ao lado do corpo', visivel('#moFig'));
    ok('o total vestido aparece', txt('#moTot')==='Vestido: +10% de dano. Vida 85 · Mana 95', txt('#moTot'));
    ok('na cidade a mochila está vazia, com os 20 espaços', cheias().length===0&&todos('#moGrade .cel').length===20&&txt('#moTit')==='Mochila', todos('#moGrade .cel').length);
    clica($('#moDoll .s-arma'));
    var acao=function(){return $('#moAcoes button')};
    ok('a arma vestida oferece tirar para a mochila', visivel('#moAcoes')&&txt('#moAcoes button')==='Tirar para a mochila', txt('#moAcoes'));
    clica(acao());
    ok('tirar põe a arma na mochila, não no cofre', !sv().chars.feiticeiro.equip.arma&&sv().chars.feiticeiro.mochila.machado===1&&!sv().itens.machado&&cheias().length===1, JSON.stringify(sv().chars.feiticeiro.mochila));
    clica(cheias()[0]);
    ok('a peça da mochila oferece vestir', txt('#moAcoes button')==='Vestir', txt('#moAcoes'));
    clica(acao());
    ok('vestir da mochila volta a arma ao corpo', sv().chars.feiticeiro.equip.arma==='machado'&&!sv().chars.feiticeiro.mochila.machado&&cheias().length===0, JSON.stringify(sv().chars.feiticeiro.equip));
    tecla('keydown','KeyB');tecla('keyup','KeyB');
    ok('B fecha a mochila', !aberta()&&bt.getAttribute('aria-expanded')==='false');
    clica(bt);
    cacar();
    ok('entrar na masmorra fecha a mochila', !aberta());
    await quadros(2);
    clica(bt);
    ok('a mochila abre na masmorra', aberta());
    ok('a mochila mostra o valor e os espaços', txt('#moVal')==='220 ouro · 2/20', txt('#moVal'));
    ok('a mochila tem as duas coisas, a mais valiosa primeiro', cheias().length===2&&/^200 de ouro/.test(cheias()[0].getAttribute('aria-label')||''), cheias().map(function(b){return b.getAttribute('aria-label')}).join(' | '));
    ok('o risco da morte aparece, com o selo', txt('#moRisco')==='Se morrer, perde 176 de ouro em loot (o selo guarda 44). Saia pela porta e guarde no Banco.', txt('#moRisco'));
    clica(cheias()[1]);
    ok('tocar numa peça diz o que ela é', txt('#moInfo')==='espada enferrujada · vale 20 de ouro · Arma, +6% de dano. Na mochila, cai na morte. Guardada no Banco, vai para o cofre.', txt('#moInfo'));
    ok('a peça tocada fica marcada', $('#moGrade .cel.on')&&$('#moGrade .cel.on').dataset.k==='espada');
    ok('a peça do saco oferece trocar pela vestida', txt('#moAcoes button')==='Trocar', txt('#moAcoes'));
    clica($('#moAcoes button'));
    ok('trocar na caçada veste a espada e põe o machado na mochila', /^Arma: espada/.test($('#moDoll .s-arma').getAttribute('aria-label')||'')&&txt('#moVal')==='228 ouro · 2/20'&&txt('#moTot').indexOf('+6% de dano')>0, txt('#moVal')+' · '+txt('#moTot'));
    var t0=txt('#timeT');
    await quadros(40);
    ok('o jogo não pausa com a mochila aberta', txt('#timeT')!==t0&&aberta(), t0+' → '+txt('#timeT'));
    tecla('keydown','Escape');
    ok('Esc fecha a mochila', !aberta());
    clica(bt);
    var acabou=await ate(function(){return visivel('#end')},1500);
    ok('a incursão acabou', acabou);
    ok('a tela final fecha a mochila', !aberta()&&bt.getAttribute('aria-expanded')==='false');
    ok('a espada vestida na caçada ficou no corpo depois do fim', sv().chars.feiticeiro.equip.arma==='espada', JSON.stringify(sv().chars.feiticeiro.equip));
    ok('soterrado, a mochila ficou na masmorra', txt('#eLoot')==='228 ouro · perdido'&&sv()&&JSON.stringify(sv().chars.feiticeiro.mochila)==='{}', txt('#eLoot')+' / '+(sv()&&JSON.stringify(sv().chars.feiticeiro.mochila)));
`,
  },
  {
    nome: 'banco-mochila',
    o_que: 'a mochila fica com o personagem entre as caçadas: o Banqueiro guarda uma peça ou tudo no cofre e lista o cofre inteiro (peça, tesouro e material, como item), devolve peça, pilha e ouro à mochila, o Guia avisa o que ela arrisca e ela entra inteira na caçada',
    semente: 7,
    save: {'masmorra-runas-v2': {
      cofre: 10, itens: {}, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null], mochila: {ouro: 50, gema: 1, espada: 2, seda: 2, sumiu: 4}}},
    }},
    roteiro: `
    var mo=function(){return sv()&&sv().chars.feiticeiro.mochila};
    var linhaMo=function(nome){return todos('#eqMo li.sp').filter(function(li){return li.querySelector('h3').textContent.indexOf(nome)>=0})[0]};
    entrar();
    clica($('#bMochila'));
    ok('na cidade a Mochila mostra o que o personagem carrega, uma casa por espada', todos('#moGrade .cel:not(:disabled)').length===5&&txt('#moVal')==='226 ouro · 5/20', txt('#moVal'));
    ok('e avisa que vai junto na próxima caçada', /^Vai com você na próxima caçada: se morrer, perde 226 de ouro em loot\./.test(txt('#moRisco')), txt('#moRisco'));
    clica($('#bMochila'));
    Tl.abreNpc('guia');
    ok('o Guia diz o que a mochila arrisca', /A mochila vai junto, com 226 de ouro em loot: morrer perde 226\./.test(txt('#hRisco')), txt('#hRisco'));
    Tl.abreNpc('banqueiro');
    ok('o Banco mostra a mochila', visivel('#equip')&&todos('#eqMo li.sp').length===4&&txt('#eqMoVal')==='226 ouro · 5/20', txt('#eqMoVal')+' / '+todos('#eqMo li.sp').length);
    clica(linhaMo('espada').querySelector('button'));
    ok('guardar uma espada leva uma só para o cofre', mo().espada===1&&sv().itens.espada===1&&/1 peça de equipamento/.test(txt('#eqMsg')), JSON.stringify(mo())+' / '+txt('#eqMsg'));
    clica($('#eqGuarda'));
    ok('guardar tudo: a moeda vira ouro, espada, gema e seda ficam no cofre como item', sv().cofre===60&&sv().itens.espada===2&&sv().mats.seda===2&&sv().mats.gema===1&&JSON.stringify(mo())==='{}', sv().cofre+' / '+JSON.stringify(sv().itens)+' / '+JSON.stringify(sv().mats));
    ok('o Banco diz o que foi para o cofre', txt('#eqMsg')==='Foram para o cofre: 50 de ouro, 1 peça de equipamento, 3 outros itens.', txt('#eqMsg'));
    ok('com a mochila vazia, guardar tudo fica apagado', $('#eqGuarda').disabled&&txt('#eqGold')==='60');
    var linhaC=function(nome){return todos('#eqList li.sp').filter(function(li){return li.querySelector('h3').textContent.indexOf(nome)>=0})[0]};
    ok('o cofre lista tudo: a espada, a gema e a seda', !!linhaC('espada')&&!!linhaC('gema rubra')&&!!linhaC('seda de aranha')&&/3 tipos de item/.test(txt('#eqCofreT')), txt('#eqCofreT')+' / '+todos('#eqList li.sp h3').map(function(h){return h.textContent}).join(' | '));
    ok('material não se vende no Banco, só leva', linhaC('seda de aranha').querySelectorAll('.btns button').length===1, linhaC('seda de aranha').textContent);
    clica(linhaC('gema rubra').querySelector('.btns button'));
    ok('vender a gema no Banco paga o valor dela', sv().cofre===180&&!sv().mats.gema&&txt('#eqGold')==='180', sv().cofre+' / '+JSON.stringify(sv().mats));
    clica(linhaC('seda de aranha').querySelector('.btns button'));
    ok('levar a seda devolve a pilha inteira à mochila', mo().seda===2&&!sv().mats.seda, JSON.stringify(mo()));
    clica($('#eqGuarda'));
    var levar=todos('#eqList li.sp')[0].querySelectorAll('.btns button')[2];
    ok('a peça do cofre tem o botão de levar', levar&&levar.textContent==='levar', levar&&levar.textContent);
    clica(levar);
    ok('levar põe a espada de volta na mochila', mo().espada===1&&sv().itens.espada===1, JSON.stringify(mo()));
    $('#eqQtd').value='30';clica($('#eqRetira'));
    ok('retirar ouro tira do cofre e põe na mochila', sv().cofre===150&&mo().ouro===30&&txt('#eqGold')==='150', sv().cofre+' / '+JSON.stringify(mo()));
    $('#eqQtd').value='999';clica($('#eqRetira'));
    ok('não se retira mais do que o cofre tem', sv().cofre===150&&/O cofre tem 150/.test(txt('#eqMsg')), txt('#eqMsg'));
    cacar();
    await quadros(2);
    ok('a mochila entra inteira na caçada', txt('#bagT')==='50', txt('#bagT'));
`,
  },
  {
    nome: 'chao-da-cidade',
    o_que: 'peças de teste no chão da cidade: pisar leva ao cofre do Banco, uma vez por conta, e não voltam ao chão',
    semente: 7,
    conteudo: [c => { c.city.chao = [{x: 27, y: 20, item: 'espada'}, {x: 29, y: 20, item: 'cota'}]; }],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    entrar();await quadros(2);
    ok('as duas peças estão no chão', Cd.C.chao.length===2, Cd.C.chao.length);
    tecla('keydown','KeyD');
    var pegou=await ate(function(){return Cd.C.chao.length===0},80);
    tecla('keyup','KeyD');await quadros(8);
    ok('andando por cima, pegou as duas', pegou, Cd.C.chao.length);
    ok('foram para o cofre da conta', sv().itens.espada===1&&sv().itens.cota===1, JSON.stringify(sv().itens));
    ok('o save lembra que já pegou', sv().chao['27,20']===1&&sv().chao['29,20']===1, JSON.stringify(sv().chao));
    ok('o registro avisa', /Você pegou espada enferrujada/.test(txt('#log')||''), txt('#log'));
    clica($('#bMochila'));
    ok('foram para o cofre, não para a mochila', txt('#moTit')==='Mochila'&&txt('#moVal')==='0 ouro · 0/20'&&todos('#moGrade .cel:not([disabled])').length===0, txt('#moTit')+' / '+txt('#moVal')+' / '+todos('#moGrade .cel:not([disabled])').length);
    clica($('#moX'));
    clica($('#cMenu'));await quadros(2);entrar();await quadros(2);
    ok('voltando à cidade, não aparecem de novo', Cd.C.chao.length===0, Cd.C.chao.length);
    Tl.abreNpc('banqueiro');
    ok('o Banco lista as duas para vestir', todos('#eqList li.sp').length===2, todos('#eqList li.sp').length);
`,
  },
  {
    nome: 'armas-que-renascem',
    o_que: 'a faca e a espada de madeira da casa vazia: pisar leva à mochila, a peça renasce no mesmo sqm e, com a mochila cheia, fica no chão',
    semente: 7,
    conteudo: [c => { c.city.chao = [{x: 27, y: 20, item: 'faca', respawn: 2}]; }],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    entrar();await quadros(2);
    ok('a faca está no chão', Cd.C.chao.length===1&&Cd.C.chao[0].k==='faca', JSON.stringify(Cd.C.chao));
    tecla('keydown','KeyD');
    var pegou=await ate(function(){return Cd.C.chao.length===0},40);
    tecla('keyup','KeyD');await quadros(60);
    ok('pisou e pegou', pegou, Cd.C.chao.length);
    ok('parado em cima, ela não renasce', Cd.C.p.tx===27&&Cd.C.chao.length===0, Cd.C.p.tx+' / '+Cd.C.chao.length);
    tecla('keydown','KeyD');await ate(function(){return Cd.C.p.tx>=29},40);tecla('keyup','KeyD');
    ok('foi para a mochila, não para o cofre', sv().chars.cavaleiro.mochila.faca===1&&!sv().itens.faca, JSON.stringify(sv().chars.cavaleiro.mochila)+' / '+JSON.stringify(sv().itens));
    ok('o save não marca a peça como pega', !sv().chao['27,20'], JSON.stringify(sv().chao));
    ok('o registro avisa', /Você pegou faca\. Está na mochila/.test(txt('#log')||''), txt('#log'));
    var volta=await ate(function(){return Cd.C.chao.length===1},80);
    ok('renasce no mesmo sqm', volta&&Cd.C.chao[0].x===27&&Cd.C.chao[0].y===20, JSON.stringify(Cd.C.chao));
    Pg.ch().mochila={faca:1,espada:19};
    ok('a mochila está cheia', Pg.cabe(Pg.ch().mochila,'faca')===0, Pg.cabe(Pg.ch().mochila,'faca'));
    tecla('keydown','KeyA');
    var pisou=await ate(function(){return Cd.C.p.tx===27},40);
    tecla('keyup','KeyA');await quadros(4);
    ok('chegou no sqm da faca', pisou, Cd.C.p.tx);
    ok('mochila cheia: a faca fica no chão', Cd.C.chao.length===1&&Pg.ch().mochila.faca===1, Cd.C.chao.length+' / '+Pg.ch().mochila.faca);
    ok('o registro diz que não coube', /A mochila está cheia\. Faca fica no chão/.test(txt('#log')||''), txt('#log'));
`,
  },
  {
    nome: 'equipamento-no-corpo',
    o_que: 'o que o personagem veste aparece nele: retrato no Banco, cidade, incursão com golpe, e os outros jogadores veem pela presença',
    semente: 11,
    limite: 90000,
    patches: [P.spawnNaEntrada],
    save: {'masmorra-runas-v2': {
      cofre: 0, itens: {couraca: 1}, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null],
        equip: {arma: 'espada', armadura: 'cota', amuleto: 'amuleto'}}},
    }},
    roteiro: `
    var RT=window.__rt,V=document.querySelector('script[src*="main.js"]').src.split('v=')[1];
    var chegou=await ate(function(){return $('#app').dataset.arte==='1'},400);
    ok('o atlas carregou', chegou);
    /* uma impressão digital dos pixels do retrato: muda se o boneco muda */
    var digital=function(){var c=$('#eqBoneco canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,h=0,n=0;
      for(var i=0;i<d.length;i+=4){if(d[i+3]){n++;h=(Math.imul(h,31)+d[i]*7+d[i+1]*13+d[i+2]*17+i)|0}}return n+':'+h};
    entrar();
    await ate(function(){return txt('#cRede')==='Só você na cidade'},40);
    var tr=RT.enviadas.filter(function(d){return d.event==='presence'});
    ok('a presença diz o que ele veste', tr.length===1&&JSON.stringify(tr[0].payload.payload.eq)==='{"arma":"espada","armadura":"cota","amuleto":"amuleto"}', tr.length&&JSON.stringify(tr[0].payload.payload));
    /* dado de fora: só peça que existe e é daquele espaço */
    RT.entra('ana1',{nome:'Ana',classe:'druida',lvl:4,eq:{arma:'machado',armadura:'coroa',amuleto:'__proto__'}});RT.pos('ana1',9,9);
    await quadros(4);
    var a=Cd.OUTROS.get('ana1');
    ok('o equipamento dos outros chega conferido', a&&a.eq.arma==='machado'&&a.eq.armadura===null&&a.eq.amuleto===null, a&&JSON.stringify(a.eq));
    RT.entra('bia',{nome:'Bia',classe:'feiticeiro',lvl:2});RT.pos('bia',10,9);
    await quadros(4);
    ok('quem não manda equipamento aparece sem nada', Cd.OUTROS.get('bia')&&Cd.OUTROS.get('bia').eq.arma===null, Cd.OUTROS.get('bia')&&JSON.stringify(Cd.OUTROS.get('bia').eq));
    Tl.abreNpc('banqueiro');
    ok('o Banco mostra o boneco vestido', visivel('#eqBoneco'), $('#eqBoneco').hidden);
    var d0=digital();
    ok('o retrato tem o boneco desenhado', +d0.split(':')[0]>300, d0);
    clica($('#eqBoneco'));var d1=digital();
    ok('tocar no boneco o gira', d1!==d0, d0+' → '+d1);
    clica($('#eqBoneco'));clica($('#eqBoneco'));clica($('#eqBoneco'));
    ok('quatro toques voltam de frente', digital()===d0, digital());
    var linha=todos('#eqList li.sp')[0];
    clica(linha.querySelectorAll('.btns button')[0]);
    var d2=digital();
    ok('trocar a cota pela couraça muda o boneco', sv().chars.cavaleiro.equip.armadura==='couraca'&&d2!==d0, d2);
    clica(todos('#eqSlots button')[0]);
    ok('tirar a arma também muda o boneco', !sv().chars.cavaleiro.equip.arma&&digital()!==d2, digital());
    await quadros(3);
    tr=RT.enviadas.filter(function(d){return d.event==='presence'});
    var ult=tr[tr.length-1].payload.payload.eq;
    ok('o que muda no Banco vai de novo para os outros', tr.length===2&&ult.arma===null&&ult.armadura==='couraca'&&ult.amuleto==='amuleto', tr.length+' / '+JSON.stringify(ult));
    clica($('#eqList li.sp .btns button'));
    ok('a espada voltou para a mão', sv().chars.cavaleiro.equip.arma==='espada', JSON.stringify(sv().chars.cavaleiro.equip));
    clica($('#eqBack'));
    await quadros(6);
    cacar();
    await quadros(2);
    ok('a incursão começou vestida', $('#app').classList.contains('playing'));
    tecla('keydown','KeyJ');
    var In=await import('./src/sim/incursao.js?v='+V);
    var golpeou=await ate(function(){return In.G&&In.G.p.swing>0},400);
    await quadros(6);
    tecla('keyup','KeyJ');
    ok('o golpe saiu com a espada na mão, sem erro de desenho', golpeou, In.G&&In.G.p.swing);
`,
  },
  {
    nome: 'forja',
    o_que: 'o Gordon na Forja: encomenda só com o material todo, entregar libera a loja, comprar põe a peça no Banco, vender material é barato e mostra o que a encomenda usa; o material extraído volta na mochila e o Banco guarda no cofre, onde o Gordon vê',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.sacoMat, P.portalNaEntrada],
    save: {'masmorra-runas-v2': {
      cofre: 300, itens: {}, mats: {dente: 3, seda: 6, osso: 2, gema: 1}, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'cavaleiro',
      chars: {cavaleiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['golpe', null, null, null]}},
    }},
    roteiro: `
    var loja=function(nome){return todos('#fgLoja li.sp').filter(function(li){return li.querySelector('h3').textContent===nome})[0]};
    var mat=function(nome){return todos('#fgMats li.sp').filter(function(li){return li.querySelector('h3').textContent.indexOf(nome)===0})[0]};
    entrar();
    ok('o Gordon está na cidade', Cd.C.npcs.some(function(n){return n.k==='gordon'}));
    Tl.abreNpc('gordon');
    ok('o Gordon abre a Forja', visivel('#forja')&&txt('#forja h2')==='Gordon', txt('#forja h2'));
    ok('a Forja mostra o cofre', txt('#fgGold')==='300', txt('#fgGold'));
    ok('a primeira encomenda diz o que falta', (txt('#fgMissao')||'').indexOf('dente de rato 3/3 · seda de aranha 4/4')>=0, txt('#fgMissao'));
    ok('o depósito ignora o que o Gordon não compra', !mat('gema')&&todos('#fgMats li.sp').length===3, todos('#fgMats li.sp').length);
    ok('a seda separa o que a encomenda usa', /4 para a encomenda/.test(mat('seda').textContent)&&mat('seda').querySelectorAll('button').length===1, mat('seda').textContent);
    ok('a maça só sai depois da encomenda 1', loja('maça cravejada').querySelector('button').disabled&&/depois da encomenda 1/.test(loja('maça cravejada').textContent), loja('maça cravejada').textContent);
    clica(mat('seda').querySelector('button'));clica(mat('seda').querySelector('button'));
    ok('vender 1 duas vezes paga 4 por seda',sv().cofre===308&&sv().mats.seda===4&&/pagou 4/.test(txt('#fgMsg')), sv().cofre+' / '+JSON.stringify(sv().mats));
    clica($('#fgMissao button'));
    ok('entregar consome o pedido e avança a encomenda', sv().forja===1&&!sv().mats.seda&&!sv().mats.dente&&sv().mats.osso===2, sv().forja+' / '+JSON.stringify(sv().mats));
    ok('o Gordon diz o que liberou', /maça cravejada/.test(txt('#fgMsg')||''), txt('#fgMsg'));
    ok('a segunda encomenda aparece incompleta', (txt('#fgMissao h3')||'').indexOf('2/4')===0&&$('#fgMissao button').disabled, txt('#fgMissao'));
    clica(loja('maça cravejada').querySelector('button'));
    ok('comprar a maça debita 220 e põe a peça no cofre', sv().cofre===88&&sv().itens.maca===1, sv().cofre+' / '+JSON.stringify(sv().itens));
    ok('sem ouro, a couraça de 90 fica bloqueada', loja('couraça de couro').querySelector('button').disabled);
    clica($('#fgBack'));
    Tl.abreNpc('banqueiro');
    ok('a maça comprada está no Banco para vestir', todos('#eqList li.sp h3').some(function(h){return h.textContent==='maça cravejada'}), txt('#eqList'));
    clica($('#eqBack'));
    cacar();
    await quadros(2);
    clica($('#bMochila'));
    var sd=todos('#moGrade .cel:not(:disabled)').filter(function(b){return b.dataset.k==='seda'})[0];
    clica(sd);
    ok('a mochila diz que a seda, guardada, o Gordon vê', /fica no cofre e o Gordon vê na Forja/.test(txt('#moInfo')||''), txt('#moInfo'));
    clica($('#bMochila'));
    tecla('keydown','KeyJ');
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('saiu pelo portal', acabou&&txt('#endTitle')==='Extraído!', txt('#endTitle'));
    var m0=sv().mats.seda|0,c0=sv().cofre;
    ok('a seda saiu na mochila, sem ir sozinha para lugar nenhum', sv().chars.cavaleiro.mochila.seda>=2&&sv().cofre===c0, JSON.stringify(sv().chars.cavaleiro.mochila));
    clica($('#toMenu'));Tl.abreNpc('banqueiro');clica($('#eqGuarda'));
    ok('guardada no Banco, a seda vai para o depósito, não para o ouro', (sv().mats.seda|0)>=m0+2&&!sv().chars.cavaleiro.mochila.seda, JSON.stringify(sv().mats)+' / '+sv().cofre);
    ok('o Banco avisa o que foi para o cofre', /2 outros itens/.test(txt('#eqMsg')||''), txt('#eqMsg'));
`,
  },
  {
    nome: 'incursao-extracao',
    o_que: 'incursão de ponta a ponta: combate, portal, extração com a mochila, e o Banco guardando o ouro no cofre e o equipamento como peça',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.sacoEquip, P.portalNaEntrada, P.spawnNaEntrada, P.miraBot],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    cacar();
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
    var m=/^([0-9]+) ouro · (.+)$/.exec(txt('#eLoot')||'');
    ok('o loot saiu na mochila', !!m&&m[2]==='na mochila', txt('#eLoot'));
    var loot=m?+m[1]:-1,mo=sv()&&sv().chars.feiticeiro.mochila;
    ok('o loot semeado veio junto', loot>=220, loot);
    ok('a extração não guarda nada sozinha: está tudo na mochila', sv()&&sv().cofre===0&&!Object.keys(sv().itens||{}).length&&mo&&mo.espada>=1, sv()&&JSON.stringify(mo));
    ok('a tela final mostra o mesmo cofre', txt('#eCofre')===sv().cofre+' ouro', txt('#eCofre'));
    ok('a tela final manda guardar no Banco', /guarde no Banco/.test(txt('#endText')||''), txt('#endText'));
    ok('a espada aparece marcada como arma', todos('#endItems li small').some(function(x){return x.textContent==='arma'}), todos('#endItems li small').length);
    ok('o recorde foi atualizado', sv()&&sv().best===loot, sv()&&sv().best);
    clica($('#toMenu'));Tl.abreNpc('banqueiro');clica($('#eqGuarda'));
    var VAL={espada:20,machado:28,amuleto:60,couraca:30,cota:90,dente:3,seda:8,osso:10,erva:15},pecas=0;
    for(var k in (sv()&&sv().itens)||{})pecas+=VAL[k]*sv().itens[k];
    for(var k in (sv()&&sv().mats)||{})pecas+=VAL[k]*sv().mats[k];
    ok('guardada no Banco, a espada vai para o cofre como peça, não como ouro', sv()&&sv().itens&&sv().itens.espada>=1, sv()&&JSON.stringify(sv().itens));
    ok('ouro no cofre + peças e materiais guardados = valor da mochila', sv()&&sv().cofre+pecas===loot&&!Object.keys(sv().chars.feiticeiro.mochila).length, sv()&&(sv().cofre+' + '+pecas+' de '+loot));
    ok('uma saída foi contada', sv()&&sv().ext===1, sv()&&sv().ext);
    ok('uma incursão foi contada', sv()&&sv().runs===1, sv()&&sv().runs);
    ok('nenhuma morte foi contada', sv()&&sv().deaths===0, sv()&&sv().deaths);
    ok('houve combate: ao menos um monstro abatido', +txt('#eKills')>=1, txt('#eKills'));
    ok('houve experiência ganha', /^\\+[1-9]/.test(txt('#eXp')||''), txt('#eXp'));
    ok('a experiência foi persistida', sv()&&(sv().chars.feiticeiro.xp>0||sv().chars.feiticeiro.lvl>1), sv()&&JSON.stringify(sv().chars.feiticeiro));
    ok('o treino foi registrado', (txt('#eTrain')||'').length>0, txt('#eTrain'));
    ok('o tempo na masmorra foi registrado', (txt('#eTime')||'')!=='', txt('#eTime'));
    ok('o selo não aparece em extração', $('#eSeal').hidden);
    ok('extrair não custa experiência', $('#eXpPerda').hidden&&$('#eXpPerdaDt').hidden);
    ok('a mochila foi detalhada item por item', todos('#endItems li').length>=1, todos('#endItems li').length);
`,
  },
  {
    nome: 'arte',
    o_que: 'os sprites do OTSP chegam e a incursão roda desenhada com eles: combate, cadáver, efeitos e ícones',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.saco, P.portalNaEntrada, P.spawnNaEntrada, P.miraBot],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    }},
    roteiro: `
    var chegou=await ate(function(){return $('#app').dataset.arte==='1'},400);
    ok('o atlas carregou', chegou);
    $('#play').click();
    ok('a escolha de personagem mostra o retrato de cada classe', todos('#pickList .cls .ico').length===4, todos('#pickList .cls .ico').length);
    clica($('#pickBack'));
    cacar();
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
    entrar();
    await quadros(6);
    ok('a cidade abre e é desenhada sem a arte', $('#app').classList.contains('cidade')&&!!Cd.C, !!Cd.C);
    cacar();
    tecla('keydown','KeyJ');
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('a incursão chegou ao fim sem a arte', acabou, txt('#endTitle'));
    ok('o botão da poção ficou sem ícone', !$('#bPot .ico'));
`,
  },
  {
    nome: 'morte',
    o_que: 'morte: tela final, perda do saco, Selo de resguardo devolvendo 40% e 25% do XP do nível perdidos',
    semente: 3,
    patches: [P.tempo(12, 3), P.saco, P.spawnNaEntrada],
    conteudo: [A.ratoLetal],
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 2},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 400, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null], equip: {arma: 'machado', armadura: null, amuleto: null}}},
    }},
    roteiro: `
    $('#play').click();
    ok('a escolha de personagem avisa o preço da morte antes de entrar', txt('#pickList .cls.on .risco')==='Morrer custa a mochila (vazia) e 100 de XP.', txt('#pickList .cls.on .risco'));
    cacar();
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
    var ganho=+((/^\\+([0-9]+)/.exec(txt('#eXp')||'')||[])[1]),perda=/^−([0-9]+) xp \\(25% do nível\\)$/.exec(txt('#eXpPerda')||'');
    ok('a tela final mostra a experiência perdida em linha própria', !$('#eXpPerda').hidden&&!$('#eXpPerdaDt').hidden&&!!perda, txt('#eXpPerda'));
    ok('a perda é 25% do XP do nível na hora da morte', !!perda&&+perda[1]===Math.floor((400+ganho)*0.25), txt('#eXpPerda')+' / ganho '+ganho);
    ok('o save guardou o XP já reduzido, sem descer de nível', sv()&&sv().chars.feiticeiro.lvl===1&&!!perda&&sv().chars.feiticeiro.xp===400+ganho-(+perda[1]), sv()&&JSON.stringify(sv().chars.feiticeiro));
    ok('o texto final fala da experiência perdida', /25% da experiência/.test(txt('#endText')||''), txt('#endText'));
    clica($('#toMenu'));
    await quadros(2);
    Tl.abreNpc('guia');
    ok('o Guia de caça também avisa, com o XP reduzido', (txt('#hRisco')||'').indexOf('Hoje: '+Math.floor(sv().chars.feiticeiro.xp*0.25)+' xp.')>=0, txt('#hRisco'));
    clica($('#huntBack'));
    clica($('#cMenu'));
    ok('de volta à escolha de personagem, o aviso já conta o XP reduzido', (txt('#pickList .cls.on .risco')||'').indexOf(' e '+Math.floor(sv().chars.feiticeiro.xp*0.25)+' de XP.')>=0, txt('#pickList .cls.on .risco'));
`,
  },
  {
    nome: 'classes',
    o_que: 'as quatro classes são selecionáveis, coexistem no save e nascem com 2 espaços',
    semente: 5,
    save: {'masmorra-runas-v2': {cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0, up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0}, classe: null, chars: {}}},
    roteiro: `
    ok('save sem classe abre a tela de entrada, só com a conta', visivel('#menu')&&visivel('#contaF'));
    $('#play').click();
    ok('a tela seguinte é a escolha de classe', visivel('#pick'));
    var cards=function(){return todos('#pickList button.cls')};
    ok('quatro classes na lista', cards().length===4, cards().length);
    var nomes=cards().map(function(b){return b.querySelector('h3').textContent});
    ok('as quatro classes da Etapa 3, na ordem', nomes.join(',')==='Feiticeiro,Druida,Caçador,Cavaleiro', nomes.join(','));
    ok('cada classe mostra cinco barras de crescimento', cards().every(function(b){return b.querySelectorAll('.bars > div').length===5}), cards().map(function(b){return b.querySelectorAll('.bars > div').length}).join(','));
    ok('a escolha de personagem tem Regras e Voltar', visivel('#toRegras')&&visivel('#pickBack'));
    var vida={'Feiticeiro':'85/85','Druida':'92/92','Caçador':'110/110','Cavaleiro':'135/135'};
    for(var i=0;i<nomes.length;i++){
      var n=nomes[i];
      clica(cards().filter(function(b){return b.querySelector('h3').textContent===n})[0]);
      ok('escolher '+n+' entra na cidade', $('#app').classList.contains('cidade'));
      ok('o save guarda '+n, ({'Feiticeiro':'feiticeiro','Druida':'druida','Caçador':'cacador','Cavaleiro':'cavaleiro'})[n]===sv().classe, sv().classe);
      ok(n+' nasce no nível 1', txt('#sLvl')==='1', txt('#sLvl'));
      ok(n+' nasce com 2 espaços', txt('#sSlots')==='2', txt('#sSlots'));
      cacar();
      await quadros(3);
      ok(n+' entra com a vida da classe', txt('#hpT')===vida[n], txt('#hpT'));
      ok(n+' leva ao menos uma habilidade', !$('#s0').hidden);
      ok('o nome da classe aparece no HUD de '+n, txt('#clsT')===n, txt('#clsT'));
      ok('o rótulo acessível de '+n+' diz o custo certo', ($('#s0').getAttribute('aria-label')||'').indexOf(n==='Cavaleiro'?'sem mana':'de mana')>=0, $('#s0').getAttribute('aria-label'));
      clica($('#toMenu'));
      ok('voltou à cidade depois da incursão', $('#app').classList.contains('cidade'));
      clica($('#cMenu'));
      ok('o Menu da cidade reabre a escolha de personagem', visivel('#pick'));
      ok('com classe escolhida já há como voltar', !$('#pickBack').hidden);
    }
    var s=sv();
    ok('os quatro personagens coexistem no save', s&&Object.keys(s.chars).sort().join(',')==='cacador,cavaleiro,druida,feiticeiro', s&&Object.keys(s.chars).sort().join(','));
    ok('cada personagem guarda os próprios espaços', s&&Object.keys(s.chars).every(function(k){return Array.isArray(s.chars[k].slots)&&s.chars[k].slots.length===4}), s&&JSON.stringify(s.chars));
    clica(cards().filter(function(b){return b.querySelector('h3').textContent==='Cavaleiro'})[0]);
    entrar();clica($('#cGrim'));
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
    entrar();clica($('#cGrim'));
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
    ok('o Grimório volta à cidade', $('#app').classList.contains('cidade')&&!visivel('#grim'));
    cacar();
    await quadros(3);
    var visiveis=[0,1,2,3].filter(function(i){return !$('#s'+i).hidden});
    ok('a incursão mostra só os espaços cheios', visiveis.length===3, visiveis.join(','));
    ok('o Caçador entra com 110+11*17 de vida', txt('#hpT')==='297/297', txt('#hpT'));
`,
  },
  {
    nome: 'nivel-na-incursao',
    o_que: 'subir de nível no meio da incursão: a habilidade com preço do nível novo não vem sozinha, o registro diz que o Mestre de magias ensina e por quanto',
    semente: 23,
    limite: 90000,
    patches: [P.tempo(30, 25), P.spawnNaEntrada],
    /* xpNeed(8) é 3379 (progression.xp do content.json): a primeira morte de
       rato estoura o nível 9, que é onde o Feiticeiro pode aprender Onda de
       Fogo com o Mestre de magias (o terceiro espaço, aberto no 8, fica vago) */
    save: {'masmorra-runas-v2': {
      cofre: 0, runs: 0, ext: 0, deaths: 0, best: 0,
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 8, xp: 3378, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', 'flam', null, null], sabe: ['faisca', 'flam']}},
    }},
    roteiro: `
    cacar();
    await quadros(2);
    ok('entrou no nível 8', txt('#lvlT')==='Nv 8', txt('#lvlT'));
    ok('dois botões de ação no começo', [0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).length===2, [0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).join(','));
    tecla('keydown','KeyJ');
    var subiu=await ate(function(){return txt('#lvlT')==='Nv 9'},1200);
    tecla('keyup','KeyJ');
    ok('subiu de nível matando no meio da incursão', subiu, txt('#lvlT'));
    await quadros(4);
    var c=sv().chars.feiticeiro;
    ok('a habilidade com preço não vem sozinha', c.slots[2]===null&&c.sabe.indexOf('ondafogo')<0, JSON.stringify(c.slots)+' / '+JSON.stringify(c.sabe));
    ok('o registro diz quem ensina e quanto custa', /Onda de Fogo já pode ser aprendida com o Mestre de magias, por 500 de ouro/.test(txt('#log')||''), txt('#log'));
    ok('sem habilidade nova, o terceiro botão continua escondido', $('#s2').hidden, 'visíveis: '+[0,1,2,3].filter(function(i){return !$('#s'+i).hidden}).join(','));
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
    cacar();
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
    cacar();
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
    if(visivel('#menu'))$('#play').click();
    if(visivel('#pick')){
      clica(todos('#pickList button.cls').filter(function(b){return b.querySelector('h3').textContent==='Druida'})[0]);
      ok('dá para escolher uma classe e seguir', $('#app').classList.contains('cidade'));
    }
    /* o cofre no acampamento prova que showMenu() correu até o fim: o markup
       traz 0 de placeholder, e era nele que o teste caía antes */
    ok('o acampamento foi desenhado de verdade', txt('#sCofre')==='300', txt('#sCofre'));
    ok('o acampamento tem um personagem para mostrar', txt('#sLvl')==='1', txt('#sLvl'));
    ok('o personagem que faltava foi criado', sv()&&sv().chars.druida&&sv().chars.druida.lvl===1, sv()&&JSON.stringify(sv().chars));
    cacar();
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
    cacar();
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
    cacar();
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
    cacar();
    await quadros(3);
    ok('a vida soma classe, nível e Vigor: 85+24+30', txt('#hpT')==='139/139', txt('#hpT'));
    ok('a mana soma classe, nível e Foco: 95+64+10', txt('#mpT')==='169/169', txt('#mpT'));
    ok('a Bolsa de poções migrada vale na incursão', txt('#potN')==='×4', txt('#potN'));
    ok('a incursão nova contou sobre as sete antigas', sv()&&sv().runs===8, sv()&&sv().runs);
`,
  },
  {
    nome: 'feira',
    o_que: 'mercado entre jogadores: a caixa entra no cofre ao abrir, vender e comprar casam com o livro, o resto fica anunciado, cancelar devolve, erro do banco vira aviso, e save mais velho que o mercado é trocado pelo da nuvem',
    semente: 43,
    patches: [P.nuvem(null, {}, {
      itens: {espada: {venda: [[25, 1]], compra: [[18, 3]], ultimo: 22, dia: 4}, cota: {venda: [[70, 2]], compra: [], ultimo: null, dia: 0}, bogus: {venda: [[1, 1]], compra: [], ultimo: null, dia: 0}},
      minhas: [{id: 7, lado: 'compra', item: 'cota', preco: 50, qtd: 1, resta: 1}],
      caixa: {ouro: 40, itens: {}},
      /* o machado está no cofre mas não tem origem: veio de antes da conta */
      lastro: {ouro: 340, itens: {espada: 2}},
    })],
    save: {'masmorra-runas-v2': {
      cofre: 300, itens: {espada: 2, machado: 1}, runs: 1, ext: 0, deaths: 0, best: 0, dono: 'u1',
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    },
    'masmorra-runas-v2-sessao': {tk: 'tk1', uid: 'u1', usuario: 'ana'}},
    roteiro: `
    var pronto=await ate(function(){return /salvo na nuvem · ana/.test(txt('#contaT')||'')},300);
    ok('a sessão guardada liga a nuvem', pronto, txt('#contaT'));
    entrar();await quadros(2);
    Tl.abreNpc('corretor');
    var abriu=await ate(function(){return /Da feira/.test(txt('#mktMsg')||'')},300);
    ok('a Feira abre e avisa o que entrou da caixa', abriu&&/40 de ouro/.test(txt('#mktMsg')), txt('#mktMsg'));
    ok('a caixa entrou no cofre e no save', sv().cofre===340&&txt('#mktGold')==='340', sv().cofre+' / '+txt('#mktGold'));
    ok('o save guarda a marca do mercado', sv().mkt===window.__nuvem.dados.mkt&&sv().mkt>=1, sv().mkt);
    var lis=todos('#mktItens li');
    ok('a lista tem só as peças de equipamento do jogo (item desconhecido do livro fica fora)', lis.length===9&&!/bogus/.test(txt('#mktItens')), lis.length);
    ok('a espada mostra os dois lados do livro e o cofre', /2 no cofre/.test(lis[0].textContent)&&/vendem a partir de 25/.test(lis[0].textContent)&&/compram até 18/.test(lis[0].textContent), lis[0].textContent);
    ok('suas ofertas listam a compra de cota', /Compra: cota de malha a 50/.test(txt('#mktMinhas')||''), txt('#mktMinhas'));
    ok('peça sem origem aparece como tal na lista', /machado rachado · 1 no cofre, 0 com origem/.test(lis[1].textContent), lis[1].textContent);
    clica(lis[1].querySelector('button'));
    ok('peça sem origem abre comprando', $('#mpLadoC').getAttribute('aria-pressed')==='true', $('#mpLadoC').getAttribute('aria-pressed'));
    clica($('#mpLadoV'));
    ok('vender peça sem origem fica bloqueado e explicado', $('#mpOk').disabled&&/Só 0 têm origem registrada/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpVolta'));
    lis=todos('#mktItens li');
    clica(lis[0].querySelector('button'));
    ok('quem tem a peça abre vendendo, pelo melhor preço de compra', visivel('#mktPeca')&&$('#mpLadoV').getAttribute('aria-pressed')==='true'&&$('#mpPreco').value==='18', $('#mpPreco').value);
    ok('o resumo diz o que recebe, já com a taxa', /recebe 17 de ouro \\(taxa de 1\\)/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpQtdMais'));
    ok('o + soma uma peça e o resumo acompanha', $('#mpQtd').value==='2'&&/recebe 35/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpOk'));
    var vendeu=await ate(function(){return /Vendeu/.test(txt('#mktMsg')||'')},300);
    ok('vender casa com a compra do livro', vendeu&&/Vendeu 2 × espada enferrujada: entraram 35 de ouro/.test(txt('#mktMsg')), txt('#mktMsg'));
    ok('o cofre e as peças vêm do banco', sv().cofre===375&&!sv().itens.espada, JSON.stringify([sv().cofre,sv().itens]));
    ok('a volta é para a lista', visivel('#mktLista')&&!visivel('#mktPeca'));
    clica(todos('#mktItens li button')[0]);
    ok('sem a peça, abre comprando, pelo melhor preço de venda', $('#mpLadoC').getAttribute('aria-pressed')==='true'&&$('#mpPreco').value==='25', $('#mpPreco').value);
    $('#mpQtd').value='3';$('#mpQtd').dispatchEvent(new Event('input'));
    ok('o resumo da compra diz quanto fica reservado', /Reserva 75 de ouro/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpOk'));
    var comprou=await ate(function(){return /Comprou/.test(txt('#mktMsg')||'')},300);
    ok('comprar leva o que há e anuncia o resto', comprou&&/Comprou espada enferrujada por 25 de ouro\\. 2 ficaram anunciadas no livro a 25/.test(txt('#mktMsg')), txt('#mktMsg'));
    ok('a peça veio e o ouro do resto ficou preso', sv().cofre===300&&sv().itens.espada===1, JSON.stringify([sv().cofre,sv().itens]));
    ok('a oferta nova aparece nas suas', todos('#mktMinhas li').length===2&&/Compra: 3 × espada enferrujada a 25/.test(txt('#mktMinhas')), txt('#mktMinhas'));
    clica(todos('#mktMinhas li button')[0]);
    var cancelou=await ate(function(){return /voltaram ao cofre/.test(txt('#mktMsg')||'')},300);
    ok('cancelar devolve o ouro preso', cancelou&&/50 de ouro voltaram/.test(txt('#mktMsg'))&&sv().cofre===350, txt('#mktMsg')+' / '+sv().cofre);
    clica(todos('#mktItens li button')[6]);
    ok('a cota abre', txt('#mpNome')==='cota de malha', txt('#mpNome'));
    $('#mpQtd').value='100';$('#mpQtd').dispatchEvent(new Event('input'));
    ok('sem ouro, o botão não anuncia e o resumo diz quanto falta', $('#mpOk').disabled&&/Faltam/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpLadoV'));
    ok('vender o que não tem fica bloqueado', $('#mpOk').disabled&&/Você tem 0/.test(txt('#mpRes')||''), txt('#mpRes'));
    clica($('#mpLadoC'));$('#mpQtd').value='1';$('#mpQtd').dispatchEvent(new Event('input'));
    window.__nuvem.forcaErro='limite';
    clica($('#mpOk'));
    var recusou=await ate(function(){return /10 ofertas abertas/.test(txt('#mktMsg')||'')},300);
    ok('o erro do banco vira aviso legível e nada muda no cofre', recusou&&$('#mktMsg').classList.contains('ruim')&&sv().cofre===350, txt('#mktMsg'));
    ok('a origem acompanhou os negócios', window.__nuvem.mk.lastro.ouro===350&&window.__nuvem.mk.lastro.itens.espada===1, JSON.stringify(window.__nuvem.mk.lastro));
    /* parte do ouro do cofre sem origem: a Feira mostra quanto vale e barra a compra acima disso */
    window.__nuvem.mk.lastro.ouro=60;
    clica($('#mktBack'));Tl.abreNpc('corretor');
    var leu=await ate(function(){return visivel('#mktOrig')},300);
    ok('a Feira mostra o ouro com origem quando é menor que o cofre', leu&&/Com origem registrada: 60 de ouro/.test(txt('#mktOrig')), txt('#mktOrig'));
    clica(todos('#mktItens li button')[6]);
    $('#mpPreco').value='70';$('#mpQtd').value='1';$('#mpQtd').dispatchEvent(new Event('input'));
    ok('comprar acima do ouro com origem fica bloqueado', $('#mpOk').disabled&&/Só 60 de ouro têm origem/.test(txt('#mpRes')||''), txt('#mpRes'));
    window.__nuvem.mk.lastro.ouro=350;
    clica($('#mktBack'));
    /* outro aparelho negociou: a nuvem tem mkt maior, e a próxima gravação daqui é recusada */
    window.__nuvem.dados.mkt+=5;window.__nuvem.dados.cofre=999;
    Tl.abreNpc('banqueiro');
    clica(todos('#eqList button.rm')[0]);
    ${espera(2500)}
    ok('a venda ao Banco avisa o banco da origem', window.__nuvem.args.lastro_banco&&window.__nuvem.args.lastro_banco.p_item==='machado'&&window.__nuvem.args.lastro_banco.p_val===28, JSON.stringify(window.__nuvem.args.lastro_banco));
    var trocou=await ate(function(){return sv()&&sv().cofre===999},300);
    ok('save mais velho que o mercado é recusado e o da nuvem entra', trocou&&sv().mkt===window.__nuvem.dados.mkt, sv()&&JSON.stringify([sv().cofre,sv().mkt,window.__nuvem.dados.mkt]));
`,
  },
  {
    nome: 'feira-saco',
    o_que: 'com conta, a caçada abre no banco; a Mochila vende uma peça do saco na Feira (sai do saco, vai com a caçada e o saco); a extração fecha a caçada com o saco que sobrou e a peça vendida não volta ao cofre',
    semente: 11,
    limite: 90000,
    patches: [P.tempo(20, 10), P.sacoEquip, P.portalNaEntrada, P.nuvem(null, {}, {lastro: {ouro: 0, itens: {}}})],
    save: {'masmorra-runas-v2': {
      cofre: 0, itens: {}, runs: 0, ext: 0, deaths: 0, best: 0, dono: 'u1',
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    },
    'masmorra-runas-v2-sessao': {tk: 'tk1', uid: 'u1', usuario: 'ana'}},
    roteiro: `
    var pronto=await ate(function(){return /salvo na nuvem · ana/.test(txt('#contaT')||'')},300);
    ok('a sessão guardada liga a nuvem', pronto, txt('#contaT'));
    cacar();
    var abriu=await ate(function(){return window.__nuvem.chamadas.indexOf('caca_comecar')>=0},200);
    ok('a caçada abre no banco ao começar', abriu, window.__nuvem.chamadas.join());
    await quadros(4);
    ok('o saco entrou com a espada', txt('#bagT')==='220', txt('#bagT'));
    clica($('#bMochila'));
    var esp=todos('#moGrade .cel:not(:disabled)').filter(function(b){return /espada/.test(b.getAttribute('aria-label')||'')})[0];
    ok('a espada está no saco da Mochila', !!esp);
    clica(esp);
    ok('peça do saco oferece a venda na Feira pelo valor dela', visivel('#moVenda')&&$('#mvPreco').value==='20', $('#mvPreco').value);
    clica($('#mvMais'));
    clica($('#mvOk'));
    var vendeu=await ate(function(){return /anunciada na Feira a 21/.test(txt('#mvMsg')||'')},300);
    ok('a venda do saco foi anunciada', vendeu, txt('#mvMsg'));
    var a=window.__nuvem.args.mercado_anunciar||{};
    ok('o anúncio leva a caçada e o saco de antes', a.p_caca===501&&a.p_saco&&a.p_saco.espada===1&&a.p_qtd===1&&a.p_lado==='venda', JSON.stringify(a));
    ok('a espada saiu do saco e do valor dele', txt('#bagT')==='200'&&!todos('#moGrade .cel:not(:disabled)').some(function(b){return /espada/.test(b.getAttribute('aria-label')||'')}), txt('#bagT'));
    ok('peça vestida não oferece venda', (clica(todos('#moDoll .cel')[0]),!visivel('#moVenda')));
    clica($('#moX'));
    tecla('keydown','KeyJ');
    var acabou=await ate(function(){return visivel('#end')},1500);
    tecla('keyup','KeyJ');
    ok('saiu pelo portal', acabou&&txt('#endTitle')==='Extraído!', txt('#endTitle'));
    var fim=await ate(function(){return !!window.__nuvem.args.caca_fim},300);
    var f=window.__nuvem.args.caca_fim||{};
    ok('a extração fecha a caçada no banco, sem a peça vendida', fim&&f.p_id===501&&f.p_desfecho==='extraiu'&&!(f.p_saco||{}).espada, JSON.stringify(f));
    ok('o ouro extraído vai como origem', f.p_ouro>=200&&window.__nuvem.mk.lastro.ouro===f.p_ouro, f.p_ouro+' / '+window.__nuvem.mk.lastro.ouro);
    ok('a espada vendida não volta ao cofre', sv()&&!(sv().itens||{}).espada, sv()&&JSON.stringify(sv().itens));
    ok('a fila da origem esvaziou', (localStorage.getItem('masmorra-runas-v2-fila')||'[]')==='[]', localStorage.getItem('masmorra-runas-v2-fila'));
`,
  },
  {
    nome: 'vestida-morte',
    o_que: 'com conta, vestir do saco e morrer: a peça fica no corpo e a caçada fecha no banco dando origem só a ela, para poder ir à Feira',
    semente: 11,
    patches: [P.tempo(20, 10), P.sacoEquip, P.nuvem(null, {}, {lastro: {ouro: 0, itens: {}}})],
    save: {'masmorra-runas-v2': {
      cofre: 0, itens: {}, runs: 0, ext: 0, deaths: 0, best: 0, dono: 'u1',
      up: {vigor: 0, foco: 0, poder: 0, bolsa: 0, seguro: 0},
      classe: 'feiticeiro',
      chars: {feiticeiro: {lvl: 1, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', null, null, null]}},
    },
    'masmorra-runas-v2-sessao': {tk: 'tk1', uid: 'u1', usuario: 'ana'}},
    roteiro: `
    await ate(function(){return /salvo na nuvem · ana/.test(txt('#contaT')||'')},300);
    cacar();
    await ate(function(){return window.__nuvem.chamadas.indexOf('caca_comecar')>=0},200);
    await quadros(4);
    clica($('#bMochila'));
    clica(todos('#moGrade .cel:not(:disabled)').filter(function(b){return /espada/.test(b.getAttribute('aria-label')||'')})[0]);
    ok('a espada do saco oferece vestir', txt('#moAcoes button')==='Vestir', txt('#moAcoes'));
    clica($('#moAcoes button'));
    clica($('#moX'));
    I.sai(I.G.p,'morreu');
    var fim=await ate(function(){return !!window.__nuvem.args.caca_fim},300);
    var f=window.__nuvem.args.caca_fim||{};
    ok('a morte fecha a caçada mandando só a peça vestida', fim&&f.p_desfecho==='morreu'&&JSON.stringify(f.p_saco)==='{"espada":1}', JSON.stringify(f));
    ok('a espada ganhou origem na nuvem', (window.__nuvem.mk.lastro.itens||{}).espada===1, JSON.stringify(window.__nuvem.mk.lastro));
    ok('a espada continua vestida depois da morte', sv().chars.feiticeiro.equip.arma==='espada', JSON.stringify(sv().chars.feiticeiro.equip));
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
    ok('a sessão antiga do e-mail foi descartada', visivel('#menu')&&visivel('#contaF'));
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
    var entrou=await ate(function(){return /salvo na nuvem · novato/.test(txt('#pConta')||'')&&visivel('#pick')},200);
    ok('conta nova entra direto na escolha de personagem, com o usuário', entrou&&visivel('#pConta'), txt('#pConta')+' / pick='+visivel('#pick'));
    ok('não há tela intermediária: nada de Continuar', !visivel('#menu')&&txt('#play')!=='Continuar', txt('#play'));
    ok('a conta foi criada com o nome sem espaços', window.__nuvem.contas.novato==='1', JSON.stringify(window.__nuvem.contas));
    ok('a sessão ficou guardada no aparelho', /tk1/.test(localStorage.getItem('masmorra-runas-v2-sessao')||''));
    ok('a senha não fica guardada no aparelho', !/"1"/.test(localStorage.getItem('masmorra-runas-v2-sessao')||'')&&$('#contaS').value==='');
    ok('a nuvem foi lida depois de entrar', window.__nuvem.gets===1, window.__nuvem.gets);
    ${espera(1800)}
    ok('o save local subiu para a conta nova', window.__nuvem.posts>=1&&window.__nuvem.dados.cofre===10, window.__nuvem.posts);
    cacar();
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
    ok('com a sessão guardada, o jogo abre direto na escolha de personagem', visivel('#pick')&&!visivel('#menu')&&txt('#pickBack')==='Sair da conta', txt('#pickBack'));
    cacar();
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
    clica($('#pickBack'));
    await quadros(4);
    ok('Sair da conta, na escolha de personagem, volta à tela de entrada', visivel('#menu')&&visivel('#contaF'));
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
  const semVersao = verificaVersao(fontes);
  if (semVersao.length) {
    console.error(`VERSÃO FALHOU: imports sem ?v=${VERSAO} (rode node tools/versao.mjs ${VERSAO}):\n  ` + semVersao.join('\n  '));
    return 1;
  }
  console.log(`VERSAO_OK   (v${VERSAO} no index.html e em todos os imports)`);

  const sim = await testaSimulacao();
  if (sim.falhas.length) {
    console.log('\u2717 simulação no Node');
    for (const f of sim.falhas) console.log(`    falhou: ${f}`);
  } else {
    console.log(`\u2713 simulação no Node — incursão inteira sem navegador: ${sim.a.passos} passos, ${sim.a.kills} abates; sorteio com semente: mesma masmorra, mesmo resultado a 20, 60 e quadros irregulares, efeitos isolados, sem Math.random; grupo de 1, 2 e 4 jogadores determinista, com loot único e extração individual`);
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
