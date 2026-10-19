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

## 2026-10-19 16:30 UTC — sessão manual (nuvem)

**Item desenvolvido:** o mundo em volta da cidade (0.45.0), pedido do Leonardo: a cidade de hoje cercada por muralha, com portões abertos ("porta, não portal mágico"), e fora dela estradas, vilas e matas para explorar e, mais tarde, achar os próximos lugares de caça; sem monstros por enquanto. `tools/mundo.mjs` gera `city.mapa` (240×180, antes 54×38), `city.regioes` (15 nomes anunciados ao entrar) e `city.mundo` (semente e retângulo da cidade, que o script não toca). O portão `P` virou chão; a muralha mostra a face de fora; o mapa do canto mostra uma janela de 64 sqm; `city.chao` foi deslocado para as coordenadas do mundo.

**Validação:** `node tools/testar.mjs` completo, todos verdes. Casos `chao-da-cidade` e `armas-que-renascem` passaram a usar as coordenadas do mundo (+93, +71). Simulação no Node ganhou: quatro portões abertos, toda região alcançável a pé do `@`, sair pelo portão sul e voltar anuncia a cidade, região fora do mapa recusada. Telas conferidas em 360×640 (portão sul, Vila da Ponte, muralha, Vila do Cais, Ruínas). Download: `content.json` 21 → 29 KB em gzip; total 573 KB.

**Análise:** o mundo é texto no `content.json` como a cidade era; a 2 sqm/s, do centro à borda leva perto de 1 min no nível 1. Nenhuma regra de jogo mudou: lá fora não se ganha nem se perde nada. O não-objetivo "mapa contínuo" foi reescrito para "mapa contínuo de caça", com a decisão registrada na Parte 6.

**Roadmap:** item novo direto em `Concluído`; o item "Escada de lugares de caça" diz que a entrada pode ficar numa clareira do mundo.

**Pendências e riscos:** rodar `node tools/mundo.mjs` de novo apaga edição à mão fora dos muros (a cidade fica). O portão é só um vão na muralha, sem sprite de portão; um portão aberto do OTSP pede `tools/sprites.mjs` com o `cwebp`. Quem está numa versão velha não vê quem está na nova (o canal da cidade é por versão), como sempre. Pilar 5: andar longe sem nada a decidir é tempo morto; enquanto o mundo não tiver entradas de caça, ele é passeio opcional (os NPCs continuam todos dentro dos muros).

**Próximo passo recomendado:** pôr a entrada de um lugar de caça numa clareira (item 6 da fila).

## 2026-10-19 15:10 UTC — sessão manual (nuvem)

**Item desenvolvido:** atlas em WebP sem perda (0.44.0), por decisão do Leonardo ("pode usar o cwebp, execute"). `tools/sprites.mjs` grava o PNG e, pelo `cwebp` (`-lossless -z 9 -exact -metadata none`; PATH ou `FIBULA_CWEBP`), o `atlas.webp`; sem o `cwebp`, para antes de gravar. `src/arte.js` pede o WebP e, se não abrir, o PNG; `ART.url` guarda o que chegou e os ícones da interface usam ele. O harness copia o WebP, conta o WebP no orçamento, confere no caso `arte` que o WebP tem os mesmos pixels do PNG e prova a volta para o PNG no caso novo `arte-sem-webp`.

**Validação:** `node tools/testar.mjs` completo, todos verdes. Download antes de jogar 938 → 564 KB (atlas 793 → 420 KB); 4G calculado: primeira tela 976 ms, arte 1.352 ms; cronometrado aqui: 1.415 e 1.786 ms. WebP determinístico (duas gerações, mesmos bytes) e com os mesmos pixels do PNG. Sabotagem: WebP com um quadrado vermelho de 64×64 → "4096 pixels diferentes", reprovado.

**Análise:** o `cwebp` desta sessão é o 1.3.2 do apt (o pacote de binários do Google respondeu 404 por aqui). Outra versão pode gerar bytes diferentes do mesmo PNG; os pixels continuam iguais, e é isso que o caso `arte` confere.

