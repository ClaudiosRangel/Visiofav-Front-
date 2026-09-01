# Suite de QA Automatizada — Vizor ERP

Automação de testes E2E em **Python + Playwright** que simula um usuário
real navegando pelo Vizor ERP e um cliente de API autenticado que semeia dados
reais e verifica o estado do backend. Cobre desde carregamento de tela até
validação de valor (saldos, quantidades e cálculos).

---

## Módulos cobertos

### Módulos originais (smoke / carregamento de tela)

| Arquivo | O que testa |
|---------|-------------|
| `test_01_login_e_navegacao.py` | Login e acesso aos módulos |
| `test_02_portal_representante.py` | Portal Representante (CRUD) |
| `test_03_orcamento_grafico.py` | Wizard de Orçamento Gráfico (7 steps) |
| `test_04_pedido_venda.py` | Pedido de Venda (CRUD + tabs) |
| `test_05_pcp_ordens_producao.py` | Ordens de Produção (CRUD) |
| `test_06_pcp_programacao.py` | Painel de Programação |
| `test_07_estoque.py` | Consulta de Estoque / WMS |
| `test_08_fluxo_integrado.py` | Fluxo entre módulos |
| `test_09_fluxo_recebimento_wms.py` | Fluxo de recebimento WMS (smoke) |
| `test_10_requisicoes_reserva.py` | Requisições e reservas |

### Novos módulos de QA de negócio (lançamentos reais + validação de valor)

| Arquivo | O que testa |
|---------|-------------|
| `test_11_fluxo_wms_encadeado.py` | **Cenário E2E encadeado** — seed via API → conferência cega (UI) → endereçamento → verificação de saldo. Caminho crítico ponta a ponta. `@pytest.mark.slow` |
| `test_12_recebimento_producao.py` | Integração PCP→WMS: conclusão de OP gera `NotaEntrada` tipo PRODUCAO (quantidade, empresaId, casos de não-geração) |
| `test_13_saldos_consolidados.py` | Reconciliação de saldos: fórmula `disponivel = fisico − reservado`, origem WMS vs ERP, reserva de produção, paridade UI × API |
| `test_14_reserva_picking.py` | Reserva (≤ e > disponível) e separação/picking (reduz saldo do endereço, paridade UI × backend incluindo caso zero) |
| `test_15_ondas_expedicao.py` | Ondas de separação, conferência de saída (sem e com divergência), expedição (reduz físico) |
| `test_16_inventario_ciclico.py` | Inventário cíclico: ajuste por contagem, caso conforme, saldo após inventário == contagem |
| `test_17_bloqueios.py` | Bloqueios de WMS: bloquear subtrai do disponível, separação é impedida, liberar devolve |
| `test_18_ressuprimento_crossdock.py` | Ressuprimento (conservação de físico total) e cross-dock até a expedição |
| `test_19_integracao_api_key.py` | Integração de ERP externo via API-Key: 401/403 e lançamento autenticado |
| `test_20_webhook_importacao.py` | Webhooks (entrega, identificador no payload, retentativa, isolamento) e importação por arquivo |
| `test_21_isolamento_multitenant.py` | Isolamento multi-tenant: consultas escopadas por empresaId, acesso cruzado retorna 404 |

---

## Infraestrutura de QA (arquivos de suporte)

| Arquivo | Descrição |
|---------|-----------|
| `wms_api.py` | `WmsApiClient` — cliente HTTP autenticado (Bearer) que reaproveita o `APIRequestContext` do Playwright. Encapsula seed idempotente de pré-requisitos, avanço de estado (conferência, endereçamento, inventário, bloqueio, etc.) e verificação de saldo/backend. |
| `conftest.py` | Fixtures de autenticação (`_autenticado`, `page_auth`), marcador de execução (`run_id`), cliente de API (`wms_api`, `api_token`) e **limpeza rastreável centralizada** (`cleanup_registry`). |
| `helpers.py` | Helpers de UI Mantine (Select via teclado, esperas, evidências), `screenshot_com_nome` (best-effort, nome + horário). |

---

## Marcador de execução (`run_id`)

Todo dado criado pela suíte carrega um marcador único no formato:

```
QA-WMS-{AAAAMMDD-HHMMSS}-{RAND4}
```

Exemplos de campos marcados:
- Nota de entrada: `fornecedor = "QA-WMS {run_id}"`
- Lote do item: `lote = "LOTE-{sufixo_run}"` (sufixo truncado a 26 chars para caber em `VarChar(30)`)
- OPs avulsas: `descricao` contém o `run_id`

