# Plano de Implementação

Legenda: `[BACK]` = VisioFab.Wms.Back; `[FRONT]` = VisioFab.Wms.Front.

- [x] 1. [BACK] Endpoint `POST /orcamento-grafico/cabecalho`
  - Criar handler ao lado do `POST /` em `orcamento-grafico.routes.ts`: cria
    `OrcamentoGrafico` RASCUNHO só com `clienteId?/clienteNome?/vendedorId?/
    linhaProdutoId?`, numeração sequencial por empresa, empresaId explícito,
    permissão `podeCriarOrcamento`; 400 se sem cliente; retorna `{ id, numero }`.
  - get_diagnostics limpo.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. [FRONT] Modal "Novo Orçamento" enxuto
  - Criar `NovoOrcamentoModal.tsx` (Cliente + Vendedor + Linha de Produto).
    Botão "Criar e abrir editor" → `POST /cabecalho` → `onCriado(id)`.
  - Em `page.tsx`, trocar o `router.push('/orcamento-grafico/novo')` do botão
    "+ Novo Orçamento" para abrir este modal; no `onCriado` navegar para
    `/orcamento-grafico/:id?novoItem=1`.
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 3. [FRONT] Abertura automática do Editor no detalhe
  - Em `[id]/page.tsx`, se `searchParams.novoItem === '1'`, abrir o editor de
    página única (item novo) uma única vez e limpar o query param.
  - _Requirements: 1.3, 5.3_

- [x] 4. [FRONT] Linha de Produto fixa no topo do Editor (novo + editar)
  - Em `EditorItem.tsx`, adicionar prop `linhaProdutoId` + `onLinhaProdutoChange`
    e renderizar um `Select` de Linha de Produto (ativas) acima das seções.
    onChange persiste via `PUT /:id` (feito pela página) + recarrega.
  - Em `[id]/page.tsx`, passar `linhaProdutoId` e o handler de troca (PUT +
    `carregar()`).
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. [FRONT] Informação do produto destacada na seção Produto
  - Em `SecaoProduto.tsx`, bloco de resumo (miniatura + descrição do tipo +
    nome/foto do produto se houver) acima do `StepTipo`; estado vazio quando
    nada selecionado.
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Verificação e não-regressão
  - get_diagnostics limpo nos arquivos tocados (back e front).
  - Conferir imports dos componentes novos (build do Next não pega ReferenceError).
  - Edição de item e Puxar Cálculo continuam idênticos; wizard `/novo` acessível
    por URL. Nenhuma string "Calcgraf" visível.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "4", "5"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["6"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": [],
    "4": [],
    "5": [],
    "6": ["2", "3", "4", "5"]
  }
}
```
