'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Checkbox, Paper, NumberInput, SimpleGrid, Group, Collapse, Badge,
  Loader, Center, TextInput, Alert,
} from '@mantine/core'
import { IconSettings, IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData, AcabamentoRicoSelecionado } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface AcabamentoCadastro {
  id: string
  codigo: string
  nome: string
  naturezaCusto: 'HORA_MAQUINA' | 'MATERIAL_KG' | 'MATERIAL_UN' | 'CUSTO_FIXO'
  precoUnitario: number | null
  custoHora: number | null
  producaoHora: number | null
  quantAcertos: number | null
  tempoPorAcertoMin: number | null
  tempoPrimeiroAcertoMin: number | null
  unidadeBase: string | null
}

const naturezaBadge: Record<string, { label: string; color: string }> = {
  HORA_MAQUINA: { label: 'Hora-máquina', color: 'orange' },
  MATERIAL_KG: { label: 'Material/kg', color: 'blue' },
  MATERIAL_UN: { label: 'Material/un', color: 'blue' },
  CUSTO_FIXO: { label: 'Custo fixo', color: 'grape' },
}

export default function StepAcabamentos({ formData, updateForm }: Props) {
  const [cadastro, setCadastro] = useState<AcabamentoCadastro[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    // limit máx do backend é 100 (Zod). 200 fazia o Zod rejeitar (400) e a lista
    // ficava vazia ("Nenhum acabamento cadastrado"). A Wega tem ~67 acabamentos,
    // então 100 cobre tudo numa página.
    api.get('/orcamento-grafico/acabamentos', { params: { page: 1, limit: 100 } })
      .then(({ data }) => {
        // Os campos numéricos vêm como STRING do backend (Decimal do Prisma).
        // O schema Zod do /calcular espera number — por isso convertemos aqui,
        // senão o cálculo falha com "Expected number, received string".
        const num = (v: unknown): number | null =>
          v == null || v === '' ? null : Number(v)
        const items = (data.data || data || []).map((a: any) => ({
          ...a,
          precoUnitario: num(a.precoUnitario),
          custoHora: num(a.custoHora),
          producaoHora: num(a.producaoHora),
          quantAcertos: num(a.quantAcertos),
          tempoPorAcertoMin: num(a.tempoPorAcertoMin),
          tempoPrimeiroAcertoMin: num(a.tempoPrimeiroAcertoMin),
        }))
        setCadastro(items)
      })
      .catch(() => setCadastro([]))
      .finally(() => setLoading(false))
  }, [])

  const selecionados = formData.acabamentosRicos
  const selById = new Map(selecionados.map((s) => [s.acabamentoId, s]))

  const toggle = (ac: AcabamentoCadastro) => {
    if (selById.has(ac.id)) {
      updateForm({ acabamentosRicos: selecionados.filter((s) => s.acabamentoId !== ac.id) })
    } else {
      // O cadastro vem com Decimals serializados como STRING (ex.: custoHora "320").
      // O backend (Zod) espera number — converter com `num()` evita o erro
      // "Expected number, received string" no /calcular.
      const num = (v: unknown): number | undefined =>
        v == null || v === '' ? undefined : Number(v)
      const novo: AcabamentoRicoSelecionado = {
        acabamentoId: ac.id,
        nome: ac.nome,
        naturezaCusto: ac.naturezaCusto,
        // defaults a partir do cadastro (modo DERIVADO — tempos vêm do Calcgraf).
        // O usuário pode ajustar; se deixar como veio, o backend usa o cadastro.
        custoHora: num(ac.custoHora),
        producaoHora: num(ac.producaoHora),
        quantAcertos: num(ac.quantAcertos),
        tempoPorAcertoMin: num(ac.tempoPorAcertoMin),
        tempoPrimeiroAcertoMin: num(ac.tempoPrimeiroAcertoMin),
        unidadeBase: (ac.unidadeBase as 'FOLHA' | 'PRODUTO') ?? 'FOLHA',
      }
      updateForm({ acabamentosRicos: [...selecionados, novo] })
    }
  }

  const patch = (id: string, campo: keyof AcabamentoRicoSelecionado, valor: any) => {
    updateForm({
      acabamentosRicos: selecionados.map((s) =>
        s.acabamentoId === id ? { ...s, [campo]: valor } : s,
      ),
    })
  }

  const filtrados = busca.trim()
    ? cadastro.filter((a) => `${a.codigo} ${a.nome}`.toLowerCase().includes(busca.toLowerCase()))
    : cadastro

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Acabamentos</Text>
      <Text size="sm" c="dimmed">
        Selecione os acabamentos do orçamento e informe os consumos/tempos. A lista vem do cadastro de Acabamentos.
      </Text>

      {cadastro.length === 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Nenhum acabamento cadastrado. Cadastre em Orçamento Gráfico → Cadastros → Acabamentos
          (ou importe do Calcgraf). Você pode seguir sem acabamentos.
        </Alert>
      )}

      {cadastro.length > 0 && (
        <TextInput
          placeholder="Buscar acabamento..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
      )}

      <Stack gap="sm">
        {filtrados.map((ac) => {
          const sel = selById.get(ac.id)
          const ativo = !!sel
          const nb = naturezaBadge[ac.naturezaCusto]
          return (
            <Paper key={ac.id} p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Checkbox
                    label={
                      <Group gap="xs">
                        <Text fw={500}>{ac.nome}</Text>
                        <Badge size="xs" variant="light" color={nb?.color}>{nb?.label}</Badge>
                      </Group>
                    }
                    checked={ativo}
                    onChange={() => toggle(ac)}
                  />
                  {ativo && <IconSettings size={16} color="gray" />}
                </Group>

                <Collapse in={ativo}>
                  {sel && (
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
                      {sel.naturezaCusto === 'MATERIAL_KG' && (
                        <>
                          <NumberInput label="Consumo (kg)" value={sel.variavelKg ?? ''} min={0} decimalScale={3} size="xs"
                            onChange={(v) => patch(ac.id, 'variavelKg', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Preço/kg (R$)" value={sel.precoKg ?? ''} min={0} decimalScale={4} size="xs"
                            onChange={(v) => patch(ac.id, 'precoKg', typeof v === 'number' ? v : undefined)} />
                        </>
                      )}
                      {sel.naturezaCusto === 'MATERIAL_UN' && (
                        <>
                          <NumberInput label="Consumo (un)" value={sel.variavelUn ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'variavelUn', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Preço/un (R$)" value={sel.precoUn ?? ''} min={0} decimalScale={4} size="xs"
                            onChange={(v) => patch(ac.id, 'precoUn', typeof v === 'number' ? v : undefined)} />
                        </>
                      )}
                      {sel.naturezaCusto === 'CUSTO_FIXO' && (
                        <NumberInput label="Valor fixo (R$)" value={sel.valorFixo ?? ''} min={0} decimalScale={2} size="xs"
                          onChange={(v) => patch(ac.id, 'valorFixo', typeof v === 'number' ? v : undefined)} />
                      )}
                      {sel.naturezaCusto === 'HORA_MAQUINA' && (
                        <>
                          <NumberInput label="Custo/hora" prefix="R$ " value={sel.custoHora ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'custoHora', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Produção (un/h)" description="Do cadastro" value={sel.producaoHora ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'producaoHora', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Qtd. acertos" value={sel.quantAcertos ?? ''} min={0} size="xs"
                            onChange={(v) => patch(ac.id, 'quantAcertos', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="Tempo/acerto (min)" value={sel.tempoPorAcertoMin ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'tempoPorAcertoMin', typeof v === 'number' ? v : undefined)} />
                          <NumberInput label="1º acerto (min)" value={sel.tempoPrimeiroAcertoMin ?? ''} min={0} decimalScale={2} size="xs"
                            onChange={(v) => patch(ac.id, 'tempoPrimeiroAcertoMin', typeof v === 'number' ? v : undefined)} />
                        </>
                      )}
                    </SimpleGrid>
                  )}
                </Collapse>
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </Stack>
  )
}
