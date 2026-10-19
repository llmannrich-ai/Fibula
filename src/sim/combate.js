/* ---------- combate ----------
   Toda função aqui recebe o jogador que age (p, de G.ps): o personagem dele
   é p.c, a classe p.cl e as melhorias p.up. Nada lê o save. */
import {T,TAU,rr,ri,frr,sorte,hyp,saida} from './base.js?v=0.28.0';
import {EL_COR,SPELLS,ITEMS,LOOT,PROG,CLASSES,fmtItem,listaDaClasse,precoHab} from './dados.js?v=0.28.0';
import {stats,eqBonus,xpNeed,manaPraMag,golpesPraPer,nSlots,cabe} from './progresso.js?v=0.28.0';
import {G,flowAt,num,shake,sai} from './incursao.js?v=0.28.0';

function target(p,range){
  let best=null,bd=range;
  for(const m of G.mons){const fd=flowAt(m);if(fd<0||fd>11)continue;const d=hyp(m.x-p.x,m.y-p.y);if(d<bd){bd=d;best=m}}
  return best;
}
/* sem p, o jogador deste aparelho: é o que a tela pergunta */
export const bf=(k,p=G.ps[0])=>{const b=p.buffs[k],s=p.sup&&p.sup[k];return (b?b.v:0)+(s?s.v:0)};
const poderDe=(s,p)=>s.esc==='per'?p.c.per:p.c.mag;
function rolaDano(s,p){
  const l=p.c.lvl,P=poderDe(s,p),mn=l/2+P*s.a1+s.b1,mx=l/2+P*s.a2+s.b2;
  return Math.max(1,Math.round(rr(mn,mx)*stats(p.c,p.cl,p.up).pow*(1+bf('dano',p))));
}
const alcanceDe=(s,p)=>((s.alc||0)+bf('alc',p))*T;
/* Magia sobe gastando mana; Perícia sobe acertando golpes — é assim no Tibia,
   e é o que faz dois personagens do mesmo nível não serem iguais. */
/* as mensagens de um jogador levam ele como último argumento de saida.log e
   saida.banner; a tela mostra só as do jogador dela */
