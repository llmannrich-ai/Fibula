/* ---------- mensagens e HUD ----------
   log() e banner() são o lado de tela de saida.log e saida.banner. */
import {RUN,PORTAL_AT,clamp,fmt} from './sim/base.js?v=0.8.1';
import {SPELLS,CITY} from './sim/dados.js?v=0.8.1';
import {save,ch,KL,xpNeed,nSlots} from './sim/progresso.js?v=0.8.1';
import {G} from './sim/incursao.js?v=0.8.1';
import {C} from './sim/cidade.js?v=0.8.1';
import {ART,icone} from './arte.js?v=0.8.1';
import {rede} from './rede.js?v=0.8.1';
import {$} from './dom.js?v=0.8.1';

export const logEl=$('#log'),bannerEl=$('#banner');
export function log(msg,cls='loot'){
  const d=document.createElement('div');d.className='ln out '+cls;d.textContent=msg;logEl.appendChild(d);
  while(logEl.children.length>5)logEl.firstChild.remove();
  setTimeout(()=>d.remove(),8200);
}
let bT;export function banner(t){bannerEl.textContent=t;bannerEl.classList.add('show');clearTimeout(bT);bT=setTimeout(()=>bannerEl.classList.remove('show'),2400)}

export const E={hpI:$('#hpI'),hpT:$('#hpT'),mpI:$('#mpI'),mpT:$('#mpT'),xpI:$('#xpI'),lvlT:$('#lvlT'),clsT:$('#clsT'),magT:$('#magT'),perT:$('#perT'),
  bagT:$('#bagT'),timeT:$('#timeT'),clock:$('#clock'),portalT:$('#portalT'),bPot:$('#bPot'),potN:$('#potN'),
  compass:$('#compass'),compassArrow:$('#compassArrow'),
  slots:[$('#s0'),$('#s1'),$('#s2'),$('#s3')]};
export const setT=(el,v)=>{if(el.textContent!==v)el.textContent=v};
/* ícone da poção no botão; chamado quando o atlas termina de chegar */
export function montaIcones(){
  if(G&&G.active)montaBotoes();
  if(E.bPot.querySelector('.ico'))return;
  const i=document.createElement('span');i.className='ico';i.setAttribute('aria-hidden','true');
  if(icone(i,'pocao'))E.bPot.insertBefore(i,E.bPot.querySelector('.nm'));
}
export function montaBotoes(){ // chamado ao entrar na incursão: os espaços mudam com o nível
  const c=ch(),n=nSlots();
  for(let i=0;i<4;i++){
    const b=E.slots[i],id=i<n?c.slots[i]:null,s=id&&SPELLS[id];
    b.hidden=!s;
    if(!s)continue;
    b.querySelector('.nm').textContent=s.k;
    const ef='ef_'+(s.t==='cura'?'cura':s.t==='buff'?'faisca':s.el||'fisico'),ic=b.querySelector('.ico')||document.createElement('span');
    ic.className='ico';ic.setAttribute('aria-hidden','true');
    if(ART.s[ef]&&icone(ic,ef,0,ART.s[ef].f>>1))b.insertBefore(ic,b.querySelector('.nm'));else ic.remove();
    b.querySelector('.ct').textContent=s.mana?s.mana+' mana':'grátis';
    b.dataset.el=s.t==='cura'?'cura':s.t==='buff'?'apoio':s.el;
    b.setAttribute('aria-label',`${s.n} — ${s.mana?s.mana+' de mana':'sem mana'} (${['J','K','L','I'][i]})`);
  }
}
export function hud(){
  const p=G.p,c=ch(),left=Math.max(0,RUN-G.t);
  E.hpI.style.width=(p.hp/p.mhp*100)+'%';setT(E.hpT,`${Math.ceil(p.hp)}/${p.mhp}`);
  E.mpI.style.width=(p.mp/p.mmp*100)+'%';setT(E.mpT,`${Math.floor(p.mp)}/${p.mmp}`);
  E.xpI.style.width=(c.xp/xpNeed(c.lvl)*100)+'%';setT(E.lvlT,'Nv '+c.lvl);
  setT(E.clsT,KL().nome);setT(E.magT,'Magia '+c.mag);setT(E.perT,'Perícia '+c.per);
  setT(E.bagT,String(G.bagVal));setT(E.timeT,fmt(left));E.clock.classList.toggle('warn',left<=60);
  setT(E.portalT,G.portal.open?'Portal aberto':'Portal em '+fmt(PORTAL_AT-G.t));E.portalT.classList.toggle('open',G.portal.open);
  const showCompass=G.portal.open&&!G.over;E.compass.hidden=!showCompass;
  if(showCompass)E.compassArrow.style.transform=`rotate(${Math.atan2(G.portal.y-p.y,G.portal.x-p.x)}rad)`;
  E.bPot.style.setProperty('--cd',clamp(p.cdC,0,1));E.bPot.classList.toggle('dim',p.pot<=0);setT(E.potN,'×'+p.pot);
  for(let i=0;i<4;i++){
    const b=E.slots[i];if(b.hidden)continue;
    const id=c.slots[i],s=SPELLS[id];
    const esp=Math.max(p.cds[id]||0,p.gcd[s.g]||0);
    b.style.setProperty('--cd',clamp(esp/Math.max(s.cd,s.gcd||.4),0,1));
    b.classList.toggle('dim',p.mp<s.mana);
  }
}
/* ---------- HUD da cidade ----------
   Quem você é, o cofre, e o botão de falar quando há um NPC ao alcance. Ao
   chegar perto, o NPC diz a frase dele no registro, como no Tibia. */
const EC={cls:$('#cCls'),lvl:$('#cLvl'),cofre:$('#cCofre'),rede:$('#cRede'),falar:$('#bFalar'),quem:$('#falarT')};
let pertoAntes=null;
export function hudCidade(){
  const c=ch();
  setT(EC.cls,KL().nome);setT(EC.lvl,'Nv '+c.lvl);setT(EC.cofre,String(save.cofre));
  setT(EC.rede,rede.estado==='ligado'?(rede.n?`${rede.n+1} na cidade`:'Só você na cidade'):rede.estado==='sem rede'?'Sem rede: só você':'Conectando…');
  if(C.perto===pertoAntes)return;
  pertoAntes=C.perto;EC.falar.hidden=!C.perto;
  if(!C.perto)return;
  const n=CITY.npcs[C.perto];
  setT(EC.quem,n.nome);EC.falar.setAttribute('aria-label',`Falar com ${n.nome} (${n.casa}) — Enter`);
  log(`${n.nome}: ${n.fala}`,'info');
}
/* ao entrar na cidade o botão recomeça escondido */
export const zeraCidade=()=>{pertoAntes=null;EC.falar.hidden=true};
