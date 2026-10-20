/* ---------- saguão: as salas da Arena ----------
   Decisão do Leonardo em 20/10/2026: no menu, não no mapa, quem quer jogar a
   Arena junto cria uma sala, e os outros veem as salas abertas, entram, veem
   quem está em cada uma e escolhem a equipe por uma das 4 cores. Só organiza:
   não decide regra nenhuma, e nada que valha ouro, XP ou item passa por aqui.
   Um canal do Realtime (realtime:saguao-<x.y>), só presença e um broadcast:
   - cada um anuncia na presença {sg, nome, cl, lvl, sala, quer}: a sala em que
     está (o ID do criador) e a cor que quer;
   - o criador anuncia também {dono: {nome, eq}}: o nome da sala e a equipe
     que ele confirmou para cada um (eq[id] = cor). "Pertence" é o que o dono
     confirmou; "quer" é o que cada um pediu;
   - Começar manda 'comeca': o dono abre a arena da sala (o canal arena-L<id>
     da sala de caça, src/sala.js) e quem está nela entra logo depois, com a cor
     da equipe como código de time, dentro dos 15 s da porta.
   O laço chama quadro(dt): liga com a tela aberta ou com sala, e desliga ao
   sair dela. */
import {CLASSES,HUNTS} from './sim/dados.js?v=0.51.0';
import {save,ch} from './sim/progresso.js?v=0.51.0';
import {poeTime} from './sim/incursao.js?v=0.51.0';
import {SB_URL,SB_KEY,quemSou} from './nuvem.js?v=0.51.0';
import {ID} from './rede.js?v=0.51.0';
import {vaiCaca,SALA,saiDaSala} from './sala.js?v=0.51.0';
import {log} from './hud.js?v=0.51.0';

const VER=(()=>{try{return(new URL(import.meta.url).searchParams.get('v')||'dev').split('.').slice(0,2).join('.')}catch(e){return 'dev'}})();
const TOPICO='realtime:saguao-'+VER,BATIDA=25;
/* as 4 equipes; o código é o time da Arena (poeTime) */
export const CORES=[{k:'VERMELHO',nome:'Vermelha',cor:'#c94a3f'},{k:'AZUL',nome:'Azul',cor:'#3f6fc9'},{k:'VERDE',nome:'Verde',cor:'#4a9a4f'},{k:'AMARELO',nome:'Amarela',cor:'#d8b43a'}];
const COR=new Set(CORES.map(c=>c.k));
/* SG.salas: [{id, nome, dono, membros: [{id, nome, cl, lvl, quer, eq}]}];
   SG.minha: o id da sala em que estou; SG.quer: a cor que pedi; SG.eq: as
   equipes que confirmei (só o dono) */
export const SG={estado:'fora',salas:[],minha:null,quer:null,nomeSala:'',eq:{},aberto:false,aoMudar(){}};
const PRES=new Map();
let ws=null,ref=0,pronto=false,espera=0,tenta=0,batida=0,vai=0,vaiK=null,saindo=0,viu=false,sumiu=0;
/* quanto se espera o criador voltar (a rede dele caiu) antes de dar a sala por fechada */
const FOLGA=10;

const manda=(event,payload)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({topic:TOPICO,event,payload,ref:String(++ref),join_ref:'1'}))};
/* sem controle nem caracteres que invertem a ordem do texto */
const nome=t=>String(t||'').replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,24);
const eu=()=>({sg:1,nome:quemSou()||CLASSES[save.classe].nome,cl:save.classe,lvl:ch().lvl,sala:SG.minha,quer:SG.quer,
  dono:SG.minha===ID?{nome:SG.nomeSala,eq:SG.eq}:null});
const presenca=()=>{if(pronto)manda('presence',{type:'presence',event:'track',payload:eu()})};
export const maxSaguao=()=>{const k=Object.keys(HUNTS).find(h=>HUNTS[h].arena);return k?HUNTS[k].arena.max:4};

