# Roadmap do Fibula

Fila única de trabalho dos agentes e das sessões manuais (decisão de
18/10/2026). As decisões do dono ficam na seção 15 do [PRD](docs/PRD.md). `Agora` tem **um** item por vez.
Ao concluir, mova para `Concluído` com a data e o commit, e promova o primeiro
de `Próximo`.

Todo item aqui precisa ter passado pelas quatro perguntas de
[VISAO.md](VISAO.md), e cada um declara o pilar que serve. Item sem pilar não
entra na lista. Cada item também diz **quando está pronto** — sem isso o agente
não tem como saber que terminou.

---

## Agora

### Sair cedo precisa ser uma jogada válida

**Pilar 4.** Hoje o portal abre em 1:30 e nunca mais fecha, então a estratégia
ótima é sempre ficar até o fim: o arco da decisão não existe. Candidatos a
testar: o portal custar uma fatia do saco se usado cedo, ou o valor do loot
crescer com o tempo de permanência, ou o portal ter uma janela que fecha e
reabre. Precisa de teste de jogo, não só de implementação.

Com a morte custando XP (0.6.0), ficar até o fim já ficou mais caro para quem
morre; meça de novo antes de escolher, porque parte do problema pode ter
mudado.

**Pronto quando:** existe uma situação clara em que sair aos 2:00 é melhor que
sair aos 5:30, e o diário registra qual das três opções foi escolhida e por quê.

**Fase:** jogo, em paralelo à F0.

---

## Próximo

Ordem decidida em 18/10/2026, depois do primeiro playtest do Leonardo
("razoável"): primeiro o que faz a **decisão de extrair** existir (morte que
custa, progressão que não dispara, sair cedo valendo a pena), depois o resto
da F0. Itens técnicos da F0 entram em paralelo quando couberem numa execução.

### 1. Tela de créditos no jogo

**Pilar 2.** A licença CC BY 4.0 do OTSP exige atribuição. Hoje ela está em
`assets/CREDITOS.md` e no README; a seção 9 do PRD pede que o jogo mostre esse
conteúdo. Botão discreto no acampamento abrindo uma tela com origem, licença e
autores.

**Fase:** F0 (5, fecho). **Pronto quando:** a tela existe, lista o OTSP com
licença e link para os autores, e há caso no `tools/testar.mjs`.

### 2. PWA instalável

**Pilar 3.** Manifesto e service worker para instalar na tela inicial e abrir
offline, com o último conteúdo baixado. As fontes já são do sistema, então não
há folha externa para embutir. Sem biblioteca.

**Fase:** F0 (6). **Pronto quando:** o Chrome do Android oferece "Instalar",
o jogo abre sem rede depois da primeira visita, e um caso no harness confere
que o manifesto e o service worker carregam.

### 3. Revisar a economia do Selo de resguardo

**Pilar 1.** No nível 3 o Selo guarda 60% do loot do saco na morte, o que pode
reduzir demais o risco da extração tardia — exatamente o que o pilar 1 existe
para proteger. Fica mais urgente depois que a morte passar a custar XP, porque
as duas coisas somadas mudam a conta toda.

**Pronto quando:** custo ou percentual ajustado, com a justificativa escrita no
diário.

**Fase:** jogo, em paralelo à F0.

---

## Depois

### Jogo, aguardando vaga (reordenar quando a F0 fechar)

### Escolha de risco na entrada: três profundidades

**Pilares 2 e 4.** Antes de entrar, o jogador escolhe entre três profundidades,
cada uma com multiplicador de dano dos monstros e de valor do loot. O mundo
deixa de se ajustar ao jogador: a profundidade funda é entrável no nível 1 e é
burrice entrar. É a forma mais barata de criar a sensação de mundo indiferente,
e transforma cada incursão numa decisão antes mesmo de começar.

**Pronto quando:** as três opções aparecem no menu, afetam `spawn()` e a tabela
de loot, e a escolha some do caminho de quem só quer jogar (uma fica como
padrão).

