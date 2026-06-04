# Implementation Plan: Geo Frontend Integration

## Overview

This plan implements the frontend geolocation layer for the VisioFab WMS system. The backend API endpoints are already available; tasks focus on creating the data hooks (TanStack Query), UI components (Mantine v7), and a new batch geocoding page. Implementation follows incremental steps: types → hooks → components → page → integration into existing pages.

## Tasks

- [x] 1. Set up types, test infrastructure, and data layer
  - [x] 1.1 Create geo API types and query keys
    - Create `src/data/types/geo.ts` with all TypeScript interfaces: `GeocodificacaoResult`, `SugestaoRota`, `OtimizacaoResult`, `SequenciaEntrega`, `SalvarSequenciaRequest`, `DistanciaResult`, `CoberturaRota`, `CidadeCobertura`, `BairroCobertura`, `CoberturaConsolidada`, `Sobreposicao`, `BatchGeoResult`, `ResumoGeoClientes`
    - Create `GEO_KEYS` constant object with all query key factories
    - _Requirements: 9.10_

  - [x] 1.2 Set up Vitest and React Testing Library
    - Install and configure `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `fast-check`
    - Create `vitest.config.ts` with jsdom environment, path aliases matching `tsconfig.json`
    - Create `src/test/setup.ts` with Testing Library matchers
    - Add `test` script to `package.json`
    - _Requirements: Testing infrastructure_

  - [x] 1.3 Implement all geo mutation hooks in `useGeo.ts`
    - Create `src/data/hooks/useGeo.ts`
    - Implement `useGeocodificarCliente(clienteId)` — POST `/api/geo/clientes/:id/geocodificar`, invalidates `clientes` key
    - Implement `useGeocodificarEmpresa()` — POST `/api/geo/empresa/geocodificar`, invalidates `empresa-config` key
    - Implement `useGeocodificarBatch()` — POST `/api/geo/clientes/geocodificar-batch`, invalidates `clientes` key
    - Implement `useOtimizarRota(mapaId)` — POST `/api/geo/mapas/:id/otimizar`
    - Implement `useSalvarSequencia(mapaId)` — POST `/api/geo/mapas/:id/salvar-sequencia`, invalidates `mapas-carregamento` key
    - All mutations follow consistent `onError` pattern: 503 → orange notification, else → red notification with API message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.2, 10.3, 10.4_

  - [x] 1.4 Implement all geo query hooks in `useGeo.ts`
    - Implement `useDistanciaCliente(clienteId)` — GET `/api/geo/distancia/cliente/:clienteId`, enabled when clienteId truthy
    - Implement `useSugestaoRota(clienteId, enabled)` — GET `/api/geo/clientes/:id/sugestao-rota`, enabled conditionally
    - Implement `useCoberturaRota(rotaId, enabled)` — GET `/api/geo/rotas/:id/cobertura`, enabled conditionally
    - Implement `useCoberturaConsolidada(enabled)` — GET `/api/geo/rotas/cobertura-consolidada`
    - Implement `useResumoGeoClientes()` — GET endpoint for client geo summary (for batch page)
    - _Requirements: 9.6, 9.7, 9.8, 9.9_

  - [ ]* 1.5 Write property test: hooks call correct endpoints (Property 11)
    - **Property 11: Geo hooks call correct endpoints**
    - Generate random valid entity IDs; assert each hook constructs the correct URL path and uses correct HTTP method
    - Assert mutation hooks invalidate the specified query keys on success
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8**

- [x] 2. Checkpoint - Ensure data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement geocoding components (Client and Company)
  - [x] 3.1 Implement GeoStatusBadge component
    - Create `src/components/geo/GeoStatusBadge.tsx`
    - Render green Badge with `IconMapPinFilled` when `geocodificado === true`
    - Render gray Badge with `IconMapPinOff` when `geocodificado === false`
    - _Requirements: 1.7_

  - [ ]* 3.2 Write property test: geocoding status indicator (Property 2)
    - **Property 2: Geocoding status indicator reflects coordinates**
    - Generate clients with random lat/lng (or null); assert badge color/icon matches coordinate presence
    - **Validates: Requirements 1.7**

  - [x] 3.3 Implement GeocodificarClienteButton component
    - Create `src/components/geo/GeocodificarClienteButton.tsx`
    - Props: `clienteId`, `temEndereco`, `temCoordenadas`
    - Render Button with `IconMapPin`, text "Geocodificar"
    - Disabled when `!temEndereco` or mutation `isPending`
    - On click: call `useGeocodificarCliente.mutate(clienteId)`
    - Success: green notification "Coordenadas atualizadas com sucesso"
    - Error 503: orange notification with service unavailable message
    - Other errors: red notification with API message
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 3.4 Write property test: geocode button visibility (Property 1)
    - **Property 1: Geocode button visibility follows address condition**
    - Generate arbitrary client objects with random cep/cidade fields; assert button enabled iff cep or cidade is non-empty
    - **Validates: Requirements 1.1**

  - [ ]* 3.5 Write property test: buttons disabled during pending mutation (Property 12)
    - **Property 12: Buttons disabled during pending mutation**
    - Render button during pending state; assert disabled attribute is true for all geo action buttons
    - **Validates: Requirements 10.1, 10.5**

  - [x] 3.6 Implement GeocodificarEmpresaButton component
    - Create `src/components/geo/GeocodificarEmpresaButton.tsx`
    - Props: `temEndereco`, `temCoordenadas`
    - Same pattern as client button but calls `useGeocodificarEmpresa`
    - When `!temCoordenadas`: show yellow Alert informing geocoding needed for route optimization
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.7 Write property tests: success/error notifications (Properties 13, 14)
    - **Property 13: Success notifications use green color**
    - **Property 14: Error notifications use red color with API message**
    - After mutation resolution, assert notification config has correct color and message
    - **Validates: Requirements 10.2, 10.3**

- [x] 4. Implement route suggestion and distance components
  - [x] 4.1 Implement SugestaoRotaModal component
    - Create `src/components/geo/SugestaoRotaModal.tsx`
    - Props: `opened`, `onClose`, `clienteId`, `onRotaSelecionada`
    - Use `useSugestaoRota(clienteId)` query, enabled when `opened`
    - Display Table with columns: Código, Descrição, Distância Média (km), Qtd Clientes
    - Empty state: message "Não há rotas com clientes geocodificados para comparação"
    - Each row: "Selecionar" button calling `onRotaSelecionada(rotaId)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ]* 4.2 Write property test: route suggestion button enabled condition (Property 3)
    - **Property 3: Route suggestion button enabled iff client has coordinates**
    - Generate clients with random coordinates (or null); assert button enabled/disabled state
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 4.3 Write property test: route suggestion display fields (Property 4)
    - **Property 4: Route suggestion display contains all required fields**
    - Generate arbitrary arrays of suggestion objects; assert all fields present in rendered output
    - **Validates: Requirements 2.3**

  - [x] 4.4 Implement DistanciaClienteInfo component
    - Create `src/components/geo/DistanciaClienteInfo.tsx`
    - Props: `clienteId`, `clienteTemCoordenadas`, `empresaTemCoordenadas`
    - If `!clienteTemCoordenadas`: render "Distância: não disponível (cliente sem geolocalização)"
    - If `!empresaTemCoordenadas`: render "Distância: não disponível (empresa sem geolocalização)"
    - Otherwise: use `useDistanciaCliente(clienteId)`, display `{value.toFixed(2)} km`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.5 Write property test: distance formatting consistency (Property 8)
    - **Property 8: Distance formatting consistency**
    - Generate random float values; assert displayed string matches pattern `X.XX km` (exactly 2 decimal places)
    - **Validates: Requirements 6.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement route optimization and sequence components
  - [x] 6.1 Implement OtimizarRotaPanel component
    - Create `src/components/geo/OtimizarRotaPanel.tsx`
    - Props: `mapaId`, `status`, `nfs`
    - Show "Otimizar Rota" button only when status is `AGUARDANDO_SEPARACAO` or `EM_CARREGAMENTO`
    - On click: call `useOtimizarRota.mutate(mapaId)`
    - Render optimized list as Table: Ordem, Cliente, Endereço, Distância Parcial
    - Non-geocoded clients at end with Badge "Sem geolocalização" and distance "—"
    - Show Card with `distanciaTotalKm` prominently
    - After optimization: show "Salvar Sequência" button
    - On save: call `useSalvarSequencia.mutate({ mapaId, sequencia })`
    - Handle 422 empresa error with specific guidance notification
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 6.2 Write property test: optimize button visibility by status (Property 5)
    - **Property 5: Optimize route button visibility follows map status**
    - Generate maps with random statuses; assert button visible iff status is AGUARDANDO_SEPARACAO or EM_CARREGAMENTO
    - **Validates: Requirements 4.1**

  - [ ]* 6.3 Write property test: non-geocoded clients at end (Property 6)
    - **Property 6: Non-geocoded clients appear at end of optimized sequence**
    - Generate mixed sequences with geocoded and non-geocoded clients; assert ordering invariant and indicators
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 6.4 Write property test: romaneio display mode (Property 7)
    - **Property 7: Romaneio display mode matches sequence existence**
    - Generate romaneio data with/without saved sequence; assert order number and distance columns shown iff sequence exists
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

