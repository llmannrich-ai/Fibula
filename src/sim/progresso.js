/* ---------- personagem e progressão ----------
   O save em memória e tudo o que deriva dele. Onde o save é gravado
   (localStorage, nuvem) é do cliente, em src/salvar.js e src/nuvem.js; aqui
   ele só é lido e alterado, e quem altera chama saida.persist() depois. */
import {CLASSES,SPELLS,SLOT_LVL,UP,listaDaClasse,slotsIniciais} from './dados.js';

export const UP0={vigor:0,foco:0,poder:0,bolsa:0,seguro:0};
export const novoChar=(c,lvl=1)=>({lvl,xp:0,mag:0,manaG:0,per:10,golpes:0,slots:slotsIniciais(c,lvl)});
export const SAVE0=()=>({cofre:0,runs:0,ext:0,deaths:0,best:0,up:Object.assign({},UP0),classe:null,chars:{}});
/* lê um save cru (do localStorage ou da nuvem) por cima dos padrões */
export const normaliza=s=>{const n=Object.assign(SAVE0(),s);n.up=Object.assign({},UP0,s.up||{});n.chars=s.chars||{};
  /* save apontando para um personagem que não existe deixava a tela em branco */
  if(n.classe&&!CLASSES[n.classe])n.classe=null;
  if(n.classe&&!n.chars[n.classe])n.chars[n.classe]=novoChar(n.classe);
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
  mhp:Math.round(K.hp+K.ghp*(l-1)+15*u.vigor),
  mmp:Math.round(K.mp+K.gmp*(l-1)+10*u.foco),
  pow:1+.08*u.poder
}};

/* ---------- melhorias permanentes (ralo do cofre) ---------- */
export const upCost=(k,n)=>Math.round(UP[k].base*Math.pow(UP[k].mult,n)/5)*5;
export const sealPct=()=>.2*save.up.seguro;
