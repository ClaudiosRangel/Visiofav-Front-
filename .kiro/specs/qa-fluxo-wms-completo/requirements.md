# Requirements Document

## Introduction

Esta feature expande a suíte de QA automatizada existente (Python + Playwright em
`tests/e2e-qa`) para cobrir **todo o fluxo WMS de ponta a ponta**, elevando o nível de
validação do padrão atual ("a tela carrega e o formulário funciona") para um padrão de
**QA de negócio**: lançamentos reais persistidos, validação de valor esperado (assert em
números, saldos e cálculos), validação da lógica de negócio completa e validação da
confiabilidade dos dados apresentados na UI (o que a tela mostra bate com o backend e com
a regra de negócio).

O escopo cobre duas frentes:

1. **Fluxo WMS integrado ao Vizor** — recebimento (compra e produção via PCP), conferência,
   endereçamento/put-away, saldos (WMS vs ERP), reserva, separação/picking, ondas,
   conferência de saída, expedição, inventário, bloqueios, ressuprimento e cross-dock.
2. **Integração de ERPs externos com o WMS** — via API com API-Key
   (`wms-api-integracao`), eventos por webhook (`webhook-dispatcher`) e importação por
   arquivo (`file-importer`).

Requisitos transversais críticos: isolamento multi-tenant (por `empresaId`), reconciliação
de saldos (Físico / Reservado / Disponível), limpeza de dados de teste (a suíte não pode
poluir permanentemente o ambiente demo) e produção de evidências (screenshots + relatório).

A suíte roda contra o ambiente de produção Vercel (`https://visiofav-front-wofr.vercel.app`),
empresa "VisioFab Demo", e a API `https://api.vizorerp.com.br/api`. Como valida lançamentos
reais, cada teste deve criar seus próprios dados com identificador rastreável (prefixo `QA-`)
e limpá-los ao final.

## Glossary

- **Suite_QA**: A suíte de testes automatizados Python + Playwright localizada em
  `tests/e2e-qa`, incluindo os novos módulos criados por esta feature.
- **Caso_De_Teste**: Uma função de teste individual (`test_*`) que executa um cenário de
  negócio completo.
- **Fluxo_WMS_Vizor**: O conjunto de etapas do WMS operado dentro do Vizor: recebimento →
  conferência → endereçamento → saldo → reserva → separação → conferência de saída →
  expedição → inventário.
- **API_Cliente**: O componente da Suite_QA que faz chamadas HTTP autenticadas à API Vizor
  (`https://api.vizorerp.com.br/api`) para preparar dados, validar estado de backend e
  reconciliar valores.
- **Saldo_Fisico**: Quantidade física total de um produto em estoque.
- **Saldo_Reservado**: Soma de reservas de venda + reservas de produção (`ReservaProducao`
  ATIVA) de um produto.
- **Saldo_Disponivel**: `Saldo_Fisico − Saldo_Reservado`.
- **Endpoint_Saldo_Consolidado**: `GET /api/saldos/consolidado`, fonte oficial da visão
  consolidada de saldos por produto (origem WMS ou ERP).
- **Integracao_ERP_Externo**: O conjunto de rotas de integração externa autenticadas por
  API-Key (`/api/v1/integracao`, `wms-api-integracao`), webhooks (`/api/webhooks`) e
  importação por arquivo.
- **Api_Key**: Chave de integração validada pelo header `X-Api-Key` para autenticar um ERP
  externo, associada a uma empresa e a uma `ConfigIntegracao` ativa.
- **Dado_De_Teste**: Qualquer registro criado pela Suite_QA durante a execução, identificado
  por prefixo rastreável (`QA-`).
- **Evidencia**: Screenshot ou entrada de relatório gerada por um Caso_De_Teste para
  comprovar o resultado.
- **Relatorio_QA**: O relatório consolidado (HTML) gerado ao final da execução da Suite_QA.
- **Empresa_Isolada**: Uma empresa (tenant) cujo `empresaId` delimita a visibilidade dos
  dados; dados de uma empresa não devem aparecer para outra.

## Requirements

### Requirement 1: Fluxo de recebimento por compra com lançamento real e validação de valor

**User Story:** Como QA, quero que a suíte execute um recebimento de compra completo com
dados reais persistidos, para validar que a quantidade recebida e conferida se reflete
corretamente no saldo do WMS.

#### Acceptance Criteria

