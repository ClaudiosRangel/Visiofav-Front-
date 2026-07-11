# Requirements Document

## Introduction

Este documento especifica os requisitos para adicionar suporte ao logotipo de
Empresa no frontend do Vizor WMS/ERP, especificamente no formulário de
criação/edição de empresa (`EmpresaModal.tsx`, usado tanto no
Modo_Gerenciar_Empresas quanto no fluxo de criação rápida via
Rodapé_Acesso_Rápido da tela de seleção de empresa).

O backend (`VisioFab.Wms.Back`, spec `logo-empresa`) já expõe o contrato
necessário e é tratado como fixo por este documento: o campo `logo` é
trafegado como string base64 (com ou sem prefixo `data:image/...;base64,`)
embutida no corpo JSON de `POST /empresas` e `PUT /empresas/:id`, aceitando
`string | null | undefined` — ausência do campo mantém o valor atual, `null`
remove o logo, e uma string define/atualiza o logo. O backend valida
formato (PNG/JPEG) e tamanho (máximo 2.000.000 bytes de conteúdo binário
decodificado) de forma independente do client e retorna 400 com mensagem em
português quando o conteúdo é inválido. `GET /empresas/minhas` passará a
retornar o campo `logo` (string base64/data-URL ou `null`) para cada
empresa.

**Premissas validadas (sem necessidade de alteração nesta funcionalidade):**

- `CardEmpresa.tsx` e `selecaoEmpresa.utils.ts` (spec `selecao-empresa-redesign`)
  já implementam toda a lógica de exibição do logo no avatar da tela de
  seleção (`deveExibirLogoNoAvatar`, fallback de iniciais). Nenhuma alteração
  é necessária nesses arquivos.

**Fora de escopo nesta versão:**

- Exibição de miniatura/coluna de logo na tabela administrativa do
  Modo_Gerenciar_Empresas. O endpoint administrativo `GET /empresas` não
  expõe o campo `logo` nesta versão do backend.

## Glossary

- **Sistema_Frontend**: A aplicação frontend Next.js 15 (App Router, Mantine 7, TanStack Query, TypeScript) do Vizor WMS/ERP.
- **Sistema_Backend**: A API Fastify + Prisma do Vizor WMS/ERP (`VisioFab.Wms.Back`), tratada como contrato fixo por este documento.
- **EmpresaModal**: O componente `EmpresaModal.tsx`, formulário React Hook Form + Zod usado para criar e editar Empresa, contendo o bloco de campos principais (Razão Social, Nome Fantasia, CNPJ) fora das Tabs, seguido de Tabs com dados adicionais.
- **Campo_Logo**: O controle de avatar clicável exibido no bloco de campos principais do EmpresaModal, responsável por exibir o preview do logotipo atual e permitir selecionar, trocar ou remover um arquivo de imagem.
- **Arquivo_Selecionado**: O arquivo de imagem escolhido pelo usuário através do Campo_Logo, antes de ser convertido para base64.
- **Estado_Logo**: O valor do campo `logo` no estado do formulário do EmpresaModal, que assume um dos três significados: `undefined` (nenhuma alteração — usuário não tocou no Campo_Logo), `null` (remoção explícita de um logotipo já cadastrado) ou uma string base64/data-URL (logotipo novo ou trocado).
- **Validador_Logo_Client**: A lógica client-side responsável por verificar, no momento da seleção de um Arquivo_Selecionado, se o tipo MIME pertence ao conjunto `{image/png, image/jpeg}` e se o tamanho em bytes do arquivo não excede 2.097.152 bytes (2MB), antes de qualquer conversão ou envio.
- **Notificação_Erro**: Mensagem exibida ao usuário via `notifications.show({ color: 'red' })`, seguindo o padrão já utilizado no projeto (`DropzonePdf.tsx`, `OcrUploadDialog.tsx`).
- **Mutação_Criar**: A mutation React Query que executa `POST /empresas` a partir do EmpresaModal.
- **Mutação_Atualizar**: A mutation React Query que executa `PUT /empresas/:id` a partir do EmpresaModal.
- **Modo_Gerenciar_Empresas**: Modo administrativo da tela de seleção de empresa que exibe a tabela de Empresas com CRUD, conforme já definido no spec `selecao-empresa-redesign`.

## Requirements

### Requirement 1: Campo de Logo no EmpresaModal

**User Story:** Como usuário administrativo cadastrando ou editando uma empresa, eu quero ver e definir o logotipo da empresa junto aos dados principais do formulário, para que eu configure a identidade visual da empresa sem precisar navegar por abas do formulário.

