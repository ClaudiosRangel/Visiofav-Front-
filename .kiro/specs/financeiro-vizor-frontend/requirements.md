# Requirements Document

## Introduction

Este documento especifica os requisitos do **frontend** do painel administrativo
do **Financeiro Vizor** — o controle de cobrança recorrente das empresas
clientes do Vizor ERP (billing do SaaS). O painel é **exclusivo do perfil
SUPER_ADMIN** (o dono do Vizor) e consome a API REST já especificada no backend
(`VisioFab.Wms.Back`), sob o prefixo `/api/financeiro-vizor`.

Este spec cobre **apenas o frontend**: as telas, os fluxos de interação, a
validação no cliente (espelhando a do backend), o controle de visibilidade e
acesso por perfil, e o tratamento amigável das respostas de erro da API. Toda
a regra de negócio (cálculo de total, dias em atraso, ciclo de inadimplência,
guard de somente-leitura) já está implementada e especificada no backend — o
frontend apenas apresenta os dados e aciona os endpoints, refletindo o estado
retornado.

O frontend é construído com **Next.js 15 (App Router)**, **Mantine 7**,
**@tanstack/react-query**, **Axios** e **TypeScript**, seguindo os padrões
consolidados do projeto (mesmo padrão das telas do Portal do Representante
Admin).

Decisões de escopo e padrão adotadas (registradas para rastreabilidade):

- O painel é acessível apenas ao SUPER_ADMIN. O item de menu é ocultado para
  os demais perfis e a rota é protegida por guard no cliente
  (`usePerfilGuard`), redirecionando quem não tem permissão. — Req 1
- O perfil do usuário é lido do token JWT via `getUserPerfil()`
  (`@/hooks/usePerfilGuard`), que decodifica o token obtido de `authStorage`
  (sessionStorage por aba, nunca `localStorage` direto). — Req 1
- A base da API é lida de `NEXT_PUBLIC_API_URL` (produção
  `https://api.vizorerp.com.br/api`), via a instância Axios já configurada
  do projeto. — Req 8
- A reativação após bloqueio é sempre manual pelo SUPER_ADMIN; dar baixa em
  fatura NÃO reativa a empresa automaticamente. — Req 4, Req 5
- Para campos "selecionar da lista OU digitar livre" usa-se `TagsInput`
  (Mantine 7), pois `MultiSelect` não tem mais `creatable`. — Req 7
- Fundos de áreas com texto/botões usam tokens de tema `*-light`/`*-filled`,
  nunca cores claras fixas (`-0`), para manter contraste no tema escuro. — Req 7
- Os seis módulos cobráveis são fixos: `COMPRAS`, `VENDAS`, `FINANCEIRO`,
  `FISCAL`, `WMS`, `PCP`. — Req 3
- O aviso ao cliente de empresa bloqueada (banner de somente-visualização em
  `SOMENTE_LEITURA` e tela de acesso impedido em `INATIVADO`) trata as
  respostas HTTP 403 do backend de forma amigável. — Req 6, Req 8

## Glossary

- **Financeiro_Vizor_Frontend**: Painel administrativo (frontend) de cobrança
  das empresas clientes do Vizor. Exclusivo do SUPER_ADMIN. Consome a API sob
  `/api/financeiro-vizor`.
- **SUPER_ADMIN**: Perfil do dono do Vizor, único autorizado a acessar o
  Financeiro_Vizor_Frontend.
- **Perfil_Usuario**: Papel do usuário autenticado, lido do token JWT via
  `getUserPerfil()`. Valores relevantes: `SUPER_ADMIN` e demais perfis
  (`ADMIN`, `SUPERVISOR`, `OPERADOR`, etc.).
- **Empresa**: Empresa cliente do Vizor exibida e gerenciada no painel.
- **Status_Financeiro**: Estado de cobrança da empresa, retornado pela API com
  exatamente um dos valores `ATIVO`, `SOMENTE_LEITURA` ou `INATIVADO`.
- **Modulo_Cobravel**: Módulo do ERP cobrado por empresa. Conjunto fixo:
  `COMPRAS`, `VENDAS`, `FINANCEIRO`, `FISCAL`, `WMS`, `PCP`.
- **Preco_Modulo**: Valor mensal de um Modulo_Cobravel para uma empresa.
- **Total_Mensal**: Soma dos Preco_Modulo da empresa, retornada pela API.
- **Total_Vencido**: Valor total vencido em aberto da empresa, retornado pela API.
- **Contrato**: Configuração de cobrança da empresa: data do contrato, dia de
  vencimento e preço de cada Modulo_Cobravel.
