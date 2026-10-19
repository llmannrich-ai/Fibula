/* ---------- mapa ----------
   Os mapas de caça são fixos (decisão do Leonardo, 19/10/2026): cada lugar
   tem o mapa dele em hunts.<k>.mapa no content.json, desenhado no Remere's
   Map Editor com os sprites do OTSP e convertido por tools/otbm.mjs (ou
   gerado como rascunho por tools/mapas.mjs). leMapa() lê esse mapa; o
   gerador (genMap, objetos) ficou só para o rascunho, e pecas() serve também
   à cidade. */
import {MW,MH,rnd,ri,hyp,sorte,semente} from './base.js?v=0.37.0';

function carve(g,x,y){if(x>0&&y>0&&x<MW-1&&y<MH-1)g[y*MW+x]=0}
function corridor(g,a,b){
  let x=a.cx,y=a.cy;
  const sx=()=>{while(x!==b.cx){carve(g,x,y);carve(g,x,y+1);x+=Math.sign(b.cx-x)}};
  const sy=()=>{while(y!==b.cy){carve(g,x,y);carve(g,x+1,y);y+=Math.sign(b.cy-y)}};
  if(sorte()<.5){sx();sy()}else{sy();sx()}
  carve(g,x,y);carve(g,x+1,y);carve(g,x,y+1);
}
function carveRooms(g,rooms,atalhos){
  for(const r of rooms)for(let j=r.y;j<r.y+r.h;j++)for(let i=r.x;i<r.x+r.w;i++)g[j*MW+i]=0;
  for(let i=1;i<rooms.length;i++){
    let best=0,bd=1e9;
    for(let j=0;j<i;j++){const d=hyp(rooms[i].cx-rooms[j].cx,rooms[i].cy-rooms[j].cy);if(d<bd){bd=d;best=j}}
    corridor(g,rooms[best],rooms[i]);
  }
  for(let k=0;k<atalhos;k++)corridor(g,rooms[rnd(rooms.length)],rooms[rnd(rooms.length)]);
}
/* m é o mapa do mapa de caça (hunts.<k>.mapa no content.json): quantas
   salas, de que tamanho e quantos corredores a mais; sem ele, a Masmorra de
   Runas de sempre, na mesma sequência de sorteio */
const PADRAO={salas:[9,15],w:[5,10],h:[5,9],atalhos:3};
export function genMap(m0){
  const m=Object.assign({},PADRAO,m0),r=genSalas(m);
  r.obj=objetos(r.g,r.rooms,m.objetos);return r;
}
function genSalas(m){
  let fallback=null;
  for(let attempt=0;attempt<50;attempt++){
    const g=new Uint8Array(MW*MH).fill(1),rooms=[];
    for(let t=0;t<600&&rooms.length<m.salas[1];t++){
      const w=ri(m.w[0],m.w[1]),h=ri(m.h[0],m.h[1]),x=ri(2,MW-w-3),y=ri(2,MH-h-3);
      if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
      rooms.push({x,y,w,h,cx:x+(w>>1),cy:y+(h>>1)});
    }
    if(rooms.length<m.salas[0]){if(!fallback||rooms.length>fallback.rooms.length)fallback={g,rooms};continue}
    carveRooms(g,rooms,m.atalhos);
    return{g,rooms};
  }
  const{g,rooms}=fallback;carveRooms(g,rooms,m.atalhos);return{g,rooms};
}
/* ---------- objetos ----------
   Os objetos sólidos do lugar (mapa.objetos no content.json: pilar, rocha,
   sarcófago, palmeira...), como os do Tibia: ocupam o sqm e ninguém passa.
   Ficam em g com o valor 2 (sólido, mas com chão debaixo) e em obj com o
   número do objeto na lista mais 1. onde: parede (encostado numa parede da
   sala, longe das passagens), canto (entre duas paredes) ou meio (no miolo de
   sala grande, longe do centro). p é a chance de cada sqm que serve.
   A sorte é um hash da semente e do sqm, não o sorteio da regra: o mesmo
   lugar com a mesma semente tem os mesmos objetos, e a sequência do resto da
   masmorra (monstros, dano, loot) não muda por causa deles. Nenhum objeto
   fecha caminho: se tampar uma passagem, não entra */
const sh=(x,y,i)=>{let h=(Math.imul(x+1,73856093)^Math.imul(y+1,19349663)^Math.imul(i+7,83492791)^semente)>>>0;
  h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;return((h^(h>>>16))>>>0)/4294967296};
