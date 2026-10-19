# Roadmap do Fibula

Fila única de trabalho dos agentes e das sessões manuais. As regras da fila
(pilar, "Pronto quando:", um item em `Agora`) estão no [CLAUDE.md](CLAUDE.md),
Parte 4; as decisões do dono, na Parte 6. Ao concluir, mova o item para
`Concluído` com a data e o commit, e promova o primeiro de `Próximo`.

---

## Agora

### Queda de conexão não mata

**Pilar 4.** Pré-requisito da morte da opção B. Hoje o convidado que fica 12 s
sem notícia volta à cidade sem resultado. Regra: jogador sem entrada por
queda de rede ou aba no fundo fica parado e invulnerável por 20 s; depois sai
com a mochila se não estava em combate (dano recebido ou causado nos últimos
5 s). Vale para o convidado (no aparelho do anfitrião) e para quem caça
sozinho.

**Pronto quando:** caso no harness em que o convidado some no meio da caçada
e volta à cidade com a mochila, e outro em que some em combate e fica protegido
os 20 s.

---

## Próximo

Ordem decidida em 19/10/2026 com os pilares novos: primeiro o que faz o mundo
ser fixo e a morte ser justa, depois o que a endurece, depois o resto da F0.

### 1. Saída segura perto

**Pilar 5.** Depende da pendência P8 (padrão:
60 s). Medir, em cada lugar fixo, o tempo de caminhada no nível recomendado do
sqm mais longe até a porta; onde passar do limite, pôr uma segunda saída (escada
ou porta) numa sala funda.

**Pronto quando:** o tempo máximo até uma saída, por lugar, está no diário e
nenhum passa do limite; caso no harness confere que a segunda saída extrai.

### 2. Medir o ritmo até o nível 20 em horas

**Pilar 3.** Alvo do Leonardo: nível 20 em ~3 h de caçada efetiva. Script em
`tools/balanceamento/` que simula caçadas no lugar recomendado para cada nível
e mede as horas até cada nível com a curva atual (`520 · L^0,9`). Propor a
curva nova no diário e numa issue `feedback`; acelerar a progressão é
sensível.

**Pronto quando:** a tabela "nível × horas" atual e a proposta estão no diário,
e a issue existe.

### 3. Morte da opção B

**Pilar 4.** Depende de "Queda de conexão não mata" (`Agora`), do item 2 e da pendência P9 (**sensível**: os
números são do Leonardo). Morrer leva a mochila e uma fatia do XP que pode
derrubar o nível; cada peça vestida tem uma chance de cair; um seguro comprado
com ouro reduz as perdas e substitui o Selo de resguardo. A tela antes de
entrar diz o que está em jogo; a tela final, o que caiu. Muda o save
(equipamento perdido, nível que desce): migração testada. A seção "A morte" da tela de Regras muda junto.

**Pronto quando:** o caso `morte` do harness cobre a queda de nível, a peça
perdida e o seguro, e a tela de entrada mostra a perda possível.

### 4. Orçamento de download vigiado

**Pilar 5** (e o não-objetivo "o jogo abre em dois segundos num 3G ruim").
Pedido do Leonardo em 19/10/2026: o jogo está só começando, e cada mapa,
monstro e item novo faz o download crescer. Hoje o jogador baixa ~1 MB de
cara (atlas de 784 KB, `content.json` de ~100 KB e o código); o requisito da
Parte 2 é **menos de 2 MB e menos de 3 s em 4G**. Em vez de descobrir tarde,
o harness passa a medir:

- o total do que o jogador baixa antes de jogar (`index.html`, `src/`,
  `content.json`, `atlas.png`, `atlas.json`), com dois limites num lugar só
  do `tools/testar.mjs`: **aviso** acima de 1,2 MB e **falha** acima de 1,8 MB;
- o tamanho de cada parte, impresso em toda execução, para o diário registrar
  a tendência;
