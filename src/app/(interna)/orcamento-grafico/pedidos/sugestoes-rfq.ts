/**
 * Sugestões de preenchimento do formulário de Pedido/Proposta (RFQ).
 *
 * Valores derivados da planilha real de pedidos da Carton Wega (384 respostas,
 * "Formulário sem título (respostas).xlsx"), normalizados e consolidados — os
 * que mais se repetem viram opções de combobox (Autocomplete aceita digitar
 * livre). Ordenados por frequência observada.
 */

// #5 Mercado atuante
export const SUG_MERCADO = [
  'Alimentício', 'Cosméticos', 'Alimentos congelados', 'Alimentos', 'E-commerce',
  'Farmacêutico', 'Bebidas', 'Perfumaria', 'Cigarro', 'Lab. Veterinário',
]

// #13 Tipo de serviço / embalagem (complementa o cadastro de TipoEmbalagem)
export const SUG_TIPO_EMBALAGEM = [
  'Cartucho', 'Caixa', 'Display', 'Cinta', 'Sacola', 'Cartela', 'Envelope',
  'Estojo', 'Envoltório', 'Cesta de Natal',
]

// #16 Cartão (complementa o cadastro de Suportes)
export const SUG_CARTAO = [
  'Duplex', 'Fibra longa', 'Triplex', 'Duplex + Micro', 'Duplex + Cartão',
  'Cartão + Cartão', 'Kraft', 'Fibra Longa + Micro Ondulado', 'Kraft + Micro',
]

// #17 Gramatura (texto livre; valores comuns)
export const SUG_GRAMATURA = [
  '240', '250', '260', '276', '280', '290', '295', '300', '310', '190 + 230', '210 + 250',
]

// #22 Acabamentos (checklist livre quando não há cadastro)
export const SUG_ACABAMENTOS = [
  "Verniz Base D'água", 'Verniz UV', "Verniz Base D'água Fosco", 'Laminação Fosca',
  'Sem Verniz', 'Hot Stamping', 'Relevo', 'Plastificação interna', 'Plastificação externa',
  'Verniz Localizado',
]

// #24 Acondicionamento
export const SUG_ACONDICIONAMENTO = ['Caixa', 'Pacote', 'Cintado', 'Opcional']

// #14 Especificação (temperatura/uso)
export const SUG_ESPECIFICACAO = ['Comum', 'Congelado', 'Forno']

// #9 Prazo de pagamento (texto livre; semente também p/ o cadastro de prazos)
export const SUG_PRAZO = [
  '28/35', '28/35/42', '30/45', '30/45/60', '30/45/60 DDL', 'À vista', '30 dias',
  '28 dias', '30/40/50/60 DDL', '21/28/35', '28/35/42/49',
]

// #20 Cores (frente x verso)
export const SUG_CORES = ['4x0', '5x0', '2x0', '6x0', '1x0', '3x0', '4x1', '4x4']
