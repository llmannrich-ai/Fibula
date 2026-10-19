# Plano do multiplayer (F2 · Co-op)

> **Referência, não instrução.** O guia único é o [CLAUDE.md](../CLAUDE.md);
> quando este documento discordar dele, vale o guia. Onde aqui se lê "PRD",
> leia a Parte 2 (produto) ou a Parte 6 (decisões) do guia. Mudou desde a
> análise: **o grupo não muda o mundo** (pilar 1, 19/10/2026) — a tabela de
> regras de grupo da seção 3 não vale mais nas linhas de monstros e de vida do
> Guardião, e o `progression.party` só tem `lootProtection` e `shareTiles`.
>
> Análise de 2026-10-18, sobre a `main` em `d018606` (versão 0.5.0). Detalha
> **como** chegar à F2: servidor autoritativo, salas de 1 a 4, convite por
> link, reconexão. As decisões que eram só do Leonardo estão na seção 7.

## 1. Resumo

O multiplayer tem duas metades de tamanho bem diferente:

1. **Ensinar a simulação a ter mais de um jogador** (etapas M0 e M1). É
   refatoração dentro de `src/sim/`, sem rede, sem servidor, sem gasto, e
   testável no Node com o harness que já existe. É a parte que mais muda
   código e a que mais reduz risco.
2. **Pôr a simulação num servidor e falar com ele** (etapas M2 a M4). Exige
   `server/` com `ws`, hospedagem paga (Fly.io, região `gru`) e as decisões
   D2, C6 e C7 do PRD.

Recomendação: **fazer M0 já** (é o item "passo fixo" da F0, ainda aberto),
**M1 em paralelo à F1** (não gasta nada e não muda o que o jogador vê) e
**só começar M2 quando a F1 cumprir o critério de saída** — o próprio PRD
(seção 17) põe "retenção baixa" como risco alto e manda testar com
testadores reais antes de investir no multiplayer.

| Etapa | O quê | Muda o que o jogador vê? | Precisa de gasto/decisão? | Tamanho |
|---|---|---|---|---|
| M0 | Passo fixo da simulação | Não | Não | 1–2 sessões |
| M1 | Simulação com N jogadores (solo = grupo de 1) | Não | Não | 3–5 sessões |
| M2 | Servidor local + protocolo + cliente em rede | Sim (sala por link) | D-M1, D-M2 | 4–6 sessões |
| M3 | Progresso calculado no servidor | Sim (save) | D-M3 | 2–3 sessões |
| M4 | Deploy, reconexão, carga, latência | Sim | D2, C6, C7 | 3–4 sessões |

"Sessão" = uma execução de agente ou sessão manual com teste e commit.

## 1.1 Antes da F2: a cidade compartilhada (19/10/2026)

O Leonardo decidiu testar o multiplayer primeiro **só na cidade**, com as
caçadas sozinhas. Entrou na 0.8.0 sem servidor próprio: o Realtime do
Supabase (presença e broadcast), pelo `WebSocket` nativo, em `src/rede.js`.
Serve porque na cidade não há regra a proteger; não serve para a incursão,
onde dano, loot e XP precisam de servidor autoritativo (M2 a M4 abaixo). O que
o teste ensina sobre a rede de celular (queda, aba no fundo, reconexão) vale
para a M2.

## 1.2 Andar por sqm (19/10/2026, versão 0.9.0)

Decisão do Leonardo, depois do estudo do movimento do Tibia (Forgotten
Server, `creature.cpp`): todo mundo anda por sqm, um passo de cada vez. Para o
multiplayer isso muda três coisas:

- **Rede:** um passo é uma mensagem com o sqm de destino e a duração; quem
  recebe anima igual, sem adivinhar caminho, e parado não manda nada. Na
  cidade, ~3 mensagens por segundo de quem anda (eram 5).
- **Servidor autoritativo (M2):** conferir o movimento de um cliente vira
  checar se o sqm é vizinho, livre e se a duração do passo passou — sem
  refazer física contínua. Monstros mandam um evento por passo, não 20
  posições por segundo.
- **Jogo em grupo:** bloqueio de corpo (monstros ocupam sqm) dá papel ao
  cavaleiro, que segura o corredor.

## 1.3 Caçar junto com o anfitrião calculando (19/10/2026, versão 0.14.0)

Opção C, decidida pelo Leonardo depois de testar a cidade compartilhada com
dois celulares: co-op na masmorra **antes da M2 e sem gasto**, com o aparelho
de quem cria a sala no papel do servidor. Usa a M1 (fichas, `G.ps`) e o
andar por sqm: o convidado anda no próprio aparelho e conta o sqm; o
anfitrião leva o boneco até lá pela regra, então não há teleporte. O
`CLAUDE.md` (Realtime → Sala) descreve o funcionamento.

