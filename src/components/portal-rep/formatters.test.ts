import { describe, it, expect } from 'vitest'
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarCpf,
  formatarCnpj,
  formatarTelefone,
  formatarDocumento,
  validarCpf,
  validarCnpj,
} from './formatters'

describe('formatarData', () => {
  it('formata Date no padrão DD/MM/AAAA', () => {
    const date = new Date(2024, 0, 15) // 15 de janeiro de 2024
    expect(formatarData(date)).toBe('15/01/2024')
  })

  it('formata string ISO no padrão DD/MM/AAAA', () => {
    expect(formatarData('2024-06-25T10:30:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})

describe('formatarDataHora', () => {
  it('formata Date no padrão DD/MM/AAAA HH:mm', () => {
    const date = new Date(2024, 5, 10, 14, 30) // 10/06/2024 14:30
    expect(formatarDataHora(date)).toBe('10/06/2024 14:30')
  })
})

describe('formatarMoeda', () => {
  it('formata valor com centavos', () => {
    const resultado = formatarMoeda(1234.56)
    // toLocaleString pode usar espaço normal ou non-breaking space
    expect(resultado).toMatch(/R\$\s*1\.234,56/)
  })

  it('formata zero', () => {
    const resultado = formatarMoeda(0)
    expect(resultado).toMatch(/R\$\s*0,00/)
  })

  it('formata valores grandes', () => {
    const resultado = formatarMoeda(99999.99)
    expect(resultado).toMatch(/R\$\s*99\.999,99/)
  })
})

describe('formatarCpf', () => {
  it('formata 11 dígitos como CPF', () => {
    expect(formatarCpf('12345678901')).toBe('123.456.789-01')
  })

  it('formata CPF com caracteres não numéricos', () => {
    expect(formatarCpf('123.456.789-01')).toBe('123.456.789-01')
  })
})

describe('formatarCnpj', () => {
  it('formata 14 dígitos como CNPJ', () => {
    expect(formatarCnpj('12345678000199')).toBe('12.345.678/0001-99')
  })
})

describe('formatarTelefone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatarTelefone('11999887766')).toBe('(11) 99988-7766')
  })

  it('formata fixo com 10 dígitos', () => {
    expect(formatarTelefone('1133224455')).toBe('(11) 3322-4455')
  })
})

describe('formatarDocumento', () => {
  it('detecta CPF (11 dígitos) e aplica máscara', () => {
    expect(formatarDocumento('12345678901')).toBe('123.456.789-01')
  })

  it('detecta CNPJ (14 dígitos) e aplica máscara', () => {
    expect(formatarDocumento('12345678000199')).toBe('12.345.678/0001-99')
  })

  it('retorna o documento original se não for 11 nem 14 dígitos', () => {
    expect(formatarDocumento('12345')).toBe('12345')
  })
})

describe('validarCpf', () => {
  it('valida CPF correto', () => {
    expect(validarCpf('52998224725')).toBe(true)
  })

  it('rejeita CPF com dígito verificador incorreto', () => {
    expect(validarCpf('52998224700')).toBe(false)
  })

  it('rejeita CPF com todos os dígitos iguais', () => {
    expect(validarCpf('11111111111')).toBe(false)
    expect(validarCpf('00000000000')).toBe(false)
  })

  it('rejeita CPF com tamanho incorreto', () => {
    expect(validarCpf('1234567890')).toBe(false)
    expect(validarCpf('123456789012')).toBe(false)
  })

  it('valida CPF com pontuação', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
  })
})

describe('validarCnpj', () => {
  it('valida CNPJ correto', () => {
    expect(validarCnpj('11222333000181')).toBe(true)
  })

  it('rejeita CNPJ com dígito verificador incorreto', () => {
    expect(validarCnpj('11222333000100')).toBe(false)
  })

  it('rejeita CNPJ com todos os dígitos iguais', () => {
    expect(validarCnpj('11111111111111')).toBe(false)
  })

  it('rejeita CNPJ com tamanho incorreto', () => {
    expect(validarCnpj('1122233300018')).toBe(false)
    expect(validarCnpj('112223330001811')).toBe(false)
  })

  it('valida CNPJ com pontuação', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })
})
