# Requirements Document: ERP Vendas — Pedido Completo Frontend

## Introduction

Evolução da interface frontend do módulo de Pedido de Venda do VisioFab ERP para suportar todos os novos campos, filtros, faturamento parcial e restrições por status implementados no backend. O frontend é construído em Next.js 15 (App Router) com Mantine 7, React Query, react-hook-form + Zod. As páginas existentes (listagem, criação/edição monolítica, detalhe) serão refatoradas para uma arquitetura modular com layout em Accordion, modal de faturamento parcial, campos desabilitados + banner de status, e badges de prioridade.

## Glossary

- **Pagina_Listagem**: Página de listagem de pedidos de venda em `/vendas/pedidos` com tabela paginada, filtros e ações
- **Pagina_Formulario**: Página de criação e edição de pedido de venda em `/vendas/pedidos/novo` e `/vendas/pedidos/novo?editId={id}`, utilizando layout Accordion com seções modulares
- **Pagina_Detalhe**: Página de visualização do pedido em `/vendas/pedidos/{id}` com todas as informações e ações contextuais
- **Accordion_Layout**: Layout de formulário utilizando Mantine Accordion para organizar campos em seções colapsáveis
- **Modal_Faturamento**: Modal para seleção de itens e quantidades para faturamento parcial do pedido
- **Banner_Status**: Componente de alerta exibido no topo do formulário indicando restrições de edição baseadas no status do pedido
- **Badge_Prioridade**: Componente Badge do Mantine com cores por prioridade (URGENTE=vermelho, NORMAL=azul, BAIXA=cinza)
- **Componente_Modular**: Componente React isolado e reutilizável, cada um responsável por uma seção do formulário
- **Hook_Pedido**: Custom hooks utilizando @tanstack/react-query para fetch, mutação e cache de dados do pedido de venda
- **API_Pedidos**: Backend API em `/pedidos-venda` com endpoints para CRUD, confirmação, cancelamento e faturamento parcial
- **Filtro_Listagem**: Conjunto de inputs no topo da listagem para filtrar pedidos por status, prioridade, origem, número PO do cliente e ordenação

## Requirements

### Requirement 1: Listagem de Pedidos — Novos Filtros

**User Story:** Como operador de vendas, eu quero filtrar pedidos por prioridade, origem, número do pedido do cliente e ordenar por prioridade, para que eu encontre rapidamente os pedidos relevantes.

#### Acceptance Criteria

1. WHEN the user navigates to `/vendas/pedidos`, THE Pagina_Listagem SHALL display filter inputs for: status (Select, existing), prioridade (Select with options BAIXA/NORMAL/URGENTE), origemPedido (Select with options MANUAL/ECOMMERCE/EDI/ORCAMENTO), and numeroPedidoCliente (TextInput with search icon)
2. WHEN the user selects a prioridade filter value, THE Pagina_Listagem SHALL send the `prioridade` query parameter to `GET /pedidos-venda` and refresh the table showing only matching results
3. WHEN the user selects an origemPedido filter value, THE Pagina_Listagem SHALL send the `origemPedido` query parameter to `GET /pedidos-venda` and refresh the table showing only matching results
4. WHEN the user types in the numeroPedidoCliente filter (minimum 1 non-whitespace character), THE Pagina_Listagem SHALL send the `numeroPedidoCliente` query parameter to `GET /pedidos-venda` after a 400ms debounce and refresh the table
5. WHEN the user activates the "Ordenar por Prioridade" toggle, THE Pagina_Listagem SHALL send the `ordenarPorPrioridade=true` query parameter to `GET /pedidos-venda` and display results in priority order (URGENTE first, then NORMAL, then BAIXA)
6. WHEN any filter is changed, THE Pagina_Listagem SHALL reset pagination to page 1
7. WHEN the user clears a filter, THE Pagina_Listagem SHALL remove the corresponding query parameter and refresh the table

---

### Requirement 2: Listagem de Pedidos — Colunas e Badges de Prioridade

