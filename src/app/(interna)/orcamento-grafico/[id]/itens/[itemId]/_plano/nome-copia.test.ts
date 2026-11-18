import { describe, expect, it } from 'vitest'

import { LIMITE_NOME_COPIA, gerarNomeCopia } from './nome-copia'

describe('gerarNomeCopia', () => {
  it('primeira cópia leva "(Cópia)"', () => {
    expect(gerarNomeCopia('Tampa', ['Tampa'])).toBe('Tampa (Cópia)')
  })

  it('usa "(Cópia 2)", "(Cópia 3)" quando o nome já existe', () => {
    expect(gerarNomeCopia('Tampa', ['Tampa', 'Tampa (Cópia)'])).toBe('Tampa (Cópia 2)')
    expect(gerarNomeCopia('Tampa', ['Tampa', 'Tampa (Cópia)', 'Tampa (Cópia 2)'])).toBe('Tampa (Cópia 3)')
  })

  it('compara sem diferenciar caixa nem acento', () => {
    expect(gerarNomeCopia('Fundo', ['Fundo', 'FUNDO (COPIA)'])).toBe('Fundo (Cópia 2)')
    expect(gerarNomeCopia('Cartão', ['cartao (cópia)'])).toBe('Cartão (Cópia 2)')
  })

  it('nome já terminado em "(Cópia)" parte do nome base', () => {
    expect(gerarNomeCopia('Tampa (Cópia)', ['Tampa', 'Tampa (Cópia)'])).toBe('Tampa (Cópia 2)')
    expect(gerarNomeCopia('Tampa (cópia 2)', ['Tampa', 'Tampa (Cópia)', 'Tampa (cópia 2)'])).toBe('Tampa (Cópia 3)')
  })

  it('nome de 60 caracteres: trunca o nome base, nunca o sufixo', () => {
    const nome = 'A'.repeat(60)
    const copia = gerarNomeCopia(nome, [nome])
    expect(copia.length).toBe(LIMITE_NOME_COPIA)
    expect(copia.endsWith(' (Cópia)')).toBe(true)
    const copia2 = gerarNomeCopia(nome, [nome, copia])
    expect(copia2.length).toBe(LIMITE_NOME_COPIA)
    expect(copia2.endsWith(' (Cópia 2)')).toBe(true)
  })

  it('nunca passa de 60 caracteres e não repete nomes existentes', () => {
    const existentes = ['Miolo']
    for (let i = 0; i < 12; i++) {
      const nome = gerarNomeCopia('Miolo', existentes)
      expect(nome.length).toBeLessThanOrEqual(LIMITE_NOME_COPIA)
      expect(existentes.map((n) => n.toLowerCase())).not.toContain(nome.toLowerCase())
      existentes.push(nome)
    }
  })
})
