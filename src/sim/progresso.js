/* ---------- personagem e progressão ----------
   O save em memória e tudo o que deriva dele. Onde o save é gravado
   (localStorage, nuvem) é do cliente, em src/salvar.js e src/nuvem.js; aqui
   ele só é lido e alterado, e quem altera chama saida.persist() depois. */
import {CLASSES,SPELLS,SLOT_LVL,UP,ITEMS,SLOTS_EQ,listaDaClasse,slotsIniciais} from './dados.js?v=0.5.0';

export const UP0={vigor:0,foco:0,poder:0,bolsa:0,seguro:0};
const EQ0=()=>({arma:null,armadura:null,amuleto:null});
export const novoChar=(c,lvl=1)=>({lvl,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:slotsIniciais(c,lvl),equip:EQ0()});
/* cofre (ouro) e itens (equipamento guardado) são da conta; equip é de cada personagem */
export const SAVE0=()=>({cofre:0,itens:{},runs:0,ext:0,deaths:0,best:0,up:Object.assign({},UP0),classe:null,chars:{}});
/* lê um save cru (do localStorage ou da nuvem) por cima dos padrões */
export const normaliza=s=>{const n=Object.assign(SAVE0(),s);n.up=Object.assign({},UP0,s.up||{});n.chars=s.chars||{};
  /* save apontando para um personagem que não existe deixava a tela em branco */
  if(n.classe&&!CLASSES[n.classe])n.classe=null;
  if(n.classe&&!n.chars[n.classe])n.chars[n.classe]=novoChar(n.classe);
  /* saves de antes do equipamento não têm itens nem equip; item que saiu do
     content.json some em vez de quebrar a tela */
  n.itens={};for(const[k,q]of Object.entries(s.itens||{}))if(ITEMS[k]&&ITEMS[k].slot&&q>0)n.itens[k]=q|0;
  for(const c of Object.values(n.chars)){const e=EQ0();
    for(const sl of SLOTS_EQ){const id=c.equip&&c.equip[sl];if(id&&ITEMS[id]&&ITEMS[id].slot===sl)e[sl]=id}
    c.equip=e}
  return n};
export let save=SAVE0();
export const setSave=s=>{save=s};
export const ch=()=>save.chars[save.classe];
export const KL=()=>CLASSES[save.classe];

export const xpNeed=l=>Math.round(40*Math.pow(l,1.6));
/* custo exponencial de Magia e Perícia — mesma forma das fórmulas de
   vocation.cpp (1600*manaMultiplier^(ml-1) e skillBase*mult^(nivel-11)),
   com as bases encolhidas para a escala de uma incursão de 6 minutos */
export const manaPraMag=n=>Math.round(240*Math.pow(KL().mMult,n));
export const golpesPraPer=n=>Math.round(12*Math.pow(KL().pMult,n-10));
export const nSlots=()=>SLOT_LVL.filter(l=>ch().lvl>=l).length;
export const desbloqueadas=()=>listaDaClasse(save.classe).filter(k=>ch().lvl>=SPELLS[k].lvl);

export const stats=()=>{const c=ch(),K=KL(),u=save.up,l=c.lvl;return{
  mhp:Math.round(K.hp+K.ghp*(l-1)+15*u.vigor+eqBonus('vida')),
  mmp:Math.round(K.mp+K.gmp*(l-1)+10*u.foco+eqBonus('mana')),
  pow:1+.08*u.poder+eqBonus('dano')
}};

/* ---------- cofre e equipamento ----------
   O cofre é da conta: ouro em save.cofre, peças em save.itens, servem a
   qualquer personagem. O que está vestido mora em ch().equip, é só daquele
   personagem e não cai na morte — só o saco cai. */
export const eqBonus=b=>{const e=ch().equip;let v=0;if(!e)return v;
  for(const sl of SLOTS_EQ){const id=e[sl],bo=id&&ITEMS[id]&&ITEMS[id].bonus;if(bo&&bo[b])v+=bo[b]}
  return v};
const tiraDoCofre=k=>{if(!(save.itens[k]>0))return false;if(--save.itens[k]<=0)delete save.itens[k];return true};
const poeNoCofre=k=>{save.itens[k]=(save.itens[k]||0)+1};
/* veste a peça do cofre; a que estava no espaço volta para o cofre */
export function equipar(k){
  const it=ITEMS[k],e=ch().equip;if(!it||!it.slot||!tiraDoCofre(k))return false;
  if(e[it.slot])poeNoCofre(e[it.slot]);e[it.slot]=k;return true}
export function desequipar(sl){const e=ch().equip,k=e[sl];if(!k)return false;poeNoCofre(k);e[sl]=null;return true}
export function vender(k){if(!tiraDoCofre(k))return false;save.cofre+=ITEMS[k].val;return true}
/* extração: equipamento vai para o cofre como peça, o resto vira ouro */
export function guardaSaco(bag){let ouro=0,pecas=0;
  for(const[k,q]of Object.entries(bag)){if(ITEMS[k].slot){save.itens[k]=(save.itens[k]||0)+q;pecas+=q}else ouro+=ITEMS[k].val*q}
  save.cofre+=ouro;return{ouro,pecas}}

/* ---------- melhorias permanentes (ralo do cofre) ---------- */
export const upCost=(k,n)=>Math.round(UP[k].base*Math.pow(UP[k].mult,n)/5)*5;
export const sealPct=()=>.2*save.up.seguro;
