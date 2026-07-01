# Implementation Plan: ERP Módulo Fiscal — Frontend

## Overview

Implementação incremental do módulo fiscal frontend: primeiro componentes reutilizáveis e hooks de dados, depois páginas de listagem/emissão de documentos fiscais, cadastros, obrigações acessórias e utilitários. Cada etapa constrói sobre a anterior, integrando tudo via sidebar modular e navegação consistente.

## Tasks

- [x] 1. Criar componentes reutilizáveis do módulo fiscal
  - [x] 1.1 Criar componente ListagemFiscal
    - Criar `src/components/fiscal/ListagemFiscal.tsx`
    - Implementar tabela genérica paginada com props: queryKey, endpoint, columns, filters, actions, title, breadcrumb, createButton, statusColors
    - Usar Mantine Table, Pagination, TextInput (busca), LoadingOverlay
    - Integrar com useQuery para fetch paginado (page, limit, busca)
    - Exibir empty state quando data.length === 0
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 22.1, 22.2_

  - [x] 1.2 Criar componente StatusBadge
    - Criar `src/components/fiscal/StatusBadge.tsx`
    - Implementar Badge colorido que recebe status string e colorMap opcional
    - Usar mapa padrão FISCAL_STATUS_COLORS do design (PENDENTE→gray, AUTORIZADA→green, REJEITADA→red, CANCELADA→orange, DENEGADA→yellow, CONTINGENCIA→blue)
    - Fallback para 'gray' se status não encontrado no mapa
    - _Requirements: 3.5, 22.1_


  - [x] 1.3 Criar componente FormularioEmissao
    - Criar `src/components/fiscal/FormularioEmissao.tsx`
    - Implementar form multi-step com Stepper do Mantine
    - Props: tipo, steps (StepConfig[]), onSubmit, initialData, title, breadcrumb
    - Validação client-side por step antes de avançar
    - Botão final "Emitir" desabilitado durante submissão (isPending)
    - _Requirements: 4.1, 4.3, 22.1_

  - [x] 1.4 Criar componentes auxiliares (FiltrosPeriodo, ModalCancelamento, ModalCartaCorrecao)
    - Criar `src/components/fiscal/FiltrosPeriodo.tsx` — DateInput de período (data início/fim)
    - Criar `src/components/fiscal/ModalCancelamento.tsx` — Modal com textarea justificativa (min 15 chars)
    - Criar `src/components/fiscal/ModalCartaCorrecao.tsx` — Modal com textarea texto correção (min 15 chars)
    - _Requirements: 5.1, 5.4, 22.1_

  - [ ]* 1.5 Escrever property test para StatusBadge
    - **Property 5: Status Badges Determinísticos**
    - Criar `src/components/fiscal/__tests__/StatusBadge.test.tsx` usando vitest + fast-check
    - Para qualquer string de status, a cor retornada é sempre uma cor Mantine válida (do mapa ou 'gray' fallback)
    - **Validates: Requirements 3.5**

  - [ ]* 1.6 Escrever property test para paginação do ListagemFiscal
    - **Property 3: Paginação Consistente**
    - Criar `src/components/fiscal/__tests__/ListagemFiscal.test.tsx` usando vitest + fast-check
    - Para qualquer combinação de total/limit/page, a página sanitizada nunca é < 1 e nunca excede totalPages
    - **Validates: Requirements 3.2, 3.3**

