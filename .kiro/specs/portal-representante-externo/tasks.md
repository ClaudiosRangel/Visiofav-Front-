# Implementation Plan: Portal do Representante Externo (Frontend PWA)

## Overview

Implementação do portal mobile-first para representantes comerciais externos como route group isolado `src/app/(portal-rep)/` no projeto Next.js existente. O portal usa Mantine 7 com tema verde/branco, consome a API `/api/portal-rep/` já implementada no backend, e funciona como PWA instalável com suporte offline.

A implementação segue a ordem: infraestrutura → layout/auth → hooks de dados → páginas → PWA → testes de propriedade.

## Tasks

- [x] 1. Infraestrutura base (tema, API, tipos, formatadores)
  - [x] 1.1 Criar tema Mantine customizado verde/branco
    - Criar `src/lib/portal-rep-theme.ts` com `createTheme` usando `primaryColor: 'green'`, paleta verde customizada, `defaultRadius: 'md'`, e defaults de componentes (Card com shadow/border, Button com radius md)
    - _Requisitos: 21.1, 21.3, 21.4, 21.5_

  - [x] 1.2 Criar instância Axios dedicada com interceptors de auth
    - Criar `src/data/hooks/portal-rep-app/portal-rep-api.ts` com instância Axios separada (`baseURL` apontando para `/portal-rep`)
    - Implementar interceptor de request que adiciona `Authorization: Bearer {token}` de `localStorage`
    - Implementar interceptor de response que trata 401 (tenta refresh), 403 `SENHA_TEMPORARIA` (redireciona), e limpa tokens ao falhar
    - _Requisitos: 3.3, 3.4, 3.6, 20.3, 20.4_

  - [x] 1.3 Criar arquivo de tipos/interfaces TypeScript
    - Criar `src/data/hooks/portal-rep-app/types.ts` com todas as interfaces: `LoginPayload`, `LoginResponse`, `TrocarSenhaPayload`, `ClienteCarteira`, `CriarClientePayload`, `EditarClientePayload`, `SolicitarAlteracaoFiscalPayload`, `StatusSolicitacao`, `ItemSolicitacao`, `SolicitacaoOrcamento`, `CriarSolicitacaoPayload`, `StatusPedido`, `PedidoPipeline`, `DetalhePipeline`, `ResumoComissao`, `DetalheComissao`, `Notificacao`, `DashboardData`
    - _Requisitos: 3.2, 6.1, 7.1, 9.1, 10.1, 12.1, 14.1, 16.1_

  - [x] 1.4 Criar módulo de formatadores e validadores brasileiros
    - Criar `src/components/portal-rep/formatters.ts` com funções: `formatarData`, `formatarDataHora`, `formatarMoeda`, `formatarCpf`, `formatarCnpj`, `formatarTelefone`, `formatarDocumento`, `validarCpf`, `validarCnpj`
    - Todas as funções seguem o padrão brasileiro (DD/MM/AAAA, R$ X.XXX,XX, máscaras de documento)
    - _Requisitos: 7.2, 25.1, 25.2, 25.3, 25.4_

  - [ ]* 1.5 Testes de propriedade para formatadores e validadores
    - **Propriedade 7: Formatação brasileira — round-trip de padrão**
    - **Propriedade 3: Validação de CPF/CNPJ — dígitos verificadores**
    - **Valida: Requisitos 7.2, 14.4, 25.1, 25.2, 25.3, 25.4**