**Roadmap:** "Atlas em WebP sem perda" de `Depois` para `Concluído`.

**Pendências e riscos:** quem rodar `node tools/sprites.mjs` (por exemplo depois de importar um mapa do editor) precisa do `cwebp`: no Windows do Leonardo, o zip da libwebp com a pasta `bin` no PATH (`docs/rme.md`). O PNG continua no repositório como reserva (iOS antes do 14).

**Próximo passo recomendado:** o item `Agora` da fila.

## 2026-10-19 15:04 UTC — sessão manual (nuvem)

**Item desenvolvido:** nenhum publicado. Pedido do Leonardo: filtro de linha no PNG do atlas. Implementado em `tools/sprites.mjs` (os cinco filtros do PNG, um para todas as linhas ou o melhor por linha, com deflate 9) e **desfeito**, porque não reduz: 794 KB contra os 793 KB de hoje.

**Validação:** medições no atlas atual (1024×2144, 48.810 cores, alfa só 0 ou 255): sem filtro 794 KB; Sub 968 KB; Up 982 KB; estratégias `Z_FILTERED` e `Z_RLE` piores; PNG "otimizado" do Pillow 1.026 KB. **WebP sem perda: 422 KB (−47%), os mesmos pixels.** PNG com paleta de 256 cores: 279 KB, mas com perda de cor (o atlas tem 48 mil cores). Os itens com padrão (chão em 16 variações) são 16% dos pixels.

**Análise:** pixel art com transparência já comprime bem sem filtro; o ganho de verdade está no formato. O WebP sem perda é aceito por todo navegador do público (Chrome do Android; Safari desde o iOS 14), mas o Node não tem codificador: gerar o atlas em WebP pede uma ferramenta de fora (o `cwebp` do Google ou o Pillow) no passo de montagem, só em `tools/`, nunca no navegador do jogador.

**Roadmap:** entrou em `Depois` "Atlas em WebP sem perda", à espera da decisão do Leonardo sobre a ferramenta.

**Pendências e riscos:** nenhum código mudou.

**Próximo passo recomendado:** o Leonardo decidir se o `tools/sprites.mjs` pode chamar o `cwebp` (ou o Pillow) para gravar o atlas em WebP.

## 2026-10-19 12:06 UTC — sessão manual (nuvem)

**Item desenvolvido:** orçamento de download vigiado (0.43.1), pedido do Leonardo ("temos que ter um mecanismo para garantir a velocidade rápida de download"). `tools/testar.mjs`: `orcamento()` mede antes dos casos o que o jogador baixa, como a rede leva (gzip no texto), e reprova acima de 1,8 MB (aviso em 1,2 MB); o coletor serve os casos com `rede: '4g'` a 9 Mbit/s com 170 ms por pedido e banda dividida; o caso `rede-4g` mede a primeira tela e a arte, com limite de 3 s, e imprime os dois tempos. Números em `ORCAMENTO`. O caso achou a arte em 3.298 ms: o atlas só começava depois do `content.json`, e a imagem depois do `atlas.json`. `src/arte.js` passou a pedir os dois ao carregar o módulo, em paralelo (`pede()`).

**Validação:** `node tools/testar.mjs` — todos os casos, mais a simulação e o orçamento. Hoje: 920 KB no total (774 KB atlas.png, 106 KB src/, 21 KB content.json, 13 KB index.html, 2 KB atlas.json); no 4G, primeira tela em ~1.300 ms e arte em ~2.000 ms (antes da correção, 3.298 ms). Sabotagem: uma cópia com atlas de 2,5 MB deu `DOWNLOAD_FALHOU` e arte em 3.540 ms, reprovada.

**Análise:** o atlas é 84% do download. O caminho de maior ganho, quando o aviso chegar, é o atlas por lugar (a cidade não precisa dos itens da Cripta). Outro ganho barato e sem mudança no jogo: o PNG do `tools/sprites.mjs` sai sem filtro de linha (filtro 0); com filtro por linha, como os otimizadores fazem, deve encolher.

