# Design Document — pcp-visualizacao-planos-gantt

## Overview

Feature de melhoria visual do módulo PCP que atende 3 dos 4 pontos da reunião
com a Carton Wega (15/10/2026): (1) garantir "VERSO" (nunca "costa") em todas
as telas, (2) visualização consolidada dos planos/componentes de uma OP e (3)
rótulo de face/plano/sequência nas barras do Gantt, com as barras da mesma OP
visualmente associadas. O item 4 (travar/mover blocos no Gantt) é a Spec B,
fora do escopo aqui.

O trabalho é majoritariamente **frontend** (VisioFab.Wms.Front — Next.js 15 +
Mantine 7). Há **uma exceção de backend** descoberta na investigação: o detalhe
da OP hoje só expõe `VariacaoOrdemProducao` (model legado), e NÃO há endpoint
que devolva os `PlanoOrdemProducao` (os planos reais gravados pelo agente
Calcgraf e pelo importador de PDF — TAMPA/CAIXA/FACE FRENTE/VERSO). Para o item
2, precisamos de **uma rota de LEITURA nova** no backend (`GET
/ordens-producao/:id/planos`). É leitura pura, **sem mudança de schema** (o
model `PlanoOrdemProducao` já existe).

### Achados da investigação (código real)

- `src/app/(interna)/pcp/gantt/page.tsx` e
  `src/app/(interna)/pcp/timeline/gantt/page.tsx`: ambas consomem `GET
  /pcp/timeline`, desenham **1 barra por etapa** usando `bar.descricao` /
  `bar.produtoNome`, agrupam por `tipoProcesso` + `centroProducao` e já aplicam
  cor estável por OP (`getOpColor` / `OP_COLORS`). Hoje **não** exibem
  face/plano/sequência no texto da barra. As duas telas recebem o mesmo
  tratamento (Req 3.7).
- `src/app/(interna)/pcp/ordens-producao/[id]/page.tsx`: abas atuais Etapas,
  Materiais, **Variações** (consome `/ordens-producao/:id/variacoes` →
  `VariacaoOrdemProducao`), Entregas, Histórico. A nova visualização de
  **Planos** entra como aba/seção adicional, **sem remover** as existentes.
- `src/app/(interna)/orcamento-grafico/[id]/PlanosDoItem.tsx`: já é uma tabela
  de planos (TAMPA/CAIXA/BOLSA / FRENTE+COSTA) — serve de **referência visual**
  (padrão de tabela Mantine com `Seq. / Nome / ... / Cores` em badge). Esse
  arquivo ainda tem o literal "COSTA" num placeholder/exemplo — será
  normalizado conceitualmente, mas o foco do Req 1 é o nome exibido do plano.
- **Não existe** helper `rotuloPlano` no frontend. A normalização
  "COSTA"→"VERSO" só foi feita no backend (relatório `op-pdf-gerado.service`).
  Logo, o Req 1 exige **criar** esse helper no front e aplicá-lo nas telas.

## Architecture

### D1 — Helper de rótulo compartilhado no frontend (Req 1)

Criar `src/lib/plano-rotulo.ts` exportando `rotuloPlano(nome)` (e um auxiliar
`rotuloComFace` para o Gantt). Regra única e testável: substituir o termo
"COSTA" (isolado, case-insensitive, qualquer acentuação de caixa) por "VERSO",
preservando o restante do texto. Centralizar num único módulo evita regra
duplicada/divergente e dá um ponto único de teste (vitest).

Justificativa: a regra do backend já existe mas não é acessível ao front; um
helper no front é a forma mais barata e segura de garantir o Req 1 em todas as
superfícies, sem depender de o backend reprocessar nomes já gravados (OPs
antigas podem ter "COSTA" persistido no nome do plano/etapa).

### D2 — Rota de leitura de planos no backend (Req 2)

Adicionar `GET /ordens-producao/:id/planos` em
`variacoes-entrega.routes.ts` (mesmo arquivo/registro já montado sob o prefixo
`/api/ordens-producao`, com `authenticate` + `moduloGuard('PCP')`). Retorna os
`PlanoOrdemProducao` da OP, isolados por `empresaId` **via a OP** (o `findFirst`
da OP já filtra `empresaId`; os planos são buscados por `ordemProducaoId` da OP
validada). `select` explícito dos campos exibidos (sem campos pesados). Ordena
por `sequencia asc`.

Justificativa: a aba "Variações" atual não cobre `PlanoOrdemProducao`; sem essa
rota o front não teria de onde ler os planos reais. É leitura pura, segue o
padrão de isolamento do steering (filtra pela OP com `empresaId`), sem schema.

### D3 — Componente reutilizável de visualização de planos (Req 2)

Criar `src/components/pcp/PlanosOverview.tsx`: recebe a lista de planos e
renderiza uma tabela/cards por plano, reaproveitando o padrão visual de
`PlanosDoItem.tsx`. Usado numa **nova aba "Planos"** do detalhe da OP (ao lado
de "Variações"). Mantém "Variações" intacta (não-regressão, Req 4.3).

