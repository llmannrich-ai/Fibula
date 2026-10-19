/* ---------- sala: caçar junto ----------
   Teste do co-op na masmorra sem servidor próprio (decisão do Leonardo em
   19/10/2026, opção C do plano do multiplayer): quem cria a sala é o
   ANFITRIÃO, e o aparelho dele roda a regra da incursão para todos, a mesma
   src/sim/ de sempre com várias fichas. Os CONVIDADOS mandam só a entrada
   (posição, habilidades seguradas, poção) e desenham o retrato que o
   anfitrião manda. O canal é o Realtime do Supabase, um por sala, pelo
   WebSocket nativo, como a cidade (src/rede.js).
   A sala fica aberta até o anfitrião fechar ou sair do jogo; quem está na
   cidade a vê no Guia de caça. Só o anfitrião pode trapacear (é ele quem
   calcula), e cada um grava o próprio save com o resultado que o anfitrião
   mandou: serve para jogar com amigos, não com desconhecidos — isso é a M2.
   Mensagens (broadcast): quero (convidado pede para entrar, com a ficha),
   membros (a lista), comeca (semente e fichas), ent (entrada do convidado),
   estado (o retrato), fim (o resultado de um convidado), log, fecha. */
import {CLASSES,ITEMS,SPELLS} from './sim/dados.js?v=0.18.1';
import {save,ch,confereFicha,guardaSaco} from './sim/progresso.js?v=0.18.1';
import {G,retrato,aplicaRetrato,fichaLocal} from './sim/incursao.js?v=0.18.1';
import {drinkPot} from './sim/combate.js?v=0.18.1';
import {SB_URL,SB_KEY,quemSou} from './nuvem.js?v=0.18.1';
import {rede,ID,anuncia} from './rede.js?v=0.18.1';
import {persist} from './salvar.js?v=0.18.1';
import {log} from './hud.js?v=0.18.1';

const VER=(()=>{try{return(new URL(import.meta.url).searchParams.get('v')||'dev').split('.').slice(0,2).join('.')}catch(e){return 'dev'}})();
/* 4 jogadores no máximo; retrato e entrada a 10 por segundo: com 4, ~40
   envios por segundo no canal, abaixo dos ~100 que o plano Free aceita */
export const MAX=4;
const RITMO=.1,BATIDA=25,PACIENCIA=12;
/* papel: null (fora de sala), 'anfitriao' ou 'convidado'. membros: quem está
   na sala, o anfitrião primeiro: {id, nome, cl, lvl, ficha (só no anfitrião)} */
export const SALA={papel:null,id:null,membros:[],estado:'fora',aoMudar(){}};
let ws=null,ref=0,pronto=false,espera=0,tenta=0,batida=0,ritmo=0,semAnf=0,potes=0,potesViu=[];
/* no anfitrião, durante a incursão da sala: o índice em G.ps de cada id, a
   entrada de cada convidado e quem já recebeu o resultado */
const IDX=new Map(),ENTS=[];
const topico=()=>'realtime:sala-'+VER+'-'+SALA.id;
const manda=(event,payload,topic=topico())=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}))};
const bc=(event,payload)=>manda('broadcast',{type:'broadcast',event,payload});
const nomeMeu=()=>quemSou()||CLASSES[save.classe].nome;
const minhaFicha=()=>({nome:nomeMeu(),cl:save.classe,c:JSON.parse(JSON.stringify(ch())),up:Object.assign({},save.up)});
const avisa=()=>{rede.sala=SALA.papel==='anfitriao'?{n:SALA.membros.length}:null;rede.naSala=SALA.papel?Math.max(1,SALA.membros.length):0;anuncia();SALA.aoMudar()};

function liga(){
  pronto=false;ref=0;SALA.estado='ligando';
  try{ws=new WebSocket(SB_URL.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+SB_KEY+'&vsn=1.0.0')}catch(e){ws=null;caiu();return}
  const s=ws;
  s.onopen=()=>{if(ws!==s)return;tenta=0;manda('phx_join',{config:{broadcast:{self:false},presence:{key:ID},private:false}})};
  s.onmessage=m=>{if(ws!==s)return;let d;try{d=JSON.parse(m.data)}catch(e){return}if(d&&d.topic===topico())recebe(d)};
  s.onclose=()=>{if(ws!==s)return;ws=null;caiu()};
  s.onerror=()=>{};
}
function caiu(){pronto=false;if(!SALA.papel){SALA.estado='fora';return}SALA.estado='sem rede';espera=Math.min(20,2**tenta++)}
function solta(){
  if(ws){manda('phx_leave',{});try{ws.close()}catch(e){}}
  ws=null;pronto=false;SALA.papel=null;SALA.id=null;SALA.membros=[];SALA.estado='fora';IDX.clear();ENTS.length=0;avisa();
}

