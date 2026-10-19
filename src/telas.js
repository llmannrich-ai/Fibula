/* ---------- telas ----------
   Acampamento, cidade, personagens, grimório, banco (equipamento), Guia de
   caça, tela final, Mercador, lojas de provisões, Feira (mercado entre
   jogadores) e Forja (o Gordon). */
import {clamp,fmtEl,sementeDe,novaSemente} from './sim/base.js?v=0.30.0';
import {CLASSES,CL_ORDEM,SPELLS,SLOT_LVL,EL_COR,listaDaClasse,precoHab,UP,ITEMS,fmtItem,SLOTS_EQ,SLOT_NOME,fmtBonus,CITY,HUNTS,FORJA,SUP,MT,PROG} from './sim/dados.js?v=0.30.0';
import {save,ch,KL,novoChar,xpNeed,manaPraMag,golpesPraPer,nSlots,upCost,sealPct,equipar,desequipar,vender,ehMat,guardaMochila,guardaUm,leva as levaDoCofre,levaComida,retira,cabe,ocupa,nEspacos,valMochila,perdaXp,pctPerdaXp,missao,reservado,podeEntregar,entregar,venderMat,comprarForja,podeComprar,compra,gastaProv,podeAprender,aprende} from './sim/progresso.js?v=0.30.0';
import {G,setG,newRun,nComida} from './sim/incursao.js?v=0.30.0';
import {C,entraCidade} from './sim/cidade.js?v=0.30.0';
import {persist,saveFalhou} from './salvar.js?v=0.30.0';
import {desenhaConta,temConta,mercado,cacaComeca,lastroBanco} from './nuvem.js?v=0.30.0';
import {rede,SALAS} from './rede.js?v=0.30.0';
import {SALA,MAX,criaSala,entraSala,saiDaSala,entraPorta,dentro} from './sala.js?v=0.30.0';
import {logEl,log,banner,montaBotoes,setT,zeraCidade,vestido,fechaMochila} from './hud.js?v=0.30.0';
import {icone} from './arte.js?v=0.30.0';
import {$,app} from './dom.js?v=0.30.0';
import {retrato} from './desenho.js?v=0.30.0';

export const menu=$('#menu'),endS=$('#end'),shopS=$('#shop'),pickS=$('#pick'),grimS=$('#grim'),equipS=$('#equip'),huntS=$('#hunts'),mktS=$('#mkt'),forjaS=$('#forja'),lojaS=$('#loja');
const TELAS=[menu,endS,shopS,pickS,grimS,equipS,huntS,mktS,forjaS,lojaS];
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
const risco=()=>{const pd=perdaXp(),v=valMochila(ch().mochila),sela=Math.round(v*sealPct());
  return (v?`A mochila vai junto, com ${v} de ouro em loot: morrer perde ${v-sela}`+(sela?` (o selo guarda ${sela})`:'')+'. Guarde no Banco o que não quer arriscar. ':'A mochila está vazia. ')+
    `Morrer também custa ${pctPerdaXp()}% da experiência do nível atual, nunca o nível. Hoje: ${pd?pd+' xp':'nada, o nível está vazio'}.`};
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
  /* a masmorra da sala roda no aparelho do anfitrião enquanto a sala existir */
  if(!G||(G.active&&!(G.sala&&SALA.papel==='anfitriao'))){newRun()}
}
/* ?semente=12345 (ou um texto qualquer) no endereço fixa a masmorra de toda
   incursão desta aba: para reproduzir um problema pelo número que a tela final
   mostra, ou para jogar o mesmo mapa que outra pessoa */
const SEM_URL=(()=>{try{const v=new URLSearchParams(location.search).get('semente');return v?sementeDe(v):undefined}catch(e){return undefined}})();
const nMasmorra=s=>'nº '+s.toLocaleString('pt-BR');
/* a versão vem do endereço deste módulo (?v=, posto por tools/versao.mjs) */
const VERSAO=(()=>{try{return new URL(import.meta.url).searchParams.get('v')||'dev'}catch(e){return 'dev'}})();
/* caca é o mapa de caça (hunts no content.json). prepara monta a incursão
   (a da sala, src/sala.js); sem ele, a solo com relógio no mapa caca, que o
   jogador não alcança mais (toda caçada é numa sala) e fica para os testes */
