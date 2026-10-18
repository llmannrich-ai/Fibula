# Diário de execuções - Fibula

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
