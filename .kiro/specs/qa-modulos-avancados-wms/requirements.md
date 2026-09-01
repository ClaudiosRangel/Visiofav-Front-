# Requirements Document

## Introduction

Esta feature estende a suíte de QA automatizada existente (Python + Playwright em
`tests/e2e-qa`) para cobrir, **com dados e informações reais**, dez módulos
avançados do WMS/ERP Vizor que ainda não têm cobertura de QA de negócio:
**Faturamento (armazenagem 3PL), Picking Zona, LMS (Labor Management), Pátio,
Multi-CD, Demanda/IA, BI Avançado, Wave Planning, Portal 3PL e Gestão**.

O nível de validação é **QA de negócio**, no mesmo padrão da suíte atual: cada
Caso_De_Teste exercita a rota real do backend, valida a estrutura e as
invariantes da resposta e, quando possível, **semeia dados rastreáveis
(prefixo `QA-`) e afirma valores** (ex.: um contrato criado aparece na
listagem; uma meta criada é retornada; o total do dashboard reflete os
registros semeados). Quando um pré-requisito de ambiente não puder ser atingido
de forma determinística (ex.: exige processamento assíncrono de worker, ou
massa histórica de snapshots), o teste faz `pytest.skip` com motivo explícito —
**nunca um assert falso/mascarado**. Divergências conhecidas entre o
comportamento esperado e o real do backend são registradas com
`xfail(strict=True)`.

**Isolamento multi-tenant é requisito de primeira classe.** Acabamos de
encontrar e corrigir um vazamento real em que uma rota de listagem (Conferência
de Entrada) não filtrava por `empresaId`, exibindo dados de uma empresa dentro
de outra. Por isso, para CADA módulo, além de validar o funcionamento, a suíte
valida explicitamente que as listagens/relatórios respondem **escopados pela
empresa da sessão** — comparando o retorno com o token de uma segunda empresa
(que não deve conter os dados da primeira).

A suíte reaproveita a infraestrutura existente (`wms_api.py`, fixtures do
`conftest.py`, limpeza rastreável, evidências, relatório HTML, seed de QA do
backend `/api/qa-seed/*`) e roda contra produção (front Vercel, API
`https://api.vizorerp.com.br/api`), empresa "VisioFab Demo".

Este documento é fiel ao comportamento atual do backend (verificado em código):
`faturamento/faturamento.routes.ts`, `picking-zona/picking-zona.routes.ts`,
`lms/lms.routes.ts`, `patio/patio.routes.ts`, `multi-cd/multi-cd.routes.ts`,
`demanda/demanda.routes.ts`, `bi/bi.routes.ts`, `wave/wave.routes.ts`,
`portal/portal.routes.ts`. Todos os módulos aplicam `authenticate` +
`moduloGuard('WMS')` e filtram por `empresaId` do usuário (retornando 403
quando o usuário não tem empresa vinculada).

## Glossary

- **Suite_QA**: A suíte Python + Playwright em `tests/e2e-qa`.
- **Caso_De_Teste**: Função `test_*` que exercita um cenário de negócio.
- **API_Cliente**: Cliente HTTP autenticado (`WmsApiClient` em `wms_api.py`).
- **Empresa_Sessao**: A empresa da sessão autenticada do QA (VisioFab Demo).
- **Segunda_Empresa**: Outra empresa vinculada ao mesmo usuário admin, usada só
  para provar isolamento (a listagem de A nunca contém dados de B).
- **Dado_De_Teste**: Registro criado pela Suite_QA, rastreável por prefixo `QA-`.
- **Modulo_Faturamento**: Faturamento de armazenagem 3PL — `ContratoArmazenagem`,
  `TarifaContrato`, `MedicaoOcupacao`, `FaturaArmazenagem`, `ItemFatura`.
- **Modulo_PickingZona**: Zonas de picking — `ZonaPicking`, `SeparadorZona`,
  `PontoConsolidacao`, `SubOnda`.
