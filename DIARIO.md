# Diário de execuções — Fibula

Uma entrada por execução, mais recente no topo, máximo 20 — ao passar de 20,
apague a mais antiga.

Formato de cada entrada, que é o que o ciclo automático já produz:

- `## AAAA-MM-DD HH:MM UTC`
- **Item desenvolvido:** o que saiu, com o commit ou o PR
- **Validação:** como foi testado (`SINTAXE_OK`, harness headless, teste manual)
- **Análise:** o que a leitura do código revelou nesta passada
- **Roadmap:** o que mudou de seção e por quê
- **Pendências e riscos:** o que ficou torto
- **Próximo passo recomendado:** para a execução seguinte

Das sete partes, **Pendências e riscos** é a mais útil: é o que a próxima
execução precisa saber e não vai descobrir lendo o código.

---

## 2026-10-19 01:55 UTC — sessão manual (nuvem)

**Item desenvolvido:** a masmorra da sala sem tempo, com porta (0.15.0), a pedido do Leonardo ("entrada e saída por uma porta acessível por qualquer usuário; fecha quando quem criou fecha na cidade ou sai do programa"), com as três escolhas dele: sem tempo, monstros renascem, porta na sala de entrada. Modo "masmorra aberta" em `src/sim/incursao.js` (`newRun(s,fichas,true)`, `entra()`, `repovoa()`, `progression.respawn` no `content.json`); `src/sala.js` troca o "começar com o grupo" por `entraPorta()`/`porta`; o Guia de caça mostra quem está na masmorra e o botão "Entrar pela porta"; a presença da cidade segue com `longe` enquanto o anfitrião caça, para a sala não sumir da lista.

**Validação:** `node tools/testar.mjs` — 27/27; os dois casos da sala reescritos para o fluxo novo (entrar, sair, voltar a entrar, anfitrião entrando depois, masmorra que não desaba, fechar com gente dentro). No Node: não desaba depois do tempo da solo, quem entra não sai sem querer pela porta, a sala repovoa em 60 s e não repovoa com jogador perto, sair pela porta guarda o saco e entrar de novo dá jogador novo. Quatro sabotagens barradas. Dois Chromium no Realtime de verdade, duas rodadas verdes: B entra sozinho com o anfitrião na cidade, anda e é visto, o anfitrião entra depois, B sai com o saco e volta, o anfitrião sai e fecha a sala, B volta à cidade. Tela conferida em 360×640.

**Análise:** a masmorra da sala nasce com o grupo de um (o anfitrião), então tem menos monstros que antes na largada (~40 contra ~66 com dois); o respawn sobe o normal de cada sala com quem está dentro. Com a porta na entrada e sem tempo, o risco da sala é só o caminho de volta com o saco cheio.

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono, PRD 15.1). `Agora` continua "sair cedo", que agora vale só para o solo.

**Pendências e riscos:**
- **Conflito com o pilar das partidas curtas**, aceito pelo Leonardo: na sala não há pressão de tempo; o solo continua com 6 minutos. Medir no playtest se a sala virou farm sem risco.
- O anfitrião continua não podendo deixar o jogo em segundo plano: a masmorra congela para quem está dentro, e em 12 s eles voltam sem resultado.
- O anfitrião não troca de personagem com a sala aberta (trocar fecha a sala).
- A masmorra do anfitrião roda sem parar enquanto a sala existir; com a aba aberta horas, `G.t` cresce sem limite (inofensivo) e os cadáveres ficam capados em 60.
- O Guardião renasce também: matar o chefe e esperar 60 s longe dele é farm. Se pesar, `progression.respawn` ganha um tempo próprio para o chefe.

**Próximo passo recomendado:** o Leonardo testar com um amigo: entrar em momentos diferentes, sair e voltar, e dizer se a sala sem tempo ficou boa; depois, "Sair cedo" (`Agora`).

---

## 2026-10-19 01:38 UTC — sessão manual (nuvem)

**Item desenvolvido:** caçar junto (0.14.0), opção C do plano do multiplayer, a pedido do Leonardo ("criada na opção de entrar na masmorra na cidade; cada usuário pode criar uma sala; ela fica aberta até ele sair do jogo ou fechar"). Módulo novo `src/sala.js` (canal do Realtime por sala); seção "Caçar em grupo" no Guia de caça (criar, ver as abertas, entrar, sair, fechar); `retrato()`, `aplicaRetrato()` e `assiste()` em `src/sim/incursao.js`; `confereFicha()` em `src/sim/progresso.js`; `saida.sai(p)` para a tela final ser de cada jogador; o desenho mostra todos da sala com nome. Mesclada com o andar por sqm (`78b2abf`, sessão paralela) por commit de merge: a posição do convidado passou a ser o sqm, e o anfitrião o leva até lá pela regra (um sqm por passo, na velocidade do nível).

**Validação:** `node tools/testar.mjs` — 24/24, com dois casos novos (`sala-anfitriao`, `sala-convidado`, Realtime falso) e, no Node, o retrato (o convidado vê os mesmos monstros, jogadores e sacos), a `confereFicha()` e o limite de um sqm por passo. Sete sabotagens barradas (teleporte, ficha sem conferir, poção ignorada, retrato puxando quem anda, item falso no save, e duas do retrato). Fora do harness: dois Chromium com saves próprios no **Realtime de verdade**, servindo esta cópia: criar, listar, entrar, caçar juntos (66–71 monstros iguais nos dois), andar e ser visto no sqm exato, habilidade do convidado lançada no anfitrião, extração dos dois com cofre de cada um, sala aberta depois, fechar — quatro rodadas verdes seguidas. Telas conferidas em 360×640.

**Análise:** o teste ao vivo achou um problema que o harness não pegava: com mais de ~100 ms de atraso, o retrato podia mostrar o anfitrião um passo atrás com os dois parados, e o convidado era puxado de volta. Agora só volta quando a diferença dura (3 retratos se longe, 8 se é um sqm com os dois parados). O primeiro retrato de cada caçada atrasava até 5 s (temporizador do "estou vivo" da sala); corrigido.

**Roadmap:** "Caçar junto" em `Concluído`, fora da fila (decisão do dono, PRD 15.1). `Agora` continua "sair cedo".

**Pendências e riscos:**
- **O anfitrião não pode minimizar o jogo**: o navegador para o laço e a caçada congela para todos; 12 s depois os convidados voltam à cidade sem resultado. No celular, atender uma ligação derruba a sala.
- **Só o anfitrião pode trapacear** (é ele quem calcula). Aceito para amigos; não abrir a desconhecidos sem a M2.
- O convidado que fecha o jogo no meio fica parado na masmorra do anfitrião até morrer ou a masmorra desabar; o save dele não muda.
- Entrar numa sala no meio de uma caçada dela deixa o convidado para a próxima.
- Cota do Realtime: com 2 jogadores, ~40 mensagens/s contando entregas; a cota de 2 milhões/mês dá algumas dezenas de horas. Olhar o painel (Usage → Realtime Messages) depois dos testes com amigos.
- Os efeitos que o convidado vê são os principais (dano, magias de área, cadáveres); faíscas e fumaça não vão pela rede.

**Próximo passo recomendado:** o Leonardo testar com um amigo, cada um no seu celular, e dizer se o atraso do convidado incomoda; depois, "Sair cedo" (`Agora`).

---

## 2026-10-19 13:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** equipamento visível no personagem (0.12.0), a pedido do Leonardo. Nova seção "equipamento no corpo" em `src/desenho.js`: `mede()` lê os pixels de cada quadro da classe uma vez (topo, altura, pescoço, mãos e quais pixels do tronco são roupa, pela cor dominante da faixa), `vestido()` guarda em cache o quadro retingido pela armadura, `poeArma()` desenha o sprite do item na mão (atrás do corpo de costas, girando no golpe) e `poeAmuleto()` a pedra no peito. `retrato()` desenha o mesmo boneco em qualquer canvas: o Banco mostra o personagem vestido e gira ao toque. Dados em `items.<k>.veste` (`cor`, `malha`), validados na carga. Rede: a presença leva `eq`, reenviada quando muda no Banco; `poeOutro()` só aceita peça que existe e é daquele espaço. Sem a arte, o desenho em código ganhou a faixa da armadura e a pedra.

