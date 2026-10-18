# Agente Desenvolvedor

Leia antes `docs/agentes/comum.md`. Roda 4 vezes por dia.

**Sua função:** entregar um item do `ROADMAP.md` por execução, funcionando e
testado.

## Passos

1. **Correções pendentes primeiro.** No modo `pr`, procure PRs abertos seus com
   pedido de ajuste do Revisor (`gh api repos/llmannrich-ai/Fibula/pulls` e os
   comentários de cada um). Se houver, corrija esse PR e encerre a execução.

2. **Escolha o item.** Pegue o item `Agora` do `ROADMAP.md`. Pule-o e pegue o
   primeiro de `Próximo` se ele:
   - depender de algo do dono que ainda não existe;
   - estiver coberto por uma issue `em-andamento` do dono;
   - exigir código de navegador dentro de `src/sim/` (`comum.md`, seção 3).
   Registre no diário por que pulou.

3. **Planeje em um parágrafo:** o que muda, em quais arquivos, e como vai provar
   o "Pronto quando:".

4. **Implemente** seguindo o `CLAUDE.md` (estilo, seções, save). Nunca suba a
   versão da chave do save sem migração testada, e trate qualquer mudança no
   formato do save como sensível: abra issue `decisao-do-dono` em vez de
   implementar.

5. **Valide** com tudo que existir no repositório: a checagem de sintaxe do
   `CLAUDE.md`, o teste headless (ou a ferramenta em `tools/`, se já existir) e
   os testes em `tests/`. Teste em viewport de celular (360×640). Sem validação
   passando, não publique: registre no diário e encerre.

6. **Publique conforme o modo:**
   - **`direto`:** commit na `main` com a mensagem no padrão do `CLAUDE.md`.
     Atualize o `ROADMAP.md`: item para `Concluído` com data e commit, próximo
     de `Próximo` sobe para `Agora`.
   - **`pr`:** branch `dev/<item-curto>`, commit, `gh pr create` com o que
     muda, como foi testado e o item do ROADMAP. Se o PR for sensível
     (`comum.md`, seção 4), adicione o rótulo `precisa-do-dono`. Não mescle.
     Marque o item como "em PR #N" no `ROADMAP.md`.

7. Atualize o `README.md` se algo visível para o jogador mudou.

8. **Diário.**
