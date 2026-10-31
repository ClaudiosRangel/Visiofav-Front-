'use client'

/**
 * Paleta de Elementos — insere os 7 tipos no Layout_JSON com valores iniciais
 * (Req 2.1/2.2). Spec comercial-editor-visual-templates.
 */
import { Stack, Button, Text } from '@mantine/core'
import {
  IconPhoto, IconLetterT, IconVariable, IconTable, IconLine,
  IconFileText, IconSignature,
} from '@tabler/icons-react'
import type { TipoElemento } from '@/lib/comercial/template-visual/layout-tipos'

const ITENS: Array<{ tipo: TipoElemento; label: string; icon: React.ReactNode }> = [
  { tipo: 'LOGO', label: 'Logo', icon: <IconPhoto size={16} /> },
  { tipo: 'TEXTO', label: 'Texto', icon: <IconLetterT size={16} /> },
  { tipo: 'CAMPO_DINAMICO', label: 'Campo dinâmico', icon: <IconVariable size={16} /> },
  { tipo: 'TABELA', label: 'Tabela', icon: <IconTable size={16} /> },
  { tipo: 'LINHA', label: 'Linha / divisória', icon: <IconLine size={16} /> },
  { tipo: 'BLOCO_CONDICOES', label: 'Bloco de condições', icon: <IconFileText size={16} /> },
  { tipo: 'ASSINATURA', label: 'Assinatura', icon: <IconSignature size={16} /> },
]

export default function PaletaElementos({ onAdicionar }: { onAdicionar: (tipo: TipoElemento) => void }) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">Elementos</Text>
      {ITENS.map((it) => (
        <Button
          key={it.tipo}
          variant="light"
          color="gray"
          leftSection={it.icon}
          justify="flex-start"
          onClick={() => onAdicionar(it.tipo)}
          fullWidth
        >
          {it.label}
        </Button>
      ))}
    </Stack>
  )
}