**Validação:** `node tools/testar.mjs` — todos os casos, com o caso novo `equipamento-no-corpo` (presença com `eq`, dado de fora conferido, retrato desenhado, giro, troca de armadura e arma mudando o boneco, presença reenviada, golpe na incursão com a arma). Fora do harness: bancada com as 4 classes × 4 combinações × 4 direções e o jogo em 390×740 (cidade e Banco), olhados um a um.

**Análise:** os outfits com máscara de cor e addons existem no OTSP (16–18, 20, 21, 44, 45), mas são cidadãos genéricos; usá-los trocaria a cara das classes. A cor dominante resolve bem o manto dos magos e o aço do cavaleiro; no caçador, couro e pele têm o mesmo matiz, então a couraça pinta também os braços (fica como manga).

**Roadmap:** "Equipamento no corpo" em `Concluído`, fora da fila (pedido do dono). Juntado com a Mochila e a Feira (0.11.0) que entraram em paralelo; o Leonardo autorizou deploy direto na `main` sempre.

**Pendências e riscos:**
- **Arte por código, não por sprite.** A posição da arma vem da borda do boneco na altura da mão, não de um ponto de mão desenhado; em alguns quadros ela fica um pouco solta do corpo. Se o Leonardo quiser acabamento de Tibia, o caminho é um ponto de mão por classe e direção numa tabela de arte (em `tools/sprites.mjs` ou no `atlas.json`).
- No cavaleiro e no caçador de frente, a arma equipada aparece junto da arma que o sprite já segura.
- A cor de cada peça nova precisa de `veste` no `content.json`; sem ela, a armadura não aparece (arma aparece sempre, pelo `it_<chave>`; amuleto usa dourado).
- Presença com `eq` é aberta como o resto da cidade: quem tem a chave pode dizer que veste qualquer peça que existe. Não vale nada, só se vê.

**Próximo passo recomendado:** o Leonardo olhar no celular (Banco e cidade com outra pessoa); depois, "Sair cedo" (`Agora`).

---

## 2026-10-19 04:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** a Feira, mercado entre jogadores (0.11.0), a pedido do Leonardo ("cada player vende para cada player, buy e sell, match"). O Corretor (`city.npcs.corretor`, letra `T`, ao lado do chafariz; sprite OTSP 45) abre a tela `#mkt`. Livro de ofertas por peça de equipamento, compra e venda com preço por peça e quantidade, match automático. Banco: `tools/supabase/003_mercado.sql` — `mercado_ordens`, `mercado_negocios`, `mercado_caixa` e as funções `mercado_livro/anunciar/cancelar/coletar`; `save_gravar` reescrito com a guarda de `mkt`. Cliente: `mercado()` e `temConta()` em `nuvem.js`, `showFeira()` em `telas.js`, `soPecas()` em `progresso.js`.

**Validação:** SQL aplicado duas vezes num Postgres 16 local (idempotente) e exercitado com três contas: match em vários níveis de preço, preço do maker, devolução da diferença ao comprador, taxa de 2% arredondada para cima, caixa e coleta, cancelamento, sem auto-match, `sem_ouro`, `sem_peca`, `sessao`, guarda `mercado` no `save_gravar`, `anon` sem acesso a tabela nem a função auxiliar; soma de ouro conservada (1060 − 5 de taxa = 1055). `node tools/testar.mjs` — 23/23, com o caso novo `feira` (24 asserções; o Supabase falso ganhou as quatro funções e a guarda de `mkt`) e o Corretor no caso `cidade` e na cidade do Node. Tela conferida em 360×740 com Playwright fora do repositório, sem erro de página.

**Análise:** o save continua do cliente, então a única forma de o banco decidir o mercado foi tornar o save **da nuvem** a fonte do cofre e das peças durante a operação: o cliente sobe o save, o banco debita na mesma transação do livro e devolve cofre, peças e `mkt`, que o cliente adota. A outra ponta nunca tem o save reescrito (ela pode estar no meio de uma incursão e sobrescreveria): recebe na `mercado_caixa`, que entra ao abrir a Feira. Um seletor `#mpPreco+` derrubava o grafo de módulos inteiro (todos os casos davam "não reportou em 45000 ms"): `querySelector` estoura com `+` no id.

**Roadmap:** Feira em `Concluído` (antecipada da F3, decisão registrada no PRD 15.1). `Agora` segue "sair cedo".

**Pendências e riscos:**
- Migração 003 **aplicada** em produção pelo conector, em sete partes (`003a`…`003g`), com o Leonardo de acordo. O conector trava (60 s, desfaz tudo) em qualquer migração que contenha `delete`: a caixa agora é zerada por `update`, e o arquivo foi ajustado igual. Conferido depois: RLS ligada nas três tabelas, auxiliares sem acesso de `anon`, API real respondendo `sessao` para token inválido. Os avisos novos do Supabase (funções da Feira executáveis por `anon`, tabelas sem política) são o desenho.
- **Trapaça vira problema dos outros.** Quem editar o JSON do próprio save cria ouro e peças e agora pode gastá-los com jogadores honestos. É a dívida do D-M3: o mercado deixa de ser seguro para abrir a desconhecidos sem cofre autoritativo no servidor.
- Dois aparelhos na mesma conta: se um negociar enquanto o outro está numa incursão, a gravação do segundo é recusada e ele adota a nuvem, perdendo o resultado dessa incursão. Raro, mas real.
- Sem expiração de oferta; limite de 10 abertas por jogador. Ouro preso numa compra não conta no cofre do menu.
- Volume de match serializado num único `pg_advisory_xact_lock`: suficiente para dezenas de jogadores, não para milhares.

**Próximo passo recomendado:** testar com duas contas reais vendendo uma peça uma para a outra, no jogo publicado.
## 2026-10-19 04:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** velocidade do Tibia para jogador e monstros (0.13.0), a pedido do Leonardo ("reduza a velocidade dos monstros e do player para se assemelhar ao Tibia"). `passoDaVel()` em `progresso.js` é a fórmula do Forgotten Server (`Creature::getStepDuration`: 857,36·ln(vel/2+261,29)−4795,01, chão 150, arredondado para cima em 50 ms). Jogador: 220 + 2 por nível, teto 1500 (`progression.walk`, campos novos `speedBase`, `speedPerLevel`, `speedMax`, `ground`); monstros: `spd` agora em unidades do Tibia — rato 134 (900 ms), aranha 200 (600 ms), esqueleto e orc 150 (800 ms), xamã e Guardião 140 (850 ms). Andar à toa: 1,5× mais lento (era 2,5×).

**Validação:** `node tools/testar.mjs` — 23/23. Na simulação no Node: nível 1 = 0,55 s, nível 200 = 0,25 s, velocidade 150 = 0,8 s, buff de 50% = 0,4 s, 2,2 s para leste = 4 sqm. O caso `rato letal` sobe o rato para 400. Os roteiros da cidade andam até chegar, não por tempo fixo. Caçada no Chromium em 360×640 sem erro (Cavaleiro nível 6: 3 sqm em 1,5 s).

**Análise:** do sqm de entrada ao portal são 70 sqm na mediana (52 a 103, 40 sementes, em 4 direções). No nível 1 isso dá ~40 s em linha reta, contra ~18 s no 0.9.0: cabe na incursão de 6 min, mas a masmorra cobre menos. Monstros ficaram mais lentos que o jogador (a aranha, a mais rápida, a 600 ms contra 550 ms do nível 1): fugir ficou fácil, como no Tibia de níveis baixos.

**Roadmap:** sem mudança de fila.

**Pendências e riscos:** **balanceamento a medir** — com monstros mais lentos que o jogador, a morte pode ter ficado rara (pilar 1); se ficar, a alavanca é o `spd` de cada monstro no `content.json`. O `wander` só pede ≥ 1 na validação.

**Próximo passo recomendado:** o Leonardo jogar no celular e dizer se o ritmo agrada; o agente de Balanceamento medir mortes e XP por incursão com a velocidade nova.

---

