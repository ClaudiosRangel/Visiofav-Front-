# Handoff — Próxima sessão de QA (fluxo WMS completo)

Este documento prepara a retomada do trabalho de QA automatizado do WMS. Leia
antes de continuar. Atualizado ao final da sessão em que o spec
`qa-fluxo-wms-completo` foi implementado (44/44 tasks) e o endereço de overflow
foi adicionado ao backend.

---

## 0. AÇÃO IMEDIATA AO RETOMAR — ambiente foi zerado

A empresa **VisioFab Demo** teve **todos os dados zerados** pelo usuário. Antes
de rodar qualquer teste de fluxo, é preciso **repovoar os pré-requisitos**,
senão os testes de put-away/saldo vão skipar por falta de dados.

Rodar, na ordem, do diretório `tests/e2e-qa` com o venv ativo
(`.venv\Scripts\activate`):

1. **Garantir cadastros base** (o zeramento removeu produtos, endereços, SKUs,
   centros, etc.). Verificar/repor via UI ou API:
   - Ao menos **1 Centro de Distribuição + Depósito + Zona + Formato de
     endereço** configurados (a criação de endereço depende disso).
   - **Endereços de armazenagem** gerados (`POST /enderecos/gerar` ou pela tela
     de Endereços). Sem endereços, não há put-away.
   - **Marcar 1–2 endereços como OVERFLOW** (`PUT /enderecos/:id`
     `{ "permiteOverflow": true }`) — zona de transbordo (ver seção 3).
   - Um **Centro de Produção** ativo (para test_12 — recebimento por produção).
   - Idealmente: um **Cliente** e uma **Tabela de Preço** (para test_18
     cross-dock e cenários de venda/onda).

2. **Rodar `python manutencao_ambiente.py`** (utilitário já existente): ele
   **garante o produto demo `MOCA395CX48`** (endereçável, com SKU lastro/camada)
   e zera saldos de QA residuais. É idempotente. Rodar em modo visual para
   acompanhar: `$env:HEADLESS="false"; $env:SLOW_MO="300"; python manutencao_ambiente.py`.

3. **Validar o caminho crítico**: `pytest test_11_fluxo_wms_encadeado.py -s`
   (modo visual: `$env:HEADLESS="false"; $env:SLOW_MO="500"`). Se passar, o
   ambiente está pronto. Se skipar/falhar no seed, faltam cadastros base
   (voltar ao passo 1).

> **Importante**: com a demo recém-zerada, a distribuição inteligente só aloca
> em endereços 100% livres (Prioridade 3) ou de overflow (Prioridade 4). Como o
> ambiente estará "vazio", os endereços novos estarão livres — o put-away deve
> funcionar direto. O overflow só é exercitado quando o armazém enche.

---

## 1. O que ESTÁ pronto e validado

- **Spec `qa-fluxo-wms-completo`: 44/44 tasks concluídas.** Arquivos de teste
  `test_11`–`test_21` criados, mais infra (`wms_api.py`, fixtures no
  `conftest.py`, limpeza rastreável, evidências, relatório HTML).
- **Caminho crítico (test_11) validado** headless e visual (passou várias
  vezes quando o ambiente tinha endereço livre).
- **Bugs reais corrigidos** durante o trabalho:
  - `wms_api.py`: lote cabe em `VarChar(30)` (`lote_do_run`); produto de QA
    idempotente; `limit<=100` em `/centros-producao`.
  - **Backend (deployado em `main`)**: `SaldoEndereco` agora grava `empresaId`
    (bug de isolamento multi-tenant — o bloqueio por lote não enxergava as
    posições); bloqueio tolera legado (`empresaId null`).
  - **Backend (deployado)**: **Endereço de overflow** no put-away (ver seção 3).

## 2. LIMITAÇÃO IMPORTANTE — o que o QA cobre HOJE (responde à pergunta do usuário)

**Pergunta**: "o QA está verificando a regra de negócio com comportamento
correto de CADA menu?"

**Resposta honesta**: parcialmente.

- `test_01`–`test_10` (originais): majoritariamente **SMOKE** — verificam que a
  tela/menu carrega e o formulário funciona. NÃO validam a fundo a regra de
  negócio de cada menu.
