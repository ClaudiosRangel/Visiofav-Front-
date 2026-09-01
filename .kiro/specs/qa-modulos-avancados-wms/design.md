# Design Document

## Overview

Estender a suíte `tests/e2e-qa` com cobertura de QA de negócio para dez módulos
avançados do WMS, reaproveitando toda a infraestrutura existente
(`WmsApiClient`, fixtures `page_auth`/`wms_api`/`run_id`, `cleanup_registry`,
evidências, relatório HTML). Cada módulo ganha um arquivo de teste próprio; um
arquivo transversal valida isolamento multi-tenant em todos.

O foco é **testar com dados e informações reais**: onde a rota permite semear
(criar contrato, meta, zona, regra de onda, etc.), o teste cria um registro de
QA e afirma que ele aparece na listagem e é recuperável. Onde a rota é só
leitura/relatório/dashboard, o teste valida estrutura + isolamento. Onde o dado
depende de worker/histórico (previsão, snapshots BI, produtividade), valida a
degradação graciosa (200 com vazios) — sem forçar assert que o backend não
cumpre.

## Steering / Standards

- Idioma português nas mensagens/documentação (steering `idioma-portugues`).
- Padrão da suíte: `pytest.skip` no seed para pré-requisito indisponível;
  `xfail(strict=True)` para divergência conhecida; nunca assert falso.
- Produto/registro exclusivo por execução (sufixo `run_id`) quando o dado
  acumula estado, para não interferir entre testes (lição do test_14/15).
- Rodar em modo visual e headless; `control_pwsh_process` para execução longa.

## Architecture

### Arquivos de teste (um por módulo + transversal)

| Arquivo | Módulo | Prefixo API |
|---------|--------|-------------|
| `test_32_faturamento.py` | Faturamento 3PL | `/faturamento` |
| `test_33_picking_zona.py` | Picking Zona | `/picking-zona` |
| `test_34_lms.py` | LMS | `/lms` |
| `test_35_patio.py` | Pátio | `/patio` |
| `test_36_multi_cd.py` | Multi-CD | `/multi-cd` |
| `test_37_demanda_ia.py` | Demanda/IA | `/demanda` |
| `test_38_bi_avancado.py` | BI Avançado | `/bi` |
| `test_39_wave_planning.py` | Wave Planning | `/wave` |
| `test_40_portal_3pl.py` | Portal 3PL | `/portal` |
| `test_41_gestao.py` | Gestão (dashboards) | `/dashboard-wms`, `/pcp/dashboard/unificado` |
| `test_42_isolamento_modulos_avancados.py` | Transversal (Req 11) | todos |

### Padrão de cada teste de módulo

1. **Leitura/estrutura** (sempre executável, seguro): consulta os GET
   principais do módulo com a Empresa_Sessao e valida status 200 + forma da
   resposta (chaves esperadas, tipos). Cobre a maioria dos ACs.
2. **Semeadura + verificação de valor** (quando a rota POST existe e é
   determinística): cria um registro `QA-{run_id}`, confirma que aparece na
   listagem e é recuperável por id; registra para limpeza.
3. **Isolamento** (por módulo e no transversal): obtém token da Segunda_Empresa
   e confirma que a listagem dela não contém o registro de QA da
   Empresa_Sessao; e que todo `empresaId` retornado é o da empresa do token.

### Multi-tenant helper no cliente

Adicionar ao `WmsApiClient`:

- `token_de_outra_empresa() -> (token, empresaId) | (None, None)`: descobre uma
  segunda empresa vinculada ao admin (via `GET /empresas/minhas` ou
  `/empresas`), seleciona-a (`POST /empresas/:id/selecionar`) e devolve o token
  — sem alterar o token da sessão principal (usa o request context com header
  explícito). Se o admin só tiver uma empresa, devolve `(None, None)` e o
  teste de isolamento faz skip.
- `get_com_token(path, token, params) -> APIResponse`: GET numa rota usando um
  token arbitrário (para consultar como a Segunda_Empresa).
- Helpers de leitura por módulo, cada um um GET fino que retorna o JSON:
  `faturamento_resumo()`, `faturamento_contratos()`, `picking_zonas()`,
  `lms_dashboard()`, `lms_metas()`, `patio_fila()`, `multicd_painel()`,
  `demanda_dashboard()`, `bi_dashboard()`, `wave_regras()`, etc. Todos usam
  `_get` (assert 5xx = falha dura) e retornam `resp` cru para o teste avaliar.
