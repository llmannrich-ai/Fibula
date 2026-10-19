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

## 2026-10-19 04:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** a entrada do Esgoto virou uma grade no chão (0.24.0), a pedido do Leonardo ("troque a entrada do esgoto por uma entrada ao invés de um NPC, com a imagem de um esgoto da cidade"). O NPC `vigia` saiu; entrou `city.npcs.grade` com `lugar: true` e `acao: "Descer"`, na rua sul (20,32), desenhado com o item 999 do OTSP ("sewers") deitado no chão. Um NPC-lugar não bloqueia o caminho (`entraCidade()`), quem volta do Esgoto sai em cima dele, o botão diz a `acao` em vez de "Falar" e o registro mostra só a frase, sem "Nome:". Sem a arte, uma grade redonda desenhada em código.

**Validação:** `node tools/testar.mjs` — 32/32; o caso `mapas-de-caca` confere que a grade não é sólida, que a volta é em cima dela e que o botão diz "Descer" com o rótulo acessível. Tela conferida em 390×780 com o atlas.

**Análise:** `lugar` e `acao` são campos genéricos do NPC, validados em `validaConteudo()`; servem para a próxima entrada que não é pessoa (um alçapão, uma escada de cripta).

**Roadmap:** sem mudança.

**Pendências e riscos:** a grade fica perto da borda sul do mapa, então a câmera presa à borda a deixa colada aos botões no celular; se incomodar, subir a grade uma ou duas linhas.

**Próximo passo recomendado:** o Leonardo descer pela grade no celular e dizer se a posição está boa.

## 2026-10-19 03:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** o corpo da Mochila no desenho da janela de inventário do Tibia (0.23.0), a pedido do Leonardo ("algo bem melhor para representar os equipamentos na tela inventário, que se assemelhe à do Tibia, equipamentos em posição de uso"). `desenhaMochila()` em `src/hud.js` monta três colunas (amuleto/arma/anel, elmo/armadura/calça/botas, saco/escudo/munição), a do meio mais alta, como no Tibia. Casa vazia mostra a silhueta do que vai nela (SVG inline como `mask` no `<style>`, variável `--sil` por classe `s-<casa>`); as casas que o jogo não tem são `.trava`, apagadas e `aria-hidden`. Ao lado, `#moFig`: o `retrato()` do Banco com o boneco vestido, que gira ao toque (`MO.dir`). Sem o atlas, a letra da classe.

**Validação:** `node tools/testar.mjs` — 31/31; o caso `mochila` acha a arma pela classe `s-arma` (a ordem no DOM mudou) e confere as três colunas, as seis casas apagadas e o boneco. Conferido com Chromium em 390×844 e 375×667.

**Análise:** o corpo cresceu ~70 px na tela alta; na baixa (`max-height:740px`) as linhas de anel, calça, munição e botas somem, e o corpo fica com duas linhas e o boneco de 96 px.

**Roadmap:** item novo em `Concluído`, fora da fila (pedido do dono). `Agora` continua "sair cedo".

**Pendências e riscos:**
- **As casas apagadas prometem peças que não existem** (elmo, escudo, anel, calça, botas, munição). É o desenho do Tibia, mas se virar pergunta de jogador, ou elas entram no `content.json` (cada uma é um `slot` novo em `SLOTS_EQ` e na `veste`), ou saem da tela — apagar as `trava()` de `desenhaMochila()`.
- A tela do Banco (`drawEquip()`) continua com os três botões em linha; não foi pedida.

**Próximo passo recomendado:** o Leonardo abrir a Mochila no celular e dizer se as casas apagadas ficam ou saem; depois, "Sair cedo" (`Agora`).

## 2026-10-19 03:10 UTC — sessão manual (nuvem)

