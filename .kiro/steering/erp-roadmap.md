---
inclusion: manual
---

# VisioFab ERP — Roadmap Completo e Contexto do Projeto

## Visão Geral

O VisioFab está evoluindo de um WMS especializado para um **ERP completo** focado no mercado brasileiro. O diferencial competitivo é a combinação de WMS nativo sofisticado + ERP com UX moderna + preço acessível — um posicionamento que nenhum concorrente ocupa bem hoje no Brasil.

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend Web | Next.js 15 (App Router) + Mantine 7 + React Query + Axios |
| Backend API | Fastify + Prisma 6 + PostgreSQL (Neon) + Zod |
| App Mobile | React Native (Expo) |
| Deploy Frontend | Vercel |
| Deploy Backend | Render |
| Testes | Vitest + Playwright + fast-check |

## Posicionamento Competitivo

- **Contra Bling/Tiny**: Precisa de fiscal + financeiro + integrações marketplace
- **Contra Omie**: Fiscal mais robusto + contábil + WMS (já tem vantagem)
- **Contra TOTVS/Sankhya**: Não compete em 100% das features, mas fiscal e financeiro sólidos + UX moderna

## Módulos — Ordem de Implementação

### Prioridade 1 (Sem isso não vende ERP no Brasil)

| # | Módulo | Status | Spec Backend | Spec Frontend |
|---|--------|--------|--------------|---------------|
| 1 | **Fiscal** | ✅ Frontend completo, Backend implementado | `erp-modulo-fiscal` | `erp-modulo-fiscal-frontend` |
| 2 | **Financeiro** | 🔲 Não iniciado | — | — |
| 3 | **Cadastros Completos** | 🔲 Não iniciado | — | — |

### Prioridade 2 (Diferencial competitivo)

| # | Módulo | Status |
|---|--------|--------|
| 4 | **Vendas (Atacado + Varejo)** | Parcial (pedidos existem, falta PDV, força de vendas, comissões avançadas) |
| 5 | **Compras com MRP** | Parcial (pedido de compra existe, falta MRP, cotação, aprovações) |
| 6 | **PDV integrado** | 🔲 Não iniciado |
| 7 | **Força de vendas mobile** | 🔲 Não iniciado |
| 8 | **Régua de cobrança** | 🔲 Não iniciado |

### Prioridade 3 (Amadurecimento)

| # | Módulo | Status |
|---|--------|--------|
| 9 | **Contábil** | 🔲 Não iniciado (estratégia: exportar para Domínio/Fortes) |
| 10 | **BI/Dashboards** | Parcial (alguns KPIs existem) |
| 11 | **Integrações** | 🔲 Marketplaces, e-commerce, Open Finance |
| 12 | **CRM integrado** | 🔲 Pipeline de vendas |

## O que já existe (implementado)

### WMS (Completo e sofisticado)
- Recebimento com conferência (cego/parcial)
- Endereçamento inteligente (shelf life, capacidade, nível)
- Picking (wave, batch, zone)
- Roteirização e montagem de carga
- Cross-docking
- Abastecimento de picking
- Controle de pátio e doca
- Agenda de agendamento
- Etiquetas (GS1-128)
- KPIs em tempo real

### Módulo Fiscal (Backend + Frontend)
- Motor tributário (regras NCM × CFOP × UF × regime com fallback hierárquico)
- NF-e (emissão, cancelamento, CC-e, inutilização)
- NFC-e, CT-e, MDF-e, NFS-e
- SPED (geração EFD ICMS/IPI, Contribuições, ECD, ECF, Reinf)
- Apuração de impostos (ICMS, ICMS-ST, PIS/COFINS, IPI)
- Certificados digitais A1
- Contingência (fila + retransmissão automática)
- GNRE
- Importação de XML
- Manifesto do destinatário
- Auditoria fiscal

### Vendas (Parcial)
- Pedidos de venda
- Tabelas de preço
- Vendas efetivadas
- Entregas
- Comissões (básico)

### Compras (Parcial)
- Pedidos de compra
- Importação XML NF-e
- Compras efetivadas
- Devoluções
- Transferências

### Financeiro (Básico)
- Contas a pagar
- Contas a receber

### Cadastros (Básico)
- Clientes
- Fornecedores
- Produtos
- Transportadoras

## Próximo Módulo a Implementar: Financeiro

### Escopo do Módulo Financeiro

**Integração Bancária:**
- CNAB 240/400 (remessa e retorno para todos bancos principais)
- PIX via API (QR code dinâmico, cobrança, baixa automática)
- DDA (Débito Direto Autorizado)
- Conciliação bancária automática (OFX + matching inteligente)

**Contas a Pagar:**
- Provisão e fluxo de caixa
- Borderô de pagamento em lote
- Adiantamento a fornecedor
- Rateio por centro de custo / projeto

**Contas a Receber:**
- Boleto registrado com todos os bancos (emissão + retorno)
- Aging / inadimplência
- Régua de cobrança automatizada (email, SMS, WhatsApp)
- Score de crédito do cliente

**Tesouraria:**
- Fluxo de caixa projetado vs. realizado
- Multi-conta bancária
- Controle de cheques (custódia, compensação, devolução)
- Conciliação de cartões (TEF × operadora × liquidação)

**Contratos:**
- Gestão de contratos recorrentes (mensalidade, aluguel)
- Faturamento automático recorrente

## Gaps Conhecidos por Módulo

### Fiscal (para completar)
- NFC-e com integração SAT/MFe
- NFS-e multi-município (webservices diferentes por prefeitura)
- SPED Fiscal completo (registros de ajuste, ressarcimento ST)
- SPED Reinf / DCTF-Web
- GNRE automática para ST interestadual

### Vendas (para completar)
- PDV/Frente de caixa (TEF, SAT, impressora fiscal)
- Força de vendas mobile (catálogo, pedido offline)
- Hub de integração com marketplaces
- Venda consignada
- Comissionamento avançado (escalonado, por meta, split)
- Controle de crédito com score e bloqueio automático
- Tabelas de preço com vigência, região e canal
- Workflow de aprovação de desconto

### Compras (para completar)
- MRP (cálculo de necessidade baseado em demanda/estoque mínimo)
- Mapa de cotação com scoring automático
- Workflow de aprovação (por alçada/valor)
- Avaliação de desempenho de fornecedor
- Compra para importação (desembaraço)
- Contratos de fornecimento com reajuste

### Cadastros (para completar)
- Consulta automática CNPJ (API Receita Federal / BrasilAPI)
- Consulta SINTEGRA/SUFRAMA
- Score de crédito configurável
- Grupo econômico com consolidação
- Múltiplos endereços tipados (entrega, cobrança, fiscal)
- Anexos de documentos
- Integração SPC/Serasa

## Regras de Desenvolvimento

1. **Um spec por módulo** — cada módulo tem seu próprio spec (requirements → design → tasks)
2. **Backend primeiro** — implementar API antes do frontend
3. **Padrões existentes** — seguir os mesmos patterns do projeto (useCrudGenerico, ListagemFiscal, FormularioEmissao, etc.)
4. **Incremental** — cada módulo constrói sobre o anterior
5. **Testes** — property tests com fast-check para lógica de negócio crítica

## Referências de Specs Existentes

- Backend Fiscal: `c:\Source\VisioFab.Wms.Back\.kiro\specs\erp-modulo-fiscal\`
- Frontend Fiscal: `c:\Source\VisioFab.Wms.Front\.kiro\specs\erp-modulo-fiscal-frontend\`
- WMS specs: múltiplos em `c:\Source\VisioFab.Wms.Back\.kiro\specs\`
