/* ---------- estado da incursão ---------- */
import {T,MW,MH,RUN,PORTAL_AT,EXT,TAU,TICK,rnd,rr,ri,frr,sorte,semeia,semente,novaSemente,hyp,DIRS,saida,DIR8,poeNoSqm,comeca,avanca,dir8,passoPara,sorteAgora,poeSorte} from './base.js?v=0.48.0';
import {EL_COR,MT,PROG,CLASSES,HUNTS,SPELLS,ITEMS,cacaDe} from './dados.js?v=0.48.0';
import {save,ch,stats,sealPct,perdaXp,durPasso,passoDaVel,confereFicha,efeitoProv,soMochila,valMochila,ehComida} from './progresso.js?v=0.48.0';
import {leMapa,pecas} from './mapa.js?v=0.48.0';
import {bf,lancarSlot,atingir,explode,hitMon,hurtPlayer,pickup,efeito,podeFerir} from './combate.js?v=0.48.0';

export let G=null;
export const setG=v=>{G=v};
/* o chefe é do mapa de caça (G.caca); sem ele, o de progression */
const chefe=()=>HUNTS[G.caca].boss||PROG.boss;
function spawn(k,r,d,boss){
  const n0=G.mons.length;spawn0(k,r,d,boss);if(G.mons.length>n0)G.mons[n0].sala=r.i;
}
function spawn0(k,r,d,boss){
  /* o mundo é igual para todos: a vida vem do lugar (a profundidade), nunca
     do nível nem do tamanho do grupo de quem entra */
  const t=MT[k],sc=PROG.scaling,hpm=boss?1:1+sc.hpPerDepth*d;
  /* um monstro por sqm: se o sorteado já tem dono, o monstro não nasce. O
     chefe nasce sempre: com o sqm dele ocupado, vai para o livre mais perto
     do centro da sala (sem sorteio, para não mudar a masmorra de ninguém) */
  /* o mapa é fixo: cada monstro tem o ponto dele, sempre o mesmo sqm */
  let tx=r.cx,ty=r.cy;
  /* ponto ocupado (um jogador, outro monstro): espera o próximo respawn */
  if(G.ocu[ty*MW+tx]||G.g[ty*MW+tx])return;G.ocu[ty*MW+tx]=1;
  const hp=Math.round(t.hp*hpm);
  G.mons.push({id:G.nid++,k,t,x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,hp,mhp:hp,r:t.r,spd:t.spd,dmg:Math.round(t.dmg*(1+sc.dmgPerDepth*d)),xpm:1+sc.xpPerDepth*d,atkCd:rr(0,1),flash:0,aggro:false,wt:0,anim:frr(0,9),mv:0,face:frr(0,TAU),slow:0,slowF:1,dot:null,dn:G.ps.map(()=>0)});
  poeNoSqm(G.mons[G.mons.length-1],tx,ty);
}
/* ---------- jogadores ----------
   Solo é um grupo de um: a incursão sempre tem uma lista de jogadores, G.ps,
   e a regra não lê o save para saber quem joga. Cada jogador nasce de uma
   ficha {cl, c, up, prov, local}: a classe, o personagem (lvl, xp, mag, per,
   slots, equip), as melhorias da conta, as provisões que ele leva e se ele é
   o dono do save deste aparelho. No solo a ficha aponta para o próprio personagem do save, então
   nível, Magia e Perícia que sobem na incursão já ficam nele, como antes; o
   servidor da F2 monta as fichas do banco. O que é da conta (cofre, peças,
   estatísticas) só muda para a ficha local, em sai(). */
export const fichaLocal=()=>({cl:save.classe,c:ch(),up:save.up,prov:save.prov,local:true,time:meuTime});
/* o time da Arena deste aparelho: quem digita o mesmo código não se fere lá
   dentro. Fica fora do save: vale enquanto o jogo está aberto */
export let meuTime='';
export const poeTime=v=>{meuTime=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)};
/* onde cada jogador aparece na sala de entrada, em sqm a partir do centro;
   jogadores não se bloqueiam (só monstros ocupam sqm) */
const LADO=[[0,0],[1,0],[-1,0],[0,1]];
/* as provisões (p.prov, o que sai do estoque quando a caçada começa) dão
   poções e buffs do começo (p.sup), que somam aos das habilidades em vez de
   serem trocados por eles. A comida está na mochila (p.bag), como o loot.
   Todo mundo entra com fome (p.ali, os segundos de alimentação, em zero):
   sem comer, não se regenera nada */
function novoJogador(f,i,s){
  const st=stats(f.c,f.cl,f.up),o=LADO[i]||LADO[0],e=efeitoProv(f.prov);
  const p={id:i,cl:f.cl,c:f.c,up:f.up,local:!!f.local,nome:f.nome||'',time:f.time||'',pk:0,prov:Object.assign({},f.prov),
    x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,r:11,face:0,hp:st.mhp,mhp:st.mhp,mp:st.mmp,mmp:st.mmp,
    cds:{},gcd:{ataque:0,cura:0,apoio:0},buffs:{},sup:e.buffs,ali:0,cdCo:0,cdC:0,pot:3+f.up.bolsa+e.pot,flash:0,walk:0,mv:false,swing:0,swingA:0,swingR:0,
    pch:0,bag:{},bagVal:0,kills:0,xpGain:0,magGain:0,perGain:0,fora:null,sealed:0,ouroExt:0,pecas:0,mats:0,xpPerdido:0};
  /* a mochila entra inteira (p.bag é ela durante a caçada); bag0 é como
     entrou, para o banco só contar como origem o que a caçada rendeu */
  const mo=soMochila(f.c.mochila);for(const k in mo)p.bag[k]=(p.bag[k]|0)+mo[k];p.bagVal=valMochila(p.bag);p.bag0=mo;
  poeNoSqm(p,s.cx+o[0],s.cy+o[1]);return p;
}
/* s é a semente da incursão: a mesma semente dá a mesma masmorra. Sem ela,
   sorteia uma nova (é o caso normal do jogador). fichas são os jogadores;
   sem elas, o personagem do save sozinho. aberta é a masmorra da sala (ver
   "masmorra aberta" abaixo): sem tempo, com a porta na sala de entrada.
   caca é o mapa de caça (hunts no content.json). O mapa e os pontos de
   spawn são fixos (pilar 2): a semente só sorteia o que acontece na caçada
   (dano, loot, movimento), nunca o lugar */