**Item desenvolvido:** mais mapas de caça (0.22.0), a pedido do Leonardo ("crie mais mapas de caça: esgoto, navio que leva para ilha, outros; cada um acessado como a masmorra, criando ou entrando em salas"). `hunts` no `content.json` ganhou, por mapa, `npc` (quem leva até ele), `bands` e `boss` (no formato de `progression`), `mapa` (salas, tamanho, atalhos, lido por `genMap(m)`), `arte` (chão, parede, cores sem sprite, escuridão, tochas) e as frases `entrada`/`volta`. Três mapas novos: **Esgoto** (nível 1, Vigia do esgoto, letra `V` perto do mercado: morcego, barata, lesma, Centopeia-rainha; muitas salas pequenas), **Ilha da Enseada** (nível 8, Capitão, letra `N` no porto do canal leste: vespa, lagarta-cuspideira à distância, leão, troll, Dragão da enseada; poucas salas grandes, menos escuro, sem tochas) e **Cripta Antiga** (nível 15, no Guia: esqueleto, fantasma, múmia, necromante à distância, Senhora das Sombras; mais escura). A Masmorra de Runas não mudou (sem `bands`, `boss` e `mapa`, usa `progression`, e `genMap()` sorteia na mesma ordem). Treze monstros e dois NPCs com sprite do OTSP; chão e parede de cada mapa no atlas. `showHunts(npc)`: cada NPC que abre `cacadas` mostra só os mapas dele, com os monstros listados, e cada linha tem "entrar" e "criar sala". A sala guarda o mapa (`SALA.caca`), anunciado na presença (`sala.h`), na lista de membros e na porta; a porta só abre no NPC daquele mapa. A volta da caçada é ao lado de quem levou (`entraCidade(npc)`).

**Validação:** `node tools/testar.mjs` — 32/32, com o caso novo `mapas-de-caca` (Vigia → Esgoto e volta ao lado dele, Capitão → Ilha, sala da Ilha anunciada com o mapa, porta fechada no Guia, volta de navio ao porto) e, no Node, os quatro mapas: monstros só da tabela de cada um, um chefe só, mesma semente igual, mapas diferentes por mapa de caça, chave desconhecida virando Runas, quatro conteúdos tortos recusados. Telas e os quatro mapas conferidos com Chromium em 390×780 com o atlas.

**Análise:** o chefe podia **não nascer** quando um monstro comum já ocupava o sqm dele (acontecia também na Masmorra de Runas, em algumas sementes). Agora, com o sqm ocupado, o chefe vai para o livre mais perto do centro da sala, sem sorteio, então nenhuma masmorra muda de mapa. O "Entrar pela porta" ficava desabilitado até outra coisa redesenhar o Guia depois que o canal da sala ligava: `SALA.aoMudar()` agora roda ao ligar. A `main` subiu para 0.21.0 (habilidades no Mestre de magias) durante o trabalho; mesclado, esta é a 0.22.0, e a sala de 0.21 não enxerga a de 0.22 (o canal leva a versão).

**Roadmap:** "Lugares com nome" foi para `Concluído`; o Acampamento Orc do item original ficou de fora (os orcs já são da Masmorra). `Agora` não mudou.

**Pendências e riscos:**
- **Balanceamento é chute medido só no papel.** Simulação de 40 sementes, masmorra inteira: Esgoto ~620 XP e ~400 de loot; Runas ~1.640 e ~1.600; Ilha ~3.170 e ~2.040; Cripta ~6.440 e ~3.000. Ninguém jogou a Ilha no nível 8 nem a Cripta no 15; o dano dos monstros (12 a 52) precisa do agente de Balanceamento com personagens de referência.
- O chefe dos mapas novos não deixa troféu próprio (a coroa é só do Guardião); os novos dropam gema e equipamento.
- Monstro à distância usa sempre o projétil do xamã (`mi_xama`).
- O atlas foi de ~340 KB para ~510 KB (o dragão e a sombra são grandes).
- O Gordon pede materiais pensando na Masmorra; a Ilha dá muita seda e a Cripta muita erva, o que barateia as encomendas.

