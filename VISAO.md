# Visão de design do Fibula

Este documento existe para decidir discussões. Quando duas ideias competem, a
que serve melhor os pilares ganha. Quando uma ideia esbarra num não-objetivo,
ela não entra — e quem quiser que entre precisa primeiro mudar este arquivo,
com o Leonardo de acordo.

## A frase

**Tibia raiz, feito direito num celular, numa partida de menos de dez minutos.**

O Tibia antigo acertava uma coisa que quase nenhum jogo de celular tenta: fazer
o mundo parecer indiferente a você. Os monstros não eram balanceados para o seu
nível, a morte custava horas de progresso, e por isso cada decisão de avançar um
corredor a mais tinha peso. A sensação não era de poder, era de risco
administrado.

O Tibia também errava muito, e quase todos os erros eram de tempo: meia hora
andando até um lugar, vinte minutos esperando respawn, uma sessão que só fazia
sentido se você tivesse três horas livres. Isso é incompatível com celular.

Fibula pega o peso e joga fora a espera. A incursão é curta de propósito, e é
justamente a pressa que recria a tensão da volta para o depósito: você está com
o saco cheio, o tempo está acabando, e cada monstro entre você e o portal é uma
aposta.

Quando a inspiração virar número — curva de nível, custo de magia, diferença
entre classes — a fonte é
[docs/analise-tibia-habilidades.md](docs/analise-tibia-habilidades.md), que
destrincha as fórmulas reais do Tibia e explica por que classe aqui é **taxa de
crescimento, não lista de poderes**. Este documento diz para onde o jogo vai;
aquele diz como o Tibia fazia a conta.

## Os cinco pilares

### 1. A morte custa, e o jogador sabe o preço antes de arriscar

Sem penalidade, extração não é decisão — é só uma fila de recompensas. O que faz
o jogador hesitar na porta da próxima sala é ter algo a perder.

A regra é que **a perda precisa ser concreta, quantificada e visível**: o jogador
vê quanto está carregando durante a incursão, vê exatamente o que perdeu na tela
final, e sabe de antemão qual é a regra. Penalidade escondida vira sensação de
injustiça, não de risco.

O contrapeso é o tempo de recuperação: a perda tem que doer por uma ou duas
incursões, não por uma semana. Perder três horas de progresso era o erro do
Tibia, não a virtude.

Hoje (0.6.0): morrer custa o saco inteiro, menos o que o Selo de resguardo
protege, e 25% da experiência acumulada no nível atual, nunca o nível. O menu
mostra quanto XP está em jogo antes de entrar. Isso é o piso, não o teto — o peso da morte pode crescer,
desde que continue legível e recuperável.

### 2. O mundo parece maior que o jogador

É daqui que vem a sensação de MMO, e ela não depende de ter outras pessoas
conectadas. Depende de três coisas:

- **O mundo não se ajusta a você.** Lugares têm um nível de perigo próprio. Entrar
  num lugar acima do seu nível é permitido e é burrice — essa possibilidade é o
  que dá significado a ficar mais forte.
- **O mundo tem nomes e lugares, não "fase 3".** Esgoto, cripta, acampamento orc.
  O jogador deve conseguir dizer para onde está indo e por quê.
- **O jogador vê rastro de outros.** Placar, marcas de morte, preços que se
  movem, um recorde que não é seu. Tudo isso funciona de forma assíncrona, sem
  servidor e sem jogo em rede.

A sensação de habitar um mundo compartilhado começa com persistência e rastro,
sem rede. A partir da F2 do [PRD](docs/PRD.md) ela ganha gente de verdade:
co-op em tempo real nas incursões e, depois, uma cidade compartilhada. O rastro
assíncrono continua valendo para quem joga sozinho.

### 3. Celular de verdade, uma mão só, retrato

O jogo nasce para o toque. Não é um jogo de PC com controle adaptado.

O teste é brutal e simples: **dá para jogar bem, em pé, no ônibus, com uma mão?**
Se a resposta envolve "é melhor com as duas mãos" ou "no computador fica melhor",
a decisão está errada.

