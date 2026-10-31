'use client'

/**
 * Painel de Propriedades — edita posição/dimensão/estilo/binding do elemento
 * selecionado (Req 1.4/1.5/3.1/3.2). Spec comercial-editor-visual-templates.
 * Alterações numéricas aplicam clamp (Req 1.5).
 */
import { Stack, Group, NumberInput, Select, Switch, TextInput, Textarea, Text, ColorInput, Divider, Button } from '@mantine/core'
import type { Elemento, Pagina } from '@/lib/comercial/template-visual/layout-tipos'
import { clampElemento } from '@/lib/comercial/template-visual/layout-escala'

/** Catálogo de bindings suportados (Req 3.1). */
export const BINDINGS_DISPONIVEIS: Array<{ value: string; label: string }> = [
  { value: '{{cliente.nome}}', label: 'Cliente — Nome' },
  { value: '{{cliente.cnpj}}', label: 'Cliente — CNPJ' },
  { value: '{{empresa.razaoSocial}}', label: 'Empresa — Razão social' },
  { value: '{{empresa.cnpj}}', label: 'Empresa — CNPJ' },
  { value: '{{orcamento.numero}}', label: 'Orçamento — Número' },
  { value: '{{orcamento.descricao}}', label: 'Orçamento — Descrição' },
  { value: '{{orcamento.precoVenda}}', label: 'Orçamento — Preço de venda (R$)' },
  { value: '{{orcamento.validadeAte}}', label: 'Orçamento — Validade (data)' },
  { value: '{{orcamento.criadoEm}}', label: 'Orçamento — Data de emissão' },
  { value: '{{orcamento.vendedorNome}}', label: 'Orçamento — Vendedor' },
]

interface Props {
  elemento: Elemento | null
  pagina: Pagina
  onChange: (el: Elemento) => void
  onRemover: (id: string) => void
}

export default function PainelPropriedades({ elemento, pagina, onChange, onRemover }: Props) {
  if (!elemento) {
    return <Text size="sm" c="dimmed">Selecione um elemento no canvas para editar.</Text>
  }
  const el = elemento

  const aplicar = (patch: Partial<Elemento>) => {
    onChange(clampElemento({ ...el, ...patch }, pagina))
  }
  const aplicarEstilo = (patch: Partial<NonNullable<Elemento['estilo']>>) => {
    const estiloAtual = el.estilo ?? { fonte: 'Helvetica' as const, tamanhoPt: 10, alinhamento: 'left' as const, negrito: false, cor: '#000000' }
    onChange({ ...el, estilo: { ...estiloAtual, ...patch } })
  }

  const temEstilo = el.tipo !== 'LOGO' && el.tipo !== 'LINHA'

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">Propriedades — {el.tipo}</Text>

      <Group grow>
        <NumberInput label="X (pt)" value={el.xPt} onChange={(v) => aplicar({ xPt: Number(v) || 0 })} />
        <NumberInput label="Y (pt)" value={el.yPt} onChange={(v) => aplicar({ yPt: Number(v) || 0 })} />
      </Group>
      <Group grow>
        <NumberInput label="Largura (pt)" value={el.larguraPt} min={0} onChange={(v) => aplicar({ larguraPt: Number(v) || 0 })} />
        <NumberInput label="Altura (pt)" value={el.alturaPt} min={0} onChange={(v) => aplicar({ alturaPt: Number(v) || 0 })} />
      </Group>

      {temEstilo && (
        <>
          <Divider label="Estilo" labelPosition="left" />
          <Group grow>
            <NumberInput label="Tamanho (pt)" value={el.estilo?.tamanhoPt ?? 10} min={4} onChange={(v) => aplicarEstilo({ tamanhoPt: Number(v) || 10 })} />
            <Select
              label="Alinhamento"
              data={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]}
              value={el.estilo?.alinhamento ?? 'left'}
              onChange={(v) => aplicarEstilo({ alinhamento: (v as 'left' | 'center' | 'right') || 'left' })}
            />
          </Group>
          <Group grow align="flex-end">
            <ColorInput label="Cor" value={el.estilo?.cor ?? '#000000'} onChange={(v) => aplicarEstilo({ cor: v })} format="hex" />
            <Switch label="Negrito" checked={!!el.estilo?.negrito} onChange={(e) => aplicarEstilo({ negrito: e.currentTarget.checked, fonte: e.currentTarget.checked ? 'Helvetica-Bold' : 'Helvetica' })} />
          </Group>
        </>
      )}

      {(el.tipo === 'TEXTO' || el.tipo === 'BLOCO_CONDICOES') && (
        <Textarea label="Texto" autosize minRows={2} value={el.textoEstatico ?? ''} onChange={(e) => aplicar({ textoEstatico: e.currentTarget.value })} />
      )}

      {el.tipo === 'CAMPO_DINAMICO' && (
        <Select
          label="Campo (binding)"
          data={BINDINGS_DISPONIVEIS}
          value={el.binding ?? null}
          searchable
          onChange={(v) => aplicar({ binding: v ?? undefined })}
        />
      )}

      {el.tipo === 'TABELA' && (
        <Select
          label="Fonte de dados"
          data={[{ value: 'variacoes', label: 'Variações de tiragem' }, { value: 'itens', label: 'Itens' }]}
          value={el.tabela?.fonteDados ?? 'variacoes'}
          onChange={(v) => aplicar({ tabela: { fonteDados: (v as 'itens' | 'variacoes') || 'variacoes', colunas: el.tabela?.colunas ?? [] } })}
        />
      )}

      {el.tipo === 'ASSINATURA' && (
        <TextInput label="Rótulo" value={el.rotuloAssinatura ?? ''} onChange={(e) => aplicar({ rotuloAssinatura: e.currentTarget.value })} />
      )}

      <Divider my="xs" />
      <Button color="red" variant="light" onClick={() => onRemover(el.id)}>Remover elemento</Button>
    </Stack>
  )
}
