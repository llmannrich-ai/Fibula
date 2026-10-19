/* ---------- conta e save na nuvem (Supabase) ----------
   Opcional e sem biblioteca: fetch puro na API do Supabase com a chave
   pública. Login simples da fase de teste, com usuário e senha e sem e-mail:
   o jogo só chama as funções conta_* e save_* do banco
   (tools/supabase/002_login_simples.sql), que conferem senha e token; as
   tabelas não são acessíveis de fora. Sem sessão nada daqui fala com a rede, e
   o jogo segue só com o localStorage.
   Conflito entre aparelhos: no aparelho já ligado à conta vence o save gravado
   por último (save.em); no primeiro login de um aparelho vence o que tem mais
   incursões, para um save novo nunca apagar um antigo; num aparelho que era de
   outra conta vence sempre a nuvem, para uma conta não herdar a outra.
   Depois de uma operação do mercado (save.mkt), a nuvem recusa save mais
   velho que ela ('mercado'), e este aparelho adota o da nuvem. */
import {normaliza,soPecas,save,setSave,ehMat} from './sim/progresso.js?v=0.47.0';
import {ITEMS} from './sim/dados.js?v=0.47.0';
import {G} from './sim/incursao.js?v=0.47.0';
import {pecasDaCaca,vestidasDaCaca} from './sim/combate.js?v=0.47.0';
import {KEY,persist,marcaFalha,aoGravar} from './salvar.js?v=0.47.0';
import {menu,showMenu,pickS,showPick} from './telas.js?v=0.47.0';
import {$} from './dom.js?v=0.47.0';

export const SB_URL='https://bpwljbualdjlwmzcryzl.supabase.co',SB_KEY='sb_publishable_3qKOZTHCsqhpQkyIXNwsrg_KUxPvFhp';
const KEYS=KEY+'-sessao';
let sessao=null;try{sessao=JSON.parse(localStorage.getItem(KEYS)||'null')}catch(e){}
/* sessão do login por e-mail, que saiu: some do aparelho */
if(sessao&&!sessao.tk){sessao=null;try{localStorage.removeItem(KEYS)}catch(e){}}
const nuvem={pronto:false,msg:'',erro:false,timer:0,sujo:false,voo:null};
const guardaSessao=v=>{sessao=v;try{v?localStorage.setItem(KEYS,JSON.stringify(v)):localStorage.removeItem(KEYS)}catch(e){}};
const rpc=(fn,corpo,keepalive)=>fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',keepalive:!!keepalive,
  headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(corpo)});
/* as funções do banco levantam uma palavra-chave como mensagem de erro */
const erroRpc=async r=>{try{return(await r.json()).message||''}catch(e){return''}};
const MSG_CONTA={credenciais:'Usuário ou senha incorretos.',usuario_existe:'Esse nome de usuário já existe. Escolha outro ou entre com a senha dele.',
  usuario_invalido:'O nome de usuário precisa ter de 1 a 24 caracteres.',senha_invalida:'A senha não pode ficar vazia.'};
