# Implementation Plan — Desagrupar Planos na Fila (PCP)

## Overview

Feature **100% frontend** (`VisioFab.Wms.Front`), tela
`src/app/(interna)/pcp/programacao/page.tsx`. Adiciona a capacidade de
desagrupar, via menu de contexto (botão direito), uma OP de planos (caixa/tampa)
na fila — passando suas etapas a linhas independentes e arrastáveis. Sem
backend, sem schema, sem novo contrato de API (reusa `PATCH
/pcp/etapas/reordenar`).

Convenções (steering): `get_diagnostics` limpo nos arquivos tocados; `npm run
build` (Next) OK ao final; vitest com `--pool=threads`. Não-regressão: com
nenhuma OP desagrupada, o painel se comporta idêntico ao atual. Commits ficam com
o usuário. Tarefas `*` são testes (opcionais p/ MVP), fast-check/puras.

## Tasks

- [x] 1. [FRONT] Helpers puros do desagrupamento (+ parametrizar agrupamento)
  - [x] 1.1 Criar `src/app/(interna)/pcp/programacao/desagrupar-planos.ts`:
    - `chaveDesagrupar(centroId, opId): string` (`${centroId}:${opId}`).
    - `aplicarToggle(set: Set<string>, chave: string): Set<string>` (idempotente:
      adiciona se ausente, remove se presente).
    - _Requirements: 1.2, 5.1_
  - [ ]* 1.2 Testes puros (vitest, `--pool=threads`):
    - **P1 idempotência** do toggle (toggle 2× volta ao original).
    - **P2 isolamento** por chave composta centro/OP.
    - _Validates: 3.1, 5.1_

- [x] 2. [FRONT] Estado + condição de agrupamento
  - [x] 2.1 Adicionar estado `planosDesagrupados: Set<string>` + `toggleDesagrupado`
        (análogo a `planosRecolhidos`), usando os helpers de 1.1.
    - _Requirements: 1.2, 5.1_
  - [x] 2.2 Em `agruparFilaPorOp`, tratar a OP como SEM pai quando
        `planosDesagrupados.has(centroId:opId)` → etapas sem `ehFilhoPlano`
        (arrastáveis individualmente). Garantir que `idsSortable` passe a usar os
        ids das etapas (sem `pai:<opId>`) para a OP desagrupada.
    - _Requirements: 1.2, 1.3, 2.1, 4.1_
  - [ ]* 2.3 Teste da função pura `agruparFilaPorOp` parametrizada por
        `planosRecolhidos`/`planosDesagrupados`:
    - **P3 não-regressão**: Sets vazios ⇒ saída idêntica à atual (pais+filhos).
    - desagrupado ⇒ OP alvo sai sem linha-PAI e com etapas sem `ehFilhoPlano`.
    - _Validates: 4.1, 1.2_

- [x] 3. [FRONT] Ações no menu de contexto (botão direito)
  - [x] 3.1 No menu de contexto de etapa existente (`contextMenu`), adicionar:
    - quando `contextMenu.etapa.plano?.nome` e a OP está AGRUPADA → item
      "Desagrupar planos" → `toggleDesagrupado(centroId, opId)`.
    - quando a OP está DESAGRUPADA → item "Reagrupar planos" → mesmo toggle.
    - `centroId = contextMenu.centro.centro.id`, `opId = contextMenu.etapa.opId`.
      Fechar o menu ao acionar.
    - _Requirements: 1.1, 3.1_

- [x] 4. [FRONT] Arraste individual + persistência (reuso)
  - [x] 4.1 Verificar que, com a OP desagrupada, o arraste de cada etapa cai no
        fluxo normal (não no ramo `pai:<opId>`) e persiste via `PATCH
        /pcp/etapas/reordenar` (sem alterar `handleDragEnd`). Ajustar só se o
        ramo de linha-PAI interceptar indevidamente.
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 5. [FRONT] Checkpoint — verificação
  - `get_diagnostics` limpo nos arquivos tocados (page.tsx + desagrupar-planos.ts).
    `npm run build` (Next) ✓ Compiled successfully in 9.3min, 360/360 páginas
    geradas (não-regressão). Os testes puros (`*` 1.2/2.3) ficaram opcionais.
    Fluxo: botão direito numa OP caixa/tampa → "Desagrupar planos" → etapas viram
    linhas arrastáveis independentes → "Reagrupar planos" volta ao bloco.

## Notes

- Somente frontend; reusa a reordenação existente. Com nenhuma OP desagrupada, o
  comportamento é idêntico ao atual (não-regressão).
- Desagrupamento é por OP (não um modo global do centro), via menu de contexto —
  pedido explícito do usuário.
- Estado client-side; não persiste entre reloads (a ordem da fila sim).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "3.1", "4.1"] }
  ]
}
```
