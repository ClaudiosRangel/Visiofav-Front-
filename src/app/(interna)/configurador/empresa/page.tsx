'use client'

import { useEffect } from 'react'
import { Card, TextInput, Select, NumberInput, Tabs, Button, Group, Text, Switch, LoadingOverlay, FileButton, Image, ActionIcon, Divider } from '@mantine/core'
import { IconPhoto, IconUpload, IconTrash } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api'
import { GeocodificarEmpresaButton } from '@/components/geo/GeocodificarEmpresaButton'
import { GEO_KEYS } from '@/data/types/geo'
import { getUserPerfil } from '@/hooks/usePerfilGuard'
import { IntegracaoTabContent } from './IntegracaoTabContent'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => ({ value: u, label: u }))

const REGIMES_TRIBUTARIOS = [
  { value: '1', label: '1 - Simples Nacional / MEI (Microempresa)' },
  { value: '2', label: '2 - Lucro Presumido' },
  { value: '3', label: '3 - Lucro Real' },
]

const AMBIENTES_NFE = [
  { value: '1', label: '1 - Produção' },
  { value: '2', label: '2 - Homologação' },
]

const PERFIS_PERMITIDOS = ['ADMIN', 'SUPER_ADMIN', 'DIRETOR']

const empresaSchema = z.object({
  // Header
  razaoSocial: z.string().min(1, 'Razão Social é obrigatória'),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  // Dados Gerais
  inscEstadual: z.string().optional(),
  rntrc: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  status: z.boolean().default(true),
  usaWms: z.boolean().default(false),
  // Endereço
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  // Fiscal
  regimeTributario: z.string().optional(),
  ambienteNfe: z.string().optional(),
  serieNfe: z.string().optional(),
  proximoNumeroNfe: z.number().int().positive().nullable().optional(),
  serieCte: z.string().optional(),
  proximoNumeroCte: z.number().int().positive().nullable().optional(),
  ambienteCte: z.string().optional(),
  codigoMunicipio: z.string().optional(),
})

type EmpresaForm = z.infer<typeof empresaSchema>

