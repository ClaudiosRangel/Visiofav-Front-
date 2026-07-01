# Requirements Document: ERP Módulo Fiscal — Frontend

## Introduction

Módulo frontend completo para o sistema fiscal do VisioFab ERP, implementado em Next.js 15 (App Router) com Mantine 7 e React Query. O módulo conecta-se à API backend existente (`/api/fiscal`) e fornece interfaces para emissão de documentos fiscais eletrônicos (NF-e, NFC-e, CT-e, MDF-e, NFS-e), motor tributário, cadastros fiscais, SPED, apuração de impostos, certificados digitais, contingência, GNRE, importação de XML, manifesto do destinatário e auditoria fiscal.

## Glossary

- **Modulo_Fiscal_Frontend**: Conjunto de páginas, componentes e hooks React que compõem a interface do módulo fiscal no VisioFab ERP frontend
- **Dashboard_Fiscal**: Página inicial do módulo fiscal exibindo métricas e indicadores consolidados
- **Sidebar_Fiscal**: Seção de navegação lateral dedicada ao módulo fiscal dentro do ModuleSidebar
- **Listagem_Paginada**: Componente de tabela com paginação server-side, busca e filtros conectado via React Query
- **Formulario_Emissao**: Interface para criação/edição de documentos fiscais com validação client-side via Zod
- **Hook_React_Query**: Custom hook utilizando @tanstack/react-query para fetch, mutação e cache de dados da API
- **API_Fiscal**: Backend API em `/api/fiscal` com endpoints para todos os subdomínios fiscais
- **Motor_Tributario_UI**: Interface CRUD de regras tributárias com busca por NCM+CFOP+UF e visualização de fallback
- **Cadastros_Fiscais_UI**: Interfaces CRUD para tabelas auxiliares (NCM, CFOP, CEST, CST/CSOSN, Natureza de Operação)
- **SPED_UI**: Interface para geração e download de arquivos SPED (EFD ICMS/IPI, Contribuições, ECD, ECF, Reinf)
- **Apuracao_UI**: Interface para visualização e cálculo de apuração de impostos por período
- **Certificados_UI**: Interface para upload, listagem e gestão de certificados digitais A1
- **Contingencia_UI**: Interface para monitoramento de status SEFAZ, fila de contingência e retransmissão
- **GNRE_UI**: Interface para geração, pagamento e consolidação de guias GNRE
- **Importacao_XML_UI**: Interface para upload de XMLs de NF-e, de-para de produtos e geração de notas de entrada
- **Auditoria_Fiscal_UI**: Interface para consulta de logs de operações fiscais
- **MDe_UI**: Interface para manifesto do destinatário (ciência, confirmação, desconhecimento, não realizada)

## Requirements

### Requirement 1: Navegação e Estrutura do Módulo Fiscal

**User Story:** As a user, I want to access all fiscal screens from a dedicated Fiscal section in the sidebar, so that I can navigate efficiently between fiscal features.

#### Acceptance Criteria

1. WHEN the user navigates to any route starting with `/fiscal`, THE Sidebar_Fiscal SHALL display all menu entries for the fiscal module organized in groups (Documentos, Motor Tributário, Cadastros, Obrigações, Utilitários)
2. THE Sidebar_Fiscal SHALL include navigation entries for: Dashboard, NF-e, NFC-e, CT-e, MDF-e, NFS-e, Motor Tributário, NCM, CFOP, CEST, CST/CSOSN, Natureza de Operação, SPED, Apuração, Certificados, Contingência, GNRE, Importação XML, Manifesto Destinatário, Auditoria
3. WHEN the user clicks a navigation entry, THE Modulo_Fiscal_Frontend SHALL route to the corresponding page without full page reload
4. WHILE the user is on a fiscal page, THE Sidebar_Fiscal SHALL highlight the active menu item with the project's active style (teal color scheme)

---

### Requirement 2: Dashboard Fiscal

