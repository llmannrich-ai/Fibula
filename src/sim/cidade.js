/* ---------- cidade ----------
   O lugar entre incursões: um mapa fixo (city.mapa no content.json) por onde o
   jogador anda até as casas dos NPCs — Mercador, Banco, a Feira e o Guia de caça, que
   leva às masmorras. É regra e não tela, como a incursão: quando a cidade
   for compartilhada (F3 do PRD), é este estado que o servidor vai rodar, com
   os outros jogadores ao lado de C.p. Aqui só se anda e se descobre quem está
   perto; o que cada NPC abre é do cliente (src/telas.js). */
import {T,hyp,DIR8,poeNoSqm,comeca,avanca,dir8,passoPara} from './base.js?v=0.14.0';
import {ch,durPasso} from './progresso.js?v=0.14.0';
import {CITY,LEGENDA,CLASSES,PROG,ITEMS,SLOTS_EQ} from './dados.js?v=0.14.0';
import {pecas} from './mapa.js?v=0.14.0';

/* tipo de tile (LEGENDA, em src/sim/dados.js): chão (0 grama, 2 rua,
   3 assoalho) ou obstáculo (1 parede, 4 árvore, 5 água, 6 portão). @ é onde se
   chega da primeira vez; a letra de um NPC de city.npcs é o lugar dele */
const SOLIDO=[0,1,0,0,1,1,1];
export let C=null;
/* lê o mapa do conteúdo; dePortao põe o jogador na frente do Guia, que é por
   onde se volta de uma incursão */
export function entraCidade(dePortao){
  const M=CITY.mapa,h=M.length,w=M[0].length,t=new Uint8Array(w*h),sol=new Uint8Array(w*h),fora=new Uint8Array(w*h);
  let sx=1,sy=1;const npcs=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const c=M[y][x],i=y*w+x;
    if(c==='@'){sx=x;sy=y}
    const k=npcDaLetra(c);
    if(k){npcs.push({k,n:CITY.npcs[k],x:(x+.5)*T,y:(y+.5)*T});sol[i]=1;continue}
    t[i]=LEGENDA[c];sol[i]=SOLIDO[t[i]];
  }
  /* o chão debaixo do NPC é o do vizinho: assoalho dentro de casa, rua na praça */
  for(const n of npcs){const x=n.x/T|0,y=n.y/T|0;t[y*w+x]=[t[y*w+x-1],t[y*w+x+1],t[(y-1)*w+x],t[(y+1)*w+x]].find(v=>v===3)??2}
  /* as paredes saem como as de uma sala da masmorra, com o assoalho de dentro
     fazendo o papel do chão: o que não é assoalho conta como rocha */
  for(let i=0;i<w*h;i++)fora[i]=t[i]===3?0:1;
  if(dePortao){const g=npcs.find(n=>CITY.npcs[n.k].abre==='cacadas');if(g){sx=g.x/T|0;sy=(g.y/T|0)-1}}
  C={w,h,t,sol,par:pecas(fora,w,h),npcs,outros:OUTROS,p:{x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,r:11,face:Math.PI/2,walk:0,mv:false},perto:null,t0:0};
  poeNoSqm(C.p,sx,sy);
  return C;
}
export const npcDaLetra=c=>{for(const k in CITY.npcs)if(CITY.npcs[k].letra===c)return k;return null};
/* física da cidade: a mesma da incursão (src/sim/incursao.js), na grade da cidade */
/* física da cidade: o mesmo andar por sqm da incursão (base.js), na grade da
   cidade; jogadores não se bloqueiam */
const livreC=(x,y)=>x>=0&&y>=0&&x<C.w&&y<C.h&&C.sol[y*C.w+x]!==1;
/* ent é a mesma entrada da incursão ({x,y} do movimento); devolve a chave do
   NPC ao alcance de uma conversa, ou null */