- **Dia_Vencimento**: Dia do mês (inteiro de 1 a 31) em que as faturas vencem.
- **Data_Contrato**: Data de início do contrato; não pode ser futura.
- **Fatura**: Vencimento mensal da empresa, com competência, data de vencimento,
  valor, status (`PENDENTE`, `VENCIDA`, `PAGA`, `CANCELADA`) e data de pagamento.
- **Competencia**: Mês/ano de referência de uma Fatura (formato `YYYY-MM`).
- **Baixa**: Ação de marcar uma Fatura como paga, via endpoint de baixa.
- **Cancelamento**: Ação de marcar uma Fatura como cancelada, via endpoint de
  cancelamento.
- **Geracao_Vencimentos**: Ação de gerar N faturas mensais em lote.
- **Reativacao**: Ação manual de voltar a empresa ao status `ATIVO`.
- **Inativacao**: Ação manual de mudar a empresa para o status `INATIVADO`.
- **Banner_Somente_Visualizacao**: Aviso exibido ao usuário de uma empresa em
  `SOMENTE_LEITURA` informando o modo somente-visualização por pendência
  financeira.
- **Aviso_Acesso_Impedido**: Aviso/tela exibido ao usuário de uma empresa em
  `INATIVADO` informando que o acesso aos módulos está impedido.
- **API_Base**: URL base da API, lida de `NEXT_PUBLIC_API_URL`.
- **Endpoint_Financeiro**: Qualquer endpoint da API sob o prefixo
  `/api/financeiro-vizor` consumido pelo painel.

## Requirements

### Requirement 1: Acesso exclusivo ao painel Financeiro Vizor

**User Story:** Como SUPER_ADMIN, quero acessar o painel do Financeiro Vizor por
um item de menu visível só para mim e por uma rota protegida, para que apenas eu
gerencie a cobrança das empresas.

#### Acceptance Criteria

1. WHERE o Perfil_Usuario é `SUPER_ADMIN`, THE Financeiro_Vizor_Frontend SHALL exibir o item de menu "Financeiro Vizor" que leva ao painel.
2. WHERE o Perfil_Usuario é diferente de `SUPER_ADMIN`, THE Financeiro_Vizor_Frontend SHALL ocultar o item de menu "Financeiro Vizor", de modo que não fique visível nem acionável.
3. WHEN um usuário com Perfil_Usuario diferente de `SUPER_ADMIN` abre a rota do painel, THE Financeiro_Vizor_Frontend SHALL exibir uma notificação de acesso negado e redirecionar o usuário para a rota `/dashboard`.
4. WHEN a rota do painel é aberta, THE Financeiro_Vizor_Frontend SHALL obter o Perfil_Usuario a partir do token JWT lido de `authStorage`, sem depender de `localStorage` diretamente.
5. IF o token JWT não está presente ou não pode ser decodificado quando a rota do painel é aberta, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma notificação informando que não foi possível verificar a permissão de acesso e não exibir dados de cobrança.

### Requirement 2: Listagem de empresas com status financeiro

**User Story:** Como SUPER_ADMIN, quero ver a lista de todas as empresas com o
status financeiro de cada uma, para acompanhar a situação de cobrança.

#### Acceptance Criteria

1. WHEN o painel de listagem é aberto, THE Financeiro_Vizor_Frontend SHALL solicitar as empresas via `GET /api/financeiro-vizor/empresas` e exibir para cada empresa o nome, o Status_Financeiro, o Total_Mensal e o Total_Vencido.
2. THE Financeiro_Vizor_Frontend SHALL exibir o Status_Financeiro de cada empresa como um selo (badge) colorido, usando cor distinta para cada valor `ATIVO`, `SOMENTE_LEITURA` e `INATIVADO`.
3. THE Financeiro_Vizor_Frontend SHALL exibir o Total_Mensal e o Total_Vencido de cada empresa formatados como valores monetários em reais com duas casas decimais.
4. WHILE a requisição de listagem está em andamento, THE Financeiro_Vizor_Frontend SHALL exibir um indicador de carregamento.
5. IF a requisição de listagem retorna uma lista vazia, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma indicação de que não há empresas a exibir.
6. WHEN o SUPER_ADMIN digita um termo no campo de busca, THE Financeiro_Vizor_Frontend SHALL exibir apenas as empresas cujo nome contém o termo informado, ignorando diferenças entre maiúsculas e minúsculas.
7. WHEN o SUPER_ADMIN seleciona um valor de Status_Financeiro no filtro de status, THE Financeiro_Vizor_Frontend SHALL exibir apenas as empresas com o Status_Financeiro selecionado.
8. WHEN o SUPER_ADMIN seleciona a opção "todos" no filtro de status, THE Financeiro_Vizor_Frontend SHALL exibir as empresas de todos os valores de Status_Financeiro.
9. WHEN o SUPER_ADMIN seleciona uma empresa na listagem, THE Financeiro_Vizor_Frontend SHALL navegar para a tela de detalhe de cobrança da empresa selecionada.

