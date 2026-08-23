# Requirements Document

## Introduction

Este documento especifica os requisitos para as telas administrativas do Portal do Representante no frontend do Vizor ERP (VisioFab.Wms.Front — Next.js 15, Mantine 7, TypeScript). As telas permitem que administradores do ERP (perfis ADMIN e SUPER_ADMIN) gerenciem contas de representantes, visualizem e processem solicitações de orçamento, configurem critérios de comissão e aprovem alterações cadastrais de clientes submetidas por representantes.

O backend (`VisioFab.Wms.Back`, módulo `portal-rep/admin`) já está implementado e é tratado como contrato fixo. Todas as rotas são protegidas por autenticação interna do ERP e filtram dados por `empresaId` do usuário logado. O prefixo das rotas é `/api/portal-rep/admin/`.

**Escopo deste documento:**

- Tela de listagem e CRUD de contas de representantes
- Tela de listagem e processamento de solicitações de orçamento
- Tela/seção de configuração de critério de creditamento de comissão
- Tela de listagem e aprovação/rejeição de alterações cadastrais de clientes

**Fora de escopo:**

- O portal externo do representante (frontend separado, outro projeto)
- Alterações no backend (já implementado)
- Configuração de percentuais de comissão por produto/tabela (não coberto pelos endpoints atuais)

## Glossary

- **Sistema_Frontend**: A aplicação frontend Next.js 15 (App Router, Mantine 7, TanStack Query, Axios, TypeScript) do Vizor ERP.
- **ERP_Admin**: Usuário interno do ERP com perfil ADMIN ou SUPER_ADMIN, único tipo de usuário com acesso às telas deste módulo.
- **Representante_Conta**: Registro de credencial de acesso ao Portal do Representante, vinculado a um Vendedor existente no ERP. Possui status ATIVO ou INATIVO.
- **Vendedor**: Cadastro de vendedor existente no módulo de Vendas do ERP. Cada Representante_Conta vincula-se a exatamente um Vendedor (relação 1:1).
- **Solicitacao_Orcamento**: Pedido de orçamento criado por um representante no portal externo, contendo cliente, produtos, quantidades e especificações. Administradores podem visualizar todas as solicitações e disparar o cálculo de preço.
- **Configuracao_Comissao**: Definição do critério de creditamento de comissão para a empresa. Valores possíveis: ENTREGUE, FATURADO, PAGO.
- **Aprovacao_Cliente**: Solicitação de alteração cadastral de cliente (vinculação ou alteração fiscal) submetida por um representante, pendente de aprovação do ERP_Admin.
- **Senha_Temporaria**: Senha gerada automaticamente pelo backend ao criar uma conta ou resetar a senha de um representante. Deve ser exibida ao administrador uma única vez para repasse ao representante.
- **API_Admin_Portal**: Conjunto de endpoints REST em `/api/portal-rep/admin/` que fornecem os dados para as telas deste módulo.

## Requirements

### Requirement 1: Navegação e Acesso ao Módulo

**User Story:** Como um administrador do ERP, eu quero acessar as telas de administração do Portal do Representante pela navegação lateral do sistema, para que eu gerencie representantes sem sair do fluxo normal de trabalho no ERP.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL exibir um item de menu "Portal Representante" na sidebar de navegação, agrupando as sub-páginas do módulo administrativo.
2. THE Sistema_Frontend SHALL restringir a visibilidade do item de menu "Portal Representante" exclusivamente a usuários com perfil ADMIN ou SUPER_ADMIN.
3. WHEN o ERP_Admin clica no item de menu "Portal Representante", THE Sistema_Frontend SHALL expandir um submenu com as opções: Representantes, Solicitações de Orçamento, Configuração de Comissão e Aprovações de Clientes.
4. IF um usuário sem perfil ADMIN ou SUPER_ADMIN tentar acessar diretamente a URL de qualquer página do módulo, THEN THE Sistema_Frontend SHALL redirecionar para a página principal do ERP.

---

### Requirement 2: Listagem de Contas de Representantes

**User Story:** Como um administrador do ERP, eu quero visualizar todas as contas de representantes cadastradas na empresa, para que eu tenha visão geral de quem tem acesso ao portal e o status de cada conta.

#### Acceptance Criteria

