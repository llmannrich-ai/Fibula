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
| 0.6.0 (18/10/2026) | Morrer custa 25% da experiência do nível (nunca o nível), com aviso no menu e linha própria na tela final; curva de nível mais lenta, ajustável no `content.json` |
| 0.10.0 (19/10/2026) | O que o personagem veste aparece nele: a armadura retinge o tronco (couro marrom, malha cinza), a arma vai na mão e corta no golpe, e o amuleto brilha no peito. O Banco mostra o boneco vestido, que gira com um toque, e na cidade os outros jogadores veem o que você veste |
| 0.9.0 (19/10/2026) | Anda-se por sqm, como no Tibia: um passo de cada vez, mais rápido a cada nível; monstros ocupam o sqm deles e cercam o jogador, e o cavaleiro pode segurar um corredor. Na cidade, os outros jogadores andam exatamente os passos que deram |
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