- [x] 7. Implement coverage components
  - [x] 7.1 Implement CoberturaRotaModal component
    - Create `src/components/geo/CoberturaRotaModal.tsx`
    - Props: `opened`, `onClose`, `rotaId`, `rotaDescricao`
    - Use `useCoberturaRota(rotaId)` query
    - Header card: total geocodificados / não-geocodificados
    - Accordion or nested list: Cidade → Bairros com quantidade de clientes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.2 Implement CoberturaConsolidadaModal component
    - Create `src/components/geo/CoberturaConsolidadaModal.tsx`
    - Props: `opened`, `onClose`
    - Use `useCoberturaConsolidada()` query
    - Display all routes' coverage grouped by city/bairro
    - Overlapping areas highlighted with `Badge color="orange"` listing conflicting routes
    - _Requirements: 7.5, 7.6, 7.7_

  - [ ]* 7.3 Write property test: coverage overlap highlighting (Property 9)
    - **Property 9: Coverage overlap highlighting**
    - Generate consolidated coverage data with overlapping city+bairro combos; assert visual highlighting and route listing
    - **Validates: Requirements 7.7**

- [x] 8. Implement batch geocoding page
  - [x] 8.1 Create GeocodificacaoBatchPage
    - Create `src/app/(interna)/configurador/geocodificacao-lote/page.tsx`
    - Display summary card: total clients, geocodificados, não-geocodificados (use `useResumoGeoClientes`)
    - "Geocodificar Todos" button triggering `useGeocodificarBatch` mutation
    - Loading state: progress indicator with "Processando geocodificação..."
    - Result display: success/failure counts + table of failed clients (razão social, motivo)
    - "Reexecutar Falhas" button re-submitting only failed client IDs
    - Filter by geocoding status (geocodificados / não-geocodificados)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 8.2 Write property test: batch result summary correctness (Property 10)
    - **Property 10: Batch result summary correctness**
    - Generate batch results; assert `sucessos + falhas === totalProcessados` and failure detail list length equals `falhas`
    - **Validates: Requirements 8.5**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate components into existing pages
  - [x] 10.1 Integrate GeocodificarClienteButton and GeoStatusBadge into Clientes page
    - Add `GeoStatusBadge` to client listing table as optional column
    - Add `GeocodificarClienteButton` to client detail/edit page
    - Add `SugestaoRotaModal` trigger button (disabled when no coordinates) with tooltip
    - Add latitude/longitude as read-only fields in detail and optional columns in listing
    - _Requirements: 1.1, 1.6, 1.7, 2.1, 2.5_

  - [x] 10.2 Integrate GeocodificarEmpresaButton into Empresa config page
    - Add `GeocodificarEmpresaButton` to empresa configuration page
    - Display lat/lng as read-only fields
    - Show yellow alert when empresa lacks coordinates
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 10.3 Integrate OtimizarRotaPanel into Mapa de Carregamento detail
    - Add `OtimizarRotaPanel` to the mapa detail page
    - Add "Distância Total (km)" column to mapas listing when value available
    - _Requirements: 4.1, 4.9_

  - [x] 10.4 Integrate sequence display into Romaneio view
    - When mapa has saved sequence: show NFs in sequence order with Ordem and Distância columns
    - When mapa has no sequence: show NFs in original order without extra columns
    - Show distance total card at top of romaneio
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 10.5 Integrate DistanciaClienteInfo into Pedido de Venda detail
    - Add `DistanciaClienteInfo` component to order detail card
    - _Requirements: 6.1_

  - [x] 10.6 Integrate CoberturaRotaModal and CoberturaConsolidadaModal into Rotas page
    - Add "Ver Cobertura" button per route in listing
    - Add "Cobertura Consolidada" button in page header/toolbar
    - _Requirements: 7.1, 7.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All hooks follow the established project pattern: TanStack Query v5 with Axios via `@/lib/api`
- Components use Mantine v7 and `@mantine/notifications` for feedback
- The batch geocoding page is the only new route; all other features integrate into existing pages

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.6"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.7", "4.1", "4.4"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.5", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] }
  ]
}
```
