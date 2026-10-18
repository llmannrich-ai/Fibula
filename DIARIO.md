# Diário de execuções — Fibula

Uma entrada por execução, mais recente no topo, máximo 20 — ao passar de 20,
apague a mais antiga.

Formato de cada entrada, que é o que o ciclo automático já produz:

- `## AAAA-MM-DD HH:MM UTC`
- **Item desenvolvido:** o que saiu, com o commit ou o PR
- **Validação:** como foi testado (`SINTAXE_OK`, harness headless, teste manual)
- **Análise:** o que a leitura do código revelou nesta passada
- **Roadmap:** o que mudou de seção e por quê
- **Pendências e riscos:** o que ficou torto
- **Próximo passo recomendado:** para a execução seguinte

Das sete partes, **Pendências e riscos** é a mais útil: é o que a próxima
execução precisa saber e não vai descobrir lendo o código.

---

## 2026-10-18 19:10 UTC

**Item desenvolvido:** Base de orientação para IA — commit `e13649f`.
`CLAUDE.md` (arquitetura do `index.html`, convenções de código, roteiro de teste
headless, regras de git), `VISAO.md` (a frase, os cinco pilares, os
não-objetivos, o teste de quatro perguntas), `AGENTS.md` como ponteiro, e
formato para este diário e para o roadmap. Nenhuma linha de jogo alterada.

**Validação:** nada de execução — a mudança é só de documentação e o
`index.html` não foi tocado nesta entrada. Conferido que os links internos dos
quatro documentos resolvem, que todos os arquivos estão em UTF-8, e que os
marcos de linha citados no `CLAUDE.md` batem com o `index.html` de 871 linhas
depois do merge.

**Análise:**
- O repositório não tinha nenhum arquivo de orientação até agora: sem
  `CLAUDE.md`, sem `AGENTS.md`, sem `.cursorrules`. O ciclo automático começava
  cada execução sem saber a arquitetura, as convenções nem como testar.
- Ao conferir o `<head>` para montar a tabela de linhas, apareceu uma
  dependência de rede que eu havia dado como inexistente: o `index.html` busca
  Pixelify Sans e Barlow Semi Condensed no Google Fonts (linhas 13–15). A
  documentação foi corrigida para registrar a exceção em vez de afirmar "zero
  dependências". **Lição:** conferir o `<head>` antes de repetir que o jogo não
  faz chamada externa.
- A base filosófica foi definida pelo Leonardo nesta sessão e virou o
  `VISAO.md`: Tibia raiz num celular — a morte custa, o mundo parece maior que o
  jogador, incursão abaixo de dez minutos. Daí saíram os cinco pilares, e todo
  item do roadmap agora declara qual deles serve.
- As duas execuções anteriores do ciclo criaram um `ROADMAP.md` e um `DIARIO.md`
  próprios enquanto esta sessão escrevia os seus, em paralelo. Os dois conjuntos
  foram mesclados à mão: os itens e a análise da rotina foram preservados
  integralmente, e o formato de entrada **dela** foi adotado como contrato aqui,
  porque é mais rico que o que eu havia proposto e é o que a automação já emite.

**Roadmap:** reescrito na estrutura por pilares, com critério de "pronto quando"
em cada item. "Peso de XP na morte" entrou em `Agora` (pilar 1, o item-cabeça da
direção nova). O item que a rotina havia promovido a `Agora`, "aviso quando o
save não persiste", **desceu para `Próximo` #1** — nada estava em andamento, e a
direção que o Leonardo deu nesta sessão tem precedência; continua sendo um bug
real e é o próximo da fila. Os quatro itens de `Próximo` e as quatro ideias de
`Depois` da rotina foram todos mantidos, agora com pilar declarado. "Revisar a
economia do Selo de resguardo" ganhou urgência: a 60% ele briga diretamente com
o pilar 1, e piora quando a morte passar a custar XP. Dois itens novos em
`Depois`: cortar a dependência de fontes externas, e pôr um harness de teste no
repositório.

**Pendências e riscos:**
- **Não existe harness de teste no repositório.** O `CLAUDE.md` descreve o
  procedimento headless em detalhe, mas cada execução ainda monta o `test.html`
  do zero. Isso é desperdício e convida a pular o teste. Está em `Depois`.
