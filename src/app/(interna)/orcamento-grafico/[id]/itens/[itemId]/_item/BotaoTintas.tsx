'use client'

/**
 * BotaoTintas — botão de pasta ao lado de "Cobertura de Tinta". Abre a janela "Tintas"
 * (Tinta | Complem. | Perc %) e devolve as cores do cálculo. A % de cada tinta define o consumo e o
 * custo de tinta no cálculo; o preço/kg vem do cadastro e pode ser ajustado na linha.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Alert, Badge, Button, Group, Indicator, Modal, NumberInput, Select, Stack, Table, Text, TextInput, Tooltip,
} from '@mantine/core'
import { IconAlertTriangle, IconFolderOpen, IconPlus, IconTrash } from '@tabler/icons-react'

import { carregarTintas } from './tintas-cadastro'
import {
  MAX_TINTAS,
  coresDasLinhas,
  linhaVazia,
  linhasDasCores,
  resumoTintas,
  validarLinhasTinta,
  type CorGravada,
  type LinhaTinta,
  type TintaCadastro,
} from './tintas-item'

export interface BotaoTintasProps {
  value: ReadonlyArray<Partial<CorGravada>> | null | undefined
  onChange: (cores: CorGravada[]) => void
  disabled?: boolean
  /** Ex.: "da capa interna" (título da janela). */
  sufixoTitulo?: string
}

export default function BotaoTintas({ value, onChange, disabled, sufixoTitulo }: BotaoTintasProps) {
  const [aberto, setAberto] = useState(false)
  const [cadastro, setCadastro] = useState<TintaCadastro[]>([])
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<LinhaTinta[]>([])
  const [tentou, setTentou] = useState(false)

  useEffect(() => {
    if (!aberto) return
    carregarTintas()
      .then((l) => {
        setCadastro(l)
        setErroCarga(null)
      })
      .catch(() => setErroCarga('Não foi possível carregar o cadastro de tintas.'))
  }, [aberto])

  // Como no sistema de referência: a janela abre vazia e só vem preenchida quando o item nasce de um
  // cálculo existente. Em orçamento novo, as tintas são incluídas à mão.
  const abrir = () => {
    setLinhas(linhasDasCores(value, cadastro))
    setTentou(false)
    setAberto(true)
  }

  const opcoes = useMemo(() => {
    const base = cadastro.map((t) => ({ value: t.id, label: t.nome }))
    // Tinta gravada que não está no cadastro continua visível na linha.
    for (const l of linhas) {
      if (l.tinta && !l.tintaId && !base.some((o) => o.label === l.tinta)) base.push({ value: `nome:${l.tinta}`, label: l.tinta })
    }
    return base
  }, [cadastro, linhas])

  const erros = tentou ? validarLinhasTinta(linhas) : []
  const erroDe = (chave: string, campo: string) => erros.find((e) => e.chave === chave && e.campo === campo)?.motivo

  const mudar = (chave: string, parcial: Partial<LinhaTinta>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)))

  const escolherTinta = (chave: string, v: string | null) => {
    if (!v) return mudar(chave, { tintaId: null, tinta: '' })
    if (v.startsWith('nome:')) return mudar(chave, { tintaId: null, tinta: v.slice(5) })
    const t = cadastro.find((x) => x.id === v)
    if (!t) return
    setLinhas((ls) =>
      ls.map((l) =>
        l.chave === chave
          ? { ...l, tintaId: t.id, tinta: t.nome, precoKg: l.precoKg && l.tintaId === t.id ? l.precoKg : String(t.precoKg).replace('.', ',') }
          : l,
      ),
    )
  }

  const confirmar = () => {
    setTentou(true)
    if (validarLinhasTinta(linhas).length > 0) return
    onChange(coresDasLinhas(linhas))
    setAberto(false)
  }

  const qtd = (value ?? []).length
  const soma = coresDasLinhas(linhas).reduce((s, c) => s + c.coberturaPercent, 0)
  const semPreco = linhas.some((l) => l.tinta && (Number(l.precoKg.replace(',', '.')) || 0) === 0)

  return (
    <>
      <Tooltip label={`Tintas: ${resumoTintas(value)}`}>
        <Indicator label={qtd} size={16} disabled={qtd === 0} offset={4}>
          <ActionIcon variant="default" size={36} aria-label="Tintas" disabled={disabled} onClick={abrir}>
            <IconFolderOpen size={16} />
          </ActionIcon>
        </Indicator>
      </Tooltip>

      <Modal
        opened={aberto}
        onClose={() => setAberto(false)}
        title={<Text fw={700}>{sufixoTitulo ? `Tintas ${sufixoTitulo}` : 'Tintas'}</Text>}
        size="xl"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Informe as tintas aplicadas e a porcentagem de cada uma. O cálculo usa a % para a quantidade de tinta e o
            preço/kg para o custo.
          </Text>
          {erroCarga && (
            <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
              {erroCarga}
            </Alert>
          )}
          <Table withTableBorder verticalSpacing={4}>
            <Table.Thead bg="var(--mantine-color-default-hover)">
              <Table.Tr>
                <Table.Th>Tinta</Table.Th>
                <Table.Th>Complem.</Table.Th>
                <Table.Th w={110} ta="right">
                  Perc (%)
                </Table.Th>
                <Table.Th w={130} ta="right">
                  R$/kg
                </Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linhas.map((l) => (
                <Table.Tr key={l.chave}>
                  <Table.Td>
                    <Select
                      size="xs"
                      aria-label="Tinta"
                      placeholder="Selecione a tinta"
                      searchable
                      data={opcoes}
                      value={l.tintaId ?? (l.tinta ? `nome:${l.tinta}` : null)}
                      onChange={(v) => escolherTinta(l.chave, v)}
                      error={erroDe(l.chave, 'tinta')}
                      nothingFoundMessage="Nenhuma tinta encontrada"
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      aria-label="Complemento"
                      placeholder="Ex.: CMYK, CW0210 - DOURADO"
                      maxLength={120}
                      value={l.complemento}
                      onChange={(e) => mudar(l.chave, { complemento: e.currentTarget.value })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      aria-label="Percentual"
                      hideControls
                      min={0}
                      max={100}
                      decimalScale={2}
                      decimalSeparator=","
                      value={l.perc === '' ? '' : Number(l.perc.replace(',', '.'))}
                      onChange={(v) => mudar(l.chave, { perc: v === '' ? '' : String(v).replace('.', ',') })}
                      error={erroDe(l.chave, 'perc')}
                      styles={{ input: { textAlign: 'right' } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      aria-label="Preço por kg"
                      hideControls
                      min={0}
                      decimalScale={4}
                      decimalSeparator=","
                      thousandSeparator="."
                      prefix="R$ "
                      value={l.precoKg === '' ? '' : Number(l.precoKg.replace(/\./g, '').replace(',', '.'))}
                      onChange={(v) => mudar(l.chave, { precoKg: v === '' ? '' : String(v).replace('.', ',') })}
                      error={erroDe(l.chave, 'precoKg')}
                      styles={{ input: { textAlign: 'right' } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label="Remover tinta"
                      onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {linhas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center">
                      Nenhuma tinta. O cálculo fica sem custo de tinta.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Group justify="space-between">
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
                disabled={linhas.length >= MAX_TINTAS}
              >
                Adicionar tinta
              </Button>
              <Badge variant="light" color="gray">
                Total {String(Math.round(soma * 100) / 100).replace('.', ',')}%
              </Badge>
              {semPreco && (
                <Badge variant="light" color="orange">
                  Tinta sem preço no cadastro: informe o R$/kg
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Button variant="default" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmar}>Confirmar</Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