export default function EmpresaPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Verificação de perfil
  useEffect(() => {
    const perfil = getUserPerfil()
    if (perfil && !PERFIS_PERMITIDOS.includes(perfil)) {
      notifications.show({ title: 'Acesso negado', message: 'Você não tem permissão para acessar esta página', color: 'red' })
      router.replace('/dashboard')
    }
  }, [router])

  // Carregar dados da empresa
  const { data: empresa, isLoading } = useQuery<any>({
    queryKey: [GEO_KEYS.empresa],
    queryFn: async () => { const { data } = await api.get('/empresas/minha'); return data },
    staleTime: 1000 * 60 * 5,
  })

  // Salvar alterações
  const salvar = useMutation({
    mutationFn: async (body: Partial<EmpresaForm>) => {
      const { data } = await api.put('/empresas/minha', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GEO_KEYS.empresa] })
      notifications.show({ title: 'Sucesso', message: 'Dados da empresa atualizados', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar dados da empresa', color: 'red' })
    },
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      razaoSocial: '', nomeFantasia: '', cnpj: '',
      inscEstadual: '', rntrc: '', telefone: '', email: '', status: true, usaWms: false,
      logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '',
      regimeTributario: '', ambienteNfe: '', serieNfe: '', proximoNumeroNfe: null,
      serieCte: '', proximoNumeroCte: null, ambienteCte: '',
    },
  })

  // Popular form quando empresa carregar
  useEffect(() => {
    if (empresa) {
      reset({
        razaoSocial: empresa.razaoSocial || '',
        nomeFantasia: empresa.nomeFantasia || '',
        cnpj: empresa.cnpj || '',
        inscEstadual: empresa.inscEstadual || '',
      rntrc: (empresa as any).rntrc || '',
        telefone: empresa.telefone || '',
        email: empresa.email || '',
        status: empresa.status ?? true,
        usaWms: empresa.usaWms ?? false,
        logradouro: empresa.logradouro || '',
        numero: empresa.numero || '',
        complemento: empresa.complemento || '',
        bairro: empresa.bairro || '',
        cidade: empresa.cidade || '',
        uf: empresa.uf || '',
        cep: empresa.cep || '',
        regimeTributario: empresa.regimeTributario ? String(empresa.regimeTributario) : '',
        ambienteNfe: empresa.ambienteNFe ? String(empresa.ambienteNFe) : '',
        serieNfe: empresa.serieNFe ? String(empresa.serieNFe) : '',
        proximoNumeroNfe: empresa.proximoNumeroNFe ?? null,
        serieCte: empresa.serieCTe ? String(empresa.serieCTe) : '',
        proximoNumeroCte: empresa.proximoNumeroCTe ?? null,
        ambienteCte: empresa.ambienteCTe ? String(empresa.ambienteCTe) : '',
        codigoMunicipio: empresa.codigoMunicipio || '',
      })
      setLogoUrl(empresa.logo || null)
    }
  }, [empresa, reset])

  const temEndereco = !!(empresa?.cep || empresa?.cidade)
  const temCoordenadas = !!(empresa?.latitude && empresa?.longitude)

  async function onSubmit(data: EmpresaForm) {
    // Remove cnpj from payload (read-only) and convert string fields to numbers for backend
    const { cnpj, regimeTributario, ambienteNfe, ambienteCte, serieNfe, proximoNumeroNfe, serieCte, proximoNumeroCte, codigoMunicipio, ...rest } = data
    const payload: any = {
      ...rest,
      regimeTributario: regimeTributario ? Number(regimeTributario) : undefined,
      ambienteNFe: ambienteNfe ? Number(ambienteNfe) : undefined,
      ambienteCTe: ambienteCte ? Number(ambienteCte) : undefined,
      serieNFe: serieNfe ? Number(serieNfe) : undefined,
      proximoNumeroNFe: proximoNumeroNfe ?? undefined,
      serieCTe: serieCte ? Number(serieCte) : undefined,
      proximoNumeroCTe: proximoNumeroCte ?? undefined,
      codigoMunicipio: codigoMunicipio || undefined,
    }
    salvar.mutate(payload)
  }

  async function handleUploadLogo(file: File | null) {
    if (!file) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/empresas/minha/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setLogoUrl(data.logo || data.logoUrl || null)
      queryClient.invalidateQueries({ queryKey: [GEO_KEYS.empresa] })
      notifications.show({ title: 'Sucesso', message: 'Logo enviado', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar logo', color: 'red' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleRemoverLogo() {
    try {
      await api.delete('/empresas/minha/logo')
      setLogoUrl(null)
      queryClient.invalidateQueries({ queryKey: [GEO_KEYS.empresa] })
      notifications.show({ title: 'Sucesso', message: 'Logo removido', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao remover logo', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Empresa</Text>
      <Text size="xl" fw={600} mb="lg">Dados da Empresa</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ===== CABEÇALHO — Logo + Dados principais ===== */}
          <div className="flex items-start gap-4 p-3 border border-gray-200 rounded-md mb-4">
            {/* Logo upload area */}
            <div className="flex flex-col items-center gap-2">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo da empresa" w={120} h={120} fit="contain" radius="md" style={{ border: '1px solid #e0e0e0' }} />
              ) : (
                <div className="w-[120px] h-[120px] bg-gray-100 rounded-md flex items-center justify-center border border-dashed border-gray-300">
                  <IconPhoto size={40} className="text-gray-300" />
                </div>
              )}
              <Group gap={4}>
                <FileButton onChange={handleUploadLogo} accept="image/png,image/jpeg,image/webp,image/gif">
                  {(props) => (
                    <Button size="xs" variant="light" leftSection={<IconUpload size={14} />} loading={uploadingLogo} {...props}>
                      {logoUrl ? 'Trocar' : 'Enviar'}
                    </Button>
                  )}
                </FileButton>
                {logoUrl && (
                  <ActionIcon size="sm" variant="light" color="red" onClick={handleRemoverLogo}>
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
              <Text size="xs" c="dimmed">Logo (JPEG, PNG, WebP)</Text>
            </div>

            {/* Main fields */}
            <div className="flex-1">
              <div className="flex flex-col gap-4">
                <Controller name="razaoSocial" control={control} render={({ field }) => (
                  <TextInput label={<>Razão Social <span style={{ color: 'red' }}>*</span></>} error={errors.razaoSocial?.message} {...field} />
                )} />
                <Controller name="nomeFantasia" control={control} render={({ field }) => (
                  <TextInput label="Nome Fantasia" {...field} />
                )} />
                <Controller name="cnpj" control={control} render={({ field }) => (
                  <TextInput label="CNPJ" readOnly disabled description="Não editável após cadastro" {...field} />
                )} />
              </div>
            </div>
          </div>

          {/* ===== ABAS ===== */}
          <Tabs defaultValue="dados-gerais">
            <Tabs.List mb="md">
              <Tabs.Tab value="dados-gerais">Dados Gerais</Tabs.Tab>
              <Tabs.Tab value="endereco">Endereço</Tabs.Tab>
              <Tabs.Tab value="fiscal">Fiscal</Tabs.Tab>
              <Tabs.Tab value="geolocalizacao">Geolocalização</Tabs.Tab>
              <Tabs.Tab value="integracao">Integração</Tabs.Tab>
            </Tabs.List>

            {/* ABA DADOS GERAIS */}
            <Tabs.Panel value="dados-gerais">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <Controller name="inscEstadual" control={control} render={({ field }) => (
                    <TextInput label="Inscrição Estadual" placeholder="Isento ou número" {...field} />
                  )} />
                  <Controller name="rntrc" control={control} render={({ field }) => (
                    <TextInput label="RNTRC (ANTT)" placeholder="Nº registro ANTT" {...field} />
                  )} />
                  <Controller name="telefone" control={control} render={({ field }) => (
                    <TextInput label="Telefone" placeholder="(00) 00000-0000" {...field} />
                  )} />
                  <Controller name="email" control={control} render={({ field }) => (
                    <TextInput label="E-mail" placeholder="contato@empresa.com" {...field} />
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="status" control={control} render={({ field }) => (
                    <Switch
                      label="Empresa Ativa"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )} />
                  <Controller name="usaWms" control={control} render={({ field }) => (
                    <Switch
                      label="Usa WMS"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )} />
                </div>
              </div>
            </Tabs.Panel>

            {/* ABA ENDEREÇO */}
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
                    <Select label="UF" data={UFS} searchable clearable value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                  )} />
                </div>
                <Controller name="cep" control={control} render={({ field }) => (
                  <TextInput label="CEP" placeholder="00000-000" className="max-w-xs" {...field} />
                )} />
              </div>
            </Tabs.Panel>

            {/* ABA FISCAL */}
            <Tabs.Panel value="fiscal">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="regimeTributario" control={control} render={({ field }) => (
                    <Select
                      label="Regime Tributário"
                      data={REGIMES_TRIBUTARIOS}
                      clearable
                      value={field.value || null}
                      onChange={(v) => field.onChange(v || '')}
                    />
                  )} />
                  <Controller name="ambienteNfe" control={control} render={({ field }) => (
                    <Select
                      label="Ambiente NF-e"
                      data={AMBIENTES_NFE}
                      clearable
                      value={field.value || null}
                      onChange={(v) => field.onChange(v || '')}
                    />
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="codigoMunicipio" control={control} render={({ field }) => (
                    <TextInput label="Cód. Município (IBGE)" placeholder="7 dígitos — ex: 3304557" maxLength={7} {...field} value={field.value ?? ''} />
                  )} />
                </div>
                <Text size="sm" fw={600} mt="sm">NF-e</Text>
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="serieNfe" control={control} render={({ field }) => (
                    <TextInput label="Série NF-e" placeholder="1" {...field} value={field.value ?? ''} />
                  )} />
                  <Controller name="proximoNumeroNfe" control={control} render={({ field }) => (
                    <NumberInput
                      label="Próximo Número NF-e"
                      placeholder="1"
                      min={1}
                      allowDecimal={false}
                      value={field.value ?? ''}
                      onChange={(v) => field.onChange(v === '' ? null : typeof v === 'number' ? v : null)}
                    />
                  )} />
                </div>
                <Text size="sm" fw={600} mt="sm">CT-e</Text>
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="ambienteCte" control={control} render={({ field }) => (
                    <Select
                      label="Ambiente CT-e"
                      data={AMBIENTES_NFE}
                      clearable
                      value={field.value || null}
                      onChange={(v) => field.onChange(v || '')}
                    />
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Controller name="serieCte" control={control} render={({ field }) => (
                    <TextInput label="Série CT-e" placeholder="1" {...field} value={field.value ?? ''} />
                  )} />
                  <Controller name="proximoNumeroCte" control={control} render={({ field }) => (
                    <NumberInput
                      label="Próximo Número CT-e"
                      placeholder="1"
                      min={1}
                      allowDecimal={false}
                      value={field.value ?? ''}
                      onChange={(v) => field.onChange(v === '' ? null : typeof v === 'number' ? v : null)}
                    />
                  )} />
                </div>
              </div>
            </Tabs.Panel>

            {/* ABA GEOLOCALIZAÇÃO */}
            <Tabs.Panel value="geolocalizacao">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="Latitude"
                    value={empresa?.latitude != null ? String(empresa.latitude) : ''}
                    readOnly
                    disabled
                    placeholder="Não definida"
                  />
                  <TextInput
                    label="Longitude"
                    value={empresa?.longitude != null ? String(empresa.longitude) : ''}
                    readOnly
                    disabled
                    placeholder="Não definida"
                  />
                </div>
                <GeocodificarEmpresaButton
                  temEndereco={temEndereco}
                  temCoordenadas={temCoordenadas}
                />
              </div>
            </Tabs.Panel>

            {/* ABA INTEGRAÇÃO */}
            <Tabs.Panel value="integracao">
              <IntegracaoTabContent />
            </Tabs.Panel>
          </Tabs>

          {/* ===== BOTÕES DE AÇÃO ===== */}
          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" loading={salvar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Card>
    </div>
  )
}
