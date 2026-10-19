/* ---------- estado da incursão ---------- */
import {T,MW,MH,RUN,PORTAL_AT,EXT,TAU,TICK,rnd,rr,ri,frr,sorte,semeia,semente,novaSemente,hyp,DIRS,saida,DIR8,poeNoSqm,comeca,avanca,dir8,passoPara} from './base.js?v=0.21.0';
import {EL_COR,MT,PROG,CLASSES,HUNTS,cacaDe} from './dados.js?v=0.21.0';
import {save,ch,stats,sealPct,guardaSaco,perdaXp,durPasso,passoDaVel,confereFicha,efeitoProv} from './progresso.js?v=0.21.0';
import {genMap,pecas} from './mapa.js?v=0.21.0';
import {bf,lancarSlot,atingir,explode,hitMon,hurtPlayer,pickup} from './combate.js?v=0.21.0';

export let G=null;
export const setG=v=>{G=v};
/* a tabela de spawn e o chefe são do mapa de caça (G.caca); sem eles, os de progression */
const bandas=()=>HUNTS[G.caca].bands||PROG.bands,chefe=()=>HUNTS[G.caca].boss||PROG.boss;
function pickType(d){
  const bs=bandas(),b=bs.find(b=>d<b.untilDepth)||bs[bs.length-1];
  const linhas=Object.entries(b.weights);
  let r=sorte();
  for(const[k,w]of linhas){if(r<w)return k;r-=w}
  return linhas[linhas.length-1][0];
}
function spawn(k,r,d,boss){
  const n0=G.mons.length;spawn0(k,r,d,boss);if(G.mons.length>n0)G.mons[n0].sala=r.i;
}
function spawn0(k,r,d,boss){
  const t=MT[k],sc=PROG.scaling,lv=sc.hpPerCharLevel*(G.lvl-1),
    hpm=boss?(1+lv*sc.bossLevelFactor)*(1+PROG.party.bossHp*(G.ps.length-1)):1+sc.hpPerDepth*d+lv;
  /* um monstro por sqm: se o sorteado já tem dono, o monstro não nasce. O
     chefe nasce sempre: com o sqm dele ocupado, vai para o livre mais perto
     do centro da sala (sem sorteio, para não mudar a masmorra de ninguém) */
  let tx=boss?r.cx:r.x+1+rnd(r.w-2),ty=boss?r.cy-1:r.y+1+rnd(r.h-2);
  if(boss&&G.ocu[ty*MW+tx]){let bd=1e9;
    for(let j=r.y;j<r.y+r.h;j++)for(let i=r.x;i<r.x+r.w;i++){const d=(i-r.cx)**2+(j-r.cy+1)**2;if(!G.ocu[j*MW+i]&&d<bd){bd=d;tx=i;ty=j}}}
  if(G.ocu[ty*MW+tx])return;G.ocu[ty*MW+tx]=1;
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
export const fichaLocal=()=>({cl:save.classe,c:ch(),up:save.up,prov:save.prov,local:true});
/* onde cada jogador aparece na sala de entrada, em sqm a partir do centro;
   jogadores não se bloqueiam (só monstros ocupam sqm) */
const LADO=[[0,0],[1,0],[-1,0],[0,1]];
/* as provisões (p.prov, o que sai do estoque quando a caçada começa) dão
   poções, regeneração a mais (rgh, rgm) e buffs do começo (p.sup), que
   somam aos das habilidades em vez de serem trocados por eles */
function novoJogador(f,i,s){
  const st=stats(f.c,f.cl,f.up),o=LADO[i]||LADO[0],e=efeitoProv(f.prov);
  const p={id:i,cl:f.cl,c:f.c,up:f.up,local:!!f.local,nome:f.nome||'',prov:Object.assign({},f.prov),
    x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,r:11,face:0,hp:st.mhp,mhp:st.mhp,mp:st.mmp,mmp:st.mmp,
    cds:{},gcd:{ataque:0,cura:0,apoio:0},buffs:{},sup:e.buffs,rgh:e.rhp,rgm:e.rmp,cdC:0,pot:3+f.up.bolsa+e.pot,flash:0,walk:0,mv:false,swing:0,swingA:0,swingR:0,
    pch:0,bag:{},bagVal:0,kills:0,xpGain:0,magGain:0,perGain:0,fora:null,sealed:0,ouroExt:0,pecas:0,mats:0,xpPerdido:0};
  poeNoSqm(p,s.cx+o[0],s.cy+o[1]);return p;
}
/* s é a semente da incursão: a mesma semente dá a mesma masmorra. Sem ela,
   sorteia uma nova (é o caso normal do jogador). fichas são os jogadores;
   sem elas, o personagem do save sozinho. aberta é a masmorra da sala (ver
   "masmorra aberta" abaixo): sem tempo, com a porta na sala de entrada.
   caca é o mapa de caça (hunts no content.json): a mesma semente no mesmo
   mapa de caça dá a mesma masmorra */
export function newRun(s0=novaSemente(),fichas=[fichaLocal()],aberta=false,caca){
  semeia(s0);caca=cacaDe(caca);
  const {g,rooms}=genMap(HUNTS[caca].mapa),s=rooms[0];
  let pr=s,md=1;
  for(const r of rooms){r.d=hyp(r.cx-s.cx,r.cy-s.cy);if(r.d>md){md=r.d;pr=r}}
  const ps=fichas.map((f,i)=>novoJogador(f,i,s));
  /* G.p é o jogador deste aparelho, para a tela; a regra só usa G.ps */
  G={g,rooms,par:pecas(g),cad:[],seen:new Uint8Array(MW*MH),flow:new Int16Array(MW*MH).fill(-1),fdono:new Uint8Array(MW*MH),ocu:new Uint8Array(MW*MH),flowT:0,ps,p:ps[0],
     lvl:Math.max(...fichas.map(f=>f.c.lvl)),nid:0,mons:[],proj:[],drops:[],fx:[],torches:[],pend:[],
     t:0,kills:0,caca,portal:aberta?{x:(s.cx+.5)*T,y:(s.cy+.5)*T,open:true}:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false},aberta,respT:0,over:false,active:false,shake:0,warned:false,miniT:0,end:null,dur:0,acc:0,alfa:1,semente};
  for(const p of ps)G.ocu[p.ty*MW+p.tx]=1;
  const mais=1+PROG.party.monsters*(ps.length-1);
  rooms.forEach((r,i)=>{r.i=i});
  for(const r of rooms){
    if(r===s)continue;
    const pr2=PROG.perRoom,d=r.d/md,base=ri(pr2.min,pr2.max)+(r.w*r.h>pr2.largeRoomArea?pr2.largeRoomBonus:0),
      n=Math.round(base*mais);
    r.base=base;r.prof=d;r.esp=0;
    for(let k=0;k<n;k++)spawn(pickType(d),r,d,false);
  }
  pr.chefe=true;
  const bs=chefe();
  spawn(bs.type,pr,1,true);
  spawn(bs.escort[rnd(bs.escort.length)],pr,1,false);
  for(const p of ps)G.ocu[p.ty*MW+p.tx]=0;
  revela();
}

