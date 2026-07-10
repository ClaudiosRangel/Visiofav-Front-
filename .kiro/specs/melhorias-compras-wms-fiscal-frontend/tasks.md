# Implementation Plan: Melhorias Compras, WMS e Fiscal (Frontend)

## Overview

Este plano implementa a interface de usuário para as cinco melhorias de Compras, WMS e Fiscal cujo backend (`VisioFab.Wms.Back`, spec `melhorias-compras-wms-fiscal`) já está em produção. Nenhum novo endpoint é criado — o trabalho é de composição de páginas existentes, funções puras de decisão de UI e duas novas páginas (Seed Fiscal, Kardex). A abordagem segue a ordem do design: primeiro as funções puras testáveis (utils/hooks), depois a integração visual em cada página, com checkpoints entre blocos.

Linguagem de implementação: TypeScript (Next.js 15 App Router + Mantine 7 + `@tanstack/react-query` + Axios), conforme já usado no projeto. Biblioteca de PBT: **fast-check** (já presente em `devDependencies`), mínimo de 100 iterações por teste de propriedade.

## Tasks

- [x] 1. Requirement 1 — Transporte via XML: funções puras e exibição na Agenda/Portaria/Nota
  - [x] 1.1 Implementar src/utils/transporteWms.ts
    - Criar `deveExibirAlertaDivergencia(divergenciaTransporte: string | null | undefined): boolean` (retorna `true` se e somente se o valor, após `trim()`, tem comprimento maior que zero)
    - Criar `deveExibirCampoTransporte(valor: string | null | undefined): boolean` (mesma lógica, usada para `transportadoraUf`/`transportadoraRntc`)
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 1.8_

  - [x]* 1.2 Write property test for indicador de alerta de divergência
    - **Property 1: Indicador de alerta de divergência de transporte depende exclusivamente do conteúdo do campo**
    - **Validates: Requirements 1.3, 1.4, 1.6**

  - [x]* 1.3 Write property test for exibição independente dos campos de transporte da Nota_Entrada
    - **Property 2: Exibição de cada campo de transporte da Nota_Entrada é decidida de forma independente**
    - **Validates: Requirements 1.7, 1.8**

  - [x] 1.4 Integrar indicador de divergência na Tela_Portaria
    - Em `src/app/(interna)/wms/portaria/page.tsx`, na função `renderAgendamentoRow`, adicionar `Tooltip` com `IconAlertTriangle` na célula de motorista/placa, exibido quando `deveExibirAlertaDivergencia(ag.divergenciaTransporte)` é `true`, com o texto completo de `ag.divergenciaTransporte` no `label` do `Tooltip`
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

  - [x] 1.5 Integrar indicador de divergência na Tela_Agenda_WMS
    - Em `src/app/(interna)/wms/agenda/page.tsx`, aplicar a mesma marcação (`Tooltip` + `IconAlertTriangle`) na célula de motorista/placa da tabela de agendamentos por doca
    - _Requirements: 1.2, 1.4, 1.5, 1.6_

  - [x] 1.6 Exibir transportadoraUf/transportadoraRntc na Tela_Nota_Entrada
    - Em `src/app/(interna)/recebimento/NotaDetalheModal.tsx`, adicionar no cabeçalho do modal os campos "UF Transporte" e "RNTC", cada um exibido individualmente quando `deveExibirCampoTransporte` retorna `true` para o respectivo campo (`nota.transportadoraUf`/`nota.transportadoraRntc`)
    - _Requirements: 1.7, 1.8_

