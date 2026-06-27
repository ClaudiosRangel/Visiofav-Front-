# Design Document

## Overview

Este documento descreve a arquitetura técnica para implementação dos 10 menus/funcionalidades do Vizor ERP. O design segue a stack existente: Next.js 15 App Router (frontend), Fastify + Prisma 6 + PostgreSQL (backend), Mantine 7 (UI), @tanstack/react-query (state/cache), @dnd-kit (drag-and-drop) e TailwindCSS (utilities).

## Architecture

### Frontend (Next.js 15 — App Router)

```
src/
├── app/(interna)/
│   ├── dashboard/page.tsx          # Req 1 — Dashboard Executivo
│   ├── favoritos/page.tsx          # Req 2 — Favoritos (ou drawer na sidebar)
│   ├── relatorios/
│   │   ├── page.tsx                # Req 3 — Catálogo de Relatórios
│   │   └── [id]/page.tsx           # Detalhe/execução de relatório
│   ├── indicadores/page.tsx        # Req 4 — Painel de Indicadores
│   ├── configuracoes/
│   │   ├── empresa/page.tsx        # Req 5 — Dados da Empresa
│   │   ├── parametros/page.tsx     # Req 5 — Parâmetros Gerais
│   │   ├── modulos/page.tsx        # Req 5 — Módulos Ativos
│   │   ├── email/page.tsx          # Req 5 — Email/SMTP
│   │   ├── integracoes/page.tsx    # Req 5 — Integrações
│   │   ├── backup/page.tsx         # Req 5 — Backup/Restore
│   │   ├── notificacoes/page.tsx   # Req 5 — Notificações
│   │   └── campos/page.tsx         # Req 5 — Campos Personalizados
│   ├── permissoes/page.tsx         # Req 6 — Permissões
│   ├── logs/page.tsx               # Req 7 — Logs de Auditoria
│   └── suporte/
│       ├── page.tsx                # Req 8 — Canal de Suporte
│       └── [ticketId]/page.tsx     # Detalhe do ticket
├── components/
│   ├── dashboard/
│   │   ├── KpiWidget.tsx
│   │   ├── ChartWidget.tsx
│   │   ├── AlertsPanel.tsx
│   │   ├── QuickActionsConfig.tsx
│   │   ├── MiniCalendar.tsx
│   │   └── IntegrationHealth.tsx
│   ├── favoritos/
│   │   ├── FavoritosPanel.tsx
│   │   ├── FavoritoItem.tsx
│   │   └── FavoritoStar.tsx        # ☆/★ icon para header de páginas
│   ├── relatorios/
│   │   ├── ReportCatalog.tsx
│   │   ├── ReportBuilder.tsx
│   │   ├── ReportScheduler.tsx
│   │   └── ReportHistory.tsx
│   ├── indicadores/
│   │   ├── KpiCard.tsx
│   │   ├── GaugeChart.tsx
│   │   ├── TrendLine.tsx
│   │   └── MetaConfigModal.tsx
│   ├── configuracoes/
│   │   ├── EmpresaForm.tsx
│   │   ├── SmtpForm.tsx
│   │   ├── ModulosToggle.tsx
│   │   ├── CamposPersonalizados.tsx
│   │   └── NotificacoesConfig.tsx
│   ├── permissoes/
│   │   ├── PerfilList.tsx
│   │   ├── PermissionMatrix.tsx
│   │   └── PermissionLog.tsx
│   ├── logs/
│   │   ├── LogTable.tsx
│   │   ├── LogDetailModal.tsx
│   │   └── RetentionConfig.tsx
│   ├── suporte/
│   │   ├── TicketForm.tsx
│   │   ├── TicketList.tsx
│   │   ├── KnowledgeBase.tsx
│   │   ├── Changelog.tsx
│   │   └── SystemStatus.tsx
│   ├── preferences/
│   │   ├── PreferencesDrawer.tsx   # Drawer lateral (gear icon)
│   │   └── ThemeToggle.tsx         # Toggle claro/escuro/auto
│   └── layout/
│       └── FavoritoStar.tsx        # Componente ★ no header
├── providers/
│   ├── ThemeProvider.tsx           # Wrapper do MantineProvider com colorScheme
│   └── PreferencesProvider.tsx     # Context para preferências do usuário
├── hooks/
│   ├── useFavoritos.ts
│   ├── usePreferences.ts
│   ├── useTheme.ts
│   ├── useDashboardKpis.ts
│   ├── useIndicadores.ts
│   ├── useRelatorios.ts
│   ├── useLogs.ts
│   ├── usePermissoes.ts
│   └── useSuporteTickets.ts
└── lib/
    └── api.ts                       # Axios instance (já existe)
```

