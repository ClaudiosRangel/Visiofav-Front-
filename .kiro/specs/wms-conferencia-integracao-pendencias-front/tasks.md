# Implementation Plan: Conferência, Integração e Pendências (Frontend)

## Overview

Implementação frontend das telas de configuração de integração, configuração de e-mail fiscal, reformulação do bloqueio de conferência no ProdutoModal, e listagem/resolução de pendências CC-e. Abordagem incremental: primeiro hooks de dados, depois componentes de seção isolados, integração na página existente, e por fim a nova página de pendências com item de menu.

## Tasks

- [ ] 1. Criar React Query hooks para as novas funcionalidades
  - [ ] 1.1 Criar hook useConfigIntegracao
    - Criar `src/data/hooks/useConfigIntegracao.ts`
    - Implementar `useConfigIntegracao()` com `useQuery` — GET `/api/config-integracao`, staleTime 5min
    - Implementar `useSalvarConfigIntegracao()` com `useMutation` — POST `/api/config-integracao`, invalidar queryKey no onSuccess
    - Interface `ConfigIntegracao { integracaoAtiva: boolean; sistemaExterno: string | null }`
    - Seguir padrão existente em `useNotaEntrada.ts`
    - _Requirements: 1.4, 1.5, 1.7_

  - [ ] 1.2 Criar hook useConfigEmailFiscal
    - Criar `src/data/hooks/useConfigEmailFiscal.ts`
    - Implementar `useConfigEmailFiscal()` com `useQuery` — GET `/api/config-email-fiscal`, staleTime 5min
    - Implementar `useSalvarConfigEmailFiscal()` com `useMutation` — POST `/api/config-email-fiscal`, invalidar queryKey no onSuccess
    - Interface `ConfigEmailFiscal { email: string }`
    - _Requirements: 2.3, 2.4, 2.6_

  - [ ] 1.3 Criar hook usePendenciasCce
    - Criar `src/data/hooks/usePendenciasCce.ts`
    - Implementar `usePendenciasCce(filtros?)` com `useQuery` — GET `/api/pendencias-cce` com params, staleTime 30s
    - Implementar `useResolverPendencia()` com `useMutation` — PATCH `/api/pendencias-cce/:id/resolver`, invalidar queryKey no onSuccess
    - Interface `PendenciaCce { id, fornecedor, notaFiscal, criadoEm, codigoProduto, descricaoProduto, motivo, status }`
    - Interface `FiltrosPendencia { fornecedor?, dataInicial?, dataFinal?, status? }`
    - _Requirements: 4.5, 4.6, 5.3, 5.5, 5.6_

- [ ] 2. Criar componente IntegracaoSection e adicionar na página de conferência
  - [ ] 2.1 Implementar IntegracaoSection
    - Criar `src/app/(interna)/configurador/conferencia/IntegracaoSection.tsx`
    - Renderizar Card com título "Integração com Sistema Externo", ícone IconPlugConnected
    - Switch para `integracaoAtiva`, TextInput para `sistemaExterno` (maxLength=100)
    - Desabilitar TextInput quando Switch=false
    - Botão "Salvar" que chama `useSalvarConfigIntegracao().mutate()`
    - Carregar config existente via `useConfigIntegracao()` e preencher formulário ao montar
    - Exibir `notifications.show` com color green (sucesso) ou red (erro da API)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.2 Escrever testes do IntegracaoSection
    - Criar `src/app/(interna)/configurador/conferencia/__tests__/IntegracaoSection.test.tsx`
    - Testar renderização com dados carregados da API
    - Testar que TextInput fica disabled quando Switch=false
    - Testar notificação de sucesso após salvar
    - Testar notificação de erro quando API retorna 422
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

