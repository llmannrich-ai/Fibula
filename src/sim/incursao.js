/* ---------- estado da incursão ---------- */
import {T,MW,MH,RUN,PORTAL_AT,EXT,TAU,rnd,rr,ri,frr,sorte,semeia,semente,novaSemente,hyp,DIRS,saida} from './base.js?v=0.7.0';
import {EL_COR,MT,PROG} from './dados.js?v=0.7.0';
import {save,ch,KL,stats,sealPct,guardaSaco,perdaXp} from './progresso.js?v=0.7.0';
import {genMap,pecas} from './mapa.js?v=0.7.0';
import {bf,lancarSlot,atingir,explode,hitMon,hurtPlayer,pickup} from './combate.js?v=0.7.0';

export let G=null;
export const setG=v=>{G=v};
function pickType(d){
  const bandas=PROG.bands,b=bandas.find(b=>d<b.untilDepth)||bandas[bandas.length-1];
  const linhas=Object.entries(b.weights);
  let r=sorte();
  for(const[k,w]of linhas){if(r<w)return k;r-=w}
  return linhas[linhas.length-1][0];
}
function spawn(k,r,d,boss){
  const t=MT[k],sc=PROG.scaling,lv=sc.hpPerCharLevel*(ch().lvl-1),
    hpm=boss?1+lv*sc.bossLevelFactor:1+sc.hpPerDepth*d+lv;
  const x=boss?(r.cx+.5)*T:(r.x+1+rnd(r.w-2)+.5)*T,y=boss?(r.cy-.5)*T:(r.y+1+rnd(r.h-2)+.5)*T;
  const hp=Math.round(t.hp*hpm);
  G.mons.push({k,t,x,y,hp,mhp:hp,r:t.r,spd:t.spd,dmg:Math.round(t.dmg*(1+sc.dmgPerDepth*d)),xpm:1+sc.xpPerDepth*d,atkCd:rr(0,1),flash:0,aggro:false,wt:0,wa:0,wm:false,anim:frr(0,9),mv:0,face:frr(0,TAU),slow:0,slowF:1,dot:null});
}
/* s é a semente da incursão: a mesma semente dá a mesma masmorra. Sem ela,
   sorteia uma nova (é o caso normal do jogador) */
export function newRun(s0=novaSemente()){
  semeia(s0);
  const {g,rooms}=genMap(),s=rooms[0];
  let pr=s,md=1;
  for(const r of rooms){r.d=hyp(r.cx-s.cx,r.cy-s.cy);if(r.d>md){md=r.d;pr=r}}
  const st=stats();
  const p={x:(s.cx+.5)*T,y:(s.cy+.5)*T,r:11,face:0,hp:st.mhp,mhp:st.mhp,mp:st.mmp,mmp:st.mmp,
    cds:{},gcd:{ataque:0,cura:0,apoio:0},buffs:{},cdC:0,pot:3+save.up.bolsa,flash:0,walk:0,mv:false,swing:0,swingA:0,swingR:0};
  G={g,rooms,par:pecas(g),cad:[],seen:new Uint8Array(MW*MH),flow:new Int16Array(MW*MH).fill(-1),flowT:0,p,mons:[],proj:[],drops:[],fx:[],torches:[],pend:[],
     t:0,bag:{},bagVal:0,kills:0,xpGain:0,magGain:0,perGain:0,portal:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false,ch:0},over:false,active:false,shake:0,warned:false,miniT:0,end:null,dur:0,semente};
  for(const r of rooms){
    if(r===s)continue;
    const pr2=PROG.perRoom,d=r.d/md,
      n=ri(pr2.min,pr2.max)+(r.w*r.h>pr2.largeRoomArea?pr2.largeRoomBonus:0);
    for(let k=0;k<n;k++)spawn(pickType(d),r,d,false);
  }
  const bs=PROG.boss;
  spawn(bs.type,pr,1,true);
  spawn(bs.escort[rnd(bs.escort.length)],pr,1,false);
  reveal();
}

