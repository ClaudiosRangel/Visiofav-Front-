# Design — Novo Orçamento via Editor de Página Única

## Visão geral

Dois repositórios. Mudança principal é de FRONT; o BACK ganha 1 endpoint novo
(criar cabeçalho). Caminho A + A1.

## Backend (`VisioFab.Wms.Back`)

### Endpoint novo: `POST /api/orcamento-grafico/cabecalho`

Arquivo: `src/modules/orcamento-grafico/orcamento-grafico.routes.ts` (ao lado do
`POST /`). Reusa a lógica de numeração sequencial por empresa já existente no
`POST /` (extrair/replicar o cálculo de `numero` = max+1 por empresa).

```ts
app.post('/cabecalho', async (request, reply) => {
  const user = request.user as { id: string; empresaId: string; perfil?: string }
  if (!(await verificarPermissaoComercial(user.empresaId, user.id, user.perfil, 'podeCriarOrcamento')))
    return reply.status(403).send({ message: 'Sem permissão para criar orçamentos no Comercial.' })

  const body = z.object({
    clienteId: z.string().uuid().optional().nullable(),
    clienteNome: z.string().max(200).optional().nullable(),
    vendedorId: z.string().uuid().optional().nullable(),
    linhaProdutoId: z.string().uuid().optional().nullable(),
  }).parse(request.body)

  if (!body.clienteId && !body.clienteNome?.trim())
    return reply.status(400).send({ message: 'Informe o cliente (cadastrado ou nome livre).' })

  // numero = max+1 por empresa (mesma regra do POST /)
  // cria OrcamentoGrafico RASCUNHO, etapaCalculo default, SEM item.
  // empresaId EXPLÍCITO. Retorna { id, numero }.
})
```

Não toca schema (todos os campos já existem: `linhaProdutoId` foi adicionado na
spec de paridade). Não precisa migrate-prod.

## Frontend (`VisioFab.Wms.Front`)

### 1. Modal "Novo Orçamento" enxuto

Novo componente `src/app/(interna)/orcamento-grafico/NovoOrcamentoModal.tsx`:
- Campos: Cliente (reusar o Autocomplete/busca de cliente já usado no wizard/
  `EditarCabecalhoModal`), Vendedor (Select), Linha de Produto (Select, ativas).
- Botão "Criar e abrir editor": chama `POST /cabecalho`, no sucesso chama
  `onCriado(id)`.
- A lista (`page.tsx`): o botão "+ Novo Orçamento" abre este modal (substitui o
  `router.push('/orcamento-grafico/novo')`). No `onCriado` → `router.push(
  '/orcamento-grafico/' + id + '?novoItem=1')`.

### 2. Abertura automática do editor no detalhe

`[id]/page.tsx`: ao montar, se `searchParams` tem `novoItem=1`, abrir o
`editorPaginaOpen` com `itemEditorPagina=null` (item novo) uma única vez (limpar
o query param depois para não reabrir em refresh).

### 3. Linha de Produto no topo do Editor

`EditorItem.tsx`:
- Nova prop `linhaProdutoId?: string | null` + `onLinhaProdutoChange?(id)`.
- Renderizar, acima do Grid de seções, um `Paper` com `Select` de Linha de
  Produto (carregar ativas de `/linhas-produto?situacao=ativa`). Valor =
  `linhaProdutoId`. onChange: `PUT /:id` com `{ linhaProdutoId }` + callback para
  a página recarregar o `linhaProdutoCodigo` (que controla `mostrarCampo`).
- A página `[id]/page.tsx` passa `linhaProdutoId={orcamento.linhaProdutoId}` e um
  `onLinhaProdutoChange` que faz o PUT e `carregar()`.

### 4. Informação do produto destacada

`SecaoProduto.tsx`: antes do `StepTipo`, um bloco de resumo (Paper) com a
miniatura + descrição do tipo selecionado (e nome/foto do produto se houver).
Usa `formData.tipoEmbalagem`, `formData._imagemProdutoUrl`.

## Correctness Properties

- P1: `POST /cabecalho` sempre cria com `empresaId` do usuário e status RASCUNHO.
- P2: numeração do cabeçalho é sequencial por empresa (não colide).
- P3: trocar Linha de Produto não apaga valores comuns do formData (R3.2).
- P4: sem `novoItem=1`, o detalhe não abre o editor automaticamente (não-regressão).

## Não-regressão

- `POST /` e `/de-calculo` intactos. Wizard `/novo` intacto (só deixa de ser o
  destino do botão). Edição de item idêntica.
