/* ---------- cidade ----------
   O lugar entre incursões: um mapa fixo (city.mapa no content.json) por onde o
   jogador anda até as casas dos NPCs — Mercador, Banco e o Guia de caça, que
   leva às masmorras. É regra e não tela, como a incursão: quando a cidade
   for compartilhada (F3 do PRD), é este estado que o servidor vai rodar, com
   os outros jogadores ao lado de C.p. Aqui só se anda e se descobre quem está
   perto; o que cada NPC abre é do cliente (src/telas.js). */
import {T,hyp} from './base.js?v=0.8.0';
import {CITY,LEGENDA,CLASSES} from './dados.js?v=0.8.0';
import {pecas} from './mapa.js?v=0.8.0';

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
  C={w,h,t,sol,par:pecas(fora,w,h),npcs,outros:OUTROS,p:{x:(sx+.5)*T,y:(sy+.5)*T,r:11,face:Math.PI/2,walk:0,mv:false},perto:null,t0:0};
  return C;
}
export const npcDaLetra=c=>{for(const k in CITY.npcs)if(CITY.npcs[k].letra===c)return k;return null};
/* física da cidade: a mesma da incursão (src/sim/incursao.js), na grade da cidade */
const solidoC=(x,y)=>x<0||y<0||x>=C.w||y>=C.h||C.sol[y*C.w+x]===1;
function bloqC(x,y,r){
  const a=Math.floor((x-r)/T),b=Math.floor((x+r)/T),c=Math.floor((y-r)/T),d=Math.floor((y+r)/T);
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++)if(solidoC(i,j))return true;
  return false;
}
function andaC(e,dx,dy){const r=e.r*.85;if(dx&&!bloqC(e.x+dx,e.y,r))e.x+=dx;if(dy&&!bloqC(e.x,e.y+dy,r))e.y+=dy}
/* ent é a mesma entrada da incursão ({x,y} do movimento); devolve a chave do
   NPC ao alcance de uma conversa, ou null */
export function updateCidade(dt,ent){
  const p=C.p;C.t0+=dt;
  let mx=ent.x,my=ent.y;const ml=hyp(mx,my);if(ml>1){mx/=ml;my/=ml}
  p.mv=ml>.08;
  if(p.mv){andaC(p,mx*128*dt,my*128*dt);p.face=Math.atan2(my,mx);p.walk+=dt*Math.min(1,ml)*12}
  let melhor=null,md=T*1.75;
  for(const n of C.npcs){const d=hyp(n.x-p.x,n.y-p.y);if(d<md){md=d;melhor=n.k}}
  C.perto=melhor;
  dtS=dt;OUTROS.forEach(segue1);
  return melhor;
}

/* ---------- os outros ----------
   Quem mais está na cidade chega pela rede (src/rede.js), que só escreve aqui,
   por poeOutro() e tiraOutro(). É dado de fora, então tudo é conferido: número
   preso ao mapa, classe que existe, nome curto e sem caractere de controle.
   Cada outro guarda o alvo (ax, ay), a última posição recebida, e a posição
   desenhada (x, y), que corre atrás dele: as mensagens chegam a no máximo 8
   por segundo e a tela anda a 60. Nada daqui é regra de jogo: na cidade não se
   ganha nem se perde nada, e é por isso que ela pode ser o primeiro teste do
   multiplayer sem servidor próprio. */
export const OUTROS=new Map(),MAX_OUTROS=40;
const num=(v,a,b,pad)=>typeof v==='number'&&isFinite(v)?Math.min(b,Math.max(a,v)):pad;
export function poeOutro(id,d){
  if(typeof id!=='string'||!id||id.length>40)return null;
  let o=OUTROS.get(id);
  if(!o){if(OUTROS.size>=MAX_OUTROS)return null;
    o={id,nome:'…',classe:'feiticeiro',lvl:1,x:0,y:0,ax:0,ay:0,vis:false,r:11,face:Math.PI/2,walk:0,mv:false,flash:0,swing:0};OUTROS.set(id,o)}
  if(typeof d.nome==='string'){const n=d.nome.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16);if(n)o.nome=n}
  if(typeof d.classe==='string'&&CLASSES[d.classe])o.classe=d.classe;
  o.lvl=Math.round(num(d.lvl,1,999,o.lvl));
  if(d.x!==undefined&&d.y!==undefined&&C){
    const LW=C.w*T,LH=C.h*T;o.ax=num(d.x,0,LW,o.ax);o.ay=num(d.y,0,LH,o.ay);
    if(!o.vis){o.x=o.ax;o.y=o.ay;o.vis=true}
    o.face=num(d.f,-4,4,o.face);
  }
  return o;
}
export const tiraOutro=id=>OUTROS.delete(id);
let dtS=0;const segue1=o=>segue(o,dtS);
/* corre atrás do alvo um pouco mais rápido que se anda (128), e salta se ficou
   longe demais (mensagem perdida, aba que voltou do fundo) */
function segue(o,dt){
  if(!o.vis)return;
  const dx=o.ax-o.x,dy=o.ay-o.y,d=hyp(dx,dy);
  if(d>T*4){o.x=o.ax;o.y=o.ay;o.mv=false;return}
  o.mv=d>1.5;
  if(!o.mv)return;
  const s=Math.min(d,Math.max(150,d*8)*dt);o.x+=dx/d*s;o.y+=dy/d*s;
  o.face=Math.atan2(dy,dx);o.walk+=dt*12;
}
