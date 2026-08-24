'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stack,
  Title,
  Card,
  Text,
  Group,
  Badge,
  Select,
  ActionIcon,
  Affix,
  Modal,
  Button,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconFileInvoice, IconTrash } from '@tabler/icons-react'
import {
  usePortalRepOrcamentos,
  useCancelarSolicitacao,
} from '@/data/hooks/portal-rep-app/usePortalRepOrcamentos'
import { formatarData } from '@/components/portal-rep/formatters'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { EmptyState } from '@/components/portal-rep/EmptyState'
import type { StatusSolicitacao, SolicitacaoOrcamento } from '@/data/hooks/portal-rep-app/types'

const STATUS_COLORS: Record<StatusSolicitacao, string> = {
  PENDENTE: 'yellow',
  CALCULADO: 'blue',
  ENVIADO: 'cyan',
  ACEITO: 'green',
  RECUSADO: 'red',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'CALCULADO', label: 'Calculado' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'ACEITO', label: 'Aceito' },
  { value: 'RECUSADO', label: 'Recusado' },
]

/** Tempo em ms para considerar long-press */
const LONG_PRESS_DURATION = 500

export default function OrcamentosListagemPage() {
  const router = useRouter()
  const [statusFiltro, setStatusFiltro] = useState<string>('')

  const params = statusFiltro ? { status: statusFiltro } : undefined
  const { data: solicitacoes, isLoading, refetch } = usePortalRepOrcamentos(params)
  const cancelarMutation = useCancelarSolicitacao()

  // Context menu state (long-press)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    solicitacao: SolicitacaoOrcamento
  } | null>(null)

  // Confirmation modal state
  const [confirmCancel, setConfirmCancel] = useState<SolicitacaoOrcamento | null>(null)

  // Long-press handling
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, solicitacao: SolicitacaoOrcamento) => {
      if (solicitacao.status !== 'PENDENTE') return
      longPressTriggered.current = false
      const touch = e.touches[0]
      const x = touch.clientX
      const y = touch.clientY

      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true
        setContextMenu({ x, y, solicitacao })
      }, LONG_PRESS_DURATION)
    },
    [],
  )

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleCardClick = useCallback(
    (id: string) => {
      // Prevent navigation if long-press was triggered
      if (longPressTriggered.current) {
        longPressTriggered.current = false
        return
      }
      router.push(`/portal-rep/orcamentos/${id}`)
    },
    [router],
  )

  const handleContextMenuAction = useCallback(() => {
    if (contextMenu) {
      setConfirmCancel(contextMenu.solicitacao)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleConfirmCancelar = useCallback(async () => {
    if (!confirmCancel) return
    try {
      await cancelarMutation.mutateAsync(confirmCancel.id)
      notifications.show({
        message: 'Solicitação cancelada com sucesso.',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        message:
          err?.response?.data?.message ||
          'Erro ao cancelar solicitação. Tente novamente.',
        color: 'red',
      })
    } finally {
      setConfirmCancel(null)
    }
  }, [confirmCancel, cancelarMutation])

  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Orçamentos</Title>
        </Group>

        <Select
          placeholder="Filtrar por status"
          data={STATUS_OPTIONS}
          value={statusFiltro}
          onChange={(value) => setStatusFiltro(value ?? '')}
          clearable={false}
        />

        {isLoading ? (
          <Stack gap="sm">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </Stack>
        ) : !solicitacoes || solicitacoes.length === 0 ? (
          <EmptyState
            icon={IconFileInvoice}
            title="Nenhum orçamento encontrado"
            description={
              statusFiltro
                ? 'Nenhum orçamento com este status.'
                : 'Suas solicitações de orçamento aparecerão aqui.'
            }
          />
        ) : (
          <Stack gap="sm">
            {solicitacoes.map((solicitacao) => (
              <Card
                key={solicitacao.id}
                className="portal-rep-touchable"
                style={{ cursor: 'pointer' }}
                onClick={() => handleCardClick(solicitacao.id)}
                onTouchStart={(e) => handleTouchStart(e, solicitacao)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onContextMenu={(e) => {
                  if (solicitacao.status === 'PENDENTE') {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      solicitacao,
                    })
                  }
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={500} lineClamp={1}>
                      {solicitacao.clienteNome}
                    </Text>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        {formatarData(solicitacao.criadoEm)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        •
                      </Text>
                      <Text size="sm" c="dimmed">
                        {solicitacao.tipoEmbalagem} — Qtd: {solicitacao.quantidade}
                      </Text>
                    </Group>
                  </Stack>
                  <Badge color={STATUS_COLORS[solicitacao.status]} variant="light">
                    {solicitacao.status}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      {/* FAB para nova solicitação */}
      <Affix position={{ bottom: 80, right: 20 }}>
        <ActionIcon
          size="xl"
          radius="xl"
          color="green"
          variant="filled"
          onClick={() => router.push('/portal-rep/orcamentos/novo')}
          aria-label="Nova solicitação de orçamento"
          className="portal-rep-touchable"
        >
          <IconPlus size={24} />
        </ActionIcon>
      </Affix>

      {/* Context menu (long-press / right-click) */}
      {contextMenu && (
        <>
          <div
            className="portal-rep-context-overlay"
            onClick={() => setContextMenu(null)}
            onTouchStart={() => setContextMenu(null)}
          />
          <div
            className="portal-rep-context-menu"
            style={{
              top: contextMenu.y,
              left: Math.min(contextMenu.x, window.innerWidth - 200),
            }}
          >
            <button
              className="portal-rep-context-menu-item portal-rep-context-menu-item--danger"
              onClick={handleContextMenuAction}
            >
              <IconTrash size={16} />
              Cancelar Solicitação
            </button>
          </div>
        </>
      )}

      {/* Modal de confirmação de cancelamento */}
      <Modal
        opened={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        title="Confirmar Cancelamento"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Tem certeza que deseja cancelar a solicitação de orçamento para{' '}
            <Text span fw={500}>
              {confirmCancel?.clienteNome}
            </Text>
            ? Essa ação não pode ser desfeita.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirmCancel(null)}>
              Não, manter
            </Button>
            <Button
              color="red"
              onClick={handleConfirmCancelar}
              loading={cancelarMutation.isPending}
            >
              Sim, cancelar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PullToRefresh>
  )
}
