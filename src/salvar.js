/* ---------- progresso salvo neste navegador ----------
   localStorage na chave masmorra-runas-v2, mesclado sobre os padrões; sem ela,
   procura a v1 e migra. Subir a KEY sem escrever a migração zera o progresso
   de todos os jogadores. */
import {CLASSES} from './sim/dados.js?v=0.6.0';
import {UP0,novoChar,normaliza,save,setSave} from './sim/progresso.js?v=0.6.0';

export const KEY='masmorra-runas-v2';
const KEY1='masmorra-runas-v1';
export let saveFalhou=false; // vira true se o navegador recusou gravar: o menu avisa
export const marcaFalha=()=>{saveFalhou=true};
/* precisa do conteúdo carregado: a migração chama slotsIniciais() */
export function carregaSave(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null');
    if(s){const faltava=!!(s.classe&&CLASSES[s.classe]&&!(s.chars||{})[s.classe]);
      setSave(normaliza(s));if(faltava)localStorage.setItem(KEY,JSON.stringify(save))}
    else{ // migra o save da Etapa 2: cofre, melhorias e o nível viram um Feiticeiro
      const v1=JSON.parse(localStorage.getItem(KEY1)||'null');
      if(v1){
        save.cofre=v1.cofre|0;save.runs=v1.runs|0;save.ext=v1.ext|0;save.deaths=v1.deaths|0;save.best=v1.best|0;
        save.up=Object.assign({},UP0,v1.up||{});
        save.classe='feiticeiro';
        save.chars.feiticeiro=novoChar('feiticeiro',Math.max(1,v1.lvl|0));
        save.chars.feiticeiro.xp=v1.xp|0;
        localStorage.setItem(KEY,JSON.stringify(save));
      }
    }
  }catch(e){}
  try{localStorage.setItem(KEY+'-sonda','1');localStorage.removeItem(KEY+'-sonda')}catch(e){saveFalhou=true}
}
/* a nuvem (src/nuvem.js) se registra aqui para subir cada gravação */
let aposGravar=()=>{};
export const aoGravar=f=>{aposGravar=f};
export const persist=()=>{save.em=Date.now();try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){saveFalhou=true}aposGravar()};
