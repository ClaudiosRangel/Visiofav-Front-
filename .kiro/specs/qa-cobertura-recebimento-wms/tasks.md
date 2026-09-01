# Implementation Plan

## Overview

Plano de implementação da suíte de QA de cobertura de recebimento WMS
(SKU, Dados Logísticos, Agenda de Docas, Portaria, Conferência de Entrada,
segunda conferência/HOLD e integração PCP→WMS). A task 1 (extensão do
`WmsApiClient`) é pré-requisito de todas as demais. As tasks 2–10 são módulos
de teste independentes entre si e podem ser implementados em qualquer ordem
após a task 1. A task 11 (documentação) fecha o trabalho.

## Tasks

- [ ] 1. Estender `WmsApiClient` com métodos de setup e verificação por domínio
- [ ] 1.1 Adicionar métodos de SKU e Dados Logísticos ao `wms_api.py`
  - Implementar `criar_sku`, `listar_skus`, `atualizar_sku`, `excluir_sku` (rotas `/sku`).
  - Implementar `criar_dados_armazenagem/picking/expedicao` e `listar_dados_*` (rotas `/dados-logisticos/*`).
  - Cada método documenta a rota exata e retorna JSON desserializado; herda assert de 5xx.
  - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.4_

- [ ] 1.2 Adicionar métodos de Agenda de Docas e Portaria ao `wms_api.py`
  - Implementar `listar_docas`, `ler_config_doca`, `agendar_doca`, `mover_agendamento`, `registrar_chegada`, `criar_bloqueio_slot`, `remover_bloqueio_slot`.
  - Implementar `portaria_conferir`, `portaria_autorizar_entrada`, `portaria_registrar_saida`, `listar_agendamentos_hoje`.
  - _Requirements: 3.1, 3.2, 3.6, 4.1, 4.2, 4.3_

- [ ] 1.3 Adicionar métodos de Conferência e setup de regras de Produto ao `wms_api.py`
  - Implementar `iniciar_conferencia`, `obter_nota`, `conferir_todos`, `conferir_item`, `segunda_conferencia`, `colocar_em_hold`, `confirmar_conferencia`, `listar_notas_pendentes`, `listar_pendencias_logisticas`.
  - Implementar `garantir_produto_com_regras(exige_lote, shelf_life_minimo, tolerancia)` — usa API de produto se disponível; sinaliza indisponibilidade para o teste decidir `skip`.
  - _Requirements: 5.1, 5.3, 6.1, 6.5, 7.1, 8.1_

- [ ] 1.4 Adicionar métodos de configuração PCP e OP ao `wms_api.py`
  - Implementar `ler_config_pcp`, `set_integracao_wms_automatica(bool)` (rotas `/pcp/configuracao`).
  - Implementar `criar_op` e `concluir_ultima_etapa_op` (best-effort; retorna indisponível quando o setup de OP não é viável por API).
  - _Requirements: 9.1, 9.4_

- [ ] 2. Implementar `test_22_sku_regras.py` (Req 1)
  - 22.1 Volume auto-calculado (`L×A×C/1e6`) ao criar SKU sem volume.
  - 22.2 Capacidade de palete = `lastro×camada` via simulação de put-away.
  - 22.3 Listagem de SKUs ordenada por `sequencia`.
  - 22.4 Criar SKU resolve pendência logística (skip se não gerável).
  - 22.5 Isolamento multi-tenant de SKU (skip se sem 2ª empresa; documentar limitação).
  - Limpeza via `cleanup_registry`; evidência em falha.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.1, 10.2, 10.3_

- [ ] 3. Implementar `test_23_dados_logisticos.py` (Req 2)
  - 23.1 Default `tipoNorma=FEFO`. 23.2 Enum inválido rejeitado (400).
  - 23.3 Criar dados logísticos resolve pendência (skip se não gerável).
  - 23.4 Consulta independente dos três sub-cadastros por `produtoId`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.1, 10.2_

- [ ] 4. Implementar `test_24_agenda_doca.py` (Req 3)
  - 24.1 Agendamento válido → AGENDADO. 24.2 Sobreposição+buffer → 409, não persiste.
  - 24.3 Fora do horário operacional → rejeição com motivo.
  - 24.4 Bloqueio de slot sobreposto → rejeição; limpar bloqueio no teardown.
  - 24.5 Mover para janela livre → aceito. 24.6 Registrar chegada → NA_DOCA + `horaChegadaReal`.
  - Skip se não houver Doca cadastrada.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.2, 10.3_

- [ ] 5. Implementar `test_25_portaria_estados.py` (Req 4)
  - 25.1 Conferir AGENDADO → ESPERA + nota PENDENTE (skip se sem pedido vinculável).
  - 25.2 Autorizar não-CONFIRMADO → 422. 25.3 Autorizar CONFIRMADO → NA_DOCA + OS CONFERENCIA.
  - 25.4 Sem NF sem credenciais → 422 (nada alterado). 25.5 Credenciais inválidas → 401.
  - 25.6 Pendência logística ao autorizar → conferência bloqueada (422 `PENDENCIA_LOGISTICA`).
  - Skip honesto onde o estado sequencial (CONFIRMADO) não for montável só por API.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.2, 10.3_

