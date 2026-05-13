'use client'

import { Modal, TextInput, Button, Group, Select } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useCriarDeposito, useAtualizarDeposito } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import { FormatoEnderecoSelect } from '@/components/configurador/FormatoEnderecoSelect'

const schema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  centroDistribuicaoId: z.string().min(1, 'Centro de Distribuição é obrigatório'),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().optional(),
  telefone1: z.string().optional(),
  telefone2: z.string().optional(),
  formatoEnderecoId: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void; editData?: Record<string, any> | null }

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => ({ value: uf, label: uf }))

export default function DepositoModal({ opened, onClose, editData }: Props) {
  const criar = useCriarDeposito()
  const atualizar = useAtualizarDeposito()
  const { data: cdsResponse } = useCentrosDistribuicao({ limit: 100 })
  const isEditing = !!editData

  const cdOptions = (cdsResponse?.data || []).map((cd: any) => ({ value: cd.id, label: cd.nome || cd.descricao || cd.codigo || '—' }))

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (editData) {
      reset({ descricao: editData.descricao, centroDistribuicaoId: editData.centroDistribuicaoId, cidade: editData.cidade || '', uf: editData.uf || '', cep: editData.cep || '', telefone1: editData.telefone1 || '', telefone2: editData.telefone2 || '', formatoEnderecoId: editData.formatoEnderecoId || null })
    } else {
      reset({ descricao: '', centroDistribuicaoId: '', formatoEnderecoId: null })
    }
  }, [editData, reset, opened])

  async function onSubmit(data: FormValues) {
    try {
      // Limpar campos vazios e garantir formatoEnderecoId como null quando não selecionado
      const payload: any = { ...data }
      if (!payload.formatoEnderecoId) payload.formatoEnderecoId = null
      if (!payload.cidade) delete payload.cidade
      if (!payload.uf) delete payload.uf
      if (!payload.cep) delete payload.cep
      if (!payload.telefone1) delete payload.telefone1
      if (!payload.telefone2) delete payload.telefone2
      if (!payload.logradouro) delete payload.logradouro
      if (!payload.numero) delete payload.numero

      if (isEditing) { await atualizar.mutateAsync({ id: editData.id, ...payload }); notifications.show({ title: 'Sucesso', message: 'Atualizado', color: 'green' }) }
      else { await criar.mutateAsync(payload); notifications.show({ title: 'Sucesso', message: 'Criado', color: 'green' }) }
      onClose()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' }) }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isEditing ? 'Editar Depósito' : 'Novo Depósito'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4">
          <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (
            <Select label={<>Centro de Distribuição <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} searchable {...field} />
          )} />
          <Controller name="descricao" control={control} render={({ field }) => (
            <TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />
          )} />
          <div className="flex gap-4 w-full">
            <Controller name="cidade" control={control} render={({ field }) => (<TextInput label="Cidade" className="w-5/12" {...field} />)} />
            <Controller name="uf" control={control} render={({ field }) => (<Select label="UF" data={UF_OPTIONS} className="w-3/12" clearable {...field} />)} />
            <Controller name="cep" control={control} render={({ field }) => (<TextInput label="CEP" className="w-4/12" {...field} />)} />
          </div>
          <div className="flex gap-4 w-full">
            <Controller name="telefone1" control={control} render={({ field }) => (<TextInput label="Telefone 1" className="w-6/12" {...field} />)} />
            <Controller name="telefone2" control={control} render={({ field }) => (<TextInput label="Telefone 2" className="w-6/12" {...field} />)} />
          </div>
          <Controller name="formatoEnderecoId" control={control} render={({ field }) => (
            <FormatoEnderecoSelect value={field.value ?? null} onChange={field.onChange} error={errors.formatoEnderecoId?.message} />
          )} />
        </div>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button>
        </Group>
      </form>
    </Modal>
  )
}