**Próximo passo recomendado:** o Leonardo jogar o Esgoto com um personagem novo e a Ilha com um de nível 8 e dizer se o perigo está certo; depois, Balanceamento dos mapas novos.

## 2026-10-19 02:45 UTC — sessão manual (nuvem)

**Item desenvolvido:** habilidades se aprendem com o Mestre de magias (0.21.0), decisão do Leonardo com três escolhas: quem já jogava mantém o que o nível liberou, a de nível 1 continua grátis e as runas continuam à venda. `preco` em cada habilidade do `content.json` (0 no nível 1; 100 a 3.500 até o nível 32); `ch().sabe` no save; `podeAprender()` e `aprende()` em `src/sim/progresso.js` (a aprendida vai para o espaço livre); subir de nível não ensina mais a habilidade com preço, o registro diz quem ensina e quanto custa; o Mestre ganhou a seção "Habilidades da sua classe" (`ensina: true` em `city.npcs`), e o Grimório mostra "no Mestre" e o preço. `confereFicha()` e o resultado da sala só aceitam habilidade sabida.

**Validação:** `node tools/testar.mjs` — 31/31. No Node: personagem novo só sabe a de nível 1, aprender pede nível e ouro, vai para o espaço livre, save antigo (sem `sabe`) fica com tudo do nível, ficha de fora não usa habilidade que não sabe, e o conteúdo sem habilidade grátis no nível 1 ou sem quem ensine é recusado. Navegador: `lojas` compra a Golpe Brutal no Mestre; `nivel-na-incursao` reescrito (o nível 9 não traz mais a Onda de Fogo sozinha). Telas do Mestre e do Grimório conferidas em 390×844.

**Análise:** a decisão muda o ritmo de quem começa agora: o personagem novo chega ao nível 4 sem a segunda habilidade até juntar 150 de ouro. Quem já tinha save não sente nada.

**Roadmap:** item novo em `Concluído`, fora da fila (decisão do dono, PRD 15.1). `Agora` continua "sair cedo".

**Pendências e riscos:**
- **Preços são chute** (tabela por nível: 3→100, 4→150, 9→500, 15→1.100, 22→2.000, 32→3.500). Concorrem com as melhorias do Mercador, a Forja e as provisões pelo mesmo cofre; medir com o agente de Balanceamento quanto ouro uma caçada típica traz em cada faixa de nível.
- A morte não leva habilidade; perder o nível não existe, então o que se aprende nunca volta atrás.
- O convidado da sala que aprende no meio da sala manda a ficha nova só na próxima entrada pela porta (é o fluxo da 0.19).

**Próximo passo recomendado:** o Leonardo criar um personagem novo e jogar até o nível 4–5 para sentir se o ouro chega a tempo da segunda habilidade.

## 2026-10-19 02:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** a cidade cinco vezes maior e as lojas de provisões (0.20.0), a pedido do Leonardo ("amplie o mapa da cidade para cerca de 5 vezes; insira NPCs que vendem itens como mercado de alimentos, poções e magias"). Mapa de 54×38 (2.052 sqm, era 408): praça com fonte e canteiros, templo com estátuas, rio com duas pontes, Torre dos magos do outro lado, pomar, horta, poço, casas de moradores, Quitanda e Feira a céu aberto. Chãos novos (`:` praça, `=` ponte, `v` flores, `h` horta) e objetos sólidos (`OBJETOS` em `src/sim/dados.js`: fonte, poço, barril, caixote, estátua, arbusto, cerejeira, frutífera, forno, estante, banca, lenha), que ficam sobre o chão do vizinho como os NPCs. Mapa da cidade no canto (`drawMiniCidade()`). Três NPCs com `abre: "loja"` e uma tela só (`showLoja()`): Quitandeira (refeição: regenera vida e/ou mana a caçada toda, uma por vez), Boticária (poção a mais, até 5; elixir de pressa no primeiro minuto) e Mestre de magias (runas de pele de pedra, fúria e olho de águia nos primeiros 90 s). Provisões em `supplies` no `content.json`, guardadas em `save.prov`, levadas pela ficha (`prov`) e gastas no `start()`. O buff da provisão mora em `p.sup` e soma ao das habilidades em vez de ser trocado. 15 sprites novos do OTSP no atlas.