### Monstro novo para variar a sala do Guardião

**Pilar 2.** Hoje só orc e xamã acompanham o chefe, então a sala final é sempre
igual. Um acompanhante raro com loot próprio dá à sala do Guardião a chance de
surpreender.

**Pronto quando:** um monstro novo aparece ocasionalmente nessa sala, com
entrada própria em `MT` e em `LOOT`.

### Revisar a escala de HP dos monstros em níveis altos

**Pilar 4.** Monstros escalam com `save.lvl`, o que pode tornar a incursão lenta
e repetitiva para jogador avançado — e incursão lenta briga direto com o teto de
dez minutos.

**Pronto quando:** a curva foi revisada contra dois ou três níveis de referência
e o resultado está no diário.

### Log legível em tela estreita

**Pilar 3.** O `#log` usa `width:min(66vw,330px)` sobre o canvas; o
empilhamento abaixo de 340px de largura nunca foi verificado.

**Pronto quando:** testado num viewport de 320px e ajustado se preciso.

### Outros

- **Rastro assíncrono de outros jogadores** — placar local, marca de morte no
  mapa onde a última incursão terminou, recorde a ser batido. Sensação de MMO
  sem rede (pilar 2).
- **Som** — efeitos curtos de golpe, de dano e de extração, mais um fundo sóbrio.
  Nada que precise de arquivo externo grande; de preferência síntese via
  WebAudio, sem biblioteca.
- **Mercado com preço móvel** — o valor dos itens oscila entre incursões, dando
  motivo para guardar loot em vez de vender na hora (pilar 5).

---

## Concluído

