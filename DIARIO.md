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

## 2026-10-19 11:23 UTC — sessão manual (nuvem)

**Item desenvolvido:** mapas de caça fixos e a ponte com o Remere's Map Editor (0.41.0), por decisão do Leonardo ("pode publicar na main e seguir com o Remere; o mapa será fixo e igual sempre, não tem aleatoriedade no mapa"). Antes, a 0.37.0 publicou os mapas vestidos (mesclando a `main` 0.36.0). Agora cada lugar tem `hunts.<lugar>.mapa`: pilhas de itens do OTSP por sqm (`c`/`p`/`o`/`v`, `l` para luz), grade em base 64, entrada e um monstro por ponto de spawn; `newRun()` lê com `leMapa()` e cada ponto é uma "sala" de um monstro em `G.rooms` (nasce e renasce ali; a herança da sala da 0.38.0 segue funcionando). `tools/mapas.mjs` gerou os quatro rascunhos a partir de `hunts.<lugar>.rascunho` (o gerador e os enfeites da 0.37.0 viraram ferramenta); `tools/otbm.mjs` exporta e importa `.otbm` (formato OTBM 2, items.otb 3.55, como o `otsp.otbm` salvo pelo RME 3.3), lê o spawn.xml e o waypoint `entrada`, e monta a pasta do editor com os 19 monstros do Fibula; `tools/otsp-itens.json` traz o que é chão, sólido, luz e parede no `items.otb` do OTSP (no OTSP o id do servidor é o do cliente). O desenho pinta a pilha de cada sqm com os padrões e a animação dos itens (`t<id>` no atlas, que foi a 784 KB). Guia em `docs/rme.md`.

**Validação:** `node tools/testar.mjs` — 36/36. A simulação no Node confere, nos quatro lugares: outra semente dá o mesmo mapa e os mesmos monstros nos mesmos sqm; ninguém nasce fora do chão; todo ponto de spawn se alcança da porta; exportar e importar pelo `.otbm` devolve o mesmo mapa. O carregamento recusa lugar sem mapa, linha curta, spawn fora do chão, mapa sem o chefe e entrada fora do chão. O leitor de `.otbm` leu os 10.455 sqm do `otsp.otbm` salvo pelo editor. Capturas dos quatro lugares conferidas.

**Análise:** três testes da `main` supunham o mapa sorteado e foram ajustados ao mapa fixo sem perder o que provam: "sementes 7 e 8" agora exige o **mesmo** mapa; o `spawnNaEntrada` põe dois pontos do monstro mais fraco a 2 sqm da porta; a herança da sala começa no maior grupo de monstros longe do chefe e sai depois do primeiro abate (e não depois de 400 passos). Escolhas de sprite corrigidas pelas regras do OTSP: o caixote 1115 não bloqueia (virou o 1139), a vela 1178 bloqueia e dá luz (virou objeto da Cripta).

**Roadmap:** "Mapas de caça fixos" para `Concluído`; `Agora`: queda de conexão não mata. Saíram "Forma por lugar" e "Bordas de chão" (agora é desenho no editor); entraram "Pincéis do Fibula no editor" e "Redesenhar os lugares no editor".

**Pendências e riscos:** a configuração do RME com o OTSP (pasta de dados da 10.41, cliente renomeado para `Tibia.dat`/`Tibia.spr`, assinatura) não foi testada numa máquina com o editor: está marcada em `docs/rme.md`. O import só lê o andar 7, 64×64 a partir de (1000, 1000), sem escada, casa ou atributo de item. Os quatro mapas são rascunhos do gerador, não desenho com intenção. `content.json` foi a ~100 KB e o atlas a 784 KB (orçamento de 2 MB). `node tools/mapas.mjs --forca` apaga o que foi desenhado no editor.

**Próximo passo recomendado:** o Leonardo configurar o RME pelo `docs/rme.md` e abrir o `esgoto.otbm`; em paralelo, "Pincéis do Fibula no editor" pode ser feito por um agente.

## 2026-10-19 11:11 UTC — sessão manual (nuvem)

**Item desenvolvido:** tela de entrada só com a conta (0.40.0), a pedido do Leonardo ("serve somente para login e criação de login; o personagem deve ser escolhido na tela seguinte"). A primeira tela (`#menu`) ficou com o título, usuário e senha, Entrar, Criar conta e o `#play`: "Jogar sem conta" (um link discreto) sem sessão, "Continuar" com ela. Saíram dela o personagem, o preço da morte e o rodapé. A escolha de personagem (`#pick`) virou a tela seguinte: tocar num personagem entra na cidade (`escolher()`, que só tira da sala e zera a incursão se a classe mudar), cada personagem mostra o preço da morte (`riscoCurto(c)`), os números da conta ganharam o nível, e o rodapé tem Regras e Voltar. O Menu da cidade abre a escolha de personagem.

**Validação:** `node tools/testar.mjs` — 36/36. O harness ganhou `entrar()` (tela de entrada → escolha → cidade), que substituiu os 20 cliques diretos em `#play`; asserções novas: a tela de entrada só tem a conta, "Jogar sem conta" e "Continuar" conforme a sessão, o preço da morte no cartão do personagem, Regras e Voltar na escolha, e o Menu da cidade abrindo a escolha. Prints em 390×844.

**Análise:** "Jogar sem conta" ficou porque jogar sem conta é regra do produto (save no aparelho); se o Leonardo quiser exigir conta, é mudança sensível (dados pessoais e testadores).

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono). `Agora` segue "Mapas de caça fixos".

**Pendências e riscos:** depois de entrar ou criar conta, a tela mostra "Continuar" em vez de ir sozinha para a escolha de personagem, porque o save da nuvem chega depois (assíncrono); ir sozinho exigiria esperar a nuvem.

**Próximo passo recomendado:** o Leonardo abrir no celular; depois, "Mapas de caça fixos" (`Agora`).

---
## 2026-10-19 12:20 UTC — sessão manual (nuvem)

