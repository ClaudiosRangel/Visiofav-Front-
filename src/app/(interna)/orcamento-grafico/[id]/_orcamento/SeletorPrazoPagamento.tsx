'use client'

/**
 * Prazo de pagamento do orçamento (cadastro do Comercial). Mostra o prazo mais usado pelo cliente e,
 * quando `aplicarPadrao`, já o seleciona se nada estiver escolhido (R4). Somente leitura com motivo
 * quando `bloqueadoMotivo` (R1).
 */

import { useEffect, useMemo, useState } from 'react'
import { Group, Popover, Select, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core'
import { IconHistory, IconLock } from '@tabler/icons-react'

import {
  carregarPrazos,
  historicoPrazosDoCliente,
  resumoUsoPrazo,
  rotuloPrazo,
  type HistoricoPrazosCliente,
  type PrazoPagamento,
} from './prazo-cliente'

interface Props {
  value: string | null
  onChange: (prazoId: string | null, prazo: PrazoPagamento | null) => void
  clienteId?: string | null
  /** Seleciona o prazo mais usado pelo cliente quando ainda não há prazo. */
  aplicarPadrao?: boolean
  disabled?: boolean
  /** Bloqueado com o motivo (ex.: definido no orçamento calculado). */
  bloqueadoMotivo?: string | null
  label?: string
  /** Texto do prazo gravado quando ele não está mais no cadastro. */
  textoAtual?: string | null
}

export default function SeletorPrazoPagamento({
  value,
  onChange,
  clienteId,
  aplicarPadrao,
  disabled,
  bloqueadoMotivo,
  label = 'Prazo de pagamento',
  textoAtual,
}: Props) {
  const [prazos, setPrazos] = useState<PrazoPagamento[]>([])
  const [historico, setHistorico] = useState<HistoricoPrazosCliente | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    carregarPrazos()
      .then((l) => { if (ativo) setPrazos(l) })
      .catch(() => { if (ativo) setErro('Não foi possível carregar os prazos de pagamento.') })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    setHistorico(null)
    if (!clienteId) return
    historicoPrazosDoCliente(clienteId)
      .then((h) => { if (ativo) setHistorico(h) })
      .catch(() => { if (ativo) setHistorico(null) })
    return () => { ativo = false }
  }, [clienteId])

  const padraoId = historico?.padrao?.prazoId ?? null
  useEffect(() => {
    if (!aplicarPadrao || value || !padraoId || disabled || bloqueadoMotivo) return
    const p = prazos.find((x) => x.id === padraoId)
    if (p) onChange(p.id, p)
  }, [aplicarPadrao, value, padraoId, prazos, disabled, bloqueadoMotivo, onChange])

  const opcoes = useMemo(() => {
    const base = prazos.map((p) => ({ value: p.id, label: `${rotuloPrazo(p)}${p.id === padraoId ? ' — mais usado pelo cliente' : ''}` }))
    if (value && !base.some((o) => o.value === value)) base.unshift({ value, label: textoAtual || 'Prazo gravado' })
    return base
  }, [prazos, padraoId, value, textoAtual])

  const linhas = historico?.historico ?? []
  const descricao = bloqueadoMotivo
    ? undefined
    : historico?.padrao
      ? `Mais usado pelo cliente: ${historico.padrao.descricao}`
      : clienteId
        ? 'Cliente sem histórico de prazos.'
        : undefined

  return (
    <Stack gap={2}>
      <Select
        label={
          <Group gap={6} wrap="nowrap" component="span">
            <span>{label}</span>
            {bloqueadoMotivo && (
              <Tooltip label={bloqueadoMotivo} multiline w={300}>
                <ThemeIcon size="xs" variant="light" color="gray" aria-label="Prazo bloqueado">
                  <IconLock size={12} />
                </ThemeIcon>
              </Tooltip>
            )}
            {linhas.length > 0 && (
              <Popover width={320} position="bottom-start" withArrow shadow="md">
                <Popover.Target>
                  <UnstyledButton aria-label="Histórico de prazos do cliente">
                    <ThemeIcon size="xs" variant="light">
                      <IconHistory size={12} />
                    </ThemeIcon>
                  </UnstyledButton>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap={6}>
                    <Text size="xs" fw={700}>Prazos praticados com o cliente</Text>
                    {linhas.slice(0, 8).map((l) => (
                      <div key={`${l.prazoId ?? l.descricao}`}>
                        <Text size="sm">{l.descricao}</Text>
                        <Text size="xs" c="dimmed">{resumoUsoPrazo(l)}</Text>
                      </div>
                    ))}
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>
        }
        aria-label={label}
        placeholder={erro ? 'Prazos indisponíveis' : 'Selecione o prazo'}
        data={opcoes}
        value={value}
        onChange={(v) => onChange(v, prazos.find((p) => p.id === v) ?? null)}
        searchable
        clearable={!bloqueadoMotivo}
        disabled={disabled || !!bloqueadoMotivo}
        description={bloqueadoMotivo ?? descricao}
        error={erro}
        nothingFoundMessage="Nenhum prazo cadastrado"
        comboboxProps={{ withinPortal: true }}
      />
    </Stack>
  )
}
