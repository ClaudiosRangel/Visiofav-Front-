'use client'

import { useState } from 'react'
import { Card, Badge, Button, Group, Text, Stack, Alert } from '@mantine/core'
import { IconCheck, IconLock, IconFileText, IconBan, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import ModalSenhaSupervisor from './ModalSenhaSupervisor'
import { useResolverDivergenciaLV, isFinalizacaoHabilitada } from '@/hooks/useResolverDivergenciaLV'

type ModoResolucao = 'ACEITAR_LIVRE' | 'ACEITAR_SENHA' | 'ACEITAR_CCE' | 'BLOQUEAR'

export interface DivergenciaItem {
  divergenciaId: string
  itemId: string
  descricao: string
  tipo: 'LOTE_DIVERGENTE' | 'VALIDADE_DIVERGENTE'
  valorEsperado: string | null
  valorConferido: string | null
  modoResolucao: ModoResolucao
  status: string
}

interface DivergenciaLoteValidadePanelProps {
  divergencias: DivergenciaItem[]
  notaId: string
  onResolucaoCompleta: () => void
}

const modoConfig: Record<ModoResolucao, { color: string; icon: React.ReactNode; label: string }> = {
  ACEITAR_LIVRE: { color: 'green', icon: <IconCheck size={14} />, label: 'Aceitação Livre' },
  ACEITAR_SENHA: { color: 'yellow', icon: <IconLock size={14} />, label: 'Requer Supervisor' },
  ACEITAR_CCE: { color: 'blue', icon: <IconFileText size={14} />, label: 'CC-e' },
  BLOQUEAR: { color: 'red', icon: <IconBan size={14} />, label: 'Bloqueado' },
}

export default function DivergenciaLoteValidadePanel({
  divergencias,
  notaId,
  onResolucaoCompleta,
}: DivergenciaLoteValidadePanelProps) {
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [divergenciaSelecionada, setDivergenciaSelecionada] = useState<string | null>(null)

  const resolverMutation = useResolverDivergenciaLV()

  const finalizacaoHabilitada = isFinalizacaoHabilitada(divergencias)

  async function handleAceitarLivre(divergenciaId: string) {
    try {
      await resolverMutation.mutateAsync({ divergenciaId, acao: 'ACEITAR' })
      notifications.show({ title: 'Divergência aceita', message: 'Divergência resolvida com sucesso', color: 'green' })
      onResolucaoCompleta()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao resolver divergência', color: 'red' })
    }
  }

  async function handleAceitarCCe(divergenciaId: string) {
    try {
      await resolverMutation.mutateAsync({ divergenciaId, acao: 'ACEITAR' })
      notifications.show({ title: 'CC-e emitida', message: 'Divergência aceita e Carta de Correção emitida', color: 'blue' })
      onResolucaoCompleta()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao emitir CC-e', color: 'red' })
    }
  }

  function handleAbrirModalSenha(divergenciaId: string) {
    setDivergenciaSelecionada(divergenciaId)
    setModalSenhaAberto(true)
  }

  async function handleConfirmarSupervisor(credenciais: { usuario: string; senha: string }) {
    if (!divergenciaSelecionada) return

    await resolverMutation.mutateAsync({
      divergenciaId: divergenciaSelecionada,
      acao: 'ACEITAR',
      credenciaisSupervisor: credenciais,
    })

    notifications.show({ title: 'Liberado', message: 'Divergência liberada pelo supervisor', color: 'green' })
    onResolucaoCompleta()
  }

  if (divergencias.length === 0) return null

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Divergências de Lote/Validade</Text>

      {!finalizacaoHabilitada && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
          Existem divergências pendentes. Resolva todas antes de finalizar a conferência.
        </Alert>
      )}

      {divergencias.map((div) => {
        const config = modoConfig[div.modoResolucao]
        const tipoLabel = div.tipo === 'LOTE_DIVERGENTE' ? 'Lote' : 'Validade'
        const resolvida = div.status !== 'PENDENTE'

        return (
          <Card key={div.divergenciaId} withBorder shadow="xs" padding="md" opacity={resolvida ? 0.6 : 1}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <Badge color={config.color} variant="light" leftSection={config.icon}>
                  {config.label}
                </Badge>
                <Badge color="gray" variant="outline">
                  {tipoLabel}
                </Badge>
                {resolvida && (
                  <Badge color="green" variant="filled">
                    Resolvida
                  </Badge>
                )}
              </Group>
            </Group>

            <Text size="sm" fw={500} mb="xs">{div.descricao}</Text>

            <Group gap="xl" mb="sm">
              <div>
                <Text size="xs" c="dimmed">Esperado (NF-e)</Text>
                <Text size="sm" fw={500}>{div.valorEsperado || '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Conferido</Text>
                <Text size="sm" fw={500}>{div.valorConferido || '—'}</Text>
              </div>
            </Group>

            {!resolvida && (
              <Group>
                {div.modoResolucao === 'ACEITAR_LIVRE' && (
                  <Button
                    color="green"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={resolverMutation.isPending}
                    onClick={() => handleAceitarLivre(div.divergenciaId)}
                  >
                    Aceitar
                  </Button>
                )}

                {div.modoResolucao === 'ACEITAR_SENHA' && (
                  <Button
                    color="yellow"
                    size="xs"
                    leftSection={<IconLock size={14} />}
                    onClick={() => handleAbrirModalSenha(div.divergenciaId)}
                  >
                    Liberar
                  </Button>
                )}

                {div.modoResolucao === 'ACEITAR_CCE' && (
                  <Button
                    color="blue"
                    size="xs"
                    leftSection={<IconFileText size={14} />}
                    loading={resolverMutation.isPending}
                    onClick={() => handleAceitarCCe(div.divergenciaId)}
                  >
                    Aceitar (CC-e)
                  </Button>
                )}

                {div.modoResolucao === 'BLOQUEAR' && (
                  <Text size="sm" c="red" fs="italic">
                    Bloqueado — entre em contato com administrador
                  </Text>
                )}
              </Group>
            )}
          </Card>
        )
      })}

      <ModalSenhaSupervisor
        opened={modalSenhaAberto}
        onClose={() => setModalSenhaAberto(false)}
        onConfirm={handleConfirmarSupervisor}
      />
    </Stack>
  )
}