**User Story:** As a fiscal manager, I want to see key fiscal metrics at a glance, so that I can monitor the fiscal health of the company.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/dashboard`, THE Dashboard_Fiscal SHALL display summary cards with: total NF-e emitidas no mês, NF-e pendentes, valor total faturado, certificados próximos do vencimento, documentos em contingência
2. WHEN the page loads, THE Dashboard_Fiscal SHALL fetch metrics from `GET /api/fiscal/dashboard/metricas`
3. IF the API returns an error, THEN THE Dashboard_Fiscal SHALL display an error notification and show fallback empty state
4. WHILE the data is loading, THE Dashboard_Fiscal SHALL display a skeleton/loading overlay on the metric cards

---

### Requirement 3: Listagem de NF-e

**User Story:** As a fiscal operator, I want to list all issued NF-e with filters and pagination, so that I can find and manage electronic invoices.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/nfe`, THE Listagem_Paginada SHALL display a table with columns: Número, Série, Chave de Acesso, Destinatário, Valor, Status, Data Emissão
2. THE Listagem_Paginada SHALL fetch data from `GET /api/fiscal/nfe` with server-side pagination parameters (page, limit)
3. WHEN the user changes the page, THE Listagem_Paginada SHALL fetch the corresponding page from the API and update the table
4. WHEN the user applies a filter (status, período, destinatário), THE Listagem_Paginada SHALL send filter parameters to the API and refresh results
5. THE Listagem_Paginada SHALL display status badges with colors: PENDENTE (gray), AUTORIZADA (green), REJEITADA (red), CANCELADA (orange), DENEGADA (yellow)

---

### Requirement 4: Emissão de NF-e

**User Story:** As a fiscal operator, I want to create and emit NF-e, so that I can generate electronic invoices for sales operations.

#### Acceptance Criteria

1. WHEN the user clicks "Nova NF-e" on the NF-e list page, THE Formulario_Emissao SHALL display a multi-step form with sections: Dados Gerais, Destinatário, Itens, Transporte, Pagamento, Informações Complementares
2. WHEN the user adds an item, THE Formulario_Emissao SHALL allow selecting a product and invoke the Motor Tributário for automatic tax calculation
3. WHEN the user submits the form, THE Formulario_Emissao SHALL validate all fields client-side and POST to `POST /api/fiscal/nfe/emitir`
4. IF the API returns a success response with status AUTORIZADA, THEN THE Modulo_Fiscal_Frontend SHALL display a success notification with the protocol number and redirect to the NF-e detail view
5. IF the API returns a rejection or error, THEN THE Modulo_Fiscal_Frontend SHALL display an error notification with the rejection reason from SEFAZ
6. IF the API returns status CONTINGENCIA, THEN THE Modulo_Fiscal_Frontend SHALL display an info notification informing the document was queued for retransmission

---

### Requirement 5: Cancelamento e Carta de Correção de NF-e

**User Story:** As a fiscal operator, I want to cancel an authorized NF-e or issue a CC-e, so that I can correct fiscal documents as legally required.

#### Acceptance Criteria

1. WHEN the user clicks "Cancelar" on an authorized NF-e, THE Modulo_Fiscal_Frontend SHALL open a modal requesting justification (minimum 15 characters)
2. WHEN the user confirms the cancellation, THE Modulo_Fiscal_Frontend SHALL POST to `POST /api/fiscal/nfe/{id}/cancelar` with the justification
3. IF the cancellation is successful, THEN THE Modulo_Fiscal_Frontend SHALL update the NF-e status to CANCELADA and display a success notification
4. WHEN the user clicks "Carta de Correção" on an authorized NF-e, THE Modulo_Fiscal_Frontend SHALL open a modal with a text area for the correction text (minimum 15 characters)
5. WHEN the user submits the CC-e, THE Modulo_Fiscal_Frontend SHALL POST to `POST /api/fiscal/nfe/{id}/cce` and display the result

---

### Requirement 6: Emissão de NFC-e

