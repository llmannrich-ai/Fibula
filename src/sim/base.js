/* ---------- base da simulação ----------
   Nada em src/sim/ toca em DOM, canvas, localStorage ou relógio do navegador:
   é a regra do jogo, e é o que o servidor da F2 vai rodar no Node. O que a
   simulação precisa contar para fora (mensagem, nível novo, fim da incursão,
   hora de gravar) sai por `saida`, que o cliente preenche em src/main.js. */
export const T=32,MW=64,MH=64,RUN=360,PORTAL_AT=90,EXT=2.5,TAU=Math.PI*2;
/* a regra anda em passos fixos de TICK segundos (20 por segundo, a taxa de
   estado do servidor da F2), qualquer que seja o quadro da tela: ver passo()
   em incursao.js */
export const TICK=.05;

/* ---------- sorteio com semente ----------
   Toda a sorte do jogo sai daqui, nunca de Math.random: a mesma semente dá a
   mesma masmorra — mapa, monstros, dano e loot —, no celular, no Node e no
   servidor da F2. É o que permite jogar junto, reproduzir um bug pelo número
   da masmorra e medir balanceamento sem ruído.
   São dois sorteios com a mesma semente e sequências separadas:
   - o da REGRA (rnd, rr, ri, sorte): mapa, spawn, dano, loot, movimento;
   - o do EFEITO (frr): partículas, números e tremor, que só enfeitam.
   Efeito nunca usa o da regra. Senão uma tela que desenha mais faíscas que
   outra mudaria o loot do próximo monstro, e cliente e servidor divergiriam.
   O gerador é o mulberry32: 32 bits de estado, rápido, sem alocação. Trocar
   o algoritmo muda todas as masmorras de todas as sementes; o tools/testar.mjs
   prende a sequência para isso não acontecer sem querer. */
const gerador=s=>{let a=s>>>0;const f=()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};f.le=()=>a;f.poe=v=>{a=v|0};return f};
let regra=gerador(1),enfeite=gerador(1^0x9E3779B9);
export let semente=1;
/* reinicia os dois sorteios; newRun() chama no começo de cada incursão */
export function semeia(s){semente=s>>>0;regra=gerador(semente);enfeite=gerador(semente^0x9E3779B9)}
/* onde os dois sorteios estão: a herança da sala (src/sim/incursao.js) leva
   isto, para quem assume a masmorra sortear dali em diante */
export const sorteAgora=()=>[regra.le(),enfeite.le()];
export const poeSorte=(r,e)=>{regra.poe(r);enfeite.poe(e)};
/* a única sorte que não vem de semente: escolher a semente de uma incursão nova */
export const novaSemente=()=>Math.floor(Math.random()*4294967296)>>>0;
/* "12345" vale 12345; qualquer outro texto vira número pelo FNV-1a, então
   "leo" ou "desafio-da-semana" também são sementes */
export const sementeDe=txt=>{txt=String(txt).trim().toLowerCase();
  if(/^\d{1,10}$/.test(txt)&&+txt<4294967296)return +txt;
  let h=0x811C9DC5;for(let i=0;i<txt.length;i++)h=Math.imul(h^txt.charCodeAt(i),0x01000193);return h>>>0};
export const sorte=()=>regra();
export const rnd=n=>Math.floor(regra()*n),rr=(a,b)=>a+regra()*(b-a),ri=(a,b)=>a+rnd(b-a+1);
export const frr=(a,b)=>a+enfeite()*(b-a);
export const clamp=(v,a,b)=>v<a?a:v>b?b:v,hyp=Math.hypot;
export const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
export const fmtEl=s=>fmt(Math.floor(Math.max(0,s)));
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
/* ---------- passo de sqm ----------
   Como no Tibia, quem anda (jogador, monstro, outro jogador da cidade) está
   sempre num sqm (tx, ty) e vai a um vizinho por vez. O sqm novo é dele desde
   o começo do passo; x, y em pixels vão do ponto de partida (ox, oy) ao
   centro do sqm em sd segundos, e só servem para o desenho e para o alcance
   do combate. É o que faz a rede barata e exata: um passo é uma mensagem
   ("fui para o sqm tal, levo tanto"), e quem recebe anima igual. */
export const centro=t=>(t+.5)*T;
/* as 8 direções, na ordem do ângulo (leste, sudeste, sul…) */
export const DIR8=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
export function poeNoSqm(e,tx,ty){e.tx=tx;e.ty=ty;e.x=e.ox=centro(tx);e.y=e.oy=centro(ty);e.st=0;e.sd=0}
function posPasso(e){const k=e.sd>0?Math.min(1,e.st/e.sd):1;e.x=e.ox+(centro(e.tx)-e.ox)*k;e.y=e.oy+(centro(e.ty)-e.oy)*k}
/* começa um passo de (dx, dy); sobra é o tempo que passou do fim do passo
   anterior, para emendar sem perder velocidade */
export function comeca(e,dx,dy,sd,sobra=0){e.ox=e.x;e.oy=e.y;e.tx+=dx;e.ty+=dy;e.sd=sd;e.st=sobra;e.face=Math.atan2(dy,dx);posPasso(e)}
/* anda o passo em curso; devolve -1 se ele continua, ou o tempo que sobrou
   depois do fim (0 para quem já estava parado) */
export function avanca(e,dt){
  if(!(e.sd>0))return 0;
  e.st+=dt;posPasso(e);
  if(e.st<e.sd)return -1;
  const s=e.st-e.sd;e.sd=0;e.st=0;return s;
}
/* o joystick em uma das 8 direções (índice de DIR8), ou -1 se está no meio */
export const dir8=(x,y)=>x*x+y*y<.09?-1:(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8;
/* o passo que dá para dar na direção i: a diagonal só com os dois lados livres
   (não se corta quina), senão escorrega pelo eixo mais forte do joystick, e
   depois pelo outro. livre(x,y) diz se dá para pisar; devolve o índice de
   DIR8 do passo possível, ou -1 */
export function passoPara(e,i,livre,mx,my){
  const d=DIR8[i],dx=d[0],dy=d[1];
  if(!dx||!dy)return livre(e.tx+dx,e.ty+dy)?i:-1;
  if(livre(e.tx+dx,e.ty)&&livre(e.tx,e.ty+dy)&&livre(e.tx+dx,e.ty+dy))return i;
  const ix=dx>0?0:4,iy=dy>0?2:6,a=Math.abs(mx)>=Math.abs(my)?ix:iy,b=a===ix?iy:ix;
  if(livre(e.tx+DIR8[a][0],e.ty+DIR8[a][1]))return a;
  if(livre(e.tx+DIR8[b][0],e.ty+DIR8[b][1]))return b;
  return -1;
}

/* log(msg,cls) e banner(txt) são as mensagens da incursão; nivel() avisa que
   espaços e habilidades mudaram; sai(p) que um jogador saiu da incursão (o
   resultado dele está em p); fim(kind) fecha a sala; persist() pede para
   gravar o save. Sem cliente, tudo é silêncio. */
export const saida={log(){},banner(){},nivel(){},sai(){},fim(){},persist(){}};