Use `listar_notas_por_marcador(run_id)` para localizar e o relatório de limpeza para rastrear o que não pôde ser removido.

---

## Pré-requisitos

- Python 3.10+
- pip

## Instalação

```powershell
cd tests/e2e-qa

# Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Instalar browser
playwright install chromium
```

## Configuração

Edite `.env` conforme o ambiente:

```env
# Produção (padrão)
BASE_URL=https://visiofav-front-wofr.vercel.app
# API_URL é derivada automaticamente (https://api.vizorerp.com.br/api)

# Local
# BASE_URL=http://localhost:3000
# API_URL=http://localhost:3333/api

EMAIL=admin@visiofab.com
PASSWORD=987123
EMPRESA_NOME=VisioFab Demo

# Execução visual
HEADLESS=true      # false para ver o browser
SLOW_MO=0          # milissegundos entre ações (ex: 600 para debug lento)

# Variáveis opcionais para casos condicionados (omitir = skip honesto)
# WMS_API_KEY=<chave de empresa WMS_STANDALONE + integração ativa>
# WMS_API_KEY_PRODUTO_CODIGO=MOCA395CX48
# WMS_API_KEY_MESMA_EMPRESA_DEMO=1
# INTEGRACAO_API_KEY_SEM_INTEGRACAO=<chave válida de empresa sem integração>
# WEBHOOK_TEST_URL=https://...  (destino que retorna erro para exercitar retry)
```

---

## Executar testes

### Toda a suite (produção, headless)
```powershell
pytest
```

### Módulo específico — recomendado para os novos módulos
```powershell
# Nunca usar modo watch. Rodar módulo a módulo.
pytest test_11_fluxo_wms_encadeado.py -s
pytest test_13_saldos_consolidados.py -s
pytest test_17_bloqueios.py -s
```

### Modo visual (ver o browser)
```powershell
$env:HEADLESS="false"
$env:SLOW_MO="600"
pytest test_11_fluxo_wms_encadeado.py -s
```

### Contra ambiente local
```powershell
$env:BASE_URL="http://localhost:3000"
$env:API_URL="http://localhost:3333/api"
pytest test_11_fluxo_wms_encadeado.py -s
```

### Somente testes rápidos (sem @slow)
```powershell
pytest -m "not slow"
```

---

## Limpeza de dados de teste

A suíte cria dados rastreáveis com prefixo `QA-` (marcador `run_id`). Ao final de cada
sessão, a fixture `cleanup_registry` (autouse) realiza uma **varredura centralizada**:

1. Localiza notas de entrada do run via `listar_notas_por_marcador(run_id)`.
2. Remove o que for possível (notas, OPs avulsas, reservas, webhooks, estruturas, lotes
   bloqueados) via os endpoints de exclusão disponíveis.
3. Grava um relatório em `evidencias/limpeza_{run_id}.txt` com o que foi removido e o
   que **não pôde ser removido** (identificador rastreável para limpeza manual posterior).

Nenhuma falha de limpeza interrompe ou afeta o resultado dos testes (Requisito 13.3).

---

## Evidências e relatório

- **Screenshots em etapas**: `helpers.screenshot_com_nome(page, nome)` — grava em
  `evidencias/{nome}_{AAAAMMDD_HHMMSS}.png`. Best-effort (falha ao gravar não derruba o
  teste).
- **Screenshots em falha**: o hook `pytest_runtest_makereport` captura automaticamente
  a tela no momento da falha em `evidencias/FALHA_{nome_teste}_{horário}.png`.
- **Relatório HTML consolidado**: gerado ao final em `report.html`
  (pytest-html, configurado em `pytest.ini`).

---

## Comportamento esperado em produção (skips honestos)

Alguns cenários fazem `pytest.skip` no seed por dependerem de estado inatingível
deterministicamente em produção. Isso é **esperado e correto** — o skip é melhor que
um assert falso:

| Módulo | Motivo do skip |
|--------|---------------|
| `test_15` (ondas/expedição) | Criar onda nova exige `PedidoVenda` em `EM_SEPARACAO` via efetivação fiscal real de NF-e |
| `test_18` (cross-dock) | Idem + tabela de preço não cadastrada na demo |
| `test_19` (API-Key positivo) | Requer `WMS_API_KEY` de empresa com integração `WMS_STANDALONE` ativa (a demo opera em `ERP_COMPLETO`) |
| `test_20` (webhook disparo) | Nenhuma entrega pré-existente para reenvio na empresa demo |
| `test_20` (importação arquivo) | Endpoint `file-importer` existe no backend mas não está publicado em nenhuma rota |

