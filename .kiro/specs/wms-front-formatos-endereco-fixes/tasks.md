# Implementation Plan: wms-front-formatos-endereco-fixes

## Overview

Implementação de três entregas no frontend WMS: CRUD de Formatos de Endereço (com seletores em depósito/zona e adaptação do EnderecoAutoModal), alerta de shelf life na conferência de entrada, e integração de sugestões automáticas no endereçamento manual. Cada task segue os padrões existentes do projeto (useCrudGenerico, react-hook-form + zod, Mantine 7, TanStack Query 5).

## Tasks

- [ ] 1. Hook e tipos base para Formato de Endereço
  - [ ] 1.1 Criar hook `useFormatoEndereco` com interfaces e CRUD genérico
    - Criar arquivo `src/data/hooks/useFormatoEndereco.ts`
    - Definir interfaces `ComponenteFormato`, `FormatoEndereco`, `FormatoResolvidoResponse`, `GerarEnderecosInput`
    - Instanciar `useCrudGenerico<FormatoEndereco>('/formato-endereco', 'formato-endereco')`
    - Implementar `useResolverFormato(depositoId, zonaId?)` com `useQuery` (GET `/formato-endereco/resolver`)
    - Implementar `useGerarComFormato()` com `useMutation` (POST `/formato-endereco/gerar`)
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 4.1, 4.5_

- [ ] 2. CRUD de Formatos de Endereço — Tela no Configurador
  - [ ] 2.1 Criar componente `FormatosEnderecoTab` com tabela e modal de criação/edição
    - Criar arquivo `src/app/(interna)/configurador/enderecos/FormatosEnderecoTab.tsx`
    - Implementar tabela com colunas: Nome, Componentes (badges dos ativos), Status
    - Implementar botões: Novo, Atualizar, Editar, Excluir (com confirmação)
    - Implementar modal inline com formulário react-hook-form + zod
    - Schema: `nome` (min 1 char), `componentes` (array com ao menos 1 ativo)
    - Cada componente (RUA, PREDIO, NIVEL, APARTAMENTO) com toggle ativo, digitos (1-10), separador (max 3)
    - Notificações de sucesso/erro via Mantine notifications
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ] 2.2 Integrar `FormatosEnderecoTab` na página de Endereços do Configurador
    - Adicionar botão ou sub-aba "Formatos de Endereço" na página `configurador/enderecos`
    - Renderizar `FormatosEnderecoTab` quando a sub-aba estiver ativa
    - _Requirements: 1.1_

  - [ ]* 2.3 Escrever property tests para CRUD de Formatos
    - **Property 1: Format table renders all items with required columns**
    - **Property 2: Format CRUD payload correctness**
    - **Property 3: Format validation rejects invalid submissions**
    - **Property 4: API error messages propagate to notifications**
    - **Validates: Requirements 1.2, 1.4, 1.5, 1.7, 1.8**

- [ ] 3. Seletor de Formato reutilizável e integração em Depósito/Zona
  - [ ] 3.1 Criar componente `FormatoEnderecoSelect`
    - Criar arquivo `src/components/configurador/FormatoEnderecoSelect.tsx`
    - Implementar Select Mantine com busca de formatos via `formatoEnderecoCrud.useListar`
    - Props: `value`, `onChange`, `error`, `label`
    - Configurar `searchable`, `clearable`, placeholder indicando seleção opcional
    - _Requirements: 2.1, 3.1_

  - [ ] 3.2 Integrar `FormatoEnderecoSelect` no `DepositoModal`
    - Adicionar campo `formatoEnderecoId` (opcional, nullable) ao schema zod do DepositoModal
    - Renderizar `<FormatoEnderecoSelect>` no formulário
    - Pré-selecionar formato existente no modo edição (via reset do form)
    - Incluir `formatoEnderecoId` no payload de POST/PUT
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Integrar `FormatoEnderecoSelect` no modal de Zona (`ZonasPage`)
    - Adicionar campo `formatoEnderecoId` (opcional, nullable) ao schema zod da zona
    - Renderizar `<FormatoEnderecoSelect>` no modal inline
    - Pré-selecionar formato existente no modo edição
    - Incluir `formatoEnderecoId` no payload de POST/PUT
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.4 Escrever property tests para FormatoEnderecoSelect
    - **Property 5: Format Select renders all options and pre-selects current value**
    - **Property 6: Entity save payload includes formatoEnderecoId**
    - **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 3.3**

