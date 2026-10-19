/* ---------- rede: a cidade compartilhada ----------
   Primeiro teste do multiplayer, só na cidade (decisão do Leonardo em
   19/10/2026): as caçadas continuam sozinhas. Sem servidor próprio e sem gasto:
   o canal de broadcast e presença do Supabase Realtime, pelo WebSocket nativo
   do navegador e com a mesma chave publicável de src/nuvem.js.
   Cada cliente conta a própria posição e desenha a dos outros; ninguém decide
   regra nenhuma, porque na cidade não há o que decidir (sem combate, sem loot,
   sem ouro). Por isso não precisa de servidor autoritativo — e por isso também
   não vale para a incursão, que é o servidor da F2 (docs/plano-multiplayer.md).
   O laço chama quadro() a cada quadro: liga ao entrar na cidade, desliga ao
   sair dela ou com a aba no fundo, e religa sozinho se a conexão cair. */
import {CLASSES,SLOTS_EQ} from './sim/dados.js?v=0.19.0';
import {save,ch} from './sim/progresso.js?v=0.19.0';
import {C,OUTROS,poeOutro,tiraOutro} from './sim/cidade.js?v=0.19.0';
import {SB_URL,SB_KEY,quemSou} from './nuvem.js?v=0.19.0';
import {log} from './hud.js?v=0.19.0';

/* versões diferentes não se misturam: cada x.y tem a sua cidade */
const VER=(()=>{try{return(new URL(import.meta.url).searchParams.get('v')||'dev').split('.').slice(0,2).join('.')}catch(e){return 'dev'}})();
const TOPICO='realtime:cidade-'+VER;
/* identidade desta aba, não da conta: duas abas da mesma conta são dois bonecos */
export const ID=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,'0')).join('');
/* uma mensagem por passo de sqm (~3 por segundo andando, nada parado). O
   Realtime do plano Free aceita ~100 envios por segundo por canal (medido em
   19/10/2026: 11 pessoas a 8/s passam, 13 perdem mensagens e são expulsas),
   então cabem ~30 andando ao mesmo tempo. ENVIO é só um piso contra rajada */
const ENVIO=.1,BATIDA=25;
/* rede.sala: a sala que este aparelho anuncia na presença, {n} quem está nela
   (src/sala.js põe e tira). SALAS: as salas abertas de quem está na cidade,
   para o Guia de caça listar */
export const rede={estado:'fora',n:0,sala:null,naSala:0,aoMudar(){}};
export const SALAS=new Map();
let ws=null,ref=0,pronto=false,quer=false,espera=0,tenta=0,batida=0,envio=0,mandou={x:-1,y:-1},primeiro=true;

const manda=(event,payload,topic=TOPICO)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}))};
const bc=(event,payload)=>manda('broadcast',{type:'broadcast',event,payload});
/* sem conta, o nome é o da classe: "Cavaleiro" diz mais que "Visitante". O
   que ele veste vai junto, para os outros verem no boneco */
const veste=[null,null,null];
const eu=()=>{const e=ch().equip;for(let i=0;i<3;i++)veste[i]=e[SLOTS_EQ[i]]||null;
  return {nome:quemSou()||CLASSES[save.classe].nome,classe:save.classe,lvl:ch().lvl,eq:{arma:veste[0],armadura:veste[1],amuleto:veste[2]},sala:rede.sala}};
