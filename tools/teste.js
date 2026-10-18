#!/usr/bin/env node
/* Teste headless do Fibula: node tools/teste.js [caminho/index.html]
   Gera duas cópias do index.html em /tmp (menu com loja; incursão ativa),
   roda cada uma no Chromium headless e sai com código != 0 se algum cenário
   falhar. Sem dependências. Navegador: variável CHROME, ou o Chromium do
   Playwright em /opt/pw-browsers, ou chrome/chromium no PATH. */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const src = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fibula-teste-'));

function achaChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const cands = [path.join(base, 'chromium')];
  try { for (const d of fs.readdirSync(base)) if (/^chromium-\d+$/.test(d)) cands.push(path.join(base, d, 'chrome-linux', 'chrome')); } catch (_) {}
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch (_) {} }
  for (const n of ['chromium', 'chromium-browser', 'google-chrome', 'chrome']) {
    const r = cp.spawnSync('which', [n], { encoding: 'utf8' });
    if (r.status === 0) return r.stdout.trim();
  }
  return null;
}

const SHIM = `<script>
window.requestAnimationFrame=function(cb){return setTimeout(function(){cb(performance.now())},50)};
window.__errs=[];
function __e(m){__errs.push(String(m).slice(0,200));document.documentElement.setAttribute('data-errs',__errs.join(' | '))}
window.addEventListener('error',function(e){__e(e.message+' @'+e.lineno)});
window.addEventListener('unhandledrejection',function(e){__e('promessa: '+e.reason)});
try{localStorage.setItem('masmorra-runas-v2',JSON.stringify(%SAVE%))}catch(e){__e('seed: '+e)}
</script>`;

const HELP = `<script>
window.__r=function(k,v){document.documentElement.setAttribute('data-'+k,String(v))};
window.__clica=function(s){var e=document.querySelector(s);if(!e)throw new Error('sem '+s);e.click();return e};
window.__vis=function(s){var e=document.querySelector(s);return !!e&&!e.hidden};
</script>`;

const CENARIOS = [
  {
    nome: 'menu e Mercador',
    save: { cofre: 500, classe: 'feiticeiro', chars: { feiticeiro: { lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', 'flam', null] } } },
    patch: [],
    espera: 20000,
    roteiro: `
setTimeout(function(){try{
  if(!__vis('#menu'))throw new Error('menu não apareceu');
  __r('menu',1);
  var antes=+document.querySelector('#sCofre').textContent;
  __clica('#toShop');
  var btn=[].slice.call(document.querySelectorAll('#shopList .buy')).filter(function(b){return !b.disabled})[0];
  if(!btn)throw new Error('nenhuma melhoria comprável com cofre 500');
  btn.click();
  var s=JSON.parse(localStorage.getItem('masmorra-runas-v2'));
  if(!(s.cofre<500))throw new Error('cofre não baixou: '+s.cofre);
  __r('comprou',1);
  __clica('#shopBack');
  if(+document.querySelector('#sCofre').textContent!==s.cofre)throw new Error('menu não reflete o cofre');
  __r('ok',1);
}catch(e){__r('falha',e.message)}},1000);`,
  },
  {
    nome: 'incursão ativa até a tela final',
    save: { cofre: 0, classe: 'feiticeiro', chars: { feiticeiro: { lvl: 3, xp: 0, mag: 0, manaG: 0, per: 10, golpes: 0, slots: ['faisca', 'flam', null] } } },
    patch: [
      ['RUN=360,PORTAL_AT=90', 'RUN=12,PORTAL_AT=3'],
      ['t:0,bag:{},bagVal:0', 't:0,bag:{ouro:200},bagVal:200'],
    ],
    espera: 40000,
    roteiro: `
setTimeout(function(){try{
  __clica('#play');
  if(__vis('#menu'))throw new Error('menu continua visível após entrar');
  __r('entrou',1);
}catch(e){__r('falha',e.message)}},500);
setTimeout(function(){try{
  if(!__vis('#end'))throw new Error('tela final não apareceu');
  var l=document.querySelector('#eLoot').textContent;
  if(l.indexOf('200 ouro')!==0)throw new Error('saco inesperado: '+l);
  __r('final',document.querySelector('#endTitle').textContent);
  __clica('#again');
  if(__vis('#end'))throw new Error('nova incursão não começou');
  __r('ok',1);
}catch(e){__r('falha',e.message)}},25000);`,
  },
];

function monta(c, html) {
  for (const [de, para] of c.patch) {
    if (!html.includes(de)) throw new Error(`cenário "${c.nome}": trecho para patch não encontrado no index.html: ${de}`);
    html = html.replace(de, para);
  }
  if (!/<head>/.test(html) || !html.includes('</body>')) throw new Error('index.html sem <head> ou </body>');
  html = html.replace('<head>', '<head>' + SHIM.replace('%SAVE%', JSON.stringify(c.save)));
  return html.replace('</body>', HELP + '<script>' + c.roteiro + '</script></body>');
}

const chrome = achaChrome();
if (!chrome) { console.error('FALHA: Chromium não encontrado (defina CHROME)'); process.exit(2); }
const html = fs.readFileSync(src, 'utf8');
let falhas = 0;

CENARIOS.forEach((c, i) => {
  const arq = path.join(tmp, `test${i}.html`);
  fs.writeFileSync(arq, monta(c, html));
  const r = cp.spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--user-data-dir=' + path.join(tmp, 'perfil' + i), '--allow-file-access-from-files',
    '--virtual-time-budget=' + c.espera, '--dump-dom', 'file://' + arq,
  ], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 << 20 });
  const dom = r.stdout || '';
  /* filtra pelo atributo seguido de = e aspa: o próprio código do harness casa com a palavra solta */
  const tag = (dom.match(/<html[^>]*>/) || [''])[0];
  const attr = n => { const m = tag.match(new RegExp('\\sdata-' + n + '="([^"]*)"')); return m ? m[1] : null; };
  const erros = attr('errs'), falha = attr('falha'), ok = attr('ok') === '1';
  if (r.error || !dom) { console.error(`FALHA [${c.nome}]: navegador não rodou (${r.error || r.stderr.slice(0, 200)})`); falhas++; return; }
  if (erros) { console.error(`FALHA [${c.nome}]: erros no console: ${erros}`); falhas++; }
  else if (falha) { console.error(`FALHA [${c.nome}]: ${falha}`); falhas++; }
  else if (!ok) { console.error(`FALHA [${c.nome}]: roteiro não terminou`); falhas++; }
  else console.log(`ok [${c.nome}]` + (attr('final') ? ` — fim: ${attr('final')}` : ''));
});

fs.rmSync(tmp, { recursive: true, force: true });
if (falhas) { console.error(`${falhas} cenário(s) falharam`); process.exit(1); }
console.log('TESTE_OK');
