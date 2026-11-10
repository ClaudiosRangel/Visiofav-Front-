# Design — Desagrupar Planos na Fila da Programação (PCP)

## Visão geral

Feature **100% frontend** (`VisioFab.Wms.Front`), na tela
`src/app/(interna)/pcp/programacao/page.tsx`. Não toca backend, schema nem
contrato de API — a reordenação já existe (`PATCH /pcp/etapas/reordenar`) e a
fila aceita qualquer `posicaoFila`.

O agrupamento pai/filho de OPs com 2+ planos é construído inteiramente no
cliente pela função `agruparFilaPorOp(itens, centroId)`, que insere uma linha-PAI
sintética (`isPaiPlano`, `dndId: pai:<opId>`) e marca as etapas como
`ehFilhoPlano: true` (não arrastáveis individualmente). O estado
`planosRecolhidos: Set<string>` (chave `centroId:opId`) já controla recolher/
expandir. Vamos introduzir um estado análogo `planosDesagrupados: Set<string>`
que, quando contém `centroId:opId`, faz `agruparFilaPorOp` **pular o
agrupamento** daquela OP — renderizando suas etapas como linhas normais,
arrastáveis.

## Componentes e mudanças

### 1. Estado novo `planosDesagrupados`

Análogo a `planosRecolhidos`:

```ts
const [planosDesagrupados, setPlanosDesagrupados] = useState<Set<string>>(new Set())
function toggleDesagrupado(centroId: string, opId: string) {
  const chave = `${centroId}:${opId}`
  setPlanosDesagrupados((prev) => {
    const novo = new Set(prev)
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave)
    return novo
  })
}
```

### 2. `agruparFilaPorOp` respeita o desagrupamento (Req 1.2, 4.1)

Hoje a função decide `temPai` por `planosPorOp.get(opId)?.size >= 1`. Passa a
receber (via closure) o `planosDesagrupados` e tratar a OP como **sem pai**
quando `centroId:opId` está desagrupado:

```ts
const desagrupada = !!(centroId && planosDesagrupados.has(`${centroId}:${it.opId}`))
const temPai = !desagrupada && it.tipoFila !== 'rc' && it.plano?.nome && it.opId
  && (planosPorOp.get(it.opId)?.size || 0) >= 1
```

Quando `desagrupada`, as etapas NÃO recebem `ehFilhoPlano: true` → caem no ramo
`else` do `SortableRow` (grip próprio, arrastáveis individualmente — Req 2.1).
O `idsSortable` (que alimenta o `SortableContext`) já deriva de
`agruparFilaPorOp(...).map(i => i.dndId || i.id)`, então ao desagrupar os ids
passam a ser os das etapas individuais automaticamente (sem `pai:<opId>`).

### 3. Ações no menu de contexto (botão direito) (Req 1.1, 3.1)

O menu de contexto de etapa já existe (`contextMenu` state + `Box` renderizado
no fim do componente). Adicionar itens condicionais:

- Se a etapa tem plano (`contextMenu.etapa.plano?.nome`) e a OP está AGRUPADA →
  item **"Desagrupar planos"** → `toggleDesagrupado(centroId, opId)`.
- Se a OP está DESAGRUPADA → item **"Reagrupar planos"** → mesmo toggle (inverte).

O `centroId` sai de `contextMenu.centro.centro.id` e o `opId` de
`contextMenu.etapa.opId`. Só aparece para etapas com plano (não polui o menu de
etapas sem plano).

### 4. Arraste e persistência (Req 2.2, 2.3, 2.4)

Nenhuma mudança no `handleDragEnd`/`handleDragEndCortadeira`: quando a OP está
desagrupada, o `active.id` é o id da etapa (não `pai:<opId>`), então o ramo de
"arrasto de linha-PAI" é naturalmente ignorado e cai no arraste normal de etapa,
que já persiste via `PATCH /pcp/etapas/reordenar` com `posicaoFila` sequencial.
Intercalar etapas de OPs diferentes já é suportado (a fila é uma lista única).

### 5. Indicação visual (Req 3.2)

As etapas desagrupadas continuam exibindo o rótulo do plano (CAIXA/TAMPA) que já
é renderizado na linha via `rotuloPlano`/`plano.nome` — o usuário distingue que
são planos. Opcional: um leve realce/badge "desagrupado" na linha; não é
essencial para o MVP (o rótulo do plano já basta).

## Correctness Properties

1. **Idempotência do toggle**: desagrupar e reagrupar a mesma OP retorna ao
   estado inicial (Set volta a não conter a chave). (teste puro do reducer do
   Set — função `toggleDesagrupado` extraída como helper puro)
2. **Isolamento por OP/centro**: desagrupar `centroId:opId` não afeta outras OPs
   nem a mesma OP em outro centro (chave composta). (teste puro)
3. **Não-regressão do agrupamento**: com `planosDesagrupados` vazio,
   `agruparFilaPorOp` produz exatamente a saída atual (pais + filhos). (teste
   com fixture da função pura `agruparFilaPorOp` extraída/parametrizada)

Para viabilizar os testes 1–3 sem React, extrair funções puras:
- `chaveDesagrupar(centroId, opId) → string`
- `aplicarToggle(set, chave) → novo Set`
- `agruparFilaPorOp` já é quase pura (depende só de `planosRecolhidos`/
  `planosDesagrupados`) — parametrizar esses dois Sets como argumento para
  testá-la isolada (hoje usa closure; passar como parâmetro opcional com default
  mantém a não-regressão).

## Decisões

- **D1 — Desagrupar por OP via menu de contexto, não um "modo do centro"**: o
  usuário pediu explicitamente o botão direito → desagrupar aquela OP, depois
  arrastar livre. Mais granular e menos intrusivo que um toggle global do centro;
  preserva o agrupamento para as demais OPs (que a Wega quer manter juntas).
- **D2 — Client-side, sem persistência entre reloads**: o desagrupamento é
  preferência de interação; a ordem resultante da fila é persistida normalmente
  pela reordenação. Persistir o Estado_Desagrupado exigiria schema/endpoint —
  fora de escopo (Req 5.2). Ao recarregar, volta ao agrupado, mas a ordem da fila
  (posicaoFila) permanece como foi salva.
- **D3 — Reusar `agruparFilaPorOp`/`planosRecolhidos`**: menor risco; o mecanismo
  de árvore já existe e é testado em produção. Só acrescentamos um segundo Set de
  controle e uma condição.
