/* ---------- mensagens e HUD ----------
   log() e banner() são o lado de tela de saida.log e saida.banner. */
import {RUN,PORTAL_AT,clamp,fmt} from './sim/base.js?v=0.13.0';
import {SPELLS,CITY,ITEMS,SLOTS_EQ,SLOT_NOME,fmtItem,fmtBonus} from './sim/dados.js?v=0.13.0';
import {save,ch,KL,xpNeed,nSlots,stats,eqBonus,sealPct,soPecas} from './sim/progresso.js?v=0.13.0';
import {G} from './sim/incursao.js?v=0.13.0';
import {tiraDoSaco,poeNoSaco} from './sim/combate.js?v=0.13.0';
import {temConta,mercado,cacaId} from './nuvem.js?v=0.13.0';
import {erroFeira} from './telas.js?v=0.13.0';
import {persist} from './salvar.js?v=0.13.0';
import {C} from './sim/cidade.js?v=0.13.0';
import {ART,icone} from './arte.js?v=0.13.0';
import {rede} from './rede.js?v=0.13.0';
import {$,app} from './dom.js?v=0.13.0';

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
  const m=document.createElement('span');m.className='ico';m.setAttribute('aria-hidden','true');
  if(icone(m,'saco2'))MO.bt.insertBefore(m,MO.bt.querySelector('.nm'));
  if(!MO.el.hidden)desenhaMochila();
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
  setT(E.bagT,String(p.bagVal));if(p.bagVal!==MO.val&&!MO.el.hidden)desenhaMochila();setT(E.timeT,fmt(left));E.clock.classList.toggle('warn',left<=60);
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

/* ---------- mochila ----------
   O corpo (o que o personagem veste) e o saco (o que ele carrega e perde se
   morrer), numa janela sobre o jogo: a incursão não pausa, e o toque fora
   dela continua sendo joystick. Só mostra — vestir e vender é no Banco, na
   cidade. Nada de arrastar nem de passar o mouse (pilar 3): tocar numa peça
   diz o que ela é. */
const MO={el:$('#mochila'),bt:$('#bMochila'),val:-1,sel:null};
/* o bônus somado do que está vestido, em texto; o Banco usa o mesmo */
export function vestido(c=ch()){
  const st=stats(c),tot=[eqBonus('dano',c)&&`+${Math.round(eqBonus('dano',c)*100)}% de dano`,eqBonus('red',c)&&`−${Math.round(eqBonus('red',c)*100)}% de dano sofrido`,
    eqBonus('vida',c)&&`+${eqBonus('vida',c)} de vida`,eqBonus('mana',c)&&`+${eqBonus('mana',c)} de mana`].filter(Boolean);
  return (tot.length?'Vestido: '+tot.join(', ')+'. ':'Nada vestido. ')+`Vida ${st.mhp} · Mana ${st.mmp}`;
}
const naCaca=()=>!!(G&&G.active&&G.p&&!app.classList.contains('cidade'));
function cel(k,q,rot){
  const b=document.createElement('button');b.type='button';b.className='cel';
  if(!k){b.disabled=true;b.setAttribute('aria-label',rot||'vazio');return b}
  const it=ITEMS[k];b.classList.add('r'+it.rar);
  const ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');
  if(icone(ic,'it_'+k))b.appendChild(ic);
  else{const i=document.createElement('i');i.textContent=it.nome.slice(0,2);b.appendChild(i)}
  if(q>1){const n=document.createElement('q');n.textContent=q;b.appendChild(n)}
  b.setAttribute('aria-label',(rot?rot+': ':'')+fmtItem([k,q])+(it.slot?', '+fmtBonus(it):''));
  b.addEventListener('click',()=>{MO.sel=MO.sel===b.dataset.k?null:b.dataset.k;desenhaMochila()});
  return b;
}
function info(k,q,vestida){
  const el=$('#moInfo');el.textContent='';
  if(!k){el.textContent=naCaca()?'Toque numa peça para ver o que é. O jogo continua correndo.':'Toque numa peça para ver o que é. Vestir, trocar e vender é no Banco.';return}
  const it=ITEMS[k],b=document.createElement('b');b.className='r'+it.rar;b.textContent=fmtItem([k,q]);
  const bo=it.slot?` · ${SLOT_NOME[it.slot]}, ${fmtBonus(it)}`:'';
  el.append(b,vestida?`${bo}. Vestida: não cai na morte.`:(k==='ouro'?'.':` · vale ${it.val*q} de ouro${bo}.`)+(it.slot?' Ao extrair, vai para o Banco.':''));
}
export function desenhaMochila(){
  const c=ch(),K=KL(),caca=naCaca(),p=caca?G.p:null,bag=p?p.bag:{},val=p?p.bagVal:0;
  MO.val=caca?val:-1;
  setT($('#moEye'),`Mochila · ${K.nome} · Nv ${c.lvl}`);
  /* corpo: amuleto e arma, o boneco, armadura e o próprio saco */
  const d=$('#moDoll');d.textContent='';let selInfo=null;
  const eq=sl=>{const k=c.equip[sl],w=document.createElement('div');w.className='eq s-'+sl;
    const b=cel(k,1,SLOT_NOME[sl]);if(!k)b.setAttribute('aria-label',SLOT_NOME[sl]+' vazio');
    b.dataset.k='eq:'+sl;if(MO.sel==='eq:'+sl){b.classList.add('on');selInfo=[k,1,true]}
    const s=document.createElement('small');s.textContent=SLOT_NOME[sl];w.append(b,s);return w};
  const fig=document.createElement('div');fig.className='fig';fig.setAttribute('aria-hidden','true');
  const ic=document.createElement('span');ic.className='ico';
  if(icone(ic,'cls_'+save.classe,2,0,64))fig.appendChild(ic);else{const l=document.createElement('b');l.textContent=K.nome[0];fig.appendChild(l)}
  const sw=document.createElement('div');sw.className='eq s-saco';
  const sc=document.createElement('button');sc.type='button';sc.className='cel'+(val?' cheia':'');sc.disabled=true;
  const si=document.createElement('span');si.className='ico';si.setAttribute('aria-hidden','true');if(icone(si,'saco2'))sc.appendChild(si);
  sc.setAttribute('aria-label',`Saco: ${val} de ouro`);
  const ss=document.createElement('small');ss.textContent='Saco';sw.append(sc,ss);
  d.append(eq('amuleto'),fig,eq('armadura'),eq('arma'),sw);
  setT($('#moTot'),vestido(c));
  /* saco: o mais valioso primeiro; casas vazias completam a grade, como um container do Tibia */
  const sela=p?Math.round(val*sealPct(p.up)):0;
  const mv=$('#moVal');mv.textContent='';const vb=document.createElement('b');vb.textContent=val;mv.append(vb,' ouro');
  setT($('#moRisco'),!caca?'O saco enche na masmorra e só é seu depois do portal.'
    :val?`Se morrer, perde ${val-sela} de ouro`+(sela?` (o selo guarda ${sela}).`:'.')+' Extraia para guardar.':'Vazio. Cada monstro deixa um saco no chão: encoste nele para pegar.');
  const g=$('#moGrade');g.textContent='';
  const rows=Object.entries(bag).sort((a,b)=>ITEMS[b[0]].val*b[1]-ITEMS[a[0]].val*a[1]);
  for(const[k,q]of rows){const b=cel(k,q);b.dataset.k=k;if(MO.sel===k){b.classList.add('on');selInfo=[k,q,false]}g.appendChild(b)}
  for(let i=rows.length;i<Math.max(12,Math.ceil(rows.length/6)*6);i++)g.appendChild(cel(null));
  if(!selInfo)MO.sel=null;
  info(...(selInfo||[]));
  vendaDoSaco(caca&&selInfo&&!selInfo[2]&&ITEMS[selInfo[0]].slot?selInfo[0]:null);
}
/* ---------- venda do saco ----------
   Na caçada, a peça do saco pode ir direto para a Feira, uma por vez (decisão
   do Leonardo: livre, mesmo que depois morra). Sai do saco na hora e volta se
   o banco recusar; o ouro de um negócio fechado já entra no cofre. */
