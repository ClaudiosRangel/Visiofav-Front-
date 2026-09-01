# Implementation Plan

## Overview

Plano de implementação da cobertura de QA de negócio para dez módulos avançados
do WMS (Faturamento, Picking Zona, LMS, Pátio, Multi-CD, Demanda/IA, BI
Avançado, Wave Planning, Portal 3PL e Gestão) mais uma verificação transversal
de isolamento multi-tenant. A task 1 (extensão do `WmsApiClient` com helpers
multi-tenant e de leitura/seed por módulo) é pré-requisito de todas as demais.
As tasks 2–11 são módulos de teste independentes entre si e podem ser feitos em
qualquer ordem após a task 1. A task 12 (transversal) depende dos helpers da
task 1. A task 13 corrige achados de backend, se houver. A task 14 fecha com a
execução consolidada e a documentação.

## Tasks

- [x] 1. Infraestrutura de cliente para os módulos avançados
  - Adicionar ao `wms_api.py` os helpers multi-tenant (`empresas_do_usuario`, `token_de_outra_empresa`, `get_com_token`).
  - Adicionar helpers finos de leitura (GET cru) e de seed (POST cru) por módulo, retornando `APIResponse`.
  - Corrigido `_empresa_id_sessao` para decodificar o JWT (a rota `/auth/me` não existe — causava falso vazamento).
  - _Requirements: 11.1, 11.2, 12.1, 12.4_

- [x] 2. QA Faturamento (`test_32_faturamento.py`)
  - Estrutura: `GET /faturamento/resumo`, `/contratos`, `/faturas`, `/medicoes` → 200 + schema.
  - Seed + valor: criar `ContratoArmazenagem` de QA e confirmar na listagem e por id (skip se não houver cliente).
  - Isolamento: listagens não contêm registros de QA para a Segunda_Empresa.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2_

- [x] 3. QA Picking Zona (`test_33_picking_zona.py`)
  - Seed + valor: criar `ZonaPicking` de QA e confirmar em `/zonas` e `/zonas/:id`.
  - Estrutura: `/separadores`, `/pontos-consolidacao`, `/sub-ondas`, `/painel` → 200.
  - Isolamento: zona de QA não aparece para a Segunda_Empresa.
  - _Requirements: 2.1, 2.2, 2.3, 11.1_

- [x] 4. QA LMS (`test_34_lms.py`)
  - Seed + valor: criar `MetaOperacao` de QA e confirmar em `/metas` e `/metas/:id`.
  - Estrutura: `/dashboard`, `/produtividade`, `/ranking`, `/incentivos` → 200.
  - Degradação graciosa: ranking sem produtividade retorna zero sem erro.
  - Isolamento: meta de QA não aparece para a Segunda_Empresa.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1_

- [x] 5. QA Pátio (`test_35_patio.py`)
  - Estrutura: `/fila`, `/veiculos`, `/config`, `/kpis`, `/relatorio/*` → 200.
  - Seed + valor: registrar `VeiculoPatio` de QA e confirmar na fila (skip se pré-requisito indisponível).
  - Isolamento: veículo de QA não aparece para a Segunda_Empresa.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.1_

- [x] 6. QA Multi-CD (`test_36_multi_cd.py`)
  - Estrutura: `/painel`, `/solicitacoes`, `/transito` → 200.
  - Seed + valor: criar `SolicitacaoTransferencia` de QA se houver >= 1 CD; senão skip.
  - Isolamento: solicitação de QA não aparece para a Segunda_Empresa.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 11.1_

- [x] 7. QA Demanda/IA (`test_37_demanda_ia.py`)
  - Estrutura: `/dashboard`, `/abc`, `/previsoes`, `/slotting/sugestoes`, `/produtos-criticos`, `/config` → 200.
  - Degradação graciosa: sem histórico, previsões/sugestões vazias sem erro.
  - Isolamento: curva ABC/produtos só da empresa da sessão.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 11.1_

