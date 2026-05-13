'use client'

import { useMemo } from 'react'
import { Modal, TextInput, Button, Group, Select, Text, NumberInput } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useGerarEnderecos } from '@/data/hooks/useEndereco'
import { useDepositos } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import { estruturasCrud, zonasCrud } from '@/data/hooks/useCrudGenerico'
import { useResolverFormato, useGerarComFormato } from '@/data/hooks/useFormatoEndereco'
import type { SegmentoFormato, FaixaSegmento } from '@/data/hooks/useFormatoEndereco'

// Schema base — campos de faixa são opcionais para suportar formatos dinâmicos
const schema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  depositoId: z.string().min(1, 'Depósito é obrigatório'),
  zonaId: z.string().optional(),
  estruturaId: z.string().optional(),
  codigoDeposito: z.string().min(1),
  codigoZona: z.string().min(1),
  ruaInicio: z.number().min(1).optional(),
  ruaFim: z.number().min(1).optional(),
  predioInicio: z.number().min(1).optional(),
  predioFim: z.number().min(1).optional(),
  nivelInicio: z.number().min(1).optional(),
  nivelFim: z.number().min(1).optional(),
  aptoInicio: z.number().min(1).optional(),
  aptoFim: z.number().min(1).optional(),
  tipo: z.string().min(1),
  nivelPicking: z.number().min(0).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void }

/** Mapeia campoFisico do backend para chave interna de visibilidade */
function mapCampoFisico(campoFisico: string): 'rua' | 'predio' | 'nivel' | 'apto' | null {
  switch (campoFisico) {
    case 'codigoRua': return 'rua'
    case 'codigoPredio': return 'predio'
    case 'codigoNivel': return 'nivel'
    case 'codigoApto': return 'apto'
    default: return null // codigoDeposito, codigoZona — não precisam de faixa
  }
}