**Item desenvolvido:** correção 0.38.1, a partir da pergunta do Leonardo "por que os alimentos não aparecem na mochila?". Reproduzido no navegador: sozinho (o anfitrião), a comida comprada e a que cai do rato aparecem na janela da Mochila. O defeito era do **convidado da sala**: o retrato do anfitrião mandava só o valor da mochila (`bv`), nunca o conteúdo, e a janela do convidado ficava parada no que ele levou ao entrar — nenhum loot aparecia, comida ou não. O retrato agora leva `bag` de cada jogador e o convidado aplica a dele (`soMochila`).

**Validação:** `node tools/testar.mjs` — 36/36, com asserção nova no `sala-convidado` (a mochila vem no retrato, item inexistente fora, a do anfitrião não muda).

**Análise:** outra causa possível, que não é defeito: a comida comprada na 0.29.0 (quando ficava em `prov`) foi migrada na 0.33.0 para o **cofre do Banco**, não para a mochila; aparece no Banqueiro, com "levar".

**Roadmap:** sem mudança.

**Pendências e riscos:** o retrato cresce ~100 bytes por jogador (a mochila de cada um a 10/s); com 4 na sala continua muito abaixo do limite do Realtime.

**Próximo passo recomendado:** o Leonardo confirmar, como convidado numa sala, que o loot aparece na Mochila.

## 2026-10-19 — sessão manual (nuvem): sucessão do anfitrião da sala, com a masmorra

**Item desenvolvido:** a pedido do Leonardo ("caso o anfitrião feche o servidor, o usuário mais antigo dentro do servidor passa a ser o servidor" e, depois, "o novo anfitrião recebe todos os dados do mapa e mantém o servidor com ele"), 0.38.0. `src/sala.js` separa o canal da sala (`SALA.id`, id de quem criou + contador) do anfitrião de agora (`SALA.anf`) e conta as trocas em `SALA.gen`. O anfitrião manda a **herança** a cada segundo (com alguém dentro; 5 s sem ninguém) e no `passa`: `heranca()`/`adota()` em `src/sim/incursao.js`, o estado inteiro da regra (monstros, jogadores com ficha e saco, projéteis, sacos no chão, salas, sorteio, fonte do campo de fluxo, sqm ocupados), ~20 KB. Quem assume adota a última herança e segue rodando; quem estava dentro continua (`G.convidado` cai e o laço passa a rodar `passo()` aqui). Sem `passa` (fechou o jogo, caiu a rede), a saída é vista pela presença do canal da sala ou por 12 s sem notícia (`sucede()`). Dois anfitriões: `gen` maior, empate pelo id menor (`cede()`). `src/sim/base.js` ganhou `sorteAgora()`/`poeSorte()` (mesma sequência do mulberry32); `buildFlow()` guarda a origem em `G.fsrc`. O lugar do anfitrião em `G.ps` deixou de ser sempre 0 (`meuI()`), e a poção do anfitrião é a de `G.p` (`src/controles.js`).

**Validação:** `node tools/testar.mjs` inteiro verde, depois de mesclar a `main` 0.37.0 (mapas de caça, comida como item, voz, mapas vestidos): a herança leva `G.caca` e as comidas já vistas. Na simulação no Node: com 3 jogadores em combate, quem adota a herança e recebe as mesmas entradas fica **idêntico** ao anfitrião por 400 passos (monstros, abates, sacos, vida, XP); herança com classe inexistente é recusada; tamanho abaixo de 60 KB. Sabotagem (adotar sem o sorteio) barrada. Nos casos `sala-*`: `passa` com a herança, convidado que continua na masmorra quando outro assume, convidado que vira anfitrião sem sair dela (mesma semente, abates e monstros da herança, mesmo sqm) e passa a rodar a regra, recebe gente nova pela porta e manda a própria herança, lista do anfitrião velho ignorada, geração maior leva a sala. Não testado com dois Chromium no Realtime de verdade.

**Análise:** a herança custa uma mensagem por segundo por sala (a cota mensal conta cada entrega: com 4 na sala, +3 por segundo sobre os ~40 do retrato), ~20 KB cada, bem abaixo do limite de tamanho do broadcast.

**Roadmap:** sem mudança de seção (pedido do dono fora da fila).

**Pendências e riscos:**
- A volta de até 1 s na troca: o que aconteceu nesse segundo no aparelho do anfitrião velho (um abate, um saco pego) se desfaz, e acontece de novo ou não. Não duplica nada, porque o resultado de cada um só sai do anfitrião de agora.
- Uma queda curta de rede do anfitrião já dispara a troca; ao voltar ele vê a geração maior e vira convidado. A masmorra dele (que seguiu rodando sozinha) é descartada; quem estava dentro dela, nele, volta à cidade.
- Nenhuma mensagem do canal tem remetente conferido: um terceiro com a chave pode mandar `passa`/`membros` com geração alta, ou uma herança falsa, e tomar a sala. É o mesmo nível de confiança do anfitrião (que já calcula tudo), agora ao alcance de quem conhece o canal.
- `G.pend` não vai na herança (perde-se no máximo o segundo golpe de um ataque múltiplo).

**Próximo passo recomendado:** testar com dois ou três aparelhos de verdade: anfitrião fecha a aba com convidados na masmorra e eles continuam caçando; anfitrião sai pelo Guia.

---

## 2026-10-19 22:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** decisão do Leonardo registrada no guia, sem código. Ele testou a mira manual (0.34.0) no celular e aprovou "por agora": o jogo se joga sempre com duas mãos. O pilar 5 virou "Duas mãos, e pode parar a qualquer hora", a regra passou a dizer que o alvo é apontado pelo jogador, a pergunta 4 do teste das ideias fala em duas mãos, a P10 saiu das pendências e entrou em "Em vigor".

**Validação:** só texto; nenhum arquivo de `src/` tocado.