**User Story:** Como gerente de vendas, eu quero visualizar a prioridade e origem de cada pedido na listagem com indicadores visuais, para que eu identifique rapidamente pedidos urgentes.

#### Acceptance Criteria

1. THE Pagina_Listagem SHALL display table columns: Número, Cliente, Vendedor, Valor Total, Prioridade, Origem, Status, Ações
2. WHEN a pedido has prioridade URGENTE, THE Pagina_Listagem SHALL display a Badge_Prioridade with color red and text "URGENTE"
3. WHEN a pedido has prioridade NORMAL, THE Pagina_Listagem SHALL display a Badge_Prioridade with color blue and text "NORMAL"
4. WHEN a pedido has prioridade BAIXA, THE Pagina_Listagem SHALL display a Badge_Prioridade with color gray and text "BAIXA"
5. THE Pagina_Listagem SHALL display the origemPedido value as a text badge for each pedido row
6. WHILE the table data is loading, THE Pagina_Listagem SHALL display a LoadingOverlay on the table card

---

### Requirement 3: Formulário — Accordion Layout com Seções Modulares

**User Story:** Como operador de vendas, eu quero um formulário organizado em seções colapsáveis (Accordion), para que eu preencha os dados do pedido de forma organizada sem sobrecarga visual.

#### Acceptance Criteria

1. WHEN the user navigates to `/vendas/pedidos/novo` or `/vendas/pedidos/novo?editId={id}`, THE Pagina_Formulario SHALL display a Mantine Accordion with the following sections: "Dados Gerais", "Entrega e Transporte", "Financeiro (Desconto/Acréscimo)", "Itens do Pedido", "Observações"
2. THE Accordion_Layout SHALL open the section "Dados Gerais" by default on page load
3. THE Accordion_Layout SHALL allow multiple sections to be open simultaneously
4. WHEN a section contains validation errors after form submission, THE Accordion_Layout SHALL automatically open that section and scroll to the first error field
5. WHEN the user is creating a new pedido, THE Pagina_Formulario SHALL display all sections as editable
6. THE Pagina_Formulario SHALL render each Accordion section as an independent modular React component receiving form control via react-hook-form context

---

### Requirement 4: Seção "Dados Gerais"

**User Story:** Como operador de vendas, eu quero preencher os dados principais do pedido incluindo cliente, vendedor, tabela de preço, condição de pagamento, prioridade, origem e número PO do cliente, para registrar as informações comerciais essenciais.

#### Acceptance Criteria

1. THE Componente_Modular for "Dados Gerais" SHALL display fields: clienteId (Select searchable, required), vendedorId (Select searchable, optional), tabelaPrecoId (Select, required), condicaoPagId (Select, conditional on tabelaPrecoId), prioridade (Select with BAIXA/NORMAL/URGENTE, default NORMAL), origemPedido (Select with MANUAL/ECOMMERCE/EDI/ORCAMENTO, default MANUAL), numeroPedidoCliente (TextInput, max 60 chars, optional), dataValidade (DateInput, optional, must be today or future)
2. WHEN the user selects a tabelaPrecoId, THE Componente_Modular SHALL load and display condição de pagamento options linked to that price table
3. WHEN the user selects origemPedido as ORCAMENTO, THE Componente_Modular SHALL display an additional field orcamentoOrigemId (TextInput or Select, optional)
4. IF the user sets dataValidade to a date in the past, THEN THE Componente_Modular SHALL display a validation error message "Data de validade deve ser igual ou posterior a hoje"
5. WHEN the user types more than 60 characters in numeroPedidoCliente, THE Componente_Modular SHALL prevent additional input (maxLength enforcement)

---

### Requirement 5: Seção "Entrega e Transporte"

**User Story:** Como operador de vendas, eu quero informar data de entrega, transportadora, modalidade de frete e endereço alternativo de entrega, para que as informações logísticas do pedido estejam completas.

#### Acceptance Criteria

