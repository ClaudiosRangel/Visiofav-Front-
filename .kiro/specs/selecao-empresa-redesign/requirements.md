# Requirements Document

## Introduction

Este documento especifica os requisitos para o redesenho da tela de seleção de empresa (`/selecionar-empresa`) do Vizor WMS/ERP. Hoje, após o login, o usuário é sempre redirecionado para essa tela — mesmo quando possui acesso a apenas uma empresa — e a tela exibe um grid simples de cards (Mantine `Card` + `SimpleGrid`) contendo razão social, nome fantasia e CNPJ, sem busca, sem indicação de matriz/filial, sem endereço, sem avatar/ícone de empresa e sem rodapé de atalhos.

O redesenho tem dois objetivos centrais:

1. **Pular a seleção manual quando não há escolha real** — se o usuário autenticado tem acesso a exatamente 1 (uma) empresa, a tela não deve ser exibida; a empresa é selecionada automaticamente e o usuário é levado direto para `/modulos`.
2. **Redesenho visual da tela** — adicionar busca, cards mais ricos (avatar com iniciais ou logo, endereço, botão de ação) e um rodapé fixo de "Acesso rápido", mantendo o modo "Gerenciar Empresas" (CRUD administrativo) inalterado em sua funcionalidade e posição. O badge "Matriz" sugerido inicialmente foi excluído do escopo (ver Assumption 2 abaixo).

O frontend utiliza Next.js 15 (App Router), Mantine 7, TypeScript, TanStack Query e Axios. O backend (`VisioFab.Wms.Back`) utiliza Fastify + Prisma 6 + PostgreSQL.

### Dependências de backend (fora do escopo de implementação deste spec)

Este spec cobre apenas o frontend (`VisioFab.Wms.Front`). Duas Acceptance Criteria abaixo (3.2 e 3.4) dependem de uma alteração no backend (`VisioFab.Wms.Back`) que **não será implementada por este spec** — ela deve ser tratada em um spec de backend próprio antes ou em paralelo à implementação deste frontend:

- **Assumption 1**: O endpoint `GET /empresas/minhas` (`empresa-selector.routes.ts`) atualmente retorna apenas `{ id, razaoSocial, nomeFantasia, cnpj }`. Os campos `cidade`, `uf` e `logo` já existem no `model Empresa` do Prisma (usados hoje apenas no endpoint administrativo `GET /empresas` e no endpoint `GET /empresas/minha`), mas não são expostos por `GET /empresas/minhas`. Este spec assume que o backend será estendido para incluir `cidade`, `uf` e `logo` na resposta de `GET /empresas/minhas` antes da implementação dos Requirements 3.2 e 3.4.
- **Assumption 2**: O conceito de "Matriz/Filial" não existe hoje no `model Empresa` (não há campo booleano equivalente). Por decisão de produto, o badge "Matriz" **foi excluído do escopo deste redesenho** e não deve ser implementado nesta versão — poderá ser adicionado em iteração futura quando o backend suportar o conceito.

## Glossary

- **Sistema_Frontend**: A aplicação frontend Next.js 15 (App Router, Mantine 7, TanStack Query, TypeScript) do Vizor WMS/ERP
- **Sistema_Backend**: A API Fastify + Prisma do Vizor WMS/ERP (`VisioFab.Wms.Back`)
- **Usuário**: Pessoa autenticada no sistema, vinculada a uma ou mais Empresas via `UsuarioEmpresa`
- **Empresa**: Registro do tenant (razão social, nome fantasia, CNPJ e demais dados) ao qual o Usuário pode ter acesso
- **Tela_Seleção_Empresa**: A página `/selecionar-empresa` (`SelecionarEmpresaPage`), responsável por listar as Empresas do Usuário e permitir a seleção
- **Card_Empresa**: Componente visual que representa uma Empresa na Tela_Seleção_Empresa, contendo avatar, nome, razão social, CNPJ, endereço (quando disponível) e botão de ação
- **Modo_Gerenciar_Empresas**: Modo alternativo da Tela_Seleção_Empresa, restrito a Perfil_Administrativo, que exibe uma tabela com CRUD de Empresas (criar, editar, inativar)
- **Perfil_Administrativo**: Perfil de usuário igual a `SUPER_ADMIN`, `ADMIN` ou `DIRETOR`
- **EmpresaProvider**: Contexto React (`EmpresaProvider.tsx`) responsável por manter a Empresa selecionada, buscar módulos autorizados e expor `selecionarEmpresa`, `trocarEmpresa` e `logout`
- **Barra_de_Busca**: Campo de texto no topo da Tela_Seleção_Empresa usado para filtrar Empresas por nome no lado do cliente
- **Rodapé_Acesso_Rápido**: Seção fixa na parte inferior da Tela_Seleção_Empresa contendo atalhos: "Meus Dados", "Nova Empresa" (somente Perfil_Administrativo) e "Central de Ajuda"
- **Seleção_Automática**: Fluxo em que o Sistema_Frontend seleciona a única Empresa disponível para o Usuário sem exibir a Tela_Seleção_Empresa, navegando direto para `/modulos`

