# Requisitos — Ajustes 2 do Editor de Orçamento (UX)

## Introdução

Segunda rodada de ajustes de UX no Editor de Item do Orçamento Gráfico, a partir
do uso real e dos prints enviados pelo usuário. Foco: corrigir o corte da barra
de KPIs ao rolar, eliminar o preview de encaixe duplicado, hidratar os Dados
Técnicos a partir da Ficha Master do produto, reorganizar as seções do índice e
aplicar o layout de "Dados Técnicos" (Processos de Impressão + Avisos + Config.
da Faca). Não altera o motor de cálculo.

## Requisitos

### Requisito 1 — Barra de KPIs não corta ao rolar

**User Story:** Como usuário, quero que os KPIs no topo permaneçam inteiros e
legíveis ao rolar o editor, como acontecia na tela em steps.

#### Acceptance Criteria
1. QUANDO o usuário rola o conteúdo do editor ENTÃO a barra de KPIs DEVE
   permanecer fixa, inteira (rótulo + valor visíveis) e sem cortar no topo,
   respeitando o header do modal full-screen.
2. O conteúdo que rola NÃO DEVE aparecer por trás/pelas laterais da barra.

### Requisito 2 — Sem encaixe duplicado

**User Story:** Como usuário, não quero ver o encaixe da folha duas vezes (uma
solta no corpo e outra no painel de preview).

#### Acceptance Criteria
1. O encaixe (SVG) DEVE aparecer SOMENTE no painel lateral de Preview.
2. A exibição solta do encaixe no corpo das seções DEVE ser removida.
3. Os demais dados da seção onde o encaixe estava DEVEM permanecer.

### Requisito 3 — Dados Técnicos hidratados da Ficha Master (faca + arte + campos)

**User Story:** Como calculista, ao editar um item com produto vinculado, quero
que os dados da Ficha Master (faca, arte e campos gráficos) venham preenchidos,
sem perder a capacidade de ajustar manualmente.

#### Acceptance Criteria
1. QUANDO o orçamento tem produto/pedido vinculado ENTÃO o editor DEVE buscar a
   Ficha Master e pré-preencher campos gráficos disponíveis (cartão, gramatura,
   nº de cores, cores, acabamentos, matriz) QUANDO o item não os tiver.
2. A prioridade de fonte DEVE ser: Ficha Master DEFINITIVA (produto) → RASCUNHO
   (pedido) → o que já estiver no item/orçamento.
3. O preenchimento automático NÃO DEVE sobrescrever valores já informados no item
   (edição manual preservada).
4. SE não houver Ficha Master ENTÃO os campos permanecem manuais (não-regressão),
   com o aviso amigável existente.

### Requisito 4 — Preview busca imagens da Ficha Master (faca + arte)

**User Story:** Como usuário, quero que o preview mostre a faca e a arte do
produto, vindas da Ficha Master (rascunho ou definitivo).

#### Acceptance Criteria
1. O painel Preview DEVE exibir a imagem da faca E a arte (quando houver),
   buscando da Ficha Master: definitiva (produto) → rascunho (pedido) → imagem
   do orçamento como fallback.
2. SE nenhuma imagem existir ENTÃO o painel mostra o estado vazio atual.

### Requisito 5 — Seções do índice reorganizadas (Itens Complementares + Materiais)

**User Story:** Como usuário, quero "Itens Complementares" e "Materiais de
Acabamento" como seções próprias no índice, para achar rápido.

#### Acceptance Criteria
1. O índice DEVE listar seções dedicadas para "Itens Complementares" (itens
   diversos / fornecidos / campos livres) e "Materiais de Acabamento".
2. O comportamento de cálculo desses blocos DEVE permanecer idêntico.

### Requisito 6 — Layout dos Dados Técnicos (Processos + Avisos + Config. da Faca)

**User Story:** Como usuário, gostei do layout com Processos de Impressão,
Avisos de Preenchimento e Configuração da Faca lado a lado — quero aplicá-lo
respeitando os dados e o cálculo do projeto.

#### Acceptance Criteria
1. A seção Dados Técnicos DEVE apresentar: painel "Processos de Impressão"
   (processo + nº de cores + cores especiais + arte/pré-impressão), painel
   "Avisos de Preenchimento" (inline, amigável) e painel "Configuração da Faca"
   (imagem da faca + formato de entrada/corte + peças por folha + sangria +
   pinça), reusando os campos que JÁ alimentam o cálculo.
2. Nenhum campo novo de cálculo é introduzido; é reorganização visual dos campos
   existentes.
3. Não-regressão: os valores calculados permanecem idênticos.

### Requisito 7 — Não-regressão

#### Acceptance Criteria
1. Motor de cálculo inalterado; salvar/Puxar Cálculo/ancoragem preservados.
2. Nenhuma string "Calcgraf" visível na tela de orçamento.