### D4 — Derivação do rótulo de barra no Gantt (Req 3)

Em ambas as telas de Gantt, derivar `rotuloBarra` a partir de `descricao` +
`sequencia` da etapa (a `descricao` já traz "— FRENTE"/"— VERSO"/"— <PLANO>"
quando a OP é multi-plano/retiração, conforme o parser/ingestão). Aplicar
`rotuloComFace`/`rotuloPlano` para nunca exibir "COSTA". Barras da mesma OP já
compartilham cor; adicionar o rótulo da face/plano no texto e no tooltip, e uma
marca visual (ex.: contador "2ª passada") quando houver 2+ barras da mesma OP
no mesmo centro. **Não** mesclar barras (Req 3.5).

## Components and Interfaces

### Novos

| Arquivo | Papel |
|---|---|
| `VisioFab.Wms.Front/src/lib/plano-rotulo.ts` | `rotuloPlano(nome)` + `rotuloComFace(texto)` (Req 1). |
| `VisioFab.Wms.Front/src/lib/plano-rotulo.test.ts` | Testes vitest do helper. |
| `VisioFab.Wms.Front/src/components/pcp/PlanosOverview.tsx` | Visualização consolidada de planos (Req 2). |
| `VisioFab.Wms.Back/.../ordem-producao/variacoes-entrega.routes.ts` (ALTERA) | nova rota `GET /:id/planos` (Req 2 / D2). |

### Alterados (frontend)

| Arquivo | Mudança |
|---|---|
| `.../pcp/ordens-producao/[id]/page.tsx` | nova aba "Planos" consumindo `GET /ordens-producao/:id/planos` + `PlanosOverview`; aplicar `rotuloPlano` onde exibe nome de plano/variação. |
| `.../pcp/gantt/page.tsx` | derivar e exibir `rotuloBarra` (face/plano/seq); tooltip completo; marca de 2ª passada; `rotuloPlano`. |
| `.../pcp/timeline/gantt/page.tsx` | idem (Req 3.7). |
| `.../pcp/programacao/page.tsx` | aplicar `rotuloPlano` nos rótulos de plano exibidos (garantia Req 1). |
| `.../orcamento-grafico/[id]/PlanosDoItem.tsx` | aplicar `rotuloPlano` no nome exibido; trocar o placeholder "FRENTE" (remover exemplo "COSTA"). |

## Helper `rotuloPlano`

```ts
// src/lib/plano-rotulo.ts
/** Troca o termo legado "COSTA" por "VERSO" (case-insensitive), preservando
 *  o restante do texto. Idempotente. */
export function rotuloPlano(nome: string | null | undefined): string {
  if (!nome) return ''
  // \bCOSTA\b em qualquer caixa → "VERSO" (mantém o resto).
  return nome.replace(/\bcosta\b/gi, 'VERSO')
}

/** Para rótulos de barra/etapa que embutem a face no texto (ex.: "Impressão
 *  — COSTA"). Mesma regra; nome separado para clareza de intenção. */
export function rotuloComFace(texto: string | null | undefined): string {
  return rotuloPlano(texto)
}
```

Regra (Req 1.1/1.2): só o termo isolado "COSTA" vira "VERSO"; não afeta
substrings de outras palavras (uso de `\b`). Idempotente (aplicar 2× não muda).

## Rota backend `GET /ordens-producao/:id/planos`

```ts
app.get('/:id/planos', async (request, reply) => {
  const user = request.user as { id: string; empresaId: string }
  const { id } = idParamsSchema.parse(request.params)
  const op = await prisma.ordemProducao.findFirst({ where: { id, empresaId: user.empresaId }, select: { id: true } })
  if (!op) return reply.status(404).send({ message: 'OP não encontrada' })
  const planos = await prisma.planoOrdemProducao.findMany({
    where: { ordemProducaoId: id },
    orderBy: { sequencia: 'asc' },
    select: {
      id: true, nome: true, tipo: true, formato: true, cores: true,
      tiragem: true, montagem: true, material: true, gramatura: true,
      faceDeId: true, sequencia: true,
    },
  })
  return { ordemProducaoId: id, planos, total: planos.length }
})
```

Isolamento: a OP é validada por `empresaId`; os planos pertencem à OP. Sem
schema. Se o model/campos divergirem no schema real, ajustar o `select` (os
nomes acima vêm do steering pcp-modulo seção 10.1).

## Data Models

Nenhum model novo e nenhuma migração. A feature reusa models existentes:

- `PlanoOrdemProducao` (já no schema — steering pcp-modulo §10.1): `id`, `nome`,
  `tipo` (`COMPONENTE` | `FACE`), `formato`, `cores`, `tiragem`, `montagem`,
  `material`, `gramatura`, `faceDeId` (auto-FK FRENTE←VERSO), `sequencia`.
  Exposto em leitura pela nova rota `GET /ordens-producao/:id/planos`.
