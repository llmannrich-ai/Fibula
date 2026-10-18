# Diário de desenvolvimento

Uma entrada por execução, mais recente no topo, máximo 20 — ao passar de 20,
apague a mais antiga. Cada entrada diz **o que mudou**, **o que foi testado** e
**o que ficou torto**. A terceira parte é a mais útil: é o que a próxima
execução precisa saber e não vai descobrir lendo o código.

Formato: `## AAAA-MM-DD — título curto`, seguido das três partes.

---

## 2026-10-18 — Base de orientação para IA

**O que mudou.** Criados `CLAUDE.md` (como trabalhar: arquitetura do
`index.html`, convenções, roteiro de teste headless, regras de git),
`VISAO.md` (por que o jogo é assim: a frase, os cinco pilares, os
não-objetivos, o teste de quatro perguntas), `ROADMAP.md` e este diário.
Nenhuma linha de jogo foi alterada.

O roadmap nasceu com o primeiro item em `Agora` já escolhido e justificado:
peso de XP na morte. Os itens de `Próximo` e `Depois` declaram o pilar que
servem, para que a próxima execução não precise reinventar a justificativa.

**O que foi testado.** Nada de execução — a mudança é só de documentação, o
`index.html` não foi tocado. Conferido que o repositório não tinha nenhum
arquivo de orientação antes (sem `CLAUDE.md`, `AGENTS.md`, `.cursorrules`) e
que o `ROADMAP.md` e o `DIARIO.md` que o ciclo automático espera na raiz da
`main` de fato não existiam.

**O que ficou torto.** Três coisas:

Primeira: ao conferir o `<head>` para montar a tabela de linhas do `CLAUDE.md`,
apareceu uma dependência de rede que eu havia dado como inexistente — o
`index.html` busca duas fontes no Google Fonts (linhas 13–15). A documentação
foi corrigida para registrar a exceção em vez de afirmar "zero dependências", e
a remoção entrou em `Depois` no roadmap. Lição para a próxima execução: conferir
o `<head>` antes de repetir que o jogo não faz chamada externa.

Segunda: **não existe harness de teste no repositório.** O `CLAUDE.md`
descreve o procedimento headless em detalhe, mas cada execução ainda precisa
montar o `test.html` do zero. Isso é desperdício e convida a pular o teste. Um
script em `tools/` que gere os dois harness (menu com loja, e incursão ativa) e
devolva código de saída diferente de zero quando o `data-errs` aparecer
resolveria — forte candidato a item de roadmap.

Terceira: **os números de linha da tabela do `CLAUDE.md` vão envelhecer.** Eles
valem para o `index.html` de 861 linhas desta data. Se a divergência incomodar,
troque a coluna de linhas pelos marcadores de seção, que são estáveis.

---

## 2026-10-18 — Correção do tempo da incursão na tela final

**O que mudou.** A tela final passou a exibir a duração correta da incursão.

**O que foi testado.** Sem registro — entrada reconstruída do histórico do git
(`9a7e4db`), antes de este diário existir.

**O que ficou torto.** Sem registro.

---

## 2026-10-18 — Etapa 2: cofre e Mercador

**O que mudou.** O ouro extraído passou a acumular no cofre, e o cofre ganhou
destino: o Mercador, com cinco melhorias permanentes de preço geométrico —
Vigor, Foco, Poder arcano, Bolsa de poções e Selo de resguardo. O save ganhou o
objeto `up` com o nível de cada melhoria, e `stats()` passou a derivar vida,
mana e poder do nível somado às melhorias.

**O que foi testado.** Sem registro — entrada reconstruída do histórico do git
(`ca4b5e7`).

**O que ficou torto.** Sem registro.

---

## 2026-10-18 — Etapa 1: protótipo jogável

**O que mudou.** Primeira versão do jogo num `index.html` único: incursão de
seis minutos em masmorra gerada por salas e corredores, cinco tipos de monstro
mais o Guardião do Portal, perseguição por campo de fluxo recalculado a cada
0,2 s, loot por tabela de raridade, portal de extração abrindo aos 1:30 com 2,5 s
de canalização, morte com perda do saco, HUD com vida, mana, XP e relógio,
minimapa com névoa, e joystick virtual na metade esquerda da tela.

**O que foi testado.** Sem registro — entrada reconstruída do histórico do git
(`b451196`).

**O que ficou torto.** Sem registro.
