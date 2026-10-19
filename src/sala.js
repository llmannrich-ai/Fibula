/* ---------- sala: caçar junto ----------
   Teste do co-op na masmorra sem servidor próprio (decisão do Leonardo em
   19/10/2026, opção C do plano do multiplayer): quem cria a sala é o
   ANFITRIÃO, e o aparelho dele roda a regra da incursão para todos, a mesma
   src/sim/ de sempre com várias fichas. Os CONVIDADOS mandam só a entrada
   (posição, habilidades seguradas, poção) e desenham o retrato que o
   anfitrião manda. O canal é o Realtime do Supabase, um por sala, pelo
   WebSocket nativo, como a cidade (src/rede.js).
   A sala fica aberta enquanto houver alguém nela; quem está na cidade a vê
   no Guia de caça. Se o anfitrião sai (da sala, do jogo ou da rede), o
   convidado mais antigo vira o anfitrião: a sala segue no mesmo canal, e a
   masmorra também. O anfitrião manda a herança (o estado inteiro da regra,
   heranca() em src/sim/incursao.js) a cada segundo e ao passar a sala; quem
   assume a adota e segue rodando, e quem estava lá dentro nem sai (volta no
   máximo um segundo). Sem herança (entrou agora), abre uma masmorra nova e
   quem estava dentro volta à cidade sem resultado. Cada troca sobe SALA.gen; se dois aparelhos se acharem anfitrião, fica o de
   geração maior e, empatados, o de id menor. Só o anfitrião pode trapacear (é ele quem
   calcula), e cada um grava o próprio save com o resultado que o anfitrião
   mandou: serve para jogar com amigos, não com desconhecidos — isso é a M2.
   A sala é de um mapa de caça (SALA.caca: o Esgoto, a Ilha, a Cripta...), e
   é uma só por lugar (decisão do Leonardo em 19/10/2026): o canal é o do
   mapa (sala-<x.y>-<mapa>-<cópia>), e quem pisa no portal do lugar (vaiCaca)
   procura quem está rodando aquele canal. Achou, entra no servidor dele;
   não achou, vira o servidor. Cheio (MAX), vai para a cópia seguinte. O
   anfitrião é sempre alguém lá dentro: quem sai passa o servidor, com a
   herança, a quem ficou; o último a sair continua com ele (a masmorra segue
   rodando no aparelho dele, na cidade) até alguém entrar e receber o
   servidor, ou até ele ir embora. Convidado que sai da masmorra sai da sala.
   A masmorra da sala nasce com ela e não tem tempo ("masmorra aberta" em
   src/sim/incursao.js): cada um entra e sai pela porta quando quiser, e ela
   acaba quando o anfitrião sai da sala (na cidade) ou do jogo.
   Mensagens (broadcast): quero (pedir para ficar na sala, com a ficha),
   membros (a lista, com quem está dentro), entro (convidado na porta),
   porta (a resposta: semente e quem está dentro), ent (entrada do
   convidado), estado (o retrato), fim (o resultado de quem saiu), log,
   heranca (o estado da masmorra, para quem assumir), passa (o anfitrião sai
   e diz quem fica no lugar, com a herança) e fecha (saiu sozinho),
   e voz (a apresentação da voz entre dois aparelhos, src/voz.js). */

import {CLASSES,ITEMS,SPELLS,HUNTS,cacaDe} from './sim/dados.js?v=0.48.0';
import {save,ch,confereFicha,valMochila} from './sim/progresso.js?v=0.48.0';
import {G,newRun,entra,retrato,aplicaRetrato,fichaLocal,heranca,adota,solid,arenaFechada,reabreEm,meuTime} from './sim/incursao.js?v=0.48.0';
import {novaSemente} from './sim/base.js?v=0.48.0';
import {drinkPot,comer} from './sim/combate.js?v=0.48.0';
import {SB_URL,SB_KEY,quemSou} from './nuvem.js?v=0.48.0';
import {rede,ID,anuncia} from './rede.js?v=0.48.0';
import {persist} from './salvar.js?v=0.48.0';
import {log} from './hud.js?v=0.48.0';
import {recebeVoz,desligaVoz} from './voz.js?v=0.48.0';