export function newRun(s0=novaSemente(),fichas=[fichaLocal()],aberta=false,caca){
  semeia(s0);caca=cacaDe(caca);const A=HUNTS[caca].arena;
  /* rooms[0] é a porta; cada ponto de spawn é uma "sala" de um monstro,
     com a profundidade dele (a distância andando desde a porta) */
  const M=leMapa(HUNTS[caca].mapa),g=M.g.slice(),e=M.entrada,s={x:e.x-1,y:e.y-1,w:3,h:3,cx:e.x,cy:e.y},
    rooms=[s,...M.pontos.map(q=>({x:q.x,y:q.y,w:1,h:1,cx:q.x,cy:q.y,tipo:q.k,prof:MT[q.k].boss?1:q.prof,base:1,esp:0}))],
    pr=rooms.find(r=>r.tipo&&MT[r.tipo].boss)||rooms[rooms.length-1];
  const ps=fichas.map((f,i)=>novoJogador(f,i,A?entradaDe(A,f,i):s));
  /* G.p é o jogador deste aparelho, para a tela; a regra só usa G.ps */
  G={g,pi:M.pi,pilhas:M.pilhas,rooms,par:pecas(g),cad:[],seen:new Uint8Array(MW*MH),flow:new Int16Array(MW*MH).fill(-1),fdono:new Uint8Array(MW*MH),fsrc:[],ocu:new Uint8Array(MW*MH),flowT:0,ps,p:ps[0],
     nid:0,mons:[],proj:[],drops:[],fx:[],torches:[],pend:[],
     t:0,kills:0,caca,portal:aberta?{x:(s.cx+.5)*T,y:(s.cy+.5)*T,open:true}:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false},aberta,arena:!!A,arC:-1,arF:[],arT:0,respT:0,over:false,active:false,shake:0,warned:false,miniT:0,end:null,dur:0,acc:0,alfa:1,semente};
  for(const p of ps)G.ocu[p.ty*MW+p.tx]=1;
  rooms.forEach((r,i)=>{r.i=i});
  for(const r of rooms)if(r.tipo)spawn(r.tipo,r,r.prof,!!MT[r.tipo].boss);
  for(const p of ps)G.ocu[p.ty*MW+p.tx]=0;
  if(A){const[cx,cy]=xy(A.pontos.saidas[0]);G.portal={x:(cx+.5)*T,y:(cy+.5)*T,open:false}}
  revela();
}

/* ---------- física ----------
   Andar é por sqm (passo de sqm, em base.js). G.ocu marca os sqm com monstro:
   monstro não entra em sqm de monstro nem de jogador, e jogador não entra em
   sqm de monstro — é o bloqueio de corpo do Tibia, que deixa o cavaleiro
   segurar o corredor. Jogadores não se bloqueiam entre si. */
/* parede (1) e objeto do lugar (2, ver mapa.js) são sólidos */
export const solid=(x,y)=>x<0||y<0||x>=MW||y>=MH||G.g[y*MW+x]!==0;
const temJogador=(x,y)=>{for(const p of G.ps)if(!p.fora&&p.tx===x&&p.ty===y)return true;return false};
const livreP=(x,y)=>!solid(x,y)&&!G.ocu[y*MW+x];
const livreM=(x,y)=>livreP(x,y)&&!temJogador(x,y);
/* um monstro dá um passo: troca de sqm em G.ocu já no começo, como no Tibia */
function passoM(m,i,sd){
  const d=DIR8[i];G.ocu[m.ty*MW+m.tx]=0;
  comeca(m,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd);
  G.ocu[m.ty*MW+m.tx]=1;
}
const Q=new Int32Array(MW*MH);
/* a BFS parte de todos os jogadores que ainda estão na masmorra ao mesmo
   tempo: G.flow é a distância até o mais perto, e G.fdono diz qual é ele —
   é o alvo do monstro naquele tile. Mesmo custo de uma origem só */
function buildFlow(){
  /* de onde o campo partiu fica em G.fsrc: a herança da sala leva isto, para
     quem assume refazer o mesmo campo */
  const fs=G.fsrc;fs.length=0;
  for(let i=0;i<G.ps.length;i++){const p=G.ps[i];fs.push(p.fora?-1:p.ty*MW+p.tx)}
  fluxo(fs);
}
function fluxo(fs){
  const f=G.flow,o=G.fdono,g=G.g;f.fill(-1);let h=0,t=0;
  for(let i=0;i<fs.length;i++){const s=fs[i];if(s<0||s>=MW*MH)continue;
    if(f[s]<0){f[s]=0;o[s]=i;Q[t++]=s}}
  while(h<t){
    const c=Q[h++],v=f[c],w=o[c];if(v>=22)continue;
    const x=c%MW,y=(c/MW)|0;
    if(x>0&&g[c-1]===0&&f[c-1]<0){f[c-1]=v+1;o[c-1]=w;Q[t++]=c-1}
    if(x<MW-1&&g[c+1]===0&&f[c+1]<0){f[c+1]=v+1;o[c+1]=w;Q[t++]=c+1}
    if(y>0&&g[c-MW]===0&&f[c-MW]<0){f[c-MW]=v+1;o[c-MW]=w;Q[t++]=c-MW}
    if(y<MH-1&&g[c+MW]===0&&f[c+MW]<0){f[c+MW]=v+1;o[c+MW]=w;Q[t++]=c+MW}
  }
}
export const flowAt=e=>G.flow[e.ty*MW+e.tx];
function reveal(p){
  const tx=p.x/T|0,ty=p.y/T|0;
  for(let j=-7;j<=7;j++)for(let i=-7;i<=7;i++){
    if(i*i+j*j>52)continue;const x=tx+i,y=ty+j;
    if(x>=0&&y>=0&&x<MW&&y<MH)G.seen[y*MW+x]=1;
  }
}
function revela(){for(const p of G.ps)if(!p.fora)reveal(p)}

/* ---------- efeitos ----------
   Efeitos visuais são dados do estado (G.fx, G.shake); quem desenha é o
   render(), que também é quem respeita prefers-reduced-motion. */
export const num=(x,y,txt,col,big)=>G.fx.push({k:'num',x:x+frr(-4,4),y,txt:String(txt),col,big,t:0,life:1});
export const shake=v=>{G.shake=Math.max(G.shake,v)};
export function spark(x,y,col){for(let i=0;i<6;i++){const a=frr(0,TAU),s=frr(30,90);G.fx.push({k:'sp',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,col,t:0,life:.35})}}

/* ---------- passo fixo ----------
   O cliente chama passo() uma vez por quadro, com o tempo real do quadro; a
   regra só anda em update(TICK), quantas vezes couberem no tempo acumulado.
   Assim a mesma semente e as mesmas entradas dão o mesmo resultado a 30, 60
   ou 120 quadros por segundo, no celular, no Node e no servidor. Os efeitos
   (G.fx, G.shake) não são regra e andam no tempo real, para não pular.
   G.alfa diz quanto do passo seguinte já passou: o render() desenha entre a
   posição do passo anterior (x0, y0) e a atual. */