- [x] 2. Criar hooks de dados fiscais (camada de data layer)
  - [x] 2.1 Criar hooks CRUD genéricos fiscais
    - Criar `src/data/hooks/fiscal/useCadastrosFiscais.ts`
    - Exportar instâncias de useCrudGenerico para: ncm, cfop, cest, cst-csosn, natureza-operacao, motor-tributario, gnre, certificados
    - Usar queryKeys hierárquicas (ex: ['fiscal', 'ncm'], ['fiscal', 'motor-tributario'])
    - _Requirements: 21.1, 21.4_

  - [x] 2.2 Criar hook useNfe
    - Criar `src/data/hooks/fiscal/useNfe.ts`
    - Implementar useListar (GET /fiscal/nfe com params), useDetalhe (GET /fiscal/nfe/{id}), useEmitir (POST /fiscal/nfe/emitir), useCancelar (POST /fiscal/nfe/{id}/cancelar), useCartaCorrecao (POST /fiscal/nfe/{id}/cce)
    - Invalidar queryKey ['fiscal', 'nfe'] no onSuccess de mutations
    - staleTime: 2min para listagem
    - _Requirements: 3.2, 4.3, 5.2, 5.5, 21.2, 21.3_

  - [x] 2.3 Criar hooks useNfce, useCte, useMdfe, useNfse
    - Criar `src/data/hooks/fiscal/useNfce.ts` — useListar + useEmitir para /fiscal/nfce
    - Criar `src/data/hooks/fiscal/useCte.ts` — useListar + useEmitir para /fiscal/cte
    - Criar `src/data/hooks/fiscal/useMdfe.ts` — useListar + useEmitir para /fiscal/mdfe
    - Criar `src/data/hooks/fiscal/useNfse.ts` — useListar + useEmitir para /fiscal/nfse
    - Seguir mesmo padrão do useNfe com invalidação de cache
    - _Requirements: 6.3, 18.4, 18.5, 18.6, 21.2, 21.3_

  - [x] 2.4 Criar hook useMotorTributario
    - Criar `src/data/hooks/fiscal/useMotorTributario.ts`
    - Implementar useSimular (POST /fiscal/motor-tributario/simular) retornando SimulacaoMotorResponse
    - _Requirements: 8.1, 21.3_

  - [x] 2.5 Criar hooks especializados (useSped, useApuracao, useContingencia, useDashboardFiscal)
    - Criar `src/data/hooks/fiscal/useSped.ts` — useHistorico + useGerar
    - Criar `src/data/hooks/fiscal/useApuracao.ts` — useConsultar + useCalcular
    - Criar `src/data/hooks/fiscal/useContingencia.ts` — useStatus (refetchInterval: 30s), useFila, useRetransmitir, useRetransmitirTodos
    - Criar `src/data/hooks/fiscal/useDashboardFiscal.ts` — useQuery com staleTime 5min
    - _Requirements: 2.2, 12.3, 13.2, 13.4, 15.1, 15.5, 21.2_

  - [x] 2.6 Criar hooks utilitários (useCertificados, useImportacaoXml, useManifesto, useAuditoriaFiscal, useGnre)
    - Criar `src/data/hooks/fiscal/useCertificados.ts` — useUpload (multipart/form-data)
    - Criar `src/data/hooks/fiscal/useImportacaoXml.ts` — useListar, useUpload, useGerarEntrada
    - Criar `src/data/hooks/fiscal/useManifesto.ts` — useListar + useManifestar
    - Criar `src/data/hooks/fiscal/useAuditoriaFiscal.ts` — useListar com filtros
    - Criar `src/data/hooks/fiscal/useGnre.ts` — usePagar (POST /fiscal/gnre/{id}/pagar)
    - _Requirements: 14.3, 16.4, 17.3, 19.3, 20.2, 21.2, 21.3_

  - [ ]* 2.7 Escrever property test para cache invalidation
    - **Property 2: Cache Invalidation Correta**
    - Criar `src/data/hooks/fiscal/__tests__/cacheInvalidation.test.ts` usando vitest + fast-check
    - Para qualquer mutação fiscal bem-sucedida, a queryKey correspondente é invalidada
    - Testar que após emitir/cancelar NF-e, a query ['fiscal', 'nfe'] é refetchada
    - **Validates: Requirements 21.3**