### Backend (Fastify + Prisma 6)

#### Novas Rotas API

```
# Dashboard (Req 1)
GET  /api/dashboard/kpis?periodo=mes&inicio=&fim=
GET  /api/dashboard/alertas
GET  /api/dashboard/calendario?dias=7
GET  /api/dashboard/integracao-status

# Favoritos (Req 2)
GET    /api/favoritos
POST   /api/favoritos          { href, label, modulo }
DELETE /api/favoritos/:id
PUT    /api/favoritos/reordenar  { ids: string[] }

# Relatórios (Req 3)
GET    /api/relatorios/catalogo?modulo=&tipo=
POST   /api/relatorios/executar    { relatorioId, filtros, formato }
GET    /api/relatorios/historico?page=1&limit=20
POST   /api/relatorios/agendar     { relatorioId, filtros, formato, frequencia, destinatarios }
GET    /api/relatorios/agendamentos
DELETE /api/relatorios/agendamentos/:id
GET    /api/relatorios/compartilhar/:token

# Indicadores (Req 4)
GET    /api/indicadores?periodo=mes
GET    /api/indicadores/:id/drilldown?page=1&limit=50
PUT    /api/indicadores/:id/meta   { valor }

# Configurações (Req 5)
GET    /api/configuracoes/empresa
PUT    /api/configuracoes/empresa
POST   /api/configuracoes/empresa/logo  (multipart)
GET    /api/configuracoes/parametros
PUT    /api/configuracoes/parametros
GET    /api/configuracoes/modulos
PUT    /api/configuracoes/modulos
GET    /api/configuracoes/smtp
PUT    /api/configuracoes/smtp
POST   /api/configuracoes/smtp/testar
GET    /api/configuracoes/notificacoes
PUT    /api/configuracoes/notificacoes
GET    /api/configuracoes/campos-personalizados
POST   /api/configuracoes/campos-personalizados
DELETE /api/configuracoes/campos-personalizados/:id

# Permissões (Req 6)
GET    /api/permissoes/perfis
GET    /api/permissoes/perfis/:id
PUT    /api/permissoes/perfis/:id    { permissoes }
GET    /api/permissoes/usuarios/:id  (override por usuário)
PUT    /api/permissoes/usuarios/:id  { overrides }
GET    /api/permissoes/log?page=1&limit=20&perfilId=&usuarioId=&dataInicio=&dataFim=

# Logs (Req 7)
GET    /api/logs/atividades?page=1&limit=20&usuario=&modulo=&acao=&dataInicio=&dataFim=
GET    /api/logs/sessoes?page=1&limit=20
GET    /api/logs/criticos?page=1&limit=20
GET    /api/logs/:id/detalhe
POST   /api/logs/exportar          { filtros, formato }
GET    /api/logs/retencao
PUT    /api/logs/retencao          { dias }

# Suporte (Req 8)
GET    /api/suporte/tickets?page=1&limit=20&status=&prioridade=
POST   /api/suporte/tickets        (multipart — com anexos)
GET    /api/suporte/tickets/:id
GET    /api/suporte/kb?busca=&modulo=
GET    /api/suporte/changelog?limit=20
GET    /api/suporte/status

# Preferências (Req 9 e 10)
GET    /api/usuarios/me/preferencias
PUT    /api/usuarios/me/preferencias   { tema, idioma, densidade, formatoData, notificacoes, moduloPadrao, tamanhoFonte }
```

## Data Models (Prisma Schema Additions)

