# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação das funcionalidades completas dos menus laterais (sidebar) e ações do header no sistema Vizor ERP. Atualmente, a sidebar na página `/modulos` (componente `ModulesSidebar.tsx`) exibe itens de menu como placeholders sem funcionalidade real, e o ícone de engrenagem (⚙️) no header (`ModulesHeader.tsx`) não executa nenhuma ação.

A implementação abrange 10 áreas funcionais: Dashboard executivo com KPIs em tempo real, Favoritos do usuário, Central de Relatórios, Painel de Indicadores/KPIs, Configurações expandidas do sistema, Permissões granulares de acesso, Logs de auditoria completos, Canal de Suporte, Preferências rápidas do usuário (gear icon) e Toggle de tema claro/escuro.

O frontend utiliza Next.js 15 App Router, Mantine 7, TypeScript, TailwindCSS e @tanstack/react-query. O backend utiliza Fastify + Prisma 6 + PostgreSQL (Neon). O sistema já possui autenticação, contexto de empresa (tenant) e permissões básicas de módulo.

## Glossary

- **Sistema_Frontend**: A aplicação frontend Next.js 15 com App Router, Mantine v7, TanStack Query, TailwindCSS e TypeScript
- **Sistema_Backend**: A aplicação backend Fastify com Prisma 6 e PostgreSQL (Neon) hospedada no Render
- **Usuário**: Pessoa autenticada no sistema com perfil de acesso definido
- **Empresa**: Entidade tenant que representa a empresa ativa no contexto do Usuário
- **Módulo**: Funcionalidade do ERP habilitada por empresa (WMS, PCP, VENDAS, COMPRAS, FINANCEIRO, FISCAL, CONFIGURADOR)
- **Sidebar**: Componente de navegação lateral fixo (`ModulesSidebar.tsx`) exibido na página de módulos
- **Header**: Componente de cabeçalho (`ModulesHeader.tsx`) com ações globais e menu do usuário
- **KPI**: Key Performance Indicator — métrica de desempenho operacional
- **Widget**: Componente visual encapsulado que exibe um KPI ou informação resumida no Dashboard
- **Favorito**: Página ou relatório marcado pelo Usuário para acesso rápido
- **Relatório**: Documento gerado com dados consolidados, exportável em PDF, Excel ou CSV
- **Indicador**: Métrica quantitativa com meta configurável e visualização gráfica
- **Perfil_de_Acesso**: Conjunto de permissões atribuído a um Usuário (SUPER_ADMIN, ADMIN, GERENTE, OPERADOR, VISUALIZADOR)
- **Log_de_Auditoria**: Registro de ação realizada no sistema contendo Usuário, ação, data/hora, recurso e valores alterados
- **Ticket_de_Suporte**: Solicitação de ajuda criada pelo Usuário com título, descrição, prioridade e status
- **Preferência_de_Usuário**: Configuração individual do Usuário persistida no perfil (tema, idioma, densidade, etc.)
- **Tema**: Esquema de cores da interface — Light (claro), Dark (escuro) ou Auto (segue OS)
- **MantineProvider**: Componente raiz do Mantine que gerencia o colorScheme da aplicação

## Requirements

### Requirement 1: Dashboard Executivo com KPIs em Tempo Real

