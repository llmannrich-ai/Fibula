# Roadmap do Fibula

Contrato entre execuções do ciclo automático. `Agora` tem **um** item por vez.
Ao concluir, mova para `Concluído` com a data e o commit, e promova o primeiro
de `Próximo`.

Todo item aqui precisa ter passado pelas quatro perguntas de
[VISAO.md](VISAO.md), e cada um declara o pilar que serve. Item sem pilar não
entra na lista. Cada item também diz **quando está pronto** — sem isso o ciclo
automático não tem como saber que terminou.

---

## Agora

### CI no GitHub Actions

**Pilar 5.** `.github/workflows/ci.yml` rodando `node tools/testar.mjs` em todo
push e PR. O script já existe e já é o portão, mas hoje depende de o agente
lembrar de chamá-lo; a CI é o que transforma isso em rede de verdade. Depende da
configuração C4 do dono (permissão para criar workflows; ver issue
`precisa-do-dono`). Tudo vai direto na `main`, sem PR. Se o push do workflow for
recusado por falta de C4, deixe o arquivo pronto em `docs/` e siga para outro
item. Na nuvem não existe Edge: a Action instala Chromium e aponta
`FIBULA_EDGE` para ele.

**Fase:** F0 (3). **Pronto quando:** o workflow roda verde na `main` e falha num
PR de teste com erro de sintaxe proposital; o resultado está no diário.

---

## Próximo

Itens técnicos da F0 primeiro (PRD, seção 11); itens de jogo entram em paralelo
quando o Desenvolvedor julgar que cabe numa execução.

### 1. Aviso de falha do save em modo privado

**Pilar 5.** Em modo privado, ou com `localStorage` bloqueado, o progresso não é
salvo e o jogador não é avisado (o `catch` de `persist()` está vazio). A outra
metade deste item — o teste automatizado da migração `v1`→`v2` — já está feita:
é o caso `migracao-save` do `tools/testar.mjs`, que semeia um save da Etapa 2 e
confere cofre, melhorias, estatísticas, nível, experiência e espaços. Nenhuma
alteração no formato do save.

**Fase:** F0 (4). **Pronto quando:** aviso no menu aparece se `persist()` falhou
ao menos uma vez, e um caso novo no `tools/testar.mjs` prova isso com o
`localStorage` sabotado.

### 2. Pipeline dos sprites OTSP (sem trocar o desenho)

**Pilar 2.** `tools/` com script que recorta as folhas usadas do OTSP, converte
o magenta em transparência e monta o atlas; `assets/otsp/` com as folhas usadas,
`LICENSE.txt` e `AUTHORS.md`; `assets/CREDITOS.md`. Seguir as regras da seção 9
do PRD. O jogo continua desenhando as formas atuais.

**Fase:** F0 (5). **Pronto quando:** rodar o script gera o atlas de criaturas de
forma reproduzível, `assets/CREDITOS.md` lista origem, licença e alterações, e
o `index.html` não mudou.

### 3. Gerador aleatório com semente

**Pilar 5.** RNG pequeno e isolado (mulberry32 ou similar) com função de
semente, exposto para `genMap()` e `spawn()`. Se virar mais de ~60 linhas em
`index.html` ou exigir mover código entre seções, esperar a divisão do arquivo
(`comum.md`, seção 3) e fazer outro item.

**Fase:** F0 (2). **Pronto quando:** mesma semente gera o mesmo mapa (teste em
`tools/`) e partidas sem semente continuam variando.

### 4. Peso de verdade na morte: perder parte do XP, não só o saco

**Pilar 1.** Hoje a morte custa apenas o loot que estava no saco, e a
experiência ganha na incursão fica inteira. Isso faz morrer com o saco vazio
sair de graça: no começo da incursão não existe decisão nenhuma, porque não há
nada a perder. O risco só começa a existir depois do primeiro loot bom.

O que fazer: morrer passa a custar também uma fatia do progresso dentro do nível
atual (candidato inicial: 25% do XP acumulado no nível, sem nunca descer de
nível). Precisa aparecer em três lugares — aviso no menu antes de entrar, linha
própria na tela final mostrando quanto foi perdido, e barra de XP no HUD que
reflete a perda ao reabrir.

Cuidado com o pilar 1 na parte da recuperação: se a fatia fizer o jogador
recuar mais de duas incursões, está alta demais. Comece em 25%, jogue, ajuste.

Não implemente proteção contra isso no Mercador nesta etapa — o Selo de
resguardo cobre loot, e misturar as duas coisas confunde a leitura.

Depois da Etapa 3 existem **três** moedas de progressão (nível, magia e
perícia), e no Tibia a morte mordia todas. Comece só pelo XP do nível: é a mais
legível das três e já cria a hesitação que falta. Magia e perícia ficam para
uma revisão posterior, com o diário registrando a decisão.

**Pronto quando:** morrer reduz o XP do nível atual, a tela final mostra a perda
em linha própria, o menu avisa a regra antes de entrar, e o save sobrevive a um
recarregamento com o valor reduzido.

**Fase:** jogo, em paralelo à F0.

### 5. Revisar a economia do Selo de resguardo

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

### Equipamento persistente com três slots

**Pilares 2 e 5.** Arma, armadura e amuleto. O loot raro que hoje é só número
(espada enferrujada, amuleto tribal, gema rubra) passa a ter uso: equipar em vez
de vender. Isso dá ao jogador o momento Tibia de encontrar algo que muda o
personagem, e cria um segundo ralo para o cofre.

Atenção ao pilar 3: no máximo três slots, tela própria, nenhum arrastar e soltar.

**Pronto quando:** os três slots persistem no save, afetam `stats()`, e dá para
equipar e desequipar numa tela só, com o dedo.

### Sair cedo precisa ser uma jogada válida

**Pilar 4.** Hoje o portal abre em 1:30 e nunca mais fecha, então a estratégia
ótima é sempre ficar até o fim: o arco da decisão não existe. Candidatos a
testar: o portal custar uma fatia do saco se usado cedo, ou o valor do loot
crescer com o tempo de permanência, ou o portal ter uma janela que fecha e
reabre. Precisa de teste de jogo, não só de implementação.

**Pronto quando:** existe uma situação clara em que sair aos 2:00 é melhor que
sair aos 5:30, e o diário registra qual das três opções foi escolhida e por quê.

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

- **Cortar a dependência de fontes externas** *(F0 item 6)* — o `index.html` busca Pixelify
  Sans e Barlow Semi Condensed no Google Fonts, hoje a única coisa no jogo que
  depende de rede e um atraso no primeiro carregamento em conexão ruim
  (pilar 3). Duas saídas: embutir os dois pesos como `@font-face` com fonte em
  base64 no próprio arquivo, ou trocar por pilha de fontes do sistema e aceitar
  a perda estética. Pré-requisito para o PWA abrir offline de verdade.

- **Rastro assíncrono de outros jogadores** — placar local, marca de morte no
  mapa onde a última incursão terminou, recorde a ser batido. Sensação de MMO
  sem rede (pilar 2).
- **Som** — efeitos curtos de golpe, de dano e de extração, mais um fundo sóbrio.
  Nada que precise de arquivo externo grande; de preferência síntese via
  WebAudio para manter o arquivo único.
- **PWA** *(F0 item 6)* — manifesto e service worker para instalar na tela inicial e abrir
  offline. Reforça o pilar 3 sem contrariar o "zero dependências".
- **Mercado com preço móvel** — o valor dos itens oscila entre incursões, dando
  motivo para guardar loot em vez de vender na hora (pilar 5).

---

## Concluído

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
