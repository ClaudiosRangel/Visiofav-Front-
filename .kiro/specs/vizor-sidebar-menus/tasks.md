# Tasks

## Task 1: Infraestrutura Base — ThemeProvider e PreferencesProvider
- [x] Criar `src/providers/ThemeProvider.tsx` que wrapa MantineProvider com `colorScheme` dinâmico, lê/salva localStorage(`vizor-theme`), detecta preferência do OS via `matchMedia`, e sincroniza classe `dark` no `<html>`
- [x] Criar `src/providers/PreferencesProvider.tsx` com context para preferências do usuário (tema, idioma, densidade, formatoData, notificações, moduloPadrao, tamanhoFonte)
- [x] Criar `src/hooks/useTheme.ts` com funções `setTheme(mode)`, `currentTheme`, `effectiveTheme` (resolve 'auto')
- [x] Criar `src/hooks/usePreferences.ts` com TanStack Query para GET/PUT `/api/usuarios/me/preferencias`
- [x] Integrar ThemeProvider no layout raiz `src/app/layout.tsx` envolvendo MantineProvider existente
- [x] Adicionar transição CSS global de 200ms em `background-color`, `color`, `border-color` para smooth theme switch
- [x] Adicionar classe `dark` no TailwindCSS config (`darkMode: 'class'`)

## Task 2: Preferências Rápidas — Drawer do Gear Icon (Req 9)
- [x] Criar `src/components/preferences/PreferencesDrawer.tsx` com Mantine Drawer (posição: right)
- [x] Implementar seção Tema: SegmentedControl com opções Claro/Escuro/Auto
- [x] Implementar seção Idioma: Select com pt-BR ativo, en-US e es desabilitados
- [x] Implementar seção Densidade: SegmentedControl (Compacta/Normal/Espaçosa)
- [x] Implementar seção Formato de Data: Radio DD/MM/YYYY e YYYY-MM-DD
- [x] Implementar seção Notificações: 3 switches (sons, push, email)
- [x] Implementar seção Módulo Padrão: Select com módulos do usuário
- [x] Implementar seção Tamanho da Fonte: SegmentedControl (Pequeno 14px / Médio 16px / Grande 18px)
- [x] Implementar seção Atalhos de Teclado: botão que abre modal listando atalhos
- [x] Implementar seção Sobre: versão, build date, link suporte@vizorerp.com.br
- [x] Implementar botão Sair com diálogo de confirmação
- [x] Conectar onClick do IconSettings no `ModulesHeader.tsx` para abrir o drawer
- [x] Persistir todas as alterações no localStorage imediatamente e na API via `usePreferences` hook

## Task 3: Toggle de Tema na Sidebar (Req 10)
- [x] Criar `src/components/preferences/ThemeToggle.tsx` com SegmentedControl (sol/lua/auto) acessível por teclado
- [x] Integrar ThemeToggle no footer da `ModulesSidebar.tsx` (antes do item Suporte)
- [x] Garantir que ThemeToggle e o controle no PreferencesDrawer estejam sincronizados
- [x] Testar dark mode em todos os componentes existentes: sidebar, header, cards, tabelas, modais
- [x] Adicionar classes `dark:` no TailwindCSS para componentes que usam classes hardcoded de cor (bg-white, text-gray-*, border-gray-*)
- [x] Validar que gráficos (se existirem) respeitam o tema

## Task 4: Backend — Rotas de Preferências e Tema
- [x] Criar migration Prisma para modelo `PreferenciaUsuario`
- [x] Criar rota `GET /api/usuarios/me/preferencias` que retorna preferências do usuário autenticado (cria registro com defaults se não existir)
- [x] Criar rota `PUT /api/usuarios/me/preferencias` que atualiza preferências parcialmente (merge)
- [x] Adicionar validação Zod para o body do PUT (tema: enum, idioma: enum, densidade: enum, etc.)
- [x] Testar rotas com autenticação

## Task 5: Navegação da Sidebar — Conectar Menus às Rotas
- [x] Atualizar `ModulesSidebar.tsx`: adicionar onClick/Link nos itens Dashboard, Favoritos, Relatórios, Indicadores que navegam para as rotas correspondentes
- [x] Atualizar `ModulesSidebar.tsx`: expandir sub-itens de Configurações com links para cada sub-página
- [x] Atualizar `ModulesSidebar.tsx`: adicionar onClick nos itens Permissões, Logs, Suporte que navegam para as rotas
- [x] Implementar highlight de item ativo na sidebar baseado no pathname atual
- [x] Ocultar itens Permissões e Logs para perfis OPERADOR/VISUALIZADOR usando hook de perfil existente
- [x] Ocultar sub-itens restritos de Configurações (Multiempresa, Backup, Limpar Dados) para perfis não-admin

