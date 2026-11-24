'use client'

/**
 * GridPlanos — grid "Tipos de Plano" do item multi-plano (R9.1 a R9.12).
 *
 * Colunas Nome · Suporte · Cores · Formato (L x A mm) · Acabamento (nomes por vírgula), uma linha
 * por plano na ordem de sequência. Seleção de 1 linha (clique); duplo clique ou "Abrir" leva à
 * Tela_Plano. Ações:
 *  - Incluir: sempre (vai para `planos/novo`, com `?apos=<selecionado>` se houver);
 *  - Copiar e Excluir: exatamente 1 selecionado (Excluir pede confirmação);
 *  - Subir/Descer: 2 ou mais planos e 1 selecionado;
 *  - Desfazer: há ação na pilha da sessão.
 * No limite de 20 planos, Incluir e Copiar ficam desabilitados com aviso. Falha de gravação mantém
 * a lista e mostra "A operação não foi salva." com o detalhe.
 *
 * Suporte: o plano só traz `suporteId` e a gramatura; a coluna mostra a gramatura (sem buscar o
 * nome um a um na rede) ou "—".
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionIcon, Alert, Badge, Button, Group, Modal, Paper, Radio, ScrollArea, Stack, Table, Text, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconLayoutList,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'

import { MSG_LIMITE_PLANOS, usePlanosDoItem, type PlanosDoItem } from '../_plano/usePlanosDoItem'
import type { PlanoLeitura } from '../_plano/plano.types'
import CartaoSecao from './CartaoSecao'

export interface GridPlanosProps {
  orcamentoId: string
  itemId: string
  /** Chamado depois de cada gravação bem-sucedida (incluir/copiar/excluir/mover/desfazer). */
  onAlterado?: () => void
  /** Estado/ações já criados pelo pai; sem ele o grid usa `usePlanosDoItem`. */
  planosDoItem?: PlanosDoItem
  /** Navegação da tela (ex.: com a guarda de alterações não salvas). Padrão: router.push. */
  navegar?: (url: string) => void
  /** Abre o plano na gaveta lateral (`novo` = inclusão). Sem ela, navega para a página do plano. */
  abrirPlano?: (planoId: string, posicaoApos?: string | null) => void
  disabled?: boolean
}

// ─── Formatação das colunas (puras) ─────────────────────────────────────────

function numeroBr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function textoSuporte(p: PlanoLeitura): string {
  const g = numeroBr(p.gramatura)
  return g ? `${g} g/m²` : '—'
}

export function textoCores(p: PlanoLeitura): string {
  const nxm = typeof p.especificacao?.cores === 'string' ? p.especificacao.cores.trim() : ''
  if (nxm) return nxm
  return p.numCores !== null && p.numCores !== undefined ? String(p.numCores) : '—'
}

export function textoFormato(p: PlanoLeitura): string {
  const l = numeroBr(p.formatoLarguraMm)
  const a = numeroBr(p.formatoAlturaMm)
  return l && a ? `${l} x ${a} mm` : '—'
}

export function textoAcabamento(p: PlanoLeitura): string {
  const nomes = (p.acabamentosRicos ?? [])
    .map((a) => (typeof a?.nome === 'string' ? a.nome.trim() : ''))
    .filter((n) => n.length > 0)
  return nomes.length > 0 ? nomes.join(', ') : '—'
}

