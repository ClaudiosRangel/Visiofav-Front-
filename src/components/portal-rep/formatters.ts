/**
 * Módulo de formatadores e validadores brasileiros
 * Usado pelo Portal do Representante Externo
 *
 * Validates: Requirements 7.2, 25.1, 25.2, 25.3, 25.4
 */

/**
 * Formata uma data no padrão brasileiro DD/MM/AAAA
 */
export function formatarData(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}

/**
 * Formata uma data e hora no padrão brasileiro DD/MM/AAAA HH:mm
 */
export function formatarDataHora(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const minuto = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`
}

/**
 * Formata um valor numérico como moeda brasileira R$ X.XXX,XX
 */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Formata uma string de 11 dígitos como CPF: XXX.XXX.XXX-XX
 */
export function formatarCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Formata uma string de 14 dígitos como CNPJ: XX.XXX.XXX/XXXX-XX
 */
export function formatarCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  )
}

/**
 * Formata uma string de 10 ou 11 dígitos como telefone brasileiro
 * 11 dígitos: (XX) XXXXX-XXXX (celular)
 * 10 dígitos: (XX) XXXX-XXXX (fixo)
 */
export function formatarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

/**
 * Detecta se o documento é CPF (11 dígitos) ou CNPJ (14 dígitos) e aplica a máscara correspondente
 */
export function formatarDocumento(doc: string): string {
  const digits = doc.replace(/\D/g, '')
  if (digits.length === 11) {
    return formatarCpf(digits)
  }
  if (digits.length === 14) {
    return formatarCnpj(digits)
  }
  return doc
}

/**
 * Valida CPF usando algoritmo de dígitos verificadores
 * Retorna true se o CPF for válido, false caso contrário
 */
export function validarCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  if (digits.length !== 11) return false

  // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Cálculo do primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits[i]) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[9])) return false

  // Cálculo do segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits[i]) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[10])) return false

  return true
}

/**
 * Valida CNPJ usando algoritmo de dígitos verificadores
 * Retorna true se o CNPJ for válido, false caso contrário
 */
export function validarCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')

  if (digits.length !== 14) return false

  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Cálculo do primeiro dígito verificador
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma = 0
  for (let i = 0; i < 12; i++) {
    soma += parseInt(digits[i]) * pesos1[i]
  }
  let resto = soma % 11
  const dig1 = resto < 2 ? 0 : 11 - resto
  if (dig1 !== parseInt(digits[12])) return false

  // Cálculo do segundo dígito verificador
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  soma = 0
  for (let i = 0; i < 13; i++) {
    soma += parseInt(digits[i]) * pesos2[i]
  }
  resto = soma % 11
  const dig2 = resto < 2 ? 0 : 11 - resto
  if (dig2 !== parseInt(digits[13])) return false

  return true
}
