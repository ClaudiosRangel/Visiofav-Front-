# Requirements Document

## Introduction

Esta feature dá **paridade total e moderna** à tela de Orçamento Gráfico do Vizor
em relação ao sistema gráfico legado desktop (origem dos dados da Carton Wega),
de forma que o usuário acostumado ao sistema antigo não sinta dificuldade ao
operar no Vizor. O editor de item já foi convertido em editor de página única
(Bloco 1, entregue); esta spec cobre os blocos funcionais restantes que faltam
para a paridade: cadastro de **Linha de Produto** como seletor inicial do
orçamento, **observação por cliente** exibida como alerta destacado, **materiais
de acabamento com opção de computar custo**, **cobertura de tinta** e **processo
de impressão** virando cadastros editáveis, **microondulado** com lista de
materiais, e **busca de sigla de acabado**.

A feature toca DOIS repositórios SEPARADOS: o backend (`VisioFab.Wms.Back`,
Fastify + Prisma + PostgreSQL/Neon) e o frontend (`VisioFab.Wms.Front`, Next.js
15 + Mantine 7). Os dados de referência vêm de uma base restaurada do sistema
legado (SQL Server local, somente leitura) e são importados para o Neon via
scripts versionados idempotentes, com de-para por CNPJ/código.

Empresa de produção alvo: **Carton Wega** (`empresaId`
`75848e24-742e-461d-b913-1642c5b83ae9`).

**Restrição de marca:** o nome do sistema legado NÃO deve aparecer em NENHUM
texto visível da tela de orçamento. Pode aparecer apenas em comentários de
código e em scripts/documentos de migração.

**Priorização:** Requisitos 1 a 7 e 10 a 13 são **MVP**. Requisitos 8
(microondulado com lista) e 9 (busca de sigla de acabado) são **Opcionais /
Fase 2** e devem ser claramente marcados como tais no design e nas tasks.

## Glossary

- **Sistema**: a aplicação Vizor ERP (backend + frontend) no contexto desta feature.
- **Orcamento_Grafico**: módulo e tela de orçamento gráfico do Vizor onde o usuário monta e precifica um trabalho gráfico.
- **Linha_Produto**: cadastro que classifica o tipo de trabalho gráfico (ex.: LÂMINAS, LÂMINA SIMPLES, CARTUCHO, SACOLA, CARTUCHO COMPOSTO). É um cadastro SEPARADO do Tipo de Embalagem e, no fluxo legado, é o primeiro seletor ao incluir um orçamento, orientando quais campos aparecem.
- **Tipo_Embalagem**: cadastro existente no Vizor (`TipoEmbalagem`, códigos `CG-EMB-*`) que define a geometria/planificação do produto. NÃO é a Linha de Produto.
- **Observacao_Cliente**: texto informativo associado a um Cliente, exibido como alerta destacado não-bloqueante ao abrir/editar um orçamento do cliente e impresso na proposta.
- **Material_Acabamento**: material associado a uma atividade de acabamento (ex.: laminação/BOPP), com preço de referência, que pode OPCIONALMENTE ser computado no custo do orçamento.
- **Cobertura_Tinta**: classificação da cobertura de tinta de um orçamento (ex.: Escala ou Especial), virando cadastro editável.
- **Processo_Impressao**: processo de impressão do orçamento (ex.: Offset Plana), virando cadastro editável.
- **Material_Microondulado**: material de uma lista escolhível quando o orçamento é marcado como microondulado.
- **Sigla_Acabado**: identificador/busca de um acabado a partir de um cadastro, em vez de texto livre.
- **Base_Restaurada**: cópia restaurada do banco do sistema legado (SQL Server local, SOMENTE LEITURA) usada como fonte de dados de importação.
- **Importador**: script versionado e idempotente que lê a Base_Restaurada e grava no banco de produção (Neon) via de-para.
- **De_Para_CNPJ**: processo de correspondência de registros entre o sistema legado e o Vizor usando CNPJ normalizado (somente dígitos) ou código.
- **empresaId**: identificador da empresa (multi-tenant) que isola todos os dados de negócio.

