# Suite de QA Automatizada — Vizor ERP

## Localização

```
tests/e2e-qa/
```

## O que é

Suite de testes E2E em **Python + Playwright** que simula um usuário real
navegando pelo sistema, clicando em menus, preenchendo formulários e
validando que tudo funciona. Cobre 78 testes em 6 módulos:

| Módulo | Arquivo | Testes |
|--------|---------|--------|
| Login + Navegação | `test_01_login_e_navegacao.py` | 9 |
| Portal Representante | `test_02_portal_representante.py` | 8 |
| Orçamento Gráfico | `test_03_orcamento_grafico.py` | 8 |
| Pedido de Venda | `test_04_pedido_venda.py` | 7 |
| PCP - Ordens de Produção | `test_05_pcp_ordens_producao.py` | 12 |
| PCP - Programação | `test_06_pcp_programacao.py` | 8 |
| Estoque / WMS | `test_07_estoque.py` | 12 |
| Fluxo Integrado + Resiliência | `test_08_fluxo_integrado.py` | 14 |
| Fluxo Recebimento WMS (completo) | `test_09_fluxo_recebimento_wms.py` | 25 |

O `test_09` cobre o fluxo ponta a ponta de entrada de mercadoria: Nota
Fiscal de Entrada → Dados Logísticos → SKU (lastro/camada) → Criação de
Endereços → Agenda de Docas → Portaria (chegada/liberação) → Conferência
Cega → Endereçamento (put-away) → Inventário Cíclico. Etapas que dependem de
estado sequencial (portaria) são validadas via UI + API, seguindo o padrão
do teste TS de referência (`tests/e2e/fluxo-recebimento.spec.ts`).

## Como rodar

O ambiente virtual já está criado em `tests/e2e-qa/.venv/`. Para executar:

```powershell
cd C:\Source\VisioFab.Wms.Front\tests\e2e-qa
.venv\Scripts\activate
pytest
```

### Modo visual (ver o browser clicando)

```powershell
$env:HEADLESS="false"
$env:SLOW_MO="800"
pytest -s
```

### Rodar módulo específico

```powershell
pytest test_05_pcp_ordens_producao.py
```

## Ambiente de teste

- **URL**: `https://visiofav-front-wofr.vercel.app` (produção Vercel)
- **Empresa**: VisioFab Demo (primeira empresa do seletor)
- **Credenciais**: admin@visiofab.com / 987123
- **Configuração**: arquivo `tests/e2e-qa/.env`

## Quando rodar

- Depois de alterações nos módulos cobertos (representante, orçamento,
  pedido, PCP, programação, estoque)
- Antes de entregar uma feature para validar que nada quebrou
- Se o usuário pedir "roda o QA" ou "testa o sistema"

## Se um teste falhar

Os falhas geralmente indicam:
1. **Bug real no sistema** — a tela mudou de comportamento
2. **Seletor desatualizado** — um label/botão foi renomeado no frontend
3. **Dados de teste ausentes** — a empresa demo precisa de dados (produtos,
   centros, clientes cadastrados)

Para debugar, rodar em modo visual com `$env:HEADLESS="false"` e ver onde
trava.

## Reinstalar do zero (outra máquina)

```powershell
cd C:\Source\VisioFab.Wms.Front\tests\e2e-qa
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
pytest
```

## Padrão para Mantine Select (referência para novos testes)

O Mantine 7 usa combobox com portal (dropdown renderizado fora do DOM do
input). O padrão correto para selecionar opções em testes é via teclado:

```python
input_field.click()
time.sleep(0.5)
input_field.press("ArrowDown")
time.sleep(0.3)
input_field.press("Enter")
```

Não usar `page.locator('[role="option"]').click()` — o dropdown fecha antes
do click completar.

## Habilitador de seed de QA — onda/expedição sem NF-e (importante)

Em produção, um `PedidoVenda` só chega a `EM_SEPARACAO` por efetivação fiscal
real (`POST /api/vendas` → emissão de NF-e à SEFAZ), inviável numa suíte de
QA. Para testar **de verdade** os fluxos de onda/separação/conferência de
saída/expedição e cross-dock, o backend expõe uma rota de seed restrita:

- **Backend**: `POST /api/qa-seed/pedido-em-separacao`
  (`VisioFab.Wms.Back/src/modules/qa-seed/qa-seed.routes.ts`, registrada em
  `server.ts`). Cria um `PedidoVenda` já em `EM_SEPARACAO` (reaproveita/cria
  cliente + tabela de preço mínimos de QA, claramente marcados "nao usar em
  producao"). Protegida por JWT + perfil **ADMIN/SUPER_ADMIN** (mesmo padrão
  do `adminPcpRoutes`). Se a env `WMS_QA_SEED_KEY` existir, exige também o
  header `x-qa-seed-key` (camada extra). O cliente de QA já envia esse header
  (default `qa-seed-visiofab-2026`).

- **Cliente de QA** (`wms_api.py`): `seed_pedido_em_separacao`,
  `criar_onda`, `separar_todos_itens_onda`, `seed_onda_separada`
  (pedido→onda→separa→`SEPARADA`), `seed_onda_com_item_pendente` (onda com
  item `PENDENTE`, para o Req 4.3), `seed_carregamento_confirmavel`
  (cadeia completa até um carregamento pronto para expedir: onda→conferência
  aprovada→volume→carregamento). O `test_15` usa esses para rodar 100% sem
  skip; o `test_14` (4.3/4.4) semeia produto EXCLUSIVO + item próprio.

### Malha de endereços satura — sempre garantir endereços VAZIOS

A demo tem poucos endereços e eles **saturam** ao longo da suíte (cada
put-away ocupa um endereço com `SaldoEndereco`). O motor RF008 rejeita
endereços ocupados mesmo com `status=LIVRE`. Por isso:
- `enderecos_vazios()` cruza endereços × saldos e retorna só os SEM saldo.
- `garantir_enderecos_para_qa(minimo)` gera novos endereços (rua 9, via
  `POST /enderecos/gerar`) quando os VAZIOS são insuficientes — é chamado no
  início de `seed_fisico_por_recebimento`. Sem isso, o put-away não endereça
  nada e testes de picking/ressuprimento falham/pulam por interferência de
  saldo entre testes. **Regra**: teste que precisa de físico endereçado deve
  usar produto EXCLUSIVO por execução (`garantir_produto_configurado(sufixo=)`)
  e garantir endereços vazios antes.

## Retrato consolidado da suíte (última execução: 31/08/2026)

**199 testes: 185 passed, 13 skipped, 1 xfailed, 0 failed** (headless, ~27min).

- `xfailed` (1): `test_14` reserva de produção não valida contra o disponível
  (comportamento REAL do backend documentado — vira asserção normal se o
  backend passar a rejeitar).
- `skipped` (13): pré-requisitos genuinamente indisponíveis/estruturais —
  `test_19` (3, integração API-Key externa, exige `WMS_API_KEY`), `test_20`
  (4, importação por arquivo CSV: `file-importer.ts` existe mas NÃO está
  plugado em rota), e alguns condicionais de ambiente em `test_02/06/09/21`.
