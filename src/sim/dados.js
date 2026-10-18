/* ---------- conteúdo do jogo (data/game/content.json) ----------
   Classes, habilidades, melhorias, inimigos, itens, loot e progressão moram
   fora do motor: ajustar balanceamento não exige mexer em código. Quem busca o
   arquivo é o cliente (src/main.js) ou o servidor; aqui ele é validado e vira
   as tabelas abaixo, que são leituras dele e não literais. */
export function validaConteudo(c){
  for(const k of ['classes','classOrder','slotLevels','spells','upgrades','enemies','items','loot','progression'])
    if(!c[k]||typeof c[k]!=='object')throw new Error(`conteúdo sem a seção "${k}"`);
  const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  if(!Array.isArray(c.classOrder)||!c.classOrder.length)throw new Error('classOrder vazio');
  for(const k of c.classOrder)if(!tem(c.classes,k))throw new Error(`classOrder cita classe inexistente: ${k}`);
  if(!Array.isArray(c.slotLevels)||!c.slotLevels.length)throw new Error('slotLevels vazio');
  for(const[k,s]of Object.entries(c.spells)){
    if(!tem(c.classes,s.c))throw new Error(`habilidade ${k} é de classe inexistente: ${s.c}`);
    if(typeof s.lvl!=='number')throw new Error(`habilidade ${k} sem lvl numérico`);
  }
  for(const k of c.classOrder)
    if(!Object.values(c.spells).some(s=>s.c===k))throw new Error(`classe ${k} não tem nenhuma habilidade`);
  for(const[k,u]of Object.entries(c.upgrades))
    if(typeof u.base!=='number'||typeof u.mult!=='number'||typeof u.max!=='number')
      throw new Error(`melhoria ${k} sem base/mult/max numéricos`);
  for(const[k,it]of Object.entries(c.items)){
    if(it.slot===undefined)continue;
    if(!SLOTS_EQ.includes(it.slot))throw new Error(`item ${k} com slot desconhecido: ${it.slot}`);
    for(const[b,v]of Object.entries(it.bonus||{}))
      if(!(b in BONUS)||typeof v!=='number')throw new Error(`item ${k} com bônus inválido: ${b}`);
  }
  for(const k of Object.keys(c.enemies))if(!c.loot[k])throw new Error(`inimigo sem tabela de loot: ${k}`);
  for(const[k,tbl]of Object.entries(c.loot)){
    if(!tem(c.enemies,k))throw new Error(`loot de inimigo inexistente: ${k}`);
    for(const row of tbl)if(!tem(c.items,row[0]))throw new Error(`loot cita item inexistente: ${row[0]}`);
  }
  const p=c.progression;
  if(!Array.isArray(p.bands)||!p.bands.length)throw new Error('progression.bands vazio');
  if(!p.scaling||!p.boss||!p.perRoom||!p.xp)throw new Error('progression incompleta');
  if(!(p.xp.base>0&&p.xp.exp>0&&p.xp.deathLoss>=0&&p.xp.deathLoss<1))throw new Error('progression.xp precisa de base e exp positivos e deathLoss entre 0 e 1');
  for(const b of p.bands){
    if(typeof b.untilDepth!=='number')throw new Error('banda sem untilDepth numérico');
    const soma=Object.values(b.weights||{}).reduce((a,v)=>a+v,0);
    if(Math.abs(soma-1)>.001)throw new Error(`pesos da banda ${b.untilDepth} somam ${soma}, não 1`);
    for(const k of Object.keys(b.weights))if(!tem(c.enemies,k))throw new Error(`banda cita inimigo inexistente: ${k}`);
  }
  for(const k of [p.boss.type,...(p.boss.escort||[])])
    if(!tem(c.enemies,k))throw new Error(`chefe cita inimigo inexistente: ${k}`);
}

/* ---------- classes ----------
   Adaptação das vocações do Tibia: a identidade não vem de poderes exclusivos,
   vem das TAXAS DE CRESCIMENTO. ghp/gmp espelham gainhp/gainmana do
   vocations.xml; mMult espelha manamultiplier (custo exponencial de magia);
   pMult espelha o skill multiplier das armas; rhp/rmp espelham os ticks de
   regeneração. Quem é de mana regenera mana; quem é de vida regenera vida. */
export let CLASSES,CL_ORDEM;

/* ---------- habilidades ----------
   Campos espelham o Spell do Forgotten Server: grupo, nível, mana, cooldown
   próprio (cd) e cooldown de grupo (gcd), escala (magia ou perícia) e a
   fórmula de dano no formato nivel/2 + poder*a + b, que é a tradução direta de
   "level/5 + magicLevel*a + b" das spells em data/scripts/spells.
   Espaços de habilidade (SLOT_LVL): dois de saída, o terceiro no nível 8, o
   quarto no 18. */
export let SPELLS,SLOT_LVL;
export const EL_COR={fogo:'#ff9a3c',energia:'#9db8ff',gelo:'#8fe3ff',terra:'#9fd36b',sagrado:'#ffe7a8',fisico:'#e8e0cf'};
export const listaDaClasse=c=>Object.keys(SPELLS).filter(k=>SPELLS[k].c===c);
export const slotsIniciais=(c,lvl)=>{
  const n=SLOT_LVL.filter(l=>lvl>=l).length,libs=listaDaClasse(c).filter(k=>SPELLS[k].lvl<=lvl);
  return [0,1,2,3].map(i=>i<n?(libs[i]||null):null);
};

/* ---------- melhorias permanentes e dados do jogo ---------- */
export let UP,MT,ITEMS,LOOT,PROG;
export const fmtItem=([k,q])=>k==='ouro'?`${q} de ouro`:(q>1?`${q} × ${ITEMS[k].nome}`:ITEMS[k].nome);

/* ---------- equipamento ----------
   Três espaços, nenhum a mais (pilar 3). Item com slot no content.json é
   equipável: na extração vai para o cofre da conta em vez de virar ouro. */
export const SLOTS_EQ=['arma','armadura','amuleto'];
export const SLOT_NOME={arma:'Arma',armadura:'Armadura',amuleto:'Amuleto'};
const BONUS={dano:v=>`+${Math.round(v*100)}% de dano`,red:v=>`−${Math.round(v*100)}% de dano sofrido`,vida:v=>`+${v} de vida`,mana:v=>`+${v} de mana`};
export const fmtBonus=it=>Object.entries(it.bonus||{}).map(([b,v])=>BONUS[b](v)).join(', ');

/* valida e liga as tabelas; estoura com a mensagem que o menu mostra */
export function carrega(c){
  validaConteudo(c);
  CLASSES=c.classes;CL_ORDEM=c.classOrder;SPELLS=c.spells;SLOT_LVL=c.slotLevels;
  UP=c.upgrades;MT=c.enemies;ITEMS=c.items;LOOT=c.loot;PROG=c.progression;
}