- `test_11`–`test_21` (novos): **QA de valor de negócio** — validam resultados
  esperados (saldo aumenta pela quantidade exata, `disponivel = fisico −
  reservado`, bloqueio subtrai do disponível, reserva vs disponível, ajuste de
  inventário = diferença, conservação no ressuprimento, isolamento por empresa,
  autenticação por API-Key, etc.). Usam a API como fonte de verdade e conferem
  números.
- **A cobertura é por FLUXO, não menu-a-menu.** Segue a cadeia recebimento →
  conferência → endereçamento → saldo → reserva → picking → ondas → expedição →
  inventário → bloqueio → ressuprimento/cross-dock → integração externa →
  isolamento. NÃO é uma varredura exaustiva de cada menu do sistema validando
  cada regra.
- **Vários cenários fazem `skip` honesto** por dependerem de estado inatingível
  de forma determinística em produção (ondas/expedição exigem `PedidoVenda` em
  `EM_SEPARACAO` via emissão de NF-e real; cross-dock exige tabela de preço;
  integração API-Key positiva exige empresa `WMS_STANDALONE`; webhook-disparo
  exige entrega prévia; importação por arquivo exige endpoint não publicado).

### Lacuna a considerar para a próxima sessão

Se o objetivo é "**cada menu com comportamento correto conforme a regra de
negócio**", falta:
- Uma **matriz de cobertura por menu** (listar cada tela do WMS e a regra de
  negócio que deveria ser validada) — hoje não existe.
- Elevar os smoke tests (`test_01`–`test_10`) para validação de valor onde fizer
  sentido.
- Cobrir menus/regras não exercitados pelo fluxo principal (ex.: cadastros
  específicos, relatórios, configurações, permissões por perfil).

Sugestão: criar um novo spec `qa-cobertura-menus-wms` (ou estender este) com a
matriz menu × regra de negócio × asserção, e implementar módulo a módulo.

## 3. Endereço de OVERFLOW (transbordo) — implementado no backend

Lacuna de negócio descoberta e **corrigida** nesta sessão: a distribuição
inteligente do put-away não tinha fallback quando o armazém enchia (retornava
`alocacoes: []`, deixando a mercadoria conferida sem destino).

- Nova flag **`permiteOverflow`** (`permite_overflow` em `endereco`, default
  `false`). Ativar via `PUT /enderecos/:id { "permiteOverflow": true }` ou no
  `POST /enderecos`.
- 4ª prioridade na distribuição (`enderecamento-inteligente.routes.ts`): quando
  fixo/consolidação/livre não cobrem, aloca em endereços de overflow (aceitam
  saldo mesmo já ocupados).
- Doc completo: `VisioFab.Wms.Back/docs/melhoria-endereco-overflow-putaway.md`.
- **Pendência de setup**: marcar ao menos 1 endereço como overflow na demo
  repovoada (a flag é opt-in por endereço).

## 4. Como rodar (lembrete)

```powershell
cd C:\Source\VisioFab.Wms.Front\tests\e2e-qa
.venv\Scripts\activate

# Módulo a módulo (recomendado — evita acúmulo de estado entre módulos):
pytest test_11_fluxo_wms_encadeado.py -s
pytest test_13_saldos_consolidados.py -s
# etc.

# Modo visual (ver os cliques):
$env:HEADLESS="false"; $env:SLOW_MO="500"; pytest test_11_fluxo_wms_encadeado.py -s

# Suíte inteira (headless) — ~18min; alguns skips são esperados:
pytest
```

## 5. Notas de robustez descobertas (para não re-investigar)

- **Rodar a suíte inteira em bloco** reaproveita o mesmo produto demo e pode
  acumular saldo/esgotar endereços entre módulos. Preferir módulo a módulo, OU
  garantir endereços de overflow suficientes, OU rodar `manutencao_ambiente.py`
  entre execuções.
- **`GET /notas-entrada/:id`** retorna 500 (não 404) para algumas notas —
  robustez do backend; os testes contornam sem depender dessa rota.
- **`aplicar-ajustes` do inventário** falha em bloco (500) quando há item com
  endereço corrompido (`enderecoCompleto` com `NaN`) — dados legados. O
  `manutencao_ambiente.py` pula esses e tem fallback item-a-item.
