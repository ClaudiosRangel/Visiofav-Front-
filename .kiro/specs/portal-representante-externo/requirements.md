# Requirements Document

## Introduction

Aplicação web mobile-first (força de vendas) para representantes comerciais externos, acessada via subdomínio `representante.vizorerp.com.br`. Construída como route group `src/app/(portal-rep)/` no projeto Next.js existente, com layout próprio (sem sidebar/header do ERP), utilizando Mantine 7 com tema verde/branco. O app é instalável como PWA, responsivo (celular, tablet, desktop) e consome exclusivamente a API já implementada em `/api/portal-rep/`.

## Glossary

- **Portal_Rep**: A aplicação web frontend do representante comercial externo
- **Representante**: Usuário do portal — um vendedor externo com credenciais próprias
- **Shell_PWA**: Estrutura mínima da aplicação (layout, navegação, service worker) que funciona offline
- **Bottom_Nav**: Barra de navegação fixa no rodapé da tela em dispositivos móveis (padrão nativo)
- **Sidebar_Desktop**: Painel lateral de navegação exibido em telas grandes (≥768px)
- **JWT_Token**: Token de autenticação armazenado em localStorage
- **Refresh_Token**: Token de longa duração usado para renovar o JWT expirado
- **Pull_to_Refresh**: Gesto de puxar para baixo em listas para recarregar dados
- **Pipeline**: Fluxo visual do ciclo de vida de um pedido (Orçamento → PV → OP → Produção → Expedição → Entregue)
- **Solicitacao_Orcamento**: Pedido de cotação criado pelo representante para um cliente
- **Comissao_Projetada**: Valor de comissão estimado para pedidos ainda não creditados
- **Comissao_Realizada**: Valor de comissão efetivamente creditado conforme critério configurado
- **Carteira_Clientes**: Conjunto de clientes vinculados ao representante logado
- **Campos_Fiscais**: Dados fiscais do cliente (CNPJ/CPF, IE, razão social) que exigem aprovação administrativa para alteração
- **Notificacao**: Mensagem do sistema para o representante (mudança de status, orçamento calculado, etc.)
- **Tap_Target**: Área mínima de toque em interfaces mobile (≥44px × 44px conforme WCAG)
- **Breakpoint_Mobile**: Largura de tela < 768px
- **Breakpoint_Desktop**: Largura de tela ≥ 768px

## Requirements

### Requisito 1: Instalação PWA e Funcionamento Offline

**User Story:** Como representante, eu quero instalar o portal na tela inicial do celular e ter acesso ao shell mesmo sem internet, para que a experiência seja equivalente a um app nativo.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL disponibilizar um manifesto PWA válido (`manifest.json`) com `name`, `short_name`, `start_url`, `display: standalone`, `theme_color` verde e ícones nos tamanhos 192px e 512px
2. THE Portal_Rep SHALL registrar um service worker que faça cache do Shell_PWA (HTML, CSS, JS, fontes, ícones) na primeira visita
3. WHILE o dispositivo estiver offline, THE Portal_Rep SHALL exibir o Shell_PWA com a navegação e uma mensagem informativa de que não há conexão
4. WHEN o dispositivo recuperar a conexão, THE Portal_Rep SHALL recarregar automaticamente os dados da tela ativa sem necessidade de ação do usuário
5. THE Portal_Rep SHALL exibir o prompt de instalação nativo ("Adicionar à tela inicial") quando o navegador oferecer suporte

---

### Requisito 2: Layout Responsivo com Navegação Adaptativa

**User Story:** Como representante, eu quero que o portal se adapte ao meu dispositivo (celular, tablet, desktop), para que eu tenha a melhor experiência em qualquer tela.

#### Critérios de Aceitação

