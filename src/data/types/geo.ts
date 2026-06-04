// ===== Interfaces =====

/** Resultado de geocodificação de cliente ou empresa */
export interface GeocodificacaoResult {
  latitude: number
  longitude: number
  enderecoFormatado?: string
}

/** Sugestão de rota por proximidade geográfica */
export interface SugestaoRota {
  rotaId: string
  codigo: string
  descricao: string
  distanciaMediaKm: number
  quantidadeClientes: number
}

/** Resultado da otimização de rota */
export interface OtimizacaoResult {
  sequencia: SequenciaEntrega[]
  distanciaTotalKm: number
}

/** Item da sequência de entrega otimizada */
export interface SequenciaEntrega {
  ordem: number
  nfeId: string
  clienteId: string
  clienteRazaoSocial: string
  endereco: string
  distanciaParcialKm: number | null
  temGeolocalizacao: boolean
}

/** Request para salvar sequência de entrega */
export interface SalvarSequenciaRequest {
  sequencia: Array<{
    nfeId: string
    ordem: number
  }>
}

/** Resultado de cálculo de distância */
export interface DistanciaResult {
  distanciaKm: number
  origemLatitude: number
  origemLongitude: number
  destinoLatitude: number
  destinoLongitude: number
}

/** Cobertura geográfica de uma rota */
export interface CoberturaRota {
  rotaId: string
  rotaDescricao: string
  totalClientesGeocodificados: number
  totalClientesNaoGeocodificados: number
  cidades: CidadeCobertura[]
}

/** Cidade dentro da cobertura de uma rota */
export interface CidadeCobertura {
  cidade: string
  uf: string
  bairros: BairroCobertura[]
}

/** Bairro dentro da cobertura de uma cidade */
export interface BairroCobertura {
  bairro: string
  quantidadeClientes: number
}

/** Cobertura consolidada de todas as rotas */
export interface CoberturaConsolidada {
  rotas: CoberturaRota[]
  sobreposicoes: Sobreposicao[]
}

/** Sobreposição de área entre rotas */
export interface Sobreposicao {
  cidade: string
  bairro: string
  rotas: Array<{ rotaId: string; codigo: string; descricao: string }>
}

/** Resultado de geocodificação em lote */
export interface BatchGeoResult {
  totalProcessados: number
  sucessos: number
  falhas: number
  detalheFalhas: Array<{
    clienteId: string
    razaoSocial: string
    motivo: string
  }>
}

/** Resumo de status de geocodificação dos clientes */
export interface ResumoGeoClientes {
  total: number
  geocodificados: number
  naoGeocodificados: number
}

// ===== Query Keys =====

export const GEO_KEYS = {
  clientes: 'clientes',
  empresa: 'empresa-config',
  mapas: 'mapas-carregamento',
  distancia: (clienteId: string) => ['geo-distancia', clienteId] as const,
  sugestaoRota: (clienteId: string) => ['geo-sugestao-rota', clienteId] as const,
  coberturaRota: (rotaId: string) => ['geo-cobertura', rotaId] as const,
  coberturaConsolidada: ['geo-cobertura-consolidada'] as const,
  resumoGeo: ['geo-resumo-clientes'] as const,
}
