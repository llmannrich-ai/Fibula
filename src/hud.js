/* ---------- mensagens e HUD ----------
   log() e banner() são o lado de tela de saida.log e saida.banner. */
import {RUN,PORTAL_AT,clamp,fmt} from './sim/base.js?v=0.38.1';
import {SPELLS,CITY,ITEMS,SLOTS_EQ,SLOT_NOME,fmtItem,fmtBonus,CLASSES} from './sim/dados.js?v=0.38.1';
import {save,ch,KL,xpNeed,nSlots,stats,eqBonus,sealPct,soPecas,ehMat,ocupa,nEspacos,valMochila,cabe,vesteDaMochila,tiraPraMochila} from './sim/progresso.js?v=0.38.1';
import {G,nComida} from './sim/incursao.js?v=0.38.1';
import {tiraDoSaco,poeNoSaco,vesteDoSaco,tiraProSaco} from './sim/combate.js?v=0.38.1';
import {temConta,mercado,cacaId} from './nuvem.js?v=0.38.1';
import {erroFeira} from './telas.js?v=0.38.1';
import {persist} from './salvar.js?v=0.38.1';
import {C} from './sim/cidade.js?v=0.38.1';
import {ART,icone} from './arte.js?v=0.38.1';
import {retrato} from './desenho.js?v=0.38.1';
import {rede} from './rede.js?v=0.38.1';
import {VOZ} from './voz.js?v=0.38.1';
import {$,app} from './dom.js?v=0.38.1';

export const logEl=$('#log'),bannerEl=$('#banner');
export function log(msg,cls='loot'){
  const d=document.createElement('div');d.className='ln out '+cls;d.textContent=msg;logEl.appendChild(d);
  while(logEl.children.length>5)logEl.firstChild.remove();
  setTimeout(()=>d.remove(),8200);
}
let bT;export function banner(t){bannerEl.textContent=t;bannerEl.classList.add('show');clearTimeout(bT);bT=setTimeout(()=>bannerEl.classList.remove('show'),2400)}

export const E={hpI:$('#hpI'),hpT:$('#hpT'),mpI:$('#mpI'),mpT:$('#mpT'),xpI:$('#xpI'),lvlT:$('#lvlT'),clsT:$('#clsT'),magT:$('#magT'),perT:$('#perT'),
  bagT:$('#bagT'),timeT:$('#timeT'),clock:$('#clock'),portalT:$('#portalT'),bPot:$('#bPot'),potN:$('#potN'),bCom:$('#bCom'),comT:$('#comT'),comN:$('#comN'),
  compass:$('#compass'),compassArrow:$('#compassArrow'),
  slots:[$('#s0'),$('#s1'),$('#s2'),$('#s3')]};