function gastaMana(n,p){
  if(n<=0)return;const c=p.c,K=CLASSES[p.cl];c.manaG+=n;
  while(c.manaG>=manaPraMag(c.mag,K)){c.manaG-=manaPraMag(c.mag,K);c.mag++;p.magGain++;
    saida.banner('Magia '+c.mag,p);saida.log(`Sua Magia subiu para ${c.mag}.`,'info',p)}
}
function registraGolpe(p){
  const c=p.c,K=CLASSES[p.cl];c.golpes++;
  while(c.golpes>=golpesPraPer(c.per,K)){c.golpes-=golpesPraPer(c.per,K);c.per++;p.perGain++;
    saida.banner('Perícia '+c.per,p);saida.log(`Sua Perícia subiu para ${c.per}.`,'info',p)}
}
function aplicaEfeitos(m,s,p){
  if(s.lento){const f=s.lento.f;if(m.slow<=0||f<m.slowF)m.slowF=f;m.slow=Math.max(m.slow,s.lento.dur)}
  if(s.dot)m.dot={left:s.dot.dur,dps:Math.max(1,rolaDano(s,p)*s.dot.f),el:s.el,tick:0,p};
}
const efeito=(x,y,el)=>G.fx.push({k:'ef',x,y,n:'ef_'+(el||'fisico'),t:0,life:.5});
export function atingir(m,s,mult,p){
  efeito(m.x,m.y,s.el);
  hitMon(m,Math.round(rolaDano(s,p)*(mult||1)),EL_COR[s.el],p);
  if(m.hp>0)aplicaEfeitos(m,s,p);
  if(s.esc==='per')registraGolpe(p);
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
function miraEm(s,p){
  const tg=target(p,s.raio?s.raio+40:alcanceDe(s,p)||T*7);
  if(tg)p.face=Math.atan2(tg.y-p.y,tg.x-p.x);
  return tg;
}
export function podeLancar(id,p=G.ps[0]){
  const s=SPELLS[id];
  if(!s||p.c.lvl<s.lvl)return false;
  return (p.cds[id]||0)<=0&&(p.gcd[s.g]||0)<=0&&p.mp>=s.mana;
}
function lancar(id,p){
  if(!G||!G.active||G.over||p.fora)return;
  const s=SPELLS[id];
  if(!s||p.c.lvl<s.lvl)return;
  if((p.cds[id]||0)>0||(p.gcd[s.g]||0)>0)return;
  if(p.mp<s.mana){if(s.cd>1)saida.log(`Mana insuficiente para ${s.n}.`,'warn',p);p.gcd[s.g]=.25;return}
  if(s.t==='cura'&&p.hp>=p.mhp)return;
  let usou=true;
  switch(s.t){
    case'proj':{
      const tg=target(p,alcanceDe(s,p));if(!tg){usou=false;break}
      p.face=Math.atan2(tg.y-p.y,tg.x-p.x);
      G.proj.push({k:'b',s,p,x:p.x+Math.cos(p.face)*12,y:p.y-14,tg,vx:0,vy:0,col:EL_COR[s.el],life:1.6});
      break}
    case'bomba':{
      const tg=miraEm(s,p);let tx,ty;
      if(tg){tx=tg.x;ty=tg.y}else{tx=p.x+Math.cos(p.face)*90;ty=p.y+Math.sin(p.face)*90}
      G.proj.push({k:'r',s,p,x:p.x,y:p.y-14,tx,ty,col:EL_COR[s.el],life:2.2});
      break}
    case'cone':{
      miraEm(s,p);
      G.fx.push({k:'cone',x:p.x,y:p.y,ang:p.face,raio:s.raio,ab:s.ang,col:EL_COR[s.el],el:s.el,t:0,life:.4});
      for(const m of emCone(p.x,p.y,p.face,s.raio,s.ang))atingir(m,s,1,p);
      shake(4);break}
    case'aura':{
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:s.raio,col:EL_COR[s.el],el:s.el,t:0,life:.45});
      for(const m of emCone(p.x,p.y,0,s.raio,Math.PI))atingir(m,s,1,p);
      shake(s.raio>120?7:4);break}
    case'feixe':{
      miraEm(s,p);
      G.fx.push({k:'feixe',x:p.x,y:p.y-8,ang:p.face,comp:s.raio,col:EL_COR[s.el],el:s.el,t:0,life:.3});
      for(const m of emLinha(p.x,p.y,p.face,s.raio,s.max))atingir(m,s,1,p);
      shake(3);break}
    case'melee':{
      const tg=miraEm(s,p);
      if(s.unico&&!tg){usou=false;break}
      p.swing=.24;p.swingA=p.face;p.swingR=s.raio;
      const alvos=emCone(p.x,p.y,p.face,s.raio,s.ang,s.unico?1:0);
      if(s.unico&&!alvos.length){usou=false;break}
      for(const m of alvos)atingir(m,s,1,p);
      if(s.multi)for(let i=1;i<s.multi;i++)G.pend.push({t:i*.16,fn:()=>{
        if(p.fora)return;
        const vivos=emCone(p.x,p.y,p.face,s.raio+8,s.ang,1);
        p.swing=.2;p.swingA=p.face;p.swingR=s.raio;
        for(const m of vivos)atingir(m,s,1,p);shake(5);
      }});
      shake(s.unico?5:3);break}
    case'cura':{
      const h=rolaDano(s,p);p.hp=Math.min(p.mhp,p.hp+h);
      num(p.x,p.y-30,'+'+h,'#7ee07a',true);
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:34,col:'#9cf0c0',el:'cura',t:0,life:.4});
      break}
    case'buff':{
      if(s.buff)for(const k of['velo','dano','arm','alc'])if(s.buff[k])p.buffs[k]={v:s.buff[k],left:s.buff.dur};
      if(s.taunt){let n=0;for(const m of G.mons)if(hyp(m.x-p.x,m.y-p.y)<s.taunt){m.aggro=true;n++}
        if(n)saida.log(`${n} inimigo${n>1?'s':''} voltou a atenção para você.`,'info',p)}
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:46,col:'#ffd68a',el:'faisca',t:0,life:.5});
      break}
  }
  if(!usou){p.gcd[s.g]=.2;return}
  p.mp-=s.mana;gastaMana(s.mana,p);
  p.cds[id]=s.cd;p.gcd[s.g]=Math.max(p.gcd[s.g]||0,s.gcd||s.cd);
}
export function lancarSlot(i,p){const id=p.c.slots[i];if(id)lancar(id,p)}
export function drinkPot(p=G&&G.ps[0]){
  if(!G||!G.active||G.over||p.fora)return;
  if(p.cdC>0)return;
  if(p.pot<=0){saida.log('Sem poções.','warn',p);return}
  if(p.hp>=p.mhp)return;
  const h=45+5*(p.c.lvl-1);p.hp=Math.min(p.mhp,p.hp+h);p.pot--;p.cdC=1;
  num(p.x,p.y-30,'+'+h,'#7ee07a',true);efeito(p.x,p.y,'cura');
}
export function explode(x,y,s,p){
  const raio=s.raio||76;
  G.fx.push({k:'boom',x,y,raio,col:EL_COR[s.el],el:s.el,t:0,life:.5});shake(6);
  for(const m of G.mons.slice())if(hyp(m.x-x,m.y-y)<raio+m.r)atingir(m,s,1,p);
}
/* m.dn guarda o dano de cada jogador no monstro: decide quem ganha XP e de
   quem é a vez de pegar o loot */
