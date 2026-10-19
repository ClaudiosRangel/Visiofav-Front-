# Design Document

## Overview

Padronização dos grids de PCP, Orçamento Gráfico, Compras e WMS usando o
componente `DataTablePadrao` (wrapper sobre mantine-datatable). Client-side por
padrão; server-side nas telas cuja listagem já é paginada no backend. Entregue
em ondas por módulo. Cada tela mantém colunas, badges, ações e formulários.

## Architecture

```
src/components/ui/DataTablePadrao.tsx   [wrapper único — FEITO]
  props: dados, colunas, camposBusca, buscaPlaceholder, carregando,
         ordenacaoInicial, pageSize, textoVazio, idAccessor
  comportamento: busca textual + sort + paginação + contador (client-side)

Telas: substituem <Table>/<Table.Thead>/<Table.Tbody> por <DataTablePadrao>
  mapeando as <Table.Th> para colunas e o render de <Table.Td> para column.render.

CSS global: src/app/layout.tsx importa 'mantine-datatable/styles.css'  [FEITO]
```

## Components and Interfaces

- `DataTablePadrao<T>`: já implementado. Para server-side, a tela controla
  `page`/`sortStatus` por fora e passa `comBusca={false}` usando a busca própria
  (ou evolui o wrapper com props server-side numa onda futura, se necessário).
- Padrão de coluna: `{ accessor, title, sortable?, width?, render? }`.

## Data Models

Sem mudança de schema. Puramente frontend.

## Correctness Properties

### Property 1: Preservação de ações

Cada ação (editar/inativar/navegar/modal) de uma tela refatorada continua
disparando o mesmo handler de antes.

**Validates: Requirements 2.2, 3.1, 4.1, 5.1, 6.2**

### Property 2: Server-side preservado

Telas com paginação server-side (ex.: Produtos) continuam paginando no backend
após a refatoração.

**Validates: Requirements 6.3**

### Property 3: Build verde por onda

Ao final de cada onda (módulo), `npm run build` passa.

**Validates: Requirements 6.1**

## Error Handling

- Lista vazia → texto de vazio do wrapper.
- Erro de carga → o try/catch existente de cada tela é mantido.

## Testing Strategy

- Verificação por `get_diagnostics` em cada tela refatorada.
- `npm run build` ao final de cada onda (módulo).
- Validação visual pelo usuário por módulo.
