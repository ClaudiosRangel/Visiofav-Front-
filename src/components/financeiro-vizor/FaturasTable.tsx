'use client'

import { useState } from 'react'
import { Button, Card, Group, Table, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconCashBanknote, IconPlaylistAdd, IconX } from '@tabler/icons-react'

import { StatusFaturaBadge } from '@/components/financeiro-vizor/StatusFaturaBadge'
import { GerarVencimentosModal } from '@/components/financeiro-vizor/GerarVencimentosModal'
import { useFaturaMutations } from '@/hooks/financeiro-vizor/useFaturaMutations'
import {
  formatarBRL,
  formatarCompetencia,
  formatarData,
} from '@/lib/financeiro-vizor/format'
import type { FaturaView } from '@/lib/financeiro-vizor/types'

interface FaturasTableProps {
  /** Empresa dona das faturas (usada nas mutations). */
  empresaId: string
  /** Faturas a exibir (vindas do detalhe). */
  faturas: FaturaView[]
}

/**
 * Tabela de faturas de uma empresa (Req 4.2–4.4) com ações por linha (baixa e
 * cancelamento) e geração de vencimentos em lote.
 *
 * Colunas: Competência (`formatarCompetencia`), Vencimento (`formatarData`),
 * Valor (`formatarBRL`) e Status (`StatusFaturaBadge`). Quando não há faturas,
 * exibe um estado vazio explícito (Req 4.4).
 *
 * Baixa e cancelamento abrem um `modals.openConfirmModal` (@mantine/modals) e só
 * enviam a requisição ao confirmar (Req 4.6, 4.8). As mutations
 * (`useFaturaMutations`) invalidam o detalhe no sucesso e notificam o resultado;
 * o botão que disparou a ação fica desabilitado/carregando enquanto a mutation
 * correspondente está `isPending`, sem travar os botões das demais linhas/ações
 * (Req 4.13).
 */
export function FaturasTable({ empresaId, faturas }: FaturasTableProps) {
  const { darBaixa, cancelarFatura, gerarVencimentos } =
    useFaturaMutations(empresaId)
  const [modalGerarAberto, setModalGerarAberto] = useState(false)

  /** Guarda qual fatura está sendo processada, para o loading ser por linha. */
  const [faturaEmBaixa, setFaturaEmBaixa] = useState<string | null>(null)
  const [faturaEmCancelamento, setFaturaEmCancelamento] = useState<string | null>(
    null,
  )

  function confirmarBaixa(fatura: FaturaView) {
    modals.openConfirmModal({
      title: 'Dar baixa na fatura',
      children: (
        <Text size="sm">
          Confirma a baixa da fatura da competência{' '}
          <strong>{formatarCompetencia(fatura.competencia)}</strong> no valor de{' '}
          <strong>{formatarBRL(fatura.valor)}</strong>? A fatura será marcada como
          paga.
        </Text>
      ),
      labels: { confirm: 'Confirmar baixa', cancel: 'Cancelar' },
      confirmProps: { color: 'green' },
      onConfirm: () => {
        setFaturaEmBaixa(fatura.id)
        darBaixa.mutate(
          { faturaId: fatura.id },
          { onSettled: () => setFaturaEmBaixa(null) },
        )
      },
    })
  }

  function confirmarCancelamento(fatura: FaturaView) {
    modals.openConfirmModal({
      title: 'Cancelar fatura',
      children: (
        <Text size="sm">
          Confirma o cancelamento da fatura da competência{' '}
          <strong>{formatarCompetencia(fatura.competencia)}</strong> no valor de{' '}
          <strong>{formatarBRL(fatura.valor)}</strong>? Esta ação marca a fatura
          como cancelada.
        </Text>
      ),
      labels: { confirm: 'Confirmar cancelamento', cancel: 'Voltar' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setFaturaEmCancelamento(fatura.id)
        cancelarFatura.mutate(
          { faturaId: fatura.id },
          { onSettled: () => setFaturaEmCancelamento(null) },
        )
      },
    })
  }

  /** Faturas já pagas ou canceladas não podem sofrer baixa/cancelamento. */
  function acoesHabilitadas(status: FaturaView['status']) {
    return status === 'PENDENTE' || status === 'VENCIDA'
  }

  return (
    <Card shadow="sm" padding="md" radius="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>Faturas</Text>
        <Button
          leftSection={<IconPlaylistAdd size={16} />}
          variant="light"
          onClick={() => setModalGerarAberto(true)}
        >
          Gerar vencimentos
        </Button>
      </Group>

      {faturas.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Nenhuma fatura gerada para esta empresa.
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Competência</Table.Th>
              <Table.Th>Vencimento</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {faturas.map((fatura) => (
              <Table.Tr key={fatura.id}>
                <Table.Td>{formatarCompetencia(fatura.competencia)}</Table.Td>
                <Table.Td>{formatarData(fatura.dataVencimento)}</Table.Td>
                <Table.Td>{formatarBRL(fatura.valor)}</Table.Td>
                <Table.Td>
                  <StatusFaturaBadge status={fatura.status} />
                </Table.Td>
                <Table.Td>
                  {acoesHabilitadas(fatura.status) && (
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="green"
                        leftSection={<IconCashBanknote size={14} />}
                        onClick={() => confirmarBaixa(fatura)}
                        loading={
                          darBaixa.isPending && faturaEmBaixa === fatura.id
                        }
                        disabled={
                          cancelarFatura.isPending &&
                          faturaEmCancelamento === fatura.id
                        }
                      >
                        Baixa
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconX size={14} />}
                        onClick={() => confirmarCancelamento(fatura)}
                        loading={
                          cancelarFatura.isPending &&
                          faturaEmCancelamento === fatura.id
                        }
                        disabled={
                          darBaixa.isPending && faturaEmBaixa === fatura.id
                        }
                      >
                        Cancelar
                      </Button>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <GerarVencimentosModal
        opened={modalGerarAberto}
        onClose={() => setModalGerarAberto(false)}
        isPending={gerarVencimentos.isPending}
        onConfirmar={(meses) =>
          gerarVencimentos.mutate(
            { meses },
            { onSuccess: () => setModalGerarAberto(false) },
          )
        }
      />
    </Card>
  )
}
