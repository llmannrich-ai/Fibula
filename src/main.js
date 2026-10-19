/* ---------- Fibula: o cliente ----------
   Ponto de entrada do index.html. Busca o conteúdo, liga a simulação
   (src/sim/, sem DOM) às telas, ao desenho e ao save, e roda o laço.
   O carregamento do conteúdo é a primeira coisa que acontece porque a migração
   de save chama slotsIniciais() e portanto já precisa de SPELLS e SLOT_LVL. */
import {saida} from './sim/base.js?v=0.20.0';
import {carrega} from './sim/dados.js?v=0.20.0';
import {G,passo,parado,assiste,newRun} from './sim/incursao.js?v=0.20.0';
import {C,updateCidade} from './sim/cidade.js?v=0.20.0';
import {carregaSave,persist} from './salvar.js?v=0.20.0';
import {puxa,cacaFim} from './nuvem.js?v=0.20.0';
import {carregaArte} from './arte.js?v=0.20.0';
import {W,H,resize,render,renderCidade,drawMini} from './desenho.js?v=0.20.0';
import {log,banner,montaIcones,montaBotoes,hud,hudCidade} from './hud.js?v=0.20.0';
import {showMenu,showPick,showEnd,showCidade,start,pickS,endS,equipS,desenhaBoneco,conteudoFalhou,V} from './telas.js?v=0.20.0';
import {joy,joyIdle,leEntrada,soltaTudo} from './controles.js?v=0.20.0';
import {quadro} from './rede.js?v=0.20.0';
import {quadro as quadroSala,entradas,saiu,logPara,ganchos} from './sala.js?v=0.20.0';
import {quadro as quadroVoz} from './voz.js?v=0.20.0';
import {app} from './dom.js?v=0.20.0';

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
  /* mensagem com jogador (o último argumento) só aparece na tela dele; na
     sala, o anfitrião manda as dos convidados para eles e as da sala a todos */
  const meu=p=>!p||!G||p===G.p;
  saida.log=(m,c,p)=>{if(meu(p))log(m,c);if(G&&p!==G.p)logPara(p,m,c,false)};
  saida.banner=(t,p)=>{if(meu(p))banner(t);if(G&&p!==G.p)logPara(p,t,'info',true)};
  saida.nivel=p=>{if(meu(p))montaBotoes()};saida.persist=persist;
  /* a tela final aparece quando sai o jogador deste aparelho; na sala, a
     incursão segue no anfitrião até o último sair */
  const fimMeu=kind=>{if(G&&G.p)cacaFim(kind,G.p);soltaTudo();setTimeout(showEnd,kind==='extraiu'?450:1100)};
  saida.sai=p=>{if(p===G.p)fimMeu(p.fora);else saiu(p)};
  /* o convidado: começa quando o anfitrião manda, termina com o resultado dele */
  ganchos.comeca=(s,fichas,eu)=>start(()=>{newRun(s,fichas,true);G.p=G.ps[eu];G.convidado=true;G.sala=true});
  ganchos.fim=fimMeu;ganchos.banner=banner;
  ganchos.aborta=msg=>{G.over=true;soltaTudo();showCidade('portao');log(msg+' A incursão acabou sem resultado.','warn')};

  /* ---------- laço ---------- */
  const PARADO={x:0,y:0,held:[false,false,false,false]};
  let last=performance.now();
  const frame=now=>{
    /* nem acima de 100 ms, dois passos da regra (aba voltando do fundo), nem
       abaixo de zero (carimbo do quadro anterior ao performance.now() da carga) */
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
    if((app.clientWidth||innerWidth)!==W||(app.clientHeight||innerHeight)!==H)onResize();
    quadro(dt,V.cidade);
    const ent=leEntrada(),corre=G&&G.active&&!G.over;
    if(V.cidade&&C){
      /* andando na cidade; com uma tela dela aberta, ela só fica de fundo */
      if(app.classList.contains('cidade')){updateCidade(dt,ent);hudCidade()}
      renderCidade();
      /* o anfitrião que já saiu da incursão continua rodando a dos outros */
      if(corre&&!G.convidado)passo(dt,entradas(PARADO));
    }else if(G){
      if(corre){if(G.convidado)assiste(dt,G.p.id,ent);else passo(dt,entradas(ent))}
      else parado(dt);
      render();
      if(G.active){hud();G.miniT-=dt;if(G.miniT<=0){drawMini();G.miniT=.15}}
    }
    quadroSala(dt,ent);quadroVoz(dt);
    requestAnimationFrame(frame);
  };
  function onResize(){resize();if(joy.id===null)joyIdle()}
  addEventListener('resize',onResize);
  onResize();
  showMenu();
  puxa();
  requestAnimationFrame(frame);
}
