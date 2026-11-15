'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center, NumberInput, Alert, Badge, ScrollArea,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconLock, IconRefresh } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { parametrosApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type { Parametros } from '../_shared/cadastros-graficos.types'

function statusDe(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

export default function ParametrosOrcamentoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Parâmetros do Orçamento' }, [])

  const [dados, setDados] = useState<Parametros | null>(null)
  const [valores, setValores] = useState<Record<string, number | string>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [proibido, setProibido] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await parametrosApi.obter()
      setDados(r)
      setValores({ ...r.parametros })
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar parâmetros'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const alterados = useMemo(() => {
    if (!dados) return [] as string[]
    return dados.definicoes
      .filter((d) => {
        const v = valores[d.chave]
        const atual = dados.parametros[d.chave] ?? d.padrao
        return typeof v === 'number' && v !== atual
      })
      .map((d) => d.chave)
  }, [dados, valores])

  const invalidos = useMemo(() => {
    if (!dados) return [] as string[]
    return dados.definicoes
      .filter((d) => {
        const v = valores[d.chave]
        return typeof v !== 'number' || Number.isNaN(v) || v < d.min || v > d.max || (d.inteiro && !Number.isInteger(v))
      })
      .map((d) => d.chave)
  }, [dados, valores])

  async function salvar() {
    if (!dados) return
    if (invalidos.length > 0) {
      notifications.show({ title: 'Valores inválidos', message: 'Corrija os campos destacados antes de salvar.', color: 'red' })
      return
    }
    const payload: Record<string, number> = {}
    for (const d of dados.definicoes) payload[d.chave] = valores[d.chave] as number
    setSalvando(true)
    setProibido(false)
    try {
      const r = await parametrosApi.salvar(payload)
      setDados(r)
      setValores({ ...r.parametros })
      notifications.show({ title: 'Salvo', message: 'Parâmetros atualizados.', color: 'green' })
    } catch (err) {
      if (statusDe(err) === 403) {
        setProibido(true)
        notifications.show({
          title: 'Sem permissão',
          message: 'Somente administradores podem alterar os parâmetros do orçamento.',
          color: 'red',
        })
      } else {
        notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar parâmetros'), color: 'red' })
      }
    } finally {
      setSalvando(false)
    }
  }

  function restaurarPadroes() {
    if (!dados) return
    const v: Record<string, number> = {}
    for (const d of dados.definicoes) v[d.chave] = d.padrao
    setValores(v)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Parâmetros do Orçamento</Title>
          <Text size="sm" c="dimmed">
            Valores numéricos que a empresa pode ajustar dentro da faixa permitida de cada parâmetro.
          </Text>
        </div>
        <Group>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={restaurarPadroes} disabled={!dados || loading}>
            Restaurar padrões
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={salvar}
            loading={salvando}
            disabled={!dados || alterados.length === 0 || invalidos.length > 0}
          >
            Salvar
          </Button>
        </Group>
      </Group>

      {proibido && (
        <Alert color="red" variant="light" icon={<IconLock size={16} />} title="Acesso negado (403)">
          Somente administradores podem alterar os parâmetros do orçamento. Você pode apenas consultar os valores.
        </Alert>
      )}

      {erro && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro">
          <Group justify="space-between">
            <Text size="sm">{erro}</Text>
            <Button size="xs" variant="light" onClick={carregar}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : !dados || dados.definicoes.length === 0 ? (
        !erro && <Center py="xl"><Text c="dimmed">Nenhum parâmetro disponível.</Text></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Parâmetro</Table.Th>
                <Table.Th>Padrão</Table.Th>
                <Table.Th>Faixa</Table.Th>
                <Table.Th w={200}>Valor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dados.definicoes.map((d) => {
                const v = valores[d.chave]
                const invalido = invalidos.includes(d.chave)
                const mudou = alterados.includes(d.chave)
                return (
                  <Table.Tr key={d.chave}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm">{d.descricao}</Text>
                        {mudou && <Badge size="xs" variant="light" color="yellow">alterado</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{d.chave}</Text>
                    </Table.Td>
                    <Table.Td>{d.padrao}</Table.Td>
                    <Table.Td>{d.min} a {d.max}{d.inteiro ? ' (inteiro)' : ''}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={v}
                        min={d.min}
                        max={d.max}
                        allowDecimals={!d.inteiro}
                        decimalScale={d.inteiro ? 0 : 4}
                        decimalSeparator=","
                        error={invalido ? `Entre ${d.min} e ${d.max}` : undefined}
                        onChange={(val) => setValores((prev) => ({ ...prev, [d.chave]: val }))}
                        aria-label={d.descricao}
                      />
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  )
}