1. WHILE a largura de tela for menor que Breakpoint_Mobile, THE Portal_Rep SHALL exibir a Bottom_Nav fixa no rodapé com ícones e labels para as seções principais (Dashboard, Clientes, Orçamentos, Pipeline, Mais)
2. WHILE a largura de tela for igual ou maior que Breakpoint_Desktop, THE Portal_Rep SHALL exibir a Sidebar_Desktop fixa à esquerda com links para todas as seções
3. THE Portal_Rep SHALL ocultar a Sidebar_Desktop em telas menores que Breakpoint_Desktop
4. THE Portal_Rep SHALL ocultar a Bottom_Nav em telas iguais ou maiores que Breakpoint_Desktop
5. THE Portal_Rep SHALL garantir que todos os Tap_Target tenham dimensão mínima de 44px × 44px em dispositivos de toque
6. THE Portal_Rep SHALL aplicar o tema visual verde/branco diferenciado do ERP (azul) em todas as telas
7. THE Portal_Rep SHALL exibir o badge de notificações não lidas no ícone de notificações tanto na Bottom_Nav quanto na Sidebar_Desktop
8. WHEN o item "Mais" da Bottom_Nav for tocado, THE Portal_Rep SHALL exibir um menu com as seções secundárias (Comissões, Notificações, Perfil)

---

### Requisito 3: Autenticação JWT com Refresh Token

**User Story:** Como representante, eu quero fazer login com meu e-mail e senha e permanecer autenticado entre sessões, para que eu não precise digitar credenciais repetidamente.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir a tela de login com campos de e-mail, senha e seleção de empresa
2. WHEN o representante submeter credenciais válidas via POST `/api/portal-rep/auth/login`, THE Portal_Rep SHALL armazenar o JWT_Token e o Refresh_Token em localStorage
3. WHEN o JWT_Token expirar e uma requisição retornar HTTP 401, THE Portal_Rep SHALL automaticamente chamar POST `/api/portal-rep/auth/refresh` com o Refresh_Token para obter novos tokens
4. IF o Refresh_Token também estiver expirado ou inválido, THEN THE Portal_Rep SHALL redirecionar o representante para a tela de login e limpar o localStorage
5. WHEN o representante tocar no botão "Sair", THE Portal_Rep SHALL limpar todos os tokens do localStorage e redirecionar para a tela de login
6. THE Portal_Rep SHALL incluir o JWT_Token no header `Authorization: Bearer {token}` de toda requisição autenticada
7. WHEN a resposta do login indicar `senhaTemporaria === true`, THE Portal_Rep SHALL redirecionar imediatamente para a tela de troca de senha obrigatória
8. IF o login retornar erro HTTP 401 com code `CONTA_BLOQUEADA`, THEN THE Portal_Rep SHALL exibir mensagem informando que a conta está temporariamente bloqueada
9. IF o login retornar erro HTTP 401 com credenciais inválidas, THEN THE Portal_Rep SHALL exibir mensagem de erro genérica sem revelar qual campo está incorreto
10. THE Portal_Rep SHALL desabilitar o botão de login durante o processamento da requisição e exibir indicador de carregamento

---

### Requisito 4: Troca de Senha Obrigatória

**User Story:** Como representante com senha temporária, eu quero ser forçado a criar uma nova senha no primeiro acesso, para que minha conta fique segura.

#### Critérios de Aceitação

1. WHILE `senhaTemporaria === true`, THE Portal_Rep SHALL bloquear a navegação para qualquer tela funcional e exibir apenas a tela de troca de senha
2. THE Portal_Rep SHALL exibir campos de senha atual (temporária), nova senha e confirmação de nova senha
3. WHEN a nova senha for diferente da confirmação, THE Portal_Rep SHALL exibir erro de validação em tempo real sem submeter o formulário
4. WHEN a troca de senha for bem-sucedida via POST `/api/portal-rep/auth/trocar-senha`, THE Portal_Rep SHALL redirecionar para o Dashboard
5. IF a API retornar erro na troca de senha, THEN THE Portal_Rep SHALL exibir a mensagem de erro retornada sem limpar os campos preenchidos

---

### Requisito 5: Dashboard com Cards de Resumo