**User Story:** Como gestor, quero visualizar um dashboard executivo com KPIs consolidados de todos os módulos ativos, para que eu possa tomar decisões estratégicas baseadas em dados atualizados.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Dashboard" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/dashboard` e renderizar a página de dashboard executivo
2. THE Sistema_Frontend SHALL exibir widgets de KPI contendo: receita do mês atual, pedidos pendentes, taxa de ocupação do armazém e ordens de produção em atraso
3. THE Sistema_Frontend SHALL exibir gráficos atualizados automaticamente a cada 60 segundos contendo: fluxo de entrada/saída de mercadorias, fluxo de caixa e produção realizada versus meta planejada
4. THE Sistema_Frontend SHALL exibir seção de alertas críticos contendo no máximo 10 itens visíveis por categoria (itens em estoque mínimo, notas fiscais rejeitadas e atrasos de produção/entrega), com indicador do total de alertas quando houver mais itens além dos exibidos
5. THE Sistema_Frontend SHALL exibir até 8 atalhos de ação rápida configuráveis pelo Usuário com links diretos para operações frequentes, persistindo a configuração entre sessões
6. THE Sistema_Frontend SHALL exibir filtro de período com opções: Hoje, Semana, Mês, Trimestre e Período Personalizado (data início e data fim)
7. WHEN o Usuário seleciona Período Personalizado no filtro, THE Sistema_Frontend SHALL validar que a data início não é posterior à data fim, que o intervalo não excede 365 dias e que a data fim não é futura, exibindo mensagem de validação caso alguma regra seja violada
8. WHEN o Usuário altera o filtro de período, THE Sistema_Frontend SHALL recarregar todos os widgets e gráficos com dados do período selecionado em até 5 segundos
9. THE Sistema_Frontend SHALL exibir um indicador de saúde das integrações atualizado a cada 60 segundos mostrando status online/offline de cada serviço externo conectado
10. THE Sistema_Frontend SHALL exibir um mini-calendário com eventos dos próximos 7 dias contendo agenda de docas, vencimentos financeiros e marcos de produção
11. WHEN os dados dos widgets estão sendo carregados, THE Sistema_Frontend SHALL exibir skeleton loading em cada widget individualmente
12. IF a requisição de dados do dashboard falhar, THEN THE Sistema_Frontend SHALL exibir mensagem de erro no widget afetado com botão para tentar novamente, preservando os dados dos demais widgets que carregaram com sucesso
13. IF o Usuário não possuir permissão de acesso a um módulo específico, THEN THE Sistema_Frontend SHALL ocultar os widgets e gráficos relacionados a esse módulo e exibir apenas os KPIs dos módulos aos quais o Usuário tem acesso

---

### Requirement 2: Favoritos do Usuário

**User Story:** Como usuário do sistema, quero marcar páginas e relatórios como favoritos para acesso rápido, para que eu possa navegar diretamente às funcionalidades que utilizo com mais frequência.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Favoritos" na Sidebar, THE Sistema_Frontend SHALL exibir um painel com a lista de páginas e relatórios favoritados pelo Usuário, agrupados por Módulo, em no máximo 300ms após o clique
2. THE Sistema_Frontend SHALL permitir ao Usuário adicionar qualquer página navegável do sistema (exceto páginas de autenticação) como favorito através de um ícone de estrela (☆/★) presente no header de cada página
3. THE Sistema_Frontend SHALL permitir ao Usuário reordenar favoritos via drag-and-drop usando a biblioteca @dnd-kit já instalada no projeto, e WHEN o Usuário finaliza a reordenação (drop), THE Sistema_Frontend SHALL persistir a nova ordem na API do backend vinculada ao perfil do Usuário
4. THE Sistema_Frontend SHALL agrupar favoritos por Módulo (WMS, PCP, Vendas, Compras, Financeiro, Fiscal) com cabeçalho de grupo colapsável, exibindo apenas os grupos que possuem ao menos 1 favorito
5. THE Sistema_Frontend SHALL permitir ao Usuário fixar relatórios específicos como favoritos diretamente da Central de Relatórios através do mesmo ícone de estrela (☆/★)
6. THE Sistema_Frontend SHALL limitar a quantidade máxima de favoritos a 20 itens por Usuário
7. IF o Usuário tentar adicionar um 21º favorito, THEN THE Sistema_Frontend SHALL exibir notificação informando que o limite de 20 favoritos foi atingido e sugerindo remover um item existente, sem adicionar o novo item
8. THE Sistema_Frontend SHALL exibir campo de busca no topo da lista de favoritos que filtra itens por nome ou módulo à medida que o Usuário digita, com debounce de 300ms
9. WHEN o Usuário adiciona ou remove um favorito, THE Sistema_Frontend SHALL persistir a alteração na API do backend vinculada ao perfil do Usuário e exibir feedback visual de confirmação (ícone de estrela atualizado para ★ ao adicionar ou ☆ ao remover)
10. WHEN o Usuário clica em um item da lista de favoritos, THE Sistema_Frontend SHALL navegar para a página correspondente
11. IF a lista de favoritos estiver vazia, THEN THE Sistema_Frontend SHALL exibir mensagem orientando o Usuário sobre como adicionar favoritos, incluindo indicação do ícone de estrela no header das páginas
12. IF a persistência de favoritos na API falhar, THEN THE Sistema_Frontend SHALL reverter a alteração localmente ao estado anterior e exibir notificação de erro
13. IF um item favoritado referenciar uma página que não existe mais no sistema, THEN THE Sistema_Frontend SHALL exibir o item como indisponível na lista de favoritos e permitir ao Usuário removê-lo