/* ---------- o que o jogador faz ---------- */
export function criaSala(){
  if(SALA.papel)return;
  SALA.papel='anfitriao';SALA.id=ID;SALA.membros=[{id:ID,nome:nomeMeu(),cl:save.classe,lvl:ch().lvl}];
  liga();avisa();log('Sala aberta. Quem estiver na cidade a vê no Guia de caça.','info');
}
export function entraSala(id){
  if(SALA.papel||!id||id===ID)return;
  SALA.papel='convidado';SALA.id=id;SALA.membros=[];semAnf=0;liga();avisa();
}
/* o anfitrião fecha (os convidados voltam a caçar sozinhos); o convidado sai */
export function saiDaSala(){
  if(!SALA.papel)return;
  const era=SALA.papel;
  if(era==='anfitriao')bc('fecha',{});else bc('saio',{id:ID});
  solta();log(era==='anfitriao'?'Você fechou a sala.':'Você saiu da sala.','info');
}
export const correndo=()=>!!(G&&G.sala&&G.active&&!G.over);

/* ---------- anfitrião ---------- */
/* as fichas da incursão da sala, o anfitrião primeiro; quem está numa
   incursão própria agora fica de fora desta */
export function comecaGrupo(semente,hunt){
  const fichas=[fichaLocal()],ids=[ID];IDX.clear();ENTS.length=0;IDX.set(ID,0);ritmo=0;
  for(const m of SALA.membros.slice(1)){if(!m.ficha)continue;IDX.set(m.id,fichas.length);ids.push(m.id);fichas.push(Object.assign({},m.ficha,{c:JSON.parse(JSON.stringify(m.ficha.c))}))}
  bc('comeca',{semente,hunt,ids,fichas:fichas.map(f=>({nome:f.nome||nomeMeu(),cl:f.cl,c:f.c,up:f.up}))});
  return fichas;
}
/* a entrada de cada jogador para passo(): a deste aparelho e a última de
   cada convidado */
export function entradas(local){
  if(!correndo()||SALA.papel!=='anfitriao')return local;
  ENTS[0]=local;for(let i=1;i<G.ps.length;i++)if(!ENTS[i])ENTS[i]={x:0,y:0,held:[false,false,false,false]};
  return ENTS;
}
/* o resultado de um convidado que saiu, para o save dele */
function mandaFim(p){
  const id=[...IDX].find(([,i])=>i===p.id);if(!id)return;
  const c=p.c;
  bc('fim',{id:id[0],r:{fora:p.fora,bag:p.bag,bagVal:p.bagVal,sealed:p.sealed,xpPerdido:p.xpPerdido,kills:p.kills,xpGain:p.xpGain,magGain:p.magGain,perGain:p.perGain,
    c:{lvl:c.lvl,xp:c.xp,mag:c.mag,manaG:c.manaG,per:c.per,golpes:c.golpes,slots:c.slots}}});
}
/* chamado por saida.sai e saida.log/banner (src/main.js) para quem não é
   deste aparelho */
