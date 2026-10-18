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

## 2026-10-18 22:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** login simples com usuário e senha, sem e-mail, no lugar do link mágico, a pedido do Leonardo ("fase de teste, qualquer usuário, qualquer senha"). Banco: migração `login_simples` (`tools/supabase/002_login_simples.sql`), aplicada pelo conector. Jogo: seção `conta e save na nuvem` reescrita, com campos de usuário e senha e os botões Entrar e Criar conta.

**Validação:** `node tools/testar.mjs` — 14/14, sintaxe OK. O caso `nuvem-entrar` foi refeito: campo vazio, senha errada, usuário repetido sem diferenciar maiúscula, conta nova, sessão guardada sem a senha, leitura e gravação com o token. Contra o banco real, por `curl` com a chave publishable: criar, duplicar (recusado), senha errada (recusada), entrar, ler vazio, gravar, ler, token falso (recusado), leitura direta das tabelas (recusada), função auxiliar (recusada), sair (token morto). O CORS a partir de `llmannrich-ai.github.io` está liberado. Menu conferido em 360 px.

**Análise:**
- O login não usa o Supabase Auth: são cinco funções `security definer` que conferem senha (bcrypt via `pgcrypto`) e token (o banco guarda só o sha256). As tabelas ficam fechadas para `anon`. Os avisos do Supabase sobre "função executável por anon" e "RLS sem política" são o desenho, não um furo; está explicado no `CLAUDE.md`.
- A sessão guardada do login por e-mail (formato antigo, sem `tk`) agora é apagada do aparelho ao abrir o jogo. O teste novo pegou que ela só era ignorada.
- O `save.dono` mudou de espaço de nomes: antes era o id do Supabase Auth, agora é o id de `public.jogadores`. Um aparelho ligado ao login antigo é tratado como "de outra conta" e adota o que estiver na nuvem.

**Roadmap:** sem item novo; é ajuste do save na nuvem, já em `Concluído`.

**Pendências e riscos:**
- **Sem limite de tentativas e sem recuperação de senha.** Aceito para a fase de teste. Antes de abrir para desconhecidos, voltar ao Supabase Auth ou pôr limite de taxa.
- **Conta `teste_claude_tmp` ficou no banco** (senha `1`, sessões encerradas, save `{"cofre":42}`). O `execute_sql` do conector expira em `delete`; apagar no painel (Table Editor → `jogadores`).
- A tabela `public.saves` (login por e-mail) ficou sem uso. Não apagar sem decisão do Leonardo.
- O PRD 7.5 ainda diz "link mágico e Google"; a troca é temporária e precisa voltar para lá ou o PRD mudar.

**Próximo passo recomendado:** Leonardo cria uma conta no celular e confere o "Progresso salvo na nuvem"; o ciclo segue no pipeline de sprites OTSP.

---

## 2026-10-18 21:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** revisão e mescla na `main` do save na nuvem (branch `claude/fibula-supabase-connection-1d3e9b`, feita na sessão do computador). Na revisão, uma correção no `puxa()` do `index.html` e o caso `nuvem-outra-conta`.

**Validação:** `node tools/testar.mjs` — 14/14, sintaxe OK. O caso novo falhou contra o código da branch (leu cofre 777 no lugar de 30) e passa com a correção. Banco conferido pelo conector: `public.saves` com RLS ligada, migração `saves` aplicada, nenhum aviso de segurança. Só a chave publishable está no código.

**Análise:**
- **Perda de dados ao trocar de conta no mesmo aparelho.** Na primeira entrada de uma conta, vencia o save com mais incursões. Se o aparelho tinha o save da conta A (`dono` = A) e alguém entrava com B, o save de A, com mais incursões, sobrescrevia o de B na nuvem. Agora, quando o `dono` local é outra conta, vence sempre a nuvem.
- Sem save na nuvem para B, o save local de A ainda é copiado para B. É cópia, não perda; mantido de propósito para não apagar progresso que ainda não subiu.
- O conflito entre aparelhos já ligados usa `save.em`, o relógio do cliente. Relógio errado num aparelho pode fazer o save mais antigo vencer. Aceitável para os testadores; resolver de verdade é do servidor.
- O `CLAUDE.md` da branch dizia que o conector do Supabase não enxergava o projeto. Deixou de ser verdade quando o Leonardo o religou à organização "Versa" (Free); o texto foi corrigido.

**Roadmap:** o save na nuvem entrou em `Concluído`, marcado como antecipado da F1. `Agora` continua o pipeline de sprites OTSP.

