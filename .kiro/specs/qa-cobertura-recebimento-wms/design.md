# Design Document

## Overview

Suíte de QA de negócio (Python + Playwright) que cobre exaustivamente o
recebimento WMS e seus módulos conectados: SKU, Dados Logísticos, Agenda de
Docas, Portaria, Conferência de Entrada (incluindo segunda conferência,
tolerância, shelf-life, lote/validade, HOLD) e a integração PCP → WMS.

Reaproveita toda a infraestrutura já existente em `tests/e2e-qa`:
`wms_api.py` (`WmsApiClient`), fixtures do `conftest.py` (`run_id`,
`page_auth`, `wms_api`, `cleanup_registry`, hook de evidência em falha),
`manutencao_ambiente.py` (repovoamento) e `report.html` (pytest-html).

A suíte NÃO reimplementa cliente HTTP nem autenticação — estende o
`WmsApiClient` com métodos novos por domínio, e adiciona arquivos de teste
`test_22`..`test_30` (numeração seguindo os módulos existentes até `test_21`).

### Princípios de teste (herdados da suíte atual)

- `assert` valida comportamento do sistema; `pytest.skip(motivo)` cobre
  pré-requisito de ambiente indisponível de forma determinística.
- Divergência conhecida entre requisito e backend → `pytest.mark.xfail(strict=True)`.
- Todo dado criado leva prefixo `QA-` + `run_id` e é limpo via `cleanup_registry`.
- Playwright em modo visual quando solicitado (`HEADLESS=false`, `SLOW_MO`),
  headless por padrão no CI.
- Mantine Select via teclado (click → ArrowDown → Enter), nunca `[role="option"]`.

## Architecture

```
tests/e2e-qa/
├── wms_api.py                      # estende WmsApiClient (métodos por domínio)
├── conftest.py                     # fixtures existentes + novas fixtures de setup de produto
├── test_22_sku_regras.py           # Req 1
├── test_23_dados_logisticos.py     # Req 2
├── test_24_agenda_doca.py          # Req 3
├── test_25_portaria_estados.py     # Req 4
├── test_26_conferencia_bloqueios.py# Req 5
├── test_27_conferencia_quantidade.py # Req 6
├── test_28_conferencia_lote_shelflife.py # Req 7
├── test_29_segunda_conferencia_hold.py   # Req 8
└── test_30_pcp_wms_recebimento.py  # Req 9
```

Requisito 10 (rastreabilidade/limpeza/evidências) é transversal: satisfeito
pelas fixtures existentes, reaplicadas em todos os módulos novos.

## Mapeamento Requisito → Endpoint/Regra → Implementação

### Req 1 — SKU (`test_22_sku_regras.py`)
- Endpoints: `POST /sku`, `GET /sku?produtoId=`, `PUT /sku/:id`, `DELETE /sku/:id` (backend `sku/sku.routes.ts`).
- 1.1 Volume auto: criar SKU com L/A/C sem volume → `GET` e conferir `volume == L*A*C/1_000_000` (tolerância float).
- 1.2 Palete = lastro×camada: criar SKU com `lastro`/`camada`; validar via simulação de put-away (`POST /conferencia-entrada/enderecamento-automatico/:notaId {confirmar:false}`) que a capacidade por endereço = `lastro*camada` (a distribuição usa `calcularCapacidadePalete`).
- 1.3 Ordenação: criar 2 SKUs (sequencia 1 e 2) → `GET` retorna ordenado asc.
- 1.4 Resolve pendência: produto sem SKU → autorizar entrada gera pendência → criar SKU → pendência resolvida (`GET` pendências logísticas = 0). Skip se não for possível gerar pendência determinística.
- 1.5 Isolamento: cobre via assert de que a listagem por `produtoId` de outra empresa não retorna o SKU. Skip se não houver segunda empresa acessível (o token de QA é de uma empresa só) — documentar como limitação, alinhado ao test_21 existente.

### Req 2 — Dados Logísticos (`test_23_dados_logisticos.py`)
- Endpoints: `POST/GET/PUT/DELETE /dados-logisticos/{armazenagem,picking,expedicao}`.
- 2.1 Default FEFO: criar armazenagem sem `tipoNorma` → persistido `FEFO`.
- 2.2 Enum: `POST` com `tipoNorma` inválido → rejeitado (Zod 400). Assert status 400.
- 2.3 Resolve pendência: análogo a 1.4.
- 2.4 Independência: os três sub-cadastros consultáveis por `produtoId`.

