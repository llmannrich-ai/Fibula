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

## 2026-10-18 23:50 UTC

**Item desenvolvido:** Harness de teste headless no repositório —
[tools/testar.mjs](tools/testar.mjs), commit `3f11261`. Um comando,
`node tools/testar.mjs`, refaz a checagem de sintaxe, monta uma **cópia** do
`index.html` por caso de teste, roda cada uma no Edge headless e sai com código
diferente de zero se qualquer asserção falhar ou se um erro de janela aparecer.
Oito casos, 194 asserções, 6 s de execução: menu com Mercador, incursão de ponta
a ponta até a extração, morte com o Selo de resguardo, as quatro classes,
grimório no nível 18, nível subindo no meio da incursão, save corrompido e
migração `v1`→`v2`. Cada caso tem save semeado próprio. No mesmo commit, as
duas correções que ele achou na Etapa 3 (abaixo) e o `CLAUDE.md` trocando o
procedimento manual pela linha de comando.

**Validação:** `SINTAXE_OK` e os 8 casos passando. O portão foi testado contra
si mesmo, com três cópias quebradas de propósito via `FIBULA_JOGO`: chave de
bloco a mais no `hud()` (barrou na sintaxe, saída 1), referência inexistente no
`hud()` (apareceu em `data-errs`, saída 1) e remoção do `save.cofre+=G.bagVal`
no `finish()` (duas asserções falharam nomeando o que leram, saída 1). Os cinco
itens da lista "o que olhar antes de dizer que está pronto" do `CLAUDE.md`
passaram a estar cobertos pelo script.

**Análise:**
- **A Etapa 3 nunca tinha sido executada fora do navegador de quem escreveu, e
  tinha dois bugs. Os dois foram corrigidos neste commit.**
  1. **A habilidade aprendida no meio da incursão não virava botão.** O
     `gainXp()` abre espaço novo, escolhe a habilidade e escreve no log
     "`Onda de Fogo` foi para o espaço 3" — mas o `montaBotoes()` só era chamado
     no `start()`, então o botão continuava `hidden` até a incursão seguinte. O
     `hud()` faz `if(b.hidden)continue`, então nada o revelava depois. Pior:
     `lancarSlot(i)` lê `ch().slots[i]`, que **estava** preenchido, então a
     tecla `L` do teclado conjurava uma habilidade sem botão na tela. Num jogo
     de celular, isso é a habilidade simplesmente não existir. Correção de uma
     linha: `montaBotoes()` no fim do laço de nível do `gainXp()`.
  2. **Save com classe apontando para personagem ausente deixava a tela em
     branco.** Com `classe:'druida'` e `chars:{}` no `localStorage`, o `ch()`
     devolve `undefined` e o `showMenu()` estoura em `c.lvl` **antes** do
     `requestAnimationFrame(frame)` no fim da IIFE: o laço nunca começa e o
     jogador fica olhando os placeholders do markup, sem jeito de sair a não ser
     limpando o armazenamento. Correção na carga do save: classe fora da tabela
     `CLASSES` volta a `null` (cai na escolha de personagem) e classe válida sem
     personagem ganha um `novoChar()`, já persistido. O cofre e as melhorias
     sobrevivem.
- Terceira correção, menor: o `aria-label` dos botões de habilidade dizia
  "0 de mana" para o Golpe do Cavaleiro, enquanto o rótulo visível dizia
  "grátis". Agora diz "sem mana" nos dois.
- **O `--dump-dom` que o `CLAUDE.md` mandava usar não existe mais.** O Edge
  desta máquina é o 155, aceita a opção e não escreve nada — nem para uma página
  trivial. A opção saiu do headless novo e só vive no `chrome-headless-shell`,
  que não vem instalado. Foi o que custou mais tempo nesta execução, porque
  falha em silêncio: saída 0, zero byte, nenhum erro. No lugar dela o script
  sobe um coletor HTTP em `127.0.0.1` e a cópia faz `POST` do resultado no fim
  do roteiro, com o DOM final no mesmo pacote (gravado em `dump.html` para
  inspeção, igual ao roteiro manual). Isso também dispensou a
  `--virtual-time-budget`.
- O atalho do `requestAnimationFrame` ficou melhor do que o documentado: em vez
  de `setTimeout(cb, 50)`, é `setTimeout(cb, 0)` com um **timestamp sintético**
  que anda 50 ms por quadro. O `dt` do jogo continua no passo cheio, mas o
  tempo de parede não precisa passar: uma incursão de 20 s roda em segundos, e
  a suíte inteira em 6.
- O `Math.random` é semeado por caso (mulberry32 de uma linha). Sem isso, mapa,
  corredores, spawns e loot mudam a cada execução e um teste de combate fica
  intermitente. Com isso, "passou hoje" significa "passa amanhã".
- Como o jogo inteiro vive numa IIFE, o harness não alcança função nenhuma por
  dentro: tudo é clique em botão, tecla despachada na janela e leitura do DOM e
  do `localStorage`. Isso é limitação e virtude — testa o que o jogador toca.
  Para exercitar o combate, o roteiro despacha `keydown` de `KeyJ`, que o
  `update()` lê como botão segurado.
- Os patches na cópia são substituições exatas que **estouram se não casarem**.
  Se o `index.html` mudar a linha patcheada, o harness falha alto em vez de
  testar coisa nenhuma — o modo de falha que mais importa evitar num portão.

