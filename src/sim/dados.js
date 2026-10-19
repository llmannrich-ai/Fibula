/* ---------- conteúdo do jogo (data/game/content.json) ----------
   Classes, habilidades, melhorias, inimigos, itens, loot, progressão, as
   provisões, a cidade, os mapas de caça e a forja do Gordon moram
   fora do motor: ajustar balanceamento não exige mexer em código. Quem busca o
   arquivo é o cliente (src/main.js) ou o servidor; aqui ele é validado e vira
   as tabelas abaixo, que são leituras dele e não literais. */
export function validaConteudo(c){
  for(const k of ['classes','classOrder','slotLevels','spells','upgrades','enemies','items','loot','progression','supplies','city','hunts','forja'])
    if(!c[k]||typeof c[k]!=='object')throw new Error(`conteúdo sem a seção "${k}"`);
  const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  if(!Array.isArray(c.classOrder)||!c.classOrder.length)throw new Error('classOrder vazio');
  for(const k of c.classOrder)if(!tem(c.classes,k))throw new Error(`classOrder cita classe inexistente: ${k}`);
  if(!Array.isArray(c.slotLevels)||!c.slotLevels.length)throw new Error('slotLevels vazio');
  for(const[k,s]of Object.entries(c.spells)){
    if(!tem(c.classes,s.c))throw new Error(`habilidade ${k} é de classe inexistente: ${s.c}`);
    if(typeof s.lvl!=='number')throw new Error(`habilidade ${k} sem lvl numérico`);
    if(s.preco!==undefined&&!(Number.isInteger(s.preco)&&s.preco>=0))throw new Error(`habilidade ${k} com preço inválido: inteiro >= 0`);
  }
  for(const k of c.classOrder){
    if(!Object.values(c.spells).some(s=>s.c===k))throw new Error(`classe ${k} não tem nenhuma habilidade`);
    if(!Object.values(c.spells).some(s=>s.c===k&&s.lvl<=1&&!s.preco))throw new Error(`classe ${k} sem habilidade grátis no nível 1: o personagem novo não teria como atacar`);
  }
  for(const[k,u]of Object.entries(c.upgrades))
    if(typeof u.base!=='number'||typeof u.mult!=='number'||typeof u.max!=='number')
      throw new Error(`melhoria ${k} sem base/mult/max numéricos`);
  for(const[k,it]of Object.entries(c.items)){
    if(it.slot===undefined)continue;
    if(!SLOTS_EQ.includes(it.slot))throw new Error(`item ${k} com slot desconhecido: ${it.slot}`);
    for(const[b,v]of Object.entries(it.bonus||{}))
      if(!(b in BONUS)||typeof v!=='number')throw new Error(`item ${k} com bônus inválido: ${b}`);
    const v=it.veste;
    if(v!==undefined&&(!v||typeof v!=='object'||(v.cor!==undefined&&!/^#[0-9a-f]{6}$/i.test(v.cor))||(v.malha!==undefined&&typeof v.malha!=='boolean')))
      throw new Error(`item ${k} com veste inválida: cor é #rrggbb e malha é true ou false`);
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
  const w=p.walk;
  if(!w||!['speedBase','speedPerLevel','speedMax','ground','diagonal','stepMs','wander'].every(k=>typeof w[k]==='number'&&w[k]>=0)||!(w.speedBase>0&&w.speedMax>=w.speedBase&&w.ground>0&&w.diagonal>=1&&w.stepMs>0&&w.wander>=1))throw new Error('progression.walk precisa de speedBase e speedMax (>= speedBase), speedPerLevel, ground, diagonal >= 1, stepMs e wander >= 1');
  for(const[k,e]of Object.entries(c.enemies))if(!(e.spd>0))throw new Error(`inimigo ${k} precisa de spd (velocidade do Tibia) positivo`);
  if(!p.respawn||!(p.respawn.seconds>0)||!(p.respawn.clearTiles>=0))throw new Error('progression.respawn precisa de seconds positivo e clearTiles');
  if(!p.mochila||!(Number.isInteger(p.mochila.espacos)&&p.mochila.espacos>0))throw new Error('progression.mochila precisa de espacos inteiro positivo');
  if(!p.comida||!(p.comida.max>0))throw new Error('progression.comida precisa de max (segundos de alimentação) positivo');
  const pt=p.party;
  if(!pt||!['lootProtection','shareTiles'].every(k=>typeof pt[k]==='number'&&pt[k]>=0))throw new Error('progression.party precisa de lootProtection e shareTiles numéricos e não negativos');
  /* o mundo é igual para todos (pilar 1 do CLAUDE.md): nada escala com o nível ou o grupo de quem entra */
  for(const k of ['hpPerCharLevel','bossLevelFactor'])if(k in p.scaling)throw new Error(`progression.scaling.${k}: monstro não escala com o nível do jogador`);
  for(const k of ['monsters','bossHp'])if(k in pt)throw new Error(`progression.party.${k}: o mundo não muda com o tamanho do grupo`);
  for(const b of p.bands){
    if(typeof b.untilDepth!=='number')throw new Error('banda sem untilDepth numérico');
    const soma=Object.values(b.weights||{}).reduce((a,v)=>a+v,0);
    if(Math.abs(soma-1)>.001)throw new Error(`pesos da banda ${b.untilDepth} somam ${soma}, não 1`);
    for(const k of Object.keys(b.weights))if(!tem(c.enemies,k))throw new Error(`banda cita inimigo inexistente: ${k}`);
  }
  for(const k of [p.boss.type,...(p.boss.escort||[])])
    if(!tem(c.enemies,k))throw new Error(`chefe cita inimigo inexistente: ${k}`);
  const ci=c.city,M=ci.mapa;
  if(!Array.isArray(M)||M.length<3||typeof M[0]!=='string'||M[0].length<3)throw new Error('city.mapa precisa de ao menos 3 linhas de texto');
  if(M.some(l=>typeof l!=='string'||l.length!==M[0].length))throw new Error(`city.mapa tem linhas de tamanhos diferentes (a primeira tem ${M[0].length})`);
  const letras={};
  for(const[k,s]of Object.entries(c.supplies)){
    if(typeof s.nome!=='string'||!(Number.isInteger(s.preco)&&s.preco>0))throw new Error(`provisão ${k} sem nome ou preço inteiro positivo`);
    const e=s.efeito;
    if(!e||typeof e!=='object'||!Object.keys(e).length||!(Number.isInteger(s.max)&&s.max>=1))throw new Error(`provisão ${k} precisa de efeito e de max inteiro >= 1`);
    for(const[a,v]of Object.entries(e)){
      if(a==='buff'){if(!v||!(v.dur>0)||!Object.keys(v).every(b=>b==='dur'||(BUFFS.includes(b)&&typeof v[b]==='number')))throw new Error(`provisão ${k} com buff inválido: ${BUFFS.join(', ')} e dur positivo`)}
      else if(!['pot','comida'].includes(a)||!(typeof v==='number'&&v>0))throw new Error(`provisão ${k} com efeito inválido: ${a}`);
    }
  }
  for(const[k,n]of Object.entries(ci.npcs||{})){
    if(typeof n.letra!=='string'||n.letra.length!==1||n.letra in LEGENDA||n.letra in OBJETOS)throw new Error(`NPC ${k} sem letra própria no mapa`);
    if(!ABRE.includes(n.abre))throw new Error(`NPC ${k} abre algo que não existe: ${n.abre}`);
    if((n.lugar!==undefined&&typeof n.lugar!=='boolean')||(n.acao!==undefined&&(typeof n.acao!=='string'||!n.acao||n.acao.length>10)))throw new Error(`NPC ${k}: lugar é true ou false e acao é um texto curto`);
    if(n.abre==='loja'&&(!Array.isArray(n.vende)||!n.vende.length||n.vende.some(v=>!tem(c.supplies,v))))throw new Error(`a loja de ${k} precisa de vende com chaves de supplies`);
    letras[n.letra]=0;
  }
  let chegada=0;
  for(const l of M)for(const ch of l){if(ch==='@')chegada++;if(ch in letras)letras[ch]++;else if(!(ch in LEGENDA)&&!(ch in OBJETOS))throw new Error(`city.mapa tem um caractere desconhecido: "${ch}"`)}
  if(chegada!==1)throw new Error(`city.mapa precisa de exatamente um @ (tem ${chegada})`);
  for(const[k,n]of Object.entries(ci.npcs))if(letras[n.letra]!==1)throw new Error(`o NPC ${k} (${n.letra}) aparece ${letras[n.letra]} vezes no mapa, e não uma`);
  for(const a of ABRE)if(!Object.values(ci.npcs).some(n=>n.abre===a))throw new Error(`nenhum NPC da cidade abre ${a}`);
  if(Object.values(c.spells).some(s=>s.preco)&&!Object.values(ci.npcs).some(n=>n.ensina===true&&n.abre==='loja'))throw new Error('há habilidade com preço e nenhuma loja da cidade com ensina: true');
  for(const q of ci.chao||[]){
    const l=M[q&&q.y],t=l&&typeof q.x==='number'?l[q.x]:undefined;
    if(!q||!tem(c.items,q.item))throw new Error(`city.chao cita item inexistente: ${q&&q.item}`);
    if(!t||!',._@:=vh'.includes(t))throw new Error(`city.chao põe ${q.item} em ${q.x},${q.y}, que não é chão da cidade`);
  }
  const hs=Object.entries(c.hunts).filter(([k])=>k[0]!=='_');
  if(!hs.length)throw new Error('hunts vazio: o Guia de caça não teria para onde levar');
  for(const[k,h]of hs){
    if(typeof h.nome!=='string'||typeof h.nivel!=='number')throw new Error(`mapa de caça ${k} sem nome ou nível`);
    if(!ci.npcs[h.npc]||ci.npcs[h.npc].abre!=='cacadas')throw new Error(`mapa de caça ${k} precisa de npc, um NPC da cidade que abre cacadas`);
    for(const b of h.bands||[]){
      if(typeof b.untilDepth!=='number')throw new Error(`mapa de caça ${k}: banda sem untilDepth numérico`);
      const soma=Object.values(b.weights||{}).reduce((a,v)=>a+v,0);
      if(Math.abs(soma-1)>.001)throw new Error(`mapa de caça ${k}: pesos da banda ${b.untilDepth} somam ${soma}, não 1`);
      for(const e of Object.keys(b.weights))if(!tem(c.enemies,e))throw new Error(`mapa de caça ${k} cita inimigo inexistente: ${e}`);
    }
    if(h.bands!==undefined&&(!Array.isArray(h.bands)||!h.bands.length))throw new Error(`mapa de caça ${k}: bands vazio`);
    if(h.boss!==undefined)for(const e of [h.boss.type,...(h.boss.escort||[])])if(!tem(c.enemies,e))throw new Error(`mapa de caça ${k}: chefe cita inimigo inexistente: ${e}`);
    const m=h.mapa,par=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isInteger)&&v[0]>=2&&v[0]<=v[1];
    if(m!==undefined&&!(m&&par(m.salas)&&par(m.w)&&par(m.h)&&m.w[1]<=16&&m.h[1]<=16&&Number.isInteger(m.atalhos)&&m.atalhos>=0))throw new Error(`mapa de caça ${k}: mapa precisa de salas, w e h ([mínimo, máximo], até 16) e atalhos`);
  }
  for(const[k,n]of Object.entries(ci.npcs))if(n.abre==='cacadas'&&!hs.some(([,h])=>h.npc===k))throw new Error(`o NPC ${k} abre cacadas, mas nenhum mapa de caça é dele`);
  const f=c.forja,inteiro=v=>Number.isInteger(v)&&v>0;
  if(!f.compra||typeof f.compra!=='object'||!Array.isArray(f.missoes)||!Array.isArray(f.loja))throw new Error('forja precisa de compra, missoes e loja');
  for(const[k,v]of Object.entries(f.compra)){
    if(!tem(c.items,k)||c.items[k].slot!==undefined||k==='ouro')throw new Error(`forja compra o que não é material: ${k}`);
    if(!inteiro(v))throw new Error(`forja paga um preço inválido por ${k}`);
  }
  for(const[i,m]of f.missoes.entries()){
    if(typeof m.nome!=='string'||!m.pede||!Object.keys(m.pede).length)throw new Error(`encomenda ${i+1} da forja sem nome ou sem pedido`);
    for(const[k,q]of Object.entries(m.pede))if(!tem(f.compra,k)||!inteiro(q))throw new Error(`encomenda ${i+1} da forja pede ${k}, que o Gordon não compra, ou quantidade inválida`);
  }
  for(const o of f.loja){
    const it=c.items[o.item];
    if(!it||!it.slot)throw new Error(`forja vende o que não é equipamento: ${o.item}`);
    if(!inteiro(o.preco)||o.preco<=it.val)throw new Error(`forja vende ${o.item} por ${o.preco}, e precisa ser mais que o val (${it.val})`);
    if(!Number.isInteger(o.missao)||o.missao<0||o.missao>f.missoes.length)throw new Error(`forja libera ${o.item} numa encomenda que não existe: ${o.missao}`);
  }
}

/* ---------- cidade e mapas de caça ----------
   O mapa da cidade é texto no content.json, uma letra por tile: mudar uma
   casa de lugar é editar dado. LEGENDA diz o que cada letra é (o número é o
   tipo de tile de src/sim/cidade.js); as letras dos NPCs vêm de city.npcs.
   ABRE é o que um NPC pode abrir. OBJETOS são as coisas sólidas que enfeitam
   a cidade (o nome é o sprite obj_<nome>); ficam sobre o chão do vizinho.
   HUNTS são os mapas de caça, cada um com o NPC que leva até ele (npc), a
   tabela de spawn, o chefe, o jeito de cavar o mapa e a arte; caçaDe(k) dá o
   mapa k, ou o primeiro se k não existe (o que vem da rede passa por aqui). */
export const LEGENDA={',':0,'#':1,'.':2,'_':3,'A':4,'~':5,'P':6,'@':2,':':7,'=':8,'v':9,'h':10};
export const OBJETOS={f:'fonte',p:'poco',b:'barril',c:'caixote',e:'estatua',y:'arbusto',r:'cerejeira',q:'frutifera',n:'forno',s:'estante',k:'banca',w:'lenha'};
export const ABRE=['mercador','banco','cacadas','mercado','forja','loja'];
export let CITY,HUNTS;
export const cacaDe=k=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(HUNTS,k)?k:HUNTS.runas?'runas':Object.keys(HUNTS)[0];
/* ---------- provisões ----------
   O que as lojas da cidade vendem (supplies no content.json): comida, poção
   e runa, que vão inteiras na próxima caçada. A comida (efeito.comida, em
   segundos de alimentação) se come na caçada e o que sobra volta ao
   extrair; poção e runa valem desde a entrada. BUFFS são os buffs que uma
   provisão pode dar, os mesmos das habilidades */
export let SUP;
export const BUFFS=['velo','dano','arm','alc'];

/* ---------- classes ----------
   Adaptação das vocações do Tibia: a identidade não vem de poderes exclusivos,
   vem das TAXAS DE CRESCIMENTO. ghp/gmp espelham gainhp/gainmana do
   vocations.xml; mMult espelha manamultiplier (custo exponencial de magia);
   pMult espelha o skill multiplier das armas; rhp/rmp espelham os ticks de
   regeneração. Quem é de mana regenera mana; quem é de vida regenera vida.
   Como no Tibia, só se regenera alimentado (progression.comida). */
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
/* o preço de aprender (0: vem sozinha ao chegar no nível) */
export const precoHab=k=>SPELLS[k].preco||0;
export const slotsIniciais=(c,lvl)=>{
  const n=SLOT_LVL.filter(l=>lvl>=l).length,libs=listaDaClasse(c).filter(k=>SPELLS[k].lvl<=lvl);
  return [0,1,2,3].map(i=>i<n?(libs[i]||null):null);
};

/* ---------- melhorias permanentes e dados do jogo ---------- */
export let UP,MT,ITEMS,LOOT,PROG;
export const fmtItem=([k,q])=>k==='ouro'?`${q} de ouro`:(q>1?`${q} × ${ITEMS[k].nome}`:ITEMS[k].nome);

/* ---------- forja do Gordon ----------
   compra (preço por material), missoes (encomendas em ordem) e loja (o que
   ele vende e a partir de qual encomenda); a regra mora em progresso.js. */
export let FORJA;

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
  UP=c.upgrades;MT=c.enemies;ITEMS=c.items;LOOT=c.loot;PROG=c.progression;CITY=c.city;HUNTS=Object.fromEntries(Object.entries(c.hunts).filter(([k])=>k[0]!=='_'));FORJA=c.forja;SUP=c.supplies;
}
