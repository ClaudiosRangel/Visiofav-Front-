# Requirements Document

## Introduction

Esta feature cria uma suíte de QA automatizada (Python + Playwright, no mesmo
diretório `tests/e2e-qa`) focada em **cobertura total da regra de negócio do
recebimento WMS e de tudo que o influencia e está conectado a ele**: Agenda de
Docas, Portaria, cadastro de SKU, Dados Logísticos, Conferência de Entrada
(incluindo segunda conferência, tolerância, shelf-life, lote/validade, HOLD/Fila
de Exceções) e a integração PCP → WMS (Ordem de Produção concluída gerando Nota
de Entrada de produção que entra no mesmo fluxo de conferência).

O nível de validação é **QA de negócio**: cada Caso_De_Teste exercita a regra
real, persiste dados rastreáveis (prefixo `QA-`) e faz `assert` sobre o
comportamento observado (estados, bloqueios, valores). Quando um pré-requisito
de ambiente não puder ser atingido de forma determinística, o teste faz
`pytest.skip` com motivo claro — nunca um assert falso/mascarado. Divergências
conhecidas entre requisito e comportamento do backend são registradas com
`xfail(strict=True)`.

A suíte reaproveita a infraestrutura existente (`wms_api.py`, fixtures do
`conftest.py`, limpeza rastreável, evidências, relatório HTML) e roda contra o
ambiente de produção (front Vercel `https://visiofav-front-wofr.vercel.app`,
API `https://api.vizorerp.com.br/api`), empresa "VisioFab Demo".

Este documento é fiel ao comportamento atual do backend (verificado em código):
`conferencia/conferencia-entrada.routes.ts`, `conferencia-entrada/*.service.ts`,
`agenda-doca/agenda-doca.service.ts`, `portaria/portaria.routes.ts` +
`liberacao-conferencia.service.ts`, `sku/sku.routes.ts`,
`dados-logisticos/dados-logisticos.routes.ts`,
`pcp/etapa-operacional.service.ts` (`concluirEtapa`) e
`pcp/pcp-wms-integration.service.ts` (`criarEntradaProducao`).

## Glossary

- **Suite_QA**: A suíte Python + Playwright em `tests/e2e-qa`, incluindo os novos módulos desta feature.
- **Caso_De_Teste**: Uma função de teste (`test_*`) que exercita um cenário de negócio.
- **API_Cliente**: O cliente HTTP autenticado (`WmsApiClient` em `wms_api.py`) usado para preparar dados e verificar estado de backend.
- **Nota_Entrada**: Registro `NotaEntrada`. Estados relevantes: `PENDENTE` → `EM_CONFERENCIA` → `CONFERIDA` → `ENDERECADA` (rejeitar volta a `PENDENTE`).
- **Item_Nota**: `ItemNotaEntrada`. `statusConferencia`: `PENDENTE | CONFERIDO | PENDENTE_SEGUNDA_CONFERENCIA | HOLD | REJEITADO`.
- **Produto**: cadastro `Produto`, com os campos que ditam regras de conferência: `exigeLote`, `shelfLifeMinimo`, `toleranciaQuantidadePercentual`.
- **Tolerancia_Quantidade**: percentual de desvio de quantidade aceito automaticamente sem virar divergência. Prioridade: `Produto.toleranciaQuantidadePercentual`, fallback `Empresa.toleranciaQuantidadePercentualPadrao`, default 0.
- **Pendencia_Logistica**: `PendenciaLogistica` gerada quando SKU e/ou Dados Logísticos de um produto da nota não estão configurados; bloqueia o início e a execução da conferência.
- **Agenda_Doca**: `AgendaWms`, com `status`: `AGENDADO | CONFIRMADO | ESPERA | NA_DOCA | CONFERINDO | CONFERIDO | RECEBIDO | CANCELADO | ATRASADO`.
- **Config_Doca**: `ConfigDoca` (`horaAberturaOp`, `horaFechamentoOp`, `bufferMinutos`, `toleranciaAtraso`).
- **SKU**: `Sku` — palete = `lastro × camada`; `qtdEmbalagem`, códigos de barra, peso/volume/dimensões.
- **Integracao_Pcp_Wms**: fluxo em que a conclusão da última etapa de uma OP (`concluirEtapa`) gera `NotaEntrada` `tipo=PRODUCAO`, controlado pela flag `pcp.integracaoWmsAutomatica` (pré-condição `Empresa.usaWms`).
- **Dado_De_Teste**: registro criado pela Suite_QA, identificado por prefixo rastreável (`QA-`).
- **Evidencia**: screenshot ou entrada de relatório que comprova o resultado.

