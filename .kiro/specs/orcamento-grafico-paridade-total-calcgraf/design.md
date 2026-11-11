# Design Document

## Overview

Esta feature completa a paridade da tela de Orçamento Gráfico do Vizor com o
sistema gráfico legado, de forma aditiva e sem regressão. Entregamos seis blocos
funcionais, divididos em MVP e Fase 2:

**MVP (R1–R7, R10–R13):**
1. Cadastro de **Linha de Produto** (independente de `TipoEmbalagem`) + seletor
   inicial do orçamento com campos condicionais por linha.
2. **Observação por cliente** com alerta destacado no topo do orçamento e na
   proposta/impressão.
3. **Materiais de acabamento** com opção de computar no custo (flag + valor).
4. **Cobertura de Tinta** e **Processo de Impressão** como cadastros editáveis
   com seletor.
5. **Importadores** da base restaurada para linhas, observações, materiais,
   coberturas e processos (idempotentes, de-para por CNPJ/código).

**Fase 2 (R8, R9):**
6. **Microondulado com lista** de materiais e **busca de Sigla de Acabado** —
   esboçados aqui, detalhados quando priorizados.

A feature toca os dois repositórios separados (`VisioFab.Wms.Back` e
`VisioFab.Wms.Front`). Toda mudança de schema vem acompanhada do SQL idempotente
em `prisma/migrate-prod.ts` no mesmo commit, e toda query filtra `empresaId`
explicitamente. A palavra "Calcgraf" não aparece em texto visível da tela.

## Architecture

```
┌─────────────────────────── VisioFab.Wms.Back ───────────────────────────┐
│ prisma/schema.prisma  (models novos + campos aditivos)                   │
│   + migrate-prod.ts   (CREATE TABLE/ADD COLUMN IF NOT EXISTS)            │
│                                                                          │
│ src/modules/orcamento-grafico/                                           │
│   cadastros/                                                             │
│     linha-produto.routes.ts        CRUD LinhaProduto                     │
│     cobertura-tinta.routes.ts      CRUD CoberturaTinta                   │
│     processo-impressao.routes.ts   CRUD ProcessoImpressao               │
│     material-acabamento.routes.ts  CRUD MaterialAcabamento              │
│   orcamento-grafico.routes.ts      + linhaProdutoId / cobertura /        │
│                                      processo no POST/PUT; observacao do  │
│                                      cliente no GET; proposta PDF         │
│   calculo-grafico/                                                       │
│     materiais-computados.service.ts  (motor: soma MD dos materiais)     │
│   (Cliente ganha campo observacao — rota de cliente existente estende)   │
│                                                                          │
│ scripts/  (importadores, somente leitura do SQL Server → Neon)          │
│   exportar-paridade-calcgraf.mjs    (sqlcmd -u UTF-16→UTF-8)             │
│   gravar-linhas-produto.mjs                                             │
│   gravar-observacoes-cliente.mjs                                        │
│   gravar-materiais-acabamento.mjs                                       │
│   gravar-coberturas-processos.mjs                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS (api.vizorerp.com.br)
┌─────────────────────────── VisioFab.Wms.Front ──────────────────────────┐
│ src/app/(interna)/orcamento-grafico/                                     │
│   [id]/page.tsx            ← Alerta de Observação do Cliente (topo)       │
│   [id]/EditorItem.tsx      ← seletor Linha de Produto + campos condic.    │
│   [id]/editor/campos-por-linha.ts   ← MAPA FIXO linha → campos (R2.3)     │
│   [id]/editor/SecaoProduto.tsx      ← usa o mapa                          │
│   [id]/editor/SecaoDadosTecnicos.tsx← cobertura/processo = Select         │
│   [id]/editor/SecaoAcabamentos.tsx  ← materiais: checkbox computar + valor│
│   novo/StepTipo.tsx / page.tsx      ← Linha de Produto como 1ª etapa      │
│   cadastros/linhas-produto/page.tsx    (nova tela CRUD)                   │
│   cadastros/coberturas-tinta/page.tsx  (nova tela CRUD)                   │
│   cadastros/processos-impressao/page.tsx (nova tela CRUD)                 │
│   cadastros/materiais-acabamento/page.tsx (nova tela CRUD)                │
└──────────────────────────────────────────────────────────────────────────┘
```

Fluxo de dados da importação (uma vez, pré-produção):