```prisma
// ─── FAVORITOS ───
model Favorito {
  id        String   @id @default(uuid())
  usuarioId String
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])
  empresaId String
  href      String
  label     String
  modulo    String
  ordem     Int      @default(0)
  criadoEm  DateTime @default(now())
  @@unique([usuarioId, href])
  @@index([usuarioId, empresaId])
}

// ─── RELATÓRIOS ───
model Relatorio {
  id          String   @id @default(uuid())
  nome        String
  descricao   String?
  modulo      String
  tipo        String   // 'predefinido' | 'personalizado'
  campos      Json     // { campos: [], filtros: [], agrupamentos: [] }
  criadoPor   String
  empresaId   String
  criadoEm    DateTime @default(now())
  execucoes   RelatorioExecucao[]
  agendamentos RelatorioAgendamento[]
}

model RelatorioExecucao {
  id          String   @id @default(uuid())
  relatorioId String
  relatorio   Relatorio @relation(fields: [relatorioId], references: [id])
  usuarioId   String
  formato     String   // 'pdf' | 'xlsx' | 'csv'
  status      String   // 'sucesso' | 'erro'
  arquivoUrl  String?
  erro        String?
  criadoEm    DateTime @default(now())
}

model RelatorioAgendamento {
  id            String   @id @default(uuid())
  relatorioId   String
  relatorio     Relatorio @relation(fields: [relatorioId], references: [id])
  filtros       Json
  formato       String
  frequencia    String   // 'diaria' | 'semanal' | 'mensal'
  destinatarios String[] // emails
  ativo         Boolean  @default(true)
  empresaId     String
  criadoPor     String
  criadoEm      DateTime @default(now())
}

// ─── INDICADORES ───
model IndicadorMeta {
  id          String   @id @default(uuid())
  empresaId   String
  modulo      String
  indicador   String   // 'acuracidade' | 'otif' | 'oee' | 'ticket_medio' | etc.
  valor       Float
  atualizadoPor String
  atualizadoEm  DateTime @default(now())
  @@unique([empresaId, modulo, indicador])
}

// ─── PERMISSÕES ───
model PerfilPermissao {
  id       String @id @default(uuid())
  perfil   String // 'SUPER_ADMIN' | 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'VISUALIZADOR'
  modulo   String
  tela     String?  // null = módulo inteiro
  acao     String   // 'ler' | 'criar' | 'editar' | 'excluir' | 'aprovar' | 'exportar'
  permitido Boolean @default(false)
  empresaId String
  @@unique([perfil, modulo, tela, acao, empresaId])
  @@index([perfil, empresaId])
}

model UsuarioPermissaoOverride {
  id        String  @id @default(uuid())
  usuarioId String
  modulo    String
  tela      String?
  acao      String
  permitido Boolean
  empresaId String
  @@unique([usuarioId, modulo, tela, acao, empresaId])
}

// ─── LOGS ───
model LogAuditoria {
  id        String   @id @default(uuid())
  usuarioId String
  usuarioNome String
  acao      String   // 'criar' | 'editar' | 'excluir' | 'aprovar' | 'login' | 'logout'
  modulo    String
  recurso   String   // ex: "Produto #123"
  detalhes  Json?    // { campo: "preco", antes: 10, depois: 15 }
  ip        String?
  userAgent String?
  critico   Boolean  @default(false)
  empresaId String
  criadoEm  DateTime @default(now())
  @@index([empresaId, criadoEm])
  @@index([usuarioId, criadoEm])
  @@index([modulo, criadoEm])
}

model LogRetencao {
  id        String @id @default(uuid())
  empresaId String @unique
  dias      Int    @default(90)
  atualizadoPor String
  atualizadoEm  DateTime @default(now())
}

// ─── SUPORTE ───
model Ticket {
  id          String   @id @default(uuid())
  numero      Int      @default(autoincrement())
  titulo      String
  descricao   String
  prioridade  String   // 'baixa' | 'media' | 'alta' | 'critica'
  status      String   @default("aberto") // 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
  usuarioId   String
  empresaId   String
  criadoEm    DateTime @default(now())
  atualizadoEm DateTime @updatedAt
  anexos      TicketAnexo[]
  mensagens   TicketMensagem[]
}

model TicketAnexo {
  id        String @id @default(uuid())
  ticketId  String
  ticket    Ticket @relation(fields: [ticketId], references: [id])
  nomeArquivo String
  url       String
  tamanho   Int
  tipo      String
  criadoEm  DateTime @default(now())
}

model TicketMensagem {
  id        String   @id @default(uuid())
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  autorId   String
  autorNome String
  conteudo  String
  tipo      String   @default("resposta") // 'resposta' | 'nota_interna'
  criadoEm  DateTime @default(now())
}

// ─── CONFIGURAÇÕES ───
model ConfiguracaoEmpresa {
  id        String @id @default(uuid())
  empresaId String @unique
  moeda     String @default("BRL")
  fusoHorario String @default("America/Sao_Paulo")
  formatoData String @default("DD/MM/YYYY")
  casasDecimais Int @default(2)
  smtp      Json?  // { host, porta, usuario, senha, tls }
  notificacoes Json? // { email: true, push: true, sons: true }
  criadoEm  DateTime @default(now())
  atualizadoEm DateTime @updatedAt
}

model CampoPersonalizado {
  id        String @id @default(uuid())
  empresaId String
  entidade  String // 'cliente' | 'produto' | 'pedido'
  nome      String
  tipo      String // 'texto' | 'numero' | 'data' | 'selecao'
  opcoes    Json?  // para tipo 'selecao'
  obrigatorio Boolean @default(false)
  ordem     Int    @default(0)
  criadoEm  DateTime @default(now())
  @@index([empresaId, entidade])
}

// ─── PREFERÊNCIAS DO USUÁRIO ───
model PreferenciaUsuario {
  id          String @id @default(uuid())
  usuarioId   String @unique
  tema        String @default("auto")    // 'light' | 'dark' | 'auto'
  idioma      String @default("pt-BR")
  densidade   String @default("normal")  // 'compacta' | 'normal' | 'espacosa'
  formatoData String @default("DD/MM/YYYY")
  notifSons   Boolean @default(true)
  notifPush   Boolean @default(true)
  notifEmail  Boolean @default(true)
  moduloPadrao String?
  tamanhoFonte String @default("medio")  // 'pequeno' | 'medio' | 'grande'
  criadoEm    DateTime @default(now())
  atualizadoEm DateTime @updatedAt
}

// ─── KNOWLEDGE BASE ───
model ArtigoKB {
  id        String @id @default(uuid())
  titulo    String
  conteudo  String
  modulo    String
  tags      String[]
  publicado Boolean @default(true)
  criadoEm  DateTime @default(now())
  atualizadoEm DateTime @updatedAt
}

model Changelog {
  id        String @id @default(uuid())
  versao    String
  titulo    String
  descricao String
  criadoEm  DateTime @default(now())
}
```

