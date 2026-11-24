'use client'

/**
 * CampoDimensoes — várias medidas num campo só ("220 x 150 x 80"), como no Calcgraf.
 * Mantém o texto digitado enquanto o campo tem foco; fora do foco mostra o valor do estado.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Group, Text, TextInput, Tooltip } from '@mantine/core'
import { IconHelpCircle } from '@tabler/icons-react'

/** "220 x 150 x 80" → ['220','150','80'] (n partes; sobra vai para a última). Aceita x, X, × e *. Puro. */
export function separarDimensoes(texto: string, n: number): string[] {
  const partes = texto.split(/\s*[xX×*]\s*/).map((p) => p.trim())
  const saida = Array.from({ length: n }, (_, i) => partes[i] ?? '')
  if (partes.length > n) saida[n - 1] = partes.slice(n - 1).join('')
  return saida
}

/** Valores → texto do campo ("220 x 150 x 80"); vazios do fim são omitidos. Puro. */
export function juntarDimensoes(valores: readonly string[]): string {
  const ate = valores.reduce((u, v, i) => (v !== '' ? i : u), -1)
  return valores.slice(0, ate + 1).map((v) => v || '0').join(' x ')
}

export interface CampoDimensoesProps {
  label: string
  valores: readonly string[]
  onChange: (valores: string[]) => void
  placeholder?: string
  ajuda?: string
  error?: ReactNode
  disabled?: boolean
  /** Sufixo exibido dentro do campo (ex.: mm). */
  unidade?: string
  'data-testid'?: string
}

export default function CampoDimensoes({
  label,
  valores,
  onChange,
  placeholder,
  ajuda,
  error,
  disabled,
  unidade = 'mm',
  ...resto
}: CampoDimensoesProps) {
  const externo = juntarDimensoes(valores)
  const [texto, setTexto] = useState(externo)
  const [focado, setFocado] = useState(false)
  useEffect(() => {
    if (!focado) setTexto(externo)
  }, [externo, focado])
  return (
    <TextInput
      label={
        ajuda ? (
          <Group gap={4} wrap="nowrap" component="span">
            {label}
            <Tooltip label={ajuda} withArrow multiline w={220}>
              <IconHelpCircle size={14} style={{ color: 'var(--mantine-primary-color-filled)' }} />
            </Tooltip>
          </Group>
        ) : (
          label
        )
      }
      aria-label={label}
      placeholder={placeholder}
      inputMode="decimal"
      value={texto}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      onChange={(e) => {
        const t = e.currentTarget.value
        setTexto(t)
        onChange(separarDimensoes(t, valores.length))
      }}
      rightSection={unidade ? <Text size="xs" c="dimmed">{unidade}</Text> : undefined}
      error={error}
      disabled={disabled}
      data-testid={resto['data-testid']}
    />
  )
}
