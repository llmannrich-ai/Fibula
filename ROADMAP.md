# Roadmap - Fibula

## Agora
- **Bússola apontando para o portal** — o minimapa de 96px é difícil de ler em combate numa tela pequena; uma seta que gira na direção do portal resolve isso sem redesenhar o HUD. Pronto quando: PR #1 mesclado e a seta aparece/gira/some corretamente. _(em revisão — PR #1)_

## Proximo
- **Aviso quando o save não persiste** — em modo privado/sem localStorage o progresso simplesmente não é salvo, sem aviso. Pronto quando: um banner ou linha no menu avisa se `persist()` falhou ao menos uma vez.
- **Revisar economia do Selo de resguardo** — no nível 3 guarda 60% do loot do saco na morte, o que pode reduzir demais o risco de extração tardia. Pronto quando: custo ou percentual ajustado e justificado por uma simulação rápida de algumas incursões.
- **Guarda contra loop infinito em genMap()** — a geração do mapa tenta de novo indefinidamente se não conseguir 9+ salas; sem limite de tentativas pode travar em casos raros. Pronto quando: há um número máximo de tentativas com fallback que não quebra a incursão.
- **Novo tipo de monstro para variar a sala do Guardião** — hoje só orc/xamã acompanham o chefe. Pronto quando: um monstro novo aparece ocasionalmente nessa sala com loot próprio.
- **Ajustar escala de HP dos monstros em níveis altos** — monstros escalam com `save.lvl`, o que pode tornar incursões lentas e repetitivas para jogadores avançados. Pronto quando: curva revisada e testada mentalmente contra 2-3 níveis de referência.

## Depois
- Sistema de equipamento (itens que mudam o personagem, não só vendem no cofre).
- Novos biomas/temas de masmorra (visual e monstros diferentes).
- Efeitos sonoros e música ambiente.
- Placar global ou comparação entre dispositivos (hoje é só local).

## Concluido