---

### Requirement 3: Central de Relatórios

**User Story:** Como usuário do sistema, quero acessar uma central unificada de relatórios de todos os módulos, para que eu possa gerar, exportar e agendar relatórios sem navegar por cada módulo individualmente.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Relatórios" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/relatorios` e renderizar o catálogo central de relatórios
2. THE Sistema_Frontend SHALL exibir um catálogo de relatórios pré-definidos incluindo: Estoque Atual, Movimentações, Vendas por Período, Comissões, Contas a Pagar e Contas a Receber
3. THE Sistema_Frontend SHALL exibir um construtor de relatórios personalizados onde o Usuário pode selecionar até 20 campos, até 10 filtros e até 5 agrupamentos dentre os campos disponíveis nos módulos do sistema
4. THE Sistema_Frontend SHALL permitir exportação de relatórios nos formatos PDF, Excel (.xlsx) e CSV, limitando a exportação a no máximo 50.000 linhas por arquivo
5. WHEN o Usuário clica em "Exportar", THE Sistema_Frontend SHALL exibir indicador de progresso, gerar o arquivo no formato selecionado em até 30 segundos e iniciar o download automaticamente ao concluir
6. IF a geração do arquivo de exportação falha ou excede 30 segundos, THEN THE Sistema_Frontend SHALL cancelar a operação e exibir mensagem de erro sugerindo reduzir o período ou número de registros
7. THE Sistema_Frontend SHALL permitir ao Usuário agendar envio automático de relatórios por email com frequências: diária, semanal e mensal, para no máximo 10 destinatários por agendamento
8. WHEN o Usuário configura um agendamento, THE Sistema_Frontend SHALL validar que todos os campos obrigatórios estão preenchidos (relatório, pelo menos um filtro de período, formato, frequência e pelo menos um destinatário com email válido) e enviar os parâmetros para a API do backend
9. IF o envio dos parâmetros de agendamento para a API falha, THEN THE Sistema_Frontend SHALL exibir mensagem de erro e manter o formulário preenchido para nova tentativa
10. THE Sistema_Frontend SHALL exibir histórico de execuções de relatórios contendo: nome do relatório, data/hora de geração, Usuário que solicitou e status (sucesso/erro), paginado com 20 registros por página e ordenado por data decrescente
11. THE Sistema_Frontend SHALL permitir ao Usuário compartilhar link de relatório com outros Usuários da mesma Empresa, concedendo acesso somente leitura ao resultado por até 7 dias após a geração
12. THE Sistema_Frontend SHALL exibir filtros avançados para o catálogo: data, empresa, módulo, status e responsável
13. WHEN filtros são aplicados no catálogo, THE Sistema_Frontend SHALL atualizar a lista de relatórios em até 2 segundos exibindo apenas os que atendem aos critérios selecionados

---

### Requirement 4: Painel de Indicadores (KPIs)

