'use client'

import { Modal, TextInput, Button, Group, Select, Tabs, Divider } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => ({ value: u, label: u }))

const schema = z.object({
  razaoSocial: z.string().min(1, 'Razão Social é obrigatória'),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().min(1, 'CNPJ é obrigatório'),
  inscEstadual: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props { opened: boolean; onClose: () => void; editData?: any }

export default function FornecedorModal({ opened, onClose, editData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!editData

  const criar = useMutation({
    mutationFn: async (body: any) => { const { data } = await api.post('/fornecedores', body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: any) => { const { data } = await api.put(`/fornecedores/${id}`, body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (editData) {
      reset({
        razaoSocial: editData.razaoSocial || '', nomeFantasia: editData.nomeFantasia || '',
        cnpj: editData.cnpj || '', inscEstadual: editData.inscEstadual || '',
        logradouro: editData.logradouro || '', numero: editData.numero || '',
        complemento: editData.complemento || '', bairro: editData.bairro || '',
        cidade: editData.cidade || '', uf: editData.uf || '', cep: editData.cep || '',
        telefone: editData.telefone || '', email: editData.email || '',
      })
    } else {
      reset({ razaoSocial: '', cnpj: '' })
    }
  }, [editData, reset, opened])

  async function onSubmit(data: FormValues) {
    try {
      if (isEditing) await atualizar.mutateAsync({ id: editData.id, ...data })
      else await criar.mutateAsync(data)
      notifications.show({ title: 'Sucesso', message: isEditing ? 'Fornecedor atualizado' : 'Fornecedor criado', color: 'green' })
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="xl" centered closeOnClickOutside={false}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="dados">
          <Tabs.List mb="md">
            <Tabs.Tab value="dados">Dados Cadastrais</Tabs.Tab>
            <Tabs.Tab value="endereco">Endereço</Tabs.Tab>
            <Tabs.Tab value="contato">Contato</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="dados">
            <div className="flex flex-col gap-4">
              <Controller name="razaoSocial" control={control} render={({ field }) => (
                <TextInput label={<>Razão Social <span style={{ color: 'red' }}>*</span></>} error={errors.razaoSocial?.message} {...field} />
              )} />
              <Controller name="nomeFantasia" control={control} render={({ field }) => (
                <TextInput label="Nome Fantasia" {...field} />
              )} />
              <div className="grid grid-cols-2 gap-4">
                <Controller name="cnpj" control={control} render={({ field }) => (
                  <TextInput label={<>CNPJ <span style={{ color: 'red' }}>*</span></>} placeholder="00.000.000/0000-00" error={errors.cnpj?.message} {...field} />
                )} />
                <Controller name="inscEstadual" control={control} render={({ field }) => (
                  <TextInput label="Inscrição Estadual" placeholder="Isento ou número" {...field} />
                )} />
              </div>
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="endereco">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Controller name="logradouro" control={control} render={({ field }) => (
                    <TextInput label="Logradouro" placeholder="Rua, Av, etc." {...field} />
                  )} />
                </div>
                <Controller name="numero" control={control} render={({ field }) => (
                  <TextInput label="Número" placeholder="S/N" {...field} />
                )} />
              </div>
              <Controller name="complemento" control={control} render={({ field }) => (
                <TextInput label="Complemento" placeholder="Sala, Andar, etc." {...field} />
              )} />
              <div className="grid grid-cols-3 gap-4">
                <Controller name="bairro" control={control} render={({ field }) => (
                  <TextInput label="Bairro" {...field} />
                )} />
                <Controller name="cidade" control={control} render={({ field }) => (
                  <TextInput label="Cidade" {...field} />
                )} />
                <Controller name="uf" control={control} render={({ field }) => (
                  <Select label="UF" data={UFS} searchable clearable value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                )} />
              </div>
              <Controller name="cep" control={control} render={({ field }) => (
                <TextInput label="CEP" placeholder="00000-000" className="max-w-xs" {...field} />
              )} />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="contato">
            <div className="flex flex-col gap-4">
              <Controller name="telefone" control={control} render={({ field }) => (
                <TextInput label="Telefone" placeholder="(00) 00000-0000" {...field} />
              )} />
              <Controller name="email" control={control} render={({ field }) => (
                <TextInput label="E-mail" placeholder="contato@empresa.com" {...field} />
              )} />
            </div>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button>
        </Group>
      </form>
    </Modal>
  )
}