#### Acceptance Criteria

1. THE EmpresaModal SHALL exibir o Campo_Logo no bloco de campos principais, fora das Tabs, posicionado ao lado dos campos Razão Social, Nome Fantasia e CNPJ.
2. THE EmpresaModal SHALL renderizar o Campo_Logo como um avatar clicável que abre o seletor de arquivos do sistema operacional ao ser clicado.
3. WHERE o Estado_Logo contém uma string base64/data-URL (logotipo novo, trocado ou já cadastrado), THE EmpresaModal SHALL exibir essa imagem como preview dentro do Campo_Logo.
4. WHERE o Estado_Logo é `undefined` ou `null`, THE EmpresaModal SHALL exibir um estado padrão de avatar sem imagem (placeholder) dentro do Campo_Logo.
5. WHERE o Estado_Logo contém uma string base64/data-URL, THE EmpresaModal SHALL exibir um controle para remover o logotipo atual, além do controle para trocá-lo.
6. WHEN o usuário aciona o controle de remoção do logotipo descrito no Acceptance Criteria 1.5, THE EmpresaModal SHALL definir o Estado_Logo como `null` e atualizar o preview do Campo_Logo para o estado padrão sem imagem.

### Requirement 2: Validação Client-Side do Arquivo Selecionado

**User Story:** Como usuário selecionando um arquivo de logotipo, eu quero receber feedback imediato quando o arquivo escolhido não é aceitável, para que eu corrija a seleção sem esperar uma resposta do servidor.

#### Acceptance Criteria

1. WHEN o usuário seleciona um Arquivo_Selecionado através do Campo_Logo, THE Sistema_Frontend SHALL executar o Validador_Logo_Client sobre esse arquivo antes de iniciar qualquer conversão para base64 ou alteração do Estado_Logo.
2. IF o tipo MIME do Arquivo_Selecionado não pertence ao conjunto `{image/png, image/jpeg}`, THEN THE Validador_Logo_Client SHALL rejeitar o arquivo, THE Sistema_Frontend SHALL exibir uma Notificação_Erro informando que apenas arquivos PNG ou JPG são aceitos, e THE Sistema_Frontend SHALL manter o Estado_Logo inalterado.
3. IF o tamanho em bytes do Arquivo_Selecionado exceder 2.097.152 bytes (2MB), THEN THE Validador_Logo_Client SHALL rejeitar o arquivo, THE Sistema_Frontend SHALL exibir uma Notificação_Erro informando que o tamanho máximo permitido é 2MB, e THE Sistema_Frontend SHALL manter o Estado_Logo inalterado.
4. WHEN o Arquivo_Selecionado satisfaz simultaneamente o tipo MIME permitido e o limite de tamanho, THE Validador_Logo_Client SHALL aprovar o arquivo e THE Sistema_Frontend SHALL prosseguir com a conversão descrita no Requirement 3.
5. THE Validador_Logo_Client SHALL ser implementado como uma função pura, independente de estado de componente React ou de chamadas de rede, recebendo o tipo MIME e o tamanho em bytes do arquivo como entrada e retornando um resultado de aprovação ou rejeição com o motivo da rejeição.

### Requirement 3: Conversão para Base64 e Estado do Formulário

**User Story:** Como usuário que selecionou um arquivo de logotipo válido, eu quero que o arquivo seja preparado automaticamente para envio, para que eu não precise realizar nenhuma conversão manual.

#### Acceptance Criteria

1. WHEN o Validador_Logo_Client aprova um Arquivo_Selecionado, THE Sistema_Frontend SHALL converter esse arquivo para uma string base64 (data URL) e SHALL definir o Estado_Logo com essa string.
2. THE EmpresaModal SHALL declarar o campo `logo` no schema Zod do formulário com o tipo `string | null | undefined`, mantendo compatibilidade com os demais campos opcionais já existentes no schema.
3. IF a conversão do Arquivo_Selecionado para base64 falhar por qualquer motivo (arquivo corrompido, erro de leitura), THEN THE Sistema_Frontend SHALL exibir uma Notificação_Erro informando a falha na leitura do arquivo e SHALL manter o Estado_Logo inalterado.

### Requirement 4: Decisão do Valor Enviado no Payload

**User Story:** Como desenvolvedor mantendo a integração com o backend, eu quero que o payload enviado reflita corretamente a intenção do usuário (nenhuma alteração, remoção ou novo logotipo), para que o backend aplique o comportamento correto definido em seu contrato.

#### Acceptance Criteria