/* ---------- física ---------- */
export const solid=(x,y)=>x<0||y<0||x>=MW||y>=MH||G.g[y*MW+x]===1;
function blocked(x,y,r){
  const a=Math.floor((x-r)/T),b=Math.floor((x+r)/T),c=Math.floor((y-r)/T),d=Math.floor((y+r)/T);
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++)if(solid(i,j))return true;
  return false;
}
function move(e,dx,dy){const r=e.r*.85;if(dx&&!blocked(e.x+dx,e.y,r))e.x+=dx;if(dy&&!blocked(e.x,e.y+dy,r))e.y+=dy}
const Q=new Int32Array(MW*MH);
function buildFlow(){
  const f=G.flow,g=G.g;f.fill(-1);
  const s=(G.p.y/T|0)*MW+(G.p.x/T|0);let h=0,t=0;Q[t++]=s;f[s]=0;
  while(h<t){
    const c=Q[h++],v=f[c];if(v>=22)continue;
    const x=c%MW,y=(c/MW)|0;
    if(x>0&&g[c-1]===0&&f[c-1]<0){f[c-1]=v+1;Q[t++]=c-1}
    if(x<MW-1&&g[c+1]===0&&f[c+1]<0){f[c+1]=v+1;Q[t++]=c+1}
    if(y>0&&g[c-MW]===0&&f[c-MW]<0){f[c-MW]=v+1;Q[t++]=c-MW}
    if(y<MH-1&&g[c+MW]===0&&f[c+MW]<0){f[c+MW]=v+1;Q[t++]=c+MW}
  }
}
export const flowAt=e=>G.flow[(e.y/T|0)*MW+(e.x/T|0)];
function reveal(){
  const tx=G.p.x/T|0,ty=G.p.y/T|0;
  for(let j=-7;j<=7;j++)for(let i=-7;i<=7;i++){
    if(i*i+j*j>52)continue;const x=tx+i,y=ty+j;
    if(x>=0&&y>=0&&x<MW&&y<MH)G.seen[y*MW+x]=1;
  }
}

/* ---------- efeitos ----------
   Efeitos visuais são dados do estado (G.fx, G.shake); quem desenha é o
   render(), que também é quem respeita prefers-reduced-motion. */
export const num=(x,y,txt,col,big)=>G.fx.push({k:'num',x:x+frr(-4,4),y,txt:String(txt),col,big,t:0,life:1});
export const shake=v=>{G.shake=Math.max(G.shake,v)};
export function spark(x,y,col){for(let i=0;i<6;i++){const a=frr(0,TAU),s=frr(30,90);G.fx.push({k:'sp',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,col,t:0,life:.35})}}

/* ---------- atualização ----------
   ent é a entrada do quadro, montada pelo cliente em src/controles.js:
   {x,y} do movimento (comprimento até 1) e held[4] dos espaços seguros. */
