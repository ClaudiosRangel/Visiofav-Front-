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

import { Paper, Stack, Text, Group, Image } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'

import EncaixeVisual, { type EncaixeLayout } from '../../novo/EncaixeVisual'
import ImagensProdutoFaca from '../../novo/ImagensProdutoFaca'

interface Props {
  /** dataURL/base64 da imagem da faca (do orçamento/RFQ ou Ficha Master). */
  imagemFaca?: string | null
  /** URL da foto do produto cadastrado. */
  imagemProduto?: string | null
  /** Imagem da ARTE (dataURL/URL) vinda da Ficha Master, se houver. */
  arte?: string | null
  /** Layout do encaixe na folha (de `resultadoCalculo.encaixe.layout`), se houver. */
  encaixeLayout?: EncaixeLayout | null
}

export default function PainelPreview({ imagemFaca, imagemProduto, arte, encaixeLayout }: Props) {
  const temEncaixe = !!encaixeLayout && encaixeLayout.folhaLarguraMm > 0 && encaixeLayout.folhaAlturaMm > 0
  const temImagem = !!imagemFaca || !!imagemProduto
  const temArte = !!arte
  const vazio = !temEncaixe && !temImagem && !temArte

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

        {/* Arte da Ficha Master — bloco próprio com borda, fit contain. */}
        {temArte && (
          <Stack gap={4}>
            <Text size="sm" fw={600}>Arte</Text>
            <Image
              src={arte!}
              alt="Arte da Ficha Master"
              fit="contain"
              mah={220}
              style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 4 }}
            />
          </Stack>
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