const VER=(()=>{try{return(new URL(import.meta.url).searchParams.get('v')||'dev').split('.').slice(0,2).join('.')}catch(e){return 'dev'}})();
/* 4 jogadores no máximo; retrato e entrada a 10 por segundo: com 4, ~40
   envios por segundo no canal, abaixo dos ~100 que o plano Free aceita */
export const MAX=4;
/* a Arena cabe mais gente (arena.max, até 8): com 8, ~80 envios por segundo */
export const maxSala=(k=SALA.caca)=>HUNTS[k]&&HUNTS[k].arena?HUNTS[k].arena.max:MAX;
const RITMO=.1,BATIDA=25,PACIENCIA=12,HERDA=1;
/* papel: null (fora de sala), 'anfitriao' ou 'convidado'. id: o canal da
   sala, que não muda com o anfitrião; anf: o anfitrião de agora; gen: quantas
   vezes ele mudou; caca: o mapa de caça. membros: quem está na sala, o
   anfitrião primeiro e os outros por ordem de chegada: {id, nome, cl, lvl,
   ficha (só no anfitrião)} */
export const SALA={papel:null,id:null,n:1,anf:null,gen:0,caca:null,membros:[],estado:'fora',auto:false,aoMudar(){}};
/* o anfitrião já esteve lá dentro e saiu: é o último que saiu */
let jaSaiu=false,dentroAntes=false;
/* procT: quanto se esperou pela presença do canal antes de decidir;
   foraT: quanto o convidado está na cidade sem pedir a porta */
let procT=0,foraT=0;
let ultHer=null,herT=0,ultDentro='',pedindo=false,pedT=0,ws=null,ref=0,pronto=false,espera=0,tenta=0,batida=0,ritmo=0,semAnf=0,potes=0,potesViu=[],comidas=0,comidasViu=[];
/* no anfitrião, durante a incursão da sala: o índice em G.ps de cada id, a
   entrada de cada convidado e quem já recebeu o resultado */
const IDX=new Map(),ENTS=[];
/* o lugar deste aparelho em G.ps: 0 para quem criou a sala, outro para quem
   a herdou */
const meuI=()=>IDX.has(ID)?IDX.get(ID):0;
/* a herança vai com quem é quem (o id de cada lugar de G.ps) e as poções e
   comidas já vistas de cada um, para o próximo anfitrião não repetir */
const pacote=()=>{const ids=[];for(const[id,i]of IDX)ids[i]=id;return{anf:ID,ids,pot:potesViu.slice(),com:comidasViu.slice(),h:heranca()}};
const topico=()=>'realtime:sala-'+VER+'-'+SALA.id;
const manda=(event,payload,topic=topico())=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}))};
const bc=(event,payload)=>manda('broadcast',{type:'broadcast',event,payload});
/* a apresentação da voz (src/voz.js) passa por este canal */
export const sinal=q=>{if(pronto)bc('voz',Object.assign({de:ID},q))};
const nomeMeu=()=>quemSou()||CLASSES[save.classe].nome;
const minhaFicha=()=>({nome:nomeMeu(),time:meuTime,cl:save.classe,c:JSON.parse(JSON.stringify(ch())),up:Object.assign({},save.up),prov:Object.assign({},save.prov)});
const avisa=()=>{rede.sala=SALA.papel==='anfitriao'?{n:SALA.membros.length,h:SALA.caca,id:SALA.id}:null;rede.naSala=SALA.papel?Math.max(1,SALA.membros.length):0;anuncia();SALA.aoMudar()};

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
  ws=null;pronto=false;pedindo=false;ultHer=null;SALA.papel=null;SALA.id=null;SALA.n=1;SALA.anf=null;SALA.gen=0;SALA.caca=null;SALA.membros=[];SALA.estado='fora';SALA.auto=false;IDX.clear();ENTS.length=0;avisa();
}

