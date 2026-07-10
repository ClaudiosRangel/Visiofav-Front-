# Requirements Document

## Introduction

Este documento especifica o frontend (Next.js 15 App Router + Mantine 7 + @tanstack/react-query + Axios) para as cinco melhorias de Compras, WMS e Fiscal cujo backend (`VisioFab.Wms.Back`, spec `melhorias-compras-wms-fiscal`) já está implementado e em produção, mas que ainda não possuem nenhuma tela consumindo os endpoints/campos correspondentes:

1. **Transporte via XML na Agenda/Portaria WMS** — exibição dos dados de transporte (placa, UF, RNTC, motorista) extraídos do XML da NFe de compra, e alerta visual quando há divergência de transporte registrada.
2. **Código sequencial de Produto e enriquecimento de SKU via GTIN** — exibição do código sequencial gerado automaticamente, do motivo de falha de enriquecimento de SKU quando presente, e tratamento de itens de XML pendentes por esgotamento da faixa de códigos.
3. **Seed Fiscal (NCM/CFOP/CEST)** — tela administrativa em Configurações para popular os cadastros fiscais globais a partir de uma fonte externa.
4. **Kardex de estoque e saldo** — tela de consulta do histórico de movimentações de estoque e saldo atual por produto, relevante para empresas que não utilizam o módulo WMS.
5. **Liberação de conferência por senha de Supervisor** — ajuste no fluxo existente de "Autorizar Entrada" da tela de Portaria, para solicitar credenciais de Supervisor quando a API exigir.

As cinco funcionalidades são independentes entre si e tratadas como requisitos separados. Este documento não cobre nenhuma alteração no backend, nem a tela de seleção de empresa (tratada em spec separado).

## Glossary

- **Frontend**: A aplicação `VisioFab.Wms.Front` (Next.js 15 App Router) como um todo.
- **API**: O backend `VisioFab.Wms.Back` já implementado, consumido pelo Frontend através da instância Axios em `src/lib/api.ts`.
- **Tela_Seed_Fiscal**: Página em Configurações que exibe a contagem de registros das tabelas NCM, CFOP e CEST e permite disparar o seed fiscal.
- **Cadastro_Fiscal**: Cada uma das três tabelas globais NCM, CFOP e CEST alvo do seed fiscal.
- **Usuario_Admin**: Usuário autenticado cujo perfil (decodificado do token JWT) é `ADMIN`, `SUPER_ADMIN` ou outro perfil já tratado como administrativo pelo Frontend.
- **Tela_Kardex**: Página de consulta do histórico de movimentações de estoque (Kardex) e saldo atual de um Produto.
- **Movimentacao_Estoque**: Registro individual do histórico de Kardex retornado pela API, com campos `tipo`, `quantidade`, `saldoAnterior`, `saldoPosterior`, `origemId` e `criadoEm`.
- **Empresa_Sem_WMS**: Empresa cujo campo `usaWms` (retornado pela API em `GET /empresas/minha`) é `false`.
- **Tela_Portaria**: Página existente em `/wms/portaria` (`src/app/(interna)/wms/portaria/page.tsx`) que lista agendamentos e permite autorizar a entrada de veículos na doca.
- **Modal_Credenciais_Supervisor**: Modal exibido pela Tela_Portaria para coletar usuário e senha de Supervisor quando exigido pela API.
- **Fluxo_Autorizar_Entrada**: Conjunto de ações da Tela_Portaria acionadas ao clicar em "Autorizar Entrada" para um agendamento, incluindo a chamada a `POST /portaria/autorizar-entrada/:id` e o tratamento de suas respostas.
- **AgendaWms**: Registro de agendamento de recebimento retornado pela API (`GET /agenda-wms`, `GET /portaria/agendamentos-hoje`), contendo os campos `placa`, `motorista`, `tipoVeiculo` e `divergenciaTransporte`.
- **Divergencia_Transporte**: Texto (até 500 caracteres) presente no campo `divergenciaTransporte` de um AgendaWms quando a placa extraída do XML da NFe difere da placa já preenchida manualmente.
- **Tela_Agenda_WMS**: Página existente em `/wms/agenda` (`src/app/(interna)/wms/agenda/page.tsx`) que lista agendamentos de recebimento por doca.
- **Nota_Entrada**: Registro retornado pela API (`GET /notas-entrada/:id`) representando a nota fiscal de entrada, contendo os campos `transportadoraUf` e `transportadoraRntc` extraídos do XML da NFe.
- **Tela_Nota_Entrada**: Modal/página existente de detalhe de Nota_Entrada (`src/app/(interna)/recebimento/NotaDetalheModal.tsx`).
- **Produto**: Registro retornado pela API (`GET /produtos/:id`), contendo os campos `codigo` (código sequencial gerado automaticamente pelo Sistema quando o Produto é criado via importação de XML) e `motivoFalhaEnriquecimentoSku`.
- **Tela_Produto**: Modal existente de cadastro/edição de Produto (`src/app/(interna)/configurador/produtos/ProdutoModal.tsx`).
- **Motivo_Falha_Enriquecimento_Sku**: Texto presente no campo `motivoFalhaEnriquecimentoSku` de um Produto quando a busca externa por GTIN/EAN falhou, expirou ou não retornou dados de catálogo.
- **Tela_Importar_XML**: Página existente de importação de XML de compra (`src/app/(interna)/compras/importar-xml/page.tsx`).
- **Item_Pendente_XML**: Item do XML de NFe de compra que não pôde ser resolvido como Produto durante a importação por esgotamento da faixa de códigos sequenciais, retornado pela API no campo `itensPendentes` da resposta de `POST /compras/importar-xml`, contendo `cProd`, `xProd` e `motivo`.