**User Story:** As a fiscal operator, I want to emit NFC-e for consumer sales, so that I can issue point-of-sale electronic invoices.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/nfce`, THE Listagem_Paginada SHALL display all NFC-e with columns: Número, Série, Consumidor, Valor Total, Status, Data
2. WHEN the user clicks "Nova NFC-e", THE Formulario_Emissao SHALL display a simplified form (consumidor opcional, itens, pagamento)
3. WHEN the form is submitted, THE Formulario_Emissao SHALL POST to `POST /api/fiscal/nfce/emitir`
4. IF the emission is successful, THEN THE Modulo_Fiscal_Frontend SHALL display the DANFCE link for printing

---

### Requirement 7: Motor Tributário — CRUD de Regras

**User Story:** As a fiscal administrator, I want to manage tax rules, so that I can configure automatic tax calculation for all fiscal operations.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/motor-tributario`, THE Listagem_Paginada SHALL display all tax rules with columns: NCM, CFOP, UF Origem, UF Destino, Regime, CST/CSOSN, Alíq. ICMS, Alíq. PIS, Alíq. COFINS
2. WHEN the user clicks "Nova Regra", THE Formulario_Emissao SHALL display a form with all fields of a tax rule (NCM, CFOP, UF origem, UF destino, regime tributário, CST/CSOSN, alíquotas, bases de cálculo)
3. WHEN the user submits the form, THE Modulo_Fiscal_Frontend SHALL POST to `POST /api/fiscal/motor-tributario` and refresh the list
4. WHEN the user clicks "Editar" on a rule, THE Formulario_Emissao SHALL load the existing data via `GET /api/fiscal/motor-tributario/{id}` and display the edit form
5. WHEN the user clicks "Excluir" on a rule, THE Modulo_Fiscal_Frontend SHALL request confirmation and DELETE via `DELETE /api/fiscal/motor-tributario/{id}`
6. WHEN the user uses the search bar, THE Motor_Tributario_UI SHALL filter rules by NCM, CFOP or UF using query parameters sent to the API

---

### Requirement 8: Motor Tributário — Simulação de Busca com Fallback

**User Story:** As a fiscal administrator, I want to simulate tax rule lookups, so that I can verify which rule applies for a given NCM+CFOP+UF combination and understand the fallback level.

#### Acceptance Criteria

1. WHEN the user fills the simulation form (NCM, CFOP, UF Origem, UF Destino, Regime) and clicks "Simular", THE Motor_Tributario_UI SHALL call `POST /api/fiscal/motor-tributario/simular` with the parameters
2. WHEN the API responds, THE Motor_Tributario_UI SHALL display the matched rule with its fallback level (Exato, NCM parcial, CFOP genérico, Padrão regime)
3. IF no rule is found, THEN THE Motor_Tributario_UI SHALL display a warning indicating the item would be blocked

---

### Requirement 9: Cadastros Fiscais — NCM

**User Story:** As a fiscal administrator, I want to manage the NCM table, so that I can maintain the product classification codes used in fiscal documents.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/cadastros/ncm`, THE Listagem_Paginada SHALL display NCM records with columns: Código, Descrição, Alíquota IPI, Ex TIPI
2. WHEN the user clicks "Novo NCM", THE Modulo_Fiscal_Frontend SHALL display a creation form with validation (código: 8 dígitos numéricos)
3. WHEN the user searches by code or description, THE Listagem_Paginada SHALL filter results using the search parameter sent to `GET /api/fiscal/cadastros/ncm`
4. THE Modulo_Fiscal_Frontend SHALL support edit and delete operations for NCM records

---

### Requirement 10: Cadastros Fiscais — CFOP

**User Story:** As a fiscal administrator, I want to manage the CFOP table, so that I can maintain fiscal operation codes.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/cadastros/cfop`, THE Listagem_Paginada SHALL display CFOP records with columns: Código, Descrição, Tipo (Entrada/Saída)
2. WHEN the user clicks "Novo CFOP", THE Modulo_Fiscal_Frontend SHALL display a creation form with validation (código: 4 dígitos numéricos)
3. THE Modulo_Fiscal_Frontend SHALL support search, edit and delete operations for CFOP records