- Helpers de seed por módulo (quando aplicável): `criar_contrato_armazenagem`,
  `criar_zona_picking`, `criar_meta_lms`, `criar_regra_onda`,
  `criar_solicitacao_transferencia`. Cada um POST cru, retornando a resposta
  para o teste inspecionar status/corpo.

### Isolamento — verificação canônica (Req 11)

Função utilitária no `test_42` (e reutilizada nos módulos):

```
def afirmar_isolamento(wms_api, path, extrai_lista):
    # 1) lista com a Empresa_Sessao
    r_sessao = wms_api._get(path)
    ids_sessao = { x.get('empresaId') for x in extrai_lista(r_sessao.json()) if x.get('empresaId') }
    # todo empresaId retornado deve ser o da sessão
    assert ids_sessao <= { empresa_sessao }
    # 2) lista com a Segunda_Empresa (token distinto)
    token2, emp2 = wms_api.token_de_outra_empresa()
    if not token2: pytest.skip("usuário só tem 1 empresa — isolamento não testável")
    r2 = wms_api.get_com_token(path, token2)
    ids2 = { x.get('empresaId') for x in extrai_lista(r2.json()) if x.get('empresaId') }
    assert empresa_sessao not in ids2  # dados da sessão não vazam para a outra empresa
```

Onde a listagem não expõe `empresaId` no item, o isolamento é verificado por
ausência do registro semeado (id do registro de QA não aparece na lista da
Segunda_Empresa).

## Components and Interfaces

### `WmsApiClient` (novos métodos)

- Multi-tenant: `empresas_do_usuario()`, `token_de_outra_empresa()`,
  `get_com_token(path, token, params=None)`.
- Leitura (um por rota GET coberta): retornam `APIResponse` cru.
- Seed (um por POST coberto): retornam `APIResponse` cru; validam pré-requisitos
  mínimos (ex.: cliente existente para contrato) e deixam o teste decidir skip.
- Limpeza: onde houver DELETE/inativação, registrar no `cleanup_registry`
  (estender o `RegistroLimpeza` com listas por tipo — contratos, zonas, metas,
  regras — best-effort; se não houver DELETE, o registro fica rastreável por
  `QA-` e é documentado como resíduo aceitável).

### Fixtures

Reaproveita `wms_api`, `run_id`, `page_auth`, `cleanup_registry` existentes.
Nenhuma fixture nova é necessária.

## Data Models

Nenhuma alteração de schema. A cobertura é somente de leitura + criação via
rotas públicas já existentes. Se algum seed exigir um habilitador de backend
(ex.: criar um segundo CD para Multi-CD, ou um `SnapshotBI` para o dashboard),
o design prevê **preferir o skip honesto** a criar endpoints de seed novos —
salvo se o usuário pedir explicitamente o habilitador (como foi feito para
onda/expedição). Decisão registrada por módulo na fase de implementação.

## Error Handling

- `_get`/`_post`/`_patch` tratam 5xx como falha dura (assert) — indica bug de
  servidor, não segue o fluxo.
- 403 "Usuário sem empresa vinculada" não deve ocorrer (a sessão tem empresa);
  se ocorrer, é falha de setup e o teste reporta.
- 404/422 em seed = pré-requisito indisponível → `pytest.skip` no seed.
- Vazamento de isolamento (dados de outra empresa) = **assert que FALHA** — é o
  achado que queremos capturar, não mascarar.

## Testing Strategy

- Sem PBT (fluxos determinísticos; asserts de valor e de estrutura).
- Ordem de execução: os arquivos são independentes; cada um semeia o que
  precisa e limpa best-effort.
- Modo visual para acompanhar (evidência de dashboards via screenshot
  best-effort); headless para o retrato consolidado.
- Ao final, rodar a suíte inteira e produzir o retrato consolidado, garantindo
  que os novos módulos não regridem os testes existentes.
- **Achados de backend** (ex.: uma rota sem filtro de empresa, como ocorreu na
  Conferência) são corrigidos no backend no mesmo ciclo (commit + deploy +
  reteste), seguindo o padrão já adotado nesta sessão.
