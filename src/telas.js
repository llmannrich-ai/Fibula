/* ---------- telas ----------
   Acampamento, personagens, grimório, equipamento, tela final e Mercador. */
import {clamp,fmtEl,sementeDe} from './sim/base.js?v=0.6.1';
import {CLASSES,CL_ORDEM,SPELLS,SLOT_LVL,EL_COR,listaDaClasse,UP,ITEMS,fmtItem,SLOTS_EQ,SLOT_NOME,fmtBonus} from './sim/dados.js?v=0.6.1';
import {save,ch,KL,novoChar,xpNeed,manaPraMag,golpesPraPer,nSlots,upCost,sealPct,stats,eqBonus,equipar,desequipar,vender,perdaXp,pctPerdaXp} from './sim/progresso.js?v=0.6.1';
import {G,setG,newRun} from './sim/incursao.js?v=0.6.1';
import {persist,saveFalhou} from './salvar.js?v=0.6.1';
import {desenhaConta} from './nuvem.js?v=0.6.1';
import {logEl,log,montaBotoes,setT} from './hud.js?v=0.6.1';
import {icone} from './arte.js?v=0.6.1';
import {$,app} from './dom.js?v=0.6.1';

export const menu=$('#menu'),endS=$('#end'),shopS=$('#shop'),pickS=$('#pick'),grimS=$('#grim'),equipS=$('#equip');
const TELAS=[menu,endS,shopS,pickS,grimS,equipS];
const soTela=el=>{for(const t of TELAS)t.hidden=t!==el;app.classList.remove('playing')};
export function showMenu(){
  if(!save.classe)return showPick();
  const c=ch();
  $('#mEye').textContent=`Protótipo · v${VERSAO} · ${KL().nome}`;
  $('#sLvl').textContent=c.lvl;$('#sMag').textContent=c.mag;$('#sPer').textContent=c.per;
  $('#sCofre').textContent=save.cofre;$('#sBest').textContent=save.best;$('#sSlots').textContent=nSlots();
  $('#mAviso').hidden=!saveFalhou;desenhaConta();
  $('#sRuns').textContent=save.runs;$('#sExt').textContent=save.ext;$('#sDead').textContent=save.deaths;
  /* pilar 1: o preço da morte, em número, antes de entrar */
  const pd=perdaXp();
  $('#mRisco').textContent=`Morrer também custa ${pctPerdaXp()}% da experiência do nível atual, nunca o nível. Hoje: ${pd?pd+' xp':'nada, o nível está vazio'}.`;
  soTela(menu);
  if(!G||G.active){newRun()}
}
/* ?semente=12345 (ou um texto qualquer) no endereço fixa a masmorra de toda
   incursão desta aba: para reproduzir um problema pelo número que a tela final
   mostra, ou para jogar o mesmo mapa que outra pessoa */
const SEM_URL=(()=>{try{const v=new URLSearchParams(location.search).get('semente');return v?sementeDe(v):undefined}catch(e){return undefined}})();
const nMasmorra=s=>'nº '+s.toLocaleString('pt-BR');
/* a versão vem do endereço deste módulo (?v=, posto por tools/versao.mjs) */
const VERSAO=(()=>{try{return new URL(import.meta.url).searchParams.get('v')||'dev'}catch(e){return 'dev'}})();
function start(){
  newRun(SEM_URL);G.active=true;save.runs++;persist();montaBotoes();
  for(const t of TELAS)t.hidden=true;app.classList.add('playing');logEl.textContent='';
  log('Você entrou na masmorra. O portal abre em 1:30.','info');
  if(SEM_URL!==undefined)log(`Masmorra ${nMasmorra(G.semente)}, escolhida pelo endereço.`,'info');
}