**Roadmap:** "Orçamento de download vigiado" para `Concluído`; os itens de `Próximo` foram renumerados.

O caso `semente-na-url` falhava de vez em quando (inclusive antes desta mudança): comparava duas fotos da tela, e com tocha, água e luz animadas pelo tempo interpolado do desenho (que depende do relógio do navegador) as fotos nunca batem pixel a pixel. Passou a comparar o retrato da regra ao começar (semente e monstros com sqm e vida), que é o que o caso quer provar; 4 de 4 execuções verdes depois.

A primeira CI reprovou o `rede-4g` (primeira tela 2,8 s, arte 3,5 s; aqui 1,3 e 2,0): cronometrar no navegador mede a CPU da máquina de teste, e a da CI é mais lenta. O limite de 3 s passou a ser **calculado** no orçamento (idas e voltas em fila pela profundidade dos imports, mais os bytes pela banda: hoje 1,0 s e 1,7 s, igual em qualquer máquina); o cronometrado continua impresso e só reprova acima de 6 s. A sabotagem de 2,5 MB segue barrada (3,2 s calculados).

**Pendências e riscos:** o 4G simulado é o do servidor de teste, não um aparelho de verdade; não modela o TCP começando devagar nem a CPU do celular, então o tempo real tende a ser maior. A primeira visita é o pior caso; o PWA (item da fila) resolve as seguintes. A CI roda numa máquina mais lenta: se o `rede-4g` oscilar perto de 3 s lá, investigar antes de mexer no limite.

**Próximo passo recomendado:** filtro de linha no PNG do atlas (ganho sem mudar o jogo) e o item `Agora`.

## 2026-10-19 11:32 UTC — sessão manual (nuvem)

**Item desenvolvido:** escolha de personagem sem rolagem (0.43.0), a pedido do Leonardo ("retire a barra de rolagem dos personagens, deixe somente a tela"). O `#pickList` perdeu o `max-height:58vh;overflow:auto`; para caber, o texto de apresentação saiu, os números da conta ficaram numa linha de seis, os cartões ficaram mais baixos e o de quem já existe mostra o preço da morte no lugar da descrição da classe (o novo segue com a descrição). As barras de crescimento ficaram. As telas não mostram mais barra de rolagem (`scrollbar-width:none`) quando, num aparelho muito baixo, precisarem rolar.

**Validação:** `node tools/testar.mjs` — 36/36, com asserção nova: a escolha de personagem não rola e a lista não tem rolagem própria. Medido no Chromium: 640/640 em 360×640 e 844/844 em 390×844 com os quatro personagens criados e a linha da conta visível.

**Análise:** em 360×640 a folga é de ~16 px; um quinto elemento na tela (outra classe, um aviso) volta a pedir rolagem.

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono).

**Pendências e riscos:** a folga pequena acima; o aviso de save que falha (`#mAviso`) fica na tela de entrada, não nesta.

**Próximo passo recomendado:** o Leonardo conferir no celular.

---

## 2026-10-19 11:28 UTC — sessão manual (nuvem)

**Item desenvolvido:** sem tela intermediária depois do login (0.42.0), a pedido do Leonardo ("a tela intermediária de continuar não faz sentido"). Com sessão, `showMenu()` vai direto a `showPick()`: ao abrir o jogo (com o save local, refeito quando a nuvem chega) e depois de Entrar ou Criar conta, quando `puxa()` termina ou falha (`seguir()` em `src/nuvem.js`). A tela de entrada perdeu o "Continuar" e o "Sair"; "Sair da conta" virou o `#pickBack` da escolha de personagem com sessão (`sairDaConta()`), e a linha da conta aparece ali (`#pConta`).

**Validação:** `node tools/testar.mjs` — 36/36. Asserções novas: conta nova entra direto na escolha de personagem, sem "Continuar"; sessão guardada abre na escolha com "Sair da conta"; sair volta à tela de entrada.