export function hitMon(m,d,col,p){
  if(m.hp<=0)return;
  m.hp-=d;m.flash=.12;m.aggro=true;num(m.x,m.y-m.r-8,d,col||'#ff6b5b');
  if(p)m.dn[p.id]=(m.dn[p.id]||0)+d;
  if(m.hp<=0)kill(m);
}
function kill(m){
  const i=G.mons.indexOf(m);if(i>=0)G.mons.splice(i,1);
  G.kills++;
  G.cad.push({x:m.x,y:m.y,k:m.k});if(G.cad.length>60)G.cad.shift();
  for(let k=0;k<10;k++){const a=frr(0,TAU),s=frr(15,50);G.fx.push({k:'puff',x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:frr(3,6),t:0,life:.6})}
  /* XP cheia para cada um que bateu no monstro ou estava por perto */
  const PT=PROG.party,perto=PT.shareTiles*T;let dono=0;
  for(const q of G.ps){if(m.dn[q.id]>m.dn[dono])dono=q.id;
    if(!q.fora&&(m.dn[q.id]>0||hyp(q.x-m.x,q.y-m.y)<=perto)){q.kills++;gainXp(Math.round(m.t.xp*m.xpm),q)}}
  const got=[];
  for(const[k,ch,a,b]of LOOT[m.k])if(sorte()<ch)got.push([k,ri(a,b)]);
  const rar=got.length?Math.max(...got.map(g=>ITEMS[g[0]].rar)):0;
  /* um drop só, e quem causou mais dano tem a vez (ver update) */
  if(got.length)G.drops.push({x:m.x,y:m.y,items:got,rar,t:0,dono});
  saida.log(`Loot de ${m.t.nome}: ${got.length?got.map(fmtItem).join(', '):'nada'}.`,['loot','rare','epic'][rar]);
  if(m.t.boss){saida.banner(m.t.nome+' caiu');}
}
function gainXp(x,p){
  const c=p.c;c.xp+=x;p.xpGain+=x;num(p.x,p.y-40,x+' xp','#f3ead6');
  while(c.xp>=xpNeed(c.lvl)){
    const slotsAntes=nSlots(c);
    c.xp-=xpNeed(c.lvl);c.lvl++;
    const st=stats(c,p.cl,p.up),dh=st.mhp-p.mhp,dm=st.mmp-p.mmp;
    p.mhp=st.mhp;p.mmp=st.mmp;
    p.hp=Math.min(p.mhp,p.hp+dh);p.mp=Math.min(p.mmp,p.mp+dm);
    saida.banner(`Nível ${c.lvl}`,p);saida.log(`Você subiu para o nível ${c.lvl}. Vida e mana máximas aumentaram.`,'info',p);
    if(nSlots(c)>slotsAntes)saida.log(`Novo espaço de habilidade liberado: agora você leva ${nSlots(c)} para a masmorra.`,'rare',p);
    /* a habilidade do nível novo: de graça vem sozinha; com preço, o Mestre
       de magias ensina na cidade */
    for(const k of listaDaClasse(p.cl)){if(SPELLS[k].lvl!==c.lvl||(c.sabe&&c.sabe.includes(k)))continue;
      if(precoHab(k)){saida.log(`${SPELLS[k].n} já pode ser aprendida com o Mestre de magias, por ${precoHab(k)} de ouro.`,'epic',p);continue}
      if(c.sabe)c.sabe.push(k);
      saida.log(`Habilidade aprendida: ${SPELLS[k].n}. Equipe no Grimório.`,'epic',p);
      const vago=c.slots.indexOf(null);
      if(vago>=0&&vago<nSlots(c)){c.slots[vago]=k;saida.log(`${SPELLS[k].n} foi para o espaço ${vago+1}.`,'info',p)}
    }
    /* os espaços e as habilidades mudaram: sem isto o botão da habilidade nova
       só aparecia na incursão seguinte */
    saida.nivel(p);
  }
  saida.persist();
}
export function hurtPlayer(p,d){
  if(G.over||p.fora)return;
  /* armadura da classe (o shielding/armor do Tibia) somada ao buff de Provocar */
  d=Math.max(1,Math.round(d*(1-Math.min(.75,CLASSES[p.cl].red+eqBonus('red',p.c)+bf('arm',p)))));
  p.hp-=d;p.flash=.15;num(p.x,p.y-30,d,'#ff4d4d',true);shake(3);efeito(p.x,p.y,'fisico');
  if(p.hp<=0){p.hp=0;sai(p,'morreu')}
}
/* venda da mochila na Feira (src/hud.js): a peça sai da mochila quando o jogador
   anuncia e volta se o banco recusar. Quem chama é o cliente, com a resposta
   da rede, fora do update() — como drinkPot(); na F2 vira entrada (ent) */
