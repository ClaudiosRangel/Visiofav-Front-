# Requirements Document

## Introduction

Implementação frontend das telas de configuração de integração, configuração de e-mail fiscal, reformulação do cadastro de produto (bloqueio de conferência), listagem de pendências CC-e e resolução de pendências. O frontend consome a API REST do backend (Fastify) previamente especificada e utiliza o stack existente: Next.js 15 App Router, Mantine 7, TanStack React Query e react-hook-form com Zod para validação client-side. As configurações são adicionadas como novas seções na página `/configurador/conferencia` existente, a listagem de pendências em nova rota `/wms/pendencias-cce`, e o bloqueio de conferência é aplicado ao ProdutoModal existente.

## Glossary

- **Frontend_WMS**: Aplicação web Next.js 15 com Mantine 7 hospedada na Vercel, responsável pela interface do usuário do WMS
- **Pagina_Conferencia**: Página existente em `/configurador/conferencia` que exibe switches de configuração de conferência cega
- **ProdutoModal**: Modal existente em `/configurador/produtos/ProdutoModal.tsx` para criação e edição de produtos
- **Pagina_Pendencias**: Nova página em `/wms/pendencias-cce` para listagem e resolução de pendências CC-e
- **Formulario_Integracao**: Seção de formulário para ativar/desativar integração e definir o nome do sistema externo
- **Formulario_Email_Fiscal**: Seção de formulário para configurar o endereço de e-mail do setor fiscal
- **Secao_Bloqueio**: Seção de checkboxes no ProdutoModal que substitui os Selects de divergência de lote e validade
- **Tabela_Pendencias**: Componente de tabela que lista pendências CC-e com colunas e filtros
- **Confirm_Modal**: Modal de confirmação (Mantine modals.openConfirmModal) exibido antes de ações destrutivas ou irreversíveis
- **Notificacao_Sucesso**: Notificação visual (notifications.show com color green) indicando operação bem-sucedida
- **Notificacao_Erro**: Notificação visual (notifications.show com color red) indicando falha na operação
- **API_Backend**: API REST Fastify exposta em `/api` consumida via Axios pela instância `api` de `@/lib/api`

## Requirements

### Requirement 1: Seção de Configuração de Integração na Página de Conferência

**User Story:** As a administrador do WMS, I want configurar a integração com sistema externo na mesma página de conferência, so that eu consiga ativar e definir o nome do sistema sem navegar para outra tela.

#### Acceptance Criteria

1. THE Pagina_Conferencia SHALL exibir uma nova seção "Integração com Sistema Externo" após as seções existentes de conferência, contendo um Switch para ativação da integração e um TextInput para o nome do sistema externo
2. THE Formulario_Integracao SHALL limitar o campo de nome do sistema externo a 100 caracteres utilizando a propriedade maxLength do TextInput
3. WHEN o Switch de integração estiver desativado, THE Formulario_Integracao SHALL desabilitar (disabled) o TextInput de nome do sistema externo, indicando visualmente que o campo não é necessário
4. WHEN o administrador clicar no botão "Salvar" da seção de integração, THE Frontend_WMS SHALL enviar requisição POST para `/api/config-integracao` com os campos `integracaoAtiva` (boolean) e `sistemaExterno` (string ou null)
5. WHEN a requisição de salvamento da configuração de integração retornar sucesso, THE Frontend_WMS SHALL exibir Notificacao_Sucesso com a mensagem "Configuração de integração salva"
6. IF a requisição de salvamento da configuração de integração retornar erro 422 (sistema externo obrigatório quando ativo), THEN THE Frontend_WMS SHALL exibir Notificacao_Erro com a mensagem retornada pela API e manter os valores digitados no formulário
7. WHEN a Pagina_Conferencia for carregada, THE Frontend_WMS SHALL buscar a configuração existente via GET `/api/config-integracao` e preencher o formulário com os valores retornados

### Requirement 2: Seção de Configuração de E-mail Fiscal na Página de Conferência

**User Story:** As a administrador do WMS, I want configurar o e-mail do setor fiscal na página de conferência, so that o sistema saiba para onde enviar notificações de divergência quando não houver integração.

#### Acceptance Criteria

1. THE Pagina_Conferencia SHALL exibir uma nova seção "E-mail do Setor Fiscal" após a seção de integração, contendo um TextInput para o endereço de e-mail e um botão "Salvar"
2. THE Formulario_Email_Fiscal SHALL limitar o campo de e-mail a 254 caracteres utilizando a propriedade maxLength do TextInput
3. WHEN o administrador clicar no botão "Salvar" da seção de e-mail fiscal, THE Frontend_WMS SHALL enviar requisição POST para `/api/config-email-fiscal` com o campo `email` (string)
4. WHEN a requisição de salvamento do e-mail retornar sucesso, THE Frontend_WMS SHALL exibir Notificacao_Sucesso com a mensagem "E-mail fiscal salvo"
5. IF a requisição de salvamento retornar erro 422 (formato inválido ou campo vazio), THEN THE Frontend_WMS SHALL exibir Notificacao_Erro com a mensagem retornada pela API e preservar o valor digitado no campo de e-mail sem limpar o formulário
6. WHEN a Pagina_Conferencia for carregada, THE Frontend_WMS SHALL buscar a configuração de e-mail existente via GET `/api/config-email-fiscal` e preencher o campo com o valor retornado

### Requirement 3: Reformulação do Cadastro de Produto — Bloqueio de Conferência

**User Story:** As a administrador do WMS, I want substituir os Selects de divergência de lote e validade por checkboxes de bloqueio de conferência no cadastro de produto, so that a opção "Aceitar Livremente" seja removida e o cadastro reflita os novos modos de tratamento.