export const setT=(el,v)=>{if(el.textContent!==v)el.textContent=v};
/* ícones da poção e da comida nos botões; chamado quando o atlas termina de chegar */
export function montaIcones(){
  if(G&&G.active)montaBotoes();
  if(E.bPot.querySelector('.ico'))return;
  const i=document.createElement('span');i.className='ico';i.setAttribute('aria-hidden','true');
  if(icone(i,'pocao'))E.bPot.insertBefore(i,E.bPot.querySelector('.nm'));
  const f=document.createElement('span');f.className='ico';f.setAttribute('aria-hidden','true');
  if(icone(f,'sup_presunto'))E.bCom.insertBefore(f,E.bCom.querySelector('.nm'));
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
  const p=G.p,c=p.c,left=G.aberta?RUN:Math.max(0,RUN-G.t);
  E.hpI.style.width=(p.hp/p.mhp*100)+'%';setT(E.hpT,`${Math.ceil(p.hp)}/${p.mhp}`);
  E.mpI.style.width=(p.mp/p.mmp*100)+'%';setT(E.mpT,`${Math.floor(p.mp)}/${p.mmp}`);
  E.xpI.style.width=(c.xp/xpNeed(c.lvl)*100)+'%';setT(E.lvlT,'Nv '+c.lvl);
  setT(E.clsT,CLASSES[p.cl].nome);setT(E.magT,'Magia '+c.mag);setT(E.perT,'Perícia '+c.per);
  setT(E.bagT,String(p.bagVal));if(p.bagVal!==MO.val&&!MO.el.hidden)desenhaMochila();setT(E.timeT,G.aberta?'sem tempo':fmt(left));E.clock.classList.toggle('warn',left<=60);
  setT(E.portalT,G.aberta?'Porta da sala':G.portal.open?'Portal aberto':'Portal em '+fmt(PORTAL_AT-G.t));E.portalT.classList.toggle('open',G.portal.open);
  const showCompass=G.portal.open&&!G.over&&(!G.aberta||p.longe);E.compass.hidden=!showCompass;
  if(showCompass)E.compassArrow.style.transform=`rotate(${Math.atan2(G.portal.y-p.y,G.portal.x-p.x)}rad)`;
  E.bPot.style.setProperty('--cd',clamp(p.cdC,0,1));E.bPot.classList.toggle('dim',p.pot<=0);setT(E.potN,'×'+p.pot);
  /* a comida: quantas restam e quanto tempo de alimentação falta (sem ele, fome) */
  const nc=G.convidado?p.nc|0:nComida(p.bag);
  E.bCom.style.setProperty('--cd',clamp(p.cdCo,0,1));E.bCom.classList.toggle('fome',p.ali<=0);E.bCom.classList.toggle('dim',!nc);
  setT(E.comN,'×'+nc);setT(E.comT,p.ali>0?fmt(p.ali):'Fome');
  for(let i=0;i<4;i++){
    const b=E.slots[i];if(b.hidden)continue;
    const id=c.slots[i],s=SPELLS[id];
    const esp=Math.max(p.cds[id]||0,p.gcd[s.g]||0);
    b.style.setProperty('--cd',clamp(esp/Math.max(s.cd,s.gcd||.4),0,1));
    b.classList.toggle('dim',p.mp<s.mana);
  }
  hudVoz();
}
/* ---------- voz da sala ----------
   O botão aparece só com sala ligada. Desligado, o toque liga (pede o
   microfone); ligado, segurar fala e o rótulo diz quem fala agora */
const EV={b:$('#bVoz'),nm:$('#bVoz .nm'),ct:$('#vozT')};
let vozAntes='';
export function hudVoz(){
  const est=!VOZ.pode&&!VOZ.ligada?'':VOZ.pedindo?'pede':!VOZ.ligada?'off':VOZ.falando?'ar':'on';
  if(est!==vozAntes){
    vozAntes=est;EV.b.hidden=!est;EV.b.classList.toggle('on',est==='on');EV.b.classList.toggle('no-ar',est==='ar');
    EV.b.setAttribute('aria-label',est==='off'||est==='pede'?'Ligar a voz da sala':'Segurar para falar com a sala (V)');
  }
  if(!est)return;
  setT(EV.nm,est==='off'||est==='pede'?'Voz':'Falar');
  setT(EV.ct,est==='off'?'ligar':est==='pede'?'…':est==='ar'?'no ar':VOZ.quem?VOZ.quem:VOZ.n?`${VOZ.n+1} na voz`:'só você');
}
/* ---------- HUD da cidade ----------
   Quem você é, o cofre, e o botão de falar quando há um NPC ao alcance. Ao
   chegar perto, o NPC diz a frase dele no registro, como no Tibia. */
const EC={cls:$('#cCls'),lvl:$('#cLvl'),cofre:$('#cCofre'),rede:$('#cRede'),falar:$('#bFalar'),quem:$('#falarT'),acao:$('#bFalar .nm')};
let pertoAntes=null;
export function hudCidade(){
  const c=ch();
  setT(EC.cls,KL().nome);setT(EC.lvl,'Nv '+c.lvl);setT(EC.cofre,String(save.cofre));
  hudVoz();
  setT(EC.rede,(rede.estado==='ligado'?(rede.n?`${rede.n+1} na cidade`:'Só você na cidade'):rede.estado==='sem rede'?'Sem rede: só você':'Conectando…')+(rede.naSala?` · sala ${rede.naSala}/4`:''));
  if(C.perto===pertoAntes)return;
  pertoAntes=C.perto;EC.falar.hidden=!C.perto;
  if(!C.perto)return;
  const n=CITY.npcs[C.perto];
  /* um lugar (a grade do esgoto) não fala: o botão diz a ação dele */
  const ac=n.acao||'Falar';setT(EC.acao,ac);setT(EC.quem,n.nome);
  EC.falar.setAttribute('aria-label',n.lugar?`${ac}: ${n.nome} (${n.casa}) — Enter`:`${ac} com ${n.nome} (${n.casa}) — Enter`);
  log(n.lugar?n.fala:`${n.nome}: ${n.fala}`,'info');
}
/* ao entrar na cidade o botão recomeça escondido */
export const zeraCidade=()=>{pertoAntes=null;EC.falar.hidden=true};

