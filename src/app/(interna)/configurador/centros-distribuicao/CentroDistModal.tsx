'use client'

import { Modal, TextInput, Button, Group, Select } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useCriarCentroDistribuicao, useAtualizarCentroDistribuicao } from '@/data/hooks/useCentroDistribuicao'

const schema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().optional(),
  telefone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  opened: boolean
  onClose: () => void
  editData?: Record<string, any> | null
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
].map((uf) => ({ value: uf, label: uf }))

export default function CentroDistModal({ opened, onClose, editData }: Props) {
  const criar = useCriarCentroDistribuicao()
  const atualizar = useAtualizarCentroDistribuicao()
  const isEditing = !!editData

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { descricao: '' },
  })

  useEffect(() => {
    if (editData) {
      reset({
        descricao: editData.descricao || '',
        logradouro: editData.logradouro || '',
        numero: editData.numero || '',
        complemento: editData.complemento || '',
        bairro: editData.bairro || '',
        cidade: editData.cidade || '',
        uf: editData.uf || '',
        cep: editData.cep || '',
        telefone: editData.telefone || '',
      })
    } else {
      reset({ descricao: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '', telefone: '' })
    }
  }, [editData, reset, opened])

  async function onSubmit(data: FormValues) {
    try {
      if (isEditing) {
        await atualizar.mutateAsync({ id: editData.id, ...data })
        notifications.show({ title: 'Sucesso', message: 'Registro atualizado', color: 'green' })
      } else {
        await criar.mutateAsync(data)
        notifications.show({ title: 'Sucesso', message: 'Registro criado', color: 'green' })
      }
      onClose()
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível salvar', color: 'red' })
    }
  }

  const saving = criar.isPending || atualizar.isPending

  return (
    <Modal opened={opened} onClose={onClose} title={isEditing ? 'Editar Centro de Distribuição' : 'Novo Centro de Distribuição'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          <Controller name="descricao" control={control} render={({ field }) => (
            <TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />
          )} />
          <div className="flex gap-4 w-full">
            <Controller name="logradouro" control={control} render={({ field }) => (<TextInput label="Logradouro" className="w-8/12" {...field} />)} />
            <Controller name="numero" control={control} render={({ field }) => (<TextInput label="Número" className="w-4/12" {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="complemento" control={control} render={({ field }) => (<TextInput label="Complemento" className="w-6/12" {...field} />)} />
            <Controller name="bairro" control={control} render={({ field }) => (<TextInput label="Bairro" className="w-6/12" {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="cidade" control={control} render={({ field }) => (<TextInput label="Cidade" className="w-5/12" {...field} />)} />
            <Controller name="uf" control={control} render={({ field }) => (<Select label="UF" data={UF_OPTIONS} className="w-3/12" clearable {...field} />)} />
            <Controller name="cep" control={control} render={({ field }) => (<TextInput label="CEP" className="w-4/12" {...field} />)} />
          </div>
          <Controller name="telefone" control={control} render={({ field }) => (<TextInput label="Telefone" className="w-6/12" {...field} />)} />
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </Group>
      </form>
    </Modal>
  )
}
