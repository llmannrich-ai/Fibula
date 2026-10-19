/* ---------- voz: falar na sala ----------
   Decisão do Leonardo em 19/10/2026: voz só na sala de caçar junto, entre
   quem se chamou; nunca na cidade aberta, que pede moderação (F3 do PRD).
   O áudio vai direto de aparelho para aparelho (WebRTC do navegador, sem
   biblioteca), em malha: com 4 na sala, cada um manda para os outros 3. O
   canal da sala (src/sala.js) só leva a apresentação, uma oferta e uma
   resposta por par; o som não passa pelo Supabase nem gasta a cota dele.
   Para os aparelhos se acharem, o STUN do Cloudflare e o do Google respondem
   "qual é o meu endereço de fora", e só isso: é a exceção à regra de não
   falar com outro servidor, aceita pelo Leonardo na mesma data. Sem TURN:
   onde a rede não deixa ligar direto (CGNAT de operadora), não há voz com
   aquela pessoa, e o jogo diz isso em vez de ficar mudo.
   Segurar para falar: o microfone só manda som com o botão apertado (V no
   teclado). Mensagens ('voz' no canal da sala): oi (estou com a voz ligada,
   a cada 5 s), tchau, oferta e resposta (o SDP já com os candidatos). Quem
   tem o id menor oferece, para os dois não oferecerem ao mesmo tempo. */
import {SALA,sinal} from './sala.js?v=0.19.0';
import {ID} from './rede.js?v=0.19.0';
import {log} from './hud.js?v=0.19.0';

export const STUN=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];
/* pode: há sala ligada para falar. quem: o nome de quem fala agora. n: com
   quantos a voz está ligada */
export const VOZ={pode:false,ligada:false,pedindo:false,falando:false,quem:'',n:0};
const OI=5,SUMIU=16,DESISTE=20,TENTAS=2;
/* um par por pessoa com a voz ligada: {pc, audio, t (último oi), t0 (criado), ok} */
const PARES=new Map(),FALHAS=new Map();
let mic=null,oi=0,nivel=0;
/* os prazos da rede são do relógio, não do jogo */
const ja=()=>performance.now()/1000;
const nome=id=>{const m=SALA.membros.find(m=>m.id===id);return m?m.nome:'alguém'};
const daSala=id=>typeof id==='string'&&id!==ID&&SALA.membros.some(m=>m.id===id);

export function ligaVoz(){
  if(!SALA.papel||VOZ.ligada||VOZ.pedindo)return;
  const md=typeof navigator!=='undefined'&&navigator.mediaDevices;
  if(!md||!md.getUserMedia||typeof RTCPeerConnection==='undefined'){log('Este navegador não deixa usar o microfone.','warn');return}
  VOZ.pedindo=true;
  return md.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}).then(s=>{
    VOZ.pedindo=false;
    if(!SALA.papel){for(const t of s.getTracks())t.stop();return}
    mic=s;for(const t of s.getAudioTracks())t.enabled=false;
    VOZ.ligada=true;oi=0;FALHAS.clear();
    log('Voz ligada. Segure Falar (ou V) para a sala ouvir.','info');
  },e=>{
    VOZ.pedindo=false;
    log(e&&e.name==='NotAllowedError'?'Sem permissão para o microfone: a voz fica desligada.':'Não deu para abrir o microfone.','warn');
  });
}
export function desligaVoz(avisa=true){
  if(!VOZ.ligada)return;
  sinal({t:'tchau'});
  for(const id of[...PARES.keys()])fecha(id);
  if(mic)for(const t of mic.getTracks())t.stop();
  mic=null;VOZ.ligada=VOZ.falando=false;VOZ.quem='';VOZ.n=0;
  if(avisa)log('Voz desligada.','info');
}
/* segurar o botão: o som só sai enquanto ele está apertado */
export function fala(on){
  on=!!on&&VOZ.ligada;if(on===VOZ.falando)return;
  VOZ.falando=on;if(mic)for(const t of mic.getAudioTracks())t.enabled=on;
}

function fecha(id){
  const p=PARES.get(id);if(!p)return;PARES.delete(id);
  try{p.pc.close()}catch(e){}
  if(p.audio){p.audio.srcObject=null;p.audio.remove()}
}
function falhou(id){
  const n=(FALHAS.get(id)||0)+1;FALHAS.set(id,n);fecha(id);
  if(n===TENTAS)log(`Sem voz com ${nome(id)}: a rede de um de vocês não deixa ligar direto.`,'warn');
}
/* espera os candidatos (o STUN responde em menos de um segundo) até 2 s, e
   manda tudo numa mensagem só */
