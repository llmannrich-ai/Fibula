# O que os dados do Tibia ensinam sobre classes e habilidades

> **Referência, não instrução.** O guia único é o [CLAUDE.md](../CLAUDE.md);
> quando este documento discordar dele, vale o guia. Use-o para saber como o
> Tibia fazia a conta antes de mexer numa curva.

Análise dos dados do Tibia disponíveis na máquina e como eles viraram o sistema de
classes, habilidades e evolução da Masmorra de Runas.

## De onde vieram os dados

| Fonte | Caminho | O que tem |
|---|---|---|
| **The Forgotten Server** (TFS 1.x) | `~/dev/forgottenserver` | A mina de ouro: `data/XML/vocations.xml`, 223 magias em `data/scripts/spells`, `data/weapons/weapons.xml`, e as fórmulas em C++ em `src/vocation.cpp` e `src/player.h` |
| **OTClient** | `~/dev/otclient` | Cliente. Interface, protocolo e sprites — nada de regras de jogo |
| **REA** | `~/Desktop/rea-tibia` | Ambiente de análise dos formatos binários do cliente (`.dat`/`.spr`, `appearances.dat`). Pasta `alvo/` ainda vazia |

Só o Forgotten Server tem **regras**. As outras duas pastas tratam de formato de
arquivo e de renderização. Toda a análise abaixo sai de lá.

---

## 1. A descoberta central: classe no Tibia é taxa de crescimento, não lista de poderes

O `vocations.xml` tem 9 entradas (nenhuma + 4 básicas + 4 promoções) e cada uma é
só um punhado de números. Não há nenhum campo "habilidades desta classe".

| | Sorcerer | Druid | Paladin | Knight |
|---|---|---|---|---|
| `gainhp` por nível | 5 | 5 | 10 | **15** |
| `gainmana` por nível | **30** | **30** | 15 | 5 |
| `gaincap` | 10 | 10 | 20 | **25** |
| regenera vida a cada | 6 s | 6 s | 4 s | **3 s** |
| regenera mana a cada | **3 s** | **3 s** | 4 s | 6 s |
| `manamultiplier` | **1.1** | **1.1** | 1.4 | 3.0 |
| multiplicador de espada/machado | 2.0 | 1.8 | 1.2 | **1.1** |
| `magicshield` | sim | sim | não | não |

O que diferencia um cavaleiro de um feiticeiro não é "o cavaleiro tem Fúria".
É que **as mesmas coisas custam preços absurdamente diferentes para cada um.**

## 2. As três moedas de progressão

O Tibia tem três barras que sobem de forma independente, cada uma com sua própria
economia. É isso que faz dois personagens de nível 100 não serem iguais.

### Nível — cúbico, ganho matando

```cpp
// src/player.h:146
getExpForLevel(lv) = (((lv-6)*lv + 17)*lv - 12) / 6 * 100
```

Nível 8 = 4.200 de experiência. Nível 100 = 15.694.800. O crescimento é cúbico: o
custo de cada nível cresce com o quadrado do nível.

### Magic level — exponencial, ganho **gastando mana**

```cpp
// src/vocation.cpp:150
getReqMana(magLevel) = 1600 * manaMultiplier^(magLevel-1)
```

Com `manamultiplier`:

| | custo acumulado até ML 10 |
|---|---|
| Sorcerer / Druid (1.1) | ~25 mil de mana |
| Paladin (1.4) | ~1,1 milhão |
| Knight (3.0) | ~47 milhões |

Um cavaleiro precisa gastar **1.800 vezes mais mana** que um feiticeiro para chegar
ao mesmo magic level. Na prática ele nunca chega — e é exatamente esse o ponto.

### Weapon skill — exponencial, ganho **acertando golpes**

```cpp
// src/vocation.cpp:141
getReqSkillTries(skill, level) = skillBase[skill] * multiplier^(level - 11)
// skillBase = {punho 50, porrete 50, espada 50, machado 50, distância 30, escudo 100, pesca 20}
// todo personagem começa com skill 10 (MINIMUM_SKILL_LEVEL)
```