export function passo(dt,ent){
  G.acc+=dt;
  while(G.acc>=TICK&&!G.over){G.acc-=TICK;update(TICK,ent)}
  efeitos(dt);G.alfa=G.over?1:G.acc/TICK;
}
function efeitos(dt){
  for(let i=G.fx.length-1;i>=0;i--){const f=G.fx[i];f.t+=dt;if(f.vx!==undefined){f.x+=f.vx*dt;f.y+=f.vy*dt}if(f.t>=f.life)G.fx.splice(i,1)}
  G.shake=Math.max(0,G.shake-dt*30);
}
/* a posição de antes do passo, que o render() usa para interpolar */
function guarda(){
  for(const p of G.ps){p.x0=p.x;p.y0=p.y;p.w0=p.walk}
  for(const m of G.mons){m.x0=m.x;m.y0=m.y;m.a0=m.anim}
  for(const q of G.proj){q.x0=q.x;q.y0=q.y}
}

/* ---------- atualização ----------
   Um passo da regra; fora dos testes, quem chama é passo(), sempre com TICK.
   ent é a entrada do quadro, montada pelo cliente em src/controles.js:
   {x,y} do movimento (comprimento até 1), held[4] dos espaços seguros e,
   opcionais, mira[4] (a direção de cada um; NaN é para onde o jogador olha)
   e alc[4] (de 0 a 1, quão longe a bomba cai). Com
   mais de um jogador, ent é uma lista, uma entrada por jogador de G.ps. */
const UM=[null],PARADO={x:0,y:0,held:[false,false,false,false]};
export function update(dt,ent){
  const ents=Array.isArray(ent)?ent:(UM[0]=ent,UM);
  guarda();G.t+=dt;
  G.flowT-=dt;if(G.flowT<=0){buildFlow();G.flowT=.2}
  for(const p of G.ps)if(!p.fora)anda(p,dt,ents[p.id]||PARADO);
  for(let i=G.pend.length-1;i>=0;i--){const q=G.pend[i];q.t-=dt;if(q.t<=0){G.pend.splice(i,1);q.fn();if(G.over)return}}
  for(const p of G.ps){if(p.fora)continue;const e=ents[p.id]||PARADO;for(let i=0;i<4;i++)if(e.held[i])lancarSlot(i,p,e.mira?e.mira[i]:NaN,e.alc?e.alc[i]:1)}
  revela();
  updateMons(dt);if(G.over)return;
  updateProj(dt);if(G.over)return;
  /* o loot é único: o primeiro que encosta leva, mas nos primeiros
     lootProtection segundos só quem causou mais dano no monstro (d.dono) */
  const prot=PROG.party.lootProtection;
  for(let i=G.drops.length-1;i>=0;i--){const d=G.drops[i];d.t+=dt;
    for(const p of G.ps){if(p.fora||(p.id!==d.dono&&d.t<prot))continue;
      if(hyp(d.x-p.x,d.y-p.y)<p.r+16){pickup(d,i,p);break}}}
  if(G.arena){arena(dt);if(G.over)return;return repovoa(dt)}
  const po=G.portal;
  if(!po.open&&G.t>=PORTAL_AT){po.open=true;saida.banner('Portal de saída aberto');saida.log(`Um portal se abriu na sala de ${MT[chefe().type].nome}. Siga o ponto dourado no mapa.`,'info')}
  /* a extração é de cada um: quem fica parado no portal sai com o próprio saco */
  if(po.open)for(const p of G.ps){
    if(p.fora)continue;
    /* na porta da sala só sai quem já se afastou dela: todos entram por ela */
    const d=hyp(p.x-po.x,p.y-po.y);if(d>64)p.longe=true;
    if(d<38&&(p.longe||!G.aberta)){p.pch+=dt;if(p.pch>=EXT){sai(p,'extraiu');if(G.over)return}}
    else p.pch=Math.max(0,p.pch-dt*2);
  }
  if(G.aberta)return repovoa(dt);
  const left=RUN-G.t;
  if(left<=60&&!G.warned){G.warned=true;saida.banner('A masmorra está desabando');saida.log('Falta 1 minuto. Chegue ao portal ou perca o saco.','warn')}
  if(left<=0)finish('desabou');
}
/* o passo pelo joystick: um de cada vez, e o joystick só escolhe o próximo
   quando o atual acaba. O convidado de uma sala anda assim no próprio
   aparelho e conta ao anfitrião em que sqm está (ver anda) */
export function movimenta(p,dt,ent){
  const sobra=avanca(p,dt);
  if(sobra>=0){
    const i=dir8(ent.x,ent.y),j=i<0?-1:passoPara(p,i,livreP,ent.x,ent.y);
    if(j>=0){const d=DIR8[j],sd=durPasso(p.c,bf('velo',p));comeca(p,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd,sobra)}
    else if(i>=0)p.face=Math.atan2(DIR8[i][1],DIR8[i][0]);
  }
  p.mv=p.sd>0;if(p.mv)p.walk+=dt*12;
}
/* movimento, regeneração e recargas de um jogador. Com ent.pos (o convidado
   de uma sala, que anda no próprio aparelho), ent.pos é o sqm em que ele
   diz estar, e o anfitrião leva o boneco até lá um sqm por vez, na
   velocidade do nível e só por sqm livre: posição de fora nunca teleporta */
