# Fibula — guia para agentes

Leia este arquivo inteiro antes do primeiro `edit`. Ele diz **como** trabalhar
aqui. O **por quê** de cada decisão de jogo está em [VISAO.md](VISAO.md), e é de
leitura obrigatória antes de qualquer mudança que o jogador perceba.

## O que é

Fibula é um RPG de extração para celular. O jogador entra numa masmorra gerada
na hora, mata o que puder, enche o saco de loot e precisa alcançar o portal
antes do tempo acabar. Se morrer, perde o saco. O ouro extraído vai para o
cofre e só sai dele no Mercador, em melhorias permanentes.

A base filosófica é **Tibia raiz num celular**: a morte custa, o mundo parece
maior que você, mas a partida cabe em menos de dez minutos. Os cinco pilares e
os não-objetivos estão em [VISAO.md](VISAO.md).

Ao vivo em https://llmannrich-ai.github.io/Fibula/ (GitHub Pages, branch `main`,
raiz do repositório).

## Regra número um: um arquivo, uma dependência

Todo o jogo é o [index.html](index.html) — hoje ~860 linhas. Não há build, não
há `package.json`, não há import, não há arquivo `.js` ou `.css` separado. O
GitHub Pages serve o arquivo cru, e o `.nojekyll` existe para ele não ser
processado.

Isso é uma escolha, não uma dívida: o jogo abre instantâneo no celular e
qualquer agente consegue ler o programa inteiro de uma vez. **Não quebre isso.**
Nenhuma biblioteca, nenhum bundler, nenhum arquivo separado — nem "só para
organizar".

A única exceção hoje é uma folha de estilo externa do Google Fonts (Pixelify
Sans e Barlow Semi Condensed), nas linhas 13–15. Ela é um resto conhecido, não
um precedente: degrada para `system-ui`/`sans-serif` se não carregar, mas é a
única coisa no jogo que depende de rede. Está no [ROADMAP.md](ROADMAP.md) para
ser embutida ou removida. **Não adicione outras.**

Se o arquivo passar de ~2000 linhas, aí sim vale discutir a separação com o
Leonardo antes de fazer.

## Mapa do index.html

| Linhas | Bloco | Conteúdo |
|---|---|---|
| 3–132 | `<head>` | meta de viewport e de app móvel, estilo crítico inline (11), título, fontes externas (13–15) |
| 16–130 | `<style>` | todo o CSS: HUD, telas, botões, joystick |
| 133–213 | markup | `#app`, canvas, HUD, `#menu`, `#end`, `#shop`, `#joy` |
| 214–858 | `<script>` | o jogo, numa IIFE em modo estrito |

O script é dividido por comentários de seção `/* ---------- nome ---------- */`.
**Mantenha essa divisão** e coloque código novo na seção certa:

- **progresso salvo** — `KEY`, `save`, `persist()`, `xpNeed()`, `stats()`
- **melhorias permanentes** — tabela `UP`, `upCost()`, `sealPct()`
- **dados do jogo** — tabelas `MT` (monstros), `ITEMS`, `LOOT`
- **mapa** — `genMap()`, `corridor()`, `carve()`
- **estado da incursão** — `newRun()`, `spawn()`, `pickType()`
- **física** — `solid()`, `blocked()`, `move()`, `buildFlow()`, `reveal()`
- **efeitos e mensagens** — `log()`, `banner()`, `num()`, `shake()`, `spark()`
- **combate** — `castBolt()`, `castRune()`, `drinkPot()`, `hitMon()`, `kill()`,
  `gainXp()`, `hurtPlayer()`, `pickup()`
- **atualização** — `update()`, `updateMons()`, `updateProj()`, `finish()`
- **desenho** — `render()`, `drawPlayer()`, `drawMon()`, `drawMini()`
- **HUD** — `hud()` e o cache de elementos `E`
- **telas** — `showMenu()`, `start()`, `showEnd()`
- **mercador** — `drawShop()`, `buy()`, `showShop()`
- **controles** — joystick por ponteiro, `bindHold()`, teclado
- **laço** — `frame()`, `onResize()`

### Números que governam o jogo

Constantes no topo do script: `T=32` (lado do tile), `MW=MH=64` (mapa),
`RUN=360` (duração da incursão em segundos), `PORTAL_AT=90` (quando o portal
abre), `EXT=2.5` (segundos parado no portal para extrair).

Balanceamento vive nas tabelas `MT`, `LOOT`, `ITEMS` e `UP`, não espalhado pelo
código. Ajuste de dificuldade é edição de tabela. Se você se pegar escrevendo um
número mágico dentro de `updateMons()`, ele provavelmente devia ser um campo em
`MT`.

### Duas coisas sutis que já custaram tempo

**O campo de fluxo.** A perseguição dos monstros não é um pathfinding por
monstro: `buildFlow()` faz uma BFS a partir do jogador e preenche `G.flow` com a
distância em tiles, recalculada a cada 0,2 s e cortada em 22 passos. Os
monstros só leem esse campo. Por isso aggro é medido em distância de fluxo
(`fd<=9`, chefe `fd<=7`, desiste em `fd>18`) e não em linha reta — um monstro do
outro lado da parede não vem. Mexer nisso muda o jogo inteiro.

**O save é mesclado, não substituído.** `localStorage` na chave
`masmorra-runas-v1`, formato
`{lvl,xp,cofre,runs,ext,deaths,best,up:{vigor,foco,poder,bolsa,seguro}}`. A
leitura faz `Object.assign` sobre os padrões, então **adicionar** campo novo é
seguro e não apaga o progresso de ninguém. Só suba a versão da `KEY` se o
significado de um campo existente mudar — e isso zera o save de todos os
jogadores, então é decisão do Leonardo, não sua.

