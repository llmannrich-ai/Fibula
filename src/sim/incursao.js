/* ---------- estado da incursão ---------- */
import {T,MW,MH,RUN,PORTAL_AT,EXT,TAU,TICK,rnd,rr,ri,frr,sorte,semeia,semente,novaSemente,hyp,DIRS,saida,DIR8,poeNoSqm,comeca,avanca,dir8,passoPara} from './base.js?v=0.11.0';
import {EL_COR,MT,PROG,CLASSES} from './dados.js?v=0.11.0';
import {save,ch,stats,sealPct,guardaSaco,perdaXp,durPasso,passoDaVel} from './progresso.js?v=0.11.0';
import {genMap,pecas} from './mapa.js?v=0.11.0';
import {bf,lancarSlot,atingir,explode,hitMon,hurtPlayer,pickup} from './combate.js?v=0.11.0';

export let G=null;
export const setG=v=>{G=v};
function pickType(d){
  const bandas=PROG.bands,b=bandas.find(b=>d<b.untilDepth)||bandas[bandas.length-1];
  const linhas=Object.entries(b.weights);
  let r=sorte();
  for(const[k,w]of linhas){if(r<w)return k;r-=w}
  return linhas[linhas.length-1][0];
}
function spawn(k,r,d,boss){
  const t=MT[k],sc=PROG.scaling,lv=sc.hpPerCharLevel*(G.lvl-1),
    hpm=boss?(1+lv*sc.bossLevelFactor)*(1+PROG.party.bossHp*(G.ps.length-1)):1+sc.hpPerDepth*d+lv;
  /* um monstro por sqm: se o sorteado já tem dono, o monstro não nasce */
  const tx=boss?r.cx:r.x+1+rnd(r.w-2),ty=boss?r.cy-1:r.y+1+rnd(r.h-2);
  if(G.ocu[ty*MW+tx])return;G.ocu[ty*MW+tx]=1;
  const hp=Math.round(t.hp*hpm);
  G.mons.push({k,t,x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,hp,mhp:hp,r:t.r,spd:t.spd,dmg:Math.round(t.dmg*(1+sc.dmgPerDepth*d)),xpm:1+sc.xpPerDepth*d,atkCd:rr(0,1),flash:0,aggro:false,wt:0,anim:frr(0,9),mv:0,face:frr(0,TAU),slow:0,slowF:1,dot:null,dn:G.ps.map(()=>0)});
  poeNoSqm(G.mons[G.mons.length-1],tx,ty);
}
/* ---------- jogadores ----------
   Solo é um grupo de um: a incursão sempre tem uma lista de jogadores, G.ps,
   e a regra não lê o save para saber quem joga. Cada jogador nasce de uma
   ficha {cl, c, up, local}: a classe, o personagem (lvl, xp, mag, per,
   slots, equip), as melhorias da conta e se ele é o dono do save deste
   aparelho. No solo a ficha aponta para o próprio personagem do save, então
   nível, Magia e Perícia que sobem na incursão já ficam nele, como antes; o
   servidor da F2 monta as fichas do banco. O que é da conta (cofre, peças,
   estatísticas) só muda para a ficha local, em sai(). */
export const fichaLocal=()=>({cl:save.classe,c:ch(),up:save.up,local:true});
/* onde cada jogador aparece na sala de entrada, em sqm a partir do centro;
   jogadores não se bloqueiam (só monstros ocupam sqm) */
const LADO=[[0,0],[1,0],[-1,0],[0,1]];
function novoJogador(f,i,s){
  const st=stats(f.c,f.cl,f.up),o=LADO[i]||LADO[0];
  const p={id:i,cl:f.cl,c:f.c,up:f.up,local:!!f.local,
    x:0,y:0,tx:0,ty:0,ox:0,oy:0,st:0,sd:0,r:11,face:0,hp:st.mhp,mhp:st.mhp,mp:st.mmp,mmp:st.mmp,
    cds:{},gcd:{ataque:0,cura:0,apoio:0},buffs:{},cdC:0,pot:3+f.up.bolsa,flash:0,walk:0,mv:false,swing:0,swingA:0,swingR:0,
    pch:0,bag:{},bagVal:0,kills:0,xpGain:0,magGain:0,perGain:0,fora:null,sealed:0,ouroExt:0,pecas:0,xpPerdido:0};
  poeNoSqm(p,s.cx+o[0],s.cy+o[1]);return p;
}
/* s é a semente da incursão: a mesma semente dá a mesma masmorra. Sem ela,
   sorteia uma nova (é o caso normal do jogador). fichas são os jogadores;
   sem elas, o personagem do save sozinho */