## Requirements

### Requirement 1: Exibição dos dados de transporte extraídos do XML e alerta de divergência na Agenda/Portaria WMS

**User Story:** Como operador de recebimento, eu quero ver os dados de transporte extraídos do XML da NFe diretamente na Agenda/Portaria WMS, e ser alertado quando houver divergência entre a placa do XML e a placa já preenchida manualmente, para que eu possa confirmar ou investigar a informação antes de liberar o veículo.

#### Acceptance Criteria

1. THE Tela_Portaria SHALL exibir, para cada AgendaWms listado, os campos `motorista` e `placa` já retornados pela API `GET /portaria/agendamentos-hoje`, sem alteração no formato de exibição já existente.
2. THE Tela_Agenda_WMS SHALL exibir, para cada AgendaWms listado, os campos `motorista` e `placa` já retornados pela API `GET /agenda-wms`, sem alteração no formato de exibição já existente.
3. WHEN um AgendaWms retornado pela API possui o campo `divergenciaTransporte` preenchido (não nulo e não vazio), THE Tela_Portaria SHALL exibir um indicador visual de alerta (por exemplo, ícone e/ou cor de destaque) associado àquele AgendaWms, distinto da exibição de agendamentos sem divergência.
4. WHEN um AgendaWms retornado pela API possui o campo `divergenciaTransporte` preenchido, THE Tela_Agenda_WMS SHALL exibir o mesmo indicador visual de alerta descrito no critério 3.
5. WHEN o operador aciona a exibição do indicador de alerta (por exemplo, tooltip ou clique no ícone), THE Tela_Portaria e a Tela_Agenda_WMS SHALL exibir o conteúdo textual completo de `divergenciaTransporte` para aquele AgendaWms.
6. IF o campo `divergenciaTransporte` de um AgendaWms for nulo ou vazio, THEN THE Tela_Portaria e a Tela_Agenda_WMS SHALL exibir aquele AgendaWms sem nenhum indicador visual de alerta de divergência, e o indicador visual de alerta SHALL ser determinado exclusivamente pela presença de conteúdo não vazio nesse campo retornado pela API, sem depender de nenhum estado local de UI (por exemplo, cache desatualizado ou re-renderização parcial) que possa exibi-lo de forma inconsistente com o valor atual do campo.
7. THE Tela_Nota_Entrada SHALL exibir os campos `transportadoraUf` e `transportadoraRntc` da Nota_Entrada retornada por `GET /notas-entrada/:id`, quando presentes, próximos aos demais dados de transporte já exibidos (campo `transportadora`).
8. IF os campos `transportadoraUf` ou `transportadoraRntc` de uma Nota_Entrada forem nulos, THEN THE Tela_Nota_Entrada SHALL omitir a exibição do respectivo campo, sem exibir texto de erro ou espaço em branco visualmente destacado.

---

### Requirement 2: Exibição do código sequencial de Produto e do motivo de falha de enriquecimento de SKU

**User Story:** Como gestor de cadastro de produtos, eu quero visualizar o código sequencial gerado automaticamente pelo Sistema e entender por que o SKU de um produto não foi enriquecido automaticamente, para que eu não confunda esse código com o código do fornecedor e possa completar manualmente os dados de SKU quando necessário.