### Req 3 — Agenda de Docas (`test_24_agenda_doca.py`)
- Endpoints: `POST /agenda-doca/agendar`, `PUT /agenda-doca/:id/mover`, `PUT /agenda-doca/:id/chegada`, `GET/POST/DELETE /agenda-doca/bloqueios`, `GET/PUT /agenda-doca/config`.
- Setup: garantir 1 `Doca` e ler `Config_Doca` (buffer, horário op). Se não houver doca cadastrada, skip com motivo.
- 3.1 Criar dentro do horário e sem conflito → `status=AGENDADO`.
- 3.2 Sobreposição com buffer → HTTP 409 e segundo agendamento não persistido (contar agendamentos antes/depois).
- 3.3 Fora do horário operacional → rejeição com motivo de horário.
- 3.4 Bloqueio de slot sobreposto → agendamento rejeitado; limpar bloqueio no teardown.
- 3.5 Mover para janela livre → aceito (revalidação exclui o próprio id).
- 3.6 Registrar chegada → `horaChegadaReal` gravada, `status=NA_DOCA`.

### Req 4 — Portaria (`test_25_portaria_estados.py`)
- Endpoints: `POST /portaria/conferir/:id`, `POST /portaria/autorizar-entrada/:id`, `POST /portaria/registrar-saida/:id`, `GET /portaria/agendamentos-hoje`, `GET /portaria/validar-placa/:placa`.
- 4.1 Conferir AGENDADO → `ESPERA` + Nota_Entrada PENDENTE quando há pedido. Skip se não houver pedido de compra vinculável de forma determinística.
- 4.2 Autorizar não-CONFIRMADO → HTTP 422 (assert mensagem de status).
- 4.3 Autorizar CONFIRMADO → `NA_DOCA` + OS CONFERENCIA (verificar OS via API se exposta; senão via efeito no fluxo de conferência).
- 4.4 "Agendado sem NF" sem credenciais → HTTP 422, nada alterado.
- 4.5 Credenciais inválidas → HTTP 401.
- 4.6 Pendência logística ao autorizar → início de conferência bloqueado (422 `PENDENCIA_LOGISTICA`).
- Vários itens dependem de estado sequencial (CONFIRMADO só via módulo agenda). Onde o estado não puder ser montado só por API, usar `skip` honesto — mesmo padrão do `test_09` de referência.

### Req 5 — Conferência: bloqueios (`test_26_conferencia_bloqueios.py`)
- Endpoints: `POST /conferencia-entrada/iniciar/:notaId`, `GET /conferencia-entrada/:notaId`.
- 5.1 Nota sem itens → iniciar 422.
- 5.2 Pendência logística PENDENTE → iniciar 422 `PENDENCIA_LOGISTICA`.
- 5.3 Nota ok → `EM_CONFERENCIA`.
- 5.4 `conferenciaLoteCega` → lote/validade nulos na resposta de iniciar. Ler flag da empresa; se não ativável por API, skip.
- 5.5 `produtoNaoEncontrado=true` para item com código sem Produto: criar nota com item de código inexistente → iniciar e conferir a flag por item.

### Req 6 — Conferência: quantidade/tolerância (`test_27_conferencia_quantidade.py`)
- Endpoint: `POST /conferencia-entrada/conferir-todos/:notaId`.
- 6.1 Qtd exata → `temDivergencia=false`.
- 6.2 Excesso → `DIVERGENTE`/`EXCESSO`, item vira `PENDENTE_SEGUNDA_CONFERENCIA` (verificar via `GET /:notaId`).
- 6.3 Dentro da tolerância: setar `Produto.toleranciaQuantidadePercentual` (via API de produto, se disponível) → conferir com desvio abaixo → `TOLERANCIA_ACEITA`. Skip se não for possível setar a tolerância por API.
- 6.4 Recebimento parcial: exige `Empresa.permiteRecebimentoParcial=true`; se não ativável, skip. Falta → `RECEBIMENTO_PARCIAL`.
- 6.5 Qtd ausente → `QUANTIDADE_NAO_INFORMADA`.

### Req 7 — Lote/validade/shelf-life (`test_28_conferencia_lote_shelflife.py`)
- Endpoint: `POST /conferencia-entrada/conferir-todos/:notaId` (+ `conferir-item`).
- Setup: produto com `exigeLote=true` e/ou `shelfLifeMinimo` (setar via API de produto; skip se não disponível).
- 7.1/7.2 lote/validade ausentes → `LOTE_NAO_INFORMADO`/`VALIDADE_NAO_INFORMADA`.
- 7.3 lote divergente da NF-e → `PENDENTE_SEGUNDA_CONFERENCIA` com `LOTE_DIVERGENTE`.
- 7.4 shelf-life insuficiente → 422 `SHELF_LIFE` com `diasRestantes`/`dataMinima`.
- 7.5 shelf-life suficiente → não bloqueia.