Para chegar a espada 60: **cavaleiro** (mult 1.1) precisa de ~58 mil golpes
acertados. **Feiticeiro** (mult 2.0) precisaria de 5,6×10¹⁶. A diferença não é de
grau, é de categoria: para o mago, a espada simplesmente não existe como caminho.

> Note a elegância: as três moedas sobem fazendo **a coisa que elas representam**.
> Você sobe de nível matando, sobe magia gastando mana, sobe perícia batendo.
> Nada disso é um botão de "gastar ponto de atributo".

## 3. Anatomia de uma magia

As 223 magias registradas são todas o mesmo objeto com campos diferentes:

```lua
-- data/scripts/spells/attack/flame_strike.lua
spell:group("attack")        -- attack | healing | support | conjuring
spell:level(14)              -- porta de entrada por nível
spell:mana(20)
spell:cooldown(2000)         -- recarga da própria magia
spell:groupCooldown(2000)    -- recarga COMPARTILHADA com o grupo inteiro
spell:range(3)
spell:vocation("sorcerer;true", "druid;true", ...)
combat:setArea(createCombatArea(AREA_WAVE4))

function onGetFormulaValues(player, level, magicLevel)
  local min = (level / 5) + (magicLevel * 1.4) + 8
  local max = (level / 5) + (magicLevel * 2.2) + 14
end
```

**Distribuição por vocação** (contando as básicas): druida 72, feiticeiro 65,
paladino 38, cavaleiro 26. O cavaleiro tem um terço do repertório do druida — e
compensa com o dano de arma, que não passa por magia nenhuma.

**Só existem duas famílias de fórmula de dano:**

| Família | Forma | Quem usa |
|---|---|---|
| Mágica | `nível/5 + magicLevel × a + b` | feiticeiro, druida, e alguns golpes sagrados do paladino |
| De arma | `nível/5 + perícia × ataque_da_arma × a + b` | cavaleiro, paladino |

O coeficiente `a` é toda a curva de poder: vai de 0.3 (Buzz, nível 1) a 8.0
(Eternal Winter). A fórmula é a mesma; só o multiplicador muda.

**Degraus de recarga nos 50 ataques:** 2 s (11 magias) → 4 s (10) → 6 s (5) →
8 s (9) → 30 s (8) → 40 s (7). Ou seja: um golpe spammável, uma onda de área, um
golpe forte, e uma bomba de guardar para a emergência.

**Formas de área mais usadas:** `CIRCLE3X3` (16×), `CIRCLE2X2` (11×),
`SQUARE1X1` (10×), `CIRCLE6X6` (9×), `BEAM` (11× somando os tamanhos),
`WAVE`/`SQUAREWAVE` (12×). **A forma da área é a identidade tática da magia** —
muito mais do que o número de dano.

**Cadência de liberação dos ataques por nível:** 1, 8, 12-18, 23-29, 33-40, 50-60,
70-90, 100+. Grosso modo: uma habilidade nova a cada ~8 níveis no começo, abrindo
para ~15-20 depois.

## 4. O `groupCooldown` é o mecanismo mais subestimado

Hell's Core tem cooldown próprio de 40 s mas `groupCooldown` de 2 s. Flame Strike
tem 2 s e 2 s. Isso significa: **lançar qualquer ataque trava todos os ataques por
um instante.** Sem isso, o jogador ótimo enfileira as cinco magias mais fortes e
dispara todas no mesmo frame. Com isso, ele precisa escolher a ordem.

É um freio de encadeamento, não de repetição — e é o que faz "ter muitas magias"
não virar "disparar todas de uma vez".

---

## A adaptação: o que entrou na Masmorra de Runas

O jogo é uma incursão de 6 minutos num celular. Não dá para herdar as escalas do
Tibia (nem os 10 botões de magia). O que foi preservado foi **a estrutura**.

### As quatro classes

Os números vêm das razões do `vocations.xml`, comprimidos para a escala do jogo.