Ainda em 19/10, o Leonardo trocou o tempo da masmorra da sala por uma
**porta**: a masmorra nasce com a sala, não tem tempo, cada um entra e sai
quando quer e os monstros renascem. O solo continua com 6 minutos. Para o
servidor da F2, isso é uma instância persistente por sala, não uma partida
com começo e fim; o protocolo (entrada por passo, retrato, resultado por
jogador ao sair) é o mesmo.

O que isso adianta da M2: o protocolo (entrada por passo, retrato a 10/s,
resultado por jogador) e o convidado desenhando um estado que não calcula.
O que **não** resolve, e continua sendo da M2/M3: trapaça do anfitrião,
partida que congela se o anfitrião minimiza o jogo, e o limite de ~100
envios por segundo por canal do Realtime.

## 2. Onde o código está hoje (o que impede o multiplayer)

O que já ajuda muito:

- **Fronteira `src/sim/` sem DOM** — o servidor roda os mesmos arquivos.
- **Sorteio com semente** — o mapa não precisa trafegar: o servidor manda a
  semente e o cliente roda `genMap()` igual. Só entidades que se mexem vão
  pela rede.
- **Entrada como argumento** (`update(dt, ent)`) — basta virar uma entrada
  por jogador.
- **Harness que roda a incursão no Node** — é o banco de testes do servidor.

O que impede, em ordem de esforço:

| # | Problema | Onde | Por que trava |
|---|---|---|---|
| P1 | **Um jogador só**: `G.p` é um objeto único | `incursao.js` (5 usos), `combate.js` (10), `desenho.js`, `hud.js` | Tudo — monstros, projéteis, portal, fluxo — mira `G.p` |
| P2 | **A simulação lê o save global**: `ch()`, `stats()`, `KL()`, `save.up` | `combate.js` (dano, mana, golpes, XP), `incursao.js` (`newRun`, `spawn`, `finish`) | No servidor há 4 personagens diferentes na mesma sala; não existe "o" save |
| P3 | **Progresso escrito no meio da incursão**: `gainXp()` mexe em `ch().xp`, `manaG`, `golpes` na hora | `combate.js` | Servidor precisa acumular por jogador e aplicar no fim, numa transação |
| P4 | **Passo variável**: `update(dt)` com o `dt` do quadro | `main.js` → `update()` | Servidor e cliente divergem; a semente só repete com o mesmo `dt` |
| P5 | **`saida` é um alvo só**: `log`, `banner`, `fim` não dizem de qual jogador | `base.js` | Mensagem de "você morreu" iria para todos |
| P6 | **Campo de fluxo parte de um ponto** | `buildFlow()` | Monstro precisa perseguir o jogador mais próximo |
| P7 | **Estado não serializável** | `G.pend` guarda funções (`q.fn`), monstros guardam `t` (referência à tabela) | Não dá para mandar nem conferir o estado |

## 3. Etapas

### M0 · Passo fixo (item 2 da F0) — feito em 18/10, versão 0.6.1

Entrou como descrito abaixo, com `TICK=0.05` e `passo()` em `src/sim/incursao.js`;
o `CLAUDE.md` ("O passo é fixo") descreve o resultado.

**O que fazer**

- `TICK=1/20` em `src/sim/base.js` (20 Hz, a taxa de estado que o PRD pede;
  50 ms já é o `dt` máximo que o jogo aceita e o que o harness usa, então não
  há comportamento novo a validar).
- `main.js` acumula o tempo real e chama `update(TICK, ent)` quantas vezes
  couber; o `render()` interpola posições entre o estado anterior e o atual
  (`alpha = acumulado/TICK`), senão o movimento fica a 20 quadros visíveis.
- Guardar `x0,y0` de jogador, monstros e projéteis no início de cada passo
  para a interpolação. Sem alocação: campos no próprio objeto.

**Pronto quando:** a mesma semente e a mesma sequência de entradas dão o
**mesmo resultado de incursão inteira** no Node em duas rodadas (o harness
passa a prender isso), e o jogo no celular não ficou visivelmente mais
travado (olho humano, viewport de celular).

**Risco:** o efeito de 20 Hz sem interpolação é feio. A interpolação é parte
da entrega, não melhoria futura.

### M1 · A simulação com N jogadores — feita em 19/10, versão 0.8.2

O princípio: **solo é um grupo de um**. Um caminho de código só, senão o
modo multiplayer apodrece sem ninguém perceber.

