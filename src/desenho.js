/* ---------- desenho ----------
   Canvas, câmera, sprites e luz. Lê o estado da incursão (G) e o da cidade
   (C) e nunca os altera, a não ser pela lista de tochas visíveis, que é cache
   do próprio desenho. */
import {T,MW,MH,RUN,EXT,TAU,TICK,frr,hyp,clamp} from './sim/base.js?v=0.15.0';
import {CITY,CLASSES,ITEMS} from './sim/dados.js?v=0.15.0';
import {save,KL,ch} from './sim/progresso.js?v=0.15.0';
import {G,solid} from './sim/incursao.js?v=0.15.0';
import {C,LISTA_OBJ} from './sim/cidade.js?v=0.15.0';
import {bf} from './sim/combate.js?v=0.15.0';
import {ART,dir4,dir8,PECA,desl} from './arte.js?v=0.15.0';
import {$,app,RM} from './dom.js?v=0.15.0';

const cvs=$('#c'),ctx=cvs.getContext('2d');
const mini=$('#mini'),mctx=mini.getContext('2d'),cmini=$('#cmini'),cmctx=cmini.getContext('2d');
const dark=document.createElement('canvas'),dctx=dark.getContext('2d');
export let W=0,H=0,DPR=1,MS=96;
export function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  W=app.clientWidth||innerWidth;H=app.clientHeight||innerHeight;
  for(const c of [cvs,dark]){c.width=Math.max(1,Math.round(W*DPR));c.height=Math.max(1,Math.round(H*DPR))}
  MS=mini.clientWidth||96;mini.width=Math.round(MS*DPR);mini.height=Math.round(MS*DPR);
}
const hash=(x,y)=>{let h=(Math.imul(x,73856093)^Math.imul(y,19349663))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return h^(h>>>16)};
/* desenha o sprite com o centro do tile em (x,y): as peças crescem para cima
   e para a esquerda a partir do canto inferior direito, como no cliente do
   Tibia, então criatura de 64 px e parede passam por cima do tile vizinho */
function spr(n,d,f,x,y){
  const s=ART.s[n];if(!s)return false;
  ctx.drawImage(ART.img,s.x+(f%s.f)*s.w,s.y+(d%s.d)*s.h,s.w,s.h,Math.round(x+T/2-s.w-s.ox),Math.round(y+T/2-s.h-s.oy),s.w,s.h);
  return true;
}
function circle(c,x,y,r){c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
const rgba=(h,a)=>{const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
function nearFloor(x,y){for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=x+i,b=y+j;if(a>=0&&b>=0&&a<MW&&b<MH&&G.g[b*MW+a]===0)return true}return false}
function outText(t,x,y,col){ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle='#000';ctx.strokeText(t,x,y);ctx.fillStyle=col;ctx.fillText(t,x,y)}
/* nome e barra de vida como no Tibia: Verdana em negrito e a cor da faixa de vida */
const FONTE_MAPA='700 11px Verdana,Tahoma,sans-serif';
const corVida=p=>p>.92?'#00c000':p>.6?'#60c060':p>.3?'#c0c000':p>.08?'#c03030':'#c00000';

/* magia de área do jeito do Tibia: o efeito do elemento em cada tile de chão
   dentro da forma, todos no mesmo quadro */
function efArea(f){
  const n='ef_'+(f.el||'fisico'),s=ART.s[n];if(!s)return false;
  const fr=Math.min(s.f-1,f.t/f.life*s.f|0),R=f.k==='feixe'?f.comp:f.raio||74;
  const ux=Math.cos(f.ang||0),uy=Math.sin(f.ang||0);
  const a=Math.floor((f.x-R)/T),b=Math.floor((f.x+R)/T),c=Math.floor((f.y-R)/T),d=Math.floor((f.y+R)/T);
  for(let ty=c;ty<=d;ty++)for(let tx=a;tx<=b;tx++){
    if(solid(tx,ty))continue;
    const cx=(tx+.5)*T,cy=(ty+.5)*T,dx=cx-f.x,dy=cy-f.y;
    if(f.k==='feixe'){const t=dx*ux+dy*uy;if(t<0||t>R||Math.abs(-dx*uy+dy*ux)>18)continue}
    else{
      if(hyp(dx,dy)>R)continue;
      if(f.k==='cone'&&f.ab<Math.PI){let g=Math.atan2(dy,dx)-f.ang;while(g>Math.PI)g-=TAU;while(g<-Math.PI)g+=TAU;if(Math.abs(g)>f.ab)continue}
    }
    spr(n,0,fr,cx,cy);
  }
  return true;
}
/* criatura do atlas: quadro 0 parada, 1 e 2 andando; o golpe recebido clareia */
function sprCriatura(n,face,mv,fase,flash,x,y){
  const s=ART.s[n];if(!s)return false;
  const d=dir4(face),f=mv&&s.f>1?1+(fase|0)%(s.f-1):0;
  spr(n,d,f,x,y);
  if(flash){ctx.globalAlpha=.6;ctx.globalCompositeOperation='lighter';spr(n,d,f,x,y);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
  return true;
}
/* ---------- equipamento no corpo ----------
   O que o personagem veste aparece nele. Os bonecos das classes no OTSP têm
   uma camada só, sem a máscara de cor dos outfits do Tibia, então nada de
   sprite novo: a armadura retinge a roupa do tronco do próprio boneco
   (guardando a sombra dele, e o resto do boneco continua dizendo a classe), a
   arma é o sprite do item na mão — e é ela que corta no golpe — e o amuleto é
   a pedra dele no peito. A cor e a malha vêm de items.<k>.veste no
   content.json. Onde ficam o tronco, o pescoço e as mãos sai dos pixels de
   cada quadro, medido uma vez; o quadro retingido fica em cache por classe,
   armadura, direção e quadro, então nada é alocado por quadro desenhado. */
const MEDE=new Map(),VESTE=new Map();
let tela0=null;
function pixels(s,d,f){
  if(!tela0){tela0=document.createElement('canvas');tela0.width=tela0.height=64}
  const g=tela0.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,64,64);
  g.drawImage(ART.img,s.x+f*s.w,s.y+d*s.h,s.w,s.h,0,0,s.w,s.h);
  return g.getImageData(0,0,s.w,s.h);
}
const hsl=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/510,dl=(mx-mn)/255;
  let h=0;if(dl)h=mx===r?((g-b)/255/dl+6)%6:mx===g?(b-r)/255/dl+2:(r-g)/255/dl+4;
  return [h*60,dl?dl/(1-Math.abs(2*l-1)||1):0,l]};