function anda(p,dt,ent){
  if(ent.pos){
    const sobra=avanca(p,dt),dx=ent.pos.x-p.tx,dy=ent.pos.y-p.ty;
    if(sobra>=0&&(dx||dy)){
      const i=dir8(dx,dy),j=i<0?-1:passoPara(p,i,livreP,dx,dy);
      if(j>=0){const d=DIR8[j],sd=durPasso(p.c,bf('velo',p));comeca(p,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd,sobra)}
    }
    if(!p.sd&&Number.isFinite(ent.f))p.face=ent.f;
    p.mv=p.sd>0;if(p.mv)p.walk+=dt*12;
  }else movimenta(p,dt,ent);
  /* regeneração da classe, fixa, só enquanto houver alimentação */
  if(p.ali>0){const K=CLASSES[p.cl];
    p.mp=Math.min(p.mmp,p.mp+K.rmp*dt);p.hp=Math.min(p.mhp,p.hp+K.rhp*dt);
    p.ali-=dt;if(p.ali<=0){p.ali=0;saida.log('Você está com fome: sem comer, não se regenera vida nem mana.','warn',p)}}
  p.cdC-=dt;p.cdCo-=dt;p.flash-=dt;p.swing-=dt;
  for(const k in p.cds)if(p.cds[k]>0)p.cds[k]-=dt;
  for(const k in p.gcd)if(p.gcd[k]>0)p.gcd[k]-=dt;
  for(const k in p.buffs){p.buffs[k].left-=dt;if(p.buffs[k].left<=0)delete p.buffs[k]}
  for(const k in p.sup){p.sup[k].left-=dt;if(p.sup[k].left<=0)delete p.sup[k]}
}
/* fora da incursão (menu por cima do mapa, tela final) só os efeitos andam */
export function parado(dt){G.t+=dt;G.alfa=1;efeitos(dt)}
function updateMons(dt){
  const f=G.flow,o=G.ocu;
  /* quem morreu desocupa o sqm: a grade é refeita a cada passo da regra */
  o.fill(0);for(const m of G.mons)if(m.hp>0)o[m.ty*MW+m.tx]=1;
  for(const m of G.mons.slice()){
    if(m.hp<=0)continue;
    m.atkCd-=dt;m.flash-=dt;m.anim+=dt;m.mv=0;
    if(m.slow>0){m.slow-=dt;if(m.slow<=0)m.slowF=1}
    if(m.dot){m.dot.left-=dt;m.dot.tick+=dt;
      if(m.dot.tick>=.5){m.dot.tick=0;hitMon(m,Math.max(1,Math.round(m.dot.dps*.5)),EL_COR[m.dot.el],m.dot.p);
        G.fx.push({k:'sp',x:m.x+frr(-6,6),y:m.y+frr(-6,6),vx:0,vy:-24,col:EL_COR[m.dot.el],t:0,life:.4});
        if(m.hp<=0)continue}
      if(m.dot.left<=0)m.dot=null}
    /* um passo de cada vez; o próximo só é escolhido quando o atual acaba.
       spd é a velocidade do Tibia, e a lentidão (slowF) a reduz */
    const livreAgora=avanca(m,dt)>=0,sd=passoDaVel(m.spd*m.slowF);
    m.mv=m.sd>0?1:0;
    /* o alvo é o jogador mais perto pelo campo de fluxo */
    const tx=m.tx,ty=m.ty,fd=f[ty*MW+tx];
    let p=fd>=0?G.ps[G.fdono[ty*MW+tx]]:null;if(p&&p.fora)p=null;
    if(p&&fd<=(m.t.boss?7:9))m.aggro=true;else if(!p||fd>18)m.aggro=false;
    if(m.aggro){
      const dx=p.x-m.x,dy=p.y-m.y,dist=hyp(dx,dy)||1;
      if(!m.mv)m.face=Math.atan2(dy,dx);
      /* corpo a corpo é sqm vizinho, diagonal inclusive, como no Tibia */
      const junto=Math.max(Math.abs(p.tx-tx),Math.abs(p.ty-ty))<=1;
      if(m.t.ranged&&dist<T*5.5&&fd>=0&&fd<=7){
        if(m.atkCd<=0){m.atkCd=m.t.atk;const s=230;G.proj.push({k:'m',x:m.x,y:m.y-6,vx:dx/dist*s,vy:dy/dist*s,dmg:ri(Math.round(m.dmg*.7),m.dmg),life:2.5})}
        /* o xamã recua um sqm quando o jogador chega perto demais */
        if(livreAgora&&dist<T*2){
          let bi=-1,bd=dist;
          for(let i=0;i<8;i++){const d=DIR8[i],nx=tx+d[0],ny=ty+d[1];if(!livreM(nx,ny)||(d[0]&&d[1]&&(!livreM(tx+d[0],ty)||!livreM(tx,ty+d[1]))))continue;
            const dd=hyp(p.x-(nx+.5)*T,p.y-(ny+.5)*T);if(dd>bd){bd=dd;bi=i}}
          if(bi>=0)passoM(m,bi,sd);
        }
      }else if(junto){
        if(m.atkCd<=0){m.atkCd=m.t.atk;hurtPlayer(p,ri(Math.round(m.dmg*.7),m.dmg));if(G.over)return}
      }else if(livreAgora&&fd>0){
        /* desce o campo de fluxo; se o caminho está ocupado, contorna por um
           sqm de mesma distância (é assim que os monstros cercam) */
        let best=fd,bi=-1,lado=-1;
        for(let i=0;i<8;i++){
          const d=DIR8[i],nx=tx+d[0],ny=ty+d[1];if(!livreM(nx,ny))continue;
          if(d[0]&&d[1]&&(solid(tx+d[0],ty)||solid(tx,ty+d[1])))continue;
          const v=f[ny*MW+nx];if(v<0)continue;
          if(v<best){best=v;bi=i}else if(v===fd&&lado<0)lado=i;
        }
        if(bi<0&&fd<=3)bi=lado;
        if(bi>=0)passoM(m,bi,sd);
      }
    }else if(livreAgora){
      m.wt-=dt;if(m.wt<=0){m.wt=rr(1,3);
        if(sorte()<.45){const i=rnd(8),d=DIR8[i];if(livreM(tx+d[0],ty+d[1])&&!(d[0]&&d[1]&&(solid(tx+d[0],ty)||solid(tx,ty+d[1]))))passoM(m,i,sd*PROG.walk.wander)}}
    }
    m.mv=m.sd>0?1:0;
  }
}
function updateProj(dt){
  for(let i=G.proj.length-1;i>=0;i--){
    const q=G.proj[i];q.life-=dt;let dead=q.life<=0;
    if(q.k==='b'){
      /* o tiro do jogador vai reto: o primeiro monstro no caminho leva, a
         parede para, e no fim do alcance ele se desfaz com o mesmo efeito */
      q.x+=q.vx*dt;q.y+=q.vy*dt;
      let alvo=null;for(const m of G.mons)if(m.hp>0&&hyp(m.x-q.x,m.y-q.y)<m.r+6){alvo=m;break}
      /* na Arena, o adversário no caminho também leva */
      if(!alvo&&G.arena)for(const o of G.ps)if(podeFerir(q.p,o)&&hyp(o.x-q.x,o.y-q.y)<o.r+6){alvo=o;break}
      if(alvo){atingir(alvo,q.s,1,q.p);spark(q.x,q.y,q.col);dead=true}
      else if(solid(q.x/T|0,q.y/T|0)||dead){efeito(q.x-q.vx*dt,q.y-q.vy*dt,q.s.el);spark(q.x,q.y,q.col);dead=true}
    }else if(q.k==='r'){
      const dx=q.tx-q.x,dy=q.ty-q.y,d=hyp(dx,dy),pa=430*dt;
      if(d<=pa){explode(q.tx,q.ty,q.s,q.p);dead=true}else{q.x+=dx/d*pa;q.y+=dy/d*pa}
    }else{
      q.x+=q.vx*dt;q.y+=q.vy*dt;
      if(solid(q.x/T|0,q.y/T|0)){spark(q.x,q.y,'#9fd36b');dead=true}
      else for(const p of G.ps)if(!p.fora&&hyp(q.x-p.x,q.y-p.y)<p.r+5){hurtPlayer(p,q.dmg);dead=true;if(G.over)return;break}
    }
    if(dead){const k=G.proj.indexOf(q);if(k>=0)G.proj.splice(k,1)}
  }
}
/* um jogador sai da incursão: pelo portal ('extraiu'), morto ('morreu') ou
   soterrado ('desabou'). Extraindo, a mochila sai como está (nada vai sozinho
   para o cofre: guardar é no Banco); morrendo, fica toda na masmorra. A perda
   de XP, a mochila e o Selo valem para a ficha de qualquer um; cofre e
   estatísticas só para a ficha local. Quem sai não volta, e a sala acaba
   quando não sobra ninguém dentro */
