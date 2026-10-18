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

Todo o jogo é o [index.html](index.html) — hoje ~1380 linhas. Não há build, não
há `package.json`, não há import, não há arquivo `.js` ou `.css` separado. O
GitHub Pages serve o arquivo cru, e o `.nojekyll` existe para ele não ser
processado. A pasta `docs/` guarda análise de design, e a `tools/` ferramenta de
desenvolvimento (teste, servidor local, extração de dados) — nada em nenhuma das
duas vai para o navegador do jogador. A regra vale para o que é **servido**: o
`tools/testar.mjs` roda no Node e pode ter o tamanho que precisar.

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

O arquivo tem 1382 linhas em 18/10/2026. Os quatro blocos são `<head>` (3–190,
com o estilo crítico inline na 11 e as fontes externas em 13–15), o `<style>`
principal (16–188), o markup (191–302) e o `<script>` (303–1379).

Esses números envelhecem a cada commit. **Para achar as coisas, use os
marcadores de seção `/* ---------- nome ---------- */`**, que são estáveis.
Mantenha a divisão e ponha código novo na seção certa:

- **classes** — tabela `CLASSES` e `SPELLS`, o coração da Etapa 3
- **progresso salvo** — `KEY`, `KEY1`, `save`, `persist()`, a migração v1→v2
- **personagem e progressão** — `novoChar()`, `ch()`, `KL()`, `stats()`,
  `xpNeed()`, `manaPraMag()`, `golpesPraPer()`, `nSlots()`, `desbloqueadas()`
- **melhorias permanentes** — tabela `UP`, `upCost()`, `sealPct()`
- **dados do jogo** — tabelas `MT` (monstros), `ITEMS`, `LOOT`
- **mapa** — `genMap()`, `carveRooms()`, `corridor()`, `carve()`
- **estado da incursão** — `newRun()`, `spawn()`, `pickType()`
- **física** — `solid()`, `blocked()`, `move()`, `buildFlow()`, `reveal()`
- **efeitos e mensagens** — `log()`, `banner()`, `num()`, `shake()`, `spark()`
- **combate** — conjuração, `hitMon()`, `kill()`, `gainXp()`, `hurtPlayer()`,
  `pickup()`
- **atualização** — `update()`, `updateMons()`, `updateProj()`, `finish()`
- **desenho** — `render()`, `drawPlayer()`, `drawMon()`, `drawMini()`
- **HUD** — `hud()` e o cache de elementos `E`
- **telas** — `showMenu()`, `start()`, `showEnd()`
- **personagens** — escolha de classe, `showPick()`
- **grimório** — habilidades desbloqueadas e os slots de ação
- **mercador** — `drawShop()`, `buy()`, `showShop()`
- **controles** — joystick por ponteiro, `bindHold()`, teclado
- **laço** — `frame()`, `onResize()`

### Números que governam o jogo

Constantes no topo do script: `T=32` (lado do tile), `MW=MH=64` (mapa),
`RUN=360` (duração da incursão em segundos), `PORTAL_AT=90` (quando o portal
abre), `EXT=2.5` (segundos parado no portal para extrair).

Balanceamento vive nas tabelas `CLASSES`, `SPELLS`, `MT`, `LOOT`, `ITEMS` e
`UP`, não espalhado pelo código. Ajuste de dificuldade é edição de tabela. Se
você se pegar escrevendo um número mágico dentro de `updateMons()`, ele
provavelmente devia ser um campo em `MT`.

### As três moedas de progressão

A Etapa 3 trouxe o modelo do Tibia, e ele é a coisa mais importante de entender
antes de mexer em progressão: **classe não é lista de poderes, é taxa de
crescimento.** As mesmas coisas custam preços diferentes para cada classe.

- **Nível** (`ch().lvl`, `xp`) — sobe matando, custo em `xpNeed()`. Define vida,
  mana e quais habilidades e slots estão liberados.
- **Magia** (`mag`, `manaG`) — sobe **gastando mana**, custo exponencial em
  `manaPraMag()` com o `mMult` da classe.
- **Perícia** (`per`, `golpes`) — sobe **acertando golpes**, custo em
  `golpesPraPer()` com o `pMult` da classe.

As duas últimas são o que faz dois personagens de mesmo nível não serem iguais.
O raciocínio completo, com as fórmulas originais do Forgotten Server de onde
isso saiu, está em
[docs/analise-tibia-habilidades.md](docs/analise-tibia-habilidades.md) — leia
antes de tocar em qualquer curva.

### Duas coisas sutis que já custaram tempo

**O campo de fluxo.** A perseguição dos monstros não é um pathfinding por
monstro: `buildFlow()` faz uma BFS a partir do jogador e preenche `G.flow` com a
distância em tiles, recalculada a cada 0,2 s e cortada em 22 passos. Os
monstros só leem esse campo. Por isso aggro é medido em distância de fluxo
(`fd<=9`, chefe `fd<=7`, desiste em `fd>18`) e não em linha reta — um monstro do
outro lado da parede não vem. Mexer nisso muda o jogo inteiro.

**O save é mesclado, e migrado quando preciso.** `localStorage` na chave
`masmorra-runas-v2`, formato
`{cofre,runs,ext,deaths,best,up:{...},classe,chars:{<classe>:{lvl,xp,mag,manaG,per,golpes,slots}}}`.
O que é da conta (cofre, melhorias, estatísticas) fica na raiz; o que é do
personagem fica em `chars`, um por classe.

