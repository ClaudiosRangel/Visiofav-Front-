# Requirements — Desagrupar Planos na Fila da Programação (PCP)

## Introdução

No painel de Programação do PCP, quando uma Ordem de Produção tem 2+ planos
(ex.: CAIXA e TAMPA), o frontend agrupa as etapas desses planos num **bloco
pai/filho**: a linha-PAI representa a OP e as etapas por plano ficam aninhadas
como filhas. Hoje **só a linha-PAI é arrastável** — ao mover, o bloco inteiro
(caixa + tampa) vai junto, preservando a ordem relativa. Esse agrupamento foi
pedido pela Carton Wega para manter caixa+tampa coladas.

O Caio (Carton Wega) relatou um caso oposto na **Mazola (Acoplagem)**: ele quer
rodar **todas as caixas primeiro e depois todas as tampas** (aproveitar o
acerto), o que o agrupamento impede, porque caixa e tampa de uma mesma OP não
podem ser separadas na fila.

Esta feature adiciona a capacidade de **desagrupar** uma OP de planos
diretamente na fila, via **menu de contexto (botão direito do mouse)**. Uma vez
desagrupada, as etapas daquele plano viram **linhas independentes e
arrastáveis**, e o operador as reorganiza livremente na fila (mesmo arraste que
já existe hoje) — por exemplo, movendo todas as caixas para o topo e as tampas
para baixo. O desagrupamento é uma preferência de **visualização/interação do
painel** (client-side), não altera dados de OP/plano nem o backend.

## Glossário

- **Bloco_De_Planos**: agrupamento visual pai/filho de uma OP com 2+ planos no
  painel (linha-PAI sintética `pai:<opId>` + etapas-filhas por plano).
- **Desagrupar**: ação que remove o agrupamento pai/filho de uma OP específica
  na fila de um centro, passando a renderizar suas etapas como linhas
  independentes e arrastáveis.
- **Estado_Desagrupado**: conjunto (client-side) de OPs atualmente desagrupadas,
  por centro (chave `centroId:opId`), análogo ao estado existente
  `planosRecolhidos`.
- **Reagrupar**: ação inversa (opcional) que volta a OP ao modo pai/filho.

## Requirements

### Requisito 1 — Desagrupar via menu de contexto (botão direito)

**User Story:** Como programador do PCP, quero clicar com o botão direito numa OP
de planos (caixa/tampa) e escolher "Desagrupar", para poder sequenciar cada
plano separadamente na fila.

#### Acceptance Criteria

1. QUANDO o usuário aciona o menu de contexto (botão direito) sobre uma linha de
   uma OP agrupada (Bloco_De_Planos) THEN o sistema SHALL exibir a ação
   "Desagrupar planos".
2. QUANDO o usuário escolhe "Desagrupar planos" THEN o sistema SHALL registrar
   a OP como desagrupada (`Estado_Desagrupado`, por centro) e re-renderizar suas
   etapas como linhas independentes (sem a linha-PAI sintética).
3. A ação SHALL afetar somente a OP escolhida, naquele centro; as demais OPs de
   planos permanecem agrupadas.
4. O desagrupamento SHALL ser client-side (não chama backend, não altera
   OP/plano/`posicaoFila` por si só).

### Requisito 2 — Etapas desagrupadas são arrastáveis individualmente

**User Story:** Como programador, depois de desagrupar, quero arrastar cada
etapa (caixa, tampa) para a posição que eu quiser na fila, como já faço com
qualquer etapa.

#### Acceptance Criteria

1. QUANDO uma OP está no Estado_Desagrupado THEN cada etapa dela SHALL ser
   arrastável de forma independente (grip próprio), igual a uma etapa sem plano.
2. QUANDO o usuário arrasta uma etapa desagrupada e solta numa nova posição THEN
   o sistema SHALL persistir a nova ordem pela MESMA rota de reordenação já
   usada (`PATCH /pcp/etapas/reordenar`), gravando `posicaoFila` sequencial.
3. A reordenação SHALL permitir intercalar etapas de OPs diferentes (ex.: todas
   as caixas antes de todas as tampas), sem recriar o agrupamento
   automaticamente.
4. O arraste de etapas desagrupadas NÃO SHALL mover outras etapas junto (ao
   contrário do arraste da linha-PAI, que move o bloco inteiro).

### Requisito 3 — Reagrupar (inverso) e indicação visual

**User Story:** Como programador, quero poder voltar ao modo agrupado se mudar de
ideia, e identificar visualmente quais OPs estão desagrupadas.

#### Acceptance Criteria

1. QUANDO uma OP está desagrupada THEN o menu de contexto sobre qualquer etapa
   dela SHALL oferecer "Reagrupar planos", que remove a OP do Estado_Desagrupado
   e volta ao modo pai/filho.
2. O sistema SHALL indicar visualmente (ex.: rótulo do plano na própria linha,
   como CAIXA/TAMPA) que as etapas desagrupadas pertencem a planos, para o
   usuário não confundir com etapas sem plano.
3. O Estado_Desagrupado SHALL conviver com o estado existente de recolher/
   expandir (`planosRecolhidos`) sem conflito.

### Requisito 4 — Preservação do comportamento atual (não-regressão)

**User Story:** Como usuário que já usa o agrupamento, quero que o comportamento
padrão continue idêntico quando eu não desagrupar nada.

#### Acceptance Criteria

1. POR PADRÃO (nenhuma OP desagrupada) o painel SHALL manter exatamente o
   comportamento atual: Bloco_De_Planos pai/filho, só o pai arrastável, filhos
   movem juntos.
2. A reordenação de etapas sem plano e o arraste da linha-PAI das OPs ainda
   agrupadas NÃO SHALL mudar de comportamento.
3. A feature SHALL ser **somente frontend** (`VisioFab.Wms.Front`), sem alterar
   backend, schema ou contrato de API; usa a rota de reordenação já existente.

### Requisito 5 — Escopo e persistência do estado

#### Acceptance Criteria

1. O Estado_Desagrupado SHALL ser mantido no estado do componente do painel
   (client-side), por centro + OP (chave `centroId:opId`), análogo a
   `planosRecolhidos`.
2. NÃO é requisito persistir o Estado_Desagrupado entre recarregamentos de
   página nesta versão (pode resetar ao recarregar); a ordem efetiva da fila, no
   entanto, é persistida normalmente pela reordenação (Req 2.2).