/** Nome do tipo de plano, quando o plano o guarda (`especificacao.tipoPlanoNome`). */
function nomeTipo(p: PlanoLeitura): string | null {
  const n = (p.especificacao as { tipoPlanoNome?: unknown } | null)?.tipoPlanoNome
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

// ─── Componente ─────────────────────────────────────────────────────────────

function GridPlanosComHook(props: GridPlanosProps) {
  const planosDoItem = usePlanosDoItem(props.orcamentoId, props.itemId)
  return <GridPlanosView {...props} planosDoItem={planosDoItem} />
}

export default function GridPlanos(props: GridPlanosProps) {
  return props.planosDoItem ? <GridPlanosView {...props} planosDoItem={props.planosDoItem} /> : <GridPlanosComHook {...props} />
}

function GridPlanosView({
  orcamentoId,
  itemId,
  onAlterado,
  planosDoItem: h,
  navegar,
  abrirPlano,
  disabled = false,
}: GridPlanosProps & { planosDoItem: PlanosDoItem }) {
  const router = useRouter()
  const ir = navegar ?? ((url: string) => router.push(url))
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const selecionado = h.planos.find((p) => p.id === selecionadoId) ?? null
  const indiceSel = selecionado ? h.planos.indexOf(selecionado) : -1
  const travado = disabled || h.ocupado
  const umSelecionado = !!selecionado
  const podeMover = h.planos.length >= 2 && umSelecionado

  const urlPlano = (planoId: string) => `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${planoId}`

  const depois = (ok: boolean) => {
    if (ok) onAlterado?.()
  }

  const abrir = (planoId: string) => (abrirPlano ? abrirPlano(planoId) : ir(urlPlano(planoId)))
  const incluir = () => {
    const url = h.incluir(selecionado?.id ?? null)
    if (!url) return
    if (abrirPlano) abrirPlano('novo', selecionado?.id ?? null)
    else ir(url)
  }
  const copiar = async () => {
    if (selecionado) depois(await h.copiar(selecionado.id))
  }
  const excluir = async () => {
    if (!selecionado) return
    setConfirmarExclusao(false)
    const ok = await h.excluir(selecionado.id)
    if (ok) setSelecionadoId(null)
    depois(ok)
  }
  const mover = async (direcao: 'cima' | 'baixo') => {
    if (selecionado) depois(await h.mover(selecionado.id, direcao))
  }
  const desfazer = async () => depois(await h.desfazer())

  const botoes = (
    <Group gap={6} wrap="wrap">
      <Button size="xs" leftSection={<IconPlus size={14} />} onClick={incluir} disabled={travado || h.noLimite}>
        Adicionar Plano
      </Button>
      <Button
        size="xs"
        variant="default"
        leftSection={<IconPencil size={14} />}
        onClick={() => selecionado && abrir(selecionado.id)}
        disabled={disabled || !umSelecionado}
      >
        Editar
      </Button>
      <Button
        size="xs"
        variant="default"
        c="red"
        leftSection={<IconTrash size={14} />}
        onClick={() => setConfirmarExclusao(true)}
        disabled={travado || !umSelecionado}
      >
        Excluir
      </Button>
      <Button
        size="xs"
        variant="default"
        leftSection={<IconCopy size={14} />}
        onClick={copiar}
        disabled={travado || !umSelecionado || h.noLimite}
      >
        Duplicar
      </Button>
      <Tooltip label="Subir o plano selecionado">
        <ActionIcon
          variant="default"
          size={30}
          aria-label="Subir"
          onClick={() => mover('cima')}
          disabled={travado || !podeMover || indiceSel <= 0}
        >
          <IconArrowUp size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Descer o plano selecionado">
        <ActionIcon
          variant="default"
          size={30}
          aria-label="Descer"
          onClick={() => mover('baixo')}
          disabled={travado || !podeMover || indiceSel >= h.planos.length - 1}
        >
          <IconArrowDown size={14} />
        </ActionIcon>
      </Tooltip>
      <Button
        size="xs"
        variant="default"
        leftSection={<IconArrowBackUp size={14} />}
        onClick={desfazer}
        disabled={travado || !h.podeDesfazer}
      >
        Desfazer
      </Button>
    </Group>
  )

  return (
    <CartaoSecao
      titulo="Tipos de Plano"
      icone={<IconLayoutList size={16} />}
      contador={h.planos.length}
      direita={botoes}
      data-testid="grid-planos"
    >
    <Stack gap="sm">
      {h.noLimite && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />} data-testid="grid-planos-limite">
          {MSG_LIMITE_PLANOS}
        </Alert>
      )}

      {h.erroOperacao && h.erroOperacao !== MSG_LIMITE_PLANOS && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          withCloseButton
          onClose={h.limparErro}
          data-testid="grid-planos-erro"
        >
          {h.erroOperacao}
        </Alert>
      )}

      {h.erroCarga ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} data-testid="grid-planos-erro-carga">
          <Group justify="space-between" gap="sm">
            <Text size="sm">{h.erroCarga}</Text>
            <Button size="xs" variant="default" onClick={() => void h.recarregar()}>
              Tentar novamente
            </Button>
          </Group>
        </Alert>
      ) : h.carregando && h.planos.length === 0 ? (
        <Text size="sm" c="dimmed">
          Carregando planos…
        </Text>
      ) : h.planos.length === 0 ? (
        <Paper withBorder radius="md" p="md" data-testid="grid-planos-vazio">
          <Stack gap="xs" align="flex-start">
            <Text size="sm" c="dimmed">
              Este item ainda não tem planos.
            </Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={incluir} disabled={travado || h.noLimite}>
              Incluir plano
            </Button>
          </Stack>
        </Paper>
      ) : (
        <ScrollArea>
          <Table highlightOnHover withTableBorder verticalSpacing="xs" data-testid="grid-planos-tabela">
            <Table.Thead
              bg="var(--mantine-color-default-hover)"
              style={{ textTransform: 'uppercase', fontSize: 'var(--mantine-font-size-xs)', letterSpacing: '0.04em' }}
            >
              <Table.Tr>
                <Table.Th w={36} />
                <Table.Th>Nome</Table.Th>
                <Table.Th>Suporte</Table.Th>
                <Table.Th>Cores</Table.Th>
                <Table.Th>Formato</Table.Th>
                <Table.Th>Acabamento</Table.Th>
                <Table.Th w={80} ta="right">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {h.planos.map((p) => {
                const ativo = p.id === selecionadoId
                return (
                  <Table.Tr
                    key={p.id}
                    data-testid={`plano-linha-${p.id}`}
                    aria-selected={ativo}
                    bg={ativo ? 'var(--mantine-color-blue-light)' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelecionadoId(ativo ? null : p.id)}
                    onDoubleClick={() => !disabled && abrir(p.id)}
                  >
                    <Table.Td>
                      <Radio checked={ativo} onChange={() => setSelecionadoId(p.id)} aria-label={`Selecionar ${p.nome}`} size="xs" />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={600}>{p.nome}</Text>
                        {nomeTipo(p) && (
                          <Badge size="xs" variant="light" color="gray">{nomeTipo(p)}</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{textoSuporte(p)}</Table.Td>
                    <Table.Td>
                      {textoCores(p) === '—' ? '—' : <Badge size="sm" variant="light" radius="sm">{textoCores(p)}</Badge>}
                    </Table.Td>
                    <Table.Td ff="monospace" fz="xs">{textoFormato(p)}</Table.Td>
                    <Table.Td>{textoAcabamento(p)}</Table.Td>
                    <Table.Td>
                      <Group gap={2} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Editar plano">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            aria-label={`Editar ${p.nome}`}
                            disabled={disabled}
                            onClick={(e) => { e.stopPropagation(); abrir(p.id) }}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Excluir plano">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            aria-label={`Excluir ${p.nome}`}
                            disabled={travado}
                            onClick={(e) => { e.stopPropagation(); setSelecionadoId(p.id); setConfirmarExclusao(true) }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal opened={confirmarExclusao} onClose={() => setConfirmarExclusao(false)} title="Excluir plano" centered>
        <Stack gap="md">
          <Text size="sm">Excluir o plano "{selecionado?.nome ?? ''}"? Você pode desfazer esta ação.</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmarExclusao(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={excluir}>
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
    </CartaoSecao>
  )
}