export function start(prepara,caca){
  V.cidade=false;
  if(prepara)prepara();else newRun(SEM_URL,undefined,false,caca);
  /* as provisões que este jogador levou saem do estoque agora */
  const levou=G.p&&G.p.prov&&Object.keys(G.p.prov).length?listaProv(G.p.prov):'';
  if(levou)gastaProv(G.p.prov);
  G.active=true;save.runs++;persist();montaBotoes();cacaComeca();
  for(const t of TELAS)t.hidden=true;app.classList.remove('cidade');app.classList.add('playing');logEl.textContent='';fechaMochila();
  const H=HUNTS[G.caca];
  log(G.aberta?`${H.entrada||`Você entrou em ${H.nome}.`} Não há tempo: volte à porta, na sala de entrada, para sair com a mochila.`:`${H.entrada||'Você entrou na masmorra.'} O portal abre em 1:30.`,'info');
  if(levou)log(`Você levou ${levou}.`,'info');
  log(nComida(G.p.bag)?'Você está com fome: toque em Comer para regenerar vida e mana.':'Não há comida na mochila: sem comer, não se regenera vida nem mana.','warn');
  if(SEM_URL!==undefined)log(`Masmorra ${nMasmorra(G.semente)}, escolhida pelo endereço.`,'info');
}

/* ---------- cidade ----------
   O mapa e quem está perto são da simulação (src/sim/cidade.js); aqui ficam
   o que cada NPC abre e a chegada. como: 'chegada' (vindo do acampamento, no
   @ do mapa), 'portao' (de volta de uma incursão, na frente do NPC que leva
   ao mapa de caça de onde se volta) ou nada
   (voltando de uma tela aberta na cidade, no mesmo lugar). */
export function showCidade(como){
  if(!save.classe)return showPick();
  if(como||!C)entraCidade(como==='portao'&&(G&&HUNTS[G.caca]?HUNTS[G.caca].npc:true));
  V.cidade=true;soTela(null);app.classList.add('cidade');zeraCidade();
  if(como){logEl.textContent='';banner(CITY.nome);log(como==='portao'?(G&&HUNTS[G.caca]&&HUNTS[G.caca].volta||'Você voltou à cidade pelo portão.'):`Você está na ${CITY.nome.toLowerCase()}. Para caçar, fale com o Guia no portão sul.`,'info')}
}
export function abreNpc(k){
  const a=CITY.npcs[k].abre;
  if(a==='mercador')showShop();else if(a==='banco'){msgEq('');drawEquip()}else if(a==='mercado')showFeira();else if(a==='forja')showForja();else if(a==='loja')showLoja(k);else showHunts(k);
}
/* ---------- lojas de provisões ----------
   Uma tela para todas: o NPC diz o que vende (vende, no content.json). A
   provisão fica guardada e vai inteira na próxima caçada; a comida que
   comida é item: vai para a mochila na hora */