- **2026-10-19 — Lugares com nome: Esgoto, Ilha da Enseada e Cripta (0.22.0)**
  *(pedido do Leonardo: "crie mais mapas de caça; esgoto, navio que leva para
  ilha, outros; cada um acessado como a masmorra, criando ou entrando em
  salas"; pilar 2)*. Cada mapa em `hunts` do `content.json` com o NPC que leva
  até ele, tabela de spawn, chefe, jeito de cavar (`genMap(m)`) e arte (chão,
  parede, escuridão, tochas). Dois NPCs novos: Vigia do esgoto (`V`) e Capitão
  do porto (`N`); o Guia leva à Masmorra e à Cripta. Treze monstros novos, com
  sprite do OTSP. A sala de caçar junto é de um mapa. O Acampamento Orc do
  item original ficou de fora: os orcs já moram na Masmorra de Runas.

- **2026-10-19 — Habilidades se aprendem com o Mestre de magias (0.21.0)**
  *(decisão do Leonardo; pilares 2 e 5)*. `preco` em cada habilidade do
  `content.json`; o nível libera, o ouro ensina; a de nível 1 é grátis; save
  antigo fica com tudo que o nível liberava. Novo ralo grande do cofre.
- **2026-10-19 — A cidade cinco vezes maior, com lojas de provisões (0.20.0)**
  *(pedido do Leonardo: "amplie o mapa da cidade para cerca de 5 vezes; insira
  NPCs que vendem itens como mercado de alimentos, poções e magias"; pilares 2
  e 5)*. Mapa de 54×38 (era 24×17) com praça, templo, rio e pontes, pomar,
  horta e casas; objetos sólidos no mapa (`OBJETOS`) e chãos novos; mapa da
  cidade no canto. Provisões (`supplies` no `content.json`): Quitandeira,
  Boticária e Mestre de magias vendem o que vai inteiro na próxima caçada —
  ralo novo do cofre e aposta a mais na mesa. O Gordon foi para a forja do mapa
  novo; as peças de teste do chão, para a praça.
- **2026-10-19 — A masmorra da sala sem tempo, com porta (0.19.0)** *(pedido
  do Leonardo; pilar 2)*. A masmorra nasce com a sala e fica aberta até o
  anfitrião fechar (na cidade) ou sair do jogo. Cada membro entra e sai por
  uma porta na sala de entrada quando quiser, e volta; os monstros renascem
  (`progression.respawn`). Casos `sala-anfitriao` e `sala-convidado`
  reescritos, regras da masmorra aberta no Node, quatro sabotagens barradas,
  e duas rodadas com dois navegadores no Realtime de verdade.
- **2026-10-19 — Gordon e a Forja (0.18.0)** *(pedido do Leonardo)*. NPC
  novo na cidade (`city.npcs.gordon`, letra `F`, casa no canto sudoeste):
  compra materiais barato, quatro encomendas em ordem, loja liberada por
  encomenda; quatro peças novas no `content.json` e no atlas. Pilar 5: os
  materiais nascem com dois ralos (encomenda e venda barata) e as peças são
  ralo novo de ouro. Caso `forja` (19 asserções) e a forja na simulação do
  Node.

- **2026-10-19 — Origem na Feira e venda do saco (0.15.0)** *(decisão do
  Leonardo: anunciar só o que se tem no cofre ou no saco, com o banco
  conferindo a origem)*. Saldo de origem no banco (`mercado_lastro`),
  caçadas registradas, venda ao Banco avisada, anistia de quem já tinha conta;
  venda do saco pela Mochila com limites de plausibilidade. Casos `feira`
  (31 asserções) e `feira-saco` (14) no harness; `004_origem.sql`.

- **2026-10-19 — Caçar junto (0.14.0)** *(opção C do plano do multiplayer,
  a pedido do Leonardo; pilar 2)*. No Guia de caça, qualquer um cria uma sala
  e quem está na cidade a vê e entra (até 4); a sala fica aberta até o
  anfitrião fechar ou sair do jogo. O aparelho do anfitrião roda a incursão de
  todos com a simulação da M1 e manda o retrato a 10 por segundo pelo Realtime;
  o convidado anda no próprio aparelho, conta o sqm, e o anfitrião o leva até
  lá pela regra. Cada um grava o próprio save com o resultado. Testado com dois
  navegadores no Realtime de verdade (quatro rodadas) e com dois casos novos
  no harness (`sala-anfitriao`, `sala-convidado`); sete sabotagens barradas.
- **2026-10-19 — Equipamento no corpo (0.12.0)** *(pedido do Leonardo; pilar 2:
  na cidade compartilhada, o que o outro veste conta quanto ele já arriscou)*.
  Os bonecos das classes no OTSP têm uma camada só, sem a máscara de cor dos
  outfits do Tibia, então nada de sprite novo: a armadura retinge a roupa do
  tronco guardando a sombra (`items.<k>.veste` no `content.json`: `cor` e
  `malha`), a arma é o sprite do item na mão e gira no golpe, o amuleto é uma
  pedra no peito. O Banco ganhou o boneco vestido, que gira ao toque; a
  presença da cidade leva o equipamento, conferido em `poeOutro()`. Caso
  `equipamento-no-corpo` no harness.
- **2026-10-19 — A Feira: mercado entre jogadores (0.11.0)** *(pedido do
  Leonardo, antecipado da F3; pilares 2 e 5)*. O Corretor, na praça, abre o
  livro de ofertas das peças de equipamento. Compra e venda com preço por
  peça, match automático no banco (melhor preço, depois ordem de chegada,
  pelo preço de quem já estava no livro), custódia no save da nuvem, caixa
  para quem estava fora, cancelamento e 2% de taxa na venda como ralo.
  Esquema em `tools/supabase/003_mercado.sql`; caso `feira` no harness.

- **2026-10-19 — Andar por sqm (0.9.0)** *(decisão do Leonardo: "faça para
  tudo"; pilares 2 e 3, base do servidor da F2)*. Jogador, monstros e os outros
  jogadores da cidade andam um sqm por vez, em 8 direções, como no Tibia. A
  velocidade cresce com o nível (`progression.walk`: 3,3 sqm/s no nível 1, até
  4,5; passo arredondado para 50 ms); a diagonal dura 1,4× e não corta quina.
  Monstros ocupam o sqm deles (bloqueio de corpo), atacam do sqm vizinho e
  cercam pelo campo de fluxo; o empurrão entre círculos saiu. Na cidade, uma
  mensagem por passo (sqm e duração), e o outro jogador anda o mesmo passo.
  Simulação no Node: velocidade por nível, buff, parada no centro do sqm,
  quina, e um monstro por sqm em 2.400 passos de regra (sabotagem que deixa
  monstros se sobreporem reprova). Dois navegadores no Realtime de verdade:
  o B viu o A no mesmo sqm e pixel.
- **2026-10-19 — Multiplayer M1: a simulação com N jogadores (0.8.2)**
  *(antecipada da F2 pelo Leonardo, D-M1; regras de grupo D-M2; pilar 2)*.
  Solo é um grupo de um: a incursão tem sempre a lista `G.ps`, cada jogador
  com a ficha, a entrada, o saco e a saída dele, e `newRun(semente, fichas)`
  aceita vários. Regras de grupo em `progression.party` do `content.json`:
  ×1,6 de monstros por jogador a mais, ×1,8 na vida do Guardião, **loot
  único** (um drop por monstro, um jogador pega, quem causou mais dano tem 10
  s de vez), XP cheia para quem bateu ou estava perto, extração individual.
  O campo de fluxo parte de todos e cada monstro persegue o mais perto. Nada
  muda para quem joga sozinho: a mesma semente dá a mesma incursão do código
  anterior, conferido nas quatro classes. Ainda **não há como jogar junto**:
  a tela é solo, e a rede é a M2. Testes de 1, 2 e 4 jogadores no Node.
- **2026-10-19 — A cidade compartilhada (0.8.0)** *(primeiro teste do
  multiplayer, a pedido do Leonardo: só na cidade, caçadas sozinhas; pilar 2)*.
  Quem está na cidade vê os outros andando, com nome (o da conta, ou o da
  classe) e a classe de cada um, e o HUD conta quantos são; o registro avisa
  quem chega e quem sai. Sem servidor próprio: presença e broadcast do
  Supabase Realtime pelo `WebSocket` nativo (`src/rede.js`), posição só
  quando mexe e no máximo 8 por segundo; liga ao entrar na cidade, desliga ao
  caçar, ao ir ao menu e com a aba no fundo, religa sozinho se cair. Dado de
  fora conferido em `poeOutro()`. Caso `cidade-compartilhada` no harness, com
  um Realtime falso; testado também com dois navegadores no Realtime de
  verdade (um viu o outro andar até a posição exata e sair para caçar).
- **2026-10-18 — A Cidade (0.7.0)** *(antecipado da F3 a pedido do Leonardo,
  sem rede; pilares 2 e 3)*. Entre incursões o jogador anda por um mapa de
  24×17 com as casas do Mercador (melhorias) e do Banco (cofre, vestir e
  vender) e o Guia de caça no portão sul, que lista os mapas de caça com o
  nível recomendado e o preço da morte. Chegar perto de um NPC mostra o botão
  Falar (ou Enter) e a frase dele no registro; a volta de cada incursão é pelo
  portão. Mapa, NPCs e mapas de caça moram em `city` e `hunts` do
  `content.json`, validados na carga; a regra fica em `src/sim/cidade.js`,
  sem DOM, pronta para o servidor da cidade compartilhada. Sprites novos do
  OTSP (grama, rua, assoalho, água, árvores e três NPCs). Caso `cidade` novo
  no harness e a cidade na simulação no Node.

- **2026-10-18 — Passo fixo na simulação (0.6.1)** *(F0, item 2; etapa M0 do
  [plano do multiplayer](docs/plano-multiplayer.md))*. A regra anda em
  `update(TICK)` com `TICK=0.05` (20 passos por segundo, a taxa de estado da
  F2), chamada por `passo(dt,ent)` com acumulador; os efeitos andam no tempo do
  quadro, e o `render()` interpola jogador, monstros e projéteis entre o passo
  anterior e o atual. A simulação no Node confere a mesma incursão inteira com
  quadros de 50 ms, 1/60 s e irregulares; a sabotagem (regra no tempo do
  quadro) deu 6 contra 8 abates na mesma semente e reprovou. Escolhido 1/20 s
  em vez do 1/30 s que o item sugeria: é o `dt` com que o harness e o jogo já
  rodavam, e a interpolação cobre a tela.
- **2026-10-18 — A morte custa XP, e a curva de nível ficou lenta (0.6.0)**
  *(os itens "Peso de verdade na morte" e "Curva de nível rápida demais",
  juntos a pedido do Leonardo: 25% de um nível barato não pesava nada)*.
  Medido com a simulação no Node: a masmorra inteira vale ~1.680 de XP e uma
  incursão típica ~840, e não cresce com o nível do personagem. Curva antiga
  `40·L^1,6`: nível 8 em ~3,4 incursões. Curva nova `520·L^0,9`, em
  `progression.xp` do `content.json`: nível 8 em ~15, nível 18 em ~75.
  Morrer (ou ficar soterrado) leva 25% do XP do nível atual, nunca o nível
  (`deathLoss`); no pior caso isso custa 2 incursões até o nível 17. O menu
  avisa o preço em XP antes de entrar, a tela final mostra "Experiência
  perdida" em linha própria, e o save guarda o valor reduzido. Casos `morte`
  e `incursao-extracao` e a simulação no Node conferem; sabotagem barrada.

- **2026-10-18 — Versão 0.5.0 no ar, com versão nos endereços**. O menu mostra
  a versão do jogo (antes dizia "Etapa 3"), e todo módulo e o atlas são
  pedidos com `?v=<versão>`: o Pages guarda arquivos por 10 minutos, e sem
  isso um deploy podia se misturar com módulos velhos do cache e deixar a
  tela preta. `tools/versao.mjs` troca a versão em todos os endereços; o
  `tools/testar.mjs` barra import sem a versão do `index.html`. Tabela
  "Versões" no README.
- **2026-10-18 — Sorteio com semente** *(F0 item 2, primeira metade)*. Toda a
  sorte da simulação sai de `src/sim/base.js` (mulberry32), em dois sorteios
  com a mesma semente: o da regra (mapa, spawn, dano, loot, movimento) e o dos
  efeitos visuais, que não se misturam. `newRun(s)` repete a masmorra; sem
  semente, cada incursão sorteia a sua. A tela final mostra o número da
  masmorra, e `?semente=` no endereço a repete. O `tools/testar.mjs` prende a
  sequência do gerador, proíbe `Math.random` e efeito com sorteio da regra em
  `src/sim/`, e confere mesma masmorra para a mesma semente no Node e na tela
  (casos `semente-na-url` e `semente-variada`). Cinco sabotagens, cinco
  barradas.
- **2026-10-18 — Equipamento persistente com três espaços e cofre de peças da
  conta** *(pedido do Leonardo, adiantado do `Depois`; pilares 2 e 5)*. Arma,
  armadura e amuleto, uma tela própria (`Equipamento`, no acampamento) com
  toque, sem arrastar. Na extração, item com `slot` no `content.json` vai para
  o cofre como **peça** (`save.itens`, da conta, serve a todos os personagens);
  o resto vira ouro como antes. Cada personagem veste o seu (`chars.<classe>.equip`),
  e o vestido não cai na morte. Peça no cofre se veste, troca ou vende pelo
  mesmo valor de antes — a economia do ouro não mudou para quem só vende.
  Bônus (`dano`, `red`, `vida`, `mana`) entram em `stats()` e em
  `hurtPlayer()`. Itens novos: couraça de couro (orc) e cota de malha
  (esqueleto e Guardião). Caso `equipamento` novo no `tools/testar.mjs`,
  extração e morte ampliados, e a regra do cofre testada no Node.
- **2026-10-18 — Código dividido em módulos ES, com a regra do jogo separada da
  tela** *(F0 item 1)*. O `<script>` de 1.290 linhas saiu do `index.html` para
  `src/` (cliente) e `src/sim/` (simulação: conteúdo, progressão, mapa,
  incursão, física e combate), sem build e sem biblioteca. `src/sim/` não toca
  em DOM nem em armazenamento: avisa o cliente pelo objeto `saida` e recebe a
  entrada em `update(dt, ent)`. O `tools/testar.mjs` passou a servir as cópias
  por HTTP (módulo ES não abre em `file://`), checa a sintaxe de cada módulo e
  ganhou o passo "simulação no Node": procura DOM em `src/sim/` e roda uma
  incursão inteira sem navegador, duas vezes com a mesma semente. Nada muda
  para o jogador; os 16 casos de navegador passam como antes. Decisão do
  Leonardo (opção A).
- **2026-10-18 — Arte do Tibia: sprites OTSP no lugar das formas e janelas de
  pedra** (pedido do Leonardo; cobre o item `Agora` "pipeline dos sprites" e
  vai além dele, trocando o desenho — F0 item 5 — e cortando o Google Fonts —
  metade do F0 item 6). `tools/sprites.mjs` lê `otsp.dat`/`otsp.spr` do
  pacote no commit fixado e gera `assets/otsp/atlas.png` + `atlas.json`
  (idênticos a cada execução), com `LICENSE.txt`, `AUTHORS.md` e
  `assets/CREDITOS.md`. No jogo: monstros, classes e cadáveres do pacote com 4
  direções e caminhada, chão de terra, paredes de tijolo com o encaixe do
  Tibia desenhadas linha a linha com as criaturas, sacos e itens, efeitos de
  magia por tile e projéteis em 8 direções por elemento, nome e barra de vida
  nas cores do Tibia e minimapa marrom e cinza. Interface com janelas de pedra
  chanfradas, barras do Tibia, botões quadrados com ícone e fontes do sistema.
  Sem o atlas o jogo cai no desenho em código. Dois casos novos (`arte`,
  `sem-arte`); 16/16.

- **2026-10-18 — Save na nuvem com conta (antecipado da F1)**. Login simples
  com usuário e senha, sem e-mail (fase de teste; o link mágico, que veio
  primeiro, não entregava o e-mail), e save sincronizado com o Supabase
  (projeto `bpwljbualdjlwmzcryzl`, funções e tabelas em
  `tools/supabase/002_login_simples.sql`), por `fetch` direto, sem biblioteca. Opcional:
  sem conta ou sem rede o jogo segue só com o `localStorage`. Antecipado da F1
  por decisão do Leonardo, com a F0 ainda aberta. Dívida conhecida: o cliente
  grava o save inteiro, então quem editar o JSON trapaceia no próprio save (só
  se resolve com servidor autoritativo). Quatro casos novos em
  `tools/testar.mjs` (`nuvem-entrar`, `nuvem-adota`, `nuvem-importa`,
  `nuvem-outra-conta`).
- **2026-10-18 — Aviso de falha do save**. O menu mostra uma faixa quando o
  navegador recusa gravar (aba anônima, armazenamento bloqueado), detectada por
  uma sonda na carga e por qualquer `persist()` que falhe. Formato do save
  intacto. Dois casos novos em `tools/testar.mjs` (`save-bloqueado`,
  `save-normal-sem-aviso`); a migração v1→v2 já tinha caso (`migracao-save`).
- **2026-10-18 — CI no GitHub Actions** (`.github/workflows/ci.yml`). Todo push
  e PR roda `node tools/testar.mjs` (sintaxe + os casos headless) no Ubuntu com
  `google-chrome`. Verde na `main`; um branch com erro de sintaxe proposital
  falhou, como devia.
- **2026-10-18 — Ferramenta de teste headless no repositório** (`3f11261`).
  `node tools/testar.mjs` é um comando só e é o portão: refaz a checagem de
  sintaxe, monta uma cópia do `index.html` por caso de teste, roda cada uma no
  Edge headless e sai com código diferente de zero se qualquer asserção falhar
  ou se o `data-errs` aparecer. Oito casos, 194 asserções: menu com Mercador,
  incursão de ponta a ponta até a extração, morte com o selo, as quatro
  classes, grimório no nível 18, nível subindo no meio da incursão, save
  corrompido e migração `v1`→`v2`. Cada caso tem save semeado próprio e
  `Math.random` semeado, então o resultado é determinístico. Rodar contra a
  Etapa 3 achou dois bugs, corrigidos no mesmo commit: o botão da habilidade
  aprendida no meio da incursão não aparecia até a incursão seguinte, e um save
  com classe apontando para personagem ausente deixava a tela em branco.
  Substitui o `test.html` montado à mão que o `CLAUDE.md` descrevia. Duas
  diferenças em relação à especificação deste item: o arquivo é
  `tools/testar.mjs` e não `tools/teste.js` (ESM, para `import` sem
  `package.json`), e o resultado volta por um coletor HTTP em `127.0.0.1` e não
  por `--dump-dom`, porque o Edge 155 aceita a opção e não escreve nada.
- **2026-10-18 — Conteúdo do jogo fora do motor** (`191e80e`). Classes,
  habilidades, melhorias do Mercador, inimigos, itens, loot e progressão em
  [`data/game/content.json`](data/game/content.json), carregado antes do jogo
  iniciar e validado no carregamento (seções, referências cruzadas e pesos das
  bandas). Balancear deixa de exigir edição de código. Duas consequências para
  quem vier depois: o `index.html` **não abre mais direto do disco** (o
  `fetch` é bloqueado em `file://`), então `tools/serve.ps1` virou necessário
  para teste local; e o IIFE ficou assíncrono, porque a migração de save chama
  `slotsIniciais()` e já precisa de `SPELLS` no topo do script.
- **2026-10-18 — Etapa 3: classes, habilidades e evolução** (`1639d2d`).
  Quatro classes (Feiticeiro, Druida, Caçador, Cavaleiro) definidas por taxa de
  crescimento e não por lista de poderes, grimório com slots de habilidade
  liberados por nível, e as três moedas de progressão do Tibia — nível por
  abate, magia por mana gasta, perícia por golpe acertado. Save migrado para
  `v2` com conversão do progresso da Etapa 2 em um Feiticeiro. O raciocínio
  está em [docs/analise-tibia-habilidades.md](docs/analise-tibia-habilidades.md).
  Entrega de uma vez os dois itens que estavam em `Depois`: vocações e
  habilidade que sobe com uso.
- **2026-10-18 — Base de orientação para IA** (`e13649f`). `CLAUDE.md`,
  `VISAO.md`, `AGENTS.md`, e formato para `ROADMAP.md` e `DIARIO.md`.
- **2026-10-18 — Guarda contra loop infinito em `genMap()`** (`f6c53ef`).
  Limite de tentativas e fallback para o melhor mapa encontrado.
- **2026-10-18 — Bússola apontando para o portal** (`fb877b1`, PR #1).
- **2026-10-18 — Correção do tempo exibido na tela final** (`9a7e4db`).
- **2026-10-18 — Etapa 2: cofre e Mercador** (`ca4b5e7`). O ouro extraído passa
  a ir para o cofre, e o cofre tem onde ser gasto: cinco melhorias permanentes
  com preço geométrico.
- **2026-10-18 — Etapa 1: protótipo jogável** (`b451196`). Incursão de 6 minutos
  com mapa gerado, cinco tipos de monstro mais o Guardião do Portal, campo de
  fluxo para perseguição, loot por raridade, portal de extração, morte com
  perda do saco, HUD, minimapa e joystick virtual.
