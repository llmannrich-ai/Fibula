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
   A sala é de um mapa de caça (SALA.caca: o Esgoto, a Ilha, a Cripta...),
   escolhido ao criar, e vai junto no anúncio, na lista e na porta.
   A masmorra da sala nasce com ela e não tem tempo ("masmorra aberta" em
   src/sim/incursao.js): cada um entra e sai pela porta quando quiser, e ela
   só acaba quando o anfitrião fecha a sala (na cidade) ou sai do jogo.
   Mensagens (broadcast): quero (pedir para ficar na sala, com a ficha),
   membros (a lista, com quem está dentro), entro (convidado na porta),
   porta (a resposta: semente e quem está dentro), ent (entrada do
   convidado), estado (o retrato), fim (o resultado de quem saiu), log,
   fecha, e voz (a apresentação da voz entre dois aparelhos, src/voz.js). */
import {CLASSES,ITEMS,SPELLS,cacaDe} from './sim/dados.js?v=0.35.0';
import {save,ch,confereFicha,valMochila} from './sim/progresso.js?v=0.35.0';
import {G,newRun,entra,retrato,aplicaRetrato,fichaLocal} from './sim/incursao.js?v=0.35.0';
import {novaSemente} from './sim/base.js?v=0.35.0';
import {drinkPot,comer} from './sim/combate.js?v=0.35.0';
import {SB_URL,SB_KEY,quemSou} from './nuvem.js?v=0.35.0';
import {rede,ID,anuncia} from './rede.js?v=0.35.0';
import {persist} from './salvar.js?v=0.35.0';
import {log} from './hud.js?v=0.35.0';
import {recebeVoz,desligaVoz} from './voz.js?v=0.35.0';

const VER=(()=>{try{return(new URL(import.meta.url).searchParams.get('v')||'dev').split('.').slice(0,2).join('.')}catch(e){return 'dev'}})();
/* 4 jogadores no máximo; retrato e entrada a 10 por segundo: com 4, ~40
   envios por segundo no canal, abaixo dos ~100 que o plano Free aceita */
export const MAX=4;
const RITMO=.1,BATIDA=25,PACIENCIA=12;
/* papel: null (fora de sala), 'anfitriao' ou 'convidado'. membros: quem está
   na sala, o anfitrião primeiro: {id, nome, cl, lvl, ficha (só no anfitrião)} */
export const SALA={papel:null,id:null,caca:null,membros:[],estado:'fora',aoMudar(){}};
let ultDentro='',pedindo=false,pedT=0,ws=null,ref=0,pronto=false,espera=0,tenta=0,batida=0,ritmo=0,semAnf=0,potes=0,potesViu=[],comidas=0,comidasViu=[];
/* no anfitrião, durante a incursão da sala: o índice em G.ps de cada id, a
   entrada de cada convidado e quem já recebeu o resultado */
const IDX=new Map(),ENTS=[];
const topico=()=>'realtime:sala-'+VER+'-'+SALA.id;
const manda=(event,payload,topic=topico())=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}))};
const bc=(event,payload)=>manda('broadcast',{type:'broadcast',event,payload});
/* a apresentação da voz (src/voz.js) passa por este canal */
export const sinal=q=>{if(pronto)bc('voz',Object.assign({de:ID},q))};
const nomeMeu=()=>quemSou()||CLASSES[save.classe].nome;
const minhaFicha=()=>({nome:nomeMeu(),cl:save.classe,c:JSON.parse(JSON.stringify(ch())),up:Object.assign({},save.up),prov:Object.assign({},save.prov)});
const avisa=()=>{rede.sala=SALA.papel==='anfitriao'?{n:SALA.membros.length,h:SALA.caca}:null;rede.naSala=SALA.papel?Math.max(1,SALA.membros.length):0;anuncia();SALA.aoMudar()};