**Pendências e riscos:**
- **Configuração do Auth no painel, com o Leonardo:** Site URL e Redirect URLs com `https://llmannrich-ai.github.io/Fibula/`. Sem isso o link mágico pode voltar para o endereço errado.
- **E-mail:** o SMTP padrão do Supabase só entrega para membros da organização. Testadores de fora não recebem o link até existir SMTP próprio.
- **Trapaça:** o cliente grava o save inteiro. A RLS só impede mexer no save de outra pessoa.
- O link mágico precisa ser aberto no mesmo aparelho em que foi pedido (o token volta no `#hash` da URL).

**Próximo passo recomendado:** Leonardo configura o Auth e testa o login no próprio celular; o ciclo segue no pipeline de sprites OTSP.

---

## 2026-10-18 21:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** conserto da CI vermelha na `main` desde `bb2143e`. Só `tools/testar.mjs` (e uma linha do `CLAUDE.md`); o `index.html` não mudou.

**Validação:** `node tools/testar.mjs` — 10/10 casos, sintaxe OK, no Chromium de `/opt/pw-browsers`. Cópia com `save.cofre+=G.bagVal` removido via `FIBULA_JOGO`: `incursao-extracao` falhou e a saída foi 1, como devia.

**Análise:** o merge do conteúdo externo com o harness deixou três quebras que nenhum dos dois lados via sozinho:
1. O marcador do `<script>` procurava `(()=>{`, mas o IIFE virou `(async()=>{` com o `content.json`. A suíte parava antes de rodar qualquer caso.
2. O `fetch` falso do prelúdio devolvia o `content.json` para **qualquer** URL, inclusive o `POST` do resultado para o coletor. Todo caso morria com "o roteiro não reportou". Agora só a URL do `content.json` é interceptada.
3. O patch "rato letal" procurava a tabela `MT` no `index.html`, que saiu para o `content.json`. Virou ajuste de conteúdo: campo `conteudo` no caso, função `ajusta()` que estoura se o valor esperado não estiver lá (mesmo princípio dos patches de texto).

**Roadmap:** sem mudança; `Agora` continua o pipeline de sprites OTSP.

**Pendências e riscos:**
- Mudanças no `content.json` que alterem `enemies.rato` quebram o caso `morte` de propósito; ajuste o `A.ratoLetal` junto.
- A CI só ficou vermelha porque cada lado foi testado antes do merge, não depois. Quem mesclar `main` com trabalho paralelo precisa rodar `node tools/testar.mjs` **depois** do merge.
- Supabase (F1) ainda não tem projeto do Fibula na conta; nada foi criado.

**Próximo passo recomendado:** pipeline dos sprites OTSP, como estava.

---

## 2026-10-19 00:20 UTC — Desenvolvedor

**Item desenvolvido:** aviso de falha do save. `index.html`: variável `saveFalhou`, sonda de gravação na carga, `persist()` marca a falha, faixa `#mAviso` no menu (+7 linhas). `tools/testar.mjs`: opção `bloqueiaSave` no caso e dois casos novos.

**Validação:** `node tools/testar.mjs` — 10/10 casos, sintaxe OK. O caso `save-bloqueado` falha contra o `index.html` anterior (confirmado com `FIBULA_JOGO`) e passa com a mudança. Save sem alteração de formato.

**Análise:**
- O teste da migração v1→v2 já existia (`migracao-save`, 20 asserções); não dupliquei.
- A sonda grava e remove uma chave auxiliar (`masmorra-runas-v2-sonda`) na carga, porque `persist()` só roda depois de uma incursão e o menu abriria sem aviso para quem já nasce bloqueado.
- Navegador que lança no `getItem` (não só no `setItem`) também cai na sonda.

**Roadmap:** item em `Concluído`; pipeline de sprites OTSP promovido a `Agora`.

**Pendências e riscos:**
- O aviso só é reavaliado ao abrir o menu; falha no meio da incursão aparece na volta ao menu.
- O branch remoto `teste-ci-quebrada` continua lá por decisão do dono (pode ficar).

**Próximo passo recomendado:** pipeline dos sprites OTSP (`tools/` + `assets/` + `assets/CREDITOS.md`), sem trocar o desenho do jogo.

---

## 2026-10-18 23:50 UTC

