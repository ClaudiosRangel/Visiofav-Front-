'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, Group, Badge, Loader, Center, Select, Image, ThemeIcon, Paper } from '@mantine/core'
import { IconPackage, IconBox, IconRectangle, IconShoppingBag } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface TipoEmbalagem {
  id: string
  codigo: string
  descricao: string
  parametros: any[]
  processosObrigatorios: string[]
  imagemUrl?: string | null
}

const ICONS: Record<string, any> = {
  CARTUCHO: IconBox,
  CAIXA: IconPackage,
  DISPLAY: IconRectangle,
  SACOLA: IconShoppingBag,
}

function getIcon(codigo: string) {
  const upper = (codigo || '').toUpperCase()
  for (const [key, Icon] of Object.entries(ICONS)) {
    if (upper.includes(key)) return Icon
  }
  return IconPackage
}

/** Miniatura do tipo: imagem cadastrada OU ícone padrão por código. */
function Miniatura({ tipo, size = 36 }: { tipo?: TipoEmbalagem; size?: number }) {
  if (tipo?.imagemUrl) {
    return <Image src={tipo.imagemUrl} alt={tipo.descricao} w={size} h={size} fit="contain" radius="sm" />
  }
  const Icon = getIcon(tipo?.codigo ?? '')
  return (
    <ThemeIcon variant="light" color="gray" size={size} radius="sm">
      <Icon size={size * 0.6} stroke={1.5} />
    </ThemeIcon>
  )
}

export default function StepTipo({ formData, updateForm }: Props) {
  const [tipos, setTipos] = useState<TipoEmbalagem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orcamento-grafico/tipos-embalagem')
      .then(({ data }) => setTipos(Array.isArray(data) ? data : data.data || []))
      .catch(() => setTipos([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Center py="xl"><Loader /></Center>

  const selecionado = tipos.find((t) => t.id === formData.tipoEmbalagemId)
  const porId = new Map(tipos.map((t) => [t.id, t]))

  return (
    <Stack gap="md">
      <div>
        <Text fw={600} size="lg">Tipo de Embalagem</Text>
        <Text size="sm" c="dimmed">Selecione o tipo de produto gráfico para este orçamento.</Text>
      </div>

      <Select
        label="Tipo de embalagem"
        placeholder="Selecione o tipo..."
        searchable
        data={tipos.map((t) => ({ value: t.id, label: t.descricao }))}
        value={formData.tipoEmbalagemId}
        onChange={(v) => {
          const tipo = v ? porId.get(v) ?? null : null
          updateForm({ tipoEmbalagemId: v, tipoEmbalagem: tipo, medidas: {} })
        }}
        leftSection={<Miniatura tipo={selecionado} size={22} />}
        comboboxProps={{ withinPortal: true }}
        renderOption={({ option }) => {
          const t = porId.get(option.value)
          return (
            <Group gap="sm" wrap="nowrap" w="100%">
              <Miniatura tipo={t} size={34} />
              <div style={{ flex: 1 }}>
                <Text size="sm">{t?.descricao ?? option.label}</Text>
                <Group gap={4} mt={2}>
                  {t?.processosObrigatorios?.slice(0, 3).map((p) => (
                    <Badge key={p} size="xs" variant="light" color="gray">{p.replace(/_/g, ' ')}</Badge>
                  ))}
                </Group>
              </div>
            </Group>
          )
        }}
      />

      {/* Prévia do selecionado (imagem + selos) */}
      {selecionado && (
        <Paper withBorder p="sm">
          <Group gap="md" wrap="nowrap">
            <Miniatura tipo={selecionado} size={56} />
            <div>
              <Text fw={600}>{selecionado.descricao}</Text>
              <Group gap={4} mt={4}>
                {selecionado.processosObrigatorios?.map((p) => (
                  <Badge key={p} size="xs" variant="light" color="teal">{p.replace(/_/g, ' ')}</Badge>
                ))}
              </Group>
            </div>
          </Group>
        </Paper>
      )}

      {tipos.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          Nenhum tipo de embalagem cadastrado. Cadastre em Orçamento Gráfico → Cadastros → Tipos de Embalagem.
        </Text>
      )}
    </Stack>
  )
}