## 2026-10-19 12:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** botão **Mochila** (0.10.0), a pedido do Leonardo para dar visibilidade ao equipamento. Abre na masmorra e na cidade (`B` no teclado, `Esc` fecha) uma janela sobre o jogo, que **não pausa**: em cima o corpo à moda da janela de inventário do Tibia (amuleto e arma à esquerda, o boneco da classe no meio, armadura e o saco à direita) com o bônus somado; embaixo o saco em grade de container, o mais valioso primeiro, quantidade no canto, borda por raridade, e a linha do pilar 1: "Se morrer, perde X de ouro (o selo guarda Y)". Tocar numa peça diz o que ela é e quanto vale (nada de passar o mouse). Só mostra: vestir, trocar e vender continua no Banco. Código na seção nova `mochila` de `src/hud.js` (`desenhaMochila()`, `abreMochila()`, `fechaMochila()`, `vestido()`, que o Banco passou a usar também); fora dela o toque segue sendo joystick (`.mwin` entrou na exceção de `controles.js`); qualquer troca de tela fecha a janela. De quebra, `icone()` corta o fundo ao sprite quando a caixa é maior: o Cavaleiro (sprite de 32 px) aparecia com os quadros vizinhos do atlas em Personagens.

**Validação:** `node tools/testar.mjs` — 23/23, com o caso novo `mochila` (botão na cidade, corpo vestido, saco vazio em grade, B e Esc, saco semeado na masmorra em ordem de valor, risco com selo, toque numa peça, relógio andando com a janela aberta, tela final fechando). Fora do harness: o jogo de verdade no Chromium em 360×640, 390×844 e 412×915, na cidade e na masmorra, e a tela de Personagens.

**Análise:** em 360×640 a janela tem ~300 px entre o HUD de cima e os botões; com o boneco em duas linhas a grade do saco ficava abaixo da dobra. Em tela baixa (`max-height:740px`) a janela sobe por cima do minimapa e o corpo vira uma linha só.

**Roadmap:** sem mudança (pedido direto do dono, fora da fila).

**Pendências e riscos:**
- A janela cobre o meio da tela: dá para fugir com ela aberta, mas não ver o monstro que chega por cima. Foi escolha (o mundo não espera); se no celular incomodar, a saída é encolher para só o saco durante a caça.
- Vestir uma peça do saco no meio da incursão **não** existe: mexeria em regra (`src/sim/`) e no que a F2 tem de conferir. Se o Leonardo quiser, é um item de roadmap, não um ajuste de tela.
- O botão fica acima da poção, a 94 px do pé: confirmar no celular que não é tocado sem querer ao beber poção.

**Próximo passo recomendado:** o Leonardo abrir a mochila numa caçada no celular e dizer se o tamanho e o lugar do botão estão bons.

---

## 2026-10-19 03:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** andar por sqm em tudo (0.9.0), a pedido do Leonardo depois do estudo do movimento do Tibia. `base.js` ganhou o passo de sqm (`poeNoSqm`, `comeca`, `avanca`, `dir8`, `passoPara`, `DIR8`, `centro`), usado pelo jogador e pelos monstros da incursão, pelo jogador da cidade e pelos outros jogadores da cidade. `progresso.js` tem `durPasso()`; `progression.walk` no `content.json` (validado em `dados.js`). Na incursão: `G.ocu` (bloqueio de corpo), `passoM()`, monstros que descem o fluxo sqm a sqm, contornam por sqm de mesma distância quando perto, atacam do vizinho e o xamã recua um sqm; `move()`, `blocked()` e o empurrão entre monstros saíram; o fluxo parte do sqm do jogador. Rede: `pos` agora é `{id,x,y,d}` em sqm e ms, um por passo.

**Validação:** `node tools/testar.mjs` — 22/22. Na simulação no Node, casos novos: passo do nível 1 = 0,3 s e no teto 0,2 s, buff encurta, nasce no centro do sqm, 1,5 s para leste = 5 sqm e para no centro, quina escorrega, e nenhum par de monstros no mesmo sqm nem no sqm do jogador em 2.400 passos com o jogador andando e lutando; sabotagem (`livreM` sem ocupação) reprovou com "dois monstros no sqm 28,49". Caso `cidade-compartilhada` reescrito para passos (uma mensagem por passo e nada parado, passo animado inteiro, salto quando falta mensagem). Os roteiros `cidade` e a cidade no Node agora andam até o sqm da porta (antes "x < 180", que não existe mais parado). Fora do harness: dois Chromium no Realtime de verdade (B viu A em 15,11, x=496, igual ao A) e uma caçada em 360×640 com rato e aranha cercando o Cavaleiro em sqm vizinhos; nenhum erro de página.

**Análise:**
- Velocidade: 3,3 sqm/s no nível 1 (passo de 300 ms) contra 4 sqm/s do movimento livre — a caminhada até o portal ficou ~20% mais longa. Medir o pilar 4 (arco de 5 a 7 minutos) no próximo playtest.
- O Tibia usa diagonal 3× mais lenta; aqui 1,4×, porque o joystick puxa para a diagonal.
- Os nomes dos monstros são desenhados acima do sqm; com monstros em sqm vizinhos na vertical, o nome de um cai perto do sprite do outro (o sprite do OTSP é desenhado para cima e para a esquerda do sqm, como no Tibia).

**Roadmap:** "Andar por sqm" em `Concluído`, fora da fila (decisão do dono).

**Pendências e riscos:**
- **Balanceamento mexeu sem medida fina.** Kiting, chegada ao portal e dano recebido mudaram (monstro cerca e bloqueia). O agente de Balanceamento deve medir XP por incursão e mortes de novo com a simulação no Node.
- No celular, falta sentir: o joystick só escolhe direção no fim de cada passo (até 300 ms de atraso para virar), como no Tibia. Se incomodar, a saída é aceitar a mudança de direção no primeiro terço do passo.
- O desenho só interpola o jogador deste aparelho na incursão (`G.p`); com o servidor da F2, os outros jogadores vão precisar entrar em `guarda()`/`render()`.

**Próximo passo recomendado:** o Leonardo jogar no celular e dizer se o passo de sqm agrada; depois, "Sair cedo" (`Agora`).

---

## 2026-10-19 03:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** decisões D-M1 e D-M2 do Leonardo registradas (PRD 15.1, plano do multiplayer, `209a079`) e a etapa **M1 do multiplayer** (0.8.2): a simulação com N jogadores. `G.p` virou `G.ps`; cada jogador nasce de uma ficha `{cl, c, up, local}` e carrega entrada, saco, recargas, ganhos e saída (`p.fora`); `newRun(semente, fichas)` e `update(dt, ents)` aceitam vários; tudo em `combate.js` recebe o jogador que age; `stats()`, `eqBonus()`, `manaPraMag()` e afins ganharam parâmetros opcionais (sem eles, o save, como a tela usa). Regras de grupo em `progression.party` (validado na carga). `saida.log/banner/nivel` levam o jogador, e o `main.js` só mostra os do aparelho. Tela final, HUD e desenho leem o jogador (`G.p`), não a sala.

**Validação:** `node tools/testar.mjs` — 22/22. Antes de mexer nos testes, o solo do código novo foi comparado com o do commit anterior (cópia em scratch): quatro classes, com movimento, morte e subida de nível, saída idêntica byte a byte. Bloco novo na simulação no Node: ficha local = solo; 1, 2 e 4 jogadores deterministas a 50 ms e 1/60 s; mais monstros e Guardião ×1,8; drop com vez; dono = quem causou mais dano; extração individual sem fechar a sala; ficha de outro não mexe no cofre. Cinco sabotagens (loot sem vez, extração fechando a sala, dono errado, sem monstros a mais, conta de outro) — cinco barradas.

**Análise:** a regra só lia o save em quatro pontos (`ch()`, `KL()`, `stats()`, `save.up`) e o jogador em `G.p`; os dois patches do harness que dependiam do texto do estado (`bag:{}` e o portal) foram atualizados. A primeira versão do teste de grupo errou por amarrar a entrada roteirizada ao relógio do quadro e não ao passo da regra: entrada por passo é a forma certa, e vai ser a do protocolo da M2.

