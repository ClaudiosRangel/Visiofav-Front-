# Implementation Plan: ERP Vendas — Pedido Completo Frontend

## Overview

Implementação frontend do módulo completo de Pedido de Venda para o VisioFab ERP. A abordagem é bottom-up: primeiro a camada de dados (types, schema, hooks), depois componentes compartilhados, seções modulares do formulário, refatoração das páginas (listagem, formulário, detalhe), modal de faturamento parcial, e por fim integração e validação final. Stack: Next.js 15, Mantine 7, React Query, react-hook-form + Zod, TypeScript.

## Tasks

- [x] 1. Camada de dados — Types e Schema Zod
  - [x] 1.1 Criar arquivo de tipos do módulo de vendas
    - Criar `src/data/hooks/vendas/types.ts` com todas as interfaces e type aliases: `PrioridadePedido`, `OrigemPedido`, `StatusPedido`, `TipoDesconto`, `TipoAcrescimo`, `ModalidadeFrete`, `EnderecoEntrega`, `ItemPedidoVenda`, `VendaEfetivada`, `PedidoVenda`, `PedidosVendaFilters`, `FaturarParcialPayload`, `PedidosVendaResponse`
    - Importar `PaginatedResponse` do módulo fiscal existente
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 1.2 Criar schema Zod completo com validações cross-field
    - Criar `src/lib/schemas/pedidoVendaSchema.ts` com: `enderecoEntregaSchema`, `itemSchema` (com refine de preço negativo), `pedidoVendaSchema` (com superRefine para endereço parcial, desconto/acréscimo cross-field, percentual 0.01-100)
    - Exportar type `PedidoVendaFormValues` inferido do schema
    - Incluir constante `UFS_VALIDAS` com as 27 UFs brasileiras
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 5.3, 5.5, 5.6, 6.3, 6.4, 6.6, 7.4_

  - [x] 1.3 Criar funções utilitárias puras (cálculo de item, formatação, cores)
    - Criar `calcularTotalItem` — fórmula: ((precoUnit × (1 - desconto/100)) - descontoValor) × quantidade + frete + seguro + outrasDespesas
    - Criar `formatarEnderecoEntrega` — concatena campos com formatação padrão
    - Criar `getProgressColor` — green (faturado completo), orange (parcial), gray (zero)
    - Criar `isFieldDisabled` e `isItemEditable` — lógica de desabilitação por status
    - Criar `FIELD_TO_SECTION` e `getFirstErrorSection` — mapeamento campo → seção do Accordion
    - Localizar em `src/components/vendas/utils.ts` ou arquivo adequado
    - _Requirements: 7.3, 9.1, 9.2, 9.3, 10.3, 12.3, 3.4_

  - [ ]* 1.4 Escrever property tests para calcularTotalItem
    - **Property 2: Item total calculation correctness**
    - **Validates: Requirements 7.3**
    - Usar fast-check para gerar inputs arbitrários com constraints válidos
    - Verificar que resultado é idêntico à fórmula canônica

  - [ ]* 1.5 Escrever property tests para schema Zod
    - **Property 3: Negative price validation**
    - **Property 4: Date validation rejects past dates**
    - **Property 5: Cross-field desconto/acréscimo validation**
    - **Property 6: Partial address triggers all-mandatory validation**
    - **Property 7: CEP and UF format validation**
    - **Property 14: Required fields schema validation**
    - **Validates: Requirements 7.4, 4.4, 5.4, 6.3, 6.4, 6.6, 5.3, 5.5, 5.6, 13.2, 13.3, 13.4**

  - [ ]* 1.6 Escrever property tests para funções utilitárias
    - **Property 1: Priority badge color mapping**
    - **Property 8: Status-based field disabling**
    - **Property 9: Partially billed items non-editable**
    - **Property 10: Address formatting determinism**
    - **Property 12: Billing progress color mapping**
    - **Validates: Requirements 2.2, 2.3, 2.4, 9.1, 9.2, 9.3, 10.3, 12.3**

- [x] 2. Hooks React Query
  - [x] 2.1 Criar hooks de query e mutation para pedidos de venda
    - Criar `src/data/hooks/vendas/usePedidoVenda.ts` com: `usePedidosVenda(params)`, `usePedidoVenda(id)`, `useCriarPedido()`, `useEditarPedido(id)`, `useConfirmarPedido()`, `useCancelarPedido()`, `useFaturarParcial(pedidoId)`
    - Usar instância `api` existente de `@/lib/api`
    - Invalidar cache corretamente em cada mutation (lista e detalhe)
    - Query key: `'pedidos-venda'`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 2.2 Criar hook useTransportadoras
    - Criar `src/data/hooks/vendas/useTransportadoras.ts` para fetch de transportadoras ativas
    - staleTime de 5 minutos
    - Query key: `'transportadoras-select'`
    - _Requirements: 15.6_

