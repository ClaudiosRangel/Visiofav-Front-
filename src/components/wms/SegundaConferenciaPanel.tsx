'use client'

import { useState } from 'react'
import { Card, Badge, Button, Group, Text, Stack, Alert, NumberInput, TextInput, Divider } from '@mantine/core'
import { IconAlertTriangle, IconLock, IconMail, IconFileText, IconBan, IconCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import ModalSenhaSupervisor from './ModalSenhaSupervisor'
import {
  useSubmeterSegundaConferencia,
  useAutorizarSenhaSegundaConferencia,
  useRejeitarItemSegundaConferencia,
  type ResultadoItemSegundaConferencia,
} from '@/hooks/useSegundaConferencia'

export interface ItemPendenteSegundaConferencia {
  itemId: string
  descricao: string
  tipo: string
}

interface SegundaConferenciaPanelProps {
  notaId: string
  itensPendentes: ItemPendenteSegundaConferencia[]
  onConcluido: () => void
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  resolvido: { color: 'green', icon: <IconCheck size={14} />, label: 'Resolvido — valores coincidem com a NF-e' },
  divergenciaQuantidade: { color: 'orange', icon: <IconAlertTriangle size={14} />, label: 'Quantidade divergente novamente' },
  pendenciaCriada: { color: 'blue', icon: <IconFileText size={14} />, label: 'Pendência CC-e criada' },
  emailEnviado: { color: 'blue', icon: <IconMail size={14} />, label: 'E-mail enviado ao setor fiscal' },
  emailFalhou: { color: 'red', icon: <IconMail size={14} />, label: 'Falha ao enviar e-mail' },
  requerSenha: { color: 'yellow', icon: <IconLock size={14} />, label: 'Requer autorização de supervisor' },
  bloqueado: { color: 'red', icon: <IconBan size={14} />, label: 'Bloqueado — reconferência obrigatória' },
  ignorado: { color: 'gray', icon: <IconBan size={14} />, label: 'Ignorado' },
}

/**
 * Painel de segunda conferência obrigatória. Exibido quando a 1ª conferência
 * detecta divergência de lote/validade — o conferente deve digitar novamente
 * lote/validade/quantidade para cada item pendente. Se os valores coincidirem
 * com a NF-e, o item é auto-resolvido. Caso contrário, o backend decide entre
 * senha de supervisor, pendência CC-e ou e-mail fiscal (conforme configuração
 * do produto e da integração).
 */
export default function SegundaConferenciaPanel({ notaId, itensPendentes, onConcluido }: SegundaConferenciaPanelProps) {
  const [quantidades, setQuantidades] = useState<Record<string, number>>({})
  const [lotes, setLotes] = useState<Record<string, string>>({})
  const [validades, setValidades] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<ResultadoItemSegundaConferencia[] | null>(null)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [itemSenhaSelecionado, setItemSenhaSelecionado] = useState<string | null>(null)

  const submeterMutation = useSubmeterSegundaConferencia()
  const autorizarSenhaMutation = useAutorizarSenhaSegundaConferencia()
  const rejeitarItemMutation = useRejeitarItemSegundaConferencia()

  // Itens ainda sem um resultado registrado — precisam ser (re)enviados.
  // Um item volta para este estado após "Corrigir Contagem".
  const itensASubmeter = itensPendentes.filter(
    (item) => !resultado?.some((r) => r.itemNotaEntradaId === item.itemId)
  )

  async function handleSubmeter() {
    // Quantidade é sempre obrigatória para submeter a segunda conferência
    const semQuantidade = itensASubmeter.some((item) => quantidades[item.itemId] === undefined)
    if (semQuantidade) {
      notifications.show({ title: 'Atenção', message: 'Informe a quantidade conferida para todos os itens', color: 'orange' })
      return
    }
    try {
      const itens = itensASubmeter.map((item) => ({
        itemNotaEntradaId: item.itemId,
        quantidadeConferida: quantidades[item.itemId] ?? 0,
        lote: lotes[item.itemId] || undefined,
        validade: validades[item.itemId] || undefined,
      }))
      const resp = await submeterMutation.mutateAsync({ notaId, itens })
      setResultado((prev) => [...(prev ?? []), ...resp.itens])

      if (
        resp.divergenciaResolvida &&
        !resp.divergenciaQuantidade &&
        !resp.pendenciaCriada &&
        !resp.emailEnviado &&
        !resp.requerSenha &&
        !resp.bloqueado
      ) {
        notifications.show({ title: 'Segunda conferência concluída', message: 'Valores confirmados — divergência resolvida', color: 'green' })
        onConcluido()
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao submeter segunda conferência', color: 'red' })
    }
  }

  function handleAbrirSenha(itemId: string) {
    setItemSenhaSelecionado(itemId)
    setModalSenhaAberto(true)
  }

  async function handleConfirmarSupervisor(credenciais: { usuario: string; senha: string }) {
    if (!itemSenhaSelecionado) return
    await autorizarSenhaMutation.mutateAsync({ notaId, itemNotaEntradaId: itemSenhaSelecionado, credenciaisSupervisor: credenciais })
    notifications.show({ title: 'Liberado', message: 'Divergência liberada pelo supervisor', color: 'green' })
    setResultado((prev) => prev?.map((r) => (r.itemNotaEntradaId === itemSenhaSelecionado ? { ...r, resultado: { status: 'resolvido' } } : r)) ?? null)
    onConcluido()
  }

  // "Aceitar com divergência" — reenvia o item sinalizando aceite explícito
  // da divergência de quantidade
  async function handleAceitarDivergenciaQuantidade(itemId: string) {
    try {
      const resp = await submeterMutation.mutateAsync({
        notaId,
        itens: [{
          itemNotaEntradaId: itemId,
          quantidadeConferida: quantidades[itemId] ?? 0,
          lote: lotes[itemId] || undefined,
          validade: validades[itemId] || undefined,
          aceitarDivergenciaQuantidade: true,
        }],
      })
      setResultado((prev) => {
        const outros = prev?.filter((r) => r.itemNotaEntradaId !== itemId) ?? []
        return [...outros, ...resp.itens]
      })
      notifications.show({ title: 'Divergência aceita', message: 'Quantidade aceita com divergência', color: 'green' })
      if (!resp.requerSenha && !resp.bloqueado && !resp.pendenciaCriada && !resp.emailEnviado) {
        onConcluido()
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao aceitar divergência', color: 'red' })
    }
  }

  async function handleRejeitarItem(itemId: string) {
    if (!confirm('Rejeitar este item? Ele será marcado como não recebido.')) return
    try {
      await rejeitarItemMutation.mutateAsync({ notaId, itemNotaEntradaId: itemId })
      notifications.show({ title: 'Item rejeitado', message: 'Item marcado como não recebido', color: 'orange' })
      setResultado((prev) => prev?.map((r) => (r.itemNotaEntradaId === itemId ? { ...r, resultado: { status: 'ignorado', motivo: 'REJEITADO' } } : r)) ?? null)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao rejeitar item', color: 'red' })
    }
  }

  function handleCorrigirContagem(itemId: string) {
    // Limpa o resultado do item para permitir nova digitação nesta mesma tela
    setResultado((prev) => prev?.filter((r) => r.itemNotaEntradaId !== itemId) ?? null)
    setQuantidades((prev) => ({ ...prev, [itemId]: undefined as any }))
  }

  if (itensPendentes.length === 0) return null

  return (
    <Card withBorder shadow="sm" padding="md">
      <Stack gap="md">
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          Divergência de lote/validade detectada na primeira conferência. É obrigatório
          realizar uma <strong>segunda conferência</strong> antes de aprovar esta nota.
        </Alert>

        <Text fw={600} size="lg">Segunda Conferência Obrigatória</Text>

        {itensPendentes.map((item) => {
          const resultadoItem = resultado?.find((r) => r.itemNotaEntradaId === item.itemId)
          const status = resultadoItem?.resultado.status
          const config = status ? statusConfig[status] : null
          const aindaDigitando = !resultadoItem

          return (
            <Card key={item.itemId} withBorder padding="sm" opacity={status === 'resolvido' ? 0.6 : 1}>
              <Group justify="space-between" mb="xs">
                <Text fw={500}>{item.descricao}</Text>
                <Group gap={4}>
                  {item.tipo.includes('QUANTIDADE_DIVERGENTE') && <Badge color="gray" variant="outline">Quantidade</Badge>}
                  {item.tipo.includes('LOTE_DIVERGENTE') && <Badge color="gray" variant="outline">Lote</Badge>}
                  {item.tipo.includes('VALIDADE_DIVERGENTE') && <Badge color="gray" variant="outline">Validade</Badge>}
                </Group>
              </Group>

              {config && (
                <Badge color={config.color} variant="light" leftSection={config.icon} mb="xs">
                  {config.label}
                </Badge>
              )}

              {aindaDigitando && (
                <Group grow>
                  <NumberInput
                    label="Quantidade conferida"
                    required
                    value={quantidades[item.itemId] ?? ''}
                    onChange={(v) => setQuantidades((prev) => ({ ...prev, [item.itemId]: Number(v) || 0 }))}
                    min={0}
                  />
                  <TextInput
                    label="Lote"
                    value={lotes[item.itemId] ?? ''}
                    onChange={(e) => setLotes((prev) => ({ ...prev, [item.itemId]: e.currentTarget.value }))}
                  />
                  <TextInput
                    label="Validade"
                    placeholder="DD/MM/AAAA"
                    value={validades[item.itemId] ?? ''}
                    onChange={(e) => setValidades((prev) => ({ ...prev, [item.itemId]: e.currentTarget.value }))}
                  />
                </Group>
              )}

              {status === 'divergenciaQuantidade' && (
                <Group mt="sm">
                  <Button color="orange" variant="light" size="xs"
                    onClick={() => handleAceitarDivergenciaQuantidade(item.itemId)}
                    loading={submeterMutation.isPending}>
                    Aceitar com divergência
                  </Button>
                  <Button color="red" variant="light" size="xs" leftSection={<IconBan size={14} />}
                    onClick={() => handleRejeitarItem(item.itemId)}
                    loading={rejeitarItemMutation.isPending}>
                    Rejeitar
                  </Button>
                  <Button color="gray" variant="light" size="xs"
                    onClick={() => handleCorrigirContagem(item.itemId)}>
                    Corrigir Contagem
                  </Button>
                </Group>
              )}

              {status === 'requerSenha' && (
                <Button mt="sm" color="yellow" size="xs" leftSection={<IconLock size={14} />}
                  onClick={() => handleAbrirSenha(item.itemId)}>
                  Liberar com senha de supervisor
                </Button>
              )}
            </Card>
          )
        })}

        {itensASubmeter.length > 0 && (
          <>
            <Divider />
            <Group justify="flex-end">
              <Button loading={submeterMutation.isPending} onClick={handleSubmeter}>
                Submeter Segunda Conferência
              </Button>
            </Group>
          </>
        )}
      </Stack>

      <ModalSenhaSupervisor
        opened={modalSenhaAberto}
        onClose={() => setModalSenhaAberto(false)}
        onConfirm={handleConfirmarSupervisor}
      />
    </Card>
  )
}
