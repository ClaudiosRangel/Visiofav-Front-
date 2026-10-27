'use client'

/**
 * Aprovação de amostra/modelo pelo representante (em nome do cliente) — R5.7
 * da spec orcamento-grafico-handoff-comercial. Lista as amostras do orçamento
 * vinculado à solicitação e permite aprovar/reprovar. Consome:
 *   GET  /solicitacoes-orcamento/:id/amostras
 *   POST /solicitacoes-orcamento/amostras/:amostraId/aprovar
 *   POST /solicitacoes-orcamento/amostras/:amostraId/reprovar
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Stack, Text, Group, Badge, Button, Textarea, TextInput, Anchor } from '@mantine/core'
import { IconCheck, IconX, IconPaperclip } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { portalRepApi } from '@/data/hooks/portal-rep-app/portal-rep-api'

interface Amostra {
  id: string
  tipo: string
  status: string
  rodada: number
  anexoUrl: string | null
  motivoReprova: string | null
  criadoEm: string
}

const STATUS_COR: Record<string, string> = {
  SOLICITADA: 'gray',
  EM_PRODUCAO_AMOSTRA: 'blue',
  ENVIADA_CLIENTE: 'indigo',
  APROVADA: 'green',
  REPROVADA: 'red',
}

export default function AmostrasRepSection({ solicitacaoId }: { solicitacaoId: string }) {
  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [loading, setLoading] = useState(true)
  const [acao, setAcao] = useState<string | null>(null)
  const [aprovadoPor, setAprovadoPor] = useState('')
  const [motivoReprova, setMotivoReprova] = useState('')
  const [modoReprova, setModoReprova] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await portalRepApi.get(`/solicitacoes-orcamento/${solicitacaoId}/amostras`)
      setAmostras(Array.isArray(data) ? data : [])
    } catch {
      setAmostras([])
    } finally {
      setLoading(false)
    }
  }, [solicitacaoId])

  useEffect(() => { carregar() }, [carregar])

  async function aprovar(id: string) {
    if (!aprovadoPor.trim()) {
      notifications.show({ message: 'Informe quem aprovou.', color: 'orange' })
      return
    }
    setAcao(id)
    try {
      await portalRepApi.post(`/solicitacoes-orcamento/amostras/${id}/aprovar`, { aprovadoPor: aprovadoPor.trim() })
      notifications.show({ message: 'Amostra aprovada!', color: 'green' })
      setAprovadoPor('')
      await carregar()
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha ao aprovar', color: 'red' })
    } finally {
      setAcao(null)
    }
  }

  async function reprovar(id: string) {
    if (!motivoReprova.trim()) {
      notifications.show({ message: 'Informe o motivo da reprovação.', color: 'orange' })
      return
    }
    setAcao(id)
    try {
      await portalRepApi.post(`/solicitacoes-orcamento/amostras/${id}/reprovar`, { motivoReprova: motivoReprova.trim() })
      notifications.show({ message: 'Amostra reprovada.', color: 'orange' })
      setMotivoReprova('')
      setModoReprova(null)
      await carregar()
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha ao reprovar', color: 'red' })
    } finally {
      setAcao(null)
    }
  }

  if (loading) return null
  if (amostras.length === 0) return null

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">Amostras / Modelos</Text>
        {amostras.map((a) => {
          const pendente = a.status === 'ENVIADA_CLIENTE' || a.status === 'SOLICITADA' || a.status === 'EM_PRODUCAO_AMOSTRA'
          return (
            <Card key={a.id} withBorder padding="sm">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={500}>Rodada {a.rodada}</Text>
                    <Badge size="sm" variant="light">{a.tipo}</Badge>
                  </Group>
                  <Badge size="sm" color={STATUS_COR[a.status] || 'gray'}>{a.status}</Badge>
                </Group>

                {a.anexoUrl && (
                  <Anchor href={a.anexoUrl} target="_blank" size="xs">
                    <Group gap={4}><IconPaperclip size={14} /> Ver anexo</Group>
                  </Anchor>
                )}

                {a.motivoReprova && (
                  <Text size="xs" c="red">Reprovada: {a.motivoReprova}</Text>
                )}

                {pendente && (
                  <Stack gap={6}>
                    {modoReprova === a.id ? (
                      <Stack gap={6}>
                        <Textarea
                          placeholder="Motivo da reprovação"
                          value={motivoReprova}
                          onChange={(e) => setMotivoReprova(e.currentTarget.value)}
                          autosize
                          minRows={2}
                        />
                        <Group gap="xs">
                          <Button size="xs" color="red" loading={acao === a.id} onClick={() => reprovar(a.id)}>
                            Confirmar reprovação
                          </Button>
                          <Button size="xs" variant="subtle" onClick={() => { setModoReprova(null); setMotivoReprova('') }}>
                            Voltar
                          </Button>
                        </Group>
                      </Stack>
                    ) : (
                      <Stack gap={6}>
                        <TextInput
                          placeholder="Nome de quem aprova (cliente)"
                          value={aprovadoPor}
                          onChange={(e) => setAprovadoPor(e.currentTarget.value)}
                          size="xs"
                        />
                        <Group gap="xs">
                          <Button
                            size="xs"
                            color="green"
                            leftSection={<IconCheck size={14} />}
                            loading={acao === a.id}
                            onClick={() => aprovar(a.id)}
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconX size={14} />}
                            onClick={() => setModoReprova(a.id)}
                          >
                            Reprovar
                          </Button>
                        </Group>
                      </Stack>
                    )}
                  </Stack>
                )}
              </Stack>
            </Card>
          )
        })}
      </Stack>
    </Card>
  )
}