const sessaoMorta=()=>{guardaSessao(null);nuvem.pronto=false;nuvem.erro=false;nuvem.msg='Sua sessão expirou. Entre de novo.';desenhaConta()};
/* a gravação em voo fica em nuvem.voo, para o mercado esperar por ela */
const empurra=keepalive=>nuvem.voo=sobe(keepalive);
async function sobe(keepalive){
  if(!sessao||!nuvem.pronto)return;
  nuvem.sujo=false;
  try{
    const r=await rpc('save_gravar',{p_token:sessao.tk,p_dados:save},keepalive);
    if(!r.ok){const m=await erroRpc(r);if(m==='sessao')return sessaoMorta();
      /* outro aparelho (ou uma resposta perdida) mexeu no mercado depois deste save */
      if(m==='mercado')return puxa(true);
      throw new Error('HTTP '+r.status)}
    if(nuvem.erro){nuvem.erro=false;desenhaConta()}
  }catch(e){nuvem.sujo=true;if(!nuvem.erro){nuvem.erro=true;desenhaConta()}}
}
function agendaNuvem(){
  if(!sessao||!nuvem.pronto)return;
  nuvem.sujo=true;clearTimeout(nuvem.timer);nuvem.timer=setTimeout(empurra,1500);
}
aoGravar(agendaNuvem);
export async function puxa(forca){
  if(!SB_KEY||!sessao)return;
  /* não troca o save no meio de uma incursão: espera ela acabar */
  if(G&&G.active)return void setTimeout(()=>puxa(forca),3000);
  try{
    const r=await rpc('save_ler',{p_token:sessao.tk});
    if(!r.ok){if(await erroRpc(r)==='sessao')return sessaoMorta();throw new Error('HTTP '+r.status)}
    const d=await r.json();
    if(!sessao)return;
    if(G&&G.active)return void setTimeout(()=>puxa(forca),3000);
    /* aparelho que era de outra conta: o save local é dela, nunca vai para esta */
    const ligado=save.dono===sessao.uid,outro=!!save.dono&&!ligado;
    const adota=!!d&&(forca||(ligado?(d.em||0)>(save.em||0):outro||(d.runs|0)>=(save.runs|0)));
    if(adota){setSave(normaliza(d));save.dono=sessao.uid;try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){marcaFalha()}}
    nuvem.pronto=true;nuvem.erro=false;esvazia();
    if(!adota){save.dono=sessao.uid;persist()}
    seguir();
  }catch(e){nuvem.erro=true;seguir();setTimeout(()=>puxa(forca),30000)}
}
/* ---------- mercado entre jogadores ----------
   O livro de ofertas e o match moram no banco (tools/supabase/003_mercado.sql),
   que confere o que se oferece contra o save da nuvem e o altera na mesma
   transação. Por isso o save deste aparelho sobe antes de cada operação, e o
   cofre e as peças que o banco devolve substituem os daqui. O erro sai como a
   palavra-chave do banco ('sem_ouro', 'limite'…) ou 'conta', 'nuvem', 'rede'. */
export const temConta=()=>!!sessao;
export async function mercado(fn,args){
  if(!sessao)throw new Error('conta');
  if(!nuvem.pronto)throw new Error('nuvem');
  const muda=fn!=='mercado_livro';
  await esvazia();
  if(muda){clearTimeout(nuvem.timer);await nuvem.voo;if(nuvem.sujo)await empurra();if(nuvem.sujo)throw new Error('rede')}
  let r;try{r=await rpc(fn,Object.assign({p_token:sessao.tk},args))}catch(e){throw new Error('rede')}
  if(!r.ok){const m=await erroRpc(r);if(m==='sessao')sessaoMorta();throw new Error(m||'rede')}
  const d=await r.json();
  if(muda){save.cofre=Math.max(0,d.cofre|0);save.itens=soPecas(d.itens);save.mkt=d.mkt|0;persist()}
  return d;
}
/* ---------- origem do loot ----------
   O banco só deixa anunciar o que tem origem registrada
   (tools/supabase/004_origem.sql): a caçada abre no banco ao começar
   (caca_comecar) e fecha ao acabar (caca_fim), com o que a caçada rendeu na
   extração (só o que a mochila tem a mais do que tinha ao entrar: o resto já
   foi contado na caçada em que veio) ou o ouro do Selo na morte; a venda ao Banco também avisa
   (lastro_banco). O que não chegou por falta de rede espera numa fila no
   aparelho e vai antes da próxima operação da Feira. */
const KEYF=KEY+'-fila';
let fila=[];try{fila=JSON.parse(localStorage.getItem(KEYF)||'[]')||[]}catch(e){}
const guardaFila=()=>{try{localStorage.setItem(KEYF,JSON.stringify(fila))}catch(e){}};
let esvaziando=null;
/* manda a fila em ordem; para no primeiro erro de rede, descarta o que o
   banco recusou (caçada já fechada, sessão de outra conta) */