**User Story:** Como representante, eu quero ver um resumo visual da minha situação comercial ao abrir o app, para que eu tenha visão rápida de orçamentos, pipeline e comissões.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir na tela de Dashboard um card de "Orçamentos Pendentes" com a contagem de solicitações com status PENDENTE
2. THE Portal_Rep SHALL exibir na tela de Dashboard um card de "Pipeline" com resumo de pedidos por status (quantidade em cada etapa)
3. THE Portal_Rep SHALL exibir na tela de Dashboard um card de "Comissão do Mês" com os valores de Comissao_Projetada e Comissao_Realizada do mês corrente
4. WHEN um card do Dashboard for tocado, THE Portal_Rep SHALL navegar para a seção correspondente (Orçamentos, Pipeline ou Comissões)
5. THE Portal_Rep SHALL carregar os dados do Dashboard em paralelo (3 requisições simultâneas) e exibir skeletons individuais por card durante o carregamento
6. THE Portal_Rep SHALL suportar Pull_to_Refresh na tela de Dashboard para recarregar todos os cards

---

### Requisito 6: Listagem de Clientes da Carteira

**User Story:** Como representante, eu quero ver todos os clientes da minha carteira com busca e filtragem, para que eu encontre rapidamente o cliente desejado.

#### Critérios de Aceitação

1. WHEN a tela de Clientes for aberta, THE Portal_Rep SHALL carregar a lista de clientes via GET `/api/portal-rep/clientes` e exibir nome, CNPJ/CPF, cidade/UF e telefone
2. THE Portal_Rep SHALL exibir um campo de busca que filtra localmente por nome, CNPJ/CPF ou cidade
3. THE Portal_Rep SHALL exibir a lista em formato de cards em mobile e tabela em desktop
4. THE Portal_Rep SHALL suportar Pull_to_Refresh para recarregar a lista de clientes
5. WHEN um cliente for tocado na lista, THE Portal_Rep SHALL navegar para a tela de detalhe/edição do cliente
6. THE Portal_Rep SHALL exibir um botão flutuante (FAB) em mobile ou botão no cabeçalho em desktop para cadastrar novo cliente

---

### Requisito 7: Cadastro de Novo Cliente

**User Story:** Como representante, eu quero cadastrar novos clientes/prospects diretamente pelo portal, para que eu agilize o processo comercial sem depender do back-office.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir formulário de cadastro com campos: razão social, nome fantasia, CPF/CNPJ, inscrição estadual, telefone, e-mail, endereço (logradouro, número, complemento, bairro, cidade, UF, CEP)
2. WHEN o CPF/CNPJ for digitado, THE Portal_Rep SHALL validar o formato e os dígitos verificadores em tempo real (client-side)
3. WHEN o formulário for submetido com dados válidos via POST `/api/portal-rep/clientes`, THE Portal_Rep SHALL exibir notificação de sucesso e navegar de volta para a lista de clientes
4. IF a API retornar HTTP 409 com code `DOCUMENTO_EXISTENTE`, THEN THE Portal_Rep SHALL exibir mensagem informando que o cliente já existe e oferecer opção de solicitar vinculação
5. THE Portal_Rep SHALL desabilitar o botão de salvar durante o processamento e exibir indicador de carregamento
6. WHEN o campo CEP for preenchido com 8 dígitos, THE Portal_Rep SHALL preencher automaticamente os campos de endereço (cidade, UF, bairro, logradouro) quando possível

---

### Requisito 8: Edição de Dados Complementares do Cliente

**User Story:** Como representante, eu quero editar dados complementares dos meus clientes (telefone, e-mail, endereço), para que eu mantenha o cadastro atualizado sem burocracia.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir os dados do cliente em formulário editável via PUT `/api/portal-rep/clientes/:id`
2. THE Portal_Rep SHALL permitir edição direta dos campos complementares: telefone, e-mail, endereço completo
3. THE Portal_Rep SHALL exibir os Campos_Fiscais (razão social, CNPJ/CPF, IE) como somente-leitura com indicação visual de que alteração requer aprovação
4. WHEN o representante tocar em "Solicitar alteração fiscal", THE Portal_Rep SHALL abrir formulário separado para preencher os novos valores fiscais
5. WHEN a solicitação de alteração fiscal for submetida via PUT `/api/portal-rep/clientes/:id/campos-fiscais`, THE Portal_Rep SHALL exibir mensagem informando que a solicitação foi enviada para aprovação
6. THE Portal_Rep SHALL exibir feedback de sucesso ou erro após salvar dados complementares

