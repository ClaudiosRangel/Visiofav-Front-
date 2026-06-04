# Requirements Document

## Introduction

Este documento especifica os requisitos para a integração de funcionalidades de geolocalização no frontend do sistema VisioFab WMS (Next.js 15 + Mantine v7). O backend já possui todos os endpoints de geolocalização implementados (spec `roteirizacao-geolocalizacao` do VisioFab.Wms.Back). Esta spec trata exclusivamente da camada de apresentação e interação do usuário com esses endpoints.

A integração abrange: geocodificação de clientes e empresa, visualização de coordenadas, otimização de sequência de entrega em mapas de carregamento, exibição de distâncias, sugestão de rotas por proximidade, visualização de áreas de cobertura, e ferramenta de geocodificação em lote.

## Glossary

- **Sistema_Frontend**: A aplicação frontend Next.js 15 com App Router, Mantine v7, TanStack Query e TypeScript
- **API_Geo**: Conjunto de endpoints REST de geolocalização disponíveis no backend (`/api/geo/*`)
- **Cliente**: Entidade de cliente com campos de endereço e coordenadas opcionais (latitude/longitude)
- **Empresa**: Entidade tenant representando a empresa autenticada; ponto de origem das entregas
- **Mapa_de_Carregamento**: Documento que agrupa NFs/volumes para despacho de um veículo/motorista
- **Romaneio**: Relatório de lista de entrega (packing list) associado a um Mapa_de_Carregamento
- **Rota**: Entidade de rota de entrega contendo código, descrição e transportadora vinculada
- **Coordenadas**: Par de valores latitude e longitude em formato decimal
- **Geocodificação**: Processo de conversão de endereço textual em coordenadas geográficas via API backend
- **Sequência_de_Entrega**: Ordem otimizada de visita aos clientes dentro de um Mapa_de_Carregamento
- **Área_de_Cobertura**: Conjunto de cidades e bairros atendidos por uma Rota específica
- **Pedido_de_Venda**: Pedido de venda vinculado a um cliente e opcionalmente a uma rota
- **Hook_de_Dados**: Custom hook TanStack Query para encapsular chamadas à API com cache e invalidação
- **Usuário**: Usuário autenticado do sistema com acesso ao módulo correspondente

## Requirements

### Requisito 1: Geocodificação no Cadastro de Clientes

**User Story:** Como operador de cadastro, quero geocodificar o endereço de um cliente diretamente na tela de cadastro, para que as coordenadas sejam preenchidas automaticamente sem digitação manual.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Geocodificar" na tela de edição/detalhe do Cliente quando o Cliente possuir endereço preenchido (CEP ou cidade)
2. WHEN o Usuário clica no botão "Geocodificar", THE Sistema_Frontend SHALL enviar uma requisição POST para `/api/geo/clientes/:id/geocodificar` e exibir indicador de carregamento durante o processamento
3. WHEN a API_Geo retorna coordenadas válidas, THE Sistema_Frontend SHALL atualizar a exibição dos campos latitude e longitude do Cliente e exibir notificação de sucesso
4. IF a API_Geo retorna erro de geocodificação (endereço não encontrado), THEN THE Sistema_Frontend SHALL exibir notificação de erro com a mensagem retornada pela API sem alterar os campos do Cliente
5. IF a API_Geo retorna erro 503 (serviço indisponível), THEN THE Sistema_Frontend SHALL exibir notificação informando que o serviço de geocodificação está temporariamente indisponível
6. THE Sistema_Frontend SHALL exibir os campos latitude e longitude na listagem de clientes como coluna opcional e no detalhe/edição do Cliente como campos somente-leitura
7. THE Sistema_Frontend SHALL exibir um indicador visual (ícone ou badge) na listagem de clientes para diferenciar clientes geocodificados de não-geocodificados

---

### Requisito 2: Sugestão de Rota para Clientes

