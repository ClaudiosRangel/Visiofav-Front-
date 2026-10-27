'use client'

/**
 * Sino de notificações do setor Comercial (R4, hand-off). Consome
 * /orcamento-grafico/comercial/notificacoes*. Mostra badge de não-lidas e
 * popover com a lista; marca lida ao clicar e "ler todas".
 */
import { useEffect, useState, useCallback } from 'react'
import { ActionIcon, Indicator, Popover, Stack, Group, Text, Button, ScrollArea, Divider } from '@mantine/core'
import { IconBell, IconChecks, IconCircleFilled } from '@tabler/icons-react'
import { api } from '@/lib/api'

interface NotificacaoComercial {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  criadoEm: string
}

function tempoRelativo(data: string): string {
  const diffMin = Math.floor((Date.now() - new Date(data).getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d}d`
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function NotificacoesComercialBell() {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<NotificacaoComercial[]>([])
  const [naoLidas, setNaoLidas] = useState(0)

  const carregarContagem = useCallback(async () => {
    try {
      const { data } = await api.get('/orcamento-grafico/comercial/notificacoes/count-nao-lidas')
      setNaoLidas(data?.naoLidas ?? 0)
    } catch { /* silencioso */ }
  }, [])

  const carregarLista = useCallback(async () => {
    try {
      const { data } = await api.get('/orcamento-grafico/comercial/notificacoes', { params: { pageSize: 15 } })
      setItens(Array.isArray(data?.itens) ? data.itens : [])
      setNaoLidas(data?.naoLidas ?? 0)
    } catch { setItens([]) }
  }, [])

  // Contagem no mount + polling leve a cada 60s.
  useEffect(() => {
    carregarContagem()
    const t = setInterval(carregarContagem, 60000)
    return () => clearInterval(t)
  }, [carregarContagem])

  useEffect(() => { if (aberto) carregarLista() }, [aberto, carregarLista])

  async function marcarLida(id: string) {
    try {
      await api.put(`/orcamento-grafico/comercial/notificacoes/${id}/lida`)
      setItens((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
      setNaoLidas((n) => Math.max(0, n - 1))
    } catch { /* silencioso */ }
  }

  async function lerTodas() {
    try {
      await api.put('/orcamento-grafico/comercial/notificacoes/ler-todas')
      setItens((prev) => prev.map((n) => ({ ...n, lida: true })))
      setNaoLidas(0)
    } catch { /* silencioso */ }
  }

  return (
    <Popover opened={aberto} onChange={setAberto} position="bottom-end" width={380} shadow="lg">
      <Popover.Target>
        <Indicator color="red" size={16} label={naoLidas > 99 ? '99+' : naoLidas} disabled={naoLidas === 0} offset={4}>
          <ActionIcon variant="light" color="gray" size="lg" onClick={() => setAberto((a) => !a)} title="Notificações do comercial">
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm">
          <Text fw={600} size="sm">Notificações do comercial</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconChecks size={14} />} onClick={lerTodas} disabled={naoLidas === 0}>
            Ler todas
          </Button>
        </Group>
        <Divider />
        <ScrollArea.Autosize mah={360}>
          {itens.length === 0 ? (
            <Text c="dimmed" ta="center" py="md" size="sm">Sem notificações.</Text>
          ) : (
            <Stack gap={0}>
              {itens.map((n) => (
                <Group
                  key={n.id}
                  wrap="nowrap"
                  align="flex-start"
                  gap="xs"
                  p="sm"
                  style={{ cursor: 'pointer', background: n.lida ? undefined : 'var(--mantine-color-blue-light)' }}
                  onClick={() => !n.lida && marcarLida(n.id)}
                >
                  <IconCircleFilled size={8} color={n.lida ? 'transparent' : 'var(--mantine-color-blue-6)'} style={{ marginTop: 6 }} />
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="sm" fw={n.lida ? 400 : 600}>{n.titulo}</Text>
                    <Text size="xs" c="dimmed">{n.mensagem}</Text>
                    <Text size="xs" c="dimmed">{tempoRelativo(n.criadoEm)}</Text>
                  </Stack>
                </Group>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  )
}
