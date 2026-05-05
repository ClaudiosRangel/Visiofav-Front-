'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, Select, NumberInput, Radio, LoadingOverlay } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useGerarEnderecos } from '@/data/hooks/useEndereco'
import { useDepositos } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import { zonasCrud, estruturasCrud, classificacoesProdutoCrud, ambientesArmazenagemCrud } from '@/data/hooks/useCrudGenerico'

const schema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  depositoId: z.string().min(1, 'Depósito é obrigatório'),
  codigoDeposito: z.string().min(1, 'Código do depósito é obrigatório'),
  codigoZona: z.string().min(1, 'Código da zona é obrigatório'),
  zonaId: z.string().min(1, 'Zona é obrigatória'),
  estruturaId: z.string().min(1, 'Estrutura é obrigatória'),
  classificacaoProdutoId: z.string().optional(),
  ambienteArmazenagemId: z.string().optional(),
  areaArmazenagem: z.enum(['PULMAO', 'PICKING'], { required_error: 'Área é obrigatória' }),
  situacao: z.string().min(1, 'Situação é obrigatória'),
  lado: z.enum(['PAR', 'IMPAR', 'AMBOS'], { required_error: 'Lado é obrigatório' }),
  ruaInicio: z.number().min(1, 'Mínimo 1'),
  ruaFim: z.number().min(1, 'Mínimo 1'),
  predioInicio: z.number().min(1, 'Mínimo 1'),
  predioFim: z.number().min(1, 'Mínimo 1'),
  nivelInicio: z.number().min(1, 'Mínimo 1'),
  nivelFim: z.number().min(1, 'Mínimo 1'),
  aptoInicio: z.number().min(1, 'Mínimo 1'),
  aptoFim: z.number().min(1, 'Mínimo 1'),
}).refine((d) => d.ruaInicio <= d.ruaFim, { message: 'Rua início deve ser ≤ fim', path: ['ruaFim'] })
  .refine((d) => d.predioInicio <= d.predioFim, { message: 'Prédio início deve ser ≤ fim', path: ['predioFim'] })
  .refine((d) => d.nivelInicio <= d.nivelFim, { message: 'Nível início deve ser ≤ fim', path: ['nivelFim'] })
  .refine((d) => d.aptoInicio <= d.aptoFim, { message: 'Apto início deve ser ≤ fim', path: ['aptoFim'] })

type FormValues = z.infer<typeof schema>