1. THE Componente_Modular for "Entrega e Transporte" SHALL display fields: dataEntrega (DateInput, optional, must be today or future), transportadoraId (Select searchable, optional), modalidadeFrete (Select with options 0-CIF/1-FOB/2-Terceiros/3-Próprio remetente/4-Próprio destinatário/9-Sem frete, optional)
2. THE Componente_Modular SHALL display a "Endereço de Entrega Alternativo" sub-section with fields: logradouro (TextInput, max 200), numero (TextInput, max 20), complemento (TextInput, max 100, optional), bairro (TextInput, max 100), cidade (TextInput, max 100), uf (Select with 27 UFs brasileiras), cep (TextInput, mask 8 digits)
3. WHEN the user starts filling any address field, THE Componente_Modular SHALL require all mandatory address fields (logradouro, numero, bairro, cidade, uf, cep) before submission
4. IF the user informs dataEntrega with a date in the past, THEN THE Componente_Modular SHALL display a validation error "Data de entrega deve ser igual ou posterior a hoje"
5. IF the user informs cep with a value not matching exactly 8 numeric digits, THEN THE Componente_Modular SHALL display a validation error "CEP deve conter exatamente 8 dígitos numéricos"
6. IF the user informs uf with a value not in the list of 27 valid Brazilian states, THEN THE Componente_Modular SHALL display a validation error "UF inválida"

---

### Requirement 6: Seção "Financeiro (Desconto/Acréscimo)"

**User Story:** Como operador de vendas, eu quero aplicar desconto geral e acréscimo geral ao pedido, para que eu configure valores fiscais e logísticos de forma rápida no nível do pedido.

#### Acceptance Criteria

1. THE Componente_Modular for "Financeiro" SHALL display fields: tipoDesconto (Select with PERCENTUAL/VALOR_FIXO, optional), descontoGeral (NumberInput, decimal 2 places, conditional on tipoDesconto), tipoAcrescimo (Select with FRETE/SEGURO/OUTRAS_DESPESAS, optional), acrescimoGeral (NumberInput, decimal 2 places, conditional on tipoAcrescimo)
2. WHEN the user selects tipoDesconto, THE Componente_Modular SHALL enable and require the descontoGeral field
3. WHEN the user fills descontoGeral without selecting tipoDesconto, THE Componente_Modular SHALL display a validation error "Tipo de desconto é obrigatório quando desconto geral é informado"
4. WHEN tipoDesconto is PERCENTUAL, THE Componente_Modular SHALL validate that descontoGeral is between 0.01 and 100.00
5. WHEN the user selects tipoAcrescimo, THE Componente_Modular SHALL enable and require the acrescimoGeral field
6. WHEN the user fills acrescimoGeral without selecting tipoAcrescimo, THE Componente_Modular SHALL display a validation error "Tipo de acréscimo é obrigatório quando acréscimo geral é informado"

---

### Requirement 7: Seção "Itens do Pedido" — Campos Complementares

**User Story:** Como operador de vendas, eu quero registrar desconto por valor, frete, seguro, despesas, observação, data de entrega e comissão por item, para que cada item contenha informações granulares para fins fiscais e logísticos.

#### Acceptance Criteria

1. THE Componente_Modular for "Itens do Pedido" SHALL display a table with columns: Produto (Select), Unidade (Select), Quantidade (NumberInput), Preço Unit. (NumberInput), Desc % (NumberInput), Desc Valor (NumberInput), Frete (NumberInput), Seguro (NumberInput), Outras Desp. (NumberInput), Total (calculated, read-only)
2. WHEN the user clicks on an item row's expand/detail icon, THE Componente_Modular SHALL display additional fields: observacaoItem (Textarea, max 1000 chars), dataEntregaItem (DateInput, optional), comissaoPercItem (NumberInput, 0-100, 2 decimal places)
3. WHEN any price-related field is changed (precoUnitario, desconto, descontoValor, quantidade, frete, seguro, outrasDespesas), THE Componente_Modular SHALL recalculate the item total in real-time using the formula: total = ((precoUnit × (1 - desconto/100)) - descontoValor) × quantidade + frete + seguro + outrasDespesas
4. IF the calculated precoFinal (after discounts) results in a value less than zero, THEN THE Componente_Modular SHALL display a validation error on the item "Desconto total excede o preço do produto"
5. WHEN the user clicks "Adicionar Item", THE Componente_Modular SHALL append a new empty item row to the table
6. WHEN the user clicks the remove button on an item and there are more than 1 item, THE Componente_Modular SHALL remove the item from the table

