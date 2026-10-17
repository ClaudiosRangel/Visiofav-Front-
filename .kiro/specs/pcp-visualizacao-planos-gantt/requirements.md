# Requirements Document

## Introduction

Esta feature é 100% de **frontend** no VisioFab (ERP gráfico, módulo PCP) e
atende 3 dos 4 pontos levantados na reunião com a Carton Wega em 15/10/2026.
Nenhuma mudança de schema é feita — todos os dados consumidos
(`PlanoOrdemProducao`, `EtapaOrdemProducao`, e o endpoint `/pcp/timeline`) já
existem no backend. O objetivo é melhorar a **clareza visual** da estrutura
gráfica das OPs e padronizar a nomenclatura exibida ao usuário.

Os três objetivos são:

1. **Garantia de nomenclatura "VERSO"**: validar que nenhuma tela de PCP exibe
   o termo legado "costa"/"COSTA" ao usuário — sempre "VERSO". A normalização
   do legado já existe (helper de rótulo de plano); esta feature apenas garante
   e valida a cobertura em todas as superfícies de PCP.
2. **Visualização consolidada de Planos/Componentes da OP**: um padrão de
   card/tabela que mostre, por plano/componente, nome, formato, cores
   (frente × verso quando há retiração), tiragem, material/gramatura e a
   relação FRENTE/VERSO, para o usuário entender a estrutura gráfica da OP de
   forma clara (equivalente ou melhor que o PDF do Calcgraf).
3. **Clareza das barras do Gantt para OPs com múltiplas passadas/processos**:
   quando uma OP tem 2+ etapas no mesmo centro (ex.: impressão FRENTE e VERSO,
   ou 2ª passada) ou passa por mais de um processo, cada barra deve rotular a
   face/plano/sequência a que pertence, e as barras da mesma OP devem ser
   visualmente associadas.

### Fora de escopo (explícito)

- O item 4 da reunião (travar/mover blocos no Gantt via drag & drop) **NÃO**
  faz parte desta spec — será uma spec separada (B).
- Nenhuma mudança de schema, migração de banco ou nova rota de backend.
- Nenhuma alteração em lógica de apontamento, fila ou status de produção.
- Isolamento multi-tenant por `empresaId` já é garantido pelas rotas
  existentes — não é responsabilidade desta feature.

## Glossary

- **Front_PCP**: O conjunto de telas do módulo PCP no frontend web
  (`VisioFab.Wms.Front`, Next.js 15 + Mantine 7).
- **Tela_PCP**: Qualquer tela de usuário do módulo PCP: lista de OPs
  (`/pcp/ordens-producao`), detalhe da OP (`/pcp/ordens-producao/[id]`), aba
  Planos/Variações do detalhe da OP, Gantt (`/pcp/gantt` e
  `/pcp/timeline/gantt`), painel de Programação (`/pcp/programacao`), e o
  relatório/PDF gerado de OP.
- **Rotulador_Plano**: O componente/função de frontend que normaliza o nome
  exibido de um plano, convertendo o termo legado "COSTA" (em qualquer caixa)
  para "VERSO" antes de renderizar.
- **Plano**: Um registro de `PlanoOrdemProducao` associado a uma OP. Possui
  `nome`, `tipo` (`COMPONENTE` ou `FACE`), `formato`, `cores`, `tiragem`,
  `montagem`, `material`, `gramatura`, `faceDeId` e `sequencia`.
- **Plano_Face**: Um Plano cujo `tipo` é `FACE`, representando a FRENTE ou o
  VERSO de uma impressão em retiração (tira-retira).
- **Plano_Verso**: Um Plano_Face cujo `faceDeId` aponta para outro Plano_Face
  (a FRENTE), ou seja, o lado VERSO da retiração.
- **Plano_Frente**: Um Plano_Face que é referenciado por um Plano_Verso através
  de `faceDeId`.
- **Visualizacao_Planos**: A superfície de frontend (card/tabela consolidada)
  que exibe os Planos de uma OP de forma estruturada.
- **Barra_Gantt**: O elemento visual retangular que representa uma
  `EtapaOrdemProducao` em uma das telas de Gantt.
- **Rotulo_Barra**: O texto exibido dentro ou junto de uma Barra_Gantt
  identificando a face/plano/sequência da etapa.
- **Cor_OP**: A cor de preenchimento atribuída de forma estável a todas as
  Barra_Gantt de uma mesma OP (comportamento já existente).
- **Etapa**: Um registro de `EtapaOrdemProducao` retornado pelo endpoint
  `/pcp/timeline` com, no mínimo, os campos `descricao` e `sequencia`.
- **Retiracao**: Impressão tira-retira em que a mesma folha passa 2 vezes na
  máquina (FRENTE e VERSO), gerando 2 Plano_Face na mesma OP.

## Requirements

### Requirement 1: Nomenclatura "VERSO" em todas as telas de PCP

**User Story:** Como operador/planejador de PCP da Carton Wega, quero que todas
as telas sempre mostrem "VERSO" (nunca "costa"), para que a nomenclatura seja
consistente com a linguagem adotada pela fábrica.

#### Acceptance Criteria

1. WHERE um nome de Plano contém o termo legado "COSTA" em qualquer combinação
   de maiúsculas e minúsculas, THE Rotulador_Plano SHALL exibir "VERSO" no
   lugar do termo "COSTA".
2. THE Rotulador_Plano SHALL preservar o restante do nome do Plano inalterado
   ao substituir apenas o termo "COSTA" por "VERSO".
3. WHEN uma Tela_PCP exibe o nome de um Plano, THE Front_PCP SHALL aplicar o
   Rotulador_Plano antes de renderizar o texto.