**User Story:** Como operador de cadastro, quero visualizar sugestões de rota para um cliente com base na proximidade geográfica, para que a atribuição de rotas seja mais precisa e ágil.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Sugerir Rota" na tela de edição/detalhe do Cliente quando o Cliente possuir coordenadas cadastradas
2. WHEN o Usuário clica no botão "Sugerir Rota", THE Sistema_Frontend SHALL enviar uma requisição GET para `/api/geo/clientes/:id/sugestao-rota` e exibir indicador de carregamento
3. WHEN a API_Geo retorna sugestões, THE Sistema_Frontend SHALL exibir uma lista ordenada contendo: código da rota, descrição, distância média em km e quantidade de clientes na rota
4. IF a API_Geo retorna lista vazia de sugestões, THEN THE Sistema_Frontend SHALL exibir mensagem informando que não há rotas com clientes geocodificados para comparação
5. IF o Cliente não possuir coordenadas cadastradas, THEN THE Sistema_Frontend SHALL desabilitar o botão "Sugerir Rota" com tooltip informando que o cliente precisa ser geocodificado primeiro
6. THE Sistema_Frontend SHALL permitir ao Usuário selecionar uma rota sugerida e vincular ao Cliente com um clique

---

### Requisito 3: Geocodificação no Cadastro de Empresa

**User Story:** Como administrador, quero geocodificar o endereço da empresa diretamente na tela de configuração, para que o sistema utilize a localização da empresa como ponto de origem nas otimizações de rota.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Geocodificar Endereço" na tela de configuração da Empresa quando a Empresa possuir endereço preenchido
2. WHEN o Usuário clica no botão "Geocodificar Endereço", THE Sistema_Frontend SHALL enviar uma requisição POST para `/api/geo/empresa/geocodificar` e exibir indicador de carregamento
3. WHEN a API_Geo retorna coordenadas válidas, THE Sistema_Frontend SHALL atualizar a exibição dos campos latitude e longitude da Empresa e exibir notificação de sucesso
4. IF a API_Geo retorna erro, THEN THE Sistema_Frontend SHALL exibir notificação de erro com a mensagem retornada pela API
5. THE Sistema_Frontend SHALL exibir os campos latitude e longitude da Empresa como campos somente-leitura na tela de configuração
6. THE Sistema_Frontend SHALL exibir um alerta informativo na tela de configuração quando a Empresa não possuir coordenadas, indicando que a geocodificação é necessária para otimização de rotas

---

### Requisito 4: Otimização de Sequência no Mapa de Carregamento

**User Story:** Como coordenador logístico, quero otimizar a sequência de entrega de um mapa de carregamento diretamente na interface, para que o motorista percorra a menor distância possível.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Otimizar Rota" no detalhe do Mapa_de_Carregamento quando o mapa estiver com status AGUARDANDO_SEPARACAO ou EM_CARREGAMENTO
2. WHEN o Usuário clica no botão "Otimizar Rota", THE Sistema_Frontend SHALL enviar uma requisição POST para `/api/geo/mapas/:id/otimizar` e exibir indicador de carregamento
3. WHEN a API_Geo retorna a sequência otimizada, THE Sistema_Frontend SHALL exibir a lista de entregas na ordem otimizada contendo: número de ordem, razão social do cliente, endereço e distância parcial em km ao ponto anterior
4. WHEN a API_Geo retorna clientes sem geolocalização, THE Sistema_Frontend SHALL exibi-los ao final da lista com indicador visual "Sem geolocalização" e distância parcial como "—"
5. THE Sistema_Frontend SHALL exibir a distância total estimada do percurso em destaque (badge ou card de resumo) após a otimização
6. THE Sistema_Frontend SHALL exibir um botão "Salvar Sequência" após a otimização ser calculada, permitindo ao Usuário persistir a ordem otimizada
7. WHEN o Usuário clica em "Salvar Sequência", THE Sistema_Frontend SHALL enviar uma requisição POST para `/api/geo/mapas/:id/salvar-sequencia` com a sequência exibida e exibir notificação de sucesso
8. IF a API_Geo retorna erro indicando que a Empresa não possui coordenadas, THEN THE Sistema_Frontend SHALL exibir notificação orientando o Usuário a geocodificar a empresa primeiro
9. THE Sistema_Frontend SHALL exibir a coluna "Distância Total (km)" na listagem de Mapas de Carregamento quando o valor estiver disponível

---

### Requisito 5: Exibição de Sequência no Romaneio

**User Story:** Como coordenador logístico, quero visualizar a ordem de entrega e distâncias no romaneio, para que o motorista siga a rota otimizada durante as entregas.

