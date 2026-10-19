/* ---------- personagem e progressão ----------
   O save em memória e tudo o que deriva dele. Onde o save é gravado
   (localStorage, nuvem) é do cliente, em src/salvar.js e src/nuvem.js; aqui
   ele só é lido e alterado, e quem altera chama saida.persist() depois. */
import {CLASSES,SPELLS,SLOT_LVL,UP,ITEMS,PROG,SLOTS_EQ,FORJA,SUP,BUFFS,listaDaClasse,slotsIniciais,precoHab} from './dados.js?v=0.27.0';

export const UP0={vigor:0,foco:0,poder:0,bolsa:0,seguro:0};
const EQ0=()=>({arma:null,armadura:null,amuleto:null});
/* sabe: as habilidades que o personagem aprendeu (no nível certo e, se têm
   preço, pagas ao Mestre de magias). Personagem de antes disso (sem sabe) fica
   com tudo que o nível dele já liberava: ninguém perde o que usava */
const daClasse=(cl,lvl)=>listaDaClasse(cl).filter(k=>SPELLS[k].lvl<=lvl);
const confereSabe=(sabe,cl,lvl)=>Array.isArray(sabe)?daClasse(cl,lvl).filter(k=>sabe.includes(k)):daClasse(cl,lvl);
/* a ficha que um convidado manda ao anfitrião da sala é dado de fora: só
   passa classe que existe, números inteiros no intervalo, habilidades da
   classe aprendidas e já liberadas no nível e equipamento do espaço certo.
   Devolve a ficha limpa ou null */
export function confereFicha(f){
  if(!f||typeof f!=='object'||!CLASSES[f.cl]||!f.c||typeof f.c!=='object')return null;
  const n=(v,a,b)=>Number.isFinite(v)?Math.max(a,Math.min(b,Math.floor(v))):a,c=f.c,lvl=n(c.lvl,1,200);
  const sabe=confereSabe(c.sabe,f.cl,lvl),slots=[0,1,2,3].map(i=>{const k=Array.isArray(c.slots)&&c.slots[i];return sabe.includes(k)?k:null});
  const equip=EQ0();for(const sl of SLOTS_EQ){const k=c.equip&&c.equip[sl];if(ITEMS[k]&&ITEMS[k].slot===sl)equip[sl]=k}
  const up={};for(const k in UP0)up[k]=n(f.up&&f.up[k],0,UP[k]?UP[k].max:0);
  return{cl:f.cl,nome:String(f.nome||CLASSES[f.cl].nome).replace(/[\u0000-\u001f]/g,'').slice(0,20),
    c:{lvl,xp:n(c.xp,0,1e9),mag:n(c.mag,0,200),manaG:n(c.manaG,0,1e9),per:n(c.per,10,200),golpes:n(c.golpes,0,1e9),slots,sabe,equip,mochila:soMochila(c.mochila)},up,prov:soProv(f.prov)};
}
export const novoChar=(c,lvl=1)=>({lvl,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:slotsIniciais(c,lvl),sabe:daClasse(c,lvl),equip:EQ0(),mochila:{}});
/* cofre (ouro), itens (equipamento guardado), prov (provisões para a próxima
   caçada), mats (materiais para o Gordon) e forja (encomendas entregues) são
   da conta; equip e mochila são de cada personagem */
/* chao: as peças do chão da cidade (city.chao) que esta conta já pegou, por id */
export const SAVE0=()=>({cofre:0,itens:{},prov:{},mats:{},forja:0,runs:0,ext:0,deaths:0,best:0,up:Object.assign({},UP0),classe:null,chars:{},chao:{}});
/* só as peças que existem no content.json, com quantidade inteira positiva:
   vale para o save cru e para o cofre que o mercado da nuvem devolve */
export const soPecas=o=>{const r={};for(const[k,q]of Object.entries(o||{}))if(ITEMS[k]&&ITEMS[k].slot&&q>0)r[k]=q|0;return r};
/* lê um save cru (do localStorage ou da nuvem) por cima dos padrões */
export const normaliza=s=>{const n=Object.assign(SAVE0(),s);n.up=Object.assign({},UP0,s.up||{});n.chars=s.chars||{};
  /* save apontando para um personagem que não existe deixava a tela em branco */
  if(n.classe&&!CLASSES[n.classe])n.classe=null;
  if(n.classe&&!n.chars[n.classe])n.chars[n.classe]=novoChar(n.classe);
  /* saves de antes do equipamento não têm itens nem equip; item que saiu do
     content.json some em vez de quebrar a tela */
  n.itens=soPecas(s.itens);n.prov=soProv(s.prov);n.mats=soMats(s.mats);
  n.forja=Math.max(0,Math.min(FORJA.missoes.length,s.forja|0));
  n.chao=s.chao&&typeof s.chao==='object'&&!Array.isArray(s.chao)?s.chao:{};
  for(const[cl,c]of Object.entries(n.chars)){const e=EQ0();
    for(const sl of SLOTS_EQ){const id=c.equip&&c.equip[sl];if(id&&ITEMS[id]&&ITEMS[id].slot===sl)e[sl]=id}
    c.equip=e;c.sabe=confereSabe(c.sabe,cl,c.lvl|0);c.mochila=soMochila(c.mochila)}
  return n};