#### Acceptance Criteria

1. THE ProdutoModal SHALL exibir na aba "Dados Gerais" uma seção "Bloqueio de Conferência" em substituição aos dois Selects "Divergência de Lote" e "Divergência de Validade"
2. THE Secao_Bloqueio SHALL exibir dois checkboxes com os labels: "Aceitar com senha supervisor" (campo `aceitarSenha`) e "Aceitar com CCE Automática ou Pendente" (campo `aceitarCcePendente`)
3. THE ProdutoModal SHALL NOT exibir a opção "Aceitar Livremente" em nenhum campo ou checkbox do cadastro de produto
4. THE Secao_Bloqueio SHALL permitir que ambos os checkboxes estejam marcados simultaneamente, que ambos estejam desmarcados, ou qualquer combinação individual
5. WHEN o administrador salvar o produto com as novas configurações de bloqueio, THE Frontend_WMS SHALL enviar os campos `aceitarSenha` (boolean) e `aceitarCcePendente` (boolean) na requisição de criação ou atualização do produto
6. WHEN o ProdutoModal for aberto em modo edição, THE Frontend_WMS SHALL preencher os checkboxes com os valores booleanos retornados pela API (`aceitarSenha` e `aceitarCcePendente`), mapeando valores antigos (`modoResolucaoLote`, `modoResolucaoValidade`) para os novos campos quando necessário durante a migração
7. THE Secao_Bloqueio SHALL exibir um texto descritivo informando que quando nenhuma opção estiver marcada o sistema aplicará bloqueio total com reconferência obrigatória

### Requirement 4: Listagem de Pendências CC-e

**User Story:** As a operador do WMS, I want visualizar pendências de CC-e em uma listagem com filtros, so that eu possa acompanhar o status de cada divergência aguardando correção.

#### Acceptance Criteria

1. THE Frontend_WMS SHALL disponibilizar a rota `/wms/pendencias-cce` com uma página de listagem de pendências acessível via item de menu "Pendências" no módulo WMS
2. THE Tabela_Pendencias SHALL exibir as colunas: Fornecedor, Nota Fiscal, Data de Criação (formatada em dd/MM/yyyy), Produto, Motivo e Status
3. THE Tabela_Pendencias SHALL ordenar os registros por data de criação decrescente (mais recentes primeiro) como ordenação padrão
4. THE Pagina_Pendencias SHALL exibir filtros acima da tabela contendo: TextInput para busca parcial de fornecedor, dois DateInput para intervalo de datas (data inicial e data final), e Select para filtro exato por status com opções "Pendente", "CCE Emitida" e "Resolvida"
5. WHEN o operador aplicar ou alterar qualquer filtro, THE Frontend_WMS SHALL enviar requisição GET para `/api/pendencias-cce` com os parâmetros de filtro e atualizar a tabela com os resultados
6. WHEN a Pagina_Pendencias for carregada ou atualizada, THE Frontend_WMS SHALL buscar os dados via GET `/api/pendencias-cce` utilizando TanStack React Query para cache e revalidação
7. IF a resposta da API retornar lista vazia (ou nenhum resultado para os filtros aplicados), THEN THE Tabela_Pendencias SHALL exibir um estado vazio com a mensagem "Nenhuma pendência encontrada" centralizada na área da tabela
8. THE Pagina_Pendencias SHALL exibir o status da pendência como Badge colorido: "Pendente" (cor laranja), "CCE Emitida" (cor azul) e "Resolvida" (cor verde)

### Requirement 5: Resolução e Cancelamento de Pendências

**User Story:** As a administrador do WMS, I want resolver ou cancelar pendências diretamente da listagem, so that itens aguardando CC-e possam ser liberados sem sair da tela.

#### Acceptance Criteria

1. THE Tabela_Pendencias SHALL exibir na coluna de ações um botão "Resolver" e um botão "Cancelar" para cada pendência com status "Pendente" (AGUARDANDO_CCE)
2. WHEN o operador clicar no botão "Resolver", THE Frontend_WMS SHALL abrir um Confirm_Modal com título "Resolver Pendência", mensagem "Confirma a resolução desta pendência?" e botões "Confirmar" e "Cancelar"
3. WHEN o operador confirmar a resolução no Confirm_Modal, THE Frontend_WMS SHALL enviar requisição PATCH para `/api/pendencias-cce/:id/resolver` com body `{ "status": "RESOLVIDA" }`
4. WHEN o operador clicar no botão "Cancelar" da pendência, THE Frontend_WMS SHALL abrir um Confirm_Modal com título "Cancelar Pendência", mensagem "Confirma o cancelamento desta pendência?" e botões "Confirmar" e "Cancelar"
5. WHEN o operador confirmar o cancelamento no Confirm_Modal, THE Frontend_WMS SHALL enviar requisição PATCH para `/api/pendencias-cce/:id/resolver` com body `{ "status": "CANCELADA" }`
6. WHEN a requisição de resolução ou cancelamento retornar sucesso, THE Frontend_WMS SHALL exibir Notificacao_Sucesso, invalidar o cache da query de pendências e atualizar a tabela automaticamente
7. IF a requisição de resolução retornar erro 404 ou 409 (pendência não encontrada ou já processada), THEN THE Frontend_WMS SHALL exibir Notificacao_Erro com a mensagem retornada pela API
8. WHILE uma pendência estiver com status "Resolvida" ou "Cancelada", THE Tabela_Pendencias SHALL NOT exibir botões de ação para essa pendência
