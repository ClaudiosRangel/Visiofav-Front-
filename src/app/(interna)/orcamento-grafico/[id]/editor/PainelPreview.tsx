'use client'

/**
 * PainelPreview — bloco de PRÉ-VISUALIZAÇÃO 2D do item de orçamento gráfico,
 * pensado para viver num painel lateral RETRÁTIL do editor (Req 5).
 *
 * Feature: orcamento-editor-ux-redesign (Tarefa 7)
 * _Requirements: 5.1, 5.2_
 *
 * Componente de APRESENTAÇÃO PURO (sem estado/efeito próprio): recebe o layout
 * de encaixe e as imagens já resolvidas pelo pai e apenas desenha. Reaproveita:
 *  - `EncaixeVisual` (SVG do encaixe na folha) — quando há `encaixeLayout`.
 *  - `ImagensProdutoFaca` (faca + produto lado a lado) — quando há alguma imagem.
 *
 * Quando não há nada para mostrar, exibe um estado vazio discreto em vez de
 * sumir — o painel continua visível para o usuário saber onde o preview aparece.
 */

import { Paper, Stack, Text, Group } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'

import EncaixeVisual, { type EncaixeLayout } from '../../novo/EncaixeVisual'
import ImagensProdutoFaca from '../../novo/ImagensProdutoFaca'

interface Props {
  /** dataURL/base64 da imagem da faca (do orçamento/RFQ). */
  imagemFaca?: string | null
  /** URL da foto do produto cadastrado. */
  imagemProduto?: string | null
  /** Layout do encaixe na folha (de `resultadoCalculo.encaixe.layout`), se houver. */
  encaixeLayout?: EncaixeLayout | null
}

export default function PainelPreview({ imagemFaca, imagemProduto, encaixeLayout }: Props) {
  const temEncaixe = !!encaixeLayout && encaixeLayout.folhaLarguraMm > 0 && encaixeLayout.folhaAlturaMm > 0
  const temImagem = !!imagemFaca || !!imagemProduto
  const vazio = !temEncaixe && !temImagem

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="md">
        <IconPhoto size={18} />
        <Text fw={600}>Preview</Text>
      </Group>

      <Stack gap="md">
        {temEncaixe && <EncaixeVisual layout={encaixeLayout!} />}
        {temImagem && (
          <ImagensProdutoFaca imagemFaca={imagemFaca} imagemProduto={imagemProduto} />
        )}

        {vazio && (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            Sem pré-visualização disponível ainda.
          </Text>
        )}
      </Stack>
    </Paper>
  )
}
