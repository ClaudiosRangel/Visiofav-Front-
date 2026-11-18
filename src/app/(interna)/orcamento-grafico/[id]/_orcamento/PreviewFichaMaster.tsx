'use client'

/**
 * PreviewFichaMaster — botão "Preview" + Drawer SOMENTE LEITURA com a ficha master do produto do
 * orçamento: imagem de corte, arte aprovada mais recente e dados gráficos (cartão, gramatura,
 * nº de cores, cores, acabamentos, matriz), com a origem da ficha.
 *
 * É por orçamento (não depende da linha selecionada no grid) e não tem upload, edição, gravação,
 * recálculo nem chamada ao motor. Lê pelo hook `useFichaMaster(id, aberto)`, que só consulta com o
 * drawer aberto. Reutiliza `editor/PainelPreview` para desenhar as imagens.
 */

import { useState } from 'react'
import { Alert, Badge, Button, Divider, Drawer, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconPhoto } from '@tabler/icons-react'

import PainelPreview from '../editor/PainelPreview'
import { origemDaArte, useFichaMaster } from '../_hooks/useFichaMaster'
import type { FichaMasterDTO, OrigemFichaMaster } from '../_hooks/hierarquia.types'

export interface PreviewFichaMasterProps {
  orcamentoId: string
  /** Abre o drawer já na montagem (útil em testes). */
  abertoInicialmente?: boolean
  /** Rótulo do botão (padrão "Preview"; a tela do item usa "Propriedades/Preview"). */
  rotuloBotao?: string
  /** Tamanho do botão (padrão do Mantine). */
  tamanhoBotao?: 'xs' | 'sm' | 'md'
}

const ROTULO_ORIGEM: Record<OrigemFichaMaster, string> = {
  PRODUTO: 'Ficha do produto',
  RASCUNHO: 'Rascunho da pré-impressão',
  ORCAMENTO: 'Imagem gravada no orçamento',
  VAZIO: 'Sem ficha',
}

function semConteudo(f: FichaMasterDTO): boolean {
  return (
    f.origem === 'VAZIO' ||
    (!f.imagemFaca && !f.arte && !f.arteUrl && !f.cartao && !f.gramatura && f.numCores == null &&
      !f.coresDescricao && !f.acabamentos && !f.matriz)
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | number | null | undefined }) {
  const texto = valor === null || valor === undefined || valor === '' ? '—' : String(valor)
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">{rotulo}</Text>
      <Text size="sm" ta="right">{texto}</Text>
    </Group>
  )
}

export default function PreviewFichaMaster({
  orcamentoId,
  abertoInicialmente = false,
  rotuloBotao = 'Preview',
  tamanhoBotao,
}: PreviewFichaMasterProps) {
  const [aberto, setAberto] = useState(abertoInicialmente)
  const { dados, carregando, erro, recarregar } = useFichaMaster(orcamentoId, aberto)

  let corpo
  if (erro) {
    corpo = (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar a ficha master">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{erro}</Text>
          <Button size="xs" variant="default" onClick={recarregar}>Tentar novamente</Button>
        </Group>
      </Alert>
    )
  } else if (!dados) {
    corpo = (
      <Group gap="xs" py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{carregando ? 'Carregando ficha master…' : 'Aguardando ficha master.'}</Text>
      </Group>
    )
  } else if (semConteudo(dados)) {
    corpo = (
      <Paper withBorder p="lg" radius="md">
        <Text size="sm" ta="center" c="dimmed">
          Este produto ainda não tem ficha master nem arte. Elas são cadastradas pela Pré-Impressão.
        </Text>
      </Paper>
    )
  } else {
    corpo = (
      <Stack gap="md">
        <Group gap="xs">
          <Text size="sm" c="dimmed">Origem:</Text>
          <Badge variant="light">{ROTULO_ORIGEM[dados.origem] ?? dados.origem}</Badge>
        </Group>

        <PainelPreview imagemFaca={dados.imagemFaca} arte={origemDaArte(dados)} />

        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Text fw={600}>Dados gráficos</Text>
            <Divider />
            <Linha rotulo="Cartão" valor={dados.cartao} />
            <Linha rotulo="Gramatura" valor={dados.gramatura} />
            <Linha rotulo="Nº de cores" valor={dados.numCores} />
            <Linha rotulo="Cores" valor={dados.coresDescricao} />
            <Linha rotulo="Acabamentos" valor={dados.acabamentos} />
            <Linha rotulo="Matriz" valor={dados.matriz} />
          </Stack>
        </Paper>
      </Stack>
    )
  }

  return (
    <>
      <Button variant="default" size={tamanhoBotao} leftSection={<IconPhoto size={16} />} onClick={() => setAberto(true)}>
        {rotuloBotao}
      </Button>
      <Drawer
        opened={aberto}
        onClose={() => setAberto(false)}
        position="right"
        size="lg"
        title="Ficha master do produto"
        closeButtonProps={{ 'aria-label': 'Fechar' }}
      >
        {corpo}
      </Drawer>
    </>
  )
}