- [x] 3. Checkpoint — Hooks e componentes reutilizáveis completos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Configurar sidebar fiscal e navegação
  - [x] 4.1 Adicionar módulo Fiscal no ModuleSidebar
    - Modificar `src/components/layout/ModuleSidebar.tsx`
    - Adicionar entrada 'fiscal' no MODULE_MENUS com grupos: Documentos (NF-e, NFC-e, CT-e, MDF-e, NFS-e), Motor Tributário (Regras, Simular), Cadastros (NCM, CFOP, CEST, CST/CSOSN, Natureza Operação), Obrigações (SPED, Apuração, GNRE), Utilitários (Certificados, Contingência, Importação XML, Manifesto Dest., Auditoria)
    - Incluir ícones corretos do @tabler/icons-react para cada item
    - Incluir Dashboard como primeiro item
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.2 Escrever property test para navegação completa
    - **Property 1: Navegação Completa**
    - Criar `src/components/fiscal/__tests__/sidebarFiscal.test.ts` usando vitest + fast-check
    - Para qualquer entry.href no menu fiscal, a rota é uma string não-vazia que inicia com '/fiscal/'
    - Todas as 20 entradas requeridas estão presentes no menu
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 5. Implementar Dashboard Fiscal
  - [x] 5.1 Criar página /fiscal/dashboard
    - Criar `src/app/(interna)/fiscal/dashboard/page.tsx`
    - Renderizar breadcrumb "Início / Fiscal / Dashboard"
    - Exibir 5 cards de métricas: NF-e emitidas, NF-e pendentes, valor faturado, certificados expirando, documentos em contingência
    - Usar useDashboardFiscal() para dados, LoadingOverlay durante loading
    - Exibir notificação vermelha e empty state se API retornar erro
    - Invocar useModuloGuard('FISCAL')
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 22.2, 22.4_

  - [ ]* 5.2 Escrever testes do Dashboard Fiscal
    - Criar `src/app/(interna)/fiscal/dashboard/__tests__/page.test.tsx`
    - Testar renderização dos 5 cards com dados mockados
    - Testar loading overlay enquanto isLoading=true
    - Testar fallback empty state quando API retorna erro
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 6. Implementar listagem e emissão de NF-e
  - [x] 6.1 Criar página de listagem /fiscal/nfe
    - Criar `src/app/(interna)/fiscal/nfe/page.tsx`
    - Usar ListagemFiscal com colunas: Número, Série, Chave de Acesso, Destinatário, Valor, Status, Data Emissão
    - Integrar StatusBadge para coluna Status
    - Adicionar filtros: status (Select), período (DateInput), destinatário (TextInput)
    - Botão "Nova NF-e" redireciona para /fiscal/nfe/nova
    - Ações na tabela: "Cancelar" e "Carta de Correção" (apenas para AUTORIZADA)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.4_

  - [x] 6.2 Criar página de emissão /fiscal/nfe/nova
    - Criar `src/app/(interna)/fiscal/nfe/nova/page.tsx`
    - Usar FormularioEmissao com steps: Dados Gerais, Destinatário, Itens, Transporte, Pagamento, Info Complementares
    - Ao adicionar item, permitir seleção de produto com busca no motor tributário
    - No submit, chamar useNfe().useEmitir().mutate(payload)
    - Tratar respostas: AUTORIZADA→notif verde+redirect, REJEITADA→notif vermelha, CONTINGENCIA→notif info
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 22.3_

  - [x] 6.3 Implementar cancelamento e CC-e de NF-e
    - Integrar ModalCancelamento na página de listagem NF-e
    - Ao confirmar cancelamento, chamar useNfe().useCancelar() com justificativa
    - Integrar ModalCartaCorrecao na página de listagem NF-e
    - Ao submeter CC-e, chamar useNfe().useCartaCorrecao() com texto correção
    - Exibir notificações de sucesso/erro
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 22.3, 22.5_

  - [ ]* 6.4 Escrever property test para formulário de emissão NF-e
    - **Property 4: Formulário de Emissão — Validação**
    - Criar `src/app/(interna)/fiscal/nfe/__tests__/emissao.test.ts` usando vitest + fast-check
    - Para qualquer combinação de campos obrigatórios vazios, o formulário não permite submissão
    - Campos obrigatórios preenchidos com valores válidos permitem submissão
    - **Validates: Requirements 4.3, 6.3**

- [ ] 7. Implementar NFC-e, CT-e, MDF-e, NFS-e
  - [x] 7.1 Criar páginas de listagem e emissão NFC-e
    - Criar `src/app/(interna)/fiscal/nfce/page.tsx` — Listagem com colunas: Número, Série, Consumidor, Valor Total, Status, Data
    - Criar `src/app/(interna)/fiscal/nfce/nova/page.tsx` — Formulário simplificado (consumidor opcional, itens, pagamento)
    - No sucesso, exibir link DANFCE para impressão
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Criar páginas de listagem e emissão CT-e
    - Criar `src/app/(interna)/fiscal/cte/page.tsx` — Listagem com colunas: Número, Série, Tomador, Valor, Status, Data
    - Criar `src/app/(interna)/fiscal/cte/nova/page.tsx` — Formulário CT-e, POST para /fiscal/cte/emitir
    - _Requirements: 18.1, 18.4_

  - [x] 7.3 Criar páginas de listagem e emissão MDF-e
    - Criar `src/app/(interna)/fiscal/mdfe/page.tsx` — Listagem com colunas: Número, Série, UF Carregamento, UF Descarregamento, Status, Data
    - Criar `src/app/(interna)/fiscal/mdfe/nova/page.tsx` — Formulário MDF-e, POST para /fiscal/mdfe/emitir
    - _Requirements: 18.2, 18.5_

  - [x] 7.4 Criar páginas de listagem e emissão NFS-e
    - Criar `src/app/(interna)/fiscal/nfse/page.tsx` — Listagem com colunas: Número, Tomador, Serviço, Valor, Status, Data
    - Criar `src/app/(interna)/fiscal/nfse/nova/page.tsx` — Formulário NFS-e, POST para /fiscal/nfse/emitir
    - _Requirements: 18.3, 18.6_