1. WHEN um Caso_De_Teste cria uma Nota Fiscal de Entrada de compra com quantidade definida, THE Suite_QA SHALL persistir a nota e recuperar seu identificador via API_Cliente.
2. WHEN a conferência de entrada de uma nota é concluída com quantidade conferida igual à quantidade da nota, THE Suite_QA SHALL verificar que o Saldo_Fisico do produto aumentou exatamente pela quantidade conferida.
3. THE Suite_QA SHALL verificar que o aumento de Saldo_Fisico resultante de uma conferência não excede a quantidade da Nota Fiscal de Entrada original.
4. WHEN o endereçamento (put-away) de uma nota conferida é concluído, THE Suite_QA SHALL verificar que a soma das quantidades nos endereços de destino é igual à quantidade endereçada.
5. IF a quantidade conferida difere da quantidade da nota, THEN THE Suite_QA SHALL verificar que o sistema registra a divergência com o valor da diferença.
6. THE Suite_QA SHALL registrar uma Evidencia da tela de saldo após o recebimento.

### Requirement 2: Recebimento por produção (integração PCP → WMS) com validação de quantidade

**User Story:** Como QA, quero validar que a conclusão de uma Ordem de Produção gera uma
entrada no WMS com a quantidade correta, para garantir a confiabilidade da integração
PCP → WMS.

#### Acceptance Criteria

1. WHEN a última etapa de uma Ordem de Produção é concluída com quantidade produzida maior que zero e a integração automática está ativa, THE Suite_QA SHALL verificar via API_Cliente que uma Nota Fiscal de Entrada do tipo PRODUCAO foi criada.
2. IF a quantidade produzida de uma Ordem de Produção concluída é zero, THEN THE Suite_QA SHALL verificar que nenhuma Nota Fiscal de Entrada do tipo PRODUCAO é criada.
3. THE Suite_QA SHALL verificar que a quantidade da Nota Fiscal de Entrada gerada é igual à quantidade efetivamente produzida da Ordem de Produção.
4. WHERE a flag de integração automática está desativada para a empresa, THE Suite_QA SHALL verificar que nenhuma Nota Fiscal de Entrada do tipo PRODUCAO é criada ao concluir a Ordem de Produção.
5. THE Suite_QA SHALL verificar que a Nota Fiscal de Entrada gerada pertence ao `empresaId` da Ordem de Produção.

### Requirement 3: Reconciliação de saldos (Físico, Reservado, Disponível)

**User Story:** Como QA, quero que a suíte valide a fórmula de saldos consolidados, para
garantir que os números apresentados ao usuário são confiáveis.

#### Acceptance Criteria

1. WHEN a Suite_QA consulta o Endpoint_Saldo_Consolidado para um produto, THE Suite_QA SHALL verificar que Saldo_Disponivel é igual a Saldo_Fisico menos Saldo_Reservado.
2. WHEN existe SaldoEndereco WMS maior que zero para um produto, THE Endpoint_Saldo_Consolidado SHALL reportar origem WMS com endereços detalhados mesmo quando o Saldo_Fisico consolidado é zero, e a Suite_QA SHALL verificar que a soma dos saldos por endereço é igual ao Saldo_Fisico.
3. IF não existe SaldoEndereco WMS para um produto com estoque global, THEN THE Endpoint_Saldo_Consolidado SHALL reportar origem ERP, e a Suite_QA SHALL verificar essa origem.
4. WHEN uma reserva de produção ATIVA é criada para um produto, THE Suite_QA SHALL verificar que o Saldo_Reservado do produto aumentou pela quantidade reservada e o Saldo_Disponivel diminuiu pela mesma quantidade.
5. THE Suite_QA SHALL verificar que o valor de saldo exibido na tela de Consulta de Saldos é igual ao valor retornado pelo Endpoint_Saldo_Consolidado.

### Requirement 4: Reserva e separação/picking com validação de lógica

**User Story:** Como QA, quero validar o ciclo de reserva e separação de mercadoria, para
garantir que o estoque disponível é abatido corretamente durante a saída.

#### Acceptance Criteria

1. WHEN uma reserva é criada para uma quantidade menor ou igual ao Saldo_Disponivel, THE Suite_QA SHALL verificar que a reserva é persistida com a quantidade solicitada.
2. IF uma reserva é solicitada para quantidade maior que o Saldo_Disponivel, THEN THE Suite_QA SHALL verificar que o sistema exibe uma mensagem de erro E rejeita a operação (ambos devem ocorrer).
3. WHEN uma separação (picking) é confirmada para uma quantidade reservada, THE Suite_QA SHALL verificar que o Saldo_Fisico do endereço de origem diminui pela quantidade separada.
4. THE Suite_QA SHALL verificar que a quantidade separada exibida na tela é igual à quantidade registrada no backend via API_Cliente, incluindo o caso em que ambas as quantidades são zero.

### Requirement 5: Ondas de separação, conferência de saída e expedição

**User Story:** Como QA, quero validar o fluxo de saída em onda até a expedição, para
garantir que os itens expedidos correspondem aos itens separados e conferidos.

