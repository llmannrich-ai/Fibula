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

## Regra número um: nada de build, nada de biblioteca

O **código** do jogo é o [index.html](index.html) (estilo e markup) mais os
módulos ES nativos de [`src/`](src/), que o navegador carrega como estão, a
partir de um único `<script type="module" src="src/main.js">`. Não há build,
não há bundler, não há `package.json`, não há biblioteca, não há `.css`
separado. O GitHub Pages serve os arquivos crus, e o `.nojekyll` existe para
eles não serem processados. A pasta `docs/` guarda análise de design, e a
`tools/` ferramenta de desenvolvimento (teste, servidor local, extração de
dados, montagem do atlas) — nada em nenhuma das duas vai para o navegador do
jogador. A regra vale para o que é **servido**: o `tools/testar.mjs` roda no
Node e pode ter o tamanho que precisar.

Isso é uma escolha, não uma dívida: o jogo abre rápido no celular e qualquer
agente lê o programa inteiro em poucos arquivos. **Não quebre isso.** Nenhuma
biblioteca, nenhum bundler, nenhum passo de compilação, nenhum `import` de fora
do repositório.

O código foi dividido em módulos em 18/10/2026, por decisão do Leonardo
(opção A da análise daquele dia), para separar a **regra** do jogo da **tela**:
a F2 do [PRD](docs/PRD.md) precisa rodar a mesma simulação num servidor. Por
isso a fronteira abaixo é a regra que mais importa nesta pasta.

### A fronteira: `src/sim/` não conhece o navegador

`src/sim/` é a simulação: conteúdo, progressão, mapa, incursão, física e
combate. **Nada ali toca em `document`, `window`, `localStorage`, canvas,
`setTimeout` ou `requestAnimationFrame`.** O que a simulação precisa contar
para fora sai pelo objeto `saida` de [`src/sim/base.js`](src/sim/base.js) —
`log`, `banner`, `nivel` (espaços ou habilidades mudaram), `fim` (incursão
acabou) e `persist` (hora de gravar) —, que o cliente preenche em
[`src/main.js`](src/main.js). A entrada chega como argumento:
`update(dt, ent)`, com `ent` montado por `leEntrada()` em `src/controles.js`.
Efeitos visuais (`G.fx`, `G.shake`) são dados do estado; quem os desenha, e
quem respeita `prefers-reduced-motion`, é o `render()`.

O `tools/testar.mjs` vigia isso: procura esses nomes nos arquivos de
`src/sim/` e roda uma incursão inteira no Node, sem navegador. Se você precisa
de algo do navegador dentro de `src/sim/`, o lugar certo é um campo novo em
`saida` ou em `ent`, não um `import` do cliente.

### O que mais o jogador baixa

Fora o `index.html` e o `src/`, o jogador baixa **três** coisas, todas do
próprio repositório, servidas pelo mesmo Pages. Estão aqui para não serem
confundidas com precedente:

| O quê | De onde | Se não carregar |
|---|---|---|
| [`data/game/content.json`](data/game/content.json) — classes, habilidades, melhorias, inimigos, itens, loot e progressão | mesma origem, deste repositório | o menu diz o motivo e o jogo não começa |
| [`assets/otsp/atlas.png`](assets/otsp/atlas.png) e [`atlas.json`](assets/otsp/atlas.json) — os sprites do OpenTibia Sprite Pack que o jogo usa, ~250 KB | mesma origem, gerados por [`tools/sprites.mjs`](tools/sprites.mjs) | o jogo segue com o desenho em código de antes (`ART.ok` falso) |

Nenhuma é de terceiro: **o jogo não fala com nenhum outro servidor** além do
Supabase: o banco só quando há conta, e o Realtime (a cidade compartilhada e
as salas de caçar junto, ver abaixo) só enquanto o jogador está na cidade ou
numa sala. A folha do Google Fonts que existia saiu em
18/10/2026 junto com a arte do Tibia — as fontes agora são do sistema (Verdana,
como o cliente do Tibia, e uma serifa Palatino nos títulos).

O `content.json` existe por um motivo que o código não resolve: **ajustar o
jogo sem editar programa.** Mudar o preço de uma melhoria, o dano de uma
habilidade ou a vida de um monstro é mexer em dado, e quem balanceia não
precisa encostar no motor — o carregamento valida o arquivo antes de liberar o
jogo. O atlas é imagem, que não cabe num arquivo de texto, e segue as regras de
arte da seção 9 do [PRD](docs/PRD.md): só OTSP ou outra fonte com licença
aberta, montado por script versionado, nunca à mão, com cada arquivo listado em
[`assets/CREDITOS.md`](assets/CREDITOS.md). Para trocar o sprite de um monstro,
edite a tabela `ARTE` do `tools/sprites.mjs` e rode `node tools/sprites.mjs`
(o `--catalogo` grava folhas com o id de cada sprite do pacote).

**Não adicione dependência de terceiro nenhuma.** Para dado do próprio
repositório, o teste é se ele serve para alguém ajustar o jogo sem programar —
se for só para "organizar o código", não entra.

Duas consequências de o jogo ser módulo ES e buscar o `content.json`, que já
pegaram gente desprevenida:

- **O `index.html` não abre direto do disco.** O navegador bloqueia `fetch` e
  módulo ES em `file://`. Para rodar local, use
  [`tools/serve.ps1`](tools/serve.ps1) (ou qualquer servidor estático que
  entregue `.js` como `text/javascript`) e abra pelo `localhost`.