/* o Banco se abre de dentro da cidade: trocar de peça lá manda a presença de novo */
const mudouVeste=()=>{const e=ch().equip;for(let i=0;i<3;i++)if((e[SLOTS_EQ[i]]||null)!==veste[i])return true;return false};
const presenca=()=>manda('presence',{type:'presence',event:'track',payload:eu()});
/* a presença muda (abriu ou fechou sala, entrou alguém nela) */
export function anuncia(){if(pronto)presenca()}
function minhaPos(){
  /* o passo: o sqm para onde vou e quanto levo (0 se já estou parado nele) */
  const p=C.p;mandou.x=p.tx;mandou.y=p.ty;
  bc('pos',{id:ID,x:p.tx,y:p.ty,d:Math.round(p.sd*1000)});
}
function liga(){
  pronto=false;primeiro=true;ref=0;rede.estado='ligando';
  try{ws=new WebSocket(SB_URL.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+SB_KEY+'&vsn=1.0.0')}catch(e){ws=null;caiu();return}
  /* um socket velho que fecha depois de um novo aberto não mexe no novo */
  const s=ws;
  s.onopen=()=>{if(ws!==s)return;tenta=0;manda('phx_join',{config:{broadcast:{self:false},presence:{key:ID},private:false}})};
  s.onmessage=m=>{if(ws!==s)return;let d;try{d=JSON.parse(m.data)}catch(e){return}if(d&&d.topic===TOPICO)recebe(d)};
  s.onclose=()=>{if(ws!==s)return;ws=null;caiu()};
  s.onerror=()=>{};
}
function caiu(){
  pronto=false;OUTROS.clear();SALAS.clear();rede.n=0;
  if(!quer){rede.estado='fora';return}
  rede.estado='sem rede';espera=Math.min(30,2**tenta++);
}
function desliga(){
  quer=false;espera=0;
  if(ws){manda('phx_leave',{});try{ws.close()}catch(e){}}
  ws=null;pronto=false;OUTROS.clear();SALAS.clear();rede.n=0;rede.estado='fora';
}
function conta(){rede.n=OUTROS.size;rede.aoMudar()}
function chegou(id,meta,avisa){
  if(id===ID||!meta)return;
  const o=poeOutro(id,meta);
  if(o&&avisa)log(`${o.nome} chegou à cidade.`,'info');
  /* a sala anunciada: só o número de gente, o resto é o nome já conferido */
  const n=meta.sala&&meta.sala.n|0;
  if(o&&n>=1&&n<=4)SALAS.set(id,{id,nome:o.nome,classe:o.classe,n});else SALAS.delete(id);
}
/* o servidor pode tirar o cliente do canal (excesso de mensagens, canal
   reiniciado) sem fechar o socket: aí o jogo ficaria "ligado" e invisível.
   Qualquer erro do canal fecha o socket, e caiu() religa com espera */
const expulso=d=>d.event==='phx_error'||d.event==='phx_close'||(d.event==='system'&&d.payload&&d.payload.status==='error')||(d.event==='phx_reply'&&d.ref!=='1'&&d.payload&&d.payload.status==='error');
function recebe(d){
  const p=d.payload||{};
  if(expulso(d)){const s=ws;ws=null;caiu();try{s&&s.close()}catch(e){}return}
  if(d.event==='phx_reply'&&d.ref==='1'){
    if(p.status!=='ok'){rede.estado='sem rede';return}
    pronto=true;rede.estado='ligado';
    presenca();minhaPos();
  }else if(d.event==='presence_state'){
    for(const id in p)chegou(id,p[id].metas&&p[id].metas[0],false);
    primeiro=false;conta();
  }else if(d.event==='presence_diff'){
    let novo=false;
    for(const id in p.joins||{}){if(id===ID)continue;const ja=OUTROS.has(id);chegou(id,p.joins[id].metas&&p.joins[id].metas[0],!primeiro&&!ja);novo=true}
    for(const id in p.leaves||{}){if(id===ID||(p.joins&&p.joins[id]))continue;SALAS.delete(id);const o=OUTROS.get(id);if(o&&o.vis)log(`${o.nome} saiu da cidade.`,'info');tiraOutro(id)}
    /* quem chegou ainda não sabe onde estou */
    if(novo&&pronto){const p=C.p,sd=p.sd;p.sd=0;minhaPos();p.sd=sd}
    conta();
  }else if(d.event==='broadcast'&&p.event==='pos'){
    /* a posição pode chegar antes da presença: o nome vem depois */
    const q=p.payload;if(q&&q.id!==ID){poeOutro(q.id,q);conta()}
  }
}
/* naCidade: o jogador está na cidade (ou numa tela aberta a partir dela) */
export function quadro(dt,naCidade){
  const fundo=typeof document!=='undefined'&&document.hidden;
  const deve=naCidade&&!fundo&&!!C&&!!CLASSES[save.classe]&&typeof WebSocket!=='undefined';
  if(!deve){if(quer||ws)desliga();return}
  quer=true;
  if(!ws){espera-=dt;if(espera<=0)liga();return}
  if(!pronto)return;
  batida-=dt;if(batida<=0){batida=BATIDA;manda('heartbeat',{},'phoenix')}
  if(mudouVeste())presenca();
  envio-=dt;
  const p=C.p;
  if((p.tx!==mandou.x||p.ty!==mandou.y)&&envio<=0){envio=ENVIO;minhaPos()}
}