export function newRun(s0=novaSemente(),fichas=[fichaLocal()]){
  semeia(s0);
  const {g,rooms}=genMap(),s=rooms[0];
  let pr=s,md=1;
  for(const r of rooms){r.d=hyp(r.cx-s.cx,r.cy-s.cy);if(r.d>md){md=r.d;pr=r}}
  const ps=fichas.map((f,i)=>novoJogador(f,i,s));
  /* G.p é o jogador deste aparelho, para a tela; a regra só usa G.ps */
  G={g,rooms,par:pecas(g),cad:[],seen:new Uint8Array(MW*MH),flow:new Int16Array(MW*MH).fill(-1),fdono:new Uint8Array(MW*MH),ocu:new Uint8Array(MW*MH),flowT:0,ps,p:ps[0],
     lvl:Math.max(...fichas.map(f=>f.c.lvl)),mons:[],proj:[],drops:[],fx:[],torches:[],pend:[],
     t:0,kills:0,portal:{x:(pr.cx+.5)*T,y:(pr.cy+.5)*T,open:false},over:false,active:false,shake:0,warned:false,miniT:0,end:null,dur:0,acc:0,alfa:1,semente};
  for(const p of ps)G.ocu[p.ty*MW+p.tx]=1;
  const mais=1+PROG.party.monsters*(ps.length-1);
  for(const r of rooms){
    if(r===s)continue;
    const pr2=PROG.perRoom,d=r.d/md,
      n=Math.round((ri(pr2.min,pr2.max)+(r.w*r.h>pr2.largeRoomArea?pr2.largeRoomBonus:0))*mais);
    for(let k=0;k<n;k++)spawn(pickType(d),r,d,false);
  }
  const bs=PROG.boss;
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
  if(!po.open&&G.t>=PORTAL_AT){po.open=true;saida.banner('Portal de saída aberto');saida.log('Um portal se abriu na sala do Guardião. Siga o ponto dourado no mapa.','info')}
  /* a extração é de cada um: quem fica parado no portal sai com o próprio saco */
  if(po.open)for(const p of G.ps){
    if(p.fora)continue;
    if(hyp(p.x-po.x,p.y-po.y)<38){p.pch+=dt;if(p.pch>=EXT){sai(p,'extraiu');if(G.over)return}}
    else p.pch=Math.max(0,p.pch-dt*2);
  }
  const left=RUN-G.t;
  if(left<=60&&!G.warned){G.warned=true;saida.banner('A masmorra está desabando');saida.log('Falta 1 minuto. Chegue ao portal ou perca o saco.','warn')}
  if(left<=0)finish('desabou');
}
/* movimento, regeneração e recargas de um jogador */
function anda(p,dt,ent){
  /* um passo de cada vez: o joystick só escolhe o próximo quando o atual acaba */
  const sobra=avanca(p,dt);
  if(sobra>=0){
    const i=dir8(ent.x,ent.y),j=i<0?-1:passoPara(p,i,livreP,ent.x,ent.y);
    if(j>=0){const d=DIR8[j],sd=durPasso(p.c,bf('velo',p));comeca(p,d[0],d[1],d[0]&&d[1]?sd*PROG.walk.diagonal:sd,sobra)}
    else if(i>=0)p.face=Math.atan2(DIR8[i][1],DIR8[i][0]);
  }
  p.mv=p.sd>0;if(p.mv)p.walk+=dt*12;
  const K=CLASSES[p.cl];
  p.mp=Math.min(p.mmp,p.mp+K.rmp*dt);p.hp=Math.min(p.mhp,p.hp+K.rhp*dt);
  p.cdC-=dt;p.flash-=dt;p.swing-=dt;
  for(const k in p.cds)if(p.cds[k]>0)p.cds[k]-=dt;
  for(const k in p.gcd)if(p.gcd[k]>0)p.gcd[k]-=dt;
  for(const k in p.buffs){p.buffs[k].left-=dt;if(p.buffs[k].left<=0)delete p.buffs[k]}
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
  if(kind==='extraiu'){if(p.local){const r=guardaSaco(p.bag);p.ouroExt=r.ouro;p.pecas=r.pecas;save.ext++;save.best=Math.max(save.best,p.bagVal)}}
  else{p.sealed=Math.round(p.bagVal*sealPct(p.up));p.xpPerdido=perdaXp(p.c);p.c.xp-=p.xpPerdido;
    if(p.local){save.deaths++;if(p.sealed)save.cofre+=p.sealed}}
  for(const q of G.ps)if(!q.fora)return;
  G.over=true;G.end=kind;G.dur=G.t;
  saida.persist();
  if(kind!=='extraiu')shake(8);
  saida.fim(kind);
}
/* a sala acaba para todos que ainda estão nela (o desabamento, ou o teste) */
export function finish(kind){if(G.over)return;for(const p of G.ps)if(!p.fora)sai(p,kind)}
