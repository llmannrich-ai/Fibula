/* ---------- controles ----------
   Joystick por ponteiro, botões seguráveis e teclado. A simulação não lê
   nada daqui direto: o laço pede leEntrada() e passa o resultado a update(),
   ou a updateCidade() quando se anda na cidade. */
import {hyp} from './sim/base.js?v=0.48.0';
import {G} from './sim/incursao.js?v=0.48.0';
import {drinkPot,comer,formaMira} from './sim/combate.js?v=0.48.0';
import {SPELLS} from './sim/dados.js?v=0.48.0';
import {pocao,comida} from './sala.js?v=0.48.0';
import {VOZ,ligaVoz,fala} from './voz.js?v=0.48.0';
/* na sala, o convidado pede a poção ao anfitrião, que é quem a bebe */
const bebe=()=>{if(G&&G.convidado)pocao();else drinkPot(G&&G.p)};
const come=()=>{if(G&&G.convidado)comida();else comer(G&&G.p)};
import {W,H,MIRA} from './desenho.js?v=0.48.0';
import {E} from './hud.js?v=0.48.0';
import {$,app} from './dom.js?v=0.48.0';

export const held=[false,false,false,false];
export const soltaTudo=()=>{for(let i=0;i<4;i++){held[i]=false;tiroAte[i]=0}MIRA.i=-1};
const keys={};
export const joy={id:null,ox:0,oy:0,x:0,y:0};
/* a entrada do quadro, reaproveitada para não alocar no laço quente */
const mira=[NaN,NaN,NaN,NaN],alc=[1,1,1,1],ent={x:0,y:0,held,mira,alc};
/* o tiro mirado é um toque: o espaço fica seguro por TIRO ms depois de
   soltar o dedo, o bastante para a regra (passo de 50 ms) lançar uma vez e
   pouco para repetir (a menor recarga é de 0,32 s) */
const TIRO=250,tiroAte=[0,0,0,0];
export function leEntrada(){
  const ag=performance.now();for(let i=0;i<4;i++)if(tiroAte[i]&&ag>tiroAte[i]){tiroAte[i]=0;held[i]=false}
  let mx=joy.x,my=joy.y;
  if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
  if(keys.KeyW||keys.ArrowUp)my-=1;if(keys.KeyS||keys.ArrowDown)my+=1;
  ent.x=mx;ent.y=my;return ent;
}
const joyEl=$('#joy'),knob=$('#knob');
export function joyIdle(){joyEl.classList.add('idle');joyEl.style.left='80px';joyEl.style.top=(H-96)+'px';knob.style.transform=''}
app.addEventListener('pointerdown',e=>{
  if(!(G&&G.active&&!G.over)&&!app.classList.contains('cidade')||joy.id!==null)return;
  if(e.target.closest('button,.screen,.mwin'))return;
  const r=app.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(x>W*.6)return;
  joy.id=e.pointerId;joy.ox=x;joy.oy=y;joy.x=joy.y=0;
  joyEl.classList.remove('idle');joyEl.style.left=x+'px';joyEl.style.top=y+'px';
});
app.addEventListener('pointermove',e=>{
  if(e.pointerId!==joy.id)return;
  const r=app.getBoundingClientRect();let dx=e.clientX-r.left-joy.ox,dy=e.clientY-r.top-joy.oy;
  const l=hyp(dx,dy),mx=44;if(l>mx){dx=dx/l*mx;dy=dy/l*mx}
  joy.x=dx/mx;joy.y=dy/mx;knob.style.transform=`translate(${dx}px,${dy}px)`;
});
const joyEnd=e=>{if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;joyIdle()};
app.addEventListener('pointerup',joyEnd);app.addEventListener('pointercancel',joyEnd);
app.addEventListener('contextmenu',e=>e.preventDefault());
/* zoom do iPhone: o Safari ignora o user-scalable=no, e polegar no joystick
   mais dedo numa habilidade é uma pinça. Barra o gesto e, se o zoom entrar
   mesmo assim, reescreve o viewport, que é o que faz o Safari voltar a 1. */