- O `tools/testar.mjs` monta cada cópia de teste numa pasta (o `index.html`, o
  `src/`, o `content.json` do caso e o atlas) e a serve pelo mesmo servidor em
  `127.0.0.1` que recebe o resultado.

Arquivo novo em `src/` precisa de motivo: um módulo é uma **seção** com
fronteira clara, não um lugar para "organizar". Antes de criar um, veja se o
código cabe numa seção que já existe.

## Mapa do código

Os números envelhecem a cada commit. **Para achar as coisas, use os
marcadores de seção `/* ---------- nome ---------- */`**, que são estáveis.
Ponha código novo na seção certa — e, se for regra de jogo, em `src/sim/`.

**`index.html`** — o `<head>` com o estilo crítico inline, o `<style>`
principal, o markup das telas e do HUD, e a linha que carrega
`src/main.js?v=<versão>` (ver "Versão e deploy").

**`src/sim/` — a simulação, sem DOM**

- `base.js` — `T=32`, `MW`, `MH`, `RUN`, `PORTAL_AT`, `EXT`, `TICK`, `clamp()`,
  `hyp()`, `fmt()`, `DIRS`, o objeto `saida`, o **passo de sqm** (`DIR8`,
  `centro()`, `poeNoSqm()`, `comeca()`, `avanca()`, `dir8()`, `passoPara()`)
  e o **sorteio com semente**:
  `semeia()`, `novaSemente()`, `sementeDe()`, `sorte()`, `rnd()`, `rr()`,
  `ri()` (regra) e `frr()` (efeito)
- `dados.js` — **conteúdo do jogo**, **classes**, **habilidades**, **melhorias
  e dados**: `validaConteudo()`, `carrega()` e as tabelas `CLASSES`,
  `CL_ORDEM`, `SPELLS`, `SLOT_LVL`, `UP`, `MT`, `ITEMS`, `LOOT`, `PROG`,
  `EL_COR`, mais `listaDaClasse()`, `slotsIniciais()`, `fmtItem()` e, do equipamento, `SLOTS_EQ`, `SLOT_NOME`, `fmtBonus()`; da cidade,
  `CITY`, `HUNTS`, `LEGENDA` (o que cada letra de `city.mapa` é) e `ABRE`
  (o que um NPC pode abrir). As tabelas
  são **leituras** do `content.json`, ligadas por `carrega()`: para mudar
  valor, edite o JSON
- `progresso.js` — **personagem e progressão**: o `save` em memória
  (`setSave()` para trocar o objeto inteiro), `SAVE0()`, `normaliza()`,
  `novoChar()`, `ch()`, `KL()`, `stats()`, `xpNeed()`, `manaPraMag()`,
  `golpesPraPer()`, `nSlots()`, `desbloqueadas()`, `upCost()`, `sealPct()`,
  `passoDaVel()` (a fórmula do passo do Tibia) e `durPasso()` (o passo do
  personagem pelo nível)
- `mapa.js` — `genMap()`, `carveRooms()`, `corridor()`, `carve()`, `pecas()`
  (qual peça de parede cada bloco sólido recebe; a cidade usa com a grade dela)
- `cidade.js` — **cidade**: `C`, `entraCidade(dePortao)` (lê `city.mapa` do
  `content.json`), a física da grade da cidade e `updateCidade(dt,ent)`, que
  anda e devolve o NPC ao alcance (`C.perto`). É regra, não tela: na F3 é o
  estado que o servidor da cidade compartilhada roda, e **os outros jogadores**
  (`OUTROS`, `poeOutro()`, `tiraOutro()`), que confere o dado que vem da rede
  e faz o boneco de cada um correr atrás da última posição recebida
- `incursao.js` — **estado da incursão** (`G`, `setG()`, `newRun()`,
  `spawn()`, `pickType()`), **jogadores** (`G.ps`, `fichaLocal()`,
  `novoJogador()`, `sai()`), **física** (`solid()`, `blocked()`, `move()`,
  `buildFlow()`, `reveal()`), **efeitos** (`num()`, `shake()`, `spark()`) e
  **passo fixo** (`passo(dt,ent)`, `efeitos()`, `guarda()`),
  **atualização** (`update(dt,ent)`, `anda()`, `parado(dt)`, `updateMons()`,
  `updateProj()`, `finish()`). **Solo é um grupo de um** (etapa M1 do
  [plano do multiplayer](docs/plano-multiplayer.md)): a incursão tem sempre
  uma lista de jogadores, `G.ps`, cada um com a ficha dele (`p.cl`, `p.c`,
  `p.up`) e o próprio saco, e `newRun(semente, fichas)` aceita várias. A regra
  nunca lê `G.p` nem o `save` para saber quem joga: `G.p` é só o jogador
  deste aparelho, para a tela. No solo a ficha aponta para o personagem do
  save, e o que é da conta (cofre, peças) só muda para a ficha local, em `sai()`
- `combate.js` — conjuração (`lancar()`, `lancarSlot()`, `drinkPot()`), todas
  recebendo o jogador que age,
  `hitMon()`, `kill()`, `gainXp()`, `hurtPlayer()`, `pickup()`

**`src/` — o cliente**

- `main.js` — busca o `data/game/content.json` (primeira coisa que roda,
  porque a migração de save chama `slotsIniciais()`), liga `saida` às telas e
  ao save, e o **laço** (`frame()`, `onResize()`)