Toda escrita em `save` precisa de `persist()` depois. Todo atributo derivado
(vida máxima, mana máxima, poder) passa por `stats()`.

## Convenções de código

O estilo é deliberadamente compacto — linhas densas, nomes curtos, `const` em
tudo. Escreva no mesmo registro do código vizinho; não "arrume" o estilo
existente.

- **Domínio em português, motor em inglês ou abreviado.** `save`, `cofre`,
  `bag`, `mons`, `portal`, `pot` convivem com `ctx`, `dt`, `hyp`, `clamp`,
  `fx`. Siga.
- **Tudo que o jogador lê é português correto, com acentos.** Nomes de monstro,
  de item, mensagens de log, rótulos de botão, textos de tela.
- **Grades são `Uint8Array` ou `Int16Array`**, indexadas `y*MW+x`. Não troque
  por array de arrays.
- **Nada de alocação no laço quente.** `update()` e `render()` rodam 60 vezes
  por segundo; evite criar objetos e arrays por quadro.
- **Acessibilidade não é opcional.** `prefers-reduced-motion` já é respeitado
  (`RM` desliga o tremor de tela); botões gerados levam `aria-label`. Mantenha.
- **Sem `console.log` no código entregue.**

## Como testar — não pule esta parte

Validar só o menu dá falsa confiança: `update()`, `gainXp()` e `finish()` ficam
fora do caminho executado. O teste que pega erro de verdade é o da incursão
ativa.

### 1. Sintaxe (obrigatório antes de qualquer commit de código)

```bash
sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d' > /tmp/game.js && node --check /tmp/game.js && echo SINTAXE_OK
```

Sem `SINTAXE_OK` na saída, **não comite**. Um erro de sintaxe aqui derruba o
jogo inteiro, porque é um arquivo só.

### 2. Execução headless

O navegador embutido do Claude não abre `file://`. Use o Edge headless, com
`--user-data-dir` sempre apontando para um perfil temporário, para não tocar no
perfil real:

```bash
msedge --headless=new --disable-gpu --no-first-run --user-data-dir=/tmp/perfil-teste --allow-file-access-from-files --virtual-time-budget=40000 --dump-dom "file:///caminho/test.html"
```

No Windows o binário está em
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.

**`requestAnimationFrame` não dispara nesse modo.** Sem um shim, o laço nunca
roda e você lê só os placeholders estáticos do markup (`100/100`, `×3`) e acha
que passou. Injete antes do script do jogo:

```js
window.requestAnimationFrame=function(cb){return setTimeout(function(){cb(performance.now())},50)};
```

50 ms é o `dt` máximo que o jogo aceita, então cada quadro avança o tempo de
jogo no passo cheio e a `--virtual-time-budget` controla a duração do teste.

O `test.html` é uma **cópia** do `index.html` com: um capturador que joga erros
num atributo `data-errs` no `<html>`, o save semeado no `localStorage`, e um
roteiro que clica nos botões e grava os resultados em atributos `data-*`. Depois
é só procurar no `--dump-dom`. Para encurtar a incursão, patcheie **só a
cópia**: `RUN=360` para `12`, `PORTAL_AT=90` para `3`, e semeie o saco
(`bag:{},bagVal:0` para `bag:{ouro:200},bagVal:200`) para a aritmética ficar
determinística.

Rode os dois harness — menu com loja, e incursão ativa — e confirme que o
atributo `data-errs` está **ausente** nos dois dumps. Cuidado: contar ocorrências
de `data-errs` dá falso positivo, porque casa com o próprio código do harness no
DOM; filtre pelo nome do atributo seguido do sinal de igual e da aspa.

### 3. O que olhar antes de dizer que está pronto

Uma incursão inteira do início ao fim sem erro no console. Morrer de propósito e
conferir a tela final. Extrair e conferir que o cofre subiu. Comprar no
Mercador e conferir que o efeito aparece na incursão seguinte. Recarregar e
conferir que o save sobreviveu.

## Git e o ciclo automático

Existe uma rotina de nuvem que roda de duas em duas horas, desenvolve **um**
item do roadmap e **comita direto na `main`**. A rede de segurança é o histórico
do git (`git revert`), não revisão prévia — foi decisão do Leonardo. Por isso a
checagem de sintaxe acima não é recomendação, é portão.

Proibido: `push --force`, `rebase`, reescrever histórico.

Dois arquivos são o contrato entre execuções, ambos na raiz da `main`:

- **[ROADMAP.md](ROADMAP.md)** — seções `Agora`, `Próximo`, `Depois` e
  `Concluído`. `Agora` tem **um** item. Ao terminar, mova para `Concluído` com a
  data e promova o próximo.
- **[DIARIO.md](DIARIO.md)** — uma entrada por execução, mais recente no topo,
  máximo 20. Diga o que mudou, o que você testou e o que ficou torto.

Mensagem de commit em português, no imperativo, descrevendo o efeito para o
jogador — não o arquivo tocado. "Adiciona o Mercador: o cofre agora tem onde ser
gasto", não "atualiza index.html".

Armadilha conhecida: `gh pr list` e `gh pr view` falham com HTTP 403 nas sessões
de nuvem. Use `gh api repos/{owner}/{repo}/pulls`. O `gh pr create` funciona.

## Antes de propor qualquer coisa

Passe a ideia pelos cinco pilares e pelos não-objetivos de
[VISAO.md](VISAO.md). Uma funcionalidade que não serve nenhum pilar não entra,
mesmo que seja boa — e uma que contraria um não-objetivo não entra nem se for
ótima. Se a ideia for realmente boa e o pilar estiver errado, diga isso em vez
de contornar: o documento também pode mudar.
