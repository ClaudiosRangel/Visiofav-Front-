'use client'

import { Modal, TextInput, Button, Group, Select } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useCriarEndereco } from '@/data/hooks/useEndereco'
import { useDepositos } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'

const schema = z.object({
  centroDistribuicaoId: z.string().min(1, 'CD é obrigatório'),
  depositoId: z.string().min(1, 'Depósito é obrigatório'),
  codigoDeposito: z.string().min(1), codigoZona: z.string().min(1),
  codigoRua: z.string().min(1, 'Rua é obrigatória'),
  codigoPredio: z.string().min(1, 'Prédio é obrigatório'),
  codigoNivel: z.string().min(1, 'Nível é obrigatório'),
  codigoApto: z.string().min(1, 'Apto é obrigatório'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
})
type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void; editData?: Record<string, any> | null }

export default function EnderecoModal({ opened, onClose, editData }: Props) {
  const criar = useCriarEndereco()
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '—' }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || '—' }))

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!editData) reset({ codigoDeposito: '001', codigoZona: '001', codigoRua: '', codigoPredio: '', codigoNivel: '', codigoApto: '', tipo: 'ARMAZENAGEM' })
  }, [editData, reset, opened])

  async function onSubmit(data: FormValues) {
    try {
      await criar.mutateAsync(data)
      notifications.show({ title: 'Sucesso', message: 'Endereço criado', color: 'green' })
      onClose()
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }) }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={editData ? 'Editar Endereço' : 'Novo Endereço'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} className="w-6/12" searchable {...field} />)} />
            <Controller name="depositoId" control={control} render={({ field }) => (<Select label={<>Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions} error={errors.depositoId?.message} className="w-6/12" searchable {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="codigoDeposito" control={control} render={({ field }) => (<TextInput label="Cód. Depósito" className="w-3/12" {...field} />)} />
            <Controller name="codigoZona" control={control} render={({ field }) => (<TextInput label="Cód. Zona" className="w-3/12" {...field} />)} />
            <Controller name="codigoRua" control={control} render={({ field }) => (<TextInput label={<>Rua <span style={{ color: 'red' }}>*</span></>} error={errors.codigoRua?.message} className="w-3/12" {...field} />)} />
            <Controller name="codigoPredio" control={control} render={({ field }) => (<TextInput label={<>Prédio <span style={{ color: 'red' }}>*</span></>} error={errors.codigoPredio?.message} className="w-3/12" {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="codigoNivel" control={control} render={({ field }) => (<TextInput label={<>Nível <span style={{ color: 'red' }}>*</span></>} error={errors.codigoNivel?.message} className="w-3/12" {...field} />)} />
            <Controller name="codigoApto" control={control} render={({ field }) => (<TextInput label={<>Apto <span style={{ color: 'red' }}>*</span></>} error={errors.codigoApto?.message} className="w-3/12" {...field} />)} />
            <Controller name="tipo" control={control} render={({ field }) => (
              <Select label={<>Tipo <span style={{ color: 'red' }}>*</span></>} data={[
                { value: 'ARMAZENAGEM', label: 'Armazenagem' }, { value: 'PICKING', label: 'Picking' },
                { value: 'DOCA', label: 'Doca' }, { value: 'AVARIA', label: 'Avaria' },
              ]} error={errors.tipo?.message} className="w-6/12" {...field} />
            )} />
          </div>
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={criar.isPending}>Salvar</Button>
        </Group>
      </form>
    </Modal>
  )
}