function esvazia(){
  if(esvaziando)return esvaziando;
  return esvaziando=(async()=>{
    while(fila.length&&sessao){
      const f=fila[0];
      if(f.uid===sessao.uid){
        let r;try{r=await rpc(f.fn,Object.assign({p_token:sessao.tk},f.args))}catch(e){break}
        if(!r.ok&&r.status>=500)break;
      }
      fila.shift();guardaFila();
    }
  })().finally(()=>{esvaziando=null});
}
const enfila=(fn,args)=>{if(!sessao)return;fila.push({fn,args,uid:sessao.uid});guardaFila();esvazia()};
const caca={id:null};
export const cacaId=()=>caca.id;
export async function cacaComeca(){
  caca.id=null;if(!sessao||!nuvem.pronto)return;
  try{const r=await rpc('caca_comecar',{p_token:sessao.tk});if(r.ok)caca.id=await r.json()}catch(e){}
}
/* kind: extraiu, morreu ou desabou; p: o jogador deste aparelho */
export function cacaFim(kind,p){
  if(!caca.id)return;
  /* peças: as que a caçada rendeu (pecasDaCaca); ouro e gemas viram ouro no
     Banco; material vai para o Gordon, sem origem */
  const b0=p.bag0||{};let ouro=0;
  for(const[k,q]of Object.entries(p.bag)){const n=q-(b0[k]|0);if(n>0&&!ITEMS[k].slot&&!ehMat(k))ouro+=ITEMS[k].val*n}
  enfila('caca_fim',{p_id:caca.id,p_desfecho:kind,p_saco:kind==='extraiu'?pecasDaCaca(p):vestidasDaCaca(p),p_ouro:kind==='extraiu'?ouro:p.sealed|0});
  caca.id=null;
}
export const lastroBanco=(k,val)=>enfila('lastro_banco',{p_item:k,p_val:val});
/* o nome de usuário da conta ligada: é o nome que os outros veem na cidade */
export const quemSou=()=>sessao?sessao.usuario||null:null;
/* depois de ler a nuvem (ou de não conseguir), quem está na tela de entrada
   segue para a escolha de personagem, e quem já está nela a vê de novo com o
   save que chegou: com conta aberta, a tela de entrada não aparece */
function seguir(){if(!menu.hidden)showMenu();else if(!pickS.hidden)showPick();else desenhaConta()}
export function desenhaConta(){
  /* a tela de entrada é só para quem não tem conta aberta: entrar, criar ou jogar sem conta */
  const pl=$('#play');if(!pl.disabled){pl.textContent=SB_KEY?'Jogar sem conta':'Jogar';pl.className=SB_KEY?'link':'cta'}
  $('#pickBack').textContent=sessao?'Sair da conta':'Voltar';
  const pc=$('#pConta');pc.hidden=!sessao;
  const box=$('#mConta');box.hidden=!SB_KEY;if(!SB_KEY)return;
  $('#contaF').hidden=!!sessao;
  const t=sessao?(nuvem.erro?'Sem conexão com a nuvem agora. O progresso segue salvo neste aparelho.'
      :nuvem.pronto?`Progresso salvo na nuvem · ${sessao.usuario}`:'Conectando à nuvem…'):'';
  $('#contaT').textContent=sessao?t:nuvem.msg||'';pc.textContent=t;
}
async function acessa(fn){
  const u=$('#contaU').value.trim(),pw=$('#contaS').value;
  if(!u||!pw){nuvem.msg='Preencha usuário e senha.';return desenhaConta()}
  $('#contaB').disabled=$('#contaC').disabled=true;
  try{
    const r=await rpc(fn,{p_usuario:u,p_senha:pw});
    if(r.ok){const j=await r.json();guardaSessao({tk:j.token,uid:j.id,usuario:j.usuario});nuvem.msg='';$('#contaS').value='';puxa()}
    else nuvem.msg=MSG_CONTA[await erroRpc(r)]||'Não deu para entrar agora. Tente de novo.';
  }catch(e){nuvem.msg='Sem conexão. Tente de novo quando tiver rede.'}
  $('#contaB').disabled=$('#contaC').disabled=false;desenhaConta();
}
$('#contaF').addEventListener('submit',ev=>{ev.preventDefault();acessa('conta_entrar')});
$('#contaC').addEventListener('click',()=>acessa('conta_criar'));
export async function sairDaConta(){
  clearTimeout(nuvem.timer);if(nuvem.sujo)await empurra();
  if(sessao)rpc('conta_sair',{p_token:sessao.tk}).catch(()=>{});
  guardaSessao(null);nuvem.pronto=false;nuvem.erro=false;nuvem.msg='';desenhaConta();
}
/* fechar a aba ou trocar de app não pode deixar a última gravação para trás */
addEventListener('visibilitychange',()=>{if(document.hidden&&nuvem.sujo){clearTimeout(nuvem.timer);empurra(true)}});
/* ---------- telemetria ----------
   Os eventos da Parte 2 do CLAUDE.md (sessao_inicio, caca_inicio, caca_fim,
   compra, nivel_up, erro_cliente) vão em lote para telemetria_gravar
   (tools/supabase/007_telemetria.sql). Sem dado pessoal: quem manda é o
   aparelho, um uuid sorteado aqui e guardado no localStorage; com conta, o
   banco tira o jogador do token. Funciona sem conta. O que não subiu espera
   numa fila no aparelho (até 300 eventos) e vai na próxima chance; nada aqui
   segura o jogo nem mostra erro. */
