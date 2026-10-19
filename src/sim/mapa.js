/* ---------- mapa ---------- */
import {MW,MH,rnd,ri,hyp,sorte} from './base.js?v=0.30.0';

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
export function genMap(m=PADRAO){
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
/* peça de parede de cada bloco sólido que encosta no chão, como o Tibia monta
   uma sala: 1 vertical, 2 horizontal, 3 poste (canto de cima à esquerda),
   4 canto (onde a horizontal que vem do oeste encontra a vertical que vem do
   norte). Bloco sem chão em volta fica 0 e é só escuridão. A cidade usa a
   mesma montagem na grade dela (w×h). */
export function pecas(g,w=MW,h=MH){
  const P=new Uint8Array(w*h),ch=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&g[y*w+x]===0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(g[y*w+x]===0)continue;
    const hz=ch(x,y-1)||ch(x,y+1),v=ch(x+1,y)||ch(x-1,y);
    P[y*w+x]=hz&&v?4:hz?2:v?1:ch(x+1,y+1)?3:ch(x-1,y+1)?2:ch(x+1,y-1)?1:ch(x-1,y-1)?4:0;
  }
  return P;
}