1. WHEN o ERP_Admin acessa a página de Representantes, THE Sistema_Frontend SHALL realizar uma requisição `GET /api/portal-rep/admin/representantes` e exibir os resultados em uma tabela.
2. THE Sistema_Frontend SHALL exibir as seguintes colunas na tabela de representantes: Nome do Vendedor, E-mail, Status (ATIVO/INATIVO), Último Acesso e Data de Criação.
3. THE Sistema_Frontend SHALL indicar visualmente o status de cada conta utilizando badges coloridos (verde para ATIVO, vermelho para INATIVO).
4. THE Sistema_Frontend SHALL exibir a informação de senha temporária pendente quando o campo `senhaTemporaria` da conta estiver marcado como verdadeiro.
5. WHILE os dados estão sendo carregados da API_Admin_Portal, THE Sistema_Frontend SHALL exibir um indicador de carregamento (skeleton ou spinner) na área da tabela.
6. IF a requisição à API_Admin_Portal retornar erro, THEN THE Sistema_Frontend SHALL exibir uma mensagem de erro com opção de tentar novamente.

---

### Requirement 3: Criação de Conta de Representante

**User Story:** Como um administrador do ERP, eu quero criar novas contas de acesso ao portal vinculadas a vendedores existentes, para que representantes comerciais possam acessar o portal de forma independente.

#### Acceptance Criteria

1. WHEN o ERP_Admin clica no botão "Novo Representante" na página de listagem, THE Sistema_Frontend SHALL abrir um modal de criação com os campos: Vendedor (seleção) e E-mail.
2. THE Sistema_Frontend SHALL apresentar o campo Vendedor como um select/autocomplete que lista apenas vendedores da empresa que ainda não possuem conta de representante vinculada.
3. THE Sistema_Frontend SHALL validar o campo E-mail no client-side, rejeitando formatos inválidos e exibindo mensagem de erro inline antes de permitir o envio.
4. WHEN o ERP_Admin submete o formulário com dados válidos, THE Sistema_Frontend SHALL enviar uma requisição `POST /api/portal-rep/admin/representantes` com o payload `{ vendedorId, email }`.
5. WHEN a API_Admin_Portal retorna sucesso (status 201) com a senha temporária gerada, THE Sistema_Frontend SHALL exibir a senha temporária em um diálogo de confirmação com opção de copiar para a área de transferência.
6. WHEN o diálogo de senha temporária é fechado, THE Sistema_Frontend SHALL invalidar a query de listagem de representantes para refletir o novo registro na tabela.
7. IF a API_Admin_Portal retornar erro (duplicidade de vendedor, e-mail já usado), THEN THE Sistema_Frontend SHALL exibir a mensagem de erro retornada pelo backend no modal sem fechá-lo, permitindo correção.

---

### Requirement 4: Edição de Conta de Representante

**User Story:** Como um administrador do ERP, eu quero editar os dados de uma conta de representante existente, para que eu mantenha as informações atualizadas sem precisar recriar a conta.

#### Acceptance Criteria

1. WHEN o ERP_Admin clica na ação de editar em uma linha da tabela de representantes, THE Sistema_Frontend SHALL abrir um modal de edição pré-preenchido com os dados atuais da conta (e-mail, status, notificação por e-mail).
2. THE Sistema_Frontend SHALL permitir a edição dos campos: E-mail, Status (ATIVO/INATIVO) e Notificação por E-mail (ativada/desativada).
3. THE Sistema_Frontend SHALL exibir o nome do vendedor vinculado como informação somente-leitura no modal de edição.
4. WHEN o ERP_Admin submete alterações válidas, THE Sistema_Frontend SHALL enviar uma requisição `PUT /api/portal-rep/admin/representantes/:id` com os campos alterados.
5. WHEN a API_Admin_Portal retorna sucesso, THE Sistema_Frontend SHALL fechar o modal, invalidar a query de listagem e exibir uma notificação de sucesso.
6. IF a API_Admin_Portal retornar erro de validação, THEN THE Sistema_Frontend SHALL exibir a mensagem de erro no modal sem fechá-lo.

---

### Requirement 5: Inativação de Conta de Representante

**User Story:** Como um administrador do ERP, eu quero inativar a conta de um representante de forma rápida, para que eu revogue imediatamente o acesso ao portal quando necessário.

#### Acceptance Criteria

1. WHEN o ERP_Admin clica na ação de inativar em uma linha da tabela de representantes com status ATIVO, THE Sistema_Frontend SHALL exibir um diálogo de confirmação informando que o acesso do representante ao portal será revogado.
2. WHEN o ERP_Admin confirma a inativação, THE Sistema_Frontend SHALL enviar uma requisição `PUT /api/portal-rep/admin/representantes/:id/inativar`.
3. WHEN a API_Admin_Portal retorna sucesso, THE Sistema_Frontend SHALL invalidar a query de listagem e exibir uma notificação de sucesso indicando que a conta foi inativada.
4. IF a API_Admin_Portal retornar erro, THEN THE Sistema_Frontend SHALL exibir a mensagem de erro em uma notificação e manter o estado anterior na tabela.

