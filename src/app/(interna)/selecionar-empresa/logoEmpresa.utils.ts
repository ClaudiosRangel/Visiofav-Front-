export const MIMETYPES_LOGO_PERMITIDOS = ['image/png', 'image/jpeg'] as const
export const TAMANHO_MAXIMO_LOGO_CLIENT_BYTES = 2_097_152 // 2MB

export type MotivoRejeicaoLogoClient = 'TIPO_INVALIDO' | 'TAMANHO_EXCEDIDO'

export type ResultadoValidacaoLogoClient =
  | { aprovado: true }
  | { aprovado: false; motivo: MotivoRejeicaoLogoClient }

export type ModoFormularioEmpresa = 'criar' | 'editar'

export interface DecisaoPayloadLogo {
  incluirCampo: boolean
  valor?: string | null
}

/**
 * Requirements 2.1, 2.2, 2.3, 2.4, 2.5 — Validador_Logo_Client. Função pura —
 * recebe apenas o mimetype declarado e o tamanho em bytes do arquivo (nunca o
 * conteúdo binário), sem I/O. Verifica tipo MIME antes de tamanho; ambos
 * precisam ser válidos para aprovação.
 */
export function validarArquivoLogoClient(
  mimetype: string,
  tamanhoBytes: number,
): ResultadoValidacaoLogoClient {
  if (!MIMETYPES_LOGO_PERMITIDOS.includes(mimetype as (typeof MIMETYPES_LOGO_PERMITIDOS)[number])) {
    return { aprovado: false, motivo: 'TIPO_INVALIDO' }
  }
  if (tamanhoBytes > TAMANHO_MAXIMO_LOGO_CLIENT_BYTES) {
    return { aprovado: false, motivo: 'TAMANHO_EXCEDIDO' }
  }
  return { aprovado: true }
}

/**
 * Requirements 2.2, 2.3 — mensagem em português correspondente a cada motivo
 * de rejeição do Validador_Logo_Client, usada pela Notificação_Erro.
 */
export function mensagemErroLogoClient(motivo: MotivoRejeicaoLogoClient): string {
  switch (motivo) {
    case 'TIPO_INVALIDO':
      return 'Apenas arquivos PNG ou JPG são aceitos para o logo.'
    case 'TAMANHO_EXCEDIDO':
      return 'O tamanho máximo permitido para o logo é 2MB.'
  }
}

/**
 * Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2 — decide se o campo `logo`
 * deve constar no corpo enviado ao backend, e com qual valor. Função pura,
 * sem I/O.
 *
 * `estadoLogo`: valor atual do campo no formulário (`string | null`).
 * `logoFoiTocado`: `true` se o usuário interagiu com o Campo_Logo durante
 *   esta sessão (selecionou um arquivo novo OU removeu o logo existente);
 *   `false` se o campo permanece exatamente como foi inicializado por
 *   `reset()` (relevante apenas em modo 'editar' — em modo 'criar' o valor
 *   inicial é sempre `null` e qualquer seleção já é "tocado").
 *
 * Regra: em modo 'criar', o campo é sempre incluído (com `null` quando
 * nenhum arquivo foi selecionado, ou com a string quando foi). Em modo
 * 'editar', o campo só é incluído quando `logoFoiTocado === true`; caso
 * contrário é omitido, preservando o logo já cadastrado no backend.
 */
export function determinarLogoParaPayload(
  estadoLogo: string | null,
  modo: ModoFormularioEmpresa,
  logoFoiTocado: boolean,
): DecisaoPayloadLogo {
  if (modo === 'editar' && !logoFoiTocado) {
    return { incluirCampo: false }
  }
  return { incluirCampo: true, valor: estadoLogo }
}

/**
 * Requirements 1.3, 1.4 — decide se o preview do Campo_Logo deve ser
 * exibido. Função pura, sem I/O. Retorna `true` se e somente se
 * `estadoLogo` é uma string com comprimento maior que zero.
 */
export function deveExibirPreviewLogo(estadoLogo: string | null | undefined): boolean {
  return typeof estadoLogo === 'string' && estadoLogo.length > 0
}

/**
 * Requirements 1.5 — decide se o botão de remover logo deve ser exibido.
 * Função pura, sem I/O. Retorna `true` se e somente se `estadoLogo` é uma
 * string com comprimento maior que zero.
 */
export function deveExibirBotaoRemoverLogo(estadoLogo: string | null | undefined): boolean {
  return typeof estadoLogo === 'string' && estadoLogo.length > 0
}

/**
 * Requirements 1.6 — representa a ação de remover o logo. Função pura, sem
 * I/O. Sempre retorna `null`, independentemente do valor anterior do
 * Estado_Logo, garantindo que remover resulte sempre em `null`.
 */
export function removerLogo(): null {
  return null
}

/**
 * Requirements 5.4, 5.5 — inicializa o Estado_Logo ao abrir o formulário
 * (criação ou edição). Função pura, sem I/O. Retorna `null` quando
 * `logoEditData` é `undefined` ou `null`, e a mesma string quando
 * `logoEditData` é uma string.
 */
export function inicializarEstadoLogo(logoEditData: string | null | undefined): string | null {
  return typeof logoEditData === 'string' ? logoEditData : null
}