export function update(dt,ent){
  const p=G.p;G.t+=dt;
  G.flowT-=dt;if(G.flowT<=0){buildFlow();G.flowT=.2}
  let mx=ent.x,my=ent.y;
  const ml=hyp(mx,my);if(ml>1){mx/=ml;my/=ml}
  const vel=128*(1+bf('velo'));
  p.mv=ml>.08;
  if(p.mv){move(p,mx*vel*dt,my*vel*dt);p.face=Math.atan2(my,mx);p.walk+=dt*Math.min(1,ml)*12}
  const K=KL();
  p.mp=Math.min(p.mmp,p.mp+K.rmp*dt);p.hp=Math.min(p.mhp,p.hp+K.rhp*dt);
  p.cdC-=dt;p.flash-=dt;p.swing-=dt;
  for(const k in p.cds)if(p.cds[k]>0)p.cds[k]-=dt;
  for(const k in p.gcd)if(p.gcd[k]>0)p.gcd[k]-=dt;
  for(const k in p.buffs){p.buffs[k].left-=dt;if(p.buffs[k].left<=0)delete p.buffs[k]}
  for(let i=G.pend.length-1;i>=0;i--){const q=G.pend[i];q.t-=dt;if(q.t<=0){G.pend.splice(i,1);q.fn();if(G.over)return}}
  for(let i=0;i<4;i++)if(ent.held[i])lancarSlot(i);
  reveal();
  updateMons(dt);if(G.over)return;
  updateProj(dt);if(G.over)return;
  for(let i=G.drops.length-1;i>=0;i--){const d=G.drops[i];d.t+=dt;if(hyp(d.x-p.x,d.y-p.y)<p.r+16)pickup(d,i)}
  for(let i=G.fx.length-1;i>=0;i--){const f=G.fx[i];f.t+=dt;if(f.vx!==undefined){f.x+=f.vx*dt;f.y+=f.vy*dt}if(f.t>=f.life)G.fx.splice(i,1)}
  G.shake=Math.max(0,G.shake-dt*30);
  const po=G.portal;
  if(!po.open&&G.t>=PORTAL_AT){po.open=true;saida.banner('Portal de saída aberto');saida.log('Um portal se abriu na sala do Guardião. Siga o ponto dourado no mapa.','info')}
  if(po.open){
    if(hyp(p.x-po.x,p.y-po.y)<38){po.ch+=dt;if(po.ch>=EXT)return finish('extraiu')}
    else po.ch=Math.max(0,po.ch-dt*2);
  }
  const left=RUN-G.t;
  if(left<=60&&!G.warned){G.warned=true;saida.banner('A masmorra está desabando');saida.log('Falta 1 minuto. Chegue ao portal ou perca o saco.','warn')}
  if(left<=0)finish('desabou');
}
/* fora da incursão (menu por cima do mapa, tela final) só os efeitos andam */
export function parado(dt){
  G.t+=dt;for(let i=G.fx.length-1;i>=0;i--){const f=G.fx[i];f.t+=dt;if(f.t>=f.life)G.fx.splice(i,1)}G.shake=Math.max(0,G.shake-dt*30);
}
function updateMons(dt){
  const p=G.p,f=G.flow;
  for(const m of G.mons.slice()){
    if(m.hp<=0)continue;
    m.atkCd-=dt;m.flash-=dt;m.anim+=dt;m.mv=0;
    if(m.slow>0){m.slow-=dt;if(m.slow<=0)m.slowF=1}
    if(m.dot){m.dot.left-=dt;m.dot.tick+=dt;
      if(m.dot.tick>=.5){m.dot.tick=0;hitMon(m,Math.max(1,Math.round(m.dot.dps*.5)),EL_COR[m.dot.el]);
        G.fx.push({k:'sp',x:m.x+frr(-6,6),y:m.y+frr(-6,6),vx:0,vy:-24,col:EL_COR[m.dot.el],t:0,life:.4});
        if(m.hp<=0)continue}
      if(m.dot.left<=0)m.dot=null}
    const spd=m.spd*m.slowF;
    const tx=m.x/T|0,ty=m.y/T|0,fd=f[ty*MW+tx],dx=p.x-m.x,dy=p.y-m.y,dist=hyp(dx,dy)||1;
    if(fd>=0&&fd<=(m.t.boss?7:9))m.aggro=true;else if(fd<0||fd>18)m.aggro=false;
    let vx=0,vy=0;
    if(m.aggro){
      m.face=Math.atan2(dy,dx);
      const reach=m.r+p.r+5;
      if(m.t.ranged&&dist<T*5.5&&fd>=0&&fd<=7){
        if(m.atkCd<=0){m.atkCd=m.t.atk;const s=230;G.proj.push({k:'m',x:m.x,y:m.y-6,vx:dx/dist*s,vy:dy/dist*s,dmg:ri(Math.round(m.dmg*.7),m.dmg),life:2.5})}
        if(dist<T*2){vx=-dx/dist*.6;vy=-dy/dist*.6}
      }else if(dist<=reach){
        if(m.atkCd<=0){m.atkCd=m.t.atk;hurtPlayer(ri(Math.round(m.dmg*.7),m.dmg));if(G.over)return}
      }else if(dist<T*1.3||fd<=1){vx=dx/dist;vy=dy/dist}
      else if(fd>0){
        let best=fd,bx=0,by=0;
        for(const[ox,oy]of DIRS){
          const nx=tx+ox,ny=ty+oy;if(solid(nx,ny))continue;
          if(ox&&oy&&(solid(tx+ox,ty)||solid(tx,ty+oy)))continue;
          const v=f[ny*MW+nx];if(v>=0&&v<best){best=v;bx=nx;by=ny}
        }
        if(best<fd){const cx=(bx+.5)*T-m.x,cy=(by+.5)*T-m.y,l=hyp(cx,cy)||1;vx=cx/l;vy=cy/l}
      }
      if(vx||vy){move(m,vx*spd*dt,vy*spd*dt);m.mv=1}
    }else{
      m.wt-=dt;if(m.wt<=0){m.wt=rr(1,3);m.wa=rr(0,TAU);m.wm=sorte()<.45}
      if(m.wm){move(m,Math.cos(m.wa)*spd*.3*dt,Math.sin(m.wa)*spd*.3*dt);m.mv=1;m.face=m.wa}
    }
  }
  const ms=G.mons;
  for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++){
    const a=ms[i],b=ms[j],dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy),mn=a.r+b.r;
    if(d>0&&d<mn){const push=(mn-d)/2,ux=dx/d,uy=dy/d;move(a,-ux*push,-uy*push);move(b,ux*push,uy*push)}
  }
}
function updateProj(dt){
  for(let i=G.proj.length-1;i>=0;i--){
    const q=G.proj[i];q.life-=dt;let dead=q.life<=0;
    if(q.k==='b'){
      if(q.tg&&q.tg.hp>0){
        const dx=q.tg.x-q.x,dy=q.tg.y-q.y,d=hyp(dx,dy)||1;q.vx=dx/d*560;q.vy=dy/d*560;
        if(d<q.tg.r+6){atingir(q.tg,q.s);spark(q.x,q.y,q.col);dead=true}
      }else if(!q.vx&&!q.vy)dead=true;
      q.x+=q.vx*dt;q.y+=q.vy*dt;
    }else if(q.k==='r'){
      const dx=q.tx-q.x,dy=q.ty-q.y,d=hyp(dx,dy),pa=430*dt;
      if(d<=pa){explode(q.tx,q.ty,q.s);dead=true}else{q.x+=dx/d*pa;q.y+=dy/d*pa}
    }else{
      q.x+=q.vx*dt;q.y+=q.vy*dt;
      if(solid(q.x/T|0,q.y/T|0)){spark(q.x,q.y,'#9fd36b');dead=true}
      else if(hyp(q.x-G.p.x,q.y-G.p.y)<G.p.r+5){hurtPlayer(q.dmg);dead=true;if(G.over)return}
    }
    if(dead){const k=G.proj.indexOf(q);if(k>=0)G.proj.splice(k,1)}
  }
}
export function finish(kind){
  if(G.over)return;G.over=true;G.end=kind;G.dur=G.t;
  G.sealed=0;G.ouroExt=0;G.pecas=0;G.xpPerdido=0;
  if(kind==='extraiu'){const r=guardaSaco(G.bag);G.ouroExt=r.ouro;G.pecas=r.pecas;save.ext++;save.best=Math.max(save.best,G.bagVal)}
  else{save.deaths++;G.sealed=Math.round(G.bagVal*sealPct());if(G.sealed)save.cofre+=G.sealed;
    G.xpPerdido=perdaXp();ch().xp-=G.xpPerdido}
  saida.persist();
  if(kind!=='extraiu')shake(8);
  saida.fim(kind);
}
