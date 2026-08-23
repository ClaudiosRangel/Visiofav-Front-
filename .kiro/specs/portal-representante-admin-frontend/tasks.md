# Implementation Plan: Portal Representante — Admin Frontend

## Overview

Implementação das telas administrativas do Portal do Representante no frontend do Vizor ERP. O módulo permite que administradores (ADMIN/SUPER_ADMIN) gerenciem contas de representantes, processem solicitações de orçamento, configurem critérios de comissão e revisem aprovações de clientes. A implementação segue a ordem: tipos compartilhados → hooks de dados → navegação/sidebar → páginas individuais → testes.

O backend já está implementado com contrato fixo em `/api/portal-rep/admin/`. O frontend será construído com Next.js 15 App Router, Mantine 7, TanStack Query, Axios e TypeScript, seguindo os padrões consolidados do projeto (padrão de `usePedidoVenda.ts`, `PedidosVendaPage`, etc.).

## Tasks

- [x] 1. Criar tipos compartilhados e hooks de dados
  - [x] 1.1 Criar `src/data/hooks/portal-representante/types.ts` com todas as interfaces TypeScript
    - Definir tipos: `StatusRepresentante`, `CriterioComissao`, `TipoAprovacao`, `StatusAprovacao`, `StatusSolicitacao`
    - Definir interfaces: `Representante`, `VendedorDisponivel`, `CriarRepresentantePayload`, `CriarRepresentanteResponse`, `EditarRepresentantePayload`, `ResetarSenhaResponse`, `SolicitacaoOrcamento`, `SolicitacaoItem`, `SolicitacoesFilters`, `PaginatedResponse<T>`, `ConfiguracaoComissao`, `AlterarComissaoPayload`, `AprovacaoCliente`
    - Definir constantes de UI: `statusRepresentanteColors`, `statusSolicitacaoColors`, `criterioComissaoOptions`
    - _Requirements: 12.4_

  - [x] 1.2 Criar `src/data/hooks/portal-representante/useRepresentantes.ts`
    - Implementar `useRepresentantes()` — GET `/portal-rep/admin/representantes`, queryKey `['portal-rep-representantes']`
    - Implementar `useVendedoresDisponiveis()` — GET `/portal-rep/admin/representantes` (param: vendedores-disponiveis), queryKey `['portal-rep-vendedores-disponiveis']`
    - Implementar `useCriarRepresentante()` — POST `/portal-rep/admin/representantes`, invalida `['portal-rep-representantes']`
    - Implementar `useEditarRepresentante()` — PUT `/portal-rep/admin/representantes/:id`, invalida `['portal-rep-representantes']`
    - Implementar `useInativarRepresentante()` — PUT `/portal-rep/admin/representantes/:id/inativar`, invalida `['portal-rep-representantes']`
    - Implementar `useResetarSenha()` — PUT `/portal-rep/admin/representantes/:id/resetar-senha`, invalida `['portal-rep-representantes']`
    - _Requirements: 2.1, 3.4, 3.6, 4.4, 4.5, 5.2, 5.3, 6.2, 12.5_

  - [x] 1.3 Criar `src/data/hooks/portal-representante/useSolicitacoesOrcamento.ts`
    - Implementar `useSolicitacoesOrcamento(params: SolicitacoesFilters)` — GET `/portal-rep/admin/solicitacoes-orcamento`, queryKey `['portal-rep-solicitacoes', params]`
    - Implementar `useCalcularOrcamento()` — POST `/portal-rep/admin/solicitacoes-orcamento/:id/calcular`, invalida `['portal-rep-solicitacoes']`
    - _Requirements: 7.1, 7.5, 8.2, 8.4, 12.5_

  - [x] 1.4 Criar `src/data/hooks/portal-representante/useConfiguracaoComissao.ts`
    - Implementar `useConfiguracaoComissao()` — GET `/portal-rep/admin/configuracao-comissao`, queryKey `['portal-rep-config-comissao']`
    - Implementar `useAlterarConfiguracaoComissao()` — PUT `/portal-rep/admin/configuracao-comissao`, invalida `['portal-rep-config-comissao']`
    - _Requirements: 9.1, 9.3, 9.4, 12.5_

  - [x] 1.5 Criar `src/data/hooks/portal-representante/useAprovacoesCliente.ts`
    - Implementar `useAprovacoesCliente()` — GET `/portal-rep/admin/aprovacoes-cliente`, queryKey `['portal-rep-aprovacoes']`
    - _Requirements: 10.1, 12.5_

