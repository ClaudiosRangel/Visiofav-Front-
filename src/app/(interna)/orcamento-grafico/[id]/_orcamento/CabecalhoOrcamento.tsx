'use client'

/**
 * CabecalhoOrcamento — dados do ORÇAMENTO (nível 1 da hierarquia): título e migalhas, Série,
 * Número, Data (dd/mm/aaaa), Cliente Principal (código, nome e busca) e a opção
 * "Reforma Tributária 2027". Somente apresentação: a edição do cliente/vendedor abre o
 * `EditarCabecalhoModal` existente, montado por quem renderiza (handler `onEditarCliente`).
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ActionIcon, Anchor, Breadcrumbs, Checkbox, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'

import { formatarData } from './formatadores'
import { rotuloSerieCabecalho } from '../../cadastros/_shared/series'

export interface CabecalhoOrcamentoProps {
  numero: number
  /** Nome da série (cópia gravada no orçamento). Vazio com `serieId` = série padrão sem nome. */
  serie?: string | null
  serieId?: string | null
  /** Data do orçamento (ISO); exibida como dd/mm/aaaa. */
  dataOrcamento?: string | null
  clienteCodigo?: string | null
  clienteNome?: string | null
  /** Valor salvo; ausente/null ⇒ desmarcado (orçamento novo). */
  reformaTributaria2027?: boolean | null
  /** Abre o modal de edição do cliente. Sem handler, o botão de busca fica desabilitado. */
  onEditarCliente?: () => void
  /** Sem handler, o checkbox é exibido somente leitura. */
  onAlterarReformaTributaria?: (marcado: boolean) => void
  /** Botões da barra de ações (ex.: Preview, Proposta). */
  acoes?: ReactNode
  /** Destino da primeira migalha. */
  hrefLista?: string
}

export default function CabecalhoOrcamento({
  numero,
  serie,
  serieId,
  dataOrcamento,
  clienteCodigo,
  clienteNome,
  reformaTributaria2027,
  onEditarCliente,
  onAlterarReformaTributaria,
  acoes,
  hrefLista = '/orcamento-grafico',
}: CabecalhoOrcamentoProps) {
  return (
    <Stack gap="sm">
      <Breadcrumbs>
        <Anchor component={Link} href={hrefLista} size="sm">
          Orçamentos
        </Anchor>
        <Text size="sm">Orçamento {numero}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={2}>Orçamento {numero}</Title>
        {acoes && <Group gap="xs">{acoes}</Group>}
      </Group>

      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <TextInput
            label="Série"
            value={serie?.trim() ? serie : serieId ? rotuloSerieCabecalho(serie) : ''}
            readOnly
            placeholder="—"
          />
          <TextInput label="Número do orçamento" value={String(numero)} readOnly />
          <TextInput label="Data" value={dataOrcamento ? formatarData(dataOrcamento) : ''} readOnly placeholder="—" />
          <Checkbox
            mt={{ base: 0, lg: 28 }}
            label="Reforma Tributária 2027"
            checked={!!reformaTributaria2027}
            readOnly={!onAlterarReformaTributaria}
            onChange={onAlterarReformaTributaria ? (e) => onAlterarReformaTributaria(e.currentTarget.checked) : undefined}
          />
        </SimpleGrid>

        <Group gap="sm" mt="md" align="flex-end" wrap="nowrap">
          <TextInput label="Cód. cliente" value={clienteCodigo ?? ''} readOnly placeholder="—" w={140} />
          <TextInput label="Cliente principal" value={clienteNome ?? ''} readOnly placeholder="Sem cliente definido" style={{ flex: 1 }} />
          <Tooltip label="Buscar ou trocar o cliente">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Buscar cliente"
              onClick={onEditarCliente}
              disabled={!onEditarCliente}
            >
              <IconSearch size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>
    </Stack>
  )
}