- `salvar.js` — **progresso salvo**: `KEY`, `KEY1`, `carregaSave()` com a
  migração v1→v2, `persist()`, `saveFalhou`
- `nuvem.js` — **conta e save na nuvem** (Supabase); registra-se em
  `aoGravar()` para subir cada gravação; exporta `SB_URL`, `SB_KEY` e
  `quemSou()` para a rede, e `mercado(fn,args)`, que sobe o save, chama uma
  função da Feira e adota o cofre e as peças que o banco devolve
- `rede.js` — **a cidade compartilhada**: o canal `realtime:cidade-<x.y>` do
  Supabase Realtime, por `WebSocket` nativo. `quadro(dt,naCidade)`, chamado
  pelo laço, liga ao entrar na cidade e desliga ao sair dela (caçar, menu) ou
  com a aba no fundo, e religa sozinho. Presença (nome, classe, nível) e
  broadcast de **um passo por mensagem** (`{id, x, y, d}`: sqm de destino e
  duração em ms), nada parado; erro do
  canal (expulsão por excesso) fecha o socket e religa. Não decide
  regra nenhuma. Anuncia na presença a sala aberta deste aparelho
  (`rede.sala`) e lista as dos outros em `SALAS`, para o Guia de caça
- `sala.js` — **caçar junto** (ver "Sala" na seção do Realtime): um canal
  `realtime:sala-<x.y>-<id do anfitrião>` por sala. O anfitrião roda a
  incursão de todos (`comecaGrupo()`, `entradas()`) e manda `retrato()` a 10
  por segundo; o convidado manda a entrada (o sqm em que está, espaços
  segurados, poção) e aplica o retrato. `criaSala()`, `entraSala()`,
  `saiDaSala()`, `quadro(dt,ent)` chamado pelo laço, e os `ganchos` que o
  `main.js` liga às telas
- `arte.js` — `ART`, `carregaArte()` (sem `await`: não segura o jogo),
  `icone()` (sprite como fundo de elemento da interface), `dir4()`, `dir8()`,
  `PECA`
- `desenho.js` — canvas, `resize()`, **interpolação** (`render()` desenha
  entre o passo anterior e o atual e chama `cena()`), `spr()` (desenha com o canto inferior
  direito no tile, como o Tibia), `render()`, `drawPlayer()`, `drawMon()`,
  `drawMini()`, `efArea()` (magia de área tile a tile), `sprCriatura()`, o
  **equipamento no corpo** (`mede()`, `vestido()`, `poeArma()`,
  `poeAmuleto()`, `bonecoVestido()`: a armadura retinge o tronco do boneco pela
  `veste` do item no `content.json`, a arma é o sprite do item na mão) e
  `retrato()`, o boneco vestido no Banco. Com a
  arte, o `render()` segue a ordem do cliente do Tibia: chão, depois **linha
  por linha** as paredes da linha e quem está nela — a parede de baixo cobre o
  pé de quem encosta nela. Sem a arte, o caminho antigo (formas em código)
  fica intacto; mexa nos dois ou teste o `sem-arte`. A **cidade** tem o
  `renderCidade()` dela (dia claro, sem escuridão), com `drawNpc()`
- `hud.js` — `log()`, `banner()`, `hud()`, `montaBotoes()`, `montaIcones()`,
  o cache de elementos `E` e o **HUD da cidade** (`hudCidade()`, botão de
  falar e a frase do NPC no registro)
- `telas.js` — **telas** (`showMenu()`, `start()`, `showEnd()`), **cidade**
  (`V.cidade`, `showCidade()`, `abreNpc()`, `showHunts()` do Guia de caça),
  **feira** (`showFeira()`, a tela do mercado entre jogadores, aberta pelo
  Corretor),
  **personagens** (`showPick()`), **grimório**, **equipamento** (`drawEquip()`, aberto pelo Banco), **mercador** (`drawShop()`,
  `buy()`, `showShop()`) e `conteudoFalhou()`. O fluxo é acampamento →
  cidade → Guia de caça → incursão → tela final → cidade; as telas abertas na
  cidade voltam para ela (`volta()`)
- `controles.js` — joystick por ponteiro, `bindHold()`, teclado, `held` e
  `leEntrada()`
- `dom.js` — `$`, `app` e `RM` (`prefers-reduced-motion`)

Os ciclos de `import` entre módulos são permitidos e existem
(`incursao`↔`combate`, `telas`↔`nuvem`), desde que **o topo do módulo não use
nada do outro lado do ciclo** — só funções chamadas depois. Quebrar isso dá
`Cannot access 'X' before initialization` na carga; foi assim que
`salvar.js` passou a não importar `nuvem.js`.

### Números que governam o jogo

Constantes de `src/sim/base.js`: `T=32` (lado do tile), `MW=MH=64` (mapa),
`RUN=360` (duração da incursão em segundos), `PORTAL_AT=90` (quando o portal
abre), `EXT=2.5` (segundos parado no portal para extrair), `TICK=0.05` (o
passo da regra: 20 por segundo). A velocidade de andar mora em
`progression.walk` do `content.json` (unidades do Tibia: 220 + 2 por nível) e
no `spd` de cada monstro.