- [x] 8. Checkpoint — Documentos fiscais completos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implementar Motor Tributário
  - [x] 9.1 Criar página de regras /fiscal/motor-tributario
    - Criar `src/app/(interna)/fiscal/motor-tributario/page.tsx`
    - Usar ListagemFiscal com colunas: NCM, CFOP, UF Origem, UF Destino, Regime, CST/CSOSN, Alíq. ICMS, Alíq. PIS, Alíq. COFINS
    - Botão "Nova Regra" abre formulário (modal ou página)
    - Ações: Editar (carrega dados via GET), Excluir (confirmação + DELETE)
    - Barra de busca filtrando por NCM, CFOP ou UF
    - Usar motorTributarioCrud do useCadastrosFiscais
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 9.2 Criar página de simulação /fiscal/motor-tributario/simular
    - Criar `src/app/(interna)/fiscal/motor-tributario/simular/page.tsx`
    - Form com campos: NCM, CFOP, UF Origem, UF Destino, Regime Tributário
    - Botão "Simular" chama useMotorTributario().useSimular()
    - Exibir regra encontrada com Badge indicando nível de fallback (EXATO→green, NCM_PARCIAL→teal, CFOP_GENERICO→yellow, PADRAO_REGIME→orange)
    - Se nenhuma regra encontrada, exibir Alert warning "item seria bloqueado"
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Implementar Cadastros Fiscais
  - [x] 10.1 Criar página NCM /fiscal/cadastros/ncm
    - Criar `src/app/(interna)/fiscal/cadastros/ncm/page.tsx`
    - Usar ListagemFiscal com colunas: Código, Descrição, Alíquota IPI, Ex TIPI
    - CRUD completo via ncmCrud: criar (validação 8 dígitos), editar, excluir
    - Busca por código ou descrição
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.2 Criar página CFOP /fiscal/cadastros/cfop
    - Criar `src/app/(interna)/fiscal/cadastros/cfop/page.tsx`
    - Usar ListagemFiscal com colunas: Código, Descrição, Tipo (Entrada/Saída)
    - CRUD completo via cfopCrud: criar (validação 4 dígitos), editar, excluir
    - Busca por código ou descrição
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 10.3 Criar páginas CEST, CST/CSOSN e Natureza de Operação
    - Criar `src/app/(interna)/fiscal/cadastros/cest/page.tsx` — colunas: Código, Descrição, NCMs vinculados; CRUD via cestCrud
    - Criar `src/app/(interna)/fiscal/cadastros/cst-csosn/page.tsx` — colunas: Código, Tipo (CST/CSOSN), Descrição; CRUD via cstCsosnCrud
    - Criar `src/app/(interna)/fiscal/cadastros/natureza-operacao/page.tsx` — colunas: Código, Descrição, CFOP padrão, Tipo; CRUD via naturezaOperacaoCrud
    - Busca por código ou descrição em todas
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 10.4 Escrever testes unitários dos cadastros fiscais
    - Criar `src/app/(interna)/fiscal/cadastros/__tests__/cadastros.test.tsx`
    - Testar renderização de cada listagem com dados mockados
    - Testar validação de código NCM (8 dígitos) e CFOP (4 dígitos)
    - Testar fluxo de criação → sucesso → refresh da listagem
    - _Requirements: 9.2, 10.2, 11.4_