---

### Requirement 8: Seção "Observações"

**User Story:** Como operador de vendas, eu quero adicionar observações internas e observações para a nota fiscal, para que informações relevantes acompanhem o pedido e a NF-e.

#### Acceptance Criteria

1. THE Componente_Modular for "Observações" SHALL display fields: observacao (Textarea, max 1000 chars, label "Observação Interna"), observacaoNota (Textarea, max 2000 chars, label "Observação para Nota Fiscal")
2. THE Componente_Modular SHALL display a character counter below each textarea showing current/max characters
3. WHEN the user types beyond the maximum character limit, THE Componente_Modular SHALL prevent additional input (maxLength enforcement)

---

### Requirement 9: Restrições de Edição por Status

**User Story:** Como operador de vendas, eu quero que o formulário impeça edição de campos baseado no status do pedido, mostrando um banner informativo, para que eu entenda quais campos posso alterar sem precisar submeter e receber erro.

#### Acceptance Criteria

1. WHILE a pedido has status RASCUNHO, THE Pagina_Formulario SHALL enable all fields in all sections for editing
2. WHILE a pedido has status CONFIRMADO without partial billings, THE Pagina_Formulario SHALL enable only the fields: observacao, observacaoNota, prioridade, dataEntrega, transportadoraId, modalidadeFrete, enderecoEntrega; all other fields SHALL be rendered as disabled (gray, non-interactive)
3. WHILE a pedido has status CONFIRMADO with partial billings, THE Pagina_Formulario SHALL enable the same header fields as criterion 2, and for items SHALL disable editing and removal of items where quantidadeFaturada is greater than 0
4. WHILE a pedido has status CONFIRMADO, THE Pagina_Formulario SHALL display a Banner_Status at the top with color blue and message "Pedido confirmado — apenas alguns campos podem ser editados"
5. WHILE a pedido has status CONFIRMADO with partial billings, THE Banner_Status SHALL additionally display message "Itens parcialmente faturados não podem ser alterados"
6. IF a pedido has status EFETIVADO or CANCELADO, THEN THE Pagina_Formulario SHALL redirect to the detail page (Pagina_Detalhe) instead of displaying the edit form
7. WHEN a disabled field is rendered, THE Pagina_Formulario SHALL apply Mantine's `disabled` prop resulting in grayed-out appearance and non-interactive behavior

---

### Requirement 10: Página de Detalhe — Novos Campos

**User Story:** Como operador de vendas, eu quero visualizar todos os novos campos do pedido na página de detalhe, para que eu tenha visibilidade completa das informações sem precisar editar.

#### Acceptance Criteria

1. WHEN the user navigates to `/vendas/pedidos/{id}`, THE Pagina_Detalhe SHALL display all header fields organized in cards: Dados do Pedido (cliente, vendedor, tabela, valor total, prioridade, origem, numeroPedidoCliente, dataValidade), Entrega e Transporte (dataEntrega, transportadora, modalidadeFrete, enderecoEntrega), Financeiro (tipoDesconto, descontoGeral, tipoAcrescimo, acrescimoGeral)
2. THE Pagina_Detalhe SHALL display the prioridade field using Badge_Prioridade with the corresponding color (URGENTE=red, NORMAL=blue, BAIXA=gray)
3. WHEN a pedido has enderecoEntrega populated, THE Pagina_Detalhe SHALL display the full address formatted as: "logradouro, numero - complemento - bairro, cidade/uf - CEP: cep"
4. THE Pagina_Detalhe SHALL display the items table with additional columns: Desc. Valor, Frete, Seguro, Outras Desp., Qtd. Faturada (showing progress as faturada/total)
5. WHEN a pedido has observacao or observacaoNota populated, THE Pagina_Detalhe SHALL display them in a dedicated "Observações" card
6. WHEN a pedido has dataLimiteAtendimento populated (URGENTE priority), THE Pagina_Detalhe SHALL display it as a highlighted date with label "Limite de Atendimento (SLA)"