**Pendências e riscos:** "por agora": se testadores reclamarem do esforço de mirar o ataque básico, o meio-termo conversado é alvo automático só no ataque básico e mira nas magias fortes. O Balanceamento não deve supor que todo tiro acerta.

## 2026-10-19 10:42 UTC — sessão manual (nuvem)

**Item desenvolvido:** mapas vestidos (0.37.0), a pedido do Leonardo ("o mapa está pobre para a arte do Tibia que temos"). Objetos sólidos por lugar em `hunts.<k>.mapa.objetos` (pilar, barril, caixote, rocha, sarcófago, gárgula, estátua, palmeira, cacto), postos por `objetos()` em `src/sim/mapa.js` com um hash da semente — não com o sorteio da regra, para a sequência de monstros, dano e loot não mudar — e recusados se fecharem caminho. Ficam em `G.g` com o valor 2: `solid()` passou a ser `g!==0`, o campo de fluxo e o projétil já paravam neles, `pecas()` só monta parede no valor 1 e o spawn pula o sqm de objeto. No desenho, `vesteMapa()` monta uma vez por masmorra a variante do chão, o detalhe (`arte.detalhes`: teias, pedrinhas, sangue, ossadas, grade, lodo, tufos, velas) e o sprite de cada objeto; a Ilha trocou o muro por mata (`arte.borda`). 54 sprites novos do OTSP (atlas de 502 KB para 584 KB). Plano das fases seguintes e pesquisa de fontes legais de mapa em `docs/plano-mapas.md`.

**Validação:** `node tools/testar.mjs` — 34/34. A simulação no Node agora confere, nos quatro lugares: há objetos, a mesma semente dá os mesmos objetos, nenhum monstro ou jogador nasce em cima de parede ou objeto, e todo chão continua alcançável da entrada; o carregamento recusa objeto com `onde` desconhecido e detalhe sem sprite. Capturas em 900×640 e 360×640 dos quatro lugares conferidas (em 30 sementes: 18 a 51 objetos por mapa, em média).

**Análise:** não existe mapa grande do Tibia que se possa baixar legalmente: os "real maps" dos servidores OT (Canary/OTServBR, conversões 7.7) são o mapa da CipSoft, e a licença do código do servidor não cobre o mapa. O único livre é o `otsp.otbm` do próprio OTSP (CC BY 4.0), uma demonstração de ~117×90 sqm, junto com os `rme_files` para o Remere's Map Editor. Os ids do OTSP não batem com os do Tibia, então todo mapa nosso tem de nascer no OTSP.

**Roadmap:** `Agora` (mapas fixos) ganhou a nota das duas sementes (mapa fixa, caçada nova). `Próximo` ganhou 8 (forma por lugar) e 9 (bordas de chão); `Depois`, mapas desenhados no editor (decisão do Leonardo). A 0.29.0 foi para `Concluído`.

**Pendências e riscos:** enquanto o mapa não for fixo, os objetos são só enfeite, não marco. Objeto de 64 px pode esconder monstro atrás (como no Tibia; nome e vida ficam por cima). O spawn pula o sqm de objeto, então pode nascer um monstro a menos numa sala; o Balanceamento deve contar isso ao medir horas por nível. Nas capturas locais o navegador headless entrou uma vez no canal real da cidade (Realtime) antes de eu bloquear a rede: só presença, por segundos.

**Próximo passo recomendado:** "Mapas de caça fixos" (`Agora`), separando a semente do mapa da semente da caçada.
## 2026-10-19 10:51 UTC — sessão manual (nuvem)

**Item desenvolvido:** a comida virou item (0.36.0), a pedido do Leonardo ("animais também devem ter loot de comidas para guardar na mochila ou no cofre"). `items` ganhou seis comidas com `comida` (segundos): frutas, queijo, presunto, ensopado, carne e presunto de dragão (720 s). Loot: rato → queijo; leão → carne e presunto; orc e troll → carne; dragão → presunto de dragão. As provisões de comida da Quitanda viraram `efeito.item`: a compra vai direto para a mochila do personagem (recusa com a mochila cheia). `comer()` tira da mochila (`p.bag`); saíram `p.com` e `devolveComida()`, porque a mochila já volta extraindo e cai morrendo. No Banco, a comida guardada fica como item no cofre (`save.mats`, como os tesouros da 0.32.0), com "levar" a pilha inteira e sem "vender"; `normaliza()` move a comida da 0.29.0 (em `prov`) para lá. Sprites `it_*` das comidas no atlas (`tools/sprites.mjs`; o presunto de dragão é o pernil do pacote com o matiz girado).

**Validação:** `node tools/testar.mjs` — 35/35 (simulação no Node refeita para comida-item: compra na mochila, mochila cheia, migração da 0.29.0, loot dos animais, comer da mochila, extrair/morrer, Banco guardar e levar; casos `lojas`, `sala-anfitriao` e `sala-convidado` ajustados). Capturas do Banco em 375×740.

**Análise:** mesclado com a 0.32.0, que passou a guardar tudo o que não se veste em `save.mats`; o cofre de comida separado que eu tinha feito saiu, e a comida usa o mesmo lugar. `save.itens` (só peças) é o que a Feira e a origem conhecem, então **comida não se negocia na Feira**.

**Roadmap:** item fora da fila (pedido do dono), decisão na Parte 6 do `CLAUDE.md`.

**Pendências e riscos:**
- Só cinco monstros derrubam comida; insetos, morcego e mortos-vivos não (como no Tibia). No Esgoto (nível 1) só há insetos e morcego: quem caça lá depende da Quitanda.
- Comida ocupa uma casa da mochila por tipo: com 20 casas, carregar vários tipos aperta o loot.
- Personagem novo sem ouro continua entrando sem comida (pendência da 0.29.0).
- Comida não vai à Feira; se o Leonardo quiser, é mudança no banco (`003_mercado.sql`, `004_origem.sql`).