1. WHILE o usuário está editando uma Empresa existente e não interage com o Campo_Logo durante a sessão de edição, THE EmpresaModal SHALL manter o Estado_Logo como `undefined`, resultando na omissão do campo `logo` no corpo enviado à Mutação_Atualizar.
2. WHEN o usuário remove um logotipo já cadastrado através do controle descrito no Acceptance Criteria 1.6, THE EmpresaModal SHALL incluir o campo `logo` com valor `null` no corpo enviado à Mutação_Atualizar.
3. WHEN o usuário seleciona e tem aprovado um novo Arquivo_Selecionado (seja para definir um logotipo inexistente ou trocar um logotipo já cadastrado), THE EmpresaModal SHALL incluir o campo `logo` com a string base64/data-URL correspondente no corpo enviado à Mutação_Criar ou à Mutação_Atualizar.
4. WHEN o usuário cria uma nova Empresa sem selecionar nenhum Arquivo_Selecionado, THE EmpresaModal SHALL enviar o corpo da Mutação_Criar sem o campo `logo` ou com o campo `logo` igual a `null`, e THE Sistema_Frontend SHALL considerar essa submissão válida, sem exibir erro de validação relacionado ao Campo_Logo.
5. THE Sistema_Frontend SHALL implementar a determinação do valor a incluir no payload (omitir, `null` ou string base64) como uma função pura que recebe o Estado_Logo e o modo do formulário (criação ou edição) como entrada, sem depender de efeitos colaterais de rede ou de estado de componente React.

### Requirement 5: Envio do Logo nas Mutations de Criação e Atualização

**User Story:** Como usuário administrativo salvando uma empresa, eu quero que o logotipo configurado seja persistido junto aos demais dados da empresa, para que eu não precise de uma etapa de salvamento separada.

#### Acceptance Criteria

1. WHEN o usuário submete o EmpresaModal em modo de criação, THE EmpresaModal SHALL incluir o valor determinado pelo Requirement 4 no corpo da requisição enviada pela Mutação_Criar.
2. WHEN o usuário submete o EmpresaModal em modo de edição, THE EmpresaModal SHALL incluir o valor determinado pelo Requirement 4 no corpo da requisição enviada pela Mutação_Atualizar.
3. WHEN a Mutação_Criar ou a Mutação_Atualizar retorna sucesso, THE EmpresaModal SHALL invalidar a query `['empresas-admin']` e a query `['empresas-minhas']`.
4. WHEN o EmpresaModal é reaberto em modo de edição para uma Empresa que possui o campo `logo` preenchido em `editData`, THE EmpresaModal SHALL inicializar o Estado_Logo com o valor de `editData.logo` e exibir esse valor como preview no Campo_Logo.
5. WHEN o EmpresaModal é reaberto em modo de edição para uma Empresa cujo campo `logo` em `editData` é `null` ou ausente, THE EmpresaModal SHALL inicializar o Estado_Logo como `null` e exibir o estado padrão sem imagem no Campo_Logo.

### Requirement 6: Exibição de Erros Retornados pelo Backend

**User Story:** Como usuário que envia um logotipo rejeitado pelo backend, eu quero entender o motivo da rejeição e poder corrigir minha submissão, para que eu não perca os demais dados já preenchidos no formulário.

#### Acceptance Criteria

1. IF a Mutação_Criar ou a Mutação_Atualizar retornar um erro de status 400 relacionado à validação do campo `logo`, THEN THE EmpresaModal SHALL exibir uma Notificação_Erro com a mensagem retornada pelo Sistema_Backend, sem fechar o EmpresaModal.
2. WHEN o EmpresaModal permanece aberto após um erro retornado pelo Sistema_Backend conforme o Acceptance Criteria 6.1, THE EmpresaModal SHALL preservar os valores já preenchidos nos demais campos do formulário, permitindo que o usuário corrija o Campo_Logo e reenvie a submissão.

### Requirement 7: Premissas Validadas e Escopo Excluído

**User Story:** Como desenvolvedor implementando esta funcionalidade, eu quero ter clareza sobre quais componentes não precisam de alteração, para evitar retrabalho ou modificações desnecessárias.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL implementar os Requirements 1 a 6 deste documento sem exigir qualquer alteração em `CardEmpresa.tsx` ou `selecaoEmpresa.utils.ts`, uma vez que a exibição do logotipo na tela de seleção de empresa já está implementada nesses arquivos.
2. THE Sistema_Frontend SHALL manter o Modo_Gerenciar_Empresas sem coluna ou miniatura de logotipo na tabela administrativa nesta versão, uma vez que o endpoint `GET /empresas` não expõe o campo `logo`.