| | Feiticeiro | Druida | Caçador | Cavaleiro |
|---|---|---|---|---|
| vida inicial / por nível | 85 / +6 | 92 / +7 | 110 / +11 | **135 / +17** |
| mana inicial / por nível | **95 / +16** | 88 / +15 | 70 / +10 | 45 / +4 |
| regenera vida | 1,0/s | 1,1/s | 1,6/s | **2,6/s** |
| regenera mana | **8,5/s** | 8,0/s | 5,5/s | 2,6/s |
| custo de Magia (`mMult`) | **1,09** | 1,09 | 1,22 | 1,9 |
| custo de Perícia (`pMult`) | 2,0 | 1,8 | 1,2 | **1,1** |
| redução de dano recebido | 0% | 6% | 14% | **28%** |

A última linha é a tradução do `skillBase[escudo]=100` e dos multiplicadores de
`defense`/`armor` do XML: o Tibia tem perícia de escudo como oitava barra, que aqui
virou uma constante por classe em vez de mais uma coisa para o jogador gerenciar.

### As três moedas, preservadas

| Moeda | Como sobe | Fórmula no jogo | Origem |
|---|---|---|---|
| **Nível** | matando | `40 × nível^1.6` | análogo da curva cúbica, encolhido |
| **Magia** | gastando mana | `240 × mMult^magia` | `1600 × manaMultiplier^(ml-1)` |
| **Perícia** | acertando golpes | `12 × pMult^(perícia-10)` | `skillBase × mult^(nível-11)`, começando em 10 |

As bases caíram de 1600→240 e de 50→12 porque uma incursão dura 6 minutos, não seis
meses. As **razões entre as classes** são as do Tibia.

Cada habilidade declara em que moeda escala (`esc: 'mag'` ou `'per'`), então o
Míssil Divino do caçador escalar em Magia — como o Divine Missile original —
continua sendo o motivo de um caçador treinar magia.

### A fórmula de dano

`dano = nível/2 + poder × a + b`, com `poder` sendo Magia ou Perícia. É a fórmula
do TFS com `nível/5` virando `nível/2` (nossos níveis são muito menores) e os
coeficientes `a` reescalonados.

### As 24 habilidades

Seis por classe, com as palavras mágicas originais preservadas como sabor
(`exori flam`, `exevo gran mas frigo`, `utani tempo hur`). Liberadas nos níveis
**1, 3-5, 7-11, 13-17, 20-24 e 32** — a mesma cadência de "uma nova a cada ~8
níveis, abrindo depois".

Os tipos de efeito saíram direto das formas de área do TFS: `proj` (alvo único),
`bomba` (arremesso que explode, as runas), `cone` (WAVE), `feixe` (BEAM),
`aura` (CIRCLE centrado em você), `melee` (SQUARE1X1), `cura` e `buff`.

### A mudança de verdade: espaços de habilidade

Um celular não tem dez botões. A adaptação é a parte mais livre do desenho:

> **Você aprende seis habilidades, mas só leva algumas para a masmorra.**
> São 2 espaços no nível 1, o terceiro no nível 8, o quarto no nível 18.

Isso resolve três coisas de uma vez: cabe na tela; transforma "subir de nível" em
uma decisão (o que trocar) e não só num número maior; e faz o `groupCooldown` —
que também veio junto, por grupo de ataque/cura/apoio — importar de verdade, porque
você escolheu aqueles três ataques e tem que decidir a ordem.

### O que ficou de fora

- **Promoções** (Master Sorcerer, Elite Knight). Cabem numa etapa futura como um
  segundo patamar de taxas de crescimento, exatamente como são no XML.
- **Perícia de escudo, pesca, capacidade, soul points.** Virou constante (armadura)
  ou não tem uso num jogo de incursão curta.
- **Runas como item conjurado.** No Tibia você conjura uma runa com N cargas e
  carrega no inventário; aqui a "bomba" é lançada direto. O sistema de conjuração
  (`conjuring`, 47 scripts) é o candidato natural se o jogo ganhar inventário.
- **Dano por elemento com resistências.** Os elementos existem (fogo, energia, gelo,
  terra, sagrado, físico) e dão cor e efeito, mas nenhum monstro resiste ou é fraco
  a nada ainda. É a extensão de menor custo e maior ganho tático.
