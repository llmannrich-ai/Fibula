/* ---------- combate ---------- */
import {T,TAU,rr,ri,hyp,saida} from './base.js';
import {EL_COR,SPELLS,ITEMS,LOOT,fmtItem} from './dados.js';
import {ch,KL,stats,xpNeed,manaPraMag,golpesPraPer,nSlots,desbloqueadas} from './progresso.js';
import {G,flowAt,num,shake,finish} from './incursao.js';

function target(range){
  let best=null,bd=range;
  for(const m of G.mons){const fd=flowAt(m);if(fd<0||fd>11)continue;const d=hyp(m.x-G.p.x,m.y-G.p.y);if(d<bd){bd=d;best=m}}
  return best;
}
export const bf=k=>{const b=G.p.buffs[k];return b?b.v:0};
const poderDe=s=>s.esc==='per'?ch().per:ch().mag;
function rolaDano(s){
  const l=ch().lvl,P=poderDe(s),mn=l/2+P*s.a1+s.b1,mx=l/2+P*s.a2+s.b2;
  return Math.max(1,Math.round(rr(mn,mx)*stats().pow*(1+bf('dano'))));
}
const alcanceDe=s=>((s.alc||0)+bf('alc'))*T;
/* Magia sobe gastando mana; Perícia sobe acertando golpes — é assim no Tibia,
   e é o que faz dois personagens do mesmo nível não serem iguais. */