- [x] 11. Checkpoint — Motor tributário e cadastros completos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implementar SPED e Apuração de Impostos
  - [x] 12.1 Criar página SPED /fiscal/sped
    - Criar `src/app/(interna)/fiscal/sped/page.tsx`
    - Exibir Select de tipo SPED (EFD ICMS/IPI, EFD Contribuições, ECD, ECF, Reinf)
    - Inputs de período (mês/ano)
    - Botão "Gerar" chama useSped().useGerar() com loading state
    - No sucesso, exibir link de download do arquivo gerado
    - Exibir tabela com histórico de gerações: data, tipo, status, download
    - Exibir notificação vermelha se geração falhar
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 12.2 Criar página Apuração /fiscal/apuracao
    - Criar `src/app/(interna)/fiscal/apuracao/page.tsx`
    - Tabs Mantine para: ICMS, ICMS-ST, PIS/COFINS, IPI
    - Inputs de período (mês/ano) por tab
    - Exibir resumo: Base de Cálculo, Créditos, Débitos, Saldo
    - Botão "Recalcular" chama useApuracao().useCalcular() e atualiza valores
    - Empty state quando não há dados para o período selecionado
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 13. Implementar Certificados Digitais
  - [x] 13.1 Criar página Certificados /fiscal/certificados
    - Criar `src/app/(interna)/fiscal/certificados/page.tsx`
    - Listagem com colunas: Razão Social, CNPJ, Validade, Status
    - Badges de status: Válido (green), Próximo do Vencimento <30 dias (orange), Expirado (red)
    - Botão "Novo Certificado" abre modal/form com FileInput (.pfx) e PasswordInput (senha)
    - Upload via useCertificados().useUpload() como multipart/form-data
    - Ação "Excluir" com confirmação via certificadosCrud
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 13.2 Escrever property test para indicação de vencimento de certificados
    - **Property 7: Certificados — Indicação de Vencimento**
    - Criar `src/app/(interna)/fiscal/certificados/__tests__/vencimento.test.ts` usando vitest + fast-check
    - Para qualquer diasParaVencer: <0 → 'EXPIRADO'/red, 0-29 → 'PROXIMO_VENCIMENTO'/orange, ≥30 → 'VALIDO'/green
    - **Validates: Requirements 14.4, 14.5**

- [x] 14. Implementar Contingência
  - [x] 14.1 Criar página Contingência /fiscal/contingencia
    - Criar `src/app/(interna)/fiscal/contingencia/page.tsx`
    - Exibir status SEFAZ (Badge Online/green ou Offline/red) via useContingencia().useStatus()
    - Tabela de fila com colunas: Tipo Documento, Número, Data Enfileiramento, Tentativas, Status
    - Botão "Retransmitir" por item (chama useRetransmitir)
    - Botão "Retransmitir Todos" no topo (chama useRetransmitirTodos com loading)
    - Auto-refresh via refetchInterval: 30_000 (30s)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 14.2 Escrever property test para auto-refresh de contingência
    - **Property 6: Contingência — Auto-refresh**
    - Criar `src/app/(interna)/fiscal/contingencia/__tests__/autoRefresh.test.ts` usando vitest
    - Verificar que useStatus e useFila possuem refetchInterval de 30_000ms configurado
    - **Validates: Requirements 15.5**

- [x] 15. Implementar GNRE
  - [x] 15.1 Criar página GNRE /fiscal/gnre
    - Criar `src/app/(interna)/fiscal/gnre/page.tsx`
    - Listagem com colunas: UF, Receita, Valor, Vencimento, Status (Gerada/Paga/Vencida com badges)
    - Botão "Nova GNRE" abre form (UF destino, código receita, referência, valor, vencimento)
    - Submit via gnreCrud.useCriar ou POST /fiscal/gnre/gerar
    - Ação "Registrar Pagamento" chama useGnre().usePagar()
    - Resumo consolidado por UF e status (cards ou tabela resumo)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 16. Checkpoint — Obrigações e utilitários parciais completos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implementar Importação XML
  - [x] 17.1 Criar página Importação XML /fiscal/importacao-xml
    - Criar `src/app/(interna)/fiscal/importacao-xml/page.tsx`
    - Listagem de XMLs importados: Chave, Fornecedor, Valor, Data, Status (Importado/Processado/Erro)
    - Botão "Upload XML" abre Dropzone aceita .xml (single ou batch)
    - Upload via useImportacaoXml().useUpload() como multipart/form-data
    - Ao clicar em XML importado, exibir itens com de-para (produto fornecedor → produto interno)
    - Botão "Gerar Entrada" chama useImportacaoXml().useGerarEntrada()
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 17.2 Escrever property test para upload multipart
    - **Property 8: Upload Multipart**
    - Criar `src/data/hooks/fiscal/__tests__/uploadMultipart.test.ts` usando vitest
    - Verificar que useUpload envia FormData com Content-Type multipart/form-data
    - Testar para certificado (.pfx) e XML (.xml)
    - **Validates: Requirements 14.3, 17.3**