export let save=SAVE0();
export const setSave=s=>{save=s};
export const ch=()=>save.chars[save.classe];
export const KL=()=>CLASSES[save.classe];

/* curva e perda na morte vêm de progression.xp no content.json */
/* duração de um passo, em segundos, para uma velocidade em unidades do Tibia:
   a fórmula do Forgotten Server (Creature::getStepDuration), com o chão de
   progression.walk.ground e arredondada para cima em múltiplos de stepMs */
export function passoDaVel(vel){
  const w=PROG.walk,c=Math.max(1,Math.floor(857.36*Math.log(Math.max(1,vel)/2+261.29)-4795.01+.5));
  return Math.max(w.stepMs,Math.ceil(Math.floor(1000*w.ground/c)/w.stepMs)*w.stepMs)/1000;
}
/* o passo do personagem: velocidade 220 + 2 por nível, como no Tibia, até
   speedMax; velo é o buff de velocidade (0 sem buff) */
export const durPasso=(c,velo=0)=>{const w=PROG.walk;return passoDaVel(Math.min(w.speedMax,w.speedBase+w.speedPerLevel*(c.lvl-1))*(1+velo))};
export const xpNeed=l=>Math.round(PROG.xp.base*Math.pow(l,PROG.xp.exp));
/* a morte leva uma fatia do XP do nível atual, nunca o nível */
export const pctPerdaXp=()=>Math.round(PROG.xp.deathLoss*100);
export const perdaXp=(c=ch())=>Math.floor(Math.max(0,c.xp)*PROG.xp.deathLoss);
/* custo exponencial de Magia e Perícia — mesma forma das fórmulas de
   vocation.cpp (1600*manaMultiplier^(ml-1) e skillBase*mult^(nivel-11)),
   com as bases encolhidas para a escala de uma incursão de 6 minutos.
   Os parâmetros opcionais são a ficha de um jogador da incursão (personagem,
   classe, melhorias); sem eles, vale o personagem do save */
export const manaPraMag=(n,K=KL())=>Math.round(240*Math.pow(K.mMult,n));
export const golpesPraPer=(n,K=KL())=>Math.round(12*Math.pow(K.pMult,n-10));
export const nSlots=(c=ch())=>SLOT_LVL.filter(l=>c.lvl>=l).length;
export const desbloqueadas=(c=ch(),cl=save.classe)=>listaDaClasse(cl).filter(k=>c.lvl>=SPELLS[k].lvl&&(!c.sabe||c.sabe.includes(k)));
/* ---------- aprender com o Mestre de magias ----------
   Como no Tibia: a habilidade pede o nível e o ouro. '' se dá para aprender;
   senão o motivo: 'sabe', 'nivel' ou 'ouro'. Aprendida, vai para um espaço
   livre, se houver */
export function podeAprender(k,c=ch()){
  const s=SPELLS[k];if(!s||s.c!==save.classe||c.sabe.includes(k))return 'sabe';
  if(c.lvl<s.lvl)return 'nivel';return save.cofre<precoHab(k)?'ouro':'';
}
export function aprende(k){
  const c=ch();if(podeAprender(k,c))return false;
  save.cofre-=precoHab(k);c.sabe.push(k);
  const vago=c.slots.findIndex((v,i)=>i<nSlots(c)&&!v);if(vago>=0)c.slots[vago]=k;
  return true}

export const stats=(c=ch(),cl=save.classe,u=save.up)=>{const K=CLASSES[cl],l=c.lvl;return{
  mhp:Math.round(K.hp+K.ghp*(l-1)+15*u.vigor+eqBonus('vida',c)),
  mmp:Math.round(K.mp+K.gmp*(l-1)+10*u.foco+eqBonus('mana',c)),
  pow:1+.08*u.poder+eqBonus('dano',c)
}};

/* ---------- cofre e equipamento ----------
   O cofre é da conta: ouro em save.cofre, peças em save.itens, servem a
   qualquer personagem. O que está vestido mora em ch().equip, é só daquele
   personagem e não cai na morte — só a mochila cai. */