```
SQL Server (CalcgrafCartonWega, somente leitura)
  └─ sqlcmd -u → cartoon/export/paridade-*.json (UTF-8)
       └─ gravar-*.mjs (pg, de-para por CNPJ/código, idempotente)
            └─ Neon (empresaId Carton Wega)
```

## Components and Interfaces

### Backend — Models novos (Data Models abaixo detalha o schema)

- `LinhaProduto` — cadastro independente (R1).
- `CoberturaTinta`, `ProcessoImpressao` — cadastros editáveis (R10, R11).
- `MaterialAcabamento` — catálogo com `valorUnitario` e flag (R6, R7).
- `Cliente.observacao` — campo Text aditivo (R4).
- `OrcamentoGrafico.linhaProdutoId`, `coberturaTintaId`, `processoImpressaoId`
  — FKs nullable aditivas (R2, R10, R11).
- Vínculo material↔item: `ItemOrcamentoGrafico.materiaisAcabamento` (Json) com
  `{ materialAcabamentoId, computarCusto, valorUnitario, quantidade }[]` (R6).

### Backend — Rotas (todas com `empresaId` explícito; perfil ADMIN p/ escrita de cadastros)

CRUD padrão por cadastro (prefixo `/api/orcamento-grafico`):

| Método | Rota | Descrição |
|---|---|---|
| GET | `/linhas-produto?situacao=` | Lista por empresa, filtro de situação (R1.6). |
| POST | `/linhas-produto` | Cria (exige nome+situação) (R1.3). |
| PUT | `/linhas-produto/:id` | Edita; `findFirst({id, empresaId})` → 404 cross-empresa (R1.4/1.5). |
| GET/POST/PUT | `/coberturas-tinta` | CRUD CoberturaTinta (R10). |
| GET/POST/PUT | `/processos-impressao` | CRUD ProcessoImpressao (R11). |
| GET/POST/PUT | `/materiais-acabamento` | CRUD MaterialAcabamento (R6, R7). |

Extensões em rotas existentes:
- `POST /orcamento-grafico` e `POST /de-calculo`: aceitam `linhaProdutoId?`.
- `PUT /orcamento-grafico/:id/itens/:itemId` e `POST .../itens` /
  `.../itens/:itemId/calcular`: aceitam `coberturaTintaId?`,
  `processoImpressaoId?`, `materiaisAcabamento?[]`. Mantêm os campos texto-livre
  (`coberturaTintaTexto`, `processoImpressao`) para não-regressão (R10.5/R11.5).
- `GET /orcamento-grafico/:id`: passa a resolver e retornar
  `cliente.observacao` no cabeçalho (`clienteObservacao`), para o alerta (R4).
- Rota de Cliente existente (CRUD de cliente): estende para ler/gravar
  `observacao` (R4.1).
- Proposta PDF (`/:id/proposta-pdf`): inclui `clienteObservacao` quando presente
  (R4.7).

### Backend — Motor de cálculo (materiais computados, R6)

Novo módulo puro `calculo-grafico/materiais-computados.service.ts`:

```ts
// Soma determinística dos materiais de acabamento marcados "computar no custo".
// Entrada: lista do item (materiaisAcabamento Json). Saída: total a somar no MD.
export function somarMateriaisComputados(
  materiais: { computarCusto?: boolean; valorUnitario?: number; quantidade?: number }[] | null,
): number
```

Integração em `orcamento-grafico-item.service.ts`:
- No cálculo do item, após montar `materialDireto` do motor, **somar**
  `somarMateriaisComputados(...)` à rubrica MD e ao custo de produção (R6.3).
- **Interação com a ancoragem (itens de repetição):** itens puxados de um
  cálculo de origem têm o custo ancorado no valor real da origem
  (`ancorarCustoCalcgraf`). Decisão de design: os materiais computados pelo
  usuário são **somados POR CIMA** do custo ancorado (delta aditivo), nunca
  substituindo a âncora. Assim o custo de origem permanece fiel e o material
  extra marcado pelo operador aparece como acréscimo explícito. Quando nenhum
  material tem `computarCusto`, o resultado é idêntico ao atual (R6.7).
- Validação de range 0,00–9.999.999,99 no Zod da rota (R6.8).

### Frontend — Mapa fixo Linha de Produto → campos condicionais (R2.3)