export function tiraDoSaco(p,k,q){if(!((p.bag[k]|0)>=q))return false;p.bag[k]-=q;if(!p.bag[k])delete p.bag[k];p.bagVal-=ITEMS[k].val*q;return true}
export function poeNoSaco(p,k,q){p.bag[k]=(p.bag[k]|0)+q;p.bagVal+=ITEMS[k].val*q}
/* vestir na caçada, como no Tibia (decisão do Leonardo): a peça sai da
   mochila e vale na hora; a que estava no corpo vai para a mochila e corre o
   risco dela (tirar só se couber).
   p.troca é o saldo de cada peça que entrou (+) ou saiu (−) do corpo, para a
   extração dar origem só ao que veio desta caçada (cacaFim). Vida e mana
   máximas mudam, mas a atual não sobe junto: senão tirar e pôr cura */
const troca=(p,k,n)=>{const t=p.troca||(p.troca={});t[k]=(t[k]|0)+n;if(!t[k])delete t[k]};
function reveste(p){const st=stats(p.c,p.cl,p.up);p.mhp=st.mhp;p.mmp=st.mmp;p.hp=Math.min(p.hp,p.mhp);p.mp=Math.min(p.mp,p.mmp)}
export function vesteDoSaco(p,k){
  const it=ITEMS[k],e=p.c.equip;if(!it||!it.slot||p.fora||!tiraDoSaco(p,k,1))return false;
  const v=e[it.slot];if(v){poeNoSaco(p,v,1);troca(p,v,-1)}
  e[it.slot]=k;troca(p,k,1);reveste(p);return true}
/* as peças que esta caçada rendeu, para a origem na nuvem: a mochila de
   agora, mais a que foi vestida dela, menos a que saiu do corpo para ela,
   menos o que já estava nela ao entrar (p.bag0, contado na caçada de antes) */
export const pecasDaCaca=p=>{const o={},b0=p.bag0||{},t=p.troca||{};
  for(const k of new Set([...Object.keys(p.bag),...Object.keys(t)])){if(!ITEMS[k].slot)continue;
    const n=(p.bag[k]|0)+(t[k]|0)-(b0[k]|0);if(n>0)o[k]=n}return o};
/* na morte, só as vestidas da mochila que ainda estão no corpo e não tinham
   entrado nela já com origem (p.bag0): o banco dá origem a elas (no máximo
   uma por casa), e o resto da mochila se perde */
export const vestidasDaCaca=p=>{const o={},b0=p.bag0||{};for(const[k,n]of Object.entries(p.troca||{})){const q=n-(b0[k]|0);if(q>0)o[k]=q}return o};
export function tiraProSaco(p,sl){const e=p.c.equip,k=e[sl];if(!k||p.fora||!cabe(p.bag,k))return false;e[sl]=null;poeNoSaco(p,k,1);troca(p,k,-1);reveste(p);return true}
/* o loot vai para a mochila até ela encher (progression.mochila); o que não
   cabe fica no chão, e o aviso sai uma vez por jogador em cada drop (d.av) */
export function pickup(d,i,p){
  let v=0,levou=null,resta=null;
  for(const it of d.items){const[k,q]=it,n=Math.min(q,cabe(p.bag,k));
    if(n>0){p.bag[k]=(p.bag[k]||0)+n;v+=ITEMS[k].val*n;(levou||(levou=[])).push(n<q?[k,n]:it)}
    if(n<q)(resta||(resta=[])).push(n?[k,q-n]:it)}
  const avisa=t=>{if(d.av&1<<p.id)return;d.av|=1<<p.id;saida.log(t,'info',p)};
  if(!levou)return avisa('A mochila está cheia. O loot ficou no chão.');
  p.bagVal+=v;
  if(resta){d.items=resta;d.rar=Math.max(...resta.map(g=>ITEMS[g[0]].rar));avisa('A mochila está cheia: parte do loot ficou no chão.')}
  else G.drops.splice(i,1);
  num(p.x,p.y-30,'+'+v+' ouro','#f2c14e');
  const raro=levou.filter(([k])=>ITEMS[k].rar>=1);
  if(raro.length)saida.log(`Na mochila: ${raro.map(fmtItem).join(', ')}.`,['loot','rare','epic'][Math.max(...raro.map(([k])=>ITEMS[k].rar))],p);
}