- [ ] 6. Implementar `test_26_conferencia_bloqueios.py` (Req 5)
  - 26.1 Nota sem itens → iniciar 422. 26.2 Pendência logística → iniciar 422 `PENDENCIA_LOGISTICA`.
  - 26.3 Nota ok → EM_CONFERENCIA. 26.4 `conferenciaLoteCega` oculta lote/validade (skip se não ativável).
  - 26.5 `produtoNaoEncontrado=true` para código sem Produto.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.2, 10.3_

- [ ] 7. Implementar `test_27_conferencia_quantidade.py` (Req 6)
  - 27.1 Qtd exata → sem divergência. 27.2 Excesso → DIVERGENTE/EXCESSO + PENDENTE_SEGUNDA_CONFERENCIA.
  - 27.3 Dentro da tolerância → TOLERANCIA_ACEITA (skip se tolerância não setável).
  - 27.4 Recebimento parcial (skip se `permiteRecebimentoParcial` não ativável).
  - 27.5 Qtd ausente → QUANTIDADE_NAO_INFORMADA.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.2, 10.3_

- [ ] 8. Implementar `test_28_conferencia_lote_shelflife.py` (Req 7)
  - Setup: produto com `exigeLote`/`shelfLifeMinimo` (skip se não setável por API).
  - 28.1/28.2 lote/validade ausentes → divergência específica.
  - 28.3 lote divergente → PENDENTE_SEGUNDA_CONFERENCIA `LOTE_DIVERGENTE`.
  - 28.4 shelf-life insuficiente → 422 `SHELF_LIFE`. 28.5 shelf-life suficiente → não bloqueia.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.2, 10.3_

- [ ] 9. Implementar `test_29_segunda_conferencia_hold.py` (Req 8)
  - 29.1 2ª conf. igual à NF-e → CONFERIDO. 29.2 Qtd diverge sem aceite → divergenciaQuantidade.
  - 29.3 HOLD → statusConferencia HOLD + motivo. 29.4 Confirmar com pendente → 422 `ITENS_PENDENTES_SEGUNDA_CONFERENCIA`.
  - 29.5 Confirmar com HOLD → 422 `ITENS_EM_HOLD`. 29.6 Confirmar sem pendências → CONFERIDA + OS ENDERECAMENTO.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 10.2, 10.3_

- [ ] 10. Implementar `test_30_pcp_wms_recebimento.py` (Req 9)
  - 30.1 Flag ON → NotaEntrada PRODUCAO/PRD/PENDENTE (skip se setup de OP inviável por API).
  - 30.2 empresaId da nota == da OP. 30.3 quantidade == produzida (fallback planejada).
  - 30.4 Flag OFF → nenhuma NotaEntrada PRODUCAO. 30.5 Nota entra no fluxo (aparece em notas pendentes).
  - Restaurar flag original no teardown.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.2, 10.3_

- [ ] 11. Atualizar documentação da suíte
  - Atualizar `README.md` da `tests/e2e-qa` com os novos módulos `test_22`–`test_30` e como rodá-los (módulo a módulo, modo visual).
  - Atualizar `HANDOFF-PROXIMA-SESSAO.md` marcando a cobertura de recebimento/conferência/agenda/SKU/PCP como implementada, com os skips conhecidos.
  - _Requirements: 10.4, 10.5_

## Task Dependency Graph

```
1.1 ─┐
1.2 ─┤
1.3 ─┼─ 1 (extensão do WmsApiClient) ─┬─ 2  (test_22 SKU)
1.4 ─┘                                ├─ 3  (test_23 Dados Logísticos)
                                      ├─ 4  (test_24 Agenda Doca)
                                      ├─ 5  (test_25 Portaria)
                                      ├─ 6  (test_26 Conferência bloqueios)
                                      ├─ 7  (test_27 Conferência quantidade)
                                      ├─ 8  (test_28 Lote/shelf-life)
                                      ├─ 9  (test_29 Segunda conf./HOLD)
                                      └─ 10 (test_30 PCP→WMS)
                                                    │
                                    (2..10) ────────┴─ 11 (documentação)
```

- Task 1 (subtarefas 1.1–1.4) é pré-requisito de todas as tasks 2–10.
- Tasks 2–10 são independentes entre si (podem ser paralelizadas).
- Task 11 depende da conclusão das tasks 2–10.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "wave": 2, "tasks": ["2", "3", "4", "5", "6", "7", "8", "9", "10"] },
    { "wave": 3, "tasks": ["11"] }
  ]
}
```

## Notes

- Rodar do diretório `tests/e2e-qa` com o venv ativo (`.venv\Scripts\activate`).
- Repovoar a VisioFab Demo antes (seção 0 do `HANDOFF-PROXIMA-SESSAO.md`) —
  a demo foi zerada; rodar `manutencao_ambiente.py`.
- Preferir execução módulo a módulo para evitar acúmulo de estado.
- Usar `pytest.skip(motivo)` para pré-requisito de ambiente indisponível;
  `xfail(strict=True)` para divergência conhecida requisito×backend.
- Modo visual disponível: `$env:HEADLESS="false"; $env:SLOW_MO="500"`.