export const eqBonus=(b,c=ch())=>{const e=c.equip;let v=0;if(!e)return v;
  for(const sl of SLOTS_EQ){const id=e[sl],bo=id&&ITEMS[id]&&ITEMS[id].bonus;if(bo&&bo[b])v+=bo[b]}
  return v};
const tiraDoCofre=k=>{if(!(save.itens[k]>0))return false;if(--save.itens[k]<=0)delete save.itens[k];return true};
const poeNoCofre=k=>{save.itens[k]=(save.itens[k]||0)+1};
/* veste a peça do cofre; a que estava no espaço volta para o cofre */
export function equipar(k){
  const it=ITEMS[k],e=ch().equip;if(!it||!it.slot||!tiraDoCofre(k))return false;
  if(e[it.slot])poeNoCofre(e[it.slot]);e[it.slot]=k;return true}
export function desequipar(sl){const e=ch().equip,k=e[sl];if(!k)return false;poeNoCofre(k);e[sl]=null;return true}
/* peça do chão da cidade: vai para o cofre, uma vez por conta */
export function pegaDoChao(id,k){if(!ITEMS[k]||save.chao[id])return false;save.chao[id]=1;poeNoCofre(k);return true}
export function vender(k){if(!tiraDoCofre(k))return false;save.cofre+=ITEMS[k].val;return true}
/* ---------- mochila ----------
   Como no Tibia (decisão do Leonardo, 19/10/2026): o loot fica na mochila do
   personagem (ch().mochila, {item: qtd}, ouro inclusive), ela entra inteira
   na caçada seguinte e a morte leva tudo o que está dentro. Só o cofre é
   seguro, e guardar é com o Banqueiro. Cada peça de equipamento ocupa uma
   casa; o resto empilha, uma casa por tipo (progression.mochila.espacos). */
export const soMochila=o=>{const r={};for(const[k,q]of Object.entries(o||{}))if(ITEMS[k]&&q>0)r[k]=Math.min(1e9,q|0);return r};
export const nEspacos=()=>PROG.mochila.espacos;
export const ocupa=bag=>{let n=0;for(const k in bag)n+=ITEMS[k].slot?bag[k]:1;return n};
/* quantas unidades de k ainda cabem */
export const cabe=(bag,k)=>{const l=nEspacos()-ocupa(bag);return ITEMS[k].slot?Math.max(0,l):bag[k]||l>0?1e9:0};
export const valMochila=bag=>{let v=0;for(const k in bag)v+=ITEMS[k].val*bag[k];return v};
/* no Banco: tudo da mochila para o cofre (o mesmo destino de cada coisa que
   guardaSaco() dá), ou um tipo só (uma peça de equipamento por vez) */
export function guardaMochila(){const c=ch(),r=guardaSaco(c.mochila);c.mochila={};return r}
export function guardaUm(k){const m=ch().mochila,q=ITEMS[k]&&ITEMS[k].slot?1:m[k];if(!(m[k]>0))return null;
  if((m[k]-=q)<=0)delete m[k];return guardaSaco({[k]:q})}
/* vestir e tirar pela janela da Mochila, na cidade: a troca é com a mochila,
   como no Tibia (na caçada, vesteDoSaco() e tiraProSaco(), em combate.js) */
export function vesteDaMochila(k){const it=ITEMS[k],m=ch().mochila,e=ch().equip;if(!it||!it.slot||!(m[k]>0))return false;
  if(--m[k]<=0)delete m[k];if(e[it.slot])m[e[it.slot]]=(m[e[it.slot]]|0)+1;e[it.slot]=k;return true}
export function tiraPraMochila(sl){const e=ch().equip,k=e[sl],m=ch().mochila;if(!k||!cabe(m,k))return false;e[sl]=null;m[k]=(m[k]|0)+1;return true}
/* do cofre para a mochila: uma peça, ou n de ouro */
export function leva(k){const m=ch().mochila;if(!cabe(m,k)||!tiraDoCofre(k))return false;m[k]=(m[k]|0)+1;return true}
export function retira(n){const m=ch().mochila;n=Math.min(n|0,save.cofre);if(!(n>0)||!cabe(m,'ouro'))return false;
  save.cofre-=n;m.ouro=(m.ouro|0)+n;return true}
/* equipamento vai para o cofre como peça, material que o Gordon compra vai
   para o depósito de materiais, o resto (ouro, gemas) vira ouro no cofre */