const junta=pc=>new Promise(r=>{
  if(pc.iceGatheringState==='complete')return r();
  const t=setTimeout(r,2000);
  pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);r()}});
});
function par(id){
  fecha(id);
  const pc=new RTCPeerConnection({iceServers:STUN}),t=ja(),p={pc,audio:null,t,t0:t,ok:false};
  PARES.set(id,p);
  for(const t of mic.getAudioTracks())pc.addTrack(t,mic);
  pc.ontrack=e=>{
    if(!p.audio){p.audio=document.createElement('audio');p.audio.autoplay=true;p.audio.hidden=true;document.body.appendChild(p.audio)}
    p.audio.srcObject=e.streams[0]||new MediaStream([e.track]);
    const r=p.audio.play();if(r&&r.catch)r.catch(()=>{});
  };
  pc.onconnectionstatechange=()=>{
    if(PARES.get(id)!==p)return;
    if(pc.connectionState==='connected'&&!p.ok){p.ok=true;FALHAS.delete(id);log(`Voz ligada com ${nome(id)}.`,'info')}
    else if(pc.connectionState==='failed')falhou(id);
  };
  return p;
}
async function oferece(id){
  const p=par(id),pc=p.pc;
  try{
    await pc.setLocalDescription(await pc.createOffer());await junta(pc);
    if(PARES.get(id)===p)sinal({t:'oferta',para:id,sdp:pc.localDescription.sdp});
  }catch(e){if(PARES.get(id)===p)falhou(id)}
}
async function responde(id,sdp){
  const p=par(id),pc=p.pc;
  try{
    await pc.setRemoteDescription({type:'offer',sdp});
    await pc.setLocalDescription(await pc.createAnswer());await junta(pc);
    if(PARES.get(id)===p)sinal({t:'resposta',para:id,sdp:pc.localDescription.sdp});
  }catch(e){if(PARES.get(id)===p)falhou(id)}
}

/* chamado por src/sala.js com cada mensagem 'voz' do canal da sala */
export function recebeVoz(q){
  if(!VOZ.ligada||!q||!daSala(q.de))return;
  const de=q.de,p=PARES.get(de);
  if(q.t==='oi'){
    if(p){p.t=ja();return}
    if((FALHAS.get(de)||0)>=TENTAS)return;
    /* quem tem o id menor oferece; o outro só se apresenta logo */
    if(ID<de)oferece(de);else oi=Math.min(oi,.5);
  }else if(q.t==='tchau')fecha(de);
  else if(q.para!==ID||typeof q.sdp!=='string'||q.sdp.length>20000)return;
  else if(q.t==='oferta')responde(de,q.sdp);
  else if(q.t==='resposta'&&p&&p.pc.signalingState==='have-local-offer')p.pc.setRemoteDescription({type:'answer',sdp:q.sdp}).catch(()=>falhou(de));
}

/* chamado pelo laço a cada quadro */
export function quadro(dt){
  VOZ.pode=!!SALA.papel&&SALA.estado==='ligado';
  if(!SALA.papel){if(VOZ.ligada)desligaVoz(false);return}
  if(!VOZ.ligada)return;
  const agora=ja();
  if(VOZ.pode){oi-=dt;if(oi<=0){oi=OI;sinal({t:'oi'})}}
  /* quem saiu da sala, sumiu ou não ligou a tempo */
  for(const[id,p]of PARES){
    if(!daSala(id)||agora-p.t>SUMIU)fecha(id);
    else if(!p.ok&&agora-p.t0>DESISTE)falhou(id);
  }
  /* quem fala, 5 vezes por segundo pelo nível de som que chega */
  nivel-=dt;if(nivel>0)return;nivel=.2;
  let q='',n=0;
  for(const[id,p]of PARES){
    if(!p.ok)continue;n++;
    for(const r of p.pc.getReceivers()){const s=r.getSynchronizationSources&&r.getSynchronizationSources()[0];if(s&&s.audioLevel>.03&&!q)q=nome(id)}
  }
  VOZ.quem=q;VOZ.n=n;
}