## Requirements

### Requirement 1: Cadastro de Linha de Produto

**User Story:** Como usuário do orçamento gráfico, quero um cadastro de Linha de Produto separado do Tipo de Embalagem, para que eu possa classificar o orçamento como no sistema legado.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar um cadastro Linha_Produto independente do cadastro Tipo_Embalagem, isolado por empresaId.
2. THE Linha_Produto SHALL possuir os campos código, nome e situação (ativa ou cancelada).
3. WHEN um usuário cria uma Linha_Produto, THE Sistema SHALL exigir nome e situação e gravar o registro vinculado ao empresaId da sessão.
4. WHEN um usuário edita uma Linha_Produto existente, THE Sistema SHALL persistir as alterações de nome e situação do registro cuja empresaId corresponde à empresaId da sessão.
5. IF um usuário solicita uma Linha_Produto cuja empresaId difere da empresaId da sessão, THEN THE Sistema SHALL negar o acesso e retornar erro de recurso não encontrado.
6. THE Sistema SHALL listar as Linha_Produto da empresaId da sessão, permitindo filtrar por situação.

### Requirement 2: Linha de Produto como seletor inicial do orçamento

**User Story:** Como usuário do orçamento gráfico, quero escolher a Linha de Produto como primeira etapa ao criar um orçamento, para que os campos apresentados sejam orientados pelo tipo de trabalho.

#### Acceptance Criteria

1. WHEN um usuário inicia a criação de um orçamento, THE Orcamento_Grafico SHALL apresentar o seletor de Linha_Produto como etapa inicial.
2. THE Orcamento_Grafico SHALL exibir no seletor de Linha_Produto apenas as Linha_Produto com situação ativa da empresaId da sessão, ordenadas por nome em ordem crescente.
3. THE Sistema SHALL manter um mapeamento fixo entre o código de cada Linha_Produto e o conjunto de campos condicionais a exibir (mapeamento definido no Sistema, não configurável pelo usuário), cobrindo os códigos das linhas ativas do legado (LÂMINAS, LÂMINA SIMPLES, CARTUCHO, SACOLA, CARTUCHO COMPOSTO).
4. WHEN um usuário seleciona uma Linha_Produto, THE Orcamento_Grafico SHALL exibir, em no máximo 1 segundo, o conjunto de campos condicionais mapeado para aquela Linha_Produto.
5. IF a Linha_Produto selecionada não possui conjunto de campos mapeado, THEN THE Orcamento_Grafico SHALL exibir o conjunto de campos padrão sem bloquear a edição do orçamento.
6. WHEN um usuário troca a Linha_Produto selecionada em um orçamento, THE Orcamento_Grafico SHALL atualizar os campos condicionais exibidos para o novo conjunto mapeado e preservar os valores dos campos comuns a ambos os conjuntos.
7. THE Orcamento_Grafico SHALL persistir a Linha_Produto selecionada vinculada ao orçamento com a empresaId da sessão.
8. WHILE um orçamento existente é editado, THE Orcamento_Grafico SHALL exibir a Linha_Produto previamente selecionada do orçamento.
9. WHERE um orçamento foi criado antes da existência do campo Linha_Produto, THE Orcamento_Grafico SHALL permitir abrir e editar o orçamento sem Linha_Produto selecionada.

### Requirement 3: Importação das Linhas de Produto ativas

**User Story:** Como responsável pela migração, quero importar as Linhas de Produto ativas da base restaurada, para que o cadastro do Vizor reflita o legado sem itens cancelados.

#### Acceptance Criteria

1. THE Importador SHALL ler as Linha_Produto da Base_Restaurada em modo somente leitura.
2. THE Importador SHALL gravar no Vizor apenas as Linha_Produto com situação ativa da Base_Restaurada.
3. THE Importador SHALL vincular cada Linha_Produto importada ao empresaId da Carton Wega (`75848e24-742e-461d-b913-1642c5b83ae9`).
4. WHEN o Importador é executado mais de uma vez, THE Importador SHALL produzir o mesmo estado final sem duplicar Linha_Produto (idempotência), usando De_Para_CNPJ por código.
5. IF uma Linha_Produto da Base_Restaurada já existe no Vizor para a empresaId, THEN THE Importador SHALL preservar ajustes manuais existentes e não sobrescrever campos já preenchidos manualmente.