## Task 6: Dashboard Executivo — Frontend (Req 1)
- [x] Criar página `src/app/(interna)/dashboard/page.tsx` com layout de grid responsivo
- [x] Criar widgets de KPI (receita, pedidos pendentes, ocupação armazém, OPs atrasadas)
- [x] Criar painel de alertas críticos com badges de severidade
- [x] Criar seção de status dos serviços (API, DB, Workers)
- [x] Implementar filtro de período (SegmentedControl)
- [x] Implementar skeleton loading por widget e error state com retry
- [x] Auto-refresh a cada 60 segundos

## Task 7: Dashboard Executivo — Backend (Req 1)
- [ ] Criar rota `GET /api/dashboard/kpis` que agrega: receita do mês (financeiro), pedidos pendentes (vendas/compras), ocupação armazém (WMS), OPs atrasadas (PCP) — filtrado por período
- [ ] Criar rota `GET /api/dashboard/alertas` que retorna itens em estoque mínimo, NFs rejeitadas, atrasos (max 10 por categoria)
- [ ] Criar rota `GET /api/dashboard/calendario` que retorna eventos de agenda de docas, vencimentos e marcos de produção dos próximos N dias
- [ ] Criar rota `GET /api/dashboard/integracao-status` que retorna health check dos serviços
- [ ] Adicionar validação de permissões por módulo nas respostas (omitir dados de módulos sem acesso)

## Task 8: Favoritos — Frontend (Req 2)
- [x] Criar página `src/app/(interna)/favoritos/page.tsx`
- [x] Criar lista agrupada por módulo com busca
- [x] Implementar remoção de favoritos com confirmação
- [x] Implementar estado vazio com instruções
- [x] Implementar busca com filtro por nome/módulo

## Task 9: Favoritos — Backend (Req 2)
- [ ] Criar migration Prisma para modelo `Favorito`
- [ ] Criar rota `GET /api/favoritos` — lista favoritos do usuário autenticado ordenados por `ordem`
- [ ] Criar rota `POST /api/favoritos` — adiciona favorito (valida limite 20)
- [ ] Criar rota `DELETE /api/favoritos/:id` — remove favorito
- [ ] Criar rota `PUT /api/favoritos/reordenar` — recebe array de IDs na nova ordem
- [ ] Adicionar validação Zod em todas as rotas

## Task 10: Central de Relatórios — Frontend (Req 3)
- [x] Criar página `src/app/(interna)/relatorios/page.tsx` com tabs: Catálogo / Histórico / Agendamentos
- [x] Criar grid de cards com relatórios pré-definidos por módulo
- [x] Implementar botões de exportação (PDF/Excel/CSV) por relatório
- [x] Implementar filtro por módulo no catálogo
- [x] Criar placeholders para Histórico e Agendamentos

## Task 11: Central de Relatórios — Backend (Req 3)
- [ ] Criar migrations Prisma para modelos `Relatorio`, `RelatorioExecucao`, `RelatorioAgendamento`
- [ ] Seed relatórios pré-definidos: Estoque Atual, Movimentações, Vendas por Período, Comissões, Contas a Pagar, Contas a Receber
- [ ] Criar rota `GET /api/relatorios/catalogo` — lista relatórios por módulo com filtros
- [ ] Criar rota `POST /api/relatorios/executar` — gera relatório no formato solicitado (PDF via pdfmake, Excel via exceljs, CSV streaming)
- [ ] Criar rota `GET /api/relatorios/historico` — lista execuções paginadas
- [ ] Criar rota `POST /api/relatorios/agendar` — cria agendamento com validação de destinatários
- [ ] Criar rota `GET /api/relatorios/agendamentos` — lista agendamentos ativos
- [ ] Criar rota `DELETE /api/relatorios/agendamentos/:id`
- [ ] Criar rota `GET /api/relatorios/compartilhar/:token` — acesso público temporário (7 dias)
- [ ] Implementar job de agendamento (cron) para envio automático de relatórios por email