## Requirements

### Requirement 1: Seleção Automática quando há apenas uma Empresa

**User Story:** Como usuário que tem acesso a apenas uma empresa, eu quero ser levado direto para os módulos após o login, sem precisar clicar em um card de seleção, para que eu economize um passo desnecessário no meu fluxo de acesso.

#### Acceptance Criteria

1. WHEN o Usuário autenticado possui acesso a exatamente 1 (uma) Empresa e acessa a rota `/selecionar-empresa` (diretamente pela URL ou por redirecionamento pós-login), THE Sistema_Frontend SHALL executar a Seleção_Automática dessa Empresa e navegar para `/modulos` sem renderizar a Tela_Seleção_Empresa
2. WHEN o Usuário autenticado possui acesso a 2 (duas) ou mais Empresas e acessa a rota `/selecionar-empresa`, THE Sistema_Frontend SHALL renderizar a Tela_Seleção_Empresa normalmente, exibindo um Card_Empresa para cada Empresa disponível
3. IF o Usuário autenticado não possui acesso a nenhuma Empresa, THEN THE Sistema_Frontend SHALL exibir mensagem informando que não há empresas disponíveis, sem executar a Seleção_Automática
4. WHEN a Seleção_Automática é executada, THE Sistema_Frontend SHALL seguir o mesmo fluxo de seleção manual (obter token/refreshToken via `POST /empresas/{id}/selecionar`, buscar módulos autorizados e persistir a Empresa selecionada) antes de navegar para `/modulos`
5. IF a Seleção_Automática falhar (erro na requisição de seleção ou de módulos), THEN THE Sistema_Frontend SHALL exibir a Tela_Seleção_Empresa com mensagem de erro, permitindo que o Usuário tente selecionar a Empresa manualmente
6. WHEN o Usuário aciona `EmpresaProvider.trocarEmpresa` e possui acesso a exatamente 1 (uma) Empresa, THE Sistema_Frontend SHALL executar a Seleção_Automática dessa Empresa e navegar direto para `/modulos`, sem exibir a Tela_Seleção_Empresa
7. WHILE o Usuário possui acesso a exatamente 1 (uma) Empresa, THE Sistema_Frontend SHALL ocultar o controle "Trocar Empresa" no header (ícone e item de menu), já que não há Empresa alternativa para a qual trocar

---

### Requirement 2: Busca de Empresas na Tela de Seleção

**User Story:** Como usuário com acesso a várias empresas, eu quero buscar uma empresa pelo nome, para que eu encontre rapidamente a empresa que preciso acessar sem precisar rolar a lista inteira.

#### Acceptance Criteria

1. WHEN a Tela_Seleção_Empresa é exibida com 2 (duas) ou mais Empresas disponíveis, THE Sistema_Frontend SHALL exibir a Barra_de_Busca no topo da tela, acima do grid de Card_Empresa
2. WHEN o Usuário digita um termo na Barra_de_Busca, THE Sistema_Frontend SHALL filtrar, no lado do cliente, os Card_Empresa exibidos para conter apenas Empresas cuja razão social ou nome fantasia contenha o termo digitado, sem diferenciação entre maiúsculas e minúsculas
3. WHEN o termo digitado na Barra_de_Busca não corresponde a nenhuma Empresa, THE Sistema_Frontend SHALL exibir mensagem indicando que nenhuma empresa foi encontrada para o termo buscado
4. WHEN o Usuário limpa o conteúdo da Barra_de_Busca, THE Sistema_Frontend SHALL exibir novamente todos os Card_Empresa disponíveis

---

### Requirement 3: Card de Empresa Redesenhado

**User Story:** Como usuário selecionando uma empresa, eu quero ver informações mais completas e visualmente organizadas de cada empresa, para que eu identifique com confiança qual empresa estou selecionando antes de acessá-la.

#### Acceptance Criteria