- [x] 3. Componentes compartilhados
  - [x] 3.1 Criar componente BadgePrioridade
    - Criar `src/components/vendas/BadgePrioridade.tsx` usando Mantine Badge
    - Mapa de cores: URGENTE → red, NORMAL → blue, BAIXA → gray
    - Props: `{ prioridade: PrioridadePedido }`
    - _Requirements: 2.2, 2.3, 2.4, 10.2, 14.5_

  - [x] 3.2 Criar componente BannerStatus
    - Criar `src/components/vendas/BannerStatus.tsx` usando Mantine Alert
    - Exibir nada para RASCUNHO, mensagem de restrição para CONFIRMADO
    - Mensagem adicional quando tem faturamento parcial
    - Props: `{ status: StatusPedido; temFaturamentoParcial?: boolean }`
    - _Requirements: 9.4, 9.5, 14.4_

- [x] 4. Checkpoint — Validar camada de dados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Seções modulares do formulário
  - [x] 5.1 Criar SecaoDadosGerais
    - Criar `src/components/vendas/SecaoDadosGerais.tsx`
    - Campos: clienteId (Select searchable), vendedorId (Select searchable), tabelaPrecoId (Select), condicaoPagId (Select condicional), prioridade (Select), origemPedido (Select), numeroPedidoCliente (TextInput max 60), dataValidade (DateInput)
    - Exibir campo orcamentoOrigemId quando origemPedido === 'ORCAMENTO'
    - Usar `useFormContext<PedidoVendaFormValues>()` para acesso ao form
    - Aceitar prop `disabled` para desabilitar todos os campos
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 14.2, 14.3_

  - [x] 5.2 Criar SecaoEntregaTransporte
    - Criar `src/components/vendas/SecaoEntregaTransporte.tsx`
    - Campos: dataEntrega (DateInput), transportadoraId (Select com useTransportadoras), modalidadeFrete (Select 0-CIF/1-FOB/2-Terceiros/3-Próprio remetente/4-Próprio destinatário/9-Sem frete)
    - Sub-seção "Endereço de Entrega Alternativo": logradouro, numero, complemento, bairro, cidade, uf (Select 27 UFs), cep (mask 8 dígitos)
    - Usar `useFormContext` + prop `disabled`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.2, 14.3_

  - [x] 5.3 Criar SecaoFinanceiro
    - Criar `src/components/vendas/SecaoFinanceiro.tsx`
    - Campos: tipoDesconto (Select PERCENTUAL/VALOR_FIXO), descontoGeral (NumberInput 2 decimais), tipoAcrescimo (Select FRETE/SEGURO/OUTRAS_DESPESAS), acrescimoGeral (NumberInput 2 decimais)
    - Habilitar/desabilitar campos condicionalmente (descontoGeral depende de tipoDesconto, etc.)
    - Usar `useFormContext` + prop `disabled`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 14.2, 14.3_

  - [x] 5.4 Criar SecaoItensPedido
    - Criar `src/components/vendas/SecaoItensPedido.tsx`
    - Tabela com colunas: Produto, Unidade, Qtd, Preço Unit., Desc %, Desc Valor, Frete, Seguro, Outras Desp., Total (read-only calculado)
    - Expand/detail por item: observacaoItem, dataEntregaItem, comissaoPercItem
    - Botão "Adicionar Item" e botão remover (mínimo 1 item)
    - Usar `useFieldArray` para gerenciar itens dinamicamente
    - Recalcular total do item em real-time via `calcularTotalItem`
    - Prop `disabled` + lógica `isItemEditable` para itens parcialmente faturados
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.3, 14.2, 14.3_

  - [x] 5.5 Criar SecaoObservacoes
    - Criar `src/components/vendas/SecaoObservacoes.tsx`
    - Campos: observacao (Textarea max 1000, label "Observação Interna"), observacaoNota (Textarea max 2000, label "Observação para Nota Fiscal")
    - Exibir contador de caracteres abaixo de cada textarea
    - Usar `useFormContext` + prop `disabled`
    - _Requirements: 8.1, 8.2, 8.3, 14.2, 14.3_