---

## Convenções da suite

- **Mantine Select**: sempre via teclado (`input.click()` → `ArrowDown` → `Enter`). Nunca
  clicar em `[role="option"]` (o dropdown fecha antes do clique completar).
- **Estratégia híbrida UI + API**: passos que testam a interface rodam via Playwright;
  passos que apenas preparam/avançam estado ou verificam a fonte de verdade usam
  `WmsApiClient` (mesma sessão autenticada, Bearer token do localStorage).
- **Skip vs Assert**: `pytest.skip` com motivo explícito para pré-requisito de ambiente
  genuinamente indisponível; `assert` para comportamento do sistema.
- **Lote canônico**: use sempre `WmsApiClient.lote_do_run(run_id)` para obter o lote
  rastreável — não reconstrua `LOTE-{run_id}` manualmente (o lote é truncado para caber
  em `VarChar(30)` e a fonte única de verdade evita divergência de filtro).

---

## Estrutura

```
tests/e2e-qa/
├── .env                                    # Configurações (URL, credenciais)
├── conftest.py                             # Fixtures e limpeza rastreável
├── helpers.py                              # Helpers de UI e evidências
├── wms_api.py                              # WmsApiClient (seed + verificação via API)
├── pytest.ini                              # Configuração do pytest (html, markers)
├── requirements.txt                        # Dependências Python
├── README.md                               # Este arquivo
│
├── test_01_login_e_navegacao.py
├── test_02_portal_representante.py
├── test_03_orcamento_grafico.py
├── test_04_pedido_venda.py
├── test_05_pcp_ordens_producao.py
├── test_06_pcp_programacao.py
├── test_07_estoque.py
├── test_08_fluxo_integrado.py
├── test_09_fluxo_recebimento_wms.py        # Smoke (mantido)
├── test_10_requisicoes_reserva.py
│
├── test_11_fluxo_wms_encadeado.py          # ★ E2E encadeado (caminho crítico)
├── test_12_recebimento_producao.py         # Integração PCP→WMS
├── test_13_saldos_consolidados.py          # Reconciliação de saldos
├── test_14_reserva_picking.py              # Reserva e picking
├── test_15_ondas_expedicao.py              # Ondas e expedição
├── test_16_inventario_ciclico.py           # Inventário cíclico
├── test_17_bloqueios.py                    # Bloqueios de WMS
├── test_18_ressuprimento_crossdock.py      # Ressuprimento e cross-dock
├── test_19_integracao_api_key.py           # Integração ERP externo (API-Key)
├── test_20_webhook_importacao.py           # Webhooks e importação por arquivo
├── test_21_isolamento_multitenant.py       # Isolamento multi-tenant
│
├── report.html                             # Relatório HTML gerado pelo pytest-html
└── evidencias/                             # Screenshots e relatório de limpeza
    ├── *.png                               # Screenshots de etapas e falhas
    └── limpeza_{run_id}.txt                # Relatório de limpeza (removidos/não-removidos)
```

---

## Filosofia dos testes

1. **Smoke vs. QA de negócio**: `test_01`–`test_10` verificam que cada tela carrega e o
   formulário funciona. `test_11`–`test_21` fazem lançamentos reais e validam números,
   saldos e cálculos.
2. **Caminho crítico sem skip**: o cenário encadeado (`test_11`) semeia os
   pré-requisitos via API e nunca pula no meio do fluxo — a ausência de dados é
   regressão real, não estado faltante.
3. **Evidências**: screenshots com nome descritivo + horário em etapas e em falha.
4. **Limpeza**: cada dado criado carrega o marcador `run_id` e é removido ao final
   (best-effort), com relatório do que não pôde ser limpo.
5. **Isolamento multi-tenant**: classe de bug histórica do projeto — coberta em
   `test_21` e defensivamente no `WmsApiClient` (filtro de empresaId nos endpoints
   que já vazaram entre empresas).

---

## Notas

- Os testes rodam contra a **empresa VisioFab Demo em produção** (Vercel/Render) por
  padrão. Para rodar localmente, configure `BASE_URL` e `API_URL` no `.env`.
- O login é feito uma vez por sessão (`_autenticado`), não a cada teste.
- Nunca rodar em modo watch — executar módulo a módulo com `pytest test_XX_....py -s`.
- Bug real encontrado e corrigido durante a feature: `SaldoEndereco` era criado sem
  `empresaId` no backend (`enderecamento-wms.routes.ts`) — o bloqueio por lote não
  enxergava as posições. Corrigido e deployado em produção.
