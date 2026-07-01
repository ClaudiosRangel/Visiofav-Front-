import { useCrudGenerico } from '@/data/hooks/useCrudGenerico'

// === Interfaces dos Cadastros Fiscais ===

export interface Ncm {
  id: string
  codigo: string
  descricao: string
  aliqIPI: number | null
  exTipi: string | null
}

export interface Cfop {
  id: string
  codigo: string
  descricao: string
  tipo: 'ENTRADA' | 'SAIDA'
}

export interface Cest {
  id: string
  codigo: string
  descricao: string
  segmento: string | null
}

export interface CstCsosn {
  id: string
  codigo: string
  tipo: 'CST' | 'CSOSN'
  descricao: string
}

export interface NaturezaOperacao {
  id: string
  descricao: string
  cfopEntrada: string | null
  cfopSaida: string | null
  tipoOperacao: string
  ativo: boolean
}

export interface RegraTributaria {
  id: string
  ncm: string
  cfop: string
  ufOrigem: string
  ufDestino: string
  regimeTributario: number
  icmsAliquota: number
  icmsCst: string | null
  icmsCsosn: string | null
  pisAliquota: number
  pisCst: string | null
  cofinsAliquota: number
  cofinsCst: string | null
  ipiAliquota: number
  ipiCst: string | null
  ativo: boolean
}

export interface Gnre {
  id: string
  ufDestino: string
  codigoReceita: string
  valor: number
  referencia: string
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO'
  dataPagamento: string | null
}

export interface CertificadoDigital {
  id: string
  cnpj: string
  titular: string
  validoDe: string
  validoAte: string
  ativo: boolean
  diasParaVencer: number
  statusVencimento: 'VALIDO' | 'PROXIMO_VENCIMENTO' | 'EXPIRADO'
}

// === Instâncias CRUD para cada cadastro fiscal ===

export const ncmCrud = useCrudGenerico<Ncm>('/fiscal/cadastros/ncm', 'fiscal-ncm')
export const cfopCrud = useCrudGenerico<Cfop>('/fiscal/cadastros/cfop', 'fiscal-cfop')
export const cestCrud = useCrudGenerico<Cest>('/fiscal/cadastros/cest', 'fiscal-cest')
export const cstCsosnCrud = useCrudGenerico<CstCsosn>('/fiscal/cadastros/cst-csosn', 'fiscal-cst-csosn')
export const naturezaOperacaoCrud = useCrudGenerico<NaturezaOperacao>(
  '/fiscal/cadastros/natureza-operacao',
  'fiscal-natureza-operacao'
)
export const motorTributarioCrud = useCrudGenerico<RegraTributaria>(
  '/fiscal/motor-tributario',
  'fiscal-motor-tributario'
)
export const gnreCrud = useCrudGenerico<Gnre>('/fiscal/gnre', 'fiscal-gnre')
export const certificadosCrud = useCrudGenerico<CertificadoDigital>(
  '/fiscal/certificados',
  'fiscal-certificados'
)