- [x] 2. Integrar navegação no ModuleSidebar
  - [x] 2.1 Adicionar módulo `'portal-representante'` ao `MODULE_MENUS` em `src/components/layout/ModuleSidebar.tsx`
    - Adicionar entrada com `title: 'Portal Representante'` e as 4 sub-páginas: Representantes (`/portal-representante/representantes`), Solicitações de Orçamento (`/portal-representante/solicitacoes-orcamento`), Configuração de Comissão (`/portal-representante/configuracao-comissao`), Aprovações de Clientes (`/portal-representante/aprovacoes-cliente`)
    - Adicionar `if (pathname.startsWith('/portal-representante')) return 'portal-representante'` na função `detectModule()`
    - Restringir visibilidade do módulo a perfis ADMIN e SUPER_ADMIN usando `getUserPerfil()` no componente (ocultar a entrada para SUPERVISOR/OPERADOR)
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Checkpoint - Verificar hooks e navegação
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar página de Representantes (CRUD completo)
  - [x] 4.1 Criar `src/app/(interna)/portal-representante/representantes/page.tsx`
    - Implementar `RepresentantesPage` como componente `'use client'`
    - Chamar `usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])` no topo
    - Layout: breadcrumb → título "Representantes" → Card com LoadingOverlay → Table
    - Tabela com colunas: Nome do Vendedor, E-mail, Status (Badge verde/vermelho), Último Acesso, Data de Criação
    - Indicar visualmente senha temporária pendente (badge ou ícone) quando `senhaTemporaria === true`
    - Botão "Novo Representante" abre modal de criação; ações por linha: Editar, Inativar, Resetar Senha
    - Tratar loading (LoadingOverlay), erro (mensagem com retry), e lista vazia
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 11.2, 11.5, 12.1, 12.2, 12.3_

  - [x] 4.2 Implementar modal de criação de representante na mesma página
    - Modal com campos: Vendedor (Select/Autocomplete usando `useVendedoresDisponiveis`), E-mail (TextInput com validação client-side)
    - Validar formato de e-mail antes de permitir submit
    - Em sucesso (201): exibir senha temporária em diálogo de confirmação com `CopyButton`
    - Em erro: exibir mensagem do backend inline no modal sem fechar
    - Após fechar diálogo de senha: invalidar query de listagem
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 11.1, 11.5_

  - [x] 4.3 Implementar modal de edição de representante na mesma página
    - Modal pré-preenchido com dados atuais (e-mail, status, notificação por e-mail)
    - Nome do vendedor exibido como somente-leitura
    - Em sucesso: fechar modal, invalidar query, notificação verde
    - Em erro: exibir mensagem no modal sem fechar
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.1, 11.5_

  - [x] 4.4 Implementar ações de inativar e resetar senha na mesma página
    - Inativar: diálogo de confirmação → PUT → notificação de sucesso ou erro
    - Resetar senha: diálogo de confirmação → PUT → exibir nova senha com CopyButton → invalidar query
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.5_

  - [ ]* 4.5 Escrever teste de propriedade para validação de e-mail
    - **Property 2: Validação de e-mail rejeita formatos inválidos**
    - **Validates: Requirements 3.3**
    - Geradores: `fc.emailAddress()` para e-mails válidos + `fc.string().filter(s => !isValidEmail(s))` para inválidos

- [x] 5. Checkpoint - Verificar página de Representantes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar página de Solicitações de Orçamento
  - [x] 6.1 Criar `src/app/(interna)/portal-representante/solicitacoes-orcamento/page.tsx`
    - Implementar `SolicitacoesOrcamentoPage` como componente `'use client'`
    - Chamar `usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])` no topo
    - Layout: breadcrumb → título → Card com LoadingOverlay → filtros → Table → Pagination
    - Filtros: status (Select), vendedor/representante (Select), nome do cliente (TextInput com debounce), período (DatePickerInput início/fim)
    - Tabela com colunas: Representante, Cliente, Status (Badge colorido por estado), Data de Criação, Ações
    - Paginação enviando `page` e `pageSize` à API
    - Ação "Calcular" em solicitações pendentes: diálogo de confirmação → POST → loading na linha → invalidar query → notificação
    - Desabilitar botão "Calcular" durante processamento; tratar erros via notificação vermelha
    - _Requirements: 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 11.1, 11.2, 11.5, 12.1, 12.2, 12.3_

  - [ ]* 6.2 Escrever teste de propriedade para botões desabilitados durante mutação de calcular
    - **Property 5: Botões desabilitados durante mutações**
    - **Validates: Requirements 8.3, 11.5**
    - Gerador: qualquer mutação em `isPending` → `button.disabled === true`