- `EtapaOrdemProducao` (via `GET /pcp/timeline`): usa `descricao` e `sequencia`
  para derivar o rótulo da barra. Nenhum campo novo.
- `VariacaoOrdemProducao`: inalterado (aba "Variações" preservada).

Tipo de front (contrato da rota nova):

```ts
interface PlanoOP {
  id: string
  nome: string
  tipo: 'COMPONENTE' | 'FACE'
  formato: string | null
  cores: string | null
  tiragem: number | null
  montagem: string | null
  material: string | null
  gramatura: number | null
  faceDeId: string | null   // VERSO aponta para a FRENTE
  sequencia: number | null
}
```

## PlanosOverview (layout)

Props: `{ planos: PlanoOP[]; loading?: boolean }`. Para cada plano
(ordenado por `sequencia`):
- **Nome** via `rotuloPlano` + **badge de tipo**: `COMPONENTE` (cyan) vs `FACE`
  (violet) — mesmo esquema do painel de Programação.
- **Formato**, **tiragem**, **material/gramatura** — "—" quando ausente (Req 2.3).
- **Cores**: quando o plano é FACE com `faceDeId`/retiração, exibir
  "frente × verso" (ex.: "7x0 × 5x0"); senão o valor de `cores`.
- **Relação FRENTE/VERSO**: o VERSO (tem `faceDeId`) é indicado visualmente e
  referenciado à FRENTE correspondente (badge "VERSO de <nome da frente>").
- **Estado vazio** (Req 2.8): "Esta OP não possui planos consolidados."
- **Dados incompletos** (Req 4.5): badge/ícone de alerta na linha, sem bloquear.

## Gantt — rótulo de barra

- `rotuloBarra(bar)`: parte de `bar.descricao` (já pode conter "— <FACE/PLANO>")
  e, quando a OP tem 2+ barras no mesmo centro, acrescenta a `sequencia`/ordem
  (ex.: "OP 3176 · VERSO" ou "OP 3176 · 2ª passada"). Sempre via `rotuloPlano`.
- Texto curto dentro da barra (quando couber); rótulo completo no **tooltip**
  (Req 3.6).
- Marca visual (ex.: faixa/ícone) na barra repetida da mesma OP+centro (Req 3.5),
  sem mesclar.
- Barras sem face/plano → render atual inalterado (Req 4.1).

## Error Handling

- `GET /:id/planos` falha ou vazio → aba "Planos" mostra estado vazio, sem
  quebrar o detalhe (Req 4.4). O front usa `.catch(() => ({ data: { planos: [] } }))`
  como já faz com variações/entregas.
- Campos ausentes do plano/etapa → "—" + alerta não-bloqueante (Req 2.3/4.5).

## Correctness Properties

Propriedades da função pura `rotuloPlano` (base dos testes vitest).

### Property 1: Idempotência
`rotuloPlano(rotuloPlano(x)) === rotuloPlano(x)` para qualquer `x` ("VERSO" não
contém o token "COSTA", então reaplicar não muda).
**Validates: Requirements 1.1, 1.2**

### Property 2: Preservação do restante
O texto fora do token "COSTA" permanece inalterado (só o token isolado é
trocado por "VERSO").
**Validates: Requirements 1.2**

### Property 3: Não vaza em substring
Palavras que apenas contêm "costa" como substring (não como token isolado,
delimitado por `\b`) não são alteradas.
**Validates: Requirements 1.1, 1.2**

### Property 4: Ausência de "COSTA" na saída
Para qualquer entrada, a saída não contém o token isolado "COSTA" em nenhuma
combinação de caixa.
**Validates: Requirements 1.1, 1.4, 1.5**

### Property 5: Nulo/vazio
`null` / `undefined` / `""` resultam em `""`.
**Validates: Requirements 1.3**

## Testing Strategy

- **Unit (vitest, já configurado no front)**: `plano-rotulo.test.ts` — "COSTA"→
  "VERSO" (várias caixas), preserva resto, não afeta substrings, idempotência,
  null/empty → "".
- **Build/lint**: `npm run build` (next build) + `npm run lint` do
  VisioFab.Wms.Front devem passar.
- **Backend**: a rota nova é leitura simples; validar com `get_diagnostics` +
  build do back (`npm run build`). Teste de rota não é obrigatório (sem lógica
  além do `findMany` filtrado), mas o isolamento por `empresaId` segue o padrão
  já testado das demais rotas de `variacoes-entrega`.
- **Validação manual**: abrir uma OP multi-plano (ex.: 3133/3143) e uma de
  retiração; conferir a aba Planos e o Gantt (FRENTE/VERSO rotulados, nenhum
  "costa").

## Rastreabilidade (decisão → requisito)

- D1 (helper rotuloPlano) → Req 1.1–1.5.
- D2 (rota /planos) + D3 (PlanosOverview) → Req 2.1–2.8.
- D4 (rótulo de barra) → Req 3.1–3.7.
- Não-regressão (abas preservadas, barra sem face inalterada, telas não quebram)
  → Req 4.1–4.5.