**Como entrou** (o `CLAUDE.md` descreve o resultado): itens 1, 2, 4 e 5
abaixo como escritos, e as regras de grupo da tabela, com os números em
`progression.party` (`monsters`, `bossHp`, `lootProtection`, `shareTiles`).
Duas diferenças, que a M2 precisa resolver:

- **Item 3 pela metade.** A ficha do solo aponta para o próprio personagem
  do save (`fichaLocal()`), então nível, Magia e Perícia continuam subindo
  direto nele, como antes; os ganhos da incursão ficam contados em cada
  jogador (`p.xpGain`, `p.magGain`, `p.perGain`, `p.bag`). O servidor passa
  fichas que são cópias e grava no banco a partir delas no fim.
- **Item 6 não entrou.** `G.pend` ainda guarda função e `m.t`, `m.dot.p` e
  `q.p` guardam objetos: o estado ainda não é JSON puro. É pré-requisito do
  snapshot da M2.

Escolhas que o plano não cobria: o nível que escala os monstros é o **maior**
do grupo (`G.lvl`), para o nível 1 não deixar a masmorra fácil para o 20; o
alvo do monstro é o dono do tile no campo de fluxo (`G.fdono`); quem sai
(portal ou morte) deixa de ser alvo, e a sala acaba quando não sobra ninguém.
O teste no Node roda 1, 2 e 4 jogadores com entradas roteirizadas; cinco
sabotagens das regras de grupo foram barradas.

**Mudanças na regra**

1. `G.p` → `G.ps` (lista de jogadores, cada um com `id`). Um atalho
   `G.p = G.ps[0]` pode existir só no cliente durante a transição.
2. **Personagem dentro do jogador** (resolve P2): `newRun(semente, fichas)`
   recebe uma ficha por jogador — `{id, classe, lvl, mag, per, slots, equip,
   up}` — e `stats()`/`KL()` passam a receber a ficha em vez de ler `save`.
   O cliente monta a ficha a partir do save; o servidor, a partir do banco.
3. **Ganhos acumulados, aplicados no fim** (resolve P3): `gainXp`, mana
   gasta e golpes vão para `p.ganho = {xp, manaG, golpes, bag}`. Nível
   subindo na incursão continua (o caso `nivel-na-incursao` cobre), mas
   calculado sobre a ficha. Quem grava no save é o cliente (solo) ou o
   servidor (co-op), a partir de `p.ganho`, em `finish`.
4. `update(dt, ents)` com `ents[id]`; `saida.*` recebe o `id` do jogador
   (ou `null` para mensagem da sala).
5. `buildFlow()` com várias origens: a BFS começa de todos os jogadores
   vivos ao mesmo tempo. Mesmo custo. O monstro guarda `alvo` (jogador mais
   perto pelo fluxo) e ataca esse.
6. Tirar funções do estado (`G.pend` vira `{t, tipo, dados}`) e trocar `m.t`
   por `m.k` + consulta a `MT`. Estado vira JSON puro.

**Regras de grupo** (padrões propostos; números no `content.json`, em
`progression.party`, para ajustar sem programar):

| Regra | Proposta | Pilar |
|---|---|---|
| Monstros por sala | × (1 + 0,6 · (n − 1)) | PRD 7.3: mais jogadores = mais monstros |
| Vida do Guardião | × (1 + 0,8 · (n − 1)) | Chefe não pode derreter com 4 |
| Loot | **Único** (decisão do Leonardo, 19/10): cada morte deixa um drop só, visível a todos, e só um jogador o pega. Nos primeiros 10 s (`progression.party.lootProtection`) só quem causou mais dano no monstro pode pegar, como no Tibia; depois, qualquer um. Troca entre jogadores fica para o Mercado (F3) | Tibia raiz: o drop é disputado, e quem matou tem a vez |
| XP | Cheia para cada participante | Tibia tinha XP dividida; aqui o grupo já cobra em monstro a mais |
| Extração | **Individual**: cada um para no portal e sai com o seu saco | Pilar 4: a decisão de sair é de cada um |
| Morte | O jogador morto perde o próprio saco e vira espectador da sala até ela acabar | Pilar 1 sem punir o grupo |
| Reviver | Não existe | Não-objetivo: nada que facilite a morte |

**Pronto quando:** o harness tem casos no Node com 1, 2 e 4 jogadores
(entradas roteirizadas), a mesma semente + mesmas entradas dá o mesmo
resultado para os quatro, todos os casos atuais do Chromium continuam
passando, e o jogador solo não percebe diferença.

### M2 · Servidor local, protocolo e cliente em rede

**Estrutura**