/* ---------- mochila ----------
   O corpo (o que o personagem veste) e a mochila (o que ele carrega entre as
   caçadas e perde se morrer), numa janela sobre o jogo: a incursão não pausa, e o toque fora
   dela continua sendo joystick. Só mostra — vestir e vender é no Banco, na
   cidade. Nada de arrastar nem de passar o mouse (pilar 3): tocar numa peça
   diz o que ela é. */
const MO={el:$('#mochila'),bt:$('#bMochila'),val:-1,sel:null,dir:2};
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
  b.addEventListener('click',()=>{MO.sel=MO.sel===b.dataset.k?null:b.dataset.k;desenhaMochila();if(MO.sel)$('#moInfo').scrollIntoView({block:'nearest'})});
  return b;
}
function info(k,q,vestida){
  const el=$('#moInfo');el.textContent='';
  if(!k){el.textContent=naCaca()?'Toque numa peça para ver o que é, vestir ou tirar. O jogo continua correndo.':'Toque numa peça para ver o que é, vestir ou tirar. Guardar e vender é no Banco.';return}
  const it=ITEMS[k],b=document.createElement('b');b.className='r'+it.rar;b.textContent=fmtItem([k,q]);
  const bo=it.slot?` · ${SLOT_NOME[it.slot]}, ${fmtBonus(it)}`:'';
  el.append(b,vestida?`${bo}. Vestida: não cai na morte; tirada, vai para a mochila.`:(k==='ouro'?'.':` · vale ${it.val*q} de ouro${bo}.`)+' Na mochila, cai na morte. '+
    (it.slot?'Guardada no Banco, vai para o cofre.':ehMat(k)?'Guardado no Banco, fica no cofre e o Gordon vê na Forja.':k==='ouro'?'Guardado no Banco, vai para o cofre.':'Guardado no Banco, fica no cofre; o Banco compra.'));
}
export function desenhaMochila(){
  const c=ch(),K=KL(),caca=naCaca(),p=caca?G.p:null,bag=p?p.bag:c.mochila,val=p?p.bagVal:valMochila(bag);
  MO.val=caca?val:-1;
  setT($('#moEye'),`Mochila · ${K.nome} · Nv ${c.lvl}`);
  /* corpo: a janela de inventário do Tibia, em três colunas, cada peça no
     lugar em que se usa (amuleto no pescoço, arma na mão, a mochila onde o
     Tibia a põe). As casas que o jogo não tem ficam apagadas, sem toque */
  const d=$('#moDoll');d.textContent='';let selInfo=null;
  const eq=sl=>{const k=c.equip[sl],b=cel(k,1,SLOT_NOME[sl]);if(!k)b.setAttribute('aria-label',SLOT_NOME[sl]+' vazio');
    b.classList.add('s-'+sl);b.dataset.k='eq:'+sl;if(MO.sel==='eq:'+sl){b.classList.add('on');selInfo=[k,1,true]}return b};
  const trava=s=>{const t=document.createElement('span');t.className='trava s-'+s;t.setAttribute('aria-hidden','true');return t};
  const col=(...a)=>{const w=document.createElement('div');w.append(...a);return w};
  const sc=document.createElement('button');sc.type='button';sc.className='cel s-saco'+(val?' cheia':'');sc.disabled=true;
  const si=document.createElement('span');si.className='ico';si.setAttribute('aria-hidden','true');if(icone(si,'saco2'))sc.appendChild(si);
  sc.setAttribute('aria-label',`Mochila: ${val} de ouro`);
  d.append(col(eq('amuleto'),eq('arma'),trava('anel')),col(trava('elmo'),eq('armadura'),trava('calca'),trava('botas')),col(sc,trava('escudo'),trava('municao')));
  /* ao lado, o boneco vestido como anda no mapa; tocar gira */
  const fg=$('#moFig'),tem=retrato(fg.firstElementChild,save.classe,c.equip,MO.dir,4);
  fg.firstElementChild.hidden=!tem;fg.lastElementChild.textContent=tem?'':K.nome[0];
  setT($('#moTot'),vestido(c));
  /* a mochila: o mais valioso primeiro, uma casa por peça de equipamento e
     uma por pilha do resto; as casas livres completam a grade, como um
     container do Tibia. É a mesma na cidade e na caçada */
  const sela=Math.round(val*sealPct(p?p.up:save.up)),n=ocupa(bag),cap=nEspacos(),perde=`perde ${val-sela} de ouro em loot`+(sela?` (o selo guarda ${sela})`:'');
  setT($('#moTit'),'Mochila');
  const mv=$('#moVal');mv.textContent='';const vb=document.createElement('b');vb.textContent=val;mv.append(vb,` ouro · ${n}/${cap}`);
  setT($('#moRisco'),!val?'Vazia. O loot das caçadas vem para cá e fica até você guardar no Banco.'
    :caca?`Se morrer, ${perde}. Saia pela porta e guarde no Banco.`+(n>=cap?' A mochila está cheia.':'')
    :`Vai com você na próxima caçada: se morrer, ${perde}. Guarde no Banco o que não quer arriscar.`);
  const g=$('#moGrade');g.textContent='';
  const rows=Object.entries(bag).sort((a,b)=>ITEMS[b[0]].val*b[1]-ITEMS[a[0]].val*a[1]);
  for(const[k,q]of rows)for(let i=0;i<(ITEMS[k].slot?q:1);i++){const b=cel(k,ITEMS[k].slot?1:q);b.dataset.k=k;
    if(MO.sel===k&&!selInfo){b.classList.add('on');selInfo=[k,q,false]}g.appendChild(b)}
  for(let i=n;i<cap;i++)g.appendChild(cel(null));
  if(!selInfo)MO.sel=null;
  info(...(selInfo||[]));
  acoes(selInfo,caca,p);
  /* o convidado da sala só vê o saco: quem o guarda é o anfitrião, e vender
     daqui duplicaria a peça. Toda caçada é numa sala, e o anfitrião vende */
  vendaDoSaco(caca&&!G.convidado&&selInfo&&!selInfo[2]&&ITEMS[selInfo[0]].slot?selInfo[0]:null);
}
/* vestir e tirar sem ir ao Banco: um toque na peça, um botão grande (pilar 3).
   A troca é com a mochila, na cidade (vesteDaMochila) e na caçada
   (vesteDoSaco); a peça vestida passa a não cair na morte, e a tirada só sai
   se couber na mochila. O convidado da sala, não: quem
   calcula a ficha dele é o anfitrião */