---

### Requirement 11: Cadastros Fiscais — CEST, CST/CSOSN, Natureza de Operação

**User Story:** As a fiscal administrator, I want to manage CEST, CST/CSOSN and Nature of Operation tables, so that I can maintain all auxiliary fiscal codes.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/cadastros/cest`, THE Listagem_Paginada SHALL display CEST records with columns: Código, Descrição, NCMs vinculados
2. WHEN the user navigates to `/fiscal/cadastros/cst-csosn`, THE Listagem_Paginada SHALL display CST and CSOSN codes with columns: Código, Tipo (CST/CSOSN), Descrição
3. WHEN the user navigates to `/fiscal/cadastros/natureza-operacao`, THE Listagem_Paginada SHALL display Nature of Operation records with columns: Código, Descrição, CFOP padrão, Tipo (Entrada/Saída)
4. THE Modulo_Fiscal_Frontend SHALL support CRUD operations (create, read, update, delete) for each of the three cadastros above
5. THE Modulo_Fiscal_Frontend SHALL provide search functionality by code or description for all three cadastros

---

### Requirement 12: SPED — Geração de Obrigações Acessórias

**User Story:** As a fiscal accountant, I want to generate SPED files, so that I can comply with accessory obligation requirements.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/sped`, THE SPED_UI SHALL display options to generate: EFD ICMS/IPI, EFD Contribuições, ECD, ECF, Reinf
2. WHEN the user selects a SPED type and defines the period (mês/ano), THE SPED_UI SHALL display a "Gerar" button
3. WHEN the user clicks "Gerar", THE SPED_UI SHALL POST to `POST /api/fiscal/sped/{tipo}/gerar` with period parameters and display a loading state
4. WHEN the generation completes, THE SPED_UI SHALL provide a download link for the generated file
5. IF the generation fails, THEN THE SPED_UI SHALL display the error message returned by the API
6. THE SPED_UI SHALL display a history of previously generated SPED files with date, type, status and download link

---

### Requirement 13: Apuração de Impostos

**User Story:** As a fiscal accountant, I want to view and calculate tax assessments by period, so that I can determine tax liabilities.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/apuracao`, THE Apuracao_UI SHALL display tabs for: ICMS, ICMS-ST, PIS/COFINS, IPI
2. WHEN the user selects a tax type and period (mês/ano), THE Apuracao_UI SHALL fetch the assessment from `GET /api/fiscal/apuracao/{tipo}` with period parameters
3. THE Apuracao_UI SHALL display a summary with: Base de Cálculo, Créditos, Débitos, Saldo (a pagar ou a compensar)
4. WHEN the user clicks "Recalcular", THE Apuracao_UI SHALL POST to `POST /api/fiscal/apuracao/{tipo}/calcular` and refresh the displayed values
5. IF no data exists for the selected period, THEN THE Apuracao_UI SHALL display an empty state suggesting the user run the calculation

---

### Requirement 14: Gestão de Certificados Digitais

**User Story:** As a fiscal administrator, I want to manage digital certificates, so that I can ensure electronic documents can be signed.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/certificados`, THE Certificados_UI SHALL display a list of certificates with columns: Razão Social, CNPJ, Validade, Status (Válido/Expirado/Próximo do Vencimento)
2. WHEN the user clicks "Novo Certificado", THE Certificados_UI SHALL display an upload form accepting .pfx files with password field
3. WHEN the user submits the upload, THE Certificados_UI SHALL POST the file to `POST /api/fiscal/certificados/upload` as multipart/form-data
4. WHEN a certificate has less than 30 days until expiration, THE Certificados_UI SHALL display a warning badge "Próximo do Vencimento" in orange
5. WHEN a certificate is expired, THE Certificados_UI SHALL display an error badge "Expirado" in red
6. THE Certificados_UI SHALL allow deleting a certificate after confirmation