---

### Requirement 11: Faturamento Parcial — Modal

**User Story:** Como operador de vendas, eu quero selecionar itens e quantidades para faturar parcialmente um pedido confirmado, para que eu efetive entregas parciais mantendo o saldo no pedido.

#### Acceptance Criteria

1. WHEN the user clicks "Faturar Parcial" on a pedido with status CONFIRMADO on the Pagina_Detalhe, THE Modal_Faturamento SHALL open displaying all items of the pedido with columns: Produto, Qtd. Original, Qtd. Já Faturada, Saldo Disponível, Qtd. a Faturar (NumberInput)
2. THE Modal_Faturamento SHALL pre-fill "Qtd. a Faturar" as 0 for all items, allowing the user to specify quantities for each item
3. WHEN the user enters a quantity greater than the available balance (quantidade - quantidadeFaturada) for any item, THE Modal_Faturamento SHALL display a validation error on that item "Quantidade excede o saldo disponível ({saldo})"
4. WHEN the user clicks "Confirmar Faturamento", THE Modal_Faturamento SHALL validate that at least 1 item has quantity greater than 0, and POST to `POST /pedidos-venda/{id}/faturar` with payload `{ itens: [{ itemId, quantidade }] }`
5. IF the API returns success, THEN THE Modal_Faturamento SHALL close, display a success notification "Faturamento parcial realizado com sucesso", and invalidate the pedido query to refresh data
6. IF the API returns an error, THEN THE Modal_Faturamento SHALL display the error message from the API in a red notification without closing the modal
7. WHILE the faturamento request is in progress, THE Modal_Faturamento SHALL display a loading state on the confirm button and disable form interactions
8. IF the user has not set any item quantity greater than 0 and clicks "Confirmar Faturamento", THEN THE Modal_Faturamento SHALL display a validation message "Selecione ao menos um item com quantidade maior que zero"

---

### Requirement 12: Página de Detalhe — Histórico de Faturamentos

**User Story:** Como operador de vendas, eu quero ver o histórico de faturamentos parciais realizados no pedido, para que eu rastreie quais entregas já foram efetivadas.

#### Acceptance Criteria

1. WHEN a pedido has vendasEfetivadas (partial billings), THE Pagina_Detalhe SHALL display a "Histórico de Faturamentos" card listing each VendaEfetivada with: data de efetivação, valor total, and a link to view the NF-e associated
2. WHEN a pedido has no vendasEfetivadas, THE Pagina_Detalhe SHALL not display the "Histórico de Faturamentos" card
3. THE Pagina_Detalhe SHALL display the progress of each item as a fraction "quantidadeFaturada / quantidade" with a colored indicator (green when fully billed, orange when partially billed, gray when not billed)

---

### Requirement 13: Formulário — Validação Zod Completa

**User Story:** Como desenvolvedor, eu quero um schema Zod completo para validação client-side do formulário, para que erros sejam apresentados ao usuário antes de enviar ao servidor.

#### Acceptance Criteria

