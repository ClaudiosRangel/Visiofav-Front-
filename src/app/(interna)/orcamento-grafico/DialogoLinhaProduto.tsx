'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Group, Loader, Modal, Radio, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'

// ============================================================================
// Diálogo "Novo Item — Selecione a Linha de Produto".
//
// Lista as linhas ATIVAS da empresa (rota sem parâmetros devolve só as ativas),
// em ordem alfabética (pt-BR), com o nome exatamente como no cadastro. Nenhuma
// linha vem pré-selecionada. O diálogo NÃO cria item:
//  - Confirmar -> onConfirmar(linha): quem chama abre o seletor com o filtro Linha.
//  - Cancelar  -> onCancelar(): quem chama abre o seletor SEM filtro de linha.
// ============================================================================

export interface LinhaProdutoSelecionada {
  id: string
  nome: string
}

interface Props {
  opened: boolean
  onConfirmar: (linha: LinhaProdutoSelecionada) => void
  onCancelar: () => void
}

const TIMEOUT_CARGA_MS = 10_000

export default function DialogoLinhaProduto({ opened, onConfirmar, onCancelar }: Props) {
  const [linhas, setLinhas] = useState<LinhaProdutoSelecionada[]>([])
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroCarga, setErroCarga] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga(false)
    setLinhas([])
    try {
      const { data } = await api.get('/orcamento-grafico/linhas-produto', {
        timeout: TIMEOUT_CARGA_MS,
      })
      const lista: any[] = Array.isArray(data) ? data : data?.data ?? []
      const ordenadas = lista
        .map((l) => ({ id: String(l.id), nome: String(l.nome ?? '') }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setLinhas(ordenadas)
    } catch {
      setErroCarga(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  // A cada abertura: recarrega e zera a seleção (nenhuma pré-selecionada).
  useEffect(() => {
    if (!opened) return
    setSelecionadaId(null)
    void carregar()
  }, [opened, carregar])

  const semLinhas = !carregando && !erroCarga && linhas.length === 0
  const linhaSelecionada = linhas.find((l) => l.id === selecionadaId) ?? null
  const confirmarHabilitado = !carregando && !erroCarga && linhaSelecionada !== null

  return (
    <Modal
      opened={opened}
      onClose={onCancelar}
      title="Novo Item — Selecione a Linha de Produto"
      centered
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {carregando && (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        )}

        {erroCarga && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            <Stack gap="xs">
              <Text size="sm">As linhas não puderam ser carregadas.</Text>
              <Group>
                <Button size="xs" variant="light" onClick={() => void carregar()}>
                  Tentar novamente
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {semLinhas && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            Não há linhas de produto ativas.
          </Alert>
        )}

        {!carregando && !erroCarga && linhas.length > 0 && (
          <Radio.Group value={selecionadaId ?? ''} onChange={setSelecionadaId}>
            <Stack gap="xs">
              {linhas.map((l) => (
                <Radio key={l.id} value={l.id} label={l.nome} />
              ))}
            </Stack>
          </Radio.Group>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            disabled={!confirmarHabilitado}
            onClick={() => linhaSelecionada && onConfirmar(linhaSelecionada)}
          >
            Confirmar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