const listaProv=o=>Object.entries(o).map(([k,q])=>q>1?`${q} × ${SUP[k].nome}`:SUP[k].nome).join(', ');
const leva=()=>Object.keys(save.prov).length?`Na próxima caçada você leva: ${listaProv(save.prov)}. Vai tudo.`:'Nada guardado para a próxima caçada.';
let lojaDe=null;
function drawLoja(){
  const n=CITY.npcs[lojaDe];
  setT($('#ljCasa'),n.casa);setT($('#ljNome'),n.nome);setT($('#ljGold'),String(save.cofre));
  const comida=n.vende.some(k=>SUP[k].efeito.item);
  setT($('#ljFala'),n.fala+(n.ensina?' Habilidade aprendida é para sempre; provisão vale para uma caçada só.':comida?' A comida vai para a sua mochila: na caçada, sem comer não se regenera vida nem mana.':' Provisão vale para uma caçada só.'));setT($('#ljLeva'),leva());
  for(const id of['#ljHabT','#ljHab','#ljProvT'])$(id).hidden=!n.ensina;
  if(n.ensina)drawEnsina();
  const ul=$('#ljList');ul.textContent='';
  for(const k of n.vende){
    const s=SUP[k],it=s.efeito.item,por=podeComprar(k),tem=it?ch().mochila[it]|0:save.prov[k]||0;
    const li=document.createElement('li');li.className='up';
    const ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');
    if(icone(ic,'sup_'+k,0,0,32))li.appendChild(ic);
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=s.nome;
    const d=document.createElement('p');d.textContent=s.desc;
    const m=document.createElement('p');m.className='meta';
    m.textContent=it?(por==='cheia'?'A mochila está cheia.':tem?`Na mochila: ${tem}`:''):por&&por!=='ouro'&&por!=='max'?`Você já leva ${SUP[por].nome}: uma por caçada.`:s.max>1?`Guardadas: ${tem} de ${s.max}`:tem?'Guardada para a próxima caçada.':'';
    info.append(h,d);if(m.textContent)info.appendChild(m);
    const b=document.createElement('button');b.type='button';
    const cheio=por==='max'||por==='cheia';b.className=cheio?'buy max':'buy';
    b.textContent=por==='cheia'?'sem espaço':cheio?(s.max>1?'cheio':'guardada'):s.preco+' ouro';b.disabled=!!por;
    b.setAttribute('aria-label',por==='cheia'?`${s.nome}: não cabe na mochila`:cheio?`${s.nome}: já guardou o máximo para a próxima caçada`:`Comprar ${s.nome} por ${s.preco} de ouro`);
    b.addEventListener('click',()=>{if(compra(k)){persist();drawLoja()}});
    li.append(info,b);ul.appendChild(li);
  }
}
/* o que o Mestre de magias ensina: as habilidades da classe do personagem,
   pela ordem de nível; aprendida é para sempre e vai para um espaço livre */
function drawEnsina(){
  const ul=$('#ljHab'),c=ch();ul.textContent='';
  for(const k of listaDaClasse(save.classe)){
    const s=SPELLS[k],por=podeAprender(k),pr=precoHab(k);
    const li=document.createElement('li');li.className='up';
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=s.n;
    const d=document.createElement('p');d.textContent=s.d;
    const m=document.createElement('p');m.className='meta';
    m.textContent=por==='sabe'?'Aprendida. Equipe no Grimório.':`nível ${s.lvl}`+(por==='nivel'?` · você está no ${c.lvl}`:'');
    info.append(h,d,m);
    const b=document.createElement('button');b.type='button';b.disabled=!!por;
    b.className=por==='sabe'?'buy max':'buy';
    b.textContent=por==='sabe'?'sabe':por==='nivel'?'nível '+s.lvl:pr+' ouro';
    b.setAttribute('aria-label',por==='sabe'?`${s.n}: já aprendida`:por==='nivel'?`${s.n}: pede o nível ${s.lvl}`:`Aprender ${s.n} por ${pr} de ouro`);
    b.addEventListener('click',()=>{if(aprende(k)){persist();log(`Você aprendeu ${s.n}.`,'epic');drawLoja()}});
    li.append(info,b);ul.appendChild(li);
  }
}
function showLoja(k){lojaDe=k;drawLoja();soTela(lojaS)}
/* a porta da sala: o anfitrião entra na masmorra que o aparelho dele já roda;
   o convidado pede, e a incursão começa quando a resposta chega (src/main.js) */
const semPorta=()=>SALA.papel==='convidado'&&(SALA.estado!=='ligado'||!SALA.membros.length);
const pelaPorta=()=>{if(SALA.papel==='anfitriao'){start(()=>{entraPorta()})}else if(entraPorta())showHunts()};
const botao=(txt,rot,fn,off)=>{const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=txt;b.setAttribute('aria-label',rot);b.disabled=!!off;b.addEventListener('click',fn);return b};
/* ---------- sala no Guia de caça ----------
   Ver as salas abertas de quem está na cidade e entrar, ou, dentro de uma,
   quem está nela. Cada NPC que abre cacadas (o Guia, a Grade do esgoto, o
   Capitão) mostra só as salas dos mapas de caça dele; criar sala é na linha
   do mapa. A sala fica aberta até o anfitrião fechar ou sair */
