'use client'

import { useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import {
  usePortalRepOrcamentoDetalhe,
  useCancelarSolicitacao,
} from '@/data/hooks/portal-rep-app/usePortalRepOrcamentos'
import { formatarData, formatarMoeda } from '@/components/portal-rep/formatters'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import type { StatusSolicitacao } from '@/data/hooks/portal-rep-app/types'

const STATUS_COLORS: Record<StatusSolicitacao, string> = {
  PENDENTE: 'yellow',
  CALCULADO: 'blue',
  ENVIADO: 'cyan',
  ACEITO: 'green',
  RECUSADO: 'red',
}

/** Status a partir do qual preços são exibidos */
const STATUS_COM_PRECO: StatusSolicitacao[] = ['CALCULADO', 'ENVIADO', 'ACEITO', 'RECUSADO']

export default function OrcamentoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: solicitacao, isLoading } = usePortalRepOrcamentoDetalhe(id)
  const cancelarMutation = useCancelarSolicitacao()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const exibirPrecos = solicitacao
    ? STATUS_COM_PRECO.includes(solicitacao.status)
    : false

  const handleCancelar = useCallback(async () => {
    if (!solicitacao) return
    try {
      await cancelarMutation.mutateAsync(solicitacao.id)
      notifications.show({
        message: 'Solicitação cancelada com sucesso.',
        color: 'green',
      })
      router.push('/portal-rep/orcamentos')
    } catch (err: any) {
      notifications.show({
        message:
          err?.response?.data?.message ||
          'Erro ao cancelar solicitação. Tente novamente.',
        color: 'red',
      })
    } finally {
      setConfirmOpen(false)
    }
  }, [solicitacao, cancelarMutation, router])

  if (isLoading) {
    return (
      <Stack gap="md" p="md">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </Stack>
    )
  }

  if (!solicitacao) {
    return (
      <Stack gap="md" p="md">
        <Text c="dimmed">Solicitação não encontrada.</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="md">
      {/* Header com botão voltar */}
      <Group gap="sm">
        <ActionIcon
          variant="subtle"
          onClick={() => router.push('/portal-rep/orcamentos')}
          aria-label="Voltar"
        >
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3}>Detalhe do Orçamento</Title>
      </Group>

      {/* Card com informações gerais */}
      <Card padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed">
                Cliente
              </Text>
              <Text size="sm" fw={500}>
                {solicitacao.clienteNome || '—'}
              </Text>
            </div>
            <Badge
              color={STATUS_COLORS[solicitacao.status]}
              variant="light"
              size="lg"
            >
              {solicitacao.status}
            </Badge>
          </Group>

          <div>
            <Text size="xs" c="dimmed">
              Data de Criação
            </Text>
            <Text size="sm">{formatarData(solicitacao.criadoEm)}</Text>
          </div>
        </Stack>
      </Card>

      {/* Card com dados da solicitação */}
      <Card padding="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Dados da Solicitação
          </Text>

          <Group grow>
            <div>
              <Text size="xs" c="dimmed">Tipo de Embalagem</Text>
              <Text size="sm">{solicitacao.tipoEmbalagem}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Quantidade</Text>
              <Text size="sm">{solicitacao.quantidade.toLocaleString('pt-BR')}</Text>
            </div>
          </Group>

          {(solicitacao.medidaLargura || solicitacao.medidaAltura || solicitacao.medidaComprimento) && (
            <div>
              <Text size="xs" c="dimmed">Medidas (mm)</Text>
              <Text size="sm">
                {[
                  solicitacao.medidaLargura && `L: ${solicitacao.medidaLargura}`,
                  solicitacao.medidaAltura && `A: ${solicitacao.medidaAltura}`,
                  solicitacao.medidaComprimento && `C: ${solicitacao.medidaComprimento}`,
                ].filter(Boolean).join(' × ')}
              </Text>
            </div>
          )}

          {solicitacao.acabamentos && (
            <div>
              <Text size="xs" c="dimmed">Acabamentos</Text>
              <Text size="sm">{solicitacao.acabamentos}</Text>
            </div>
          )}

          {solicitacao.observacoes && (
            <div>
              <Text size="xs" c="dimmed">Observações</Text>
              <Text size="sm">{solicitacao.observacoes}</Text>
            </div>
          )}
        </Stack>
      </Card>

      {/* Card de preço — apenas quando calculado */}
      {exibirPrecos && (solicitacao.precoVenda != null || solicitacao.precoUnitario != null) && (
        <Card padding="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Preço
            </Text>
            <Group grow>
              {solicitacao.precoUnitario != null && (
                <div>
                  <Text size="xs" c="dimmed">Preço Unitário</Text>
                  <Text size="sm" fw={500}>{formatarMoeda(solicitacao.precoUnitario)}</Text>
                </div>
              )}
              {solicitacao.precoVenda != null && (
                <div>
                  <Text size="xs" c="dimmed">Preço Total</Text>
                  <Text size="lg" fw={700} c="green">{formatarMoeda(solicitacao.precoVenda)}</Text>
                </div>
              )}
            </Group>
          </Stack>
        </Card>
      )}

      {/* Botão cancelar apenas para PENDENTE */}
      {solicitacao.status === 'PENDENTE' && (
        <Button
          color="red"
          variant="light"
          leftSection={<IconTrash size={16} />}
          onClick={() => setConfirmOpen(true)}
          loading={cancelarMutation.isPending}
        >
          Cancelar Solicitação
        </Button>
      )}

      {/* Modal de confirmação */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar Cancelamento"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Tem certeza que deseja cancelar esta solicitação de orçamento? Essa
            ação não pode ser desfeita.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              Não, manter
            </Button>
            <Button
              color="red"
              onClick={handleCancelar}
              loading={cancelarMutation.isPending}
            >
              Sim, cancelar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