**Item desenvolvido:** Harness de teste headless no repositório —
[tools/testar.mjs](tools/testar.mjs), commit `3f11261`. Um comando,
`node tools/testar.mjs`, refaz a checagem de sintaxe, monta uma **cópia** do
`index.html` por caso de teste, roda cada uma no Edge headless e sai com código
diferente de zero se qualquer asserção falhar ou se um erro de janela aparecer.
Oito casos, 194 asserções, 6 s de execução: menu com Mercador, incursão de ponta
a ponta até a extração, morte com o Selo de resguardo, as quatro classes,
grimório no nível 18, nível subindo no meio da incursão, save corrompido e
migração `v1`→`v2`. Cada caso tem save semeado próprio. No mesmo commit, as
duas correções que ele achou na Etapa 3 (abaixo) e o `CLAUDE.md` trocando o
procedimento manual pela linha de comando.

**Validação:** `SINTAXE_OK` e os 8 casos passando. O portão foi testado contra
si mesmo, com três cópias quebradas de propósito via `FIBULA_JOGO`: chave de
bloco a mais no `hud()` (barrou na sintaxe, saída 1), referência inexistente no
`hud()` (apareceu em `data-errs`, saída 1) e remoção do `save.cofre+=G.bagVal`
no `finish()` (duas asserções falharam nomeando o que leram, saída 1). Os cinco
itens da lista "o que olhar antes de dizer que está pronto" do `CLAUDE.md`
passaram a estar cobertos pelo script.

**Análise:**
- **A Etapa 3 nunca tinha sido executada fora do navegador de quem escreveu, e
  tinha dois bugs. Os dois foram corrigidos neste commit.**
  1. **A habilidade aprendida no meio da incursão não virava botão.** O
     `gainXp()` abre espaço novo, escolhe a habilidade e escreve no log
     "`Onda de Fogo` foi para o espaço 3" — mas o `montaBotoes()` só era chamado
     no `start()`, então o botão continuava `hidden` até a incursão seguinte. O
     `hud()` faz `if(b.hidden)continue`, então nada o revelava depois. Pior:
     `lancarSlot(i)` lê `ch().slots[i]`, que **estava** preenchido, então a
     tecla `L` do teclado conjurava uma habilidade sem botão na tela. Num jogo
     de celular, isso é a habilidade simplesmente não existir. Correção de uma
     linha: `montaBotoes()` no fim do laço de nível do `gainXp()`.
  2. **Save com classe apontando para personagem ausente deixava a tela em
     branco.** Com `classe:'druida'` e `chars:{}` no `localStorage`, o `ch()`
     devolve `undefined` e o `showMenu()` estoura em `c.lvl` **antes** do
     `requestAnimationFrame(frame)` no fim da IIFE: o laço nunca começa e o
     jogador fica olhando os placeholders do markup, sem jeito de sair a não ser
     limpando o armazenamento. Correção na carga do save: classe fora da tabela
     `CLASSES` volta a `null` (cai na escolha de personagem) e classe válida sem
     personagem ganha um `novoChar()`, já persistido. O cofre e as melhorias
     sobrevivem.
- Terceira correção, menor: o `aria-label` dos botões de habilidade dizia
  "0 de mana" para o Golpe do Cavaleiro, enquanto o rótulo visível dizia
  "grátis". Agora diz "sem mana" nos dois.
- **O `--dump-dom` que o `CLAUDE.md` mandava usar não existe mais.** O Edge
  desta máquina é o 155, aceita a opção e não escreve nada — nem para uma página
  trivial. A opção saiu do headless novo e só vive no `chrome-headless-shell`,
  que não vem instalado. Foi o que custou mais tempo nesta execução, porque
  falha em silêncio: saída 0, zero byte, nenhum erro. No lugar dela o script
  sobe um coletor HTTP em `127.0.0.1` e a cópia faz `POST` do resultado no fim
  do roteiro, com o DOM final no mesmo pacote (gravado em `dump.html` para
  inspeção, igual ao roteiro manual). Isso também dispensou a
  `--virtual-time-budget`.
- O atalho do `requestAnimationFrame` ficou melhor do que o documentado: em vez
  de `setTimeout(cb, 50)`, é `setTimeout(cb, 0)` com um **timestamp sintético**
  que anda 50 ms por quadro. O `dt` do jogo continua no passo cheio, mas o
  tempo de parede não precisa passar: uma incursão de 20 s roda em segundos, e
  a suíte inteira em 6.
- O `Math.random` é semeado por caso (mulberry32 de uma linha). Sem isso, mapa,
  corredores, spawns e loot mudam a cada execução e um teste de combate fica
  intermitente. Com isso, "passou hoje" significa "passa amanhã".