export default function EnderecoAutoModal({ opened, onClose }: Props) {
  const gerar = useGerarEnderecos()
  const gerarComFormato = useGerarComFormato()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })
  const { data: estruturasResp } = estruturasCrud.useListar({ limit: 100 })
  const { data: zonasResp } = zonasCrud.useListar({ limit: 100 })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '—' }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || '—' }))
  const estruturaOptions = (estruturasResp?.data || []).map((e: any) => ({ value: e.id, label: e.descricao || '—' }))

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigoDeposito: '001', codigoZona: '001',
      ruaInicio: 1, ruaFim: 1, predioInicio: 1, predioFim: 1,
      nivelInicio: 1, nivelFim: 1, aptoInicio: 1, aptoFim: 1,
      tipo: 'ARMAZENAGEM', nivelPicking: 1,
    },
  })

  const v = watch()
  const depositoId = v.depositoId
  const zonaId = v.zonaId

  // Filtrar zonas pelo depósito selecionado
  const zonaOptions = useMemo(() => {
    const todas = (zonasResp?.data || []) as any[]
    if (!depositoId) return todas.map((z: any) => ({ value: z.id, label: z.descricao || '—' }))
    return todas
      .filter((z: any) => !z.depositoId || z.depositoId === depositoId)
      .map((z: any) => ({ value: z.id, label: z.descricao || '—' }))
  }, [zonasResp, depositoId])

  // Resolve formato de endereço baseado no depósito e zona selecionados
  const { data: formatoResolvido, isError: formatoError } = useResolverFormato(depositoId || null, zonaId || null)

  // Determinar se estamos usando formato dinâmico (v2) ou legado
  const usarFormatoDinamico = useMemo(() => {
    if (!formatoResolvido || formatoError) return false
    const segmentos: SegmentoFormato[] = (formatoResolvido as any).segmentos || []
    if (segmentos.length === 0) return false
    // Se tem exatamente os 6 segmentos padrão (rua, predio, nivel, apto, deposito, zona), usar legado
    const camposFaixa = segmentos.filter(s => s.ativo !== false).map(s => s.campoFisico)
    const temRua = camposFaixa.includes('codigoRua')
    const temPredio = camposFaixa.includes('codigoPredio')
    const temNivel = camposFaixa.includes('codigoNivel')
    const temApto = camposFaixa.includes('codigoApto')
    // Se tem todos os 4 campos de faixa, usar legado (mais simples)
    if (temRua && temPredio && temNivel && temApto) return false
    // Formato com menos segmentos → usar v2
    return true
  }, [formatoResolvido, formatoError])

  // Determinar quais campos de faixa estão visíveis baseado no formato resolvido
  const camposVisiveis = useMemo(() => {
    if (!formatoResolvido || formatoError) {
      return { rua: true, predio: true, nivel: true, apto: true }
    }
    const segmentos: SegmentoFormato[] = (formatoResolvido as any).segmentos || []
    if (segmentos.length === 0) {
      return { rua: true, predio: true, nivel: true, apto: true }
    }
    const mapa = { rua: false, predio: false, nivel: false, apto: false }
    for (const seg of segmentos) {
      if (seg.ativo === false) continue
      const campo = mapCampoFisico(seg.campoFisico)
      if (campo) mapa[campo] = true
    }
    // Se nenhum campo de faixa foi mapeado, fallback para todos
    if (!mapa.rua && !mapa.predio && !mapa.nivel && !mapa.apto) {
      return { rua: true, predio: true, nivel: true, apto: true }
    }
    return mapa
  }, [formatoResolvido, formatoError])

  // Calcular total apenas com segmentos ativos
  const total = useMemo(() => {
    let result = 1
    if (camposVisiveis.rua) result *= Math.max(0, (v.ruaFim || 0) - (v.ruaInicio || 0) + 1)
    if (camposVisiveis.predio) result *= Math.max(0, (v.predioFim || 0) - (v.predioInicio || 0) + 1)
    if (camposVisiveis.nivel) result *= Math.max(0, (v.nivelFim || 0) - (v.nivelInicio || 0) + 1)
    if (camposVisiveis.apto) result *= Math.max(0, (v.aptoFim || 0) - (v.aptoInicio || 0) + 1)
    return result
  }, [v.ruaInicio, v.ruaFim, v.predioInicio, v.predioFim, v.nivelInicio, v.nivelFim, v.aptoInicio, v.aptoFim, camposVisiveis])

  async function onSubmit(data: FormValues) {
    try {
      if (usarFormatoDinamico && formatoResolvido) {
        // Montar faixas dinâmicas baseado nos segmentos do formato
        const segmentos: SegmentoFormato[] = (formatoResolvido as any).segmentos || []
        const faixas: FaixaSegmento[] = []

        for (const seg of segmentos) {
          if (seg.ativo === false) continue
          const campo = seg.campoFisico
          switch (campo) {
            case 'codigoRua':
              faixas.push({ campoFisico: campo, inicio: data.ruaInicio || 1, fim: data.ruaFim || 1 })
              break
            case 'codigoPredio':
              faixas.push({ campoFisico: campo, inicio: data.predioInicio || 1, fim: data.predioFim || 1 })
              break
            case 'codigoNivel':
              faixas.push({ campoFisico: campo, inicio: data.nivelInicio || 1, fim: data.nivelFim || 1 })
              break
            case 'codigoApto':
              faixas.push({ campoFisico: campo, inicio: data.aptoInicio || 1, fim: data.aptoFim || 1 })
              break
            case 'codigoDeposito': {
              const val = parseInt(data.codigoDeposito, 10) || 1
              faixas.push({ campoFisico: campo, inicio: val, fim: val })
              break
            }
            case 'codigoZona': {
              const val = parseInt(data.codigoZona, 10) || 1
              faixas.push({ campoFisico: campo, inicio: val, fim: val })
              break
            }
          }
        }

        const result: any = await gerarComFormato.mutateAsync({
          formatoEnderecoId: formatoResolvido.id,
          depositoId: data.depositoId,
          centroDistribuicaoId: data.centroDistribuicaoId,
          estruturaId: data.estruturaId,
          codigoDeposito: data.codigoDeposito,
          codigoZona: data.codigoZona,
          tipo: data.tipo,
          nivelPicking: data.nivelPicking,
          faixas,
          ...(data.zonaId ? { zonaId: data.zonaId } : {}),
        })
        notifications.show({ title: 'Sucesso', message: `${result.criados} endereços criados`, color: 'green' })
      } else {
        // Endpoint legado — enviar todos os campos de faixa
        const result: any = await gerar.mutateAsync({
          ...data,
          ruaInicio: data.ruaInicio || 1,
          ruaFim: data.ruaFim || 1,
          predioInicio: data.predioInicio || 1,
          predioFim: data.predioFim || 1,
          nivelInicio: data.nivelInicio || 1,
          nivelFim: data.nivelFim || 1,
          aptoInicio: data.aptoInicio || 1,
          aptoFim: data.aptoFim || 1,
          ...(data.zonaId ? { zonaId: data.zonaId } : {}),
        })
        notifications.show({ title: 'Sucesso', message: `${result.criados} endereços criados`, color: 'green' })
      }
      onClose()
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao gerar endereços', color: 'red' })
    }
  }

  const isLoading = gerar.isPending || gerarComFormato.isPending

  return (
    <Modal opened={opened} onClose={onClose} title="Gerar Endereços Automáticos" size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} className="w-6/12" searchable {...field} />)} />
            <Controller name="depositoId" control={control} render={({ field }) => (<Select label={<>Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions} error={errors.depositoId?.message} className="w-6/12" searchable {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="zonaId" control={control} render={({ field }) => (<Select label="Zona" data={zonaOptions} className="w-6/12" searchable clearable placeholder="Selecione uma zona (opcional)" {...field} value={field.value || null} />)} />
            <Controller name="estruturaId" control={control} render={({ field }) => (<Select label="Estrutura" data={estruturaOptions} className="w-6/12" searchable clearable placeholder="Selecione uma estrutura (opcional)" {...field} value={field.value || null} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="codigoDeposito" control={control} render={({ field }) => (<TextInput label="Cód. Depósito" className="w-3/12" {...field} />)} />
            <Controller name="codigoZona" control={control} render={({ field }) => (<TextInput label="Cód. Zona" className="w-3/12" {...field} />)} />
            <Controller name="tipo" control={control} render={({ field }) => (<Select label="Tipo" data={[{ value: 'ARMAZENAGEM', label: 'Armazenagem' }, { value: 'PICKING', label: 'Picking' }]} className="w-3/12" {...field} />)} />
            <Controller name="nivelPicking" control={control} render={({ field }) => (
              <NumberInput
                label="Nível Picking (até)"
                description="Níveis ≤ este valor = Picking"
                className="w-3/12"
                min={0}
                max={v.nivelFim || 99}
                disabled={v.tipo === 'PICKING'}
                {...field}
              />
            )} />
          </div>

          <Text size="sm" fw={600}>
            Faixas de Endereço
            {usarFormatoDinamico && formatoResolvido && (
              <Text span size="xs" c="dimmed" ml="xs">
                (formato: {formatoResolvido.nome})
              </Text>
            )}
          </Text>

          {camposVisiveis.rua && (
            <div className="flex gap-4 w-full">
              <Controller name="ruaInicio" control={control} render={({ field }) => (<NumberInput label="Rua Início" className="w-3/12" min={1} {...field} />)} />
              <Controller name="ruaFim" control={control} render={({ field }) => (<NumberInput label="Rua Fim" className="w-3/12" min={1} {...field} />)} />
              {camposVisiveis.predio && (
                <>
                  <Controller name="predioInicio" control={control} render={({ field }) => (<NumberInput label="Prédio Início" className="w-3/12" min={1} {...field} />)} />
                  <Controller name="predioFim" control={control} render={({ field }) => (<NumberInput label="Prédio Fim" className="w-3/12" min={1} {...field} />)} />
                </>
              )}
            </div>
          )}
          {!camposVisiveis.rua && camposVisiveis.predio && (
            <div className="flex gap-4 w-full">
              <Controller name="predioInicio" control={control} render={({ field }) => (<NumberInput label="Prédio Início" className="w-3/12" min={1} {...field} />)} />
              <Controller name="predioFim" control={control} render={({ field }) => (<NumberInput label="Prédio Fim" className="w-3/12" min={1} {...field} />)} />
            </div>
          )}
          {(camposVisiveis.nivel || camposVisiveis.apto) && (
            <div className="flex gap-4 w-full">
              {camposVisiveis.nivel && (
                <>
                  <Controller name="nivelInicio" control={control} render={({ field }) => (<NumberInput label="Nível Início" className="w-3/12" min={1} {...field} />)} />
                  <Controller name="nivelFim" control={control} render={({ field }) => (<NumberInput label="Nível Fim" className="w-3/12" min={1} {...field} />)} />
                </>
              )}
              {camposVisiveis.apto && (
                <>
                  <Controller name="aptoInicio" control={control} render={({ field }) => (<NumberInput label="Apto Início" className="w-3/12" min={1} {...field} />)} />
                  <Controller name="aptoFim" control={control} render={({ field }) => (<NumberInput label="Apto Fim" className="w-3/12" min={1} {...field} />)} />
                </>
              )}
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-md">
            <Text size="sm" fw={600}>Total de endereços a gerar: <Text span c="primary" fw={700}>{total}</Text></Text>
          </div>
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isLoading}>Gerar Endereços</Button>
        </Group>
      </form>
    </Modal>
  )
}
