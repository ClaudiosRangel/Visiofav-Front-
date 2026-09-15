import { describe, it, expect } from 'vitest'
import { validarCpf, validarCnpj, detectarTipoPessoa, validarDocumento, mascararDocumento, rotuloDocumento } from './documento'

describe('validarCpf/validarCnpj', () => {
  it('vetores conhecidos', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('529.982.247-24')).toBe(false)
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
    expect(validarCnpj('11.222.333/0001-80')).toBe(false)
  })
})

describe('detectarTipoPessoa', () => {
  it('11→FISICA, 14→JURIDICA, outro→null', () => {
    expect(detectarTipoPessoa('52998224725')).toBe('FISICA')
    expect(detectarTipoPessoa('11222333000181')).toBe('JURIDICA')
    expect(detectarTipoPessoa('123')).toBeNull()
  })
})

describe('validarDocumento', () => {
  it('vazio é válido (opcional)', () => {
    expect(validarDocumento('')).toEqual({ valido: true, tipoPessoa: null })
  })
  it('detecta e valida', () => {
    expect(validarDocumento('529.982.247-25')).toEqual({ valido: true, tipoPessoa: 'FISICA' })
    expect(validarDocumento('11.222.333/0001-81')).toEqual({ valido: true, tipoPessoa: 'JURIDICA' })
  })
})

describe('mascararDocumento', () => {
  it('CPF', () => { expect(mascararDocumento('52998224725')).toBe('529.982.247-25') })
  it('CNPJ', () => { expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81') })
})

describe('rotuloDocumento', () => {
  it('muda conforme tamanho', () => {
    expect(rotuloDocumento('52998224725')).toBe('CPF')
    expect(rotuloDocumento('11222333000181')).toBe('CNPJ')
    expect(rotuloDocumento('123')).toBe('CPF/CNPJ')
  })
})