Arquivo novo `src/app/(interna)/orcamento-grafico/[id]/editor/campos-por-linha.ts`:

```ts
// Chaves de campo condicional exibíveis na seção Produto/Dados Técnicos.
export type CampoCondicional =
  | 'montagem3d' | 'abaCola' | 'abaFechamento' | 'alca' | 'fundo'
  | 'microondulado' | 'fibra' | 'formatoCorte' | 'coberturaTinta' | 'processoImpressao'

// Mapa FIXO por CÓDIGO da linha (não configurável pelo usuário). O código vem do
// legado; o nome é só exibição. Ajustável aqui no código.
export const CAMPOS_POR_LINHA: Record<string, CampoCondicional[]> = {
  'CARTUCHO':          ['montagem3d','abaCola','abaFechamento','fibra','formatoCorte','coberturaTinta','processoImpressao'],
  'CARTUCHO COMPOSTO': ['montagem3d','abaCola','abaFechamento','microondulado','fibra','formatoCorte','coberturaTinta','processoImpressao'],
  'SACOLA':            ['alca','fundo','abaCola','fibra','coberturaTinta','processoImpressao'],
  'LAMINA SIMPLES':    ['formatoCorte','coberturaTinta','processoImpressao'],
  'LAMINAS':           ['formatoCorte','coberturaTinta','processoImpressao'],
}
// Conjunto padrão quando a linha não está mapeada (R2.5): todos os campos.
export const CAMPOS_PADRAO: CampoCondicional[] = [...]
export function camposDaLinha(codigo?: string | null): CampoCondicional[]
```

A normalização do código remove acentos/caixa para casar `LÂMINAS`→`LAMINAS`.
Cada `Secao*` consulta `camposDaLinha(linhaProdutoCodigo)` e renderiza só os
campos presentes (campos fora do conjunto ficam ocultos, não removidos do
form — preservam valor ao trocar de linha, R2.6).

### Frontend — Seletor de Linha de Produto (R2)

- **No fluxo `/novo`** (`StepTipo.tsx` / `page.tsx`): adicionar o `Select` de
  Linha de Produto ANTES do Tipo de Embalagem, como primeira escolha. Só linhas
  ativas, ordenadas por nome (R2.2). Carregado de `GET /linhas-produto?situacao=ativa`.
- **No EditorItem** (edição): o seletor aparece no topo da seção Produto; troca
  de linha reatualiza os campos condicionais (R2.6).
- `linhaProdutoId` entra no `WizardFormData` e no payload de salvar.

### Frontend — Alerta de Observação do Cliente (R4)

Em `[id]/page.tsx`, logo abaixo do cabeçalho do orçamento:

```tsx
{orcamento.clienteObservacao?.trim() && (
  <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}
         title="Observação do cliente">
    <Text style={{ whiteSpace: 'pre-line' }}>{orcamento.clienteObservacao}</Text>
  </Alert>
)}
```

- Não-bloqueante: é só um `Alert`, não interfere nas ações (R4.3).
- Reage à troca de cliente porque o `GET /:id` recarrega após `EditarCabecalhoModal`
  salvar (ou, se o cliente for editável inline, revalida) (R4.5/4.6).
- A proposta PDF (backend) recebe `clienteObservacao` e imprime num bloco
  destacado (R4.7).
- O cadastro de Cliente (tela existente) ganha o campo "Observação" (Textarea,
  máx. 1000) (R4.1).

### Frontend — Materiais de acabamento com custo (R6)

Em `editor/SecaoAcabamentos.tsx`, por material listado da atividade:
- `Checkbox` "Computar no custo" + `NumberInput` "Valor unitário" (habilitado só
  quando marcado) + exibição do subtotal (valor × quantidade).
- O estado entra em `WizardFormData.materiaisAcabamento` e vai no payload.
- Quando nenhum está marcado, o comportamento é o atual (informativo) — o
  backend soma zero (R6.7).

### Frontend — Cobertura/Processo como Select (R10, R11)

Em `editor/SecaoDadosTecnicos.tsx`, os campos hoje `TextInput`
(`coberturaTintaTexto`, `processoImpressao`) passam a `Select` + opção de digitar
livre (fallback texto) alimentados por `GET /coberturas-tinta` e
`/processos-impressao`. O texto livre antigo é preservado quando não há match
(R10.5/R11.5).

### Frontend — Telas de cadastro novas

