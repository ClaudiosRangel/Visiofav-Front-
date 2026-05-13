# Requirements Document

## Introduction

Este documento especifica os requisitos para três entregas no frontend WMS (Next.js 15 / Mantine 7):

1. **Telas de Formatos de Endereço** — CRUD de formatos de endereço no Configurador, seletor de formato nos modais de depósito e zona, e adaptação do EnderecoAutoModal para exibir apenas os campos do formato ativo.
2. **Bug: Shelf Life permitindo sem aviso** — Na conferência de entrada, exibir alerta visual (warning não-bloqueante) quando a data de vencimento informada resulta em dias restantes menores que o shelf_life_minimo do produto.
3. **Bug: Endereçamento manual sem sugestões automáticas** — Na conferência de entrada > aba Endereçar > modo manual, integrar as sugestões do hook useEnderecamentoInteligente (useDistribuicaoInteligente) no fluxo manual existente.

## Glossary

- **Sistema_Frontend**: A aplicação Next.js 15 App Router com React 19, Mantine 7, TanStack Query 5, react-hook-form e zod que compõe o frontend WMS.
- **Formato_Endereco**: Entidade que define quais componentes (rua, prédio, nível, apartamento, etc.) compõem um endereço de armazenagem, incluindo ordem, separadores e quantidade de dígitos.
- **CRUD_Formatos**: Tela de listagem, criação, edição e exclusão de Formato_Endereco dentro do módulo Configurador > Endereços.
- **DepositoModal**: Modal de criação/edição de depósito localizado em `configurador/depositos/DepositoModal.tsx`.
- **ZonasPage**: Página de CRUD de zonas com modal inline localizada em `configurador/zonas/page.tsx`.
- **EnderecoAutoModal**: Modal de geração automática de endereços localizado em `configurador/enderecos/EnderecoAutoModal.tsx`.
- **Conferencia_Entrada**: Página de conferência de entrada WMS localizada em `wms/conferencia-entrada/page.tsx`.
- **Shelf_Life_Minimo**: Campo numérico do produto que indica a quantidade mínima de dias de validade restantes aceitáveis no momento do recebimento.
- **Hook_Enderecamento_Inteligente**: Hook `useEnderecamentoInteligente.ts` que expõe `useDistribuicaoInteligente` e `useOcupacaoArmazem` para sugestões automáticas de endereçamento.
- **Modo_Manual_Enderecamento**: Fluxo na aba Endereçar da Conferencia_Entrada onde o operador seleciona manualmente os endereços de destino para cada item.
- **API_Formato_Endereco**: Endpoints REST do backend: GET/POST/PUT/DELETE `/api/formato-endereco`, GET `/api/formato-endereco/resolver`, POST `/api/formato-endereco/gerar`.

## Requirements

### Requirement 1: CRUD de Formatos de Endereço

**User Story:** Como administrador do armazém, quero cadastrar, editar, listar e excluir formatos de endereço, para que eu possa definir a estrutura dos endereços de cada depósito/zona.

#### Acceptance Criteria

1. WHEN o usuário navega para Configurador > Endereços, THE Sistema_Frontend SHALL exibir um botão ou sub-aba "Formatos de Endereço" que dá acesso ao CRUD_Formatos.
2. WHEN o usuário acessa o CRUD_Formatos, THE Sistema_Frontend SHALL listar todos os formatos de endereço retornados por GET `/api/formato-endereco` em uma tabela com colunas: nome, componentes configurados e status.
3. WHEN o usuário clica em "Novo Formato", THE Sistema_Frontend SHALL abrir um modal com campos para nome do formato e configuração dos componentes (rua, prédio, nível, apartamento — cada um com flag ativo, quantidade de dígitos e separador).
4. WHEN o usuário preenche os campos obrigatórios e clica em "Salvar" no modal de criação, THE Sistema_Frontend SHALL enviar POST `/api/formato-endereco` com os dados do formulário e exibir notificação de sucesso ao receber resposta 2xx.
5. WHEN o usuário clica em "Editar" em um formato existente, THE Sistema_Frontend SHALL abrir o modal preenchido com os dados atuais do formato e enviar PUT `/api/formato-endereco/:id` ao salvar.
6. WHEN o usuário clica em "Excluir" em um formato existente e confirma a ação, THE Sistema_Frontend SHALL enviar DELETE `/api/formato-endereco/:id` e remover o item da listagem ao receber resposta 2xx.
7. IF a API retorna erro (status 4xx ou 5xx) em qualquer operação CRUD, THEN THE Sistema_Frontend SHALL exibir notificação de erro com a mensagem retornada pela API.
8. THE Sistema_Frontend SHALL validar no cliente que o campo nome do formato possui ao menos 1 caractere e que ao menos um componente está marcado como ativo antes de permitir o envio do formulário.

### Requirement 2: Seletor de Formato no Modal de Depósito

**User Story:** Como administrador do armazém, quero associar um formato de endereço padrão a cada depósito, para que os endereços gerados nesse depósito sigam o formato definido.

#### Acceptance Criteria

1. WHEN o DepositoModal é aberto, THE Sistema_Frontend SHALL buscar a lista de formatos de endereço via GET `/api/formato-endereco` e exibir um campo Select "Formato de Endereço" com as opções retornadas.
2. WHEN o usuário seleciona um formato e salva o depósito, THE Sistema_Frontend SHALL incluir o campo `formatoEnderecoId` no payload enviado ao backend (POST ou PUT).
3. WHILE o DepositoModal está em modo edição e o depósito já possui um formato associado, THE Sistema_Frontend SHALL pré-selecionar o formato atual no campo Select.
4. THE Sistema_Frontend SHALL permitir que o campo "Formato de Endereço" fique vazio (seleção opcional), sem bloquear o salvamento do depósito.

