# Fibula — Masmorra de Runas

Protótipo jogável de um RPG de extração para celular.

**Jogar:** https://llmannrich-ai.github.io/Fibula/

## Na incursão

- Arraste o lado esquerdo da tela para andar.
- Segure um botão de habilidade para repeti-la assim que ela sair da recarga. **Poção** cura.
- Não há relógio: saia pela porta da sala de entrada quando quiser, parado nela por 2,5 s. Se morrer, perde a mochila.
- As regras completas estão no botão **Regras**, na tela inicial.
- Teclado: WASD anda, **J K L I** são os quatro espaços de habilidade, **P** bebe poção.
- Cada masmorra tem um número, mostrado na tela final. Para jogar a mesma de
  novo — ou a mesma que um amigo —, abra o jogo com `?semente=` e o número no
  fim do endereço: https://llmannrich-ai.github.io/Fibula/?semente=12345. Um
  texto também vale (`?semente=desafio`).

## Classes e habilidades (Etapa 3)

Quatro classes adaptadas das vocações do Tibia. Nenhuma delas tem poder exclusivo
de graça: **o que muda é a velocidade com que cada coisa cresce.**

| Classe | Jeito de jogar | Cresce rápido em | Cresce devagar em |
|---|---|---|---|
| Feiticeiro | fogo e energia, dano bruto e área | mana, Magia | vida, Perícia, armadura |
| Druida | gelo e terra, cura e controle | mana, Magia | vida, Perícia |
| Caçador | distância e mobilidade | Perícia, alcance | mana |
| Cavaleiro | corpo a corpo, bate de graça | vida, Perícia, armadura | mana, Magia |

Cada personagem tem **três barras independentes**, como no Tibia:

- **Nível** — sobe matando. Aumenta vida e mana máximas e libera habilidades novas.
- **Magia** — sobe **gastando mana**. Escala as magias de feiticeiro e druida (e os
  golpes sagrados do caçador).
- **Perícia** — sobe **acertando golpes**. Escala os ataques de cavaleiro e caçador.

O custo das duas últimas é exponencial e o expoente depende da classe, então um
cavaleiro praticamente nunca chega a uma Magia alta — exatamente como no original.

### Espaços de habilidade

Cada classe aprende **seis habilidades**, mas você não leva todas:

| Espaços | Abre no nível |
|---|---|
| 1 e 2 | 1 |
| 3 | 8 |
| 4 | 18 |

Monte a mão no **Grimório**, na cidade. Subir de nível não é só um número maior: é
uma decisão sobre o que trocar. Cada grupo (ataque, cura, apoio) tem uma recarga
compartilhada, então encadear três ataques exige ordem, não botão rápido.

Os personagens de cada classe são guardados em separado — o cofre e as melhorias do
Mercador são da conta e valem para todos.

> A íntegra do levantamento que gerou esse desenho está em
> [docs/analise-tibia-habilidades.md](docs/analise-tibia-habilidades.md).

## Entre incursões — o Mercador (Etapa 2)

O ouro que você extrai vai para o **cofre**, e o cofre só serve para gastar com o
**Mercador**, no menu. As melhorias são permanentes e valem para todas as
incursões seguintes:

| Melhoria | Efeito | Níveis |
|---|---|---|
| Vigor | +15 de vida máxima | 8 |
| Foco | +10 de mana máxima | 8 |
| Poder arcano | +8% de dano em todas as habilidades | 8 |
| Bolsa de poções | +1 poção em cada incursão | 4 |
| Selo de resguardo | guarda 20% do loot do saco se você morrer | 3 |

O preço de cada nível sobe geometricamente, então o cofre nunca deixa de ter uso.

O progresso fica salvo no navegador de cada aparelho. Com uma conta (usuário e
senha, no menu), ele também vai para a nuvem e segue você em outro aparelho. Na
primeira entrada, uma conta sem save recebe o progresso que já estava no
aparelho.

## Arte