const nope=e=>e.preventDefault();
for(const ev of['gesturestart','gesturechange','gestureend'])document.addEventListener(ev,nope,{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
document.addEventListener('dblclick',nope,{passive:false});
const vp=document.querySelector('meta[name=viewport]'),vv=window.visualViewport;
if(vp&&vv)vv.addEventListener('resize',()=>{if(vv.scale>1.01){const c=vp.content;vp.content=c+',minimum-scale=1';setTimeout(()=>vp.content=c,300)}});
function bindHold(el,down,up){
  el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{el.setPointerCapture(e.pointerId)}catch(_){}down()});
  for(const ev of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{if(up)up()});
}
/* a mira: o botão da habilidade é um joystick. Apertar mostra a mira para
   onde o personagem olha, arrastar escolhe a direção (e, na bomba, a
   distância), soltar lança. Não há alvo automático: o que sai pode errar.
   Arrastar de volta para o botão e soltar cancela. Aura, cura e apoio não
   miram: segurar repete, como antes */
const ARR=56,MORTA=14;
const habDe=i=>{const p=G&&G.p,id=p&&p.c.slots[i];return id?SPELLS[id]:null};
for(let i=0;i<4;i++){
  const el=E.slots[i];let id=null,ox=0,oy=0,mexeu=false;
  el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    if(id!==null||!(G&&G.active&&!G.over))return;
    try{el.setPointerCapture(e.pointerId)}catch(_){}
    const s=habDe(i);
    if(!formaMira(s,G.p)){held[i]=true;id=e.pointerId;return}
    id=e.pointerId;ox=e.clientX;oy=e.clientY;mexeu=false;
    MIRA.i=i;MIRA.a=G.p.face;MIRA.d=1;MIRA.anula=false;
  });
  el.addEventListener('pointermove',e=>{if(e.pointerId!==id||MIRA.i!==i)return;
    const dx=e.clientX-ox,dy=e.clientY-oy,l=hyp(dx,dy);
    if(l>MORTA){mexeu=true;MIRA.a=Math.atan2(dy,dx);MIRA.d=Math.min(1,(l-MORTA)/ARR);MIRA.anula=false}
    else if(mexeu)MIRA.anula=true;
  });
  const fim=lanca=>e=>{if(e.pointerId!==id)return;id=null;
    if(MIRA.i!==i){held[i]=false;return}
    MIRA.i=-1;if(!lanca||MIRA.anula||!(G&&G.active&&!G.over))return;
    mira[i]=MIRA.a;alc[i]=mexeu?Math.max(.15,MIRA.d):1;held[i]=true;tiroAte[i]=performance.now()+TIRO;
  };
  el.addEventListener('pointerup',fim(true));
  for(const ev of['pointercancel','lostpointercapture'])el.addEventListener(ev,fim(false));
}
bindHold(E.bPot,bebe);bindHold(E.bCom,come);
/* voz da sala: o primeiro toque liga (pede o microfone), depois segurar fala */
bindHold($('#bVoz'),()=>{if(VOZ.ligada)fala(true);else ligaVoz()},()=>fala(false));
const TECLAS=['KeyJ','KeyK','KeyL','KeyI'];
const digitando=e=>e.target&&e.target.closest&&e.target.closest('input,textarea,select');
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyV'&&!e.repeat&&VOZ.ligada&&!digitando(e))fala(true);
  if(G&&G.active&&!G.over){
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    const i=TECLAS.indexOf(e.code);
    if(i>=0||e.code==='Space'){const k=i<0?0:i;held[k]=true;mira[k]=NaN;alc[k]=1;tiroAte[k]=0}
    if(e.code==='KeyP'&&!e.repeat)bebe();
    if(e.code==='KeyC'&&!e.repeat)come();
  }
});
addEventListener('keyup',e=>{keys[e.code]=false;
  const i=TECLAS.indexOf(e.code);if(i>=0)held[i]=false;
  if(e.code==='Space')held[0]=false;
  if(e.code==='KeyV')fala(false);
});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;soltaTudo();fala(false)});