### Requirement 3: Seletor de Formato no Modal de Zona

**User Story:** Como administrador do armazém, quero associar um formato de endereço a uma zona específica, para que endereços dessa zona possam ter formato diferente do depósito.

#### Acceptance Criteria

1. WHEN o modal de criação/edição de zona é aberto na ZonasPage, THE Sistema_Frontend SHALL buscar a lista de formatos de endereço via GET `/api/formato-endereco` e exibir um campo Select "Formato de Endereço" com as opções retornadas.
2. WHEN o usuário seleciona um formato e salva a zona, THE Sistema_Frontend SHALL incluir o campo `formatoEnderecoId` no payload enviado ao backend.
3. WHILE o modal de zona está em modo edição e a zona já possui um formato associado, THE Sistema_Frontend SHALL pré-selecionar o formato atual no campo Select.
4. THE Sistema_Frontend SHALL permitir que o campo "Formato de Endereço" fique vazio (seleção opcional), sem bloquear o salvamento da zona.

### Requirement 4: Adaptação do EnderecoAutoModal com Formato Ativo

**User Story:** Como administrador do armazém, quero que o modal de geração automática de endereços exiba apenas os campos de faixa correspondentes ao formato ativo do depósito/zona selecionado, para evitar confusão e erros de preenchimento.

#### Acceptance Criteria

1. WHEN o usuário seleciona um depósito no EnderecoAutoModal, THE Sistema_Frontend SHALL chamar GET `/api/formato-endereco/resolver?depositoId={id}` para obter o formato ativo aplicável.
2. WHEN o formato ativo é resolvido com sucesso, THE Sistema_Frontend SHALL exibir apenas os campos de faixa (início/fim) dos componentes marcados como ativos no formato retornado.
3. WHILE nenhum formato é retornado pela API de resolução (resposta vazia ou 404), THE Sistema_Frontend SHALL exibir todos os campos de faixa padrão (rua, prédio, nível, apartamento) como comportamento fallback.
4. WHEN o usuário altera a seleção de depósito, THE Sistema_Frontend SHALL buscar novamente o formato ativo e atualizar a visibilidade dos campos de faixa.
5. WHEN o usuário submete o formulário de geração, THE Sistema_Frontend SHALL enviar POST `/api/formato-endereco/gerar` com os dados de faixa preenchidos e o formatoEnderecoId resolvido.
6. IF a chamada a GET `/api/formato-endereco/resolver` falha, THEN THE Sistema_Frontend SHALL exibir todos os campos de faixa padrão e permitir a geração normalmente.

### Requirement 5: Alerta de Shelf Life na Conferência de Entrada

**User Story:** Como conferente, quero ser alertado visualmente quando a data de vencimento informada resulta em shelf life abaixo do mínimo do produto, para que eu possa tomar uma decisão consciente antes de prosseguir.

#### Acceptance Criteria

1. WHEN o conferente informa uma data de vencimento para um item na Conferencia_Entrada, THE Sistema_Frontend SHALL calcular os dias restantes entre a data de vencimento informada e a data atual.
2. WHEN os dias restantes calculados são menores que o valor de shelf_life_minimo do produto (obtido via GET `/api/produtos/:id`), THE Sistema_Frontend SHALL exibir um alerta visual de cor amarela (warning) junto ao campo de validade do item.
3. THE Sistema_Frontend SHALL exibir no alerta uma mensagem indicando os dias restantes e o mínimo exigido (exemplo: "Validade com 15 dias restantes — mínimo exigido: 30 dias").
4. THE Sistema_Frontend SHALL manter o alerta como não-bloqueante, permitindo que o conferente ignore o aviso e prossiga com a conferência sem impedimento.
5. WHILE o campo shelf_life_minimo do produto não está definido ou é zero, THE Sistema_Frontend SHALL omitir a validação de shelf life e não exibir alerta para o item.
6. WHEN o conferente altera a data de vencimento para um valor que resulta em dias restantes maiores ou iguais ao shelf_life_minimo, THE Sistema_Frontend SHALL remover o alerta visual imediatamente.

### Requirement 6: Sugestões Automáticas no Endereçamento Manual

**User Story:** Como operador de armazém, quero ver sugestões automáticas de endereço ao endereçar manualmente os itens conferidos, para agilizar o processo e reduzir erros de alocação.

#### Acceptance Criteria

1. WHEN o operador entra no modo manual de endereçamento na Conferencia_Entrada e uma nota é selecionada, THE Sistema_Frontend SHALL chamar `useDistribuicaoInteligente` do Hook_Enderecamento_Inteligente para cada item pendente de endereçamento.
2. WHEN o Hook_Enderecamento_Inteligente retorna sugestões de alocação, THE Sistema_Frontend SHALL exibir as sugestões ao lado de cada item na interface de endereçamento manual (endereço sugerido e percentual de ocupação).
3. WHEN o operador clica em "Aceitar Sugestões", THE Sistema_Frontend SHALL preencher automaticamente os campos de endereço de destino com os valores sugeridos pelo hook.
4. THE Sistema_Frontend SHALL permitir que o operador altere manualmente qualquer endereço de destino após aceitar as sugestões, sem restrição.
5. WHILE o Hook_Enderecamento_Inteligente está carregando as sugestões, THE Sistema_Frontend SHALL exibir um indicador de carregamento (loader) na seção de sugestões.
6. IF o Hook_Enderecamento_Inteligente retorna erro ou não retorna sugestões, THEN THE Sistema_Frontend SHALL exibir mensagem informativa e permitir que o operador preencha os endereços manualmente sem impedimento.
7. WHEN o operador confirma o endereçamento manual, THE Sistema_Frontend SHALL utilizar o hook `useConfirmarDistribuicao` para persistir as alocações definidas.