### Requirement 3: Tela de contrato e preços por módulo

**User Story:** Como SUPER_ADMIN, quero editar o contrato e os preços por módulo
de uma empresa com validação no cliente, para configurar quanto a empresa paga
sem enviar dados inválidos à API.

#### Acceptance Criteria

1. WHEN a tela de contrato é aberta, THE Financeiro_Vizor_Frontend SHALL solicitar os dados via `GET /api/financeiro-vizor/empresas/:id` e exibir a Data_Contrato, o Dia_Vencimento e o Preco_Modulo de cada um dos seis Modulo_Cobravel `COMPRAS`, `VENDAS`, `FINANCEIRO`, `FISCAL`, `WMS`, `PCP`.
2. THE Financeiro_Vizor_Frontend SHALL exibir Preco_Modulo igual a zero para cada Modulo_Cobravel ainda não precificado.
3. THE Financeiro_Vizor_Frontend SHALL permitir ao SUPER_ADMIN informar o Preco_Modulo de cada um dos seis Modulo_Cobravel como valor monetário de 0,00 a 999.999.999,99 com no máximo duas casas decimais.
4. THE Financeiro_Vizor_Frontend SHALL exibir o Total_Mensal como a soma dos Preco_Modulo informados na tela, atualizando o valor exibido quando qualquer Preco_Modulo é alterado.
5. WHEN o SUPER_ADMIN informa um Dia_Vencimento inteiro entre 1 e 31 e uma Data_Contrato válida não futura e todos os Preco_Modulo dentro do intervalo permitido e aciona salvar, THE Financeiro_Vizor_Frontend SHALL enviar os dados via `PUT /api/financeiro-vizor/empresas/:id/contrato` e exibir uma notificação de sucesso.
6. IF o SUPER_ADMIN informa um Dia_Vencimento não inteiro ou fora do intervalo de 1 a 31, THEN THE Financeiro_Vizor_Frontend SHALL bloquear o envio, exibir mensagem indicando que o dia de vencimento deve ser um inteiro entre 1 e 31, e preservar os dados informados na tela.
7. IF o SUPER_ADMIN informa uma Data_Contrato inválida ou posterior à data atual, THEN THE Financeiro_Vizor_Frontend SHALL bloquear o envio, exibir mensagem indicando que a data do contrato deve ser válida e não futura, e preservar os dados informados na tela.
8. IF o SUPER_ADMIN informa um Preco_Modulo negativo ou superior a 999.999.999,99, THEN THE Financeiro_Vizor_Frontend SHALL bloquear o envio, exibir mensagem indicando o intervalo permitido de valor, e preservar os dados informados na tela.
9. WHILE a requisição de salvar contrato está em andamento, THE Financeiro_Vizor_Frontend SHALL desabilitar o botão de salvar.
10. IF a API responde com erro ao salvar o contrato, THEN THE Financeiro_Vizor_Frontend SHALL exibir a mensagem de erro retornada pela API e preservar os dados informados na tela.

### Requirement 4: Detalhe e lista de faturas da empresa

**User Story:** Como SUPER_ADMIN, quero ver o detalhe de cobrança e as faturas de
uma empresa, para acompanhar os vencimentos e agir sobre eles.

#### Acceptance Criteria