- Como o jogo inteiro vive numa IIFE, o harness não alcança função nenhuma por
  dentro: tudo é clique em botão, tecla despachada na janela e leitura do DOM e
  do `localStorage`. Isso é limitação e virtude — testa o que o jogador toca.
  Para exercitar o combate, o roteiro despacha `keydown` de `KeyJ`, que o
  `update()` lê como botão segurado.
- Os patches na cópia são substituições exatas que **estouram se não casarem**.
  Se o `index.html` mudar a linha patcheada, o harness falha alto em vez de
  testar coisa nenhuma — o modo de falha que mais importa evitar num portão.

**Colisão com o agente Desenvolvedor, e o que foi feito:** enquanto esta
execução terminava, a entrada das 23:30 entregou **outro** harness para o mesmo
item, o `tools/teste.js` (126 linhas, dois cenários, Chromium da nuvem,
`--dump-dom`). Ficar com os dois é pior que escolher qualquer um — dois portões
para o mesmo item significam que um dos dois não roda e ninguém percebe. **O
`tools/teste.js` foi removido e o `tools/testar.mjs` ficou**, por três motivos
verificáveis, não por preferência:
1. **O `--dump-dom` dele não funciona na máquina do Leonardo.** O Edge 155
   aceita a opção e devolve zero byte com saída 0, então o `tools/teste.js`
   reporta "navegador não rodou" e o portão vira silêncio. O `testar.mjs` usa o
   coletor HTTP e roda nas duas máquinas.
2. **Cobertura:** 2 cenários contra 8 casos e 194 asserções. A própria entrada
   das 23:30 lista como pendência que não há cenário de extração nem de morte —
   os dois existem aqui, e o de extração passa pelo combate.
3. **A pendência "o save semeado precisa trazer o personagem em `chars`; sem ele
   o menu quebra" era o bug nº 2 desta entrada.** Ele foi contornado lá e
   corrigido aqui, então a restrição deixou de existir.
O que o `tools/teste.js` fazia melhor foi absorvido: a descoberta do navegador
(`CHROME`, `/opt/pw-browsers`, PATH) e o `--no-sandbox` fora do Windows, para a
suíte rodar também na nuvem. Se o Leonardo discordar, `git revert` deste commit
traz os dois de volta.

**Roadmap:** enquanto esta execução trabalhava, o agente de Produto promoveu o
mesmo item de `Depois` para `Agora` com uma especificação própria
("Ferramenta de teste headless no repositório", entrada de 22:00). Ele está
atendido e foi para `Concluído`; `Agora` passou a ser a CI, que era o item 1 de
`Próximo`. **Duas diferenças em relação ao que a especificação pedia**, as duas
deliberadas e explicadas acima: o arquivo é `tools/testar.mjs` e não
`tools/teste.js` (ESM, para `import` sem `package.json`), e o resultado volta
por um coletor HTTP em vez de `--dump-dom`, porque a opção não escreve mais
nada. O item 2 de `Próximo` foi aparado: a metade do teste da migração `v1`→`v2`
já está feita (caso `migracao-save`), sobrou o aviso de falha do `persist()`.

**Pendências e riscos:**
- **A extração é testada com o portal mudado de lugar.** No headless não há quem
  arraste o joystick da sala de entrada até a sala do Guardião, então o caso
  `incursao-extracao` patcheia a cópia para o portal nascer na sala de entrada.
  O que fica **sem** cobertura é a travessia: campo de fluxo levando o jogador
  para longe, aggro em corredor, o Guardião. Testar isso de verdade pede um
  roteiro que leia o `G.flow` e dirija o joystick, e o `G` está fechado dentro
  da IIFE. A saída provável é um gancho de depuração no `index.html` ligado
  apenas quando um parâmetro de URL estiver presente — decisão do Leonardo,
  porque é código de teste no arquivo do jogo.
- **Não há CI.** O script existe mas nada o roda sozinho. O ciclo automático
  tem que chamá-lo, e o `CLAUDE.md` agora manda. O item "CI no GitHub Actions"
  está em [docs/agentes/produto.md](docs/agentes/produto.md) e vale promover.
  Atenção: na nuvem não existe Edge; a Action precisa instalar Chromium e
  apontar `FIBULA_EDGE`.
- **O `kill()` sombreia o `ch`**: `for(const[k,ch,a,b]of LOOT[m.k])` usa `ch`
  como a chance do item, apagando dentro do laço o acessor do personagem. Hoje
  não quebra nada, porque o corpo do laço não chama `ch()` — mas qualquer linha
  nova ali dentro que precise do personagem vai pegar um número. Renomear para
  `pc` é seguro; não fiz para manter o diff desta execução nos dois bugs reais.
