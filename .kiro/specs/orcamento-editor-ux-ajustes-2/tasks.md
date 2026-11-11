# Plano de Implementação — Ajustes 2 do Editor de Orçamento

Legenda: `[FRONT]` = VisioFab.Wms.Front; `[BACK]` = VisioFab.Wms.Back.

- [x] 1. [FRONT] Barra de KPIs não corta ao rolar (Req 1)
  - Modal full-screen com `body` padding 0 + scroll próprio; ResumoKpis cola no
    topo (abaixo do header) com padding próprio; conteúdo com padding interno.

- [x] 2. [FRONT] Remover encaixe/imagens duplicados do corpo (Req 2)
  - StepRevisao: removidos encaixe calculado, encaixe real, botão Baixar SVG e
    ImagensProdutoFaca. Tudo isso vive só no painel Preview.

- [x] 5. [FRONT] Seções próprias no índice (Req 5)
  - Âncoras `materiais-acabamento` e `itens-complementares` + rótulos.
  - StepAcabamentos ganhou prop `mostrar` ('acabamentos'|'materiais'|'ambos').
  - SecaoAcabamentos (só acabamentos) + SecaoMateriaisAcabamento + Secao-
    ItensComplementares; EditorItem mapeia as 3 e inclui no statusPorAncora.

- [x] 6. [FRONT] Layout Dados Técnicos (Req 6)
  - StepDadosTecnicos reorganizado em painéis: Processos de Impressão | Avisos de
    Preenchimento | Configuração da Faca (imagem + formatos + montagem) +
    Acondicionamento. Mesmos campos/bindings; sem campo novo de cálculo.

- [x] 3/4. [BACK+FRONT] Ficha Master no editor e no Preview (Req 3 e 4)
  - BACK: `GET /orcamento-grafico/:id/ficha-master` consolida faca/arte/campos
    (definitivo do produto → rascunho do pedido → fallback do orçamento),
    empresaId explícito.
  - FRONT: EditorItem busca a ficha, pré-preenche gramatura quando vazia
    (conservador, uma vez), e passa faca (prioriza ficha) + arte ao PainelPreview
    (que ganhou bloco "Arte").

- [x] 7. Verificação e não-regressão
  - get_diagnostics limpo em todos os arquivos tocados (back e front). Motor de
    cálculo inalterado. Sem "Calcgraf" visível.

## Notas
- Pré-preenchimento automático foi mantido conservador: só `gramatura` tem
  mapeamento seguro e inequívoco da Ficha Master para o form do item. Os demais
  campos da ficha (cartão/cores/acabamentos/matriz) ficam para exibição/preview;
  ampliar o pré-preenchimento exige decidir o mapeamento campo a campo.