## Requirements

### Requirement 1: Cadastro de SKU e regras de embalagem/palete

**User Story:** Como QA, quero validar que o cadastro de SKU calcula e persiste corretamente as regras de embalagem e paletização, porque o SKU alimenta o cálculo de put-away e a resolução de pendência logística.

#### Acceptance Criteria

1. WHEN um SKU é criado com `largura`, `altura` e `comprimento` sem `volume` informado, THE Suite_QA SHALL verificar que o `volume` persistido é igual a `(largura × altura × comprimento) / 1.000.000`.
2. WHEN um SKU é criado com `lastro` e `camada` definidos, THE Suite_QA SHALL verificar que a capacidade de palete usada pelo put-away é igual a `lastro × camada`.
3. THE Suite_QA SHALL verificar que os SKUs de um produto são retornados ordenados por `sequencia` crescente.
4. WHEN um SKU é criado para um produto que estava com pendência logística de SKU, THE Suite_QA SHALL verificar que a Pendencia_Logistica correspondente é resolvida automaticamente.
5. THE Suite_QA SHALL verificar isolamento multi-tenant: um SKU criado em uma empresa não é retornado na listagem de SKUs de outra empresa.

### Requirement 2: Dados Logísticos (armazenagem, picking, expedição)

**User Story:** Como QA, quero validar o cadastro de Dados Logísticos e seu efeito sobre a liberação da conferência, porque a ausência deles bloqueia o recebimento.

#### Acceptance Criteria

1. WHEN Dados Logísticos de armazenagem são criados sem `tipoNorma`, THE Suite_QA SHALL verificar que o valor persistido é `FEFO` (default).
2. THE Suite_QA SHALL verificar que `tipoNorma` só aceita os valores `FEFO`, `FIFO` ou `LIFO` (valor inválido é rejeitado).
3. WHEN Dados Logísticos de armazenagem são criados para um produto com pendência logística, THE Suite_QA SHALL verificar que a Pendencia_Logistica correspondente é resolvida automaticamente.
4. THE Suite_QA SHALL verificar que os três sub-cadastros (armazenagem, picking, expedição) são consultáveis por `produtoId` de forma independente.

### Requirement 3: Agenda de Docas — conflito, buffer e horário operacional

**User Story:** Como QA, quero validar as regras de agendamento de doca, porque agendamentos conflitantes comprometem a operação de recebimento.

#### Acceptance Criteria

1. WHEN um agendamento é criado dentro do horário operacional e sem sobreposição, THE Suite_QA SHALL verificar que ele é persistido com `status=AGENDADO`.
2. IF um segundo agendamento na mesma doca e mesmo dia sobrepõe a janela de um existente (considerando o `bufferMinutos`), THEN THE Suite_QA SHALL verificar que a operação é rejeitada com HTTP 409 E que o segundo agendamento não é persistido (ambos devem ocorrer).
3. IF um agendamento tem `horaInicio` anterior a `horaAberturaOp` ou `horaFim` posterior a `horaFechamentoOp`, THEN THE Suite_QA SHALL verificar que a operação é rejeitada com o motivo de horário fora do período operacional.
4. WHEN existe um bloqueio de slot (`BloqueioSlotDoca`) sobreposto à janela solicitada, THE Suite_QA SHALL verificar que o agendamento é rejeitado com o motivo do bloqueio.
5. WHEN um agendamento é movido para uma janela livre, THE Suite_QA SHALL verificar que a revalidação de conflito exclui o próprio agendamento e a operação é aceita.
6. WHEN a chegada real de um agendamento é registrada, THE Suite_QA SHALL verificar que `horaChegadaReal` é gravada e o `status` passa a `NA_DOCA`.