/* o corpo de um quadro: topo e altura do boneco, o pescoço, as mãos e quais
   pixels do tronco são roupa (a cor que domina a faixa: o manto do mago, o
   couro do caçador, o aço do cavaleiro), fora contorno, cabelo e cajado */
function mede(n,d,f){
  const k=n+'|'+d+'|'+f;let m=MEDE.get(k);if(m)return m;
  const s=ART.s[n],im=pixels(s,d,f),w=s.w,h=s.h,D=im.data;
  let top=h,bot=-1,l=w,r=-1;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(D[(j*w+i)*4+3]){if(j<top)top=j;bot=j;if(i<l)l=i;if(i>r)r=i}
  const alt=Math.max(1,bot-top+1),y0=top+Math.round(alt*.3),y1=top+Math.round(alt*.64);
  const linha=j=>{let a=w,b=-1,sx=0,n=0;for(let i=0;i<w;i++)if(D[(j*w+i)*4+3]){if(i<a)a=i;b=i;sx+=i;n++}return {a,b,c:n?sx/n:w/2}};
  const pe=linha(top+Math.round(alt*.3)),mao=linha(top+Math.round(alt*.5));
  /* a cor da roupa: o matiz que mais aparece na faixa do tronco, ou cinza se
     o que domina é sem cor (armadura do cavaleiro) */
  const hist=new Float32Array(12);let cinza=0;
  for(let j=y0;j<=y1;j++)for(let i=0;i<w;i++){const o=(j*w+i)*4;if(!D[o+3])continue;
    const [hu,sa,l]=hsl(D[o],D[o+1],D[o+2]);if(l<.16)continue;if(sa<.22)cinza++;else hist[(hu/30|0)%12]+=sa}
  let hb=0;for(let q=1;q<12;q++)if(hist[q]>hist[hb])hb=q;
  const somaC=hist.reduce((a,v)=>a+v,0),ehCinza=cinza>somaC,hc=hb*30+15;
  const roupa=new Uint8Array(w*h);
  for(let j=y0;j<=y1;j++)for(let i=0;i<w;i++){const o=(j*w+i)*4;if(!D[o+3])continue;
    const [hu,sa,l]=hsl(D[o],D[o+1],D[o+2]);if(l<.16)continue;
    let dh=Math.abs(hu-hc);if(dh>180)dh=360-dh;
    if(ehCinza?sa<.22:sa>=.22&&dh<=40)roupa[j*w+i]=1}
  /* a força da tinta: cheia no meio do tronco, sumindo nas três linhas da
     borda, para a armadura não cortar o manto numa reta */
  for(let j=y0;j<=y1;j++){const q=Math.min(255,(Math.min(j-y0,y1-j)+1)*85);for(let i=0;i<w;i++)if(roupa[j*w+i])roupa[j*w+i]=q}
  m={top,alt,l,r,nx:pe.c,ny:top+Math.round(alt*.3),la:mao.a,lb:mao.b,my:top+Math.round(alt*.5),roupa};
  MEDE.set(k,m);return m;
}
const corRGB=h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]};
/* o quadro com a armadura: a cor dela vezes a luz do pixel original, para a
   dobra do manto continuar dobra; a malha alterna claro e escuro pixel a pixel */
function vestido(n,d,f,a){
  const k=n+'|'+a+'|'+d+'|'+f;let c=VESTE.get(k);if(c!==undefined)return c;
  const s=ART.s[n],v=a&&ITEMS[a]&&ITEMS[a].veste;c=null;
  if(v&&v.cor){
    const m=mede(n,d,f),im=pixels(s,d,f),D=im.data,[R,G_,B]=corRGB(v.cor);
    for(let j=0;j<s.h;j++)for(let i=0;i<s.w;i++){const q=m.roupa[j*s.w+i]/255;if(!q)continue;const o=(j*s.w+i)*4;
      let l=(D[o]*.299+D[o+1]*.587+D[o+2]*.114)/255*1.1+.2;if(v.malha)l*=(i+j)&1?1.15:.85;
      D[o]+=(Math.min(255,R*l)-D[o])*q;D[o+1]+=(Math.min(255,G_*l)-D[o+1])*q;D[o+2]+=(Math.min(255,B*l)-D[o+2])*q}
    c=document.createElement('canvas');c.width=s.w;c.height=s.h;c.getContext('2d').putImageData(im,0,0);
  }
  VESTE.set(k,c);return c;
}
/* a arma na mão: o sprite do item pela metade, com o cabo na mão e a lâmina
   para cima. Só olhando para oeste ela fica na mão esquerda da tela; nas
   outras, na direita, longe do cajado que os magos já seguram de frente. De
   costas (norte) ela fica atrás do corpo. No golpe, gira junto com o arco */
const CABO=[25,25],ESC_ARMA=.55;
function poeArma(g,k,d,m,bx,by,sw){
  const s=ART.s['it_'+k];if(!s)return;
  const fr=d===3?1:-1,hx=bx+(fr<0?m.lb-1:m.la+1),hy=by+m.my;
  g.save();g.translate(hx,hy);
  if(sw!==null)g.rotate(sw);
  g.scale(fr*ESC_ARMA,ESC_ARMA);
  g.drawImage(ART.img,s.x,s.y,s.w,s.h,-CABO[0],-CABO[1],s.w,s.h);g.restore();
}
/* o amuleto: a pedra no peito, dois por dois, com contorno; de costas não aparece */
function poeAmuleto(g,k,m,bx,by){
  const v=ITEMS[k]&&ITEMS[k].veste,x=Math.round(bx+m.nx)-1,y=by+m.ny;
  g.fillStyle='#1a1410';g.fillRect(x-1,y-1,4,4);
  g.fillStyle=v&&v.cor||'#e8c040';g.fillRect(x,y,2,2);
  g.fillStyle='rgba(255,255,255,.75)';g.fillRect(x,y,1,1);
}
const corpo=(g,c,s,d,f,bx,by)=>c?g.drawImage(c,bx,by):g.drawImage(ART.img,s.x+f*s.w,s.y+d*s.h,s.w,s.h,bx,by,s.w,s.h);
/* boneco com o equipamento, em qualquer canvas: o mapa e o retrato do Banco */
function bonecoVestido(g,cl,eq,d,f,x,y,flash,sw){
  const n='cls_'+cl,s=ART.s[n];if(!s)return false;
  const bx=Math.round(x+T/2-s.w-s.ox),by=Math.round(y+T/2-s.h-s.oy),m=eq&&mede(n,d,f);
  const arma=eq&&eq.arma&&ITEMS[eq.arma]?eq.arma:null;
  if(arma&&d===0)poeArma(g,arma,d,m,bx,by,sw);
  const c=eq&&eq.armadura?vestido(n,d,f,eq.armadura):null;
  corpo(g,c,s,d,f,bx,by);
  if(flash){g.globalAlpha=.6;g.globalCompositeOperation='lighter';corpo(g,c,s,d,f,bx,by);g.globalCompositeOperation='source-over';g.globalAlpha=1}
  if(eq&&eq.amuleto&&d!==0&&ITEMS[eq.amuleto])poeAmuleto(g,eq.amuleto,m,bx,by);
  if(arma&&d!==0)poeArma(g,arma,d,m,bx,by,sw);
  return true;
}
/* retrato do personagem para as telas (o Banco): de frente, ampliado */
export function retrato(cv,cl,eq,d=2,esc=2){
  const g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
  const s=ART.ok&&ART.s['cls_'+cl];if(!s)return false;
  const m=mede('cls_'+cl,d,0),bx=Math.round(cv.width/esc/2-(m.l+m.r+1)/2),by=Math.round(cv.height/esc-6-m.top-m.alt);
  g.imageSmoothingEnabled=false;g.setTransform(esc,0,0,esc,0,0);
  /* o boneco no meio, com o pé um pouco acima da borda de baixo */
  return bonecoVestido(g,cl,eq,d,0,bx-T/2+s.w+s.ox,by-T/2+s.h+s.oy,false,null);
}

