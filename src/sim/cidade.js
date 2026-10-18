/* ---------- cidade ----------
   O lugar entre incursões: um mapa fixo (city.mapa no content.json) por onde o
   jogador anda até as casas dos NPCs — Mercador, Banco e o Guia de caça, que
   leva às masmorras. É regra e não tela, como a incursão: quando a cidade
   for compartilhada (F3 do PRD), é este estado que o servidor vai rodar, com
   os outros jogadores ao lado de C.p. Aqui só se anda e se descobre quem está
   perto; o que cada NPC abre é do cliente (src/telas.js). */
import {T,hyp} from './base.js?v=0.7.0';
import {CITY,LEGENDA} from './dados.js?v=0.7.0';
import {pecas} from './mapa.js?v=0.7.0';

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
  C={w,h,t,sol,par:pecas(fora,w,h),npcs,p:{x:(sx+.5)*T,y:(sy+.5)*T,r:11,face:Math.PI/2,walk:0,mv:false},perto:null,t0:0};
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
  return melhor;
}