- **Requisito 2.2** (produção zero → nenhuma nota): o backend NÃO cumpre (faz
  fallback para a quantidade planejada). Documentado no `test_12`.
- **Requisito 4.2** (reserva > disponível rejeitada): o backend NÃO valida —
  `test_14` marca como `xfail(strict=True)` para registrar sem mascarar.

## 6. Arquivos-chave

- `wms_api.py` — cliente de API do fluxo (seed, avanço de estado, verificação).
- `conftest.py` — fixtures (`run_id`, `wms_api`, `page_auth`) + limpeza
  rastreável (`cleanup_registry`) + hook de evidência em falha.
- `manutencao_ambiente.py` — utilitário: garante produto demo + zera saldos de
  QA (liberar endereços).
- `README.md` — documentação completa da suíte expandida.
- `evidencias/` — screenshots e relatórios de limpeza por `run_id`.
- `report.html` — relatório HTML consolidado (pytest-html).

---

## 7. COMO INICIAR A PRÓXIMA SESSÃO (leia isto primeiro)

Cole no início da próxima conversa algo como:

> "Leia `tests/e2e-qa/HANDOFF-PROXIMA-SESSAO.md`. Vamos checar toda a regra de
> negócio do WMS, tanto integrado ao ERP Vizor quanto integrado a terceiros
> (standalone / API-Key). Antes de rodar, repovoe a VisioFab Demo (seção 0).
> Depois quero que você teste, menu a menu, cada tela do WMS conforme as
> matrizes das seções 8 e 9 — implementando as asserções que ainda faltam.
> Rode os testes em modo visual para eu acompanhar os cliques."

Pré-requisitos que a próxima sessão precisa ter em mãos:
- **ERP integrado**: empresa **VisioFab Demo**, `admin@visiofab.com` / `987123`,
  front Vercel `https://visiofav-front-wofr.vercel.app`, API Render
  `https://api.vizorerp.com.br/api`. Token Bearer no `localStorage`
  (`visiofab-wms-token`).
- **Standalone (terceiros)**: precisa de uma empresa com
  `modoOperacao = WMS_STANDALONE` e `integracaoAtiva = true`, configurada em
  `/wms-standalone/config`. Login do operador standalone usa `wms-token`
  (localStorage) — diferente do ERP. A **integração externa** (parceiro 3PL)
  usa header **`X-Api-Key`** contra rotas **`/api/v1/wms/*`** (NÃO Bearer).
  Para exercitar a integração positiva, exportar a env **`WMS_API_KEY`** com a
  API-Key da empresa standalone antes de rodar o test_19/20. Sem essa env, o
  test_19 só cobre o caminho negativo (401/403), que já passa.

> **Sugestão de spec novo**: criar `qa-cobertura-menus-wms` (front) com uma
> matriz menu × regra de negócio × asserção, implementando módulo a módulo. As
> seções 8 e 9 abaixo já são o rascunho dessa matriz — basta transpor para
> requirements/design/tasks.

---

## 8. MATRIZ DE COBERTURA — WMS integrado ao ERP Vizor (rotas `/wms/*` e `/estoque`)

Fonte do menu: `src/components/layout/ModuleSidebar.tsx` (grupo `title: 'WMS'`).
Legenda de cobertura QA atual: ✅ coberto por asserção de valor · 🔸 smoke
(só carrega tela) · ⬜ não coberto.

### Entrada (Inbound)
| Menu | Rota | Regra de negócio esperada | QA hoje | Asserção a implementar |
|---|---|---|---|---|
| Agenda de Docas | `/wms/agenda` | Agendamento não sobrepõe janela/doca ocupada | ⬜ | Criar 2 agendamentos na mesma doca/horário → 2º rejeitado |
| Agenda Avançada | `/wms/agenda-doca` | Idem + capacidade da doca | ⬜ | Capacidade excedida rejeita |
| Portaria | `/wms/portaria` | Chegada→liberação é sequencial (não pula estado) | 🔸 (test_09 TS ref) | Liberar sem chegada registrada → erro |
| Notas de Entrada | `/recebimento` | Nota PENDENTE entra no fluxo de conferência | ✅ test_11 | ok |
| Conferência de Entrada | `/wms/conferencia-entrada` | Qtd conferida ≤ nota; exige lote/shelf-life quando produto exige; tolerância aplicada | 🔸 | Conferir divergência acima da tolerância → bloqueia |
| Endereçamento | `/wms/enderecamento` | Put-away gera SaldoEndereco com empresaId; distribuição por prioridade (fixo→consolida→livre→overflow) | ✅ test_11 + overflow | Validar overflow quando cheio |
| Fila de Exceções | `/wms/fila-excecoes` | Item divergente cai na fila até resolução | ⬜ | Divergência → aparece na fila |
| Pendências CC-e | `/wms/pendencias-cce` | CC-e só após aprovação da nota (bug histórico) | ⬜ | Pendência só surge no confirmar |