- [x] 2. Layout e autenticação
  - [x] 2.1 Criar componente BottomNav (navegação mobile)
    - Criar `src/components/portal-rep/BottomNav.tsx` com 5 itens fixos: Dashboard, Clientes, Orçamentos, Pipeline, Mais
    - Item "Mais" abre sheet/menu com seções secundárias (Comissões, Notificações, Perfil)
    - Tap targets ≥ 44px, espaçamento ≥ 8px entre itens
    - Incluir NotificationBadge no ícone de notificações
    - Visível apenas em telas < 768px
    - _Requisitos: 2.1, 2.4, 2.5, 2.7, 2.8, 23.1_

  - [x] 2.2 Criar componente SidebarDesktop (navegação desktop)
    - Criar `src/components/portal-rep/SidebarDesktop.tsx` com links para todas as seções, logotipo no topo, botão "Sair" no rodapé
    - Badge de notificações no item "Notificações"
    - Visível apenas em telas ≥ 768px
    - _Requisitos: 2.2, 2.3, 2.7, 21.2_

  - [x] 2.3 Criar componente NotificationBadge
    - Criar `src/components/portal-rep/NotificationBadge.tsx` com lógica: oculto se 0, número exato se 1-99, "99+" se > 99
    - _Requisitos: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 2.4 Teste de propriedade para NotificationBadge
    - **Propriedade 9: Badge de notificações — lógica de exibição**
    - **Valida: Requisitos 17.1, 17.2, 17.3**

  - [x] 2.5 Criar layout.tsx do route group (portal-rep)
    - Criar `src/app/(portal-rep)/layout.tsx` com auth guard (verifica token em localStorage, redireciona para login se ausente)
    - Detectar `senhaTemporaria` e forçar redirecionamento para `/trocar-senha`
    - Renderizar BottomNav ou SidebarDesktop conforme breakpoint
    - Polling de notificações não-lidas a cada 60s via `usePortalRepNotificacoes`
    - NÃO renderizar nav nas páginas de login e trocar-senha
    - Aplicar `portalRepTheme` via `MantineProvider`
    - Listener de evento `online` para invalidar queries ao reconectar
    - _Requisitos: 1.4, 2.1, 2.2, 3.4, 4.1, 16.6, 20.4, 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 2.6 Criar hook usePortalRepAuth
    - Criar `src/data/hooks/portal-rep-app/usePortalRepAuth.ts` com mutations para login (`POST /auth/login`), refresh (`POST /auth/refresh`), trocar senha (`POST /auth/trocar-senha`), e logout (limpa localStorage)
    - _Requisitos: 3.2, 3.3, 3.5, 4.4_

  - [x] 2.7 Criar página de Login
    - Criar `src/app/(portal-rep)/portal-rep/login/page.tsx` com campos: e-mail, senha, seleção de empresa
    - Tratamento de erros: `CONTA_BLOQUEADA` exibe mensagem específica, credenciais inválidas exibe mensagem genérica
    - Botão desabilitado durante processamento com indicador de loading
    - Redireciona para `/trocar-senha` se `senhaTemporaria === true`, senão para `/dashboard`
    - _Requisitos: 3.1, 3.2, 3.7, 3.8, 3.9, 3.10_

  - [x] 2.8 Criar página de Trocar Senha
    - Criar `src/app/(portal-rep)/portal-rep/trocar-senha/page.tsx` com campos: senha atual, nova senha, confirmação
    - Validação em tempo real: erro quando nova senha ≠ confirmação
    - Redireciona para Dashboard após sucesso, mantém campos preenchidos em caso de erro
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.9 Teste de propriedade para validação de confirmação de senha
    - **Propriedade 4: Validação de confirmação de senha**
    - **Valida: Requisitos 4.3, 18.3**