**Colisão com o agente Desenvolvedor, e o que foi feito:** enquanto esta
execução terminava, a entrada das 23:30 entregou **outro** harness para o mesmo
item, o `tools/teste.js` (126 linhas, dois cenários, Chromium da nuvem,
`--dump-dom`). Ficar com os dois é pior que escolher qualquer um — dois portões
para o mesmo item significam que um dos dois não roda e ninguém percebe. **O
`tools/teste.js` foi removido e o `tools/testar.mjs` ficou**, por três motivos
verificáveis, não por preferência:
1. **O `--dump-dom` dele não funciona na máquina do Leonardo.** O Edge 155
   aceita a opção e devolve zero byte com saída 0, então o `tools/teste.js`
   reporta "navegador não rodou" e o portão vira silêncio. O `testar.mjs` usa o
   coletor HTTP e roda nas duas máquinas.
2. **Cobertura:** 2 cenários contra 8 casos e 194 asserções. A própria entrada
   das 23:30 lista como pendência que não há cenário de extração nem de morte —
   os dois existem aqui, e o de extração passa pelo combate.
3. **A pendência "o save semeado precisa trazer o personagem em `chars`; sem ele
   o menu quebra" era o bug nº 2 desta entrada.** Ele foi contornado lá e
   corrigido aqui, então a restrição deixou de existir.
O que o `tools/teste.js` fazia melhor foi absorvido: a descoberta do navegador
(`CHROME`, `/opt/pw-browsers`, PATH) e o `--no-sandbox` fora do Windows, para a
suíte rodar também na nuvem. Se o Leonardo discordar, `git revert` deste commit
traz os dois de volta.

**Roadmap:** enquanto esta execução trabalhava, o agente de Produto promoveu o
mesmo item de `Depois` para `Agora` com uma especificação própria
("Ferramenta de teste headless no repositório", entrada de 22:00). Ele está
atendido e foi para `Concluído`; `Agora` passou a ser a CI, que era o item 1 de
`Próximo`. **Duas diferenças em relação ao que a especificação pedia**, as duas
deliberadas e explicadas acima: o arquivo é `tools/testar.mjs` e não
`tools/teste.js` (ESM, para `import` sem `package.json`), e o resultado volta
por um coletor HTTP em vez de `--dump-dom`, porque a opção não escreve mais
nada. O item 2 de `Próximo` foi aparado: a metade do teste da migração `v1`→`v2`
já está feita (caso `migracao-save`), sobrou o aviso de falha do `persist()`.

**Pendências e riscos:**
- **A extração é testada com o portal mudado de lugar.** No headless não há quem
  arraste o joystick da sala de entrada até a sala do Guardião, então o caso
  `incursao-extracao` patcheia a cópia para o portal nascer na sala de entrada.
  O que fica **sem** cobertura é a travessia: campo de fluxo levando o jogador
  para longe, aggro em corredor, o Guardião. Testar isso de verdade pede um
  roteiro que leia o `G.flow` e dirija o joystick, e o `G` está fechado dentro
  da IIFE. A saída provável é um gancho de depuração no `index.html` ligado
  apenas quando um parâmetro de URL estiver presente — decisão do Leonardo,
  porque é código de teste no arquivo do jogo.
- **Não há CI.** O script existe mas nada o roda sozinho. O ciclo automático
  tem que chamá-lo, e o `CLAUDE.md` agora manda. O item "CI no GitHub Actions"
  está em [docs/agentes/produto.md](docs/agentes/produto.md) e vale promover.
  Atenção: na nuvem não existe Edge; a Action precisa instalar Chromium e
  apontar `FIBULA_EDGE`.
- **O `kill()` sombreia o `ch`**: `for(const[k,ch,a,b]of LOOT[m.k])` usa `ch`
  como a chance do item, apagando dentro do laço o acessor do personagem. Hoje
  não quebra nada, porque o corpo do laço não chama `ch()` — mas qualquer linha
  nova ali dentro que precise do personagem vai pegar um número. Renomear para
  `pc` é seguro; não fiz para manter o diff desta execução nos dois bugs reais.
- **O número de asserções que dependem de texto exato é alto de propósito.**
  Mudar um rótulo de botão ou um formato de linha da tela final quebra casos do
  harness. Isso é o preço de testar pelo DOM, e a mensagem de falha sempre
  imprime o que ela leu, então o conserto é óbvio. Não afrouxe as asserções para
  "passar"; conserte o teste ou o jogo.
- As cópias e os dumps de cada caso ficam em `%TEMP%/fibula-harness` até a
  execução seguinte, que apaga a pasta. Numa falha, o caminho vem impresso.
- **A suíte só foi executada no Edge 155 do Windows.** O caminho de nuvem
  (Chromium do Playwright, `--no-sandbox`) foi escrito mas não rodado. A
  primeira execução de nuvem que chamar `node tools/testar.mjs` é quem vai
  descobrir se o coletor HTTP em `127.0.0.1` passa pelo contêiner; se não
  passar, é aí que a CI vai travar.

**Próximo passo recomendado:** promover a CI no GitHub Actions rodando
`node tools/testar.mjs` em cada push para a `main`, com Chromium instalado e
`FIBULA_EDGE` apontado — é o que transforma o portão em rede de verdade, já que
hoje depende de o agente lembrar de chamar. Depois disso, o item `Agora` do
roadmap.



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