#### Acceptance Criteria

1. THE Tela_Produto SHALL exibir o campo `codigo` do Produto (retornado por `GET /produtos/:id`) como código interno gerado pelo Sistema, mantendo o rótulo "Código" já existente, sem alterações no comportamento de edição já existente para produtos criados manualmente.
2. WHEN um Produto é exibido na Tela_Produto e possui o campo `motivoFalhaEnriquecimentoSku` preenchido (não nulo e não vazio), THE Tela_Produto SHALL exibir esse motivo em um alerta informativo na área de cabeçalho do modal, visível imediatamente ao abrir a Tela_Produto e independentemente da aba selecionada, indicando que o SKU não foi enriquecido automaticamente e que os dados logísticos podem precisar de preenchimento manual.
3. IF o campo `motivoFalhaEnriquecimentoSku` de um Produto for nulo ou vazio, THEN THE Tela_Produto SHALL exibir esse Produto sem nenhum alerta relacionado a enriquecimento de SKU.
4. THE Tela_Produto SHALL manter o alerta descrito no critério 2 visível ao alternar entre as abas existentes (Dados Gerais, Fiscal, Estoque/Lotes), sem exigir nenhuma nova aba.
5. THE Tela_Produto SHALL exibir o alerta descrito no critério 2 sempre que o Produto for reaberto (inclusive após o usuário navegar para fora da Tela_Produto e reabri-la novamente), enquanto o campo `motivoFalhaEnriquecimentoSku` retornado pela API permanecer preenchido.

---

### Requirement 3: Tratamento de itens de XML pendentes por esgotamento de código sequencial

**User Story:** Como operador de compras, eu quero ser avisado quando um item do XML importado não pôde ser resolvido por esgotamento da faixa de códigos sequenciais, para que eu saiba que aquele item precisa de resolução manual e não foi silenciosamente ignorado.

#### Acceptance Criteria

1. WHEN a resposta de `POST /compras/importar-xml` contém um array `itensPendentes` não vazio, THE Tela_Importar_XML SHALL exibir, na etapa de resultado da importação, uma lista com o `cProd`, `xProd` e `motivo` de cada Item_Pendente_XML retornado.
2. WHEN a resposta de `POST /compras/importar-xml` contém um array `itensPendentes` vazio ou ausente, THE Tela_Importar_XML SHALL exibir a etapa de resultado da importação sem nenhuma seção de itens pendentes.
3. THE Tela_Importar_XML SHALL exibir a lista de Item_Pendente_XML descrita no critério 1 de forma visualmente distinta (por exemplo, alerta de atenção) da confirmação de sucesso da importação, sem impedir a exibição dos demais dados do resultado (pedido criado, valor total).
4. THE Tela_Importar_XML SHALL informar, junto à lista de Item_Pendente_XML, que os itens listados não foram incluídos no pedido de compra criado e necessitam de resolução manual.

---

### Requirement 4: Tela de Seed Fiscal em Configurações — contagem e exibição dos Cadastros_Fiscais

**User Story:** Como Usuario_Admin, eu quero ver quantos registros ativos já existem em NCM, CFOP e CEST antes de decidir disparar o seed, para que eu saiba quais cadastros ainda precisam ser populados.

#### Acceptance Criteria

1. WHEN o Usuario_Admin navega até a Tela_Seed_Fiscal, THE Tela_Seed_Fiscal SHALL buscar a contagem de registros ativos em `GET /api/fiscal/cadastros/seed/contagem` e exibir a quantidade retornada para NCM, CFOP e CEST separadamente.
2. WHILE a contagem está sendo carregada, THE Tela_Seed_Fiscal SHALL exibir um indicador de carregamento nos cartões/campos de contagem.
3. IF a chamada a `GET /api/fiscal/cadastros/seed/contagem` retornar erro, THEN, somente após o indicador de carregamento do critério 2 ser removido, THE Tela_Seed_Fiscal SHALL exibir uma notificação de erro com a mensagem retornada pela API e exibir um estado vazio (contagem indisponível) nos campos correspondentes, sem exibir nenhuma contagem parcial ou valor obtido em consulta anterior.
4. THE Tela_Seed_Fiscal SHALL exibir três checkboxes independentes, um para cada Cadastro_Fiscal (NCM, CFOP, CEST), permitindo qualquer combinação de seleção antes do disparo do seed.

---

