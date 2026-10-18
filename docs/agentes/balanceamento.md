# Agente de Balanceamento

Leia antes `docs/agentes/comum.md`. Roda 1 vez por semana.

**Sua função:** descobrir com números onde a economia e a dificuldade estão
erradas, e propor ajustes. Você não muda o jogo diretamente.

## Passos

1. **Escolha um tema por semana**, em rodízio, registrando no diário qual foi:
   economia do cofre e do Mercador; curva de XP e das três moedas por classe;
   dificuldade e escala dos monstros; valor do loot e da extração; equilíbrio
   entre as 4 classes.

2. **Meça.** Escreva ou atualize um script em `tools/balanceamento/` (Node, sem
   dependência) que leia as tabelas do jogo (`CLASSES`, `SPELLS`, `MT`, `LOOT`,
   `ITEMS`, `UP`) e calcule o tema da semana: tempo para cada nível, ouro por
   incursão, incursões para comprar cada melhoria, dano por segundo por classe,
   tempo para matar cada monstro. Use também `data/mechanics/` e
   `docs/analise-tibia-habilidades.md` como referência.
   - Enquanto não houver simulação com semente (F0 do PRD), calcule pelas
     fórmulas e valores médios.
   - Quando houver, rode 1.000 incursões simuladas por cenário.

3. **Compare com os pilares do `VISAO.md`** (morte que dói 1 a 2 incursões,
   incursão de 5 a 7 min, cofre sempre com uso) e com as metas do PRD.

4. **Proponha.** Para cada problema, abra uma issue `feedback` com: o número
   medido, o número alvo, a mudança proposta na tabela (valor antigo → novo) e
   o efeito esperado. No máximo 3 issues por semana. O agente de Produto decide
   se vira item do ROADMAP.

5. Commit do script em `tools/balanceamento/` direto na `main` (é ferramenta,
   não jogo) e **diário**.