- [x] 3. Checkpoint — Validar infraestrutura e autenticação
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 4. Hooks de dados
  - [x] 4.1 Criar hook usePortalRepClientes
    - Criar `src/data/hooks/portal-rep-app/usePortalRepClientes.ts` com React Query: `usePortalRepClientes` (GET /clientes), `useCriarCliente` (POST), `useEditarCliente` (PUT /:id), `useSolicitarAlteracaoFiscal` (PUT /:id/campos-fiscais)
    - _Requisitos: 6.1, 7.3, 8.1, 8.5_

  - [x] 4.2 Criar hook usePortalRepOrcamentos
    - Criar `src/data/hooks/portal-rep-app/usePortalRepOrcamentos.ts` com: `usePortalRepOrcamentos` (GET listagem), `usePortalRepOrcamentoDetalhe` (GET /:id), `useCriarSolicitacao` (POST), `useCancelarSolicitacao` (DELETE /:id)
    - _Requisitos: 9.4, 10.1, 10.3, 11.2_

  - [x] 4.3 Criar hook usePortalRepPipeline
    - Criar `src/data/hooks/portal-rep-app/usePortalRepPipeline.ts` com: `usePortalRepPipeline` (GET /pipeline), `usePortalRepPipelineDetalhe` (GET /pipeline/:pedidoVendaId)
    - _Requisitos: 12.1, 13.1_

  - [x] 4.4 Criar hook usePortalRepComissoes
    - Criar `src/data/hooks/portal-rep-app/usePortalRepComissoes.ts` com: `usePortalRepComissoes` (GET /comissoes com parâmetros mes/ano), `usePortalRepComissoesDetalhe` (GET /comissoes/detalhe com filtros)
    - _Requisitos: 14.1, 15.1_

  - [x] 4.5 Criar hook usePortalRepNotificacoes
    - Criar `src/data/hooks/portal-rep-app/usePortalRepNotificacoes.ts` com: `usePortalRepNotificacoes` (GET paginado), `useMarcarLida` (PUT /:id/lida), `useMarcarTodasLidas` (PUT /ler-todas), `useCountNaoLidas` (GET /count-nao-lidas com refetchInterval 60s)
    - _Requisitos: 16.1, 16.3, 16.4, 16.6_

  - [x] 4.6 Criar hook usePortalRepDashboard
    - Criar `src/data/hooks/portal-rep-app/usePortalRepDashboard.ts` que faz 3 queries paralelas: contagem de orçamentos pendentes, resumo do pipeline por status, comissão do mês corrente
    - _Requisitos: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 4.7 Teste de propriedade para interceptor de autenticação
    - **Propriedade 1: Interceptor de autenticação — token sempre presente**
    - **Propriedade 2: Refresh automático em 401**
    - **Valida: Requisitos 3.2, 3.3, 3.4, 3.6, 20.3, 22.3, 22.4**

- [x] 5. Componentes compartilhados
  - [x] 5.1 Criar componente PullToRefresh
    - Criar `src/components/portal-rep/PullToRefresh.tsx` com detecção de gesto touch (threshold ≥ 60px), indicador visual de carregamento, desabilita durante refresh em andamento
    - _Requisitos: 19.1, 19.2, 19.3, 19.4_

  - [x] 5.2 Criar componente PipelineTimeline
    - Criar `src/components/portal-rep/PipelineTimeline.tsx` com timeline horizontal dos 6 estágios (Orçamento → PV → OP → Produção → Expedição → Entregue)
    - Estágio atual: ícone preenchido + cor verde; concluídos: check verde; futuros: cinza
    - Suportar modo compacto para cards mobile e modo completo com datas para tela de detalhe
    - _Requisitos: 12.2, 12.3, 12.6, 13.1_

  - [ ]* 5.3 Teste de propriedade para PipelineTimeline
    - **Propriedade 8: Timeline do pipeline destaca estágio correto**
    - **Valida: Requisitos 12.2, 12.3**

  - [x] 5.4 Criar componentes EmptyState e SkeletonCard
    - Criar `src/components/portal-rep/EmptyState.tsx` com ícone/ilustração + mensagem descritiva
    - Criar `src/components/portal-rep/SkeletonCard.tsx` com skeleton animado para cards
    - _Requisitos: 20.1, 20.6_

