# Agentes

Este repositório mantém suas instruções em [CLAUDE.md](CLAUDE.md). Leia esse
arquivo antes de qualquer alteração, seja a ferramenta qual for.

Ordem de leitura:

1. **[CLAUDE.md](CLAUDE.md)** — como trabalhar: arquitetura do `index.html`,
   convenções de código, como testar de verdade, regras de git.
2. **[VISAO.md](VISAO.md)** — por que o jogo é assim: os cinco pilares, os
   não-objetivos e o teste que toda ideia precisa passar.
3. **[ROADMAP.md](ROADMAP.md)** — o que fazer agora. Um item por vez.
4. **[DIARIO.md](DIARIO.md)** — o que já foi feito e o que ficou torto.

O jogo tem base de dados no **Supabase** (contas e save na nuvem). Projeto,
chaves e regras de uso estão na seção "Supabase" do `CLAUDE.md`; os agentes
locais têm acesso às chaves sem precisar pedir.

Dois portões, sem exceção: a checagem de sintaxe do bloco `<script>` antes de
qualquer commit de código, e o teste da incursão ativa — não só do menu. Os dois
estão descritos no `CLAUDE.md`.
