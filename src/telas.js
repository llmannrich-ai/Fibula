/* ---------- telas ----------
   Acampamento, cidade, personagens, grimório, banco (equipamento), Guia de
   caça, tela final, Mercador e Feira (mercado entre jogadores). */
import {clamp,fmtEl,sementeDe,novaSemente} from './sim/base.js?v=0.15.0';
import {CLASSES,CL_ORDEM,SPELLS,SLOT_LVL,EL_COR,listaDaClasse,UP,ITEMS,fmtItem,SLOTS_EQ,SLOT_NOME,fmtBonus,CITY,HUNTS} from './sim/dados.js?v=0.15.0';
import {save,ch,KL,novoChar,xpNeed,manaPraMag,golpesPraPer,nSlots,upCost,sealPct,equipar,desequipar,vender,perdaXp,pctPerdaXp} from './sim/progresso.js?v=0.15.0';
import {G,setG,newRun} from './sim/incursao.js?v=0.15.0';
import {C,entraCidade} from './sim/cidade.js?v=0.15.0';
import {persist,saveFalhou} from './salvar.js?v=0.15.0';
import {desenhaConta,temConta,mercado,cacaComeca,lastroBanco} from './nuvem.js?v=0.15.0';
import {rede,SALAS} from './rede.js?v=0.15.0';
import {SALA,MAX,criaSala,entraSala,saiDaSala,comecaGrupo,correndo} from './sala.js?v=0.15.0';
import {logEl,log,banner,montaBotoes,setT,zeraCidade,vestido,fechaMochila} from './hud.js?v=0.15.0';
import {icone} from './arte.js?v=0.15.0';
import {$,app} from './dom.js?v=0.15.0';
import {retrato} from './desenho.js?v=0.15.0';

export const menu=$('#menu'),endS=$('#end'),shopS=$('#shop'),pickS=$('#pick'),grimS=$('#grim'),equipS=$('#equip'),huntS=$('#hunts'),mktS=$('#mkt');
const TELAS=[menu,endS,shopS,pickS,grimS,equipS,huntS,mktS];
/* V.cidade: a cidade é o fundo (está nela, ou numa tela aberta a partir dela);
   senão o fundo é a masmorra. As telas de dentro voltam para onde vieram. */
export const V={cidade:false};
const soTela=el=>{
  for(const t of TELAS)t.hidden=t!==el;app.classList.remove('playing','cidade');fechaMochila();
  for(const b of document.querySelectorAll('.voltar'))b.textContent=V.cidade?'Voltar à cidade':'Voltar ao acampamento';
};
const volta=()=>V.cidade?showCidade():showMenu();
/* pilar 1: o preço da morte, em número, antes de entrar — no acampamento e no
   Guia de caça, que é por onde se entra */
