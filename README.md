# Fibula — Masmorra de Runas

Protótipo jogável de um RPG de extração para celular.

**Jogar:** https://llmannrich-ai.github.io/Fibula/

## Na incursão

- Arraste o lado esquerdo da tela para andar.
- Segure **Faísca** para atacar o monstro mais próximo; **Runa** causa dano em área; **Poção** cura.
- O portal de saída abre aos 1:30. Fique 2,5 s nele para extrair. Se morrer, perde o loot do saco.
- Teclado: WASD anda, J Faísca, K Runa, L Poção.

## Entre incursões (Etapa 2)

O ouro que você extrai vai para o **cofre**, e o cofre só serve para gastar com o
**Mercador**, no menu. As melhorias são permanentes e valem para todas as
incursões seguintes:

| Melhoria | Efeito | Níveis |
|---|---|---|
| Vigor | +15 de vida máxima | 8 |
| Foco | +10 de mana máxima | 8 |
| Poder arcano | +8% de dano na Faísca e na Runa | 8 |
| Bolsa de poções | +1 poção em cada incursão | 4 |
| Selo de resguardo | guarda 20% do loot do saco se você morrer | 3 |

O preço de cada nível sobe geometricamente, então o cofre nunca deixa de ter uso.

O progresso fica salvo no navegador de cada aparelho.

## Desenvolvimento

O jogo inteiro é o `index.html` — sem build e sem biblioteca, servido cru pelo
GitHub Pages.

A documentação do projeto está em [CLAUDE.md](CLAUDE.md) (arquitetura,
convenções e como testar), [VISAO.md](VISAO.md) (os pilares de design e os
não-objetivos), [ROADMAP.md](ROADMAP.md) e [DIARIO.md](DIARIO.md).
