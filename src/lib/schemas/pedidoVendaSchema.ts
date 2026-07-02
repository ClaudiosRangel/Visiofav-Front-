import { z } from 'zod'

const UFS_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
] as const

const enderecoEntregaSchema = z.object({
  logradouro: z.string().max(200),
  numero: z.string().max(20),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100),
  cidade: z.string().max(100),
  uf: z.enum(UFS_VALIDAS, { errorMap: () => ({ message: 'UF inválida' }) }),
  cep: z.string().regex(/^\d{8}$/, 'CEP deve conter exatamente 8 dígitos numéricos'),
})

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  unidade: z.string().optional(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.number().min(0),
  desconto: z.number().min(0).max(100).default(0),
  descontoValor: z.number().min(0).default(0),
  frete: z.number().min(0).default(0),
  seguro: z.number().min(0).default(0),
  outrasDespesas: z.number().min(0).default(0),
  observacaoItem: z.string().max(1000).optional(),
  dataEntregaItem: z.string().optional(),
  comissaoPercItem: z.number().min(0).max(100).optional(),
}).refine((item) => {
  const precoFinal = (item.precoUnitario * (1 - item.desconto / 100)) - item.descontoValor
  return precoFinal >= 0
}, { message: 'Desconto total excede o preço do produto', path: ['descontoValor'] })

export const pedidoVendaSchema = z.object({
  // Dados Gerais
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  vendedorId: z.string().optional(),
  tabelaPrecoId: z.string().min(1, 'Tabela de preço é obrigatória'),
  condicaoPagId: z.string().optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'URGENTE']).default('NORMAL'),
  origemPedido: z.enum(['MANUAL', 'ECOMMERCE', 'EDI', 'ORCAMENTO']).default('MANUAL'),
  numeroPedidoCliente: z.string().max(60).optional(),
  orcamentoOrigemId: z.string().optional(),
  dataValidade: z.string().optional().refine((val) => {
    if (!val) return true
    return new Date(val) >= new Date(new Date().toDateString())
  }, 'Data de validade deve ser igual ou posterior a hoje'),

  // Entrega e Transporte
  dataEntrega: z.string().optional().refine((val) => {
    if (!val) return true
    return new Date(val) >= new Date(new Date().toDateString())
  }, 'Data de entrega deve ser igual ou posterior a hoje'),
  transportadoraId: z.string().optional(),
  modalidadeFrete: z.number().optional(),
  enderecoEntrega: enderecoEntregaSchema.optional(),

  // Financeiro
  tipoDesconto: z.enum(['PERCENTUAL', 'VALOR_FIXO']).optional(),
  descontoGeral: z.number().min(0).optional(),
  tipoAcrescimo: z.enum(['FRETE', 'SEGURO', 'OUTRAS_DESPESAS']).optional(),
  acrescimoGeral: z.number().min(0).optional(),

  // Itens
  itens: z.array(itemSchema).min(1, 'Pelo menos um item é obrigatório'),

  // Observações
  observacao: z.string().max(1000).optional(),
  observacaoNota: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  // Cross-field: endereço parcial exige todos os campos
  if (data.enderecoEntrega) {
    const addr = data.enderecoEntrega
    const hasAny = addr.logradouro || addr.numero || addr.bairro || addr.cidade || addr.uf || addr.cep
    if (hasAny) {
      if (!addr.logradouro) ctx.addIssue({ code: 'custom', message: 'Logradouro obrigatório', path: ['enderecoEntrega', 'logradouro'] })
      if (!addr.numero) ctx.addIssue({ code: 'custom', message: 'Número obrigatório', path: ['enderecoEntrega', 'numero'] })
      if (!addr.bairro) ctx.addIssue({ code: 'custom', message: 'Bairro obrigatório', path: ['enderecoEntrega', 'bairro'] })
      if (!addr.cidade) ctx.addIssue({ code: 'custom', message: 'Cidade obrigatória', path: ['enderecoEntrega', 'cidade'] })
      if (!addr.uf) ctx.addIssue({ code: 'custom', message: 'UF obrigatória', path: ['enderecoEntrega', 'uf'] })
      if (!addr.cep) ctx.addIssue({ code: 'custom', message: 'CEP obrigatório', path: ['enderecoEntrega', 'cep'] })
    }
  }

  // Cross-field: desconto
  if (data.descontoGeral && data.descontoGeral > 0 && !data.tipoDesconto) {
    ctx.addIssue({ code: 'custom', message: 'Tipo de desconto é obrigatório quando desconto geral é informado', path: ['tipoDesconto'] })
  }
  if (data.tipoDesconto && (!data.descontoGeral || data.descontoGeral <= 0)) {
    ctx.addIssue({ code: 'custom', message: 'Desconto geral é obrigatório quando tipo de desconto é selecionado', path: ['descontoGeral'] })
  }
  if (data.tipoDesconto === 'PERCENTUAL' && data.descontoGeral) {
    if (data.descontoGeral < 0.01 || data.descontoGeral > 100) {
      ctx.addIssue({ code: 'custom', message: 'Desconto percentual deve ser entre 0.01 e 100.00', path: ['descontoGeral'] })
    }
  }

  // Cross-field: acréscimo
  if (data.acrescimoGeral && data.acrescimoGeral > 0 && !data.tipoAcrescimo) {
    ctx.addIssue({ code: 'custom', message: 'Tipo de acréscimo é obrigatório quando acréscimo geral é informado', path: ['tipoAcrescimo'] })
  }
  if (data.tipoAcrescimo && (!data.acrescimoGeral || data.acrescimoGeral <= 0)) {
    ctx.addIssue({ code: 'custom', message: 'Acréscimo geral é obrigatório quando tipo de acréscimo é selecionado', path: ['acrescimoGeral'] })
  }
})

export type PedidoVendaFormValues = z.infer<typeof pedidoVendaSchema>