- o tempo até a primeira tela num 4G simulado no Chromium headless
  (limitação de rede do próprio navegador), com falha acima de 3 s.

Quando o aviso aparecer, a execução seguinte trata o contorno, nesta ordem
(cada um é um item próprio na fila):
1. **um atlas por lugar** (regra 3 de "Arte e licenças"): a cidade e a
   interface no atlas de entrada; cada lugar de caça baixa o dele só ao
   entrar, com a tela de carregamento curta;
2. **`content.json` dividido** da mesma forma: o mapa de cada lugar num
   arquivo próprio, buscado ao entrar;
3. **o PWA** (item seguinte) guardando no aparelho o que já foi baixado, para
   a segunda abertura não baixar nada.

**Pronto quando:** `node tools/testar.mjs` imprime o tamanho de cada parte e o
total, avisa acima de 1,2 MB, falha acima de 1,8 MB ou de 3 s em 4G
simulado (caso de sabotagem no diário prova que o portão barra), e a Parte 4
do `CLAUDE.md` descreve o orçamento.

### 5. PWA instalável

**Pilar 5.** Manifesto e service worker para instalar na tela inicial e abrir
sem rede com o último conteúdo baixado. Sem biblioteca.

**Fase:** F0. **Pronto quando:** o Chrome do Android oferece "Instalar", o jogo
abre sem rede depois da primeira visita, e um caso no harness confere que o
manifesto e o service worker carregam.

### 6. Escada de lugares de caça

**Pilar 1.** Com o mundo igual para todos, cada faixa de nível precisa de um
lugar à altura; hoje os lugares param no nível 15 (Cripta). Um lugar novo por
item, com nome, nível recomendado, monstros, chefe, mapa fixo e quem leva até
ele, todos no `content.json`.

**Pronto quando:** o lugar novo está no Guia (ou noutro NPC), com nível
recomendado acima de 15, e o caso da cidade entra nele.

### 7. Pincéis do Fibula no editor

**Pilar 2.** O OTSP traz para o Remere's Map Editor só um pincel (grama com
borda); o resto se pinta item por item. `node tools/otbm.mjs rme` passa a
gravar pincéis prontos com os ids do pacote: os quatro chãos com as
variantes (`grounds.xml`), as quatro paredes com peça vertical, horizontal,
poste e canto (`walls.xml`), as bordas de areia, terra e lama do OTSP
(215–504, `borders.xml`) e enfeites (teias, ossadas, pedras: `doodads.xml`).
Com isso a borda de chão do Tibia sai do auto-border do editor e chega ao
jogo como item da pilha, sem código novo no jogo
([docs/plano-mapas.md](docs/plano-mapas.md), Fase 4).

**Pronto quando:** a pasta do editor tem os quatro arquivos com os pincéis, o
harness confere que todo id citado existe no `items.otb`, e o
[docs/rme.md](docs/rme.md) diz como usar.

### 8. Redesenhar os lugares no editor

**Pilar 2.** Os quatro mapas de hoje são rascunhos do gerador antigo. Cada
um é redesenhado no Remere's Map Editor com intenção do Tibia: o Esgoto com
canal de água e pontes, a Ilha como clareira irregular com margem de areia e
água, a Cripta com nichos de sarcófago, a Masmorra de Runas com salões de
pilares; marcos que se reconhecem e uma segunda saída onde a P8 pedir. Um
lugar por vez, começando pelo Esgoto, depois do item 4 (cada item novo pesa no download). **Precisa do Leonardo** na primeira
configuração do editor ([docs/rme.md](docs/rme.md)); depois disso, um agente
pode desenhar pelo `.otbm` também.

**Pronto quando:** o lugar redesenhado passa no harness, a captura em
360×640 está no diário, e o Leonardo aprovou o desenho.

---

## Depois