- **Modulo_LMS**: Labor Management — `MetaOperacao`, `RegistroProdutividade`,
  `ConfigIncentivo`, `PausaOperador`, ranking/produtividade.
- **Modulo_Patio**: Pátio/yard — `VeiculoPatio`, `FilaEsperaPatio`,
  `ChamadaDoca`, `ConfigPatio`, relatórios de permanência/fila/ocupação.
- **Modulo_MultiCd**: Multi-Centro de Distribuição — `SolicitacaoTransferencia`,
  `MercadoriaTransito`, estoque por CD.
- **Modulo_Demanda**: Demanda/IA — `PrevisaoDemanda`, `ClassificacaoAbc`,
  `SugestaoSlotting`, `ConfigPrevisao`.
- **Modulo_BI**: BI Avançado — `SnapshotBI`, `CustoOperacao`, `ConfigCusto`,
  `AlertaCorrelacao`, dashboard executivo.
- **Modulo_Wave**: Wave Planning — `RegraOnda`, `PlanejamentoOnda`,
  `SimulacaoOnda`.
- **Modulo_Portal3PL**: Portal 3PL — `PortalUsuario`,
  `SolicitacaoExpedicaoPortal`, `NotificacaoPortal`.
- **Modulo_Gestao**: Visão de gestão — dashboards consolidados (dashboard-wms /
  dashboard-unificado do PCP) e indicadores gerenciais.

## Requirements

### Requirement 1: Faturamento de armazenagem 3PL

**User Story:** Como QA, quero validar o módulo de Faturamento de armazenagem,
porque ele fatura contratos 3PL e precisa refletir corretamente contratos,
medições e faturas — escopados por empresa.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta `GET /faturamento/resumo` com a Empresa_Sessao THEN o sistema SHALL responder 200 com `{totalFaturado, aReceber, inadimplente}` numéricos (>= 0).
2. WHEN a Suite_QA cria um `ContratoArmazenagem` de QA (`POST /faturamento/contratos`) com um cliente da empresa THEN o contrato criado SHALL aparecer na listagem `GET /faturamento/contratos` da mesma empresa.
3. WHEN a Suite_QA lista `GET /faturamento/faturas` e `GET /faturamento/medicoes` THEN o sistema SHALL responder 200 com listas (possivelmente vazias) coerentes com o schema.
4. WHEN a Suite_QA consulta qualquer listagem de Faturamento com a Segunda_Empresa THEN o resultado NÃO SHALL conter nenhum contrato/fatura/medição de QA criado na Empresa_Sessao (isolamento multi-tenant).
5. IF a criação de contrato exigir pré-requisito indisponível (ex.: nenhum cliente cadastrável) THEN a Suite_QA SHALL `pytest.skip` no seed com motivo explícito.

### Requirement 2: Picking Zona

**User Story:** Como QA, quero validar Picking Zona, porque zonas de picking,
separadores e pontos de consolidação organizam a separação por área.

#### Acceptance Criteria

1. WHEN a Suite_QA cria uma `ZonaPicking` de QA (`POST /picking-zona/zonas`) THEN a zona criada SHALL aparecer em `GET /picking-zona/zonas` e ser recuperável em `GET /picking-zona/zonas/:id`.
2. WHEN a Suite_QA consulta `GET /picking-zona/separadores`, `/pontos-consolidacao`, `/sub-ondas` e `/painel` THEN o sistema SHALL responder 200 com estrutura coerente.
3. WHEN a Suite_QA lista zonas com a Segunda_Empresa THEN o resultado NÃO SHALL conter a zona de QA criada na Empresa_Sessao.

### Requirement 3: LMS (Labor Management)

**User Story:** Como QA, quero validar o LMS, porque metas, produtividade,
ranking e incentivos medem a performance da operação.

#### Acceptance Criteria

