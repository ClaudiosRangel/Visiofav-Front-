'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Select, NumberInput, Button, Table, Badge, Card,
  Group, LoadingOverlay, Anchor,
} from '@mantine/core'
import { IconFileText, IconDownload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSped, SpedGeracaoPayload } from '@/data/hooks/fiscal/useSped'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const SPED_TIPOS = [
  { value: 'EFD_ICMS_IPI', label: 'EFD ICMS/IPI' },
  { value: 'EFD_CONTRIBUICOES', label: 'EFD Contribuições' },
  { value: 'ECD', label: 'ECD' },
  { value: 'ECF', label: 'ECF' },
  { value: 'REINF', label: 'Reinf' },
]

export default function SpedPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - SPED' }, [])

  const { useHistorico, useGerar } = useSped()
  const { data: historico, isLoading: isLoadingHistorico } = useHistorico()
  const gerarMutation = useGerar()

  const [tipo, setTipo] = useState<string | null>(null)
  const [mes, setMes] = useState<number | ''>(new Date().getMonth() + 1)
  const [ano, setAno] = useState<number | ''>(new Date().getFullYear())
  const [arquivoGerado, setArquivoGerado] = useState<string | null>(null)

  function handleGerar() {
    if (!tipo || !mes || !ano) {
      notifications.show({
        title: 'Campos obrigatórios',
        message: 'Selecione o tipo SPED e informe o período (mês/ano).',
        color: 'orange',
      })
      return
    }

    const periodo = `${ano}-${String(mes).padStart(2, '0')}`
    const payload: SpedGeracaoPayload = {
      tipo: tipo as SpedGeracaoPayload['tipo'],
      periodo,
    }

    setArquivoGerado(null)
    gerarMutation.mutate(payload, {
      onSuccess: (data: any) => {
        notifications.show({
          title: 'SPED gerado com sucesso',
          message: `Arquivo ${data?.nomeArquivo || 'SPED'} disponível para download.`,
          color: 'green',
        })
        setArquivoGerado(data?.nomeArquivo || null)
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Erro ao gerar SPED',
          message: error?.response?.data?.message || 'Não foi possível gerar o arquivo SPED.',
          color: 'red',
        })
      },
    })
  }

  const rows = (historico?.data ?? []).map((item) => (
    <Table.Tr key={item.id}>
      <Table.Td>{new Date(item.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
      <Table.Td>{SPED_TIPOS.find((t) => t.value === item.tipo)?.label || item.tipo}</Table.Td>
      <Table.Td>{item.periodo}</Table.Td>
      <Table.Td>
        <Badge color={item.status === 'GERADO' ? 'green' : 'red'}>
          {item.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        {item.status === 'GERADO' && item.nomeArquivo ? (
          <Anchor
            href={`${process.env.NEXT_PUBLIC_API_URL}/fiscal/sped/${item.id}/download`}
            target="_blank"
            size="sm"
          >
            <Group gap={4}>
              <IconDownload size={14} />
              {item.nomeArquivo}
            </Group>
          </Anchor>
        ) : item.erro ? (
          <Text size="sm" c="red">{item.erro}</Text>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / SPED</Text>
      <Title order={3}>SPED — Obrigações Acessórias</Title>

      <Card withBorder p="lg">
        <Stack gap="sm">
          <Text fw={600}>Gerar Arquivo SPED</Text>

          <Group align="flex-end" gap="md">
            <Select
              label="Tipo SPED"
              placeholder="Selecione o tipo"
              data={SPED_TIPOS}
              value={tipo}
              onChange={setTipo}
              w={220}
            />
            <NumberInput
              label="Mês"
              placeholder="MM"
              min={1}
              max={12}
              value={mes}
              onChange={(val) => setMes(val as number | '')}
              w={90}
            />
            <NumberInput
              label="Ano"
              placeholder="AAAA"
              min={2000}
              max={2100}
              value={ano}
              onChange={(val) => setAno(val as number | '')}
              w={110}
            />
            <Button
              leftSection={<IconFileText size={16} />}
              onClick={handleGerar}
              loading={gerarMutation.isPending}
            >
              Gerar
            </Button>
          </Group>

          {arquivoGerado && (
            <Anchor
              href={`${process.env.NEXT_PUBLIC_API_URL}/fiscal/sped/download/${arquivoGerado}`}
              target="_blank"
              size="sm"
              mt="xs"
            >
              <Group gap={4}>
                <IconDownload size={14} />
                Baixar arquivo gerado: {arquivoGerado}
              </Group>
            </Anchor>
          )}
        </Stack>
      </Card>

      <Card withBorder p="lg">
        <Stack gap="sm">
          <Text fw={600}>Histórico de Gerações</Text>

          <div style={{ position: 'relative', minHeight: 100 }}>
            <LoadingOverlay visible={isLoadingHistorico} />

            {!isLoadingHistorico && (!historico?.data || historico.data.length === 0) ? (
              <Text ta="center" c="dimmed" py="xl">
                Nenhum arquivo SPED gerado ainda.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Período</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Download</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            )}
          </div>
        </Stack>
      </Card>
    </Stack>
  )
}