**Próximo passo recomendado:** caçar ratos no nível 1 e ver se o queijo (30%) segura a regeneração; ajustar as chances no `content.json`.

---

## 2026-10-19 10:52 UTC — sessão manual (nuvem)

**Item desenvolvido:** Grimório só na cidade e troca de personagem só na tela inicial (0.35.0), a pedido do Leonardo. Saíram o `#toGrim` do rodapé da tela inicial e o `#cPick` da cidade. O Grimório continua no botão `#cGrim` da cidade, e Personagens, no rodapé e na linha do personagem da tela inicial.

**Validação:** `node tools/testar.mjs` — 36/36. Asserções novas: sem Grimório na tela inicial e sem Personagens na cidade. Os casos `equipamento` (trocar para o Cavaleiro passa pelo Menu), `classes` e `grimorio` (o Grimório abre na cidade e volta a ela) foram ajustados.

**Análise:** trocar de personagem tirava da sala (`escolher()` chama `saiDaSala()`); agora isso só acontece fora do jogo, na tela inicial.

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono). `Agora` segue "Mapas de caça fixos".

**Pendências e riscos:** nenhuma nova.

**Próximo passo recomendado:** "Mapas de caça fixos" (`Agora`).

---
## 2026-10-19 21:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** mira manual das habilidades (0.34.0), teste pedido pelo Leonardo, fora da fila. O botão da habilidade virou joystick (`src/controles.js`: apertar mostra a mira, arrastar escolhe direção e, na bomba, distância; soltar lança; voltar ao botão cancela; tocar lança para onde se olha). Em `src/sim/combate.js` saíram `target()` e `miraEm()`: o tiro vai reto até o alcance e para no primeiro monstro ou na parede, mostrando o efeito onde se desfaz; o golpe sai sem alvo; a bomba cai no ponto escolhido (cortada pela parede); o feixe para na parede. `formaMira()` diz à tela o que desenhar (`desenhaMira()` em `src/desenho.js`). Na sala, o convidado manda `ma`/`md` com a entrada.

**Validação:** `node tools/testar.mjs` — 35/35, depois de mesclar a main (0.32.0). Sonda nova na simulação no Node: tiro para o lado oposto não acerta, gasta a mana e mostra o efeito; tiro mirado acerta. Visto em 360×640 com o Chromium: mira tracejada cortada pela parede e efeito de fogo no ponto do erro.

**Análise:** os testes que lutam (simulação no Node, `incursao-extracao`, `arte`) contavam com o alvo automático; agora o jogador do teste mira no monstro mais perto (`P.miraBot` na cópia; no Node, uma mira lida dentro de cada passo da regra, para não depender do quadro).

**Roadmap:** sem mudança; é teste do dono.

**Pendências e riscos:** contraria a regra do pilar 5 ("alvo escolhido pelo jogo"); registrado como P10 na Parte 6, sensível. Risco: com uma mão, mirar e andar ao mesmo tempo não dá; o Cavaleiro e o Paladino perdem mais. O Balanceamento não deve medir dano por caçada como se a mira acertasse sempre.

**Próximo passo recomendado:** esperar o veredito do Leonardo; se a mira ficar, reescrever a regra do pilar 5 e pensar em mira automática só no ataque básico.

## 2026-10-19 10:47 UTC — sessão manual (nuvem)

**Item desenvolvido:** armas de quem começa (0.33.0), a pedido do Leonardo. Dois itens novos no `content.json`, `faca` (+2% de dano) e `espadamadeira` (+3%), `val` 0, com sprites do OTSP (ids 1750 e 1748, tabela `ARTE` do `tools/sprites.mjs`, atlas regerado). Ficam no chão da casa sem morador ao norte da praça (sqm 37,6 e 39,6). `city.chao` ganhou o campo `respawn` (segundos, 120 nelas): pisar leva à mochila se couber (`pegaPraMochila()`), cheia fica no chão com aviso, e a peça volta ao sqm depois do tempo, só se o jogador não estiver em cima. As peças de teste sem `respawn` seguem como antes (cofre, uma vez por conta). No Banco, peça de `val` 0 mostra "jogar fora" em vez de "vender 0" e não chama `lastro_banco`; a Feira não lista peça de `val` 0.

**Validação:** `node tools/testar.mjs` — 36/36 (depois de mesclar a 0.32.0). Caso novo `armas-que-renascem` (pega para a mochila, não marca `save.chao`, não renasce com o jogador em cima, renasce ao sair, mochila cheia deixa no chão); `validaConteudo()` recusa `respawn` 0. Captura em 360×640 da casa com as duas armas e da coleta.

**Análise:** pilar 6 — recurso infinito sem ralo seria ouro grátis, por isso `val` 0 (não vira ouro, não tem origem, não entra na Feira). O relógio do respawn é de cada aparelho e só corre com o jogador na cidade; recarregar a página zera e a peça volta na hora. Aceito porque a peça não vale nada; se um dia valer, o relógio precisa ir para o save ou para o servidor.

**Roadmap:** item fora da fila (pedido do dono).

**Pendências e riscos:** a peça renasce para quem está no aparelho, não é compartilhada na cidade do Realtime (cada um vê a sua). Ninguém perde nada com isso, mas não é "o mesmo mundo para todos" em sentido estrito; quando a cidade for do servidor (F3), o respawn vai junto.

**Próximo passo recomendado:** seguir a fila do `ROADMAP.md`.

---
## 2026-10-19 19:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** o cofre do Banco com tudo como item (0.32.0), a pedido do Leonardo ("tenho itens dos animais mas não aparece"; "o Banqueiro deve ter a lista completa do baú com todos os itens"). A mochila persistente já tinha entrado na `main` por outra sessão (`b3f8603`); faltava o baú: `guardaSaco()` mandava material para o depósito do Gordon (que o Banco não mostra) e transformava gema e coroa em ouro. Agora só a moeda vira ouro; peça vai para `save.itens` e todo o resto, como item, para `save.mats`. O Banco lista o cofre inteiro (`linhaObj()` em `src/telas.js`): tesouro se vende pelo valor, material não (só o Gordon compra), e os dois voltam à mochila com `leva()` (a pilha inteira). Uma primeira versão feita em paralelo, sobre a 0.19.0 (`claude/mochila-bau`), foi abandonada para não duplicar a mochila da `main`.