export function saiu(p){if(SALA.papel==='anfitriao'&&G&&G.sala)mandaFim(p)}
export function logPara(p,m,c,banner){
  if(SALA.papel!=='anfitriao'||!G||!G.sala||!pronto)return;
  const id=p?[...IDX].find(([,i])=>i===p.id):null;
  if(p&&!id)return;
  bc('log',{id:id?id[0]:null,m:String(m),c,b:!!banner});
}
function recebeAnf(ev,q,de){
  if(ev==='quero'){
    if(!q||typeof q.id!=='string')return;
    const f=confereFicha(q.ficha),ja=SALA.membros.find(m=>m.id===q.id);
    if(!f)return;
    if(ja){ja.ficha=f;ja.lvl=f.c.lvl;ja.cl=f.cl;ja.nome=f.nome}
    else if(SALA.membros.length>=MAX){bc('cheia',{id:q.id});return}
    else{SALA.membros.push({id:q.id,nome:f.nome,cl:f.cl,lvl:f.c.lvl,ficha:f});log(`${f.nome} entrou na sua sala.`,'info')}
    mandaMembros();avisa();
  }else if(ev==='saio'&&q)tira(q.id);
  else if(ev==='ent'&&q&&correndo()){
    const i=IDX.get(q.id);if(!i)return;
    const e=ENTS[i]||(ENTS[i]={x:0,y:0,held:[false,false,false,false],pos:{x:0,y:0},f:0});
    const h=q.h|0;for(let k=0;k<4;k++)e.held[k]=!!(h&(1<<k));
    /* o sqm em que o convidado diz estar; o anfitrião só anda até lá pela regra */
    if(Number.isInteger(q.x)&&Number.isInteger(q.y)){e.pos=e.pos||{x:0,y:0};e.pos.x=Math.max(0,Math.min(63,q.x));e.pos.y=Math.max(0,Math.min(63,q.y))}
    e.f=Number.isFinite(q.f)?q.f/100:e.f;
    /* a poção é um contador: cada aumento é um gole, mesmo que uma mensagem se perca */
    const n=q.pot|0;if(n>(potesViu[i]||0)){potesViu[i]=n;drinkPot(G.ps[i])}
  }
}
const mandaMembros=()=>bc('membros',{lista:SALA.membros.map(m=>({id:m.id,nome:m.nome,cl:m.cl,lvl:m.lvl}))});
function tira(id){
  const i=SALA.membros.findIndex(m=>m.id===id);if(i<1)return;
  const m=SALA.membros.splice(i,1)[0];log(`${m.nome} saiu da sua sala.`,'info');
  /* na incursão, o boneco de quem caiu fica parado */
  const k=IDX.get(id);if(k)ENTS[k]=null;
  mandaMembros();avisa();
}

/* ---------- convidado ---------- */
let eu=-1;
/* o src/telas.js liga isto: começar a incursão da sala e mostrar o fim */
export const ganchos={comeca(){},fim(){},aborta(){},banner(){}};
function recebeConv(ev,q){
  if(ev==='membros'||ev==='estado'||ev==='log')semAnf=0;
  if(ev==='membros'&&q&&Array.isArray(q.lista)){
    const antes=JSON.stringify(SALA.membros),vazia=!SALA.membros.length;
    SALA.membros=q.lista.slice(0,MAX).filter(m=>m&&CLASSES[m.cl]).map(m=>({id:String(m.id),nome:String(m.nome||'').slice(0,20),cl:m.cl,lvl:m.lvl|0}));
    if(vazia&&SALA.membros.length)log(`Você entrou na sala de ${SALA.membros[0].nome}. Espere o anfitrião começar a caçada.`,'info');
    if(JSON.stringify(SALA.membros)!==antes)avisa();
  }else if(ev==='cheia'&&q&&q.id===ID){log('A sala está cheia.','warn');solta()}
  else if(ev==='fecha'){if(correndo())ganchos.aborta('O anfitrião fechou a sala.');log('O anfitrião fechou a sala.','warn');solta()}
  else if(ev==='comeca'&&q&&Array.isArray(q.ids)&&Array.isArray(q.fichas)){
    /* quem está numa incursão própria fica de fora desta */
    eu=q.ids.indexOf(ID);if(eu<0||(G&&G.active&&!G.over))return;
    const fichas=q.fichas.map(confereFicha);if(fichas.some(f=>!f))return;
    potes=0;ritmo=0;ganchos.comeca(q.semente>>>0,fichas,eu);
  }else if(ev==='estado'&&q&&correndo()&&G.convidado)aplicaRetrato(q,eu);
  else if(ev==='fim'&&q&&q.id===ID&&correndo()&&G.convidado)aplicaFim(q.r);
  else if(ev==='log'&&q&&(q.id===null||q.id===ID)&&(correndo()||q.id===null)){if(q.b)ganchos.banner(String(q.m));else log(String(q.m),typeof q.c==='string'?q.c:'info')}
}
/* o resultado que o anfitrião calculou vai para o save deste aparelho, como
   sai() faria com a ficha local: itens só os que existem, números inteiros */