function liga(){
  pronto=false;ref=0;SALA.estado='ligando';
  try{ws=new WebSocket(SB_URL.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+SB_KEY+'&vsn=1.0.0')}catch(e){ws=null;caiu();return}
  const s=ws;
  s.onopen=()=>{if(ws!==s)return;tenta=0;manda('phx_join',{config:{broadcast:{self:false},presence:{key:ID},private:false}})};
  s.onmessage=m=>{if(ws!==s)return;let d;try{d=JSON.parse(m.data)}catch(e){return}if(d&&d.topic===topico())recebe(d)};
  s.onclose=()=>{if(ws!==s)return;ws=null;caiu()};
  s.onerror=()=>{};
}
function caiu(){pronto=false;if(!SALA.papel){SALA.estado='fora';return}SALA.estado='sem rede';espera=Math.min(20,2**tenta++);SALA.aoMudar()}
function solta(){
  if(ws){manda('phx_leave',{});try{ws.close()}catch(e){}}
  ws=null;pronto=false;pedindo=false;SALA.papel=null;SALA.id=null;SALA.caca=null;SALA.membros=[];SALA.estado='fora';IDX.clear();ENTS.length=0;avisa();
}

/* ---------- o que o jogador faz ---------- */
/* criar a sala abre a masmorra dela, vazia, no aparelho do anfitrião, no
   mapa de caça escolhido */
export function criaSala(caca){
  if(SALA.papel)return;
  SALA.papel='anfitriao';SALA.id=ID;SALA.caca=cacaDe(caca);SALA.membros=[{id:ID,nome:nomeMeu(),cl:save.classe,lvl:ch().lvl}];
  newRun(novaSemente(),[fichaLocal()],true,SALA.caca);G.ps[0].fora='fora';G.active=true;G.sala=true;
  IDX.clear();ENTS.length=0;potesViu=[];comidasViu=[];IDX.set(ID,0);
  liga();avisa();log('Sala aberta, com a masmorra dela. Quem estiver na cidade a vê no Guia de caça.','info');
}
/* quem está dentro da masmorra da sala agora */
export const dentro=id=>{const i=IDX.get(id);return SALA.papel==='anfitriao'?!!(G&&G.sala&&i!==undefined&&G.ps[i]&&!G.ps[i].fora):!!(SALA.membros.find(m=>m.id===id)||{}).d};
/* a porta: o anfitrião entra direto; o convidado pede e espera a resposta */
export function entraPorta(){
  if(SALA.papel==='anfitriao'){const p=entra(0,fichaLocal());G.p=p;ENTS[0]=null;return true}
  if(SALA.papel==='convidado'&&pronto&&!pedindo){pedindo=true;pedT=0;bc('entro',{id:ID,ficha:minhaFicha()});return true}
  return false;
}
export function entraSala(id,caca){
  if(SALA.papel||!id||id===ID)return;
  SALA.papel='convidado';SALA.id=id;SALA.caca=cacaDe(caca);SALA.membros=[];semAnf=0;liga();avisa();
}
/* o anfitrião fecha a sala, e a masmorra dela acaba (quem estava dentro
   volta à cidade sem resultado); o convidado só sai */
export function saiDaSala(){
  if(!SALA.papel)return;
  const era=SALA.papel;
  desligaVoz(false);
  if(era==='anfitriao'){bc('fecha',{});if(G&&G.sala){G.over=true;G.active=false}}else bc('saio',{id:ID});
  solta();log(era==='anfitriao'?'Você fechou a sala.':'Você saiu da sala.','info');
}
export const correndo=()=>!!(G&&G.sala&&G.active&&!G.over);

/* ---------- anfitrião ---------- */
/* um convidado na porta: entra com a ficha que mandou, conferida, no mesmo
   lugar de G.ps de antes (ou num novo), e recebe a semente e quem está lá */