1. WHEN a tela de detalhe é aberta, THE Financeiro_Vizor_Frontend SHALL solicitar os dados via `GET /api/financeiro-vizor/empresas/:id` e exibir o Total_Mensal, o Total_Vencido, o número de dias em atraso e a lista de Faturas da empresa.
2. THE Financeiro_Vizor_Frontend SHALL exibir para cada Fatura a Competencia, a data de vencimento, o valor e o status.
3. THE Financeiro_Vizor_Frontend SHALL exibir o status de cada Fatura como um selo colorido, usando cor distinta para cada valor `PENDENTE`, `VENCIDA`, `PAGA` e `CANCELADA`.
4. IF a empresa não possui nenhuma Fatura, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma indicação de que não há faturas geradas.
5. WHILE a requisição de detalhe está em andamento, THE Financeiro_Vizor_Frontend SHALL exibir um indicador de carregamento.
6. WHEN o SUPER_ADMIN aciona a baixa de uma Fatura, THE Financeiro_Vizor_Frontend SHALL exibir um diálogo de confirmação antes de enviar a requisição.
7. WHEN o SUPER_ADMIN confirma a baixa de uma Fatura, THE Financeiro_Vizor_Frontend SHALL enviar a requisição via `POST /api/financeiro-vizor/empresas/:id/faturas/:faturaId/baixa`, atualizar a lista de Faturas e exibir uma notificação de sucesso.
8. WHEN o SUPER_ADMIN aciona o cancelamento de uma Fatura, THE Financeiro_Vizor_Frontend SHALL exibir um diálogo de confirmação antes de enviar a requisição.
9. WHEN o SUPER_ADMIN confirma o cancelamento de uma Fatura, THE Financeiro_Vizor_Frontend SHALL enviar a requisição via `POST /api/financeiro-vizor/empresas/:id/faturas/:faturaId/cancelar`, atualizar a lista de Faturas e exibir uma notificação de sucesso.
10. WHEN o SUPER_ADMIN aciona a Geracao_Vencimentos, THE Financeiro_Vizor_Frontend SHALL solicitar o número de meses a gerar antes de enviar a requisição.
11. WHEN o SUPER_ADMIN confirma a Geracao_Vencimentos com um número de meses inteiro entre 1 e 60, THE Financeiro_Vizor_Frontend SHALL enviar a requisição via `POST /api/financeiro-vizor/empresas/:id/gerar-vencimentos`, atualizar a lista de Faturas e exibir uma notificação com o resultado retornado pela API.
12. IF o SUPER_ADMIN informa um número de meses não inteiro ou fora do intervalo de 1 a 60 na Geracao_Vencimentos, THEN THE Financeiro_Vizor_Frontend SHALL bloquear o envio e exibir mensagem indicando que o número de meses deve ser um inteiro entre 1 e 60.
13. WHILE uma requisição de baixa, cancelamento ou Geracao_Vencimentos está em andamento, THE Financeiro_Vizor_Frontend SHALL desabilitar o botão que disparou a ação.

### Requirement 5: Ações de status da empresa (reativar e inativar)

**User Story:** Como SUPER_ADMIN, quero reativar ou inativar uma empresa com
confirmação, para controlar manualmente quando a operação normal retorna ou é
encerrada.

#### Acceptance Criteria

1. WHEN o SUPER_ADMIN aciona a Reativacao de uma empresa, THE Financeiro_Vizor_Frontend SHALL exibir um modal de confirmação antes de enviar a requisição.
2. WHEN o SUPER_ADMIN confirma a Reativacao, THE Financeiro_Vizor_Frontend SHALL enviar a requisição via `POST /api/financeiro-vizor/empresas/:id/reativar`, atualizar o Status_Financeiro exibido para `ATIVO` conforme a resposta da API e exibir uma notificação de sucesso.
3. WHEN o SUPER_ADMIN aciona a Inativacao de uma empresa, THE Financeiro_Vizor_Frontend SHALL exibir um modal de confirmação antes de enviar a requisição.
4. WHEN o SUPER_ADMIN confirma a Inativacao, THE Financeiro_Vizor_Frontend SHALL enviar a requisição via `POST /api/financeiro-vizor/empresas/:id/inativar`, atualizar o Status_Financeiro exibido para `INATIVADO` conforme a resposta da API e exibir uma notificação de sucesso.
5. THE Financeiro_Vizor_Frontend SHALL manter a Reativacao como uma ação sempre explícita do SUPER_ADMIN, não acionando a Reativacao automaticamente ao dar Baixa em uma Fatura.
6. WHILE uma requisição de Reativacao ou Inativacao está em andamento, THE Financeiro_Vizor_Frontend SHALL desabilitar o botão de confirmação do modal.
7. IF a API responde com erro em uma Reativacao ou Inativacao, THEN THE Financeiro_Vizor_Frontend SHALL exibir a mensagem de erro retornada pela API e preservar o Status_Financeiro exibido anteriormente.

### Requirement 6: Aviso para empresa cliente bloqueada

**User Story:** Como usuário de uma empresa cliente bloqueada, quero um aviso
claro do motivo do bloqueio, para entender por que não consigo operar e o que
fazer.