- [x] 6. Páginas — Dashboard e Clientes
  - [x] 6.1 Criar página Dashboard
    - Criar `src/app/(portal-rep)/portal-rep/dashboard/page.tsx` com 3 cards de resumo: Orçamentos Pendentes, Pipeline (por status), Comissão do Mês (projetada + realizada)
    - Cards clicáveis navegando para seção correspondente
    - Skeletons individuais durante carregamento paralelo
    - Suportar Pull_to_Refresh
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.2 Criar página Listagem de Clientes
    - Criar `src/app/(portal-rep)/portal-rep/clientes/page.tsx` com lista de clientes (cards em mobile, tabela em desktop)
    - Campo de busca local filtrando por nome, CPF/CNPJ ou cidade (case-insensitive)
    - FAB em mobile / botão no header em desktop para novo cliente
    - Pull_to_Refresh para recarregar
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.3 Teste de propriedade para filtragem local de clientes
    - **Propriedade 5: Filtragem local de clientes**
    - **Valida: Requisitos 6.2**

  - [x] 6.4 Criar página Cadastro de Novo Cliente
    - Criar `src/app/(portal-rep)/portal-rep/clientes/novo/page.tsx` com formulário completo (razão social, nome fantasia, CPF/CNPJ, IE, telefone, e-mail, endereço)
    - Validação de CPF/CNPJ em tempo real (client-side)
    - Auto-preenchimento de endereço por CEP
    - Tratamento de HTTP 409 `DOCUMENTO_EXISTENTE` com opção de solicitar vinculação
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 6.5 Criar página Edição de Cliente
    - Criar `src/app/(portal-rep)/portal-rep/clientes/[id]/page.tsx` com formulário editável
    - Campos complementares editáveis: telefone, e-mail, endereço
    - Campos fiscais somente-leitura com indicação visual + botão "Solicitar alteração fiscal"
    - Formulário separado para solicitação de alteração fiscal
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 7. Páginas — Orçamentos
  - [x] 7.1 Criar página Listagem de Orçamentos
    - Criar `src/app/(portal-rep)/portal-rep/orcamentos/page.tsx` com lista de solicitações: cliente, status (badge colorido), data, qtd itens
    - Filtro por status (PENDENTE, CALCULADO, ENVIADO, ACEITO, RECUSADO)
    - Pull_to_Refresh
    - _Requisitos: 10.1, 10.2, 10.6_

  - [x] 7.2 Criar página Nova Solicitação de Orçamento
    - Criar `src/app/(portal-rep)/portal-rep/orcamentos/novo/page.tsx` com seleção de cliente + lista dinâmica de itens (produto, quantidade, especificação)
    - Validação: ao menos 1 item, quantidade > 0
    - Botão desabilitado durante processamento
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 7.3 Criar página Detalhe de Orçamento
    - Criar `src/app/(portal-rep)/portal-rep/orcamentos/[id]/page.tsx` com itens + preços (quando CALCULADO ou posterior)
    - Ocultar custo/margem — apenas preço de venda
    - Botão "Cancelar" apenas para status PENDENTE com diálogo de confirmação
    - _Requisitos: 10.3, 10.4, 10.5, 10.7, 11.1, 11.2, 11.3, 11.4, 24.1_

  - [ ]* 7.4 Teste de propriedade para ocultação de custos e botão cancelar
    - **Propriedade 6: Campos de custo/margem nunca renderizados**
    - **Propriedade 10: Botão cancelar apenas para solicitações PENDENTE**
    - **Valida: Requisitos 10.5, 10.7, 11.3, 13.4, 24.1, 24.2, 24.3**