- **Os números de linha do `CLAUDE.md` envelhecem a cada commit.** Eles valem
  para o `index.html` de 871 linhas de hoje. Se a divergência incomodar, troque
  a coluna de linhas pelos marcadores de seção `/* ---------- */`, que são
  estáveis. O mesmo vale para as referências `index.html:NNN` deste diário.
- **Duas bases concorrentes quase viraram três.** Enquanto esta sessão
  trabalhava num worktree, a rotina commitou duas vezes na `main`. Deu para
  mesclar sem perda, mas o risco é real: antes de escrever `ROADMAP.md` ou
  `DIARIO.md`, faça `git fetch` e leia a versão da `main`.

**Próximo passo recomendado:** implementar o item de `Agora` (peso de XP na
morte). Ler o `VISAO.md` antes, porque a decisão de quanto cobrar é de
balanceamento de pilar, não de código. Mexe em `gainXp()`, `finish()`,
`showEnd()` e `hud()` — não toca em `genMap()` nem no save além de reduzir
`save.xp`, então não conflita com nada pendente.

---

## 2026-10-18 18:47 UTC
**Item desenvolvido:** Guarda contra loop infinito em genMap() - commit f6c53ef
**Validação:** SINTAXE_OK
**Análise:**
- PR #1 (bússola) já foi mesclado por humano (commit fb877b1); nenhum PR aberto agora.
- `genMap()` (index.html:298, antes da correção) tentava gerar mapa em `for(;;)` sem limite; se 600 tentativas de posicionar salas nunca chegassem a 9, o laço rodava para sempre e travava a geração da incursão. Risco baixo mas sem rede de segurança — corrigido nesta execução.
- `hud()` em index.html:736 chama `setT(E.potN,'×'+p.pot)` toda frame mesmo sem mudança perceptível; `setT` já faz early-return por `textContent`, então custo é baixo — não é problema real.
- Balanceamento: Selo de resguardo no nível 3 ainda guarda 60% do loot na morte (index.html:258), o que pode reduzir demais o risco da extração tardia — mantido no roadmap para revisão.
- Robustez: não há aviso ao jogador quando `persist()` falha (index.html:244, catch vazio); promovido a item "Agora".
- Usabilidade: `#log` (index.html:61) usa `width:min(66vw,330px)`; não testado em viewport abaixo de 340px nesta execução — adicionado ao roadmap para verificação futura.
**Roadmap:** "Guarda contra loop infinito em genMap()" movido para Concluído. "Aviso quando o save não persiste" promovido de Próximo para Agora. Removido "Novo monstro"/"HP em níveis altos" não foram alterados de posição. Adicionado 1 item novo: "Tornar o log de mensagens mais legível em telas pequenas".
**Pendências e riscos:** Fallback de `genMap()` nunca testado em produção com mapa realmente degenerado (caso extremamente raro); comportamento visual do mapa nesse cenário-limite não foi validado manualmente, só por leitura de código.
**Próximo passo recomendado:** Implementar o aviso de save não persistente (item "Agora"): detectar falha em `persist()` (index.html:244) e mostrar banner/aviso simples no menu, sem alterar o formato do save.

## 2026-10-18 16:51 UTC
**Item desenvolvido:** Bússola apontando para o portal - PR #1 https://github.com/llmannrich-ai/Fibula/pull/1
**Análise:**
- Jogabilidade mobile: minimapa de 96px dificulta localizar o portal em combate; nenhum indicador direcional existia até agora.
- Robustez: save já é defensivo (campos ausentes recebem default via `Object.assign`); localStorage ausente já é tratado em try/catch, mas sem aviso ao jogador.
- Balanceamento: Selo de resguardo no nível máximo (3) guarda 60% do loot na morte, o que pode estar alto demais frente ao custo.
- Robustez: `genMap()` repete a geração até achar 9+ salas sem limite de tentativas; risco baixo mas sem rede de segurança.
- Nenhum bug bloqueante encontrado na leitura de `index.html`; código consistente com o estilo já existente.
**Roadmap:** Criado do zero (primeira execução). Item "Agora" = bússola (em PR). 5 itens em "Próximo", 4 ideias maiores em "Depois".
**Pendências e riscos:** PR #1 aguardando revisão humana; nenhuma mudança de save; nenhuma mudança direto na main além de ROADMAP/DIARIO.
**Próximo passo recomendado:** Se PR #1 ainda não tiver sido mesclado, escolher um item independente do roadmap (ex. "guarda contra loop infinito em genMap()" ou "aviso quando o save não persiste") que não toque no HUD/hud() para evitar conflito.