- [x] 7. Implementar página de Configuração de Comissão
  - [x] 7.1 Criar `src/app/(interna)/portal-representante/configuracao-comissao/page.tsx`
    - Implementar `ConfiguracaoComissaoPage` como componente `'use client'`
    - Chamar `usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])` no topo
    - Layout: breadcrumb → título → Card com LoadingOverlay
    - Exibir critério atual com Radio.Group (3 opções: Entregue, Faturado, Pago, com descrições)
    - Ao selecionar critério diferente e confirmar: PUT → notificação verde em sucesso
    - Em erro: reverter seleção para valor anterior (rollback otimista) + notificação vermelha
    - Usar `useRef` para armazenar `criterioAnterior` antes de disparar mutation
    - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.5, 12.1, 12.3_

  - [ ]* 7.2 Escrever teste de propriedade para rollback de seleção em caso de erro
    - **Property 3: Rollback de seleção de comissão em caso de erro**
    - **Validates: Requirements 9.5**
    - Geradores: `fc.constantFrom('ENTREGUE', 'FATURADO', 'PAGO')` × 2; simular erro na API; verificar que estado reverte ao anterior

- [x] 8. Implementar página de Aprovações de Clientes
  - [x] 8.1 Criar `src/app/(interna)/portal-representante/aprovacoes-cliente/page.tsx`
    - Implementar `AprovacoesClientePage` como componente `'use client'`
    - Chamar `usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])` no topo
    - Layout: breadcrumb → título → Card com LoadingOverlay → Table
    - Tabela com colunas: Representante, Cliente, Tipo de Alteração (Badge/ícone para VINCULACAO vs ALTERACAO_FISCAL), Status, Data da Solicitação, Ações
    - Ação "Ver detalhes" em aprovações pendentes: abrir Modal com comparação lado a lado (Grid com 2 colunas: dados anteriores vs dados novos)
    - Destacar visualmente campos alterados (usar `Highlight` ou estilo diferenciado para valores que diferem)
    - Tratar loading e lista vazia
    - _Requirements: 1.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 12.1, 12.2, 12.3_

  - [ ]* 8.2 Escrever teste de propriedade para destaque de campos alterados
    - **Property 4: Destaque de campos alterados na comparação**
    - **Validates: Requirements 10.5**
    - Geradores: dois `fc.record(fc.string(), fc.string())` para dadosAnteriores/dadosNovos; verificar que campos com valores diferentes recebem highlight e campos iguais não

- [x] 9. Implementar tratamento de erros global do módulo
  - [x] 9.1 Adicionar interceptadores de erro nas páginas do módulo
    - HTTP 400 (empresa não selecionada): redirecionar para `/selecionar-empresa` via `router.replace`
    - HTTP 403 (sem permissão): notificação vermelha "Apenas administradores podem acessar esta funcionalidade"
    - Erros de validação em modal: exibir mensagem inline sem fechar modal
    - Erros fora de modal: notificação vermelha com `err.response.data.message`
    - Garantir que todos os botões de ação ficam desabilitados durante `isPending` de mutations
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 10. Checkpoint - Verificar todas as páginas e tratamento de erros
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Testes de propriedade complementares
  - [ ]* 11.1 Escrever teste de propriedade para renderização completa de dados em tabelas
    - **Property 1: Renderização completa de dados em tabelas**
    - **Validates: Requirements 2.2, 7.2, 10.2**
    - Geradores: `fc.record(...)` para gerar objetos `Representante`, `SolicitacaoOrcamento`, `AprovacaoCliente` aleatórios; verificar que todas as colunas obrigatórias estão presentes no output renderizado

  - [ ]* 11.2 Escrever teste de propriedade para convenção de cores em notificações
    - **Property 6: Notificações seguem convenção de cores**
    - **Validates: Requirements 11.1**
    - Gerador: qualquer mutação + resultado (sucesso/erro); verificar `color: 'green'` para sucesso e `color: 'red'` para erro

- [x] 12. Checkpoint final - Validação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais (testes de propriedade) e podem ser puladas para um MVP mais rápido.
- Cada tarefa referencia os requisitos específicos para rastreabilidade.
- Checkpoints garantem validação incremental.
- Property tests validam as 6 propriedades de corretude definidas no design, utilizando `fc.assert(fc.property(...), { numRuns: 100 })` com fast-check.
- O backend já está implementado — este spec é 100% frontend, consumindo o contrato fixo de `/api/portal-rep/admin/`.
- Todas as páginas devem usar `usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])` no topo do componente para controle de acesso.
- O padrão de tratamento de erros segue o design: HTTP 400 → redirect empresa, HTTP 403 → notificação de permissão, erros em modal → inline sem fechar.
- Componentes Mantine 7 exclusivamente: Table, Modal, Button, TextInput, Select, Badge, Card, LoadingOverlay, Pagination, Radio.Group, CopyButton, ActionIcon, DatePickerInput, Grid, Highlight, Group.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["4.1", "6.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "6.2", "7.2", "8.2"] },
    { "id": 5, "tasks": ["4.5", "9.1"] },
    { "id": 6, "tasks": ["11.1", "11.2"] }
  ]
}
```