---

### Requisito 9: Criação de Solicitação de Orçamento

**User Story:** Como representante, eu quero criar solicitações de orçamento para meus clientes com lista de produtos e quantidades, para que o back-office calcule os preços.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir formulário de nova solicitação com seleção de cliente (da Carteira_Clientes) e lista de itens
2. THE Portal_Rep SHALL permitir adicionar múltiplos itens à solicitação, cada um com: nome/descrição do produto, quantidade e especificação técnica opcional
3. THE Portal_Rep SHALL permitir remover itens da solicitação antes do envio
4. WHEN a solicitação for submetida via POST `/api/portal-rep/solicitacoes-orcamento`, THE Portal_Rep SHALL exibir confirmação de sucesso e navegar para a listagem
5. THE Portal_Rep SHALL validar que ao menos 1 item foi adicionado antes de permitir o envio
6. THE Portal_Rep SHALL validar que a quantidade de cada item é maior que zero
7. THE Portal_Rep SHALL desabilitar o botão de enviar durante o processamento

---

### Requisito 10: Listagem e Detalhe de Solicitações de Orçamento

**User Story:** Como representante, eu quero ver minhas solicitações de orçamento com status e preços calculados, para que eu acompanhe o andamento e repasse valores aos clientes.

#### Critérios de Aceitação

1. WHEN a tela de Orçamentos for aberta, THE Portal_Rep SHALL carregar a lista via GET `/api/portal-rep/solicitacoes-orcamento` exibindo: cliente, status (badge colorido), data de criação e quantidade de itens
2. THE Portal_Rep SHALL permitir filtrar solicitações por status (PENDENTE, CALCULADO, ENVIADO, ACEITO, RECUSADO)
3. WHEN uma solicitação for tocada, THE Portal_Rep SHALL exibir a tela de detalhe via GET `/api/portal-rep/solicitacoes-orcamento/:id` com todos os itens e preços (quando disponíveis)
4. THE Portal_Rep SHALL exibir preço unitário e preço total por item apenas quando o status for CALCULADO ou posterior
5. THE Portal_Rep SHALL ocultar qualquer informação de custo ou margem — exibir apenas preço de venda
6. THE Portal_Rep SHALL suportar Pull_to_Refresh na listagem de solicitações
7. WHEN a solicitação estiver com status PENDENTE, THE Portal_Rep SHALL exibir botão "Cancelar" na tela de detalhe

---

### Requisito 11: Cancelamento de Solicitação de Orçamento

**User Story:** Como representante, eu quero cancelar solicitações de orçamento pendentes que não são mais necessárias, para que eu mantenha minha lista organizada.

#### Critérios de Aceitação

1. WHEN o representante tocar em "Cancelar" em uma solicitação PENDENTE, THE Portal_Rep SHALL exibir diálogo de confirmação
2. WHEN o cancelamento for confirmado, THE Portal_Rep SHALL enviar DELETE `/api/portal-rep/solicitacoes-orcamento/:id` e atualizar a listagem
3. THE Portal_Rep SHALL exibir o botão "Cancelar" apenas para solicitações com status PENDENTE
4. IF o cancelamento falhar (status já alterado no backend), THEN THE Portal_Rep SHALL exibir mensagem de erro e recarregar a solicitação

---

### Requisito 12: Visualização do Pipeline de Pedidos

**User Story:** Como representante, eu quero acompanhar visualmente o status de todos os pedidos dos meus clientes em uma timeline, para que eu saiba exatamente em que etapa cada pedido está.

#### Critérios de Aceitação