## Theme System (Req 9 & 10)

### ThemeProvider Architecture

```tsx
// src/providers/ThemeProvider.tsx
// Wraps MantineProvider + handles localStorage + OS detection + sync com API

// 1. Na inicialização:
//    - Lê localStorage('vizor-theme')
//    - Se não existir, detecta via window.matchMedia('(prefers-color-scheme: dark)')
//    - Aplica no MantineProvider.colorScheme
//    - Sincroniza classe 'dark' no <html> para TailwindCSS

// 2. No toggle:
//    - Atualiza state → MantineProvider re-render
//    - Salva localStorage
//    - PUT /api/usuarios/me/preferencias (async, não bloqueia)
//    - Atualiza <html> class

// 3. No modo Auto:
//    - Registra listener em window.matchMedia('(prefers-color-scheme: dark)')
//    - Alterna automaticamente quando OS muda
```

## Key Technical Decisions

1. **Favoritos como painel na sidebar** (não nova página): ao clicar em "Favoritos" na sidebar, abre um painel inline na sidebar ou navega para `/favoritos` com layout simples. Optamos por página dedicada `/favoritos` para consistência.

2. **Relatórios exportação server-side**: PDF gerado no backend com `@react-pdf/renderer` ou `pdfmake`. Excel via `exceljs`. CSV streaming direto. Frontend apenas faz download do arquivo gerado.

3. **Logs com JSON diff**: campo `detalhes` armazena diff estruturado `{ campo, antes, depois }[]`. Permite visualização granular no modal de detalhe.

4. **Permissões enforcement dual**: Frontend oculta itens sem permissão (UX). Backend valida em cada rota (segurança). Middleware Fastify `requirePermission(modulo, acao)`.

5. **SMTP validação**: Backend envia email de teste real antes de persistir config. Se falhar, retorna erro 422 com mensagem descritiva.

6. **Polling para atualizações**: Tickets e status do sistema usam polling a cada 60s via `refetchInterval` do TanStack Query. Websockets podem ser adicionados futuramente.

7. **Dark mode com Mantine + Tailwind**: MantineProvider controla componentes Mantine. Classe `dark` no `<html>` controla utilitários Tailwind (`dark:bg-gray-900`). Sincronizados pelo ThemeProvider.
