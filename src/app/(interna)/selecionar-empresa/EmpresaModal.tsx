'use client'

import { Modal, TextInput, Button, Group, Select, Tabs, Switch, Avatar, FileButton, ActionIcon } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IconBuildingSkyscraper, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import {
  inicializarEstadoLogo,
  validarArquivoLogoClient,
  mensagemErroLogoClient,
  determinarLogoParaPayload,
} from './logoEmpresa.utils'

/**
 * Requirement 3.1 — converte um `File` aprovado pelo Validador_Logo_Client
 * em uma string base64 no formato data-URL, usando a Web API nativa
 * `FileReader`. Não valida o arquivo (isso já ocorreu antes de chamar esta
 * função) e não lança: rejeita a Promise em caso de erro de leitura.
 */
function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

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
  rntrc: z.string().optional(),
  usaWms: z.boolean().optional(),
  status: z.boolean().optional(),
  logo: z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  opened: boolean
  onClose: () => void
  editData?: any
}

export default function EmpresaModal({ opened, onClose, editData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!editData
  const logoFoiTocadoRef = useRef<boolean>(false)

  const criar = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/empresas', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas-admin'] })
      queryClient.invalidateQueries({ queryKey: ['empresas-minhas'] })
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/empresas/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas-admin'] })
      queryClient.invalidateQueries({ queryKey: ['empresas-minhas'] })
    },
  })

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (editData) {
      reset({
        razaoSocial: editData.razaoSocial || '',
        nomeFantasia: editData.nomeFantasia || '',
        cnpj: editData.cnpj || '',
        inscEstadual: editData.inscEstadual || '',
        logradouro: editData.logradouro || '',
        numero: editData.numero || '',
        complemento: editData.complemento || '',
        bairro: editData.bairro || '',
        cidade: editData.cidade || '',
        uf: editData.uf || '',
        cep: editData.cep || '',
        telefone: editData.telefone || '',
        email: editData.email || '',
        rntrc: editData.rntrc || '',
        usaWms: editData.usaWms ?? false,
        status: editData.status ?? true,
        logo: inicializarEstadoLogo(editData?.logo),
      })
      logoFoiTocadoRef.current = false
    } else {
      reset({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        inscEstadual: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        cep: '',
        telefone: '',
        email: '',
        rntrc: '',
        usaWms: false,
        status: true,
        logo: inicializarEstadoLogo(editData?.logo),
      })
      logoFoiTocadoRef.current = false
    }
  }, [editData, reset, opened])

  async function onSubmit(data: FormValues) {
    const decisaoLogo = determinarLogoParaPayload(
      data.logo ?? null,
      isEditing ? 'editar' : 'criar',
      logoFoiTocadoRef.current,
    )
    const { logo, ...resto } = data
    const body = decisaoLogo.incluirCampo ? { ...resto, logo: decisaoLogo.valor } : resto

    try {
      if (isEditing) {
        await atualizar.mutateAsync({ id: editData.id, ...body })
      } else {
        await criar.mutateAsync(body)
      }
      notifications.show({
        title: 'Sucesso',
        message: isEditing ? 'Empresa atualizada' : 'Empresa criada',
        color: 'green',
      })
      onClose()
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao salvar',
        color: 'red',
      })
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Editar Empresa' : 'Nova Empresa'}
      size="xl"
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* MAIN FIELDS */}
        <div className="flex items-start gap-4 mb-4">
          <Controller name="logo" control={control} render={({ field }) => (
            <div className="flex flex-col items-center gap-2">
              <Avatar src={field.value || undefined} size={80} radius="md">
                {!field.value && <IconBuildingSkyscraper size={32} />}
              </Avatar>
              <Group gap={4}>
                <FileButton
                  onChange={async (file) => {
                    if (!file) return
                    const resultado = validarArquivoLogoClient(file.type, file.size)
                    if (!resultado.aprovado) {
                      notifications.show({
                        title: 'Arquivo inválido',
                        message: mensagemErroLogoClient(resultado.motivo),
                        color: 'red',
                      })
                      return
                    }
                    try {
                      const base64 = await arquivoParaBase64(file)
                      logoFoiTocadoRef.current = true
                      field.onChange(base64)
                    } catch {
                      notifications.show({
                        title: 'Erro',
                        message: 'Não foi possível ler o arquivo selecionado.',
                        color: 'red',
                      })
                    }
                  }}
                  accept="image/png,image/jpeg"
                >
                  {(props) => <Button size="xs" variant="light" {...props}>{field.value ? 'Trocar' : 'Enviar'}</Button>}
                </FileButton>
                {field.value && (
                  <ActionIcon
                    size="sm" variant="light" color="red"
                    onClick={() => {
                      logoFoiTocadoRef.current = true
                      field.onChange(null)
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </div>
          )} />
          <div className="flex flex-col gap-4 flex-1">
            <Controller name="razaoSocial" control={control} render={({ field }) => (
              <TextInput
                label={<>Razão Social <span style={{ color: 'red' }}>*</span></>}
                error={errors.razaoSocial?.message}
                {...field}
              />
            )} />
            <Controller name="nomeFantasia" control={control} render={({ field }) => (
              <TextInput label="Nome Fantasia" {...field} />
            )} />
            <Controller name="cnpj" control={control} render={({ field }) => (
              <TextInput
                label={<>CNPJ <span style={{ color: 'red' }}>*</span></>}
                placeholder="00.000.000/0000-00"
                error={errors.cnpj?.message}
                {...field}
                rightSection={
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="blue"
                    onClick={async () => {
                      const cnpjVal = field.value?.replace(/[^\d]/g, '')
                      if (!cnpjVal || cnpjVal.length !== 14) {
                        notifications.show({ title: 'CNPJ inválido', message: 'Informe 14 dígitos do CNPJ', color: 'red' })
                        return
                      }
                      try {
                        notifications.show({ title: 'Consultando...', message: 'Buscando dados do CNPJ na Receita Federal', color: 'blue', loading: true, id: 'cnpj-loading' })
                        const { data } = await api.get(`/empresas/consulta-cnpj/${cnpjVal}`)
                        notifications.hide('cnpj-loading')
                        if (data.razaoSocial) setValue('razaoSocial', data.razaoSocial)
                        if (data.nomeFantasia) setValue('nomeFantasia', data.nomeFantasia)
                        if (data.inscEstadual) setValue('inscEstadual', data.inscEstadual)
                        if (data.telefone) setValue('telefone', data.telefone)
                        if (data.email) setValue('email', data.email)
                        if (data.logradouro) setValue('logradouro', data.logradouro)
                        if (data.numero) setValue('numero', data.numero)
                        if (data.complemento) setValue('complemento', data.complemento)
                        if (data.bairro) setValue('bairro', data.bairro)
                        if (data.cidade) setValue('cidade', data.cidade)
                        if (data.uf) setValue('uf', data.uf)
                        if (data.cep) setValue('cep', data.cep)
                        notifications.show({ title: 'CNPJ encontrado', message: `${data.razaoSocial}`, color: 'green' })
                      } catch (err: any) {
                        notifications.hide('cnpj-loading')
                        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao consultar CNPJ', color: 'red' })
                      }
                    }}
                    style={{ marginRight: 4 }}
                  >
                    Consultar
                  </Button>
                }
                rightSectionWidth={85}
              />
            )} />
          </div>
        </div>

        {/* TABS */}
        <Tabs defaultValue="dados">
          <Tabs.List mb="md">
            <Tabs.Tab value="dados">Dados Gerais</Tabs.Tab>
            <Tabs.Tab value="endereco">Endereço</Tabs.Tab>
            <Tabs.Tab value="opcoes">Opções</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="dados">
            <div className="flex flex-col gap-4">
              <Controller name="inscEstadual" control={control} render={({ field }) => (
                <TextInput label="Inscrição Estadual" placeholder="Isento ou número" {...field} />
              )} />
              <Controller name="telefone" control={control} render={({ field }) => (
                <TextInput label="Telefone" placeholder="(00) 00000-0000" {...field} />
              )} />
              <Controller name="email" control={control} render={({ field }) => (
                <TextInput label="E-mail" placeholder="contato@empresa.com" {...field} />
              )} />
              <Controller name="rntrc" control={control} render={({ field }) => (
                <TextInput label="RNTRC (ANTT)" placeholder="00000000" description="Registro Nacional de Transportadores Rodoviários de Cargas — obrigatório para emissão de CT-e" maxLength={20} {...field} />
              )} />
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
                <TextInput label="Complemento" {...field} />
              )} />
              <div className="grid grid-cols-3 gap-4">
                <Controller name="bairro" control={control} render={({ field }) => (
                  <TextInput label="Bairro" {...field} />
                )} />
                <Controller name="cidade" control={control} render={({ field }) => (
                  <TextInput label="Cidade" {...field} />
                )} />
                <Controller name="uf" control={control} render={({ field }) => (
                  <Select
                    label="UF"
                    data={UFS}
                    searchable
                    clearable
                    value={field.value || null}
                    onChange={(v) => field.onChange(v || '')}
                  />
                )} />
              </div>
              <Controller name="cep" control={control} render={({ field }) => (
                <TextInput label="CEP" placeholder="00000-000" className="max-w-xs" {...field} />
              )} />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="opcoes">
            <div className="flex flex-col gap-4">
              <Controller name="status" control={control} render={({ field }) => (
                <Switch
                  label="Empresa Ativa"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )} />
              <Controller name="usaWms" control={control} render={({ field }) => (
                <Switch
                  label="Usa WMS"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
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