**Validação:** `node tools/testar.mjs` — 34/34. Simulação no Node: guardar deixa gema e dente como item, o Banco vende gema e recusa dente, levar a pilha de seda. Casos `banco-mochila` (cofre lista espada, gema e seda; vender a gema; levar a seda) e `forja` reescritos. Tela do Banco conferida em 360×740.

**Análise:** a origem (`caca_fim`) continua creditando como ouro o valor dos tesouros que a caçada rendeu, como antes; vender o tesouro depois no Banco não credita de novo (`lastro_banco` sai cedo sem a peça na origem). Material continua sem origem.

**Roadmap:** fora da fila (pedido do dono).

**Pendências e riscos:**
- Gema e coroa ficam no cofre até alguém vender no Banco: um toque a mais, mas é o que o Leonardo pediu (ver todos os itens).
- `save.mats` agora guarda tesouro também; a Forja só lista o que o Gordon compra, então não muda nada lá.
- A comida que sobra e for guardada no Banco vira item no cofre (antes virava ouro); dá para levar de volta na mochila.

**Próximo passo recomendado:** o Leonardo abrir o Banco depois de uma caçada e dizer se a lista do cofre ficou clara.

---

## 2026-10-19 10:43 UTC — sessão manual (nuvem)

**Item desenvolvido:** tela inicial curta, com Regras e créditos (0.31.0), a pedido do Leonardo ("minimalista, poucas coisas escritas, um botão de regras; manter a facilidade de criar usuário e senha"). Decisões dele: o título é **Fibula**, o Grimório fica no rodapé, os créditos entram nas Regras. A tela tem o personagem (toque abre Personagens), o preço da morte em uma linha (`riscoCurto()`), Jogar, a conta com os mesmos campos e botões (o texto de apoio só aparece com mensagem) e o rodapé Regras · Personagens · Grimório. A grade de números foi para Personagens (`#pStats`); as instruções numeradas, que ainda falavam do portal de 1:30, viraram a tela `#regras` (`showRegras()`), com perda de XP, espaços da mochila, tempo na porta e lugares de caça lidos do `content.json`. Sem personagem, a tela inicial pede Criar personagem e mostra o login antes, para quem tem conta não criar um personagem à toa num aparelho novo.

**Validação:** `node tools/testar.mjs` — 34/34. Asserções novas no caso do menu: Jogar visível sem rolar, sem grade nem instruções, as Regras com os números do `content.json` (buscado à parte pelo roteiro), todos os lugares, versão, links do OTSP e da CC BY 4.0, e nenhuma menção a "1:30" ou "portal abre". Os casos `classes`, `morte` e `save-corrompido` mudaram para o fluxo novo. Prints em 390×844 e 360×640 (tudo cabe sem rolar).

**Análise:** o texto de regras escrito à mão envelheceu duas versões sem ninguém notar; o caso novo barra a volta do relógio, e os números vêm dos dados.

**Roadmap:** "Tela de créditos" saiu de `Próximo` e foi para `Concluído`. `Agora` segue "Mapas de caça fixos".

**Pendências e riscos:** o texto das Regras ainda é fixo fora dos números: quando a morte da opção B entrar, a seção "A morte" precisa mudar junto (o item 4 da fila diz isso). O `README.md` também tinha o portal de 1:30 e foi corrigido.

**Próximo passo recomendado:** o Leonardo abrir no celular e dizer se a tela inicial ficou como queria; depois, "Mapas de caça fixos" (`Agora`).

---

## 2026-10-19 10:50 UTC — sessão manual (nuvem)

**Item desenvolvido:** voz na sala de caçar junto (0.30.0), a pedido do Leonardo ("captação e envio de áudio para os usuários falarem"). Ele aceitou o STUN público como exceção à regra de não falar com outro servidor; voz só na sala, não na cidade aberta. Módulo novo `src/voz.js`: WebRTC nativo em malha, apresentação (`oi`, `oferta`, `resposta`, `tchau`) pelo canal da sala (`sinal()` em `src/sala.js`), segurar para falar (`#bVoz` acima de Comer, ou V), quem fala no botão, "Ligar voz"/"Desligar voz" no Guia de caça. Sair ou fechar a sala desliga a voz.

**Validação:** mesclada com a `main` até a 0.29.0 (sala sem tempo, cidade maior, alimentação, guia único); o botão Voz subiu para cima de Comer. `node tools/testar.mjs` — 35/35, com o caso novo `voz-na-sala` (18 asserções, conexão WebRTC de verdade no Chromium headless: oferta com candidatos, resposta ao id menor, mudo sem segurar, som ao segurar, quem fala, estranho recusado, tchau, desligar ao fechar a sala). O caso rodou 6 vezes sozinho sem falhar. A cidade com o botão foi olhada em 390×844.

**Análise:** o microfone falso do Chromium só alimenta uma captura por vez; o lado de teste usa um tom do WebAudio. No harness o tempo do jogo corre mais que o relógio, então os prazos da voz são do `performance.now()`, não do `dt`.

**Roadmap:** "Voz na sala" em `Concluído`, fora da fila (pedido do dono). `Agora` não mudou.

**Pendências e riscos:**
- **Sem TURN.** Quem está atrás de CGNAT (comum no 4G) pode não ligar com alguém; o jogo avisa "Sem voz com Fulano" depois de 2 tentativas. Medir com o Leonardo em celulares reais (Wi-Fi × 4G) antes de decidir por um TURN, que custa e é outro serviço externo.
- **Não testado em iPhone.** O Safari pode exigir toque para tocar áudio que chega; o `play()` que falha é engolido em silêncio. Se alguém não ouvir no iPhone, o caminho é tocar de novo no botão Voz (o toque destrava o áudio).
- O WebRTC mostra o IP de cada um aos outros da sala. É aceitável entre amigos; para desconhecidos precisa de TURN obrigatório ou do servidor da F2.
- Com a aba no fundo, a voz pode cair (principalmente no iOS); volta ao reabrir, pelo `oi` a cada 5 s.