- [ ] 3. Criar componente EmailFiscalSection e adicionar na página de conferência
  - [ ] 3.1 Implementar EmailFiscalSection
    - Criar `src/app/(interna)/configurador/conferencia/EmailFiscalSection.tsx`
    - Renderizar Card com título "E-mail do Setor Fiscal", ícone IconMail
    - TextInput para `email` (maxLength=254)
    - Botão "Salvar" que chama `useSalvarConfigEmailFiscal().mutate()`
    - Carregar config existente via `useConfigEmailFiscal()` e preencher ao montar
    - Exibir `notifications.show` com color green (sucesso) ou red (erro da API)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Escrever testes do EmailFiscalSection
    - Criar `src/app/(interna)/configurador/conferencia/__tests__/EmailFiscalSection.test.tsx`
    - Testar renderização com dados carregados
    - Testar notificação de sucesso após salvar
    - Testar preservação do valor quando API retorna 422
    - _Requirements: 2.1, 2.4, 2.5_

- [ ] 4. Modificar página de conferência para incluir novas seções
  - [ ] 4.1 Integrar IntegracaoSection e EmailFiscalSection na page.tsx
    - Modificar `src/app/(interna)/configurador/conferencia/page.tsx`
    - Importar e renderizar `<IntegracaoSection />` após as seções existentes de switches
    - Importar e renderizar `<EmailFiscalSection />` após IntegracaoSection
    - Manter layout existente e Stack/spacing consistente
    - _Requirements: 1.1, 2.1_

- [ ] 5. Checkpoint — Validar seções de configuração
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Criar utilitário mapearModosBloqueio e componente BloqueioConferenciaSection
  - [ ] 6.1 Criar mapearModosBloqueio.ts
    - Criar `src/lib/mapearModosBloqueio.ts`
    - Implementar função que recebe objeto produto e retorna `{ aceitarSenha: boolean, aceitarCcePendente: boolean }`
    - Se produto já tem campos booleanos (`typeof produto.aceitarSenha === 'boolean'`), retornar diretamente
    - Mapeamento legado: ACEITAR_SENHA → aceitarSenha=true; ACEITAR_CCE → aceitarCcePendente=true; BLOQUEAR e ACEITAR_LIVRE → ambos false
    - _Requirements: 3.6_

  - [ ]* 6.2 Escrever property test para mapearModosBloqueio
    - **Property 1: Mapeamento de modos legados para booleanos**
    - Criar `src/lib/__tests__/mapearModosBloqueio.test.ts` usando vitest + fast-check
    - Para qualquer combinação de `modoResolucaoLote` e `modoResolucaoValidade` em {BLOQUEAR, ACEITAR_LIVRE, ACEITAR_SENHA, ACEITAR_CCE}: aceitarSenha=true iff pelo menos um modo é ACEITAR_SENHA; aceitarCcePendente=true iff pelo menos um modo é ACEITAR_CCE
    - **Validates: Requirements 3.6**

  - [ ] 6.3 Implementar BloqueioConferenciaSection
    - Criar `src/app/(interna)/configurador/produtos/BloqueioConferenciaSection.tsx`
    - Receber prop `control: Control<any>` do react-hook-form
    - Renderizar dois Checkboxes via Controller: "Aceitar com senha supervisor" (campo `aceitarSenha`) e "Aceitar com CCE Automática ou Pendente" (campo `aceitarCcePendente`)
    - Exibir texto descritivo quando ambos desmarcados: "Bloqueio total — reconferência obrigatória"
    - Ambas opções podem ser marcadas simultânea ou individualmente
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [ ]* 6.4 Escrever testes do BloqueioConferenciaSection
    - Criar `src/app/(interna)/configurador/produtos/__tests__/BloqueioConferenciaSection.test.tsx`
    - Testar que ambos checkboxes são renderizados
    - Testar exibição de texto descritivo quando ambos desmarcados
    - Testar combinações de marcação individual e simultânea
    - _Requirements: 3.2, 3.4, 3.7_

- [ ] 7. Modificar ProdutoModal para usar BloqueioConferenciaSection
  - [ ] 7.1 Substituir Selects de divergência por BloqueioConferenciaSection
    - Modificar `src/app/(interna)/configurador/produtos/ProdutoModal.tsx`
    - Remover Selects de "Divergência de Lote" e "Divergência de Validade"
    - Importar e renderizar `<BloqueioConferenciaSection control={control} />` na aba "Dados Gerais"
    - Usar `mapearModosBloqueio()` para preencher defaultValues ao abrir em modo edição
    - Enviar campos `aceitarSenha` e `aceitarCcePendente` no body da requisição de criação/atualização
    - _Requirements: 3.1, 3.5, 3.6_

