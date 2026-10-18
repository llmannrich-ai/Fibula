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

## 2026-10-18 23:30 UTC — Desenvolvedor

**Item desenvolvido:** ferramenta de teste headless — `tools/teste.js`, mais a seção 2 do `CLAUDE.md` reescrita para usá-la. Nenhuma linha do `index.html` alterada.

**Validação:** `node tools/teste.js` imprime `TESTE_OK` e sai com 0 nos dois cenários (menu e Mercador com compra e save; incursão ativa de 12 s até a tela final e "Nova incursão"). Cópia com `throw` injetado em `update()` falha com exit 1 e mensagem do erro. Não rodei a checagem de sintaxe separada porque o código de jogo não mudou.

**Análise:**
- O jogo é uma IIFE: o teste não alcança `G` nem `save` por fora, então os cenários dirigem a interface por cliques e leem o DOM e o `localStorage`.
- O save semeado precisa trazer o personagem em `chars`; sem isso o menu quebra (`ch()` indefinido). Qualquer teste futuro de save deve semear assim.
- A incursão de teste termina por "desabou" (o jogador não se move), o que exercita `update()`, `hud()` e `finish()`, mas não a extração nem a morte em combate.

**Roadmap:** item movido para `Concluído`; a CI foi promovida a `Agora`; `Próximo` renumerado.