---

### Requirement 15: Contingência

**User Story:** As a fiscal operator, I want to monitor SEFAZ status and manage contingency queue, so that I can ensure documents are transmitted when services recover.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/contingencia`, THE Contingencia_UI SHALL display the current SEFAZ status (Online/Offline) fetched from `GET /api/fiscal/contingencia/status`
2. THE Contingencia_UI SHALL display the contingency queue with columns: Tipo Documento, Número, Data Enfileiramento, Tentativas, Status
3. WHEN the user clicks "Retransmitir" on a queued document, THE Contingencia_UI SHALL POST to `POST /api/fiscal/contingencia/{id}/retransmitir`
4. WHEN the user clicks "Retransmitir Todos", THE Contingencia_UI SHALL POST to `POST /api/fiscal/contingencia/retransmitir-todos` and display progress
5. THE Contingencia_UI SHALL auto-refresh the queue status every 30 seconds using React Query refetchInterval

---

### Requirement 16: GNRE

**User Story:** As a fiscal operator, I want to generate and manage GNRE payments, so that I can pay inter-state tax obligations.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/gnre`, THE GNRE_UI SHALL display a list of GNRE guias with columns: UF, Receita, Valor, Vencimento, Status (Gerada/Paga/Vencida)
2. WHEN the user clicks "Nova GNRE", THE GNRE_UI SHALL display a form to generate a new GNRE (UF destino, código receita, referência, valor, vencimento)
3. WHEN the form is submitted, THE GNRE_UI SHALL POST to `POST /api/fiscal/gnre/gerar`
4. THE GNRE_UI SHALL allow registering a payment against a GNRE via `POST /api/fiscal/gnre/{id}/pagar`
5. THE GNRE_UI SHALL display a consolidated summary of GNRE values by UF and status

---

### Requirement 17: Importação de XML

**User Story:** As a purchasing/fiscal operator, I want to import XML files from suppliers, so that I can create inbound entries from received invoices.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/importacao-xml`, THE Importacao_XML_UI SHALL display a list of previously imported XMLs with columns: Chave, Fornecedor, Valor, Data, Status (Importado/Processado/Erro)
2. WHEN the user clicks "Upload XML", THE Importacao_XML_UI SHALL display a dropzone accepting .xml files (single or batch)
3. WHEN files are uploaded, THE Importacao_XML_UI SHALL POST to `POST /api/fiscal/importacao/upload` as multipart/form-data
4. WHEN the user clicks on an imported XML, THE Importacao_XML_UI SHALL display the items and allow a de-para mapping (supplier product → internal product)
5. WHEN the user confirms the mapping and clicks "Gerar Entrada", THE Importacao_XML_UI SHALL POST to `POST /api/fiscal/importacao/{id}/gerar-entrada` to create the inbound document

---

### Requirement 18: CT-e, MDF-e, NFS-e

**User Story:** As a fiscal operator, I want to list and emit CT-e, MDF-e, and NFS-e, so that I can manage transport and service fiscal documents.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/cte`, THE Listagem_Paginada SHALL display all CT-e documents with columns: Número, Série, Tomador, Valor, Status, Data
2. WHEN the user navigates to `/fiscal/mdfe`, THE Listagem_Paginada SHALL display all MDF-e documents with columns: Número, Série, UF Carregamento, UF Descarregamento, Status, Data
3. WHEN the user navigates to `/fiscal/nfse`, THE Listagem_Paginada SHALL display all NFS-e documents with columns: Número, Tomador, Serviço, Valor, Status, Data
4. WHEN the user clicks "Novo CT-e", THE Formulario_Emissao SHALL display the CT-e emission form and POST to `POST /api/fiscal/cte/emitir`
5. WHEN the user clicks "Novo MDF-e", THE Formulario_Emissao SHALL display the MDF-e emission form and POST to `POST /api/fiscal/mdfe/emitir`
6. WHEN the user clicks "Nova NFS-e", THE Formulario_Emissao SHALL display the NFS-e emission form and POST to `POST /api/fiscal/nfse/emitir`