### Requirement 5: Disparo do Seed Fiscal e feedback por tabela

**User Story:** Como Usuario_Admin, eu quero selecionar quais Cadastros_Fiscais popular e disparar o seed, recebendo o resultado individual de cada tabela, para que eu saiba exatamente o que foi inserido ou o que falhou.

#### Acceptance Criteria

1. WHEN o Usuario_Admin não seleciona nenhum checkbox de Cadastro_Fiscal, THE Tela_Seed_Fiscal SHALL manter o botão de disparo do seed desabilitado.
2. WHEN o Usuario_Admin seleciona ao menos um Cadastro_Fiscal e clica no botão de disparo, THE Tela_Seed_Fiscal SHALL enviar `POST /api/fiscal/cadastros/seed` com `{ tabelas: [...] }` contendo exatamente os Cadastros_Fiscais selecionados.
3. WHILE a requisição de disparo do seed está pendente, THE Tela_Seed_Fiscal SHALL desabilitar completamente o botão de disparo (impedindo novos cliques) e exibir nele um estado de carregamento, informando ao Usuario_Admin que o processamento pode levar até 60 segundos por tabela selecionada.
4. WHEN a resposta de `POST /api/fiscal/cadastros/seed` retornar, para uma tabela selecionada, o formato `{ inseridos, ignorados }`, THE Tela_Seed_Fiscal SHALL exibir para aquela tabela uma notificação/indicação de sucesso contendo a quantidade de registros inseridos e a quantidade de registros ignorados.
5. WHEN a resposta de `POST /api/fiscal/cadastros/seed` retornar, para uma tabela selecionada, o formato `{ erro: { code, message } }`, THE Tela_Seed_Fiscal SHALL exibir para aquela tabela uma indicação de falha contendo a mensagem de erro retornada, sem afetar a exibição do resultado das demais tabelas selecionadas na mesma requisição.
6. WHEN o disparo do seed é concluído com sucesso, independentemente da quantidade de tabelas retornadas na resposta, THE Tela_Seed_Fiscal SHALL limpar qualquer notificação de erro de contagem exibida anteriormente e atualizar a contagem exibida (Requirement 4.1) refazendo a busca em `GET /api/fiscal/cadastros/seed/contagem`.
7. IF a API retornar status 403 para `GET /api/fiscal/cadastros/seed/contagem` ou `POST /api/fiscal/cadastros/seed`, THEN THE Tela_Seed_Fiscal SHALL exibir uma notificação de acesso negado, sem exibir contagens parciais nem resultados de seed.

---

### Requirement 6: Restrição de acesso à Tela de Seed Fiscal

**User Story:** Como administrador do sistema, eu quero que apenas usuários ADMIN vejam e acessem a Tela de Seed Fiscal, para evitar tentativas de uso por perfis sem permissão.

#### Acceptance Criteria

1. WHEN um usuário autenticado sem perfil administrativo navega até a rota da Tela_Seed_Fiscal, THE Frontend SHALL bloquear o acesso e redirecionar o usuário, seguindo o mesmo padrão já utilizado pelo hook `usePerfilGuard` em outras páginas administrativas do Frontend.
2. IF o mecanismo de bloqueio de acesso descrito no critério 1 falhar (por exemplo, erro ao decodificar o token ou ao determinar o perfil do usuário), THEN THE Frontend SHALL manter o usuário na página atual sem efetuar o redirecionamento e SHALL exibir uma notificação de erro informando que não foi possível verificar a permissão de acesso.
3. THE Frontend SHALL exibir a entrada de navegação para a Tela_Seed_Fiscal, dentro do menu de Configurações, apenas para Usuario_Admin.

---

### Requirement 7: Tela de Kardex — consulta de histórico de movimentações por produto

**User Story:** Como gestor de estoque de uma Empresa_Sem_WMS, eu quero consultar o histórico cronológico de movimentações de um produto, para acompanhar entradas, saídas e ajustes de estoque sem depender do WMS.

#### Acceptance Criteria