#### Acceptance Criteria

1. WHILE o Status_Financeiro da empresa da sessão é `SOMENTE_LEITURA`, THE Financeiro_Vizor_Frontend SHALL exibir o Banner_Somente_Visualizacao informando que a empresa está em modo somente-visualização por pendência financeira.
2. WHILE o Status_Financeiro da empresa da sessão é `INATIVADO`, THE Financeiro_Vizor_Frontend SHALL exibir o Aviso_Acesso_Impedido informando que a empresa está inativada e o acesso aos módulos está impedido.
3. WHEN a API responde a uma operação de escrita com HTTP 403 e mensagem de modo somente-visualização, THE Financeiro_Vizor_Frontend SHALL exibir a mensagem retornada pela API de forma amigável, sem exibir códigos de erro técnicos ao usuário.
4. WHEN a API responde a uma operação com HTTP 403 e mensagem de empresa inativada, THE Financeiro_Vizor_Frontend SHALL exibir a mensagem retornada pela API de forma amigável, sem exibir códigos de erro técnicos ao usuário.
5. WHILE o Status_Financeiro da empresa da sessão é `ATIVO`, THE Financeiro_Vizor_Frontend SHALL não exibir o Banner_Somente_Visualizacao nem o Aviso_Acesso_Impedido.

### Requirement 7: Padrões de interface (Mantine 7 e tema)

**User Story:** Como usuário do painel, quero uma interface consistente com o
tema do sistema, para uma experiência legível em tema claro e escuro.

#### Acceptance Criteria

1. WHERE um campo permite selecionar valores de uma lista ou digitar valores livres, THE Financeiro_Vizor_Frontend SHALL usar o componente `TagsInput` do Mantine 7.
2. WHERE uma área com texto ou botões usa cor de fundo temática, THE Financeiro_Vizor_Frontend SHALL usar tokens de tema `*-light` ou `*-filled`, sem usar cores claras fixas de índice `-0` como fundo.
3. THE Financeiro_Vizor_Frontend SHALL usar exclusivamente componentes do Mantine 7 para os elementos de interface do painel.
4. WHEN o Status_Financeiro ou o status de uma Fatura é exibido em um selo, THE Financeiro_Vizor_Frontend SHALL usar cores que preservam contraste legível tanto no tema claro quanto no tema escuro.

### Requirement 8: Consumo da API e tratamento de erros

**User Story:** Como SUPER_ADMIN, quero que o painel trate os erros da API de
forma amigável, para entender o que aconteceu sem ver mensagens técnicas.

#### Acceptance Criteria

1. THE Financeiro_Vizor_Frontend SHALL enviar todas as requisições ao Endpoint_Financeiro usando a API_Base lida de `NEXT_PUBLIC_API_URL`.
2. THE Financeiro_Vizor_Frontend SHALL incluir o token JWT de autenticação, obtido de `authStorage`, no cabeçalho de autorização de cada requisição ao Endpoint_Financeiro.
3. IF a API responde com HTTP 401 a uma requisição ao Endpoint_Financeiro, THEN THE Financeiro_Vizor_Frontend SHALL tratar a resposta como sessão expirada ou não autenticada e exibir uma mensagem amigável informando a necessidade de autenticar novamente.
4. IF a API responde com HTTP 403 a uma requisição ao Endpoint_Financeiro, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma mensagem amigável de acesso negado e não exibir dados de cobrança da resposta.
5. IF a API responde com HTTP 404 a uma requisição ao Endpoint_Financeiro, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma mensagem amigável informando que o recurso solicitado não foi encontrado.
6. IF a API responde com HTTP 409 a uma requisição ao Endpoint_Financeiro, THEN THE Financeiro_Vizor_Frontend SHALL exibir a mensagem de conflito retornada pela API de forma amigável e preservar os dados exibidos na tela.
7. IF a API responde com HTTP 422 a uma requisição ao Endpoint_Financeiro, THEN THE Financeiro_Vizor_Frontend SHALL exibir a mensagem de validação retornada pela API de forma amigável e preservar os dados informados na tela.
8. IF a API responde com um código de erro sem mensagem legível, THEN THE Financeiro_Vizor_Frontend SHALL exibir uma mensagem genérica amigável informando que ocorreu um erro ao processar a solicitação.
9. WHEN uma notificação de resultado de operação é exibida, THE Financeiro_Vizor_Frontend SHALL usar a cor verde para sucesso e a cor vermelha para erro.