Isso implica: alvo escolhido pelo jogo, não apontado pelo jogador. Poucos botões,
grandes, na zona do polegar. Nada de arrastar e soltar em inventário minúsculo.
Nada de menu com seis níveis. Nada que dependa de passar o mouse por cima. E o
jogo precisa rodar liso num celular mediano — o teclado existe só para
desenvolvimento e testes.

### 4. A incursão cabe em menos de dez minutos e tem arco inteiro

Alvo de cinco a sete minutos; dez é o teto absoluto. Dentro desse tempo precisa
caber o arco completo: descer com segurança, acumular risco, decidir sair.

A decisão interessante não é "quando eu abro o jogo", é **quando eu vou embora**.
Para isso, sair cedo tem que ser viável e sair tarde tem que ser ganancioso.
Se a estratégia ótima for sempre ficar até o último segundo, o arco morreu e o
tempo virou só uma contagem.

Nada de mecânica que exija planejar a sessão: sem energia, sem vidas que
recarregam, sem evento que só acontece às oito da noite. O jogador abre, joga uma
incursão, fecha.

### 5. O progresso é permanente, visível e tem onde ser gasto

O grind do Tibia funcionava porque cada ganho era seu para sempre. Fibula mantém
isso: nível, cofre e melhorias não voltam atrás.

Em troca, **recurso acumulado precisa de ralo**. Ouro parado é progresso morto. O
Mercador existe para isso, com preço geométrico, para que o cofre nunca deixe de
ter uso. Qualquer recurso novo que entre no jogo precisa nascer com o ralo dele
já definido.

## Não-objetivos

Estes são explícitos para poupar discussão. Nada aqui entra sem o Leonardo mudar
este arquivo primeiro. Revisados em 2026-10-18 para a direção comercial com
multiplayer definida no [PRD](docs/PRD.md), que decide escopo e fase.

- **Mundo aberto contínuo e PvP aberto.** O multiplayer entra por fases (co-op
  em salas de até 4, depois cidade compartilhada — ver [PRD](docs/PRD.md)). Um
  MMO de mapa contínuo e PvP livre continuam fora.
- **Energia, vidas ou qualquer portão de tempo real.** Contraria o pilar 4.
- **Compra que vira poder.** O Fibula será comercial (F4 do PRD), mas dinheiro
  só compra estética e conveniência — nunca dano, vida, loot ou proteção contra
  a morte.
- **Facilitar a morte para reter jogador.** Modo sem penalidade, revive por
  anúncio, checkpoint no meio da incursão: tudo isso apaga o pilar 1.
- **Fidelidade de museu ao Tibia.** Não queremos os onze slots de equipamento, a
  interface de 2002, nem o tempo de viagem. Queremos a sensação, não a cópia.
- **Dependência externa nova.** Nenhuma biblioteca, nenhum build. O motivo
  técnico está no [CLAUDE.md](CLAUDE.md); o motivo de design é que o jogo tem
  que abrir em dois segundos num 3G ruim. Hoje o jogo não baixa nada de
  terceiro: a folha de fontes do Google, a única exceção herdada, saiu em
  18/10/2026. O Supabase (contas e save, só com conta) é serviço do produto,
  decidido no [PRD](docs/PRD.md), não biblioteca no navegador.
- **Rastreamento invasivo.** Sem cookie de terceiro, sem SDK de anúncio, sem
  vender dado. A partir da F1 existe telemetria própria e mínima (eventos de
  jogo da seção 12 do PRD), dentro da LGPD.

## Tom

Sóbrio e seco, em português do Brasil. O jogo fala com o jogador como um aviso,
não como um apresentador: "A masmorra está desabando", não "Uau! Corra!". Sem
emoji na interface, sem gíria, sem exclamação em excesso.

Os nomes seguem a mesma régua — Faísca, Runa, Selo de resguardo, Guardião do
Portal. Palavras comuns, concretas, levemente antigas. Nada de nome inventado
com apóstrofo no meio.

## O teste final de qualquer ideia

Quatro perguntas, nessa ordem:

1. Qual pilar isso serve? Se nenhum, está fora.
2. Isso bate em algum não-objetivo? Se sim, está fora.
3. Dá para jogar com uma mão, em pé, no ônibus?
4. Caberia numa incursão de sete minutos?

Se passar nas quatro, vale propor. Daí vira item do [ROADMAP.md](ROADMAP.md).