**Roadmap:** M1 em `Concluído`; `Próximo` voltou a ter três itens (créditos, PWA, Selo). `Agora` segue "sair cedo".

**Pendências e riscos:**
- **Ainda não dá para jogar junto.** A M1 é interna; a tela é solo. Para o Leonardo ver duas pessoas na masmorra falta a M2 (servidor e rede, que pede D2, C6 e C7) — ou um teste local barato (dois jogadores no mesmo aparelho, sem rede), que não está no plano e precisa de decisão dele.
- Item 6 da M1 não entrou: `G.pend` com função e objetos dentro do estado. Pré-requisito do snapshot da M2.
- A ficha do solo aponta para o save (XP sobe e grava no meio da incursão, como antes). O servidor da M2 precisa passar cópias.
- O nível que escala os monstros é o **maior** do grupo: um nível 1 com um 20 enfrenta a masmorra do 20. Escolha minha, a conferir no playtest.
- `drinkPot()` continua sendo chamada fora do `update()` pelo cliente (já era assim): regra fora do passo fixo. Na M2 a poção precisa virar entrada (`ent.pot`).

**Próximo passo recomendado:** o Leonardo decidir como quer testar o co-op (teste local sem custo ou M2 com servidor); enquanto isso, "Sair cedo" (`Agora`).

---

## 2026-10-19 02:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** limite real do Realtime medido, e duas correções na cidade compartilhada (0.8.1). Posição a 5 por segundo (era 8). Erro do canal (`system` com erro, `phx_error`, `phx_close`, resposta de erro) agora fecha o socket e religa: antes, o servidor tirava o cliente do canal sem fechar o socket e o jogo ficava "ligado" e invisível para os outros. O boneco dos outros corre na velocidade de quem anda (132 px/s, ou 5× a distância), para não andar e parar a cada mensagem.

**Validação:** `node tools/testar.mjs` — 22/22. O caso `cidade-compartilhada` ganhou a expulsão pelo servidor (religa sozinho) e mede a taxa pelo tempo de jogo (`C.t0`), porque o laço do roteiro e o do jogo dividem o relógio sintético; sabotagem com envio a 20/s reprovou (11 em 1,2 s). Carga no Realtime de verdade, com clientes no Node, todos enviando no mesmo instante (pior caso): 4 e 8 pessoas a 8/s, 100%; 11 a 8/s, 100%; 13 a 8/s, 92% e expulsão; 15 a 8/s, 86%; 20 a 4/s, 100%; 20 a 5/s, 100%; 18 a 5/s, 86%.

**Análise:** o limite do Free é de **envios por segundo no canal** (~100), não de entregas, como eu tinha suposto na conta de custo. A cobrança mensal, essa sim, conta cada entrega (N+1 por broadcast). Resultado: até ~15 andando juntos funciona de graça; 20 ou mais juntos por horas estoura a cota mensal (2 milhões) e, no Pro, custa centenas de dólares por mês. Para mais de 20 o caminho é o servidor próprio do plano (M2–M4), estimado em US$ 35–80 por mês.

**Roadmap:** sem mudança de fila.

**Pendências e riscos:** o limite exato oscila entre execuções (18 a 5/s perdeu, 20 a 5/s passou): o rate limit do Supabase parece ser por janela, sensível a rajada. Teste com pessoas de verdade, que não mandam no mesmo milissegundo, deve aguentar mais. Cota mensal: o painel do Supabase (Usage → Realtime Messages) mostra o consumo; vale olhar depois do primeiro teste com amigos.

**Próximo passo recomendado:** o Leonardo testar com amigos; depois, "Sair cedo" (`Agora`).

---

## 2026-10-19 01:10 UTC — sessão manual (nuvem)

**Item desenvolvido:** a cidade compartilhada (0.8.0), a pedido do Leonardo ("testar o multiplayer apenas no cenário base de cidade, deixando as caçadas individuais, rodando com o que temos"). Branch `claude/cidade-multiplayer`: parte do `claude/cidade` (0.7.0, ainda fora da `main`), mescla a `main` (passo fixo, 0.6.1) e acrescenta `src/rede.js` (Supabase Realtime por `WebSocket` nativo: presença + broadcast de posição), os outros jogadores em `src/sim/cidade.js` (`OUTROS`, `poeOutro()`, `tiraOutro()`, boneco que corre atrás da posição recebida), o desenho deles com nome em `renderCidade()` (`drawPlayer()` aceita `p.classe`), o contador no HUD da cidade (`#cRede`) e um Realtime falso no prelúdio do harness.

**Validação:** `node tools/testar.mjs` — 22/22. Caso novo `cidade-compartilhada` (22 asserções): liga só na cidade, canal da versão, presença com nome/classe/nível, quem chega aparece e é avisado, boneco anda sem saltar, dado hostil conferido (posição 1e9, classe inexistente, nome de 51 caracteres com controle), no máximo 8 posições por segundo, quem sai some, loja mantém a conexão, caçar desliga e esquece os outros, a volta religa e recebe quem já estava, queda avisa e religa sozinha, menu desliga. Fora do harness: dois Chromium (Playwright de scratch, fora do repositório) no Realtime **de verdade**, 360×640: cada um viu o outro (`2 na cidade`), o B viu o A andar até a posição exata (485,368), e o A viu o B sair ao ir caçar; nenhum erro de página. Screenshot conferido.

**Análise:**
- Realtime com a chave publicável funciona sem configurar nada: canal público, broadcast e presença. Medido antes de escrever código, com dois clientes no Node.
- A mesclagem `claude/cidade` × `main` teve conflito em todos os `?v=`; os imports novos do passo fixo (`TICK`, `passo`) se perderam na primeira resolução e o harness pegou (`TICK is not defined`).
- A identidade é por aba, não por conta: duas abas da mesma conta são dois bonecos. Nome sem conta = nome da classe.

**Roadmap:** a cidade compartilhada entrou em `Concluído`, fora da fila (decisão do dono, registrada na 15.1 do PRD).

**Pendências e riscos:**
- **A `main` ainda não tem a cidade.** Este branch leva a 0.7.0 junto; mesclar na `main` publica as duas coisas. Se a sessão da cidade mesclar a dela antes, este branch precisa de outra mesclagem da `main`.
- Cota do plano Free: 2 milhões de mensagens por mês, contando cada entrega. 4 pessoas andando sem parar a 8/s gastam ~350 mil por hora; para teste com amigos sobra, para abrir ao público não.
- Sem antitrapaça, de propósito: qualquer um com a chave publicável manda posição e nome falsos no canal. Aceitável porque a cidade não tem regra; **nada que valha ouro, XP ou item pode passar por esse canal**.
- Nome de conta aparece para todos na cidade: nome de usuário é público a partir de agora.
- No celular de verdade, falta ver a troca de 4G para Wi-Fi e a tela apagando (o código desliga com a aba no fundo e religa ao voltar).

**Próximo passo recomendado:** o Leonardo testar com duas ou três pessoas no ar (depois de mesclar na `main`) e dizer o que sentiu falta (chat, emote, ver o nível); depois, seguir o `Agora` (sair cedo).

---

## 2026-10-19 00:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** a Cidade (0.7.0), a pedido do Leonardo ("um mapa compartilhado geral chamado Cidade, com casas dos NPCs de mercado, banco e acesso aos mapas de caça"). O menu agora leva à cidade; nela o jogador anda com o mesmo joystick até a casa do Mercador, a do Banco (a antiga tela de Equipamento, que é o cofre da conta) e o Guia de caça no portão sul, que abre a lista de mapas de caça. Mapa em texto (`city.mapa`, uma letra por tile), NPCs e mapas de caça no `content.json`; regra em `src/sim/cidade.js`; `renderCidade()` em `src/desenho.js`; HUD e botão Falar em `src/hud.js`; fluxo em `src/telas.js`. Mesclado sobre a 0.6.0 (morte custando XP), que entrou na `main` em paralelo.