**Validação:** `node tools/testar.mjs` — 31/31, com o caso novo `lojas` (comprar, uma refeição por vez, máximo por provisão, o Guia mostra o que vai, a caçada começa com as poções, a regeneração e a runa, e o estoque zera) e, no Node, compra, aparo do save e da ficha de fora, efeito na caçada, buff somando ao do Provocar e acabando no tempo, e o conteúdo torto recusado. Duas sabotagens barradas (o `start()` não gastar o estoque; a comida não regenerar). Telas conferidas com Chromium em 390×844 e o mapa inteiro em 1728×1216, com e sem o atlas.

**Análise:** a `main` andou da 0.14 para a 0.19 durante o trabalho; a mescla trouxe a Forja do Gordon, que tornava redundante um Ferreiro que eu tinha feito (removido: o Gordon foi para a forja do mapa novo, letra `F`), e as peças de teste do chão (realocadas na praça, em volta do `@`; a conferência de `city.chao` aceita os chãos novos). Na sala sem tempo, o convidado manda a ficha a cada entrada (`entro`), então as provisões dele vão atualizadas sem mensagem nova.

**Roadmap:** item novo em `Concluído`, fora da fila (pedido do dono). `Agora` continua "sair cedo".

**Pendências e riscos:**
- **Andar pesa mais.** Do `@` ao Banco são ~30 sqm (~15 s); ao Guia, ~16 sqm. A volta da caçada é ao lado do Guia, mas as lojas ficam no caminho, não na porta. Se incomodar, a saída é encurtar a cidade em volta do portão, não teleporte.
- **Balanceamento das provisões é chute.** Preços de 15 a 80 de ouro; a runa da fúria (+20% de dano por 90 s) e a poção (+1, até 5) são as mais fortes. Medir com o agente de Balanceamento antes de mexer na curva de ouro.
- Na masmorra da sala, cada entrada pela porta gasta as provisões de novo (buff dos 90 s conta de cada entrada).
- A arte do OTSP não tem pão nem lampião de rua: a cesta de frutas é uma maçã e os cantos da praça viraram arbustos floridos.

**Próximo passo recomendado:** o Leonardo andar pela cidade no celular e dizer se o tamanho e as distâncias estão bons; depois, "Sair cedo" (`Agora`).

## 2026-10-19 01:55 UTC — sessão manual (nuvem)

**Item desenvolvido:** a masmorra da sala sem tempo, com porta (0.19.0), a pedido do Leonardo ("entrada e saída por uma porta acessível por qualquer usuário; fecha quando quem criou fecha na cidade ou sai do programa"), com as três escolhas dele: sem tempo, monstros renascem, porta na sala de entrada. Modo "masmorra aberta" em `src/sim/incursao.js` (`newRun(s,fichas,true)`, `entra()`, `repovoa()`, `progression.respawn` no `content.json`); `src/sala.js` troca o "começar com o grupo" por `entraPorta()`/`porta`; o Guia de caça mostra quem está na masmorra e o botão "Entrar pela porta"; a presença da cidade segue com `longe` enquanto o anfitrião caça, para a sala não sumir da lista.