---

### Requirement 6: Reset de Senha de Representante

**User Story:** Como um administrador do ERP, eu quero gerar uma nova senha temporária para um representante, para que ele possa recuperar o acesso ao portal quando esquece a senha ou perde as credenciais.

#### Acceptance Criteria

1. WHEN o ERP_Admin clica na ação de resetar senha em uma linha da tabela de representantes, THE Sistema_Frontend SHALL exibir um diálogo de confirmação informando que uma nova senha temporária será gerada e a senha atual invalidada.
2. WHEN o ERP_Admin confirma o reset, THE Sistema_Frontend SHALL enviar uma requisição `PUT /api/portal-rep/admin/representantes/:id/resetar-senha`.
3. WHEN a API_Admin_Portal retorna sucesso com a nova senha temporária, THE Sistema_Frontend SHALL exibir a nova senha em um diálogo com opção de copiar para a área de transferência.
4. THE Sistema_Frontend SHALL invalidar a query de listagem após o reset para refletir a atualização do campo de senha temporária pendente.
5. IF a API_Admin_Portal retornar erro, THEN THE Sistema_Frontend SHALL exibir a mensagem de erro em uma notificação sem alterar o estado da tabela.

---

### Requirement 7: Listagem de Solicitações de Orçamento

**User Story:** Como um administrador do ERP, eu quero visualizar todas as solicitações de orçamento enviadas por representantes, para que eu priorize e processe os orçamentos pendentes de cálculo.

#### Acceptance Criteria

1. WHEN o ERP_Admin acessa a página de Solicitações de Orçamento, THE Sistema_Frontend SHALL realizar uma requisição `GET /api/portal-rep/admin/solicitacoes-orcamento` e exibir os resultados em uma tabela paginada.
2. THE Sistema_Frontend SHALL exibir as seguintes colunas: Representante (nome do vendedor), Cliente, Status, Data de Criação e Ações.
3. THE Sistema_Frontend SHALL permitir filtrar as solicitações por: status, vendedor (representante), nome do cliente e período (data início e data fim).
4. THE Sistema_Frontend SHALL indicar visualmente o status de cada solicitação com badges coloridos diferenciados por estado (pendente, calculado, etc.).
5. THE Sistema_Frontend SHALL implementar paginação na tabela, enviando os parâmetros `page` e `pageSize` à API_Admin_Portal.
6. WHILE os dados estão sendo carregados ou os filtros estão sendo aplicados, THE Sistema_Frontend SHALL exibir um indicador de carregamento sem remover o conteúdo atual da tabela (loading overlay ou skeleton parcial).

---

### Requirement 8: Processamento de Solicitação de Orçamento (Calcular)

**User Story:** Como um administrador do ERP, eu quero disparar o cálculo de uma solicitação de orçamento diretamente pela lista, para que o preço de venda seja gerado e disponibilizado ao representante.

#### Acceptance Criteria

1. WHEN o ERP_Admin clica na ação "Calcular" em uma solicitação com status pendente, THE Sistema_Frontend SHALL exibir um diálogo de confirmação informando que o orçamento será processado pelo motor de cálculo.
2. WHEN o ERP_Admin confirma o processamento, THE Sistema_Frontend SHALL enviar uma requisição `POST /api/portal-rep/admin/solicitacoes-orcamento/:id/calcular`.
3. WHILE a requisição de cálculo está em processamento, THE Sistema_Frontend SHALL desabilitar o botão de ação e exibir um indicador de loading na linha correspondente da tabela.
4. WHEN a API_Admin_Portal retorna sucesso, THE Sistema_Frontend SHALL invalidar a query de listagem, atualizar o status da solicitação na tabela e exibir uma notificação de sucesso.
5. IF a API_Admin_Portal retornar erro (solicitação já calculada, erro no motor de cálculo), THEN THE Sistema_Frontend SHALL exibir a mensagem de erro em uma notificação.

---

### Requirement 9: Configuração de Critério de Creditamento de Comissão

**User Story:** Como um administrador do ERP, eu quero definir em qual momento a comissão do representante é creditada (na entrega, no faturamento ou no pagamento), para que a política de remuneração reflita as regras comerciais da empresa.

#### Acceptance Criteria