- [x] 2. Checkpoint — Validar Requirement 1
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Requirement 2 e 3 — Código sequencial de Produto, alerta de SKU e itens pendentes de XML
  - [x] 3.1 Implementar src/utils/produtoSku.ts
    - Criar `deveExibirAlertaEnriquecimentoSku(motivo: string | null | undefined): boolean` (mesma lógica de trim/comprimento de `transporteWms.ts`)
    - Criar interface `ItemPendenteXml { cProd: string; xProd: string; motivo: string }`
    - Criar `deveExibirSecaoItensPendentes(itensPendentes: ItemPendenteXml[] | null | undefined): boolean` (retorna `true` se e somente se o valor é um array com ao menos um elemento)
    - _Requirements: 2.2, 2.3, 2.5, 3.1, 3.2_

  - [x]* 3.2 Write property test for alerta de enriquecimento de SKU
    - **Property 3: Alerta de falha de enriquecimento de SKU depende exclusivamente do conteúdo de `motivoFalhaEnriquecimentoSku`**
    - **Validates: Requirements 2.2, 2.3, 2.5**

  - [x]* 3.3 Write property test for seção de itens pendentes
    - **Property 4: Seção de itens pendentes é exibida se e somente se o array recebido não é vazio, preservando seu conteúdo**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.4 Exibir alerta de enriquecimento de SKU no ProdutoModal
    - Em `src/app/(interna)/configurador/produtos/ProdutoModal.tsx`, no cabeçalho fixo (antes do componente `<Tabs>`), adicionar um `Alert` (ícone `IconAlertCircle`, cor `orange`) exibido quando `deveExibirAlertaEnriquecimentoSku(produtoCompleto?.motivoFalhaEnriquecimentoSku)` é `true`, com o texto do motivo e indicação para verificar a aba "Estoque / Lotes"
    - Confirmar que o alerta é recalculado a partir do `produtoCompleto` já buscado via `useQuery` existente (`staleTime: 0`), permanecendo visível ao alternar abas e ao reabrir o modal
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 3.5 Confirmar exibição do código sequencial sem alteração de comportamento
    - Verificar que o campo `codigo` na aba "Dados Gerais" do `ProdutoModal.tsx` mantém o rótulo "Código" e o comportamento de edição já existentes, sem nenhuma mudança de texto ou de lógica de formulário
    - _Requirements: 2.1_

  - [x] 3.6 Exibir seção de itens pendentes na Tela_Importar_XML
    - Em `src/app/(interna)/compras/importar-xml/page.tsx`, na etapa de resultado (`step === 2`), adicionar um `Alert` (ícone `IconAlertCircle`, cor `orange`, título "Itens pendentes de resolução manual") com uma `Table` listando `cProd`/`xProd`/`motivo` de cada item de `resultado.itensPendentes`, exibido quando `deveExibirSecaoItensPendentes(resultado.itensPendentes)` é `true`
    - Incluir texto informando que os itens listados não foram incluídos no pedido de compra criado e necessitam de resolução manual
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint — Validar Requirements 2 e 3
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Requirement 4, 5 e 6 — Tela de Seed Fiscal
  - [x] 5.1 Implementar hook e funções puras useSeedFiscal.ts
    - Criar `src/data/hooks/fiscal/useSeedFiscal.ts` com tipos `CadastroFiscal`, `ContagemSeedFiscal`, `ResultadoTabela`, `RespostaSeedFiscal`
    - Implementar `useContagemSeedFiscal()` (`GET /fiscal/cadastros/seed/contagem`) e `useDispararSeedFiscal()` (`POST /fiscal/cadastros/seed`)
    - Implementar `montarTabelasSeedPayload(selecionados: Set<CadastroFiscal>)`, `botaoSeedHabilitado(selecionados)`, `classificarResultadoSeedPorTabela(resultado)`, `deveExibirDadosParciaisSeed(status)`, `deveExibirLinkSeedFiscal(perfil)`
    - _Requirements: 4.1, 4.4, 5.1, 5.2, 5.4, 5.5, 5.7, 6.3_

  - [x]* 5.2 Write property test for payload do seed
    - **Property 5: Payload do seed reflete exatamente o conjunto de tabelas selecionado**
    - **Validates: Requirements 4.4, 5.2**

  - [x]* 5.3 Write property test for habilitação do botão de disparo
    - **Property 6: Botão de disparo do seed é habilitado se e somente se ao menos uma tabela está selecionada**
    - **Validates: Requirements 5.1**

  - [x]* 5.4 Write property test for classificação do resultado por tabela
    - **Property 7: Classificação do resultado do seed por tabela é independente e determinística**
    - **Validates: Requirements 5.4, 5.5**

  - [x]* 5.5 Write property test for dados parciais em 403
    - **Property 8: Dados parciais do seed nunca são exibidos quando a API retorna 403**
    - **Validates: Requirements 5.7**

  - [x]* 5.6 Write property test for visibilidade do link de navegação
    - **Property 9: Link de navegação do Seed Fiscal é visível apenas para perfis administrativos**
    - **Validates: Requirements 6.3**

  - [x] 5.7 Implementar página /configuracoes/fiscal/seed
    - Criar `src/app/(interna)/configuracoes/fiscal/seed/page.tsx` com `usePerfilGuard('ADMIN')`, três checkboxes independentes (NCM/CFOP/CEST), cards de contagem com estado de carregamento e estado vazio em caso de erro
    - Disparar notificação de erro de contagem somente em um `useEffect` após `isLoading` virar `false` (não durante o carregamento)
    - Botão de disparo desabilitado enquanto `botaoSeedHabilitado(selecionados)` é `false`, e completamente desabilitado durante requisição pendente (loading state)
    - Ao concluir o disparo com sucesso (independentemente da quantidade de tabelas retornadas), exibir notificação por tabela via `classificarResultadoSeedPorTabela`, limpar notificação de erro de contagem anterior e refazer a busca de contagem
    - Tratar erro 403 de `GET`/`POST` com notificação de acesso negado, sem exibir contagens/resultados parciais (`deveExibirDadosParciaisSeed`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 5.8 Adicionar item de menu "Seed Fiscal" em Configurações
    - Em `src/components/modules/ModulesSidebar.tsx`, dentro do `Collapse` de "Configurações", adicionar `SidebarItem` para `/configuracoes/fiscal/seed`, renderizado apenas quando `deveExibirLinkSeedFiscal(perfil)` é `true`
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Checkpoint — Validar Requirements 4, 5 e 6
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Requirement 7, 8 e 9 — Tela de Kardex
  - [x] 7.1 Implementar hook e funções puras useKardex.ts
    - Criar `src/data/hooks/useKardex.ts` com tipos `TipoMovimentacaoEstoque`, `MovimentacaoEstoque`, `SaldoProduto` e a tabela fixa `TIPO_LABELS`
    - Implementar `traduzirTipoMovimentacao(tipo)`, `montarParametrosKardex(dataInicio, dataFim)`, `deveExibirEstadoVazioKardex(lista, ocorreuErro)`, `deveExibirEstadoFalhaKardex(ocorreuErro)`, `deveManterHistoricoAoFalharSaldo(saldoTeveErro, historicoTemDados)`
    - Implementar `useKardexProduto(produtoId, filtros)` (`GET /estoque/kardex/:produtoId`) e `useSaldoProduto(produtoId)` (`GET /estoque/saldo/:produtoId`)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.3_

  - [x]* 7.2 Write property test for tradução de tipo de movimentação
    - **Property 10: Tradução de tipo de movimentação é total e determinística**
    - **Validates: Requirements 7.2**

  - [x]* 7.3 Write property test for parâmetros de filtro
    - **Property 11: Parâmetros de filtro do Kardex refletem exatamente as datas preenchidas**
    - **Validates: Requirements 7.3**

  - [x]* 7.4 Write property test for estado vazio e estado de falha
    - **Property 12: Estado vazio e estado de falha do Kardex são mutuamente exclusivos e corretamente determinados**
    - **Validates: Requirements 7.5, 7.6**

  - [x]* 7.5 Write property test for independência entre saldo e histórico
    - **Property 13: Falha na consulta de saldo nunca oculta o histórico já carregado**
    - **Validates: Requirements 8.3**

  - [x] 7.6 Implementar hook useEmpresaAtual.ts
    - Criar `src/hooks/useEmpresaAtual.ts` com `useEmpresaAtual()` (`GET /empresas/minha`, expõe `usaWms`)
    - Implementar `deveExibirLinkKardex(usaWms)` e `deveRedirecionarKardex(usaWms, avisoDispensado)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 7.7 Write property test for visibilidade do link do Kardex
    - **Property 14: Visibilidade do link de navegação do Kardex depende exclusivamente de `usaWms`**
    - **Validates: Requirements 9.1, 9.2**

  - [x]* 7.8 Write property test for redirecionamento do Kardex
    - **Property 15: Redirecionamento por acesso direto ao Kardex é a conjunção exata de `usaWms` e aviso não dispensado**
    - **Validates: Requirements 9.3, 9.4**

  - [x] 7.9 Implementar página /estoque/kardex
    - Criar `src/app/(interna)/estoque/kardex/page.tsx` com seletor de produto, `DateInput` de `dataInicio`/`dataFim`, card de saldo atual e tabela de histórico
    - Guarda de visibilidade: ao carregar, se `deveRedirecionarKardex(usaWms, avisoDispensado)` (com `avisoDispensado` lido de `localStorage['visiofab-wms-kardex-aviso-dispensado']`), redirecionar para `/estoque` com notificação; oferecer opção de dispensar permanentemente o aviso, persistindo em `localStorage`
    - Tabela de histórico traduzida via `traduzirTipoMovimentacao`, refazendo busca ao alterar filtros de data; exibir mensagem de "nenhuma movimentação encontrada" quando `deveExibirEstadoVazioKardex` é `true`, e mensagem distinta de "falha ao carregar histórico" quando `deveExibirEstadoFalhaKardex` é `true`
    - Card de saldo atualizado a cada seleção/atualização de produto; notificação de erro (com fallback de `console.error` se a notificação falhar) quando a consulta de saldo falhar, sem afetar a exibição do histórico já carregado
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 9.3, 9.4_

  - [x] 7.10 Adicionar item de menu "Kardex" no módulo WMS
    - Em `src/components/layout/ModuleSidebar.tsx`, dentro do grupo "Estoque" do módulo `wms`, adicionar item para `/estoque/kardex`, renderizado condicionalmente por `deveExibirLinkKardex(usaWms)`
    - _Requirements: 9.1, 9.2_

- [x] 8. Checkpoint — Validar Requirements 7, 8 e 9
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Requirement 10 e 11 — Autorizar Entrada com senha de Supervisor na Portaria
  - [x] 9.1 Implementar decidirAcaoAutorizarEntrada e hook useAutorizarEntrada
    - Criar `src/hooks/useAutorizarEntrada.ts` com a função pura `decidirAcaoAutorizarEntrada(status, tinhaCredenciais): 'SUCESSO' | 'ABRIR_MODAL_CREDENCIAIS' | 'ERRO_CREDENCIAIS_INVALIDAS' | 'ERRO_GENERICO'`
    - Implementar `useAutorizarEntrada(options)` expondo `autorizar(agId)`, `confirmarComCredenciais(credenciais)`, `modalAberto`, `fecharModal`, `isPending`, reutilizável pelos dois call-sites da Tela_Portaria
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1_

  - [x]* 9.2 Write property test for decisão de ação por status HTTP
    - **Property 16: Decisão de ação do fluxo Autorizar Entrada cobre todo o espaço de status HTTP sem sobreposição**
    - **Validates: Requirements 10.2, 10.4, 10.5, 11.1**

  - [x] 9.3 Integrar useAutorizarEntrada na Tela_Portaria
    - Em `src/app/(interna)/wms/portaria/page.tsx`, substituir a mutation local `autorizarEntrada` pelo hook `useAutorizarEntrada`, com `onInvalidateQueries` invalidando `['portaria-agendamentos']`
    - Aplicar `autorizar(ag.id)` no call-site da ação rápida da tabela e `autorizar(validacao.agendamentoId)` no call-site do botão de resultado de busca por placa, ambos usando o mesmo `isPending` para o estado de carregamento
    - Renderizar `ModalSenhaSupervisor` (já existente, sem alteração) controlado por `modalAberto`/`fecharModal`/`confirmarComCredenciais`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2_

  - [x]* 9.4 Write unit tests for fluxo completo de autorizar entrada
    - Testar primeira tentativa sem credenciais (sucesso direto), abertura do modal em 422, reenvio com credenciais válidas (sucesso), reenvio com credenciais inválidas (401, modal permanece aberto), erro genérico (404/500, modal não abre) e cancelamento do modal (nenhum reenvio)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2_

- [x] 10. Checkpoint final — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (fast-check, mínimo 100 iterações)
- Unit tests validate specific examples and edge cases
- Nenhuma alteração de backend é necessária — todos os endpoints e campos consumidos por este plano já existem em produção
- `usePerfilGuard`, `useModuloGuard` e `ModalSenhaSupervisor` são reaproveitados sem alteração

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "5.1", "7.1", "9.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2", "3.3", "5.2", "5.3", "5.4", "5.5", "5.6", "7.2", "7.3", "7.4", "7.5", "7.6", "9.2"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "3.4", "3.5", "3.6", "5.7", "7.7", "7.8", "9.3"] },
    { "id": 3, "tasks": ["2", "4", "5.8", "7.9", "9.4"] },
    { "id": 4, "tasks": ["6", "7.10"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["10"] }
  ]
}
```
