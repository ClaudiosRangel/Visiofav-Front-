import './ambiente-dom.test-util'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { atividade } = vi.hoisted(() => ({ atividade: vi.fn() }))
vi.mock('../../../../cadastros/_shared/cadastros-graficos.api', () => ({ catalogoApi: { atividade } }))

import RestricoesEMateriais, {
  TEXTO_NAO_GRAVADA,
  TEXTO_SEM_ATIVIDADE,
  TEXTO_SEM_MATERIAL,
  TEXTO_SEM_RESTRICAO,
  type RestricoesEMateriaisProps,
} from './RestricoesEMateriais'
import { MENSAGEM_ERRO_RESTRICOES } from '../../../_hooks/restricoes-materiais-puro'

const ATIV = { id: 'a1', nome: 'AFT70 Coladeira' }

const RESPOSTA = {
  restricoes: [
    { id: 'r1', nome: 'Lateral Simples' },
    { id: 'r2', nome: 'Fundo Automático Normal' },
  ],
  materiais: [
    { id: 'm1', nome: 'Cola Branca', tipoParam: 3, ordem: 1, padrao: true },
    { id: 'm2', nome: 'Fita Dupla Face', tipoParam: 2, ordem: 2, padrao: false },
  ],
}

function Pagina(props: Partial<RestricoesEMateriaisProps>) {
  return (
    <MantineProvider>
      <RestricoesEMateriais atividade={ATIV} {...props} />
    </MantineProvider>
  )
}

const escolhaCola = (param1: number | null) => ({
  materialId: 'm1',
  restricaoId: null,
  tipoParam: 3,
  param1,
  param2: null,
  gramaturaKgM2: null,
  pecasPorCaixa: null,
  pendente: false,
})

