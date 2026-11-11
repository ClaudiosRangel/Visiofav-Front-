# Plano de Implementação — Redesign UX/UI do Editor de Orçamento

Tudo FRONT (`VisioFab.Wms.Front`). `*` = testes opcionais (fast-check,
`--pool=threads`). Sem schema/motor.

- [x] 1. Mensagens de erro amigáveis (Req 1)
  - [x] 1.1 Criar `editor/erros-amigaveis.ts` com `traduzirErros(resp)` +
    `ROTULO_ERRO` por campo; anti-vazamento de Zod cru; fallback genérico.
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 1.2* Testes `erros-amigaveis.test.ts` (P1 anti-Zod, P2 mapa, P3 determinístico) — 6/6.
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 Substituir o `erro` cru do `StepRevisao` (Fechamento) pelo resultado
    de `traduzirErros` (resumo amigável; título "Complete os dados do item").
    - _Requirements: 1.1, 1.3_

- [x] 2. Extrair `montarPayloadCalculo(formData)` para `itemFormShared`
  - Fonte única do payload de cálculo, reusado pelo hook de recálculo ao vivo.
  - _Requirements: 3.2, 7.1_

- [x] 3. Hook de recálculo ao vivo (Req 3)
  - [x] 3.1 Criar `editor/useCalculoAoVivo.ts` (debounce ~600 ms; escolhe rota
    item-ancorado vs `/calcular`; cancela obsoletos; mantém último KPI em erro;
    deriva kpis + erros via `traduzirErros`).
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [ ] 3.2* Teste de cancelamento/estabilidade (P3, P4) — follow-up opcional.
    - _Requirements: 3.3_

- [x] 4. Sticky Summary Bar (Req 3)
  - Criar `editor/ResumoKpis.tsx` (4 cards: Custo Total/Preço Venda/Margem/Preço
    Unitário), `position: sticky`, spinner discreto no recálculo.
  - Integrar no topo do `EditorItem` com `kpis/loading` do hook + Alert amigável.
  - _Requirements: 3.1, 3.3_

- [x] 5. Stepper de seções com status (Req 4)
  - Alterar `IndiceAncoras.tsx` (prop `statusPorAncora`, marcadores ✓/○/⚠,
    mantém scroll-spy + legenda). Derivar `statusPorAncora` no `EditorItem`
    (mapa seção→campos essenciais + errosPorCampo).
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Hierarquia visual e contraste (Req 2)
  - Tokens adaptativos nos containers/sticky bar; SecaoContainer destaca seção
    com erro (borda vermelha + ícone de status); badges elegantes. Tema claro/escuro.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Painel lateral retrátil de preview 2D (Req 5)
  - Criado `editor/PainelPreview.tsx` (SVG de encaixe + faca/produto); integrado
    como coluna retrátil no `EditorItem` (toggle expand/collapse).
  - _Requirements: 5.1, 5.2_

- [x] 8. Acabamentos agrupados/filtráveis (Req 6)
  - Em `StepAcabamentos.tsx` (usado por `SecaoAcabamentos`): selecionados
    primeiro + busca + filtro por categoria. Cálculo inalterado.
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Verificação e não-regressão (Req 7)
  - get_diagnostics limpo nos arquivos tocados; imports conferidos; motor de
    cálculo intacto (só apresentação + recálculo via rota existente);
    salvar/Puxar Cálculo/ancoragem preservados; sem "Calcgraf".
  - _Requirements: 7.1, 7.2, 7.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3", "5", "8"] },
    { "wave": 3, "tasks": ["4", "7"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["9"] }
  ],
  "dependencies": {
    "1": [],
    "2": [],
    "3": ["1", "2"],
    "4": ["3"],
    "5": ["1"],
    "6": ["3", "5"],
    "7": [],
    "8": [],
    "9": ["4", "5", "6", "7", "8"]
  }
}
```