#### Acceptance Criteria

1. WHEN uma onda de separação é gerada a partir de pedidos, THE Suite_QA SHALL verificar que a onda contém a soma dos itens dos pedidos incluídos.
2. WHEN a conferência de saída de uma onda é concluída sem divergência, THE Suite_QA SHALL verificar que a quantidade conferida é igual à quantidade separada.
3. IF a conferência de saída registra quantidade menor que a separada, THEN THE Suite_QA SHALL verificar que o sistema sinaliza a divergência com o valor faltante.
4. WHEN a expedição de uma carga conferida é confirmada, THE Suite_QA SHALL verificar que o Saldo_Fisico do produto diminui pela quantidade expedida.
5. THE Suite_QA SHALL registrar uma Evidencia de cada etapa concluída da onda.

### Requirement 6: Inventário cíclico com validação de ajuste

**User Story:** Como QA, quero validar o inventário cíclico, para garantir que a contagem
ajusta o saldo corretamente e registra a diferença.

#### Acceptance Criteria

1. WHEN uma contagem de inventário registra quantidade diferente do saldo do sistema, THE Suite_QA SHALL verificar que o ajuste aplicado é igual à diferença entre a contagem e o saldo anterior.
2. WHEN uma contagem de inventário confirma a mesma quantidade do saldo do sistema, THE Suite_QA SHALL verificar que nenhum ajuste de saldo é aplicado.
3. THE Suite_QA SHALL verificar que o saldo após o inventário é igual à quantidade contada.

### Requirement 7: Bloqueios de WMS

**User Story:** Como QA, quero validar bloqueios de estoque no WMS, para garantir que
mercadoria bloqueada não fica disponível para separação.

#### Acceptance Criteria

1. WHEN um saldo em um endereço é bloqueado, THE Suite_QA SHALL verificar que a quantidade bloqueada é subtraída do Saldo_Disponivel do produto.
2. IF uma separação é solicitada sobre um saldo bloqueado, THEN THE Suite_QA SHALL verificar que o sistema impede a operação.
3. WHEN um bloqueio é liberado, THE Suite_QA SHALL verificar que a quantidade retorna ao Saldo_Disponivel.

### Requirement 8: Ressuprimento e cross-dock

**User Story:** Como QA, quero validar ressuprimento e cross-dock, para garantir a
movimentação correta de mercadoria entre endereços.

#### Acceptance Criteria

1. WHEN um ressuprimento move quantidade de um endereço de reserva para um endereço de picking, THE Suite_QA SHALL verificar que o saldo do endereço de origem diminui e o do destino aumenta pela mesma quantidade.
2. THE Suite_QA SHALL verificar que o Saldo_Fisico total do produto permanece inalterado após um ressuprimento.
3. WHEN um item entra por cross-dock direcionado a uma saída, THE Suite_QA SHALL verificar que o item chega à expedição, admitindo saldo temporário em endereço durante o roteamento desde que nenhum saldo residual permaneça em endereço de armazenagem ao final.

### Requirement 9: Integração de ERP externo via API com API-Key

**User Story:** Como QA, quero validar a integração de ERPs externos via API-Key, para
garantir que o WMS aceita lançamentos externos autenticados e rejeita os não autenticados.

#### Acceptance Criteria

1. WHEN a API_Cliente envia uma requisição à Integracao_ERP_Externo com uma Api_Key válida, THE Suite_QA SHALL verificar que a requisição é aceita e o dado enviado é persistido no `empresaId` da Api_Key.
2. IF uma requisição à Integracao_ERP_Externo omite o header `X-Api-Key`, THEN THE Suite_QA SHALL verificar que a resposta tem status 401 com código `API_KEY_MISSING`.
3. IF uma requisição usa uma Api_Key inválida, revogada ou expirada, THEN THE Suite_QA SHALL verificar que a resposta tem status 401 com código `API_KEY_INVALID`, independentemente de quaisquer outras condições da requisição.
4. IF a empresa da Api_Key não tem integração ativa, THEN THE Suite_QA SHALL verificar que a resposta tem status 403.
5. WHEN um lançamento de entrada é recebido via Integracao_ERP_Externo, THE Suite_QA SHALL verificar que o Saldo_Fisico do produto reflete a quantidade lançada.

### Requirement 10: Eventos de webhook para ERP externo

**User Story:** Como QA, quero validar o disparo de webhooks, para garantir que eventos do
WMS são notificados a ERPs externos de forma confiável.

#### Acceptance Criteria