**Validação:** `node tools/testar.mjs` — 21/21 (simulação no Node + 20 casos). Caso `cidade` novo: anda pelo teclado do @ da praça até o Mercador (oeste pela rua, norte pela porta), confere o botão e o rótulo acessível, a frase no registro, o NPC sólido, Enter e o botão abrindo a loja, a volta no mesmo lugar, o Banco, o Guia com nível recomendado, a entrada na masmorra e a volta pelo portão ao lado do Guia. Na simulação no Node: dimensões, NPCs, alcance, chegada pelo portão e cinco conteúdos tortos recusados (linha de tamanho diferente, letra desconhecida, sem @, sem Guia, sem mapa de caça). `sem-arte` passa pela cidade desenhada em código. Screenshots em 360×640 conferidos (praça, casa do Mercador, portão).

**Análise:**
- **"Compartilhado" ainda não é rede.** Ver outros jogadores na cidade é F3 e precisa do servidor (D2, teto de gasto). O que dá para fazer sem servidor foi feito: a cidade é uma só para a conta, e o estado dela é simulação sem DOM, então o servidor vai rodar o mesmo código com N jogadores em `C`.
- O fluxo mudou: acampamento → cidade → Guia → incursão → tela final → cidade. Mercador e Equipamento saíram do menu (agora são casas); Grimório e Personagens ficaram no menu e ganharam botões no alto da cidade. "Nova incursão" na tela final continua entrando direto, para não alongar o ciclo (pilar 4).
- O aviso do preço da morte (pilar 1) também aparece no Guia de caça, que é por onde se entra agora.
- As paredes das casas saem do mesmo `pecas()` da masmorra, com o assoalho fazendo papel de chão; `pecas()` aceita a grade de qualquer tamanho.
- 17 roteiros do harness clicavam em "Entrar na masmorra"; agora chamam `cacar()`, que entra na cidade e fala com o Guia sem andar.

**Roadmap:** a Cidade entrou em `Concluído` (fora da fila, antecipada pelo dono; decisão registrada na seção 15.1 do PRD). "Lugares com nome" agora aponta para o Guia de caça como lugar da escolha. `Agora` segue "Sair cedo".

**Pendências e riscos:**
- **Os mapas de caça ainda são um só.** `hunts` tem só a Masmorra de Runas e `start()` ignora qual foi escolhido; "Lugares com nome" precisa ligar cada entrada de `hunts` à própria tabela de spawn e paleta.
- Atlas subiu de ~205 KB para ~250 KB (dez sprites novos); a primeira carga num 3G ruim fica um pouco mais lenta, mas o jogo não espera o atlas.
- A cidade não tem minimapa; com 24×17 tiles não faz falta, mas uma cidade maior vai precisar.
- O Banco é a tela de equipamento renomeada: não há depósito e saque, porque todo ouro já cai no cofre. Se o banco precisar de função própria (transferir entre contas, guardar acima de um limite), é decisão de design.
- Em tela larga (computador), o mapa inteiro cabe e fica centrado com bordas escuras; em celular a câmera segue o jogador.

**Próximo passo recomendado:** "Sair cedo" (`Agora`); depois, "Lugares com nome", que agora tem lugar natural no Guia de caça.

---
## 2026-10-18 23:55 UTC — sessão manual (nuvem)

**Item desenvolvido:** passo fixo na simulação (versão 0.6.1), etapa M0 do plano do multiplayer, a pedido do Leonardo ("prossiga"). `TICK=0.05` em `base.js`; `passo(dt,ent)` em `incursao.js` acumula o tempo real em `G.acc` e chama `update(TICK)` quantas vezes couber; `efeitos(dt)` (fx e tremor) saiu de `update()` e anda no tempo do quadro, também em `parado()`; `guarda()` grava `x0,y0` (e `w0`, `a0`) antes de cada passo; o `render()` virou interpolação + `cena()`, trocando as posições pelas interpoladas em `G.alfa` e devolvendo depois, sem alocar. O teto do `dt` no `main.js` subiu de 50 para 100 ms (dois passos).

**Validação:** `node tools/testar.mjs` — 20/20. A simulação no Node agora joga com `passo()` e confere a mesma incursão (fim, tempo, abates, XP, saco, monstros) com quadros de 50 ms, 1/60 s e irregulares (16, 17, 33, 100, 4 ms). Sabotagem (`update(dt)` no lugar do acumulador) reprovou: 6 contra 8 abates na mesma semente. **Não houve olho humano no celular**: a sessão de nuvem não tem tela, e a suavidade do movimento a 60 quadros é o que o harness não vê.

**Análise:** os casos do Chromium rodam a 50 ms por quadro, exatamente um passo, então eles nunca exercitam a interpolação (`G.alfa` fica 0 ou 1). Quem a exercita é só o celular de verdade.

**Roadmap:** "Passo fixo na simulação" foi para `Concluído`; `Próximo` renumerado.

**Pendências e riscos:** (1) conferir no celular que o movimento está liso e que o golpe e a caminhada não ficaram aos saltos; o balanço do golpe (`p.swing`) e o tremor não são interpolados, de propósito, e andam a 20 Hz. (2) As habilidades seguradas agora tentam lançar 20 vezes por segundo, não 60: a recarga pode atrasar até 50 ms. (3) Entidade nova que se mexe precisa entrar em `guarda()` e na interpolação do `render()`.

**Próximo passo recomendado:** seguir o `Agora` (sair cedo). A M1 aguarda D-M1 e D-M2.

## 2026-10-18 23:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** plano do multiplayer em `docs/plano-multiplayer.md` (commit `c0bda09`), a pedido do Leonardo: cinco etapas, M0 (passo fixo) a M4 (deploy no Fly.io), com o que trava hoje na simulação, regras de grupo propostas, riscos e decisões do dono. No `ROADMAP.md`, o item "Passo fixo na simulação" (já em `Próximo`) ganhou o passo proposto e a interpolação como parte da entrega; a M1 entrou em `Depois`, aguardando decisão.

**Validação:** só documentos; nenhum código, versão não sobe.

**Análise:** o que mais trava o multiplayer não é a rede, é a simulação supor um jogador: `G.p` único, e `combate.js` lendo e gravando no `save` global (`ch()`, `stats()`, `gainXp()`) no meio da incursão. `G.pend` guarda funções e os monstros guardam a referência `m.t`, então o estado não é serializável.

**Roadmap:** passo fixo detalhado em `Próximo` 1; M1 nova em `Depois`.

**Pendências e riscos:** decisões D-M1 (antecipar M1), D-M2 (regras de grupo) e D-M3 (solo local ou pelo servidor) abertas na seção 7 do plano. O roadmap dizia 1/30 s para o passo, o plano propõe 1/20 s; quem fizer o item escolhe e registra.

**Próximo passo recomendado:** seguir o `Agora` (sair cedo); o passo fixo é o próximo item técnico.

## 2026-10-18 23:05 UTC — sessão manual (nuvem)

**Item desenvolvido:** a morte custa XP e a curva de nível ficou lenta, os dois juntos, a pedido do Leonardo (versão 0.6.0). A curva saiu do código para `progression.xp` do `content.json` (`base` 520, `exp` 0,9, `deathLoss` 0,25), e `validaConteudo()` confere os três. `finish()` tira `perdaXp()` (25% do `xp` do nível, arredondado para baixo, nunca o nível) quando o jogador morre ou fica soterrado; extrair não custa nada. No menu, uma linha nova (`#mRisco`) diz quanto XP está em jogo hoje. Na tela final, a linha "Experiência perdida", e o texto final, que dizia "a experiência foi mantida", foi corrigido. A barra de XP do HUD já lia `c.xp`, então mostra o valor reduzido sem mudar nada.

**Validação:** `node tools/testar.mjs` — 20/20. A simulação no Node confere a perda (morreu 1000→750, desabou 101→76, extraiu 1000→1000, sem descer de nível) e a curva lida do JSON (`xpNeed(1)=520`, `xpNeed(8)=3379`). O caso `morte` confere o aviso no menu antes de entrar (`Hoje: 100 xp.`), a linha própria na tela final, perda = 25% de (400 + ganho), o save reduzido e o menu recontado na volta. `incursao-extracao` confere que extrair não mostra perda. `nivel-na-incursao` foi ajustado para `xp: 3378`. Sabotagem (tirar o `ch().xp-=` do `finish()`) reprovou a simulação e o caso `morte`. Menu conferido em 360×780.