- **O número de asserções que dependem de texto exato é alto de propósito.**
  Mudar um rótulo de botão ou um formato de linha da tela final quebra casos do
  harness. Isso é o preço de testar pelo DOM, e a mensagem de falha sempre
  imprime o que ela leu, então o conserto é óbvio. Não afrouxe as asserções para
  "passar"; conserte o teste ou o jogo.
- As cópias e os dumps de cada caso ficam em `%TEMP%/fibula-harness` até a
  execução seguinte, que apaga a pasta. Numa falha, o caminho vem impresso.
- **A suíte só foi executada no Edge 155 do Windows.** O caminho de nuvem
  (Chromium do Playwright, `--no-sandbox`) foi escrito mas não rodado. A
  primeira execução de nuvem que chamar `node tools/testar.mjs` é quem vai
  descobrir se o coletor HTTP em `127.0.0.1` passa pelo contêiner; se não
  passar, é aí que a CI vai travar.

**Próximo passo recomendado:** promover a CI no GitHub Actions rodando
`node tools/testar.mjs` em cada push para a `main`, com Chromium instalado e
`FIBULA_EDGE` apontado — é o que transforma o portão em rede de verdade, já que
hoje depende de o agente lembrar de chamar. Depois disso, o item `Agora` do
roadmap.



---

## 2026-10-18 23:50 UTC — Desenvolvedor

**Item desenvolvido:** CI no GitHub Actions — `.github/workflows/ci.yml`, commits `fea2e5e` e `9b92a55`.

**Validação:** run `39162120905` verde na `main`. Branch descartável `teste-ci-quebrada` com erro de sintaxe proposital: CI falhou (sem PR, o push do branch já dispara).

**Análise:**
- A primeira versão da CI chamava `tools/teste.js`, que o dono removera ao consolidar tudo em `tools/testar.mjs` ("um harness só"). Falhou com MODULE_NOT_FOUND. Lição: `git pull` e ler `tools/` antes de apontar a CI para um script.
- `tools/testar.mjs` já inclui a checagem de sintaxe, então a CI tem um passo só.
- O C4 foi concedido pelo dono (app Claude com acesso de escrita a workflows em todos os repositórios); o push do workflow passou direto na `main`.
- `gh api .../logs` falha (proxy); os logs saem pela ferramenta `get_job_logs` do GitHub MCP.

**Roadmap:** CI em `Concluído`; aviso de falha do save + teste da migração promovido a `Agora`. O teste da migração v1→v2 já existe em `testar.mjs` (caso de migração): conferir antes de duplicar.

**Pendências e riscos:**
- O branch remoto `teste-ci-quebrada` ficou: a exclusão deu 403. Apagar à mão (GitHub → Branches).
- Node 20 nas actions `checkout@v4`/`setup-node@v4` gera aviso de depreciação; subir versão quando houver.
- C3 (proteger a `main` exigindo CI) segue com o dono, e `modo.txt` continua `direto`. Proteger a `main` obrigaria PR; o dono decidiu direto na `main`, então não sugerir.

**Próximo passo recomendado:** aviso de falha do `persist()` no menu; o teste da migração já existe.

---

## 2026-10-18 23:30 UTC — Desenvolvedor

**Item desenvolvido:** ferramenta de teste headless — `tools/teste.js`, mais a seção 2 do `CLAUDE.md` reescrita para usá-la. Nenhuma linha do `index.html` alterada.

**Validação:** `node tools/teste.js` imprime `TESTE_OK` e sai com 0 nos dois cenários (menu e Mercador com compra e save; incursão ativa de 12 s até a tela final e "Nova incursão"). Cópia com `throw` injetado em `update()` falha com exit 1 e mensagem do erro. Não rodei a checagem de sintaxe separada porque o código de jogo não mudou.

**Análise:**
- O jogo é uma IIFE: o teste não alcança `G` nem `save` por fora, então os cenários dirigem a interface por cliques e leem o DOM e o `localStorage`.
- O save semeado precisa trazer o personagem em `chars`; sem isso o menu quebra (`ch()` indefinido). Qualquer teste futuro de save deve semear assim.
- A incursão de teste termina por "desabou" (o jogador não se move), o que exercita `update()`, `hud()` e `finish()`, mas não a extração nem a morte em combate.

**Roadmap:** item movido para `Concluído`; a CI foi promovida a `Agora`; `Próximo` renumerado.

