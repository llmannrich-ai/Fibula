/* ---------- cidade ----------
   O lugar entre incursões: um mapa fixo (city.mapa no content.json) por onde o
   jogador anda até as casas dos NPCs — Mercador, Banco, a Feira, as lojas de
   provisões (Quitanda, Botica, Torre dos magos, Forja) e o Guia de caça, que
   leva às masmorras. É regra e não tela, como a incursão: quando a cidade
   for compartilhada (F3, Parte 2 do CLAUDE.md), é este estado que o servidor vai rodar, com
   os outros jogadores ao lado de C.p. Aqui só se anda e se descobre quem está
   perto; o que cada NPC abre é do cliente (src/telas.js). */
import {T,hyp,DIR8,poeNoSqm,comeca,avanca,dir8,passoPara,saida} from './base.js?v=0.28.0';
import {ch,durPasso,save,pegaDoChao} from './progresso.js?v=0.28.0';
import {CITY,LEGENDA,OBJETOS,CLASSES,PROG,ITEMS,SLOTS_EQ,HUNTS,cacaDe} from './dados.js?v=0.28.0';
import {pecas} from './mapa.js?v=0.28.0';

/* tipo de tile (LEGENDA, em src/sim/dados.js): chão (0 grama, 2 rua,
   3 assoalho, 7 praça, 8 ponte, 9 flores, 10 horta) ou obstáculo (1 parede,
   4 árvore, 5 água, 6 portão). @ é onde se chega da primeira vez; a letra de
   um NPC de city.npcs é o lugar dele. Um objeto (OBJETOS: fonte, barril,
   estátua…) é sólido e fica sobre o chão do vizinho, como o NPC; C.obj guarda
   qual (1 + a posição em LISTA_OBJ, 0 sem objeto) */
const SOLIDO=[0,1,0,0,1,1,1,0,0,0,0];
export const LISTA_OBJ=Object.values(OBJETOS);
/* o chão debaixo de quem não tem chão próprio (NPC, objeto): o de dentro de
   casa se houver, senão a praça, a rua e, por último, a grama */
const CHAO_PREF=[3,7,2,8,10,0,9];
function chaoVizinho(t,tem,w,h,x,y){
  let melhor=-1;
  for(const[a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    if(a<0||b<0||a>=w||b>=h||!tem[b*w+a])continue;const v=t[b*w+a],r=CHAO_PREF.indexOf(v);
    if(r>=0&&(melhor<0||r<CHAO_PREF.indexOf(melhor)))melhor=v}
  return melhor<0?0:melhor;
}
export let C=null;
/* lê o mapa do conteúdo; dePortao põe o jogador na frente de quem leva às
   caçadas, que é por onde se volta de uma incursão: o NPC de chave dePortao
   (o Capitão para quem volta da ilha), ou o da Masmorra de Runas (o Guia) */
export function entraCidade(dePortao){
  const M=CITY.mapa,h=M.length,w=M[0].length,t=new Uint8Array(w*h),sol=new Uint8Array(w*h),fora=new Uint8Array(w*h),obj=new Uint8Array(w*h),tem=new Uint8Array(w*h);
  let sx=1,sy=1;const npcs=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const c=M[y][x],i=y*w+x;
    if(c==='@'){sx=x;sy=y}
    const k=npcDaLetra(c);
    /* um lugar (lugar: true, a grade do esgoto) fica no chão: pisa-se nele */
    if(k){npcs.push({k,n:CITY.npcs[k],x:(x+.5)*T,y:(y+.5)*T});sol[i]=CITY.npcs[k].lugar?0:1;continue}
    if(c in OBJETOS){obj[i]=LISTA_OBJ.indexOf(OBJETOS[c])+1;sol[i]=1;continue}
    t[i]=LEGENDA[c];sol[i]=SOLIDO[t[i]];tem[i]=1;
  }
  /* o chão debaixo do NPC e do objeto é o do vizinho: assoalho dentro de
     casa, pedra na praça, grama no pomar */
  for(let i=0;i<w*h;i++)if(!tem[i])t[i]=chaoVizinho(t,tem,w,h,i%w,i/w|0);
  /* as paredes saem como as de uma sala da masmorra, com o assoalho (ou a
     pedra do templo) de dentro fazendo o papel do chão: o resto conta como rocha */
  for(let i=0;i<w*h;i++)fora[i]=t[i]===3||t[i]===7?0:1;
  if(dePortao){const g=npcs.find(n=>n.k===dePortao)||npcs.find(n=>n.k===HUNTS[cacaDe()].npc);if(g){sx=g.x/T|0;sy=(g.y/T|0)-(g.n.lugar?0:1)}}
  C={w,h,t,sol,obj,par:pecas(fora,w,h),npcs,outros:OUTROS,p:{x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,r:11,face:Math.PI/2,walk:0,mv:false},perto:null,t0:0};
  /* peças de teste no chão (city.chao): só as que esta conta ainda não pegou */
  C.chao=(CITY.chao||[]).filter(c=>!(save.chao&&save.chao[c.x+','+c.y])).map(c=>({x:c.x,y:c.y,k:c.item}));
  poeNoSqm(C.p,sx,sy);
  return C;
}
export const npcDaLetra=c=>{for(const k in CITY.npcs)if(CITY.npcs[k].letra===c)return k;return null};
/* física da cidade: o mesmo andar por sqm da incursão (base.js), na grade da
   cidade; jogadores não se bloqueiam */
