'use client'

/**
 * PainelDadosItem — "Dados do Item": resumo em texto, SOMENTE LEITURA, do item selecionado no grid.
 * As seções e as linhas vêm prontas do back (`GET /:id/itens/:itemId/dados-item`); a ordem muda
 * por estrutura (multi-plano × plano único) e já chega definida em `secoes`. Aqui só se desenha.
 *
 * Estados: sem seleção (orientação), carregando, erro (com "Tentar novamente", sem dados do item
 * anterior) e seção sem linhas ("Sem informação cadastrada.").
 */

import { Alert, Badge, Button, Group, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'

import type { DadosItemDTO } from '../_hooks/hierarquia.types'

export interface PainelDadosItemProps {
  /** Item selecionado no grid; `null` ⇒ mensagem de orientação. */
  itemId: string | null
  dados: DadosItemDTO | null
  carregando?: boolean
  erro?: string | null
  onTentarNovamente?: () => void
}

const ROTULO_ESTRUTURA: Record<DadosItemDTO['estrutura'], string> = {
  PLANO_UNICO: 'Plano único',
  MULTI_PLANO: 'Vários planos',
}

export default function PainelDadosItem({ itemId, dados, carregando = false, erro, onTentarNovamente }: PainelDadosItemProps) {
  // Dados de outro item (resposta atrasada) nunca são exibidos.
  const dadosDoItem = dados && dados.itemId === itemId ? dados : null

  let corpo
  if (!itemId) {
    corpo = (
      <Group gap="xs" py="md" wrap="nowrap">
        <IconInfoCircle size={18} />
        <Text size="sm" c="dimmed">Selecione um item no grid de itens do orçamento para ver os dados dele.</Text>
      </Group>
    )
  } else if (erro) {
    corpo = (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar os dados do item">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{erro}</Text>
          {onTentarNovamente && (
            <Button size="xs" variant="default" onClick={onTentarNovamente}>Tentar novamente</Button>
          )}
        </Group>
      </Alert>
    )
  } else if (carregando || !dadosDoItem) {
    corpo = (
      <Stack gap="xs">
        <Skeleton height={14} width="30%" />
        <Skeleton height={12} />
        <Skeleton height={14} width="30%" mt="xs" />
        <Skeleton height={12} width="80%" />
      </Stack>
    )
  } else {
    corpo = (
      <Stack gap="md">
        {dadosDoItem.secoes.map((secao) => (
          <Stack key={secao.chave} gap={4}>
            <Text size="sm" fw={600}>{secao.titulo}</Text>
            {secao.linhas.length === 0 ? (
              <Text size="sm" c="dimmed">Sem informação cadastrada.</Text>
            ) : (
              secao.linhas.map((linha, idx) => (
                <Text key={`${secao.chave}-${idx}`} size="sm">{linha}</Text>
              ))
            )}
          </Stack>
        ))}
      </Stack>
    )
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Dados do item</Text>
        {dadosDoItem && !erro && (
          <Badge variant="light" color="blue">{ROTULO_ESTRUTURA[dadosDoItem.estrutura]}</Badge>
        )}
      </Group>
      {corpo}
    </Paper>
  )
}
