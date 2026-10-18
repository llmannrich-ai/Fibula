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
   outra conta vence sempre a nuvem, para uma conta não herdar a outra. */
import {normaliza,save,setSave} from './sim/progresso.js?v=0.8.0';
import {G} from './sim/incursao.js?v=0.8.0';
import {KEY,persist,marcaFalha,aoGravar} from './salvar.js?v=0.8.0';
import {menu,showMenu} from './telas.js?v=0.8.0';
import {$} from './dom.js?v=0.8.0';

export const SB_URL='https://bpwljbualdjlwmzcryzl.supabase.co',SB_KEY='sb_publishable_3qKOZTHCsqhpQkyIXNwsrg_KUxPvFhp';
const KEYS=KEY+'-sessao';
let sessao=null;try{sessao=JSON.parse(localStorage.getItem(KEYS)||'null')}catch(e){}
/* sessão do login por e-mail, que saiu: some do aparelho */
if(sessao&&!sessao.tk){sessao=null;try{localStorage.removeItem(KEYS)}catch(e){}}
const nuvem={pronto:false,msg:'',erro:false,timer:0,sujo:false};
const guardaSessao=v=>{sessao=v;try{v?localStorage.setItem(KEYS,JSON.stringify(v)):localStorage.removeItem(KEYS)}catch(e){}};
const rpc=(fn,corpo,keepalive)=>fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',keepalive:!!keepalive,
  headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(corpo)});
/* as funções do banco levantam uma palavra-chave como mensagem de erro */
const erroRpc=async r=>{try{return(await r.json()).message||''}catch(e){return''}};
const MSG_CONTA={credenciais:'Usuário ou senha incorretos.',usuario_existe:'Esse nome de usuário já existe. Escolha outro ou entre com a senha dele.',
  usuario_invalido:'O nome de usuário precisa ter de 1 a 24 caracteres.',senha_invalida:'A senha não pode ficar vazia.'};
const sessaoMorta=()=>{guardaSessao(null);nuvem.pronto=false;nuvem.erro=false;nuvem.msg='Sua sessão expirou. Entre de novo.';desenhaConta()};
async function empurra(keepalive){
  if(!sessao||!nuvem.pronto)return;
  nuvem.sujo=false;
  try{
    const r=await rpc('save_gravar',{p_token:sessao.tk,p_dados:save},keepalive);
    if(!r.ok){if(await erroRpc(r)==='sessao')return sessaoMorta();throw new Error('HTTP '+r.status)}
    if(nuvem.erro){nuvem.erro=false;desenhaConta()}
  }catch(e){nuvem.sujo=true;if(!nuvem.erro){nuvem.erro=true;desenhaConta()}}
}
function agendaNuvem(){
  if(!sessao||!nuvem.pronto)return;
  nuvem.sujo=true;clearTimeout(nuvem.timer);nuvem.timer=setTimeout(empurra,1500);
}
aoGravar(agendaNuvem);
export async function puxa(){
  if(!SB_KEY||!sessao)return;
  /* não troca o save no meio de uma incursão: espera ela acabar */
  if(G&&G.active)return void setTimeout(puxa,3000);
  try{
    const r=await rpc('save_ler',{p_token:sessao.tk});
    if(!r.ok){if(await erroRpc(r)==='sessao')return sessaoMorta();throw new Error('HTTP '+r.status)}
    const d=await r.json();
    if(!sessao)return;
    if(G&&G.active)return void setTimeout(puxa,3000);
    /* aparelho que era de outra conta: o save local é dela, nunca vai para esta */
    const ligado=save.dono===sessao.uid,outro=!!save.dono&&!ligado;
    const adota=!!d&&(ligado?(d.em||0)>(save.em||0):outro||(d.runs|0)>=(save.runs|0));
    if(adota){setSave(normaliza(d));save.dono=sessao.uid;try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){marcaFalha()}}
    nuvem.pronto=true;nuvem.erro=false;
    if(!adota){save.dono=sessao.uid;persist()}
    if(!menu.hidden)showMenu();else desenhaConta();
  }catch(e){nuvem.erro=true;desenhaConta();setTimeout(puxa,30000)}
}
/* o nome de usuário da conta ligada, ou null: é o nome que os outros veem na cidade */
export const quemSou=()=>sessao?sessao.usuario||null:null;
export function desenhaConta(){
  const box=$('#mConta');box.hidden=!SB_KEY;if(!SB_KEY)return;
  $('#contaF').hidden=!!sessao;$('#contaSair').hidden=!sessao;
  $('#contaT').textContent=sessao
    ?(nuvem.erro?'Sem conexão com a nuvem agora. O progresso segue salvo neste aparelho.'
      :nuvem.pronto?`Progresso salvo na nuvem · ${sessao.usuario}`:'Conectando à nuvem…')
    :nuvem.msg||'Entre com um usuário e uma senha para guardar o progresso na nuvem e continuar em outro aparelho.';
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
$('#contaSair').addEventListener('click',async()=>{
  clearTimeout(nuvem.timer);if(nuvem.sujo)await empurra();
  if(sessao)rpc('conta_sair',{p_token:sessao.tk}).catch(()=>{});
  guardaSessao(null);nuvem.pronto=false;nuvem.erro=false;nuvem.msg='';desenhaConta();
});
/* fechar a aba ou trocar de app não pode deixar a última gravação para trás */
addEventListener('visibilitychange',()=>{if(document.hidden&&nuvem.sujo){clearTimeout(nuvem.timer);empurra(true)}});