- [ ] 4. Checkpoint — Validar CRUD e seletores
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Adaptação do EnderecoAutoModal com formato ativo
  - [ ] 5.1 Implementar visibilidade condicional de campos no `EnderecoAutoModal`
    - Importar e chamar `useResolverFormato(depositoId)` após seleção de depósito
    - Calcular `componentesAtivos` via `useMemo` baseado no formato resolvido
    - Renderizar condicionalmente campos de faixa (início/fim) apenas para componentes ativos
    - Fallback: se resolver retorna null/erro, exibir todos os campos padrão
    - Re-buscar formato ao alterar seleção de depósito
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ] 5.2 Adaptar submit do `EnderecoAutoModal` para usar `useGerarComFormato`
    - Incluir `formatoEnderecoId` resolvido no payload de geração
    - Chamar POST `/formato-endereco/gerar` via `useGerarComFormato`
    - Manter comportamento existente de notificação de sucesso/erro
    - _Requirements: 4.5_

  - [ ]* 5.3 Escrever property test para visibilidade de campos
    - **Property 7: Active component field visibility matches resolved format**
    - **Validates: Requirements 4.2**

- [ ] 6. Alerta de Shelf Life na Conferência de Entrada
  - [x] 6.1 Criar utilitário `calcularDiasRestantes` e `verificarShelfLife`
    - Criar arquivo `src/utils/shelfLife.ts`
    - Implementar `calcularDiasRestantes(dataVencimento, dataReferencia)` retornando dias inteiros
    - Implementar `verificarShelfLife(dataVencimento, shelfLifeMinimo, dataReferencia)` retornando dados do alerta ou null
    - Retornar null se shelfLifeMinimo é 0, null ou undefined
    - _Requirements: 5.1, 5.5_

  - [ ] 6.2 Criar componente `ShelfLifeAlert`
    - Criar arquivo `src/components/wms/ShelfLifeAlert.tsx`
    - Renderizar `<Alert color="yellow" variant="light">` do Mantine com ícone de warning
    - Mensagem: "Validade com {diasRestantes} dias restantes — mínimo exigido: {minimoExigido} dias"
    - Retornar null se `verificarShelfLife` retorna null (sem alerta)
    - _Requirements: 5.2, 5.3_

  - [ ] 6.3 Integrar `ShelfLifeAlert` na Conferência de Entrada
    - Na seção de contagem de itens, renderizar `<ShelfLifeAlert>` ao lado do campo de validade
    - Passar `dataVencimento` do campo do formulário e `shelfLifeMinimo` do produto
    - Garantir reatividade: alerta aparece/desaparece conforme alteração da data
    - Alerta não-bloqueante: não impede prosseguimento da conferência
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [ ]* 6.4 Escrever property test para shelf life
    - **Property 8: Shelf life warning biconditional**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

- [ ] 7. Checkpoint — Validar EnderecoAutoModal e Shelf Life
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Sugestões automáticas no Endereçamento Manual
  - [ ] 8.1 Integrar `useDistribuicaoInteligente` no modo manual de endereçamento
    - Na Conferencia_Entrada, seção de endereçamento manual (`endModoAtivo === 'manual'`)
    - Ao selecionar nota e entrar no modo manual, disparar `useDistribuicaoInteligente` para cada item pendente
    - Gerenciar estado de sugestões por item (loading, resultado, erro)
    - Exibir loader enquanto hook está carregando
    - _Requirements: 6.1, 6.5_

  - [ ] 8.2 Exibir sugestões e implementar "Aceitar Sugestões"
    - Renderizar sugestão ao lado de cada item: endereço sugerido + percentual de ocupação
    - Implementar botão "Aceitar Sugestões" que preenche campos de endereço destino com valores sugeridos
    - Permitir alteração manual dos campos após aceitar sugestões
    - Exibir mensagem informativa se hook retorna erro ou sem sugestões
    - _Requirements: 6.2, 6.3, 6.4, 6.6_

  - [ ] 8.3 Implementar confirmação de endereçamento via `useConfirmarDistribuicao`
    - Botão "Confirmar Endereçamento" chama `useConfirmarDistribuicao` com payload das alocações definidas
    - Payload contém produtoId, enderecoId, enderecoCompleto, quantidadeAlocada por item
    - Notificação de sucesso/erro após confirmação
    - _Requirements: 6.7_

  - [ ]* 8.4 Escrever property tests para endereçamento inteligente
    - **Property 9: Smart addressing suggestions populate destination fields**
    - **Property 10: Confirm distribution sends correct payload**
    - **Validates: Requirements 6.2, 6.3, 6.7**

- [ ] 9. Checkpoint final — Validar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser ignoradas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude definidas no design
- O projeto não possui framework de testes configurado; tasks de property test exigirão setup prévio (vitest + @testing-library/react) se executadas
- Padrões a seguir: `useCrudGenerico` para CRUD, `ZonasPage` para tabela+modal inline, `DepositoModal` para formulário com schema zod, `EnderecoAutoModal` para campos condicionais

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "6.2"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "6.3"] },
    { "id": 3, "tasks": ["2.3", "3.4", "5.1", "6.4"] },
    { "id": 4, "tasks": ["5.2", "5.3", "8.1"] },
    { "id": 5, "tasks": ["8.2"] },
    { "id": 6, "tasks": ["8.3"] },
    { "id": 7, "tasks": ["8.4"] }
  ]
}
```