1. WHEN o usuário seleciona um produto na Tela_Kardex, THE Tela_Kardex SHALL buscar o histórico de movimentações em `GET /api/estoque/kardex/:produtoId` e exibi-lo em uma lista ordenada da Movimentacao_Estoque mais recente para a mais antiga, refletindo a ordenação já retornada pela API.
2. THE Tela_Kardex SHALL exibir, para cada Movimentacao_Estoque, o tipo traduzido para pt-BR conforme a tabela: ENTRADA_COMPRA → "Entrada por Compra", SAIDA_VENDA → "Saída por Venda", AJUSTE_MANUAL → "Ajuste Manual", ENTRADA_ESTORNO_VENDA → "Entrada por Estorno de Venda", SAIDA_ESTORNO_COMPRA → "Saída por Estorno de Compra", além da quantidade, saldo anterior, saldo posterior e data/hora formatada em pt-BR.
3. THE Tela_Kardex SHALL fornecer campos de filtro opcionais de data inicial e data final, enviando-os como `dataInicio`/`dataFim` na query de `GET /api/estoque/kardex/:produtoId` somente quando preenchidos pelo usuário.
4. WHEN o usuário altera o filtro de data inicial ou final e confirma o filtro, THE Tela_Kardex SHALL refazer a busca do histórico com os novos parâmetros e atualizar a lista exibida.
5. WHEN a chamada a `GET /api/estoque/kardex/:produtoId` retornar com sucesso uma lista vazia de Movimentacao_Estoque, THE Tela_Kardex SHALL exibir uma mensagem de estado vazio indicando que não há movimentações para o produto e o período selecionados, distinta da mensagem descrita no critério 6, exibida somente enquanto nenhuma condição de erro (critério 6) estiver ativa para a mesma consulta.
6. IF a chamada a `GET /api/estoque/kardex/:produtoId` retornar erro, THEN THE Tela_Kardex SHALL exibir uma notificação de erro com a mensagem retornada pela API e SHALL exibir, no lugar da lista — mesmo que dados parciais tenham sido recebidos antes da falha —, uma mensagem de estado de falha ao carregar o histórico, visualmente distinta da mensagem de "nenhuma movimentação encontrada" do critério 5, de modo que o usuário saiba diferenciar ausência definitiva de dados de uma falha ao carregar.

---

### Requirement 8: Tela de Kardex — saldo atual do produto

**User Story:** Como gestor de estoque, eu quero ver o saldo atual de um produto junto ao seu histórico, para saber rapidamente a quantidade disponível e reservada.

#### Acceptance Criteria

1. WHEN o usuário seleciona um produto na Tela_Kardex, THE Tela_Kardex SHALL buscar o saldo atual em `GET /api/estoque/saldo/:produtoId` e exibir a quantidade e a quantidade reservada retornadas.
2. WHEN uma nova Movimentacao_Estoque é registrada pela API entre uma consulta e outra do mesmo produto, THE Tela_Kardex SHALL refletir o saldo atualizado ao refazer a busca de saldo (por exemplo, ao selecionar novamente o produto ou atualizar a tela).
3. IF a chamada a `GET /api/estoque/saldo/:produtoId` retornar erro, THEN THE Tela_Kardex SHALL exibir uma notificação de erro com a mensagem retornada pela API, e, IF a exibição dessa notificação falhar por qualquer motivo, THEN THE Tela_Kardex SHALL registrar o erro no console do navegador como mecanismo de fallback, em ambos os casos sem interromper a exibição do histórico de movimentações já carregado.

---

### Requirement 9: Visibilidade da Tela de Kardex conforme uso de WMS pela empresa

**User Story:** Como usuário de uma empresa que utiliza o módulo WMS, eu não quero ver uma tela de Kardex vazia e sem sentido para o meu contexto, já que o WMS já controla o estoque por outros meios.

#### Acceptance Criteria

1. WHERE a Empresa autenticada não é uma Empresa_Sem_WMS (ou seja, `usaWms` é verdadeiro), THE Frontend SHALL ocultar a entrada de navegação para a Tela_Kardex no menu correspondente.
2. WHERE a Empresa autenticada é uma Empresa_Sem_WMS, THE Frontend SHALL exibir a entrada de navegação para a Tela_Kardex no menu correspondente.
3. IF um usuário de uma empresa que não é Empresa_Sem_WMS acessar diretamente a rota da Tela_Kardex pela URL, THEN THE Tela_Kardex SHALL redirecionar o usuário para fora da página, exibindo uma notificação informando que a funcionalidade é destinada a empresas sem WMS, exceto quando o usuário tiver previamente optado por não ver esse aviso novamente (critério 4).
4. THE Tela_Kardex SHALL oferecer ao usuário a opção de dispensar permanentemente o aviso/redirecionamento descrito no critério 3, persistindo essa preferência localmente no navegador; WHEN essa preferência estiver registrada, THE Tela_Kardex SHALL permitir a renderização normal da página para usuários de empresas que não são Empresa_Sem_WMS, sem exibir o aviso nem redirecionar; a renderização normal para esses usuários SHALL ocorrer somente nessa condição (preferência de dispensa registrada), independentemente de a navegação até a Tela_Kardex ter ocorrido por link de menu ou por URL direta.