/* ---------- o que o jogador faz ---------- */
/* a masmorra da sala, vazia, no aparelho do anfitrião, no mapa de caça dela */
function abreMasmorra(){
  newRun(novaSemente(),[fichaLocal()],true,SALA.caca);G.ps[0].fora='fora';G.active=true;G.sala=true;
  IDX.clear();ENTS.length=0;potesViu=[];comidasViu=[];IDX.set(ID,0);ritmo=0;herT=0;ultDentro='';
}
/* o canal de cada lugar: sala-<x.y>-<mapa>-<cópia> */
const canal=(caca,n)=>caca+'-'+n;
/* criar a sala abre a masmorra dela, no mapa de caça escolhido, na cópia n
   do canal daquele lugar. Quem pisa no portal não chama isto direto: procura
   antes quem já está lá (vaiCaca) */
export function criaSala(caca,n=1){
  if(SALA.papel)return;
  SALA.caca=cacaDe(caca);SALA.n=n;SALA.id=canal(SALA.caca,n);
  viraServidor();liga();
}
function viraServidor(){
  jaSaiu=false;dentroAntes=false;
  SALA.papel='anfitriao';SALA.anf=ID;SALA.gen=0;SALA.auto=false;SALA.membros=[{id:ID,nome:nomeMeu(),cl:save.classe,lvl:ch().lvl}];
  abreMasmorra();
  if(pronto){manda('presence',{type:'presence',event:'track',payload:{anf:true}});mandaMembros()}
  avisa();
}
/* pisar no portal do lugar k: já na sala dele, entra pela porta; noutra,
   sai dela; fora de sala, procura no canal do lugar quem está rodando a
   masmorra (a presença com anf), e entra no servidor dele ou vira o servidor */
export function vaiCaca(k,n=1){
  k=cacaDe(k);
  if(SALA.papel==='procura')return;
  if(SALA.papel&&SALA.caca===k){
    if(SALA.papel==='anfitriao')ganchos.entra();else if(!correndo()&&entraPorta())log(`Entrando em ${HUNTS[k].nome}…`,'info');
    return}
  if(SALA.papel)saiDaSala();
  SALA.papel='procura';SALA.caca=k;SALA.n=n;SALA.id=canal(k,n);SALA.membros=[];procT=0;
  liga();SALA.aoMudar();log(n>1?`${HUNTS[k].nome} está cheio. Procurando lugar na cópia ${n}…`:`Entrando em ${HUNTS[k].nome}…`,'info');
}
/* a presença do canal diz se há servidor: quem roda a masmorra anuncia anf */
function decide(estado){
  if(SALA.papel!=='procura')return;
  let tem=false;if(estado)for(const id in estado){if(id===ID)continue;const ms=estado[id]&&estado[id].metas;if(Array.isArray(ms)&&ms.some(m=>m&&m.anf===true)){tem=true;break}}
  if(tem){
    SALA.papel='convidado';SALA.anf=null;SALA.gen=0;SALA.auto=true;semAnf=0;
    manda('presence',{type:'presence',event:'track',payload:{anf:false}});bc('quero',{id:ID,ficha:minhaFicha()});avisa();
  }else{viraServidor();ganchos.entra()}
}
/* quem está dentro da masmorra da sala agora */
export const dentro=id=>{const i=IDX.get(id);return SALA.papel==='anfitriao'?!!(G&&G.sala&&i!==undefined&&G.ps[i]&&!G.ps[i].fora):!!(SALA.membros.find(m=>m.id===id)||{}).d};
/* a porta: o anfitrião entra direto; o convidado pede e espera a resposta */
/* a porta da Arena fecha no meio da partida: quanto falta para reabrir */
const mmss=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export const avisoFechada=s=>`A entrada da Arena está fechada: a próxima partida começa em ${mmss(s)}.`;
export function entraPorta(){
  if(SALA.papel==='anfitriao'&&arenaFechada()){log(avisoFechada(reabreEm()),'warn');return false}
  if(SALA.papel==='anfitriao'){const i=meuI(),p=entra(i,fichaLocal());G.p=p;ENTS[i]=null;return true}
  if(SALA.papel==='convidado'&&pronto&&!pedindo){pedindo=true;pedT=0;bc('entro',{id:ID,ficha:minhaFicha()});return true}
  return false;
}
export function entraSala(id,caca){
  if(SALA.papel||typeof id!=='string'||!id)return;
  SALA.papel='convidado';SALA.id=id;SALA.anf=null;SALA.gen=0;SALA.caca=cacaDe(caca);SALA.membros=[];semAnf=0;liga();avisa();
}
/* passar o servidor a quem está lá dentro (o mais antigo), com a herança, e
   sair da sala: o anfitrião é sempre alguém que está caçando, se houver */
