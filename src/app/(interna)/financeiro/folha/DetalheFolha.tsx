'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge, Stack,
  Modal, ActionIcon, Tooltip, Divider, Textarea, Alert, Grid,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconTrash, IconChecks, IconUserPlus, IconAlertTriangle, IconFileUpload, IconCurrencyReal,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatarBRL, formatarData, formatarCompetencia } from '@/lib/financeiro/format'

const folhaApi = {
  detalhe: (id: string) => api.get(`/financeiro/folha/${id}`).then((r) => r.data),
  addItem: (id: string, body: any) => api.post(`/financeiro/folha/${id}/itens`, body).then((r) => r.data),
  removerItem: (id: string, itemId: string) => api.delete(`/financeiro/folha/${id}/itens/${itemId}`).then((r) => r.data),
  addEncargo: (id: string, body: any) => api.post(`/financeiro/folha/${id}/encargos`, body).then((r) => r.data),
  removerEncargo: (id: string, encargoId: string) => api.delete(`/financeiro/folha/${id}/encargos/${encargoId}`).then((r) => r.data),
  importarCsv: (id: string, conteudo: string) => api.post(`/financeiro/folha/${id}/importar-csv`, { conteudo }).then((r) => r.data),
  efetivar: (id: string) => api.post(`/financeiro/folha/${id}/efetivar`, {}).then((r) => r.data),
}

const TIPOS_ENCARGO = [
  { value: 'INSS', label: 'INSS' },
  { value: 'FGTS', label: 'FGTS' },
  { value: 'IRRF', label: 'IRRF' },
  { value: 'OUTRO', label: 'Outro' },
]

interface Props {
  folhaId: string | null
  onClose: () => void
  funcionariosQuery: () => Promise<any>
}