1. THE Pagina_Formulario SHALL validate all form data client-side using a Zod schema before submission to the API
2. THE Zod schema SHALL enforce: clienteId as required string, tabelaPrecoId as required string, itens as array with minimum 1 element, each item with produtoId required and quantidade > 0
3. THE Zod schema SHALL enforce cross-field validations: tipoDesconto required when descontoGeral is filled and vice-versa, tipoAcrescimo required when acrescimoGeral is filled and vice-versa
4. THE Zod schema SHALL enforce format validations: cep as 8 numeric digits when enderecoEntrega is partially filled, uf as valid 2-char uppercase Brazilian state, dataValidade and dataEntrega as today or future when provided
5. WHEN validation fails, THE Pagina_Formulario SHALL display error messages below the respective fields using Mantine's error prop and open the Accordion section containing the first error
6. IF the API returns a 400 or 422 error after submission, THEN THE Pagina_Formulario SHALL display the server error message in a red notification toast

---

### Requirement 14: Componentes Modulares — Arquitetura

**User Story:** Como desenvolvedor, eu quero que cada seção do formulário seja um componente independente, para que o código seja manutenível, testável e reutilizável.

#### Acceptance Criteria

1. THE Pagina_Formulario SHALL organize form sections as independent component files: `SecaoDadosGerais.tsx`, `SecaoEntregaTransporte.tsx`, `SecaoFinanceiro.tsx`, `SecaoItensPedido.tsx`, `SecaoObservacoes.tsx`
2. THE Componente_Modular components SHALL receive form context via react-hook-form's `useFormContext` hook (FormProvider pattern) instead of prop drilling
3. THE Componente_Modular components SHALL accept a `disabled` prop that disables all fields within the section when status restrictions apply
4. THE Pagina_Formulario SHALL include a shared `BannerStatus` component that receives the pedido status and displays appropriate restriction messages
5. THE Pagina_Formulario SHALL include a shared `BadgePrioridade` component used in both the listing and detail pages, mapping URGENTE to red, NORMAL to blue, BAIXA to gray

---

### Requirement 15: Hooks e Data Layer

**User Story:** Como desenvolvedor, eu quero hooks React Query padronizados para todos os endpoints de pedido de venda, para que o data fetching seja consistente e cacheável.

#### Acceptance Criteria

1. THE Hook_Pedido layer SHALL provide a `usePedidosVenda` hook for listing with parameters: page, limit, status, prioridade, origemPedido, numeroPedidoCliente, ordenarPorPrioridade
2. THE Hook_Pedido layer SHALL provide a `usePedidoVenda(id)` hook for fetching a single pedido with its items, vendas efetivadas and related data
3. THE Hook_Pedido layer SHALL provide mutation hooks: `useCriarPedido`, `useEditarPedido`, `useConfirmarPedido`, `useCancelarPedido`, `useFaturarParcial`
4. WHEN a mutation succeeds, THE Hook_Pedido layer SHALL invalidate related query caches (pedidos-venda list and pedido-venda detail)
5. THE Hook_Pedido layer SHALL use the existing `api` instance from `@/lib/api` for all HTTP requests
6. THE Hook_Pedido layer SHALL provide a `useTransportadoras` hook for fetching transportadora options for the Select field

---

### Requirement 16: UX e Feedback Visual

**User Story:** Como operador de vendas, eu quero feedback visual claro durante operações, para que eu saiba o que está acontecendo no sistema em cada momento.

#### Acceptance Criteria

1. WHILE any API request is in progress on the form, THE Pagina_Formulario SHALL display a loading state on the submit button and prevent double submission
2. WHEN the form is submitted successfully, THE Pagina_Formulario SHALL display a green success notification and redirect to the appropriate page (list for new, detail for edit)
3. WHEN an API error occurs, THE Pagina_Formulario SHALL display a red error notification with the error message from the API response
4. THE Pagina_Formulario SHALL display breadcrumb text at the top: "Início / Vendas / Pedidos / Novo" or "Início / Vendas / Pedidos / Editar #{numero}"
5. THE Pagina_Detalhe SHALL display breadcrumb text at the top: "Vendas / Pedidos / #{numero}"
6. WHILE the detail page data is loading, THE Pagina_Detalhe SHALL display a LoadingOverlay on the main card