**Próximo passo recomendado:** o Leonardo testar a voz com um amigo em 4G e em Wi-Fi e dizer se ligou e se o atraso está bom.

---

## 2026-10-19 10:35 UTC — sessão manual (nuvem)

**Item desenvolvido:** alimentação como no Tibia (0.29.0), a pedido do Leonardo. Sem comida não se regenera vida nem mana; a regeneração é a da classe (`rhp`, `rmp`), fixa, e só corre com `p.ali > 0`. Cada comida tem `efeito.comida` em segundos (frutas 90 s/15 ouro, queijo 180 s/25, presunto 300 s/40, ensopado 540 s/60), até `progression.comida.max` = 1200 s. Botão Comer no HUD (tecla C), acima da Mochila: come a menor comida que o jogador levou, mostra o tempo que falta ou "Fome". A comida empilha na loja (até 10 de cada, sem o grupo "refeição"), vai na mochila (`p.com`) e o que sobra volta ao estoque só extraindo (`devolveComida()`); na sala, o convidado pede pelo contador `com` e o `fim` traz a sobra.

**Validação:** `node tools/testar.mjs` — 34/34. Simulação no Node: entra com fome, não regenera, come a menor, regenera o da classe, recusa passar do máximo, para quando acaba, sobra volta extraindo e não volta morrendo. Casos `lojas` (compra, botão Comer, HUD), `sala-anfitriao` (o anfitrião come pelo convidado, retrato com `ali` e `com`) e `sala-convidado` (tecla C vira pedido; `fim` devolve só comida que existe). Captura em 375×740 do HUD com fome e alimentado.

**Análise:** as taxas `rhp`/`rmp` das classes foram calibradas quando a regeneração era permanente e somada ao bônus da comida antiga (até +3/s). Agora o alimentado regenera só o da classe, e o faminto nada: a caçada ficou mais dura, sobretudo para o cavaleiro (2,6 de vida/s) e para quem não tem ouro para comida. Mesclado com a 0.28.0 (guia único, mundo igual para todos): os conflitos foram só nas linhas de `import`.

**Roadmap:** item fora da fila (pedido do dono), decisão na Parte 6 do `CLAUDE.md`.

**Pendências e riscos:**
- **Jogador novo sem ouro entra sem comida** e não regenera: só as 3 poções o sustentam. Considerar comida de saída para personagem novo (como o Tibia dá em Rookgaard) ou um preço de frutas que caiba na primeira caçada.
- **Balanceamento das taxas da classe** precisa ser refeito com a regeneração condicionada; medir no pilar 3 (nível 20 em ~3 h).
- O botão come sempre a menor comida; não há escolha de qual comer. Se o Leonardo quiser escolher, o caminho é pela Mochila.
- `comer()` roda fora do `update()`, como `drinkPot()`: na F2 vira entrada (`ent`).

**Próximo passo recomendado:** o Leonardo jogar uma caçada com e sem comida e decidir se o personagem novo ganha comida de saída.

## 2026-10-19 10:20 UTC — sessão manual (nuvem)

**Item desenvolvido:** um guia só e o mundo igual para todos (0.28.0), por decisão do Leonardo. (1) O `VISAO.md`, o `docs/PRD.md` e as seis instruções de `docs/agentes/` viraram um único `CLAUDE.md` em seis partes (jogo, produto, código, testes, agentes, decisões), sem contradição entre si: o princípio-mãe "a realidade como ela é" e os seis pilares novos (mundo igual para todos; mundo fixo que se aprende; evoluir lento, nível 20 em ~3 h; morte cara da opção B, sempre visível e nunca pela rede; uma mão e parar a qualquer hora; todo recurso com ralo). Cada pilar tem regra verificável e "estado hoje". O `AGENTS.md` só aponta para o guia; `docs/analise-tibia-habilidades.md` e `docs/plano-multiplayer.md` ficaram como referência. Só o `modo.txt` continua em `docs/agentes/`. (2) Os monstros deixaram de escalar com o nível e com o grupo: saíram `hpPerCharLevel`, `bossLevelFactor`, `party.monsters` e `party.bossHp` (e o respawn que crescia com o grupo); o `validaConteudo()` recusa esses campos.

**Validação:** `node tools/testar.mjs` — 32/32. A simulação no Node troca "o grupo põe mais monstros" por "o mesmo mundo para 1 ou 4 jogadores, de nível 1 ou 30" (monstro, sqm e vida). Sabotagem (monstros vezes o tamanho do grupo numa cópia) barrada com a mensagem certa.

**Análise:** a fila estava presa em "Sair cedo" desde 18/10, um item que perdeu o sentido quando a caçada virou sala sem relógio. O mapa de caça ainda é sorteado a cada sala, o que fere o pilar 2.

**Roadmap:** fila refeita pelos pilares. `Agora`: mapas de caça fixos. `Próximo`: queda de conexão não mata; saída segura perto; medir o ritmo até o nível 20; morte da opção B; créditos; PWA; escada de lugares. Saíram "Sair cedo", "Revisar a escala de HP", "Selo de resguardo" e "três profundidades".

**Pendências e riscos:** jogador de nível alto agora acha os lugares baixos fáceis — é o pilar 1 funcionando, mas falta lugar acima do nível 15 (item 7). As quatro tarefas agendadas ainda mandam ler `docs/agentes/comum.md` e `docs/agentes/<papel>.md` (a instrução só pode ser trocada na conversa de cada uma); esses arquivos agora só redirecionam para o `CLAUDE.md`. O ciclo continua `pausado`. Pendências do dono na Parte 6: P7 (venda do saco na caçada, sensível, em conflito com o pilar 4), P8 (saída a ≤ 60 s), P9 (números da morte B, sensível).