### Requirement 4: Portaria — sequência de estados e liberação com supervisor

**User Story:** Como QA, quero validar a máquina de estados da Portaria e a exigência de supervisor, porque a liberação indevida pula controles de recebimento.

#### Acceptance Criteria

1. WHEN a portaria confere um agendamento em `status=AGENDADO`, THE Suite_QA SHALL verificar que o status passa a `ESPERA` e que uma Nota_Entrada `PENDENTE` é criada quando há pedido de compra vinculado.
2. IF a portaria tenta autorizar a entrada de um agendamento que não está `CONFIRMADO`, THEN THE Suite_QA SHALL verificar que a operação é rejeitada com HTTP 422.
3. WHEN a entrada é autorizada para um agendamento `CONFIRMADO`, THE Suite_QA SHALL verificar que o status passa a `NA_DOCA` e que uma Ordem de Serviço de operação `CONFERENCIA` é criada.
4. IF um agendamento se enquadra em "agendado sem nota fiscal" (tem pedido/fornecedor mas sem Nota_Entrada `PENDENTE`/`EM_CONFERENCIA` nem compra com XML) E a autorização não traz credenciais de supervisor, THEN THE Suite_QA SHALL verificar que a operação é rejeitada com HTTP 422 e nenhum status/OS é alterado.
5. WHERE credenciais de supervisor inválidas são enviadas na condição do item 4, THE Suite_QA SHALL verificar que a operação é rejeitada com HTTP 401.
6. WHEN a autorização de entrada gera pendência logística (SKU/dados logísticos ausentes), THE Suite_QA SHALL verificar que o início da conferência é bloqueado (HTTP 422, bloqueio `PENDENCIA_LOGISTICA`).

### Requirement 5: Conferência de entrada — bloqueios de pré-condição

**User Story:** Como QA, quero validar os bloqueios que impedem iniciar/executar a conferência, porque eles protegem a integridade do recebimento.

#### Acceptance Criteria

1. IF uma Nota_Entrada não possui itens, THEN THE Suite_QA SHALL verificar que iniciar a conferência é rejeitado com HTTP 422.
2. IF existe Pendencia_Logistica `PENDENTE` para a nota, THEN THE Suite_QA SHALL verificar que iniciar a conferência é rejeitado com HTTP 422 e bloqueio `PENDENCIA_LOGISTICA`.
3. WHEN a conferência de uma nota `PENDENTE`/`EM_CONFERENCIA` sem pendências é iniciada, THE Suite_QA SHALL verificar que o status da nota passa a `EM_CONFERENCIA`.
4. WHERE `Empresa.conferenciaLoteCega` está ativa, THE Suite_QA SHALL verificar que a tela de conferência não expõe o lote/validade da NF-e (retornados como nulos) para o operador.
5. THE Suite_QA SHALL verificar que um item cujo `codigoProduto` não corresponde a nenhum Produto cadastrado é sinalizado com `produtoNaoEncontrado=true`.

### Requirement 6: Conferência de entrada — quantidade, tolerância e recebimento parcial

**User Story:** Como QA, quero validar as regras de quantidade na conferência, porque elas determinam quando há divergência.

#### Acceptance Criteria