export function DetalheFolha({ folhaId, onClose, funcionariosQuery }: Props) {
  const qc = useQueryClient()
  const aberto = Boolean(folhaId)

  const { data: folha, isLoading } = useQuery<any>({
    queryKey: ['fin-folha', folhaId],
    queryFn: () => folhaApi.detalhe(folhaId!),
    enabled: aberto,
  })

  const { data: funcData } = useQuery<any>({
    queryKey: ['fin-folha-funcionarios'],
    queryFn: funcionariosQuery,
    enabled: aberto,
  })
  const funcionarios: any[] = funcData?.data ?? funcData ?? []

  const [novoItem, setNovoItem] = useState<any>({ funcionarioId: null, proventos: '', descontos: '' })
  const [novoEncargo, setNovoEncargo] = useState<any>({ tipo: 'INSS', beneficiario: '', valor: '', vencimento: null as Date | null })
  const [csvTexto, setCsvTexto] = useState('')
  const [modalCsv, setModalCsv] = useState(false)
  const [confirmEfetivar, setConfirmEfetivar] = useState(false)

  const editavel = folha?.status === 'ABERTA'

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['fin-folha', folhaId] })
    qc.invalidateQueries({ queryKey: ['fin-folhas'] })
  }
  const erro = (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' })

  const addItem = useMutation({
    mutationFn: () => folhaApi.addItem(folhaId!, {
      funcionarioId: novoItem.funcionarioId,
      proventos: Number(novoItem.proventos) || 0,
      descontos: Number(novoItem.descontos) || 0,
    }),
    onSuccess: () => { setNovoItem({ funcionarioId: null, proventos: '', descontos: '' }); invalidar() },
    onError: erro,
  })

  const removerItem = useMutation({
    mutationFn: (itemId: string) => folhaApi.removerItem(folhaId!, itemId),
    onSuccess: invalidar, onError: erro,
  })

  const addEncargo = useMutation({
    mutationFn: () => folhaApi.addEncargo(folhaId!, {
      tipo: novoEncargo.tipo,
      beneficiario: novoEncargo.beneficiario,
      valor: Number(novoEncargo.valor) || 0,
      vencimento: (novoEncargo.vencimento ?? new Date()).toISOString(),
    }),
    onSuccess: () => { setNovoEncargo({ tipo: 'INSS', beneficiario: '', valor: '', vencimento: null }); invalidar() },
    onError: erro,
  })

  const removerEncargo = useMutation({
    mutationFn: (encargoId: string) => folhaApi.removerEncargo(folhaId!, encargoId),
    onSuccess: invalidar, onError: erro,
  })

  const importar = useMutation({
    mutationFn: () => folhaApi.importarCsv(folhaId!, csvTexto),
    onSuccess: (res: any) => {
      const pend = res?.pendentes?.length ?? 0
      notifications.show({ color: pend > 0 ? 'yellow' : 'green', message: `${res.criados} item(ns) importado(s)${pend > 0 ? `, ${pend} pendente(s)` : ''}` })
      setModalCsv(false); setCsvTexto(''); invalidar()
    },
    onError: erro,
  })

  const efetivar = useMutation({
    mutationFn: () => folhaApi.efetivar(folhaId!),
    onSuccess: (res: any) => {
      notifications.show({ color: 'green', message: `Folha efetivada: ${res.titulosFuncionarios} título(s) de funcionário + ${res.titulosEncargos} encargo(s) em contas a pagar` })
      setConfirmEfetivar(false); invalidar()
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
    onError: (e: any) => { setConfirmEfetivar(false); erro(e) },
  })

  const totais = folha?.totais ?? { totalLiquido: 0, totalEncargos: 0, totalGeral: 0 }

  return (
    <Modal opened={aberto} onClose={onClose} size="80rem" title={folha ? `Folha ${formatarCompetencia(folha.competencia)}` : 'Folha'}>
      {folha && (
        <Stack>
          <Group justify="space-between">
            <Group>
              <Badge variant="light" color={folha.status === 'EFETIVADA' ? 'green' : folha.status === 'CANCELADA' ? 'gray' : 'blue'} size="lg">{folha.status}</Badge>
              {folha.descricao && <Text c="dimmed">{folha.descricao}</Text>}
            </Group>
            <Group>
              {editavel && (
                <Button variant="light" leftSection={<IconFileUpload size={16} />} onClick={() => setModalCsv(true)}>Importar CSV</Button>
              )}
              {editavel && (
                <Button color="green" leftSection={<IconChecks size={16} />} onClick={() => setConfirmEfetivar(true)} disabled={folha.itens.length === 0 && folha.encargos.length === 0}>
                  Efetivar folha
                </Button>
              )}
            </Group>
          </Group>

          {!editavel && (
            <Alert color="green" variant="light" icon={<IconChecks size={16} />}>
              Folha efetivada — os títulos já foram gerados no Contas a Pagar. Não é mais editável.
            </Alert>
          )}

          <Grid>
            <Grid.Col span={4}><Card withBorder padding="xs"><Text size="xs" c="dimmed">Total líquidos</Text><Text fw={700}>{formatarBRL(totais.totalLiquido)}</Text></Card></Grid.Col>
            <Grid.Col span={4}><Card withBorder padding="xs"><Text size="xs" c="dimmed">Total encargos</Text><Text fw={700}>{formatarBRL(totais.totalEncargos)}</Text></Card></Grid.Col>
            <Grid.Col span={4}><Card withBorder padding="xs"><Text size="xs" c="dimmed">Total geral</Text><Text fw={700} c="blue">{formatarBRL(totais.totalGeral)}</Text></Card></Grid.Col>
          </Grid>

          {/* Itens dos funcionários */}
          <Divider label="Funcionários (líquido a pagar)" />
          {editavel && (
            <Card withBorder padding="sm">
              <Group align="flex-end" grow>
                <Select
                  label="Funcionário"
                  placeholder="Selecione"
                  searchable
                  data={funcionarios.map((f) => ({ value: f.id, label: `${f.nome}${f.cpf ? ` (${f.cpf})` : f.matricula ? ` (${f.matricula})` : ''}` }))}
                  value={novoItem.funcionarioId}
                  onChange={(v) => setNovoItem((s: any) => ({ ...s, funcionarioId: v }))}
                />
                <NumberInput label="Proventos" value={novoItem.proventos} onChange={(v) => setNovoItem((s: any) => ({ ...s, proventos: v }))} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
                <NumberInput label="Descontos" value={novoItem.descontos} onChange={(v) => setNovoItem((s: any) => ({ ...s, descontos: v }))} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
                <Button leftSection={<IconUserPlus size={16} />} loading={addItem.isPending} disabled={!novoItem.funcionarioId} onClick={() => addItem.mutate()}>Adicionar</Button>
              </Group>
            </Card>
          )}
          <Table striped>
            <Table.Thead><Table.Tr><Table.Th>Funcionário</Table.Th><Table.Th ta="right">Proventos</Table.Th><Table.Th ta="right">Descontos</Table.Th><Table.Th ta="right">Líquido</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {folha.itens.map((it: any) => (
                <Table.Tr key={it.id}>
                  <Table.Td>{it.funcionario?.nome ?? '—'}</Table.Td>
                  <Table.Td ta="right">{formatarBRL(Number(it.proventos))}</Table.Td>
                  <Table.Td ta="right">{formatarBRL(Number(it.descontos))}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatarBRL(Number(it.liquido))}</Table.Td>
                  <Table.Td>
                    {editavel && <ActionIcon variant="subtle" color="red" onClick={() => removerItem.mutate(it.id)}><IconTrash size={16} /></ActionIcon>}
                  </Table.Td>
                </Table.Tr>
              ))}
              {folha.itens.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="sm">Nenhum funcionário lançado.</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>

          {/* Encargos */}
          <Divider label="Encargos / Guias (INSS, FGTS, IRRF)" />
          {editavel && (
            <Card withBorder padding="sm">
              <Group align="flex-end" grow>
                <Select label="Tipo" data={TIPOS_ENCARGO} value={novoEncargo.tipo} onChange={(v) => setNovoEncargo((s: any) => ({ ...s, tipo: v }))} />
                <TextInput label="Beneficiário" placeholder="INSS - União" value={novoEncargo.beneficiario} onChange={(e) => setNovoEncargo((s: any) => ({ ...s, beneficiario: e.currentTarget.value }))} />
                <NumberInput label="Valor" value={novoEncargo.valor} onChange={(v) => setNovoEncargo((s: any) => ({ ...s, valor: v }))} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
                <DateInput label="Vencimento" value={novoEncargo.vencimento} onChange={(v) => setNovoEncargo((s: any) => ({ ...s, vencimento: v }))} valueFormat="DD/MM/YYYY" />
                <Button leftSection={<IconCurrencyReal size={16} />} loading={addEncargo.isPending} disabled={!novoEncargo.beneficiario || Number(novoEncargo.valor) <= 0 || !novoEncargo.vencimento} onClick={() => addEncargo.mutate()}>Adicionar</Button>
              </Group>
            </Card>
          )}
          <Table striped>
            <Table.Thead><Table.Tr><Table.Th>Tipo</Table.Th><Table.Th>Beneficiário</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th>Vencimento</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {folha.encargos.map((en: any) => (
                <Table.Tr key={en.id}>
                  <Table.Td><Badge variant="light">{en.tipo}</Badge></Table.Td>
                  <Table.Td>{en.beneficiario}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatarBRL(Number(en.valor))}</Table.Td>
                  <Table.Td>{formatarData(en.vencimento)}</Table.Td>
                  <Table.Td>
                    {editavel && <ActionIcon variant="subtle" color="red" onClick={() => removerEncargo.mutate(en.id)}><IconTrash size={16} /></ActionIcon>}
                  </Table.Td>
                </Table.Tr>
              ))}
              {folha.encargos.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="sm">Nenhum encargo lançado.</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      {/* Importar CSV */}
      <Modal opened={modalCsv} onClose={() => setModalCsv(false)} title="Importar resultado da folha (CSV)" size="lg">
        <Stack>
          <Alert color="blue" variant="light">
            Cole o CSV com as colunas: <b>cpf</b> ou <b>matricula</b>, <b>proventos</b>, <b>descontos</b>, <b>liquido</b>. Cada linha vira um item de funcionário.
          </Alert>
          <Textarea
            label="Conteúdo do CSV"
            minRows={8}
            autosize
            placeholder={'cpf,proventos,descontos,liquido\n52998224725,3000.00,800.00,2200.00'}
            value={csvTexto}
            onChange={(e) => setCsvTexto(e.currentTarget.value)}
          />
          <Button loading={importar.isPending} disabled={!csvTexto.trim()} onClick={() => importar.mutate()}>Importar</Button>
        </Stack>
      </Modal>

      {/* Confirmar efetivação */}
      <Modal opened={confirmEfetivar} onClose={() => setConfirmEfetivar(false)} title="Efetivar folha" size="md">
        <Stack>
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
            Isso vai gerar as <b>contas a pagar</b>: {folha?.itens.length} título(s) de funcionário e {folha?.encargos.length} encargo(s), totalizando <b>{formatarBRL(totais.totalGeral)}</b>. A folha ficará travada. Confirmar?
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmEfetivar(false)}>Cancelar</Button>
            <Button color="green" loading={efetivar.isPending} onClick={() => efetivar.mutate()}>Confirmar e efetivar</Button>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  )
}