export default function GerarEnderecosPage() {
  const [resultado, setResultado] = useState<{ criados: number; ignorados: number; total: number } | null>(null)

  const gerar = useGerarEnderecos()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })
  const { data: zonasResp } = zonasCrud.useListar({ limit: 100 })
  const { data: estruturasResp } = estruturasCrud.useListar({ limit: 100 })
  const { data: classificacoesResp } = classificacoesProdutoCrud.useListar({ limit: 100 })
  const { data: ambientesResp } = ambientesArmazenagemCrud.useListar({ limit: 100 })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.descricao || c.nome || c.codigo }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao }))
  const zonaOptions = (zonasResp?.data || []).map((z: any) => ({ value: z.id, label: z.descricao }))
  const estruturaOptions = (estruturasResp?.data || []).map((e: any) => ({ value: e.id, label: e.descricao }))
  const classificacaoOptions = (classificacoesResp?.data || []).map((c: any) => ({ value: c.id, label: c.descricao }))
  const ambienteOptions = (ambientesResp?.data || []).map((a: any) => ({ value: a.id, label: a.descricao }))

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigoDeposito: '001',
      codigoZona: '001',
      areaArmazenagem: 'PULMAO',
      situacao: 'ARMAZENAGEM',
      lado: 'AMBOS',
      ruaInicio: 1, ruaFim: 1,
      predioInicio: 1, predioFim: 1,
      nivelInicio: 1, nivelFim: 1,
      aptoInicio: 1, aptoFim: 1,
    },
  })

  const v = watch()
  const total = Math.max(0, (v.ruaFim || 0) - (v.ruaInicio || 0) + 1)
    * Math.max(0, (v.predioFim || 0) - (v.predioInicio || 0) + 1)
    * Math.max(0, (v.nivelFim || 0) - (v.nivelInicio || 0) + 1)
    * Math.max(0, (v.aptoFim || 0) - (v.aptoInicio || 0) + 1)

  async function onSubmit(data: FormValues) {
    try {
      setResultado(null)
      const result: any = await gerar.mutateAsync(data)
      setResultado({ criados: result.criados, ignorados: result.ignorados, total: result.total })
      notifications.show({
        title: 'Geração concluída',
        message: `${result.criados} criados, ${result.ignorados} ignorados (total: ${result.total})`,
        color: 'green',
      })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao gerar endereços'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Endereços / Gerar</Text>
      <Text size="xl" fw={600} mb="lg">Gerar Endereços</Text>
      <Card pos="relative" maw={900}>
        <LoadingOverlay visible={gerar.isPending} />
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Text size="sm" fw={600}>Localização</Text>
            <div className="flex gap-4 w-full">
              <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (
                <Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} className="w-6/12" searchable {...field} />
              )} />
              <Controller name="depositoId" control={control} render={({ field }) => (
                <Select label={<>Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions} error={errors.depositoId?.message} className="w-6/12" searchable {...field} />
              )} />
            </div>
            <div className="flex gap-4 w-full">
              <Controller name="codigoDeposito" control={control} render={({ field }) => (
                <Select label={<>Cód. Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions.map((d: any) => ({ value: d.label, label: d.label }))} error={errors.codigoDeposito?.message} className="w-3/12" searchable allowDeselect={false} {...field} />
              )} />
              <Controller name="codigoZona" control={control} render={({ field }) => (
                <Select label={<>Cód. Zona <span style={{ color: 'red' }}>*</span></>} data={zonaOptions.map((z: any) => ({ value: z.label, label: z.label }))} error={errors.codigoZona?.message} className="w-3/12" searchable allowDeselect={false} {...field} />
              )} />
              <Controller name="zonaId" control={control} render={({ field }) => (
                <Select label={<>Zona <span style={{ color: 'red' }}>*</span></>} data={zonaOptions} error={errors.zonaId?.message} className="w-3/12" searchable {...field} />
              )} />
              <Controller name="estruturaId" control={control} render={({ field }) => (
                <Select label={<>Estrutura <span style={{ color: 'red' }}>*</span></>} data={estruturaOptions} error={errors.estruturaId?.message} className="w-3/12" searchable {...field} />
              )} />
            </div>

            <Text size="sm" fw={600} mt="sm">Classificação</Text>
            <div className="flex gap-4 w-full">
              <Controller name="classificacaoProdutoId" control={control} render={({ field }) => (
                <Select label="Classificação de Produto" data={classificacaoOptions} className="w-6/12" searchable clearable {...field} value={field.value || null} />
              )} />
              <Controller name="ambienteArmazenagemId" control={control} render={({ field }) => (
                <Select label="Ambiente de Armazenagem" data={ambienteOptions} className="w-6/12" searchable clearable {...field} value={field.value || null} />
              )} />
            </div>
            <div className="flex gap-4 w-full items-end">
              <Controller name="areaArmazenagem" control={control} render={({ field }) => (
                <Radio.Group label={<>Área de Armazenagem <span style={{ color: 'red' }}>*</span></>} error={errors.areaArmazenagem?.message} {...field} className="w-4/12">
                  <Group mt="xs">
                    <Radio value="PULMAO" label="Pulmão" />
                    <Radio value="PICKING" label="Picking" />
                  </Group>
                </Radio.Group>
              )} />
              <Controller name="situacao" control={control} render={({ field }) => (
                <Select label={<>Situação <span style={{ color: 'red' }}>*</span></>} data={[
                  { value: 'ARMAZENAGEM', label: 'Armazenagem' },
                  { value: 'PICKING', label: 'Picking' },
                  { value: 'DOCA', label: 'Doca' },
                ]} error={errors.situacao?.message} className="w-4/12" {...field} />
              )} />
              <Controller name="lado" control={control} render={({ field }) => (
                <Radio.Group label={<>Lado <span style={{ color: 'red' }}>*</span></>} error={errors.lado?.message} {...field} className="w-4/12">
                  <Group mt="xs">
                    <Radio value="PAR" label="Par" />
                    <Radio value="IMPAR" label="Ímpar" />
                    <Radio value="AMBOS" label="Ambos" />
                  </Group>
                </Radio.Group>
              )} />
            </div>

            <Text size="sm" fw={600} mt="sm">Faixas de Endereço</Text>
            <div className="flex gap-4 w-full">
              <Controller name="ruaInicio" control={control} render={({ field }) => (
                <NumberInput label="Rua Início" className="w-3/12" min={1} error={errors.ruaInicio?.message} {...field} />
              )} />
              <Controller name="ruaFim" control={control} render={({ field }) => (
                <NumberInput label="Rua Fim" className="w-3/12" min={1} error={errors.ruaFim?.message} {...field} />
              )} />
              <Controller name="predioInicio" control={control} render={({ field }) => (
                <NumberInput label="Prédio Início" className="w-3/12" min={1} error={errors.predioInicio?.message} {...field} />
              )} />
              <Controller name="predioFim" control={control} render={({ field }) => (
                <NumberInput label="Prédio Fim" className="w-3/12" min={1} error={errors.predioFim?.message} {...field} />
              )} />
            </div>
            <div className="flex gap-4 w-full">
              <Controller name="nivelInicio" control={control} render={({ field }) => (
                <NumberInput label="Nível Início" className="w-3/12" min={1} error={errors.nivelInicio?.message} {...field} />
              )} />
              <Controller name="nivelFim" control={control} render={({ field }) => (
                <NumberInput label="Nível Fim" className="w-3/12" min={1} error={errors.nivelFim?.message} {...field} />
              )} />
              <Controller name="aptoInicio" control={control} render={({ field }) => (
                <NumberInput label="Apto Início" className="w-3/12" min={1} error={errors.aptoInicio?.message} {...field} />
              )} />
              <Controller name="aptoFim" control={control} render={({ field }) => (
                <NumberInput label="Apto Fim" className="w-3/12" min={1} error={errors.aptoFim?.message} {...field} />
              )} />
            </div>

            <div className="bg-gray-50 border border-gray-200 p-3 rounded-md">
              <Text size="sm" fw={600}>Total estimado: <Text span c="blue" fw={700}>{total}</Text> endereços</Text>
            </div>

            {resultado && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                <Text size="sm" fw={600} c="green">Resultado da Geração</Text>
                <Group mt="xs" gap="xl">
                  <Text size="sm">Criados: <Text span fw={700}>{resultado.criados}</Text></Text>
                  <Text size="sm">Ignorados (duplicados): <Text span fw={700}>{resultado.ignorados}</Text></Text>
                  <Text size="sm">Total: <Text span fw={700}>{resultado.total}</Text></Text>
                </Group>
              </div>
            )}
          </div>

          <Group justify="flex-end" mt="lg">
            <Button type="submit" loading={gerar.isPending} size="md">
              Gerar Endereços
            </Button>
          </Group>
        </form>
      </Card>
    </div>
  )
}