1. WHEN a Suite_QA cria uma `MetaOperacao` de QA (`POST /lms/metas`) THEN a meta criada SHALL aparecer em `GET /lms/metas` e ser recuperável em `GET /lms/metas/:id`.
2. WHEN a Suite_QA consulta `GET /lms/dashboard`, `/produtividade`, `/ranking` e `/incentivos` THEN o sistema SHALL responder 200 com estrutura coerente (dashboard com `produtividadeMedia`, `rankingTop5`).
3. WHEN a Suite_QA lista metas com a Segunda_Empresa THEN o resultado NÃO SHALL conter a meta de QA da Empresa_Sessao.
4. IF o ranking depende de `RegistroProdutividade` inexistente THEN os campos agregados SHALL ser zero/vazios sem erro (200), e a Suite_QA valida essa degradação graciosa.

### Requirement 4: Pátio (Yard Management)

**User Story:** Como QA, quero validar o Pátio, porque a fila de veículos,
chamada de doca e relatórios de permanência controlam o pátio de entrada.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta `GET /patio/fila`, `/veiculos`, `/config` e `/kpis` THEN o sistema SHALL responder 200 com estrutura coerente.
2. WHEN a Suite_QA registra um `VeiculoPatio` de QA (via a rota de entrada do pátio) THEN o veículo SHALL aparecer na fila/listagem da mesma empresa.
3. WHEN a Suite_QA consulta os relatórios `/relatorio/permanencia`, `/relatorio/fila`, `/relatorio/ocupacao` THEN o sistema SHALL responder 200.
4. WHEN a Suite_QA consulta a fila com a Segunda_Empresa THEN o resultado NÃO SHALL conter o veículo de QA da Empresa_Sessao.

### Requirement 5: Multi-CD

**User Story:** Como QA, quero validar o Multi-CD, porque solicitações de
transferência e mercadoria em trânsito movem estoque entre centros.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta `GET /multi-cd/painel`, `/solicitacoes` e `/transito` THEN o sistema SHALL responder 200 com estrutura coerente.
2. WHEN a Suite_QA cria uma `SolicitacaoTransferencia` de QA (se houver >= 1 CD cadastrado) THEN a solicitação SHALL aparecer em `GET /multi-cd/solicitacoes` e ser recuperável por id.
3. WHEN a Suite_QA lista solicitações com a Segunda_Empresa THEN o resultado NÃO SHALL conter a solicitação de QA da Empresa_Sessao.
4. IF não houver CDs suficientes para transferência THEN a Suite_QA SHALL `pytest.skip` no seed com motivo explícito.

### Requirement 6: Demanda / IA

**User Story:** Como QA, quero validar Demanda/IA, porque previsão de demanda,
curva ABC e sugestões de slotting orientam o posicionamento de estoque.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta `GET /demanda/dashboard`, `/abc`, `/previsoes`, `/slotting/sugestoes`, `/produtos-criticos` e `/config` THEN o sistema SHALL responder 200 com estrutura coerente.
2. WHEN a Suite_QA consulta a curva ABC THEN a classificação retornada SHALL usar somente produtos/movimentos da Empresa_Sessao.
3. WHEN a Suite_QA consulta os mesmos endpoints com a Segunda_Empresa THEN os resultados NÃO SHALL conter produtos exclusivos de QA da Empresa_Sessao.
4. IF a previsão depender de histórico/worker inexistente THEN o endpoint SHALL degradar graciosamente (200 com listas vazias) e a Suite_QA valida isso.

### Requirement 7: BI Avançado

**User Story:** Como QA, quero validar o BI Avançado, porque o dashboard
executivo, custos e alertas consolidam KPIs da operação.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta `GET /bi/dashboard` THEN o sistema SHALL responder 200 com `{periodo, kpis: [...], totalSnapshots}`, onde `kpis` é um array de objetos `{chave, label, valorAtual, media, variacao, unidade}`.
2. WHEN a Suite_QA consulta `GET /bi/custos`, `/custos/detalhado`, `/comparativo`, `/correlacao`, `/alertas` e `/config` THEN o sistema SHALL responder 200 com estrutura coerente.
3. WHEN a Suite_QA consulta o dashboard com a Segunda_Empresa THEN os KPIs SHALL ser calculados sobre os snapshots da Segunda_Empresa (isolamento) — não os da Empresa_Sessao.
4. IF não houver `SnapshotBI` THEN `totalSnapshots` SHALL ser 0 e os KPIs degradam sem erro (200).