describe('RestricoesEMateriais (R11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    atividade.mockResolvedValue(RESPOSTA)
  })

  it('sem atividade em foco mostra o texto de orientação e não consulta a rede', () => {
    render(<Pagina atividade={null} />)
    expect(screen.getByText(TEXTO_SEM_ATIVIDADE)).toBeInTheDocument()
    expect(atividade).not.toHaveBeenCalled()
  })

  it('mostra Restrições e Materiais da atividade, cada lista com título próprio', async () => {
    render(<Pagina />)
    expect(await screen.findByLabelText('Lateral Simples')).toBeInTheDocument()
    expect(screen.getByLabelText('Fundo Automático Normal')).toBeInTheDocument()
    expect(screen.getByLabelText('Cola Branca')).toBeInTheDocument()
    expect(screen.getByLabelText('Fita Dupla Face')).toBeInTheDocument()
    const restricoes = screen.getByTestId('lista-restricoes')
    const materiais = screen.getByTestId('lista-materiais')
    expect(restricoes).toHaveTextContent('Restrições')
    expect(materiais).toHaveTextContent('Materiais')
    expect(atividade).toHaveBeenCalledTimes(1)
    expect(atividade.mock.calls[0][0]).toBe('a1')
  })

  it('usa o catálogo do plano sem consultar a rede', async () => {
    render(
      <Pagina
        catalogoDoPlano={{
          atividades: [{ id: 'a1', restricoes: RESPOSTA.restricoes, materiais: RESPOSTA.materiais } as never],
        }}
      />,
    )
    expect(await screen.findByLabelText('Cola Branca')).toBeInTheDocument()
    expect(atividade).not.toHaveBeenCalled()
  })

  it('estados vazios', async () => {
    atividade.mockResolvedValue({ restricoes: [], materiais: [] })
    render(<Pagina />)
    expect(await screen.findByText(TEXTO_SEM_RESTRICAO)).toBeInTheDocument()
    expect(screen.getByText(TEXTO_SEM_MATERIAL)).toBeInTheDocument()
  })

  it('erro mostra a mensagem e "Tentar novamente" recarrega sem tocar nas seleções', async () => {
    atividade.mockRejectedValueOnce(new Error('rede'))
    const onMaterialChange = vi.fn()
    const onRestricaoChange = vi.fn()
    render(<Pagina onMaterialChange={onMaterialChange} onRestricaoChange={onRestricaoChange} />)

    expect(await screen.findByText(MENSAGEM_ERRO_RESTRICOES)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByLabelText('Cola Branca')).toBeInTheDocument()
    expect(atividade).toHaveBeenCalledTimes(2)
    expect(onMaterialChange).not.toHaveBeenCalled()
    expect(onRestricaoChange).not.toHaveBeenCalled()
  })

  it('Restrições recolhidas: só título e contagem até expandir', async () => {
    render(<Pagina restricoesRecolhidas />)
    await screen.findByLabelText('Cola Branca')
    const lista = screen.getByTestId('lista-restricoes')
    expect(lista).toHaveTextContent('Restrições')
    expect(lista).toHaveTextContent('2')
    expect(screen.queryByLabelText('Lateral Simples')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir' }))
    expect(screen.getByLabelText('Lateral Simples')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Recolher' }))
    expect(screen.queryByLabelText('Lateral Simples')).toBeNull()
  })

  it('escolher e limpar restrição chamam onRestricaoChange', async () => {
    const onRestricaoChange = vi.fn().mockResolvedValue(true)
    const { rerender } = render(<Pagina onRestricaoChange={onRestricaoChange} />)
    fireEvent.click(await screen.findByLabelText('Lateral Simples'))
    expect(onRestricaoChange).toHaveBeenLastCalledWith({ id: 'r1', nome: 'Lateral Simples' })

    rerender(<Pagina onRestricaoChange={onRestricaoChange} restricaoId="r1" />)
    fireEvent.click(screen.getByLabelText('Lateral Simples'))
    expect(onRestricaoChange).toHaveBeenLastCalledWith(null)
  })

  it('atividade desmarcada: orienta a marcar e bloqueia as escolhas', async () => {
    render(<Pagina marcada={false} />)
    expect(await screen.findByText('Marque a atividade para escolher restrição ou material.')).toBeInTheDocument()
    expect(screen.getByLabelText('Lateral Simples')).toBeDisabled()
    expect(screen.getByLabelText('Cola Branca')).toBeDisabled()
  })

  describe('parâmetro do material', () => {
    it('mostra o campo com o rótulo do tipoParam só no material escolhido', async () => {
      render(<Pagina escolhaAtual={escolhaCola(5)} />)
      expect(await screen.findByLabelText('Medida em mm')).toHaveValue('5')
      expect(screen.getAllByLabelText('Medida em mm')).toHaveLength(1)
    })

    it('marcar material envia a escolha inicial com a restrição atual', async () => {
      const onMaterialChange = vi.fn().mockResolvedValue(true)
      render(<Pagina onMaterialChange={onMaterialChange} restricaoId="r2" />)
      fireEvent.click(await screen.findByLabelText('Cola Branca'))
      await waitFor(() => expect(onMaterialChange).toHaveBeenCalledTimes(1))
      expect(onMaterialChange.mock.calls[0][0]).toMatchObject({ materialId: 'm1', tipoParam: 3, restricaoId: 'r2' })
    })

    it('desmarcar o material limpa a escolha (null)', async () => {
      const onMaterialChange = vi.fn().mockResolvedValue(true)
      render(<Pagina onMaterialChange={onMaterialChange} escolhaAtual={escolhaCola(5)} />)
      fireEvent.click(await screen.findByLabelText('Cola Branca'))
      await waitFor(() => expect(onMaterialChange).toHaveBeenCalledWith(null))
    })

    it.each(['', '0', '-2', '100000', 'abc', '1,234'])('valor inválido "%s" não grava e mostra o intervalo', async (texto) => {
      const onMaterialChange = vi.fn().mockResolvedValue(true)
      render(<Pagina onMaterialChange={onMaterialChange} escolhaAtual={escolhaCola(5)} />)
      const campo = await screen.findByLabelText('Medida em mm')
      fireEvent.change(campo, { target: { value: texto } })
      fireEvent.blur(campo)
      expect(
        await screen.findByText('Informe um valor maior que 0 e até 99.999,99, com até 2 casas decimais.'),
      ).toBeInTheDocument()
      expect(onMaterialChange).not.toHaveBeenCalled()
    })

    it('valor válido grava como número', async () => {
      const onMaterialChange = vi.fn().mockResolvedValue(true)
      render(<Pagina onMaterialChange={onMaterialChange} escolhaAtual={escolhaCola(5)} />)
      const campo = await screen.findByLabelText('Medida em mm')
      fireEvent.change(campo, { target: { value: '12,5' } })
      fireEvent.blur(campo)
      await waitFor(() => expect(onMaterialChange).toHaveBeenCalledTimes(1))
      expect(onMaterialChange.mock.calls[0][0]).toMatchObject({ materialId: 'm1', tipoParam: 3, param1: 12.5 })
    })

    it('valor igual ao gravado não grava de novo', async () => {
      const onMaterialChange = vi.fn().mockResolvedValue(true)
      render(<Pagina onMaterialChange={onMaterialChange} escolhaAtual={escolhaCola(5)} />)
      const campo = await screen.findByLabelText('Medida em mm')
      fireEvent.blur(campo)
      expect(onMaterialChange).not.toHaveBeenCalled()
    })

    it('gravação que falha restaura o valor anterior e avisa que não foi gravada', async () => {
      const onMaterialChange = vi.fn().mockResolvedValue(false)
      render(<Pagina onMaterialChange={onMaterialChange} escolhaAtual={escolhaCola(5)} />)
      const campo = (await screen.findByLabelText('Medida em mm')) as HTMLInputElement
      fireEvent.change(campo, { target: { value: '12' } })
      expect(campo.value).toBe('12')
      fireEvent.blur(campo)

      expect(await screen.findByText(TEXTO_NAO_GRAVADA)).toBeInTheDocument()
      await waitFor(() => expect((screen.getByLabelText('Medida em mm') as HTMLInputElement).value).toBe('5'))
    })

    it('mostra o erro da seleção com os materiais permitidos', async () => {
      render(
        <Pagina
          escolhaAtual={escolhaCola(5)}
          erroSelecao={{ mensagem: 'Material não permitido.', permitidos: ['Cola Branca', 'Cola Azul'] }}
        />,
      )
      expect(await screen.findByText('Material não permitido.')).toBeInTheDocument()
      expect(screen.getByText('Permitidos: Cola Branca, Cola Azul')).toBeInTheDocument()
    })
  })
})
