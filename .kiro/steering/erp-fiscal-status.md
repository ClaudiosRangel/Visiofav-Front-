---
inclusion: manual
---

# Módulo Fiscal — Status e Referência Rápida (Frontend)

## O que está implementado no Frontend ✅

- 20+ páginas (Dashboard, NF-e, NFC-e, CT-e, MDF-e, NFS-e, Motor Tributário, Cadastros, SPED, Apuração, Certificados, Contingência, GNRE, Importação XML, Manifesto, Auditoria)
- 16 hooks React Query com cache invalidation
- Componentes reutilizáveis (ListagemFiscal, FormularioEmissao, StatusBadge, modais)
- Sidebar completa com 20+ itens organizados em grupos
- Error handling e notificações em todas as páginas
- useModuloGuard('FISCAL') em todas as páginas

## O que está implementado no Backend ✅

- Emissão real NF-e (XML layout 4.00 + assinatura XML-DSig + SOAP SEFAZ + mTLS)
- Cancelamento, CC-e, Inutilização (com transmissão SEFAZ)
- Motor tributário com fallback hierárquico
- Contingência automática (3 falhas → enfileira)
- Certificado A1 (upload PFX + validação + crypto)
- URLs SEFAZ todos os 27 estados
- Cadastros (NCM, CFOP, CEST, CST/CSOSN, Natureza Operação)
- SPED, Apuração, GNRE, Importação XML, Auditoria

## Gaps conhecidos

1. **DANFE PDF** — endpoint existe, renderer não implementado
2. **NFC-e/CT-e/MDF-e** — não têm builder XML próprio (usam estrutura genérica)
3. **Integração Vendas→Fiscal** — vendas usa modelo NF-e legado, não DocumentoFiscal
4. **Testes em homologação** — precisa de certificado A1 real para validar

## Referência completa

Ver `#erp-fiscal-status` no backend para documentação técnica detalhada.
Ver `#erp-orquestracao` para análise de integração entre módulos.