export function sai(p,kind){
  if(G.over||p.fora)return;p.fora=kind;
  if(kind==='extraiu'){p.c.mochila=Object.assign({},p.bag);if(p.local){save.ext++;save.best=Math.max(save.best,p.bagVal-valMochila(p.bag0||{}))}}
  else{p.sealed=G.arena?0:Math.round(p.bagVal*sealPct(p.up));p.xpPerdido=perdaXp(p.c);p.c.xp-=p.xpPerdido;p.c.mochila={};
    if(G.arena)largaMochila(p);
    if(p.local){save.deaths++;if(p.sealed)save.cofre+=p.sealed}}
  if(p.local)saida.persist();
  saida.sai(p);
  /* a masmorra da sala continua aberta para quem entrar depois */
  if(G.aberta)return;
  for(const q of G.ps)if(!q.fora)return;
  G.over=true;G.end=kind;G.dur=G.t;
  saida.persist();
  if(kind!=='extraiu')shake(8);
  saida.fim(kind);
}
/* ---------- masmorra aberta ----------
   A masmorra da sala (caçar junto, src/sala.js): não tem tempo nem desaba,
   fica aberta enquanto a sala existir. A porta é o portal, na sala de
   entrada: todos entram por ela (entra()) e saem por ela com o saco, quando
   quiserem; quem sai ou morre pode entrar de novo, com ficha nova. Os
   monstros renascem como no Tibia (progression.respawn): sala com menos que
   o normal repovoa depois de um tempo, se não houver jogador perto. O normal
   cresce com quem está dentro, pelas regras de grupo. */
export function entra(i,f){
  const A=G.arena&&HUNTS[G.caca].arena,s=k=>A?entradaDe(A,f,k):G.rooms[0];
  const p=novoJogador(f,i,s(i));G.ps[i]=p;
  for(let k=0;k<i;k++)if(!G.ps[k]){G.ps[k]=novoJogador(f,k,s(k));G.ps[k].fora='fora'}
  return p;
}
function repovoa(dt){
  G.respT+=dt;if(G.respT<1)return;
  const pas=G.respT;G.respT=0;
  const R=PROG.respawn,dentro=G.ps.filter(p=>!p.fora),perto=R.clearTiles*T;
  for(const r of G.rooms){
    if(!r.tipo)continue;
    /* cada ponto renasce o monstro dele, como o spawn do Tibia */
    const vivos=G.mons.filter(m=>m.sala===r.i),alvo=r.base;
    if(vivos.length>=alvo){r.esp=0;continue}
    r.esp=(r.esp||0)+pas;
    if(r.esp<R.seconds||dentro.some(p=>hyp(p.x-(r.cx+.5)*T,p.y-(r.cy+.5)*T)<perto))continue;
    r.esp=0;
    for(let falta=alvo-vivos.length;falta>0;falta--)spawn(r.tipo,r,r.prof,!!MT[r.tipo].boss);
  }
}
/* a sala acaba para todos que ainda estão nela (o desabamento, ou o teste) */
export function finish(kind){if(G.over)return;for(const p of G.ps)if(!p.fora)sai(p,kind)}

/* ---------- arena ----------
   A Arena (decisão do Leonardo em 19/10/2026) é a masmorra aberta de uma
   sala com relógio: uma partida de A.dur segundos que recomeça sozinha,
   enquanto o servidor da sala estiver de pé. O relógio é dela, não de quem
   entra: quem chega no meio tem menos tempo, e depois de A.entraAte a porta
   só abre na partida seguinte. Cada time nasce num canto (entradaDe), os
   anéis desabam da borda ao centro, os chefes nascem no centro pelas fases,
   e só se sai pelas saídas do centro, depois de A.saidas. No fim, quem não
   saiu morre soterrado, e a partida seguinte começa com os monstros de novo.
   Ferir outro jogador é aqui, e só aqui (podeFerir, em combate.js) */
const xy=t=>String(t).trim().split(/\s+/).map(Number);
const hashT=t=>{let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))>>>0;return h};
/* o canto de cada um: o time inteiro no mesmo; sem time, um por jogador */
function entradaDe(A,f,i){const E=A.pontos.entradas,[cx,cy]=xy(E[(f&&f.time?hashT(f.time):i)%E.length]);return{cx,cy}}
export const tempoArena=()=>{const A=HUNTS[G.caca].arena;return G.t-Math.floor(G.t/A.dur)*A.dur};
/* a porta da Arena só abre no começo de cada partida */
export const arenaFechada=()=>!!(G&&G.arena&&tempoArena()>=HUNTS[G.caca].arena.entraAte);
export const reabreEm=()=>{const A=HUNTS[G.caca].arena;return A.dur-tempoArena()};
/* o anel de agora: até onde, contado do centro, o chão ainda está de pé */
export function raioArena(){const A=HUNTS[G.caca].arena,t=tempoArena();let r=99;for(const a of A.aneis)if(t>=a.t)r=a.r;return r}
const foraDoAnel=(p,c,r)=>Math.max(Math.abs(p.tx-c[0]),Math.abs(p.ty-c[1]))>r;
function arena(dt){
  const A=HUNTS[G.caca].arena,ci=Math.floor(G.t/A.dur),t=G.t-ci*A.dur,c=xy(A.pontos.centro);
  if(ci!==G.arC){if(G.arC>=0)fimDaPartida();G.arC=ci}
  A.fases.forEach((f,i)=>{if(t<f.t||G.arF[i]===ci)return;G.arF[i]=ci;
    saida.banner(f.msg);saida.log(f.msg,f.chefe?'epic':'warn');if(f.chefe)chefeNoCentro(f.chefe,c)});
  const po=G.portal;po.open=t>=A.saidas;
  /* a saída é de cada um, como o portal: parado nela, sai com a mochila */
  for(const p of G.ps){if(p.fora)continue;
    let perto=false;if(po.open)for(const q of A.pontos.saidas){const[x,y]=xy(q);if(hyp(p.x-(x+.5)*T,p.y-(y+.5)*T)<38){perto=true;break}}
    if(perto){p.pch+=dt;if(p.pch>=EXT)sai(p,'extraiu')}else p.pch=Math.max(0,p.pch-dt*2)}
  /* o desabamento fere uma vez por segundo quem está fora do anel: a mesma
     fração da vida para todos, sem armadura */
  G.arT+=dt;if(G.arT>=1){G.arT-=1;const r=raioArena();
    for(const p of G.ps){if(p.fora||!foraDoAnel(p,c,r))continue;
      const d=Math.ceil(p.mhp*A.desaba);p.hp-=d;p.flash=.15;num(p.x,p.y-30,d,'#c9a36b',true);
      if(p.hp<=0){p.hp=0;saida.log('O chão desabou debaixo de você.','warn',p);sai(p,'desabou')}}}
}
/* o fim de uma partida: quem ficou é soterrado, e a arena volta como era,
   com os monstros do mapa nos pontos deles e sem nada no chão */