### Requirement 4: Observação do Cliente com alerta destacado

**User Story:** Como usuário do orçamento gráfico, quero ver um alerta destacado quando o cliente do orçamento possui observação, para que eu não perca avisos importantes sobre a entrega.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar no cadastro de Cliente um campo Observacao_Cliente de texto livre, isolado por empresaId, com no máximo 1000 caracteres.
2. WHEN um usuário abre ou edita um orçamento cujo cliente possui Observacao_Cliente preenchida (ao menos 1 caractere não vazio), THE Orcamento_Grafico SHALL exibir a Observacao_Cliente em um componente de alerta visual no topo do orçamento, usando cor de atenção distinta do fundo padrão e exibindo o texto integral da Observacao_Cliente.
3. WHILE o alerta de Observacao_Cliente está sendo exibido, THE Orcamento_Grafico SHALL permitir que o usuário execute as ações de salvar, avançar de etapa, enviar e aprovar o orçamento sem que o alerta impeça, bloqueie ou interrompa essas ações.
4. WHILE o cliente do orçamento não possui Observacao_Cliente preenchida (campo nulo, vazio ou somente espaços), THE Orcamento_Grafico SHALL ocultar o componente de alerta de observação.
5. WHEN o cliente do orçamento é alterado para um cliente com Observacao_Cliente preenchida, THE Orcamento_Grafico SHALL atualizar o componente de alerta para exibir a Observacao_Cliente do novo cliente.
6. WHEN o cliente do orçamento é alterado para um cliente sem Observacao_Cliente preenchida, THE Orcamento_Grafico SHALL ocultar o componente de alerta de observação.
7. WHERE o cliente do orçamento possui Observacao_Cliente preenchida, THE Orcamento_Grafico SHALL incluir o texto integral da Observacao_Cliente na proposta e na impressão do orçamento.

### Requirement 5: Importação das observações de cliente

**User Story:** Como responsável pela migração, quero importar as observações de cliente da base restaurada, para que os avisos por cliente apareçam automaticamente no Vizor.

#### Acceptance Criteria

1. THE Importador SHALL ler as observações de cliente da Base_Restaurada em modo somente leitura.
2. THE Importador SHALL associar cada observação ao Cliente correspondente do Vizor usando De_Para_CNPJ por CNPJ normalizado.
3. IF o De_Para_CNPJ encontra zero ou dois ou mais clientes candidatos para uma observação, THEN THE Importador SHALL deixar o campo Observacao_Cliente vazio para aquele registro.
4. WHEN o Importador é executado mais de uma vez, THE Importador SHALL produzir o mesmo estado final sem duplicar observações (idempotência).
5. IF um Cliente já possui Observacao_Cliente preenchida manualmente, THEN THE Importador SHALL preservar o valor manual e não sobrescrever.
6. THE Importador SHALL vincular cada observação importada ao empresaId da Carton Wega (`75848e24-742e-461d-b913-1642c5b83ae9`).

### Requirement 6: Materiais de acabamento com opção de computar custo