/* o que chega de fora passa por aqui: nome cortado, classe e cor que existem */
function confere(id,m){
  if(!m||m.sg!==1||!CLASSES[m.cl])return null;
  const o={id,nome:nome(m.nome)||CLASSES[m.cl].nome,cl:m.cl,lvl:Math.max(1,Math.min(200,m.lvl|0)),sala:typeof m.sala==='string'?m.sala.slice(0,16):null,quer:COR.has(m.quer)?m.quer:null,dono:null};
  if(m.dono&&typeof m.dono==='object'&&o.sala===id){const eq={};if(m.dono.eq&&typeof m.dono.eq==='object')for(const[k,v]of Object.entries(m.dono.eq))if(COR.has(v))eq[String(k).slice(0,16)]=v;
    o.dono={nome:nome(m.dono.nome)||`Sala de ${o.nome}`,eq}}
  return o;
}
/* refaz a lista das salas a partir da presença de todos (e da minha) */
function monta(){
  const todos=[...PRES.values()],me=confere(ID,eu());if(me)todos.push(me);
  SG.salas=todos.filter(p=>p.dono).map(d=>({id:d.id,nome:d.dono.nome,dono:d.nome,eq:d.dono.eq,
    /* no máximo arena.max: o criador primeiro, depois por id (o mesmo corte em todo aparelho) */
    membros:todos.filter(p=>p.sala===d.id).sort((a,b)=>(b.id===d.id)-(a.id===d.id)||(a.id<b.id?-1:1)).slice(0,maxSaguao()).map(p=>({id:p.id,nome:p.nome,cl:p.cl,lvl:p.lvl,quer:p.quer,eq:d.dono.eq[p.id]||null}))}));
  /* a sala em que eu estava sumiu: espera FOLGA s pelo criador (a rede dele
     pode ter caído) e só então sai; antes da presença inteira chegar, nada */
  if(SG.minha&&SG.minha!==ID&&viu)sumiu=SG.salas.some(s=>s.id===SG.minha)?0:sumiu||FOLGA;
  SG.aoMudar();
}
export const minhaSala=()=>SG.salas.find(s=>s.id===SG.minha)||null;

/* ---------- o que o jogador faz ---------- */
export function abre(){SG.aberto=true;if(!ws)liga();monta()}
/* sair da tela é sair da sala (menos quem está partindo para a arena dela) */
export function fecha(){SG.aberto=false;if(SG.minha&&saindo<=0&&!vaiK)sai()}
export function cria(n){if(!save.classe)return;SG.minha=ID;SG.nomeSala=nome(n)||`Sala de ${eu().nome}`;SG.eq={};if(SG.quer)SG.eq[ID]=SG.quer;presenca();monta()}
export function entra(id){const s=SG.salas.find(x=>x.id===id);if(!s||s.membros.length>=maxSaguao()||SG.minha)return false;SG.minha=id;SG.quer=null;presenca();monta();return true}
export function sai(){SG.minha=null;SG.quer=null;SG.eq={};presenca();monta()}
/* a cor que quero; o dono se põe na equipe dele direto */
export function quero(k){if(!COR.has(k)||!SG.minha)return;SG.quer=k;if(SG.minha===ID)SG.eq[ID]=k;presenca();monta()}
/* o dono confirma a equipe pedida (ou tira, com null) */
export function confirma(id,k){if(SG.minha!==ID)return;if(COR.has(k))SG.eq[id]=k;else delete SG.eq[id];presenca();monta()}
/* começar: todos da sala vão à mesma arena, a do canal arena-L<id> */
export function comeca(){
  const s=minhaSala();if(!s||s.id!==ID)return false;
  /* as equipes vão junto: a presença do criador pode chegar depois do broadcast */
  manda('broadcast',{type:'broadcast',event:'comeca',payload:{sala:ID,eq:Object.assign({},SG.eq)}});
  parte(s,true);return true;
}
/* quem parte: a cor confirmada vira o time; o dono abre a arena agora, os
   outros entram depois que ela abriu (ESPERA quadros), ainda nos 15 s */