**Análise:**
- **Medição (antes de mexer):** um robô de caça na simulação no Node, 4 classes × 6 níveis × 8 sementes. A masmorra inteira vale ~1.680 de XP (de 1.510 a 1.840), e o robô imortal limpa tudo em 4:30. O robô mortal, que é burro, faz 130–870. Tomei como incursão típica de quem joga bem ~840 (metade da masmorra). Com a curva antiga, isso dá nível 7 em ~2,4 incursões, o que bate com o playtest ("Cavaleiro nível 7 em poucas incursões").
- **O XP por incursão não cresce com o nível do personagem** (só com a profundidade da sala; o HP dos monstros cresce 5% por nível). Por isso uma curva exponencial de verdade faria os níveis altos custarem dezenas de incursões cada, e os 25% da morte passariam de 2 incursões (limite do pilar 1) já no nível ~12. Daí o expoente menor que 1: com 520·L^0,9, o nível 8 chega em ~15 incursões (alvo do roadmap), o 12 em ~34 e o 18 em ~75, e a perda máxima fica ≤ 2 incursões até o nível 17.
- Quem já subiu de nível na curva antiga **continua no nível** (pilar 5). Só o XP que falta para o próximo ficou maior.

**Roadmap:** os dois itens foram para `Concluído` como um só. `Agora` passa a ser "Sair cedo precisa ser uma jogada válida", e o `Próximo` foi renumerado (passo fixo é o 1).

**Pendências e riscos:**
- **Os 840 de XP por incursão são estimativa, não medição de gente.** Se o Leonardo achar a curva lenta demais no próximo playtest, o ajuste é só `progression.xp.base` no `content.json`, sem programar. O que conferir: quantas incursões até o nível 3 (segunda habilidade, ~1,8 previsto).
- **O 4º espaço (nível 18) ficou em ~75 incursões, umas 7–9 horas de jogo.** É Tibia raiz, mas pode ser longe demais para a fase de testadores. Decisão de design do Leonardo.
- Acima do nível ~17 a perda passa de 2 incursões, porque o XP por incursão é fixo. O item "três profundidades" (no `Depois`), com XP maior nas fundas, resolve; até lá, ninguém chega lá.
- Magia e perícia continuam sem perda na morte (o roadmap pediu só o nível). Selo de resguardo (Próximo 4) fica mais urgente agora.
- Um commit paralelo (`c0bda09`, `docs/plano-multiplayer.md`) entrou na `main` durante esta sessão, sem conflito.

**Próximo passo recomendado:** playtest do Leonardo na 0.6.0 (sentir a perda e o ritmo do nível 1 ao 3); depois "Sair cedo", medindo de novo com o robô, já que a morte agora custa mais.

---

## 2026-10-18 23:45 UTC — sessão manual (nuvem)

**Item desenvolvido:** versão 0.5.0 e deploy seguro, a pedido do Leonardo ("atualize as versões e faça o deploy"). `tools/versao.mjs` novo; `?v=0.5.0` no `index.html`, nos 58 imports de `src/` e no `atlas.png`; menu mostra "Protótipo · v0.5.0 · <classe>" (antes "Etapa 3"); tabela "Versões" no README; seção "Versão e deploy" no `CLAUDE.md`.

**Validação:** `node tools/testar.mjs` — 20/20, com `VERSAO_OK` novo e asserção da versão no menu. Sabotagem: um import sem `?v=` em `src/arte.js` → `VERSÃO FALHOU` com o comando que conserta, saída 1. Node conferido antes: o mesmo arquivo com e sem `?v=` vira dois módulos com estados separados — é por isso que o portão exige a mesma versão em tudo.

**Análise:**
- **O risco era real:** o Pages responde `cache-control: max-age=600` em todo arquivo. Com o jogo em módulos, quem recarregasse até 10 min depois de um deploy podia receber o `index.html` novo e módulos velhos (o recarregar revalida a página, não os módulos), e um import ausente deixa a tela preta. Versão no endereço resolve sem build.
- `content.json` e `atlas.json` já iam com `cache:'no-cache'`; o `atlas.png` não, e um atlas velho com o JSON novo recortaria os sprites errado — também levou a versão.
- Deploy continua sendo o push na `main` (Pages publica sozinho). Não há passo extra.
- Branches antigos no GitHub (`docs/prd`, `teste-ci-quebrada`, `auto/bussola-portal`, `claude/…`) não têm nada que falte na `main`; ficaram, apagar é com o Leonardo.

**Roadmap:** versão 0.5.0 em `Concluído`. `Agora` segue a morte custar XP.

**Pendências e riscos:**
- **Toda mudança em `src/` ou no `index.html` precisa subir a versão** (`node tools/versao.mjs`). O harness barra import sem versão, mas não percebe versão esquecida num commit que mudou código; um agente que esquecer reabre o risco do cache por 10 minutos.
- O PWA (item 5) vai trazer service worker; ele passa a controlar o cache e precisa respeitar a mesma versão.

**Próximo passo recomendado:** a morte custar XP (`Agora`), em 0.6.0.

---

## 2026-10-18 23:20 UTC — sessão manual (nuvem)

**Item desenvolvido:** sorteio com semente, item `Agora` (F0 2, primeira metade), a pedido do Leonardo ("fundação e princípio da essência do jogo"). `src/sim/base.js` ganhou o gerador (mulberry32) com `semeia()`, `novaSemente()`, `sementeDe()`, `sorte()`/`rnd()`/`rr()`/`ri()` (regra) e `frr()` (efeito). Todo `Math.random` da simulação saiu: corredor do mapa, banda de monstro, loot, passeio dos monstros. Efeitos (número de dano, faíscas, fumaça, tremor da câmera, direção e passo inicial do desenho do monstro) passaram para o sorteio de efeito. `newRun(s)` aceita a semente e a guarda em `G.semente`; a tela final mostra "Masmorra nº 12.345", e `?semente=` no endereço (número ou texto) repete a masmorra em toda incursão da aba.

**Validação:** `node tools/testar.mjs` — 20/20 (simulação no Node + 18 casos de navegador + os 2 novos). O passo da simulação no Node agora prova: sequência do gerador presa (confere com a implementação de referência do mulberry32), `Math.random` sabotado durante a incursão, mesma semente → mesmo mapa, mesmos monstros e mesmo resultado, sementes 7 e 8 → mapas diferentes, efeitos extras não mudam a regra, efeitos não gastam sorteio da regra (sonda direta + checagem de toda linha `G.fx.push`), sem semente → sementes diferentes. No navegador, `semente-na-url` compara a imagem do canvas de duas incursões com a mesma semente (iguais) e `semente-variada` sem semente (diferentes). Cinco sabotagens via `FIBULA_JOGO` — `Math.random` no mapa, número de dano pelo sorteio da regra, constante do gerador trocada, semente fixa em 1, fumaça pelo sorteio da regra — todas saíram com código 1. A segunda não era pega pela primeira versão do teste; daí a sonda direta.

**Análise:**
- **Regra × efeito** é a decisão de desenho que importa: com um sorteio só, uma tela que desenha mais faíscas mudaria o loot do próximo monstro, e cliente e servidor divergiriam. Critério escrito no `CLAUDE.md`: "se isto mudar, o jogador ganha ou perde algo?"
- A semente de cada incursão ainda vem de `Math.random` (`novaSemente()`), a única exceção permitida e checada pelo teste.
- O mapa e a sala inicial se repetem sempre; a incursão **inteira** só se repete com o mesmo `dt` por quadro (no Node, 0,05 fixo). No celular, o `dt` varia: falta o passo fixo.
- A sequência de sorteios mudou, então as masmorras dos casos antigos mudaram; os 18 casos continuaram passando sem ajuste.

**Roadmap:** sorteio com semente em `Concluído`. `Agora` passa a ser a morte custar XP; o passo fixo é o item 3 do `Próximo`.