function abrePorta(q){
  const m=SALA.membros.find(x=>x.id===q.id),f=confereFicha(q.ficha);
  if(!m||!f||!G||!G.sala)return;
  let i=IDX.get(q.id);
  if(i===undefined){i=G.ps.length;if(i>=8)return;IDX.set(q.id,i)}
  if(G.ps[i]&&!G.ps[i].fora)return;
  entra(i,f);ENTS[i]=null;potesViu[i]=0;comidasViu[i]=0;m.ficha=f;m.lvl=f.c.lvl;
  bc('porta',{id:q.id,i,semente:G.semente,h:G.caca,ps:G.ps.map(p=>({nome:p.nome,cl:p.cl,c:{lvl:p.c.lvl,equip:p.c.equip},up:{}}))});
  ritmo=0;mandaMembros();avisa();
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
  else if(ev==='entro'&&q&&typeof q.id==='string')abrePorta(q);
  else if(ev==='ent'&&q&&correndo()){
    const i=IDX.get(q.id);if(!i)return;
    const e=ENTS[i]||(ENTS[i]={x:0,y:0,held:[false,false,false,false],pos:{x:0,y:0},f:0});
    const h=q.h|0;for(let k=0;k<4;k++)e.held[k]=!!(h&(1<<k));
    /* a mira de cada espaço (sem ela, para onde ele olha) e quão longe */
    e.mira=e.mira||[NaN,NaN,NaN,NaN];e.alc=e.alc||[1,1,1,1];
    for(let k=0;k<4;k++){const a=Array.isArray(q.ma)?q.ma[k]:null,d=Array.isArray(q.md)?q.md[k]:100;
      e.mira[k]=Number.isFinite(a)?a/100:NaN;e.alc[k]=Number.isFinite(d)?Math.max(0,Math.min(1,d/100)):1}
    /* o sqm em que o convidado diz estar; o anfitrião só anda até lá pela regra */
    if(Number.isInteger(q.x)&&Number.isInteger(q.y)){e.pos=e.pos||{x:0,y:0};e.pos.x=Math.max(0,Math.min(63,q.x));e.pos.y=Math.max(0,Math.min(63,q.y))}
    e.f=Number.isFinite(q.f)?q.f/100:e.f;
    /* a poção é um contador: cada aumento é um gole, mesmo que uma mensagem se perca */
    const n=q.pot|0;if(n>(potesViu[i]||0)){potesViu[i]=n;drinkPot(G.ps[i])}
    const c=q.com|0;if(c>(comidasViu[i]||0)){comidasViu[i]=c;comer(G.ps[i])}
  }
}
const mandaMembros=()=>bc('membros',{h:SALA.caca,lista:SALA.membros.map(m=>({id:m.id,nome:m.nome,cl:m.cl,lvl:m.lvl,d:dentro(m.id)?1:0}))});
function tira(id){
  const i=SALA.membros.findIndex(m=>m.id===id);if(i<1)return;
  const m=SALA.membros.splice(i,1)[0];log(`${m.nome} saiu da sua sala.`,'info');
  /* quem fecha o jogo dentro da masmorra some dela, sem resultado */
  const k=IDX.get(id);if(k){ENTS[k]=null;if(G&&G.sala&&G.ps[k]&&!G.ps[k].fora)G.ps[k].fora='fora'}
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
    if(q.h!==undefined)SALA.caca=cacaDe(q.h);
    SALA.membros=q.lista.slice(0,MAX).filter(m=>m&&CLASSES[m.cl]).map(m=>({id:String(m.id),nome:String(m.nome||'').slice(0,20),cl:m.cl,lvl:m.lvl|0,d:m.d?1:0}));
    if(vazia&&SALA.membros.length)log(`Você entrou na sala de ${SALA.membros[0].nome}. A masmorra dela está aberta: entre pela porta, no Guia de caça.`,'info');
    if(JSON.stringify(SALA.membros)!==antes)avisa();
  }else if(ev==='cheia'&&q&&q.id===ID){log('A sala está cheia.','warn');solta()}
  else if(ev==='fecha'){if(correndo())ganchos.aborta('O anfitrião fechou a sala.');log('O anfitrião fechou a sala.','warn');solta()}
  else if(ev==='porta'&&q&&q.id===ID&&Array.isArray(q.ps)){
    /* a porta abriu para mim: a masmorra é a mesma semente, e eu sou o i */
    pedindo=false;if(correndo())return;
    const i=q.i|0,fichas=q.ps.slice(0,8).map((f,k)=>k===i?confereFicha(minhaFicha()):confereFicha(f));
    if(i<0||i>=fichas.length||fichas.some(f=>!f))return;
    eu=i;potes=0;comidas=0;ritmo=0;SALA.caca=cacaDe(q.h);ganchos.comeca(q.semente>>>0,fichas,eu,SALA.caca);
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
    if(Array.isArray(r.c.slots))c.slots=[0,1,2,3].map(i=>{const k=r.c.slots[i];return SPELLS[k]&&SPELLS[k].c===save.classe&&SPELLS[k].lvl<=c.lvl&&c.sabe.includes(k)?k:null});
  }
  const bag={};if(r.bag&&typeof r.bag==='object')for(const[k,q]of Object.entries(r.bag))if(ITEMS[k]&&n(q))bag[k]=n(q);
  p.bag=bag;p.bagVal=n(r.bagVal);p.sealed=n(r.sealed);p.xpPerdido=n(r.xpPerdido);p.kills=n(r.kills);p.xpGain=n(r.xpGain);p.magGain=n(r.magGain);p.perGain=n(r.perGain);
  p.fora=kind;p.c=c;
  /* a mochila sai como o anfitrião contou, ou fica na masmorra */
  if(kind==='extraiu'){c.mochila=Object.assign({},bag);save.ext++;save.best=Math.max(save.best,valMochila(bag)-valMochila(p.bag0||{}))}
  else{c.mochila={};save.deaths++;save.cofre+=p.sealed}
  persist();
  G.over=true;G.end=kind;G.dur=G.t;
  ganchos.fim(kind);
}
/* a entrada do convidado: o sqm em que está (ele anda no próprio aparelho), direção,
   espaços segurados, a mira de cada um e quantas poções e comidas pediu */