Os sprites são do [OpenTibia Sprite Pack](https://github.com/peonso/opentibia_sprite_pack),
licença [CC BY 4.0](assets/otsp/LICENSE.txt), feito pela comunidade OpenTibia
([autores](assets/otsp/AUTHORS.md)). O que foi usado e o que foi alterado está
em [assets/CREDITOS.md](assets/CREDITOS.md); o atlas sai de
[`tools/sprites.mjs`](tools/sprites.mjs).

## Versões

A versão aparece no alto do menu do jogo.

| Versão | O que trouxe |
|---|---|
| 0.46.0 (19/10/2026) | A cidade ganhou muralha e quatro portões: fora deles há um mundo para andar, com estradas, quatro vilas, matas, rio, lago, a costa com um cais e ruínas antigas. Ainda sem monstros; é onde vão ficar as entradas dos próximos lugares de caça. O mapa do canto mostra os arredores, e entrar num lugar anuncia o nome dele |
| 0.45.0 (19/10/2026) | Cada lugar de caça tem um portal na cidade: a grade do esgoto, os portais das Runas e da Cripta ao lado do portão e o barco da Ilha no cais. Pise nele e entre: se alguém já caça lá, você cai na caçada dele; se não, ela abre no seu aparelho. Lugar cheio (4) abre uma cópia. Quem sai por último fica com a caçada rodando até alguém chegar. O Guia diz quantos caçam em cada lugar |
| 0.44.0 (19/10/2026) | O jogo abre mais rápido: as imagens caíram de 793 KB para 420 KB (WebP sem perda, o mesmo desenho), e o download inteiro antes de jogar foi de 938 KB para 564 KB |
| 0.43.2 (19/10/2026) | A Mochila não vende mais na Feira durante a caçada: o que está nela só fica a salvo saindo pela porta. Vender é na cidade |
| 0.43.0 (19/10/2026) | A escolha de personagem cabe inteira na tela, sem barra de rolagem: os números da conta numa linha e cartões mais baixos, com o preço da morte no lugar da descrição de quem já existe |
| 0.42.0 (19/10/2026) | Sem tela intermediária: quem tem conta aberta abre o jogo direto na escolha de personagem, e quem entra ou cria conta vai para ela sozinho. "Sair da conta" fica na escolha de personagem |
| 0.41.0 (19/10/2026) | Os lugares de caça são fixos: o Esgoto é sempre o mesmo Esgoto, com os mesmos corredores, os mesmos objetos e cada monstro no mesmo lugar, renascendo ali. O chão ganhou os padrões do Tibia (sem azulejo repetido), e as tochas e velas iluminam onde estão |
| 0.40.0 (19/10/2026) | A primeira tela é só a conta: usuário, senha, Entrar e Criar conta (ou Jogar sem conta). O personagem se escolhe na tela seguinte, que mostra o preço da morte de cada um e tem as Regras; o Menu da cidade volta a ela |
| 0.38.0 (19/10/2026) | A sala não acaba quando o anfitrião sai: o convidado mais antigo vira o anfitrião e herda a caçada como estava, com monstros, mochilas e cada um no seu lugar; quem está lá dentro continua caçando. Com gente na sala, o anfitrião tem "Sair da sala" em vez de "Fechar sala" |
| 0.37.0 (19/10/2026) | Os lugares de caça ganharam cara própria: pilares, barris e rochas na Masmorra de Runas; teias, grades e lodo no Esgoto; a Ilha virou clareira cercada de mata, com palmeiras e pedras; sarcófagos, gárgulas e ossadas na Cripta. Os objetos ocupam o sqm, como no Tibia: servem de cobertura e de gargalo |
| 0.36.0 (19/10/2026) | A comida virou item, como no Tibia: os animais derrubam comida (queijo do rato, carne e presunto do leão, carne do orc e do troll, presunto de dragão do dragão, 12 min de alimentação). A comida comprada na Quitanda vai direto para a mochila; ela entra na caçada com a mochila, volta com ela e cai se você morrer. O Banco guarda a comida no cofre como item, e "levar" põe a pilha de volta na mochila |
| 0.35.0 (19/10/2026) | O Grimório saiu da tela inicial e fica na cidade, no botão de sempre. Trocar de personagem só pela tela inicial: o botão Personagens saiu da cidade |
| 0.34.0 (19/10/2026) | Teste: as habilidades são miradas. O botão da habilidade virou um joystick: aperte para ver a mira, arraste para escolher a direção (na bomba, também a distância) e solte para lançar; volte o dedo ao botão para cancelar. Tocar sem arrastar lança para onde você olha. Nada procura o monstro sozinho: o tiro vai reto e para no primeiro monstro ou na parede, o golpe sai mesmo sem ninguém na frente, e errar gasta a mana como acertar |
| 0.33.0 (19/10/2026) | Armas de quem começa: numa casa vazia ao norte da praça, uma faca e uma espada de madeira ficam no chão. Pise para pegar: vão para a mochila, e outra aparece no mesmo lugar dois minutos depois. Não valem ouro no Banco nem entram na Feira |
| 0.32.0 (19/10/2026) | O cofre do Banco guarda tudo como item: guardar a mochila não transforma mais gema e coroa em ouro nem manda material para um depósito escondido. O Banqueiro lista o cofre inteiro (peças, tesouros e materiais) e cada item pode voltar à mochila; tesouro se vende no Banco, material continua com o Gordon, que vê o que está no cofre |
| 0.31.0 (19/10/2026) | Tela inicial nova: o personagem, o preço da morte em uma linha, Jogar e a conta, tudo sem rolar. As regras e os créditos da arte foram para o botão **Regras**; os números da conta, para Personagens. Quem ainda não tem personagem vê o login antes de criar um |
| 0.30.0 (19/10/2026) | Voz na sala de caçar junto: quem está na sala liga a voz (botão Voz, acima de Comer, ou no Guia de caça) e segura Falar, ou V, para os outros ouvirem, na cidade e na masmorra. O som vai direto entre os aparelhos; o botão mostra quem está falando |
| 0.29.0 (19/10/2026) | Alimentação como no Tibia: sem comer, o personagem não regenera vida nem mana. Cada comida dá um tempo de alimentação (de 1 min 30 s da cesta de frutas a 9 min do ensopado), comida pelo botão Comer na caçada, até 20 min acumulados; a regeneração é a da classe, fixa. A comida empilha na loja (até 10 de cada), vai na mochila e o que sobrar volta se você sair pela porta; morrendo, fica na masmorra |
| 0.28.0 (19/10/2026) | O mundo é igual para todos: os monstros e os chefes têm a mesma força para qualquer nível e qualquer tamanho de grupo. A dificuldade vem do lugar que você escolhe; cada lugar mostra o nível recomendado |
| 0.27.0 (19/10/2026) | Inventário como no Tibia: o saco saiu e ficaram a mochila e o cofre. O loot fica na mochila do personagem depois da caçada, vai junto na próxima e cai inteiro se ele morrer. Só o cofre do Banco é seguro: o Banqueiro guarda uma coisa ou tudo e devolve peças e ouro à mochila. Vestir e tirar pela Mochila, na cidade, agora troca com a mochila. A mochila tem 20 espaços; cheia, o loot fica no chão |
| 0.26.0 (19/10/2026) | Vestir e tirar pela Mochila, sem ir ao Banco: toque numa peça e no botão. Na cidade, a troca é com o cofre do Banco; na caçada, como no Tibia, com o saco: a peça que você acabou de pegar vale na hora e passa a não cair na morte, e a que sai do corpo vai para o saco e corre o risco dele |
| 0.25.0 (19/10/2026) | Toda caçada é numa sala: no Guia de caça, o lugar abre uma sala sua e já entra pela porta, e quem estiver na cidade pode entrar junto. A sala abre mesmo sem conexão. Corrige o "Entrar pela porta" que não respondia quando o canal da sala não tinha ligado, e o botão desabilitado agora parece desabilitado |
| 0.24.0 (19/10/2026) | A entrada do Esgoto deixou de ser um vigia: agora é uma grade de ferro no chão da rua, perto do mercado. Pise nela (ou chegue perto) e toque em Descer; quem volta do Esgoto sai em cima dela |
| 0.23.0 (19/10/2026) | A Mochila ganhou o corpo da janela de inventário do Tibia: três colunas com cada peça no lugar em que se usa (amuleto no pescoço, arma na mão, armadura no peito, o saco onde o Tibia põe a mochila), a silhueta do que vai em cada casa vazia e, ao lado, o boneco vestido, que gira ao toque |
| 0.22.0 (19/10/2026) | Três lugares novos para caçar, cada um com monstros, chefe, chão e paredes próprios. O Vigia, na grade do esgoto perto do mercado, leva ao Esgoto (nível 1: morcegos, baratas, lesmas e a Centopeia-rainha). O Capitão, no porto, leva de navio à Ilha da Enseada (nível 8: vespas, lagartas que cospem, leões, trolls e um dragão). O Guia, além da Masmorra de Runas, leva à Cripta Antiga (nível 15: fantasmas, múmias, necromantes e a Senhora das Sombras). Dá para criar sala em qualquer um deles e chamar quem está na cidade |
| 0.21.0 (19/10/2026) | Habilidades se aprendem com o Mestre de magias, como no Tibia: ao chegar no nível, pague o preço em ouro na Torre dos magos (150 ouro a Golpe Flamejante, 500 a Onda de Fogo, até 3.500 as de nível 32). A de nível 1 continua grátis, e quem já jogava fica com tudo que o nível dele liberava |
| 0.20.0 (19/10/2026) | A cidade cresceu cinco vezes (54×38): praça com fonte, templo, rio com duas pontes, pomar e horta, e um mapa no canto. Três lojas novas de provisões para a próxima caçada, pagas com o cofre: a Quitandeira (uma refeição que regenera vida ou mana), a Boticária (poções a mais e elixir de pressa) e o Mestre de magias, do outro lado do rio (runas de pele de pedra, fúria e olho de águia). O que se leva vai inteiro, extraindo ou morrendo |
| 0.19.0 (19/10/2026) | A masmorra da sala não tem tempo: nasce com a sala e fica aberta até quem criou fechar (na cidade) ou sair do jogo. Cada um entra e sai por uma porta na sala de entrada quando quiser, e pode voltar; os monstros renascem como no Tibia |
| 0.18.0 (19/10/2026) | Gordon, o ferreiro, abre a Forja na cidade: compra dente, seda, osso e erva por pouco, dá quatro encomendas de materiais e, a cada uma entregue, põe à venda armas e armaduras melhores (maça cravejada, gibão acolchoado, machado de guerra, couraça de placas). Esses materiais não viram mais ouro na extração: vão para o depósito dele |
| 0.17.0 (19/10/2026) | Peças de teste no chão da cidade, perto de onde se chega: pisou, vai para o cofre do Banco, uma vez por conta. Não entram na Feira (não têm origem no banco) |
| 0.16.0 (19/10/2026) | Todo mundo anda uns 15% mais rápido: o personagem do nível 1 dá um passo a cada 0,5 s (2 sqm/s), e os monstros aceleram na mesma proporção |
| 0.6.0 (18/10/2026) | Morrer custa 25% da experiência do nível (nunca o nível), com aviso no menu e linha própria na tela final; curva de nível mais lenta, ajustável no `content.json` |
| 0.15.0 (19/10/2026) | A Feira só aceita o que tem origem registrada no banco: o que foi extraído, comprado, recebido na Feira ou vendido ao Banco com a conta ligada. Na caçada, a Mochila vende uma peça do saco direto na Feira |
| 0.14.0 (19/10/2026) | Caçar junto: no Guia de caça, crie uma sala ou entre na de quem está na cidade (até 4). O aparelho de quem criou calcula a caçada de todos; loot disputado, mais monstros, e cada um sai pelo portal quando quiser. A sala fica aberta até quem criou fechar ou sair do jogo |
| 0.13.0 (19/10/2026) | Velocidade do Tibia: o personagem anda 1,8 sqm/s no nível 1 e acelera a cada nível (220 + 2 por nível, a fórmula do Tibia); monstros mais lentos que o jogador, a aranha mais rápida e o esqueleto e o orc a 1,25 sqm/s |
| 0.12.0 (19/10/2026) | O que o personagem veste aparece nele: a armadura retinge o tronco (couro marrom, malha cinza), a arma vai na mão e corta no golpe, e o amuleto brilha no peito. O Banco mostra o boneco vestido, que gira com um toque, e na cidade os outros jogadores veem o que você veste |
| 0.11.0 (19/10/2026) | A Feira: mercado entre jogadores, com conta. Anuncia-se compra ou venda de uma peça a um preço; o banco casa as ofertas na hora (melhor preço primeiro), e o que não casa fica no livro até alguém aceitar ou o dono cancelar. A venda paga 2% de taxa. Quem vendeu ou comprou enquanto estava fora recebe ao abrir a Feira |
| 0.9.0 (19/10/2026) | Anda-se por sqm, como no Tibia: um passo de cada vez, mais rápido a cada nível; monstros ocupam o sqm deles e cercam o jogador, e o cavaleiro pode segurar um corredor. Na cidade, os outros jogadores andam exatamente os passos que deram |
| 0.10.0 (19/10/2026) | Botão Mochila, na masmorra e na cidade: abre sobre o jogo, sem pausar, o corpo (amuleto, arma, armadura) e o saco em grade, com o que se perde se morrer; tocar numa peça diz o que ela é |
| 0.8.0 (19/10/2026) | A cidade é compartilhada: quem está nela vê os outros jogadores andando, com nome e classe, e o HUD conta quantos são. As caçadas continuam sozinhas |
| 0.7.0 (18/10/2026) | A Cidade: um mapa por onde se anda entre incursões, com as casas do Mercador e do Banco e o Guia de caça no portão sul, que leva às masmorras; a volta de cada incursão é pelo portão |
| 0.5.0 (18/10/2026) | Cada masmorra tem um número (tela final) e `?semente=` repete a mesma; código em módulos, com a regra do jogo separada da tela; versão no menu e nos endereços dos arquivos, para uma atualização nunca se misturar com o cache |
| 0.4 | Arte do Tibia (OpenTibia Sprite Pack); conta com usuário e senha e progresso na nuvem; equipamento (arma, armadura e amuleto) e cofre de peças |
| 0.3 | Etapa 3: quatro classes, grimório com espaços por nível, Magia e Perícia |
| 0.2 | Etapa 2: cofre e Mercador |
| 0.1 | Etapa 1: protótipo jogável — incursão, portal e morte com perda do saco |

## Desenvolvimento

O código do jogo é o `index.html` mais os módulos ES de `src/` — sem build e sem
biblioteca, servidos crus pelo GitHub Pages. A regra do jogo fica em `src/sim/`,
sem nada de navegador, para poder rodar também num servidor. O conteúdo fica
fora do código, num arquivo de dados.

Toda a documentação de quem desenvolve está num arquivo só,
[CLAUDE.md](CLAUDE.md): os princípios do jogo, o produto, o código, os testes,
os agentes e as decisões do dono. A fila de trabalho é o
[ROADMAP.md](ROADMAP.md), e o registro de cada execução, o
[DIARIO.md](DIARIO.md).

O conteúdo do jogo não fica no motor. Classes, habilidades, melhorias do
Mercador, inimigos, itens, loot e progressão moram em
[`data/game/content.json`](data/game/content.json), que o `index.html` carrega
antes de iniciar. Ajustar balanceamento — o custo de uma melhoria, o dano de
uma habilidade, a vida de um monstro, a composição das salas — é editar esse
arquivo, sem tocar em código. O carregamento valida o arquivo antes de liberar
o jogo: se uma tabela de loot citar um item que não existe, ou os pesos de uma
banda não somarem 1, o menu diz o que está errado em vez de abrir uma masmorra
quebrada.

Além disso, [`data/mechanics/`](data/mechanics/README.md) guarda a base de
referência de onde saiu esse balanceamento — combate, classes, itens e
inimigos de um servidor open source, extraídos por
[`tools/extract-mechanics.ps1`](tools/extract-mechanics.ps1). É material de
consulta: **o jogo não lê esses arquivos em runtime**, só o `content.json`.

Como o jogo busca o `content.json` por rede, **abrir o `index.html` direto do
disco não funciona** — o navegador bloqueia `fetch` em `file://` e o menu
avisa. Para rodar local, sirva a pasta por HTTP:

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

e abra http://localhost:8080/. No GitHub Pages funciona direto.
