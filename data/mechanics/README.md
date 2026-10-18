# Camada de mecânica

Base de referência para o design de combate, classes, itens e inimigos do Fibula,
derivada de um servidor Tibia open source. Não é conteúdo do jogo: é a **estrutura
numérica** sobre a qual o conteúdo do Fibula vai ser desenhado.

Gerado por [`tools/extract-mechanics.ps1`](../../tools/extract-mechanics.ps1).

## Proveniência e política de conteúdo

| | |
|---|---|
| Origem | The Forgotten Server (`otland/forgottenserver`), **GPLv2** |
| O que entra aqui | números, fórmulas, razões de balanceamento, descritores mecânicos derivados |
| O que **não** entra | nomes próprios, descrições, falas, sprites, mapa, NPCs, diálogos |

Os identificadores são códigos (`e00034`, `i02400`, `s012`, `class_4`), não nomes. Rodando
o extrator com `-WithNames` ele grava `.local/names.json` com o mapa código → nome de
origem, **fora do versionamento** (veja o `.gitignore`), apenas como referência de projeto.

Duas coisas que isso resolve de propósito: nomes e descrições do Tibia são da CipSoft, e
copiar tabelas verbatim do TFS arrastaria a GPLv2 para dentro do Fibula. Fórmula, curva e
razão de balanceamento não carregam nenhuma das duas coisas — é o que ficou aqui.

> A decisão final sobre risco jurídico é da auditoria externa, não deste arquivo. O que
> está documentado aqui é **o que** foi derivado e **de onde**, para que a auditoria tenha
> o rastro completo.

## Como regerar

```bash
powershell -ExecutionPolicy Bypass -File tools/extract-mechanics.ps1 -TfsPath "C:\Users\<você>\dev\forgottenserver" -WithNames
```

Sem `-TfsPath` ele procura em `%USERPROFILE%\dev\forgottenserver`. Sem `-WithNames` não
grava o mapa de nomes.

## Arquivos

### `combat.json` — as fórmulas

Dano de arma, com `attackValue` do equipamento e `skill` da perícia correspondente:

```
max = round( level/5 + ((skill/4 + 1) * (attack/3) * 1.03) / attackFactor )
```

O dano sorteado vai de 0 a esse máximo, com viés para o alto, multiplicado pelo
multiplicador de dano da classe. `attackFactor` é a postura: **1.0** ofensiva, **1.2**
equilibrada, **2.0** defensiva — ou seja, postura defensiva corta o dano pela metade.

Consequência de design que importa para celular: o piso do sorteio é **zero**. Golpes
que erram feio são parte da identidade do combate, não um bug.

### `classes.json` — 9 vocações

Campos por classe: ganho de HP/mana/capacidade por nível, taxa de regeneração,
`manaMultiplier` (custo de avanço do magic level), `magicShield`, multiplicadores de dano
e de avanço de cada perícia. `archetype` é derivado dos números, não do nome de origem.

Os quatro arquétipos base, por nível:

| arquétipo | HP | mana | cap | manaMultiplier |
|---|---|---|---|---|
| `caster` | 5 | 30 | 10 | 1.1 |
| `hybrid` | 10 | 15 | 20 | 1.4 |
| `tank` | 15 | 5 | 25 | 3.0 |
| `neutral` (sem classe) | 5 | 5 | 10 | 4.0 |

Nove entradas para quatro arquétipos porque as promoções repetem os mesmos números —
a promoção é progressão de status, não de balanceamento.

### `enemies.json` — 1.166 inimigos

Por inimigo: `tier`, `role`, `race`, `family`, HP, exp, velocidade, armadura, defesa,
`dps` calculado, `bulkToThreat`, lista de ataques (intervalo, chance, faixa de dano,
alcance, área), cura própria, resistências elementais, imunidades, invocações, flags de
comportamento e tabela de loot com probabilidade.

- `dps` = média de dano × chance ÷ intervalo, somando todos os ataques.
- `bulkToThreat` = HP ÷ dps **do próprio inimigo**. Alto = saco de pancada inofensivo;
  baixo = frágil e letal. **Não** é tempo-para-matar, que depende do dano do jogador.
- `elements`: positivo = resistência (reduz o dano nessa %), negativo = vulnerabilidade.
- `combat: false` marca as 217 entradas utilitárias (exp 0 — bichos de ambiente, bonecos
  de treino, pets). Elas ficam no arquivo mas fora das bandas de balanceamento.

### `tiers.json` — a escada de design

As bandas sobre os 949 inimigos de combate. É o arquivo mais útil para desenhar
progressão:

| tier | n | HP (mediana) | dps (mediana) | exp (mediana) | exp/HP | papéis dominantes |
|---|---|---|---|---|---|---|
| 1 | 42 | 50 | 4.2 | 15 | 0.30 | melee 34, ranged 5 |
| 2 | 145 | 135 | 12.5 | 60 | 0.44 | melee 59, ranged 41, caster 29 |
| 3 | 249 | 505 | 38.4 | 320 | 0.63 | ranged 50, melee 49, caster 48, caster-healer 48 |
| 4 | 275 | 2.350 | 87.6 | 1.700 | 0.72 | caster-healer 96, caster 69, ranged 46 |
| 5 | 163 | 8.500 | 188.6 | 6.650 | 0.78 | caster 62, caster-healer 59, summoner-caster 30 |
| 6 | 75 | 110.000 | 475.6 | 45.000 | 0.41 | caster-healer 31, caster 21, summoner-caster 18 |

Dois padrões que valem como lição de design, visíveis na tabela:

1. **A composição de papéis migra.** Tier 1 é quase todo corpo-a-corpo burro; de tier 4
   em diante o jogo é feito de casters, curandeiros e invocadores. A dificuldade cresce
   por *complexidade de comportamento*, não só por HP.
2. **`exp/HP` sobe de 0.30 a 0.78 e despenca para 0.41 no tier 6.** A recompensa por
   esforço melhora conforme você progride — e aí os chefes quebram a curva de propósito:
   HP enorme para recompensa proporcionalmente baixa, porque o prêmio deles é o loot, não
   a experiência.

### `items.json` — 802 itens de combate

Armas, escudos, armaduras e munição com `attack`, `defense`, `extraDef`, `armor`, peso,
alcance, tipo de arma e slot. `attrs` guarda os atributos crus restantes (bônus de
perícia, dano elemental, cargas). Os ids de item batem com os ids em `enemies[].loot`.

### `spells.json` — 50 magias de ataque

Quatro famílias de fórmula, no campo `formula.family`:

| família | n | fórmula |
|---|---|---|
| `levelMagic` | 33 | `level/5 + magicLevel*a + b` |
| `custom` | 8 | expressão própria, preservada em `minExpr`/`maxExpr` |
| `skillAttack` | 7 | `level/5 + (skill * attack * a) + b` |
| `flat` | 2 | constante, sem escala |

A existência das famílias `levelMagic` e `skillAttack` lado a lado é a decisão de design
central: conjurador escala com um atributo (magic level), guerreiro escala com o produto
de dois (perícia × ataque da arma). `manaEfficiencyAtMl50` compara dano por mana dentro da
família `levelMagic` — não faz sentido cruzar famílias.

## Onde o Fibula está nessa escada hoje

Calculado com a mesma metodologia (`dmg × 0.85 ÷ atk`, já que o golpe sorteia 70–100% de
`dmg`), nos inimigos atuais de [`index.html`](../../index.html), na profundidade inicial:

| inimigo atual | HP | dps | tier por HP | tier por dps |
|---|---|---|---|---|
| rato | 22 | 3.8 | 1 | 1 |
| aranha | 34 | 6.4 | 1 | 1–2 |
| xamã | 58 | 5.4 | 2 | 1–2 |
| esqueleto | 62 | 7.7 | 2 | 1–2 |
| orc | 95 | 9.9 | 2 | 2 |
| guardião | 520 | 14.6 | 3 | 2 |

A escada do Fibula cobre tier 1→3 em HP mas comprime o dps na faixa de tier 1–2: os
inimigos são **mais resistentes e menos letais** que os da fonte. Isso não é erro — é
coerente com uma corrida de 90 segundos onde o jogador quase não tem como se curar. Vale
como decisão consciente, não como desvio a corrigir.

## O problema de adaptação que esta base não resolve

As curvas de origem foram desenhadas para sessões de horas e progressão de meses. O Fibula
é extração de 1min30. Três tensões concretas para resolver no design, não na extração:

1. **Escala de HP.** Um inimigo de tier 4 tem 2.350 de HP. Com o dano de um jogador de
   nível baixo isso é minutos de combate — mais que a corrida inteira. Os *formatos* de
   ataque dos tiers altos (área, cura própria, invocação) são aproveitáveis; os valores
   absolutos de HP não.
2. **Curva de exp.** Os `expStages` da fonte multiplicam de 7× a 4× ao longo de 100
   níveis. Em sessão curta e repetida, a progressão tem que caber em dezenas de corridas,
   não em centenas de horas.
3. **Regeneração por tick.** A fonte regenera HP/mana a cada 3–6 segundos, o que em 90
   segundos é quase irrelevante. Ou o tick fica muito mais rápido, ou a cura vira recurso
   consumível — que é o caminho que o Fibula já tomou com a poção.

## O que não está aqui

Mapa, NPCs, quests, sistema de mercado, criação de itens e todo o conteúdo narrativo.
Nenhum desses é necessário para a camada de combate, e cada um deles seria conteúdo
copiado em vez de mecânica derivada.
