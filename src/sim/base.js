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
const gerador=s=>{let a=s>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
let regra=gerador(1),enfeite=gerador(1^0x9E3779B9);
export let semente=1;
/* reinicia os dois sorteios; newRun() chama no começo de cada incursão */
export function semeia(s){semente=s>>>0;regra=gerador(semente);enfeite=gerador(semente^0x9E3779B9)}
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
/* log(msg,cls) e banner(txt) são as mensagens da incursão; nivel() avisa que
   espaços e habilidades mudaram; sai(p) que um jogador saiu da incursão (o
   resultado dele está em p); fim(kind) fecha a sala; persist() pede para
   gravar o save. Sem cliente, tudo é silêncio. */
export const saida={log(){},banner(){},nivel(){},sai(){},fim(){},persist(){}};
