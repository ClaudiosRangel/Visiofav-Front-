# Requirements Document

## Introduction

Esta feature adiciona ao módulo WMS a capacidade de um administrador **desativar
itens do menu lateral**, de modo que os itens desativados **desapareçam** da barra
(desktop e mobile) — deixando de ser opções navegáveis. A configuração é feita por
empresa (vale para todos os usuários daquela empresa) e, nesta primeira entrega,
aplica-se apenas ao módulo WMS.

O menu do WMS é definido estaticamente e já existe um precedente no módulo PCP, que
filtra seus itens de menu com base em uma configuração carregada do backend. Esta
feature reaproveita esse padrão, persistindo a configuração na tabela genérica
`Parametro` (por empresa), sem alteração de schema.

Os requisitos abaixo foram derivados do documento de design (`design.md`,
workflow design-first).

## Glossary

- **Item de menu**: uma entrada navegável do menu do WMS, identificada por seu `href` único (ex.: `/wms/inventario`).
- **Grupo de menu**: um agrupamento de itens (ex.: "Estoque", "Recebimento"), identificado por `grupo:<label>`.
- **Menu desabilitado**: item ou grupo cujo id consta na lista `menusDesabilitados` da empresa.
- **Fail-open**: em caso de falha ao carregar a configuração, o menu é exibido completo (nunca deixar o usuário sem navegação).
- **Item protegido**: o próprio item "Configuração de Menus", que não pode ser desabilitado.

## Requirements

### Requirement 1: Ocultar itens de menu desabilitados

**User Story:** Como administrador do WMS, quero desativar itens do menu que minha
empresa não usa, para que a barra lateral fique enxuta e sem opções irrelevantes.

#### Acceptance Criteria

1. WHEN o menu do WMS é montado AND o id de um item consta em `menusDesabilitados` THEN o sistema SHALL omitir esse item da lista renderizada, tanto como item solto quanto quando pertencente a um grupo.
2. WHEN o menu do WMS é montado AND o id de um item NÃO consta em `menusDesabilitados` THEN o sistema SHALL manter o item visível, exceto se o grupo ao qual pertence estiver desabilitado.
3. WHEN `menusDesabilitados` está vazio THEN o sistema SHALL renderizar o menu do WMS completo, idêntico ao comportamento sem configuração.
4. WHEN o menu é aplicado THEN o sistema SHALL aplicar a mesma lógica funcional de visibilidade (os mesmos itens disponíveis) na barra lateral de desktop e no drawer de menu mobile, ainda que os formatos de apresentação/layout sejam diferentes.

### Requirement 2: Desativar grupos inteiros

**User Story:** Como administrador do WMS, quero desativar um grupo inteiro de menu,
para ocultar de uma vez todas as telas de uma área que não uso.

#### Acceptance Criteria

1. WHERE `grupo:<label>` consta em `menusDesabilitados` THEN o sistema SHALL omitir o grupo inteiro e todos os seus itens, independentemente do estado individual de cada item.
2. WHEN todos os itens de um grupo estão desabilitados individualmente THEN o sistema SHALL não renderizar o grupo (grupo sem itens não aparece).

### Requirement 3: Tela de configuração de menus (administração)

**User Story:** Como administrador do WMS, quero uma tela para ligar/desligar itens
do menu, para configurar a visibilidade sem depender de suporte técnico.

#### Acceptance Criteria

1. WHERE o usuário tem perfil `ADMIN` ou `SUPER_ADMIN` THEN o sistema SHALL permitir acessar a tela de Configuração de Menus do WMS e alterar a configuração.
2. IF o usuário não tem perfil `ADMIN`/`SUPER_ADMIN` THEN o sistema SHALL negar a alteração da configuração com HTTP 403.
3. WHEN a tela de configuração é aberta THEN o sistema SHALL listar os itens e grupos do menu do WMS derivados da mesma fonte usada para renderizar a barra lateral.
4. WHEN o administrador salva a configuração THEN o sistema SHALL persistir a lista de ids desabilitados por empresa e refletir a mudança no menu na próxima montagem.
5. WHEN a tela de configuração exibe o item protegido ("Configuração de Menus") THEN o sistema SHALL impedir que ele seja desabilitado.

### Requirement 4: Persistência por empresa e isolamento

**User Story:** Como administrador, quero que a configuração valha para toda a minha
empresa e não afete outras empresas, para manter o isolamento entre clientes.

#### Acceptance Criteria

1. WHEN a configuração é lida ou gravada por um usuário autenticado THEN o sistema SHALL escopá-la à empresa do usuário, usando a chave `wms.menusDesabilitados` na tabela `Parametro`.
2. WHEN um usuário de outra empresa carrega o menu THEN o sistema SHALL NOT aplicar a configuração de uma empresa diferente.
3. WHEN a configuração é gravada THEN o sistema SHALL armazenar a lista como um array de ids (JSON), sem alteração de schema do banco.
4. IF não houver usuário autenticado (ex.: inicialização ou processo em segundo plano) THEN o sistema SHALL tratar a leitura como comportamento padrão (lista vazia / menu completo), sem falhar.

### Requirement 5: Robustez (fail-open e proteção contra bloqueio)

**User Story:** Como usuário do WMS, quero que uma falha de configuração nunca me
deixe sem menu e que a tela de configuração continue sempre acessível, para não
ficar preso sem conseguir navegar ou reconfigurar.

#### Acceptance Criteria

1. IF a leitura da configuração de menus falhar (erro de rede ou backend) THEN o sistema SHALL renderizar o menu do WMS completo (fail-open), sem impedir a navegação.
2. WHEN a configuração é gravada AND a lista inclui o id do item protegido ("Configuração de Menus") THEN o sistema SHALL remover esse id antes de persistir, garantindo que a tela de configuração permaneça acessível.
3. WHEN não há configuração salva para a empresa THEN o sistema SHALL tratar `menusDesabilitados` como lista vazia (menu completo).