1. WHEN um evento do WMS coberto por um webhook configurado ocorre, THE Suite_QA SHALL verificar via API_Cliente que uma entrega de webhook é registrada para aquele evento, independentemente do sucesso ou falha da entrega HTTP imediata.
2. THE Suite_QA SHALL verificar que o payload da entrega de webhook contém o identificador do registro que originou o evento.
3. IF a entrega inicial de um webhook falha, THEN THE Suite_QA SHALL verificar que a entrega é marcada para retentativa.
4. THE Suite_QA SHALL verificar que webhooks e entregas são visíveis apenas para o `empresaId` que os configurou.

### Requirement 11: Importação de lançamentos por arquivo

**User Story:** Como QA, quero validar a importação de lançamentos por arquivo, para
garantir que ERPs sem API alimentam o WMS corretamente por arquivo.

#### Acceptance Criteria

1. WHEN um arquivo de lançamentos válido é importado, THE Suite_QA SHALL verificar que o número de registros persistidos é igual ao número de linhas válidas do arquivo.
2. IF um arquivo contém linhas inválidas, THEN THE Suite_QA SHALL verificar que o sistema reporta as linhas inválidas e persiste apenas as linhas válidas.
3. THE Suite_QA SHALL verificar que os saldos resultantes da importação são iguais à soma das quantidades das linhas válidas por produto, inclusive quando não há linhas válidas (soma igual a zero, saldo inalterado).

### Requirement 12: Isolamento multi-tenant

**User Story:** Como QA, quero validar o isolamento entre empresas, para garantir que dados
de uma empresa nunca aparecem para outra (classe de bug histórica do projeto).

#### Acceptance Criteria

1. WHEN a Suite_QA consulta saldos, endereços ou notas autenticada como uma Empresa_Isolada, THE Suite_QA SHALL verificar que apenas registros do `empresaId` dessa empresa são retornados.
2. WHEN um lançamento é criado via integração externa com uma Api_Key, THE Suite_QA SHALL verificar que o registro é gravado com o `empresaId` da Api_Key e não com o de outra empresa.
3. IF a Suite_QA tenta acessar um registro de outra empresa por identificador, THEN THE Suite_QA SHALL verificar que o sistema responde com ausência do registro (não encontrado).

### Requirement 13: Preparação e limpeza de dados de teste

**User Story:** Como QA, quero que a suíte prepare e limpe seus próprios dados, para que a
execução repetida não polua permanentemente o ambiente demo.

#### Acceptance Criteria

1. WHEN um Caso_De_Teste cria um Dado_De_Teste, THE Suite_QA SHALL identificar o registro com o prefixo `QA-`.
2. WHEN um Caso_De_Teste termina, THE Suite_QA SHALL remover ou reverter os Dado_De_Teste que criou.
3. IF a limpeza de um Dado_De_Teste falha, THEN THE Suite_QA SHALL registrar o identificador do registro não removido no Relatorio_QA e continuar a execução dos demais Caso_De_Teste.
4. WHERE um pré-requisito de dados necessário não existe no ambiente, THE Caso_De_Teste SHALL criar o pré-requisito antes de executar a validação de valor.

### Requirement 14: Evidências e relatório

**User Story:** Como QA, quero evidências e um relatório consolidado, para comprovar o que
foi validado e diagnosticar falhas.

#### Acceptance Criteria

1. WHEN um Caso_De_Teste conclui uma etapa relevante do Fluxo_WMS_Vizor, THE Suite_QA SHALL salvar uma Evidencia com nome descritivo e horário.
2. IF um Caso_De_Teste falha, THEN THE Suite_QA SHALL salvar uma Evidencia da tela no momento da falha.
3. WHEN a execução da Suite_QA termina, THE Suite_QA SHALL gerar um Relatorio_QA consolidado com o resultado de cada Caso_De_Teste.
4. IF a gravação de uma Evidencia falha, THEN THE Suite_QA SHALL continuar a execução do Caso_De_Teste e reportar a falha de evidência separadamente no Relatorio_QA.

### Requirement 15: Reutilização do padrão da suíte existente

**User Story:** Como QA, quero que os novos testes sigam o padrão da suíte existente, para
manter a manutenção simples e consistente.

#### Acceptance Criteria

1. THE Suite_QA SHALL reutilizar as fixtures de autenticação e seleção de empresa definidas em `conftest.py`.
2. THE Suite_QA SHALL reutilizar os helpers de preenchimento de campos Mantine e de espera definidos em `helpers.py`.
3. WHERE um componente Mantine Select precisa ser preenchido, THE Caso_De_Teste SHALL usar o padrão de navegação por teclado (ArrowDown + Enter) definido na convenção da suíte, em todos os modos de execução (headless e visual).
4. THE Suite_QA SHALL permitir execução em modo visual por variáveis de ambiente (`HEADLESS`, `SLOW_MO`).
