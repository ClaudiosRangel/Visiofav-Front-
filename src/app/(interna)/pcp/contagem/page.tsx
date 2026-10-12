'use client'

/**
 * Contagem por Contador — seletor de Centro (PCP).
 * Spec checkout-contagem-por-contador, task 7.1 (navegação).
 *
 * Lista os Centros de Produção configurados em modo CONTADOR e leva ao
 * histórico de contagem de cada um (/pcp/cadastros/centros/:id/contador).
 * Centros em modo QUANTIDADE não aparecem (não têm leitura de contador).
 * Padrão do PCP: `api` direto + useState, Mantine 7.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Title, Stack, Table, Group, Badge, Text, Loader, Center, Button, Card, Alert } from '@mantine/core'
import { IconGauge, IconInfoCircle, IconChevronRight } from '@tabler/icons-react'
import { api } from '@/lib/api'

export default function ContagemContadorPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'PCP - Contagem por Contador' }, [])

  const [centros, setCentros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await api.get('/centros-producao', { params: { limit: 100 } })
        const todos = res.data?.data || []
        setCentros(todos.filter((c: any) => c.modoContagem === 'CONTADOR'))
      } catch {
        setCentros([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Stack gap="md">
      <Group gap={8}>
        <IconGauge size={22} />
        <Title order={3}>Contagem por Contador</Title>
      </Group>
      <Text size="sm" c="dimmed">
        Histórico de leituras do contador de máquina por centro. Configure o modo
        de contagem em Cadastros → Centros de Produção.
      </Text>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : centros.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
          Nenhum centro está configurado em modo <b>Contador de máquina</b>. Defina
          o modo de contagem no cadastro do centro para acompanhar o histórico aqui.
        </Alert>
      ) : (
        <Card withBorder padding="sm">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Processo</Table.Th>
                <Table.Th>Zera diariamente</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {centros.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/pcp/cadastros/centros/${c.id}/contador`)}>
                  <Table.Td fw={600}>{c.codigo}</Table.Td>
                  <Table.Td>{c.descricao}</Table.Td>
                  <Table.Td><Badge variant="light" color="teal">{c.tipoProcesso?.descricao || '—'}</Badge></Table.Td>
                  <Table.Td>
                    {c.contadorZeraDiariamente
                      ? <Badge variant="light" color="orange">Sim</Badge>
                      : <Text size="xs" c="dimmed">Não</Text>}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="xs"
                      variant="light"
                      rightSection={<IconChevronRight size={14} />}
                      onClick={(e) => { e.stopPropagation(); router.push(`/pcp/cadastros/centros/${c.id}/contador`) }}
                    >
                      Histórico
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  )
}
