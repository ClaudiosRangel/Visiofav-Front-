# Implementation Plan

## Overview

Plano de implementação da paridade total da tela de Orçamento Gráfico. Toca os
dois repositórios separados. Legenda: `[BACK]` = `VisioFab.Wms.Back`; `[FRONT]`
= `VisioFab.Wms.Front`. Tarefas com `*` são property-based tests (opcionais —
rodar com `--pool=threads` no front). `[FASE 2]` = fora do MVP.

Ordem recomendada: schema (1) → motor e rotas backend (2–6) → frontend (7–12) →
importadores (13) → verificação (14). Os importadores (13) dependem dos cadastros
(1, 4) existirem, mas são independentes do frontend.

## Tasks

- [x] 1. [BACK] Schema + migrate-prod dos cadastros e campos aditivos
  - Adicionar ao `prisma/schema.prisma` os models `LinhaProduto`,
    `CoberturaTinta`, `ProcessoImpressao`, `MaterialAcabamento` (todos
    `@@unique([empresaId, codigo])`) e os campos aditivos: `Cliente.observacao`
    (Text?), `OrcamentoGrafico.linhaProdutoId/coberturaTintaId/processoImpressaoId`
    (nullable), `ItemOrcamentoGrafico.materiaisAcabamento` (Json?).
  - Replicar o SQL idempotente equivalente em `prisma/migrate-prod.ts`
    (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`,
    `ADD COLUMN IF NOT EXISTS`) no MESMO commit.
  - Rodar `npx prisma generate`; rodar `npx tsx prisma/migrate-prod.ts` 2× local
    se o Postgres local estiver disponível (senão validar por `get_diagnostics`;
    roda no deploy).
  - _Requirements: 1.1, 1.2, 4.1, 6.1, 10.1, 11.1, 13.4_

- [x] 2. [BACK] Motor puro de materiais computados + testes
  - [x] 2.1 Criar `src/modules/orcamento-grafico/calculo-grafico/materiais-computados.service.ts`
    com `somarMateriaisComputados(materiais)` (pura; soma `valorUnitario *
    quantidade` só dos itens com `computarCusto === true`; ignora valores
    ausentes/negativos tratando como 0).
    - _Requirements: 6.3, 6.4, 6.7_
  - [ ] 2.2* Testes `materiais-computados.service.test.ts` (vitest + fast-check):
    Properties 1–5 (não-negatividade, ignora não-computados, identidade/zero,
    aditividade, determinismo).
    - _Requirements: 6.3, 6.4, 6.5, 6.7_

- [x] 3. [BACK] Integrar materiais computados no cálculo do item (não-regressão)
  - Em `orcamento-grafico-item.service.ts`, somar
    `somarMateriaisComputados(item.materiaisAcabamento)` à rubrica Material
    Direto e ao custo de produção, SOMANDO POR CIMA da âncora de repetição
    (não substituir o custo ancorado). Quando a lista é vazia/sem flag, o
    resultado deve ser idêntico ao atual.
  - Validar range 0,00–9.999.999,99 no Zod da rota de item (400 fora do range).
  - _Requirements: 6.3, 6.6, 6.7, 6.8, 13.1, 13.2, 13.3_

- [x] 4. [BACK] Rotas CRUD dos cadastros novos (empresaId explícito)
  - [x] 4.1 `linha-produto.routes.ts` — GET (filtro `situacao`), POST, PUT;
    `findFirst({ id, empresaId })` → 404 cross-empresa; 409 código duplicado.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 12.1, 12.3_
  - [x] 4.2 `cobertura-tinta.routes.ts` — GET/POST/PUT, empresaId explícito.
    - _Requirements: 10.1, 10.2, 12.1_
  - [x] 4.3 `processo-impressao.routes.ts` — GET/POST/PUT, empresaId explícito.
    - _Requirements: 11.1, 11.2, 12.1_
  - [x] 4.4 `material-acabamento.routes.ts` — GET/POST/PUT, empresaId explícito.
    - _Requirements: 6.1, 6.2, 12.1_
  - [x] 4.5 Registrar os 4 routers em `server.ts`/módulo com prefixo
    `/api/orcamento-grafico`.
    - _Requirements: 1.1, 6.1, 10.1, 11.1_

- [x] 5. [BACK] Estender rotas do orçamento e do cliente com os campos novos
  - `POST /orcamento-grafico` e `POST /de-calculo`: aceitar `linhaProdutoId?`.
  - `POST/PUT .../itens` e `.../itens/:itemId/calcular`: aceitar
    `coberturaTintaId?`, `processoImpressaoId?`, `materiaisAcabamento?[]`
    (preservando os campos texto-livre `coberturaTintaTexto`/`processoImpressao`).
  - `GET /orcamento-grafico/:id`: resolver e retornar `clienteObservacao` no
    cabeçalho (lookup `Cliente.observacao` por empresaId).
  - Rota de Cliente (CRUD existente): ler/gravar `observacao` (máx. 1000).
  - _Requirements: 2.7, 4.1, 4.5, 4.6, 10.5, 11.5, 13.3_

- [x] 6. [BACK] Observação do cliente na proposta PDF
  - Incluir `clienteObservacao` (quando presente) num bloco destacado no gerador
    da proposta/relatório PDF do orçamento.
  - _Requirements: 4.7_

- [x] 7. [FRONT] Mapa fixo Linha de Produto → campos condicionais + testes
  - [x] 7.1 Criar `orcamento-grafico/[id]/editor/campos-por-linha.ts`:
    tipo `CampoCondicional`, `CAMPOS_POR_LINHA` (5 linhas), `CAMPOS_PADRAO`,
    `camposDaLinha(codigo)` com normalização (remove acento/caixa/trim).
    - _Requirements: 2.3, 2.5_
  - [ ] 7.2* Testes `campos-por-linha.test.ts` (vitest `--pool=threads`):
    Properties 6–8 (totalidade, normalização estável, preservação de valor).
    - _Requirements: 2.3, 2.5, 2.6_

- [x] 8. [FRONT] Seletor de Linha de Produto como etapa inicial
  - Adicionar `Select` de Linha de Produto (só ativas, ordenadas por nome) como
    primeira escolha no fluxo `/novo` (`StepTipo`/`page.tsx`) e no topo do
    `EditorItem`. Carregar de `GET /linhas-produto?situacao=ativa`.
    `linhaProdutoId` entra no `WizardFormData` e no payload de salvar.
  - Aplicar os campos condicionais (`camposDaLinha`) nas `Secao*`: ocultar campos
    fora do conjunto SEM apagar valores (preserva ao trocar de linha).
  - Orçamentos antigos sem linha abrem/editam normalmente.
  - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 2.9_

- [x] 9. [FRONT] Alerta destacado da observação do cliente
  - Em `[id]/page.tsx`, abaixo do cabeçalho, renderizar `Alert` (cor de atenção,
    não-bloqueante) com o texto integral de `orcamento.clienteObservacao` quando
    preenchido; ocultar quando vazio/nulo/espaços. Reagir à troca de cliente
    (recarregar após `EditarCabecalhoModal`).
  - Adicionar o campo "Observação" (Textarea, máx. 1000) no cadastro de Cliente.
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 10. [FRONT] Materiais de acabamento com opção de computar custo
  - Em `editor/SecaoAcabamentos.tsx`, por material: `Checkbox` "Computar no
    custo" + `NumberInput` "Valor unitário" (habilitado só quando marcado) +
    subtotal (valor × quantidade). Estado em `WizardFormData.materiaisAcabamento`
    → payload. Sem flag ligado = comportamento informativo atual.
  - _Requirements: 6.2, 6.4, 6.5, 6.8_

- [x] 11. [FRONT] Cobertura de Tinta e Processo de Impressão como Select
  - Em `editor/SecaoDadosTecnicos.tsx`, trocar os `TextInput` de
    `coberturaTintaTexto`/`processoImpressao` por `Select` (com opção de digitar
    livre como fallback) alimentados por `GET /coberturas-tinta` e
    `/processos-impressao`. Preservar texto livre quando não houver match.
  - _Requirements: 10.3, 10.5, 11.3, 11.5_

- [x] 12. [FRONT] Telas de cadastro novas (CRUD) + sidebar
  - Criar `cadastros/linhas-produto/page.tsx`, `cadastros/coberturas-tinta/page.tsx`,
    `cadastros/processos-impressao/page.tsx`, `cadastros/materiais-acabamento/page.tsx`
    (padrão das telas de `cadastros/` existentes). Adicionar itens ao
    `ModuleSidebar` sob Orçamento Gráfico → Cadastros.
  - _Requirements: 1.1, 1.6, 6.1, 10.1, 11.1_

- [x] 13. [BACK] Importadores da base restaurada
  - [x] 13.1 `scripts/exportar-paridade-calcgraf.mjs` (somente leitura,
    `sqlcmd -u` UTF-16→UTF-8): linhas ativas (`_LinhasProduto`), observações de
    cliente (`TabelaMemos` NomeTabela='Nomes' JOIN `Nomes` por CNPJ), materiais
    (`Itc` Origem='MAT.ACABAMENTO' + `TabelasCustoDetalhe` tab=2 col=1),
    coberturas/processos distintos → `cartoon/export/paridade-*.json`.
    - _Requirements: 3.1, 5.1, 7.1, 10.4, 11.4_
  - [x] 13.2 `gravar-linhas-produto.mjs` (pg, idempotente por `(empresaId,codigo)`,
    só ativas, não sobrescreve manual, empresaId Wega, recusa localhost).
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [x] 13.3 `gravar-observacoes-cliente.mjs` (de-para por CNPJ normalizado;
    0/2+ candidatos → não grava; não sobrescreve manual; idempotente).
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 13.4 `gravar-materiais-acabamento.mjs` (upsert por código, valorReferencia,
    não sobrescreve manual, idempotente).
    - _Requirements: 7.2, 7.3, 7.4, 7.5_
  - [x] 13.5 `gravar-coberturas-processos.mjs` (upsert idempotente das coberturas
    e processos).
    - _Requirements: 10.4, 11.4_
  - [ ] 13.6* Testes puros de de-para (CNPJ normalizado; 0/2+ → vazio;
    idempotência): Properties 9–11.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 3.4, 3.5, 7.4, 7.5_

- [x] 14. Verificação e não-regressão
  - `get_diagnostics` limpo nos arquivos tocados (back e front).
  - `npm run build` do front OK; conferir imports de componentes novos (Alert,
    Checkbox, Select) — build do Next NÃO pega `ReferenceError` de import.
  - Conferir que criar orçamento do zero e puxar cálculo continuam idênticos.
  - Nenhuma string "Calcgraf" visível na tela de orçamento.
  - _Requirements: 13.1, 13.2, 13.3, 13.5_

- [x] 15. [FASE 2] Microondulado com lista de materiais
  - Model `MaterialMicroondulado` + migrate-prod; seletor condicional ao marcar
    microondulado; não-regressão quando desmarcado.
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 16. [FASE 2] Busca de Sigla de Acabado a partir de cadastro
  - Substituir texto livre por busca/seleção de cadastro de acabados,
    preservando texto livre preexistente.
  - _Requirements: 9.1, 9.2, 9.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "4", "7"] },
    { "wave": 3, "tasks": ["3", "5", "8", "12", "13"] },
    { "wave": 4, "tasks": ["6", "9", "10", "11"] },
    { "wave": 5, "tasks": ["14"] },
    { "wave": 6, "tasks": ["15", "16"] }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["1", "2"],
    "4": ["1"],
    "5": ["1", "4"],
    "6": ["5"],
    "7": [],
    "8": ["7"],
    "9": ["5"],
    "10": ["3", "5"],
    "11": ["4", "5"],
    "12": ["4"],
    "13": ["1", "4"],
    "14": ["3", "5", "6", "8", "9", "10", "11", "12", "13"],
    "15": ["1"],
    "16": ["1"]
  }
}
```

## Notes

- Toda query nova filtra `empresaId` explícito (não confiar só em `prismaScoped`
  — bypass SUPER_ADMIN).
- Schema + `migrate-prod.ts` SEMPRE no mesmo commit (produção não usa
  `prisma migrate deploy`); rodar `migrate-prod.ts` 2× local para idempotência.
- Importadores: somente leitura do SQL Server; connection string do Neon via env
  (nunca hardcode); scripts `_tmp-`/dados `cartoon/` não são commitados.
- Não-regressão é requisito: itens de repetição ancorados mantêm o custo de
  origem; materiais computados somam POR CIMA. Build do Next não pega
  `ReferenceError` de import — conferir imports manualmente.
- "Calcgraf" não pode aparecer em texto visível da tela de orçamento.
- Commits: back e front são repos separados; commitar só quando o usuário pedir.