A leitura faz `Object.assign` sobre os padrões, então **adicionar** campo novo é
seguro e não apaga o progresso de ninguém. Se a `KEY` não existir, o código
procura a `masmorra-runas-v1` e migra: cofre, melhorias e nível antigos viram um
Feiticeiro. **Esse é o padrão a seguir** — subir a versão da `KEY` sem escrever
a migração zera o progresso de todos os jogadores, e isso é decisão do Leonardo,
não sua.

Toda escrita em `save` precisa de `persist()` depois. Todo atributo derivado
(vida máxima, mana máxima, poder) passa por `stats()`, que lê a classe atual via
`ch()` e `KL()` — nunca leia `save.chars` direto.

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

Um comando, e ele é o portão:

```bash
node tools/testar.mjs
```

Refaz a checagem de sintaxe, monta uma **cópia** do `index.html` para cada caso
de teste, roda cada cópia no Edge headless e sai com código diferente de zero
se qualquer coisa falhar. `node tools/testar.mjs --lista` mostra os casos;
`node tools/testar.mjs morte` roda só os que casam com o nome. O `index.html`
nunca é tocado. Os oito casos de hoje são o menu com o Mercador, a incursão de
ponta a ponta até a extração, a morte com o selo, as quatro classes, o grimório
no nível 18, o nível subindo no meio da incursão, o save corrompido e a
migração `v1`→`v2`.

Caso novo entra na tabela `CASOS` no fim do
[tools/testar.mjs](tools/testar.mjs): nome, save semeado, patches de texto no
`index.html`, ajustes no `content.json` (campo `conteudo`, para mexer em
monstro, item ou classe — as tabelas não moram mais no código) e um roteiro
que clica nos botões e chama `ok(nome, condição, o_que_leu)`. Uma asserção
falha imprime o que ela leu, e a cópia e o DOM final ficam na pasta de trabalho
para inspeção.

O que o script faz por você, e que custou tempo descobrir:

- **O `requestAnimationFrame` não dispara no headless.** Sem o atalho o laço
  nunca roda e você lê só os placeholders estáticos do markup (`100/100`,
  `×3`) e acha que passou. O atalho usa um timestamp sintético que anda 50 ms
  por quadro — o `dt` máximo que o jogo aceita — então o tempo de jogo corre no
  passo cheio sem esperar 50 ms de verdade: uma incursão de 20 s roda em
  segundos.
- **O `--dump-dom` não existe mais.** O Edge 155 aceita a opção e não escreve
  nada; ela saiu do headless novo e só vive no `chrome-headless-shell`, que não
  vem instalado. O script sobe um coletor HTTP em `127.0.0.1` e a cópia faz
  `POST` do resultado no fim do roteiro, com o DOM final no mesmo pacote.
- **O `--user-data-dir` é sempre um perfil temporário**, um por caso, para
  nunca tocar no perfil real.
- **O `Math.random` é semeado**, então mapa, corredores, spawns e loot ficam
  iguais em toda execução: um caso que passa hoje passa amanhã.
- **O navegador embutido do Claude não abre `file://`** — é por isso que o
  caminho é o Edge, e não ele.
- **Contar ocorrências de `data-errs` dá falso positivo**, porque casa com o
  próprio código do harness no DOM. O script ancora no nome do atributo dentro
  da tag `<html>`, e o capturador monta o nome em duas partes para o literal
  nem aparecer na página.

O navegador é descoberto nesta ordem: `FIBULA_EDGE`, `CHROME`, o Edge do
Windows, o Chromium do Playwright em `/opt/pw-browsers` (que é o que existe nas
execuções de nuvem) e, por último, o PATH. Em Linux e macOS o `--no-sandbox`
entra sozinho, porque o contêiner da nuvem não sobe o sandbox.

Para conferir que o portão realmente barra código quebrado,
`FIBULA_JOGO=<cópia quebrada> node tools/testar.mjs` roda a suíte contra outro
arquivo. `FIBULA_SAIDA` muda a pasta de trabalho.

**Há um só harness, e é este.** Se você for escrever outro, estenda a tabela
`CASOS` em vez disso — dois portões para o mesmo item significam que um dos dois
não roda e ninguém percebe.

### 3. O que olhar antes de dizer que está pronto

Uma incursão inteira do início ao fim sem erro no console. Morrer de propósito e
conferir a tela final. Extrair e conferir que o cofre subiu. Comprar no
Mercador e conferir que o efeito aparece na incursão seguinte. Recarregar e
conferir que o save sobreviveu.

Os cinco estão cobertos pelo `tools/testar.mjs`, então o que sobra para o olho
é o que ele não vê: o que **aparece na tela**. Se a mudança mexeu em desenho,
layout ou leitura, abra o jogo de verdade (`powershell -ExecutionPolicy Bypass
-File tools/serve.ps1` e `http://localhost:8080/`) num viewport de celular.
Se mexeu em regra, o script basta.

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
  máximo 20. O formato das sete partes está no cabeçalho do próprio arquivo;
  siga-o. A parte que mais importa é **Pendências e riscos**: é o que a próxima
  execução precisa saber e não vai descobrir lendo o código.

Antes de escrever em qualquer um dos dois, faça `git fetch` e leia a versão da
`main`. Já aconteceu de uma sessão manual e o ciclo automático escreverem os
dois arquivos em paralelo e ser preciso mesclar à mão.

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