Quatro telas CRUD simples (padrão das telas de `cadastros/` existentes, com
`api` direto + `useState`), adicionadas ao `ModuleSidebar` sob Orçamento Gráfico
→ Cadastros: Linhas de Produto, Coberturas de Tinta, Processos de Impressão,
Materiais de Acabamento.

## Data Models

### LinhaProduto (R1)

```prisma
model LinhaProduto {
  id        String   @id @default(uuid())
  empresaId String   @map("empresa_id")
  codigo    String   @db.VarChar(60)
  nome      String   @db.VarChar(120)
  ativo     Boolean  @default(true)
  criadoEm  DateTime @default(now()) @map("criado_em")
  atualizadoEm DateTime @updatedAt @map("atualizado_em")

  @@unique([empresaId, codigo])
  @@map("linha_produto")
}
```

### CoberturaTinta / ProcessoImpressao (R10, R11)

```prisma
model CoberturaTinta {
  id        String  @id @default(uuid())
  empresaId String  @map("empresa_id")
  codigo    String  @db.VarChar(60)
  nome      String  @db.VarChar(120)
  ativo     Boolean @default(true)
  @@unique([empresaId, codigo])
  @@map("cobertura_tinta")
}

model ProcessoImpressao {
  id        String  @id @default(uuid())
  empresaId String  @map("empresa_id")
  codigo    String  @db.VarChar(60)
  nome      String  @db.VarChar(120)
  ativo     Boolean @default(true)
  @@unique([empresaId, codigo])
  @@map("processo_impressao")
}
```

### MaterialAcabamento (R6, R7)

Decisão: **model dedicado** (em vez de estender o Json `AcabamentoGrafico.materiais`).
Justificativa: o catálogo precisa de preço de referência pesquisável, isolamento
por empresa e unicidade por código — um Json não oferece unicidade nem query por
preço. O vínculo com o item fica no Json do item (leve, por item), mas o catálogo
é relacional.

```prisma
model MaterialAcabamento {
  id            String  @id @default(uuid())
  empresaId     String  @map("empresa_id")
  codigo        String  @db.VarChar(60)
  nome          String  @db.VarChar(200)
  valorReferencia Decimal @default(0) @map("valor_referencia") @db.Decimal(12, 4)
  ativo         Boolean @default(true)
  @@unique([empresaId, codigo])
  @@map("material_acabamento")
}
```

Vínculo por item (Json aditivo em `ItemOrcamentoGrafico`):
`materiaisAcabamento Json?` = `[{ materialAcabamentoId, nome, computarCusto, valorUnitario, quantidade }]`.

### Campos aditivos

```prisma
// Cliente
observacao String? @db.Text          // R4

// OrcamentoGrafico
linhaProdutoId     String? @map("linha_produto_id")      // R2
coberturaTintaId   String? @map("cobertura_tinta_id")    // R10
processoImpressaoId String? @map("processo_impressao_id") // R11

// ItemOrcamentoGrafico
materiaisAcabamento Json? @map("materiais_acabamento")   // R6
```

### migrate-prod.ts (SQL idempotente — mesmo commit do schema, R13.4)

```sql
CREATE TABLE IF NOT EXISTS linha_produto (
  id text PRIMARY KEY, empresa_id text NOT NULL, codigo varchar(60) NOT NULL,
  nome varchar(120) NOT NULL, ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp NOT NULL DEFAULT now(), atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS linha_produto_empresa_codigo_key ON linha_produto (empresa_id, codigo);

CREATE TABLE IF NOT EXISTS cobertura_tinta ( id text PRIMARY KEY, empresa_id text NOT NULL,
  codigo varchar(60) NOT NULL, nome varchar(120) NOT NULL, ativo boolean NOT NULL DEFAULT true );
CREATE UNIQUE INDEX IF NOT EXISTS cobertura_tinta_empresa_codigo_key ON cobertura_tinta (empresa_id, codigo);

CREATE TABLE IF NOT EXISTS processo_impressao ( id text PRIMARY KEY, empresa_id text NOT NULL,
  codigo varchar(60) NOT NULL, nome varchar(120) NOT NULL, ativo boolean NOT NULL DEFAULT true );
CREATE UNIQUE INDEX IF NOT EXISTS processo_impressao_empresa_codigo_key ON processo_impressao (empresa_id, codigo);

CREATE TABLE IF NOT EXISTS material_acabamento ( id text PRIMARY KEY, empresa_id text NOT NULL,
  codigo varchar(60) NOT NULL, nome varchar(200) NOT NULL,
  valor_referencia numeric(12,4) NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true );
CREATE UNIQUE INDEX IF NOT EXISTS material_acabamento_empresa_codigo_key ON material_acabamento (empresa_id, codigo);

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE orcamento_grafico ADD COLUMN IF NOT EXISTS linha_produto_id text;
ALTER TABLE orcamento_grafico ADD COLUMN IF NOT EXISTS cobertura_tinta_id text;
ALTER TABLE orcamento_grafico ADD COLUMN IF NOT EXISTS processo_impressao_id text;
ALTER TABLE item_orcamento_grafico ADD COLUMN IF NOT EXISTS materiais_acabamento jsonb;
```