**Pendências e riscos:**
- **Passo fixo** (item 3) completa a F0 2; até lá, multiplayer e replay da incursão inteira não fecham.
- Trocar o algoritmo do gerador, a ordem dos sorteios em `genMap()`/`newRun()` ou o critério de `sementeDe()` muda a masmorra de todas as sementes já mostradas a jogadores. Hoje não há nada guardado que dependa disso; quando houver "desafio da semana" ou replay, essas mudanças viram decisão do dono.
- Uma sessão manual publicou o equipamento (`31b5a00`) em paralelo; esta mudança foi feita por cima dele, sem conflito.

**Próximo passo recomendado:** a morte custar XP (`Agora`), depois a curva de nível medida com a simulação no Node, agora com semente de verdade.

---

## 2026-10-18 23:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** equipamento persistente com três espaços (arma, armadura, amuleto) e cofre de peças da conta, a pedido do Leonardo, adiantado do `Depois`. Regra do Leonardo: **cada personagem tem o seu equipamento; o cofre é compartilhado por todos os personagens do login.** Na extração, item com `slot` no `content.json` vai para `save.itens` (raiz, da conta) como peça; o resto vira ouro como antes. Tela nova `Equipamento` no acampamento: três espaços grandes (tocar devolve ao cofre), a lista de peças do cofre com `vestir`/`trocar` e `vender <valor>`, e o total vestido com vida e mana resultantes.

**Validação:** `node tools/testar.mjs` — 18/18. Caso novo `equipamento` (vestir, trocar, devolver, vender, trocar de personagem e ver espaços vazios com o mesmo cofre, bônus em `stats()` na incursão); `incursao-extracao` agora semeia uma espada e confere ouro + peças = valor do saco; `morte` confere que o vestido não cai; a simulação no Node testa `guardaSaco()`, `equipar()`, `desequipar()` e `vender()`. Portão conferido com cópia sabotada (`guardaSaco` mandando tudo para ouro): dois casos reprovaram. Tela conferida em 360×780 no Chromium.

**Análise:**
- Vender paga o `val` cheio do item, o mesmo que a extração pagava antes: quem só vende não perde nada, e quem veste troca ouro por poder. É a decisão "vestir ou vender" que o roadmap pedia.
- Bônus somados: `dano` soma ao `pow` (mesma escala do Poder arcano, aditivo), `red` soma à armadura da classe em `hurtPlayer()` (o teto de 75% continua), `vida` e `mana` entram em `mhp`/`mmp`. Valores atuais: espada +6% de dano, machado +10%, couraça −4% de dano sofrido, cota −8%, amuleto tribal +15 vida e +15 mana.
- Save: campos novos mesclados por `normaliza()`, sem subir a `KEY`; save antigo ganha `itens:{}` e `equip` vazio. Peça que sair do `content.json` some do cofre e do corpo em vez de quebrar a tela. A nuvem grava o JSON inteiro, então não houve mudança no Supabase.

**Roadmap:** "Equipamento persistente com três slots" saiu do `Depois` para `Concluído`. `Agora` (gerador com semente) não mudou.

**Pendências e riscos:**
- **Sprites das armaduras:** resolvidos na mesma sessão (`it_couraca` = id 1998, `it_cota` = id 2034 do OTSP). A primeira versão desta entrada dizia que a nuvem não tinha o pacote, e estava errada: o `tools/sprites.mjs` baixa o OTSP sozinho do GitHub, e isso funciona na nuvem. Para achar sprite novo, rode `node tools/sprites.mjs --catalogo` e procure em `itens.png` (id = 100 + 16 × linha + coluna).
- **Sem exigência de nível nem de classe** para vestir: um Feiticeiro nível 1 veste o machado. Aceitável com bônus pequenos; se entrarem peças fortes, precisa de `lvl` mínimo no item.
- **Balanceamento a observar:** +10% de dano no machado é mais que um nível de Poder arcano (+8%, 150 de ouro). A cota cai em 35% das mortes do Guardião; se sobrar cota no cofre, ela só vira ouro.
- A coroa e a gema continuam sendo só valor (viram ouro). O amuleto tribal, que antes valia 60 de ouro direto, agora pede uma venda manual.
- O cliente ainda grava o save inteiro: editar `itens` no JSON trapaceia, como já era com o cofre.

**Próximo passo recomendado:** avaliar se a Escolha de risco (profundidades) deve multiplicar a chance de peça, que é o que dá motivo para descer mais fundo.

## 2026-10-18 22:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** alinhamento dos guias e decisões do dono num lugar só, a pedido do Leonardo depois do primeiro playtest. PRD 0.4 (estado real em 2, 7.1, 7.5, 9, 10, 11, 13 e 14; seção 15 virou a lista única de decisões, tomadas e pendentes), `CLAUDE.md` (ciclo dos agentes e decisão de testes), `VISAO.md` (fontes), `README.md` (save na nuvem), `docs/agentes/comum.md`, `revisor.md`, `desenvolvedor.md`, `balanceamento.md`. ROADMAP reordenado. Antes disso, correção da CI vermelha da divisão (`14cee97`): `dt` negativo no primeiro quadro em máquina lenta.

**Validação:** CI verde em `14cee97` depois da correção; a falha foi reproduzida localmente atrasando a entrega dos `.js` em 600 ms (mana 76/95 e relógio 0:23 no código antigo, verde no novo). Commit desta entrada só de documentação.

**Análise:**
- **Decisões do Leonardo (18/10):** apagar os agentes duplicados; com o ciclo ligado, modo `direto` (CI como alarme); 4 espaços de habilidade, não 3; testes ficaram a critério da sessão — escolhido o harness único sem `package.json`, TypeScript ou Playwright como biblioteca, a reavaliar na F2. Tudo registrado na seção 15 do PRD.
- **Agentes duplicados:** havia 2 Desenvolvedores, 2 Revisores e 2 Balanceamentos ativos (um conjunto das 19:59, na sessão fixa de cada agente, e outro das 20:29). Os 3 das 20:29 foram apagados; ficou uma tarefa por papel. As duas rotinas antigas seguem desligadas.
- **Playtest e Supabase:** a conta `leo` tem 8 incursões (2 extrações, 3 mortes), Cavaleiro no nível 7. O Cavaleiro "já começou no 6" porque a conta nova, sem save na nuvem, herdou o save que o navegador do celular já tinha: é a regra de primeira entrada (PRD 7.5), não cache. O mesmo dado mostrou a curva de nível rápida demais (1.286 de XP até o nível 6; Guardião dá ~300) — virou o item 2 do `Próximo`.
- Contradições resolvidas: rotina de 2 h no `CLAUDE.md` × 4 agentes; issues `pronta` no PRD × ROADMAP nos agentes; `tsc`/Playwright/`package.json` no PRD × harness único; 3 × 4 espaços; regra de fases × login antecipado; e-mail/Google × usuário e senha; Google Fonts citado como dependência depois de sair.

**Roadmap:** `Agora` segue o gerador com semente. `Próximo` reordenado: morte custa XP, curva de nível (novo), sair cedo (subiu de `Depois`), passo fixo (novo, F0 2), créditos, PWA (saiu de `Outros`), Selo.

**Pendências e riscos:**
- **`modo.txt` continua `pausado`.** Só o Leonardo religa (D6 do PRD); ao religar, o modo é `direto`.
- **Conta de teste `teste_claude_tmp`** no banco (sem uso). O conector não apaga dados; remover pelo painel do Supabase → `jogadores`.
- D5 (modelo de cada agente): as tarefas estão com o modelo padrão; decidir ao religar.
- A regra de primeira entrada copia o save do aparelho para a conta nova. Com testadores de fora num aparelho compartilhado, a conta nova herda o progresso de outra pessoa. Avaliar antes de convidar testadores.

**Próximo passo recomendado:** Leonardo religa o ciclo (`direto`) quando quiser; o Desenvolvedor pega o gerador com semente, e o item de jogo seguinte é a morte custar XP.

## 2026-10-18 22:10 UTC — sessão manual (nuvem)

