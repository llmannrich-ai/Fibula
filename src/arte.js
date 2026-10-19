/* ---------- arte (assets/otsp) ----------
   Sprites do OpenTibia Sprite Pack (CC BY 4.0), num atlas montado por
   tools/sprites.mjs; créditos em assets/CREDITOS.md. Carrega em paralelo e
   não segura o jogo: enquanto não chega, ou se não chegar, o render() usa o
   desenho em código de antes. app.dataset.arte marca que chegou (o CSS usa
   para os ícones). */
import {TAU} from './sim/base.js?v=0.26.0';
import {app} from './dom.js?v=0.26.0';

export const ART_URL='assets/otsp/';
/* a imagem leva a versão do jogo (?v=, como os módulos): sem ela, um atlas
   velho do cache com o atlas.json novo recortaria os sprites errado */
const PNG='atlas.png'+(()=>{try{return new URL(import.meta.url).search}catch(e){return ''}})();
export const ART={ok:false,img:null,s:{},w:1,h:1};
export async function carregaArte(aoChegar){try{
  const r=await fetch(ART_URL+'atlas.json',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json(),im=new Image();
  await new Promise((ok,ko)=>{im.onload=ok;im.onerror=()=>ko(new Error('atlas.png'));im.src=ART_URL+PNG});
  ART.img=im;ART.s=j.sprites||{};ART.w=im.naturalWidth;ART.h=im.naturalHeight;ART.ok=true;app.dataset.arte='1';
  aoChegar();
}catch(e){/* sem arte: segue o desenho em código */}}
/* sprite do atlas como fundo de um elemento da interface (ícones); caixa fixa
   alinha pelo canto inferior direito, como no mapa, criatura pequena e grande */
export function icone(el,n,d,f,caixa){
  const s=ART.s[n];if(!ART.ok||!s)return false;
  const cw=caixa||s.w,chh=caixa||s.h;
  el.style.width=cw+'px';el.style.height=chh+'px';
  el.style.backgroundImage=`url(${ART_URL}${PNG})`;el.style.backgroundSize=`${ART.w}px ${ART.h}px`;
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
export const PECA=['','par_v','par_h','par_poste','par_canto'];
export const desl=n=>(ART.s[n]&&ART.s[n].ox)||0;