- **Monstro novo para variar a sala do Guardião** (pilar 2) — um acompanhante
  raro com loot próprio; entrada em `MT` e em `LOOT`.
- **Log legível em tela estreita** (pilar 5) — o `#log` usa
  `width:min(66vw,330px)`; abaixo de 340 px de largura nunca foi verificado.
- **Rastro dos outros** (pilar 2) — placar, marca de morte no lugar, recorde a
  ser batido.
- **Som** (pilar 5: jogável sem som, melhor com) — efeitos curtos por WebAudio,
  sem arquivo grande nem biblioteca.
- **Telemetria mínima** (F1) — os eventos da Parte 2; dado pessoal é sensível.

---

## Concluído

- **2026-10-19 — Escolha de personagem sem rolagem (0.43.0)** *(pedido do
  Leonardo; pilar 5)*. Saiu a rolagem própria da lista; a tela cabe em
  360×640 com os quatro personagens e a linha da conta.

- **2026-10-19 — Sem tela intermediária depois do login (0.42.0)** *(pedido
  do Leonardo: "a tela intermediária de continuar não faz sentido"; pilar 5)*.
  Com conta aberta, a tela de entrada não aparece: o jogo abre na escolha de
  personagem, e entrar ou criar conta leva a ela quando a nuvem responde (ou
  falha). "Sair da conta" virou o botão do rodapé da escolha.

