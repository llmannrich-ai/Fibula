/* ---------- Fibula: o cliente ----------
   Ponto de entrada do index.html. Busca o conteúdo, liga a simulação
   (src/sim/, sem DOM) às telas, ao desenho e ao save, e roda o laço.
   O carregamento do conteúdo é a primeira coisa que acontece porque a migração
   de save chama slotsIniciais() e portanto já precisa de SPELLS e SLOT_LVL. */
import {saida} from './sim/base.js?v=0.6.1';
import {carrega} from './sim/dados.js?v=0.6.1';
import {G,passo,parado} from './sim/incursao.js?v=0.6.1';
import {carregaSave,persist} from './salvar.js?v=0.6.1';
import {puxa} from './nuvem.js?v=0.6.1';
import {carregaArte} from './arte.js?v=0.6.1';
import {W,H,resize,render,drawMini} from './desenho.js?v=0.6.1';
import {log,banner,montaIcones,montaBotoes,hud} from './hud.js?v=0.6.1';
import {showMenu,showPick,showEnd,pickS,endS,conteudoFalhou} from './telas.js?v=0.6.1';
import {joy,joyIdle,leEntrada,soltaTudo} from './controles.js?v=0.6.1';
import {app} from './dom.js?v=0.6.1';

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
    /* nem acima de 100 ms, dois passos da regra (aba voltando do fundo), nem
       abaixo de zero (carimbo do quadro anterior ao performance.now() da carga) */
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
    if((app.clientWidth||innerWidth)!==W||(app.clientHeight||innerHeight)!==H)onResize();
    if(G){
      if(G.active&&!G.over)passo(dt,leEntrada());
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
