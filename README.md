# Fibula — Masmorra de Runas

Protótipo jogável de um RPG de extração para celular.

**Jogar:** https://llmannrich-ai.github.io/Fibula/

## Na incursão

- Arraste o lado esquerdo da tela para andar.
- Segure um botão de habilidade para repeti-la assim que ela sair da recarga. **Poção** cura.
- O portal de saída abre aos 1:30. Fique 2,5 s nele para extrair. Se morrer, perde o loot do saco.
- Com o portal aberto, uma bússola aparece ao lado do minimapa apontando a direção dele.
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

Monte a mão no **Grimório**, no menu. Subir de nível não é só um número maior: é
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
| 0.20.0 (19/10/2026) | Voz na sala de caçar junto: quem está na sala liga a voz (botão Voz, acima da Mochila, ou no Guia de caça) e segura Falar, ou V, para os outros ouvirem, na cidade e na masmorra. O som vai direto entre os aparelhos; o botão mostra quem está falando |
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

A documentação do projeto está em [CLAUDE.md](CLAUDE.md) (arquitetura,
convenções e como testar), [VISAO.md](VISAO.md) (os pilares de design e os
não-objetivos), [ROADMAP.md](ROADMAP.md) e [DIARIO.md](DIARIO.md).

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
