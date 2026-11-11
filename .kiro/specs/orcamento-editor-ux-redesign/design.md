# Design — Redesign UX/UI do Editor de Orçamento

## Visão geral

Tudo FRONT (`VisioFab.Wms.Front`). Sem schema, sem motor. O recálculo ao vivo
reusa as rotas de cálculo JÁ existentes (`POST /orcamento-grafico/calcular` para
item novo; `POST /:id/itens/:itemId/calcular` para item ancorado de repetição),
exatamente como o `StepRevisao` faz hoje — só muda QUANDO chamamos (debounce a
cada alteração) e ONDE mostramos (sticky bar).

## Componentes / arquivos

### 1. Helper puro de tradução de erros — `editor/erros-amigaveis.ts` (NOVO)

`traduzirErros(resp): { geral: string | null; porCampo: Record<campo, string> }`
- Recebe o `err.response.data` (pode ter `issues: [{campo, mensagem}]` OU array
  Zod cru `issues: [{path, message}]` OU só `message`).
- Mapa `ROTULO_ERRO` por campo conhecido → frase PT:
  - `tipoEmbalagemId` → "Selecione o tipo de embalagem."
  - `gramatura` → "Informe a gramatura do papel."
  - `precoKg` → "Informe o preço por kg do papel."
  - `medidas` → "Preencha as medidas da embalagem."
  - `quantidade` → "Informe a quantidade (tiragem)."
  - `cores` → "Adicione ao menos uma cor."
  - ... (demais conforme surgir; fallback genérico).
- Se o motivo vier em inglês do Zod ("Expected string, received null",
  "Number must be greater than 0", "Required"), ignora o texto cru e usa o
  rótulo do campo; se o campo é desconhecido, usa "Revise este campo.".
- Property: nunca retorna string que contenha "Expected ", "received ",
  "Number must be", "Required" (anti-vazamento de Zod cru).

Testes: `erros-amigaveis.test.ts` (vitest + fast-check): P1 (nunca vaza termos
Zod), P2 (campo conhecido → frase mapeada), P3 (determinístico).

### 2. Hook de recálculo ao vivo — `editor/useCalculoAoVivo.ts` (NOVO)

`useCalculoAoVivo(formData, { orcamentoId, itemId })` →
`{ kpis, loading, errosPorCampo, erroGeral }`
- Debounce ~600 ms sobre um "resumo de dependências" do formData (os campos que
  entram no payload de cálculo). Usa `useDebouncedValue` do Mantine.
- Monta o MESMO payload do `StepRevisao.calcular` (extrair para
  `montarPayloadCalculo(formData)` em `itemFormShared` para não duplicar).
- Escolhe a rota: item de repetição (tem `itemId` + origem) → rota do item
  (ancorada); senão → `/calcular`.
- Cancela requisições obsoletas (guarda um "requestId"/AbortController; mantém o
  último resultado em caso de erro — Req 3.4).
- Deriva `kpis = { custoTotal, precoVenda, margem, precoUnitario }` do resultado.
- Em erro, chama `traduzirErros` → `errosPorCampo` + `erroGeral`.

### 3. Sticky Summary Bar — `editor/ResumoKpis.tsx` (NOVO)

Barra fixa no topo do editor (dentro do modal full-screen), 4 cards:
Custo Total / Preço de Venda / Margem / Preço Unitário. `position: sticky; top:0`.
Spinner discreto quando `loading`. Cores: Preço/Margem em verde (como o mockup),
Custo neutro. Mantém o último valor quando recalcula/erra.

### 4. Índice como Stepper com status — `IndiceAncoras.tsx` (ALTERAR)

- Nova prop `statusPorAncora: Record<AncoraId, 'ok' | 'pendente' | 'erro'>`.
- Render com marcador por status (✓ verde / ○ cinza / ⚠ vermelho) ao lado do
  label. Mantém scroll-spy (ativa) e a legenda.
- O `EditorItem` deriva o status: "erro" se `errosPorCampo` tem campo daquela
  seção; "ok" se os campos essenciais da seção estão preenchidos; senão
  "pendente". Mapa seção→campos essenciais vive no `EditorItem`.

### 5. Preview lateral retrátil — `editor/PainelPreview.tsx` (NOVO)

- Drawer/coluna retrátil (botão "Preview"/chevron) à direita do editor com o
  SVG de encaixe (reaproveita `EncaixeVisual`/`encaixeParaSvgString`) + imagem
  da faca/produto (`ImagensProdutoFaca`). Recolhível sem perder estado.
- Desktop: coluna lateral (Grid). Telas menores: Drawer.

### 6. Hierarquia visual (ALTERAR várias `Secao*` + EditorItem)

- Trocar `Paper withBorder` escuros por tokens adaptativos; inputs com estados
  (o Mantine já faz foco/disabled; garantir `error=` nos inputs com erro vindo
  de `errosPorCampo`). Badges de origem elegantes (reusar BadgeOrigemCampo).

### 7. Acabamentos agrupados — `editor/SecaoAcabamentos.tsx` (ALTERAR)

- Mostrar selecionados no topo; `TextInput` de busca + (se houver categoria)
  `SegmentedControl`/chips de categoria para filtrar a lista. Cálculo inalterado.

## Integração do recálculo ao vivo no EditorItem

- `EditorItem` chama `useCalculoAoVivo(formData, { orcamentoId, itemId })`.
- Passa `kpis/loading` → `ResumoKpis`; `errosPorCampo/erroGeral` → seções
  (inline) + `statusPorAncora` → `IndiceAncoras`.
- O `salvar()` continua como está (explícito; backend recalcula/ancora).

## Correctness Properties

- P1: `traduzirErros` nunca retorna termos Zod crus.
- P2: campo conhecido mapeia para a frase PT definida.
- P3: recálculo ao vivo é cancelável e mantém o último KPI válido em erro.
- P4: sem alterar campos, nenhum recálculo é disparado (debounce estável).

## Não-regressão

- Motor/rotas de cálculo inalterados; só muda a cadência e a apresentação.
- `salvarItem`, Puxar Cálculo, ancoragem de repetição intactos.
- Nenhuma string "Calcgraf" visível.