/* ---------- física ----------
   Andar é por sqm (passo de sqm, em base.js). G.ocu marca os sqm com monstro:
   monstro não entra em sqm de monstro nem de jogador, e jogador não entra em
   sqm de monstro — é o bloqueio de corpo do Tibia, que deixa o cavaleiro
   segurar o corredor. Jogadores não se bloqueiam entre si. */
export const solid=(x,y)=>x<0||y<0||x>=MW||y>=MH||G.g[y*MW+x]===1;
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
  const f=G.flow,o=G.fdono,g=G.g;f.fill(-1);let h=0,t=0;
  for(let i=0;i<G.ps.length;i++){const p=G.ps[i];if(p.fora)continue;
    const s=p.ty*MW+p.tx;if(f[s]<0){f[s]=0;o[s]=i;Q[t++]=s}}
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
   {x,y} do movimento (comprimento até 1) e held[4] dos espaços seguros. Com
   mais de um jogador, ent é uma lista, uma entrada por jogador de G.ps. */
const UM=[null],PARADO={x:0,y:0,held:[false,false,false,false]};
export function update(dt,ent){
  const ents=Array.isArray(ent)?ent:(UM[0]=ent,UM);
  guarda();G.t+=dt;
  G.flowT-=dt;if(G.flowT<=0){buildFlow();G.flowT=.2}
  for(const p of G.ps)if(!p.fora)anda(p,dt,ents[p.id]||PARADO);
  for(let i=G.pend.length-1;i>=0;i--){const q=G.pend[i];q.t-=dt;if(q.t<=0){G.pend.splice(i,1);q.fn();if(G.over)return}}
  for(const p of G.ps){if(p.fora)continue;const e=ents[p.id]||PARADO;for(let i=0;i<4;i++)if(e.held[i])lancarSlot(i,p)}
  revela();
  updateMons(dt);if(G.over)return;
  updateProj(dt);if(G.over)return;
  /* o loot é único: o primeiro que encosta leva, mas nos primeiros
     lootProtection segundos só quem causou mais dano no monstro (d.dono) */
  const prot=PROG.party.lootProtection;
  for(let i=G.drops.length-1;i>=0;i--){const d=G.drops[i];d.t+=dt;
    for(const p of G.ps){if(p.fora||(p.id!==d.dono&&d.t<prot))continue;
      if(hyp(d.x-p.x,d.y-p.y)<p.r+16){pickup(d,i,p);break}}}
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
  const K=CLASSES[p.cl];
  p.mp=Math.min(p.mmp,p.mp+(K.rmp+p.rgm)*dt);p.hp=Math.min(p.mhp,p.hp+(K.rhp+p.rgh)*dt);
  p.cdC-=dt;p.flash-=dt;p.swing-=dt;
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
      if(q.tg&&q.tg.hp>0){
        const dx=q.tg.x-q.x,dy=q.tg.y-q.y,d=hyp(dx,dy)||1;q.vx=dx/d*560;q.vy=dy/d*560;
        if(d<q.tg.r+6){atingir(q.tg,q.s,1,q.p);spark(q.x,q.y,q.col);dead=true}
      }else if(!q.vx&&!q.vy)dead=true;
      q.x+=q.vx*dt;q.y+=q.vy*dt;
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
   soterrado ('desabou'). A perda de XP e o Selo valem para a ficha de
   qualquer um; cofre, peças e estatísticas só para a ficha local. Quem sai
   não volta, e a sala acaba quando não sobra ninguém dentro */
export function sai(p,kind){
  if(G.over||p.fora)return;p.fora=kind;
  if(kind==='extraiu'){if(p.local){const r=guardaSaco(p.bag);p.ouroExt=r.ouro;p.pecas=r.pecas;p.mats=r.mats;save.ext++;save.best=Math.max(save.best,p.bagVal)}}
  else{p.sealed=Math.round(p.bagVal*sealPct(p.up));p.xpPerdido=perdaXp(p.c);p.c.xp-=p.xpPerdido;
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
  const p=novoJogador(f,i,G.rooms[0]);G.ps[i]=p;
  for(let k=0;k<i;k++)if(!G.ps[k]){G.ps[k]=novoJogador(f,k,G.rooms[0]);G.ps[k].fora='fora'}
  return p;
}
function repovoa(dt){
  G.respT+=dt;if(G.respT<1)return;
  const pas=G.respT;G.respT=0;
  const R=PROG.respawn,dentro=G.ps.filter(p=>!p.fora),mais=1+PROG.party.monsters*Math.max(0,dentro.length-1),perto=R.clearTiles*T;
  for(const r of G.rooms){
    if(r.base===undefined&&!r.chefe)continue;
    /* a sala do chefe tem os monstros dela mais o chefe e a escolta */
    const vivos=G.mons.filter(m=>m.sala===r.i),alvo=Math.round((r.base||0)*mais)+(r.chefe?2:0);
    if(vivos.length>=alvo){r.esp=0;continue}
    r.esp=(r.esp||0)+pas;
    if(r.esp<R.seconds||dentro.some(p=>hyp(p.x-(r.cx+.5)*T,p.y-(r.cy+.5)*T)<perto))continue;
    r.esp=0;
    let falta=alvo-vivos.length;
    if(r.chefe&&!vivos.some(m=>m.t.boss)){const bs=chefe();spawn(bs.type,r,1,true);spawn(bs.escort[rnd(bs.escort.length)],r,1,false);falta-=2}
    for(;falta>0;falta--)spawn(pickType(r.prof),r,r.prof,false);
  }
}
/* a sala acaba para todos que ainda estão nela (o desabamento, ou o teste) */
export function finish(kind){if(G.over)return;for(const p of G.ps)if(!p.fora)sai(p,kind)}

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
export function retrato(){
  const K=ks(),L=kel(),m=[],pr=[],fx=[],cad=[];
  for(const o of G.mons)m.push(o.id,K.indexOf(o.k),Math.round(o.x),Math.round(o.y),o.tx,o.ty,Math.ceil(o.hp),o.mhp,Math.round(o.face*100),(o.mv?1:0)|(o.flash>0?2:0));
  for(const q of G.proj)pr.push(q.k,Math.round(q.x),Math.round(q.y),Math.round((q.k==='r'?Math.atan2(q.ty-q.y,q.tx-q.x):Math.atan2(q.vy,q.vx))*100),q.s?L.indexOf(q.s.el):-1);
  for(const f of G.fx)if(!f.s&&FXR[f.k]){f.s=1;fx.push(f)}
  for(const c of G.cad)if(!c.s){c.s=1;cad.push([Math.round(c.x),Math.round(c.y),c.k])}
  return{t:r1(G.t),po:G.portal.open?1:0,k:G.kills,m,pr,fx,cad,
    dr:G.drops.map(d=>[Math.round(d.x),Math.round(d.y),d.rar,d.dono,r1(d.t)]),
    ps:G.ps.map(p=>({cl:p.cl,nome:p.nome,eq:p.c.equip,x:Math.round(p.x),y:Math.round(p.y),tx:p.tx,ty:p.ty,hp:Math.ceil(p.hp),mhp:p.mhp,mp:Math.floor(p.mp),mmp:p.mmp,f:Math.round(p.face*100),
      mv:p.mv?1:0,fl:p.flash>0?1:0,sw:p.swing>0?[r1(p.swing),r1(p.swingA),p.swingR]:0,fora:p.fora,pch:r1(p.pch),bv:p.bagVal,pot:p.pot,
      cdC:r1(p.cdC),cds:p.cds,gcd:p.gcd,arm:bf('arm',p),c:[p.c.lvl,p.c.xp,p.c.mag,p.c.per]}))};
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
    p.fora=typeof q.fora==='string'?q.fora:null;p.pch=num0(q.pch);p.bagVal=num0(q.bv);p.pot=num0(q.pot);p.cdC=num0(q.cdC);
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