/* ---------- personagens ---------- */
export function showPick(){
  const ul=$('#pickList');ul.textContent='';
  for(const k of CL_ORDEM){
    const K=CLASSES[k],c=save.chars[k];
    const li=document.createElement('li');
    const b=document.createElement('button');b.className='cls'+(save.classe===k?' on':'');b.type='button';
    const hd=document.createElement('div');hd.className='hd';
    const h=document.createElement('h3');h.textContent=K.nome;
    const ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');
    if(icone(ic,'cls_'+k,2,0,64))hd.appendChild(ic);
    const lv=document.createElement('span');lv.className='lv';
    lv.textContent=c?`Nível ${c.lvl} · Magia ${c.mag} · Perícia ${c.per}`:'novo · '+K.tag;
    hd.append(h,lv);
    const p=document.createElement('p');p.textContent=K.desc;
    const bars=document.createElement('div');bars.className='bars';
    /* as quatro barras são as taxas de crescimento, não o poder atual */
    const vals=[['Vida',K.ghp/17],['Mana',K.gmp/16],['Magia',Math.min(1,(1.95-K.mMult)/0.9)],['Perícia',Math.min(1,(2.05-K.pMult)/0.95)],['Armadura',K.red/0.28]];
    for(const[nome,v]of vals){
      const d=document.createElement('div');const t=document.createElement('b');t.textContent=nome;
      const i=document.createElement('i');i.style.setProperty('--v',Math.round(v*100)+'%');
      d.append(t,i);bars.appendChild(d);
    }
    b.append(hd,p,bars);
    b.addEventListener('click',()=>escolher(k));
    li.appendChild(b);ul.appendChild(li);
  }
  $('#pickBack').hidden=!save.classe;
  soTela(pickS);
}
function escolher(k){
  if(!save.chars[k])save.chars[k]=novoChar(k);
  save.classe=k;persist();setG(null);showMenu();
}

/* ---------- grimório ---------- */
function barraProg(rot,atual,falta,alvo,nota){
  const d=document.createElement('div');d.className='pr';
  const t=document.createElement('div');t.className='t';
  const a=document.createElement('b');a.textContent=`${rot} ${atual}`;
  const s=document.createElement('span');s.textContent=nota;
  t.append(a,s);
  const i=document.createElement('i');i.style.setProperty('--v',Math.round(clamp(falta/alvo,0,1)*100)+'%');
  d.append(t,i);return d;
}
function drawGrim(){
  const c=ch(),K=KL();
  $('#grimEye').textContent=`${K.nome} · Nível ${c.lvl} · ${nSlots()} espaço${nSlots()>1?'s':''}`;
  const pg=$('#grimProg');pg.textContent='';
  pg.append(
    barraProg('Nível',c.lvl,c.xp,xpNeed(c.lvl),`${c.xp} / ${xpNeed(c.lvl)} xp`),
    barraProg('Magia',c.mag,c.manaG,manaPraMag(c.mag),`${Math.round(c.manaG)} / ${manaPraMag(c.mag)} de mana gasta`),
    barraProg('Perícia',c.per,c.golpes,golpesPraPer(c.per),`${c.golpes} / ${golpesPraPer(c.per)} golpes acertados`)
  );
  const sl=$('#grimSlots');sl.textContent='';
  for(let i=0;i<4;i++){
    const aberto=i<nSlots(),id=aberto?c.slots[i]:null,s=id&&SPELLS[id];
    const b=document.createElement('button');b.type='button';
    b.className=!aberto?'lock':(s?'full':'');
    const sm=document.createElement('small');sm.textContent=`Espaço ${i+1}`;
    const sp=document.createElement('span');
    sp.textContent=!aberto?`nível ${SLOT_LVL[i]}`:(s?s.n:'vazio');
    b.append(sm,sp);
    if(aberto){
      b.setAttribute('aria-label',s?`Espaço ${i+1}: ${s.n}. Toque para esvaziar.`:`Espaço ${i+1} vazio`);
      if(s)b.addEventListener('click',()=>{c.slots[i]=null;persist();drawGrim()});
    }else{b.disabled=true;b.setAttribute('aria-label',`Espaço ${i+1} abre no nível ${SLOT_LVL[i]}`)}
    sl.appendChild(b);
  }
  const ul=$('#grimList');ul.textContent='';
  for(const k of listaDaClasse(save.classe)){
    const s=SPELLS[k],liberada=c.lvl>=s.lvl,eq=c.slots.indexOf(k);
    const li=document.createElement('li');
    li.className='sp'+(eq>=0&&eq<nSlots()?' eq':'')+(liberada?'':' locked');
    li.style.borderLeftColor=s.t==='cura'?'#8ad872':s.t==='buff'?'#f2a33a':EL_COR[s.el];
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=s.n;
    if(s.w){const w=document.createElement('span');w.className='w';w.textContent=' “'+s.w+'”';h.appendChild(w)}
    const p=document.createElement('p');p.textContent=s.d;
    const meta=document.createElement('div');meta.className='meta';
    const esc=s.esc==='per'?'Perícia':s.esc==='mag'?'Magia':null;
    meta.textContent=[`nível ${s.lvl}`,s.mana?`${s.mana} mana`:'sem mana',`${s.cd}s`,esc&&`escala em ${esc}`].filter(Boolean).join(' · ');
    info.append(h,p,meta);
    const b=document.createElement('button');b.type='button';
    if(!liberada){b.disabled=true;b.textContent='nível '+s.lvl}
    else if(eq>=0&&eq<nSlots()){b.className='rm';b.textContent='guardar';b.addEventListener('click',()=>{c.slots[eq]=null;persist();drawGrim()})}
    else{
      const vago=c.slots.findIndex((v,i)=>i<nSlots()&&!v);
      if(vago<0){b.disabled=true;b.textContent='sem espaço'}
      else{b.textContent='equipar';b.addEventListener('click',()=>{c.slots[vago]=k;persist();drawGrim()})}
    }
    li.append(info,b);ul.appendChild(li);
  }
  soTela(grimS);
}
/* ---------- equipamento ----------
   Uma tela, três espaços, botões grandes: nada de arrastar (pilar 3). O cofre
   embaixo é o da conta; os espaços em cima são do personagem atual. */
