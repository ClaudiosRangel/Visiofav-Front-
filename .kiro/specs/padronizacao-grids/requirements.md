# Requirements Document

## Glossary

- **Grid**: tabela de listagem de registros numa tela (`<Table>` do Mantine hoje).
- **DataTablePadrao**: componente wrapper reutilizável (`src/components/ui/
  DataTablePadrao.tsx`) sobre `mantine-datatable`, com busca, ordenação,
  paginação e contador — o padrão único de grid do sistema.
- **Client-side**: busca/ordenação/paginação feitas no navegador sobre a lista
  completa (listas pequenas/médias já carregadas).
- **Server-side**: a listagem já é paginada no backend (`{ data, total, page,
  limit }`); busca/ordenação/paginação devem ir ao servidor (listas grandes).

## Introduction

Os grids do sistema são inconsistentes: a maioria usa `<Table>` cru, sem
paginação, sem contador de registros, sem ordenação por coluna e sem busca.
O usuário aprovou o padrão com `mantine-datatable` (piloto na tela de Centros
de Produção) e pediu para aplicá-lo nos módulos **PCP, Orçamento Gráfico,
Compras e WMS**.

Esta feature padroniza os grids desses 4 módulos usando o componente
`DataTablePadrao`, preservando as colunas, badges, ações e formulários de cada
tela. Telas com paginação server-side (listas grandes, ex.: Produtos) usam o
modo server-side; as demais usam client-side.

Entregue em ondas por módulo para rastreabilidade entre sessões.

## Requirements

### Requirement 1: Componente DataTablePadrao

**User Story:** Como desenvolvedor, quero um componente único de grid, para
padronizar busca/ordenação/paginação em todas as telas.

#### Acceptance Criteria

1. O `DataTablePadrao` SHALL oferecer busca textual (campos configuráveis),
   ordenação por coluna, paginação e contador de registros.
2. O componente SHALL aceitar colunas no formato do mantine-datatable
   (accessor, title, sortable, width, render).
3. O componente SHALL suportar estado de carregando e texto de vazio.
4. The CSS do mantine-datatable SHALL ser importado globalmente uma vez.

### Requirement 2: Padronização dos grids do PCP

**User Story:** Como usuário do PCP, quero grids com busca/ordenação/paginação
nas telas de listagem.

#### Acceptance Criteria

1. As telas de cadastro e listagem do PCP com `<Table>` SHALL usar o
   `DataTablePadrao` (ou server-side quando a lista for grande).
2. As colunas, badges, ações e formulários existentes SHALL ser preservados.
3. Telas de visualização especial (Gantt, Programação drag-and-drop, Painel TV)
   NÃO são grids de listagem e ficam FORA do escopo.

### Requirement 3: Padronização dos grids do Orçamento Gráfico

**User Story:** Como usuário do Orçamento Gráfico, quero grids com busca/
ordenação/paginação nas telas de cadastro e listagem.

#### Acceptance Criteria

1. As telas de cadastro e listagem do Orçamento Gráfico com `<Table>` SHALL usar
   o `DataTablePadrao`, preservando colunas/ações/forms.

### Requirement 4: Padronização dos grids de Compras

**User Story:** Como usuário de Compras, quero grids com busca/ordenação/
paginação nas telas de listagem.

#### Acceptance Criteria

1. As telas de listagem de Compras com `<Table>` SHALL usar o `DataTablePadrao`
   (server-side onde a lista for paginada no backend).

### Requirement 5: Padronização dos grids do WMS

**User Story:** Como usuário do WMS, quero grids com busca/ordenação/paginação
nas telas de listagem.

#### Acceptance Criteria

1. As telas de listagem do WMS com `<Table>` SHALL usar o `DataTablePadrao`
   (server-side onde aplicável), preservando colunas/ações/forms.

### Requirement 6: Não-regressão funcional

**User Story:** Como usuário, quero que as telas padronizadas continuem
funcionando exatamente como antes (ações, navegação, paginação).

#### Acceptance Criteria

1. Após cada refatoração, o `npm run build` SHALL passar.
2. As ações (editar/inativar/abrir modal/navegar) SHALL continuar funcionando.
3. Telas com paginação server-side existente NÃO SHALL perder a paginação.