Balanceamento vive nas tabelas `CLASSES`, `SPELLS`, `MT`, `LOOT`, `ITEMS` e
`UP`, não espalhado pelo código. Ajuste de dificuldade é edição de tabela. Se
você se pegar escrevendo um número mágico dentro de `updateMons()`, ele
provavelmente devia ser um campo em `MT`.

### As três moedas de progressão

A Etapa 3 trouxe o modelo do Tibia, e ele é a coisa mais importante de entender
antes de mexer em progressão: **classe não é lista de poderes, é taxa de
crescimento.** As mesmas coisas custam preços diferentes para cada classe.

- **Nível** (`ch().lvl`, `xp`) — sobe matando, custo em `xpNeed()` (curva e
  perda na morte em `progression.xp` do `content.json`; a morte leva uma fatia
  do `xp` do nível, nunca o nível). Define vida,
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

### Três coisas sutis que já custaram tempo

**A sorte tem semente, e são duas.** Nada no jogo usa `Math.random`, a não ser
`novaSemente()`, que escolhe a semente de uma incursão nova. Toda a sorte sai
de `src/sim/base.js`: `newRun(s)` chama `semeia(s)`, e a partir daí a mesma
semente dá a mesma masmorra — mapa, monstros, dano, loot. É a base do
multiplayer (cliente e servidor precisam sortear igual), de reproduzir um bug
pelo número da masmorra (a tela final mostra; `?semente=12345` no endereço
repete) e de medir balanceamento sem ruído.

São **dois sorteios** com a mesma semente e sequências separadas, e misturar
os dois é o erro fácil de cometer:

- **regra** — `sorte()`, `rnd()`, `rr()`, `ri()`: tudo que muda o resultado
  (mapa, spawn, dano, loot, movimento, recarga);
- **efeito** — `frr()`: tudo que só enfeita (partículas, número de dano,
  tremor, direção e passo inicial do desenho do monstro).

Na dúvida, pergunte: "se isto mudar, o jogador ganha ou perde algo?" Se sim, é
regra. Efeito com o sorteio da regra faz uma tela que desenha mais faíscas
mudar o loot do próximo monstro. O `tools/testar.mjs` barra `Math.random` em
`src/sim/`, efeito (`G.fx.push`) sorteando pela regra, mudança no algoritmo
(a sequência do mulberry32 está presa) e masmorra diferente para a mesma
semente.

**O passo é fixo.** A regra anda em `update(TICK)`, chamada por `passo(dt,ent)`
quantas vezes couber no tempo real acumulado em `G.acc`; por isso a mesma
semente com as mesmas entradas dá a mesma incursão inteira a 20, 60 ou 120
quadros por segundo (o `tools/testar.mjs` confere com quadros de 50 ms, 1/60 s
e irregulares). Três consequências:

- **Nada de regra fora de `update()`.** Só os efeitos (`G.fx`, `G.shake`)
  andam no tempo do quadro, em `efeitos(dt)`.
- **O desenho fica um passo atrás.** `update()` guarda a posição de antes
  (`x0`, `y0`, `w0`, `a0`) em jogador, monstros e projéteis; o `render()` troca
  pelas posições interpoladas na fração `G.alfa`, desenha e devolve as
  verdadeiras. Entidade nova que se mexe precisa entrar em `guarda()` e no
  `render()`, senão anda aos saltos de 50 ms.
- **Testes chamam `passo()`, não `update()`**: é ela que tem o acumulador.


**Anda-se por sqm, como no Tibia.** Decisão do Leonardo em 19/10/2026.
Jogador, monstro e outro jogador da cidade estão sempre num sqm (`tx`, `ty`) e
vão a um vizinho por vez (8 direções); `x`, `y` em pixels vão do ponto de
partida ao centro do sqm novo durante o passo e só servem ao desenho e ao
alcance do combate, que continua em pixels. O sqm é de quem anda **desde o
começo do passo**. Regras:

- **Velocidade do Tibia** (`progression.walk`): jogador `220 + 2·(nível−1)`,
  vezes o buff `velo`; monstro, o `spd` dele na mesma unidade, vezes a
  lentidão. O passo sai da fórmula do Forgotten Server em `passoDaVel()`,
  com o chão `ground` 130 (o do Tibia é 150; ~15% mais rápido, pedido do
  Leonardo): nível 1 = 500 ms, 2 sqm/s; nível 100 = 300 ms; `spd` 150 =
  700 ms; arredondado para cima em múltiplos de 50 ms. Diagonal dura `diagonal` vezes mais e
  não corta quina (`passoPara()` escorrega pelo eixo livre).
- **Bloqueio de corpo.** `G.ocu` marca os sqm com monstro, refeito a cada
  passo da regra: monstro não entra em sqm de monstro nem de jogador, jogador
  não entra em sqm de monstro. Jogadores não se bloqueiam entre si.
- **Corpo a corpo é sqm vizinho** (diagonal inclusive), não distância em pixels.
- **O joystick só escolhe o próximo passo quando o atual acaba**; o tempo que
  sobrou emenda no seguinte (`avanca()` devolve a sobra), senão a velocidade
  cai com o quadro.
- Na rede, **um passo é uma mensagem**: quem recebe anima o mesmo passo com a
  mesma duração. É isso que vai deixar o servidor da F2 barato: conferir
  movimento é ver se o sqm é vizinho, livre e se o tempo do passo passou.