### Req 8 — Segunda conferência/HOLD (`test_29_segunda_conferencia_hold.py`)
- Endpoints: `POST /conferencia-entrada/segunda-conferencia/:notaId`, `.../hold`, `.../rejeitar-item`, `.../autorizar-senha`, `POST /conferencia-entrada/confirmar/:notaId`.
- 8.1 2ª conf. igual à NF-e → item `CONFERIDO`.
- 8.2 2ª conf. qtd diverge sem aceite → `divergenciaQuantidade`, item segue pendente.
- 8.3 HOLD → `statusConferencia=HOLD`, motivo registrado.
- 8.4 confirmar com item pendente → 422 `ITENS_PENDENTES_SEGUNDA_CONFERENCIA`.
- 8.5 confirmar com item em HOLD → 422 `ITENS_EM_HOLD`.
- 8.6 confirmar sem pendências → `CONFERIDA` + OS `ENDERECAMENTO`.

### Req 9 — PCP → WMS (`test_30_pcp_wms_recebimento.py`)
- Fluxo: criar OP (via API PCP) com produto acabado, avançar etapas e concluir a última (`PATCH /pcp/etapas/:id/concluir`), depois verificar Nota_Entrada `tipo=PRODUCAO`.
- Pré-condição da flag: ler/ajustar `pcp.integracaoWmsAutomatica` via `GET/PATCH /pcp/configuracao` (só ADMIN). Restaurar o valor original no teardown.
- 9.1 flag ON → cria NotaEntrada `PRODUCAO`/`PRD`/`PENDENTE`.
- 9.2 `empresaId` da nota == da OP.
- 9.3 quantidade == produzida (fallback planejada).
- 9.4 flag OFF → nenhuma NotaEntrada `PRODUCAO`.
- 9.5 nota entra no fluxo de conferência (aparece em `/notas-pendentes`).
- Montar uma OP completa por API pode não ser determinístico (BOM/roteiro). Onde o setup não for viável, skip honesto e documentar; o mínimo garantido é a verificação de 9.2/9.5 sobre uma nota `PRODUCAO` recém-criada.

## Components and Interfaces

Esta seção detalha os componentes (métodos do `WmsApiClient`) e suas interfaces
com o backend. Nenhuma rota nova de backend é criada — é QA puro sobre o
comportamento existente.

### Extensões no `WmsApiClient` (wms_api.py)

Métodos novos, agrupados por domínio (todos reutilizam `_get/_post/_put/_patch`
existentes e o padrão de assert 5xx):

- SKU: `criar_sku`, `listar_skus`, `atualizar_sku`, `excluir_sku`.
- Dados logísticos: `criar_dados_armazenagem`, `criar_dados_picking`, `criar_dados_expedicao`, `listar_dados_*`.
- Agenda: `listar_docas`, `ler_config_doca`, `agendar_doca`, `mover_agendamento`, `registrar_chegada`, `criar_bloqueio_slot`, `remover_bloqueio_slot`.
- Portaria: `portaria_conferir`, `portaria_autorizar_entrada`, `portaria_registrar_saida`, `listar_agendamentos_hoje`.
- Conferência: `iniciar_conferencia`, `obter_nota`, `conferir_todos`, `conferir_item`, `segunda_conferencia`, `colocar_em_hold`, `confirmar_conferencia`, `listar_notas_pendentes`, `listar_pendencias_logisticas`.
- Produto (setup de regra): `garantir_produto_com_regras(exige_lote, shelf_life_minimo, tolerancia)` — usa a API de produto se disponível; caso contrário, sinaliza indisponibilidade para o teste decidir `skip`.
- Config PCP: `ler_config_pcp`, `set_integracao_wms_automatica(bool)`.
- PCP: `criar_op`, `concluir_ultima_etapa_op` (best-effort; retorna indisponível quando o setup de OP não é viável por API).

Cada método novo documenta a rota exata e retorna dados já desserializados,
com assert de 5xx herdado. Nenhuma rota nova de backend é criada por esta
feature — é QA puro sobre o comportamento existente.

## Data Models

A suíte não define modelos de dados próprios — consome os modelos existentes do
backend via API. Os modelos relevantes e seus campos que ditam regras de teste:

