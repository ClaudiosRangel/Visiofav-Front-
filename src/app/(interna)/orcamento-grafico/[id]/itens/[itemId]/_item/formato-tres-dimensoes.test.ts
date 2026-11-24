import { describe, expect, it } from 'vitest'
import { separarTresDimensoes } from './BlocoFormato'

describe('Comp x Larg x Alt num campo só', () => {
  it('separa as três medidas com x, X, × ou *', () => {
    expect(separarTresDimensoes('220x150x80')).toEqual(['220', '150', '80'])
    expect(separarTresDimensoes('220 X 150 × 80,5')).toEqual(['220', '150', '80,5'])
    expect(separarTresDimensoes('220*150')).toEqual(['220', '150', ''])
  })

  it('texto parcial ou vazio não perde o que foi digitado', () => {
    expect(separarTresDimensoes('220')).toEqual(['220', '', ''])
    expect(separarTresDimensoes('220 x ')).toEqual(['220', '', ''])
    expect(separarTresDimensoes('')).toEqual(['', '', ''])
  })
})