Rodar `npx tsx prisma/migrate-prod.ts` duas vezes local para confirmar idempotência.
(Postgres local costuma estar off — roda no deploy do Render, idempotência
garantida por `IF NOT EXISTS`.)

## Importadores (R3, R5, R7, R10.4, R11.4)

Exportador único `scripts/exportar-paridade-calcgraf.mjs` (somente leitura,
`sqlcmd -u` UTF-16→UTF-8), gera `cartoon/export/paridade-*.json`:
- Linhas de Produto: `_LinhasProduto` WHERE `Ativo IN ('Ativo','ATIVO')`
  → só as 5 ativas (R3.2).
- Observações de cliente: `TabelaMemos` WHERE `NomeTabela='Nomes'` JOIN `Nomes`
  por `Codigo` → `{ cnpj: Nomes.CNPJCPF, memo }`.
- Materiais de acabamento: `Itc` (Origem='MAT.ACABAMENTO') JOIN
  `TabelasCustoDetalhe` (CodTabelaCusto=2, Coluna=1) → `{ codigo, nome, valor }`.
- Coberturas/Processos: valores distintos do legado (Escala/Especial; processos).

Gravadores `pg` idempotentes (connection string do Neon via env, nunca hardcode):
- `gravar-linhas-produto.mjs` — upsert por `(empresaId, codigo)`; não sobrescreve
  nome ajustado manualmente (R3.5).
- `gravar-observacoes-cliente.mjs` — de-para por CNPJ normalizado; 0/2+
  candidatos → NÃO grava (deixa vazio, R5.3); não sobrescreve `observacao`
  manual (R5.5).
- `gravar-materiais-acabamento.mjs` — flag `computarCusto` não existe no
  catálogo (é por vínculo de item); grava `valorReferencia`; não sobrescreve
  manual (R7.5).
- `gravar-coberturas-processos.mjs` — upsert idempotente.

Todos recusam rodar contra localhost; marcam o `empresaId` da Carton Wega.

## Error Handling

- CRUD dos cadastros: código duplicado → 409 (`@@unique`); cross-empresa → 404
  (`findFirst({ id, empresaId })`).
- Valor de material fora do range → 400 com mensagem do intervalo (R6.8).
- Importadores: candidato ambíguo (0/2+) → log + pula o registro (nunca inventa).
- Alerta de observação: tolerante a `null`/vazio/espaços (não renderiza).

## Testing Strategy

- **Motor (backend, vitest):** `materiais-computados.service.test.ts` — golden +
  property (fast-check): soma correta; zero quando nenhum `computarCusto`;
  não-regressão (resultado idêntico ao atual sem materiais). Teste de
  integração do item: material computado soma POR CIMA da âncora de repetição
  sem alterar o valor ancorado base.
- **Mapa de campos (front, vitest `--pool=threads`):** `campos-por-linha.test.ts`
  — normalização de código (acentos/caixa), conjunto padrão quando não mapeado,
  conjuntos das 5 linhas.
- **Importadores:** funções puras de de-para testadas (CNPJ normalizado; regra
  0/2+ → vazio).
- **Não-regressão:** build Next + `get_diagnostics`; conferir que criar do zero e
  puxar cálculo continuam idênticos.

## Mapa Requisito → Componente