const KEYT=KEY+'-tel',KEYA=KEY+'-aparelho',TEL_MAX=300,TEL_LOTE=50;
const VER=(()=>{try{return new URL(import.meta.url).searchParams.get('v')||'dev'}catch(e){return 'dev'}})();
const aparelho=(()=>{let a=null;try{a=localStorage.getItem(KEYA)}catch(e){}
  if(!a||!/^[0-9a-f-]{36}$/.test(a)){
    const h=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    a=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;
    try{localStorage.setItem(KEYA,a)}catch(e){}}
  return a})();
let telFila=[];try{telFila=JSON.parse(localStorage.getItem(KEYT)||'[]')||[]}catch(e){}
const tGuarda=()=>{try{localStorage.setItem(KEYT,JSON.stringify(telFila))}catch(e){}};
const telV={timer:0,voo:false};
async function telSobe(keepalive){
  clearTimeout(telV.timer);telV.timer=0;
  if(!telFila.length)return;
  if(telV.voo){telV.timer=setTimeout(telSobe,5000);return}
  telV.voo=true;const lote=telFila.slice(0,TEL_LOTE);let foi=false;
  try{
    const r=await rpc('telemetria_gravar',{p_aparelho:aparelho,p_token:sessao?sessao.tk:null,p_versao:VER,p_eventos:lote},keepalive);
    /* 4xx: o banco não quer este lote (formato velho); descarta para não travar a fila */
    if(r.ok||r.status<500){telFila.splice(0,lote.length);tGuarda();foi=true}
  }catch(e){}
  telV.voo=false;
  /* sobrou: o lote seguinte logo; sem rede, de novo em 60 s */
  if(telFila.length&&!telV.timer)telV.timer=setTimeout(telSobe,foi?2000:60000);
}
export function tel(e,d,ja){
  telFila.push({e,t:Date.now(),d:d||{}});
  if(telFila.length>TEL_MAX)telFila.splice(0,telFila.length-TEL_MAX);
  tGuarda();
  if(ja)telSobe();else if(!telV.timer)telV.timer=setTimeout(telSobe,20000);
}
export const telAparelho=()=>aparelho;
/* a caçada: o começo guarda lugar, nível e hora; o fim manda a duração, o que
   havia na mochila e os níveis que subiram (o save já tem o resultado) */
const telCaca={t0:0,lugar:'',lvl:0,classe:''};
export function telCacaInicio(lugar,c,classe,grupo){
  Object.assign(telCaca,{t0:Date.now(),lugar,lvl:c.lvl,classe});
  tel('caca_inicio',{lugar,classe,nivel:c.lvl,grupo});
}
export function telCacaFim(fim,c,mochila,xp,perdeu){
  if(!telCaca.t0)return;
  const dur=Math.round((Date.now()-telCaca.t0)/1000),{lugar,classe,lvl}=telCaca;telCaca.t0=0;
  tel('caca_fim',{lugar,classe,fim,dur,nivel:c.lvl,mochila,xp:xp|0,perdeu:perdeu|0});
  for(let n=lvl+1;n<=c.lvl;n++)tel('nivel_up',{classe,nivel:n});
  telSobe();
}
/* erros: um de cada mensagem, no máximo 5 por sessão */
const errosVistos=new Set();
const telErro=(msg,onde)=>{msg=String(msg||'').slice(0,200);if(errosVistos.has(msg)||errosVistos.size>=5)return;
  errosVistos.add(msg);tel('erro_cliente',{msg,onde:String(onde||'').replace(/^.*\/(src\/)/,'$1').slice(0,120)},true)};
addEventListener('error',ev=>telErro(ev.message,ev.filename?`${ev.filename}:${ev.lineno}`:''));
addEventListener('unhandledrejection',ev=>{const r=ev.reason;telErro(r&&r.message||r,r&&r.stack&&String(r.stack).split('\n')[1])});
addEventListener('visibilitychange',()=>{if(document.hidden&&telFila.length)telSobe(true)});