function fimDaPartida(){
  for(const p of G.ps)if(!p.fora){saida.log('A arena desabou com você dentro.','warn',p);sai(p,'desabou')}
  G.mons=[];G.proj=[];G.drops=[];G.pend=[];G.ocu.fill(0);
  for(const p of G.ps)if(!p.fora)G.ocu[p.ty*MW+p.tx]=1;
  for(const r of G.rooms){r.esp=0;if(r.tipo)spawn(r.tipo,r,r.prof,false)}
  G.ocu.fill(0);for(const m of G.mons)G.ocu[m.ty*MW+m.tx]=1;
}
/* o chefe da fase nasce no sqm livre mais perto do centro (o mesmo para
   todos: a busca não sorteia) e não renasce até a próxima partida */
function chefeNoCentro(k,c){
  for(let d=0;d<8;d++)for(let j=-d;j<=d;j++)for(let i=-d;i<=d;i++){
    if(Math.max(Math.abs(i),Math.abs(j))!==d)continue;const x=c[0]+i,y=c[1]+j;
    if(x<0||y<0||x>=MW||y>=MH||solid(x,y)||G.ocu[y*MW+x]||temJogador(x,y))continue;
    spawn0(k,{cx:x,cy:y},1,true);const m=G.mons[G.mons.length-1];if(m&&m.k===k)m.sala=-1;return}
}
/* quem morre na Arena larga a mochila inteira no chão, para quem chegar
   primeiro: o loot do adversário é de quem o derrubou, ou de quem passar */
function largaMochila(p){
  const items=Object.entries(p.bag).filter(([,q])=>q>0);if(!items.length)return;
  G.drops.push({x:p.x,y:p.y,items,rar:Math.max(...items.map(([k])=>ITEMS[k].rar)),t:PROG.party.lootProtection,dono:-1});
  saida.log(`${p.nome||CLASSES[p.cl].nome} caiu, e a mochila ficou no chão.`,'loot');
}

/* ---------- retrato da sala ----------
   Na sala (caçar junto, src/sala.js), quem roda a regra é o aparelho do
   anfitrião; os convidados só desenham. retrato() é o estado que ele manda,
   umas 10 vezes por segundo, em números e listas planas para caber no
   Realtime: monstros, jogadores, projéteis, sacos no chão e os efeitos e
   cadáveres novos desde o retrato anterior. O mapa não vai: o convidado gera
   o mesmo pela semente. aplicaRetrato() é o lado do convidado. */
let KMT=null,KEL=null;
const ks=()=>KMT||(KMT=Object.keys(MT)),kel=()=>KEL||(KEL=Object.keys(EL_COR));
const FXR={num:1,ef:1,cone:1,anel:1,feixe:1,boom:1};
const r1=v=>Math.round(v*100)/100;
/* quantas comidas há numa mochila (o botão Comer mostra; o convidado recebe pronto, em nc) */
export const nComida=bag=>{let n=0;for(const k in bag)if(ehComida(k))n+=bag[k];return n};
export function retrato(){
  const K=ks(),L=kel(),m=[],pr=[],fx=[],cad=[];
  for(const o of G.mons)m.push(o.id,K.indexOf(o.k),Math.round(o.x),Math.round(o.y),o.tx,o.ty,Math.ceil(o.hp),o.mhp,Math.round(o.face*100),(o.mv?1:0)|(o.flash>0?2:0));
  for(const q of G.proj)pr.push(q.k,Math.round(q.x),Math.round(q.y),Math.round((q.k==='r'?Math.atan2(q.ty-q.y,q.tx-q.x):Math.atan2(q.vy,q.vx))*100),q.s?L.indexOf(q.s.el):-1);
  for(const f of G.fx)if(!f.s&&FXR[f.k]){f.s=1;fx.push(f)}
  for(const c of G.cad)if(!c.s){c.s=1;cad.push([Math.round(c.x),Math.round(c.y),c.k])}
  return{t:r1(G.t),po:G.portal.open?1:0,k:G.kills,m,pr,fx,cad,
    dr:G.drops.map(d=>[Math.round(d.x),Math.round(d.y),d.rar,d.dono,r1(d.t)]),
    ps:G.ps.map(p=>({cl:p.cl,nome:p.nome,tm:p.time,eq:p.c.equip,x:Math.round(p.x),y:Math.round(p.y),tx:p.tx,ty:p.ty,hp:Math.ceil(p.hp),mhp:p.mhp,mp:Math.floor(p.mp),mmp:p.mmp,f:Math.round(p.face*100),
      mv:p.mv?1:0,fl:p.flash>0?1:0,sw:p.swing>0?[r1(p.swing),r1(p.swingA),p.swingR]:0,fora:p.fora,pch:r1(p.pch),bv:p.bagVal,bag:p.bag,pot:p.pot,ali:Math.ceil(p.ali),nc:nComida(p.bag),
      cdC:r1(p.cdC),cdCo:r1(p.cdCo),cds:p.cds,gcd:p.gcd,arm:bf('arm',p),c:[p.c.lvl,p.c.xp,p.c.mag,p.c.per]}))};
}
/* o convidado (o jogador eu de G.ps) aplica o retrato: cada coisa guarda a
   posição de antes (x0, y0) e o render() interpola até o próximo retrato, e
   G.ocu passa a ter os sqm dos monstros, para ele não pisar neles. A
   posição dele mesmo não vem do anfitrião, porque ele anda no próprio
   aparelho; só volta para o sqm que o anfitrião vê se os dois se separarem
   demais, ou se os dois estão parados em sqm diferentes (o anfitrião não
   conseguiu chegar: um monstro estava no caminho) */