const FILA=new Int32Array(MW*MH);
function alcance(g,ini){
  const v=new Uint8Array(MW*MH);let h=0,t=0,n=1;v[ini]=1;FILA[t++]=ini;
  while(h<t){const c=FILA[h++],x=c%MW;
    for(const d of [x>0?-1:0,x<MW-1?1:0,-MW,MW]){const k=c+d;if(d&&k>=0&&k<MW*MH&&!v[k]&&g[k]===0){v[k]=1;n++;FILA[t++]=k}}}
  return n;
}
function objetos(g,rooms,lista){
  const obj=new Uint8Array(MW*MH);if(!lista||!lista.length)return obj;
  const s=rooms[0],ini=s.cy*MW+s.cx;let livres=alcance(g,ini);
  const chao=(x,y)=>g[y*MW+x]===0,par=(x,y)=>g[y*MW+x]===1;
  for(let ri=0;ri<rooms.length;ri++){const r=rooms[ri],dentro=(x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
    for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
      if(!chao(x,y)||Math.max(Math.abs(x-r.cx),Math.abs(y-r.cy))<2)continue;
      /* uma passagem (chão fora da sala) por perto, ou outro objeto colado: não */
      let boca=false,viz=false;
      for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=x+i,b=y+j;
        if(g[b*MW+a]===0&&!dentro(a,b))boca=true;if(obj[b*MW+a])viz=true}
      if(boca||viz)continue;
      const pv=par(x,y-1)||par(x,y+1),ph=par(x-1,y)||par(x+1,y),
        onde=pv&&ph?'canto':pv||ph?'parede':x>r.x&&x<r.x+r.w-1&&y>r.y&&y<r.y+r.h-1&&r.w*r.h>=36?'meio':'';
      if(!onde)continue;
      for(let k=0;k<lista.length;k++){const o=lista[k];
        if(o.onde!==onde&&!(o.onde==='parede'&&onde==='canto'))continue;
        if(sh(x,y,k)>=o.p)continue;
        g[y*MW+x]=2;
        if(alcance(g,ini)===livres-1){obj[y*MW+x]=k+1;livres--}else g[y*MW+x]=0;
        break;
      }
    }
  }
  return obj;
}
/* peça de parede de cada bloco sólido que encosta no chão, como o Tibia monta
   uma sala: 1 vertical, 2 horizontal, 3 poste (canto de cima à esquerda),
   4 canto (onde a horizontal que vem do oeste encontra a vertical que vem do
   norte). Bloco sem chão em volta fica 0 e é só escuridão. A cidade usa a
   mesma montagem na grade dela (w×h). */
export function pecas(g,w=MW,h=MH){
  const P=new Uint8Array(w*h),ch=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&g[y*w+x]!==1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(g[y*w+x]!==1)continue;
    const hz=ch(x,y-1)||ch(x,y+1),v=ch(x+1,y)||ch(x-1,y);
    P[y*w+x]=hz&&v?4:hz?2:v?1:ch(x+1,y+1)?3:ch(x-1,y+1)?2:ch(x+1,y-1)?1:ch(x-1,y-1)?4:0;
  }
  return P;
}

/* ---------- mapa fixo ----------
   pilhas: uma por tipo de sqm, "<k> <chão> <itens...>", ids do OTSP de baixo
   para cima; k é c (chão), p (parede ou água: sólido), o (objeto sólido sobre
   chão) ou v (vazio), com um l a mais quando algum item dá luz (tocha). chão
   0 é sem chão. grade: MH linhas de MW sqm, dois caracteres por sqm (o número
   da pilha em base 64, ALFA). entrada: "x y", onde fica a porta. spawn:
   "x y monstro", um monstro por ponto, sempre o mesmo, no mesmo sqm */
export const ALFA='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const G_DE={c:0,p:1,o:2,v:1};
const CACHE=new WeakMap();
export function lePilha(t){const a=String(t).trim().split(/\s+/);
  return{k:a[0][0],luz:a[0][1]==='l',chao:+a[1]||0,itens:a.slice(2).map(Number)}}
export function leMapa(m){
  if(CACHE.has(m))return CACHE.get(m);
  const pilhas=m.pilhas.map(lePilha),pi=new Uint16Array(MW*MH),g=new Uint8Array(MW*MH);
  for(let y=0;y<MH;y++){const l=m.grade[y];
    for(let x=0;x<MW;x++){const i=y*MW+x,n=ALFA.indexOf(l[2*x])*64+ALFA.indexOf(l[2*x+1]);pi[i]=n;g[i]=G_DE[pilhas[n].k]}}
  const xy=t=>t.trim().split(/\s+/).map(Number),[ex,ey]=xy(m.entrada);
  /* profundidade de cada ponto: a distância andando desde a porta, de 0 a 1 */
  const dist=new Int16Array(MW*MH).fill(-1),fila=[ey*MW+ex];dist[fila[0]]=0;
  for(let h=0;h<fila.length;h++){const c=fila[h],x=c%MW;
    for(const d of [x>0?-1:0,x<MW-1?1:0,-MW,MW]){const k=c+d;if(d&&k>=0&&k<MW*MH&&dist[k]<0&&g[k]===0){dist[k]=dist[c]+1;fila.push(k)}}}
  const pontos=(m.spawn||[]).map(t=>{const a=t.trim().split(/\s+/);return{x:+a[0],y:+a[1],k:a[2]}});
  let md=1;for(const q of pontos)md=Math.max(md,dist[q.y*MW+q.x]);
  for(const q of pontos)q.prof=Math.max(0,dist[q.y*MW+q.x])/md;
  const r={g,pi,pilhas,entrada:{x:ex,y:ey},pontos,dist};CACHE.set(m,r);return r;
}