1. WHEN o ERP_Admin acessa a página de Configuração de Comissão, THE Sistema_Frontend SHALL exibir o critério de creditamento atualmente configurado para a empresa.
2. THE Sistema_Frontend SHALL apresentar as três opções de critério como radio buttons ou select com descrições claras: "Entregue" (comissão creditada na entrega), "Faturado" (comissão creditada no faturamento) e "Pago" (comissão creditada na confirmação de pagamento).
3. WHEN o ERP_Admin seleciona um critério diferente do atual e confirma a alteração, THE Sistema_Frontend SHALL enviar uma requisição `PUT /api/portal-rep/admin/configuracao-comissao` com o payload `{ criterio: "ENTREGUE" | "FATURADO" | "PAGO" }`.
4. WHEN a API_Admin_Portal retorna sucesso, THE Sistema_Frontend SHALL exibir uma notificação de sucesso e atualizar a interface para refletir o novo critério selecionado.
5. IF a API_Admin_Portal retornar erro, THEN THE Sistema_Frontend SHALL reverter a seleção para o valor anterior e exibir a mensagem de erro em uma notificação.

---

### Requirement 10: Listagem de Aprovações de Clientes Pendentes

**User Story:** Como um administrador do ERP, eu quero visualizar todas as solicitações de alteração cadastral de clientes submetidas por representantes, para que eu avalie e aprove ou rejeite cada uma antes que os dados oficiais sejam modificados.

#### Acceptance Criteria

1. WHEN o ERP_Admin acessa a página de Aprovações de Clientes, THE Sistema_Frontend SHALL realizar uma requisição `GET /api/portal-rep/admin/aprovacoes-cliente` e exibir os resultados em uma tabela.
2. THE Sistema_Frontend SHALL exibir as seguintes colunas: Representante, Cliente, Tipo de Alteração (Vinculação ou Alteração Fiscal), Status, Data da Solicitação e Ações.
3. THE Sistema_Frontend SHALL indicar visualmente o tipo de cada solicitação para diferenciá-las (ícone ou badge para VINCULACAO vs ALTERACAO_FISCAL).
4. WHEN o ERP_Admin clica na ação de visualizar detalhes de uma aprovação pendente, THE Sistema_Frontend SHALL exibir um modal ou painel lateral contendo os dados anteriores e os dados novos propostos pelo representante, lado a lado, para facilitar a comparação.
5. THE Sistema_Frontend SHALL destacar visualmente os campos que foram alterados na comparação entre dados anteriores e dados novos.
6. WHILE os dados estão sendo carregados, THE Sistema_Frontend SHALL exibir um indicador de carregamento na área da tabela.

---

### Requirement 11: Tratamento de Erros e Estados de Carregamento

**User Story:** Como um administrador do ERP, eu quero receber feedback visual claro durante operações de rede e mensagens de erro compreensíveis quando algo falha, para que eu saiba sempre o que está acontecendo no sistema.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL utilizar o padrão de notificações Mantine (`notifications.show`) com `color: 'red'` para erros e `color: 'green'` para sucessos em todas as operações deste módulo.
2. THE Sistema_Frontend SHALL utilizar `@tanstack/react-query` para gerenciamento de cache, invalidação automática após mutações e estados de loading/error em todas as requisições deste módulo.
3. IF uma requisição à API_Admin_Portal retornar HTTP 403 (usuário sem permissão), THEN THE Sistema_Frontend SHALL exibir uma mensagem informando que apenas administradores podem acessar a funcionalidade.
4. IF uma requisição à API_Admin_Portal retornar HTTP 400 (empresa não selecionada), THEN THE Sistema_Frontend SHALL redirecionar o usuário para a tela de seleção de empresa.
5. THE Sistema_Frontend SHALL desabilitar botões de ação enquanto uma mutação (criação, edição, inativação, reset, cálculo) está em processamento, prevenindo submissões duplicadas.

---

### Requirement 12: Padrões de Interface e Responsividade

**User Story:** Como um administrador do ERP, eu quero que as telas do Portal Representante sigam os mesmos padrões visuais do restante do ERP, para que eu tenha uma experiência consistente e familiar.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL utilizar exclusivamente componentes da biblioteca Mantine 7 (Table, Modal, Button, TextInput, Select, Badge, Notification, Card, etc.) nas telas deste módulo.
2. THE Sistema_Frontend SHALL seguir o padrão de layout já utilizado nas demais páginas administrativas: título da página no topo, barra de ações (filtros + botão de criação) abaixo do título e tabela de dados como conteúdo principal.
3. THE Sistema_Frontend SHALL implementar todas as páginas como componentes client-side (`'use client'`) dentro do diretório `src/app/(interna)/portal-representante/` seguindo a convenção do App Router.
4. THE Sistema_Frontend SHALL tipar todas as respostas da API_Admin_Portal com interfaces TypeScript, declaradas em arquivo dedicado de tipos dentro do módulo.
5. THE Sistema_Frontend SHALL utilizar Axios (instância configurada do projeto) para requisições HTTP e `@tanstack/react-query` para cache e gerenciamento de estado de servidor.
