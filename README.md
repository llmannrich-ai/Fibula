# Fibula — Masmorra de Runas

Protótipo jogável (Etapa 1) de um RPG de extração para celular.

**Jogar:** https://llmannrich-ai.github.io/Fibula/

- Arraste o lado esquerdo da tela para andar.
- Segure **Faísca** para atacar o monstro mais próximo; **Runa** causa dano em área; **Poção** cura.
- O portal de saída abre aos 1:30. Fique 2,5 s nele para extrair. Se morrer, perde o loot do saco.
- Teclado: WASD anda, J Faísca, K Runa, L Poção.

O progresso fica salvo no navegador de cada aparelho.

## Desenvolvimento

O conteúdo do jogo — inimigos, itens, loot e progressão — fica em
[`data/game/content.json`](data/game/content.json) e é carregado em runtime. Dá para
ajustar balanceamento mexendo só nesse arquivo, sem tocar no motor.

Como o jogo busca esse arquivo por rede, **abrir o `index.html` direto do disco não
funciona** (o navegador bloqueia `fetch` em `file://`). Para rodar local:

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

e abrir http://localhost:8080/. Em produção, no GitHub Pages, funciona direto.

[`data/mechanics/`](data/mechanics/README.md) guarda a base de referência de combate,
classes, itens e inimigos que embasa o balanceamento, derivada de um servidor open source
por [`tools/extract-mechanics.ps1`](tools/extract-mechanics.ps1).