export const pocao=()=>{potes++};
export const comida=()=>{comidas++};
function mandaEnt(ent){
  const p=G.p;let h=0;for(let k=0;k<4;k++)if(ent.held[k])h|=1<<k;
  const ma=[0,1,2,3].map(k=>ent.mira&&Number.isFinite(ent.mira[k])?Math.round(ent.mira[k]*100):null),md=(ent.alc||[1,1,1,1]).map(v=>Math.round(v*100));
  bc('ent',{id:ID,x:p.tx,y:p.ty,f:Math.round(p.face*100),h,ma,md,pot:potes,com:comidas});
}

/* ---------- canal ---------- */
const expulso=d=>d.event==='phx_error'||d.event==='phx_close'||(d.event==='system'&&d.payload&&d.payload.status==='error')||(d.event==='phx_reply'&&d.ref!=='1'&&d.payload&&d.payload.status==='error');
function recebe(d){
  const p=d.payload||{};
  if(expulso(d)){const s=ws;ws=null;caiu();try{s&&s.close()}catch(e){}return}
  if(d.event==='phx_reply'&&d.ref==='1'){
    if(p.status!=='ok'){SALA.estado='sem rede';SALA.aoMudar();return}
    pronto=true;SALA.estado='ligado';SALA.aoMudar();
    manda('presence',{type:'presence',event:'track',payload:{anf:SALA.papel==='anfitriao'}});
    if(SALA.papel==='convidado')bc('quero',{id:ID,ficha:minhaFicha()});else mandaMembros();
  }else if(d.event==='presence_diff'&&SALA.papel==='anfitriao'){
    for(const id in p.leaves||{})if(!(p.joins&&p.joins[id]))tira(id);
  }else if(d.event==='broadcast'&&p.event==='voz')recebeVoz(p.payload);
  else if(d.event==='broadcast'&&p.event){
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
    if(ritmo<=0){
      /* com convidado lá dentro, o retrato a 10 por segundo (que também diz
         aos de fora que a sala vive); sem ninguém, só a lista a cada 5 s */
      let algum=false;if(correndo())for(let i=1;i<G.ps.length;i++)if(!G.ps[i].fora){algum=true;break}
      if(algum){ritmo=RITMO;bc('estado',retrato())}else{ritmo=5;mandaMembros()}
      const dd=JSON.stringify(SALA.membros.map(m=>dentro(m.id)));if(dd!==ultDentro){ultDentro=dd;mandaMembros();SALA.aoMudar()}
    }
    return}
  /* convidado: sem notícia do anfitrião por PACIENCIA segundos, a sala acabou */
  semAnf+=dt;
  /* a porta não respondeu (sala cheia de gente dentro): dá para pedir de novo */
  if(pedindo&&(pedT+=dt)>5){pedindo=false;pedT=0;log('A porta da sala não abriu. Tente de novo.','warn')}
  if(correndo()&&G.convidado&&ritmo<=0){ritmo=RITMO;mandaEnt(ent)}
  if(semAnf>PACIENCIA){
    if(correndo()&&G.convidado)ganchos.aborta('A conexão com o anfitrião caiu.');
    log('A sala fechou: o anfitrião saiu do jogo.','warn');solta()}
}