const PORID=new Map();
const num0=v=>Number.isFinite(+v)?+v:0;
export function aplicaRetrato(r,eu){
  if(!r||!Array.isArray(r.m)||!Array.isArray(r.ps))return;
  const K=ks(),L=kel();
  G.t=num0(r.t);G.portal.open=!!r.po;G.kills=num0(r.k);G.rT=0;
  const velhos=G.mons;G.mons=[];G.ocu.fill(0);
  for(let i=0;i+9<r.m.length;i+=10){
    const k=K[r.m[i+1]];if(!k)continue;
    let o=PORID.get(r.m[i]);
    if(!o||o.k!==k){o={id:r.m[i],k,t:MT[k],r:MT[k].r,anim:frr(0,9),x:r.m[i+2],y:r.m[i+3],slow:0,dot:null};PORID.set(o.id,o)}
    o.x0=o.x;o.y0=o.y;o.a0=o.anim;o.x=num0(r.m[i+2]);o.y=num0(r.m[i+3]);o.tx=r.m[i+4]|0;o.ty=r.m[i+5]|0;o.hp=num0(r.m[i+6]);o.mhp=num0(r.m[i+7])||1;
    o.face=num0(r.m[i+8])/100;o.mv=r.m[i+9]&1;o.flash=r.m[i+9]&2?.1:0;o.anim+=.1;
    if(o.tx>=0&&o.ty>=0&&o.tx<MW&&o.ty<MH)G.ocu[o.ty*MW+o.tx]=1;
    G.mons.push(o);
  }
  for(const o of velhos)if(!G.mons.includes(o))PORID.delete(o.id);
  /* na masmorra da sala, gente entra depois: quem o convidado ainda não
     conhece ganha boneco (ficha conferida, só para desenhar) */
  for(let i=G.ps.length;i<Math.min(r.ps.length,8);i++){
    const q=r.ps[i],f=q&&confereFicha({cl:q.cl,nome:q.nome,c:{lvl:1,equip:q.eq||{}},up:{}});
    if(!f)break;entra(i,f);G.ps[i].fora='fora';
  }
  for(let i=0;i<G.ps.length&&i<r.ps.length;i++){
    const p=G.ps[i],q=r.ps[i];if(!q)continue;
    if(i!==eu&&CLASSES[q.cl]&&q.cl!==p.cl){const f=confereFicha({cl:q.cl,nome:q.nome,c:{lvl:1,equip:q.eq||{}},up:{}});if(f){p.cl=f.cl;p.nome=f.nome;p.c=f.c}}
    const qx=q.tx|0,qy=q.ty|0,outro=qx!==p.tx||qy!==p.ty;
    if(i!==eu){p.x0=p.x;p.y0=p.y;p.w0=p.walk;p.x=num0(q.x);p.y=num0(q.y);p.tx=qx;p.ty=qy;p.face=num0(q.f)/100;p.mv=!!q.mv;if(p.mv)p.walk+=.6}
    /* atraso de rede deixa o anfitrião um passo atrás por um instante; só
       volta quando a diferença dura: 3 retratos se longe, 8 (~0,8 s) se é um
       sqm com os dois parados */
    else{const longe=hyp(q.x-p.x,q.y-p.y)>96,preso=!p.sd&&!q.mv;
      p.desv=outro&&!solid(qx,qy)&&(longe||preso)?(p.desv||0)+1:0;
      if(p.desv>=(longe?3:8)){poeNoSqm(p,qx,qy);p.x0=p.x;p.y0=p.y;p.desv=0}}
    p.hp=num0(q.hp);p.mhp=num0(q.mhp)||1;p.mp=num0(q.mp);p.mmp=num0(q.mmp)||1;p.flash=q.fl?.1:0;
    if(Array.isArray(q.sw)){p.swing=num0(q.sw[0]);p.swingA=num0(q.sw[1]);p.swingR=num0(q.sw[2])}
    p.fora=typeof q.fora==='string'?q.fora:null;p.pch=num0(q.pch);p.bagVal=num0(q.bv);if(i===eu&&q.bag&&typeof q.bag==='object')p.bag=soMochila(q.bag);p.pot=num0(q.pot);p.cdC=num0(q.cdC);p.cdCo=num0(q.cdCo);
    p.ali=num0(q.ali);p.nc=num0(q.nc)|0;p.time=typeof q.tm==='string'?q.tm.slice(0,8):'';
    p.cds=q.cds&&typeof q.cds==='object'?q.cds:{};p.gcd=q.gcd&&typeof q.gcd==='object'?q.gcd:{};
    p.buffs=q.arm?{arm:{v:num0(q.arm),left:1}}:{};
    if(Array.isArray(q.c)){p.c.lvl=num0(q.c[0])||1;p.c.xp=num0(q.c[1]);p.c.mag=num0(q.c[2]);p.c.per=num0(q.c[3])}
  }
  G.proj=[];
  for(let i=0;i+4<(Array.isArray(r.pr)?r.pr.length:0);i+=5){
    const a=num0(r.pr[i+3])/100,x=num0(r.pr[i+1]),y=num0(r.pr[i+2]),el=L[r.pr[i+4]];
    G.proj.push({k:r.pr[i]==='b'||r.pr[i]==='r'?r.pr[i]:'m',x,y,vx:Math.cos(a),vy:Math.sin(a),tx:x+Math.cos(a)*40,ty:y+Math.sin(a)*40,s:{el},col:el&&EL_COR[el]});
  }
  if(Array.isArray(r.dr))G.drops=r.dr.map(d=>({x:num0(d[0]),y:num0(d[1]),rar:Math.max(0,Math.min(2,d[2]|0)),dono:d[3]|0,t:num0(d[4]),items:[]}));
  if(Array.isArray(r.fx))for(const f of r.fx.slice(0,40))if(f&&FXR[f.k]){f.t=0;f.life=Math.min(2,num0(f.life)||.5);G.fx.push(f)}
  if(Array.isArray(r.cad))for(const c of r.cad)if(Array.isArray(c)&&MT[c[2]]){G.cad.push({x:num0(c[0]),y:num0(c[1]),k:c[2]});if(G.cad.length>60)G.cad.shift()}
}
/* um quadro do convidado: ele anda no próprio aparelho, os efeitos correm, e
   G.alfa diz quanto do caminho até o próximo retrato (0,1 s) já passou */