#### Critérios de Aceitação

1. WHEN o Usuário visualiza o romaneio de um Mapa_de_Carregamento com sequência de entrega salva, THE Sistema_Frontend SHALL exibir as NFs ordenadas conforme a sequência de entrega
2. THE Sistema_Frontend SHALL exibir o número de ordem de cada entrega (1, 2, 3...) como coluna na tabela do romaneio
3. THE Sistema_Frontend SHALL exibir a distância parcial entre cada ponto de entrega em quilômetros como coluna na tabela do romaneio
4. THE Sistema_Frontend SHALL exibir a distância total estimada do percurso em um card de resumo no topo do romaneio
5. WHEN o romaneio é de um Mapa_de_Carregamento sem sequência de entrega salva, THE Sistema_Frontend SHALL exibir as NFs na ordem original sem colunas de ordem e distância

---

### Requisito 6: Distância ao Cliente em Vendas

**User Story:** Como vendedor, quero visualizar a distância entre a empresa e o cliente no detalhe do pedido de venda, para que eu possa avaliar custos logísticos durante a negociação.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir o campo "Distância (km)" no detalhe do Pedido_de_Venda quando o Cliente do pedido possuir coordenadas cadastradas
2. WHEN o detalhe do Pedido_de_Venda é carregado e o Cliente possui coordenadas, THE Sistema_Frontend SHALL enviar uma requisição GET para `/api/geo/distancia/cliente/:clienteId` para obter a distância
3. WHEN a API_Geo retorna a distância, THE Sistema_Frontend SHALL exibir o valor em quilômetros com 2 casas decimais no card de informações do pedido
4. IF o Cliente não possuir coordenadas cadastradas, THEN THE Sistema_Frontend SHALL exibir "Distância: não disponível (cliente sem geolocalização)" no campo correspondente
5. IF a Empresa não possuir coordenadas cadastradas, THEN THE Sistema_Frontend SHALL exibir "Distância: não disponível (empresa sem geolocalização)" no campo correspondente

---

### Requisito 7: Visualização de Área de Cobertura de Rotas

**User Story:** Como gerente logístico, quero visualizar as cidades e bairros atendidos por cada rota, para que eu possa entender a distribuição geográfica e identificar sobreposições.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL exibir um botão "Ver Cobertura" na listagem de Rotas para cada rota ativa
2. WHEN o Usuário clica em "Ver Cobertura", THE Sistema_Frontend SHALL enviar uma requisição GET para `/api/geo/rotas/:id/cobertura` e exibir um modal ou painel com os dados de cobertura
3. THE Sistema_Frontend SHALL exibir a lista de cidades atendidas pela Rota, e para cada cidade a lista de bairros distintos com quantidade de clientes
4. THE Sistema_Frontend SHALL exibir a quantidade total de clientes geocodificados e não-geocodificados na Rota em um resumo no topo do painel
5. THE Sistema_Frontend SHALL exibir um botão "Cobertura Consolidada" na tela de Rotas que carrega a visão consolidada de todas as rotas
6. WHEN o Usuário clica em "Cobertura Consolidada", THE Sistema_Frontend SHALL enviar uma requisição GET para `/api/geo/rotas/cobertura-consolidada` e exibir os dados em modal ou página dedicada
7. THE Sistema_Frontend SHALL destacar visualmente as sobreposições (cidades/bairros atendidos por mais de uma rota) na visão consolidada, indicando quais rotas compartilham cada área

---

### Requisito 8: Ferramenta de Geocodificação em Lote

**User Story:** Como administrador, quero geocodificar todos os clientes de uma vez, para que eu possa configurar rapidamente a geolocalização de toda a base de clientes existente.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL disponibilizar uma tela dedicada de "Geocodificação em Lote" acessível a partir do módulo Configurador
2. THE Sistema_Frontend SHALL exibir um resumo da base de clientes contendo: total de clientes, quantidade geocodificados e quantidade não-geocodificados
3. THE Sistema_Frontend SHALL exibir um botão "Geocodificar Todos" que inicia o processo de geocodificação em lote para todos os clientes sem coordenadas
4. WHEN o Usuário clica em "Geocodificar Todos", THE Sistema_Frontend SHALL enviar uma requisição POST para `/api/geo/clientes/geocodificar-batch` com os IDs dos clientes sem coordenadas e exibir indicador de progresso
5. WHEN a API_Geo retorna o resultado do lote, THE Sistema_Frontend SHALL exibir um resumo contendo: quantidade de sucessos, quantidade de falhas e lista detalhada dos clientes que falharam com o motivo
6. IF o processo de geocodificação em lote falha parcialmente, THEN THE Sistema_Frontend SHALL permitir ao Usuário reexecutar apenas para os clientes que falharam
7. THE Sistema_Frontend SHALL permitir ao Usuário filtrar a listagem de clientes por status de geocodificação (geocodificados / não-geocodificados) na tela de lote

