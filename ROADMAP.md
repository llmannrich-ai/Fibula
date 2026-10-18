# Roadmap - Fibula

## Agora
- **Aviso quando o save não persiste** — em modo privado/sem localStorage o progresso simplesmente não é salvo, sem aviso. Pronto quando: um banner ou linha no menu avisa se `persist()` falhou ao menos uma vez.

## Proximo
- **Revisar economia do Selo de resguardo** — no nível 3 guarda 60% do loot do saco na morte, o que pode reduzir demais o risco de extração tardia. Pronto quando: custo ou percentual ajustado e justificado por uma simulação rápida de algumas incursões.
- **Novo tipo de monstro para variar a sala do Guardião** — hoje só orc/xamã acompanham o chefe. Pronto quando: um monstro novo aparece ocasionalmente nessa sala com loot próprio.
- **Ajustar escala de HP dos monstros em níveis altos** — monstros escalam com `save.lvl`, o que pode tornar incursões lentas e repetitivas para jogadores avançados. Pronto quando: curva revisada e testada mentalmente contra 2-3 níveis de referência.
- **Tornar o log de mensagens mais legível em telas pequenas** — `#log` usa `width:min(66vw,330px)` sobre o canvas; vale conferir empilhamento em telas muito estreitas (<340px). Pronto quando: testado/ajustado num viewport de 320px de largura.

## Depois
- Sistema de equipamento (itens que mudam o personagem, não só vendem no cofre).
- Novos biomas/temas de masmorra (visual e monstros diferentes).
- Efeitos sonoros e música ambiente.
- Placar global ou comparação entre dispositivos (hoje é só local).

## Concluido
- Bússola apontando para o portal — 2026-10-18 — fb877b1
- Guarda contra loop infinito em genMap() — 2026-10-18 — f6c53ef