function passaPara(prox){
  const resto=SALA.membros.filter(m=>m.id!==ID&&m.id!==prox.id);
  bc('passa',{anf:prox.id,gen:SALA.gen+1,lista:[prox,...resto].map(semFicha),her:pacote()});
  if(G&&G.sala)G.active=false;
  solta();
}
/* o anfitrião sai: com mais gente, passa a sala ao convidado mais antigo;
   sozinho, fecha. A masmorra dele acaba (quem estava dentro volta à cidade
   sem resultado). O convidado só sai */
export function saiDaSala(){
  if(!SALA.papel)return;
  const era=SALA.papel,resto=SALA.membros.filter(m=>m.id!==ID),prox=resto[0];
  desligaVoz(false);
  if(era==='anfitriao'){
    if(prox)bc('passa',{anf:prox.id,gen:SALA.gen+1,lista:resto.map(semFicha),her:G&&G.sala&&!G.over?pacote():null});else bc('fecha',{});
    if(G&&G.sala){G.over=true;G.active=false}
  }else bc('saio',{id:ID});
  solta();log(era!=='anfitriao'?'Você saiu da sala.':prox?`Você saiu da sala. ${prox.nome} agora é o anfitrião.`:'Você fechou a sala.','info');
}
export const correndo=()=>!!(G&&G.sala&&G.active&&!G.over);

/* ---------- anfitrião ---------- */
/* um convidado na porta: entra com a ficha que mandou, conferida, no mesmo
   lugar de G.ps de antes (ou num novo), e recebe a semente e quem está lá */
function abrePorta(q){
  const m=SALA.membros.find(x=>x.id===q.id),f=confereFicha(q.ficha);
  if(!m||!f||!G||!G.sala)return;
  if(arenaFechada()){bc('fechada',{id:q.id,s:Math.ceil(reabreEm())});return}
  let i=IDX.get(q.id);
  if(i===undefined){i=G.ps.length;if(i>=8){bc('cheia',{id:q.id});return}IDX.set(q.id,i)}
  if(G.ps[i]&&!G.ps[i].fora)return;
  entra(i,f);ENTS[i]=null;potesViu[i]=0;comidasViu[i]=0;m.ficha=f;m.lvl=f.c.lvl;
  bc('porta',{id:q.id,i,semente:G.semente,h:G.caca,ps:G.ps.map(p=>({nome:p.nome,cl:p.cl,c:{lvl:p.c.lvl,equip:p.c.equip},up:{}}))});
  ritmo=0;mandaMembros();avisa();
}
/* a entrada de cada jogador para passo(): a deste aparelho e a última de
   cada convidado */