const ESPERA=4.5;
function parte(s,dono,eqDado){
  const eq=(dono?SG.eq[ID]:eqDado!==undefined?eqDado:s.eq[ID])||null;poeTime(eq||'');
  const k=Object.keys(HUNTS).find(h=>HUNTS[h].arena);vaiK={k,n:'L'+s.id};
  /* quem ainda tem outra sala (o servidor de uma arena de antes) sai dela */
  if(SALA.papel&&SALA.id!==k+'-'+vaiK.n)saiDaSala();
  log(`A partida da sala ${s.nome} vai começar${eq?`, na equipe ${CORES.find(c=>c.k===eq).nome.toLowerCase()}`:''}.`,'info');
  SG.aberto=false;
  /* o dono mantém a sala no ar uns segundos, para o 'comeca' chegar antes de
     ela sumir da presença; quem não é dono sai dela na hora */
  if(dono){saindo=2;vaiCaca(vaiK.k,vaiK.n);vaiK=null}else{SG.minha=null;SG.quer=null;presenca();vai=ESPERA}
}

/* ---------- canal ---------- */
function liga(){
  pronto=false;viu=false;ref=0;SG.estado='ligando';PRES.clear();
  try{ws=new WebSocket(SB_URL.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+SB_KEY+'&vsn=1.0.0')}catch(e){ws=null;caiu();return}
  const s=ws;
  s.onopen=()=>{if(ws!==s)return;tenta=0;manda('phx_join',{config:{broadcast:{self:false},presence:{key:ID},private:false}})};
  s.onmessage=m=>{if(ws!==s)return;let d;try{d=JSON.parse(m.data)}catch(e){return}if(d&&d.topic===TOPICO)recebe(d)};
  s.onclose=()=>{if(ws!==s)return;ws=null;caiu()};
  s.onerror=()=>{};
}
function caiu(){pronto=false;SG.estado='sem rede';espera=Math.min(20,2**tenta++);SG.aoMudar()}
function desliga(){if(ws){manda('phx_leave',{});try{ws.close()}catch(e){}}ws=null;pronto=false;SG.estado='fora';PRES.clear();SG.salas=[]}
const metas=v=>v&&Array.isArray(v.metas)?v.metas[v.metas.length-1]:null;
function recebe(d){
  const p=d.payload||{};
  if(d.event==='phx_reply'&&d.ref==='1'){if(p.status!=='ok'){caiu();return}pronto=true;SG.estado='ligado';presenca();monta();return}
  if(d.event==='presence_state'){viu=true;PRES.clear();for(const id in p){if(id===ID)continue;const o=confere(id,metas(p[id]));if(o)PRES.set(id,o)}monta()}
  else if(d.event==='presence_diff'){
    for(const id in p.leaves||{})if(!(p.joins&&p.joins[id]))PRES.delete(id);
    for(const id in p.joins||{}){if(id===ID)continue;const o=confere(id,metas(p.joins[id]));if(o)PRES.set(id,o);else PRES.delete(id)}
    monta()}
  else if(d.event==='broadcast'&&p.event==='comeca'&&p.payload&&p.payload.sala===SG.minha&&SG.minha!==ID){const s=minhaSala();
    if(s&&s.membros.some(m=>m.id===ID)){const e=p.payload.eq&&typeof p.payload.eq==='object'?p.payload.eq[ID]:undefined;parte(s,false,e===undefined?undefined:COR.has(e)?e:null)}}
}
/* chamado pelo laço */
export function quadro(dt){
  /* a vez de quem não é dono: entra na arena da sala, já aberta pelo dono */
  if(vai>0){vai-=dt;if(vai<=0&&vaiK){vaiCaca(vaiK.k,vaiK.n);vaiK=null}}
  if(saindo>0){saindo-=dt;if(saindo<=0){SG.minha=null;SG.quer=null;SG.eq={};presenca()}}
  if(sumiu>0){sumiu-=dt;if(sumiu<=0&&SG.minha&&SG.minha!==ID&&!SG.salas.some(s=>s.id===SG.minha)){SG.minha=null;SG.quer=null;log('A sala da Arena fechou: o criador saiu.','warn');presenca();SG.aoMudar()}}
  const quer=SG.aberto||!!SG.minha;
  if(!quer){if(ws)desliga();return}
  if(!ws){espera-=dt;if(espera<=0)liga();return}
  if(!pronto)return;
  batida-=dt;if(batida<=0){batida=BATIDA;ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}))}
}