/* dead: caído no fim da incursão; arm: o escudo de apoio ativo; eq: o que
   ele veste ({arma,armadura,amuleto}) */
/* p.classe só existe nos outros jogadores da cidade; o próprio é o do save */
function drawPlayer(p,dead,arm,eq){
  const x=p.x,y=p.y+(dead?0:Math.sin(p.walk)*1.2),cl=p.classe||p.cl||save.classe;
  if(ART.ok){
    if(dead){if(spr('cad_'+cl,0,0,p.x,p.y))return}
    else{
      const sw0=p.swing>0?1-p.swing/.24:-1,sw=sw0<0?null:p.swingA-.9+sw0*1.8;
      if(sw!==null){ctx.strokeStyle=`rgba(255,236,190,${.9-sw0*.7})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y-2,p.swingR*.8,sw-.5,sw+.5);ctx.stroke()}
      if(arm){ctx.strokeStyle='rgba(255,214,138,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-4,19,0,TAU);ctx.stroke()}
      const s=ART.s['cls_'+cl];
      if(s){const d=dir4(p.face),f=p.mv&&s.f>1?1+((p.walk/3)|0)%(s.f-1):0;
        /* no golpe a arma gira de deitada para a frente do golpe */
        if(bonecoVestido(ctx,cl,eq,d,f,p.x,p.y,p.flash>0,sw===null?null:(sw-p.swingA)*(d===3||d===2?-1:1)))return}
    }
  }
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(p.x,p.y+11,12,4,0,0,TAU);ctx.fill();
  if(dead){ctx.fillStyle='#4a4658';ctx.beginPath();ctx.ellipse(x,y+4,16,7,0,0,TAU);ctx.fill();ctx.fillStyle='#8f8a7e';circle(ctx,x+12,y+2,5);return}
  const f=p.flash>0,K=p.classe?CLASSES[p.classe]:KL(),C=K.cor;
  const s=Math.cos(p.face)>=0?1:-1;
  if(p.swing>0){ // arco do golpe corpo a corpo
    const a=1-p.swing/.24,sw=p.swingA-.9+a*1.8;
    ctx.strokeStyle=`rgba(255,236,190,${.9-a*.7})`;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(x,y-2,p.swingR*.8,sw-.5,sw+.5);ctx.stroke();
  }
  if(arm){ctx.strokeStyle='rgba(255,214,138,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-4,19,0,TAU);ctx.stroke()}
  if(K.sil==='mago'){
    ctx.strokeStyle=C.arma;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x+13*s,y+12);ctx.lineTo(x+13*s,y-16);ctx.stroke();
  }else if(K.sil==='arqueiro'){
    ctx.strokeStyle=C.arma;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x+12*s,y-4,13,-1.1,1.1);ctx.stroke();
    ctx.strokeStyle='rgba(236,228,210,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+12*s+Math.cos(-1.1)*13,y-4+Math.sin(-1.1)*13);ctx.lineTo(x+12*s+Math.cos(1.1)*13,y-4+Math.sin(1.1)*13);ctx.stroke();
  }else{
    ctx.strokeStyle=C.arma;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+13*s,y+10);ctx.lineTo(x+13*s,y-18);ctx.stroke();
    ctx.strokeStyle='#6b4a2a';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x+8*s,y+6);ctx.lineTo(x+18*s,y+6);ctx.stroke();
  }
  ctx.fillStyle=f?'#fff':C.manto;ctx.beginPath();ctx.moveTo(x-11,y+11);ctx.lineTo(x+11,y+11);ctx.lineTo(x+7,y-5);ctx.lineTo(x-7,y-5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f2a33a';ctx.fillRect(x-11,y+9,22,2);
  /* sem a arte, a armadura é a faixa do tronco e o amuleto, a pedra no peito */
  const va=eq&&eq.armadura&&ITEMS[eq.armadura]&&ITEMS[eq.armadura].veste,vm=eq&&eq.amuleto&&ITEMS[eq.amuleto]&&ITEMS[eq.amuleto].veste;
  if(va&&va.cor&&!f){ctx.fillStyle=va.cor;ctx.beginPath();ctx.moveTo(x-9,y+4);ctx.lineTo(x+9,y+4);ctx.lineTo(x+7,y-5);ctx.lineTo(x-7,y-5);ctx.closePath();ctx.fill()}
  if(vm&&!f){ctx.fillStyle='#1a1410';ctx.fillRect(x-2,y-3,4,4);ctx.fillStyle=vm.cor||'#e8c040';ctx.fillRect(x-1,y-2,2,2)}
  ctx.fillStyle=f?'#fff':'#e4c39d';circle(ctx,x,y-9,6);
  if(K.sil==='guerreiro'){
    ctx.fillStyle=f?'#fff':C.gola;ctx.beginPath();ctx.moveTo(x-9,y-8);ctx.lineTo(x-9,y-14);ctx.quadraticCurveTo(x,y-21,x+9,y-14);ctx.lineTo(x+9,y-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#16131b';ctx.fillRect(x-6,y-12,12,3);
  }else{
    ctx.fillStyle=f?'#fff':C.gola;ctx.beginPath();ctx.moveTo(x-11,y-11);ctx.lineTo(x+11,y-11);ctx.lineTo(x+4*s,y-29);ctx.closePath();ctx.fill();
  }
  if(K.sil!=='guerreiro'){ctx.fillStyle=C.orbe;circle(ctx,x+13*s,K.sil==='mago'?y-18:y-17,3.5)}
}
function drawMon(m){
  if(ART.ok&&sprCriatura('mon_'+m.k,m.face,m.mv,m.anim*8,m.flash>0,m.x,m.y))return;
  const x=m.x,y=m.y+(m.mv?Math.sin(m.anim*12)*1:0),w=m.flash>0,c=(col)=>w?'#ffffff':col;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(m.x,m.y+m.r*.8,m.r*1.05,m.r*.35,0,0,TAU);ctx.fill();
  const s=G.p.x>=m.x?1:-1;
  switch(m.k){
    case'rato':
      ctx.strokeStyle=c('#9b7c66');ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-7*s,y+2);ctx.quadraticCurveTo(x-15*s,y-2,x-16*s,y+6);ctx.stroke();
      ctx.fillStyle=c('#7d6450');ctx.beginPath();ctx.ellipse(x,y+1,9,6,0,0,TAU);ctx.fill();
      circle(ctx,x+7*s,y-1,4.5);ctx.fillStyle=c('#c49a86');circle(ctx,x+5*s,y-5,2.2);
      ctx.fillStyle='#ff4d4d';circle(ctx,x+9*s,y-2,1.2);break;
    case'aranha':
      ctx.strokeStyle=c('#2a1f33');ctx.lineWidth=1.6;
      for(let i=0;i<4;i++){const a=(i-1.5)*.45,k=Math.sin(m.anim*14+i)*2;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+13,y+Math.sin(a)*10-4+k);ctx.lineTo(x+16,y+Math.sin(a)*12+5);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-13,y+Math.sin(a)*10-4-k);ctx.lineTo(x-16,y+Math.sin(a)*12+5);ctx.stroke()}
      ctx.fillStyle=c('#4a3560');circle(ctx,x,y+2,8);ctx.fillStyle=c('#3a2a4c');circle(ctx,x+5*s,y-3,5);
      ctx.fillStyle='#ff5a5a';circle(ctx,x+7*s,y-4,1.2);circle(ctx,x+4*s,y-5,1.2);break;
    case'esqueleto':
      ctx.strokeStyle=c('#a8a090');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+9*s,y+4);ctx.lineTo(x+14*s,y-10);ctx.stroke();
      ctx.fillStyle=c('#d8d1bd');ctx.fillRect(x-6,y-3,12,13);
      ctx.fillStyle='#2b2633';for(let i=0;i<3;i++)ctx.fillRect(x-5,y+i*4-1,10,1.5);
      ctx.fillStyle=c('#ece6d4');circle(ctx,x,y-9,7);ctx.fillStyle='#16131b';circle(ctx,x-2.5+s,y-10,1.8);circle(ctx,x+2.5+s,y-10,1.8);break;
    case'orc':
      ctx.fillStyle=c('#7a7468');ctx.fillRect(x+10*s-(s<0?6:0),y-14,6,10);ctx.strokeStyle=c('#6b4a2a');ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x+13*s,y-6);ctx.lineTo(x+11*s,y+12);ctx.stroke();
      ctx.fillStyle=c('#4f6b33');circle(ctx,x,y+2,13);ctx.fillStyle=c('#5f7f3c');circle(ctx,x+2*s,y-7,8);
      ctx.fillStyle=c('#6b4a2a');ctx.fillRect(x-12,y+5,24,4);
      ctx.fillStyle='#f3efe0';ctx.fillRect(x+(s>0?1:-4),y-3,3,4);ctx.fillRect(x+(s>0?6:-9),y-3,3,4);
      ctx.fillStyle='#ffb84d';circle(ctx,x+5*s,y-9,1.5);break;
    case'xama':
      ctx.strokeStyle=c('#7a5a3a');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+12*s,y+12);ctx.lineTo(x+12*s,y-16);ctx.stroke();
      ctx.fillStyle='#7cff8a';circle(ctx,x+12*s,y-18,3.5);
      ctx.fillStyle=c('#7a2f2a');ctx.beginPath();ctx.moveTo(x-12,y+12);ctx.lineTo(x+12,y+12);ctx.lineTo(x,y-14);ctx.closePath();ctx.fill();
      ctx.fillStyle=c('#5f7f3c');circle(ctx,x+2*s,y-4,6);ctx.fillStyle='#ffe066';circle(ctx,x+4*s,y-5,1.4);break;
    case'guardiao':{
      const g=c('#6b6577'),d=c('#4e4958');
      ctx.fillStyle=d;circle(ctx,x-18,y+2,8);circle(ctx,x+18,y+2,8);
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-16,y+16);ctx.lineTo(x+16,y+16);ctx.lineTo(x+19,y-8);ctx.lineTo(x+8,y-20);ctx.lineTo(x-8,y-20);ctx.lineTo(x-19,y-8);ctx.closePath();ctx.fill();
      ctx.strokeStyle=d;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-6,y-14);ctx.lineTo(x-1,y-2);ctx.lineTo(x-7,y+9);ctx.moveTo(x+9,y-4);ctx.lineTo(x+4,y+8);ctx.stroke();
      const e=.6+.4*Math.sin(G.t*5);ctx.fillStyle=`rgba(255,184,77,${e})`;ctx.fillRect(x-9,y-13,6,3);ctx.fillRect(x+3,y-13,6,3);break}
  }
}
/* ---------- interpolação ----------
   A regra anda a 20 passos por segundo (TICK); a tela, a 60. Para o movimento
   não andar aos saltos, o quadro é desenhado entre o passo anterior (x0, y0,
   guardados por update()) e o atual, na fração G.alfa — um passo atrás do
   estado, como todo jogo em rede. render() troca as posições pelas
   interpoladas, desenha e devolve as verdadeiras: nada é alocado e a regra
   nunca vê a posição desenhada. */
const lerp=(e,a)=>{e.xr=e.x;e.yr=e.y;if(e.x0!==undefined){e.x=e.x0+(e.x-e.x0)*a;e.y=e.y0+(e.y-e.y0)*a}};
const volta=e=>{e.x=e.xr;e.y=e.yr};
export function render(){
  if(!G)return cena();
  const a=G.alfa,tr=G.t;
  if(a<1){
    G.t-=(1-a)*TICK;
    for(const q of G.ps){lerp(q,a);q.wr=q.walk;if(q.w0!==undefined)q.walk=q.w0+(q.walk-q.w0)*a}
    for(const m of G.mons){lerp(m,a);m.ar=m.anim;if(m.a0!==undefined)m.anim=m.a0+(m.anim-m.a0)*a}
    for(const q of G.proj)lerp(q,a);
  }
  cena();
  if(a<1){G.t=tr;for(const q of G.ps){volta(q);q.walk=q.wr}for(const m of G.mons){volta(m);m.anim=m.ar}for(const q of G.proj)volta(q)}
}
function cena(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#0a0910';ctx.fillRect(0,0,W,H);
  if(!G)return;
  const p=G.p,sh=RM?0:G.shake; // sem tremor com prefers-reduced-motion
  const cx=Math.round(p.x-W/2+(sh?frr(-sh,sh):0)),cy=Math.round(p.y-H/2+(sh?frr(-sh,sh):0));
  ctx.setTransform(DPR,0,0,DPR,-cx*DPR,-cy*DPR);
  const x0=Math.max(0,Math.floor(cx/T)-1),x1=Math.min(MW-1,Math.ceil((cx+W)/T)+1),y0=Math.max(0,Math.floor(cy/T)-1),y1=Math.min(MH-1,Math.ceil((cy+H)/T)+1);
  G.torches.length=0;
  /* cada jogador da sala com o equipamento dele, vestido no boneco */
  const A=ART.ok,jogador=q=>drawPlayer(q,!!q.fora&&q.fora!=='extraiu',bf('arm',q),q.c&&q.c.equip);ctx.imageSmoothingEnabled=false;
  if(A)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    /* com os sprites: o chão aqui, as paredes depois, linha a linha junto com as criaturas */
    const h=hash(x,y),cx=x*T+T/2,cy=y*T+T/2;
    if(G.g[y*MW+x]===0){spr('chao',0,0,cx,cy);if(h%23===0)spr(h&64?'cascalho':'cascalho2',0,0,cx,cy)}
    else if(G.par[y*MW+x]===2&&h%19===0&&y+1<MH&&G.g[(y+1)*MW+x]===0)G.torches.push({x:cx-6,y:cy-14});
  }
  else for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=x*T,py=y*T,h=hash(x,y);
    if(G.g[y*MW+x]===0){
      ctx.fillStyle=h&1?'#221e2b':'#1e1a26';ctx.fillRect(px,py,T,T);
      ctx.fillStyle='#16131d';ctx.fillRect(px,py+T-2,T,2);ctx.fillRect(px+T-2,py,2,T);
      if(h%13===0){ctx.fillStyle='#2e2938';ctx.fillRect(px+4+(h>>5)%20,py+6+(h>>9)%18,3,2)}
      if(h%37===0){ctx.strokeStyle='#131118';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+6,py+8);ctx.lineTo(px+14,py+16);ctx.lineTo(px+12,py+25);ctx.stroke()}
    }else if(nearFloor(x,y)){
      ctx.fillStyle='#3a3445';ctx.fillRect(px,py,T,T);
      ctx.fillStyle='#463f53';ctx.fillRect(px,py,T,3);
      ctx.fillStyle='#302b3a';ctx.fillRect(px,py+15,T,1);ctx.fillRect(px+((y&1)?8:22),py+3,1,12);ctx.fillRect(px+((y&1)?22:8),py+16,1,T-16);
      if(y+1<MH&&G.g[(y+1)*MW+x]===0){
        ctx.fillStyle='#262130';ctx.fillRect(px,py+T-12,T,12);ctx.fillStyle='#1a1621';ctx.fillRect(px,py+T-2,T,2);
        if(h%19===0){
          const tx=px+T/2,ty=py+T-12,fl=Math.sin(G.t*14+h)*1.5;
          ctx.fillStyle='#5a4128';ctx.fillRect(tx-2,ty,4,8);
          ctx.fillStyle='#f2a33a';ctx.beginPath();ctx.ellipse(tx,ty-3,3.5,6+fl,0,0,TAU);ctx.fill();
          ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.ellipse(tx,ty-2,1.6,3,0,0,TAU);ctx.fill();
          G.torches.push({x:tx,y:ty});
        }
      }
    }
  }
  // portal
  const po=G.portal;
  if(A){
    if(po.open){const g=ctx.createRadialGradient(po.x,po.y,2,po.x,po.y,34);g.addColorStop(0,'rgba(120,190,255,.55)');g.addColorStop(1,'rgba(60,120,255,0)');ctx.fillStyle=g;circle(ctx,po.x,po.y,34)}
    spr('portal',0,0,po.x,po.y);
    if(po.open){const s=ART.s.ef_cura;if(s)spr('ef_cura',0,Math.floor(G.t*12)%s.f,po.x,po.y)}
  }else if(po.open){
    const g=ctx.createRadialGradient(po.x,po.y,2,po.x,po.y,30);g.addColorStop(0,'rgba(255,214,140,.9)');g.addColorStop(1,'rgba(242,163,58,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(po.x,po.y,30,17,0,0,TAU);ctx.fill();
    for(let k=0;k<3;k++){const a=G.t*(1.5+k*.7);ctx.strokeStyle=k?'rgba(242,163,58,.7)':'#ffd68a';ctx.lineWidth=2.5-k*.5;ctx.beginPath();ctx.ellipse(po.x,po.y,26-k*7,15-k*4,0,a,a+TAU*.75);ctx.stroke()}
  }else{
    ctx.strokeStyle='#3b3546';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(po.x,po.y,24,13,0,0,TAU);ctx.stroke();
    ctx.fillStyle='#3b3546';for(let k=0;k<6;k++){const a=k/6*TAU;ctx.fillRect(po.x+Math.cos(a)*24-2,po.y+Math.sin(a)*13-2,4,4)}
  }
  // cadáveres e sacos de loot
  if(A)for(const c of G.cad)spr('cad_'+c.k,0,0,c.x,c.y);
  if(A)for(const d of G.drops){
    if(d.rar){ctx.fillStyle=['','#6cb0ff40','#c98bff50'][d.rar];circle(ctx,d.x,d.y,15)}
    spr('saco'+d.rar,0,0,d.x+6,d.y+4);
  }
  else for(const d of G.drops){
    const glow=['#d9c7a0','#6cb0ff','#c98bff'][d.rar],b=Math.sin(d.t*4)*1.5;
    if(d.rar){ctx.fillStyle=glow+'40';circle(ctx,d.x,d.y,15)}
    ctx.fillStyle='#7a5a36';ctx.beginPath();ctx.ellipse(d.x,d.y+b,8,7,0,0,TAU);ctx.fill();
    ctx.fillStyle='#5c4228';ctx.fillRect(d.x-3,d.y-9+b,6,4);
    ctx.strokeStyle=glow;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(d.x,d.y+b,8,7,0,0,TAU);ctx.stroke();
  }
  // entidades por profundidade
  const vis=G.mons.filter(m=>m.x>cx-40&&m.x<cx+W+40&&m.y>cy-40&&m.y<cy+H+40);
  const ents=vis.map(m=>({y:m.y,m}));
  /* os jogadores da sala também; quem saiu pelo portal some */
  for(const q of G.ps)if(q.fora!=='extraiu')ents.push({y:q.y,pl:q});
  ents.sort((a,b)=>a.y-b.y);
  if(A){
    /* ordem do cliente do Tibia: linha por linha, as paredes da linha e depois
       quem está nela. Parede de baixo cobre o pé de quem encosta nela, e a
       criatura cobre a parede de cima */
    let k=0;
    for(let y=y0;y<=y1;y++){
      for(let x=x0;x<=x1;x++){const q=G.par[y*MW+x];if(q)spr(PECA[q],0,0,x*T+T/2,y*T+T/2)}
      for(const t of G.torches)if((t.y/T|0)===y)spr('tocha',0,0,t.x+6,t.y+14);
      while(k<ents.length&&ents[k].y<(y+1)*T){const e=ents[k++];e.pl?jogador(e.pl):drawMon(e.m)}
    }
    while(k<ents.length){const e=ents[k++];e.pl?jogador(e.pl):drawMon(e.m)}
  }else for(const e of ents)e.pl?jogador(e.pl):drawMon(e.m);
  // projéteis
  for(const q of G.proj){
    if(A){
      const n=q.k==='m'?'mi_xama':'mi_'+(q.s.el||'fisico');
      if(spr(n,q.k==='r'?dir8(q.tx-q.x,q.ty-q.y):dir8(q.vx,q.vy),0,q.x,q.y))continue;
    }
    const col=q.col||'#c6ffbf';
    if(q.k==='b'){ctx.fillStyle=rgba(col,.35);circle(ctx,q.x,q.y,7);ctx.fillStyle=col;circle(ctx,q.x,q.y,3.5)}
    else if(q.k==='r'){ctx.fillStyle=rgba(col,.4);circle(ctx,q.x,q.y,9);ctx.fillStyle=col;circle(ctx,q.x,q.y,5)}
    else{ctx.fillStyle='rgba(124,255,138,.35)';circle(ctx,q.x,q.y,7);ctx.fillStyle='#c6ffbf';circle(ctx,q.x,q.y,3.5)}
  }
  for(const f of G.fx){
    const a=1-f.t/f.life;
    if(A&&f.k==='ef'){const s=ART.s[f.n];if(s)spr(f.n,0,Math.min(s.f-1,f.t/f.life*s.f|0),f.x,f.y);continue}
    if(A&&(f.k==='boom'||f.k==='anel'||f.k==='cone'||f.k==='feixe')&&efArea(f))continue;
    if(A&&f.k==='puff')continue;
    if(f.k==='boom'){const R=f.raio||74;ctx.fillStyle=rgba(f.col||'#f27828',a*.45);circle(ctx,f.x,f.y,R*(.5+.5*(1-a)));ctx.strokeStyle=rgba(f.col||'#ffd68a',a);ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,R*(1-a*.6),0,TAU);ctx.stroke()}
    else if(f.k==='anel'){ctx.strokeStyle=rgba(f.col,a);ctx.lineWidth=4*a+1;ctx.beginPath();ctx.arc(f.x,f.y,f.raio*(1-a*.75),0,TAU);ctx.stroke();ctx.fillStyle=rgba(f.col,a*.16);circle(ctx,f.x,f.y,f.raio*(1-a*.75))}
    else if(f.k==='cone'){ctx.fillStyle=rgba(f.col,a*.35);ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.arc(f.x,f.y,f.raio*(1-a*.5),f.ang-f.ab,f.ang+f.ab);ctx.closePath();ctx.fill()}
    else if(f.k==='feixe'){const ux=Math.cos(f.ang),uy=Math.sin(f.ang);ctx.strokeStyle=rgba(f.col,a);ctx.lineWidth=9*a+2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+ux*f.comp,f.y+uy*f.comp);ctx.stroke();ctx.lineCap='butt'}
    else if(f.k==='puff'){ctx.fillStyle=`rgba(120,110,130,${a*.6})`;circle(ctx,f.x,f.y,f.r*(1.5-a*.5))}
    else if(f.k==='sp'){ctx.fillStyle=f.col;ctx.globalAlpha=a;ctx.fillRect(f.x-1.5,f.y-1.5,3,3);ctx.globalAlpha=1}
  }
  // escuridão e luzes
  dctx.setTransform(DPR,0,0,DPR,0,0);dctx.globalCompositeOperation='source-over';dctx.clearRect(0,0,W,H);
  dctx.fillStyle='rgba(6,5,10,.82)';dctx.fillRect(0,0,W,H);dctx.globalCompositeOperation='destination-out';
  const light=(x,y,r,a)=>{x-=cx;y-=cy;if(x<-r||y<-r||x>W+r||y>H+r)return;const g=dctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(.5,`rgba(0,0,0,${a*.75})`);g.addColorStop(1,'rgba(0,0,0,0)');dctx.fillStyle=g;dctx.fillRect(x-r,y-r,r*2,r*2)};
  light(p.x,p.y,250+(RM?0:Math.sin(G.t*9)*5),1);
  for(const q of G.ps)if(q!==p&&!q.fora)light(q.x,q.y,170,.9);
  if(po.open)light(po.x,po.y,180,.9);
  for(const t of G.torches)light(t.x,t.y,120,.75);
  for(const q of G.proj)light(q.x,q.y,q.k==='r'?90:55,.8);
  for(const f of G.fx){const a=1-f.t/f.life;
    if(f.k==='boom')light(f.x,f.y,(f.raio||74)*2*a,1);
    else if(f.k==='anel'||f.k==='cone')light(f.x,f.y,f.raio*1.3*a,.9);
    else if(f.k==='feixe')light(f.x+Math.cos(f.ang)*f.comp*.5,f.y+Math.sin(f.ang)*f.comp*.5,f.comp*.6*a,.9);
  }
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(dark,0,0);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(G.active&&RUN-G.t<=60&&!G.over){const a=.18+.1*Math.sin(G.t*4);const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba(216,72,63,0)');g.addColorStop(1,`rgba(216,72,63,${a})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  // nomes, vida e números (por cima da escuridão)
  ctx.setTransform(DPR,0,0,DPR,-cx*DPR,-cy*DPR);
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.font=FONTE_MAPA;
  for(const m of vis){
    if(hyp(m.x-p.x,m.y-p.y)>265)continue;
    const pct=Math.max(0,m.hp/m.mhp),col=corVida(pct),bw=m.t.boss?46:27,top=A?m.y-(m.t.boss?44:30):m.y-m.r-(m.k==='guardiao'?14:18),mx=m.x-(A?desl('mon_'+m.k):0);
    outText(m.t.nome,mx,top-6,col);
    ctx.fillStyle='#000';ctx.fillRect(mx-bw/2-1,top-2,bw+2,5);ctx.fillStyle=col;ctx.fillRect(mx-bw/2,top-1,bw*pct,3);
  }
  /* os outros da sala com o nome; você, como sempre, "Você" */
  for(const q of G.ps){if(q===p||q.fora)continue;
    const pct=q.hp/q.mhp,col=corVida(pct),top=A?q.y-30:q.y-34,px=q.x-(A?desl('cls_'+q.cl):0);
    outText(q.nome||CLASSES[q.cl].nome,px,top-6,col);ctx.fillStyle='#000';ctx.fillRect(px-14,top-2,29,5);ctx.fillStyle=col;ctx.fillRect(px-13,top-1,27*pct,3)}
  if(!(p.fora&&p.fora!=='extraiu')){
    const pct=p.hp/p.mhp,col=corVida(pct),top=A?p.y-30:p.y-34,px=p.x-(A?desl('cls_'+save.classe):0);
    outText('Você',px,top-6,col);ctx.fillStyle='#000';ctx.fillRect(px-14,top-2,29,5);ctx.fillStyle=col;ctx.fillRect(px-13,top-1,27*pct,3);
  }
  if(p.pch>0){ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x,p.y,24,0,TAU);ctx.stroke();ctx.strokeStyle='#ffd68a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,24,-Math.PI/2,-Math.PI/2+TAU*p.pch/EXT);ctx.stroke();outText('Extraindo…',p.x,p.y+40,'#ffd68a')}
  for(const f of G.fx){if(f.k!=='num')continue;const a=1-f.t/f.life;ctx.globalAlpha=Math.min(1,a*1.6);ctx.font=`700 ${f.big?13:11}px Verdana,Tahoma,sans-serif`;outText(f.txt,f.x,f.y-f.t*32,f.col);ctx.globalAlpha=1}
}
/* ---------- cidade ----------
   Dia claro, sem escuridão nem minimapa: a cidade é o lugar seguro. Mesma
   ordem de desenho da masmorra (chão, depois linha a linha as paredes, as
   árvores e quem está na linha). Sem a arte, cores chapadas. */
const CHAO_C=['grama','','rua','assoalho','grama','agua','rua','praca','ponte','grama','terra'],
  COR_C=['#3e6b2b','#5a5650','#6d675d','#6b4a2a','#3e6b2b','#2b5f93','#6d675d','#7d7a70','#8a6a3a','#3e6b2b','#5b3d22'];
const NPC_COR={mercador:'#7a5a36',banqueiro:'#c9c2ae',guia:'#4f6b33',corretor:'#8a3f2c',quitandeira:'#e0dccf',boticaria:'#3c3a44',mago:'#2f4f9a',ferreiro:'#8d8a84'};
/* o que cresce no chão (flores, horta) e os objetos, sem a arte: cor e forma */
const FLOR=['flor1','flor2','flor3','flor4'],COR_FLOR=['#7f8cff','#f2d24b','#e0483a','#f6e9a0'];
const COR_OBJ={fonte:'#8fb4d8',poco:'#6e6a62',barril:'#7a4a22',caixote:'#a87c45',estatua:'#a9a59b',arbusto:'#2f6a2a',cerejeira:'#e7a0b8',frutifera:'#3b6e2b',forno:'#3a3633',estante:'#6b4a2a',banca:'#9a6a35',lenha:'#8a6a3a'};
function drawObj(n,x,y,hh){
  if(ART.ok&&spr('obj_'+n+(n==='arbusto'&&hh&1?'2':''),0,0,x,y))return;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y+10,12,4,0,0,TAU);ctx.fill();
  ctx.fillStyle=COR_OBJ[n]||'#77726a';
  if(n==='cerejeira'||n==='frutifera'||n==='arbusto'){ctx.fillStyle='#4a3420';ctx.fillRect(x-3,y-4,6,14);ctx.fillStyle=COR_OBJ[n];circle(ctx,x,y-12,n==='arbusto'?10:14)}
  else if(n==='fonte'||n==='poco'){circle(ctx,x,y,13);ctx.fillStyle=n==='fonte'?'#2b5f93':'#111';circle(ctx,x,y,8)}
  else ctx.fillRect(x-11,y-12,22,22);
}
function drawNpc(n,p){
  /* o NPC vira para quem chega perto, como no Tibia */
  const perto=hyp(p.x-n.x,p.y-n.y)<T*3,face=perto?Math.atan2(p.y-n.y,p.x-n.x):Math.PI/2;
  if(C.perto===n.k){ctx.strokeStyle='rgba(232,194,90,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(n.x,n.y+10,15,6,0,0,TAU);ctx.stroke()}
  if(ART.ok&&sprCriatura('npc_'+n.k,face,false,0,false,n.x,n.y))return;
  const x=n.x,y=n.y;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(x,y+11,12,4,0,0,TAU);ctx.fill();
  ctx.fillStyle=NPC_COR[n.k]||'#77726a';ctx.beginPath();ctx.moveTo(x-11,y+11);ctx.lineTo(x+11,y+11);ctx.lineTo(x+7,y-5);ctx.lineTo(x-7,y-5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e4c39d';circle(ctx,x,y-9,6);
}
/* os outros jogadores da cidade (src/sim/cidade.js), sem criar função por quadro */
let linhaC=0;
const outroNaLinha=o=>{if(o.vis&&(o.y/T|0)===linhaC)drawPlayer(o,false,false,o.eq)};
const nomeDoOutro=o=>{if(o.vis)outText(o.nome,o.x-(ART.ok?desl('cls_'+o.classe):0),o.y-(ART.ok?36:30),'#c8e6a0')};
export function renderCidade(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#0a0910';ctx.fillRect(0,0,W,H);
  if(!C)return;
  const p=C.p,w=C.w,h=C.h,LW=w*T,LH=h*T;
  /* câmera no jogador, presa às bordas; mapa menor que a tela fica no meio */
  const cx=LW<=W?Math.round((LW-W)/2):Math.round(clamp(p.x-W/2,0,LW-W)),cy=LH<=H?Math.round((LH-H)/2):Math.round(clamp(p.y-H/2,0,LH-H));
  ctx.setTransform(DPR,0,0,DPR,-cx*DPR,-cy*DPR);
  const x0=Math.max(0,Math.floor(cx/T)-1),x1=Math.min(w-1,Math.ceil((cx+W)/T)+1),y0=Math.max(0,Math.floor(cy/T)-1),y1=Math.min(h-1,Math.ceil((cy+H)/T)+1);
  const A=ART.ok;ctx.imageSmoothingEnabled=false;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const k=C.t[y*w+x],hh=hash(x,y),mx=x*T+T/2,my=y*T+T/2;
    if(A&&k!==1&&spr(CHAO_C[k]==='grama'&&hh%5===0?'grama2':CHAO_C[k],0,0,mx,my)){
      if(k===9)spr(FLOR[(hh>>3)&3],0,0,mx,my);else if(k===10&&!(x&1))spr(hh&1?'horta':'horta2',0,0,mx,my);
      continue}
    ctx.fillStyle=COR_C[k];ctx.fillRect(x*T,y*T,T,T);
    if(k===9){ctx.fillStyle=COR_FLOR[(hh>>3)&3];for(let j=0;j<3;j++)circle(ctx,x*T+6+((hh>>(5+j*3))%20),y*T+6+((hh>>(9+j*3))%20),2.5)}
    else if(k===10&&!(x&1)){ctx.fillStyle='#4f8a34';circle(ctx,mx,my,7)}
    else if(k===0||k===4){ctx.fillStyle='#355f25';if(hh%3===0)ctx.fillRect(x*T+4+(hh>>5)%20,y*T+6+(hh>>9)%18,3,2)}
    else if(k===2||k===6){ctx.fillStyle='#5d574e';ctx.fillRect(x*T,y*T+T-2,T,2);ctx.fillRect(x*T+T-2,y*T,2,T)}
    else if(k===3){ctx.fillStyle='#5a3d22';ctx.fillRect(x*T,y*T+15,T,1)}
  }
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<=x1;x++){
      const i=y*w+x,k=C.t[i],mx=x*T+T/2,my=y*T+T/2;
      if(k===1){if(A&&spr(PECA[C.par[i]]||'par_h',0,0,mx,my))continue;
        ctx.fillStyle='#57524b';ctx.fillRect(x*T,y*T-10,T,T+10);ctx.fillStyle='#6b665e';ctx.fillRect(x*T,y*T-10,T,3)}
      else if(k===4){if(A&&spr(hash(x,y)&1?'arvore':'arvore2',0,0,mx,my))continue;
        ctx.fillStyle='#4a3420';ctx.fillRect(mx-3,my-4,6,14);ctx.fillStyle='#2f5a22';circle(ctx,mx,my-12,14);ctx.fillStyle='#3b6e2b';circle(ctx,mx-4,my-16,8)}
      else if(k===6){if(A&&spr('portal',0,0,mx,my))continue;
        ctx.strokeStyle='#ffd68a';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(mx,my,13,9,0,0,TAU);ctx.stroke()}
      else if(C.obj[i])drawObj(LISTA_OBJ[C.obj[i]-1],mx,my,hash(x,y));
    }
    for(const n of C.npcs)if((n.y/T|0)===y)drawNpc(n,p);
    linhaC=y;C.outros.forEach(outroNaLinha);
    if((p.y/T|0)===y)drawPlayer(p,false,false,ch().equip);
  }
  /* nomes por cima de tudo, como no mapa da masmorra */
  ctx.font=FONTE_MAPA;
  for(const n of C.npcs)outText(CITY.npcs[n.k].nome,n.x-(A?desl('npc_'+n.k):0),n.y-(A?36:30),'#8fd0ff');
  C.outros.forEach(nomeDoOutro);
  outText('Você',p.x-(A?desl('cls_'+save.classe):0),p.y-(A?36:30),'#00c000');
}
/* o mapa da cidade no canto: o desenho fixo sai uma vez por cidade (fundo),
   e por cima, a cada chamada, os NPCs, quem mais está nela e você */
const COR_MC=['#2e5a22','#a6a29a','#8a8478','#6b4a2a','#1d3d15','#2b5f93','#e8c25a','#9a968c','#8a6a3a','#3f6b2a','#5b3d22'];
let fundoMC=null,deMC=null;
const pontoOutro=o=>{if(o.vis){cmctx.fillStyle='#c8e6a0';cmctx.fillRect(o.x/T*sMC-1,o.y/T*sMC-1,2.5,2.5)}};
let sMC=1;
export function drawMiniCidade(){
  if(!C)return;
  const w=cmini.clientWidth||108,h=Math.round(w*C.h/C.w);sMC=w/C.w;
  if(deMC!==C||cmini.width!==Math.round(w*DPR)){
    deMC=C;cmini.style.height=h+'px';cmini.width=Math.round(w*DPR);cmini.height=Math.round(h*DPR);
    fundoMC=document.createElement('canvas');fundoMC.width=C.w;fundoMC.height=C.h;
    const f=fundoMC.getContext('2d');
    for(let i=0;i<C.w*C.h;i++){f.fillStyle=C.obj[i]?'#55524b':COR_MC[C.t[i]];f.fillRect(i%C.w,i/C.w|0,1,1)}
  }
  cmctx.setTransform(DPR,0,0,DPR,0,0);cmctx.imageSmoothingEnabled=false;cmctx.drawImage(fundoMC,0,0,w,h);
  cmctx.fillStyle='#e8c25a';for(const n of C.npcs)cmctx.fillRect(n.x/T*sMC-1.5,n.y/T*sMC-1.5,3,3);
  C.outros.forEach(pontoOutro);
  cmctx.fillStyle='#fff';cmctx.fillRect(C.p.x/T*sMC-1.5,C.p.y/T*sMC-1.5,3,3);
}
export function drawMini(){
  const s=MS/MW;mctx.setTransform(DPR,0,0,DPR,0,0);mctx.clearRect(0,0,MS,MS);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const i=y*MW+x;if(!G.seen[i])continue;
    if(G.g[i]===0){mctx.fillStyle='#996633';mctx.fillRect(x*s,y*s,s+.4,s+.4)}
    else if(G.par[i]){mctx.fillStyle='#999999';mctx.fillRect(x*s,y*s,s+.4,s+.4)}}
  const po=G.portal;
  if(po.open){const b=.5+.5*Math.sin(G.t*6);mctx.fillStyle=`rgba(242,193,78,${.5+b*.5})`;mctx.fillRect(po.x/T*s-3,po.y/T*s-3,6,6)}
  mctx.fillStyle='#ffffff';mctx.fillRect(G.p.x/T*s-2,G.p.y/T*s-2,4,4);
}
