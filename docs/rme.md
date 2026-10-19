# Desenhar um mapa de caça no Remere's Map Editor

Decisão do Leonardo em 19/10/2026: **os mapas de caça são fixos**, iguais em
toda caçada e para todo jogador, e são desenhados no Remere's Map Editor
(RME) com os sprites do OTSP. O jogo não sorteia nada no mapa: nem a forma,
nem os objetos, nem onde os monstros nascem. A sorte fica só no que acontece
durante a caçada (dano, loot, movimento).

O mapa de verdade mora no `data/game/content.json` (`hunts.<lugar>.mapa`). O
`.otbm` é o arquivo de trabalho do editor: exporta-se, edita-se e importa-se
de volta. Os scripts estão em `tools/`, rodam com o Node e não instalam nada.

## Uma vez só: preparar o editor

1. **Baixe o OTSP**, se ainda não tem: `node tools/sprites.mjs` (o script
   clona o pacote numa pasta temporária e refaz o atlas). Ele precisa do
   `cwebp`: no Windows, baixe o zip da libwebp em
   developers.google.com/speed/webp/download, descompacte e ponha a pasta
   `bin` no PATH (ou o caminho do `cwebp.exe` em `FIBULA_CWEBP`).
2. **Monte a pasta do editor:** `node tools/otbm.mjs rme`. Ela sai em
   `mapas-rme/editor/`, com:
   - `data/` — os arquivos do OTSP para o RME (`items.otb`, `items.xml`,
     pincéis e paletas) e o `creatures.xml` com os **monstros do Fibula** na
     paleta de criaturas, com o desenho do jogo;
   - `cliente/` — o `otsp.dat` e o `otsp.spr` renomeados para `Tibia.dat` e
     `Tibia.spr`, que é o nome que o RME procura.
3. **Instale o RME** 3.3 ou mais novo (github.com/hampusborgos/rme, aba
   Releases). O mapa de exemplo do OTSP foi salvo com o RME 3.3, então essa
   versão sabe abrir os sprites do pacote.
4. **Aponte o RME para o OTSP:**
   - copie o conteúdo de `mapas-rme/editor/data/` para a pasta de dados da
     versão 10.41 dentro do RME (algo como `data/1041/`), substituindo os
     arquivos;
   - em Preferências → Client Version, escolha 10.41 e aponte o caminho do
     cliente para `mapas-rme/editor/cliente/`;
   - se o RME reclamar da assinatura dos arquivos, desmarque "Check file
     signatures" na mesma aba (o `.dat` do OTSP não é o da CipSoft, e é por
     isso que a assinatura não bate).

Esta configuração ainda não foi testada numa máquina Windows. Se algum passo
não bater com a tela do seu RME, o resto do caminho continua valendo: o que
importa é o RME abrir os sprites do OTSP.

## A cada mapa: exportar, desenhar, importar

```bash
node tools/otbm.mjs exporta cripta      # mapas-rme/cripta.otbm e cripta-spawn.xml
# abrir mapas-rme/cripta.otbm no RME, desenhar, salvar
node tools/otbm.mjs importa cripta      # volta para hunts.cripta.mapa no content.json
node tools/sprites.mjs                  # os itens novos do mapa entram no atlas
node tools/testar.mjs                   # o portão de sempre
node tools/versao.mjs 0.X.0             # o atlas mudou: versão nova
```

Os quatro lugares hoje (`runas`, `esgoto`, `ilha`, `cripta`) têm um
**rascunho** feito por `tools/mapas.mjs` a partir do gerador antigo. É um
ponto de partida, não um mapa pensado: a ideia é redesenhar cada um no
editor. Gerar o rascunho de novo (`node tools/mapas.mjs <lugar> --forca`)
apaga o que foi desenhado.

## As regras do desenho

| Regra | Por quê |
|---|---|
| Tudo no **andar 7**, entre **x 1000 e 1063, y 1000 e 1063** (64×64 sqm) | É o tamanho do mapa no jogo (`MW`, `MH`). O import recusa sqm fora dessa área |
| Um **waypoint chamado `entrada`** onde fica a porta, com chão nele, à esquerda, à direita e embaixo | É onde o grupo aparece (até 4) e por onde sai |
| **Um monstro por spawn**, com o nome da paleta Fibula | Cada monstro posto é um ponto fixo: nasce ali e renasce ali 60 s depois de morrer, se ninguém estiver a menos de 10 sqm. O raio e o tempo do RME são ignorados |
| O **chefe do lugar** precisa estar no spawn | O carregamento recusa o mapa sem ele |
| Todo monstro alcançável andando da entrada | O harness confere |
| Para caminhar, o sqm precisa de chão e nada sólido | O que é sólido, chão ou luz vem do `items.otb` do OTSP (`tools/otsp-itens.json`): parede, árvore, pilar, estátua e água bloqueiam; tocha e vela iluminam |

O que o jogo ainda **não** lê do `.otbm`: outros andares (escada, buraco,
corda), casas, atributos de item (quantidade, ação) e teleporte. Uma
segunda saída, se vier, entra como um segundo waypoint.

## O pilar que isso serve

Pilar 2 — o mundo é fixo e se aprende. Pense nos marcos: o salão das
gárgulas, a palmeira torta perto da escada, o corredor estreito onde o
cavaleiro segura três orcs. Lugar que se reconhece sem olhar o mapa é o que
o Tibia tinha e o sorteio tirava.