**Validação:** `node tools/testar.mjs` — 27/27; os dois casos da sala reescritos para o fluxo novo (entrar, sair, voltar a entrar, anfitrião entrando depois, masmorra que não desaba, fechar com gente dentro). No Node: não desaba depois do tempo da solo, quem entra não sai sem querer pela porta, a sala repovoa em 60 s e não repovoa com jogador perto, sair pela porta guarda o saco e entrar de novo dá jogador novo. Quatro sabotagens barradas. Dois Chromium no Realtime de verdade, duas rodadas verdes: B entra sozinho com o anfitrião na cidade, anda e é visto, o anfitrião entra depois, B sai com o saco e volta, o anfitrião sai e fecha a sala, B volta à cidade. Tela conferida em 360×640.

**Análise:** a masmorra da sala nasce com o grupo de um (o anfitrião), então tem menos monstros que antes na largada (~40 contra ~66 com dois); o respawn sobe o normal de cada sala com quem está dentro. Com a porta na entrada e sem tempo, o risco da sala é só o caminho de volta com o saco cheio.

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono, PRD 15.1). `Agora` continua "sair cedo", que agora vale só para o solo.

**Pendências e riscos:**
- **Conflito com o pilar das partidas curtas**, aceito pelo Leonardo: na sala não há pressão de tempo; o solo continua com 6 minutos. Medir no playtest se a sala virou farm sem risco.
- O anfitrião continua não podendo deixar o jogo em segundo plano: a masmorra congela para quem está dentro, e em 12 s eles voltam sem resultado.
- O anfitrião não troca de personagem com a sala aberta (trocar fecha a sala).
- A masmorra do anfitrião roda sem parar enquanto a sala existir; com a aba aberta horas, `G.t` cresce sem limite (inofensivo) e os cadáveres ficam capados em 60.
- O Guardião renasce também: matar o chefe e esperar 60 s longe dele é farm. Se pesar, `progression.respawn` ganha um tempo próprio para o chefe.
- Mesclado com a Forja, as peças no chão e o registro de caçada (0.18.0): cada entrada pela porta abre um registro de caçada na nuvem e cada saída fecha o dele. A **Mochila do convidado** mostra o saco local, que o retrato não sincroniza (só o valor): o saco de verdade é o do anfitrião e chega inteiro no resultado.

**Próximo passo recomendado:** o Leonardo testar com um amigo: entrar em momentos diferentes, sair e voltar, e dizer se a sala sem tempo ficou boa; depois, "Sair cedo" (`Agora`).
## 2026-10-19 16:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** Gordon e a Forja (0.18.0), a pedido do Leonardo ("vende armas e armaduras conforme você faz missões; compra quase qualquer item que cai dos monstros, barato; as missões são trazer loot para ele fabricar equipamento melhor"). NPC `city.npcs.gordon` (letra `F`, casa nova no canto sudoeste, sprite OTSP 21). Seção nova `forja` no `content.json`: `compra` (preço por material, cerca de metade do `val`), `missoes` (quatro encomendas em ordem) e `loja` (o que ele vende e a partir de qual encomenda). Regra em `src/sim/progresso.js` (`ehMat`, `entregar`, `venderMat`, `comprarForja`); tela `#forja` em `src/telas.js`. Quatro peças novas (maça cravejada, gibão acolchoado, machado de guerra, couraça de placas) com sprite no atlas. Save ganhou `mats` e `forja`, ambos da conta, normalizados.

**Validação:** `node tools/testar.mjs` — 30/30, com o caso novo `forja` (19 asserções: encomenda incompleta barrada, entrega consome e libera, venda da sobra poupa o da encomenda, compra vai ao Banco, Mochila e tela final avisam do depósito, extração leva a seda ao depósito) e a forja na simulação do Node. Tela olhada em 390×844 com Playwright fora do repositório. Mesclada duas vezes com a `main` (0.16.0 e 0.17.0) durante a sessão.

**Análise:** antes, todo item sem `slot` virava ouro na extração. Agora só gema e coroa viram; dente, seda, osso e erva vão para `save.mats`. Medido com 50 sementes no Node: a masmorra inteira tem ~2 dentes, ~5 sedas, ~9 ossos e ~2,6 ervas (~180 de ouro pelo `val`); uma incursão típica traz perto da metade.

