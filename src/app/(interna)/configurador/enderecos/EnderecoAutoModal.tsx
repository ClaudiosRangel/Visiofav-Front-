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
import { estruturasCrud } from '@/data/hooks/useCrudGenerico'
import { useResolverFormato, useGerarComFormato } from '@/data/hooks/useFormatoEndereco'

const schema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  depositoId: z.string().min(1, 'Depósito é obrigatório'),
  estruturaId: z.string().optional(),
  codigoDeposito: z.string().min(1), codigoZona: z.string().min(1),
  ruaInicio: z.number().min(1), ruaFim: z.number().min(1),
  predioInicio: z.number().min(1), predioFim: z.number().min(1),
  nivelInicio: z.number().min(1), nivelFim: z.number().min(1),
  aptoInicio: z.number().min(1), aptoFim: z.number().min(1),
  tipo: z.string().min(1),
  nivelPicking: z.number().min(0).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void }

export default function EnderecoAutoModal({ opened, onClose }: Props) {
  const gerar = useGerarEnderecos()
  const gerarComFormato = useGerarComFormato()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })
  const { data: estruturasResp } = estruturasCrud.useListar({ limit: 100 })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '—' }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || '—' }))
  const estruturaOptions = (estruturasResp?.data || []).map((e: any) => ({ value: e.id, label: e.descricao || '—' }))

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigoDeposito: '001', codigoZona: '001', ruaInicio: 1, ruaFim: 1, predioInicio: 1, predioFim: 1, nivelInicio: 1, nivelFim: 1, aptoInicio: 1, aptoFim: 1, tipo: 'ARMAZENAGEM', nivelPicking: 1 },
  })

  const v = watch()
  const depositoId = v.depositoId

  // Resolve formato de endereço baseado no depósito selecionado
  const { data: formatoResolvido, isError: formatoError } = useResolverFormato(depositoId || null)

  // Determinar quais campos de faixa estão visíveis baseado no formato resolvido
  const camposVisiveis = useMemo(() => {
    if (!formatoResolvido || formatoError) {
      // Fallback: exibir todos os campos (comportamento legado)
      return { rua: true, predio: true, nivel: true, apto: true }
    }
    const mapa = { rua: false, predio: false, nivel: false, apto: false }
    // Backend retorna 'segmentos' com 'campoFisico'
    const segmentos = (formatoResolvido as any).segmentos || formatoResolvido.componentes || []
    for (const seg of segmentos) {
      const campo = seg.campoFisico || ''
      if (campo === 'codigoRua') mapa.rua = true
      else if (campo === 'codigoPredio') mapa.predio = true
      else if (campo === 'codigoNivel') mapa.nivel = true
      else if (campo === 'codigoApto') mapa.apto = true
    }
    // Se nenhum campo foi mapeado (formato vazio ou incompatível), fallback para todos
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
      let result: any

      if (formatoResolvido && !formatoError && formatoResolvido.id !== 'padrao') {
        // Usar geração com formato: montar payload com faixas
        const faixas: { campoFisico: string; inicio: number; fim: number }[] = []
        if (camposVisiveis.rua) faixas.push({ campoFisico: 'codigoRua', inicio: data.ruaInicio, fim: data.ruaFim })
        if (camposVisiveis.predio) faixas.push({ campoFisico: 'codigoPredio', inicio: data.predioInicio, fim: data.predioFim })
        if (camposVisiveis.nivel) faixas.push({ campoFisico: 'codigoNivel', inicio: data.nivelInicio, fim: data.nivelFim })
        if (camposVisiveis.apto) faixas.push({ campoFisico: 'codigoApto', inicio: data.aptoInicio, fim: data.aptoFim })

        result = await gerarComFormato.mutateAsync({
          formatoEnderecoId: formatoResolvido.id,
          depositoId: data.depositoId,
          centroDistribuicaoId: data.centroDistribuicaoId,
          estruturaId: data.estruturaId,
          codigoDeposito: data.codigoDeposito,
          codigoZona: data.codigoZona,
          tipo: data.tipo,
          nivelPicking: data.nivelPicking,
          ...(camposVisiveis.rua && { ruaInicio: data.ruaInicio, ruaFim: data.ruaFim }),
          ...(camposVisiveis.predio && { predioInicio: data.predioInicio, predioFim: data.predioFim }),
          ...(camposVisiveis.nivel && { nivelInicio: data.nivelInicio, nivelFim: data.nivelFim }),
          ...(camposVisiveis.apto && { aptoInicio: data.aptoInicio, aptoFim: data.aptoFim }),
          faixas,
        } as any)
      } else {
        // Fallback: usar geração legada sem formato
        result = await gerar.mutateAsync(data)
      }

      notifications.show({ title: 'Sucesso', message: `${result.criados} endereços criados`, color: 'green' })
      onClose()
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao gerar', color: 'red' }) }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Gerar Endereços Automáticos" size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} className="w-6/12" searchable {...field} />)} />
            <Controller name="depositoId" control={control} render={({ field }) => (<Select label={<>Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions} error={errors.depositoId?.message} className="w-6/12" searchable {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="estruturaId" control={control} render={({ field }) => (<Select label="Estrutura" data={estruturaOptions} className="w-full" searchable clearable placeholder="Selecione uma estrutura (opcional)" {...field} value={field.value || null} />)} />
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
          <Text size="sm" fw={600}>Faixas de Endereço</Text>
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
          <Button type="submit" loading={gerar.isPending || gerarComFormato.isPending}>Gerar Endereços</Button>
        </Group>
      </form>
    </Modal>
  )
}