1. WHEN todos os itens são conferidos com quantidade igual à da nota, THE Suite_QA SHALL verificar que `temDivergencia` é falso e nenhum item vira `PENDENTE_SEGUNDA_CONFERENCIA`.
2. IF a quantidade conferida excede a quantidade da nota (excesso), THEN THE Suite_QA SHALL verificar que o item é marcado `DIVERGENTE` com `tipoDivergencia=EXCESSO` e vira `PENDENTE_SEGUNDA_CONFERENCIA`.
3. WHEN a quantidade conferida difere da nota mas dentro da Tolerancia_Quantidade aplicável, THE Suite_QA SHALL verificar que o item é aceito (`TOLERANCIA_ACEITA`) sem virar divergência.
4. WHERE `Empresa.permiteRecebimentoParcial` está ativa E a quantidade conferida é menor que a da nota (falta), THE Suite_QA SHALL verificar que o item é aceito como `RECEBIMENTO_PARCIAL` (saldo pendente registrado) sem virar divergência.
5. IF a quantidade não é informada ao conferir, THEN THE Suite_QA SHALL verificar que o item é `DIVERGENTE` com `tipoDivergencia=QUANTIDADE_NAO_INFORMADA`.

### Requirement 7: Conferência de entrada — lote, validade e shelf-life

**User Story:** Como QA, quero validar as regras de lote/validade e shelf-life, porque elas dependem do cadastro do produto e protegem a qualidade do estoque.

#### Acceptance Criteria

1. WHERE o Produto tem `exigeLote=true` E o lote não é informado na conferência, THE Suite_QA SHALL verificar que o item é `DIVERGENTE` com `tipoDivergencia=LOTE_NAO_INFORMADO`.
2. WHERE o Produto tem `exigeLote=true` E a validade não é informada, THE Suite_QA SHALL verificar que o item é `DIVERGENTE` com `tipoDivergencia=VALIDADE_NAO_INFORMADA`.
3. IF o lote conferido difere do lote da NF-e para produto que exige lote, THEN THE Suite_QA SHALL verificar que o item vira `PENDENTE_SEGUNDA_CONFERENCIA` com tipo contendo `LOTE_DIVERGENTE`.
4. WHERE o Produto tem `shelfLifeMinimo` definido E a validade conferida deixa menos dias que o mínimo, THE Suite_QA SHALL verificar que a conferência é bloqueada (HTTP 422, bloqueio `SHELF_LIFE`) com os dias restantes e a data mínima aceitável.
5. WHERE o Produto tem `shelfLifeMinimo` definido E a validade conferida atende o mínimo, THE Suite_QA SHALL verificar que a conferência do item não é bloqueada por shelf-life.

### Requirement 8: Segunda conferência, HOLD e confirmação da nota

**User Story:** Como QA, quero validar a segunda conferência obrigatória e os bloqueios de confirmação, porque uma nota não pode ser aprovada com pendências.

#### Acceptance Criteria

1. WHEN a segunda conferência de um item repete valores iguais aos da NF-e, THE Suite_QA SHALL verificar que o item é resolvido (`statusConferencia=CONFERIDO`).
2. IF a segunda conferência de quantidade diverge novamente e o operador não sinaliza aceite explícito, THEN THE Suite_QA SHALL verificar que o resultado é `divergenciaQuantidade` e o item permanece `PENDENTE_SEGUNDA_CONFERENCIA`.
3. WHEN um item é colocado em HOLD com motivo padronizado, THE Suite_QA SHALL verificar que `statusConferencia=HOLD` e o motivo é registrado.
4. IF uma nota tem item em `PENDENTE_SEGUNDA_CONFERENCIA`, THEN THE Suite_QA SHALL verificar que confirmar a nota é rejeitado com código `ITENS_PENDENTES_SEGUNDA_CONFERENCIA` (HTTP 422).
5. IF uma nota tem item em HOLD, THEN THE Suite_QA SHALL verificar que confirmar a nota é rejeitado com código `ITENS_EM_HOLD` (HTTP 422).
6. WHEN uma nota sem pendências é confirmada, THE Suite_QA SHALL verificar que o status passa a `CONFERIDA` e uma Ordem de Serviço de operação `ENDERECAMENTO` é criada.

### Requirement 9: Integração PCP → WMS (produção gera recebimento)

**User Story:** Como QA, quero validar que uma OP concluída gera o recebimento correto no WMS, porque a produção interna alimenta o estoque pelo mesmo fluxo de conferência.

#### Acceptance Criteria