function acoes(sel,caca,p){
  const el=$('#moAcoes');el.textContent='';
  const pode=sel&&ITEMS[sel[0]].slot&&(!caca||(!G.convidado&&!p.fora&&!G.over));
  el.hidden=!pode;if(!pode)return;
  const [k,,vestida]=sel,it=ITEMS[k],sl=it.slot,atual=ch().equip[sl];
  const bt=(t,rot,fn)=>{const b=document.createElement('button');b.type='button';b.className='cta';b.textContent=t;b.setAttribute('aria-label',rot);
    b.addEventListener('click',()=>{if(fn()){if(!caca)persist();desenhaMochila()}});el.appendChild(b)};
  if(vestida){bt('Tirar para a mochila',`Tirar ${it.nome} e pôr na mochila`,()=>{if(!(caca?tiraProSaco(p,sl):tiraPraMochila(sl)))return false;MO.sel=caca?k:null;return true});
    if(!cabe(caca?p.bag:ch().mochila,k))el.lastChild.disabled=true}
  else bt(atual?'Trocar':'Vestir',`Vestir ${it.nome}`+(atual?` no lugar de ${ITEMS[atual].nome}`:''),
    ()=>{if(!(caca?vesteDoSaco(p,k):vesteDaMochila(k)))return false;MO.sel='eq:'+sl;return true});
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
    /* recusada: volta para a mochila, a da caçada ou, se já extraiu, a do personagem */
    if(!p.fora)poeNoSaco(p,k,1);else if(p.fora==='extraiu'){p.c.mochila[k]=(p.c.mochila[k]|0)+1;persist()}
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
$('#moFig').addEventListener('click',()=>{MO.dir=(MO.dir+1)%4;desenhaMochila()});
$('#moX').addEventListener('click',fechaMochila);
addEventListener('keydown',e=>{
  const pode=app.classList.contains('cidade')||(G&&G.active&&!G.over&&app.classList.contains('playing'));
  if(e.code==='KeyB'&&!e.repeat&&pode)alterna();
  else if(e.code==='Escape')fechaMochila();
});