## Task 12: Painel de Indicadores — Frontend (Req 4)
- [x] Criar página `src/app/(interna)/indicadores/page.tsx` com layout por módulo
- [x] Criar KpiCard com valor, meta, progress bar e variação %
- [x] Implementar indicadores WMS (acuracidade, OTIF, tempo picking)
- [x] Implementar indicadores PCP (OEE, aderência)
- [x] Implementar indicadores Vendas (ticket médio, conversão)
- [x] Implementar destaque visual (vermelho) quando KPI < 80% da meta
- [x] Filtrar indicadores por módulos ativos da empresa

## Task 13: Painel de Indicadores — Backend (Req 4)
- [ ] Criar migration Prisma para modelo `IndicadorMeta`
- [ ] Criar rota `GET /api/indicadores` — calcula KPIs de cada módulo ativo para o período solicitado
- [ ] Criar rota `GET /api/indicadores/:id/drilldown` — retorna registros individuais paginados que compõem o KPI
- [ ] Criar rota `PUT /api/indicadores/:id/meta` — atualiza meta (somente ADMIN/SUPER_ADMIN)
- [ ] Implementar cálculos: acuracidade estoque, OTIF, tempo médio picking, OEE, aderência, ticket médio, taxa conversão

## Task 14: Configurações Expandidas — Frontend (Req 5)
- [ ] Criar layout `src/app/(interna)/configuracoes/layout.tsx` com sub-navegação lateral
- [ ] Criar página Dados da Empresa com formulário (razão social, CNPJ, endereço, upload logo)
- [ ] Criar página Parâmetros Gerais (moeda, fuso, formato data, casas decimais)
- [ ] Criar página Módulos Ativos com toggles por módulo
- [ ] Criar página Email/SMTP com formulário e botão "Enviar Email de Teste"
- [ ] Criar página Integrações (API Keys, Webhooks) — reaproveitar `/configurador/integracao`
- [ ] Criar página Backup/Restore com agendamento e lista de pontos de restauração
- [ ] Criar página Notificações com switches por categoria de alerta
- [ ] Criar página Campos Personalizados com CRUD de campos por entidade (limite 20)
- [ ] Condicionar visibilidade de sub-páginas por perfil do usuário

## Task 15: Configurações Expandidas — Backend (Req 5)
- [ ] Criar migrations Prisma para modelos `ConfiguracaoEmpresa` e `CampoPersonalizado`
- [ ] Criar rotas CRUD para `/api/configuracoes/empresa` (GET/PUT + POST logo multipart)
- [ ] Criar rotas para `/api/configuracoes/parametros` (GET/PUT)
- [ ] Criar rotas para `/api/configuracoes/modulos` (GET/PUT — toggle módulos por empresa)
- [ ] Criar rotas para `/api/configuracoes/smtp` (GET/PUT + POST testar — envia email de teste via Nodemailer)
- [ ] Criar rotas para `/api/configuracoes/notificacoes` (GET/PUT)
- [ ] Criar rotas CRUD para `/api/configuracoes/campos-personalizados` (GET/POST/DELETE, limite 20 por entidade)
- [ ] Validar permissão ADMIN/SUPER_ADMIN em todas as rotas de configuração
- [ ] Registrar alterações no LogAuditoria

## Task 16: Permissões Granulares — Frontend (Req 6)
- [x] Criar página `src/app/(interna)/permissoes/page.tsx`
- [x] Criar lista de perfis com descrição
- [x] Criar matriz de permissões módulo × ação com checkboxes
- [x] Implementar SUPER_ADMIN como read-only
- [x] Layout responsivo com grid perfis + matriz

## Task 17: Permissões Granulares — Backend (Req 6)
- [ ] Criar migrations Prisma para modelos `PerfilPermissao` e `UsuarioPermissaoOverride`
- [ ] Seed permissões padrão para cada perfil (SUPER_ADMIN: tudo, VISUALIZADOR: só leitura, etc.)
- [ ] Criar rota `GET /api/permissoes/perfis` — lista perfis
- [ ] Criar rota `GET /api/permissoes/perfis/:id` — retorna matriz completa de permissões do perfil
- [ ] Criar rota `PUT /api/permissoes/perfis/:id` — atualiza permissões (bloquear edição SUPER_ADMIN)
- [ ] Criar rota `GET /api/permissoes/usuarios/:id` — retorna overrides do usuário
- [ ] Criar rota `PUT /api/permissoes/usuarios/:id` — salva overrides
- [ ] Criar rota `GET /api/permissoes/log` — histórico de alterações paginado
- [ ] Criar middleware `requirePermission(modulo, acao)` para proteger rotas existentes
- [ ] Registrar toda alteração de permissão no LogAuditoria