### Requirement 8: Wave Planning

**User Story:** Como QA, quero validar o Wave Planning, porque regras de onda e
planejamentos organizam a liberação de separação em ondas.

#### Acceptance Criteria

1. WHEN a Suite_QA cria uma `RegraOnda` de QA (`POST /wave/regras`) THEN a regra criada SHALL aparecer em `GET /wave/regras`.
2. WHEN a Suite_QA consulta `GET /wave/dashboard`, `/planejamentos` e `/painel` THEN o sistema SHALL responder 200 com estrutura coerente.
3. WHEN a Suite_QA lista regras com a Segunda_Empresa THEN o resultado NÃO SHALL conter a regra de QA da Empresa_Sessao.

### Requirement 9: Portal 3PL

**User Story:** Como QA, quero validar o Portal 3PL, porque usuários externos
(clientes 3PL) solicitam expedição e consultam seu estoque pelo portal.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta as rotas de administração do Portal 3PL (listagem de usuários do portal / solicitações de expedição) com a Empresa_Sessao THEN o sistema SHALL responder 200 com estrutura coerente.
2. WHEN a Suite_QA consulta as mesmas rotas com a Segunda_Empresa THEN o resultado NÃO SHALL conter registros de QA da Empresa_Sessao.
3. IF alguma rota do portal exigir autenticação/escopo dedicado (usuário do portal, não admin) THEN a Suite_QA SHALL `pytest.skip` com motivo explícito (o escopo externo está fora desta cobertura administrativa).

### Requirement 10: Gestão (dashboards consolidados)

**User Story:** Como QA, quero validar a visão de Gestão, porque os dashboards
consolidados (WMS e unificado PCP+WMS+Vendas) resumem a operação para a gestão.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta o dashboard WMS (`GET /dashboard-wms/...`) e o dashboard unificado (`GET /pcp/dashboard/unificado`) THEN o sistema SHALL responder 200 com indicadores numéricos coerentes.
2. WHEN a Suite_QA consulta os dashboards com a Segunda_Empresa THEN os indicadores SHALL refletir apenas a Segunda_Empresa (isolamento).

### Requirement 11: Isolamento multi-tenant transversal

**User Story:** Como QA, quero uma verificação transversal de isolamento em
todos os dez módulos, porque um único endpoint sem filtro por empresa vaza
dados entre clientes (bug real já ocorrido na Conferência de Entrada).

#### Acceptance Criteria

1. WHEN a Suite_QA obtém tokens de duas empresas distintas do mesmo usuário admin THEN cada listagem/relatório coberto SHALL responder somente com dados da empresa do token usado.
2. WHEN uma listagem de QUALQUER módulo coberto retornar registros com `empresaId` THEN todos os `empresaId` retornados SHALL ser iguais ao da empresa do token.
3. IF alguma rota retornar dados de outra empresa THEN o Caso_De_Teste SHALL FALHAR (assert), sinalizando um vazamento a corrigir no backend — não mascarar com skip.

### Requirement 12: Disciplina de execução, dados e limpeza

**User Story:** Como QA, quero que a cobertura siga a disciplina da suíte, para
não poluir a base de produção nem gerar falsos verdes.

#### Acceptance Criteria

1. WHEN a Suite_QA cria qualquer Dado_De_Teste THEN ele SHALL ser rastreável por prefixo `QA-` e registrado para limpeza best-effort.
2. WHEN um pré-requisito de ambiente for genuinamente indisponível THEN a Suite_QA SHALL `pytest.skip` no seed com motivo explícito — nunca um assert falso.
3. WHEN o comportamento real do backend divergir do esperado THEN a Suite_QA SHALL registrar com `xfail(strict=True)` documentando a divergência.
4. WHEN a Suite_QA rodar THEN ela SHALL poder ser executada em modo visual (`HEADLESS=false`) e headless, e integrar-se ao relatório HTML existente.
