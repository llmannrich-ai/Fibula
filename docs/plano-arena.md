# Plano da Arena

> **Referência, não instrução.** O guia único é o [CLAUDE.md](../CLAUDE.md);
> quando este documento discordar dele, vale o guia. Nada daqui entra no jogo
> antes de o Leonardo decidir os pontos da seção 2 e, se for o caso, mudar a
> Parte 1 à mão.
>
> Plano de 19/10/2026, sobre a `main` em `b7e6286` (versão 0.47.0), a pedido
> do Leonardo, a partir da conversa com os testadores (partida curta,
> grupos de 1 a 4, mapa que fecha, extração, PvP entre grupos, loot de quem
> cai, recomeçar depois de morrer).

## 1. O que é a Arena

Um **modo à parte** do Fibula, com regras próprias e anunciadas: uma partida
curta, de 10 minutos, em que vários grupos caem no mesmo mapa, sobem de nível
**dentro da partida**, disputam o centro e precisam extrair antes de a arena
desabar. Morreu? Perde o que carregava e entra em outra partida.

No mundo, é uma **instituição da cidade**: o Mestre da Arena organiza o jogo,
e quem entra sabe as regras antes. É por isso que ela pode ter relógio e mapa
que fecha sem contaminar o resto: o mundo continua indiferente, e a Arena é um
jogo que as pessoas do mundo jogam, como a arena de Svargrond no Tibia.

**A linha que separa os dois modos:** nada que vale ouro, XP, item ou nível
sai da Arena para o personagem. O personagem da Arena é temporário e nasce em
cada partida. É o que mantém os pilares 3, 4 e 5 do jogo principal intactos,
e também o que permite rodar a Arena hoje, com o anfitrião calculando: se nada
de valor sai, trapacear não rouba nada de ninguém (o mesmo argumento que
liberou a cidade compartilhada).

### O que os testadores pediram, e onde entra

| Pedido | Na Arena |
|---|---|
| Partida curta, que vai agregando | 10 min; nível, habilidades e itens crescem dentro da partida |
| Solo, dupla, trio ou quarteto | Times de 1 a 4, até 8 jogadores por partida no início (seção 5) |
| Matar bichos e o mapa ir fechando | Monstros por toda a arena; a partir dos 5 min, anéis desabam da borda para o centro |
| Quem não extraiu morre e perde tudo | Aos 10 min a arena inteira desaba |
| Encontrar outros times e PK | PvP entre times, sem fogo amigo |
| Pegar o loot do adversário | Quem morre larga a mochila inteira no chão, para qualquer um |
| Dominar a área X e extrair na Y | O loot bom e o chefe ficam no centro; os portais de saída abrem perto do centro, então todos convergem |
| Quanto mais tempo, melhor o loot e mais chefe | Fases fixas: aos 3 min nasce o Guardião da Arena no centro, aos 6 min o segundo, com loot melhor |
| Morreu, reinicia em nova partida | Tela final com o placar e o botão "Nova partida" |

## 2. Decisões do Leonardo antes de começar

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| A1 | O que sai da Arena para o jogo principal | **Nada de valor**; só estatística e placar | Protege os pilares 3 a 5 e torna aceitável o anfitrião calcular |
| A2 | Com que personagem se joga | **Ficha temporária** de nível 1 da classe escolhida, com o kit base dela | Todos começam iguais em cada partida (pilar 1 dentro da Arena); dispensa conta |
| A3 | Precisa de conta? | **Não**: menu, "Arena", escolhe a classe e entra | Reduz o atrito para o testador |
| A4 | Duração e jogadores | **10 min, até 8 jogadores** | Cabe na meta O3; 8 é o que o Realtime grátis deve aguentar (medir) |
| A5 | Texto na Parte 1 | Uma exceção explícita, abaixo | Hoje o teste de ideias reprova o mapa que fecha; mudar a Parte 1 só o Leonardo faz |
| A6 | Ranking no banco | **Depois do MVP**; no MVP, placar só no aparelho | Uma tabela nova no Supabase é decisão sensível |

**Texto sugerido para a Parte 1**, em Não-objetivos, logo depois de "Portão
de tempo real":

> **A Arena é a exceção anunciada.** Um modo à parte, organizado no mundo pelo
> Mestre da Arena, pode ter relógio, mapa que desaba e personagem que nasce
> em cada partida. Duas regras o mantêm fora do jogo principal: nada de valor
> (ouro, XP, item, nível) sai da Arena para o personagem, e nada do personagem
> entra nela. Dentro dela, todo mundo começa igual.

Depois de mudar, ele assina com `node tools/principios.mjs --assina` e
registra a decisão na Parte 6.

## 3. Como se entra

- **Pelo menu:** botão **Arena** na tela de entrada, ao lado de "Jogar sem
  conta", e na escolha de personagem. Abre a tela da Arena: classe, tamanho
  do time e código do time.