**User Story:** Como usuário do orçamento gráfico, quero escolher se um material de acabamento entra no custo, para que eu possa precificar corretamente materiais que antes eram apenas informativos.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar um catálogo de Material_Acabamento com nome e valor de referência, isolado por empresaId.
2. THE Material_Acabamento SHALL possuir um indicador booleano de computar no custo (ativo/inativo) e um valor unitário editável no intervalo de 0,00 a 9.999.999,99, com o custo total do material calculado como valor unitário multiplicado pela quantidade vinculada.
3. WHILE o indicador de computar no custo de um Material_Acabamento vinculado ao orçamento está ativo, THE Orcamento_Grafico SHALL somar o custo total do Material_Acabamento à rubrica de Material Direto do orçamento.
4. WHILE o indicador de computar no custo de um Material_Acabamento vinculado ao orçamento está inativo, THE Orcamento_Grafico SHALL exibir o Material_Acabamento de forma informativa sem incluir qualquer valor na rubrica de Material Direto nem no custo total do orçamento.
5. WHEN um usuário altera o valor unitário editável de um Material_Acabamento com indicador de computar no custo ativo, THE Orcamento_Grafico SHALL recalcular o custo total do orçamento usando o novo valor unitário.
6. WHEN um cálculo é puxado para um item do orçamento ou o item é salvo, THE Orcamento_Grafico SHALL recalcular o custo total incluindo o custo total de cada Material_Acabamento vinculado cujo indicador de computar no custo está ativo.
7. WHILE nenhum Material_Acabamento vinculado ao orçamento tem o indicador de computar no custo ativo, THE Orcamento_Grafico SHALL produzir custo total e rubrica de Material Direto com valores idênticos aos calculados pelo comportamento atual (sem materiais de acabamento computados).
8. IF o valor unitário informado para um Material_Acabamento com indicador de computar no custo ativo está fora do intervalo de 0,00 a 9.999.999,99, THEN THE Orcamento_Grafico SHALL rejeitar a alteração, preservar o valor anterior e exibir mensagem indicando o intervalo permitido.

### Requirement 7: Importação do catálogo de materiais de acabamento

**User Story:** Como responsável pela migração, quero importar o catálogo de materiais de acabamento com preço da base restaurada, para que o Vizor tenha os materiais e valores disponíveis.

#### Acceptance Criteria

1. THE Importador SHALL ler o catálogo de materiais de acabamento e seus preços da Base_Restaurada em modo somente leitura.
2. THE Importador SHALL gravar cada Material_Acabamento com nome e valor de referência vinculado ao empresaId da Carton Wega (`75848e24-742e-461d-b913-1642c5b83ae9`).
3. THE Importador SHALL gravar cada Material_Acabamento importado com o indicador de computar no custo inativo por padrão.
4. WHEN o Importador é executado mais de uma vez, THE Importador SHALL produzir o mesmo estado final sem duplicar Material_Acabamento (idempotência).
5. IF um Material_Acabamento já possui valor ajustado manualmente, THEN THE Importador SHALL preservar o valor manual e não sobrescrever.

### Requirement 8: Microondulado com lista de materiais

> **Prioridade: Opcional / Fase 2.**

**User Story:** Como usuário do orçamento gráfico, quero escolher um material de uma lista ao marcar microondulado, para que o orçamento reflita o material microondulado específico como no legado.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar um cadastro de Material_Microondulado isolado por empresaId.
2. WHEN um usuário marca o orçamento como microondulado, THE Orcamento_Grafico SHALL permitir selecionar um Material_Microondulado da lista de materiais ativos da empresaId da sessão.
3. WHILE o orçamento não está marcado como microondulado, THE Orcamento_Grafico SHALL preservar o comportamento atual sem exigir seleção de Material_Microondulado (não-regressão).
4. THE Orcamento_Grafico SHALL persistir o Material_Microondulado selecionado vinculado ao orçamento quando microondulado estiver marcado.

### Requirement 9: Busca de Sigla de Acabado

> **Prioridade: Opcional / Fase 2.**

**User Story:** Como usuário do orçamento gráfico, quero buscar e selecionar a Sigla de Acabado a partir de um cadastro, para que eu não precise digitar texto livre.

#### Acceptance Criteria

1. THE Orcamento_Grafico SHALL permitir buscar e selecionar a Sigla_Acabado a partir de um cadastro de acabados da empresaId da sessão.
2. WHEN um usuário seleciona uma Sigla_Acabado do cadastro, THE Orcamento_Grafico SHALL preencher o campo de sigla de acabado do orçamento com a seleção.
3. WHERE um orçamento possui sigla de acabado em texto livre preexistente, THE Orcamento_Grafico SHALL preservar o texto livre e permitir sua edição (não-regressão).

