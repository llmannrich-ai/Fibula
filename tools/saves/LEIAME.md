# Saves de referência

Um save por formato que já existiu no aparelho de algum jogador. O
`tools/testar.mjs` carrega cada um na simulação no Node, em toda execução, e
confere que nada se perde: cofre, nível e XP de cada personagem, peças
guardadas e vestidas, mochila; que `normaliza()` aplicada duas vezes dá o
mesmo save; e que o personagem entra numa caçada e sai dela sem erro.

**Toda mudança no formato do save ganha um arquivo novo aqui**, com o save
como ele ficava na versão anterior à mudança. Nenhum arquivo daqui se apaga
nem se edita para o teste passar: se um deles quebra, quem quebrou foi o
código.

Formato: `{"versao": "<versão do jogo>", "o_que": "<o que este formato tem
de diferente>", "save": {<o save cru, como em masmorra-runas-v2>}}`. Sem
dado pessoal: nada de `dono`, sessão ou nome de usuário real.