4. WHEN uma Tela_PCP exibe um Rotulo_Barra que contém a face de impressão, THE
   Front_PCP SHALL exibir "VERSO" para o lado de retiração legado "COSTA".
5. THE Front_PCP SHALL exibir o termo "VERSO" (e nunca "COSTA") na lista de OPs,
   no detalhe da OP, na Visualizacao_Planos, nas telas de Gantt e no painel de
   Programação.

### Requirement 2: Visualização consolidada de Planos/Componentes da OP

**User Story:** Como planejador de PCP, quero uma visualização consolidada dos
planos/componentes de uma OP, para entender rapidamente a estrutura gráfica da
OP (nome, formato, cores, tiragem, material/gramatura e relação frente/verso).

#### Acceptance Criteria

1. WHEN o usuário abre o detalhe de uma OP que possui 1 ou mais Planos, THE
   Visualizacao_Planos SHALL exibir uma entrada por Plano.
2. THE Visualizacao_Planos SHALL exibir, para cada Plano, os campos nome,
   formato, cores, tiragem, material e gramatura.
3. WHERE um campo de um Plano está ausente ou vazio, THE Visualizacao_Planos
   SHALL exibir um marcador de ausência ("—") no lugar do valor.
4. THE Visualizacao_Planos SHALL ordenar os Planos exibidos pelo campo
   `sequencia` em ordem crescente.
5. WHERE um Plano é um Plano_Verso, THE Visualizacao_Planos SHALL indicar
   visualmente que o Plano é o VERSO e associá-lo ao Plano_Frente
   correspondente identificado por `faceDeId`.
6. WHERE um Plano_Face representa retiração com cores distintas na frente e no
   verso, THE Visualizacao_Planos SHALL exibir as cores no formato "frente ×
   verso".
7. WHERE o `tipo` de um Plano é `COMPONENTE`, THE Visualizacao_Planos SHALL
   exibir um indicador visual distinto do indicador usado para o `tipo` `FACE`.
8. IF uma OP não possui nenhum Plano, THEN THE Visualizacao_Planos SHALL exibir
   uma mensagem informando que a OP não possui planos consolidados.

### Requirement 3: Rótulo de face/plano/sequência nas barras do Gantt

**User Story:** Como planejador de PCP, quero que cada barra do Gantt indique a
face/plano/sequência da etapa, para distinguir visualmente etapas de uma mesma
OP que ocupam o mesmo centro (ex.: FRENTE e VERSO) ou passadas repetidas.

#### Acceptance Criteria

1. WHEN uma Barra_Gantt é renderizada para uma Etapa, THE Front_PCP SHALL
   derivar o Rotulo_Barra a partir dos campos `descricao` e `sequencia` da
   Etapa retornados por `/pcp/timeline`.
2. WHERE a `descricao` de uma Etapa contém a identificação de face ("FRENTE",
   "VERSO" ou "COSTA") ou de plano, THE Front_PCP SHALL incluir essa
   identificação no Rotulo_Barra, exibindo "VERSO" no lugar de "COSTA".
3. WHEN duas ou mais Barra_Gantt pertencem à mesma OP no mesmo centro de
   produção, THE Front_PCP SHALL exibir em cada Barra_Gantt o Rotulo_Barra que
   a distingue das demais Barra_Gantt da mesma OP.
4. THE Front_PCP SHALL aplicar a mesma Cor_OP a todas as Barra_Gantt de uma
   mesma OP.
5. WHERE uma Etapa é uma passada repetida de uma OP já representada por outra
   Barra_Gantt no mesmo centro, THE Front_PCP SHALL exibir no Rotulo_Barra a
   `sequencia` da Etapa e uma marca visual distintiva na Barra_Gantt repetida
   para distinguir a passada, sem suprimir nem mesclar a Barra_Gantt.
6. WHEN o espaço horizontal de uma Barra_Gantt é insuficiente para o
   Rotulo_Barra completo, THE Front_PCP SHALL disponibilizar o Rotulo_Barra
   completo no tooltip da Barra_Gantt.
7. THE Front_PCP SHALL aplicar os critérios de rotulagem de Barra_Gantt tanto
   na tela `/pcp/gantt` quanto na tela `/pcp/timeline/gantt`.

### Requirement 4: Não-regressão do comportamento existente do Gantt e do detalhe da OP

**User Story:** Como usuário de PCP, quero que as melhorias de visualização não
quebrem o comportamento atual das telas, para continuar usando o sistema sem
perda de funcionalidade.

#### Acceptance Criteria

1. WHERE uma Etapa não possui identificação de face nem de plano na `descricao`,
   THE Front_PCP SHALL renderizar a Barra_Gantt com o conteúdo atual
   (número da OP e produto) sem rótulo adicional de face/plano.
2. THE Front_PCP SHALL preservar o agrupamento das Barra_Gantt por tipo de
   processo e centro de produção já existente nas telas de Gantt.
3. THE Front_PCP SHALL preservar as abas existentes do detalhe da OP (Etapas,
   Materiais, Variações, Entregas, Histórico) ao adicionar a Visualizacao_Planos.
4. WHEN os dados consumidos de `/pcp/timeline` ou do detalhe da OP não incluem
   campos de Plano, THE Front_PCP SHALL exibir as telas sem erro e sem exibir a
   Visualizacao_Planos de Planos inexistentes.
5. IF uma Etapa ou um Plano é exibido com dados incompletos (campos esperados
   ausentes), THEN THE Front_PCP SHALL sinalizar visualmente a incompletude por
   meio de um indicador de alerta sem bloquear a exibição do item.
