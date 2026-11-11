# Requisitos — Redesign UX/UI do Editor de Orçamento Gráfico

## Introdução

A tela de edição/criação de item do orçamento gráfico (Editor de página única)
é funcional mas passa sensação "pesada, cansativa e técnica" (estilo planilha
densa). Esta spec aplica as melhores práticas de SaaS/B2B para torná-la mais
legível, orientada a KPIs e amigável, SEM alterar o motor de cálculo nem a
paridade de valores (apenas apresentação + um recálculo ao vivo que consome a
rota de cálculo já existente).

Decisões do usuário:
- Fazer **tudo numa spec** (ondas 1→6).
- **Recálculo a cada alteração** (tempo real), com debounce, via a rota de
  cálculo já existente do backend.

Escopo: FRONT (`VisioFab.Wms.Front`). Não toca schema nem o motor de cálculo.
Não mexe em "Puxar Cálculo" nem na ancoragem de repetição (preserva valores).

## Requisitos

### Requisito 1 — Mensagens de erro amigáveis (sem código bruto)

**User Story:** Como calculista, quero ver mensagens claras em português quando
faltar algo, não erros técnicos de validação.

#### Acceptance Criteria
1. QUANDO o cálculo/salvamento falha por validação ENTÃO o sistema NÃO DEVE
   exibir texto cru de Zod (ex.: "Expected string, received null",
   "Number must be greater than 0").
2. O sistema DEVE traduzir cada campo/erro conhecido para linguagem humana
   (ex.: tipoEmbalagemId → "Selecione o tipo de embalagem"; gramatura → "Informe
   a gramatura do papel"; precoKg → "Informe o preço por kg do papel").
3. QUANDO possível ENTÃO o sistema DEVE exibir o erro INLINE abaixo/junto do
   campo correspondente, além de um resumo amigável no topo da seção.
4. Erros desconhecidos DEVEM cair num texto genérico amigável, nunca no texto
   técnico cru.

### Requisito 2 — Hierarquia visual e contraste

**User Story:** Como usuário, quero uma tela com agrupamentos claros e contraste
adequado, não um bloco escuro uniforme.

#### Acceptance Criteria
1. Os containers de seção DEVEM usar tokens adaptativos do Mantine
   (`--mantine-color-body`/`-default`/`-default-border`), respeitando tema
   claro e escuro (nada de cinza-escuro fixo).
2. Campos DEVEM ter estados visuais distinguíveis: foco, desabilitado,
   preenchido, com erro.
3. Status e origem (copiado/manual/vazio) DEVEM usar badges elegantes.

### Requisito 3 — Sticky Summary Bar com KPIs em tempo real

**User Story:** Como calculista, quero ver Custo Total, Preço de Venda, Margem e
Preço Unitário atualizando enquanto edito.

#### Acceptance Criteria
1. O editor DEVE exibir uma barra fixa (topo) com Custo Total (R$), Preço de
   Venda (R$), Margem (%) e Preço Unitário (R$).
2. QUANDO o usuário altera qualquer campo que afeta o cálculo ENTÃO o sistema
   DEVE recalcular (com debounce ~500–800 ms) e atualizar os KPIs.
3. ENQUANTO o recálculo está em andamento ENTÃO o sistema DEVE indicar o estado
   de carregamento sem travar a edição.
4. SE o recálculo falhar por dados incompletos ENTÃO os KPIs DEVEM manter o
   último valor válido e o erro amigável (Req 1) DEVE ser exibido.
5. O recálculo ao vivo NÃO DEVE persistir nada; o salvar continua explícito.

### Requisito 4 — Stepper de seções com status

**User Story:** Como usuário, quero um índice lateral que mostre o progresso de
cada seção.

#### Acceptance Criteria
1. O índice lateral DEVE indicar, por seção, um status visual: concluído,
   pendente ou com erro.
2. Clicar numa seção DEVE navegar até ela (scroll suave), preservando o
   comportamento atual de scroll-spy.
3. A legenda (copiado/manual/vazio) DEVE ser mantida.

### Requisito 5 — Painel lateral retrátil de preview (2D)

**User Story:** Como calculista, quero ver o encaixe da folha e a faca num
painel lateral, não solto no fim da página.

#### Acceptance Criteria
1. O editor DEVE oferecer um painel lateral retrátil com o preview 2D (SVG de
   encaixe + imagem da faca/produto quando houver).
2. O painel DEVE poder ser recolhido/expandido sem perder o estado do form.
3. (Fora de escopo) 3D interativo — não implementado nesta spec.

### Requisito 6 — Agrupamento/filtro de Acabamentos e Materiais

**User Story:** Como usuário, quero achar acabamentos rapidamente, não rolar uma
lista enorme de checkboxes.

#### Acceptance Criteria
1. A seção de Acabamentos DEVE destacar primeiro os itens já selecionados.
2. O sistema DEVE oferecer filtro/busca por nome e/ou categoria.
3. O comportamento de cálculo dos acabamentos selecionados DEVE permanecer
   idêntico (não-regressão).

### Requisito 7 — Não-regressão

#### Acceptance Criteria
1. Os valores calculados DEVEM permanecer idênticos aos atuais (motor
   inalterado; apenas apresentação + recálculo ao vivo usando a rota existente).
2. Salvar item, Puxar Cálculo e ancoragem de repetição DEVEM continuar
   funcionando.
3. Nenhuma string "Calcgraf" visível na tela de orçamento.
