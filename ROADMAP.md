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

### 1. Passo fixo na simulação

**Pilar 4** (base técnica da F2). O `update()` roda no `dt` de cada quadro, até
50 ms. O servidor da F2 precisa do mesmo resultado em qualquer máquina: a
simulação passa a andar em passos fixos (candidato: 1/30 s), com o laço do
cliente acumulando tempo e chamando quantos passos couberem. Fazer depois do
gerador com semente.

**Fase:** F0 (2). **Pronto quando:** a simulação no Node dá o mesmo resultado
com passos de quadro diferentes (por exemplo, 16 ms e 50 ms) para a mesma
semente, e o jogo no navegador continua igual.

### 2. Tela de créditos no jogo

**Pilar 2.** A licença CC BY 4.0 do OTSP exige atribuição. Hoje ela está em
`assets/CREDITOS.md` e no README; a seção 9 do PRD pede que o jogo mostre esse
conteúdo. Botão discreto no acampamento abrindo uma tela com origem, licença e
autores.

**Fase:** F0 (5, fecho). **Pronto quando:** a tela existe, lista o OTSP com
licença e link para os autores, e há caso no `tools/testar.mjs`.

### 3. PWA instalável

**Pilar 3.** Manifesto e service worker para instalar na tela inicial e abrir
offline, com o último conteúdo baixado. As fontes já são do sistema, então não
há folha externa para embutir. Sem biblioteca.

**Fase:** F0 (6). **Pronto quando:** o Chrome do Android oferece "Instalar",
o jogo abre sem rede depois da primeira visita, e um caso no harness confere
que o manifesto e o service worker carregam.

### 4. Revisar a economia do Selo de resguardo

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

### Lugares com nome em vez de uma masmorra genérica

**Pilar 2.** Três mapas com tema, paleta e lista de monstros próprios — Esgoto,
Cripta, Acampamento Orc — escolhidos no menu. Reaproveita `genMap()` com
parâmetros diferentes e troca a tabela de spawn. O jogador passa a dizer para
onde vai.

**Pronto quando:** os três lugares têm nome no menu, monstros distintos e paleta
distinta.

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