**O campo de fluxo.** A perseguição dos monstros não é um pathfinding por
monstro: `buildFlow()` faz uma BFS a partir do sqm de cada jogador e preenche `G.flow` com a
distância em tiles, recalculada a cada 0,2 s e cortada em 22 passos. Os
monstros só leem esse campo. Por isso aggro é medido em distância de fluxo
(`fd<=9`, chefe `fd<=7`, desiste em `fd>18`) e não em linha reta — um monstro do
outro lado da parede não vem. Mexer nisso muda o jogo inteiro.

**O save é mesclado, e migrado quando preciso.** `localStorage` na chave
`masmorra-runas-v2`, formato
`{cofre,itens:{<item>:qtd},runs,ext,deaths,best,up:{...},classe,chars:{<classe>:{lvl,xp,mag,manaG,per,golpes,slots,equip:{arma,armadura,amuleto}}}}`.
O que é da conta (cofre de ouro, peças guardadas em `itens`, melhorias,
estatísticas) fica na raiz; o que é do personagem (inclusive o equipamento
vestido) fica em `chars`, um por classe. As operações do cofre de peças
(`equipar()`, `desequipar()`, `vender()`, `guardaSaco()`) e o `eqBonus()` moram
em `src/sim/progresso.js`; `normaliza()` completa `itens` e `equip` em save
antigo e descarta peça que saiu do `content.json`.

A leitura faz `Object.assign` sobre os padrões, então **adicionar** campo novo é
seguro e não apaga o progresso de ninguém. Se a `KEY` não existir, o código
procura a `masmorra-runas-v1` e migra: cofre, melhorias e nível antigos viram um
Feiticeiro. **Esse é o padrão a seguir** — subir a versão da `KEY` sem escrever
a migração zera o progresso de todos os jogadores, e isso é decisão do Leonardo,
não sua.

**O save também vai para a nuvem quando há conta** — ver a seção Supabase
logo abaixo. `persist()` grava `save.em` (horário) e agenda o envio;
`save.dono` marca a conta a que o aparelho está ligado; a sessão (token,
id e nome de usuário, nunca a senha) fica em `masmorra-runas-v2-sessao`.

Toda escrita em `save` precisa de `persist()` depois. Todo atributo derivado
(vida máxima, mana máxima, poder) passa por `stats()`, que lê a classe atual via
`ch()` e `KL()` — nunca leia `save.chars` direto.

## Supabase — a base de dados do jogo

O Fibula tem banco no Supabase: projeto `bpwljbualdjlwmzcryzl`,
`https://bpwljbualdjlwmzcryzl.supabase.co`. É a peça "Contas e dados (F1)" do
[PRD](docs/PRD.md). Hoje guarda:

- **Contas** — login simples da fase de teste: **usuário e senha, sem
  e-mail**, por decisão do Leonardo em 2026-10-18 (o link mágico não chegava,
  porque o SMTP padrão do Supabase só entrega para membros da organização).
  Tabelas `public.jogadores` (senha só como hash bcrypt), `public.sessoes` (só
  o sha256 do token) e `public.saves_jogador` (um save por jogador, mesmo JSON
  da `masmorra-runas-v2`). Esquema e funções em
  [tools/supabase/002_login_simples.sql](tools/supabase/002_login_simples.sql).
- **Mercado entre jogadores (a Feira)** — `public.mercado_ordens` (o livro
  de ofertas), `public.mercado_negocios` (histórico de preços) e
  `public.mercado_caixa` (o que alguém recebeu e ainda não entrou no save
  dele). O match é do banco: preço e depois ordem de chegada, o negócio sai
  pelo preço de quem já estava no livro, ninguém casa consigo mesmo, a venda
  paga 2% (ralo). O que se anuncia sai do save **da nuvem** na mesma
  transação (custódia), e cada operação soma 1 em `save.mkt`: o
  `save_gravar` recusa save com `mkt` menor (`'mercado'`) e o cliente relê a
  nuvem. Esquema em
  [tools/supabase/003_mercado.sql](tools/supabase/003_mercado.sql).
- **Origem do que se negocia** — `public.mercado_lastro` é um segundo saldo
  (ouro e peças) que só o banco mexe: extração de caçada registrada
  (`caca_comecar` ao entrar, `caca_fim` ao sair, em `public.cacadas`),
  negócio na Feira, venda ao Banco (`lastro_banco`) e a anistia de quem já
  tinha conta em 19/10/2026. Anunciar exige o save **e** a origem: peça de
  save editado ou de antes da conta não se negocia (`'sem_origem'`). Na
  caçada, a Mochila vende uma peça do saco na Feira (decisão do Leonardo:
  livre, mesmo que depois morra), dentro de limites de plausibilidade (30
  peças por caçada, 60 por dia, extração só depois de 85 s). Esquema em
  [tools/supabase/004_origem.sql](tools/supabase/004_origem.sql). O cliente
  guarda o que não chegou por falta de rede em `masmorra-runas-v2-fila`.
- **`public.saves`** — do login por e-mail (Supabase Auth), hoje **sem uso**.
  Fica para quando o login com e-mail ou Google voltar.
  Esquema em [tools/supabase/001_saves.sql](tools/supabase/001_saves.sql).