---

### Requisito 9: Hooks de Dados para Geolocalização

**User Story:** Como desenvolvedor, quero hooks reutilizáveis para todas as chamadas de geolocalização, para que a integração com a API seja consistente e o cache seja gerenciado corretamente.

#### Critérios de Aceitação

1. THE Sistema_Frontend SHALL implementar um hook `useGeocodificarCliente` que encapsula a mutation POST para `/api/geo/clientes/:id/geocodificar` com invalidação automática da query de clientes
2. THE Sistema_Frontend SHALL implementar um hook `useGeocodificarEmpresa` que encapsula a mutation POST para `/api/geo/empresa/geocodificar` com invalidação automática da query de empresa
3. THE Sistema_Frontend SHALL implementar um hook `useGeocodificarBatch` que encapsula a mutation POST para `/api/geo/clientes/geocodificar-batch` com invalidação automática da query de clientes
4. THE Sistema_Frontend SHALL implementar um hook `useOtimizarRota` que encapsula a mutation POST para `/api/geo/mapas/:id/otimizar`
5. THE Sistema_Frontend SHALL implementar um hook `useSalvarSequencia` que encapsula a mutation POST para `/api/geo/mapas/:id/salvar-sequencia` com invalidação automática da query de mapas de carregamento
6. THE Sistema_Frontend SHALL implementar um hook `useDistanciaCliente` que encapsula a query GET para `/api/geo/distancia/cliente/:clienteId`
7. THE Sistema_Frontend SHALL implementar um hook `useSugestaoRota` que encapsula a query GET para `/api/geo/clientes/:id/sugestao-rota`
8. THE Sistema_Frontend SHALL implementar um hook `useCoberturaRota` que encapsula a query GET para `/api/geo/rotas/:id/cobertura`
9. THE Sistema_Frontend SHALL implementar um hook `useCoberturaConsolidada` que encapsula a query GET para `/api/geo/rotas/cobertura-consolidada`
10. THE Sistema_Frontend SHALL implementar todos os hooks no diretório `src/data/hooks/` seguindo o padrão existente do projeto (TanStack Query com `api` de `@/lib/api`)

---

### Requisito 10: Tratamento de Erros e Feedback Visual

**User Story:** Como usuário, quero feedback claro sobre o resultado de cada operação de geolocalização, para que eu saiba se a ação foi bem-sucedida ou se preciso tomar alguma providência.

#### Critérios de Aceitação

1. WHEN qualquer operação de geolocalização está em andamento, THE Sistema_Frontend SHALL exibir indicador de carregamento (loading overlay ou spinner no botão) impedindo cliques duplicados
2. WHEN qualquer operação de geolocalização é concluída com sucesso, THE Sistema_Frontend SHALL exibir notificação de sucesso usando o sistema de notificações Mantine (posição top-right, cor green)
3. WHEN qualquer operação de geolocalização falha, THE Sistema_Frontend SHALL exibir notificação de erro usando o sistema de notificações Mantine (posição top-right, cor red) com a mensagem de erro retornada pela API
4. IF a API retorna erro 503 (serviço de geocodificação indisponível), THEN THE Sistema_Frontend SHALL exibir notificação com mensagem específica orientando o Usuário a tentar novamente mais tarde
5. THE Sistema_Frontend SHALL desabilitar botões de ação de geolocalização enquanto uma operação estiver em andamento para o mesmo recurso
6. WHEN a geocodificação em lote está em andamento, THE Sistema_Frontend SHALL exibir barra de progresso ou indicador de processamento com mensagem "Processando geocodificação..."
