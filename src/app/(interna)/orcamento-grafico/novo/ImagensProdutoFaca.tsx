'use client'

/**
 * ImagensProdutoFaca — bloco visual que exibe, lado a lado, a IMAGEM DA FACA e a
 * FOTO DO PRODUTO do orçamento. Reutilizado em dois lugares do editor de item:
 *  - Step "Dados Técnicos" (informações do produto).
 *  - Step "Revisão", junto do encaixe/imposição.
 *
 * Puramente visual: não afeta cálculo. Quando não há nenhuma das duas imagens,
 * o componente não renderiza nada (retorna null) — não ocupa espaço à toa.
 */

import { Paper, Text, Group, Image, Stack, Box } from '@mantine/core'

interface Props {
  /** dataURL/base64 da imagem da faca (vinda do orçamento/RFQ). */
  imagemFaca?: string | null
  /** URL da foto do produto (quando o orçamento é de um produto cadastrado). */
  imagemProduto?: string | null
  /** Título do bloco. */
  titulo?: string
  /** Clique numa imagem → amplia (modal controlado pelo pai). */
  onAmpliar?: (src: string) => void
}

function Figura({
  src,
  legenda,
  onAmpliar,
}: {
  src: string
  legenda: string
  onAmpliar?: (src: string) => void
}) {
  return (
    <Stack gap={4} align="center" style={{ flex: 1, minWidth: 0 }}>
      <Text size="xs" c="dimmed" fw={500}>{legenda}</Text>
      <Image
        src={src}
        alt={legenda}
        radius="sm"
        h={180}
        fit="contain"
        style={{
          cursor: onAmpliar ? 'zoom-in' : undefined,
          border: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
          width: '100%',
        }}
        onClick={onAmpliar ? () => onAmpliar(src) : undefined}
      />
    </Stack>
  )
}

export default function ImagensProdutoFaca({
  imagemFaca,
  imagemProduto,
  titulo = 'Imagem da faca e do produto',
  onAmpliar,
}: Props) {
  const temFaca = !!imagemFaca
  const temProduto = !!imagemProduto
  if (!temFaca && !temProduto) return null

  return (
    <Paper p="md" withBorder>
      <Text fw={600} size="sm" mb="sm">{titulo}</Text>
      <Group align="stretch" grow wrap="nowrap" gap="md">
        {temFaca && <Figura src={imagemFaca as string} legenda="Faca / corte" onAmpliar={onAmpliar} />}
        {temProduto && <Figura src={imagemProduto as string} legenda="Produto" onAmpliar={onAmpliar} />}
        {/* Mantém a coluna quando só uma imagem existe (evita ocupar 100% sozinha). */}
        {temFaca !== temProduto && <Box style={{ flex: 1 }} />}
      </Group>
    </Paper>
  )
}
