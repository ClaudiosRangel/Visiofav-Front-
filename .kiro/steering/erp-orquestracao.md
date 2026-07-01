---
inclusion: manual
---

# VisioFab ERP — Orquestração e Harmonia entre Módulos (Visão Frontend)

## Problemas de Integração Identificados

### 🔴 Modelo Legado NF-e vs. Novo DocumentoFiscal
- Vendas cria NF-e na tabela legada `nfe`, não no `documento_fiscal`
- O frontend fiscal consome `/api/fiscal/nfe` (DocumentoFiscal) 
- O frontend de vendas consome `/api/nfe` (legado)
- **Resultado:** NF-e emitidas por vendas NÃO aparecem no módulo fiscal

### 🟡 Financeiro Mínimo
- Frontend só tem 2 páginas: Contas a Pagar e Contas a Receber
- Sem integração bancária, boleto, PIX, conciliação, fluxo de caixa

### 🟡 Cadastros Básicos
- Clientes/Fornecedores sem múltiplos endereços, score crédito, consulta CNPJ

## Fluxo Ideal de Navegação (como o ERP deveria funcionar)

```
Vendas: Pedido → Confirmar → Efetivar
  ├── Gera NF-e automaticamente (visível em Fiscal > NF-e)
  ├── Gera Contas a Receber (visível em Financeiro > Contas a Receber)
  └── Entra no WMS para separação (visível em WMS > Separação)

Compras: Pedido → Confirmar → Efetivar (com XML)
  ├── Registra entrada fiscal (visível em Fiscal > NF-e entrada)
  ├── Gera Contas a Pagar (visível em Financeiro > Contas a Pagar)
  └── Agenda recebimento WMS (visível em WMS > Agenda)
```

## Sidebar (Frontend) — Módulos Registrados

| Módulo | Prefix | Status |
|--------|--------|--------|
| Compras | /compras | ✅ Funcional |
| Vendas | /vendas | ✅ Funcional |
| Financeiro | /financeiro | ⚠️ Mínimo (2 páginas) |
| Fiscal | /fiscal | ✅ Completo (20+ páginas) |
| WMS | /wms | ✅ Avançado |
| PCP | /pcp | ✅ Avançado |
| Configurador | /configurador | ✅ Cadastros básicos |

## Próximos Specs Frontend (alinhados com backend)

1. **erp-fiscal-completar-frontend** — Integrar página de DANFE, ajustar NF-e de vendas
2. **erp-financeiro-frontend** — Módulo completo (boleto, PIX, conciliação, fluxo caixa)
3. **erp-cadastros-completos-frontend** — Multi-endereço, consulta CNPJ, score crédito
4. **erp-vendas-avancado-frontend** — PDV, comissões avançadas, força de vendas