const MV={k:null,ocupado:false};
function vendaDoSaco(k){
  const el=$('#moVenda');el.hidden=!k||!temConta();
  if(el.hidden){MV.k=null;return}
  if(MV.k!==k){MV.k=k;$('#mvPreco').value=ITEMS[k].val;$('#mvMsg').textContent=''}
  $('#mvOk').disabled=MV.ocupado;
}
async function vendeDoSaco(){
  const k=MV.k,p=G&&G.p,pr=Math.round(+$('#mvPreco').value),msg=$('#mvMsg');
  if(!k||!p||p.fora||MV.ocupado)return;
  if(!(pr>=1&&pr<=1e6)){msg.textContent='O preço vai de 1 a 1.000.000 de ouro.';return}
  const id=cacaId();if(!id){msg.textContent=erroFeira('caca');return}
  const saco=soPecas(p.bag);if(!tiraDoSaco(p,k,1))return;
  MV.ocupado=true;msg.textContent='Anunciando…';desenhaMochila();
  try{
    const r=await mercado('mercado_anunciar',{p_lado:'venda',p_item:k,p_preco:pr,p_qtd:1,p_caca:id,p_saco:saco});
    msg.textContent=r.feitos?`Vendeu ${ITEMS[k].nome}: ${r.ouro} de ouro já no cofre (taxa de ${r.taxa}).`
      :`${ITEMS[k].nome} anunciada na Feira a ${pr}. Se ninguém comprar, cancele lá e ela vai para o cofre.`;
  }catch(e){
    /* recusada: volta para o saco, ou para o cofre se a caçada já acabou em extração */
    if(!p.fora)poeNoSaco(p,k,1);else if(p.fora==='extraiu'){save.itens[k]=(save.itens[k]|0)+1;persist()}
    msg.textContent=erroFeira(e.message);
  }
  MV.ocupado=false;if(!MO.el.hidden)desenhaMochila();
}
$('#mvOk').addEventListener('click',vendeDoSaco);
for(const[id,d]of[['#mvMenos',-1],['#mvMais',1]])$(id).addEventListener('click',()=>{const el=$('#mvPreco');el.value=clamp((Math.round(+el.value)||0)+d,1,1e6)});
export function abreMochila(){MO.sel=null;MO.el.hidden=false;MO.bt.setAttribute('aria-expanded','true');MO.bt.setAttribute('aria-label','Fechar a mochila (B)');desenhaMochila()}
export function fechaMochila(){if(MO.el.hidden)return;MO.el.hidden=true;MO.bt.setAttribute('aria-expanded','false');MO.bt.setAttribute('aria-label','Abrir a mochila (B)')}
const alterna=()=>MO.el.hidden?abreMochila():fechaMochila();
MO.bt.addEventListener('click',alterna);
$('#moX').addEventListener('click',fechaMochila);
addEventListener('keydown',e=>{
  const pode=app.classList.contains('cidade')||(G&&G.active&&!G.over&&app.classList.contains('playing'));
  if(e.code==='KeyB'&&!e.repeat&&pode)alterna();
  else if(e.code==='Escape')fechaMochila();
});