### Expedição (Outbound)
| Menu | Rota | Regra de negócio | QA hoje | Asserção a implementar |
|---|---|---|---|---|
| Separação (Picking) | `/picking` | Picking reduz saldo do endereço de origem | 🔸 skip | Exige pedido EM_SEPARACAO (via NF-e) |
| Conferência de Saída | `/wms/conferencia-saida` | Qtd conferida = separada | ⬜ | Divergência bloqueia embarque |
| Embalagem | `/expedicao` | Volume fecha com itens conferidos | 🔸 | — |
| Montagem de Carga | `/wms/montagem-carga` | Peso/volume ≤ capacidade do veículo | ⬜ | Excesso rejeita |
| Mapas de Carregamento | `/wms/mapas-carregamento` | Mapa reflete cargas montadas | ⬜ | — |
| Cross-Docking | `/wms/cross-dock` | Entrada casa com pedido sem endereçar | 🔸 skip (test_18) | Exige tabela de preço |

### Estoque
| Menu | Rota | Regra de negócio | QA hoje | Asserção a implementar |
|---|---|---|---|---|
| Consulta de Saldos | `/estoque` | `disponivel = fisico − reservado`; origem WMS vs ERP | ✅ test_13 | ok |
| Mapa do Armazém | `/wms/mapa` | Ocupação reflete SaldoEndereco | ⬜ | Endereço com saldo aparece ocupado |
| Transferência | `/wms/transferencia-endereco` | Conservação: origem − X = destino + X | ✅ test_17 (parcial) | Reforçar destino |
| Ressuprimento | `/wms/ressuprimento` | Conservação pulmão→picking | ✅ test_17 | ok |
| Manutenção de Estoque | `/wms/manutencao-estoque` | Ajuste manual gera movimento auditável | ⬜ | Ajuste = delta |
| Inventário | `/wms/inventario` | Ajuste = contagem − sistema | ✅ test_16 | ok |
| Classificação ABC | `/wms/classificacao-abc` | Curva por giro/valor | ⬜ | A+B+C = 100% |
| Bloqueios & Quarentena | `/wms/bloqueios` | Bloqueio subtrai do disponível; enxerga saldo por empresaId | ✅ test_15 | ok (bug corrigido) |
| Mudança de Picking | `/wms/picking/mudancas` | Realoca endereço de picking | ⬜ | — |

### Demais grupos (Operacional, Config WMS, Faturamento, Picking Zona, LMS, Pátio, Multi-CD, Demanda/IA, BI, Wave, Portal 3PL, Gestão, Cadastros)
Nenhum coberto por asserção de valor hoje (⬜). Prioridade sugerida para a
próxima sessão, do mais crítico ao menos:
1. **Multi-CD** (`/wms/multi-cd*`) — transferência entre CDs deve conservar
   estoque em trânsito (origem baixa, trânsito sobe, destino recebe).
2. **Wave Planning** (`/wms/wave*`) — onda agrupa pedidos; simular não persiste.
3. **Faturamento 3PL** (`/wms/faturamento*`) — fatura = Σ contratos/movimentos.
4. **Cadastros** (SKU, Dados Logísticos, Produtos) — SKU lastro/camada coerente.
5. Demais (LMS, Pátio, BI, Demanda, Portal 3PL, Relatórios) — smoke primeiro.

---

## 9. MATRIZ DE COBERTURA — WMS integração com TERCEIROS (standalone / API-Key)