```
server/
  package.json      ← único package.json do repositório (PRD seção 10), só com `ws`
  sala.js           ← uma sala: newRun, laço de 20 Hz, entradas, snapshots
  servidor.js       ← HTTP de saúde + WebSocket, criação de sala, código de convite
```

O `server/` importa `../src/sim/` como está. **Nada de `server/` vai para o
navegador**, e o jogo continua sem build: o cliente usa o `WebSocket` nativo.
A regra "nenhuma dependência" do `CLAUDE.md` precisa de uma linha nova
dizendo que ela vale para o que é servido pelo Pages, e que `server/` pode ter
o `ws` — o PRD já autoriza, o `CLAUDE.md` ainda não diz.

**Protocolo** (JSON no começo; binário só se a medição pedir)

| Direção | Mensagem | Conteúdo |
|---|---|---|
| C → S | `entrar` | código da sala, token da conta (ou convidado), ficha |
| S → C | `sala` | semente, lista de jogadores, quem é você, tick atual |
| C → S | `intencao` | `seq`, `x`, `y`, `held[4]`, `pot` — só intenção, nunca posição |
| S → C | `estado` | tick, último `seq` aplicado de cada um, jogadores, monstros, projéteis, drops do destinatário, eventos (`log`, `banner`, dano) |
| S → C | `fim` | resultado do destinatário: saco, ouro, XP, peças |

Mapa nunca trafega: o cliente gera pela semente. `estado` a 20 Hz com só as
entidades num raio de ~12 tiles do destinatário (o minimapa usa o que o
cliente já viu).

**Cliente**

- `src/rede.js` (módulo novo, com fronteira clara: socket, fila de
  intenções, snapshots). Sem rede, o `main.js` continua chamando a simulação
  local — é o solo.
- **Predição do próprio movimento**: o cliente roda `move()` local com a sua
  intenção e corrige quando chega o `estado` (reaplica as intenções com `seq`
  maior que o confirmado). Sem isso, 150 ms de latência viram joystick
  borrachudo, e o pilar 3 morre.
- **Outros jogadores e monstros**: desenhados ~100 ms atrás, interpolando
  entre dois snapshots.
- Dano, morte e loot **só** o servidor decide. O cliente pode antecipar o
  efeito visual (faísca, número) com `frr()`, nunca o resultado.
- Convite: menu ganha "Jogar em grupo" → cria sala → link
  `https://llmannrich-ai.github.io/Fibula/?sala=K7QF`. Quem abre o link cai
  na sala. Começa quando o dono da sala aperta "Entrar" ou quando os 4 estão.

**Testes** (um harness só): o `tools/testar.mjs` sobe o `server/` no mesmo
processo, e

- casos no Node: 4 clientes falsos com entradas roteirizadas jogam uma sala
  inteira, com atraso e perda simulados;
- casos no Chromium: duas páginas na mesma sala, uma mata, a outra vê o
  monstro morrer.

O `ws` vem do npm, então a CI precisa de `npm ci` dentro de `server/` antes
do teste. Esse é o único ponto em que o harness deixa de ser "só Node e
Chromium".

**Pronto quando:** dois navegadores na mesma máquina completam uma incursão
juntos pelo servidor local, os casos novos passam na CI e o solo continua
igual.

### M3 · Progresso calculado no servidor

Hoje o cliente grava o save inteiro (`save_gravar`), e quem edita o JSON
trapaceia. Em co-op isso deixa de ser trapaça no próprio save: um jogador com
dano editado carrega os outros.

- O servidor lê a ficha do banco ao entrar (não aceita a do cliente para
  quem tem conta) e, no `fim`, aplica `p.ganho` numa função nova
  `incursao_registrar` (arquivo `tools/supabase/003_incursoes.sql`, tabela
  `public.incursoes` como registro de auditoria: semente, jogadores, duração,
  resultado).
- O servidor fala com o Supabase com a chave **secret**, em variável de
  ambiente do Fly.io. Nunca no repositório, nunca no cliente.
- Convidado sem conta joga co-op com ficha do aparelho, mas o resultado não
  conta para ranking (quando houver).

**Pronto quando:** o critério da F2 "nenhuma regra decidida no cliente" vale
para co-op: editar o save no aparelho não muda o dano nem o loot numa sala.

### M4 · Deploy e robustez

- Fly.io, região `gru`, uma máquina pequena; `wss://` obrigatório (o Pages é
  HTTPS e o navegador bloqueia `ws://`). Deploy do servidor separado do Pages:
  push na `main` continua publicando o cliente; o servidor sobe por workflow
  com `FLY_API_TOKEN`.
