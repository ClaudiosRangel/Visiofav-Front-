'use client'

/**
 * JanelaDetalhesAtividade — "Detalhes..." de uma atividade num Plano do Cálculo: parâmetros digitados
 * (produção/hora, entradas, repetições, acertos, tempos, quebras, formato de corte), materiais com área de
 * cobertura frente/verso e informação complementar. Campo vazio = usa o cadastro da atividade.
 */
import { useEffect, useState } from 'react'
import { ActionIcon, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'

import type { AtividadeApi, DetalhesAtividade, MaterialAtividade } from './editor-calculo'

export interface JanelaDetalhesAtividadeProps {
  atividade: AtividadeApi | null
  nomePlano: string
  editavel: boolean
  salvando: boolean
  onFechar: () => void
  onSalvar: (dados: { detalhes: DetalhesAtividade; materiais: MaterialAtividade[]; infoComplementar: string | null }) => void
}

const n = (v: string | number) => (v === '' || v == null ? null : Number(v))

export default function JanelaDetalhesAtividade({ atividade, nomePlano, editavel, salvando, onFechar, onSalvar }: JanelaDetalhesAtividadeProps) {
  const [d, setD] = useState<DetalhesAtividade>({})
  const [materiais, setMateriais] = useState<MaterialAtividade[]>([])
  const [info, setInfo] = useState('')
  const [opcoesMaterial, setOpcoesMaterial] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    if (!atividade) return
    setD(atividade.detalhes ?? {})
    setMateriais(atividade.materiais ?? [])
    setInfo(atividade.infoComplementar ?? '')
  }, [atividade])

  useEffect(() => {
    if (!atividade) return
    api
      .get('/orcamento-grafico/materiais-acabamento', { params: { situacao: 'ativa' } })
      .then(({ data }) => {
        const lista = (Array.isArray(data) ? data : data?.data ?? data?.itens ?? []) as Array<{ id: string; nome?: string; descricao?: string; codigo?: string }>
        setOpcoesMaterial(lista.map((m) => ({ value: m.id, label: m.nome ?? m.descricao ?? m.codigo ?? m.id })))
      })
      .catch(() => setOpcoesMaterial([]))
  }, [atividade])

  if (!atividade) return null
  const ro = !editavel
  const set = (p: Partial<DetalhesAtividade>) => setD((x) => ({ ...x, ...p }))

  return (
    <Modal opened onClose={onFechar} size="lg" centered title={<Text fw={700}>Acabamento: {atividade.nome} — {nomePlano}</Text>}>
      <Stack gap="sm">
        <Text size="xs" c="dimmed">Campo vazio usa o valor do cadastro da atividade.</Text>
        <SimpleGrid cols={3} spacing="xs">
          <NumberInput label="Tiragem" value={d.tiragem ?? ''} onChange={(v) => set({ tiragem: n(v) })} readOnly={ro} thousandSeparator="." decimalSeparator="," />
          <NumberInput label="Produção/hora" value={d.producaoHora ?? ''} onChange={(v) => set({ producaoHora: n(v) })} readOnly={ro} thousandSeparator="." decimalSeparator="," />
          <NumberInput label="Entradas" value={d.entradas ?? ''} onChange={(v) => set({ entradas: n(v) })} readOnly={ro} />
          <TextInput label="Repetições" placeholder="2x2" value={d.repeticoes ?? ''} onChange={(e) => set({ repeticoes: e.currentTarget.value || null })} readOnly={ro} />
          <NumberInput label="Tempo 1º acerto (min)" value={d.tempoPrimeiroAcertoMin ?? ''} onChange={(v) => set({ tempoPrimeiroAcertoMin: n(v) })} readOnly={ro} />
          <NumberInput label="Quant. de acertos" value={d.quantAcertos ?? ''} onChange={(v) => set({ quantAcertos: n(v) })} readOnly={ro} />
          <NumberInput label="Tempo por acerto (min)" value={d.tempoPorAcertoMin ?? ''} onChange={(v) => set({ tempoPorAcertoMin: n(v) })} readOnly={ro} />
          <NumberInput label="Quebra fixa (%)" value={d.quebraFixa ?? ''} onChange={(v) => set({ quebraFixa: n(v) })} readOnly={ro} decimalSeparator="," />
          <NumberInput label="Quebra variável (%)" value={d.quebraVariavel ?? ''} onChange={(v) => set({ quebraVariavel: n(v) })} readOnly={ro} decimalSeparator="," />
          <TextInput label="Formato corte" placeholder="570 x 800" value={d.formatoCorte ?? ''} onChange={(e) => set({ formatoCorte: e.currentTarget.value || null })} readOnly={ro} />
        </SimpleGrid>

        <Group justify="space-between">
          <Text fw={600} size="sm">Materiais</Text>
          {editavel && (
            <Button size="compact-xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setMateriais((m) => [...m, { materialAcabamentoId: '', coberturaFrente: 100, coberturaVerso: 0 }])}>
              Incluir material
            </Button>
          )}
        </Group>
        <Table withTableBorder verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Material</Table.Th>
              <Table.Th>Medida</Table.Th>
              <Table.Th ta="right">Cobertura frente %</Table.Th>
              <Table.Th ta="right">Verso %</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {materiais.length === 0 ? (
              <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">Sem material.</Text></Table.Td></Table.Tr>
            ) : (
              materiais.map((m, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Select size="xs" data={opcoesMaterial} value={m.materialAcabamentoId || null} searchable disabled={ro}
                      onChange={(v) => setMateriais((l) => l.map((x, j) => (j === i ? { ...x, materialAcabamentoId: v ?? '' } : x)))} aria-label="Material" />
                  </Table.Td>
                  <Table.Td>
                    <TextInput size="xs" w={110} placeholder="50 x 100" value={m.medida ?? ''} readOnly={ro}
                      onChange={(e) => { const v = e.currentTarget.value; setMateriais((l) => l.map((x, j) => (j === i ? { ...x, medida: v || null } : x))) }} />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" w={90} ml="auto" min={0} max={100} value={m.coberturaFrente ?? ''} readOnly={ro}
                      onChange={(v) => setMateriais((l) => l.map((x, j) => (j === i ? { ...x, coberturaFrente: n(v) } : x)))} />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" w={90} ml="auto" min={0} max={100} value={m.coberturaVerso ?? ''} readOnly={ro}
                      onChange={(v) => setMateriais((l) => l.map((x, j) => (j === i ? { ...x, coberturaVerso: n(v) } : x)))} />
                  </Table.Td>
                  <Table.Td>
                    {editavel && (
                      <ActionIcon size="sm" variant="subtle" color="red" aria-label="Remover material" onClick={() => setMateriais((l) => l.filter((_, j) => j !== i))}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        <Textarea label="Informação complementar" autosize minRows={2} maxLength={2000} value={info} onChange={(e) => setInfo(e.currentTarget.value)} readOnly={ro} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onFechar}>{editavel ? 'Cancelar' : 'Fechar'}</Button>
          {editavel && (
            <Button
              loading={salvando}
              onClick={() => onSalvar({ detalhes: d, materiais: materiais.filter((m) => m.materialAcabamentoId), infoComplementar: info.trim() || null })}
            >
              Salvar
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