const icoItem=k=>{const ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');return icone(ic,'it_'+k)?ic:null};
function drawEquip(){
  const c=ch(),K=KL(),e=c.equip;
  $('#eqEye').textContent=`${K.nome} · Nível ${c.lvl}`;
  setT($('#eqGold'),String(save.cofre));
  const sl=$('#eqSlots');sl.textContent='';
  for(const s of SLOTS_EQ){
    const k=e[s],it=k&&ITEMS[k];
    const b=document.createElement('button');b.type='button';b.className=it?'full':'';
    const sm=document.createElement('small');sm.textContent=SLOT_NOME[s];b.appendChild(sm);
    const ic=it&&icoItem(k);if(ic)b.appendChild(ic);
    const sp=document.createElement('span');sp.textContent=it?it.nome:'vazio';b.appendChild(sp);
    if(it){const em=document.createElement('em');em.textContent=fmtBonus(it);b.appendChild(em);
      b.setAttribute('aria-label',`${SLOT_NOME[s]}: ${it.nome}, ${fmtBonus(it)}. Toque para devolver ao cofre.`);
      b.addEventListener('click',()=>{if(desequipar(s)){persist();drawEquip()}})}
    else b.setAttribute('aria-label',`${SLOT_NOME[s]} vazio`);
    sl.appendChild(b);
  }
  /* o total vestido, para o jogador ver o efeito sem fazer conta */
  const st=stats(),tot=[eqBonus('dano')&&`+${Math.round(eqBonus('dano')*100)}% de dano`,eqBonus('red')&&`−${Math.round(eqBonus('red')*100)}% de dano sofrido`,
    eqBonus('vida')&&`+${eqBonus('vida')} de vida`,eqBonus('mana')&&`+${eqBonus('mana')} de mana`].filter(Boolean);
  $('#eqTot').textContent=(tot.length?'Vestido: '+tot.join(', ')+'. ':'Nada vestido. ')+`Vida ${st.mhp} · Mana ${st.mmp}`;
  const ul=$('#eqList');ul.textContent='';
  const rows=Object.entries(save.itens).sort((a,b)=>SLOTS_EQ.indexOf(ITEMS[a[0]].slot)-SLOTS_EQ.indexOf(ITEMS[b[0]].slot)||ITEMS[b[0]].val-ITEMS[a[0]].val);
  if(!rows.length){const li=document.createElement('li');li.className='vazio';
    li.textContent='O cofre não tem peças. Armas, armaduras e amuletos que você extrair aparecem aqui.';ul.appendChild(li)}
  for(const[k,q]of rows){
    const it=ITEMS[k],atual=e[it.slot];
    const li=document.createElement('li');li.className='sp r'+it.rar;
    const ic=icoItem(k);if(ic)li.appendChild(ic);
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=q>1?`${it.nome} ×${q}`:it.nome;
    const p=document.createElement('p');p.textContent=`${SLOT_NOME[it.slot]} · ${fmtBonus(it)}`;
    const meta=document.createElement('div');meta.className='meta';
    meta.textContent=atual===k?'igual à que está vestida':atual?`no lugar de: ${ITEMS[atual].nome} (${fmtBonus(ITEMS[atual])})`:'espaço livre';
    info.append(h,p,meta);
    const bt=document.createElement('div');bt.className='btns';
    const b1=document.createElement('button');b1.type='button';b1.textContent=atual?'trocar':'vestir';
    b1.setAttribute('aria-label',`Vestir ${it.nome}`+(atual?` no lugar de ${ITEMS[atual].nome}`:''));
    if(atual===k)b1.disabled=true;
    else b1.addEventListener('click',()=>{if(equipar(k)){persist();drawEquip()}});
    const b2=document.createElement('button');b2.type='button';b2.className='rm';b2.textContent=`vender ${it.val}`;
    b2.setAttribute('aria-label',`Vender ${it.nome} por ${it.val} de ouro`);
    b2.addEventListener('click',()=>{if(vender(k)){persist();drawEquip()}});
    bt.append(b1,b2);li.append(info,bt);ul.appendChild(li);
  }
  soTela(equipS);
}

export function showEnd(){
  const k=G.end,ok=k==='extraiu';
  $('#endEye').textContent=ok?'Incursão concluída':'Fim da incursão';
  const t=$('#endTitle');t.textContent=ok?'Extraído!':k==='morreu'?'Você morreu':'Soterrado';t.classList.toggle('lost',!ok);
  $('#endText').textContent=ok?(G.pecas
      ?`Você saiu pelo portal com ${G.bagVal} de ouro em loot. ${G.ouroExt} viraram ouro no cofre, e ${G.pecas} peça${G.pecas>1?'s':''} de equipamento ${G.pecas>1?'esperam':'espera'} lá para vestir ou vender.`
      :`Você saiu pelo portal com ${G.bagVal} de ouro em loot. Tudo foi para o cofre.`)
    :k==='morreu'?`O loot que você carregava ficou na masmorra, e a morte levou ${pctPerdaXp()}% da experiência do nível.`
    :`A masmorra desabou antes de você chegar ao portal. O loot ficou para trás, e você perdeu ${pctPerdaXp()}% da experiência do nível.`;
  const l=$('#eLoot');l.textContent=`${G.bagVal} ouro · ${ok?'guardado':'perdido'}`;l.className=ok?'ok':'bad';
  const sealOn=!ok&&G.sealed>0,sl=$('#eSeal');
  $('#eSealDt').hidden=!sealOn;sl.hidden=!sealOn;
  if(sealOn){sl.textContent=`+${G.sealed} ouro (${Math.round(sealPct()*100)}%)`;sl.className='ok'}
  const xl=$('#eXpPerda');$('#eXpPerdaDt').hidden=ok;xl.hidden=ok;
  if(!ok){xl.textContent=`−${G.xpPerdido} xp (${pctPerdaXp()}% do nível)`;xl.className='bad'}
  const c=ch();
  $('#eKills').textContent=G.kills;$('#eXp').textContent=`+${G.xpGain} (nível ${c.lvl})`;
  $('#eTrain').textContent=(G.magGain||G.perGain)
    ? [G.magGain&&`+${G.magGain} de Magia`,G.perGain&&`+${G.perGain} de Perícia`].filter(Boolean).join(' · ')
    : `Magia ${c.mag} · Perícia ${c.per}`;
  $('#eTime').textContent=fmtEl(G.dur);$('#eSeed').textContent=nMasmorra(G.semente);$('#eCofre').textContent=`${save.cofre} ouro`;
  const ul=$('#endItems');ul.textContent='';
  const rows=Object.entries(G.bag).sort((a,b)=>ITEMS[b[0]].val*b[1]-ITEMS[a[0]].val*a[1]);
  if(!rows.length){const li=document.createElement('li');li.textContent='O saco estava vazio.';ul.appendChild(li)}
  for(const[k,q]of rows){const li=document.createElement('li');li.className='r'+ITEMS[k].rar;
    const a=document.createElement('span'),ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');
    if(icone(ic,'it_'+k))a.appendChild(ic);a.append(fmtItem([k,q]));
    if(ITEMS[k].slot){const sm=document.createElement('small');sm.textContent=SLOT_NOME[ITEMS[k].slot].toLowerCase();a.appendChild(sm)}
    const b=document.createElement('span');b.textContent=ITEMS[k].val*q;li.append(a,b);ul.appendChild(li)}
  soTela(endS);
}
/* ---------- mercador ---------- */
function drawShop(){
  setT($('#shopGold'),String(save.cofre));
  const ul=$('#shopList');ul.textContent='';
  for(const k in UP){
    const u=UP[k],n=save.up[k],maxed=n>=u.max,cost=maxed?0:upCost(k,n);
    const li=document.createElement('li');li.className=maxed?'up maxed':'up';
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=u.nome;
    const d=document.createElement('p');d.textContent=u.desc;
    const pips=document.createElement('div');pips.className='pips';
    for(let i=0;i<u.max;i++){const pip=document.createElement('i');if(i<n)pip.className='on';pips.appendChild(pip)}
    info.append(h,d,pips);
    const b=document.createElement('button');b.className=maxed?'buy max':'buy';
    b.textContent=maxed?'máx':cost+' ouro';
    b.disabled=maxed||save.cofre<cost;
    b.setAttribute('aria-label',maxed?`${u.nome} já está no nível máximo`:`Comprar ${u.nome} nível ${n+1} por ${cost} de ouro`);
    if(!maxed)b.addEventListener('click',()=>buy(k));
    li.append(info,b);ul.appendChild(li);
  }
}
function buy(k){
  const n=save.up[k];if(n>=UP[k].max)return;
  const cost=upCost(k,n);if(save.cofre<cost)return;
  save.cofre-=cost;save.up[k]=n+1;persist();drawShop();
}
function showShop(){drawShop();soTela(shopS)}

$('#toShop').addEventListener('click',showShop);
$('#shopBack').addEventListener('click',showMenu);
$('#toGrim').addEventListener('click',drawGrim);
$('#grimBack').addEventListener('click',showMenu);
$('#toEquip').addEventListener('click',drawEquip);
$('#eqBack').addEventListener('click',showMenu);
$('#toPick').addEventListener('click',showPick);
$('#pickBack').addEventListener('click',showMenu);
$('#play').addEventListener('click',start);
$('#again').addEventListener('click',start);
$('#toMenu').addEventListener('click',showMenu);

/* conteúdo que não carregou: o menu diz o motivo e o jogo não começa */
export function conteudoFalhou(err,DATA_URL){
  console.error('[Fibula] conteúdo não carregado:',err);
  const play=$('#play'),tela=$('#menu');
  if(play){play.disabled=true;play.textContent='Conteúdo não carregado'}
  const box=document.createElement('p');
  box.style.cssText='margin:12px 0 0;padding:10px 12px;border:1px solid #7a2b2b;border-radius:10px;'+
    'background:#2a1414;color:#f0c7c7;font-size:13px;line-height:1.45;text-align:left';
  box.textContent=location.protocol==='file:'
    ? 'Os dados do jogo são carregados por rede, e o navegador bloqueia isso em arquivo aberto do disco. '+
      'Sirva a pasta por HTTP com tools/serve.ps1 e abra pelo localhost.'
    : `Falha ao carregar ${DATA_URL} — ${err.message}`;
  (play&&play.parentNode||tela||document.body).appendChild(box);
  if(tela)tela.hidden=false;
}
