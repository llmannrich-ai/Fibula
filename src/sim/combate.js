/* ---------- combate ----------
   Toda função aqui recebe o jogador que age (p, de G.ps): o personagem dele
   é p.c, a classe p.cl e as melhorias p.up. Nada lê o save. */
import {T,TAU,rr,ri,frr,sorte,hyp,saida} from './base.js?v=0.50.0';
import {EL_COR,SPELLS,ITEMS,LOOT,PROG,CLASSES,HUNTS,fmtItem,listaDaClasse,precoHab} from './dados.js?v=0.50.0';
import {stats,eqBonus,xpNeed,manaPraMag,golpesPraPer,nSlots,cabe} from './progresso.js?v=0.50.0';
import {G,num,shake,sai,solid} from './incursao.js?v=0.50.0';

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
export const efeito=(x,y,el)=>G.fx.push({k:'ef',x,y,n:'ef_'+(el||'fisico'),t:0,life:.5});
/* ---------- PvP ----------
   Só na Arena (decisão do Leonardo em 19/10/2026): um jogador fere outro de
   time diferente (o mesmo código de time não se fere; sem código, todos são
   adversários). O dano é o da habilidade, vezes arena.pvp, e a armadura de
   quem leva conta, como contra monstro. Quem calcula é o servidor da sala;
   na F2, o servidor próprio, sempre por aqui */
export const podeFerir=(p,q)=>!!(G.arena&&p&&q&&p!==q&&!p.fora&&!q.fora&&!(p.time&&p.time===q.time));
/* os alvos de um golpe: os monstros e, na Arena, os adversários de p */
const ALVOS=[];
function alvos(p){ALVOS.length=0;for(const m of G.mons)ALVOS.push(m);if(G.arena)for(const q of G.ps)if(podeFerir(p,q))ALVOS.push(q);return ALVOS}
export function atingir(m,s,mult,p){
  if(m.cl){efeito(m.x,m.y,s.el);hurtPlayer(m,Math.max(1,Math.round(rolaDano(s,p)*(mult||1)*HUNTS[G.caca].arena.pvp)),p);if(s.esc==='per')registraGolpe(p);return}
  efeito(m.x,m.y,s.el);
  hitMon(m,Math.round(rolaDano(s,p)*(mult||1)),EL_COR[s.el],p);
  if(m.hp>0)aplicaEfeitos(m,s,p);
  if(s.esc==='per')registraGolpe(p);
}
function emCone(cx,cy,ang,raio,abertura,lim,p){
  const out=[];
  for(const m of p?alvos(p):G.mons){
    const dx=m.x-cx,dy=m.y-cy,d=hyp(dx,dy);
    if(d>raio+m.r)continue;
    if(abertura<Math.PI){let a=Math.atan2(dy,dx)-ang;while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;if(Math.abs(a)>abertura)continue}
    out.push({m,d});
  }
  out.sort((a,b)=>a.d-b.d);
  return (lim?out.slice(0,lim):out).map(o=>o.m);
}
function emLinha(cx,cy,ang,comp,lim,p){
  const ux=Math.cos(ang),uy=Math.sin(ang),out=[];
  for(const m of p?alvos(p):G.mons){
    const dx=m.x-cx,dy=m.y-cy,t=dx*ux+dy*uy;
    if(t<0||t>comp)continue;
    if(Math.abs(-dx*uy+dy*ux)>18+m.r*.6)continue;
    out.push({m,t});
  }
  out.sort((a,b)=>a.t-b.t);
  return (lim?out.slice(0,lim):out).map(o=>o.m);
}
/* a mira é do jogador (decisão do Leonardo, 19/10/2026): nada procura o
   monstro mais perto. ang é a direção que ele escolheu (sem ela, para onde
   olha) e frac, de 0 a 1, quão longe ele puxou: só a bomba usa, para cair
   no ponto escolhido. Errar gasta a mana e a recarga como acertar */
const ondeBate=(x,y,ux,uy,max)=>{let d=0;while(d<max){const n=Math.min(max,d+8);if(solid((x+ux*n)/T|0,(y+uy*n)/T|0))return d;d=n}return max};
/* a forma da mira de cada habilidade, para a tela desenhar o que vai sair:
   linha (proj, feixe), leque (cone, melee), ponto com área (bomba); aura,
   cura e apoio não miram */
