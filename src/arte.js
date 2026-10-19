/* ---------- arte (assets/otsp) ----------
   Sprites do OpenTibia Sprite Pack (CC BY 4.0), num atlas montado por
   tools/sprites.mjs; créditos em assets/CREDITOS.md. Carrega em paralelo e
   não segura o jogo: enquanto não chega, ou se não chegar, o render() usa o
   desenho em código de antes. app.dataset.arte marca que chegou (o CSS usa
   para os ícones). */
import {TAU} from './sim/base.js?v=0.46.0';
import {app} from './dom.js?v=0.46.0';

export const ART_URL='assets/otsp/';
/* a imagem leva a versão do jogo (?v=, como os módulos): sem ela, um atlas
   velho do cache com o atlas.json novo recortaria os sprites errado. Baixa o
   WebP sem perda (metade do PNG, os mesmos pixels); o aparelho que não abre
   WebP (iOS antes do 14) cai no PNG. ART.url é o que chegou, que os ícones da
   interface também usam */
const V=(()=>{try{return new URL(import.meta.url).search}catch(e){return ''}})();
export const ART={ok:false,img:null,s:{},w:1,h:1,url:''};
/* o atlas começa a baixar assim que este módulo carrega, junto do
   content.json e não depois dele, e a imagem não espera o atlas.json: no 4G
   é a diferença entre a arte chegar a tempo ou não (caso rede-4g) */
let pedido=null;
function pede(){
  if(pedido)return pedido;
  const im=new Image(),png=new Promise((ok,ko)=>{
    im.onload=()=>{ART.url=im.src;ok(im)};
    im.onerror=()=>{if(/webp/.test(im.src))im.src=ART_URL+'atlas.png'+V;else ko(new Error('atlas'))};
  });
  im.src=ART_URL+'atlas.webp'+V;
  const js=fetch(ART_URL+'atlas.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()});
  pedido=Promise.all([js,png]);pedido.catch(()=>{});return pedido;
}
try{pede()}catch(e){/* sem DOM: carregaArte tenta de novo */}
export async function carregaArte(aoChegar){try{
  const[j,im]=await pede();
  ART.img=im;ART.s=j.sprites||{};ART.w=im.naturalWidth;ART.h=im.naturalHeight;ART.ok=true;app.dataset.arte='1';
  aoChegar();
}catch(e){/* sem arte: segue o desenho em código */}}
/* sprite do atlas como fundo de um elemento da interface (ícones); caixa fixa
   alinha pelo canto inferior direito, como no mapa, criatura pequena e grande */
export function icone(el,n,d,f,caixa){
  const s=ART.s[n];if(!ART.ok||!s)return false;
  const cw=caixa||s.w,chh=caixa||s.h;
  el.style.width=cw+'px';el.style.height=chh+'px';
  el.style.backgroundImage=`url(${ART.url})`;el.style.backgroundSize=`${ART.w}px ${ART.h}px`;
  el.style.backgroundPosition=`${cw-s.w-(s.x+(f||0)*s.w)}px ${chh-s.h-(s.y+(d||0)*s.h)}px`;
  /* caixa maior que o sprite: o fundo só pinta o canto do sprite, senão os
     vizinhos do atlas aparecem junto (o cavaleiro de 32 px numa caixa de 64) */
  el.style.padding=`${Math.max(0,chh-s.h)}px 0 0 ${Math.max(0,cw-s.w)}px`;el.style.backgroundClip='content-box';
  return true;
}
/* as quatro direções do Tibia: norte, leste, sul, oeste */
export const dir4=a=>{const c=Math.cos(a),s=Math.sin(a);return Math.abs(c)>=Math.abs(s)?(c>0?1:3):(s>0?2:0)};
/* oito direções do projétil, a partir do leste no sentido horário */
export const dir8=(x,y)=>((Math.round(Math.atan2(y,x)/(TAU/8))%8)+8)%8;
export const desl=n=>(ART.s[n]&&ART.s[n].ox)||0;