O jogo fala com o banco por [`src/nuvem.js`](src/nuvem.js), com
`fetch` puro (sem `supabase-js`) e só a chave **publishable** em `SB_KEY`, que
é pública por natureza. O navegador não toca nas tabelas: chama só as funções
`conta_criar`, `conta_entrar`, `conta_sair`, `save_ler` e `save_gravar`, e as
quatro da Feira (`mercado_livro`, `mercado_anunciar`, `mercado_cancelar`,
`mercado_coletar`) e as três da origem (`caca_comecar`, `caca_fim`,
`lastro_banco`) (`POST /rest/v1/rpc/<nome>`), que rodam como dono e
conferem senha ou token por dentro. As tabelas têm RLS ligada e nenhuma
política, de propósito. Por isso os avisos de segurança do Supabase listam
essas funções como "executáveis
por anon" e as tabelas como "RLS sem política": é o desenho, não um furo. Se
um aviso **novo** aparecer, aí sim investigue.

Limites aceitos para a fase de teste, que precisam cair antes de abrir para
desconhecidos: sem limite de tentativas de senha, sem recuperação de senha, e
o cliente grava o save inteiro (quem editar o JSON trapaceia no próprio save).

**Os agentes têm acesso livre às chaves, sem pedir ao Leonardo.** Todas estão
no arquivo `api key supabase.txt`, na raiz do checkout principal
(`C:\Users\Leonardo Mannrich\Fibula\`), fora do git (`.gitignore` e
`.git/info/exclude`). Use à vontade nas sessões locais:

| Chave | Para quê | Pode ir para o navegador? |
|---|---|---|
| publishable (`sb_publishable_…`) e anon (JWT) | cliente do jogo, leituras de teste | sim — já está em `src/nuvem.js` |
| secret (`sb_secret_…`) e service_role (JWT) | administração: ignora a RLS, Auth Admin, ler e corrigir dados | **nunca** |
| senha do banco (Postgres) | migrações e SQL direto (`supabase db push --db-url …`) | **nunca** |

Para conectar no Postgres use o pooler, não o host direto (`db.<ref>.supabase.co`
só responde por IPv6 e falha nesta máquina):
`postgresql://postgres.bpwljbualdjlwmzcryzl:<senha>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`.
A `001_saves.sql` foi aplicada assim em 2026-10-18.

O que "acesso livre" **não** quer dizer:

- Não é banco aberto ao público. Nunca desligue a RLS nem crie política para
  `anon` ou `using (true)` em tabela de jogador.
- Segredo (secret, service_role, senha) nunca entra em arquivo servido, commit,
  `DIARIO.md`, issue, PR ou log. O repositório e o site são públicos; um
  vazamento obriga o Leonardo a girar a chave no painel.
- Mudança de schema entra como arquivo novo e idempotente em
  `tools/supabase/NNN_nome.sql`, aplicado no banco e comitado junto do código
  que depende dele. Não altere tabela à mão sem deixar o arquivo.
- Dados de jogadores reais: leia para depurar, mas não apague nem reescreva o
  save de ninguém sem pedido do Leonardo.

Limites conhecidos de acesso:

- **Execuções de nuvem não têm o arquivo de chaves, mas têm o conector.** O
  conector MCP do Supabase (ferramentas `mcp__Supabase__*`) foi religado em
  2026-10-18 à organização "Versa" (Free), a que contém o projeto Fibula, e
  enxerga `bpwljbualdjlwmzcryzl`: listar tabelas, aplicar migração, rodar SQL,
  ler logs e avisos de segurança. A outra organização da conta (a de TI da
  Versa Engenharia, Pro) não é do jogo — nada do Fibula entra lá. Sem o
  conector e sem as variáveis do item C5 do PRD, o agente não mexe no banco e
  registra a pendência no `DIARIO.md`.
- **Configuração do Auth** (Site URL, URLs de redirecionamento, Google e outros
  provedores, SMTP) não sai das chaves acima nem do conector: exige o painel ou
  um token pessoal (`sbp_…`, em supabase.com/dashboard/account/tokens) via CLI
  `supabase` ou Management API. Se o token entrar no arquivo de chaves, use-o.
- **O e-mail padrão do Supabase só entrega para membros da organização.** Foi
  por isso que o login saiu do e-mail; antes de voltar a ele, configure SMTP
  próprio.
- **O `execute_sql` do conector expira em comandos que apagam dados** (o
  `select` funciona). O `apply_migration` também: qualquer migração com
  `delete`, mesmo dentro do corpo de uma função, expira em 60 s e é
  desfeita inteira (19/10/2026, na 003). Escreva a função sem `delete` ou
  aplique pelo `psql`. Apagar dado de jogador fica com o Leonardo no painel.
- Os testes (`tools/testar.mjs`) nunca falam com o Supabase de verdade: o
  prelúdio bloqueia `supabase.co` e o caso que precisa de nuvem usa `P.nuvem`,
  um Supabase falso em memória que imita as cinco funções do login simples.
  O `WebSocket` também é falso em todo caso: `window.__rt` imita o canal do
  Realtime, e o roteiro faz os outros jogadores com `__rt.entra()`,
  `__rt.pos()` e `__rt.sai()` (caso `cidade-compartilhada`).

### Realtime — a cidade compartilhada

Primeiro teste do multiplayer, decisão do Leonardo em 19/10/2026: **só na
cidade**; as caçadas continuam sozinhas. Usa o Realtime do mesmo projeto, com
a chave publicável, sem tabela nem servidor próprio, e por isso não custa nada
no plano Free. Limites, medidos em 19/10/2026 com clientes de carga no canal
de verdade: **~100 envios por segundo por canal** (11 pessoas a 8/s passam; 13
perdem mensagens e são expulsas com "Too many messages per second"; a 5/s,
cerca de 15 andando ao mesmo tempo com folga), 200 conexões simultâneas e 2
milhões de mensagens por mês, **contando cada entrega** (uma posição para 19
pessoas são 20 mensagens). A conta mensal cresce com o quadrado de quem está
junto, e é por isso que mais de 20 pessoas juntas pedem o servidor da F2. Cada aparelho conta a própria posição e
desenha a dos outros: quem tem a chave pode mandar posição falsa, e tudo bem,
porque na cidade não se ganha nem se perde nada. O que chega de fora passa por
`poeOutro()` em `src/sim/cidade.js`, que prende a posição ao mapa, só aceita
classe que existe e corta o nome. **Nada que valha ouro, XP ou item pode
passar pelo canal da cidade**: isso é o servidor autoritativo da F2
([docs/plano-multiplayer.md](docs/plano-multiplayer.md)).

### Sala — caçar junto, com o anfitrião calculando

Decisão do Leonardo em 19/10/2026 (opção C do plano do multiplayer): testar o
co-op na masmorra **sem servidor próprio**. No Guia de caça, qualquer um cria
uma sala; quem está na cidade a vê e entra (até 4). A sala fica aberta até o
anfitrião fechar ou sair do jogo, e serve para várias caçadas seguidas.

- **O anfitrião é o servidor.** O aparelho dele roda a mesma `src/sim/` com
  uma ficha por jogador (`newRun(semente, fichas)`), recebe a entrada dos
  convidados e manda o `retrato()` (`src/sim/incursao.js`, seção "retrato da
  sala") a 10 por segundo. O mapa não vai: o convidado gera o mesmo pela
  semente.
- **O convidado anda no próprio aparelho** (sem atraso no próprio boneco) e
  conta o sqm em que está; o anfitrião leva o boneco dele até lá **pela
  regra**, um sqm por passo, na velocidade do nível e só por sqm livre. Se os
  dois divergem por muito tempo (um monstro no caminho), o convidado volta ao
  sqm do anfitrião (`p.desv` em `aplicaRetrato()`).
- **Cada um grava o próprio save** com o resultado que o anfitrião manda
  (`fim`), passando por conferência (item que existe, número inteiro,
  habilidade da classe). A ficha que o convidado manda passa por
  `confereFicha()` em `src/sim/progresso.js`.
- **Só o anfitrião pode trapacear**, porque é ele quem calcula. É aceitável
  entre amigos e é a exceção à regra acima, de propósito; para abrir a
  desconhecidos, o caminho é o servidor da F2 (M2).
- Custo: com 4 na sala, ~40 envios por segundo no canal, abaixo dos ~100 do
  plano Free; a cota mensal (2 milhões, contando cada entrega) dá algumas
  dezenas de horas de caçada a dois por mês.
- **O anfitrião não pode deixar o jogo em segundo plano**: o navegador para o
  laço, a incursão congela para todos, e depois de 12 s sem notícia os
  convidados voltam à cidade sem resultado.

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
for f in $(find src -name '*.js'); do cp "$f" /tmp/m.mjs && node --check /tmp/m.mjs || echo "FALHOU $f"; done; echo SINTAXE_OK
```

Qualquer `FALHOU` na saída e **não comite**. Um erro de sintaxe em qualquer
módulo derruba o jogo inteiro: o navegador não executa nada de um grafo de
módulos com um arquivo quebrado. (A cópia para `.mjs` é para o `node` ler o
arquivo como módulo sem `package.json`.) O `tools/testar.mjs` refaz essa
checagem sozinho.

### 2. Execução headless

Um comando, e ele é o portão:

```bash
node tools/testar.mjs
```

Refaz a checagem de sintaxe, roda a **simulação no Node** (procura DOM em
`src/sim/`, joga uma incursão inteira sem navegador e confere que a mesma
semente dá o mesmo resultado), monta uma **cópia** do jogo para cada caso de
teste, roda cada cópia no Edge headless e sai com código diferente de zero se
qualquer coisa falhar. `node tools/testar.mjs --lista` mostra os casos;
`node tools/testar.mjs morte` roda só os que casam com o nome (a simulação no
Node roda sempre). O jogo de verdade nunca é tocado. Os casos cobrem o menu com o Mercador, a incursão de
ponta a ponta até a extração, a incursão desenhada com os sprites (`arte`) e
sem eles (`sem-arte`, campo `semArte` do caso), a morte com o selo, as quatro
classes, o grimório no nível 18, o nível subindo no meio da incursão, o save
corrompido e bloqueado, a migração `v1`→`v2`, a conta na nuvem, o
equipamento (cofre de peças da conta, espaços de cada personagem) e a
cidade (andar até o Mercador, falar, o Guia levando à masmorra e a volta pelo
portão). Para chegar à masmorra, o roteiro chama `cacar()`, que entra na
cidade e fala com o Guia sem andar; o roteiro também enxerga os módulos como
`Tl` (`src/telas.js`) e `Cd` (`src/sim/cidade.js`).

Caso novo entra na tabela `CASOS` no fim do
[tools/testar.mjs](tools/testar.mjs): nome, save semeado, patches de texto
(procurados em todas as fontes, `index.html` e `src/`; o patch estoura se não
casar em nenhuma), ajustes no `content.json` (campo `conteudo`, para mexer em
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
  vem instalado. O script sobe um servidor HTTP em `127.0.0.1`, que entrega as
  cópias e recebe o `POST` do resultado no fim do roteiro, com o DOM final no
  mesmo pacote.
- **O roteiro é um módulo que importa `./src/main.js`.** Módulo com `await` no
  topo não segura o próximo `<script>`; importar o do jogo é o que garante que
  o roteiro só começa depois do conteúdo carregado e da primeira tela aberta.
- **O `--user-data-dir` é sempre um perfil temporário**, um por caso, para
  nunca tocar no perfil real.
- **O `Math.random` é semeado**, e ele escolhe a semente de cada incursão, então
  mapa, corredores, spawns e loot ficam iguais em toda execução: um caso que
  passa hoje passa amanhã. Caso com `query` abre a cópia com parâmetros no
  endereço (o `?semente=` usa isso).
- **Contar ocorrências de `data-errs` dá falso positivo**, porque casa com o
  próprio código do harness no DOM. O script ancora no nome do atributo dentro
  da tag `<html>`, e o capturador monta o nome em duas partes para o literal
  nem aparecer na página.

O navegador é descoberto nesta ordem: `FIBULA_EDGE`, `CHROME`, o Edge do
Windows, o Chromium do Playwright em `/opt/pw-browsers` (que é o que existe nas
execuções de nuvem) e, por último, o PATH. Em Linux e macOS o `--no-sandbox`
entra sozinho, porque o contêiner da nuvem não sobe o sandbox.

Para conferir que o portão realmente barra código quebrado,
`FIBULA_JOGO=<cópia quebrada>/index.html node tools/testar.mjs` roda a suíte
contra outra cópia do jogo (com o `src/` ao lado). `FIBULA_SAIDA` muda a pasta de trabalho.

**Há um só harness, e é este.** Se você for escrever outro, estenda a tabela
`CASOS` em vez disso — dois portões para o mesmo item significam que um dos dois
não roda e ninguém percebe. Pelo mesmo motivo não há `package.json`,
TypeScript, `node --test` nem Playwright como biblioteca (decisão de
18/10/2026, seção 15 do PRD): o script usa só o Node e o Chromium que já
existem, e a simulação no Node cobre o que um teste de unidade cobriria.
Reavaliar quando existir o servidor da F2.

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

## Versão e deploy

**Deploy é o push na `main`**: o GitHub Pages publica sozinho em um ou dois
minutos. Não há outro passo. Para conferir, a CI fica verde e o menu do jogo
no ar mostra a versão nova.

**A versão mora num lugar só**: o `?v=` da linha
`<script type="module" src="src/main.js?v=0.5.0">` do `index.html`. Todo
import relativo de `src/` repete essa versão, e o menu lê a sua de
`import.meta.url`. O motivo é o cache: o Pages manda o navegador guardar cada
arquivo por 10 minutos, e quem recarrega logo depois de um deploy receberia o
`index.html` novo com módulos velhos — um import que não existe mais deixa a
tela preta. Com a versão no endereço, versão nova é endereço novo. O
`atlas.png` leva a mesma versão.

- **Toda mudança em `src/` ou no `index.html` sobe a versão** antes do commit:
  `node tools/versao.mjs 0.5.1`. Sem isso o cache de 10 minutos volta a poder
  misturar arquivos. `node tools/versao.mjs` sozinho mostra a atual.
- Esquema `0.<etapa>.<correção>`: o segundo número sobe quando muda o que o
  jogador vê; o terceiro, para correção. Versão que muda o que o jogador vê
  ganha uma linha na tabela "Versões" do `README.md`.
- **Nunca escreva um import sem `?v=`** nem com versão diferente: o mesmo
  arquivo com dois endereços vira dois módulos, com dois estados (dois `save`,
  dois `G`). O `tools/testar.mjs` barra os dois casos e diz o comando.
- `content.json` e `atlas.json` são buscados com `cache:'no-cache'` e não
  precisam de versão.

## Git e o ciclo automático

Quatro agentes agendados desenvolvem o jogo — Produto, Desenvolvedor, Revisor e
Balanceamento —, cada um com as instruções em
[`docs/agentes/`](docs/agentes/README.md), e sessões manuais do Leonardo
trabalham em paralelo na mesma `main`. Quem decide se o ciclo roda e como o
código entra é o arquivo [`docs/agentes/modo.txt`](docs/agentes/modo.txt):
`pausado`, `direto` ou `pr` (o que cada um quer dizer está na seção 2 do
[`comum.md`](docs/agentes/comum.md)). Decisão do Leonardo em 18/10/2026:
**quando o ciclo estiver ligado, o modo é `direto`** — código vai direto na
`main`, e a rede de segurança é o histórico do git (`git revert`), não
revisão prévia. Por isso os portões locais acima não são recomendação, são
obrigação.

A CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda o
`tools/testar.mjs` em todo push. No modo `direto` ela não impede o push: é o
**alarme**. CI vermelha na `main` é a primeira coisa a resolver em qualquer
execução, antes de qualquer item do roadmap — ela já pegou, em máquina mais
lenta, um erro que o teste local não pegou.

Quando dois documentos discordarem, vale a ordem do [PRD](docs/PRD.md):
PRD (o quê e em que fase) > [VISAO.md](VISAO.md) (por quê) > este arquivo
(como) > `ROADMAP.md` e `DIARIO.md`. As decisões do dono ficam numa tabela só,
na seção 15 do PRD.

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