**User Story:** Como gestor operacional, quero visualizar indicadores de desempenho por módulo com metas configuráveis, para que eu possa monitorar a performance e identificar desvios rapidamente.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Indicadores" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/indicadores` e renderizar o painel de indicadores dentro de 2 segundos
2. THE Sistema_Frontend SHALL exibir KPIs agrupados por módulo: WMS (acuracidade de estoque em %, OTIF em %, tempo médio de picking em minutos), PCP (OEE em %, aderência ao plano em %), Vendas (ticket médio em R$, taxa de conversão em %) — cada valor exibido com até 2 casas decimais
3. THE Sistema_Frontend SHALL exibir metas configuráveis por indicador com percentual de atingimento visualizado em barra de progresso ou gauge
4. WHEN o Usuário com perfil ADMIN ou SUPER_ADMIN clica em "Configurar Meta" de um indicador, THE Sistema_Frontend SHALL exibir formulário de edição com campo numérico validado e botão de confirmação
5. THE Sistema_Frontend SHALL exibir visualizações gráficas: gauges para indicadores percentuais, barras para comparativos entre períodos, e linhas de tendência para evolução temporal dos últimos 12 meses
6. THE Sistema_Frontend SHALL exibir comparação de períodos: mês atual versus mês anterior e ano atual versus ano anterior, com variação percentual explícita ao lado de cada KPI
7. WHEN um indicador atinge valor abaixo de 80% da meta configurada, THE Sistema_Frontend SHALL destacar visualmente o indicador com cor vermelha e ícone de alerta
8. WHEN o Usuário clica em um indicador, THE Sistema_Frontend SHALL exibir drill-down com tabela paginada (máximo 50 registros por página) contendo os registros individuais que compõem o valor agregado do KPI
9. WHEN o Usuário clica em "Exportar" e seleciona formato PDF ou Excel, THE Sistema_Frontend SHALL gerar e iniciar download do arquivo contendo os dados visíveis no painel dentro de 10 segundos
10. WHEN o painel é carregado, THE Sistema_Frontend SHALL exibir apenas indicadores dos módulos ativos para a Empresa do Usuário, ocultando módulos inativos
11. IF a requisição de dados de KPI falha ou o tempo de resposta excede 10 segundos, THEN THE Sistema_Frontend SHALL exibir mensagem de erro e botão "Tentar Novamente"
12. IF o Usuário com perfil diferente de ADMIN ou SUPER_ADMIN tenta acessar configuração de metas, THEN THE Sistema_Frontend SHALL manter o botão "Configurar Meta" oculto

---

### Requirement 5: Configurações do Sistema (Sub-menu Expandido)

**User Story:** Como administrador do sistema, quero acessar todas as configurações do sistema organizadas em categorias, para que eu possa gerenciar parâmetros, integrações e preferências da empresa de forma centralizada.

#### Acceptance Criteria

1. WHEN o Usuário clica em "Configurações" na Sidebar, THE Sistema_Frontend SHALL expandir o sub-menu exibindo as categorias de configuração disponíveis
2. THE Sistema_Frontend SHALL exibir sub-item "Dados da Empresa" permitindo edição de: razão social, CNPJ, endereço completo e upload de logotipo (formatos PNG/JPG, máximo 2MB)
3. THE Sistema_Frontend SHALL exibir sub-item "Multiempresa" permitindo ao Usuário SUPER_ADMIN gerenciar filiais e unidades vinculadas
4. THE Sistema_Frontend SHALL exibir sub-item "Parâmetros Gerais" permitindo configuração de: moeda, fuso horário, formato de data e casas decimais
5. THE Sistema_Frontend SHALL exibir sub-item "Módulos Ativos" permitindo habilitar e desabilitar módulos por empresa
6. THE Sistema_Frontend SHALL exibir sub-item "Email/SMTP" permitindo configuração do servidor de email (host, porta, usuário, senha, TLS) para notificações, relatórios e suporte
7. WHEN o Usuário salva configurações de SMTP, THE Sistema_Frontend SHALL enviar um email de teste para o endereço informado e exibir resultado (sucesso/falha) antes de persistir a configuração
8. THE Sistema_Frontend SHALL exibir sub-item "Integrações" permitindo gerenciamento de API Keys, Webhooks e conexões externas
9. THE Sistema_Frontend SHALL exibir sub-item "Backup/Restore" permitindo agendamento de backup automático e restauração a partir de pontos de recuperação
10. THE Sistema_Frontend SHALL exibir sub-item "Limpar Dados" (funcionalidade já existente) para exclusão seletiva de dados por módulo
11. THE Sistema_Frontend SHALL exibir sub-item "Notificações" permitindo ativar e desativar tipos de alertas do sistema por categoria
12. THE Sistema_Frontend SHALL exibir sub-item "Campos Personalizados" permitindo ao Usuário adicionar até 20 campos extras por entidade (clientes, produtos, pedidos)
13. WHILE o Usuário possui perfil OPERADOR ou VISUALIZADOR, THE Sistema_Frontend SHALL ocultar os sub-itens "Multiempresa", "Backup/Restore" e "Limpar Dados"

