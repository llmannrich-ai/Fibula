/* ---------- Fibula: o cliente ----------
   Ponto de entrada do index.html. Busca o conteúdo, liga a simulação
   (src/sim/, sem DOM) às telas, ao desenho e ao save, e roda o laço.
   O carregamento do conteúdo é a primeira coisa que acontece porque a migração
   de save chama slotsIniciais() e portanto já precisa de SPELLS e SLOT_LVL. */
import {saida} from './sim/base.js';
import {carrega} from './sim/dados.js';
import {G,update,parado} from './sim/incursao.js';
import {carregaSave,persist} from './salvar.js';
import {puxa} from './nuvem.js';
import {carregaArte} from './arte.js';
import {W,H,resize,render,drawMini} from './desenho.js';
import {log,banner,montaIcones,montaBotoes,hud} from './hud.js';
import {showMenu,showPick,showEnd,pickS,endS,conteudoFalhou} from './telas.js';
import {joy,joyIdle,leEntrada,soltaTudo} from './controles.js';
import {app} from './dom.js';

/* ---------- conteúdo do jogo (data/game/content.json) ---------- */
const DATA_URL='data/game/content.json';
let pronto=false;
try{
  const res=await fetch(DATA_URL,{cache:'no-cache'});
  if(!res.ok)throw new Error(`HTTP ${res.status} em ${DATA_URL}`);
  carrega(await res.json());
  pronto=true;
}catch(err){conteudoFalhou(err,DATA_URL)}

if(pronto){
  carregaArte(()=>{if(!pickS.hidden)showPick();if(!endS.hidden&&G)showEnd();montaIcones()});
  carregaSave();
  /* o que a simulação conta para fora vira tela, botão e gravação */
  saida.log=log;saida.banner=banner;saida.nivel=montaBotoes;saida.persist=persist;
  saida.fim=kind=>{soltaTudo();setTimeout(showEnd,kind==='extraiu'?450:1100)};

  /* ---------- laço ---------- */
  let last=performance.now();
  const frame=now=>{
    /* nem acima de 50 ms (aba voltando do fundo) nem abaixo de zero (carimbo do
       quadro anterior ao performance.now() da carga) */
    const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
    if((app.clientWidth||innerWidth)!==W||(app.clientHeight||innerHeight)!==H)onResize();
    if(G){
      if(G.active&&!G.over)update(dt,leEntrada());
      else parado(dt);
      render();
      if(G.active){hud();G.miniT-=dt;if(G.miniT<=0){drawMini();G.miniT=.15}}
    }
    requestAnimationFrame(frame);
  };
  function onResize(){resize();if(joy.id===null)joyIdle()}
  addEventListener('resize',onResize);
  onResize();
  showMenu();
  puxa();
  requestAnimationFrame(frame);
}