1. WHEN a tela de Pipeline for aberta, THE Portal_Rep SHALL carregar a lista via GET `/api/portal-rep/pipeline` exibindo: número do pedido, cliente, status atual e data de criação
2. THE Portal_Rep SHALL representar o status de cada pedido como uma timeline horizontal com os estágios: Orçamento → PV → OP → Produção → Expedição → Entregue
3. THE Portal_Rep SHALL destacar visualmente o estágio atual na timeline (cor diferente, ícone preenchido)
4. THE Portal_Rep SHALL permitir filtrar pedidos por status, cliente ou período
5. THE Portal_Rep SHALL suportar Pull_to_Refresh na listagem do pipeline
6. THE Portal_Rep SHALL exibir a lista em formato de cards com timeline compacta em mobile

---

### Requisito 13: Detalhe do Pipeline com Percentual de Produção

**User Story:** Como representante, eu quero ver o detalhe de um pedido específico com o percentual de produção, para que eu informe meu cliente sobre a previsão de entrega.

#### Critérios de Aceitação

1. WHEN um pedido for tocado na lista de pipeline, THE Portal_Rep SHALL carregar o detalhe via GET `/api/portal-rep/pipeline/:pedidoVendaId` e exibir a timeline completa com datas de cada transição
2. THE Portal_Rep SHALL exibir o percentual de produção como barra de progresso quando o status for "Produção"
3. THE Portal_Rep SHALL exibir informações do pedido: cliente, produtos, quantidade, data de criação e previsão de entrega
4. THE Portal_Rep SHALL ocultar qualquer informação de custo ou margem no detalhe do pedido

---

### Requisito 14: Comissões — Resumo Mensal

**User Story:** Como representante, eu quero ver um resumo mensal das minhas comissões com valores projetados e realizados, para que eu tenha controle da minha remuneração.

#### Critérios de Aceitação

1. WHEN a tela de Comissões for aberta, THE Portal_Rep SHALL carregar o resumo via GET `/api/portal-rep/comissoes` exibindo Comissao_Projetada e Comissao_Realizada do mês selecionado
2. THE Portal_Rep SHALL exibir o resumo em formato de card destacado com valores grandes e legíveis
3. THE Portal_Rep SHALL permitir navegar entre meses (anterior/próximo) para consultar histórico
4. THE Portal_Rep SHALL formatar valores monetários no padrão brasileiro (R$ X.XXX,XX)
5. THE Portal_Rep SHALL suportar Pull_to_Refresh na tela de comissões

---

### Requisito 15: Comissões — Detalhamento por Pedido

**User Story:** Como representante, eu quero ver o detalhamento das minhas comissões por pedido, para que eu entenda a composição dos valores.

#### Critérios de Aceitação

1. WHEN o representante tocar em "Ver detalhes" no card de comissões, THE Portal_Rep SHALL carregar o detalhamento via GET `/api/portal-rep/comissoes/detalhe` exibindo lista de pedidos com comissão individual
2. THE Portal_Rep SHALL exibir por pedido: número, cliente, valor da venda, percentual de comissão e valor da comissão
3. THE Portal_Rep SHALL permitir filtrar o detalhamento por período e cliente
4. THE Portal_Rep SHALL ocultar qualquer informação de custo ou margem — exibir apenas valor de venda e comissão
5. THE Portal_Rep SHALL exibir totalizador no rodapé da lista com soma das comissões filtradas

---

### Requisito 16: Notificações — Listagem e Gerenciamento

**User Story:** Como representante, eu quero ver todas as minhas notificações e marcá-las como lidas, para que eu não perca informações importantes sobre meus pedidos e orçamentos.

#### Critérios de Aceitação

1. WHEN a tela de Notificações for aberta, THE Portal_Rep SHALL carregar a lista paginada via GET `/api/portal-rep/notificacoes` exibindo título, mensagem resumida, data e indicador de lida/não-lida
2. THE Portal_Rep SHALL diferenciar visualmente notificações lidas de não-lidas (fundo, opacidade ou ícone)
3. WHEN uma notificação não-lida for tocada, THE Portal_Rep SHALL marcá-la como lida via PUT `/api/portal-rep/notificacoes/:id/lida` e atualizar o badge global
4. THE Portal_Rep SHALL exibir botão "Marcar todas como lidas" que chama PUT `/api/portal-rep/notificacoes/ler-todas`
5. THE Portal_Rep SHALL implementar scroll infinito ou botão "Carregar mais" para paginação
6. WHEN o badge de notificações for exibido, THE Portal_Rep SHALL consultar GET `/api/portal-rep/notificacoes/count-nao-lidas` periodicamente (a cada 60 segundos) para atualizar a contagem
7. THE Portal_Rep SHALL suportar Pull_to_Refresh na lista de notificações