---

### Requirement 6: Permissões Granulares de Acesso

**User Story:** Como administrador, quero gerenciar permissões de acesso de forma granular por perfil, módulo, ação e tela, para que cada usuário tenha acesso apenas às funcionalidades necessárias ao seu papel.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Permissões" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/permissoes` e renderizar a tela de gerenciamento de permissões em no máximo 2 segundos
2. WHEN a tela de permissões é carregada, THE Sistema_Frontend SHALL exibir lista dos perfis de acesso (SUPER_ADMIN, ADMIN, GERENTE, OPERADOR e VISUALIZADOR) com nome e descrição de cada perfil
3. WHEN o Usuário seleciona um perfil editável na lista, THE Sistema_Frontend SHALL exibir matriz de permissões por módulo em formato de tabela com toggles para habilitar ou desabilitar acesso a cada módulo
4. THE Sistema_Frontend SHALL permitir configuração de permissões por ação (Ler, Criar, Editar, Excluir, Aprovar e Exportar) para cada módulo, exibida como checkboxes na matriz módulo × ação
5. THE Sistema_Frontend SHALL permitir configuração de permissões por tela, listando cada item de menu e página dentro de cada módulo com toggle individual de acesso por perfil
6. THE Sistema_Frontend SHALL suportar herança de perfil, onde um perfil base pode ser estendido com ajustes individuais por Usuário, e permissões individuais têm precedência sobre as permissões do perfil base
7. WHILE o perfil SUPER_ADMIN está sendo visualizado, THE Sistema_Frontend SHALL exibir todas as permissões como ativas e desabilitar edição (checkboxes em estado read-only)
8. WHEN o Usuário confirma o salvamento de permissões modificadas, THE Sistema_Frontend SHALL enviar as alterações ao backend e exibir notificação de sucesso em no máximo 3 segundos
9. IF o salvamento de permissões falha, THEN THE Sistema_Frontend SHALL exibir mensagem de erro, preservar as alterações não salvas e permitir nova tentativa
10. WHEN permissões são salvas com sucesso, THE Sistema_Frontend SHALL registrar automaticamente no Log_de_Auditoria quem modificou, quando e quais permissões foram alteradas
11. THE Sistema_Frontend SHALL exibir log de alterações de permissões com paginação de 20 registros por página e filtros por data, perfil e Usuário
12. WHILE o Usuário possui perfil OPERADOR ou VISUALIZADOR, THE Sistema_Frontend SHALL ocultar o item "Permissões" na Sidebar e redirecionar para a página inicial caso acesse a rota diretamente

---

### Requirement 7: Logs de Auditoria Completos

**User Story:** Como administrador, quero consultar um registro completo de todas as ações realizadas no sistema, para que eu possa auditar operações, investigar problemas e atender requisitos de compliance.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Logs" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/logs` e renderizar a tela de consulta de logs organizada em abas: "Atividades", "Sessões" e "Alterações Críticas"
2. WHEN a aba "Atividades" está ativa, THE Sistema_Frontend SHALL exibir tabela paginada (20 registros por página) com colunas: Usuário, ação (criar, editar, excluir, aprovar), data/hora, módulo e recurso afetado
3. THE Sistema_Frontend SHALL exibir filtros para consulta: por Usuário, módulo, intervalo de datas (máximo 365 dias) e tipo de ação
4. WHEN a aba "Sessões" está ativa, THE Sistema_Frontend SHALL exibir tabela paginada com colunas: tipo de evento (login/logout), endereço IP, dispositivo, navegador e data/hora
5. WHEN a aba "Alterações Críticas" está ativa, THE Sistema_Frontend SHALL exibir tabela contendo exclusivamente: mudanças de preço, ajustes de estoque, alterações de permissão e exclusões, com indicador visual de severidade
6. THE Sistema_Frontend SHALL permitir exportação de logs filtrados nos formatos CSV e Excel, limitada a 10.000 registros por exportação
7. THE Sistema_Frontend SHALL exibir configuração de retenção de logs com opções: 30, 60, 90 e 365 dias, visível apenas para SUPER_ADMIN
8. WHEN o Usuário SUPER_ADMIN altera a política de retenção, THE Sistema_Frontend SHALL enviar a configuração para a API e exibir notificação de sucesso
9. WHEN o Usuário clica em um registro de log, THE Sistema_Frontend SHALL abrir modal exibindo detalhes completos incluindo campo alterado, valor anterior e valor novo (JSON diff)
10. IF a consulta não retorna registros para os filtros aplicados, THEN THE Sistema_Frontend SHALL exibir estado vazio com mensagem informativa
11. WHILE o Usuário possui perfil OPERADOR ou VISUALIZADOR, THE Sistema_Frontend SHALL ocultar o item "Logs" na Sidebar e redirecionar caso acesse diretamente
12. IF a exportação excede 10.000 registros, THEN THE Sistema_Frontend SHALL exibir mensagem orientando refinar os filtros

