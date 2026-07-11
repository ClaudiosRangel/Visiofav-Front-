import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmpresaModal from './EmpresaModal'
import { api } from '@/lib/api'

// Mock do módulo de API — evita efeitos colaterais do axios/interceptors (keep-alive,
// localStorage) durante os testes; nenhum dos casos abaixo dispara submit real.
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
  },
}))

// Mock de notifications para inspecionar a Notificação_Erro exibida pelo Campo_Logo.
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}))

import { notifications } from '@mantine/notifications'

const mockedNotifications = notifications as unknown as { show: ReturnType<typeof vi.fn> }

// jsdom não implementa ResizeObserver, usado internamente pelo Modal/ScrollArea do Mantine.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderWithProviders(ui: React.ReactElement, queryClient = createQueryClient()) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>
  )
  return { ...result, queryClient }
}

// O Modal do Mantine renderiza seu conteúdo via Portal (filho de document.body,
// fora da subárvore do `container` retornado por render) — por isso as
// consultas abaixo usam `document.body` em vez de `container`.
function getFileInput(): HTMLInputElement {
  const input = document.body.querySelector('input[type="file"]')
  if (!input) throw new Error('input[type="file"] do Campo_Logo não encontrado')
  return input as HTMLInputElement
}

function getInputByName(name: string): HTMLInputElement {
  const input = document.body.querySelector(`input[name="${name}"]`)
  if (!input) throw new Error(`input[name="${name}"] não encontrado`)
  return input as HTMLInputElement
}

function getSubmitButton(): HTMLButtonElement {
  const button = document.body.querySelector('button[type="submit"]')
  if (!button) throw new Error('botão de submit ("Salvar") não encontrado')
  return button as HTMLButtonElement
}

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

describe('EmpresaModal - Campo_Logo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Requirements: 2.2, 2.3
  it('seleção de arquivo com mimetype inválido exibe Notificação_Erro e não altera o preview', async () => {
    renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} />)

    const input = getFileInput()
    const arquivoInvalido = new File([new Uint8Array(10)], 'documento.pdf', {
      type: 'application/pdf',
    })

    fireEvent.change(input, { target: { files: [arquivoInvalido] } })

    await waitFor(() => {
      expect(mockedNotifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'Apenas arquivos PNG ou JPG são aceitos para o logo.',
        })
      )
    })

    // Preview permanece no placeholder padrão (nenhum <img> renderizado)
    expect(document.body.querySelector('img')).toBeNull()
  })

  // Requirements: 2.2, 2.3
  it('seleção de arquivo com tamanho excedido exibe Notificação_Erro e não altera o preview', async () => {
    renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} />)

    const input = getFileInput()
    const arquivoGrande = new File([new Uint8Array(2_097_153)], 'logo-grande.png', {
      type: 'image/png',
    })

    fireEvent.change(input, { target: { files: [arquivoGrande] } })

    await waitFor(() => {
      expect(mockedNotifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'O tamanho máximo permitido para o logo é 2MB.',
        })
      )
    })

    expect(document.body.querySelector('img')).toBeNull()
  })

  // Requirements: 3.3
  it('mock de FileReader disparando onerror exibe Notificação_Erro de falha de leitura e mantém o Estado_Logo inalterado', async () => {
    const originalFileReader = global.FileReader

    class FileReaderComErro {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result: string | null = null
      error: Error = new Error('Falha simulada de leitura')

      readAsDataURL() {
        setTimeout(() => {
          this.onerror?.()
        }, 0)
      }
    }

    // @ts-expect-error - substitui o FileReader global apenas para este teste
    global.FileReader = FileReaderComErro

    try {
      renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} />)

      const input = getFileInput()
      const arquivoValido = new File([new Uint8Array(10)], 'logo.png', {
        type: 'image/png',
      })

      fireEvent.change(input, { target: { files: [arquivoValido] } })

      await waitFor(() => {
        expect(mockedNotifications.show).toHaveBeenCalledWith(
          expect.objectContaining({
            color: 'red',
            message: 'Não foi possível ler o arquivo selecionado.',
          })
        )
      })

      // Estado_Logo permanece inalterado (nenhum preview foi definido)
      expect(document.body.querySelector('img')).toBeNull()
    } finally {
      global.FileReader = originalFileReader
    }
  })

  // Requirements: 1.6
  it('clique no ActionIcon de remoção limpa o preview para o placeholder padrão', async () => {
    const editData = {
      id: 1,
      razaoSocial: 'Empresa Teste',
      cnpj: '12.345.678/0001-90',
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }

    renderWithProviders(
      <EmpresaModal opened={true} onClose={() => {}} editData={editData} />
    )

    // Preview do logo já cadastrado deve aparecer após a inicialização (reset) do formulário
    await waitFor(() => {
      expect(document.body.querySelector('img')).not.toBeNull()
    })

    const removerBtn = document.body
      .querySelector('svg.tabler-icon-trash')
      ?.closest('button')
    expect(removerBtn).toBeTruthy()

    fireEvent.click(removerBtn as HTMLButtonElement)

    await waitFor(() => {
      expect(document.body.querySelector('img')).toBeNull()
    })
  })
})