export function assiste(dt,eu,ent){
  const p=G.ps[eu];
  /* o elixir de pressa anda no aparelho do convidado: o relógio dele também corre aqui */
  for(const k in p.sup){p.sup[k].left-=dt;if(p.sup[k].left<=0)delete p.sup[k]}
  if(!p.fora){movimenta(p,dt,ent);p.x0=p.x;p.y0=p.y;p.w0=p.walk;reveal(p)}
  G.rT=(G.rT||0)+dt;G.alfa=Math.min(1,G.rT/.1);efeitos(dt);
}
/* ---------- herança da sala ----------
   O retrato só serve para desenhar. A herança é o estado inteiro da regra,
   que o anfitrião manda a cada segundo e na hora de passar a sala adiante:
   se ele sai, quem assume (src/sala.js) refaz a masmorra pela semente,
   põe a herança por cima e segue rodando, sem ninguém sair dela; no pior
   caso a caçada volta um segundo. Referências viram números: o jogador pelo
   lugar em G.ps, o monstro pelo id, a habilidade pela chave. Os golpes
   atrasados de G.pend (funções) não vão: no máximo se perde o segundo golpe
   de um ataque múltiplo. */
const copia=(o,sem)=>{const r={};for(const k in o)if(!sem.includes(k))r[k]=o[k];return r};
const SEM_M=['t','x0','y0','a0','dot'],SEM_Q=['x0','y0','s','p','tg'],SEM_P=['x0','y0','w0','desv','c','up','local'];
const chaveSp=s=>{for(const k in SPELLS)if(SPELLS[k]===s)return k;return null};
export function heranca(){
  const ocu=[];for(let i=0;i<MW*MH;i++)if(G.ocu[i])ocu.push(i);
  return{v:1,semente:G.semente,sorte:sorteAgora(),t:G.t,kills:G.kills,nid:G.nid,caca:G.caca,respT:G.respT,arC:G.arC,arF:G.arF.slice(),arT:G.arT,flowT:G.flowT,fsrc:G.fsrc.slice(),ocu,
    rooms:G.rooms.map(r=>[r.base===undefined?-1:r.base,r.prof||0,r.esp||0,r.chefe?1:0]),
    mons:G.mons.map(m=>Object.assign(copia(m,SEM_M),{dot:m.dot&&Object.assign({},m.dot,{p:m.dot.p?m.dot.p.id:-1})})),
    proj:G.proj.map(q=>Object.assign(copia(q,SEM_Q),{s:q.s?chaveSp(q.s):null,p:q.p?q.p.id:-1,tg:q.tg?q.tg.id:-1})),
    drops:G.drops.map(d=>Object.assign({},d)),
    ps:G.ps.map(p=>Object.assign(copia(p,SEM_P),{c:p.c,up:p.up}))};
}
/* quem assume a sala: eu é o lugar deste aparelho em G.ps (-1 se ele não
   está lá dentro) e meu, a ficha local (fichaLocal()), cujo personagem recebe o que o
   jogador eu já ganhou nesta caçada e passa a ganhar o resto, como no solo.
   A ficha dos outros passa por confereFicha() */
export function adota(h,eu,meu){
  if(!h||h.v!==1||!Array.isArray(h.ps)||!Array.isArray(h.mons)||!h.ps.length||h.ps.length>8)return false;
  const fichas=h.ps.map((q,i)=>q&&confereFicha({cl:q.cl,nome:q.nome,c:q.c,up:q.up}));
  if(fichas.some(f=>!f))return false;
  if(eu>=0){
    if(!fichas[eu]||fichas[eu].cl!==meu.cl)return false;
    const c=fichas[eu].c;for(const k of['lvl','xp','mag','manaG','per','golpes'])meu.c[k]=c[k];
    fichas[eu]=Object.assign({},meu,{nome:fichas[eu].nome});
  }
  newRun(h.semente>>>0,fichas,true,h.caca);
  if(Array.isArray(h.sorte))poeSorte(h.sorte[0]|0,h.sorte[1]|0);
  G.t=num0(h.t);G.kills=num0(h.kills);G.nid=num0(h.nid);G.respT=num0(h.respT);
  if(G.arena){G.arC=Number.isInteger(h.arC)?h.arC:-1;G.arF=Array.isArray(h.arF)?h.arF.map(v=>Number.isInteger(v)?v:-1):[];G.arT=num0(h.arT)}
  if(Array.isArray(h.rooms))h.rooms.forEach((r,i)=>{const o=G.rooms[i];if(!o||!Array.isArray(r))return;
    if(r[0]>=0)o.base=num0(r[0]);else delete o.base;o.prof=num0(r[1]);o.esp=num0(r[2]);o.chefe=!!r[3]});
  G.ps.forEach((p,i)=>{const c=p.c,up=p.up;Object.assign(p,copia(h.ps[i],SEM_P));p.c=c;p.up=up;p.id=i;p.local=i===eu;p.x0=p.x;p.y0=p.y});
  G.mons=h.mons.filter(m=>m&&MT[m.k]).map(m=>{const o=Object.assign({},m,{t:MT[m.k]});
    o.dot=m.dot?Object.assign({},m.dot,{p:G.ps[m.dot.p]||null}):null;o.x0=o.x;o.y0=o.y;o.a0=o.anim;return o});
  G.ocu.fill(0);
  if(Array.isArray(h.ocu))for(const i of h.ocu){if(i>=0&&i<MW*MH)G.ocu[i]=1}else for(const m of G.mons)G.ocu[m.ty*MW+m.tx]=1;
  const porId=new Map(G.mons.map(m=>[m.id,m]));
  G.proj=(Array.isArray(h.proj)?h.proj:[]).map(q=>Object.assign({},q,{s:q.s?SPELLS[q.s]:undefined,p:G.ps[q.p],tg:porId.get(q.tg)||null})).filter(q=>q.k==='m'||(q.s&&q.p));
  G.drops=(Array.isArray(h.drops)?h.drops:[]).map(d=>Object.assign({},d));
  /* o campo de fluxo é o mesmo que o anfitrião tinha: refeito de onde ele
     partiu, e refeito de novo quando chegar a hora dele */
  if(Array.isArray(h.fsrc)){G.fsrc=h.fsrc.map(v=>v|0);fluxo(G.fsrc);G.flowT=num0(h.flowT)}else G.flowT=0;
  G.pend=[];G.active=true;G.p=G.ps[eu]||G.ps[0];
  revela();
  return true;
}