### Requirement 10: Cobertura de Tinta como cadastro editável

**User Story:** Como usuário do orçamento gráfico, quero selecionar a cobertura de tinta a partir de um cadastro editável, para substituir o texto livre atual.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar um cadastro de Cobertura_Tinta editável, isolado por empresaId.
2. WHEN um usuário cria ou edita uma Cobertura_Tinta, THE Sistema SHALL persistir o registro vinculado ao empresaId da sessão.
3. THE Orcamento_Grafico SHALL apresentar a Cobertura_Tinta por meio de um seletor alimentado pelo cadastro de Cobertura_Tinta da empresaId da sessão.
4. THE Importador SHALL importar as Cobertura_Tinta existentes na Base_Restaurada vinculando-as ao empresaId da Carton Wega (`75848e24-742e-461d-b913-1642c5b83ae9`), de forma idempotente.
5. WHERE um orçamento possui cobertura de tinta em texto livre preexistente, THE Orcamento_Grafico SHALL preservar o texto livre do orçamento (não-regressão).

### Requirement 11: Processo de Impressão como cadastro editável

**User Story:** Como usuário do orçamento gráfico, quero selecionar o processo de impressão a partir de um cadastro editável, para substituir o texto livre atual.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar um cadastro de Processo_Impressao editável, isolado por empresaId.
2. WHEN um usuário cria ou edita um Processo_Impressao, THE Sistema SHALL persistir o registro vinculado ao empresaId da sessão.
3. THE Orcamento_Grafico SHALL apresentar o Processo_Impressao por meio de um seletor alimentado pelo cadastro de Processo_Impressao da empresaId da sessão.
4. THE Importador SHALL importar os Processo_Impressao existentes na Base_Restaurada vinculando-os ao empresaId da Carton Wega (`75848e24-742e-461d-b913-1642c5b83ae9`), de forma idempotente.
5. WHERE um orçamento possui processo de impressão em texto livre preexistente, THE Orcamento_Grafico SHALL preservar o texto livre do orçamento (não-regressão).

### Requirement 12: Isolamento multi-tenant explícito

**User Story:** Como operador do sistema multi-empresa, quero que todos os dados novos sejam isolados por empresa, para que não haja vazamento de dados entre empresas.

#### Acceptance Criteria

1. THE Sistema SHALL filtrar toda consulta aos cadastros Linha_Produto, Material_Acabamento, Cobertura_Tinta, Processo_Impressao, Material_Microondulado e Observacao_Cliente por empresaId explícito da entidade de negócio real.
2. IF um usuário com perfil de acesso amplo possui uma empresa selecionada na sessão, THEN THE Sistema SHALL restringir os dados dos cadastros desta feature à empresaId selecionada.
3. WHEN o Sistema cria um registro de qualquer cadastro desta feature, THE Sistema SHALL gravar o empresaId da entidade de negócio real do contexto.

### Requirement 13: Não-regressão do fluxo de orçamento existente

**User Story:** Como usuário do orçamento gráfico, quero que o fluxo atual continue funcionando, para que a adição dos campos novos não quebre o que já uso.

#### Acceptance Criteria

1. WHEN um usuário cria um orçamento do zero sem usar os campos novos, THE Orcamento_Grafico SHALL concluir a criação como no comportamento atual.
2. WHEN um usuário puxa um cálculo da biblioteca para um orçamento, THE Orcamento_Grafico SHALL concluir a operação como no comportamento atual.
3. THE Sistema SHALL tratar todos os campos e cadastros novos desta feature como aditivos, sem exigir preenchimento para orçamentos que não os utilizam.
4. WHERE uma alteração de schema Prisma é necessária, THE Sistema SHALL incluir no mesmo commit a alteração idempotente equivalente em `prisma/migrate-prod.ts` (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`).
5. THE Sistema SHALL não exibir o nome do sistema legado em nenhum texto visível da tela de orçamento.