**Pendências e riscos:**
- Não testei no Windows/Edge; o `CLAUDE.md` manda definir `CHROME` com o `msedge.exe`. Não confirmado.
- Não há cenário de extração nem de morte. Cobrir isso exige mover o jogador até o portal, o que o IIFE dificulta; avaliar quando a divisão do `index.html` expuser a simulação.
- A CI continua dependendo da permissão C4 (issue #2). Sem ela o push de `.github/workflows` pode ser recusado.

**Próximo passo recomendado:** tentar a CI (`.github/workflows/ci.yml`: sintaxe + `node tools/teste.js`) direto na `main`; se o push for recusado, deixar o arquivo em `docs/` e seguir para o aviso de falha do save.

---

## 2026-10-18 22:00 UTC — Produto

**Item desenvolvido:** primeira execução do agente de Produto. Só `ROADMAP.md`; nenhuma linha de jogo. `Agora` virou a ferramenta de teste headless em `tools/`; `Próximo` ganhou os itens técnicos da F0 (CI, aviso de save + teste da migração, pipeline OTSP, RNG com semente) à frente de morte-com-XP e Selo.

**Validação:** não se aplica a código. Conferido que o `ROADMAP.md` tem um item em `Agora`, 6 em `Próximo` e que todo item tem pilar, fase e "Pronto quando". Push de teste na `main` funcionou.

**Análise:**
- Fase atual: **F0 · Fundação**. Critérios de saída: faltam todos os verificáveis — não há CI nem testes, sem RNG com semente, sem sprites (`assets/` não existe), sem teste da migração, sem Playwright; fontes ainda externas; PWA ausente. A divisão do `index.html` segue em andamento (o `CLAUDE.md` ainda tem a "Regra número um").
- Issues abertas: nenhuma antes desta execução; nada a responder nem prazo vencido.
- Modo de publicação: `direto`, coerente (sem CI).

**Roadmap:** a "Peso na morte" saiu de `Agora` para `Próximo` 5 (itens técnicos da F0 têm prioridade, e o Desenvolvedor precisa do teste automatizado como portão). Os itens de jogo 3 a 9 (profundidades, equipamento, sair cedo, lugares, monstro, escala de HP, log) foram para `Depois`: equipamento e 2º bioma são F1, e a fila excedia 8 itens. O item "Harness de teste" de `Depois` foi absorvido por `Agora`. Esta execução incluiu 5 itens novos (os da lista da primeira execução, que prevalece sobre o limite de 3). O aviso de save e o teste da migração foram fundidos num só item.

**Pendências e riscos:**
- A CI precisa de C4 (permissão de workflows). Aberta issue `precisa-do-dono`; sem ela o push do workflow pode ser recusado; decisão do dono: sem PR, tudo direto na `main`.
- O RNG com semente e o pipeline de sprites mexem no `index.html` ou criam arquivos: respeitar os limites da seção 3 do `comum.md` até a divisão terminar.
- O teste headless depende do Chromium em `/opt/pw-browsers`; o `CLAUDE.md` ainda descreve o Edge do Windows.

**Próximo passo recomendado:** Desenvolvedor executa `Agora` (`tools/teste.js`) e atualiza o `CLAUDE.md`.


---

## 2026-10-18 20:00 UTC — Sessão manual

**Item desenvolvido:** conteúdo do jogo fora do motor (`191e80e`). Classes, habilidades, melhorias, inimigos, itens, loot e progressão em `data/game/content.json`, com validação no carregamento. Não era item do roadmap: veio de um pedido direto do Leonardo, que também trouxe a base de `data/mechanics/` e `tools/extract-mechanics.ps1` (já na `main` pelo ciclo).

**Validação:** quatro harness headless contra o `index.html` desta entrega — combate, extração, menu com loja e grimório, e morte — com `data-errs="` **ausente** nos quatro. Números conferidos contra os dados do JSON, não só "abriu sem erro": vida 151 do Feiticeiro nível 12 (`hp 85 + ghp 6 × 11`); Vigor a 120 e cofre 1000 → 880; vida 166 na incursão seguinte à compra; Grimório com 3 espaços no nível 12 e 6 habilidades da classe; extração levando o cofre de 1000 a 1200 em 0:05; morte em 0/85 perdendo os 200 de loot semeados. O `SINTAXE_OK` **não** foi produzido: não há Node nesta máquina. Os harness cobrem o caso, porque um erro de parse apareceria como `data-errs`.

**Análise:**
- A migração de save da Etapa 2 chama `novoChar()` → `slotsIniciais()` no topo do script, o que já lê `SPELLS` e `SLOT_LVL`. Por isso carregar os dados tarde não servia: o IIFE teve de virar assíncrono e aguardar antes de qualquer coisa.
- As 24 habilidades foram movidas por geração, não à mão: um script extrai o texto dos literais do `index.html`, o JS avalia e o resultado vira JSON. Transcrição manual de 24 registros com 12 campos cada erra em silêncio.
- A progressão de inimigos por profundidade continuava com números fixos no código (`1+.35*d`, bandas `.6/.4`); agora está no arquivo. Distribuição medida em 20 mil amostras por banda bate com a anterior.

**Roadmap:** só `Concluído` ganhou entrada. `Agora` ficou intocado de propósito — a ferramenta de teste headless é item do ciclo.

**Pendências e riscos:**
- **O `tools/testar.mjs` precisou de ajuste e eu não pude executá-lo.** O harness abre as cópias em `file://`, onde o `fetch` do `content.json` é bloqueado mesmo com `--allow-file-access-from-files`, então ele quebraria com esta entrega — e a CI roda em todo push. O `prelude()` passou a embutir o `data/game/content.json` real, lido do repositório ao montar a cópia, e a devolver por um `fetch` falso; `validaConteudo()` continua rodando contra o conteúdo verdadeiro. Há recuo para a raiz porque `FIBULA_JOGO` pode apontar uma cópia fora do repositório, sem `data/` ao lado. **Não há Node nesta máquina: o ajuste foi escrito e não executado.** O que deu para conferir foi a sintaxe, fazendo o Chromium parsear o arquivo como módulo — só apareceram falhas de resolução de `node:*`, nenhum `SyntaxError`, e a resolução só acontece depois do parse. A primeira execução de verdade é a da CI neste push. Se ela ficar vermelha, é aqui que se olha primeiro.
- Duas armadilhas que custaram tempo e vão custar de novo: as linhas do `#log` se apagam sozinhas em 8,2 s e o log guarda só 5, então um amostrador que **sobrescreve** o resultado lê vazio no fim da corrida — tem de acumular; e `--dump-dom` capturado com `&` no PowerShell volta vazio, precisa de `Start-Process -RedirectStandardOutput`.
- O harness usado aqui é Python e vive fora do repositório (scratchpad da sessão). Não é o script Node que o roadmap pede; serve como referência do que testar, não como entrega.
- Não testei: incursão de 6 minutos inteira (os harness encurtam `RUN`), troca de habilidade no Grimório, e recarregar a página para conferir persistência do save.
- Esta sessão e o ciclo automático escreveram na `main` em paralelo duas vezes. Na primeira, o ciclo descartou a externalização ao resolver o conflito do `index.html` e documentou o contrário no README; esta entrega a reaplica sobre a Etapa 3. Se a decisão certa for manter os dados inline, é `git revert` deste commit — mas então o README precisa voltar atrás também.
- O carimbo da entrada anterior (22:00 UTC) está à frente do relógio real (20:00 UTC nesta execução), o que embaralha a ordenação por horário.

**Próximo passo recomendado:** rodar `node tools/teste.js` e conferir o ajuste do SHIM que eu não pude executar. Depois, cobrir os três casos que ficaram sem teste: incursão de 6 minutos inteira, troca de habilidade no Grimório e recarga da página para conferir persistência do save.

## 2026-10-18 19:10 UTC

**Item desenvolvido:** Base de orientação para IA — commit `e13649f`.
`CLAUDE.md` (arquitetura do `index.html`, convenções de código, roteiro de teste
headless, regras de git), `VISAO.md` (a frase, os cinco pilares, os
não-objetivos, o teste de quatro perguntas), `AGENTS.md` como ponteiro, e
formato para este diário e para o roadmap. Nenhuma linha de jogo alterada.

**Validação:** `SINTAXE_OK` no `index.html` depois dos merges (o código é de
outras execuções; esta entrada não alterou nenhuma linha de jogo). Conferido que
os links internos dos documentos resolvem, que todos os arquivos estão em UTF-8,
que não sobrou marcador de conflito, e que os marcos de seção citados no
`CLAUDE.md` batem com o `index.html` de 1376 linhas depois do merge.

**Análise:**
- O repositório não tinha nenhum arquivo de orientação até agora: sem
  `CLAUDE.md`, sem `AGENTS.md`, sem `.cursorrules`. O ciclo automático começava
  cada execução sem saber a arquitetura, as convenções nem como testar.
- Ao conferir o `<head>` para montar a tabela de linhas, apareceu uma
  dependência de rede que eu havia dado como inexistente: o `index.html` busca
  Pixelify Sans e Barlow Semi Condensed no Google Fonts (linhas 13–15). A
  documentação foi corrigida para registrar a exceção em vez de afirmar "zero
  dependências". **Lição:** conferir o `<head>` antes de repetir que o jogo não
  faz chamada externa.
- A base filosófica foi definida pelo Leonardo nesta sessão e virou o
  `VISAO.md`: Tibia raiz num celular — a morte custa, o mundo parece maior que o
  jogador, incursão abaixo de dez minutos. Daí saíram os cinco pilares, e todo
  item do roadmap agora declara qual deles serve.
- As duas execuções anteriores do ciclo criaram um `ROADMAP.md` e um `DIARIO.md`
  próprios enquanto esta sessão escrevia os seus, em paralelo. Os dois conjuntos
  foram mesclados à mão: os itens e a análise da rotina foram preservados
  integralmente, e o formato de entrada **dela** foi adotado como contrato aqui,
  porque é mais rico que o que eu havia proposto e é o que a automação já emite.
- No meio do trabalho a `main` recebeu a **Etapa 3** (`1639d2d`), que levou o
  `index.html` de 871 para 1376 linhas: quatro classes, grimório com slots, as
  três moedas de progressão do Tibia e save `v2` com migração da Etapa 2. O
  `CLAUDE.md` foi refeito em cima disso — mapa de seções, as três moedas, o
  formato novo do save e o padrão de migração — e a coluna de números de linha
  deu lugar aos marcadores de seção, que não envelhecem. O `VISAO.md` ganhou
  ponteiro para `docs/analise-tibia-habilidades.md`, que é a fonte das fórmulas.
  A Etapa 3 entregou de uma vez os dois itens que estavam em `Depois`, vocações
  e habilidade que sobe com uso, e ambos saíram da lista.

**Roadmap:** reescrito na estrutura por pilares, com critério de "pronto quando"
em cada item. "Peso de XP na morte" entrou em `Agora` (pilar 1, o item-cabeça da
direção nova). O item que a rotina havia promovido a `Agora`, "aviso quando o
save não persiste", **desceu para `Próximo` #1** — nada estava em andamento, e a
direção que o Leonardo deu nesta sessão tem precedência; continua sendo um bug
real e é o próximo da fila. Os quatro itens de `Próximo` e as quatro ideias de
`Depois` da rotina foram todos mantidos, agora com pilar declarado. "Revisar a
economia do Selo de resguardo" ganhou urgência: a 60% ele briga diretamente com
o pilar 1, e piora quando a morte passar a custar XP. Dois itens novos em
`Depois`: cortar a dependência de fontes externas, e pôr um harness de teste no
repositório.

**Pendências e riscos:**
- **Não existe harness de teste no repositório.** O `CLAUDE.md` descreve o
  procedimento headless em detalhe, mas cada execução ainda monta o `test.html`
  do zero. Isso é desperdício e convida a pular o teste. Está em `Depois`.
- **Referências a linha envelhecem rápido.** A Etapa 3 deslocou tudo de uma vez.
  O `CLAUDE.md` já foi convertido para citar marcadores de seção em vez de
  faixas de linha, mas as referências `index.html:NNN` das entradas antigas
  deste diário apontam para o arquivo de 871 linhas e não valem mais.
- **A `main` se move durante a sessão.** Esta entrada precisou de dois merges:
  a rotina commitou duas vezes, e a Etapa 3 entrou depois disso. Deu para
  mesclar sem perda nenhuma, mas o risco de sobrescrever é real. Antes de
  escrever `ROADMAP.md` ou `DIARIO.md`, e antes de qualquer push, faça
  `git fetch` e leia a versão da `main`.
- **A Etapa 3 chegou sem passar pelo roadmap nem pelo diário.** Ela foi
  registrada aqui retroativamente, nesta entrada. O `index.html` dela não foi
  exercitado por esta sessão além do portão de sintaxe — classes, grimório e a
  migração `v1`→`v2` nunca passaram pelo harness headless.

**Próximo passo recomendado:** implementar o item de `Agora` (peso de XP na
morte). Ler o `VISAO.md` antes, porque a decisão de quanto cobrar é de
balanceamento de pilar, não de código. Mexe em `gainXp()`, `finish()`,
`showEnd()` e `hud()`, e agora escreve em `ch().xp` em vez de `save.xp`, por
causa do save `v2` por classe. Começar só pelo nível, deixando magia e perícia
intactas. Antes disso, se sobrar execução, vale rodar o harness headless contra
a Etapa 3 — ela nunca foi exercitada além da sintaxe.