### 9.1 Menus do app standalone (`/wms-app/*`)
Fonte: `src/app/(wms-standalone)/layout.tsx` (`WMS_MENU`). **Descoberta
importante**: a maioria das telas standalone é **STUB** ("Funcionalidade em
desenvolvimento para o modo standalone", ~400 bytes). Só 6 são funcionais.

| Menu | Rota | Estado | Regra de negócio | QA a implementar |
|---|---|---|---|---|
| Dashboard | `/wms-app/dashboard` | ✅ funcional | Indicadores do CD standalone | Smoke + números batem com API |
| Notas de Entrada | `/wms-app/recebimento` | ✅ funcional | Recebimento standalone | Nota criada aparece |
| Conferência | `/wms-app/conferencia` | ⛔ STUB | — | Nada a testar até implementar |
| Endereçamento | `/wms-app/enderecamento` | ⛔ STUB | — | idem |
| Consulta de Saldos | `/wms-app/estoque` | ✅ funcional | Saldo por endereço | disponivel = fisico − reservado |
| Transferência | `/wms-app/transferencia` | ⛔ STUB | — | — |
| Ressuprimento | `/wms-app/ressuprimento` | ⛔ STUB | — | — |
| Inventário | `/wms-app/inventario` | ✅ funcional | Ajuste = contagem − sistema | Ajuste = delta |
| Classificação ABC | `/wms-app/abc` | ⛔ STUB | — | — |
| Bloqueios | `/wms-app/bloqueios` | ✅ funcional | Bloqueio subtrai do disponível | Igual test_15, escopo standalone |
| Separação | `/wms-app/separacao` | ⛔ STUB | — | — |
| Conferência Saída | `/wms-app/conferencia-saida` | ⛔ STUB | — | — |
| Carregamento | `/wms-app/carregamento` | ⛔ STUB | — | — |
| KPIs | `/wms-app/kpis` | ⛔ STUB | — | — |
| Movimentações | `/wms-app/movimentacoes` | ⛔ STUB | — | — |
| Configurações | `/wms-app/configuracoes` | ✅ funcional | modoOperacao/integracaoAtiva/sistemaExterno | Config persiste |

> **Recomendação**: NÃO escrever asserção de valor para os 10 stubs — apenas
> um smoke test que confirma que a tela exibe "em desenvolvimento" (documenta o
> gap sem falso-verde). Focar as asserções de valor nas 6 telas funcionais.
> Se o usuário quiser cobertura completa do standalone, o passo anterior é
> **implementar** essas 10 telas (fora do escopo de QA).

### 9.2 Integração externa por API-Key (parceiro 3PL) — rotas `/api/v1/wms/*`
Autenticação por header **`X-Api-Key`** (não Bearer). Empresa precisa ser
`WMS_STANDALONE` com integração ativa.

| Cenário | QA hoje | O que falta |
|---|---|---|
| API-Key inválida/ausente → 401/403 | ✅ test_19 (negativo) | ok |
| API-Key válida → consulta saldo/recebe entrada | ⬜ | Exige env `WMS_API_KEY`; implementar caminho positivo |
| Isolamento: parceiro A não vê estoque de B | ✅ test_21 (Bearer) | Replicar via X-Api-Key |
| Webhook de disparo (entrega/movimento) | ⬜ skip | Exige entrega prévia registrada |
| Importação por arquivo (lote de itens) | ⬜ skip | Endpoint não publicado — confirmar com backend |

---

## 10. RESUMO EXECUTIVO PARA O USUÁRIO

- O QA de **fluxo** está pronto (44 tasks, test_11–21) e valida regra de negócio
  por cadeia de valor, com números conferidos via API. Mas **não** é uma
  varredura menu-a-menu — as seções 8 e 9 acima são o mapa do que ainda falta
  para cobrir "cada menu com sua regra de negócio".
- **WMS integrado ao ERP**: ~11 menus/grupos têm regra de negócio relevante; hoje
  6 telas do fluxo principal têm asserção de valor, o resto é smoke ou não
  coberto. Prioridades na seção 8.
- **WMS com terceiros (standalone)**: 10 de 16 telas são **stubs não
  implementados** — importante o usuário saber que "testar todos os menus do WMS
  de integração com terceiro" hoje significaria, na prática, testar 6 telas
  funcionais + a integração por API-Key. As outras 10 precisam ser
  **construídas** antes de terem regra de negócio a validar.
- Ambiente da demo foi zerado: **repovoar (seção 0) antes de qualquer teste.**