const risco=()=>{const pd=perdaXp();return `Morrer também custa ${pctPerdaXp()}% da experiência do nível atual, nunca o nível. Hoje: ${pd?pd+' xp':'nada, o nível está vazio'}.`};
export function showMenu(){
  V.cidade=false;
  if(!save.classe)return showPick();
  const c=ch();
  $('#mEye').textContent=`Protótipo · v${VERSAO} · ${KL().nome}`;
  $('#sLvl').textContent=c.lvl;$('#sMag').textContent=c.mag;$('#sPer').textContent=c.per;
  $('#sCofre').textContent=save.cofre;$('#sBest').textContent=save.best;$('#sSlots').textContent=nSlots();
  $('#mAviso').hidden=!saveFalhou;desenhaConta();
  $('#sRuns').textContent=save.runs;$('#sExt').textContent=save.ext;$('#sDead').textContent=save.deaths;
  $('#mRisco').textContent=risco();
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
/* por ora todos os mapas de caça do Guia levam à mesma masmorra gerada.
   prepara monta a incursão (a da sala, src/sala.js); sem ele, a solo */
export function start(prepara){
  V.cidade=false;
  if(prepara)prepara();else newRun(SEM_URL);
  G.active=true;save.runs++;persist();montaBotoes();cacaComeca();
  for(const t of TELAS)t.hidden=true;app.classList.remove('cidade');app.classList.add('playing');logEl.textContent='';fechaMochila();
  log(G.ps.length>1?`Vocês entraram na masmorra, ${G.ps.length} juntos. O portal abre em 1:30, e cada um sai por ele quando quiser.`:'Você entrou na masmorra. O portal abre em 1:30.','info');
  if(SEM_URL!==undefined)log(`Masmorra ${nMasmorra(G.semente)}, escolhida pelo endereço.`,'info');
}

/* ---------- cidade ----------
   O mapa e quem está perto são da simulação (src/sim/cidade.js); aqui ficam
   o que cada NPC abre e a chegada. como: 'chegada' (vindo do acampamento, no
   @ do mapa), 'portao' (de volta de uma incursão, na frente do Guia) ou nada
   (voltando de uma tela aberta na cidade, no mesmo lugar). */
export function showCidade(como){
  if(!save.classe)return showPick();
  if(como||!C)entraCidade(como==='portao');
  V.cidade=true;soTela(null);app.classList.add('cidade');zeraCidade();
  if(como){logEl.textContent='';banner(CITY.nome);log(como==='portao'?'Você voltou à cidade pelo portão.':`Você está na ${CITY.nome.toLowerCase()}. Para caçar, fale com o Guia no portão sul.`,'info')}
}
export function abreNpc(k){
  const a=CITY.npcs[k].abre;
  if(a==='mercador')showShop();else if(a==='banco')drawEquip();else if(a==='mercado')showFeira();else showHunts();
}
/* a incursão da sala: o anfitrião leva quem está nela */
const comGrupo=()=>start(()=>{const s=SEM_URL!==undefined?SEM_URL:novaSemente();newRun(s,comecaGrupo(s));G.sala=true});
const botao=(txt,rot,fn,off)=>{const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=txt;b.setAttribute('aria-label',rot);b.disabled=!!off;b.addEventListener('click',fn);return b};
/* ---------- sala no Guia de caça ----------
   Criar sala, ver as abertas de quem está na cidade e entrar, ou, dentro de
   uma, quem está nela. A sala fica aberta até o anfitrião fechar ou sair */
function desenhaSala(){
  const box=$('#hSala');box.textContent='';
  const h=document.createElement('h3'),p=document.createElement('p'),ul=document.createElement('ul'),ac=document.createElement('div');ac.className='acoes';
  const nomes=()=>SALA.membros.map(m=>`${m.nome} (${CLASSES[m.cl]?CLASSES[m.cl].nome:m.cl}, nv ${m.lvl})`).join(', ');
  if(SALA.papel==='anfitriao'){
    h.textContent=`Sua sala · ${SALA.membros.length}/${MAX}`;
    p.textContent=correndo()?'A incursão do grupo ainda está em andamento.':`Na sala: ${nomes()}. Ao entrar num lugar abaixo, todos vão juntos.`;
    ac.append(botao('Fechar sala','Fechar a sala',()=>{saiDaSala();showHunts()},correndo()));
  }else if(SALA.papel==='convidado'){
    const a=SALA.membros[0];
    h.textContent=a?`Sala de ${a.nome} · ${SALA.membros.length}/${MAX}`:'Entrando na sala…';
    p.textContent=a?`Na sala: ${nomes()}. Espere o anfitrião começar; enquanto isso, ande pela cidade à vontade.`:'Esperando o anfitrião responder.';
    ac.append(botao('Sair da sala','Sair da sala',()=>{saiDaSala();showHunts()}));
  }else{
    h.textContent='Caçar em grupo';
    if(rede.estado!=='ligado'){p.textContent=rede.estado==='sem rede'?'Sem conexão com a cidade agora: dá para caçar sozinho.':'Conectando à cidade…'}
    else{
      p.textContent=SALAS.size?'Salas abertas de quem está na cidade:':'Nenhuma sala aberta agora. Crie a sua e chame quem está na cidade.';
      for(const s of SALAS.values()){
        const li=document.createElement('li'),t=document.createElement('span');
        t.textContent=`Sala de ${s.nome} (${CLASSES[s.classe]?CLASSES[s.classe].nome:''}) · ${s.n}/${MAX}`;
        li.append(t,botao('entrar',`Entrar na sala de ${s.nome}`,()=>{entraSala(s.id);showHunts()},s.n>=MAX));ul.appendChild(li);
      }
      ac.append(botao('Criar sala','Criar uma sala para caçar junto',()=>{criaSala();showHunts()}));
    }
  }
  box.append(h,p);if(ul.children.length)box.appendChild(ul);box.appendChild(ac);
}
SALA.aoMudar=rede.aoMudar=()=>{if(!huntS.hidden)showHunts()};
function showHunts(){
  const ul=$('#huntList'),c=ch();ul.textContent='';
  $('#hRisco').textContent=risco();desenhaSala();
  for(const[k,h]of Object.entries(HUNTS)){
    const li=document.createElement('li');li.className='sp';
    const info=document.createElement('div');info.className='info';
    const t=document.createElement('h3');t.textContent=h.nome;
    const p=document.createElement('p');p.textContent=h.desc||'';
    const meta=document.createElement('div');meta.className='meta'+(c.lvl<h.nivel?' alto':'');
    meta.textContent=`nível recomendado ${h.nivel}`+(c.lvl<h.nivel?' · acima do seu':'');
    info.append(t,p,meta);
    const b=document.createElement('button');b.type='button';
    /* na sala, quem escolhe o lugar e começa é o anfitrião */
    if(SALA.papel==='convidado'){b.textContent='o anfitrião escolhe';b.disabled=true}
    else if(SALA.papel==='anfitriao'){b.textContent=correndo()?'em andamento':'entrar com o grupo';b.disabled=correndo();b.addEventListener('click',comGrupo)}
    else{b.textContent='entrar';b.addEventListener('click',()=>start())}
    b.setAttribute('aria-label',`Entrar em ${h.nome}`);
    li.append(info,b);ul.appendChild(li);
  }
  soTela(huntS);
}
$('#bFalar').addEventListener('click',()=>{if(C&&C.perto)abreNpc(C.perto)});
addEventListener('keydown',e=>{
  if(!app.classList.contains('cidade')||e.repeat||!C||!C.perto)return;
  if(e.code==='Enter'||e.code==='KeyE'){e.preventDefault();abreNpc(C.perto)}
});

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
  save.classe=k;persist();setG(null);volta();
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
/* o boneco vestido, como fica no mapa; tocar gira (sul, oeste, norte, leste) */
let eqDir=2;
export const desenhaBoneco=()=>{const b=$('#eqBoneco');b.hidden=!retrato(b.firstElementChild,save.classe,ch().equip,eqDir,4)};
function drawEquip(){
  const c=ch(),K=KL(),e=c.equip;
  $('#eqEye').textContent=`${K.nome} · Nível ${c.lvl}`;
  desenhaBoneco();
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
  $('#eqTot').textContent=vestido();
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
    b2.addEventListener('click',()=>{if(vender(k)){lastroBanco(k,it.val);persist();drawEquip()}});
    bt.append(b1,b2);li.append(info,bt);ul.appendChild(li);
  }
  soTela(equipS);
}