1. THE Sistema_Frontend SHALL exibir, em cada Card_Empresa, um avatar circular contendo as iniciais da Empresa (derivadas do nome fantasia, ou da razão social quando o nome fantasia não estiver preenchido) como conteúdo padrão do avatar
2. WHERE a Empresa possui um logotipo cadastrado (campo `logo`), THE Sistema_Frontend SHALL exibir a imagem do logotipo no avatar do Card_Empresa em vez das iniciais
3. THE Sistema_Frontend SHALL exibir, em cada Card_Empresa, o nome fantasia em destaque (ou a razão social, quando o nome fantasia não estiver preenchido), a razão social e o CNPJ formatado no padrão `XX.XXX.XXX/XXXX-XX`
4. WHERE a Empresa possui cidade e UF cadastrados, THE Sistema_Frontend SHALL exibir a localização no formato `Cidade/UF` no Card_Empresa
5. WHERE a especificação visual do redesenho define uma variação de Card_Empresa sem a linha de localização (por exemplo, para telas menores ou densidade de card compacta), THE Sistema_Frontend SHALL omitir essa linha mesmo quando a Empresa possuir cidade e UF cadastrados
6. IF a Empresa não possui cidade ou UF cadastrados, THEN THE Sistema_Frontend SHALL omitir a linha de localização do Card_Empresa, sem exibir espaço vazio ou texto de erro, independentemente da variação visual aplicada
7. THE Sistema_Frontend SHALL exibir um botão "Acessar empresa →" no rodapé de cada Card_Empresa
8. WHEN o Usuário clica no botão "Acessar empresa →" ou em qualquer outra área clicável do Card_Empresa, THE Sistema_Frontend SHALL selecionar a Empresa correspondente (mesmo comportamento de `selecionarEmpresa` hoje aplicado ao clique no card) e navegar para `/modulos`

---

### Requirement 4: Rodapé de Acesso Rápido

**User Story:** Como usuário na tela de seleção de empresa, eu quero acessar atalhos comuns a partir de um rodapé fixo, para que eu não precise navegar por outras telas para ações frequentes.

#### Acceptance Criteria

1. WHEN a Tela_Seleção_Empresa é exibida (fora do Modo_Gerenciar_Empresas), THE Sistema_Frontend SHALL exibir o Rodapé_Acesso_Rápido fixado na parte inferior da tela
2. THE Sistema_Frontend SHALL exibir, no Rodapé_Acesso_Rápido, o atalho "Meus Dados" visível para todos os Usuários autenticados
3. WHERE o Usuário possui Perfil_Administrativo, THE Sistema_Frontend SHALL exibir, no Rodapé_Acesso_Rápido, o atalho "Nova Empresa"
4. THE Sistema_Frontend SHALL exibir, no Rodapé_Acesso_Rápido, o atalho "Central de Ajuda" visível para todos os Usuários autenticados
5. WHEN o Usuário clica no atalho "Meus Dados", THE Sistema_Frontend SHALL navegar para a tela de dados pessoais do Usuário
6. WHEN o Usuário com Perfil_Administrativo clica no atalho "Nova Empresa", THE Sistema_Frontend SHALL abrir o formulário de criação de Empresa (mesmo modal `EmpresaModal` hoje utilizado no Modo_Gerenciar_Empresas)
7. WHEN o Usuário clica no atalho "Central de Ajuda", THE Sistema_Frontend SHALL navegar para o canal de suporte/ajuda do sistema

---

### Requirement 5: Preservação do Modo Gerenciar Empresas

**User Story:** Como administrador, eu quero continuar gerenciando (criar, editar, inativar) empresas a partir da tela de seleção redesenhada, para que eu não perca uma funcionalidade que já uso hoje.

#### Acceptance Criteria

1. WHERE o Usuário possui Perfil_Administrativo, THE Sistema_Frontend SHALL exibir o botão "Gerenciar Empresas" no topo da Tela_Seleção_Empresa, na mesma posição relativa (ao lado do título) já utilizada na implementação atual
2. IF o Usuário não possui Perfil_Administrativo, THEN THE Sistema_Frontend SHALL ocultar o botão "Gerenciar Empresas"
3. WHEN o Usuário com Perfil_Administrativo clica no botão "Gerenciar Empresas", THE Sistema_Frontend SHALL exibir o Modo_Gerenciar_Empresas com a tabela de Empresas e as ações de criar, editar e inativar, preservando o comportamento já existente
4. WHILE o Modo_Gerenciar_Empresas está ativo, THE Sistema_Frontend SHALL exibir um botão para retornar à Tela_Seleção_Empresa (mesmo comportamento do botão "Voltar para Seleção" já existente), garantindo que o Usuário sempre possa retornar à Tela_Seleção_Empresa sem depender de navegação por URL
5. WHILE o Modo_Gerenciar_Empresas está ativo, THE Sistema_Frontend SHALL ocultar a Barra_de_Busca e o Rodapé_Acesso_Rápido do redesenho, mantendo apenas os elementos da tabela administrativa
