# Créditos da arte

Toda imagem que o jogo mostra vem daqui. Cada arquivo novo em `assets/` entra
nesta lista com origem, licença e o que foi alterado (seção 9 do
[PRD](../docs/PRD.md)).

## OpenTibia Sprite Pack (OTSP)

| | |
|---|---|
| Origem | https://github.com/peonso/opentibia_sprite_pack |
| Versão usada | commit `ae88e1828671b349e729dd21177dde15ea41e123` (14/12/2020) |
| Licença | Creative Commons Atribuição 4.0 Internacional (CC BY 4.0) — texto em [otsp/LICENSE.txt](otsp/LICENSE.txt) |
| Autores | comunidade OpenTibia — lista completa em [otsp/AUTHORS.md](otsp/AUTHORS.md) |

### Arquivos

| Arquivo | O que é | Alterações |
|---|---|---|
| `otsp/atlas.png` | os sprites que o jogo usa, reunidos numa imagem só | recortados de `client_files/otsp.spr` segundo `client_files/otsp.dat` e rearranjados em grade; quadros vazios no início de três efeitos foram descartados; quatro sprites tiveram o matiz girado para virar outro elemento (`ef_energia`, `ef_sagrado` e `mi_energia` a partir do brilho azul, `ef_terra` a partir da nuvem rosa, `mi_sagrado` a partir da estrela) |
| `otsp/atlas.json` | posição, tamanho, direções e quadros de cada sprite no atlas | gerado |
| `otsp/LICENSE.txt` | licença do pacote | cópia sem alteração |
| `otsp/AUTHORS.md` | autores do pacote | cópia sem alteração |

Nenhum pixel foi desenhado à mão: o atlas sai inteiro de
[`tools/sprites.mjs`](../tools/sprites.mjs), que baixa o pacote no commit acima
e gera os arquivos de novo, idênticos. A tabela `ARTE` no topo do script diz
qual sprite do pacote virou o quê no jogo (monstros, classes, cadáveres, chão,
paredes, itens, efeitos e projéteis).

Os nomes de monstros, itens, lugares e magias são do Fibula. Nada vem do
cliente oficial do Tibia (`Tibia.spr`/`Tibia.dat`), do site da CipSoft ou da
TibiaWiki.

## Pendente

A tela de créditos dentro do jogo ainda não existe; até lá, este arquivo e o
link no README cumprem a atribuição que a licença exige.
