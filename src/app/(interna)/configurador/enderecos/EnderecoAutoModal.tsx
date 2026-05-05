'use client'

import { Modal, TextInput, Button, Group, Select, Text, NumberInput } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useGerarEnderecos } from '@/data/hooks/useEndereco'
import { useDepositos } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'

const schema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  depositoId: z.string().min(1, 'Depósito é obrigatório'),
  codigoDeposito: z.string().min(1), codigoZona: z.string().min(1),
  ruaInicio: z.number().min(1), ruaFim: z.number().min(1),
  predioInicio: z.number().min(1), predioFim: z.number().min(1),
  nivelInicio: z.number().min(1), nivelFim: z.number().min(1),
  aptoInicio: z.number().min(1), aptoFim: z.number().min(1),
  tipo: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void }

export default function EnderecoAutoModal({ opened, onClose }: Props) {
  const gerar = useGerarEnderecos()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '—' }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || '—' }))

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigoDeposito: '001', codigoZona: '001', ruaInicio: 1, ruaFim: 1, predioInicio: 1, predioFim: 1, nivelInicio: 1, nivelFim: 1, aptoInicio: 1, aptoFim: 1, tipo: 'ARMAZENAGEM' },
  })

  const v = watch()
  const total = Math.max(0, (v.ruaFim || 0) - (v.ruaInicio || 0) + 1) * Math.max(0, (v.predioFim || 0) - (v.predioInicio || 0) + 1) * Math.max(0, (v.nivelFim || 0) - (v.nivelInicio || 0) + 1) * Math.max(0, (v.aptoFim || 0) - (v.aptoInicio || 0) + 1)

  async function onSubmit(data: FormValues) {
    try {
      const result: any = await gerar.mutateAsync(data)
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
            <Controller name="codigoDeposito" control={control} render={({ field }) => (<TextInput label="Cód. Depósito" className="w-4/12" {...field} />)} />
            <Controller name="codigoZona" control={control} render={({ field }) => (<TextInput label="Cód. Zona" className="w-4/12" {...field} />)} />
            <Controller name="tipo" control={control} render={({ field }) => (<Select label="Tipo" data={[{ value: 'ARMAZENAGEM', label: 'Armazenagem' }, { value: 'PICKING', label: 'Picking' }]} className="w-4/12" {...field} />)} />
          </div>
          <Text size="sm" fw={600}>Faixas de Endereço</Text>
          <div className="flex gap-4 w-full">
            <Controller name="ruaInicio" control={control} render={({ field }) => (<NumberInput label="Rua Início" className="w-3/12" min={1} {...field} />)} />
            <Controller name="ruaFim" control={control} render={({ field }) => (<NumberInput label="Rua Fim" className="w-3/12" min={1} {...field} />)} />
            <Controller name="predioInicio" control={control} render={({ field }) => (<NumberInput label="Prédio Início" className="w-3/12" min={1} {...field} />)} />
            <Controller name="predioFim" control={control} render={({ field }) => (<NumberInput label="Prédio Fim" className="w-3/12" min={1} {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="nivelInicio" control={control} render={({ field }) => (<NumberInput label="Nível Início" className="w-3/12" min={1} {...field} />)} />
            <Controller name="nivelFim" control={control} render={({ field }) => (<NumberInput label="Nível Fim" className="w-3/12" min={1} {...field} />)} />
            <Controller name="aptoInicio" control={control} render={({ field }) => (<NumberInput label="Apto Início" className="w-3/12" min={1} {...field} />)} />
            <Controller name="aptoFim" control={control} render={({ field }) => (<NumberInput label="Apto Fim" className="w-3/12" min={1} {...field} />)} />
          </div>
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-md">
            <Text size="sm" fw={600}>Total de endereços a gerar: <Text span c="primary" fw={700}>{total}</Text></Text>
          </div>
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={gerar.isPending}>Gerar Endereços</Button>
        </Group>
      </form>
    </Modal>
  )
}
