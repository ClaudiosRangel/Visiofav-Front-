'use client'

import { useMemo } from 'react'
import { Button, Group, NumberInput, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'

import { useContratoMutation } from '@/hooks/financeiro-vizor/useContratoMutation'
import { formatarBRL } from '@/lib/financeiro-vizor/format'
import { calcularTotalForm, type PrecosPorModulo } from '@/lib/financeiro-vizor/total'
import {
  DIA_VENCIMENTO_MAX,
  MODULOS,
  PRECO_MAX,
  type DetalheCobranca,
  type Modulo,
  type SalvarContratoInput,
} from '@/lib/financeiro-vizor/types'
import {
  validarDataContrato,
  validarDiaVencimento,
  validarPreco,
} from '@/lib/financeiro-vizor/validacao'

/** Rótulos legíveis dos seis módulos cobráveis. */
const ROTULOS_MODULO: Record<Modulo, string> = {
  COMPRAS: 'Compras',
  VENDAS: 'Vendas',
  FINANCEIRO: 'Financeiro',
  FISCAL: 'Fiscal',
  WMS: 'WMS',
  PCP: 'PCP',
}

/** Valores do formulário mantidos pelo `@mantine/form`. */
interface ContratoFormValues {
  /** Data do contrato como `Date | null` (valor nativo do `DateInput`). */
  dataContrato: Date | null
  /** Dia de vencimento (1..31) — pode ser string vazia enquanto não preenchido. */
  diaVencimento: number | ''
  /** Preço por módulo (mapa `modulo -> número`). */
  precos: PrecosPorModulo
}

interface ContratoFormProps {
  /** Id da empresa cujo contrato está sendo editado. */
  empresaId: string
  /** Detalhe inicial vindo da API (contrato + preços dos 6 módulos). */
  detalhe: DetalheCobranca
}

/** Monta o mapa de preços por módulo a partir do detalhe (0 quando ausente). */
function precosIniciais(detalhe: DetalheCobranca): PrecosPorModulo {
  const mapa = new Map(detalhe.precos.map((p) => [p.modulo, p.preco]))
  return MODULOS.reduce((acc, modulo) => {
    const preco = mapa.get(modulo)
    acc[modulo] = Number.isFinite(preco) ? (preco as number) : 0
    return acc
  }, {} as PrecosPorModulo)
}

/** Converte uma `Date` para string "YYYY-MM-DD" (componentes locais). */
function dataParaIso(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Formulário de contrato e preços por módulo do painel Financeiro Vizor.
 *
 * Campos: `DateInput` (dataContrato), `NumberInput` (diaVencimento) e um
 * `NumberInput` por módulo (os seis de `MODULOS`, preço 0 default). O Total
 * Mensal exibido é derivado da soma dos preços do form (via `calcularTotalForm`),
 * recalculado a cada mudança. (Req 3.1, 3.2, 3.4)
 *
 * A validação usa as funções puras de `validacao.ts` (`validarDataContrato`,
 * `validarDiaVencimento`, `validarPreco`); quando inválido, o `@mantine/form`
 * bloqueia o submit e exibe as mensagens, preservando os dados informados.
 * (Req 3.5, 3.6, 3.7, 3.8)
 *
 * O submit chama a mutation de salvar contrato; o botão fica desabilitado
 * enquanto a chamada está em andamento. (Req 3.9, 3.10)
 */
export function ContratoForm({ empresaId, detalhe }: ContratoFormProps) {
  const mutation = useContratoMutation(empresaId)

  const form = useForm<ContratoFormValues>({
    mode: 'controlled',
    initialValues: {
      dataContrato: detalhe.dataContrato ? new Date(detalhe.dataContrato) : null,
      diaVencimento: detalhe.diaVencimento ?? '',
      precos: precosIniciais(detalhe),
    },
    validate: {
      dataContrato: (value) =>
        value instanceof Date && !Number.isNaN(value.getTime())
          ? validarDataContrato(dataParaIso(value))
          : validarDataContrato(''),
      diaVencimento: (value) =>
        typeof value === 'number' ? validarDiaVencimento(value) : validarDiaVencimento(NaN),
      precos: {
        // Validação por módulo: cada preço passa por `validarPreco`.
        ...MODULOS.reduce((acc, modulo) => {
          acc[modulo] = (value: number) => validarPreco(value)
          return acc
        }, {} as Record<Modulo, (value: number) => string | null>),
      },
    },
  })

  // Total Mensal derivado: soma exata dos preços do form, recalculado a cada
  // mudança de valor. (Property 1 / Req 3.4)
  const totalMensal = useMemo(
    () => calcularTotalForm(form.values.precos),
    [form.values.precos],
  )

  const handleSubmit = form.onSubmit((values) => {
    // `values` já passou pela validação do form; a data é uma `Date` válida e o
    // dia é um número dentro do intervalo.
    const input: SalvarContratoInput = {
      dataContrato: dataParaIso(values.dataContrato as Date),
      diaVencimento: values.diaVencimento as number,
      precos: MODULOS.map((modulo) => ({ modulo, preco: values.precos[modulo] })),
    }
    mutation.mutate(input)
  })

  return (
    <Paper withBorder p="md" radius="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Title order={4}>Contrato e preços por módulo</Title>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <DateInput
              label="Data do contrato"
              placeholder="Selecione a data"
              valueFormat="DD/MM/YYYY"
              maxDate={new Date()}
              clearable
              {...form.getInputProps('dataContrato')}
            />
            <NumberInput
              label="Dia de vencimento"
              placeholder="1 a 31"
              min={1}
              max={DIA_VENCIMENTO_MAX}
              allowDecimal={false}
              allowNegative={false}
              {...form.getInputProps('diaVencimento')}
            />
          </SimpleGrid>

          <div>
            <Text fw={600} size="sm" mb="xs">
              Preços por módulo (mensal)
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {MODULOS.map((modulo) => (
                <NumberInput
                  key={modulo}
                  label={ROTULOS_MODULO[modulo]}
                  min={0}
                  max={PRECO_MAX}
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix="R$ "
                  {...form.getInputProps(`precos.${modulo}`)}
                />
              ))}
            </SimpleGrid>
          </div>

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text fw={600}>Total Mensal:</Text>
              <Text fw={700} c="blue" data-testid="total-mensal">
                {formatarBRL(totalMensal)}
              </Text>
            </Group>
            <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
              Salvar contrato
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
