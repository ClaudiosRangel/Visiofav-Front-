'use client'

/**
 * Último cálculo do cliente, ao lado de "Localizar Cálculo" (spec orcamento-prazos-cliente-margem, R2).
 * GET /orcamento-grafico/clientes/:clienteId/ultimo-calculo. "Usar" puxa o cálculo para o orçamento.
 */

import { useEffect, useState } from 'react'
import { Button, Group, Loader, Paper, Text } from '@mantine/core'
import { IconHistory } from '@tabler/icons-react'
import { api } from '@/lib/api'

export interface UltimoCalculo {
  id: string
  numero: number
  data: string
  descricao: string | null
  tiragem: number | null
  valorTotal: number | null
  usadoEmOrcamento: boolean
}

interface Props {
  clienteId: string | null | undefined
  /** Puxa o cálculo; sem esta prop o botão "Usar" não aparece. */
  onUsar?: (calculo: UltimoCalculo) => void
  usando?: boolean
  disabled?: boolean
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "nº 15652 · 17/11/2026 · CX. CARTONAGEM… · 6.000 un · R$ 17.140,96". */
export function resumoUltimoCalculo(c: UltimoCalculo): string {
  const partes = [`nº ${c.numero}`, new Date(c.data).toLocaleDateString('pt-BR')]
  if (c.descricao) partes.push(c.descricao)
  if (c.tiragem) partes.push(`${c.tiragem.toLocaleString('pt-BR')} un`)
  if (c.valorTotal != null) partes.push(brl(c.valorTotal))
  return partes.join(' · ')
}

export default function UltimoCalculoCliente({ clienteId, onUsar, usando, disabled }: Props) {
  const [calculo, setCalculo] = useState<UltimoCalculo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    setCalculo(null)
    setErro(false)
    if (!clienteId) return
    setCarregando(true)
    api
      .get(`/orcamento-grafico/clientes/${clienteId}/ultimo-calculo`)
      .then(({ data }) => { if (ativo) setCalculo((data?.calculo ?? null) as UltimoCalculo | null) })
      .catch(() => { if (ativo) setErro(true) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [clienteId])

  if (!clienteId) return null

  return (
    <Paper withBorder radius="md" p="xs" data-testid="ultimo-calculo-cliente">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <IconHistory size={16} color="var(--mantine-color-dimmed)" />
          {carregando ? (
            <Loader size="xs" aria-label="Carregando último cálculo" />
          ) : (
            <Text size="sm" truncate="end">
              <Text span fw={600}>Último cálculo do cliente: </Text>
              {erro ? 'não foi possível consultar.' : calculo ? resumoUltimoCalculo(calculo) : 'nenhum cálculo anterior.'}
            </Text>
          )}
        </Group>
        {calculo && onUsar && (
          <Button size="xs" variant="light" loading={usando} disabled={disabled} onClick={() => onUsar(calculo)}>
            Usar
          </Button>
        )}
      </Group>
    </Paper>
  )
}
