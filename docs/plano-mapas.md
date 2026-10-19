# Plano dos mapas: do labirinto sorteado ao lugar que se aprende

Análise de 19/10/2026 (sessão manual, pedido do Leonardo: "o mapa está pobre
para a arte do Tibia que temos; enriqueça todos, inspirado no Tibia, e procure
mapas do Tibia que se possam baixar de forma legal"). É **referência**, como as
outras análises de `docs/`: quando discordar do `CLAUDE.md`, vale o guia. A
fila de trabalho continua no `ROADMAP.md`.

---

## 1. Diagnóstico (antes da 0.29.0)

| O que | Como estava | Por que parecia pobre |
|---|---|---|
| Forma | `genMap()`: retângulos de 4 a 13 sqm ligados por corredores de 2 sqm, o mesmo algoritmo nos quatro lugares | O Esgoto, a Ilha e a Cripta só mudavam o tamanho das salas. Nenhum lugar do Tibia é uma grade de caixas |
| Chão | um sprite por lugar | O Tibia mistura variantes do mesmo chão e põe borda onde dois chãos se encontram |
| Enfeite | `cascalho` a cada ~23 sqm e tocha na parede | Sem teia, ossada, sangue, mato, pedra, nada que diga "isto é uma cripta" |
| Objetos | nenhum | No Tibia, pilar, sarcófago, palmeira e rocha ocupam o sqm e mudam a luta (segurar corredor, contornar) |
| Ilha | areia entre paredes de tijolo | Lugar aberto no Tibia é fechado por mato, montanha e água, não por muro |
| Uso do OTSP | 156 dos ~2.600 sprites | Há bordas de chão (215–504), montanhas (919–994), rochas (1598–1675), plantas e árvores (1315–1584), teias (1271–1274), estátuas, sarcófago, palmeira, cacto, escada, buraco, trilho de mina |

A cidade (`city.mapa`, à mão) já estava no caminho certo: é o modelo para o
resto.

## 2. Mapas do Tibia que se podem baixar legalmente

Pesquisa de 19/10/2026. A regra do projeto (Parte 1, não-objetivos) proíbe
qualquer coisa da CipSoft, e a licença de código de um servidor OT **não**
libera o mapa que vem junto.

| Fonte | Licença | Pode usar? |
|---|---|---|
| **`server_files/world/otsp.otbm`** do próprio OTSP (peonso/opentibia_sprite_pack, commit `ae88e18`), com `otsp-spawn.xml` e os `rme_files/` (items.otb, tilesets, borders para o Remere's Map Editor) | CC BY 4.0, a mesma dos sprites | **Sim**, com crédito. Mas é um mapa de demonstração: ~117×90 sqm, 3 andares, 144 ids. Serve de exemplo de como os ids do OTSP se combinam (chão, borda, parede, escada), não de mundo |
| `forgotten.otbm` da The Forgotten Server | repositório GPL-2.0, sem licença própria do mapa nem autor | Não. Usa ids do cliente da CipSoft (10.9x) e a GPL não cobre arte de mapa claramente |
| Mapa global do Canary/OTServBR, "real map", conversões 7.7 (`.sec` do RealOTS) | — | **Proibido**: é o mapa da CipSoft, copiado ou vazado |
| Mapas custom do OTLand (Nutopia e outros) | quase nunca declaram licença | Não, sem licença escrita |
| OTBM2JSON (Inconcessus) | MIT | Sim, como referência para ler e gravar `.otbm` num script sem dependência |
| OTMapGen (Inconcessus) | MIT | A ideia (ruído + bordas + enfeites automáticos) sim; as tabelas de id são do Tibia e precisam ser refeitas para o OTSP |
| Tabela Tibia→OTSP do peonso (gist `convert.js`) | sem licença | Só consulta. Converter id não limpa a origem de um mapa da CipSoft |

**Conclusão:** não existe mapa grande do Tibia que se possa usar. O caminho é
**desenhar os nossos** com as ferramentas livres que já existem para o OTSP:
o Remere's Map Editor com os `rme_files` do pacote, e um leitor de `.otbm` em
`tools/` (seguindo o formato do OTBM2JSON, MIT) que converte o desenho para o
`content.json`. Os ids do OTSP não batem com os do Tibia ("OTSP uses different
IDs for everything", GUIDE.md do pacote), então todo mapa tem de nascer no OTSP.

## 3. O que o Tibia faz e o Fibula copia

O que entra é o que aumenta **peso e consequência** (pilares 1 e 2); nada que
aumente espera ou deslocamento (pilar 5).

1. **Cada lugar tem um desenho próprio.** Esgoto é canal de água com passarela
   e grade; caverna é parede orgânica, não retângulo; tumba é corredor com
   nichos e sarcófagos; ilha é clareira cercada de mato e mar.
2. **Objetos ocupam o sqm.** Pilar e rocha viram cobertura e gargalo: o
   cavaleiro segura a passagem entre dois pilares, o caçador atira por trás de
   um sarcófago. Muda a luta, por isso é regra (`src/sim/`), não desenho.
3. **Marcos que se aprendem.** "O salão das quatro gárgulas", "a palmeira
   torta perto da escada": é assim que o jogador do Tibia sabe onde está sem
   olhar o mapa. Só funciona com o mapa fixo (pilar 2).
4. **Chão com borda.** Grama que vira areia, terra que vira lama: as peças de
   borda do OTSP (215–504) são o que dá a cara de Tibia.
5. **Saída perto.** Escada, buraco e corda espalhados (pendência P8: ≤ 60 s).
6. **Luz como informação.** Tocha marca o corredor principal; escuridão marca
   o fundo.

## 4. Fases

### Fase 1 — Vestir os mapas (feita na 0.29.0)

- **Objetos sólidos** por lugar (`hunts.<k>.mapa.objetos`): pilar, barril e
  caixote, rocha (Runas); barril, caixote e rocha com musgo (Esgoto); palmeira,
  pedra e cacto (Ilha); sarcófago, gárgula e estátua, pilar (Cripta). Postos por
  `src/sim/mapa.js` encostados na parede, no canto ou no miolo de sala grande,
  com um hash da semente (a sequência de sorteio do resto não muda), e
  recusados se fecharem caminho. Sólidos para todos: jogador, monstro, campo de
  fluxo e projétil.
- **Detalhes do chão** (`arte.detalhes`): teia no canto, pedrinhas, sangue,
  ossadas, grade e lodo no Esgoto, tufos e plantas na Ilha, velas na Cripta.
- **Variantes de chão** (`arte.variantes`).
- **Ilha aberta** (`arte.borda`): sem muro; a rocha vira grama com mata.
- 54 sprites novos do OTSP no atlas (de 502 KB para 584 KB).

### Fase 2 — Mapas fixos (o `Agora` do ROADMAP)

Cada lugar com a semente dele no `content.json`. O detalhe que importa: a
semente do **mapa** (forma, objetos, onde os monstros nascem) é fixa, e a da
**caçada** (dano, loot, movimento) continua nova a cada sala. Hoje as duas são
a mesma; é preciso semear o mapa com a fixa, chamar `genMap()` e o spawn
inicial, e então semear a caçada com uma nova (a porta da sala passa a mandar
as duas). Com isso a Fase 1 vira marco que se aprende.

### Fase 3 — Forma por lugar

`genMap()` ganha um `estilo` por lugar, todos com sorteio da regra e mesma
saída (`g`, `rooms`, `obj`):

| Lugar | Estilo | Do Tibia |
|---|---|---|
| Runas | salões com fileiras de pilares e corredores largos | masmorra clássica de Rookgaard |
| Esgoto | galerias com **canal de água** no meio (sólido) e pontes de laje | esgoto de Thais |
| Ilha | **caverna orgânica** por autômato celular: clareiras de areia, ilhas de mato no meio, sem retângulo | ilhas de Tiquanda/Liberty Bay |
| Cripta | corredores estreitos com **nichos de sarcófago** dos dois lados e câmaras redondas | tumbas de Ankrahmun |

A água precisa de um valor novo em `g` (sólido, desenhado como água) e de
borda de margem (Fase 4).

### Fase 4 — Bordas de chão do Tibia

Uma camada de chão por sqm (areia, grama, terra, lama, água) e, onde dois se
encontram, a peça de borda certa (norte, sul, leste, oeste, quatro cantos de
fora, quatro de dentro) — o "auto-border" do Remere's Map Editor. As peças
estão no OTSP (215–504); a tabela por material vai para o `content.json`. A
mesma camada serve à cidade (rua de pedra sobre grama com borda, margem do
rio).

### Fase 5 — Mapas autorais desenhados no editor (decisão do Leonardo)

O ponto de chegada do Tibia: mapa feito à mão, com intenção. Duas opções:

1. **Remere's Map Editor + `tools/otbm.mjs`** (recomendada) — quem desenha usa
   o editor que a comunidade OT usa há 15 anos, com os `rme_files` do OTSP; o
   script lê o `.otbm` (formato do OTBM2JSON, MIT) e grava `hunts.<k>.grade`
   (letras, como `city.mapa`) e as zonas de spawn no `content.json`. O jogo não
   muda de natureza: continua lendo texto.
2. **Letras à mão no `content.json`**, como a cidade — sem ferramenta nova,
   mas 64×64 por lugar é muito texto para editar no celular.

Nas duas, o gerador vira só a ferramenta que faz o primeiro rascunho. O
`otsp.otbm` entra em `assets/CREDITOS.md` se algum pedaço dele for usado.

### Fase 6 — A cidade

Bordas (Fase 4) na rua e no rio, mais variedade de chão e enfeite com os
mesmos `detalhes`, e a cidade mostrando os lugares de caça (a grade do esgoto,
o porto, a colina da cripta) como marcos.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Objeto alto (64 px) esconde monstro atrás | O Tibia tem o mesmo; o nome e a barra de vida ficam por cima. Conferir em 360×640 a cada lugar novo |
| Objeto no sqm do spawn reduz monstros | O spawn pula o sqm sólido; medido: diferença pequena. O Balanceamento confere ao medir horas por nível |
| Atlas cresce | 584 KB hoje, orçamento de 2 MB; um atlas por lugar quando passar (Parte 2, regra 3) |
| Mapa sorteado com marco "fixo" engana | Só depois da Fase 2 os marcos valem; até lá são enfeite |
| Arte de fonte nova | Tudo aqui é OTSP. Qualquer outra fonte é decisão do Leonardo |