**Próximo passo recomendado:** "Mapas de caça fixos" (`Agora`).
## 2026-10-20 01:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** mochila e cofre como no Tibia (0.27.0), a pedido do Leonardo ("apenas com a mochila e o cofre"). O saco deixou de existir como inventário: `p.bag` é a mochila durante a caçada, começa com `ch().mochila` e volta para ela na extração; a morte a esvazia. O Banco ganhou "Guardar tudo", "guardar" por linha, "levar" nas peças do cofre e "Retirar" ouro. Mochila de 20 espaços (`progression.mochila.espacos`), peça de equipamento ocupa um, o resto empilha; cheia, o que não cabe fica no chão.

**Validação:** `node tools/testar.mjs` — 34/34 (caso novo `banco-mochila`; bloco novo da mochila na simulação no Node: entrar com ela, extrair sem cofre, morrer esvaziando com o selo, guardar, levar, retirar, mochila cheia deixando loot no chão, `normaliza()` e `confereFicha()` limpando item inexistente). Banco e Mochila conferidos em captura de 390×844.

**Análise:** mesclado com a 0.26.0 (vestir pela Mochila) e a 0.26.1 (vestida ganha origem na morte), feitas em paralelo: na cidade a troca passou a ser com a mochila, não com o cofre, e tirar só sai se couber; `pecasDaCaca()` desconta `p.bag0`, para a origem não contar de novo o que entrou na mochila. A conversão automática (ouro, gema, peça, material) que a extração fazia em `guardaSaco()` foi mantida, só mudou de hora: acontece no Banco. Por isso o servidor da Feira não mudou (`itens` e `cofre` continuam sendo o cofre). Na sala, a ficha do convidado agora leva a mochila (`confereFicha()` limpa) e o `fim` do anfitrião vira a mochila do convidado.

**Roadmap:** item fora da fila (pedido do dono), decisão na seção 15.1 do PRD.

**Pendências e riscos:**
- **Fechar o jogo no meio da caçada preserva a mochila** com que se entrou (só o ganho da caçada se perde, e nenhum XP). Já era assim com o XP; com a mochila valendo mais, o incentivo a fechar o app antes de morrer cresce. Corrigir pede esvaziar a mochila ao entrar e devolvê-la ao sair, cuidando do anfitrião que cria a sala com o próprio jogador "fora".
- **Origem (lastro) a mais:** a extração credita na origem o que a caçada rendeu, mas se o jogador morrer depois com aquilo na mochila a origem não diminui. Só quem edita o save tira proveito, e só até esse teto.
- O cofre não tem limite de espaços (o Leonardo citou espaços no banco também); com peças empilhando por tipo no save, um limite precisaria contar peça por peça e decidir o que fazer com quem já passou dele.
- A mochila cheia é um freio novo à ganância (pilar 4): medir com o Balanceamento se 20 espaços apertam ou sobram nos mapas fundos.
- Gema e coroa só viram ouro no Banco; não há NPC que compre loot avulso, de propósito por enquanto.

**Próximo passo recomendado:** o Leonardo jogar duas caçadas seguidas sem passar no Banco e morrer na segunda, para sentir se a perda está legível; decidir se fechar o app deve contar como morte.

## 2026-10-20 00:20 UTC — sessão manual (nuvem)

**Item desenvolvido:** peça vestida na caçada ganha origem também na morte (0.26.1), a pedido do Leonardo (o item 1 das pendências da 0.26.0). Migração `tools/supabase/005_vestidas.sql`, aplicada no banco pelo conector: a `caca_fim` (mesma assinatura) dá origem, na morte ou no desabamento, às peças que o cliente manda em `p_saco`, no máximo 3 e dentro dos limites de 30 por caçada e 60 por dia; passar do limite não desfaz a morte, só zera as peças. O cliente manda na morte `vestidasDaCaca(p)` (`src/sim/combate.js`): o saldo positivo de `p.troca`, as vestidas do saco que ainda estão no corpo.

**Validação:** `node tools/testar.mjs` — 33/33, com o caso novo `vestida-morte` (vestir a espada do saco pela Mochila, morrer: a caçada fecha com `{"espada":1}`, a origem sobe e a espada segue vestida) e a conferência no Node de `vestidasDaCaca()`. Sabotagem (morte mandando `{}`) barrada. No banco: a função nova está no ar e o `anon` continua executando.

**Análise:** compatível com o cliente antigo, que manda `{}` na morte. O Supabase falso dos testes passou a imitar a regra (até 3 peças fora da extração).

**Roadmap:** sem mudança.

**Pendências e riscos:**
- Quem forjar a chamada ganha origem para até 3 peças por morte, sem o piso de 85 s da extração; o teto diário de 60 continua valendo. Não testei a função contra o banco de verdade com uma caçada real (só a leitura da definição e da permissão).
- Peça vestida, tirada para o saco e morta perde-se, como o resto do saco, mas a origem dela (se tinha) fica sobrando no lastro: inofensivo, como já era com venda ao Banco.

**Próximo passo recomendado:** o Leonardo vestir uma peça na caçada, morrer e anunciá-la na Feira.

## 2026-10-19 23:55 UTC — sessão manual (nuvem)

**Item desenvolvido:** vestir e tirar pela Mochila (0.26.0), a pedido do Leonardo ("como o personagem vai equipar? não existe ferramenta para isso"), com a decisão dele de valer também na caçada, como no Tibia. Tocar numa peça mostra um botão grande abaixo do corpo: na cidade, **Vestir/Trocar** (do cofre, `equipar()`) e **Guardar no cofre** (`desequipar()`); na caçada, **Vestir/Trocar** do saco e **Tirar para o saco** (`vesteDoSaco()`/`tiraProSaco()`, em `src/sim/combate.js`). Vida e mana máximas mudam na hora, a atual não sobe (senão tirar e pôr cura). `p.troca` guarda o saldo de peças que entraram e saíram do corpo, e `pecasDaCaca()` manda à `caca_fim` o saco corrigido por ele. A descrição, o botão e a venda na Feira subiram para logo abaixo do corpo, senão o botão ficava fora da tela.

