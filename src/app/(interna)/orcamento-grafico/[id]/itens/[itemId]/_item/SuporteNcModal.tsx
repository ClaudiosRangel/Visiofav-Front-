'use client'

/**
 * SuporteNcModal — "Suporte Não Cadastrado" (botão NC, R12). Cadastra um suporte provisório
 * (`POST /orcamento-grafico/suportes-nao-cadastrados`) sem sair da tela do item/plano.
 *
 * Valida ao confirmar, mostra o erro no campo e preserva o que foi digitado em qualquer falha.
 * Duplicata: avisa com o nome/gramatura do existente e deixa "Usar o existente" (reenvia com
 * `confirmarExistente`) ou "Cancelar" (fecha sem chamar a API).
 */

import { useEffect, useState } from 'react'
import { Alert, Button, Group, Modal, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import SeletorSuportePlano from '../_plano/SeletorSuportePlano'
import {
  MAX_FIBRA_NC,
  MAX_NOME_NC,
  MENSAGEM_NAO_CRIADO,
  erroDoServidor,
  estadoSuporteNcVazio,
  interpretarRespostaSuporteNc,
  montarBodySuporteNc,
  validarSuporteNc,
  type CampoSuporteNc,
  type ErrosSuporteNc,
  type EstadoSuporteNc,
  type SuporteNcDuplicado,
} from './suporte-nc'

export const URL_SUPORTE_NC = '/orcamento-grafico/suportes-nao-cadastrados'
export const MENSAGEM_PROVISORIO = 'Suporte cadastrado como provisório. O comprador deve regularizar o preço.'

export interface SuporteNcCriadoInfo {
  suporteId: string
  precoId: string
  nome: string
  gramatura: number
  custoKg: number
}

export interface SuporteNcModalProps {
  opened: boolean
  onClose: () => void
  onCriado: (r: SuporteNcCriadoInfo) => void
}

export default function SuporteNcModal({ opened, onClose, onCriado }: SuporteNcModalProps) {
  const [estado, setEstado] = useState<EstadoSuporteNc>(estadoSuporteNcVazio)
  const [nomeReferencia, setNomeReferencia] = useState<string | null>(null)
  const [erros, setErros] = useState<ErrosSuporteNc>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState<SuporteNcDuplicado | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!opened) return
    setEstado(estadoSuporteNcVazio())
    setNomeReferencia(null)
    setErros({})
    setMensagem(null)
    setDuplicado(null)
    setEnviando(false)
  }, [opened])

  function alterar<K extends CampoSuporteNc>(campo: K, valor: EstadoSuporteNc[K]) {
    setEstado((e) => ({ ...e, [campo]: valor }))
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e))
    setDuplicado(null)
  }

  async function enviar(confirmarExistente: boolean) {
    if (!confirmarExistente) {
      const encontrados = validarSuporteNc(estado)
      setErros(encontrados)
      setMensagem(null)
      if (Object.keys(encontrados).length > 0) return
      setDuplicado(null)
    } else {
      setMensagem(null)
    }

    setEnviando(true)
    try {
      const { data } = await api.post(URL_SUPORTE_NC, montarBodySuporteNc(estado, confirmarExistente))
      const r = interpretarRespostaSuporteNc(data, estado)
      if (r.tipo === 'CRIADO') {
        notifications.show({
          message: r.provisorio ? MENSAGEM_PROVISORIO : 'Suporte cadastrado.',
          color: 'green',
        })
        onCriado({ ...r.criado })
        onClose()
      } else if (r.tipo === 'DUPLICADO') {
        setDuplicado(r.duplicado)
      } else {
        setMensagem(`${MENSAGEM_NAO_CRIADO} Resposta inesperada do servidor.`)
      }
    } catch (err) {
      const e = erroDoServidor(err)
      if (e.campoErro) setErros({ [e.campoErro.campo]: e.campoErro.motivo })
      else setMensagem(e.mensagem)
    } finally {
      setEnviando(false)
    }
  }

  const campoTexto = (campo: CampoSuporteNc, label: string, extra: { required?: boolean; maxLength?: number; decimal?: boolean; sufixo?: string } = {}) => (
    <TextInput
      label={label}
      value={String(estado[campo])}
      onChange={(ev) => alterar(campo, ev.currentTarget.value as EstadoSuporteNc[typeof campo])}
      error={erros[campo]}
      required={extra.required}
      maxLength={extra.maxLength}
      inputMode={extra.decimal ? 'decimal' : undefined}
      rightSection={extra.sufixo ? <Text size="xs" c="dimmed">{extra.sufixo}</Text> : undefined}
      rightSectionWidth={extra.sufixo ? 56 : undefined}
      disabled={enviando}
    />
  )

  return (
    <Modal opened={opened} onClose={onClose} title="Suporte não cadastrado" size="lg" closeOnClickOutside={!enviando}>
      <Stack gap="sm">
        {mensagem && (
          <Alert color="red" variant="light" title={MENSAGEM_NAO_CRIADO}>
            {mensagem.startsWith(MENSAGEM_NAO_CRIADO) ? mensagem.slice(MENSAGEM_NAO_CRIADO.length).trim() || 'Tente novamente.' : mensagem}
          </Alert>
        )}

        {duplicado && (
          <Alert color="yellow" variant="light" title="Suporte já cadastrado">
            <Stack gap="xs">
              <Text size="sm">
                Já existe o suporte <b>{duplicado.nome}</b> com gramatura{' '}
                <b>{duplicado.gramatura.toLocaleString('pt-BR')} g/m²</b>. Nada foi criado.
              </Text>
              <Group gap="xs">
                <Button size="xs" onClick={() => enviar(true)} loading={enviando}>
                  Usar o existente
                </Button>
                <Button size="xs" variant="default" onClick={onClose} disabled={enviando}>
                  Cancelar
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {campoTexto('nome', 'Nome', { required: true, maxLength: MAX_NOME_NC })}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {campoTexto('gramatura', 'Gramatura', { required: true, decimal: true, sufixo: 'g/m²' })}
          {campoTexto('fibra', 'Fibra', { maxLength: MAX_FIBRA_NC })}
          {campoTexto('espessuraGm', 'Espessura G/', { decimal: true })}
          {campoTexto('espessuraMicras', 'Espessura (micras)', { decimal: true })}
        </SimpleGrid>

        <div>
          <Text size="sm" fw={500} mb={4}>
            Formato (Largura x Altura)
          </Text>
          <Group grow align="flex-start" gap="xs" wrap="nowrap">
            <TextInput
              aria-label="Largura (mm)"
              placeholder="Largura (mm)"
              value={estado.formatoLarguraMm}
              onChange={(ev) => alterar('formatoLarguraMm', ev.currentTarget.value)}
              error={erros.formatoLarguraMm}
              inputMode="decimal"
              disabled={enviando}
            />
            <TextInput
              aria-label="Altura (mm)"
              placeholder="Altura (mm)"
              value={estado.formatoAlturaMm}
              onChange={(ev) => alterar('formatoAlturaMm', ev.currentTarget.value)}
              error={erros.formatoAlturaMm}
              inputMode="decimal"
              disabled={enviando}
            />
          </Group>
        </div>

        <Switch
          label="Tira/Retira"
          checked={estado.tiraRetira}
          onChange={(ev) => alterar('tiraRetira', ev.currentTarget.checked)}
          disabled={enviando}
        />

        <SeletorSuportePlano
          label="Consumo de Tinta"
          value={estado.tipoSuporteConsumoTintaId || null}
          nomeAtual={nomeReferencia}
          onChange={(id, nome) => {
            setNomeReferencia(nome)
            alterar('tipoSuporteConsumoTintaId', id ?? '')
          }}
          error={erros.tipoSuporteConsumoTintaId}
          disabled={enviando}
        />
        {estado.tipoSuporteConsumoTintaId && nomeReferencia && (
          <Text size="xs" c="dimmed">
            Suporte de referência: {nomeReferencia}
          </Text>
        )}

        <div>
          <Text size="sm" fw={500} mb={4}>
            Unidades
          </Text>
          <Group gap="lg">
            <Switch
              label="Custo por kg"
              checked={estado.unidadeCustoKg}
              onChange={(ev) => alterar('unidadeCustoKg', ev.currentTarget.checked)}
              disabled={enviando}
            />
            <Switch
              label="Cálculo por folha"
              checked={estado.unidadeCalculoFl}
              onChange={(ev) => alterar('unidadeCalculoFl', ev.currentTarget.checked)}
              disabled={enviando}
            />
          </Group>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {campoTexto('custoKg', 'Custo por Kg', { required: true, decimal: true, sufixo: 'R$/kg' })}
          {campoTexto('freteKg', 'Frete por Kg', { decimal: true, sufixo: 'R$/kg' })}
          {campoTexto('pacotesCom', 'Pacotes com', { decimal: true })}
          {campoTexto('creditoIcmsPerc', 'Crédito ICMS %', { decimal: true, sufixo: '%' })}
          {campoTexto('creditoIpiPerc', 'Crédito IPI %', { decimal: true, sufixo: '%' })}
        </SimpleGrid>

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => enviar(false)} loading={enviando}>
            Confirmar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
