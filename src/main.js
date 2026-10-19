/* ---------- Fibula: o cliente ----------
   Ponto de entrada do index.html. Busca o conteúdo, liga a simulação
   (src/sim/, sem DOM) às telas, ao desenho e ao save, e roda o laço.
   O carregamento do conteúdo é a primeira coisa que acontece porque a migração
   de save chama slotsIniciais() e portanto já precisa de SPELLS e SLOT_LVL. */
import {saida} from './sim/base.js?v=0.12.0';
import {carrega} from './sim/dados.js?v=0.12.0';
import {G,passo,parado} from './sim/incursao.js?v=0.12.0';
import {C,updateCidade} from './sim/cidade.js?v=0.12.0';
import {carregaSave,persist} from './salvar.js?v=0.12.0';
import {puxa,cacaFim} from './nuvem.js?v=0.12.0';
import {carregaArte} from './arte.js?v=0.12.0';
import {W,H,resize,render,renderCidade,drawMini} from './desenho.js?v=0.12.0';
import {log,banner,montaIcones,montaBotoes,hud,hudCidade} from './hud.js?v=0.12.0';
import {showMenu,showPick,showEnd,pickS,endS,equipS,desenhaBoneco,conteudoFalhou,V} from './telas.js?v=0.12.0';
import {joy,joyIdle,leEntrada,soltaTudo} from './controles.js?v=0.12.0';
import {quadro} from './rede.js?v=0.12.0';
import {app} from './dom.js?v=0.12.0';

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
  carregaArte(()=>{if(!pickS.hidden)showPick();if(!equipS.hidden)desenhaBoneco();if(!endS.hidden&&G)showEnd();montaIcones()});
  carregaSave();
  /* o que a simulação conta para fora vira tela, botão e gravação */
  /* mensagem com jogador (o último argumento) só aparece na tela dele */
  const meu=p=>!p||!G||p===G.p;
  saida.log=(m,c,p)=>{if(meu(p))log(m,c)};saida.banner=(t,p)=>{if(meu(p))banner(t)};
  saida.nivel=p=>{if(meu(p))montaBotoes()};saida.persist=persist;
  saida.fim=kind=>{if(G&&G.p)cacaFim(G.p.fora||kind,G.p);soltaTudo();setTimeout(showEnd,kind==='extraiu'?450:1100)};

  /* ---------- laço ---------- */
  let last=performance.now();
  const frame=now=>{
    /* nem acima de 100 ms, dois passos da regra (aba voltando do fundo), nem
       abaixo de zero (carimbo do quadro anterior ao performance.now() da carga) */
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
    if((app.clientWidth||innerWidth)!==W||(app.clientHeight||innerHeight)!==H)onResize();
    quadro(dt,V.cidade);
    if(V.cidade&&C){
      /* andando na cidade; com uma tela dela aberta, ela só fica de fundo */
      if(app.classList.contains('cidade')){updateCidade(dt,leEntrada());hudCidade()}
      renderCidade();
    }else if(G){
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
