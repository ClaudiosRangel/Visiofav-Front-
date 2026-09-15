'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, NumberInput, Switch, Table, Title, Stack, LoadingOverlay, ActionIcon, Tooltip, Textarea } from '@mantine/core'
import { IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { cobrancaApi } from '@/hooks/financeiro/useCobrancaApi'

interface Evento { offsetDias: number; assunto: string; template: string }

export default function ReguaPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Régua de Cobrança' }, [])
  const qc = useQueryClient()
  const [ativa, setAtiva] = useState(true)
  const [eventos, setEventos] = useState<Evento[]>([])

  const { isLoading } = useQuery({
    queryKey: ['cob-regua'],
    queryFn: async () => {
      const r: any = await cobrancaApi.obterRegua()
      if (r) { setAtiva(r.ativa); setEventos((r.eventos ?? []).map((e: any) => ({ offsetDias: e.offsetDias, assunto: e.assunto, template: e.template }))) }
      return r
    },
  })

  const salvar = useMutation({
    mutationFn: () => cobrancaApi.salvarRegua(ativa, eventos),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Régua salva' }); qc.invalidateQueries({ queryKey: ['cob-regua'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const addEvento = () => setEventos((s) => [...s, { offsetDias: -3, assunto: 'Aviso de vencimento', template: 'Olá {cliente}, seu título de {valor} vence em {vencimento}.' }])
  const setEv = (i: number, k: keyof Evento, v: any) => setEventos((s) => s.map((e, idx) => idx === i ? { ...e, [k]: v } : e))
  const delEv = (i: number) => setEventos((s) => s.filter((_, idx) => idx !== i))

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Régua de Cobrança</Title>
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
      </Group>
      <Card withBorder padding="sm">
        <Switch label="Régua ativa" checked={ativa} onChange={(e) => setAtiva(e.currentTarget.checked)} mb="md" />
        <Text size="sm" c="dimmed" mb="sm">Eventos: offset em dias relativo ao vencimento (negativo = antes, 0 = no dia, positivo = depois). Variáveis: {'{cliente}'}, {'{valor}'}, {'{vencimento}'}.</Text>
        <Table>
          <Table.Thead><Table.Tr><Table.Th w={120}>Offset (dias)</Table.Th><Table.Th>Assunto</Table.Th><Table.Th>Template</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {eventos.map((e, i) => (
              <Table.Tr key={i}>
                <Table.Td><NumberInput value={e.offsetDias} onChange={(v) => setEv(i, 'offsetDias', Number(v))} /></Table.Td>
                <Table.Td><TextInput value={e.assunto} onChange={(ev) => setEv(i, 'assunto', ev.currentTarget.value)} /></Table.Td>
                <Table.Td><Textarea autosize minRows={1} value={e.template} onChange={(ev) => setEv(i, 'template', ev.currentTarget.value)} /></Table.Td>
                <Table.Td><Tooltip label="Remover"><ActionIcon variant="subtle" color="red" onClick={() => delEv(i)}><IconTrash size={16} /></ActionIcon></Tooltip></Table.Td>
              </Table.Tr>
            ))}
            {eventos.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="sm">Nenhum evento configurado</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        <Button variant="light" leftSection={<IconPlus size={16} />} mt="sm" onClick={addEvento}>Adicionar evento</Button>
      </Card>
    </Stack>
  )
}