---

### Requirement 10: Fluxo de Autorizar Entrada — exigência de credenciais de Supervisor

**User Story:** Como operador de portaria, eu quero ser solicitado a informar usuário e senha de um Supervisor quando o sistema exigir, sem precisar entender a regra de negócio por trás da exigência, para conseguir liberar a entrada do veículo mesmo sem nota fiscal ainda vinculada.

#### Acceptance Criteria

1. WHEN o operador de portaria clica em "Autorizar Entrada" para um agendamento na Tela_Portaria, THE Fluxo_Autorizar_Entrada SHALL enviar `POST /portaria/autorizar-entrada/:id` sem `usuario`/`senha` no corpo da requisição, na primeira tentativa.
2. IF a resposta de `POST /portaria/autorizar-entrada/:id` tiver status 422, THEN THE Fluxo_Autorizar_Entrada SHALL abrir o Modal_Credenciais_Supervisor E exibir, dentro do modal, a mensagem retornada pela API como contexto para o operador — ambas as condições SHALL ser verificáveis; o Modal_Credenciais_Supervisor SHALL ser aberto somente quando o status da resposta for exatamente 422, e não para nenhum outro status.
3. WHEN o operador confirma o Modal_Credenciais_Supervisor, THE Fluxo_Autorizar_Entrada SHALL reenviar `POST /portaria/autorizar-entrada/:id` para o mesmo agendamento, incluindo `{ usuario, senha }` no corpo da requisição com os valores atuais dos campos do modal no momento da confirmação, sem exigir rastreamento adicional de preenchimento além da própria confirmação.
4. IF a resposta ao reenvio com credenciais tiver status 401, THEN THE Modal_Credenciais_Supervisor SHALL permanecer aberto, exibir uma mensagem de erro genérica (sem indicar qual campo está incorreto) e permitir que o operador tente novamente informando novas credenciais.
5. WHEN a resposta de `POST /portaria/autorizar-entrada/:id` (com ou sem credenciais) tiver status de sucesso, THE Fluxo_Autorizar_Entrada SHALL fechar o Modal_Credenciais_Supervisor (se aberto), atualizar a lista de agendamentos e exibir a notificação de sucesso já existente ("✅ Entrada autorizada").
6. WHILE a requisição de autorização (inicial ou reenvio com credenciais) está pendente, THE Fluxo_Autorizar_Entrada SHALL exibir um estado de carregamento no controle que originou a chamada (botão/ícone de autorizar entrada, ou botão de confirmação do Modal_Credenciais_Supervisor).
7. WHEN o operador fecha o Modal_Credenciais_Supervisor sem confirmar (cancelar), THE Fluxo_Autorizar_Entrada SHALL manter o agendamento no status anterior, sem reenviar a requisição de autorização.
8. THE Modal_Credenciais_Supervisor SHALL manter os campos de usuário e senha vazios ao ser reaberto para uma nova tentativa de autorização de qualquer agendamento.

---

### Requirement 11: Tratamento de outros erros no Fluxo_Autorizar_Entrada

**User Story:** Como operador de portaria, eu quero que erros não relacionados à exigência de credenciais continuem sendo tratados como hoje, para que o comportamento existente da tela não seja afetado pela nova exigência de senha.

#### Acceptance Criteria

1. IF a resposta de `POST /portaria/autorizar-entrada/:id` tiver um status de erro diferente de 422 e 401 (por exemplo, 404 ou 500), THEN THE Fluxo_Autorizar_Entrada SHALL exibir a notificação de erro já existente na Tela_Portaria com a mensagem retornada pela API, E SHALL impedir a abertura do Modal_Credenciais_Supervisor nesse caso — a notificação de erro e a abertura do modal nunca SHALL ocorrer simultaneamente para a mesma resposta.
2. THE Fluxo_Autorizar_Entrada SHALL disparar a partir de ambos os pontos de acionamento já existentes na Tela_Portaria (ação rápida na tabela de agendamentos e botão "Autorizar Entrada" no resultado de busca por placa), aplicando o mesmo tratamento de 422/401 descrito no Requirement 10 em ambos os casos.