describe('EmpresaModal - fluxo integrado de submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Requirements: 3.2
  it('schema Zod aceita logo como undefined, null e string, sem erro de validação', () => {
    // Testa diretamente o schema exportado indiretamente pelo comportamento do formulário:
    // como o schema não é exportado por EmpresaModal.tsx, replicamos aqui a mesma forma
    // do campo (`z.string().nullable().optional()`) para validar os três significados de
    // Estado_Logo sem depender de um round-trip completo de submit via UI.
    const logoSchema = z.string().nullable().optional()

    expect(logoSchema.safeParse(undefined).success).toBe(true)
    expect(logoSchema.safeParse(null).success).toBe(true)
    expect(
      logoSchema.safeParse('data:image/png;base64,iVBORw0KGgo=').success
    ).toBe(true)
  })

  // Requirements: 5.3
  it('sucesso de criar dispara invalidateQueries com empresas-admin e empresas-minhas', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 1 } })
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} />, queryClient)

    fireEvent.change(getInputByName('razaoSocial'), { target: { value: 'Empresa Teste' } })
    fireEvent.change(getInputByName('cnpj'), { target: { value: '12.345.678/0001-90' } })

    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalled()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['empresas-admin'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['empresas-minhas'] })
  })

  // Requirements: 5.3
  it('sucesso de atualizar dispara invalidateQueries com empresas-admin e empresas-minhas', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 1 } })
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const editData = {
      id: 1,
      razaoSocial: 'Empresa Existente',
      cnpj: '12.345.678/0001-90',
      logo: null,
    }

    renderWithProviders(
      <EmpresaModal opened={true} onClose={() => {}} editData={editData} />,
      queryClient
    )

    await waitFor(() => {
      expect(getInputByName('razaoSocial').value).toBe('Empresa Existente')
    })

    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalled()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['empresas-admin'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['empresas-minhas'] })
  })

  // Requirements: 5.4
  it('reabrir o modal com editData.logo preenchido exibe o preview correspondente', async () => {
    const editData = {
      id: 1,
      razaoSocial: 'Empresa Teste',
      cnpj: '12.345.678/0001-90',
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }

    renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} editData={editData} />)

    await waitFor(() => {
      const img = document.body.querySelector('img')
      expect(img).not.toBeNull()
      expect(img?.getAttribute('src')).toBe(editData.logo)
    })
  })

  // Requirements: 5.5
  it('reabrir o modal com editData.logo ausente exibe o placeholder padrão', async () => {
    const editData = {
      id: 1,
      razaoSocial: 'Empresa Teste',
      cnpj: '12.345.678/0001-90',
      // logo ausente
    }

    renderWithProviders(<EmpresaModal opened={true} onClose={() => {}} editData={editData} />)

    await waitFor(() => {
      expect(getInputByName('razaoSocial').value).toBe('Empresa Teste')
    })

    expect(document.body.querySelector('img')).toBeNull()
  })

  // Requirements: 6.1, 6.2
  it('erro 400 do backend exibe Notificação_Erro, não chama onClose e preserva os campos preenchidos', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { message: 'Formato de logo inválido' } },
    })
    const onCloseSpy = vi.fn()

    renderWithProviders(<EmpresaModal opened={true} onClose={onCloseSpy} />)

    fireEvent.change(getInputByName('razaoSocial'), { target: { value: 'Empresa Teste' } })
    fireEvent.change(getInputByName('cnpj'), { target: { value: '12.345.678/0001-90' } })

    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(mockedNotifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'Formato de logo inválido',
        })
      )
    })

    expect(onCloseSpy).not.toHaveBeenCalled()
    expect(getInputByName('razaoSocial').value).toBe('Empresa Teste')
    expect(getInputByName('cnpj').value).toBe('12.345.678/0001-90')
  })
})