export function formaMira(s,p=G.ps[0]){
  if(!s)return null;
  if(s.t==='proj')return{k:'linha',comp:alcanceDe(s,p)};
  if(s.t==='feixe')return{k:'linha',comp:s.raio};
  if(s.t==='cone'||s.t==='melee')return{k:'leque',raio:s.raio,ab:s.ang||.6};
  if(s.t==='bomba')return{k:'ponto',comp:alcanceDe(s,p)||T*6,raio:s.raio||76};
  return null;
}
export function podeLancar(id,p=G.ps[0]){
  const s=SPELLS[id];
  if(!s||p.c.lvl<s.lvl)return false;
  return (p.cds[id]||0)<=0&&(p.gcd[s.g]||0)<=0&&p.mp>=s.mana;
}
function lancar(id,p,ang,frac){
  if(!G||!G.active||G.over||p.fora)return;
  const s=SPELLS[id];
  if(!s||p.c.lvl<s.lvl)return;
  if((p.cds[id]||0)>0||(p.gcd[s.g]||0)>0)return;
  if(p.mp<s.mana){if(s.cd>1)saida.log(`Mana insuficiente para ${s.n}.`,'warn',p);p.gcd[s.g]=.25;return}
  if(s.t==='cura'&&p.hp>=p.mhp)return;
  if(formaMira(s,p))p.face=Number.isFinite(ang)?ang:p.face;
  const ux=Math.cos(p.face),uy=Math.sin(p.face);
  let usou=true;
  switch(s.t){
    case'proj':{
      /* reto, na direção da mira, até o alcance: bate no primeiro monstro
         ou na parede, e no fim do alcance se desfaz com o mesmo efeito */
      const V=560;
      G.proj.push({k:'b',s,p,x:p.x+ux*12,y:p.y+uy*12,vx:ux*V,vy:uy*V,col:EL_COR[s.el],life:Math.max(.05,(alcanceDe(s,p)-12)/V)});
      break}
    case'bomba':{
      /* cai no ponto escolhido, ou antes, onde a parede corta o arremesso */
      const max=alcanceDe(s,p)||T*6,d=ondeBate(p.x,p.y,ux,uy,max*clamp01(Number.isFinite(frac)?frac:1)),tx=p.x+ux*d,ty=p.y+uy*d;
      G.proj.push({k:'r',s,p,x:p.x,y:p.y-14,tx,ty,col:EL_COR[s.el],life:2.2});
      break}
    case'cone':{
      G.fx.push({k:'cone',x:p.x,y:p.y,ang:p.face,raio:s.raio,ab:s.ang,col:EL_COR[s.el],el:s.el,t:0,life:.4});
      for(const m of emCone(p.x,p.y,p.face,s.raio,s.ang,0,p))atingir(m,s,1,p);
      shake(4);break}
    case'aura':{
      G.fx.push({k:'anel',x:p.x,y:p.y,raio:s.raio,col:EL_COR[s.el],el:s.el,t:0,life:.45});
      for(const m of emCone(p.x,p.y,0,s.raio,Math.PI,0,p))atingir(m,s,1,p);
      shake(s.raio>120?7:4);break}
    case'feixe':{
      /* a linha de visão: a parede corta o raio */
      const comp=ondeBate(p.x,p.y,ux,uy,s.raio);
      G.fx.push({k:'feixe',x:p.x,y:p.y-8,ang:p.face,comp,col:EL_COR[s.el],el:s.el,t:0,life:.3});
      for(const m of emLinha(p.x,p.y,p.face,comp,s.max,p))atingir(m,s,1,p);
      shake(3);break}
    case'melee':{
      /* o golpe sai mesmo sem ninguém na frente */
      p.swing=.24;p.swingA=p.face;p.swingR=s.raio;
      const al=emCone(p.x,p.y,p.face,s.raio,s.ang,s.unico?1:0,p);
      for(const m of al)atingir(m,s,1,p);
      if(!al.length)efeito(p.x+ux*s.raio*.7,p.y+uy*s.raio*.7,s.el);
      if(s.multi)for(let i=1;i<s.multi;i++)G.pend.push({t:i*.16,fn:()=>{
        if(p.fora)return;
        const vivos=emCone(p.x,p.y,p.face,s.raio+8,s.ang,1,p);
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
const clamp01=v=>v<.15?.15:v>1?1:v;
export function lancarSlot(i,p,ang,frac){const id=p.c.slots[i];if(id)lancar(id,p,ang,frac)}
export function drinkPot(p=G&&G.ps[0]){
  if(!G||!G.active||G.over||p.fora)return;
  if(p.cdC>0)return;
  if(p.pot<=0){saida.log('Sem poções.','warn',p);return}
  if(p.hp>=p.mhp)return;
  const h=45+5*(p.c.lvl-1);p.hp=Math.min(p.mhp,p.hp+h);p.pot--;p.cdC=1;
  num(p.x,p.y-30,'+'+h,'#7ee07a',true);efeito(p.x,p.y,'cura');
}
/* comer, como no Tibia: a comida soma os segundos dela ao tempo de
   alimentação (p.ali), e só alimentado se regenera. Come a menor que está
   na mochila (comprada ou caída de monstro); se o tempo passaria do máximo,
   não come nada */
export function comer(p=G&&G.ps[0]){
  if(!G||!G.active||G.over||p.fora||p.cdCo>0)return;
  let k=null;for(const j in p.bag)if(ITEMS[j].comida&&p.bag[j]>0&&(!k||ITEMS[j].comida<ITEMS[k].comida))k=j;
  if(!k){saida.log('Sem comida na mochila.','warn',p);return}
  const s=ITEMS[k].comida;
  if(p.ali+s>PROG.comida.max){saida.log('Você está satisfeito.','info',p);p.cdCo=1;return}
  tiraDoSaco(p,k,1);p.ali+=s;p.cdCo=1;
  num(p.x,p.y-30,'Nham.','#e8c872');
}
export function explode(x,y,s,p){
  const raio=s.raio||76;
  G.fx.push({k:'boom',x,y,raio,col:EL_COR[s.el],el:s.el,t:0,life:.5});shake(6);
  for(const m of alvos(p).slice())if(hyp(m.x-x,m.y-y)<raio+m.r)atingir(m,s,1,p);
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
  /* a Arena paga mais (arena.xp e arena.loot), igual para todos lá dentro */
  const PT=PROG.party,perto=PT.shareTiles*T,A=G.arena&&HUNTS[G.caca].arena,mx=A?A.xp:1,ml=A?A.loot:1;let dono=0;
  for(const q of G.ps){if(m.dn[q.id]>m.dn[dono])dono=q.id;
    if(!q.fora&&(m.dn[q.id]>0||hyp(q.x-m.x,q.y-m.y)<=perto)){q.kills++;gainXp(Math.round(m.t.xp*m.xpm*mx),q)}}
  const got=[];
  for(const[k,ch,a,b]of LOOT[m.k])if(sorte()<ch*ml)got.push([k,ri(a,b)]);
  /* na Arena todo bicho pode deixar comida (arena.comida), além do loot dele */
  if(A)for(const[k,ch]of A.comida)if(sorte()<ch)got.push([k,1]);
  const rar=got.length?Math.max(...got.map(g=>ITEMS[g[0]].rar)):0;
  /* um drop só, e quem causou mais dano tem a vez (ver update) */
  if(got.length)G.drops.push({x:m.x,y:m.y,items:got,rar,t:0,dono});
  saida.log(`Loot de ${m.t.nome}: ${got.length?got.map(fmtItem).join(', '):'nada'}.`,['loot','rare','epic'][rar]);
  if(m.t.boss){saida.banner(m.t.nome+' caiu');}
}
export function gainXp(x,p){
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
/* de é o jogador que feriu (PvP, na Arena); sem ele, um monstro ou o chão */
export function hurtPlayer(p,d,de){
  /* sem notícia do aparelho (p.semRede, posto pela sala) ou enquanto a Arena
     alcança o tempo do fundo (G.alcanca), ninguém se fere: a morte nunca vem
     da ausência do aparelho (pilar 4) */
  if(G.over||p.fora||p.semRede||G.alcanca)return;
  /* armadura da classe (o shielding/armor do Tibia) somada ao buff de Provocar */
  d=Math.max(1,Math.round(d*(1-Math.min(.75,CLASSES[p.cl].red+eqBonus('red',p.c)+bf('arm',p)))));
  p.hp-=d;p.flash=.15;num(p.x,p.y-30,d,'#ff4d4d',true);shake(3);efeito(p.x,p.y,'fisico');
  if(p.hp<=0){p.hp=0;
    if(de){de.pk++;p.mortoPor=de.id;saida.log(`${de.nome||CLASSES[de.cl].nome} matou você.`,'warn',p);saida.log(`Você matou ${p.nome||CLASSES[p.cl].nome}.`,'rare',de)}
    sai(p,'morreu');
    /* quem mata fica com a experiência que o morto perdeu (arena.pvpXp): é
       troca, não criação, para dois cúmplices não fabricarem XP se matando */
    /* no máximo um nível de quem mata: um cúmplice alto não sobe um baixo de vez */
    if(de&&!de.fora&&G.arena){const x=Math.min(xpNeed(de.c.lvl),Math.round(p.xpPerdido*HUNTS[G.caca].arena.pvpXp));
      /* fica à parte (xpPvp): o bônus de saída não conta o que veio de outro jogador */
      if(x>0){gainXp(x,de);de.xpPvp=(de.xpPvp||0)+x}}}
}
/* tirar e pôr na mochila da caçada, com o valor dela (p.bagVal) */
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
export const vestidasDaCaca=p=>{const o={},b0=p.bag0||{},no=new Set(Object.values(p.c.equip));for(const[k,n]of Object.entries(p.troca||{})){const q=n-(b0[k]|0);if(q>0&&no.has(k))o[k]=q}return o};
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