- **2026-10-19 — Mapas de caça fixos e o Remere's Map Editor (0.41.0)**
  *(decisão do Leonardo: "o mapa será fixo e igual sempre, não tem
  aleatoriedade no mapa"; pilar 2)*. Cada lugar tem o mapa em
  `hunts.<lugar>.mapa`: os itens do OTSP de cada sqm, a entrada e um monstro
  por ponto de spawn, que nasce e renasce ali. `tools/mapas.mjs` gerou os
  quatro rascunhos; `tools/otbm.mjs` exporta e importa `.otbm` do Remere's
  Map Editor (ida e volta exata, conferida no harness) e monta a pasta do
  editor com os monstros do Fibula; `docs/rme.md` é o passo a passo. O atlas
  traz os itens dos mapas com os padrões de chão do Tibia (784 KB).

- **2026-10-19 — Tela de entrada só com a conta (0.40.0)** *(pedido do
  Leonardo; pilar 5)*. A primeira tela tem usuário, senha, Entrar, Criar conta
  e "Jogar sem conta" (ou "Continuar", com sessão). A escolha de personagem é
  a tela seguinte: tocar num personagem entra na cidade, cada um mostra o
  preço da morte, e o rodapé tem Regras e Voltar. O Menu da cidade abre essa
  escolha.

- **2026-10-19 — Mapas vestidos (0.37.0)** *(pedido do Leonardo; pilar 2)*.
  Objetos sólidos por lugar (`mapa.objetos`: pilar, barril, caixote, rocha,
  sarcófago, gárgula, palmeira, cacto), que bloqueiam jogador, monstro e
  projétil e nunca fecham caminho; detalhes do chão (`arte.detalhes`: teias,
  ossadas, sangue, grade, lodo, tufos, velas); variantes de chão; a Ilha
  fechada por mata em vez de muro (`arte.borda`). 54 sprites novos do OTSP.
  Plano das fases seguintes e pesquisa de fontes legais de mapa em
  [docs/plano-mapas.md](docs/plano-mapas.md).

- **2026-10-19 — Grimório só na cidade, troca de personagem só na tela inicial (0.35.0)**
  *(pedido do Leonardo; pilar 5)*. O rodapé da tela inicial ficou Regras ·
  Personagens; o botão Personagens saiu da cidade. Os casos `equipamento`,
  `classes` e `grimorio` seguem o caminho novo.

- **2026-10-19 — Tela inicial curta, com Regras e créditos (0.31.0)**
  *(pedido do Leonardo: minimalista, botão de regras, login fácil; pilares 4
  e 5; fecha o item "Tela de créditos" da F0)*. A tela inicial tem o
  personagem, o preço da morte em uma linha, Jogar, a conta (os mesmos campos
  e botões) e o rodapé Regras · Personagens · Grimório, sem rolar em 360×640.
  A tela de Regras tem seções que abrem e fecham, os números lidos do
  `content.json`, a versão e os créditos do OTSP. Os números da conta foram
  para Personagens. Sem personagem, a tela inicial pede Criar personagem e
  mostra o login antes.

- **2026-10-19 — Voz na sala (0.30.0)** *(pedido do Leonardo)*. `src/voz.js`:
  WebRTC nativo em malha entre quem está na sala, apresentação pelo canal da
  sala, segurar para falar (botão Voz ou V), quem fala no botão, STUN do
  Cloudflare e do Google, sem TURN. Caso `voz-na-sala` no harness, com
  conexão de verdade no Chromium headless.

- **2026-10-19 — Um guia só e o mundo igual para todos (0.28.0)**
  *(decisão do Leonardo: "a realidade como ela é"; pilar 1)*. O `VISAO.md`, o
  `docs/PRD.md` e `docs/agentes/` viraram as Partes 1, 2, 5 e 6 do
  `CLAUDE.md`, com o princípio-mãe e os seis pilares novos. Os monstros
  deixaram de escalar com o nível (`hpPerCharLevel`, `bossLevelFactor`) e com
  o grupo (`party.monsters`, `party.bossHp`, respawn); o carregamento recusa
  esses campos e a simulação no Node confere o mesmo mundo para 1 ou 4
  jogadores, de nível 1 ou 30. Saíram da fila "Sair cedo" (não há mais
  relógio), "Revisar a escala de HP" e "Selo de resguardo" (vira o seguro da
  morte B).

- **2026-10-19 — Mochila e cofre, como no Tibia (0.27.0)** *(pedido do
  Leonardo: "apenas com a mochila e o cofre"; pilar 1)*. O saco saiu. A
  mochila é do personagem e fica com ele entre as caçadas: entra inteira na
  próxima e cai toda na morte (menos o Selo). Extrair não guarda nada
  sozinho; o Banqueiro guarda uma coisa ou tudo no cofre e devolve peças e
  ouro à mochila. 20 espaços (`progression.mochila`); cheia, o loot fica no
  chão. O Guia de caça e a Mochila dizem quanto ela arrisca. Vestir e tirar pela
  Mochila (0.26.0) passou a trocar com a mochila também na cidade.
- **2026-10-19 — Vestir e tirar pela Mochila, também na caçada (0.26.0)**
  *(pedido e decisão do Leonardo: "como o personagem vai equipar?"; vestir na
  caçada como no Tibia; pilares 1 e 3)*. Toque na peça, botão grande. Na
  cidade troca com o cofre; na caçada com o saco (`vesteDoSaco()`,
  `tiraProSaco()` em `src/sim/combate.js`): a vestida não cai na morte, a que
  sai vai para o saco. Trocar não cura. A extração dá origem na nuvem só ao que
  veio da caçada (`pecasDaCaca()`). O convidado da sala não veste: a ficha dele é do anfitrião.

- **2026-10-19 — A Mochila com o corpo do inventário do Tibia (0.23.0)**
  *(pedido do Leonardo: "algo que se assemelha ao do Tibia, equipamentos em
  posição de uso"; pilar 1)*. Três colunas como a janela do Tibia: amuleto,
  arma e anel à esquerda; elmo, armadura, calça e botas no meio; o saco (onde o
  Tibia põe a mochila), escudo e munição à direita. Casa vazia mostra a
  silhueta do que vai nela; as que o jogo não tem ficam apagadas e sem toque.
  Ao lado, o boneco vestido, que gira ao toque. Tela baixa esconde as duas
  linhas de baixo (só casas apagadas).

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