- [x] 8. Checkpoint — Validar páginas de clientes e orçamentos
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 9. Páginas — Pipeline e Comissões
  - [x] 9.1 Criar página Listagem do Pipeline
    - Criar `src/app/(portal-rep)/portal-rep/pipeline/page.tsx` com lista de pedidos + timeline compacta por pedido
    - Filtros por status, cliente, período
    - Cards em mobile com PipelineTimeline compacta
    - Pull_to_Refresh
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 9.2 Criar página Detalhe do Pipeline
    - Criar `src/app/(portal-rep)/portal-rep/pipeline/[id]/page.tsx` com timeline completa + datas de transição
    - Barra de progresso de produção quando status = PRODUCAO
    - Informações do pedido: cliente, produtos, quantidade, data criação, previsão entrega
    - Ocultar custo/margem
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 24.1_

  - [x] 9.3 Criar página de Comissões (resumo + detalhamento)
    - Criar `src/app/(portal-rep)/portal-rep/comissoes/page.tsx` com card de resumo mensal (projetada + realizada)
    - Navegação entre meses (anterior/próximo)
    - Seção de detalhamento por pedido: número, cliente, valor venda, % comissão, valor comissão
    - Filtros por período e cliente
    - Totalizador no rodapé com soma
    - Formatação monetária brasileira
    - Pull_to_Refresh
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2, 15.3, 15.4, 15.5, 24.2_

- [x] 10. Páginas — Notificações e Perfil
  - [x] 10.1 Criar página de Notificações
    - Criar `src/app/(portal-rep)/portal-rep/notificacoes/page.tsx` com lista paginada: título, mensagem, data, indicador lida/não-lida
    - Diferenciação visual entre lidas e não-lidas
    - Marcar como lida ao tocar + atualizar badge global
    - Botão "Marcar todas como lidas"
    - Scroll infinito ou "Carregar mais" para paginação
    - Pull_to_Refresh
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_

  - [x] 10.2 Criar página de Perfil
    - Criar `src/app/(portal-rep)/portal-rep/perfil/page.tsx` com dados somente-leitura (nome, e-mail, empresa)
    - Formulário de alteração de senha (senha atual, nova, confirmação) com validação em tempo real
    - Botão "Sair" com mesma ação de logout
    - _Requisitos: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 11. Checkpoint — Validar todas as páginas funcionais
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 12. PWA — Manifesto e Service Worker
  - [x] 12.1 Criar manifesto PWA e configurar service worker
    - Criar `public/manifest-portal-rep.json` com name, short_name, start_url (`/portal-rep/dashboard`), display standalone, theme_color verde, ícones 192px e 512px
    - Configurar `next-pwa` no `next.config.js` para precache do shell (HTML, CSS, JS, fontes, ícones)
    - Runtime cache network-first para API calls
    - Fallback offline: shell com mensagem "Sem conexão"
    - Incluir link do manifesto no layout.tsx do portal
    - _Requisitos: 1.1, 1.2, 1.3, 1.5_

  - [x] 12.2 Implementar detecção de reconexão e prompt de instalação
    - Detectar evento `online` para invalidar queries automaticamente (recarregar dados da tela ativa)
    - Listener de `beforeinstallprompt` para exibir prompt nativo de instalação quando disponível
    - Exibir banner informativo quando offline
    - _Requisitos: 1.4, 1.5, 20.2_

- [x] 13. Gestos e interações touch-friendly
  - [x] 13.1 Implementar gestos e posicionamento de ações
    - Garantir transições visuais (hover/active) em todos os elementos tocáveis
    - Posicionar FABs e botões de submissão na metade inferior da tela em mobile
    - Implementar swipe-to-action ou menu de contexto (long-press) para ações secundárias em listas (ex: cancelar orçamento)
    - _Requisitos: 23.2, 23.3, 23.4_

- [x] 14. Checkpoint final — Garantir integridade completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e edge cases
- O portal é completamente isolado do ERP — nenhum componente compartilhado além do RootLayout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.5", "2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "5.1", "5.2", "5.4"] },
    { "id": 3, "tasks": ["2.7", "2.8", "2.9", "5.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 5, "tasks": ["4.7", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "9.1", "9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1", "10.2"] },
    { "id": 10, "tasks": ["12.1", "13.1"] },
    { "id": 11, "tasks": ["12.2"] }
  ]
}
```