const livreC=(x,y)=>x>=0&&y>=0&&x<C.w&&y<C.h&&C.sol[y*C.w+x]!==1;
/* ent é a mesma entrada da incursão ({x,y} do movimento); devolve a chave do
   NPC ao alcance de uma conversa, ou null */
export function updateCidade(dt,ent){
  const p=C.p;C.t0+=dt;
  const sobra=avanca(p,dt);
  if(sobra>=0){
    const i=dir8(ent.x,ent.y),j=i<0?-1:passoPara(p,i,livreC,ent.x,ent.y);
    if(j>=0){const d=DIR8[j],sd=durPasso(ch());comeca(p,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd,sobra)}
    else if(i>=0)p.face=Math.atan2(DIR8[i][1],DIR8[i][0]);
  }
  p.mv=p.sd>0;if(p.mv)p.walk+=dt*12;
  /* pisou numa peça do chão: ela vai para o cofre do Banco */
  for(let i=C.chao.length-1;i>=0;i--){const c=C.chao[i];if(c.x!==p.tx||c.y!==p.ty)continue;
    C.chao.splice(i,1);
    if(pegaDoChao(c.x+','+c.y,c.k)){saida.log(`Você pegou ${ITEMS[c.k].nome}. Está no cofre do Banco.`,'info');saida.persist()}}
  let melhor=null,md=T*1.75;
  for(const n of C.npcs){const d=hyp(n.x-p.x,n.y-p.y);if(d<md){md=d;melhor=n.k}}
  C.perto=melhor;
  dtS=dt;OUTROS.forEach(segue1);
  return melhor;
}

/* ---------- os outros ----------
   Quem mais está na cidade chega pela rede (src/rede.js), que só escreve aqui,
   por poeOutro() e tiraOutro(). É dado de fora, então tudo é conferido: número
   preso ao mapa, classe que existe, nome curto e sem caractere de controle,
   peça que existe e é daquele espaço (o equipamento só se vê, não vale nada aqui).
   Cada mensagem é um passo ("fui para o sqm tal, levo d ms"), e o boneco do
   outro anda aquele passo com a mesma duração: o que se vê é o que ele fez,
   um passo atrás, sem adivinhar caminho. Nada daqui é regra de jogo: na cidade não se
   ganha nem se perde nada, e é por isso que ela pode ser o primeiro teste do
   multiplayer sem servidor próprio. */
export const OUTROS=new Map(),MAX_OUTROS=40;
const num=(v,a,b,pad)=>typeof v==='number'&&isFinite(v)?Math.min(b,Math.max(a,v)):pad;
export function poeOutro(id,d){
  if(typeof id!=='string'||!id||id.length>40)return null;
  let o=OUTROS.get(id);
  if(!o){if(OUTROS.size>=MAX_OUTROS)return null;
    o={id,nome:'…',classe:'feiticeiro',lvl:1,x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,vis:false,r:11,face:Math.PI/2,walk:0,mv:false,flash:0,swing:0,eq:{arma:null,armadura:null,amuleto:null}};OUTROS.set(id,o)}
  if(typeof d.nome==='string'){const n=d.nome.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16);if(n)o.nome=n}
  if(typeof d.classe==='string'&&CLASSES[d.classe])o.classe=d.classe;
  o.lvl=Math.round(num(d.lvl,1,999,o.lvl));
  if(d.eq&&typeof d.eq==='object')for(const sl of SLOTS_EQ){const k=d.eq[sl];o.eq[sl]=typeof k==='string'&&Object.prototype.hasOwnProperty.call(ITEMS,k)&&ITEMS[k].slot===sl?k:null}
  /* x, y: o sqm para onde foi; d: quanto o passo dura, em ms (0: chegou lá
     sem andar, como ao entrar na cidade). Longe demais do último sqm
     (mensagem perdida, aba que voltou do fundo), salta direto */
  if(d.x!==undefined&&d.y!==undefined&&C){
    const tx=Math.round(num(d.x,0,C.w-1,o.tx)),ty=Math.round(num(d.y,0,C.h-1,o.ty)),sd=num(d.d,0,2000,0)/1000;
    if(!o.vis||!sd||Math.max(Math.abs(tx-o.tx),Math.abs(ty-o.ty))>3){poeNoSqm(o,tx,ty);o.vis=true}
    else if(tx!==o.tx||ty!==o.ty)comeca(o,tx-o.tx,ty-o.ty,sd);
  }
  return o;
}
export const tiraOutro=id=>OUTROS.delete(id);
let dtS=0;const segue1=o=>segue(o,dtS);
function segue(o,dt){if(!o.vis)return;avanca(o,dt);o.mv=o.sd>0;if(o.mv)o.walk+=dt*12}