export function updateCidade(dt,ent){
  const p=C.p;C.t0+=dt;
  const sobra=avanca(p,dt);
  if(sobra>=0){
    const i=dir8(ent.x,ent.y),j=i<0?-1:passoPara(p,i,livreC,ent.x,ent.y);
    if(j>=0){const d=DIR8[j],sd=durPasso(ch());comeca(p,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd,sobra)}
    else if(i>=0)p.face=Math.atan2(DIR8[i][1],DIR8[i][0]);
  }
  p.mv=p.sd>0;if(p.mv)p.walk+=dt*12;
  let melhor=null,md=T*1.75;
  for(const n of C.npcs){const d=hyp(n.x-p.x,n.y-p.y);if(d<md){md=d;melhor=n.k}}
  C.perto=melhor;
  dtS=dt;OUTROS.forEach(segue1);
  return melhor;
}

/* ---------- os outros ----------
   Quem mais está na cidade chega pela rede (src/rede.js), que só escreve aqui,
   por poeOutro() e tiraOutro(). É dado de fora, então tudo é conferido: número
   preso ao mapa, classe que existe, nome curto e sem caractere de controle,
   peça que existe e é daquele espaço (o equipamento só se vê, não vale nada aqui).
   Cada mensagem é um passo ("fui para o sqm tal, levo d ms"), e o boneco do
   outro anda aquele passo com a mesma duração: o que se vê é o que ele fez,
   um passo atrás, sem adivinhar caminho. Nada daqui é regra de jogo: na cidade não se
   ganha nem se perde nada, e é por isso que ela pode ser o primeiro teste do
   multiplayer sem servidor próprio. */
export const OUTROS=new Map(),MAX_OUTROS=40;
const num=(v,a,b,pad)=>typeof v==='number'&&isFinite(v)?Math.min(b,Math.max(a,v)):pad;
export function poeOutro(id,d){
  if(typeof id!=='string'||!id||id.length>40)return null;
  let o=OUTROS.get(id);
  if(!o){if(OUTROS.size>=MAX_OUTROS)return null;
    o={id,nome:'…',classe:'feiticeiro',lvl:1,x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,vis:false,r:11,face:Math.PI/2,walk:0,mv:false,flash:0,swing:0,eq:{arma:null,armadura:null,amuleto:null}};OUTROS.set(id,o)}
  if(typeof d.nome==='string'){const n=d.nome.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16);if(n)o.nome=n}
  if(typeof d.classe==='string'&&CLASSES[d.classe])o.classe=d.classe;
  o.lvl=Math.round(num(d.lvl,1,999,o.lvl));
  if(d.eq&&typeof d.eq==='object')for(const sl of SLOTS_EQ){const k=d.eq[sl];o.eq[sl]=typeof k==='string'&&Object.prototype.hasOwnProperty.call(ITEMS,k)&&ITEMS[k].slot===sl?k:null}
  /* x, y: o sqm para onde foi; d: quanto o passo dura, em ms (0: chegou lá
     sem andar, como ao entrar na cidade). Longe demais do último sqm
     (mensagem perdida, aba que voltou do fundo), salta direto */
  if(d.x!==undefined&&d.y!==undefined&&C){
    const tx=Math.round(num(d.x,0,C.w-1,o.tx)),ty=Math.round(num(d.y,0,C.h-1,o.ty)),sd=num(d.d,0,2000,0)/1000;
    if(!o.vis||!sd||Math.max(Math.abs(tx-o.tx),Math.abs(ty-o.ty))>3){poeNoSqm(o,tx,ty);o.vis=true}
    else if(tx!==o.tx||ty!==o.ty)comeca(o,tx-o.tx,ty-o.ty,sd);
  }
  return o;
}
export const tiraOutro=id=>OUTROS.delete(id);
let dtS=0;const segue1=o=>segue(o,dtS);
function segue(o,dt){if(!o.vis)return;avanca(o,dt);o.mv=o.sd>0;if(o.mv)o.walk+=dt*12}