export function showEnd(){
  /* o resultado é do jogador deste aparelho, não da sala */
  const p=G.p,k=p.fora||G.end,ok=k==='extraiu';
  $('#endEye').textContent=ok?'Incursão concluída':'Fim da incursão';
  const t=$('#endTitle');t.textContent=ok?'Extraído!':k==='morreu'?'Você morreu':'Soterrado';t.classList.toggle('lost',!ok);
  $('#endText').textContent=ok?(p.pecas
      ?`Você saiu pelo portal com ${p.bagVal} de ouro em loot. ${p.ouroExt} viraram ouro no cofre, e ${p.pecas} peça${p.pecas>1?'s':''} de equipamento ${p.pecas>1?'esperam':'espera'} lá para vestir ou vender.`
      :`Você saiu pelo portal com ${p.bagVal} de ouro em loot. Tudo foi para o cofre.`)
    :k==='morreu'?`O loot que você carregava ficou na masmorra, e a morte levou ${pctPerdaXp()}% da experiência do nível.`
    :`A masmorra desabou antes de você chegar ao portal. O loot ficou para trás, e você perdeu ${pctPerdaXp()}% da experiência do nível.`;
  const l=$('#eLoot');l.textContent=`${p.bagVal} ouro · ${ok?'guardado':'perdido'}`;l.className=ok?'ok':'bad';
  const sealOn=!ok&&p.sealed>0,sl=$('#eSeal');
  $('#eSealDt').hidden=!sealOn;sl.hidden=!sealOn;
  if(sealOn){sl.textContent=`+${p.sealed} ouro (${Math.round(sealPct(p.up)*100)}%)`;sl.className='ok'}
  const xl=$('#eXpPerda');$('#eXpPerdaDt').hidden=ok;xl.hidden=ok;
  if(!ok){xl.textContent=`−${p.xpPerdido} xp (${pctPerdaXp()}% do nível)`;xl.className='bad'}
  const c=p.c;
  $('#eKills').textContent=p.kills;$('#eXp').textContent=`+${p.xpGain} (nível ${c.lvl})`;
  $('#eTrain').textContent=(p.magGain||p.perGain)
    ? [p.magGain&&`+${p.magGain} de Magia`,p.perGain&&`+${p.perGain} de Perícia`].filter(Boolean).join(' · ')
    : `Magia ${c.mag} · Perícia ${c.per}`;
  $('#eTime').textContent=fmtEl(G.dur);$('#eSeed').textContent=nMasmorra(G.semente);$('#eCofre').textContent=`${save.cofre} ouro`;
  const ul=$('#endItems');ul.textContent='';
  const rows=Object.entries(p.bag).sort((a,b)=>ITEMS[b[0]].val*b[1]-ITEMS[a[0]].val*a[1]);
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

/* ---------- feira (mercado entre jogadores) ----------
   O livro de ofertas e o match são do banco (src/nuvem.js, mercado()); aqui é
   só a tela. Duas vistas na mesma tela, nada de arrastar (pilar 3): a lista
   das peças com o melhor preço de cada lado, e a peça aberta, com o livro,
   comprar ou vender, preço e quantidade. Tocar num preço do livro aceita
   esse preço. Ninguém tem nome na feira: não há o que moderar. */
const MK={livro:null,peca:null,lado:'venda',ocupado:false};
const MSG_MK={conta:'Para negociar com outros jogadores, entre com uma conta no acampamento.',
  nuvem:'Conectando à nuvem. Tente de novo em instantes.',rede:'Sem conexão com a feira agora. Tente de novo quando tiver rede.',
  sessao:'Sua sessão expirou. Entre de novo no acampamento.',sem_save:'Seu progresso ainda não subiu para a nuvem. Tente de novo em instantes.',
  sem_ouro:'Falta ouro no cofre para essa compra.',sem_peca:'Você não tem essa quantidade da peça no cofre.',
  limite:'Você já tem 10 ofertas abertas. Cancele uma para anunciar outra.',preco:'O preço vai de 1 a 1.000.000 de ouro por peça.',
  qtd:'A quantidade vai de 1 a 100.',ordem:'Essa oferta já fechou ou foi cancelada.',
  sem_origem:'O banco não tem registro de onde isso veio. Só se negocia o que foi extraído, comprado, recebido na Feira ou vendido ao Banco com a conta ligada.',
  caca:'Esta caçada não foi registrada no banco (sem rede quando começou). Extraia e venda do cofre.',
  caca_cedo:'A caçada acabou de começar. Espere alguns segundos para vender do saco.',
  saco_limite:'Limite de peças vindas de caçada atingido (30 por caçada, 60 por dia).'};
/* o que o banco aceita: o menor entre o save e a origem registrada */
const origem=()=>(MK.livro&&MK.livro.lastro)||{ouro:0,itens:{}};
const vendaveis=k=>Math.min(save.itens[k]|0,origem().itens[k]|0);
const ouroUtil=()=>Math.min(save.cofre,origem().ouro|0);
const pecasDaFeira=()=>Object.keys(ITEMS).filter(k=>ITEMS[k].slot).sort((a,b)=>SLOTS_EQ.indexOf(ITEMS[a].slot)-SLOTS_EQ.indexOf(ITEMS[b].slot)||ITEMS[a].val-ITEMS[b].val);
const livroDe=k=>(MK.livro&&MK.livro.itens[k])||{venda:[],compra:[],ultimo:null,dia:0};
const taxaMk=()=>MK.livro?MK.livro.taxa:2;
const taxaDe=t=>Math.ceil(t*taxaMk()/100);
const msgMk=(t,ruim)=>{const m=$('#mktMsg');m.textContent=t||'';m.className='mmsg'+(ruim?' ruim':'')};
const erroMk=e=>msgMk(MSG_MK[e.message]||MSG_MK.rede,true);
/* a mesma mensagem para a venda do saco, na Mochila */
export const erroFeira=c=>MSG_MK[c]||MSG_MK.rede;
const nPecas=(q,k)=>q>1?`${q} × ${ITEMS[k].nome}`:ITEMS[k].nome;
/* o que outros jogadores pagaram ou entregaram enquanto você não estava */
const fmtRecebido=r=>{const p=[];if(r.ouro>0)p.push(`${r.ouro} de ouro`);
  for(const[k,q]of Object.entries(r.itens||{}))if(ITEMS[k])p.push(nPecas(q,k));
  return p.length?`Da feira, entrou no cofre: ${p.join(', ')}.`:''};
async function lerLivro(){MK.livro=await mercado('mercado_livro')}
async function showFeira(){
  MK.peca=null;MK.livro=null;soTela(mktS);desenhaFeira();
  if(!temConta())return msgMk(MSG_MK.conta,true);
  msgMk('Lendo o livro de ofertas…');
  try{
    await lerLivro();let t='';
    const cx=MK.livro.caixa;
    if(cx&&(cx.ouro>0||Object.keys(cx.itens||{}).length)){t=fmtRecebido((await mercado('mercado_coletar')).recebido);await lerLivro()}
    msgMk(t);
  }catch(e){erroMk(e)}
  desenhaFeira();
}
function desenhaFeira(){
  setT($('#mktGold'),String(save.cofre));$('#mktTaxa').textContent=taxaMk();
  const og=$('#mktOrig'),ou=ouroUtil();og.hidden=!MK.livro||ou>=save.cofre;
  og.textContent=`Com origem registrada: ${ou} de ouro. Só esse pode comprar na Feira.`;
  $('#mktLista').hidden=!!MK.peca;$('#mktPeca').hidden=!MK.peca;mktS.classList.toggle('peca',!!MK.peca);
  if(MK.peca)return desenhaPeca();
  const ul=$('#mktItens');ul.textContent='';
  for(const k of pecasDaFeira()){
    const it=ITEMS[k],l=livroDe(k),tem=save.itens[k]|0;
    const li=document.createElement('li');li.className='sp r'+it.rar;
    const ic=icoItem(k);if(ic)li.appendChild(ic);
    const info=document.createElement('div');info.className='info';
    const vd=vendaveis(k);
    const h=document.createElement('h3');h.textContent=it.nome+(tem?` · ${tem} no cofre`+(MK.livro&&vd<tem?`, ${vd} com origem`:''):'');
    const p=document.createElement('p');
    p.textContent=[l.venda.length&&`vendem a partir de ${l.venda[0][0]}`,l.compra.length&&`compram até ${l.compra[0][0]}`].filter(Boolean).join(' · ')||'Ninguém anuncia agora.';
    const meta=document.createElement('div');meta.className='meta';
    meta.textContent=(l.ultimo?`último negócio ${l.ultimo}`+(l.dia?` · ${l.dia} no dia`:''):'sem negócio ainda')+` · o Banco paga ${it.val}`;
    info.append(h,p,meta);
    const b=document.createElement('button');b.type='button';b.textContent='negociar';
    b.setAttribute('aria-label',`Negociar ${it.nome}`);b.disabled=!MK.livro;
    b.addEventListener('click',()=>abrePeca(k));
    li.append(info,b);ul.appendChild(li);
  }
  const um=$('#mktMinhas');um.textContent='';
  const minhas=MK.livro?MK.livro.minhas.filter(o=>ITEMS[o.item]):[];
  if(!minhas.length){const li=document.createElement('li');li.className='vazio';
    li.textContent=MK.livro?'Nenhuma oferta sua no livro.':'O livro não foi lido.';um.appendChild(li)}
  for(const o of minhas){
    const li=document.createElement('li');li.className='sp';
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=`${o.lado==='compra'?'Compra':'Venda'}: ${nPecas(o.qtd,o.item)} a ${o.preco}`;
    const p=document.createElement('p');
    p.textContent=(o.resta<o.qtd?`${o.qtd-o.resta} já ${o.lado==='compra'?'compradas':'vendidas'}, faltam ${o.resta}. `:'')
      +(o.lado==='compra'?`${o.preco*o.resta} de ouro presos na oferta.`:`${o.resta} no livro, fora do cofre.`);
    info.append(h,p);
    const b=document.createElement('button');b.type='button';b.className='rm';b.textContent='cancelar';
    b.setAttribute('aria-label',`Cancelar a ${o.lado} de ${nPecas(o.qtd,o.item)} a ${o.preco}`);
    b.addEventListener('click',()=>cancelaOferta(o));
    li.append(info,b);um.appendChild(li);
  }
}
/* preço sugerido: o melhor do outro lado (aceitar é o caso comum), senão o
   que o Banco paga pela peça */
function abrePeca(k,lado){
  MK.peca=k;MK.lado=lado||(vendaveis(k)?'venda':'compra');
  const l=livroDe(k),o=MK.lado==='compra'?l.venda:l.compra;
  $('#mpPreco').value=o.length?o[0][0]:ITEMS[k].val;$('#mpQtd').value=1;
  msgMk('');desenhaFeira();
}
function lePreco(){return Math.round(+$('#mpPreco').value)}
function leQtd(){return Math.round(+$('#mpQtd').value)}
function desenhaPeca(){
  const k=MK.peca,it=ITEMS[k],l=livroDe(k),tem=save.itens[k]|0;
  const ic=$('#mpIco');ic.hidden=!icone(ic,'it_'+k);
  $('#mpNome').textContent=it.nome;
  const vd=vendaveis(k);
  $('#mpInfo').textContent=`${SLOT_NOME[it.slot]} · ${fmtBonus(it)} · ${tem} no cofre`+(vd<tem?` (${vd} com origem)`:'')+(l.ultimo?` · último negócio ${l.ultimo}`:'');
  for(const[id,lista,lado]of[['#mpVenda',l.venda,'compra'],['#mpCompra',l.compra,'venda']]){
    const ul=$(id);ul.textContent='';
    if(!lista.length){const li=document.createElement('li');li.className='nada';li.textContent='ninguém';ul.appendChild(li)}
    for(const[pr,q]of lista){
      const li=document.createElement('li'),b=document.createElement('button');b.type='button';
      const a=document.createElement('b');a.textContent=pr;const s=document.createElement('span');s.textContent=`× ${q}`;
      b.append(a,s);b.setAttribute('aria-label',`${lado==='compra'?'Comprar':'Vender'} a ${pr} de ouro (${q} no livro)`);
      b.addEventListener('click',()=>{MK.lado=lado;$('#mpPreco').value=pr;$('#mpQtd').value=Math.max(1,Math.min(q,lado==='venda'?tem||1:q));desenhaPeca()});
      li.appendChild(b);ul.appendChild(li);
    }
  }
  $('#mpLadoC').setAttribute('aria-pressed',String(MK.lado==='compra'));$('#mpLadoV').setAttribute('aria-pressed',String(MK.lado==='venda'));
  resumoPeca();
}
/* o que vai acontecer, em número, antes de tocar em Anunciar (pilar 1: o
   jogador sabe o preço antes de arriscar) */
function resumoPeca(){
  const k=MK.peca,pr=lePreco(),q=leQtd(),tem=save.itens[k]|0,vd=vendaveis(k),ou=ouroUtil(),l=livroDe(k);
  const valido=pr>=1&&pr<=1e6&&q>=1&&q<=100;let t,pode=valido&&!MK.ocupado;
  if(!valido)t='Preço de 1 a 1.000.000 e quantidade de 1 a 100.';
  else if(MK.lado==='compra'){const tot=pr*q;
    t=save.cofre<tot?`Faltam ${tot-save.cofre} de ouro no cofre para reservar ${tot}.`
      :ou<tot?`Só ${ou} de ouro têm origem registrada no banco; a reserva seria ${tot}.`
      :`Reserva ${tot} de ouro do cofre. Compra das vendas mais baratas, até ${pr} por peça, e a diferença volta.`+
       (l.venda.length&&l.venda[0][0]<=pr?'':' Ninguém vende por esse preço agora: a oferta fica no livro.');
    if(ou<tot)pode=false}
  else{const tot=pr*q,tx=taxaDe(tot);
    t=tem<q?`Você tem ${tem} no cofre.`
      :vd<q?`Só ${vd} ${vd===1?'tem':'têm'} origem registrada no banco. Peça de antes da conta ou de save editado não se negocia.`
      :`Se vender tudo a ${pr}, recebe ${tot-tx} de ouro (taxa de ${tx}). Se alguém já paga mais, você recebe o preço dele.`+
       (l.compra.length&&l.compra[0][0]>=pr?'':' Ninguém compra por esse preço agora: a oferta fica no livro.');
    if(vd<q)pode=false}
  $('#mpRes').textContent=t;
  const b=$('#mpOk');b.disabled=!pode;b.textContent=MK.lado==='compra'?'Anunciar compra':'Anunciar venda';
}
async function anuncia(){
  const k=MK.peca,lado=MK.lado,pr=lePreco(),q=leQtd();
  if(MK.ocupado)return;MK.ocupado=true;resumoPeca();msgMk('Anunciando…');
  try{
    const r=await mercado('mercado_anunciar',{p_lado:lado,p_item:k,p_preco:pr,p_qtd:q,p_caca:null,p_saco:null});
    const t=[fmtRecebido(r.recebido)];
    if(r.feitos)t.push(lado==='compra'?`Comprou ${nPecas(r.feitos,k)} por ${r.ouro} de ouro.`:`Vendeu ${nPecas(r.feitos,k)}: entraram ${r.ouro} de ouro no cofre (taxa de ${r.taxa}).`);
    if(r.resta)t.push(`${r.resta} ${r.resta>1?'ficaram':'ficou'} anunciada${r.resta>1?'s':''} no livro a ${pr}.`);
    await lerLivro().catch(()=>{});
    MK.peca=null;msgMk(t.filter(Boolean).join(' '));
  }catch(e){erroMk(e)}
  MK.ocupado=false;desenhaFeira();
}
async function cancelaOferta(o){
  if(MK.ocupado)return;MK.ocupado=true;msgMk('Cancelando…');
  try{
    const r=await mercado('mercado_cancelar',{p_id:o.id});
    await lerLivro().catch(()=>{});
    msgMk([fmtRecebido(r.recebido),o.lado==='compra'?`${o.preco*o.resta} de ouro voltaram ao cofre.`:`${nPecas(o.resta,o.item)} ${o.resta>1?'voltaram':'voltou'} ao cofre.`].filter(Boolean).join(' '));
  }catch(e){erroMk(e)}
  MK.ocupado=false;desenhaFeira();
}
const passo=(id,d,lo,hi)=>$(id+(d>0?'Mais':'Menos')).addEventListener('click',()=>{const el=$(id);el.value=clamp((Math.round(+el.value)||0)+d,lo,hi);resumoPeca()});
passo('#mpPreco',-1,1,1e6);passo('#mpPreco',1,1,1e6);passo('#mpQtd',-1,1,100);passo('#mpQtd',1,1,100);
for(const id of['#mpPreco','#mpQtd'])$(id).addEventListener('input',resumoPeca);
$('#mpLadoC').addEventListener('click',()=>abrePeca(MK.peca,'compra'));
$('#mpLadoV').addEventListener('click',()=>abrePeca(MK.peca,'venda'));
$('#mpOk').addEventListener('click',anuncia);
$('#mpVolta').addEventListener('click',()=>{MK.peca=null;msgMk('');desenhaFeira()});

for(const id of['#shopBack','#grimBack','#eqBack','#pickBack','#huntBack','#mktBack'])$(id).addEventListener('click',volta);
for(const id of['#shopBack','#grimBack','#eqBack','#pickBack','#huntBack'])$(id).addEventListener('click',volta);
$('#eqBoneco').addEventListener('click',()=>{eqDir=(eqDir+1)%4;desenhaBoneco()});
$('#toGrim').addEventListener('click',drawGrim);
$('#cGrim').addEventListener('click',drawGrim);
$('#toPick').addEventListener('click',showPick);
$('#cPick').addEventListener('click',showPick);
$('#cMenu').addEventListener('click',showMenu);
$('#play').addEventListener('click',()=>showCidade('chegada'));
$('#again').addEventListener('click',()=>start());
$('#toMenu').addEventListener('click',()=>showCidade('portao'));

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