## Task 18: Logs de Auditoria — Frontend (Req 7)
- [x] Criar página `src/app/(interna)/logs/page.tsx` com tabs: Atividades / Sessões / Alterações Críticas
- [x] Criar layout com filtros (módulo, ação)
- [x] Criar placeholder para exportação CSV/Excel
- [x] Implementar estados vazios por tab

## Task 19: Logs de Auditoria — Backend (Req 7)
- [ ] Criar migration Prisma para modelos `LogAuditoria` e `LogRetencao`
- [ ] Criar utility function `registrarLog(usuarioId, acao, modulo, recurso, detalhes, critico)` para uso em todas as rotas
- [ ] Criar rota `GET /api/logs/atividades` — lista paginada com filtros
- [ ] Criar rota `GET /api/logs/sessoes` — lista login/logout com IP e user-agent
- [ ] Criar rota `GET /api/logs/criticos` — lista apenas logs com `critico=true`
- [ ] Criar rota `GET /api/logs/:id/detalhe` — retorna JSON diff completo
- [ ] Criar rota `POST /api/logs/exportar` — gera CSV ou Excel dos logs filtrados (max 10.000)
- [ ] Criar rota `GET /api/logs/retencao` — retorna política atual
- [ ] Criar rota `PUT /api/logs/retencao` — atualiza (somente SUPER_ADMIN)
- [ ] Implementar cron job para limpeza de logs expirados conforme política de retenção
- [ ] Integrar `registrarLog` nas rotas existentes mais críticas (login, CRUD de produtos/estoque/preços/permissões)

## Task 20: Canal de Suporte — Frontend (Req 8)
- [x] Criar página `src/app/(interna)/suporte/page.tsx` com tabs: Meus Tickets / Abrir Ticket / Base de Conhecimento / Status
- [x] Criar formulário de abertura de ticket com validação
- [x] Criar SLA por prioridade
- [x] Criar seção Base de Conhecimento com artigos exemplo
- [x] Criar seção Status dos Serviços

## Task 21: Canal de Suporte — Backend (Req 8)
- [ ] Criar migrations Prisma para modelos `Ticket`, `TicketAnexo`, `TicketMensagem`, `ArtigoKB`, `Changelog`
- [ ] Criar rota `POST /api/suporte/tickets` (multipart) — cria ticket, salva anexos, envia email para suporte@vizorerp.com.br
- [ ] Criar rota `GET /api/suporte/tickets` — lista paginada com filtros (status, prioridade)
- [ ] Criar rota `GET /api/suporte/tickets/:id` — detalhe com mensagens e anexos
- [ ] Criar rota `POST /api/suporte/tickets/:id/mensagens` — adiciona resposta
- [ ] Criar rota `GET /api/suporte/kb` — busca artigos por palavra-chave e módulo
- [ ] Criar rota `GET /api/suporte/changelog` — lista últimas 20 entradas
- [ ] Criar rota `GET /api/suporte/status` — health check de serviços
- [ ] Configurar Nodemailer para envio de emails (usando SMTP configurado em ConfiguracaoEmpresa)
- [ ] Seed artigos KB iniciais e changelog

## Task 22: Finalização — Testes e Integração
- [ ] Verificar que todos os itens da sidebar navegam corretamente
- [ ] Verificar dark mode em todas as novas páginas
- [ ] Verificar responsive design (mobile) em todas as novas páginas
- [ ] Verificar que permissões são enforced no frontend (itens ocultos) e backend (401/403)
- [ ] Verificar que PreferencesDrawer sincroniza corretamente entre dispositivos
- [ ] Verificar exportações (PDF, Excel, CSV) funcionando end-to-end
- [ ] Verificar logs sendo gerados nas operações críticas
- [ ] Verificar que tickets enviam email para suporte@vizorerp.com.br
- [ ] Build sem erros: `npm run build` no frontend
- [ ] Build sem erros: `npm run build` no backend