- [ ] 8. Checkpoint — Validar bloqueio de conferência no ProdutoModal
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Criar página de Pendências CC-e
  - [ ] 9.1 Implementar página /wms/pendencias-cce
    - Criar `src/app/(interna)/wms/pendencias-cce/page.tsx`
    - Renderizar título "Pendências CC-e" e área de filtros (TextInput fornecedor, DateInput data inicial/final, Select status com opções Pendente/CCE Emitida/Resolvida)
    - Renderizar tabela com colunas: Fornecedor, Nota Fiscal, Data Criação (dd/MM/yyyy), Produto, Motivo, Status (Badge colorido), Ações
    - Mapeamento de cores de Badge: AGUARDANDO_CCE → orange, RESOLVIDA → green, CANCELADA → blue
    - Ordenação padrão por data de criação decrescente
    - Empty state: "Nenhuma pendência encontrada" quando lista vazia
    - Usar `usePendenciasCce(filtros)` para carregar dados
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 9.2 Implementar ações de resolução e cancelamento
    - Renderizar botões "Resolver" e "Cancelar" apenas para pendências com status AGUARDANDO_CCE
    - Não exibir botões para status RESOLVIDA ou CANCELADA
    - Ao clicar "Resolver": abrir `modals.openConfirmModal` com título "Resolver Pendência", mensagem "Confirma a resolução desta pendência?" e botões "Confirmar"/"Cancelar"
    - Ao confirmar: chamar `useResolverPendencia().mutate({ id, status: 'RESOLVIDA' })`
    - Ao clicar "Cancelar" da pendência: abrir confirm modal com título "Cancelar Pendência", mensagem "Confirma o cancelamento desta pendência?"
    - Ao confirmar cancelamento: chamar `useResolverPendencia().mutate({ id, status: 'CANCELADA' })`
    - Exibir notificação verde no sucesso, vermelha no erro (404 ou 409)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 9.3 Escrever testes da página de pendências
    - Criar `src/app/(interna)/wms/pendencias-cce/__tests__/page.test.tsx`
    - Testar renderização da tabela com dados mockados
    - Testar empty state quando lista vazia
    - Testar cores de badge por status
    - Testar visibilidade condicional de botões de ação (apenas para AGUARDANDO_CCE)
    - Testar abertura de confirm modal ao clicar resolver/cancelar
    - **Property 2: Badge de status exibe cor correta**
    - **Property 3: Botões de ação condicionais por status**
    - **Validates: Requirements 4.7, 4.8, 5.1, 5.8**

- [ ] 10. Adicionar item de menu "Pendências" no sidebar
  - [ ] 10.1 Adicionar link no ModuleSidebar
    - Modificar `src/components/layout/ModuleSidebar.tsx`
    - Adicionar item `{ icon: IconAlertCircle, label: 'Pendências CC-e', href: '/wms/pendencias-cce' }` no grupo "Recebimento" do módulo WMS (após "Endereçamento")
    - Importar `IconAlertCircle` de `@tabler/icons-react`
    - _Requirements: 4.1_

- [ ] 11. Final checkpoint — Validar todas as funcionalidades e integração
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate correctness properties from the design document (mapearModosBloqueio, badge colors, action visibility)
- O frontend é 100% TypeScript, usando Next.js 15 App Router + Mantine 7 + TanStack React Query + Axios
- fast-check já está disponível no projeto para property-based testing (vitest + fast-check)
- O backend já está implementado — esta spec cobre apenas a camada de apresentação e integração via hooks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "6.2", "6.3"] },
    { "id": 3, "tasks": ["4.1", "6.4", "7.1"] },
    { "id": 4, "tasks": ["9.1", "10.1"] },
    { "id": 5, "tasks": ["9.2"] },
    { "id": 6, "tasks": ["9.3"] }
  ]
}
```
