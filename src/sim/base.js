/* ---------- base da simulação ----------
   Nada em src/sim/ toca em DOM, canvas, localStorage ou relógio do navegador:
   é a regra do jogo, e é o que o servidor da F2 vai rodar no Node. O que a
   simulação precisa contar para fora (mensagem, nível novo, fim da incursão,
   hora de gravar) sai por `saida`, que o cliente preenche em src/main.js. */
export const T=32,MW=64,MH=64,RUN=360,PORTAL_AT=90,EXT=2.5,TAU=Math.PI*2;
export const rnd=n=>Math.floor(Math.random()*n),rr=(a,b)=>a+Math.random()*(b-a),ri=(a,b)=>a+rnd(b-a+1);
export const clamp=(v,a,b)=>v<a?a:v>b?b:v,hyp=Math.hypot;
export const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
export const fmtEl=s=>fmt(Math.floor(Math.max(0,s)));
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
/* log(msg,cls) e banner(txt) são as mensagens da incursão; nivel() avisa que
   espaços e habilidades mudaram; fim(kind) fecha a incursão; persist() pede
   para gravar o save. Sem cliente, tudo é silêncio. */
export const saida={log(){},banner(){},nivel(){},fim(){},persist(){}};
