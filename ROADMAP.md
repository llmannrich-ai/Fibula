# Roadmap do Fibula

Contrato entre execuções do ciclo automático. `Agora` tem **um** item por vez.
Ao concluir, mova para `Concluído` com a data e promova o primeiro de `Próximo`.

Todo item aqui precisa ter passado pelas quatro perguntas de
[VISAO.md](VISAO.md), e cada um declara o pilar que serve. Item sem pilar não
entra na lista.

---

## Agora

### Peso de verdade na morte: perder parte do XP, não só o saco

**Pilar 1.** Hoje a morte custa apenas o loot que estava no saco, e a
experiência ganha na incursão fica inteira. Isso faz morrer com o saco vazio sair
de graça: no começo da incursão não existe decisão nenhuma, porque não há nada a
perder. O risco só começa a existir depois do primeiro loot bom.

O que fazer: morrer passa a custar também uma fatia do progresso dentro do nível
atual (candidato inicial: 25% do XP acumulado no nível, sem nunca descer de
nível). Precisa aparecer em três lugares — aviso no menu antes de entrar, linha
própria na tela final mostrando quanto foi perdido, e barra de XP no HUD que
reflete a perda ao reabrir.

Cuidado com o pilar 1 na parte da recuperação: se a fatia fizer o jogador
recuar mais de duas incursões, está alta demais. Comece em 25%, jogue, ajuste.

Não implemente proteção contra isso no Mercador nesta etapa — o Selo de
resguardo cobre loot, e misturar as duas coisas confunde a leitura.

---

## Próximo

### 1. Escolha de risco na entrada: três profundidades

**Pilares 2 e 4.** Antes de entrar, o jogador escolhe entre três profundidades,
cada uma com multiplicador de dano dos monstros e de valor do loot. O mundo
deixa de se ajustar ao jogador: a profundidade funda é entrável no nível 1 e é
burrice entrar. É a forma mais barata de criar a sensação de mundo indiferente,
e transforma cada incursão numa decisão antes mesmo de começar.

### 2. Equipamento persistente com três slots

**Pilares 2 e 5.** Arma, armadura e amuleto. O loot raro que hoje é só número
(espada enferrujada, amuleto tribal, gema rubra) passa a ter uso: equipar em vez
de vender. Isso dá ao jogador o momento Tibia de encontrar algo que muda o
personagem, e cria um segundo ralo para o cofre, já que o Mercador pode vender
e melhorar equipamento.

Atenção ao pilar 3: no máximo três slots, tela própria, nenhum arrastar e soltar.

### 3. Lugares com nome em vez de uma masmorra genérica

**Pilar 2.** Três mapas com tema, paleta e lista de monstros próprios — Esgoto,
Cripta, Acampamento Orc — escolhidos no menu. Reaproveita `genMap()` com
parâmetros diferentes e troca a tabela de spawn. O jogador passa a dizer para
onde vai.

### 4. Sair cedo precisa ser uma jogada válida

**Pilar 4.** Hoje o portal abre em 1:30 e nunca mais fecha, então a estratégia
ótima é sempre ficar até o fim: o arco da decisão não existe. Candidatos a
testar: o portal custar uma fatia do saco se usado cedo, ou o valor do loot
crescer com o tempo de permanência, ou o portal ter uma janela que fecha e
reabre. Precisa de teste de jogo, não só de implementação.

---

## Depois

- **Cortar a dependência de fontes externas** — o `index.html` busca Pixelify
  Sans e Barlow Semi Condensed no Google Fonts, hoje a única coisa no jogo que
  depende de rede e um atraso no primeiro carregamento em conexão ruim
  (pilar 3). Duas saídas: embutir os dois pesos como `@font-face` com fonte em
  base64 no próprio arquivo, ou trocar por pilha de fontes do sistema e aceitar
  a perda estética. Pré-requisito para o PWA abrir offline de verdade.
- **Rastro assíncrono de outros jogadores** — placar local, marca de morte no
  mapa onde a última incursão terminou, recorde a ser batido. Sensação de MMO
  sem rede (pilar 2).
- **Habilidade que sobe com uso** — Faísca e Runa ganham nível conforme são
  usadas, à moda das skills do Tibia (pilares 1 e 5).
- **Som** — efeitos curtos de golpe, de dano e de extração, mais um fundo sóbrio.
  Nada que precise de arquivo externo grande; de preferência síntese via
  WebAudio para manter o arquivo único.
- **PWA** — manifesto e service worker para instalar na tela inicial e abrir
  offline. Reforça o pilar 3 sem contrariar o "zero dependências".
- **Vocações** — quatro estilos de jogo com habilidades distintas, no lugar do
  conjunto único Faísca/Runa/Poção.
- **Mercado com preço móvel** — o valor dos itens oscila entre incursões, dando
  motivo para guardar loot em vez de vender na hora (pilar 5).

---

## Concluído

- **2026-10-18 — Etapa 1: protótipo jogável.** Incursão de 6 minutos com mapa
  gerado, cinco tipos de monstro mais o Guardião do Portal, campo de fluxo para
  perseguição, loot por tabela de raridade, portal de extração aos 1:30, morte
  com perda do saco, HUD, minimapa e joystick virtual.
- **2026-10-18 — Etapa 2: cofre e Mercador.** O ouro extraído passa a ir para o
  cofre, e o cofre tem onde ser gasto: cinco melhorias permanentes com preço
  geométrico (Vigor, Foco, Poder arcano, Bolsa de poções, Selo de resguardo).
- **2026-10-18 — Correção do tempo exibido na tela final.**
- **2026-10-18 — Base de orientação para IA.** `CLAUDE.md`, `VISAO.md`,
  `ROADMAP.md` e `DIARIO.md`, para que sessões manuais e o ciclo automático
  trabalhem com o mesmo contrato.