| Req | Componentes |
|---|---|
| R1 | `LinhaProduto` model + migrate-prod; `linha-produto.routes.ts`; tela `cadastros/linhas-produto` |
| R2 | `OrcamentoGrafico.linhaProdutoId`; seletor em `StepTipo`/`EditorItem`; `campos-por-linha.ts` |
| R3 | `exportar-paridade-calcgraf.mjs` + `gravar-linhas-produto.mjs` |
| R4 | `Cliente.observacao` + migrate-prod; alerta em `[id]/page.tsx`; proposta PDF; cadastro de cliente |
| R5 | `gravar-observacoes-cliente.mjs` (de-para CNPJ) |
| R6 | `MaterialAcabamento` + `ItemOrcamentoGrafico.materiaisAcabamento`; `materiais-computados.service.ts`; `SecaoAcabamentos.tsx` |
| R7 | `gravar-materiais-acabamento.mjs` |
| R8 (Fase 2) | model `MaterialMicroondulado` (esboço); seletor condicional |
| R9 (Fase 2) | busca de Sigla de Acabado a partir de cadastro de acabados |
| R10 | `CoberturaTinta` + `coberturaTintaId`; `cobertura-tinta.routes.ts`; Select em `SecaoDadosTecnicos` |
| R11 | `ProcessoImpressao` + `processoImpressaoId`; `processo-impressao.routes.ts`; Select |
| R12 | `empresaId` explícito em todas as rotas/queries novas |
| R13 | campos aditivos nullable; migrate-prod idempotente; sem "Calcgraf" visível |

## Correctness Properties

Propriedades invariantes verificáveis por testes property-based (fast-check),
para as funções puras centrais da feature:

### Property 1: não-negatividade de `somarMateriaisComputados`
O total somado é sempre ≥ 0 para qualquer entrada com `valorUnitario` e `quantidade` ≥ 0.
**Validates: Requirements 6.3**

### Property 2: ignora não-computados
Materiais com `computarCusto !== true` nunca contribuem para o total.
**Validates: Requirements 6.4**

### Property 3: não-regressão / identidade
Se nenhum material tem `computarCusto`, o total é exatamente 0 (⇒ MD e custo
idênticos ao comportamento atual).
**Validates: Requirements 6.7**

### Property 4: aditividade
O total de uma lista concatenada é a soma dos totais das partes (`f(a++b) == f(a) + f(b)`).
**Validates: Requirements 6.3**

### Property 5: determinismo
A mesma entrada produz sempre o mesmo total.
**Validates: Requirements 6.5**

### Property 6: totalidade de `camposDaLinha`
Retorna sempre um conjunto não-vazio de campos para qualquer `codigo` (mapeado →
conjunto da linha; não mapeado/nulo → `CAMPOS_PADRAO`).
**Validates: Requirements 2.5**

### Property 7: normalização estável de código de linha
Códigos que diferem só por acento/caixa/espaços nas bordas mapeiam para o mesmo
conjunto (`LÂMINAS` ≡ `laminas ` ≡ `LAMINAS`).
**Validates: Requirements 2.3**

### Property 8: preservação de valor ao trocar de linha
Trocar a linha nunca apaga valores de campos presentes em AMBOS os conjuntos
(apenas oculta os ausentes).
**Validates: Requirements 2.6**

### Property 9: normalização de CNPJ
A comparação usa apenas dígitos; formatações diferentes do mesmo CNPJ casam
(`12.345.678/0001-90` ≡ `12345678000190`).
**Validates: Requirements 5.2**

### Property 10: ambiguidade → vazio
0 ou ≥2 candidatos ⇒ o registro NÃO é gravado (campo fica vazio).
**Validates: Requirements 5.3**

### Property 11: idempotência do importador
Rodar o importador 2× produz o mesmo estado final e não sobrescreve valor
ajustado manualmente.
**Validates: Requirements 5.4, 5.5, 3.4, 3.5, 7.4, 7.5**

## Decisões e Trade-offs

- **Mapa de campos fixo no front (não configurável):** mais simples e previsível
  para o MVP; se o cliente pedir configurável, vira cadastro numa fase futura.
- **Material computado soma por cima da âncora:** preserva a fidelidade do custo
  de origem dos itens de repetição (regra de ouro do projeto), tratando o
  material extra como acréscimo explícito do operador.
- **Catálogo relacional + vínculo Json no item:** catálogo precisa de query/
  unicidade (relacional); o vínculo por item é leve e variável (Json), seguindo
  o padrão já usado em `acabamentosRicos`/`itensDiversos`.
- **Fase 2 (R8/R9):** isoladas para não inflar o MVP; o schema fica esboçado.
