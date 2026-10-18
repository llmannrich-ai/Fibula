# Fibula — Masmorra de Runas

Protótipo jogável de um RPG de extração para celular.

**Jogar:** https://llmannrich-ai.github.io/Fibula/

## Na incursão

- Arraste o lado esquerdo da tela para andar.
- Segure um botão de habilidade para repeti-la assim que ela sair da recarga. **Poção** cura.
- O portal de saída abre aos 1:30. Fique 2,5 s nele para extrair. Se morrer, perde o loot do saco.
- Com o portal aberto, uma bússola aparece ao lado do minimapa apontando a direção dele.
- Teclado: WASD anda, **J K L I** são os quatro espaços de habilidade, **P** bebe poção.

## Classes e habilidades (Etapa 3)

Quatro classes adaptadas das vocações do Tibia. Nenhuma delas tem poder exclusivo
de graça: **o que muda é a velocidade com que cada coisa cresce.**

| Classe | Jeito de jogar | Cresce rápido em | Cresce devagar em |
|---|---|---|---|
| Feiticeiro | fogo e energia, dano bruto e área | mana, Magia | vida, Perícia, armadura |
| Druida | gelo e terra, cura e controle | mana, Magia | vida, Perícia |
| Caçador | distância e mobilidade | Perícia, alcance | mana |
| Cavaleiro | corpo a corpo, bate de graça | vida, Perícia, armadura | mana, Magia |

Cada personagem tem **três barras independentes**, como no Tibia:

- **Nível** — sobe matando. Aumenta vida e mana máximas e libera habilidades novas.
- **Magia** — sobe **gastando mana**. Escala as magias de feiticeiro e druida (e os
  golpes sagrados do caçador).
- **Perícia** — sobe **acertando golpes**. Escala os ataques de cavaleiro e caçador.

O custo das duas últimas é exponencial e o expoente depende da classe, então um
cavaleiro praticamente nunca chega a uma Magia alta — exatamente como no original.

### Espaços de habilidade

Cada classe aprende **seis habilidades**, mas você não leva todas:

| Espaços | Abre no nível |
|---|---|
| 1 e 2 | 1 |
| 3 | 8 |
| 4 | 18 |

Monte a mão no **Grimório**, no menu. Subir de nível não é só um número maior: é
uma decisão sobre o que trocar. Cada grupo (ataque, cura, apoio) tem uma recarga
compartilhada, então encadear três ataques exige ordem, não botão rápido.

Os personagens de cada classe são guardados em separado — o cofre e as melhorias do
Mercador são da conta e valem para todos.

> A íntegra do levantamento que gerou esse desenho está em
> [docs/analise-tibia-habilidades.md](docs/analise-tibia-habilidades.md).

## Entre incursões — o Mercador (Etapa 2)

O ouro que você extrai vai para o **cofre**, e o cofre só serve para gastar com o
**Mercador**, no menu. As melhorias são permanentes e valem para todas as
incursões seguintes:

| Melhoria | Efeito | Níveis |
|---|---|---|
| Vigor | +15 de vida máxima | 8 |
| Foco | +10 de mana máxima | 8 |
| Poder arcano | +8% de dano em todas as habilidades | 8 |
| Bolsa de poções | +1 poção em cada incursão | 4 |
| Selo de resguardo | guarda 20% do loot do saco se você morrer | 3 |

O preço de cada nível sobe geometricamente, então o cofre nunca deixa de ter uso.

O progresso fica salvo no navegador de cada aparelho.