---

### Requirement 19: Manifesto do Destinatário (MDe)

**User Story:** As a fiscal operator, I want to manifest knowledge of received invoices, so that I can comply with SEFAZ destination manifest requirements.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/manifesto-destinatario`, THE MDe_UI SHALL display NF-e received (from DistDFe) with columns: Chave, Emitente, Valor, Data, Situação Manifesto
2. WHEN the user selects one or more NF-e and clicks an action button, THE MDe_UI SHALL allow manifesting: Ciência da Operação, Confirmação, Desconhecimento, Operação Não Realizada
3. WHEN the manifest action is submitted, THE MDe_UI SHALL POST to `POST /api/fiscal/manifesto/{chave}/{evento}` and display the result
4. THE MDe_UI SHALL allow filtering by: Período, Situação (Sem Manifesto, Ciência, Confirmada, Desconhecida), Emitente

---

### Requirement 20: Auditoria Fiscal

**User Story:** As a fiscal auditor, I want to consult the fiscal audit log, so that I can track all fiscal operations performed in the system.

#### Acceptance Criteria

1. WHEN the user navigates to `/fiscal/auditoria`, THE Auditoria_Fiscal_UI SHALL display a paginated table of audit logs with columns: Data/Hora, Usuário, Operação, Documento, Detalhes
2. WHEN the user applies filters (período, usuário, tipo de operação, documento), THE Auditoria_Fiscal_UI SHALL send filter parameters to `GET /api/fiscal/auditoria` and refresh results
3. WHEN the user clicks on a log entry, THE Auditoria_Fiscal_UI SHALL display a modal/drawer with the full log details (payload antes/depois)
4. THE Auditoria_Fiscal_UI SHALL display entries in descending chronological order by default

---

### Requirement 21: Hooks e Data Layer

**User Story:** As a developer, I want standardized React Query hooks for all fiscal endpoints, so that data fetching is consistent and cacheable across the module.

#### Acceptance Criteria

1. THE Modulo_Fiscal_Frontend SHALL provide custom hooks following the project's useCrudGenerico pattern for all CRUD endpoints (motor-tributario, certificados, cadastros/ncm, cadastros/cfop, cadastros/cest, cadastros/cst-csosn, cadastros/natureza-operacao, gnre)
2. THE Modulo_Fiscal_Frontend SHALL provide custom hooks with useQuery for read operations (dashboard metrics, apuracao, contingencia status, auditoria, manifesto) with appropriate staleTime and refetchInterval configurations
3. THE Modulo_Fiscal_Frontend SHALL provide custom hooks with useMutation for write operations (emissão, cancelamento, CC-e, upload certificado, retransmissão, gerar SPED, gerar entrada) that invalidate related query caches on success
4. THE Modulo_Fiscal_Frontend SHALL use the existing `api` instance from `@/lib/api` for all HTTP requests

---

### Requirement 22: Responsividade e UX

**User Story:** As a user, I want the fiscal module to be usable on desktop screens with consistent UI patterns, so that my experience is seamless with the rest of the system.

#### Acceptance Criteria

1. THE Modulo_Fiscal_Frontend SHALL use Mantine 7 components consistently (Table, Card, Button, Modal, Tabs, Badge, Pagination, TextInput, Select, DateInput, FileInput, LoadingOverlay)
2. THE Modulo_Fiscal_Frontend SHALL display loading states (LoadingOverlay or Skeleton) while data is being fetched
3. THE Modulo_Fiscal_Frontend SHALL display success and error notifications using the `@mantine/notifications` library following the existing project pattern
4. THE Modulo_Fiscal_Frontend SHALL display breadcrumb-style text (e.g., "Início / Fiscal / NF-e") at the top of each page for orientation
5. WHEN an API request fails, THE Modulo_Fiscal_Frontend SHALL display the error message from the API response in a red notification toast