- **Pela cidade:** NPC **Mestre da Arena**, perto do portão (`abre: "arena"`
  em `city.npcs`), que abre a mesma tela.
- **Time:** quem quer jogar junto digita o **mesmo código de time** (4
  letras, sorteado por quem criou). Sem código, entra sozinho ou é completado
  com quem estiver na fila no mesmo tamanho de time.
- **Saída:** a tela final volta para onde se veio (menu ou cidade, em cima do
  Mestre da Arena).

## 4. A partida

### Mapa

Um mapa **fixo** de 64×64 (`arena.mapa`, mesmo formato de `hunts.<k>.mapa`,
desenhado pelo rascunho de `tools/mapas.mjs` e depois no Remere's Map Editor),
com três zonas:

| Zona | O que tem | Risco |
|---|---|---|
| **Borda** (8 entradas, uma por jogador ou time) | Monstros fracos (ratos, cobras), loot comum | Baixo; é onde se ganha os primeiros níveis |
| **Anel** | Monstros médios, baús, passagens estreitas | Médio; é onde os times se cruzam |
| **Centro** | Os dois Guardiões, o melhor loot e os 3 portais de saída | Alto; todos convergem para cá |

A força dos monstros vem só da zona (pilar 1). Nada escala com o tamanho do
time.

### Relógio (10 min)

| Tempo | Evento | Aviso |
|---|---|---|
| 0:00 | Cada time nasce na sua entrada | "A arena está aberta" |
| 3:00 | Nasce o 1º Guardião da Arena no centro | "Um Guardião desperta no centro" |
| 5:00 | O 1º anel externo desaba (dano por segundo em quem estiver nele) | "A borda está desabando" |
| 6:00 | Nasce o 2º Guardião, com loot melhor | |
| 7:00 | Abrem os 3 portais de saída no centro; 2º anel desaba | "Os portais estão abertos" |
| 9:00 | Último anel; só o centro fica de pé | "Falta 1 minuto" |
| 10:00 | Tudo desaba: quem não extraiu morre | "A arena desabou" |

Os anéis são **por distância de sqm ao centro**: dano em quem estiver fora
do raio, sem contar paredes. Fácil de conferir na regra e de desenhar como
uma sombra no chão e no minimapa.

### Progressão dentro da partida

- Nível 1 ao nascer, com o kit base da classe (arma, poção, uma habilidade).
- **Curva rápida e própria** (`arena.xp`): cerca de nível 10 em 8 minutos de
  caça boa. Os espaços de habilidade abrem pela tabela da Arena
  (`arena.slots`, por exemplo, níveis 1, 3, 5 e 8), e as habilidades vêm
  sozinhas ao abrir o espaço: não há Mestre de magias na partida.
- O loot é vestido na hora pela Mochila, como já é na caçada.
- Matar outro jogador dá o XP de um monstro do anel, mais o que ele largou.

### PvP

- Dano entre times sim, dentro do time não.
- **Dano de jogador em jogador pela metade**, como no PvP do Tibia, para a
  luta não acabar num golpe (`arena.pvp.dano`, 0,5).
- Quem morre larga **a mochila e o que está vestido** no chão, no sqm onde
  caiu, para qualquer um pegar.
- Time inteiro morto: a partida acaba para ele. Membro morto com o time vivo
  assiste ao time (a câmera segue um companheiro).

### Extração e placar

- Parado 2,5 s num portal aberto (o mesmo `EXT` de hoje), sai com a mochila.
- Pontos = valor do que saiu (preços de `items`) + 100 por abate de jogador
  + 300 por Guardião. Morreu, zero.
- Tela final: tempo, nível alcançado, abates, pontos, a colocação na partida
  e **Nova partida**.
- Guarda no aparelho só a estatística da Arena (`save.arena`: partidas,
  extrações, abates, melhor pontuação). O campo é novo e entra pelo
  `Object.assign` sem apagar nada; mesmo assim, é mudança de formato do save
  e precisa de save de referência novo em `tools/saves/`.

## 5. Como fica no código

A base já existe: a **incursão com relógio** (`RUN`, `PORTAL_AT`, "A masmorra
está desabando", `finish('desabou')` em `src/sim/incursao.js`), que saiu do
jogo principal e ficou só nos testes, é o esqueleto da partida da Arena. A
sala com anfitrião (`src/sala.js`), a herança e o retrato já levam vários
jogadores.

| Onde | O quê |
|---|---|
| `data/game/content.json` | Bloco novo `arena`: `mapa`, `spawn` por zona, `fases` (tempos e eventos), `aneis` (raios), `xp`, `slots`, `kit` por classe, `pvp`, `pontos`, `max` (8) |
| `src/sim/arena.js` (novo) | A regra da partida: `novaArena(semente, fichas)` (chama `newRun` com o mapa da Arena), fichas temporárias por `novoChar()` sem tocar no `save`, fases, anéis, pontos. Uma seção com fronteira clara: tudo que só existe na Arena |
| `src/sim/combate.js` | Dano de jogador em jogador (`G.time` de cada um, `arena.pvp.dano`); hoje o tiro só acerta monstro. O caminho é o mesmo que a F2 vai usar, sempre por `podeAtacar()` |
| `src/sim/incursao.js` | `G.arena` liga o relógio da Arena no lugar do `RUN`; morte larga a mochila no chão em vez de sumir |
| `src/sala.js` | Canal `sala-arena-<cópia>`, lobby com times e contagem, início quando 8 entram ou depois de 60 s com pelo menos 2 |
| `src/telas.js` | `showArena()` (classe, time, código), tela final da Arena, botão no menu e na escolha de personagem, NPC `abre: "arena"` |
| `src/desenho.js` | Sombra dos anéis que desabam no chão e no minimapa; cor por time no boneco |
| `src/nuvem.js` | Eventos `arena_inicio` e `arena_fim` na telemetria (a tabela aceita evento novo por arquivo `tools/supabase/NNN`) |
| `tools/testar.mjs` | Na simulação no Node: a mesma semente dá a mesma partida; o anel mata quem fica fora; a extração conta pontos; PvP só entre times; **o save principal não muda** depois de uma partida. No Chromium: casos `arena-menu`, `arena-cidade` e `arena-dois-times` |

**Capacidade:** a sala de 4 de hoje faz ~40 envios por segundo no canal,
contra o limite de ~100 do Realtime grátis. Com 8 jogadores, deve passar
perto do limite: a primeira etapa multijogador mede com clientes de carga,
como em 19/10, e corta o retrato para 8 por segundo se precisar. Mais de 8
pede o servidor da F2.

## 6. Etapas (cada uma cabe numa execução, abaixo de ~400 linhas)

| Etapa | Entrega | Pronto quando |
|---|---|---|
| **A0 · Decisões** | Leonardo decide a seção 2, muda e assina a Parte 1, registra na Parte 6 | A assinatura bate e o item entra no `ROADMAP.md` |
| **A1 · Partida solo na simulação** | `src/sim/arena.js`, o bloco `arena` no conteúdo (mapa rascunho), fases, anéis, curva, pontos | A simulação no Node joga uma partida inteira, desaba no fim e não muda o save principal |
| **A2 · A Arena na tela, sozinho** | Botão no menu, Mestre da Arena na cidade, `showArena()`, tela final, sombra dos anéis | Testador entra pelo menu e pela cidade, joga 10 min sozinho e vê o placar (casos no Chromium) |
| **A3 · Vários times** | Canal da Arena, lobby com código de time, até 8 jogadores, medição de capacidade | Dois aparelhos de times diferentes na mesma partida; a carga medida fica no diário |
| **A4 · PvP e loot do caído** | Dano entre times, mochila no chão, câmera do morto seguindo o time | Caso com dois times em que um mata o outro e pega a mochila |
| **A5 · Medir** | Telemetria `arena_*`; depois, se decidido, ranking no banco | O painel mostra partidas, taxa de extração e duração por testador |

**Primeira versão para os testadores: depois da A3.** A A4 é o que eles mais
pediram, mas a A3 já mostra se a partida curta prende.

## 7. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| A Arena engole o jogo principal: os testadores só querem ela | Alto | É um dado, não um defeito: a telemetria separa os modos. Se acontecer, a decisão de produto é do Leonardo, com número na mão |
| Escopo: são 6 etapas e roubam a fila da F1 (queda de conexão, ritmo, morte B) | Alto | A1 e A2 são baratas e reaproveitam o código; o Leonardo decide em que lugar da fila a Arena entra |
| Realtime grátis não aguenta 8 | Médio | Medir na A3; cair para 6, ou retrato mais lento |
| Anfitrião trapaceia | Baixo | Nada de valor sai da Arena (A1); o placar do aparelho não vale prêmio |
| Iniciante massacrado pelo veterano | Baixo | Todos nascem no nível 1 a cada partida; só a habilidade do jogador conta, que é o que a Arena quer medir |
| Duas mãos no celular com PvP | Médio | A mira manual já existe; testar a luta entre jogadores em 360×640 na A4 |

## 8. Como saber se deu certo (com os testadores)

- **Partidas por testador por semana** e **taxa de quem joga uma segunda
  partida logo depois da primeira**.
- **Taxa de extração** (alvo inicial: entre 30% e 50%; muito acima, a Arena
  está fácil; muito abaixo, frustrante).
- **Duração real** (quem morre cedo sai em quanto tempo?).
- **Pergunta direta depois de 1 semana:** Arena, caçada, ou as duas?

Se depois de duas semanas a Arena não tiver segunda partida em pelo menos
40% das sessões, ela não prende: congela na A3 e a fila volta à F1.