- **NotaEntrada**: `status` (PENDENTE|EM_CONFERENCIA|CONFERIDA|ENDERECADA), `tipo` (COMPRA|PRODUCAO), `serie`, `empresaId`, `numero`, `itens[]`.
- **ItemNotaEntrada**: `quantidade`, `lote`, `validade`, `codigoProduto`, `statusConferencia` (PENDENTE|CONFERIDO|PENDENTE_SEGUNDA_CONFERENCIA|HOLD|REJEITADO), `holdMotivo`.
- **Produto**: `exigeLote` (bool), `shelfLifeMinimo` (int dias), `toleranciaQuantidadePercentual` (decimal, null→padrão empresa), `codigo`.
- **Empresa**: `conferenciaLoteCega`, `permiteRecebimentoParcial`, `toleranciaQuantidadePercentualPadrao`, `usaWms`.
- **Sku**: `sequencia`, `lastro`, `camada`, `qtdEmbalagem`, `largura/altura/comprimento`, `volume` (auto = L×A×C/1e6), `pesoBruto/pesoLiquido`, `codigoBarra`, `empresaId`.
- **DadosLogisticosArmazenagem**: `tipoNorma` (FEFO|FIFO|LIFO), `enderecoFixoId`, `fixo`, `pulmaoRegulador`.
- **AgendaWms**: `status` (AGENDADO|CONFIRMADO|ESPERA|NA_DOCA|CONFERINDO|CONFERIDO|RECEBIDO|CANCELADO|ATRASADO), `docaId`, `dataPrevista`, `horaInicio/horaFim`, `horaChegadaReal`.
- **ConfigDoca**: `horaAberturaOp`, `horaFechamentoOp`, `bufferMinutos`, `toleranciaAtraso`.
- **PendenciaLogistica**: `status` (PENDENTE|RESOLVIDA), `notaEntradaId`, `empresaId`.
- **Parametro** (`pcp.integracaoWmsAutomatica`): flag booleana de integração automática PCP→WMS.

## Correctness Properties

Propriedades que devem valer independentemente dos dados de entrada:

Property 1: Conservação na conferência — a quantidade conferida aceita nunca gera saldo físico maior que a quantidade da nota (excesso vira divergência, não saldo).
**Validates: Requirements 6.1, 6.2**

Property 2: Monotonicidade de estado da nota — uma nota só avança PENDENTE→EM_CONFERENCIA→CONFERIDA→ENDERECADA; rejeitar volta a PENDENTE, nunca pula estados.
**Validates: Requirements 5.3, 8.6**

Property 3: Bloqueio de confirmação — uma nota com qualquer item em `PENDENTE_SEGUNDA_CONFERENCIA` ou `HOLD` nunca pode ser confirmada.
**Validates: Requirements 8.4, 8.5**

Property 4: Tolerância determinística — `dentroTolerancia` ⟺ `percentualDesvio ≤ toleranciaAplicada`, com `toleranciaAplicada = produto ?? empresa ?? 0`.
**Validates: Requirements 6.3**

Property 5: Isolamento multi-tenant — nenhuma consulta retorna dado de `empresaId` diferente do usuário (SKU, agenda, nota, saldo).
**Validates: Requirements 1.5**

Property 6: Integração PCP→WMS — a NotaEntrada de produção sempre pertence ao `empresaId` da OP, nunca ao do usuário que concluiu a etapa.
**Validates: Requirements 9.2**

## Error Handling

- 5xx em qualquer chamada → falha dura (assert no `_get/_post`).
- Pré-requisito ausente (sem doca, sem pedido vinculável, flag não ajustável,
  segunda empresa indisponível, setup de OP inviável) → `pytest.skip(motivo)`.
- Divergência conhecida requisito×backend → `xfail(strict=True)` com comentário
  apontando o arquivo/linha do backend.
- Teardown sempre executa (fixture com `yield`) e registra resultado da limpeza.

## Testing Strategy

- Execução recomendada módulo a módulo (evita acúmulo de estado), como já
  documentado no `HANDOFF-PROXIMA-SESSAO.md`.
- Modo visual disponível para acompanhamento (`HEADLESS=false`, `SLOW_MO`).
- Pré-requisito de ambiente: rodar `manutencao_ambiente.py` antes (garante
  produto demo endereçável); a demo foi zerada e precisa ser repovoada
  conforme seção 0 do handoff.
- Evidência automática em falha (hook existente) + relatório HTML.
```
