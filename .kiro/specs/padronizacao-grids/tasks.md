# Implementation Plan

## Overview

Padronização dos grids em 4 módulos via `DataTablePadrao`. Ondas por módulo;
build + commit ao final de cada onda. Telas de visualização especial (Gantt,
Programação, Painel TV, dashboards com cards) ficam fora. Marcar cada tela ao
concluir. Telas server-side (Produtos, listagens grandes) exigem atenção à
paginação do backend.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4"] },
    { "wave": 5, "tasks": ["5"] },
    { "wave": 6, "tasks": ["6"] }
  ],
  "dependencies": {
    "2": ["1"],
    "3": ["1"],
    "4": ["1"],
    "5": ["1"],
    "6": ["2", "3", "4", "5"]
  }
}
```

## Tasks

- [x] 1. Componente DataTablePadrao + CSS global + piloto
  - `src/components/ui/DataTablePadrao.tsx` (busca/sort/paginação/contador).
  - CSS no layout. Piloto: Centros, Recursos, Turnos (PCP).
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Onda PCP (cadastros e listagens) — telas client-side
  - tipos-processo, estruturas, roteiros, atributos-graficos, liberacoes, logs,
    de-para, importador-calcgraf/api-keys, importador-calcgraf/pendentes,
    gerencial/codigos-parada, ordens-producao, ordens-producao/requisicoes-corte.
  - Produtos é SERVER-SIDE (paginado) — tratar preservando paginação do backend.
  - FORA: programacao, timeline, gantt, painel-producao, apontamentos (abas/
    dashboards), analise-gerencial/producao (cards/gráficos), mapa-custo (editor),
    permissoes (telas específicas).
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

- [ ] 3. Onda Orçamento Gráfico
  - cadastros: acabamentos, modelos-faca, parametros-perda, precos-materiais,
    suportes, tabelas-margem, tipos-embalagem; listagem principal (page.tsx).
  - FORA: dashboard (cards), importar (wizard).
  - _Requirements: 3.1, 6.1, 6.2_

- [ ] 4. Onda Compras
  - compras-efetivadas, devolucoes, pedidos, requisicoes, transferencias.
  - FORA: importar-xml (wizard), pedidos/novo (form).
  - Atenção a server-side onde a listagem for paginada.
  - _Requirements: 4.1, 6.1, 6.2, 6.3_

- [ ] 5. Onda WMS (maior — subdividir por sub-leva)
  - consulta/* (clientes, fornecedores, produtos, transportadoras) — provável server-side.
  - cadastros/listagens: etiquetas/*, kpi/*, lms/*, faturamento/*, demanda/*,
    bi/*, picking-zona/*, multi-cd/*, patio/*, portal/*, wave/*, bloqueios,
    classificacao-abc, inventario, ordens-servico, pendencias-cce, ressuprimento,
    transferencia-endereco, auditoria, agenda, agenda-doca/bloqueios,
    logistica-reversa, manutencao-estoque, mapas-carregamento, montagem-carga,
    relatorios, relatorios-expedicao, dados-logisticos, enderecamento,
    conferencia-entrada, conferencia-saida, cross-dock, fila-excecoes, portaria.
  - FORA: mapa, mapa-armazem (visuais), monitores em tempo real, dashboards.
  - _Requirements: 5.1, 6.1, 6.2, 6.3_

- [ ] 6. Build final + validação + commit por onda
  - `npm run build` ao final de cada módulo; commit por módulo; validação do usuário.
  - _Requirements: 6.1_

## Notes

- Piloto (Task 1) já commitado: componente + Centros/Recursos/Turnos.
- Build do Next ~5-7min; validar por onda, não tela a tela.
- Client-side cobre a maioria; server-side onde o backend já pagina
  (Produtos, consultas de grande volume) — preservar a paginação existente.
- Repos: front na `main`. Confirmar push por `xxx..yyy main -> main`.