- [x] 6. Refatoração das páginas
  - [x] 6.1 Refatorar página de listagem (PedidosVendaPage)
    - Refatorar `src/app/(interna)/vendas/pedidos/page.tsx`
    - Adicionar filtros: prioridade (Select), origemPedido (Select), numeroPedidoCliente (TextInput com debounce 400ms), toggle "Ordenar por Prioridade"
    - Resetar paginação para page 1 ao alterar qualquer filtro
    - Adicionar colunas: Prioridade (BadgePrioridade), Origem (badge texto)
    - Usar `usePedidosVenda` com todos os filtros
    - Actions: Ver, Confirmar (useConfirmarPedido), Cancelar (useCancelarPedido)
    - LoadingOverlay durante carregamento
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 6.2 Refatorar página de formulário (FormularioPedidoPage)
    - Refatorar `src/app/(interna)/vendas/pedidos/novo/page.tsx`
    - Implementar FormProvider com zodResolver(pedidoVendaSchema)
    - Layout Accordion com multiple={true}, defaultValue=['dados-gerais']
    - Renderizar seções modulares: SecaoDadosGerais, SecaoEntregaTransporte, SecaoFinanceiro, SecaoItensPedido, SecaoObservacoes
    - Lógica de status: redirect para detalhe se EFETIVADO/CANCELADO, BannerStatus para CONFIRMADO, prop disabled nas seções conforme isFieldDisabled
    - Auto-abrir seção com primeiro erro via getFirstErrorSection
    - Submit: useCriarPedido (novo) ou useEditarPedido (edição)
    - Loading no botão, notificações sucesso/erro, breadcrumb
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 13.1, 13.5, 13.6, 16.1, 16.2, 16.3, 16.4_

  - [x] 6.3 Refatorar página de detalhe (DetalhePedidoPage)
    - Refatorar `src/app/(interna)/vendas/pedidos/[id]/page.tsx`
    - Cards organizados: Dados do Pedido (com BadgePrioridade), Entrega e Transporte (com formatarEnderecoEntrega), Financeiro
    - Tabela de itens com colunas adicionais: Desc Valor, Frete, Seguro, Outras Desp., Qtd Faturada (progresso com getProgressColor)
    - Card "Observações" quando preenchido
    - Card "Histórico de Faturamentos" quando existem vendasEfetivadas (link para NF-e)
    - Data Limite Atendimento (SLA) destacada para prioridade URGENTE
    - Botão "Faturar Parcial" para pedidos CONFIRMADOS
    - LoadingOverlay, breadcrumb
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.1, 12.2, 12.3, 16.5, 16.6_

- [x] 7. Modal de Faturamento Parcial
  - [x] 7.1 Criar ModalFaturamentoParcial
    - Criar `src/components/vendas/ModalFaturamentoParcial.tsx`
    - Tabela com colunas: Produto, Qtd Original, Qtd Já Faturada, Saldo Disponível, Qtd a Faturar (NumberInput)
    - Pré-preencher "Qtd a Faturar" com 0
    - Validação: quantidade não pode exceder saldo (quantidade - quantidadeFaturada)
    - Validação: ao menos 1 item com quantidade > 0 para submeter
    - Submit via useFaturarParcial → payload filtrado (apenas itens com qtd > 0)
    - Loading no botão confirmar, disable durante requisição
    - Sucesso: fechar modal + notificação verde + invalidar cache
    - Erro: manter aberto + notificação vermelha
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 7.2 Escrever property test para validação do modal de faturamento
    - **Property 11: Faturamento quantity cannot exceed available balance**
    - **Validates: Requirements 11.3**
    - Testar com fast-check que qualquer quantidade > saldo gera erro
    - Testar que quantidade dentro do saldo passa validação

  - [ ]* 7.3 Escrever property test para filter resets page
    - **Property 13: Filter change always resets page to 1**
    - **Validates: Requirements 1.6**
    - Testar com fast-check que qualquer mudança de filtro reseta page para 1

- [x] 8. Checkpoint — Integração e validação final
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integração e ajustes finais
  - [x] 9.1 Criar componente FiltrosPedidos e integrar na listagem
    - Criar `src/components/vendas/FiltrosPedidos.tsx` (se não foi inline na listagem)
    - Garantir que todos os filtros funcionam em conjunto
    - Verificar debounce do numeroPedidoCliente
    - Verificar reset de paginação
    - _Requirements: 1.1, 1.4, 1.6, 1.7_

  - [x] 9.2 Wiring final — navegação, redirects e notificações
    - Garantir navegação: listagem → formulário (novo/editar), listagem → detalhe, detalhe → editar
    - Redirect automático de formulário para detalhe quando status EFETIVADO/CANCELADO
    - Notificações globais (success/error) usando @mantine/notifications
    - Breadcrumbs corretos em todas as páginas
    - _Requirements: 9.6, 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 9.3 Escrever testes unitários de integração dos componentes
    - Testar renderização da listagem com filtros e badges
    - Testar Accordion abre "Dados Gerais" por padrão
    - Testar BannerStatus com mensagens corretas por status
    - Testar Modal abre/fecha corretamente
    - _Requirements: 2.1, 3.2, 9.4, 11.1_

- [x] 10. Checkpoint final
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- Property tests usam fast-check (já instalado no projeto) com vitest
- Localização dos testes: `src/components/vendas/__tests__/` e `src/lib/schemas/__tests__/`
- O projeto usa TypeScript 100% — todas as implementações devem ser tipadas
- Seguir padrões existentes do projeto (ex: hooks seguem padrão do `useNfe`)
- Checkpoints garantem validação incremental

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1", "3.1", "3.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.5"] },
    { "id": 4, "tasks": ["5.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3"] }
  ]
}
```