1. WHEN a última etapa de uma OP é concluída E a integração automática está ativa (`pcp.integracaoWmsAutomatica` com `Empresa.usaWms`), THE Suite_QA SHALL verificar que uma Nota_Entrada `tipo=PRODUCAO`, `serie=PRD`, `status=PENDENTE` é criada.
2. THE Suite_QA SHALL verificar que a Nota_Entrada de produção pertence ao `empresaId` da OP (não ao do usuário que concluiu a etapa).
3. THE Suite_QA SHALL verificar que a quantidade da Nota_Entrada de produção é igual à quantidade produzida apontada (ou à quantidade planejada da OP quando a produzida é zero — comportamento atual do backend).
4. WHERE a flag `pcp.integracaoWmsAutomatica` está desativada, THE Suite_QA SHALL verificar que nenhuma Nota_Entrada `tipo=PRODUCAO` é criada ao concluir a OP.
5. WHEN a Nota_Entrada de produção existe, THE Suite_QA SHALL verificar que ela entra no fluxo de conferência do WMS (é listada entre as notas pendentes de conferência).

### Requirement 10: Rastreabilidade, limpeza e evidências

**User Story:** Como QA, quero que a suíte não polua o ambiente demo e produza evidências, porque ela roda em produção.

#### Acceptance Criteria

1. THE Suite_QA SHALL identificar todo Dado_De_Teste criado com um prefixo rastreável (`QA-`) vinculado ao `run_id` da execução.
2. WHEN um Caso_De_Teste termina, THE Suite_QA SHALL remover (ou reverter ao estado neutro) os dados que criou, registrando o resultado da limpeza.
3. WHEN um Caso_De_Teste falha, THE Suite_QA SHALL capturar uma Evidencia (screenshot) do estado da tela no momento da falha.
4. THE Suite_QA SHALL consolidar os resultados em um Relatorio_QA (HTML).
5. WHERE um pré-requisito de ambiente não pode ser atingido de forma determinística, THE Suite_QA SHALL registrar `skip` com motivo em vez de asserção falsa.

### Requirement 11: Endereçamento de pulmão (Motor RF008)

**User Story:** Como QA, quero validar o motor de put-away conforme a regra RF008 do consultor, porque o endereçamento correto é a base da acuracidade do estoque.

Referência de regra (backend): spec `enderecamento-pulmao-rf008` e documentos do consultor "Regras de Manutenção dos Estoques — Parte 1 (RF008)".

#### Acceptance Criteria

1. WHERE um produto tem `ambienteExigido` definido, THE Suite_QA SHALL verificar que a distribuição (`POST /enderecamento-inteligente/distribuir`) nunca aloca em endereço de ambiente incompatível (RF004). (Skip se não for possível cadastrar ambiente/endereço incompatível de forma determinística.)
2. WHEN há endereços livres em prédios diferentes na rua do picking, THE Suite_QA SHALL verificar que a ordem das alocações segue a Regra RF008 (prédios à direita antes dos à esquerda a partir do prédio de origem).
3. THE Suite_QA SHALL verificar que a soma alocada em cada endereço nunca excede sua capacidade residual (`lastro × camada − saldo atual`).
4. WHEN um endereçamento é confirmado, THE Suite_QA SHALL verificar que o `SaldoEndereco` criado pertence ao `empresaId` da nota (isolamento multi-tenant — correção #2/#7), consultando o saldo consolidado e confirmando que não aparece para outra empresa.
5. WHERE o armazém não comporta toda a quantidade, THE Suite_QA SHALL verificar o comportamento de put-away incompleto conforme a `wms.putaway.politicaIncompleto`: `BLOQUEAR` → confirmação rejeitada (HTTP 422, bloqueio `PUTAWAY_INCOMPLETO`); `PARCIAL` → confirma o possível e retorna `itensSemDestino` com a quantidade pendente.
6. IF o produto não tem SKU master (lastro/camada), THEN THE Suite_QA SHALL verificar que `POST /enderecamento-inteligente/distribuir` retorna HTTP 422 sem alocar.