function gastaMana(n){
  if(n<=0)return;const c=ch();c.manaG+=n;
  while(c.manaG>=manaPraMag(c.mag)){c.manaG-=manaPraMag(c.mag);c.mag++;G.magGain++;
    saida.banner('Magia '+c.mag);saida.log(`Sua Magia subiu para ${c.mag}.`,'info')}
}
function registraGolpe(){
  const c=ch();c.golpes++;
  while(c.golpes>=golpesPraPer(c.per)){c.golpes-=golpesPraPer(c.per);c.per++;G.perGain++;
    saida.banner('Perícia '+c.per);saida.log(`Sua Perícia subiu para ${c.per}.`,'info')}
}
function aplicaEfeitos(m,s){
  if(s.lento){const f=s.lento.f;if(m.slow<=0||f<m.slowF)m.slowF=f;m.slow=Math.max(m.slow,s.lento.dur)}
  if(s.dot)m.dot={left:s.dot.dur,dps:Math.max(1,rolaDano(s)*s.dot.f),el:s.el,tick:0};
}
const efeito=(x,y,el)=>G.fx.push({k:'ef',x,y,n:'ef_'+(el||'fisico'),t:0,life:.5});
export function atingir(m,s,mult){
  efeito(m.x,m.y,s.el);
  hitMon(m,Math.round(rolaDano(s)*(mult||1)),EL_COR[s.el]);
  if(m.hp>0)aplicaEfeitos(m,s);
  if(s.esc==='per')registraGolpe();
}
function emCone(cx,cy,ang,raio,abertura,lim){
  const out=[];
  for(const m of G.mons){
    const dx=m.x-cx,dy=m.y-cy,d=hyp(dx,dy);
    if(d>raio+m.r)continue;
    if(abertura<Math.PI){let a=Math.atan2(dy,dx)-ang;while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;if(Math.abs(a)>abertura)continue}
    out.push({m,d});
  }
  out.sort((a,b)=>a.d-b.d);
  return (lim?out.slice(0,lim):out).map(o=>o.m);
}
function emLinha(cx,cy,ang,comp,lim){
  const ux=Math.cos(ang),uy=Math.sin(ang),out=[];
  for(const m of G.mons){
    const dx=m.x-cx,dy=m.y-cy,t=dx*ux+dy*uy;
    if(t<0||t>comp)continue;
    if(Math.abs(-dx*uy+dy*ux)>18+m.r*.6)continue;
    out.push({m,t});
  }
  out.sort((a,b)=>a.t-b.t);
  return (lim?out.slice(0,lim):out).map(o=>o.m);
}
function miraEm(s){
  const p=G.p,tg=target(s.raio?s.raio+40:alcanceDe(s)||T*7);
  if(tg)p.face=Math.atan2(tg.y-p.y,tg.x-p.x);
  return tg;
}
export function podeLancar(id){
  const s=SPELLS[id],p=G.p;
  if(!s||ch().lvl<s.lvl)return false;
  return (p.cds[id]||0)<=0&&(p.gcd[s.g]||0)<=0&&p.mp>=s.mana;
}
function lancar(id){
  if(!G||!G.active||G.over)return;
  const s=SPELLS[id],p=G.p;
  if(!s||ch().lvl<s.lvl)return;
  if((p.cds[id]||0)>0||(p.gcd[s.g]||0)>0)return;
  if(p.mp<s.mana){if(s.cd>1)saida.log(`Mana insuficiente para ${s.n}.`,'warn');p.gcd[s.g]=.25;return}
  if(s.t==='cura'&&p.hp>=p.mhp)return;
  let usou=true;
  switch(s.t){
    case'proj':{
      const tg=target(alcanceDe(s));if(!tg){usou=false;break}
      p.face=Math.atan2(tg.y-p.y,tg.x-p.x);
      G.proj.push({k:'b',s,x:p.x+Math.cos(p.face)*12,y:p.y-14,tg,vx:0,vy:0,col:EL_COR[s.el],life:1.6});
      break}
    case'bomba':{
      const tg=miraEm(s);let tx,ty;
      if(tg){tx=tg.x;ty=tg.y}else{tx=p.x+Math.cos(p.face)*90;ty=p.y+Math.sin(p.face)*90}
      G.proj.push({k:'r',s,x:p.x,y:p.y-14,tx,ty,col:EL_COR[s.el],life:2.2});
      break}
    case'cone':{
      miraEm(s);
      G.fx.push({k:'cone',x:p.x,y:p.y,ang:p.face,raio:s.raio,ab:s.ang,col:EL_COR[s.el],el:s.el,t:0,life:.4});
      for(const m of emCone(p.x,p.y,p.face,s.raio,s.ang))atingir(m,s);
      shake(4);break}
    case'aura':{
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:s.raio,col:EL_COR[s.el],el:s.el,t:0,life:.45});
      for(const m of emCone(p.x,p.y,0,s.raio,Math.PI))atingir(m,s);
      shake(s.raio>120?7:4);break}
    case'feixe':{
      miraEm(s);
      G.fx.push({k:'feixe',x:p.x,y:p.y-8,ang:p.face,comp:s.raio,col:EL_COR[s.el],el:s.el,t:0,life:.3});
      for(const m of emLinha(p.x,p.y,p.face,s.raio,s.max))atingir(m,s);
      shake(3);break}
    case'melee':{
      const tg=miraEm(s);
      if(s.unico&&!tg){usou=false;break}
      p.swing=.24;p.swingA=p.face;p.swingR=s.raio;
      const alvos=emCone(p.x,p.y,p.face,s.raio,s.ang,s.unico?1:0);
      if(s.unico&&!alvos.length){usou=false;break}
      for(const m of alvos)atingir(m,s);
      if(s.multi)for(let i=1;i<s.multi;i++)G.pend.push({t:i*.16,fn:()=>{
        const vivos=emCone(p.x,p.y,p.face,s.raio+8,s.ang,1);
        p.swing=.2;p.swingA=p.face;p.swingR=s.raio;
        for(const m of vivos)atingir(m,s);shake(5);
      }});
      shake(s.unico?5:3);break}
    case'cura':{
      const h=rolaDano(s);p.hp=Math.min(p.mhp,p.hp+h);
      num(p.x,p.y-30,'+'+h,'#7ee07a',true);
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:34,col:'#9cf0c0',el:'cura',t:0,life:.4});
      break}
    case'buff':{
      if(s.buff)for(const k of['velo','dano','arm','alc'])if(s.buff[k])p.buffs[k]={v:s.buff[k],left:s.buff.dur};
      if(s.taunt){let n=0;for(const m of G.mons)if(hyp(m.x-p.x,m.y-p.y)<s.taunt){m.aggro=true;n++}
        if(n)saida.log(`${n} inimigo${n>1?'s':''} voltou a atenção para você.`,'info')}
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:46,col:'#ffd68a',el:'faisca',t:0,life:.5});
      break}
  }
  if(!usou){p.gcd[s.g]=.2;return}
  p.mp-=s.mana;gastaMana(s.mana);
  p.cds[id]=s.cd;p.gcd[s.g]=Math.max(p.gcd[s.g]||0,s.gcd||s.cd);
}
export function lancarSlot(i){const id=ch().slots[i];if(id)lancar(id)}
export function drinkPot(){
  if(!G||!G.active||G.over)return;const p=G.p;
  if(p.cdC>0)return;
  if(p.pot<=0){saida.log('Sem poções.','warn');return}
  if(p.hp>=p.mhp)return;
  const h=45+5*(ch().lvl-1);p.hp=Math.min(p.mhp,p.hp+h);p.pot--;p.cdC=1;
  num(p.x,p.y-30,'+'+h,'#7ee07a',true);efeito(p.x,p.y,'cura');
}
export function explode(x,y,s){
  const raio=s.raio||76;
  G.fx.push({k:'boom',x,y,raio,col:EL_COR[s.el],el:s.el,t:0,life:.5});shake(6);
  for(const m of G.mons.slice())if(hyp(m.x-x,m.y-y)<raio+m.r)atingir(m,s);
}
export function hitMon(m,d,col){
  if(m.hp<=0)return;
  m.hp-=d;m.flash=.12;m.aggro=true;num(m.x,m.y-m.r-8,d,col||'#ff6b5b');
  if(m.hp<=0)kill(m);
}
function kill(m){
  const i=G.mons.indexOf(m);if(i>=0)G.mons.splice(i,1);
  G.kills++;
  G.cad.push({x:m.x,y:m.y,k:m.k});if(G.cad.length>60)G.cad.shift();
  for(let k=0;k<10;k++){const a=rr(0,TAU),s=rr(15,50);G.fx.push({k:'puff',x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rr(3,6),t:0,life:.6})}
  gainXp(Math.round(m.t.xp*m.xpm));
  const got=[];
  for(const[k,ch,a,b]of LOOT[m.k])if(Math.random()<ch)got.push([k,ri(a,b)]);
  const rar=got.length?Math.max(...got.map(g=>ITEMS[g[0]].rar)):0;
  if(got.length)G.drops.push({x:m.x,y:m.y,items:got,rar,t:0});
  saida.log(`Loot de ${m.t.nome}: ${got.length?got.map(fmtItem).join(', '):'nada'}.`,['loot','rare','epic'][rar]);
  if(m.t.boss){saida.banner('Guardião derrotado');}
}
function gainXp(x){
  const c=ch();c.xp+=x;G.xpGain+=x;num(G.p.x,G.p.y-40,x+' xp','#f3ead6');
  while(c.xp>=xpNeed(c.lvl)){
    const slotsAntes=nSlots(),tinha=desbloqueadas().length;
    c.xp-=xpNeed(c.lvl);c.lvl++;
    const st=stats(),p=G.p,dh=st.mhp-p.mhp,dm=st.mmp-p.mmp;
    p.mhp=st.mhp;p.mmp=st.mmp;
    p.hp=Math.min(p.mhp,p.hp+dh);p.mp=Math.min(p.mmp,p.mp+dm);
    saida.banner(`Nível ${c.lvl}`);saida.log(`Você subiu para o nível ${c.lvl}. Vida e mana máximas aumentaram.`,'info');
    if(nSlots()>slotsAntes)saida.log(`Novo espaço de habilidade liberado: agora você leva ${nSlots()} para a masmorra.`,'rare');
    const novas=desbloqueadas();
    if(novas.length>tinha)for(const k of novas.slice(tinha)){
      saida.log(`Habilidade aprendida: ${SPELLS[k].n}. Equipe no Grimório.`,'epic');
      const vago=c.slots.indexOf(null);
      if(vago>=0&&vago<nSlots()){c.slots[vago]=k;saida.log(`${SPELLS[k].n} foi para o espaço ${vago+1}.`,'info')}
    }
    /* os espaços e as habilidades mudaram: sem isto o botão da habilidade nova
       só aparecia na incursão seguinte */
    saida.nivel();
  }
  saida.persist();
}
export function hurtPlayer(d){
  if(G.over)return;const p=G.p;
  /* armadura da classe (o shielding/armor do Tibia) somada ao buff de Provocar */
  d=Math.max(1,Math.round(d*(1-Math.min(.75,KL().red+bf('arm')))));
  p.hp-=d;p.flash=.15;num(p.x,p.y-30,d,'#ff4d4d',true);shake(3);efeito(p.x,p.y,'fisico');
  if(p.hp<=0){p.hp=0;finish('morreu')}
}
export function pickup(d,i){
  let v=0;
  for(const[k,q]of d.items){G.bag[k]=(G.bag[k]||0)+q;v+=ITEMS[k].val*q}
  G.bagVal+=v;G.drops.splice(i,1);
  num(G.p.x,G.p.y-30,'+'+v+' ouro','#f2c14e');
  if(d.rar>=1)saida.log(`Você guardou: ${d.items.filter(([k])=>ITEMS[k].rar>=1).map(fmtItem).join(', ')}.`,['loot','rare','epic'][d.rar]);
}