- **Compatibilidade de versão**: cliente manda a sua versão (`?v=`) no
  `entrar`; servidor recusa versão diferente com "atualize a página". Sem
  isso, um deploy no meio de uma sala deixa simulações diferentes jogando
  juntas.
- **Reconexão** (PRD 7.3): 20 s parado e invulnerável; voltar com o mesmo
  token reassume o personagem; passado o prazo, sai com o saco se não estava
  em combate. No celular isso é o caso comum (tela apagou, troca de 4G para
  Wi-Fi), não exceção.
- Limite de taxa de intenções (> 30/s descarta) e de criação de salas.
- **Medição**: o cliente mede o RTT pelo eco do `seq` e manda junto do
  resultado; meta < 150 ms no Brasil (O4 do PRD).
- **Carga**: script com 50 salas × 4 clientes falsos contra a máquina do
  Fly.io, medindo CPU e o tick real (critério de saída da F2).

**Pronto quando:** os três critérios de saída da F2 no PRD — 4 celulares
completam uma incursão juntos com < 150 ms, nenhuma regra no cliente, teste
de carga com 50 salas.

## 4. O que fica de fora da F2

Cidade compartilhada, chat, guildas, mercado e matchmaking com
desconhecidos são F3. Na F2 só se joga com quem recebeu o link — o que
também dispensa moderação de chat por enquanto. PvP aberto é decisão do Leonardo (pilar 4, 19/10/2026), mas só entra com o servidor autoritativo: o que arrisca quem mata é a pendência D1.

## 5. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Investir em rede antes de saber se o jogo retém | Alto | M2 só depois do critério da F1 (D7 ≥ 25%). M0 e M1 servem ao solo também |
| Rede de celular brasileira: jitter, troca de antena, aba em segundo plano | Alto | Predição + interpolação desde a M2; reconexão como caso de teste, não como extra |
| Refatoração da M1 quebra o solo | Médio | Solo = grupo de 1, mesmo código; todos os casos atuais do harness continuam |
| Cliente e servidor com versões diferentes | Médio | Checagem de versão no `entrar` (M4) |
| Harness ganha dependência de npm | Médio | Só o `server/` tem `package.json`; casos de rede pulados com aviso se o `ws` não estiver instalado localmente, obrigatórios na CI |
| Servidor sem dono de plantão | Médio | Máquina única, sem estado persistente próprio (o banco é o Supabase); reiniciar só perde salas em andamento |
| Custo | Baixo agora | Uma máquina pequena do Fly.io custa poucos dólares por mês; confirmar o preço vigente antes da D2 |

## 6. O que muda nos guias quando cada etapa entrar

- **M0:** `CLAUDE.md` — tirar o "limite atual" da seção da semente; PRD
  seção 11 — passo fixo ✅.
- **M1:** `CLAUDE.md` — mapa do código (`G.ps`, ficha, `p.ganho`), "três
  coisas sutis" ganha o campo de fluxo com várias origens.
- **M2:** `CLAUDE.md` — regra número um passa a dizer que vale para o que é
  servido, com `server/` como a exceção que o PRD já autoriza; seção de
  testes descreve os casos de rede.
- **M3:** `CLAUDE.md` — seção Supabase ganha a `003` e a chave do servidor.

## 7. Decisões do Leonardo

| # | Decisão | Proposta | Bloqueia |
|---|---|---|---|
| D-M1 | Antecipar a F2? | **Decidida em 19/10:** antecipar só a M1 (sem rede, sem gasto). A rede (M2 em diante) segue na F2 | M2 |
| D-M2 | Regras de grupo da seção 3 | **Decidida em 19/10:** as regras da seção 3, com o loot **único** (um drop por monstro, um jogador pega) no lugar do instanciado. Ajustar no playtest | M1 |
| D-M3 | Solo continua local ou também passa pelo servidor? | Solo local (abre sem rede, ônibus, 3G); só co-op é autoritativo. Revisar quando houver ranking ou mercado (F3), porque aí o solo editado vira problema de todos | M3 |
| D2 | Teto mensal de infraestrutura (já no PRD, sensível) | — | M4 |
| C6/C7 | Conta Fly.io, `FLY_API_TOKEN`, liberar `api.fly.io` e `registry.npmjs.org` na rede do ambiente | — | M2 (npm) e M4 (deploy) |

## 8. Próximo passo concreto

Pôr a **M0 (passo fixo)** no `ROADMAP.md` como item de F0 — ela já está na
lista da F0 do PRD e não depende de nenhuma decisão. D-M1 e D-M2 foram
decididas em 19/10, e a M1 entrou na 0.8.2. O próximo passo de rede é a M2,
que depende de D2 (teto de gasto) e C6/C7.