export function guardaSaco(bag){let ouro=0,pecas=0,mats=0;
  for(const[k,q]of Object.entries(bag)){if(ITEMS[k].slot){save.itens[k]=(save.itens[k]||0)+q;pecas+=q}
    else if(ehMat(k)){save.mats[k]=(save.mats[k]||0)+q;mats+=q}else ouro+=ITEMS[k].val*q}
  save.cofre+=ouro;return{ouro,pecas,mats}}

/* ---------- forja do Gordon ----------
   Ralo dos materiais (pilar 5): ou viram ouro barato na mão dele, ou viram
   encomenda, e cada encomenda entregue libera peças melhores na loja dele,
   compradas com o ouro do cofre. Tudo da conta, como o cofre. */
export const ehMat=k=>Object.prototype.hasOwnProperty.call(FORJA.compra,k);
export const soMats=o=>{const r={};for(const[k,q]of Object.entries(o||{}))if(ITEMS[k]&&ehMat(k)&&q>0)r[k]=q|0;return r};
export const missao=()=>FORJA.missoes[save.forja]||null;
/* quanto do material a encomenda atual ainda segura (para não vender sem querer) */
export const reservado=k=>{const m=missao();return m&&m.pede[k]||0};
export const podeEntregar=()=>{const m=missao();return !!m&&Object.entries(m.pede).every(([k,q])=>(save.mats[k]|0)>=q)};
const tiraMat=(k,q)=>{if((save.mats[k]-=q)<=0)delete save.mats[k]};
export function entregar(){if(!podeEntregar())return false;
  for(const[k,q]of Object.entries(missao().pede))tiraMat(k,q);save.forja++;return true}
/* vende q unidades (no máximo o que tem); devolve o ouro recebido */
export function venderMat(k,q){q=Math.min(q|0,save.mats[k]|0);if(!(q>0)||!ehMat(k))return 0;
  const o=FORJA.compra[k]*q;tiraMat(k,q);save.cofre+=o;return o}
export const ofertaForja=k=>FORJA.loja.find(o=>o.item===k);
export function comprarForja(k){const o=ofertaForja(k);
  if(!o||o.missao>save.forja||save.cofre<o.preco)return false;save.cofre-=o.preco;poeNoCofre(k);return true}

/* ---------- provisões (lojas da cidade) ----------
   Compradas com o ouro do cofre, ficam em save.prov (da conta, até o max de
   cada uma) e vão inteiras na próxima caçada que começar, extraindo ou
   morrendo: é ralo do cofre (pilar 5) e aposta a mais na mesa (pilar 1). Só
   uma do mesmo grupo (uma refeição por caçada). */
export const soProv=o=>{const r={};for(const[k,q]of Object.entries(o||{})){const s=SUP[k];if(s&&q>0)r[k]=Math.min(s.max,q|0)}return r};
/* '' se dá para comprar; senão o motivo: 'ouro', 'max' ou a chave da
   provisão do mesmo grupo que já está guardada */
export function podeComprar(k){
  const s=SUP[k];if(!s||(save.prov[k]||0)>=s.max)return 'max';
  if(s.grupo){const o=Object.keys(save.prov).find(j=>j!==k&&SUP[j].grupo===s.grupo);if(o)return o}
  return save.cofre<s.preco?'ouro':'';
}
export function compra(k){
  if(podeComprar(k))return false;save.cofre-=SUP[k].preco;save.prov[k]=(save.prov[k]||0)+1;return true}
/* a caçada começou: o que o jogador levou (p.prov) sai do estoque */
export function gastaProv(prov){for(const[k,q]of Object.entries(prov||{})){const n=(save.prov[k]||0)-q;if(n>0)save.prov[k]=n;else delete save.prov[k]}}
/* o efeito somado das provisões de uma ficha, para novoJogador() */
export function efeitoProv(prov){
  const e={pot:0,rhp:0,rmp:0,buffs:{}};
  for(const[k,q]of Object.entries(prov||{})){const f=SUP[k]&&SUP[k].efeito;if(!f)continue;
    e.pot+=(f.pot||0)*q;e.rhp+=(f.rhp||0)*q;e.rmp+=(f.rmp||0)*q;
    if(f.buff)for(const b of BUFFS)if(f.buff[b]){const o=e.buffs[b];e.buffs[b]={v:(o?o.v:0)+f.buff[b],left:Math.max(o?o.left:0,f.buff.dur)}}}
  return e;
}

/* ---------- melhorias permanentes (ralo do cofre) ---------- */
export const upCost=(k,n)=>Math.round(UP[k].base*Math.pow(UP[k].mult,n)/5)*5;
export const sealPct=(u=save.up)=>.2*u.seguro;