function aplicaFim(r){
  if(!r||typeof r!=='object')return;
  const p=G.p,c=ch(),n=v=>Number.isFinite(v)?Math.max(0,Math.floor(v)):0;
  const kind=r.fora==='extraiu'||r.fora==='morreu'?r.fora:'desabou';
  if(r.c&&typeof r.c==='object'){
    c.lvl=Math.max(1,n(r.c.lvl));c.xp=n(r.c.xp);c.mag=n(r.c.mag);c.manaG=n(r.c.manaG);c.per=Math.max(10,n(r.c.per));c.golpes=n(r.c.golpes);
    if(Array.isArray(r.c.slots))c.slots=[0,1,2,3].map(i=>{const k=r.c.slots[i];return SPELLS[k]&&SPELLS[k].c===save.classe&&SPELLS[k].lvl<=c.lvl?k:null});
  }
  const bag={};if(r.bag&&typeof r.bag==='object')for(const[k,q]of Object.entries(r.bag))if(ITEMS[k]&&n(q))bag[k]=n(q);
  p.bag=bag;p.bagVal=n(r.bagVal);p.sealed=n(r.sealed);p.xpPerdido=n(r.xpPerdido);p.kills=n(r.kills);p.xpGain=n(r.xpGain);p.magGain=n(r.magGain);p.perGain=n(r.perGain);
  p.ouroExt=0;p.pecas=0;p.fora=kind;p.c=c;
  if(kind==='extraiu'){const g=guardaSaco(bag);p.ouroExt=g.ouro;p.pecas=g.pecas;save.ext++;save.best=Math.max(save.best,p.bagVal)}
  else{save.deaths++;save.cofre+=p.sealed}
  persist();
  G.over=true;G.end=kind;G.dur=G.t;
  ganchos.fim(kind);
}
/* a entrada do convidado: o sqm em que está (ele anda no próprio aparelho), direção,
   espaços segurados e quantas poções pediu */
export const pocao=()=>{potes++};
function mandaEnt(ent){
  const p=G.p;let h=0;for(let k=0;k<4;k++)if(ent.held[k])h|=1<<k;
  bc('ent',{id:ID,x:p.tx,y:p.ty,f:Math.round(p.face*100),h,pot:potes});
}

/* ---------- canal ---------- */
const expulso=d=>d.event==='phx_error'||d.event==='phx_close'||(d.event==='system'&&d.payload&&d.payload.status==='error')||(d.event==='phx_reply'&&d.ref!=='1'&&d.payload&&d.payload.status==='error');
function recebe(d){
  const p=d.payload||{};
  if(expulso(d)){const s=ws;ws=null;caiu();try{s&&s.close()}catch(e){}return}
  if(d.event==='phx_reply'&&d.ref==='1'){
    if(p.status!=='ok'){SALA.estado='sem rede';return}
    pronto=true;SALA.estado='ligado';
    manda('presence',{type:'presence',event:'track',payload:{anf:SALA.papel==='anfitriao'}});
    if(SALA.papel==='convidado')bc('quero',{id:ID,ficha:minhaFicha()});else mandaMembros();
  }else if(d.event==='presence_diff'&&SALA.papel==='anfitriao'){
    for(const id in p.leaves||{})if(!(p.joins&&p.joins[id]))tira(id);
  }else if(d.event==='broadcast'&&p.event){
    if(SALA.papel==='anfitriao')recebeAnf(p.event,p.payload);else recebeConv(p.event,p.payload);
  }
}
/* chamado pelo laço a cada quadro, com a entrada deste aparelho */
export function quadro(dt,ent){
  if(!SALA.papel)return;
  if(!ws){espera-=dt;if(espera<=0)liga();return}
  if(!pronto)return;
  batida-=dt;if(batida<=0){batida=BATIDA;manda('heartbeat',{},'phoenix')}
  ritmo-=dt;
  /* o anfitrião manda o retrato na incursão e, fora dela, a lista a cada 5 s,
     que é como o convidado sabe que a sala continua aberta */
  if(SALA.papel==='anfitriao'){
    if(correndo()){if(ritmo<=0){ritmo=RITMO;bc('estado',retrato())}}
    else if(ritmo<=0){ritmo=5;mandaMembros()}
    return}
  /* convidado: sem notícia do anfitrião por PACIENCIA segundos, a sala acabou */
  semAnf+=dt;
  if(correndo()&&G.convidado&&ritmo<=0){ritmo=RITMO;mandaEnt(ent)}
  if(semAnf>PACIENCIA){
    if(correndo()&&G.convidado)ganchos.aborta('A conexão com o anfitrião caiu.');
    log('A sala fechou: o anfitrião saiu do jogo.','warn');solta()}
}
