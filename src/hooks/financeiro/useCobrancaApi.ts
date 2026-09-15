/**
 * Financeiro Onda 2 (frontend) — camada de acesso à cobrança bancária.
 * Prefixo /financeiro-cobranca sobre NEXT_PUBLIC_API_URL.
 */
import { api } from '@/lib/api'

const BASE = '/financeiro-cobranca'

export interface Convenio {
  id: string
  tipo: 'BOLETO' | 'PIX' | 'AMBOS'
  banco: string
  agencia: string
  conta: string
  beneficiario: string
  status: boolean
  temClientSecret?: boolean
  temCertificadoPix?: boolean
}

export interface Boleto {
  id: string
  convenioId: string
  contaReceberId: string
  nossoNumero: string
  linhaDigitavel: string
  valor: string | number
  vencimento: string
  status: string
}

export interface PixCobranca {
  id: string
  txid: string
  brcode: string
  valor: number
  status: string
}

export const cobrancaApi = {
  // Convênios
  listarConvenios: () => api.get<Convenio[]>(`${BASE}/convenios`).then((r) => r.data),
  criarConvenio: (input: any) => api.post(`${BASE}/convenios`, input).then((r) => r.data),
  inativarConvenio: (id: string) => api.patch(`${BASE}/convenios/${id}/inativar`).then((r) => r.data),

  // Boletos
  listarBoletos: (params?: { status?: string; convenioId?: string }) => api.get<Boleto[]>(`${BASE}/boletos`, { params }).then((r) => r.data),
  emitirBoleto: (tituloId: string, convenioId: string) => api.post(`${BASE}/boletos/emitir`, { tituloId, convenioId }).then((r) => r.data),
  urlBoletoPdf: (id: string) => `${BASE}/boletos/${id}/pdf`,

  // CNAB
  gerarRemessa: (convenioId: string, boletoIds: string[]) => api.post(`${BASE}/cnab/remessa`, { convenioId, boletoIds }).then((r) => r.data),
  processarRetorno: (conteudo: string) => api.post(`${BASE}/cnab/retorno`, { conteudo }).then((r) => r.data),

  // PIX
  listarPix: () => api.get<PixCobranca[]>(`${BASE}/pix`).then((r) => r.data),
  gerarPix: (tituloId: string, convenioId: string) => api.post(`${BASE}/pix/gerar`, { tituloId, convenioId }).then((r) => r.data),
  qrcodePix: (id: string) => api.get<{ qrcode: string }>(`${BASE}/pix/${id}/qrcode`).then((r) => r.data),

  // Régua
  obterRegua: () => api.get(`${BASE}/regua`).then((r) => r.data),
  salvarRegua: (ativa: boolean, eventos: any[]) => api.put(`${BASE}/regua`, { ativa, eventos }).then((r) => r.data),
}