---

### Requisito 17: Badge de Notificações na Navegação

**User Story:** Como representante, eu quero ver um indicador de notificações não lidas no menu de navegação, para que eu saiba quando há novidades sem precisar abrir a tela de notificações.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir um badge numérico sobre o ícone de notificações na Bottom_Nav e na Sidebar_Desktop quando houver notificações não-lidas
2. WHEN a contagem de notificações não-lidas for zero, THE Portal_Rep SHALL ocultar o badge
3. WHEN a contagem for maior que 99, THE Portal_Rep SHALL exibir "99+" no badge
4. THE Portal_Rep SHALL atualizar o badge automaticamente após marcar notificações como lidas

---

### Requisito 18: Perfil e Configurações

**User Story:** Como representante, eu quero visualizar meus dados e alterar minha senha, para que eu tenha controle sobre minha conta.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir na tela de Perfil os dados somente-leitura: nome completo, e-mail e empresa vinculada
2. THE Portal_Rep SHALL disponibilizar botão "Alterar senha" que exibe formulário com campos: senha atual, nova senha e confirmação
3. WHEN a nova senha for diferente da confirmação, THE Portal_Rep SHALL exibir erro de validação em tempo real
4. WHEN a alteração de senha for bem-sucedida, THE Portal_Rep SHALL exibir notificação de sucesso e fechar o formulário
5. THE Portal_Rep SHALL disponibilizar botão "Sair" na tela de Perfil com a mesma ação de logout

---

### Requisito 19: Pull-to-Refresh em Listas

**User Story:** Como representante usando o celular, eu quero puxar para baixo nas listas para atualizar os dados, para que a interação seja natural como em apps nativos.

#### Critérios de Aceitação

1. WHILE o usuário estiver em uma tela de lista (Clientes, Orçamentos, Pipeline, Comissões, Notificações, Dashboard), THE Portal_Rep SHALL detectar o gesto de puxar para baixo (pull-down) no topo da lista
2. WHEN o gesto de pull-down atingir o threshold (≥ 60px de deslocamento), THE Portal_Rep SHALL exibir indicador visual de carregamento e disparar a recarga dos dados
3. THE Portal_Rep SHALL desabilitar o Pull_to_Refresh enquanto uma recarga já estiver em andamento
4. WHEN a recarga for concluída (sucesso ou erro), THE Portal_Rep SHALL ocultar o indicador de carregamento

---

### Requisito 20: Tratamento de Erros e Estados de Carregamento

**User Story:** Como representante, eu quero feedback claro quando algo der errado ou estiver carregando, para que eu saiba o que está acontecendo e o que fazer.

#### Critérios de Aceitação

1. WHILE dados estiverem sendo carregados pela primeira vez, THE Portal_Rep SHALL exibir skeletons ou placeholders animados em vez de tela em branco
2. IF uma requisição falhar por erro de rede, THEN THE Portal_Rep SHALL exibir mensagem amigável com botão "Tentar novamente"
3. IF uma requisição falhar com HTTP 401 (não autorizado), THEN THE Portal_Rep SHALL tentar refresh do token e, se falhar, redirecionar para login
4. IF uma requisição falhar com HTTP 403 com code `SENHA_TEMPORARIA`, THEN THE Portal_Rep SHALL redirecionar para a tela de troca de senha
5. THE Portal_Rep SHALL exibir notificações toast para feedback de ações (sucesso verde, erro vermelho) usando o sistema de notificações do Mantine
6. IF uma lista retornar vazia, THEN THE Portal_Rep SHALL exibir ilustração/ícone com mensagem descritiva (empty state) em vez de lista em branco

---

### Requisito 21: Tema Visual e Identidade

