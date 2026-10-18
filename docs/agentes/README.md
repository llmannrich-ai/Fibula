# Agentes agendados do Fibula

Quatro tarefas agendadas do Claude desenvolvem o jogo seguindo o
[PRD](../PRD.md), seção 13. As instruções vivem neste diretório, não dentro das
tarefas: para mudar o comportamento de um agente, edite o arquivo dele aqui.

| Arquivo | Para quê |
|---|---|
| [comum.md](comum.md) | Regras que todos seguem: início da execução, modo de publicação, issues, git, diário |
| [produto.md](produto.md) | Mantém o `ROADMAP.md` alinhado ao PRD e transforma feedback em itens |
| [desenvolvedor.md](desenvolvedor.md) | Entrega um item do ROADMAP por execução |
| [revisor.md](revisor.md) | Testa o que entrou na `main` (ou revisa e mescla PRs) |
| [balanceamento.md](balanceamento.md) | Mede economia e dificuldade e propõe ajustes |
| [modo.txt](modo.txt) | `direto` (sem CI, commit na `main`) ou `pr` (com CI, tudo por PR) |

## Como criar as tarefas (o dono faz uma vez)

No app do Claude: **Tarefas agendadas → + Nova tarefa**. Para cada linha da
tabela abaixo:

1. Nome: o da coluna "Nome".
2. **Repositório: `llmannrich-ai/Fibula`** — sem isso o agente não consegue
   enviar commits.
3. Horário: o da coluna "Quando" (horário de Brasília).
4. Modelo: o da coluna "Modelo".
5. Instrução: copie o bloco correspondente.

| Nome | Quando (Brasília) | Modelo |
|---|---|---|
| Fibula · Produto | Todo dia, 07:50 | Sonnet |
| Fibula · Desenvolvedor | Todo dia, 08:50, 12:50, 16:50 e 20:50 | Opus |
| Fibula · Revisor | Todo dia, 10:20, 14:20, 18:20 e 22:20 | Opus |
| Fibula · Balanceamento | Segunda-feira, 06:50 | Sonnet |

Se o app só aceitar um horário por tarefa, crie uma tarefa por horário com o
mesmo texto (ex.: "Fibula · Desenvolvedor 08:50").

**Produto**
```
Você é o agente de Produto do Fibula. No repositório llmannrich-ai/Fibula, branch main, leia docs/agentes/comum.md e docs/agentes/produto.md e execute exatamente o que eles mandam, do início ao fim, sem fazer perguntas no chat.
```

**Desenvolvedor**
```
Você é o agente Desenvolvedor do Fibula. No repositório llmannrich-ai/Fibula, branch main, leia docs/agentes/comum.md e docs/agentes/desenvolvedor.md e execute exatamente o que eles mandam, do início ao fim, sem fazer perguntas no chat.
```

**Revisor**
```
Você é o agente Revisor do Fibula. No repositório llmannrich-ai/Fibula, branch main, leia docs/agentes/comum.md e docs/agentes/revisor.md e execute exatamente o que eles mandam, do início ao fim, sem fazer perguntas no chat.
```

**Balanceamento**
```
Você é o agente de Balanceamento do Fibula. No repositório llmannrich-ai/Fibula, branch main, leia docs/agentes/comum.md e docs/agentes/balanceamento.md e execute exatamente o que eles mandam, do início ao fim, sem fazer perguntas no chat.
```

## Como acompanhar pelo celular

- **App do GitHub → Issues com rótulo `decisao-do-dono`:** perguntas dos
  agentes. Responda com um comentário (ex.: "opção 2"). Sem resposta em 72 h, o
  agente aplica a opção recomendada, exceto em temas sensíveis.
- **`precisa-do-dono`:** algo que só você faz (conta, chave, configuração) ou um
  PR sensível esperando sua aprovação.
- **Feedback de jogo:** abra uma issue com o rótulo `feedback`, texto livre. O
  agente de Produto transforma em item do ROADMAP.
- **`DIARIO.md`:** o que cada execução fez.

## Passar para o modo `pr`

Quando a CI existir: proteja a `main` no GitHub (Settings → Branches → exigir a
CI para mesclar) e troque o conteúdo de `modo.txt` para `pr`.