let huntDe=null;
const nomeCaca=k=>HUNTS[k]?HUNTS[k].nome:'';
const meus=()=>Object.keys(HUNTS).filter(k=>!huntDe||HUNTS[k].npc===huntDe);
function desenhaSala(){
  const box=$('#hSala');box.textContent='';
  const h=document.createElement('h3'),p=document.createElement('p'),ul=document.createElement('ul'),ac=document.createElement('div');ac.className='acoes';
  const nomes=()=>SALA.membros.map(m=>`${m.nome} (${CLASSES[m.cl]?CLASSES[m.cl].nome:m.cl}, nv ${m.lvl})${dentro(m.id)?' lá dentro':''}`).join(', ');
  /* a porta da sala fica com o NPC que leva ao mapa dela */
  const aqui=!SALA.caca||meus().includes(SALA.caca),npc=SALA.caca&&HUNTS[SALA.caca]?CITY.npcs[HUNTS[SALA.caca].npc]:null;
  const longe=aqui?'':` A porta fica com ${npc?npc.nome:'quem leva até lá'} (${npc?npc.casa:''}).`;
  /* o anfitrião roda a masmorra no próprio aparelho: entra mesmo sem o canal;
     o convidado depende dele para pedir a porta */
  const porta=()=>botao('Entrar pela porta',`Entrar em ${nomeCaca(SALA.caca)} pela porta da sala`,pelaPorta,!aqui||semPorta());
  const rede_=SALA.estado==='ligado'?'':SALA.estado==='sem rede'?' Sem conexão com a sala agora: tentando de novo.':' Conectando à sala…';
  if(SALA.papel==='anfitriao'){
    const n=SALA.membros.filter(m=>m.id!==SALA.id&&dentro(m.id)).length;
    h.textContent=`Sua sala · ${nomeCaca(SALA.caca)} · ${SALA.membros.length}/${MAX}`;
    p.textContent=`Na sala: ${nomes()}. Não há tempo: cada um entra e sai pela porta, na sala de entrada, quando quiser.`+longe+(n?` Fechar a sala tira quem está lá dentro, sem resultado.`:'')+(rede_?rede_+' Você já pode entrar; os outros só a veem quando ligar.':'');
    ac.append(porta(),botao('Fechar sala','Fechar a sala e a caçada dela',()=>{saiDaSala();showHunts()}));
  }else if(SALA.papel==='convidado'){
    const a=SALA.membros[0];
    h.textContent=a?`Sala de ${a.nome} · ${nomeCaca(SALA.caca)} · ${SALA.membros.length}/${MAX}`:'Entrando na sala…';
    p.textContent=(a?`Na sala: ${nomes()}. Não há tempo: entre e saia pela porta quando quiser.`+longe:'Esperando o anfitrião responder.')+rede_;
    ac.append(porta(),botao('Sair da sala','Sair da sala',()=>{saiDaSala();showHunts()}));
  }else{
    h.textContent='Caçar em grupo';
    const salas=[...SALAS.values()].filter(x=>meus().includes(x.h));
    /* toda caçada é numa sala (decisão do Leonardo em 19/10/2026): sozinho é
       uma sala de um. Criar não depende da rede, porque a masmorra roda aqui */
    if(rede.estado!=='ligado'){p.textContent=rede.estado==='sem rede'?'Sem conexão com a cidade agora: sua sala abre assim mesmo, mas ninguém a vê até a conexão voltar.':'Conectando à cidade…'}
    else{
      p.textContent=salas.length?'Salas abertas de quem está na cidade:':'Nenhuma sala aberta para estes lugares. Crie a sua no lugar escolhido e chame quem está na cidade.';
      for(const x of salas){
        const li=document.createElement('li'),t=document.createElement('span');
        t.textContent=`Sala de ${x.nome} (${CLASSES[x.classe]?CLASSES[x.classe].nome:''}) · ${nomeCaca(x.h)} · ${x.n}/${MAX}`;
        li.append(t,botao('entrar',`Entrar na sala de ${x.nome}, em ${nomeCaca(x.h)}`,()=>{entraSala(x.id,x.h);showHunts()},x.n>=MAX));ul.appendChild(li);
      }
    }
  }
  box.append(h,p);if(ul.children.length)box.appendChild(ul);if(ac.children.length)box.appendChild(ac);
}
SALA.aoMudar=rede.aoMudar=()=>{if(!huntS.hidden)showHunts()};
/* k é o NPC que abriu a tela; sem ele, o mesmo de antes */
function showHunts(k){
  if(k)huntDe=k;
  const n=CITY.npcs[huntDe];
  if(n){setT($('#hunts .eyebrow'),n.casa);setT($('#hunts h2'),n.nome)}
  const ul=$('#huntList'),c=ch();ul.textContent='';
  $('#hRisco').textContent=risco();$('#hProv').textContent=leva();desenhaSala();
  for(const k of meus()){
    const h=HUNTS[k],li=document.createElement('li');li.className='sp';
    const info=document.createElement('div');info.className='info';
    const t=document.createElement('h3');t.textContent=h.nome;
    const p=document.createElement('p');p.textContent=h.desc||'';
    const meta=document.createElement('div');meta.className='meta'+(c.lvl<h.nivel?' alto':'');
    /* pilar 2: o jogador sabe o que mora lá antes de entrar */
    const mons=[...new Set([...(h.bands||PROG.bands).flatMap(b=>Object.keys(b.weights)),(h.boss||PROG.boss).type])].map(m=>MT[m].nome);
    meta.textContent=`nível recomendado ${h.nivel}`+(c.lvl<h.nivel?' · acima do seu':'')+(mons.length?` · ${mons.join(', ')}`:'');
    info.append(t,p,meta);
    const bts=document.createElement('div');bts.className='bts';
    /* só se caça numa sala: fora de uma, o lugar abre uma sala sua e já entra
       pela porta (os outros podem entrar depois); dentro, é a porta dela */
    const b=document.createElement('button');b.type='button';
    if(!SALA.papel){b.textContent='criar sala';b.setAttribute('aria-label',`Criar uma sala em ${h.nome} e entrar`);b.addEventListener('click',()=>{criaSala(k);pelaPorta()})}
    else if(SALA.caca===k){b.textContent='pela porta';b.disabled=semPorta();b.setAttribute('aria-label',`Entrar em ${h.nome} pela porta da sala`);b.addEventListener('click',pelaPorta)}
    else{b.textContent='outra sala';b.disabled=true;b.setAttribute('aria-label',`Você está numa sala de outro lugar: saia dela para caçar em ${h.nome}`)}
    bts.append(b);li.append(info,bts);ul.appendChild(li);
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
  /* trocar de personagem tira da sala: a ficha que está lá é a do outro */
  if(SALA.papel)saiDaSala();
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
    const s=SPELLS[k],liberada=c.lvl>=s.lvl&&c.sabe.includes(k),eq=c.slots.indexOf(k);
    const li=document.createElement('li');
    li.className='sp'+(eq>=0&&eq<nSlots()?' eq':'')+(liberada?'':' locked');
    li.style.borderLeftColor=s.t==='cura'?'#8ad872':s.t==='buff'?'#f2a33a':EL_COR[s.el];
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=s.n;
    if(s.w){const w=document.createElement('span');w.className='w';w.textContent=' “'+s.w+'”';h.appendChild(w)}
    const p=document.createElement('p');p.textContent=s.d;
    const meta=document.createElement('div');meta.className='meta';
    const esc=s.esc==='per'?'Perícia':s.esc==='mag'?'Magia':null;
    meta.textContent=[`nível ${s.lvl}`,!c.sabe.includes(k)&&precoHab(k)&&`${precoHab(k)} ouro no Mestre de magias`,s.mana?`${s.mana} mana`:'sem mana',`${s.cd}s`,esc&&`escala em ${esc}`].filter(Boolean).join(' · ');
    info.append(h,p,meta);
    const b=document.createElement('button');b.type='button';
    if(!liberada){b.disabled=true;b.textContent=c.lvl>=s.lvl?'no Mestre':'nível '+s.lvl}
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
   O Banco: a mochila (guardar no cofre), o ouro do cofre (levar na mochila),
   os três espaços do personagem e as peças do cofre (vestir, vender, levar).
   Uma tela, botões grandes: nada de arrastar (pilar 3). O cofre é da conta;
   a mochila e os espaços são do personagem atual. */
const icoItem=k=>{const ic=document.createElement('span');ic.className='ico';ic.setAttribute('aria-hidden','true');return icone(ic,'it_'+k)?ic:null};
/* o boneco vestido, como fica no mapa; tocar gira (sul, oeste, norte, leste) */
let eqDir=2;
export const desenhaBoneco=()=>{const b=$('#eqBoneco');b.hidden=!retrato(b.firstElementChild,save.classe,ch().equip,eqDir,4)};
/* o que guardar faz com cada coisa da mochila, para a mensagem do Banco */
function guardou(r){const t=[];if(!r)return '';
  if(r.ouro)t.push(`${r.ouro} de ouro`);if(r.pecas)t.push(`${r.pecas} peça${r.pecas>1?'s':''} de equipamento`);
  if(r.comida)t.push(`${r.comida} comida${r.comida>1?'s':''}`);
  return (t.length?`Foram para o cofre: ${t.join(' e ')}.`:'')+(r.mats?` ${r.mats} ${r.mats>1?'materiais foram':'material foi'} para o depósito do Gordon, na Forja.`:'')}
const msgEq=t=>{$('#eqMsg').textContent=t};
function drawEquip(){
  const c=ch(),K=KL(),e=c.equip,mo=c.mochila,val=valMochila(mo),n=ocupa(mo);
  $('#eqEye').textContent=`${K.nome} · Nível ${c.lvl}`;
  desenhaBoneco();
  setT($('#eqGold'),String(save.cofre));
  /* a mochila: tudo de uma vez ou uma coisa por vez para o cofre */
  setT($('#eqMoVal'),`${val} ouro · ${n}/${nEspacos()}`);
  const sela=Math.round(val*sealPct());
  setT($('#eqMoRisco'),val?`Se morrer na próxima caçada com ela assim, perde ${val-sela} de ouro em loot`+(sela?` (o selo guarda ${sela}).`:'.'):'Vazia: nada em risco na próxima caçada.');
  $('#eqGuarda').disabled=!n;
  const um=$('#eqMo');um.textContent='';
  const mrows=Object.entries(mo).sort((a,b)=>ITEMS[b[0]].val*b[1]-ITEMS[a[0]].val*a[1]);
  if(!mrows.length){const li=document.createElement('li');li.className='vazio';li.textContent='A mochila está vazia.';um.appendChild(li)}
  for(const[k,q]of mrows){
    const it=ITEMS[k],li=document.createElement('li');li.className='sp r'+it.rar;
    const ic=icoItem(k);if(ic)li.appendChild(ic);
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=fmtItem([k,q]);
    const p=document.createElement('p');p.textContent=it.slot?`${SLOT_NOME[it.slot]} · ${fmtBonus(it)}`:it.comida?`comida: ${fmtEl(it.comida)} de alimentação cada`:ehMat(k)?'material: vai para o depósito do Gordon':k==='ouro'?'vai para o cofre':`vira ${it.val*q} de ouro no cofre`;
    info.append(h,p);
    const b=document.createElement('button');b.type='button';b.textContent='guardar';
    b.setAttribute('aria-label',it.slot?`Guardar ${it.nome} no cofre`:`Guardar ${fmtItem([k,q])} no cofre`);
    b.addEventListener('click',()=>{const r=guardaUm(k);if(r){persist();drawEquip();msgEq(guardou(r))}});
    li.append(info,b);um.appendChild(li);
  }
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
    li.textContent='O cofre não tem peças. Armas, armaduras e amuletos que você guardar aparecem aqui.';ul.appendChild(li)}
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
    /* levar: a peça volta para a mochila, e com ela para o risco */
    const b3=document.createElement('button');b3.type='button';b3.className='rm';b3.textContent='levar';
    b3.setAttribute('aria-label',`Pôr ${it.nome} na mochila`);
    if(!cabe(mo,k))b3.disabled=true;
    else b3.addEventListener('click',()=>{if(levaDoCofre(k)){persist();drawEquip();msgEq(`${it.nome} está na mochila: cai se você morrer.`)}});
    bt.append(b1,b2,b3);li.append(info,bt);ul.appendChild(li);
  }
  /* o cofre de comida: levar põe o tipo inteiro na mochila (empilha numa casa) */
  const uc=$('#eqCom');uc.textContent='';
  const crows=Object.entries(save.comida).sort((a,b)=>ITEMS[b[0]].comida-ITEMS[a[0]].comida);
  if(!crows.length){const li=document.createElement('li');li.className='vazio';
    li.textContent='Sem comida guardada. A comida que você guardar, comprada ou caída de monstro, aparece aqui.';uc.appendChild(li)}
  for(const[k,q]of crows){
    const it=ITEMS[k],li=document.createElement('li');li.className='sp r0';
    const ic=icoItem(k);if(ic)li.appendChild(ic);
    const info=document.createElement('div');info.className='info';
    const h=document.createElement('h3');h.textContent=fmtItem([k,q]);
    const p=document.createElement('p');p.textContent=`${fmtEl(it.comida)} de alimentação cada`;
    info.append(h,p);
    const b=document.createElement('button');b.type='button';b.textContent='levar';
    b.setAttribute('aria-label',`Pôr ${fmtItem([k,q])} na mochila`);
    if(!cabe(mo,k))b.disabled=true;
    else b.addEventListener('click',()=>{if(levaComida(k)){persist();drawEquip();msgEq(`${fmtItem([k,q])} na mochila: cai se você morrer.`)}});
    li.append(info,b);uc.appendChild(li);
  }
  soTela(equipS);
}