**User Story:** Como representante, eu quero que o portal tenha identidade visual própria diferente do ERP interno, para que eu reconheça facilmente que estou no app certo.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL utilizar um Mantine theme customizado com `primaryColor` verde (diferente do azul do ERP) e fundo predominantemente branco
2. THE Portal_Rep SHALL exibir o logotipo "Vizor" ou marca equivalente no topo do layout (header em mobile, topo da sidebar em desktop)
3. THE Portal_Rep SHALL utilizar exclusivamente componentes Mantine 7 para manter consistência visual
4. THE Portal_Rep SHALL aplicar bordas arredondadas (radius md) e sombras sutis nos cards para aparência moderna
5. THE Portal_Rep SHALL utilizar a fonte padrão do Mantine com tamanhos legíveis em mobile (body ≥ 14px)

---

### Requisito 22: Isolamento de Rota e Layout

**User Story:** Como desenvolvedor, eu quero que o portal do representante seja completamente isolado do ERP interno em termos de layout e navegação, para que alterações em um não afetem o outro.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL residir no route group `src/app/(portal-rep)/` com layout próprio que não herda componentes do ERP (sem `ModuleSidebar`, sem `AppHeader`)
2. THE Portal_Rep SHALL ter seu próprio `layout.tsx` na raiz do route group que define a estrutura de navegação (Bottom_Nav + Sidebar_Desktop)
3. THE Portal_Rep SHALL redirecionar para a tela de login quando não houver token válido em localStorage
4. THE Portal_Rep SHALL proteger todas as rotas funcionais com verificação de autenticação no layout (client-side guard)
5. THE Portal_Rep SHALL compartilhar apenas o `RootLayout` de `src/app/layout.tsx` (fontes, metadata, providers globais) com o restante da aplicação

---

### Requisito 23: Gestos e Interações Touch-Friendly

**User Story:** Como representante usando celular, eu quero que as interações sejam otimizadas para toque, para que eu navegue confortavelmente com uma mão.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL garantir espaçamento mínimo de 8px entre elementos interativos adjacentes para evitar toques acidentais
2. THE Portal_Rep SHALL utilizar transições visuais (hover, active) em todos os elementos tocáveis para feedback imediato
3. WHEN um item de lista suportar ação secundária (ex: cancelar orçamento), THE Portal_Rep SHALL disponibilizar a ação via swipe-to-action ou menu de contexto (long-press), além do botão explícito na tela de detalhe
4. THE Portal_Rep SHALL posicionar ações primárias (FAB, botões de submissão) na metade inferior da tela em mobile para alcance fácil com o polegar

---

### Requisito 24: Segurança de Dados — Ocultação de Custos e Margens

**User Story:** Como administrador do sistema, eu quero garantir que representantes externos não tenham acesso a dados de custo ou margem, para que informações estratégicas fiquem protegidas.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL exibir apenas preço de venda (unitário e total) nas telas de solicitação de orçamento e pipeline — campos de custo, margem ou markup não existem na interface
2. THE Portal_Rep SHALL exibir apenas valor de comissão e percentual nas telas de comissões — sem exposição do preço de custo do produto
3. IF uma resposta da API contiver campos inesperados de custo ou margem, THEN THE Portal_Rep SHALL ignorar esses campos e não renderizá-los

---

### Requisito 25: Formatação e Localização

**User Story:** Como representante brasileiro, eu quero que datas, valores e documentos estejam formatados no padrão brasileiro, para que eu leia as informações naturalmente.

#### Critérios de Aceitação

1. THE Portal_Rep SHALL formatar datas no padrão DD/MM/AAAA e timestamps no padrão DD/MM/AAAA HH:mm
2. THE Portal_Rep SHALL formatar valores monetários no padrão R$ X.XXX,XX (separador de milhar com ponto, decimal com vírgula)
3. THE Portal_Rep SHALL formatar CPF no padrão XXX.XXX.XXX-XX e CNPJ no padrão XX.XXX.XXX/XXXX-XX
4. THE Portal_Rep SHALL formatar telefones no padrão (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
5. THE Portal_Rep SHALL utilizar labels e mensagens em português brasileiro em toda a interface