- [x] 8. QA BI Avançado (`test_38_bi_avancado.py`)
  - Estrutura: `/dashboard` → `{periodo, kpis:[...], totalSnapshots}`; `/custos`, `/custos/detalhado`, `/comparativo`, `/correlacao`, `/alertas`, `/config` → 200.
  - Degradação graciosa: sem `SnapshotBI`, `totalSnapshots=0` sem erro.
  - Isolamento: dashboard da Segunda_Empresa não reflete snapshots da Empresa_Sessao.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.1_

- [x] 9. QA Wave Planning (`test_39_wave_planning.py`)
  - Seed + valor: criar `RegraOnda` de QA e confirmar em `/regras`.
  - Estrutura: `/dashboard`, `/planejamentos`, `/painel` → 200.
  - Isolamento: regra de QA não aparece para a Segunda_Empresa.
  - _Requirements: 8.1, 8.2, 8.3, 11.1_

- [x] 10. QA Portal 3PL (`test_40_portal_3pl.py`)
  - Estrutura (admin): listagens administrativas do portal → 200.
  - Isolamento: registros de QA não aparecem para a Segunda_Empresa.
  - Escopo externo: rotas de usuário do portal (não admin) → skip com motivo.
  - _Requirements: 9.1, 9.2, 9.3, 11.1_

- [x] 11. QA Gestão (`test_41_gestao.py`)
  - Estrutura: dashboard WMS e dashboard unificado (PCP+WMS+Vendas) → 200 com indicadores numéricos.
  - Isolamento: indicadores refletem apenas a empresa do token.
  - _Requirements: 10.1, 10.2, 11.1_

- [x] 12. QA Isolamento transversal (`test_42_isolamento_modulos_avancados.py`)
  - Para cada listagem coberta dos 10 módulos, afirmar que todo `empresaId` retornado é o da empresa do token e que a Segunda_Empresa não vê os registros de QA da Empresa_Sessao. Falha (assert) se houver vazamento.
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 13. Correção de achados de backend (se houver)
  - Se algum teste revelar rota sem filtro `empresaId` (vazamento), corrigir no backend (filtro na query), commit + deploy + reteste — mesmo padrão da Conferência de Entrada.
  - _Requirements: 11.3_

- [ ] 14. Execução consolidada e documentação
  - Rodar os novos módulos em modo visual; depois a suíte inteira (headless) para o retrato consolidado, sem regressão.
  - Atualizar o steering `qa-automatizado.md` com os novos módulos e o retrato.
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] },
    { "wave": 3, "tasks": ["13"] },
    { "wave": 4, "tasks": ["14"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["1"],
    "4": ["1"],
    "5": ["1"],
    "6": ["1"],
    "7": ["1"],
    "8": ["1"],
    "9": ["1"],
    "10": ["1"],
    "11": ["1"],
    "12": ["1"],
    "13": ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    "14": ["13"]
  }
}
```

- Task 1 é pré-requisito de todas (wave 1).
- Tasks 2–12 são independentes entre si (wave 2, paralelizáveis) após a task 1.
- Task 13 é condicional (só se um teste revelar bug de backend).
- Task 14 fecha o trabalho.

## Notes

- Padrão da suíte: `pytest.skip` no seed para pré-requisito indisponível;
  `xfail(strict=True)` para divergência conhecida; nunca assert falso.
- Dados de QA rastreáveis por prefixo `QA-`, registrados para limpeza
  best-effort no `cleanup_registry`.
- Preferir skip honesto a criar habilitadores de backend, salvo se o usuário
  pedir explicitamente (como foi feito para onda/expedição).
- Achados de backend (rota sem filtro de empresa) são corrigidos no mesmo
  ciclo (commit + deploy + reteste), como na Conferência de Entrada.
- Rodar em modo visual (`HEADLESS=false`) e headless; integrar ao relatório HTML.