export function showEnd(){
  /* o resultado é do jogador deste aparelho, não da sala */
  const p=G.p,k=p.fora||G.end,ok=k==='extraiu';
  $('#endEye').textContent=ok?'Incursão concluída':'Fim da incursão';
  const t=$('#endTitle');t.textContent=ok?'Extraído!':k==='morreu'?'Você morreu':'Soterrado';t.classList.toggle('lost',!ok);
  const ganho=p.bagVal-valMochila(p.bag0||{});
  $('#endText').textContent=ok?`Você saiu com a mochila valendo ${p.bagVal} de ouro em loot`+(ganho>0&&ganho<p.bagVal?`, ${ganho} desta caçada`:'')+
      '. Ela continua com você e cai se você morrer: guarde no Banco o que não quer arriscar na próxima caçada.'
    :k==='morreu'?`A mochila ficou na masmorra com tudo o que estava dentro, e a morte levou ${pctPerdaXp()}% da experiência do nível.`
    :`A masmorra desabou antes de você chegar ao portal. A mochila ficou para trás, e você perdeu ${pctPerdaXp()}% da experiência do nível.`;
  const l=$('#eLoot');l.textContent=`${p.bagVal} ouro · ${ok?'na mochila':'perdido'}`;l.className=ok?'ok':'bad';
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
  if(!rows.length){const li=document.createElement('li');li.textContent='A mochila estava vazia.';ul.appendChild(li)}
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

/* ---------- forja (Gordon) ----------
   A encomenda da vez, a loja que as encomendas liberam e o depósito de
   materiais. A regra (preços, o que se entrega, o que está liberado) é de
   src/sim/progresso.js e do content.json. */
const fgLi=(k,cls)=>{const li=document.createElement('li');li.className='sp'+(cls?' '+cls:'');const ic=k&&icoItem(k);if(ic)li.appendChild(ic);return li};
const fgInfo=(t,p,m,mcls)=>{const d=document.createElement('div');d.className='info';
  const h=document.createElement('h3');h.textContent=t;d.appendChild(h);
  if(p){const e=document.createElement('p');e.textContent=p;d.appendChild(e)}
  if(m){const e=document.createElement('div');e.className='meta'+(mcls?' '+mcls:'');e.textContent=m;d.appendChild(e)}
  return d};
const fgBt=(t,rot,fn,off)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.setAttribute('aria-label',rot);b.disabled=!!off;if(!off)b.addEventListener('click',fn);return b};
const fgVazio=(ul,t)=>{const li=document.createElement('li');li.className='vazio';li.textContent=t;ul.appendChild(li)};
function msgFg(t){$('#fgMsg').textContent=t}
function drawForja(){
  setT($('#fgGold'),String(save.cofre));
  const um=$('#fgMissao'),m=missao();um.textContent='';
  if(!m)fgVazio(um,'Gordon não tem mais encomendas. Tudo o que ele sabe forjar está à venda.');
  else{const li=fgLi(null);
    const falta=Object.entries(m.pede).map(([k,q])=>`${ITEMS[k].nome} ${Math.min(save.mats[k]|0,q)}/${q}`).join(' · ');
    li.append(fgInfo(`${save.forja+1}/${FORJA.missoes.length} · ${m.nome}`,m.fala,falta,podeEntregar()?'ok':''));
    const lib=FORJA.loja.filter(o=>o.missao===save.forja+1).map(o=>ITEMS[o.item].nome).join(' e ');
    li.appendChild(fgBt('entregar',`Entregar a encomenda ${m.nome}`+(lib?` e liberar ${lib}`:''),()=>{
      if(entregar()){persist();drawForja();msgFg(lib?`Gordon pegou os materiais. Na loja agora: ${lib}.`:'Gordon pegou os materiais.')}},!podeEntregar()));
    um.appendChild(li)}
  const ul=$('#fgLoja');ul.textContent='';
  for(const o of FORJA.loja){const it=ITEMS[o.item],livre=o.missao<=save.forja;
    const li=fgLi(o.item,'r'+it.rar+(livre?'':' locked'));
    li.append(fgInfo(it.nome,`${SLOT_NOME[it.slot]} · ${fmtBonus(it)}`,livre?'':`depois da encomenda ${o.missao}`));
    li.appendChild(fgBt(`${o.preco} ouro`,livre?`Comprar ${it.nome} por ${o.preco} de ouro`:`${it.nome}: liberada depois da encomenda ${o.missao}`,()=>{
      if(comprarForja(o.item)){persist();drawForja();msgFg(`${it.nome} foi para o cofre. Vista no Banco.`)}},!livre||save.cofre<o.preco));
    ul.appendChild(li)}
  const ml=$('#fgMats');ml.textContent='';
  const rows=Object.keys(FORJA.compra).filter(k=>save.mats[k]>0);
  if(!rows.length)fgVazio(ml,'Nada guardado. Dente, seda, osso e erva que você extrair vêm para cá.');
  for(const k of rows){const q=save.mats[k],pr=FORJA.compra[k],res=Math.min(q,reservado(k));
    const li=fgLi(k);
    li.append(fgInfo(`${ITEMS[k].nome} ×${q}`,`Gordon paga ${pr} de ouro cada`,res?`${res} para a encomenda`:''));
    li.appendChild(fgBt(`vender 1 · ${pr}`,`Vender 1 ${ITEMS[k].nome} por ${pr} de ouro`,()=>{
      const o=venderMat(k,1);if(o){persist();drawForja();msgFg(`Gordon pagou ${o} de ouro.`)}}));
    ml.appendChild(li)}
}
function showForja(){msgFg('');drawForja();soTela(forjaS)}

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
  caca_cedo:'A caçada acabou de começar. Espere alguns segundos para vender da mochila.',
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

for(const id of['#shopBack','#grimBack','#eqBack','#pickBack','#huntBack','#mktBack','#fgBack','#ljBack'])$(id).addEventListener('click',volta);
/* Banco: guardar a mochila inteira e tirar ouro do cofre para ela */
$('#eqGuarda').addEventListener('click',()=>{if(!ocupa(ch().mochila))return;const r=guardaMochila();persist();drawEquip();msgEq(guardou(r))});
for(const[id,d]of[['#eqMenos',-50],['#eqMais',50]])$(id).addEventListener('click',()=>{const el=$('#eqQtd');el.value=clamp((Math.round(+el.value)||0)+d,1,Math.max(1,save.cofre))});
$('#eqRetira').addEventListener('click',()=>{const q=Math.round(+$('#eqQtd').value);
  if(!(q>=1))return msgEq('Diga quanto ouro levar.');if(q>save.cofre)return msgEq(`O cofre tem ${save.cofre} de ouro.`);
  if(!retira(q))return msgEq('A mochila está cheia.');persist();drawEquip();msgEq(`${q} de ouro na mochila: cai se você morrer.`)});
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