**Item desenvolvido:** divisão do `index.html` em módulos ES, decisão do Leonardo (opção A). F0 item 1 do PRD. O `<script>` saiu do `index.html` (de 1629 para 339 linhas, só estilo e markup) para `src/` (cliente: `main`, `salvar`, `nuvem`, `arte`, `desenho`, `hud`, `telas`, `controles`, `dom`) e `src/sim/` (simulação: `base`, `dados`, `progresso`, `mapa`, `incursao`, `combate`). Código movido sem mudar regra; o jogador não vê diferença.

**Validação:** `node tools/testar.mjs` — 17/17: sintaxe dos 15 módulos, o passo novo "simulação no Node" (incursão inteira de 6 min, 7200 quadros, sem navegador, mesma semente dá o mesmo resultado) e os 16 casos de navegador de antes, sem mudar nenhum roteiro. O portão foi conferido com três cópias sabotadas via `FIBULA_JOGO`: erro de sintaxe num módulo, `save.cofre+=G.bagVal` removido e `document` dentro de `src/sim/` — as três saíram com código 1. Jogo aberto em 390×780 no Chromium: menu e incursão com sprites, sem erro no console.

**Análise:**
- **A fronteira:** `src/sim/` não toca em DOM, `localStorage`, canvas nem temporizador. O que antes era chamada direta (`log()`, `banner()`, `montaBotoes()`, `persist()`, `setTimeout(showEnd)`) virou o objeto `saida` de `src/sim/base.js`, preenchido em `src/main.js`. A entrada (joystick, teclado, botões seguros) chega em `update(dt, ent)`. O `prefers-reduced-motion` passou do `shake()` para o `render()` — mesmo efeito para o jogador.
- **Estado compartilhado:** `G` e `save` são `export let` com `setG()` e `setSave()`, porque módulo ES não deixa reatribuir binding importado. Mexer em campo (`save.cofre+=…`) segue igual em qualquer lugar.
- **Ciclo de import que quebrou na carga:** `salvar.js`↔`nuvem.js` dava `Cannot access 'KEY' before initialization`. A nuvem agora se registra com `aoGravar()`; regra registrada no `CLAUDE.md`.
- **Harness:** módulo ES não carrega em `file://`, então as cópias passaram a ser servidas pelo mesmo servidor HTTP que já recebia o resultado; o `fetch` falso de `content.json` e `atlas.json` saiu (cada cópia leva os arquivos reais). Patches procuram em todas as fontes. O roteiro é um módulo que importa `./src/main.js`, para só começar depois do `await` do conteúdo.
- Código morto removido: `BARRAS` (nunca lido). `podeLancar()` ficou, exportado, sem uso.

**Roadmap:** divisão em `Concluído`. O item `Agora` (gerador com semente) perdeu a ressalva de esperar a divisão e aponta para `src/sim/base.js`. PRD (seções 2, 10, 13.5, 13.6), `comum.md` seção 3, `desenvolvedor.md` e `produto.md` atualizados: a restrição de "mudanças pequenas no `index.html`" caiu.

**Pendências e riscos:**
- **Passo fixo:** a simulação ainda roda no `dt` do quadro (até 50 ms). Para o servidor da F2 falta o passo fixo — item 2 da F0, junto do gerador com semente.
- **Efeitos visuais ainda gastam `Math.random`** dentro da simulação (`num`, `spark`, `kill`). Quando o gerador com semente entrar, separar o aleatório de regra do aleatório de efeito, senão cliente e servidor divergem por causa de partícula.
- O `tools/serve.ps1` precisa entregar `.js` como `text/javascript` (já entrega); servidor estático que mande outro tipo faz o módulo não carregar.
- A entrada anterior deste diário está marcada 23:30 UTC, depois desta: relógio da outra sessão, não ordem real.

**Próximo passo recomendado:** gerador com semente em `src/sim/base.js` e passo fixo no `update()`, aproveitando o teste da simulação no Node, que já compara duas execuções.

## 2026-10-18 23:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** arte e layout do Tibia, a pedido do Leonardo ("puxar e alterar a parte de layout e de arte para ficar igual à do Tibia"). Cobre o item `Agora` (pipeline OTSP) e vai além do que ele dizia: o desenho foi trocado de fato. Arquivos novos: `tools/sprites.mjs`, `assets/otsp/` (atlas.png, atlas.json, LICENSE.txt, AUTHORS.md), `assets/CREDITOS.md`. Mudados: `index.html` (seção nova `arte`, `pecas()` no mapa, `render()`, CSS das telas e do HUD), `tools/testar.mjs` (atlas no prelúdio, casos `arte` e `sem-arte`).

**Validação:** `node tools/testar.mjs` — 16/16, sintaxe OK, rodado de novo depois do merge com o login por usuário e senha. `node tools/sprites.mjs` duas vezes deu o mesmo MD5 do atlas. Telas conferidas em 390×844 com DPR 2 no Chromium (menu, escolha de classe, incursão com combate, portal aberto).

**Análise:**
- **Por que o .dat/.spr e não as folhas PNG:** as folhas do pacote são despejo do `.spr` em ordem de id, sem dizer qual peça de 32 px é de qual criatura, direção ou quadro. O `.dat` diz; o script monta criatura de 64 px, 4 direções e quadros de caminhada sem recorte à mão. O `.spr` já traz transparência, então não há magenta a converter. Desvio consciente da regra 1 da seção 9 do PRD ("copiar as folhas usadas"): o repositório guarda só o atlas gerado (205 KB) e o script baixa o pacote no commit fixado — copiar o `.spr` (9 MB) não faria sentido.
- **Escolhas de sprite** (tabela `ARTE` no script): Feiticeiro = mago vermelho (15), Druida = mago verde (33), Caçador = caçador de couro (19), Cavaleiro = guerreiro de armadura (3); Rato = roedor (6), Aranha = besouro verde (8, o pacote não tem aranha), Esqueleto = criatura de ossos (22), Orc = goblin com tocha (7), Xamã = encapuzado com tocha (4), Guardião = demônio grande (46). Chão de terra (140), paredes de tijolo cinza (534–537), portal = poço de pedra (1122) com o brilho de teletransporte (efeito 2). O pacote tem só 15 efeitos úteis: energia, sagrado e terra são o brilho azul e a nuvem com o matiz girado no script.
- **Paredes:** peça por bloco sólido em `pecas()`, com a regra de encaixe do Tibia (vertical, horizontal, poste no canto de cima à esquerda, canto onde a horizontal do oeste encontra a vertical do norte). O `render()` desenha linha a linha, parede e depois criatura, então a parede de baixo cobre o pé de quem encosta nela, como no Tibia. Testei também a rocha de montanha (956–961): fica bonita, mas cobre uma linha inteira de chão e esconde monstro — descartada por legibilidade no celular.
- **Fontes:** o Google Fonts saiu. Verdana (a fonte do cliente do Tibia) no corpo e Palatino nos títulos, do sistema. No Android sem Verdana cai na sans do sistema.
- Cadáver de cada monstro fica no chão (até 60, o mais antigo some). O saco de loot aparece ao lado quando há loot.

**Roadmap:** item `Agora` em `Concluído` (com o que foi além); "Cortar a dependência de fontes externas" saiu de `Depois`. `Agora` virou o gerador com semente; entrou em `Próximo` a tela de créditos no jogo.

**Pendências e riscos:**
- **Créditos dentro do jogo:** a CC BY 4.0 exige atribuição; hoje está em `assets/CREDITOS.md` e no README. A seção 9 do PRD pede tela no jogo — virou o item 1 de `Próximo`.
- **Dois caminhos de desenho:** com e sem atlas. Quem mexer no `render()` precisa manter os dois ou o `sem-arte` quebra. Se um dia o atlas for obrigatório, apagar o caminho antigo encolhe o arquivo em ~120 linhas.
- **Nomes x sprites:** "Aranha" é um besouro e "Orc" é um goblin, porque o OTSP não tem aranha nem orc. Se incomodar, renomear no `content.json` é decisão do Leonardo.
- O `index.html` foi a 1629 linhas; o limite combinado para discutir divisão é ~2000.
- O PWA (outra metade do F0 item 6) precisa pôr `assets/otsp/atlas.*` no cache do service worker.

**Próximo passo recomendado:** tela de créditos (pequena, fecha a atribuição) ou o gerador com semente, que está em `Agora`.

---