---

### Requirement 8: Canal de Suporte

**User Story:** Como usuário do sistema, quero acessar um canal de suporte integrado ao sistema, para que eu possa abrir chamados, consultar tutoriais e verificar o status dos serviços sem sair da aplicação.

#### Acceptance Criteria

1. WHEN o Usuário clica no item "Suporte" na Sidebar, THE Sistema_Frontend SHALL navegar para a rota `/suporte` e renderizar a tela do canal de suporte
2. THE Sistema_Frontend SHALL exibir formulário de abertura de ticket contendo: título (máximo 150 caracteres), descrição (máximo 2000 caracteres), prioridade (Baixa, Média, Alta, Crítica) e campo para anexar até 5 arquivos (máximo 10 MB por arquivo, formatos: PNG/JPG/GIF, PDF, DOCX)
3. WHEN o Usuário submete um ticket com todos os campos obrigatórios preenchidos, THE Sistema_Frontend SHALL enviar os dados para a API do backend e enviar email para suporte@vizorerp.com.br, exibindo confirmação com o número do ticket criado
4. IF a submissão do ticket falha, THEN THE Sistema_Frontend SHALL exibir mensagem de erro, preservar os dados preenchidos e permitir nova tentativa
5. THE Sistema_Frontend SHALL exibir lista paginada de tickets do Usuário (20 por página) com colunas: título, prioridade, status (Aberto, Em Andamento, Resolvido, Fechado) e data de abertura, ordenados por data decrescente
6. THE Sistema_Frontend SHALL permitir ao Usuário filtrar tickets por status e prioridade
7. THE Sistema_Frontend SHALL exibir seção "Base de Conhecimento" com artigos de ajuda organizados por módulo, pesquisáveis por palavra-chave (mínimo 3 caracteres), exibindo até 20 resultados por consulta
8. THE Sistema_Frontend SHALL exibir seção "Tutoriais e Vídeos" com links para vídeos de treinamento organizados por funcionalidade
9. THE Sistema_Frontend SHALL exibir seção "Novidades / Changelog" listando as últimas 20 atualizações do sistema com data, versão e descrição, ordenadas por data decrescente
10. THE Sistema_Frontend SHALL exibir indicador de status dos serviços (API online/offline) atualizado a cada 60 segundos via polling
11. THE Sistema_Frontend SHALL exibir informações de SLA: tempo de resposta por prioridade (Crítica: 2h, Alta: 4h, Média: 8h, Baixa: 24h)
12. WHEN o status de um ticket é atualizado, THE Sistema_Frontend SHALL exibir a atualização na lista em até 60 segundos sem necessidade de refresh manual

---

### Requirement 9: Preferências Rápidas do Usuário (Gear Icon no Header)

**User Story:** Como usuário do sistema, quero acessar minhas preferências pessoais rapidamente a partir do header, para que eu possa ajustar tema, idioma, densidade e outras configurações sem navegar para telas de administração.

#### Acceptance Criteria

