'use client'

import { Paper, Text, Group, Badge, Stack } from '@mantine/core'

/**
 * Desenho (SVG) do encaixe/imposição das peças na folha de impressão.
 * Reproduz visualmente o que o motor calcula (`calcularEncaixe`): grade de
 * colunas × linhas de peças (já com sangria) dentro da folha, com a faixa de
 * pinça marcada. Em tempo real conforme o orçamento muda.
 */

export interface EncaixeLayout {
  folhaLarguraMm: number
  folhaAlturaMm: number
  pincaMm: number
  colunas: number
  linhas: number
  pecaLarguraMm: number
  pecaAlturaMm: number
}

interface Props {
  layout?: EncaixeLayout
  aproveitamento?: number
  percentAproveitamentoFolha?: number
  orientacao?: 'NORMAL' | 'ROTACIONADA'
}

export default function EncaixeVisual({ layout, aproveitamento, percentAproveitamentoFolha, orientacao }: Props) {
  if (!layout || layout.folhaLarguraMm <= 0 || layout.folhaAlturaMm <= 0) {
    return null
  }

  // Área de desenho (viewBox em mm; escala resolvida pelo SVG). Largura máx. de
  // referência; a altura segue a proporção da folha.
  const W = 300
  const escala = W / layout.folhaLarguraMm
  const H = Math.round(layout.folhaAlturaMm * escala)

  const pincaH = layout.pincaMm * escala
  const pw = layout.pecaLarguraMm * escala
  const ph = layout.pecaAlturaMm * escala

  // A pinça fica numa borda (gripper). O motor desconta a pinça da largura útil,
  // então a grade começa após a faixa de pinça à esquerda.
  const offsetX = pincaH
  const pecas: Array<{ x: number; y: number }> = []
  for (let c = 0; c < layout.colunas; c++) {
    for (let l = 0; l < layout.linhas; l++) {
      pecas.push({ x: offsetX + c * pw, y: l * ph })
    }
  }

  const total = layout.colunas * layout.linhas

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs" align="center">
        <Text fw={500} size="sm">Encaixe na folha</Text>
        <Group gap="xs">
          <Badge variant="light">{layout.colunas} × {layout.linhas} = {total} peças/folha</Badge>
          {orientacao && (
            <Badge variant="light" color={orientacao === 'ROTACIONADA' ? 'orange' : 'blue'}>
              {orientacao === 'ROTACIONADA' ? 'Rotacionada 90°' : 'Normal'}
            </Badge>
          )}
          {percentAproveitamentoFolha != null && (
            <Badge variant="light" color="teal">{percentAproveitamentoFolha.toFixed(1)}% da folha</Badge>
          )}
        </Group>
      </Group>

      <Stack gap={4} align="center">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ maxWidth: 360, border: '1px solid var(--mantine-color-gray-4)', background: 'var(--mantine-color-body)' }}
          role="img"
          aria-label={`Encaixe de ${total} peças na folha ${layout.folhaLarguraMm}×${layout.folhaAlturaMm} mm`}
        >
          {/* Folha */}
          <rect x={0} y={0} width={W} height={H} fill="var(--mantine-color-gray-0)" stroke="var(--mantine-color-gray-5)" strokeWidth={0.8} />

          {/* Faixa de pinça (gripper) à esquerda */}
          {pincaH > 0 && (
            <rect x={0} y={0} width={pincaH} height={H} fill="var(--mantine-color-gray-3)" opacity={0.6} />
          )}

          {/* Peças encaixadas */}
          {pecas.map((p, i) => (
            <rect
              key={i}
              x={p.x + 0.5}
              y={p.y + 0.5}
              width={Math.max(0, pw - 1)}
              height={Math.max(0, ph - 1)}
              fill="var(--mantine-color-blue-4)"
              opacity={0.75}
              stroke="var(--mantine-color-blue-7)"
              strokeWidth={0.4}
            />
          ))}
        </svg>

        <Text size="xs" c="dimmed">
          Folha {layout.folhaLarguraMm} × {layout.folhaAlturaMm} mm · peça {layout.pecaLarguraMm} × {layout.pecaAlturaMm} mm (com sangria)
          {layout.pincaMm > 0 ? ` · pinça ${layout.pincaMm} mm` : ''}
          {aproveitamento != null ? ` · aproveitamento ${aproveitamento}` : ''}
        </Text>
      </Stack>
    </Paper>
  )
}
