import { useState } from 'react'
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, it, expect } from 'vitest'

/**
 * Fase 3 (tarefa 15.4) — bloco de campos livres do StepItensDiversos:
 * rótulos sugeridos em ordem, opções de LISTA com indicador "padrão" (sem selecionar),
 * digitação livre e limite de 20 pares.
 */

import StepItensDiversos from './StepItensDiversos'
import type { OpcaoSugerida } from '../[id]/editor/campos-livres-puro'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
// jsdom não implementa scrollIntoView (usado pelo dropdown do Mantine).
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})

type Par = { rotulo: string; conteudo: string }

interface Capturas {
  ultimo: Par[]
}

function Wrapper({
  inicial,
  sugestoesRotulos,
  opcoesPorRotulo,
  obrigatorios,
  capturas,
}: {
  inicial: Par[]
  sugestoesRotulos?: string[]
  opcoesPorRotulo?: Record<string, OpcaoSugerida[]>
  obrigatorios?: Set<string>
  capturas?: Capturas
}) {
  const [form, setForm] = useState<any>({ camposLivres: inicial, itensDiversos: [], itensFornecidos: [] })
  if (capturas) capturas.ultimo = form.camposLivres
  return (
    <MantineProvider>
      <StepItensDiversos
        formData={form}
        updateForm={(p) => setForm((f: any) => ({ ...f, ...p }))}
        sugestoesRotulos={sugestoesRotulos}
        opcoesPorRotulo={opcoesPorRotulo}
        obrigatorios={obrigatorios}
      />
    </MantineProvider>
  )
}

const rotuloInputs = () => screen.getAllByPlaceholderText('Rótulo') as HTMLInputElement[]
const conteudoInputs = () => screen.getAllByPlaceholderText('Conteúdo') as HTMLInputElement[]
const botaoAdicionarCampos = () => {
  const bloco = screen.getByText('Campos Livres').closest('.mantine-Paper-root') as HTMLElement
  return within(bloco).getByRole('button', { name: /Adicionar/i })
}

describe('StepItensDiversos — campos livres com sugestões', () => {
  it('lista os rótulos sugeridos na ordem recebida', async () => {
    render(
      <Wrapper
        inicial={[{ rotulo: '', conteudo: '' }]}
        sugestoesRotulos={['ARTE', 'CORES', 'PADRÃO']}
      />,
    )
    fireEvent.focus(rotuloInputs()[0])
    fireEvent.click(rotuloInputs()[0])
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['ARTE', 'CORES', 'PADRÃO'])
  })

  it('opções do rótulo mostram "padrão" na opção padrão e nunca a selecionam sozinhas', async () => {
    const capturas: Capturas = { ultimo: [] }
    render(
      <Wrapper
        inicial={[{ rotulo: 'ARTE', conteudo: '' }]}
        sugestoesRotulos={['ARTE']}
        opcoesPorRotulo={{
          ARTE: [
            { valor: 'Nova', padrao: false },
            { valor: 'Repetição', padrao: true },
          ],
        }}
        capturas={capturas}
      />,
    )
    fireEvent.focus(conteudoInputs()[0])
    fireEvent.click(conteudoInputs()[0])
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(2))
    const opcoes = screen.getAllByRole('option')
    expect(opcoes[0].textContent).toBe('Nova')
    expect(opcoes[1].textContent).toContain('Repetição')
    expect(opcoes[1].textContent).toContain('padrão')
    expect(within(opcoes[0]).queryByText('padrão')).toBeNull()
    // Nenhuma opção foi aplicada ao conteúdo.
    expect(capturas.ultimo[0].conteudo).toBe('')
    expect(conteudoInputs()[0].value).toBe('')
  })

  it('permite digitação livre fora das opções sugeridas', () => {
    const capturas: Capturas = { ultimo: [] }
    render(
      <Wrapper
        inicial={[{ rotulo: 'ARTE', conteudo: '' }]}
        sugestoesRotulos={['ARTE']}
        opcoesPorRotulo={{ ARTE: [{ valor: 'Nova', padrao: true }] }}
        capturas={capturas}
      />,
    )
    fireEvent.change(conteudoInputs()[0], { target: { value: 'Texto qualquer' } })
    expect(capturas.ultimo[0].conteudo).toBe('Texto qualquer')
    fireEvent.change(rotuloInputs()[0], { target: { value: 'Rótulo novo' } })
    expect(capturas.ultimo[0].rotulo).toBe('Rótulo novo')
  })

  it('obrigatório mostra só o indicador e não bloqueia a edição', () => {
    render(
      <Wrapper
        inicial={[{ rotulo: 'ARTE', conteudo: '' }]}
        sugestoesRotulos={['ARTE']}
        obrigatorios={new Set(['ARTE'])}
      />,
    )
    expect(screen.getByLabelText('obrigatório')).toBeInTheDocument()
  })

  it('limite de 20 pares: adiciona até 20 e depois bloqueia o botão', () => {
    const capturas: Capturas = { ultimo: [] }
    const inicial = Array.from({ length: 19 }, (_, i) => ({ rotulo: `R${i}`, conteudo: '' }))
    render(<Wrapper inicial={inicial} sugestoesRotulos={['ARTE']} capturas={capturas} />)
    expect(botaoAdicionarCampos()).toBeEnabled()
    fireEvent.click(botaoAdicionarCampos())
    expect(capturas.ultimo).toHaveLength(20)
    expect(botaoAdicionarCampos()).toBeDisabled()
    fireEvent.click(botaoAdicionarCampos())
    expect(capturas.ultimo).toHaveLength(20)
  })

  it('sem props de sugestão mantém os campos de texto simples (comportamento antigo)', () => {
    render(<Wrapper inicial={[{ rotulo: 'ARTE', conteudo: 'x' }]} />)
    expect(rotuloInputs()[0].value).toBe('ARTE')
    expect(conteudoInputs()[0].value).toBe('x')
  })
})