export function entradas(local){
  if(!correndo()||SALA.papel!=='anfitriao')return local;
  const m=meuI();ENTS[m]=local;for(let i=0;i<G.ps.length;i++)if(i!==m&&!ENTS[i])ENTS[i]={x:0,y:0,held:[false,false,false,false]};
  return ENTS;
}
/* o resultado de um convidado que saiu, para o save dele */
function mandaFim(p){
  const id=[...IDX].find(([,i])=>i===p.id);if(!id)return;
  const c=p.c;
  bc('fim',{id:id[0],r:{fora:p.fora,bag:p.bag,bagVal:p.bagVal,sealed:p.sealed,xpPerdido:p.xpPerdido,kills:p.kills,pk:p.pk,xpGain:p.xpGain,magGain:p.magGain,perGain:p.perGain,
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
    else if(SALA.membros.length>=maxSala()){bc('cheia',{id:q.id});return}
    else{SALA.membros.push({id:q.id,nome:f.nome,cl:f.cl,lvl:f.c.lvl,ficha:f});log(`${f.nome} entrou na sua sala.`,'info')}
    mandaMembros();avisa();
  }else if(ev==='membros'&&q&&typeof q.anf==='string'&&q.anf!==ID&&Array.isArray(q.lista)){
    /* outro aparelho se acha anfitrião (a rede caiu e voltou no meio de uma
       troca): fica o de geração maior e, empatados, o de id menor */
    const g=q.gen|0;if(g>SALA.gen||(g===SALA.gen&&q.anf<ID))cede(q);
  }else if(ev==='saio'&&q)tira(q.id);
  else if(ev==='entro'&&q&&typeof q.id==='string')abrePorta(q);
  else if(ev==='ent'&&q&&correndo()){
    const i=IDX.get(q.id);if(i===undefined||q.id===ID)return;
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
const semFicha=m=>({id:m.id,nome:m.nome,cl:m.cl,lvl:m.lvl,d:dentro(m.id)?1:0});
const mandaMembros=()=>bc('membros',{anf:ID,gen:SALA.gen,s:G&&G.sala?G.semente:0,h:SALA.caca,lista:SALA.membros.map(semFicha)});
function tira(id){
  const i=SALA.membros.findIndex(m=>m.id===id);if(i<1)return;
  const m=SALA.membros.splice(i,1)[0];log(`${m.nome} saiu da sua sala.`,'info');
  /* quem fecha o jogo dentro da masmorra some dela, sem resultado */
  const k=IDX.get(id);if(k!==undefined&&id!==ID){ENTS[k]=null;if(G&&G.sala&&G.ps[k]&&!G.ps[k].fora)G.ps[k].fora='fora'}
  mandaMembros();avisa();
}

/* ---------- convidado ---------- */
let eu=-1;
/* o src/telas.js liga isto: começar a incursão da sala e mostrar o fim */
export const ganchos={comeca(){},fim(){},aborta(){},banner(){},entra(){}};
const limpa=l=>l.slice(0,8).filter(m=>m&&CLASSES[m.cl]).map(m=>({id:String(m.id),nome:String(m.nome||'').slice(0,20),cl:m.cl,lvl:m.lvl|0,d:m.d?1:0}));
/* o anfitrião mudou: quem estava na masmorra dele volta à cidade, porque a
   regra dela morava lá; se o novo sou eu, a sala passa a rodar aqui */
function troca(anf,gen,motivo){
  const velho=SALA.anf;
  SALA.gen=gen;pedindo=false;
  if(anf===ID){assume(velho,motivo);return}
  SALA.anf=anf;semAnf=0;
  const m=SALA.membros.find(x=>x.id===anf);if(m)log(`${m.nome} agora é o anfitrião da sala.`,'info');
  if(!SALA.membros.some(x=>x.id===ID))bc('quero',{id:ID,ficha:minhaFicha()});
  avisa();
}
/* o anfitrião sumiu sem passar a sala: fica o convidado mais antigo. Quem
   está na masmorra continua lá: o novo anfitrião a herda (e, se não puder,
   avisa com a semente nova na lista, e aí quem está dentro volta) */
function sucede(motivo){
  const tinha=!!SALA.anf;SALA.membros=SALA.membros.filter(m=>m.id!==SALA.anf);
  if(!tinha||!SALA.membros.length){if(correndo()&&G.convidado)ganchos.aborta(motivo);log('A sala fechou: o anfitrião saiu do jogo.','warn');solta();return}
  troca(SALA.membros[0].id,SALA.gen+1,motivo);
}
/* este aparelho vira o anfitrião: adota a última herança e a masmorra segue
   rodando aqui, com cada um no mesmo lugar de G.ps; quem saiu fica de fora
   dela, como quem fecha o jogo lá dentro */
function assume(velho,motivo){
  SALA.papel='anfitriao';SALA.anf=ID;jaSaiu=false;dentroAntes=false;
  const i=SALA.membros.findIndex(m=>m.id===ID);
  if(i>0)SALA.membros.unshift(SALA.membros.splice(i,1)[0]);else if(i<0)SALA.membros.unshift({id:ID,nome:nomeMeu(),cl:save.classe,lvl:ch().lvl});
  const her=ultHer,dentroEu=correndo()&&G.convidado&&!G.p.fora,px=dentroEu?G.p.tx:0,py=dentroEu?G.p.ty:0;
  const ids=her&&Array.isArray(her.ids)?her.ids.map(x=>typeof x==='string'?x:null):[];
  /* quem estava lá dentro continua no lugar dele; quem estava na cidade
     herda de fora (eu<0) e entra pela porta quando quiser */
  let eu=ids.indexOf(ID);
  if(eu>=0&&!dentroEu)eu=-1;
  if(her&&adota(her.h,eu,fichaLocal())){
    IDX.clear();ENTS.length=0;ids.forEach((id,k)=>{if(id&&k<G.ps.length)IDX.set(id,k)});
    potesViu=Array.isArray(her.pot)?her.pot.map(v=>v|0):[];comidasViu=Array.isArray(her.com)?her.com.map(v=>v|0):[];
    if(eu<0){const k=IDX.has(ID)?IDX.get(ID):G.ps.length;entra(k,fichaLocal());G.ps[k].fora='fora';G.p=G.ps[k];IDX.set(ID,k)}
    const k=velho?IDX.get(velho):undefined;if(k!==undefined&&G.ps[k]&&!G.ps[k].fora)G.ps[k].fora='fora';
    /* quem estava dentro fica no sqm em que já estava neste aparelho */
    if(dentroEu&&!solid(px,py)&&(G.p.tx!==px||G.p.ty!==py)){const p=G.p;p.tx=px;p.ty=py;p.x=p.x0=p.ox=(px+.5)*32;p.y=p.y0=p.oy=(py+.5)*32;p.sd=0;p.st=0}
    G.active=true;G.sala=true;ritmo=0;herT=0;ultDentro='';
    log('Agora você é o anfitrião da sala: a masmorra continua, rodando no seu aparelho.','info');
  }else{
    if(dentroEu)ganchos.aborta(motivo);
    abreMasmorra();
    log('Agora você é o anfitrião da sala: a masmorra dela roda no seu aparelho.','info');
  }
  ultHer=null;
  manda('presence',{type:'presence',event:'track',payload:{anf:true}});
  mandaMembros();avisa();
}
/* no anfitrião que perdeu a disputa: vira convidado de quem ganhou */
function cede(q){
  if(G&&G.sala){if(G.p&&!G.p.fora)ganchos.aborta('A sala mudou de anfitrião.');G.over=true;G.active=false}
  SALA.papel='convidado';SALA.membros=limpa(q.lista);IDX.clear();ENTS.length=0;SALA.auto=true;
  manda('presence',{type:'presence',event:'track',payload:{anf:false}});
  troca(q.anf,q.gen|0,'A sala mudou de anfitrião.');
}
function recebeConv(ev,q){
  if(ev==='estado'||ev==='log')semAnf=0;
  if(ev==='membros'&&q&&Array.isArray(q.lista)){
    /* só vale a lista do anfitrião de agora, ou de um que o substituiu */
    const anf=typeof q.anf==='string'?q.anf:q.lista[0]&&String(q.lista[0].id),g=q.gen|0;
    if(!anf||(SALA.anf&&anf!==SALA.anf&&!(g>SALA.gen||(g===SALA.gen&&anf<SALA.anf))))return;
    /* o anfitrião abriu outra masmorra (assumiu sem herança): quem estava na
       velha volta à cidade */
    if(q.s&&correndo()&&G.convidado&&(q.s>>>0)!==G.semente)ganchos.aborta('A masmorra da sala mudou.');
    semAnf=0;
    const antes=JSON.stringify(SALA.membros),vazia=!SALA.anf;
    SALA.membros=limpa(q.lista);
    if(!vazia&&anf!==SALA.anf){troca(anf,g,'A sala mudou de anfitrião.');return}
    SALA.anf=anf;SALA.gen=Math.max(SALA.gen,g);
    if(q.h!==undefined)SALA.caca=cacaDe(q.h);
    if(JSON.stringify(SALA.membros)!==antes)avisa();
    /* quem veio pelo portal entra sozinho, assim que o servidor o aceita */
    if(SALA.auto&&SALA.membros.some(m=>m.id===ID)&&!correndo()&&!pedindo){SALA.auto=false;if(SALA.membros[0])log(`${SALA.membros[0].nome} já caça aqui: você entra junto.`,'info');entraPorta()}
  }else if(ev==='heranca'&&q&&q.anf===SALA.anf&&q.h&&typeof q.h==='object')ultHer=q;
  else if(ev==='passa'&&q&&typeof q.anf==='string'&&Array.isArray(q.lista)&&(q.gen|0)>SALA.gen){
    if(q.her&&typeof q.her==='object'&&q.her.h)ultHer=q.her;
    SALA.membros=limpa(q.lista);troca(q.anf,q.gen|0,'O anfitrião saiu da sala.');
  }else if(ev==='cheia'&&q&&q.id===ID){
    /* lotado: a cópia seguinte do mesmo lugar */
    const k=SALA.caca,n=SALA.n||1;solta();if(n<9)vaiCaca(k,n+1);else log('Todos os lugares deste mapa estão cheios.','warn')}
  else if(ev==='fechada'&&q&&q.id===ID){pedindo=false;SALA.auto=false;log(avisoFechada(Math.max(0,q.s|0)),'warn')}
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
  p.bag=bag;p.bagVal=n(r.bagVal);p.sealed=n(r.sealed);p.xpPerdido=n(r.xpPerdido);p.kills=n(r.kills);p.pk=n(r.pk);p.xpGain=n(r.xpGain);p.magGain=n(r.magGain);p.perGain=n(r.perGain);
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
    /* procurando: espera a presença do canal para saber se há servidor */
    if(SALA.papel==='procura')return;
    manda('presence',{type:'presence',event:'track',payload:{anf:SALA.papel==='anfitriao'}});
    if(SALA.papel==='convidado')bc('quero',{id:ID,ficha:minhaFicha()});else mandaMembros();
  }else if(d.event==='presence_state'&&SALA.papel==='procura'){decide(p)
  }else if(d.event==='presence_diff'&&SALA.papel==='anfitriao'){
    for(const id in p.leaves||{})if(!(p.joins&&p.joins[id]))tira(id);
  }else if(d.event==='presence_diff'&&SALA.papel==='convidado'){
    /* o convidado também vê quem sai: se é o anfitrião, a sala passa adiante
       sem esperar a PACIENCIA; se é outro, ele sai da lista daqui */
    for(const id in p.leaves||{}){
      if(SALA.papel!=='convidado')break;
      if(id===ID||(p.joins&&p.joins[id]))continue;
      if(id===SALA.anf)sucede('A conexão com o anfitrião caiu.');
      else{const n=SALA.membros.length;SALA.membros=SALA.membros.filter(m=>m.id!==id);if(SALA.membros.length!==n)avisa()}
    }
  }else if(d.event==='broadcast'&&p.event==='voz')recebeVoz(p.payload);
  else if(d.event==='broadcast'&&p.event){
    if(SALA.papel==='anfitriao')recebeAnf(p.event,p.payload);else recebeConv(p.event,p.payload);
  }
}
/* chamado pelo laço a cada quadro, com a entrada deste aparelho */
export function quadro(dt,ent){
  if(!SALA.papel)return;
  /* sem resposta do canal (sem rede, ou presença que não veio), a masmorra
     abre aqui mesmo: caçar não depende da rede */
  if(SALA.papel==='procura'){procT+=dt;if(procT>(pronto?2:4))decide(null)}
  if(!ws){espera-=dt;if(espera<=0)liga();return}
  if(!pronto)return;
  batida-=dt;if(batida<=0){batida=BATIDA;manda('heartbeat',{},'phoenix')}
  if(SALA.papel==='procura')return;
  ritmo-=dt;
  /* o anfitrião manda o retrato na incursão e, fora dela, a lista a cada 5 s,
     que é como o convidado sabe que a sala continua aberta */
  if(SALA.papel==='anfitriao'){
    /* o anfitrião saiu da masmorra e há gente lá dentro: o servidor passa a
       quem está caçando. Sem ninguém, fica com ele, o último que saiu */
    if(correndo()){const me=G.ps[meuI()],den=!!(me&&!me.fora);if(dentroAntes&&!den)jaSaiu=true;dentroAntes=den;
      if(jaSaiu&&!den){const prox=SALA.membros.find(m=>m.id!==ID&&dentro(m.id));if(prox){passaPara(prox);return}}}
    if(ritmo<=0){
      /* com convidado lá dentro, o retrato a 10 por segundo (que também diz
         aos de fora que a sala vive); sem ninguém, só a lista a cada 5 s */
      const eu=meuI();let algum=false;if(correndo())for(let i=0;i<G.ps.length;i++)if(i!==eu&&!G.ps[i].fora){algum=true;break}
      if(algum){ritmo=RITMO;bc('estado',retrato())}else{ritmo=5;mandaMembros()}
      const dd=JSON.stringify(SALA.membros.map(m=>dentro(m.id)));if(dd!==ultDentro){ultDentro=dd;mandaMembros();SALA.aoMudar()}
    }
    /* a herança: a cada segundo com alguém lá dentro, a cada 5 s sem ninguém,
       e só se houver para quem deixar */
    herT-=dt;if(herT<=0&&SALA.membros.length>1&&correndo()){
      const m=meuI();let algum=false;for(let i=0;i<G.ps.length;i++)if(i!==m&&!G.ps[i].fora){algum=true;break}
      herT=algum?HERDA:5;bc('heranca',pacote())}
    return}
  /* convidado: sem notícia do anfitrião por PACIENCIA segundos, a sala acabou */
  semAnf+=dt;
  /* a porta não respondeu (sala cheia de gente dentro): dá para pedir de novo */
  if(pedindo&&(pedT+=dt)>5){pedindo=false;pedT=0;log('A porta da sala não abriu. Tente de novo.','warn')}
  if(correndo()&&G.convidado&&ritmo<=0){ritmo=RITMO;mandaEnt(ent)}
  if(semAnf>PACIENCIA){sucede('A conexão com o anfitrião caiu.');return}
  /* convidado que saiu da masmorra (ou nunca entrou) sai da sala: para caçar
     de novo, pisa no portal */
  if(SALA.papel==='convidado'&&!correndo()&&!pedindo&&!SALA.auto){foraT+=dt;if(foraT>3){foraT=0;bc('saio',{id:ID});desligaVoz(false);solta()}}else foraT=0;
}