1. WHEN o Usuário clica no ícone de engrenagem (⚙️) no Header, THE Sistema_Frontend SHALL abrir um drawer lateral à direita com as preferências do Usuário, e WHEN o Usuário clica fora do drawer ou no botão de fechar (X), THE Sistema_Frontend SHALL fechar o drawer
2. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Tema" com seleção entre: Claro, Escuro e Auto (segue preferência do sistema operacional)
3. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Idioma" com seleção entre: pt-BR (ativo) e indicação de en-US e es como futuros (desabilitados)
4. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Densidade da Interface" com seleção entre: Compacta, Normal e Espaçosa
5. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Formato de Data/Hora" com seleção entre: DD/MM/YYYY e YYYY-MM-DD
6. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Notificações" com toggles individuais para: sons, push e email
7. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Módulo Padrão" permitindo escolher qual módulo abrir após login, listando os módulos aos quais o Usuário tem acesso
8. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Atalhos de Teclado" que ao ser clicada abre modal com lista de atalhos organizados por categoria
9. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir opção "Tamanho da Fonte" com seleção entre: Pequeno (14px), Médio (16px) e Grande (18px)
10. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir seção "Sobre" com: versão do sistema, data do build, link para suporte (suporte@vizorerp.com.br)
11. WHILE o drawer de preferências está aberto, THE Sistema_Frontend SHALL exibir botão "Sair" (logout) que exibe diálogo de confirmação antes de encerrar a sessão
12. WHEN o Usuário altera qualquer preferência, THE Sistema_Frontend SHALL aplicar a mudança na interface em até 300ms, persistir no localStorage imediatamente, e enviar a atualização para a API do backend
13. IF a chamada à API do backend para persistir preferências falha, THEN THE Sistema_Frontend SHALL manter a preferência local, exibir notificação de falha na sincronização, e reenviá-la na próxima alteração ou login
14. WHEN o Usuário faz login em outro dispositivo, THE Sistema_Frontend SHALL carregar as preferências da API do backend e aplicar automaticamente, prevalecendo sobre o localStorage local
15. WHEN o Usuário faz login pela primeira vez, THE Sistema_Frontend SHALL aplicar valores padrão: Tema=Auto, Idioma=pt-BR, Densidade=Normal, Formato=DD/MM/YYYY, Notificações=todas ligadas, Módulo Padrão=primeiro disponível, Fonte=Médio (16px)

---

### Requirement 10: Toggle de Tema (Light/Dark Mode)

**User Story:** Como usuário do sistema, quero alternar entre tema claro e escuro com transição suave, para que eu possa utilizar o sistema confortavelmente em diferentes condições de iluminação.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL suportar três estados de tema: Light (claro), Dark (escuro) e Auto (segue preferência do sistema operacional), sendo que apenas um estado pode estar ativo por vez
2. WHEN o Usuário altera o tema, THE Sistema_Frontend SHALL persistir a preferência no localStorage com a chave `vizor-theme` e sincronizar com a API do backend de forma assíncrona sem bloquear a mudança visual
3. IF a sincronização da preferência de tema com a API falhar, THEN THE Sistema_Frontend SHALL manter a preferência no localStorage e aplicar o tema normalmente sem exibir erro
4. THE Sistema_Frontend SHALL utilizar o MantineProvider com a prop `colorScheme` para aplicar o tema e sincronizar a classe CSS `dark` no elemento `<html>` para que utilitários TailwindCSS de dark mode reflitam o mesmo estado
5. THE Sistema_Frontend SHALL aplicar o tema a toda a aplicação incluindo: sidebar, header, cards, modais, tabelas, formulários e gráficos, garantindo que nenhum componente permaneça no esquema de cor oposto
6. WHEN o tema é alterado, THE Sistema_Frontend SHALL aplicar transição de cores com duração de 200ms usando CSS transition em background-color, color e border-color
7. WHEN o Usuário seleciona "Auto" e o sistema operacional alterna entre claro e escuro, THE Sistema_Frontend SHALL alternar o tema automaticamente em até 1 segundo após a mudança do OS
8. WHEN o Usuário visita pela primeira vez (sem preferência salva), THE Sistema_Frontend SHALL utilizar a preferência do sistema operacional como tema inicial; se não detectável, aplicar Light como padrão
9. THE Sistema_Frontend SHALL exibir controle de alternância de tema acessível por teclado (focável via Tab, acionável via Enter/Space) com rótulo acessível identificando o estado atual, tanto no drawer de preferências quanto como toggle rápido na Sidebar