**Validação:** `node tools/testar.mjs` — 32/32. No Node: vestir do saco, tirar para o saco, vida máxima ±15 sem curar, origem só do que veio da caçada, nada depois de sair. No caso `mochila`: guardar e vestir na cidade (o save muda), trocar na caçada (saco 220→228, bônus da espada) e a espada fica no corpo depois do fim. Sabotagem (trocar cura) barrada. Print em 390×844.

**Análise:** vestir sai do cliente direto na regra, como a venda do saco já fazia (fora de `update()`); no solo não muda o determinismo de nada que os testes medem. Na sala de caçar junto os botões não aparecem: a ficha é do anfitrião.

**Roadmap:** item novo em `Concluído`, fora da fila (pedido do dono). `Agora` continua "sair cedo".

**Pendências e riscos:**
- **(Resolvido na 0.26.1.)** **Peça vestida na caçada e morte = peça sem origem na nuvem.** A `caca_fim` só dá origem na extração; quem veste do saco e morre fica com a peça, mas não consegue anunciá-la na Feira (`sem_origem`). Vender ao Banco funciona. Resolver pede mudar a `caca_fim` para aceitar as peças vestidas também na morte.
- Vestir do saco é uma forma de proteger loot da morte (só uma peça por casa, e a do corpo vai para o risco). Ficar de olho se a morte perde peso.
- O convidado da sala não vê os botões (a ficha dele é do anfitrião). Na mescla com a 0.25.0 (toda caçada numa sala), a venda do saco na Feira tinha ficado desligada para todos (`!G.sala`); voltou para quem não é convidado (`!G.convidado`). Quando o servidor da F2 existir, vestir vira entrada (`ent`) da regra.

**Próximo passo recomendado:** o Leonardo vestir uma peça no meio da caçada e dizer se o fluxo está claro; depois, "Sair cedo" (`Agora`).

## 2026-10-19 23:40 UTC — sessão manual (nuvem)

**Item desenvolvido:** toda caçada é numa sala (0.25.0), a pedido do Leonardo ("área de caça só acessível criando um servidor compartilhado ou entrando em um existente"), e a correção do "Entrar pela porta" que não respondia no celular.

**Validação:** `node tools/testar.mjs` — 32/32. Asserções novas: o anfitrião entra pela porta com o canal da sala caído; fora de sala, cada lugar só oferece "criar sala", que cria e já entra; a chegada não promete relógio. O canal `sala-` do Realtime de verdade foi testado do contêiner (join e presença ok).

**Análise:** o botão da porta ficava desabilitado sempre que o canal da sala não estava `ligado`, até para o anfitrião, que não precisa dele; e `.ghost:disabled` não tinha estilo, então parecia clicável. No iPhone o WebSocket cai com frequência, e era isso que o Leonardo via. A mescla com a 0.23.0 (mapas de caça novos) refez o Guia; a mudança foi reaplicada por cima: um botão por lugar ("criar sala" / "pela porta" / "outra sala"), "criar sala" não depende mais da rede.

**Roadmap:** item fora da fila (pedido do dono), decisão na seção 15 do PRD.

**Pendências e riscos:**
- **O pilar 4 mudou** (VISAO revista): sem relógio, o arco depende só do saco e da morte. Se ficar for sempre melhor que sair, a decisão de ir embora morre. Medir com o agente de Balanceamento: tempo médio de caçada e valor do saco por minuto.
- A incursão solo com relógio continua no código (`start()` sem `prepara`) e nos testes, mas o jogador não a alcança. Se o relógio não voltar, pode sair numa limpeza futura; muitos casos (extração, morte, desabamento) dependem dela hoje.
- Sala de um ainda abre o canal do Realtime e anuncia presença: custo pequeno, mas cresce com jogadores sozinhos.
- Cada entrada pela porta gasta as provisões de novo (já anotado na entrada da 0.20.0).

**Próximo passo recomendado:** o Leonardo testar no celular criar sala, entrar, sair e entrar de novo; depois, decidir se volta algum limite de tempo.
## 2026-10-19 04:00 UTC — sessão manual (nuvem)

**Item desenvolvido:** a entrada do Esgoto virou uma grade no chão (0.24.0), a pedido do Leonardo ("troque a entrada do esgoto por uma entrada ao invés de um NPC, com a imagem de um esgoto da cidade"). O NPC `vigia` saiu; entrou `city.npcs.grade` com `lugar: true` e `acao: "Descer"`, na rua sul (20,32), desenhado com o item 999 do OTSP ("sewers") deitado no chão. Um NPC-lugar não bloqueia o caminho (`entraCidade()`), quem volta do Esgoto sai em cima dele, o botão diz a `acao` em vez de "Falar" e o registro mostra só a frase, sem "Nome:". Sem a arte, uma grade redonda desenhada em código.

**Validação:** `node tools/testar.mjs` — 32/32; o caso `mapas-de-caca` confere que a grade não é sólida, que a volta é em cima dela e que o botão diz "Descer" com o rótulo acessível. Tela conferida em 390×780 com o atlas.

**Análise:** `lugar` e `acao` são campos genéricos do NPC, validados em `validaConteudo()`; servem para a próxima entrada que não é pessoa (um alçapão, uma escada de cripta).

**Roadmap:** sem mudança.

**Pendências e riscos:** a grade fica perto da borda sul do mapa, então a câmera presa à borda a deixa colada aos botões no celular; se incomodar, subir a grade uma ou duas linhas.

**Próximo passo recomendado:** o Leonardo descer pela grade no celular e dizer se a posição está boa.
