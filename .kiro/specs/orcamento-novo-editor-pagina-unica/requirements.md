# Requisitos — Novo Orçamento via Editor de Página Única (+ Linha de Produto sempre visível)

## Introdução

Hoje o botão **"+ Novo Orçamento"** abre um wizard linear de 7 steps
(`/orcamento-grafico/novo`), enquanto a edição de item usa o **Editor de página
única** (`EditorItem`). O usuário pediu unificar: o "Novo Orçamento" deve usar o
**Editor de página única** (mesmo paradigma do "Editar"), exibir a informação do
produto do orçamento, e expor o seletor de **Linha de Produto** sempre visível e
editável — tanto ao criar quanto ao editar.

Decisões já tomadas com o usuário:
- **Caminho A**: "Novo Orçamento" abre um modal enxuto (Cliente + Vendedor +
  Linha de Produto) e, ao confirmar, cria o cabeçalho e abre direto o Editor de
  página única para montar o produto do primeiro item.
- **A1**: o cabeçalho (rascunho) é **gravado imediatamente** ao confirmar o modal
  (pode gerar rascunho vazio se o usuário desistir — aceitável).

Fora de escopo: alterar o motor de cálculo/ancoragem; alterar o fluxo de
"Puxar Cálculo"; remover o wizard `/novo` do código (fica como fallback/rota
acessível, mas deixa de ser o destino do botão).

## Requisitos

### Requisito 1 — Novo Orçamento abre o Editor de página única (Caminho A)

**User Story:** Como calculista, quero que "Novo Orçamento" me leve ao editor de
página única, para montar o orçamento na mesma experiência da edição.

#### Acceptance Criteria
1. QUANDO o usuário clica em "+ Novo Orçamento" ENTÃO o sistema DEVE abrir um
   modal enxuto com os campos Cliente (busca), Vendedor e Linha de Produto.
2. QUANDO o usuário confirma o modal com ao menos um cliente (id ou nome livre)
   ENTÃO o sistema DEVE criar um orçamento RASCUNHO (A1) e navegar para
   `/orcamento-grafico/:id`.
3. QUANDO a navegação para o detalhe ocorre após criação ENTÃO o sistema DEVE
   abrir automaticamente o Editor de página única para um item novo.
4. QUANDO o usuário cancela o modal ENTÃO o sistema NÃO DEVE criar orçamento.
5. O botão NÃO DEVE mais navegar para o wizard `/orcamento-grafico/novo`.

### Requisito 2 — Endpoint de criação de cabeçalho (rascunho sem item)

**User Story:** Como sistema, preciso criar um orçamento só com cabeçalho para o
editor ter um `orcamentoId` onde gravar itens.

#### Acceptance Criteria
1. QUANDO o cliente chama `POST /orcamento-grafico/cabecalho` com
   `{ clienteId?, clienteNome?, vendedorId?, linhaProdutoId? }` ENTÃO o sistema
   DEVE criar um `OrcamentoGrafico` status RASCUNHO, sem item, com numeração
   sequencial por empresa, e retornar `{ id, numero }`.
2. O sistema DEVE gravar `empresaId` EXPLÍCITO do usuário e validar permissão
   `podeCriarOrcamento` (mesma regra do `POST /`).
3. SE nenhum cliente (id nem nome) for informado ENTÃO o sistema DEVE retornar
   400 com mensagem clara.
4. O endpoint NÃO DEVE exigir tipoEmbalagem/medidas/quantidade (diferente do
   `POST /`).

### Requisito 3 — Linha de Produto sempre visível e editável no Editor

**User Story:** Como calculista, quero ver e trocar a Linha de Produto a
qualquer momento, no novo e no editar.

#### Acceptance Criteria
1. QUANDO o Editor de página única abre (novo OU editar) ENTÃO o sistema DEVE
   exibir, no topo, um seletor de Linha de Produto (linhas ativas) com o valor
   atual do orçamento.
2. QUANDO o usuário troca a Linha de Produto ENTÃO o sistema DEVE persistir
   `linhaProdutoId` no orçamento (via `PUT /:id`) e atualizar os campos
   condicionais exibidos (campos-por-linha), SEM apagar valores já preenchidos.
3. SE o orçamento não tem linha ENTÃO o seletor aparece vazio e o editor usa o
   conjunto PADRÃO de campos (não-regressão).

### Requisito 4 — Informação do produto visível no Editor

**User Story:** Como calculista, quero ver qual produto/embalagem está no
orçamento sem precisar abrir cada campo.

#### Acceptance Criteria
1. QUANDO o Editor abre com um tipo de embalagem selecionado ENTÃO o sistema DEVE
   exibir, de forma destacada no topo da seção Produto, a descrição do tipo de
   embalagem e a miniatura/ícone.
2. SE houver produto cadastrado vinculado (nome/foto) ENTÃO o sistema DEVE
   exibi-lo junto.
3. SE nenhum produto/tipo estiver selecionado ENTÃO o sistema DEVE exibir um
   estado vazio orientando a seleção.

### Requisito 5 — Não-regressão

#### Acceptance Criteria
1. A edição de item existente DEVE continuar idêntica (mesmo save/cálculo).
2. O "Puxar Cálculo" e a criação via `/de-calculo` DEVEM continuar funcionando.
3. A rota `/orcamento-grafico/novo` (wizard) DEVE continuar acessível por URL
   direta (fallback), sem ser o destino do botão.
4. Nenhuma string "Calcgraf" visível na tela de orçamento.