**Pendências e riscos:**
- Não testei no Windows/Edge; o `CLAUDE.md` manda definir `CHROME` com o `msedge.exe`. Não confirmado.
- Não há cenário de extração nem de morte. Cobrir isso exige mover o jogador até o portal, o que o IIFE dificulta; avaliar quando a divisão do `index.html` expuser a simulação.
- A CI continua dependendo da permissão C4 (issue #2). Sem ela o push de `.github/workflows` pode ser recusado.

**Próximo passo recomendado:** tentar a CI (`.github/workflows/ci.yml`: sintaxe + `node tools/teste.js`) direto na `main`; se o push for recusado, deixar o arquivo em `docs/` e seguir para o aviso de falha do save.

---

## 2026-10-18 22:00 UTC — Produto

**Item desenvolvido:** primeira execução do agente de Produto. Só `ROADMAP.md`; nenhuma linha de jogo. `Agora` virou a ferramenta de teste headless em `tools/`; `Próximo` ganhou os itens técnicos da F0 (CI, aviso de save + teste da migração, pipeline OTSP, RNG com semente) à frente de morte-com-XP e Selo.

**Validação:** não se aplica a código. Conferido que o `ROADMAP.md` tem um item em `Agora`, 6 em `Próximo` e que todo item tem pilar, fase e "Pronto quando". Push de teste na `main` funcionou.

**Análise:**
- Fase atual: **F0 · Fundação**. Critérios de saída: faltam todos os verificáveis — não há CI nem testes, sem RNG com semente, sem sprites (`assets/` não existe), sem teste da migração, sem Playwright; fontes ainda externas; PWA ausente. A divisão do `index.html` segue em andamento (o `CLAUDE.md` ainda tem a "Regra número um").
- Issues abertas: nenhuma antes desta execução; nada a responder nem prazo vencido.
- Modo de publicação: `direto`, coerente (sem CI).

**Roadmap:** a "Peso na morte" saiu de `Agora` para `Próximo` 5 (itens técnicos da F0 têm prioridade, e o Desenvolvedor precisa do teste automatizado como portão). Os itens de jogo 3 a 9 (profundidades, equipamento, sair cedo, lugares, monstro, escala de HP, log) foram para `Depois`: equipamento e 2º bioma são F1, e a fila excedia 8 itens. O item "Harness de teste" de `Depois` foi absorvido por `Agora`. Esta execução incluiu 5 itens novos (os da lista da primeira execução, que prevalece sobre o limite de 3). O aviso de save e o teste da migração foram fundidos num só item.

**Pendências e riscos:**
- A CI precisa de C4 (permissão de workflows). Aberta issue `precisa-do-dono`; sem ela o push do workflow pode ser recusado; decisão do dono: sem PR, tudo direto na `main`.
- O RNG com semente e o pipeline de sprites mexem no `index.html` ou criam arquivos: respeitar os limites da seção 3 do `comum.md` até a divisão terminar.
- O teste headless depende do Chromium em `/opt/pw-browsers`; o `CLAUDE.md` ainda descreve o Edge do Windows.

**Próximo passo recomendado:** Desenvolvedor executa `Agora` (`tools/teste.js`) e atualiza o `CLAUDE.md`.

---

## 2026-10-18 20:00 UTC — Sessão manual

**Item desenvolvido:** conteúdo do jogo fora do motor (`191e80e`). Classes, habilidades, melhorias, inimigos, itens, loot e progressão em `data/game/content.json`, com validação no carregamento. Não era item do roadmap: veio de um pedido direto do Leonardo, que também trouxe a base de `data/mechanics/` e `tools/extract-mechanics.ps1` (já na `main` pelo ciclo).

**Validação:** quatro harness headless contra o `index.html` desta entrega — combate, extração, menu com loja e grimório, e morte — com `data-errs="` **ausente** nos quatro. Números conferidos contra os dados do JSON, não só "abriu sem erro": vida 151 do Feiticeiro nível 12 (`hp 85 + ghp 6 × 11`); Vigor a 120 e cofre 1000 → 880; vida 166 na incursão seguinte à compra; Grimório com 3 espaços no nível 12 e 6 habilidades da classe; extração levando o cofre de 1000 a 1200 em 0:05; morte em 0/85 perdendo os 200 de loot semeados. O `SINTAXE_OK` **não** foi produzido: não há Node nesta máquina. Os harness cobrem o caso, porque um erro de parse apareceria como `data-errs`.

**Análise:**
- A migração de save da Etapa 2 chama `novoChar()` → `slotsIniciais()` no topo do script, o que já lê `SPELLS` e `SLOT_LVL`. Por isso carregar os dados tarde não servia: o IIFE teve de virar assíncrono e aguardar antes de qualquer coisa.
- As 24 habilidades foram movidas por geração, não à mão: um script extrai o texto dos literais do `index.html`, o JS avalia e o resultado vira JSON. Transcrição manual de 24 registros com 12 campos cada erra em silêncio.
- A progressão de inimigos por profundidade continuava com números fixos no código (`1+.35*d`, bandas `.6/.4`); agora está no arquivo. Distribuição medida em 20 mil amostras por banda bate com a anterior.

**Roadmap:** só `Concluído` ganhou entrada. `Agora` ficou intocado de propósito — a ferramenta de teste headless é item do ciclo.

**Pendências e riscos:**
- **O `tools/teste.js` precisou de ajuste e eu não pude executá-lo.** A ferramenta nasceu na execução das 23:30, contra o `index.html` sem o `fetch`, e usava `file://`: o navegador bloqueia `fetch` em arquivo do disco mesmo com `--allow-file-access-from-files`, então ela quebraria com esta entrega. Subir um servidor no mesmo processo não dá — o `spawnSync` bloqueia o laço de eventos —, então o SHIM passou a devolver o `content.json` real, lido do repositório ao montar a cópia; a validação do carregamento continua rodando contra o arquivo verdadeiro. **Não há Node nesta máquina, então esse ajuste foi escrito e não executado.** A próxima execução do ciclo é a primeira a rodar `node tools/teste.js` com ele.
- Duas armadilhas que custaram tempo e vão custar de novo: as linhas do `#log` se apagam sozinhas em 8,2 s e o log guarda só 5, então um amostrador que **sobrescreve** o resultado lê vazio no fim da corrida — tem de acumular; e `--dump-dom` capturado com `&` no PowerShell volta vazio, precisa de `Start-Process -RedirectStandardOutput`.
- O harness usado aqui é Python e vive fora do repositório (scratchpad da sessão). Não é o script Node que o roadmap pede; serve como referência do que testar, não como entrega.
- Não testei: incursão de 6 minutos inteira (os harness encurtam `RUN`), troca de habilidade no Grimório, e recarregar a página para conferir persistência do save.
- Esta sessão e o ciclo automático escreveram na `main` em paralelo duas vezes. Na primeira, o ciclo descartou a externalização ao resolver o conflito do `index.html` e documentou o contrário no README; esta entrega a reaplica sobre a Etapa 3. Se a decisão certa for manter os dados inline, é `git revert` deste commit — mas então o README precisa voltar atrás também.
- O carimbo da entrada anterior (22:00 UTC) está à frente do relógio real (20:00 UTC nesta execução), o que embaralha a ordenação por horário.

**Próximo passo recomendado:** rodar `node tools/teste.js` e conferir o ajuste do SHIM que eu não pude executar. Depois, cobrir os três casos que ficaram sem teste: incursão de 6 minutos inteira, troca de habilidade no Grimório e recarga da página para conferir persistência do save.

## 2026-10-18 19:10 UTC

**Item desenvolvido:** Base de orientação para IA — commit `e13649f`.
`CLAUDE.md` (arquitetura do `index.html`, convenções de código, roteiro de teste
headless, regras de git), `VISAO.md` (a frase, os cinco pilares, os
não-objetivos, o teste de quatro perguntas), `AGENTS.md` como ponteiro, e
formato para este diário e para o roadmap. Nenhuma linha de jogo alterada.

**Validação:** `SINTAXE_OK` no `index.html` depois dos merges (o código é de
outras execuções; esta entrada não alterou nenhuma linha de jogo). Conferido que
os links internos dos documentos resolvem, que todos os arquivos estão em UTF-8,
que não sobrou marcador de conflito, e que os marcos de seção citados no
`CLAUDE.md` batem com o `index.html` de 1376 linhas depois do merge.

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
- No meio do trabalho a `main` recebeu a **Etapa 3** (`1639d2d`), que levou o
  `index.html` de 871 para 1376 linhas: quatro classes, grimório com slots, as
  três moedas de progressão do Tibia e save `v2` com migração da Etapa 2. O
  `CLAUDE.md` foi refeito em cima disso — mapa de seções, as três moedas, o
  formato novo do save e o padrão de migração — e a coluna de números de linha
  deu lugar aos marcadores de seção, que não envelhecem. O `VISAO.md` ganhou
  ponteiro para `docs/analise-tibia-habilidades.md`, que é a fonte das fórmulas.
  A Etapa 3 entregou de uma vez os dois itens que estavam em `Depois`, vocações
  e habilidade que sobe com uso, e ambos saíram da lista.

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
- **Referências a linha envelhecem rápido.** A Etapa 3 deslocou tudo de uma vez.
  O `CLAUDE.md` já foi convertido para citar marcadores de seção em vez de
  faixas de linha, mas as referências `index.html:NNN` das entradas antigas
  deste diário apontam para o arquivo de 871 linhas e não valem mais.
- **A `main` se move durante a sessão.** Esta entrada precisou de dois merges:
  a rotina commitou duas vezes, e a Etapa 3 entrou depois disso. Deu para
  mesclar sem perda nenhuma, mas o risco de sobrescrever é real. Antes de
  escrever `ROADMAP.md` ou `DIARIO.md`, e antes de qualquer push, faça
  `git fetch` e leia a versão da `main`.
- **A Etapa 3 chegou sem passar pelo roadmap nem pelo diário.** Ela foi
  registrada aqui retroativamente, nesta entrada. O `index.html` dela não foi
  exercitado por esta sessão além do portão de sintaxe — classes, grimório e a
  migração `v1`→`v2` nunca passaram pelo harness headless.

**Próximo passo recomendado:** implementar o item de `Agora` (peso de XP na
morte). Ler o `VISAO.md` antes, porque a decisão de quanto cobrar é de
balanceamento de pilar, não de código. Mexe em `gainXp()`, `finish()`,
`showEnd()` e `hud()`, e agora escreve em `ch().xp` em vez de `save.xp`, por
causa do save `v2` por classe. Começar só pelo nível, deixando magia e perícia
intactas. Antes disso, se sobrar execução, vale rodar o harness headless contra
a Etapa 3 — ela nunca foi exercitada além da sintaxe.

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