**Análise:** com a nuvem fora do ar, o login cai na escolha de personagem com o save do aparelho e tenta ler a nuvem de novo a cada 30 s; se o save da nuvem chegar com a escolha aberta, ela é refeita.

**Roadmap:** item em `Concluído`, fora da fila (pedido do dono).

**Pendências e riscos:** quem joga sem conta volta à tela de entrada pelo "Voltar" da escolha; quem tem conta só a vê saindo da conta.

**Próximo passo recomendado:** o Leonardo entrar no celular e conferir que cai direto na escolha.

---

## 2026-10-19 11:23 UTC — sessão manual (nuvem)

**Item desenvolvido:** mapas de caça fixos e a ponte com o Remere's Map Editor (0.41.0), por decisão do Leonardo ("pode publicar na main e seguir com o Remere; o mapa será fixo e igual sempre, não tem aleatoriedade no mapa"). Antes, a 0.37.0 publicou os mapas vestidos (mesclando a `main` 0.36.0). Agora cada lugar tem `hunts.<lugar>.mapa`: pilhas de itens do OTSP por sqm (`c`/`p`/`o`/`v`, `l` para luz), grade em base 64, entrada e um monstro por ponto de spawn; `newRun()` lê com `leMapa()` e cada ponto é uma "sala" de um monstro em `G.rooms` (nasce e renasce ali; a herança da sala da 0.38.0 segue funcionando). `tools/mapas.mjs` gerou os quatro rascunhos a partir de `hunts.<lugar>.rascunho` (o gerador e os enfeites da 0.37.0 viraram ferramenta); `tools/otbm.mjs` exporta e importa `.otbm` (formato OTBM 2, items.otb 3.55, como o `otsp.otbm` salvo pelo RME 3.3), lê o spawn.xml e o waypoint `entrada`, e monta a pasta do editor com os 19 monstros do Fibula; `tools/otsp-itens.json` traz o que é chão, sólido, luz e parede no `items.otb` do OTSP (no OTSP o id do servidor é o do cliente). O desenho pinta a pilha de cada sqm com os padrões e a animação dos itens (`t<id>` no atlas, que foi a 784 KB). Guia em `docs/rme.md`.

**Validação:** `node tools/testar.mjs` — 36/36. A simulação no Node confere, nos quatro lugares: outra semente dá o mesmo mapa e os mesmos monstros nos mesmos sqm; ninguém nasce fora do chão; todo ponto de spawn se alcança da porta; exportar e importar pelo `.otbm` devolve o mesmo mapa. O carregamento recusa lugar sem mapa, linha curta, spawn fora do chão, mapa sem o chefe e entrada fora do chão. O leitor de `.otbm` leu os 10.455 sqm do `otsp.otbm` salvo pelo editor. Capturas dos quatro lugares conferidas.

**Análise:** três testes da `main` supunham o mapa sorteado e foram ajustados ao mapa fixo sem perder o que provam: "sementes 7 e 8" agora exige o **mesmo** mapa; o `spawnNaEntrada` põe dois pontos do monstro mais fraco a 2 sqm da porta; a herança da sala começa no maior grupo de monstros longe do chefe e sai depois do primeiro abate (e não depois de 400 passos). Escolhas de sprite corrigidas pelas regras do OTSP: o caixote 1115 não bloqueia (virou o 1139), a vela 1178 bloqueia e dá luz (virou objeto da Cripta).

**Roadmap:** "Mapas de caça fixos" para `Concluído`; `Agora`: queda de conexão não mata. Saíram "Forma por lugar" e "Bordas de chão" (agora é desenho no editor); entraram "Pincéis do Fibula no editor" e "Redesenhar os lugares no editor". Depois, a pedido do Leonardo, entrou o item 4 "Orçamento de download vigiado": o harness mede o que o jogador baixa (aviso acima de 1,2 MB, falha acima de 1,8 MB ou de 3 s em 4G simulado) e, ao avisar, a fila trata atlas por lugar, `content.json` dividido e o PWA.

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