**Roadmap:** "Gordon e a Forja" em `Concluído`, fora da fila (pedido do dono). `Agora` não mudou.

**Pendências e riscos:**
- **Renda menor por incursão.** Quem só vende os materiais ao Gordon recebe ~metade do que a extração pagava antes por eles (~40 de ouro a menos numa incursão típica). É o "barato" pedido, mas mexe na economia: ajustar em `forja.compra` se a progressão ficar lenta.
- **Origem na Feira.** Peça comprada do Gordon e ouro de material vendido a ele não têm origem no banco (`004_origem.sql`): servem para vestir e para o Mercador, mas não entram na Feira. Resolver pede uma função nova no Supabase (ex.: `lastro_forja`, que troca ouro com origem pela peça); não foi feita sem o Leonardo decidir.
- Materiais não têm origem nem entram na Feira; também não estão na Mochila como vendáveis.
- As quantidades das encomendas (dente 3+3, seda 4+10, osso 12+8, erva 6) foram estimadas pela simulação, não jogadas. O dente é o gargalo (só ~2 por masmorra inteira).

**Próximo passo recomendado:** o Leonardo jogar umas incursões e dizer se o ritmo das encomendas e o preço do Gordon estão bons; decidir se a Forja entra na origem da Feira.

---

## 2026-10-19 13:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** peças de teste no chão da cidade (0.17.0), a pedido do Leonardo, para testar o equipamento sem caçar. `city.chao` no `content.json` (7 peças perto do `@`, validadas: item existe e o sqm é chão); `C.chao` em `entraCidade()`, pegar ao pisar em `updateCidade()`, `pegaDoChao()` em `progresso.js` e `save.chao` (o que a conta já pegou, completado por `normaliza()`); desenhadas com o sprite do item em `renderCidade()`.

**Validação:** `node tools/testar.mjs` — 29/29, com o caso novo `chao-da-cidade` (pega andando, vai ao cofre, o save lembra, não reaparece, o Banco lista). Cidade conferida em 390×740.

**Análise:** as peças não têm origem no banco (`004_origem.sql`), então não se anunciam na Feira nem viram lastro pela venda ao Banco; só dão ouro local ao serem vendidas ao Banco.

**Roadmap:** sem mudança (ferramenta de teste).

**Pendências e riscos:**
- **É coisa de teste.** Para tirar, apagar `city.chao` do `content.json`. Cada conta pega uma vez: 7 peças, ~360 de ouro no Banco no máximo.
- Quem já pegou e quer testar de novo precisa de save novo (ou apagar `chao` do save).

**Próximo passo recomendado:** o Leonardo testar o equipamento no corpo com as peças; depois tirar `city.chao`.

---

## 2026-10-19 14:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** todo mundo uns 15% mais rápido (0.16.0), a pedido do Leonardo. Só dado: `progression.walk.ground` de 150 (o chão padrão do Tibia) para 130. Como o passo é proporcional ao chão e arredondado para cima em 50 ms, o ganho real vai de 9% a 17%: nível 1 de 550 para 500 ms (2 sqm/s), nível 50 de 400 para 350, nível 100 de 350 para 300; aranha 600→550, orc e esqueleto 800→700, xamã e Guardião 850→750, rato 900→800. Nível 200 fica em 250.

**Validação:** `node tools/testar.mjs` — 28/28, com os valores esperados da fórmula ajustados na simulação no Node (nível 1 = 0,5 s, nível 200 = 0,25 s, velocidade 150 = 0,7 s, buff de 50% = 0,35 s, 1,8 s para leste = 4 sqm).

**Análise:** trocar o chão mantém a proporção entre jogador e monstros e o arredondamento do Tibia; trocar o arredondamento para o mais próximo daria 20% a 40%, longe do pedido.