- [x] 18. Implementar Manifesto do Destinatário
  - [x] 18.1 Criar página Manifesto /fiscal/manifesto-destinatario
    - Criar `src/app/(interna)/fiscal/manifesto-destinatario/page.tsx`
    - Listagem de NF-e recebidas: Chave, Emitente, Valor, Data, Situação Manifesto
    - Filtros: Período (DateInput), Situação (Select), Emitente (TextInput)
    - Botões de ação por NF-e: Ciência, Confirmação, Desconhecimento, Não Realizada
    - Ao clicar ação, chamar useManifesto().useManifestar({ chave, evento })
    - Exibir notificação sucesso/erro
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [x] 19. Implementar Auditoria Fiscal
  - [x] 19.1 Criar página Auditoria /fiscal/auditoria
    - Criar `src/app/(interna)/fiscal/auditoria/page.tsx`
    - Listagem paginada: Data/Hora, Usuário, Operação, Documento, Detalhes
    - Filtros: período (DateInput), usuário (TextInput), tipo operação (Select), documento (TextInput)
    - Ordem decrescente por data/hora padrão
    - Ao clicar em log entry, exibir modal/drawer com detalhes completos (payload antes/depois)
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 20. Implementar tratamento de erros e notificações globais
  - [x] 20.1 Configurar error handling global e notificações
    - Verificar que todos os hooks de mutation possuem onError exibindo notificação vermelha
    - Mensagem extraída de `error.response.data.message` ou fallback "Erro ao processar operação"
    - Verificar que todas as páginas exibem LoadingOverlay durante loading
    - Verificar breadcrumb em todas as páginas fiscais
    - Verificar useModuloGuard('FISCAL') em todas as páginas
    - _Requirements: 22.2, 22.3, 22.4, 22.5_

  - [ ]* 20.2 Escrever property test para notificações de erro
    - **Property 9: Notificações de Erro**
    - Criar `src/data/hooks/fiscal/__tests__/errorNotifications.test.ts` usando vitest + fast-check
    - Para qualquer resposta HTTP com status >= 400, uma notificação vermelha é exibida
    - Se response.data.message existe, é usada como mensagem; caso contrário, usa fallback
    - **Validates: Requirements 22.5**

  - [ ]* 20.3 Escrever property test para Module Guard
    - **Property 10: Module Guard**
    - Criar `src/app/(interna)/fiscal/__tests__/moduleGuard.test.ts` usando vitest
    - Verificar que cada page.tsx do módulo fiscal importa e invoca useModuloGuard('FISCAL')
    - **Validates: Requirements 1.1**

- [x] 21. Final checkpoint — Módulo fiscal frontend completo
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate correctness properties from the design document
- O frontend é 100% TypeScript, usando Next.js 15 App Router + Mantine 7 + TanStack React Query + Axios
- fast-check já está disponível no projeto para property-based testing (vitest + fast-check)
- O backend fiscal já está implementado — esta spec cobre apenas a camada de apresentação e integração via hooks
- Usar a instância `api` de `@/lib/api` para todas as requisições HTTP
- Seguir padrão existente de useCrudGenerico para CRUDs simples
- Componentes ListagemFiscal e FormularioEmissao são reutilizados em múltiplas páginas para consistência

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5", "1.6", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 2, "tasks": ["2.7", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["9.1", "9.2", "10.1", "10.2", "10.3"] },
    { "id": 7, "tasks": ["10.4", "12.1", "12.2"] },
    { "id": 8, "tasks": ["13.1", "14.1", "15.1"] },
    { "id": 9, "tasks": ["13.2", "14.2", "17.1", "18.1"] },
    { "id": 10, "tasks": ["17.2", "19.1", "20.1"] },
    { "id": 11, "tasks": ["20.2", "20.3"] }
  ]
}
```