**Roadmap:** sem mudança de fila.

**Pendências e riscos:** a mesma de antes: medir mortes e XP por incursão com o ritmo novo.

**Próximo passo recomendado:** o Leonardo jogar e dizer se o ritmo acertou.

---

## 2026-10-19 14:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** origem na Feira e venda do saco (0.15.0), a pedido do Leonardo ("anunciar somente o que o player tem no cofre ou no saco"). Duas decisões dele: o saco vende **livre** na caçada, mesmo que depois morra; e o banco **registra a origem**. `tools/supabase/004_origem.sql`: `mercado_lastro` (segundo saldo, só o banco mexe), `cacadas`, `fibula_marcos` (anistia uma vez só), `caca_comecar`, `caca_fim`, `lastro_banco`, `mercado_anunciar` de 7 argumentos (o de 5 virou atalho, para cliente em cache) e `mercado_livro`/`mercado_cancelar` com a origem. Cliente: fila de origem em `nuvem.js` (`masmorra-runas-v2-fila`), `cacaComeca()` no `start()`, `cacaFim()` no `saida.fim`, `lastroBanco()` na venda ao Banco; na Feira, "N com origem" e o ouro com origem; na Mochila, "Vender 1 na Feira" para peça do saco (`tiraDoSaco`/`poeNoSaco` em `combate.js`).

**Validação:** SQL num Postgres 16 local com uma conta "antiga" (anistia de cofre, peças guardadas e vestidas) e uma criada depois com save editado (99.999 de ouro, 5 cotas): tudo dela barrado com `sem_origem`; venda do saco antes de 20 s barrada; peça fora do saco barrada; venda do saco casando a 100 com 98 de origem; extração com menos de 85 s fecha sem crédito; extração válida credita só chaves válidas; fechar duas vezes recusado; venda ao Banco uma vez só por peça; cancelamento devolvendo a origem. `node tools/testar.mjs` — 26/26, com `feira` (31 asserções) e o caso novo `feira-saco` (14). Produção: migração aplicada em cinco partes, anistia nas 3 contas, auxiliares sem acesso de `anon`, API real respondendo `sessao` nos dois formatos de `mercado_anunciar`.

**Análise:** com o save gravado pelo cliente, o saldo do save não prova nada; a origem só cresce por caminhos que o banco registra. É a mesma ideia do servidor autoritativo, mas sem rodar a masmorra: o banco não sabe se a cota do saco caiu de verdade, então põe teto (30 peças por caçada, 60 por dia, 20.000 de ouro por caçada, extração só depois de 85 s).

**Roadmap:** item em `Concluído`; decisão no PRD 15.1.

**Pendências e riscos:**
- Na sala de caçar junto (0.14.0, que entrou em paralelo) a venda do saco fica desligada: no convidado o saco é retrato do anfitrião e vender dele duplicaria a peça. Liberar exige o anfitrião aplicar a venda pela regra.
- **Vender do saco tira o peso da morte** para quem vende antes de morrer (escolha do Leonardo). Medir no playtest se a morte ainda dói; o pilar 1 do VISAO.md fala justamente disso.
- **Não é anti-trapaça completo:** quem forjar chamadas à API tira até os tetos por dia. Fechar de vez é o servidor da F2.
- Quem jogou sem conta e criou conta depois não negocia o que tinha antes (não há como provar a origem). Pode gerar reclamação; a saída seria uma anistia nova, decisão do Leonardo.
- A venda do saco mexe no estado da regra fora do `update()` (como `drinkPot()`); na F2 vira entrada.
- Gasto no Mercador não baixa a origem: ela pode passar do cofre, e vale o menor dos dois.

**Próximo passo recomendado:** o Leonardo testar no celular: caçar com conta, vender uma peça do saco pela Mochila, extrair e ver a origem na Feira.

---

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
