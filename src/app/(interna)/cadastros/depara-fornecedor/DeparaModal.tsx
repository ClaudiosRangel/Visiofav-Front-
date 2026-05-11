'use client'

import { useEffect, useState } from 'react'
import {
  Modal, TextInput, Button, Group, Select, NumberInput, SimpleGrid, Text,
} from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  useDeparaCreate, useDeparaUpdate,
  DeparaFornecedor, DeparaCreatePayload, DeparaUpdatePayload,
} from '@/data/hooks/useDepara'

const deparaSchema = z.object({
  fornecedorId: z.string().min(1, 'Fornecedor é obrigatório'),
  codigoProdutoFornecedor: z.string().min(1, 'Código do produto é obrigatório'),
  descricaoFornecedor: z.string().optional(),
  produtoId: z.string().min(1, 'Produto interno é obrigatório'),
  skuId: z.string().optional().nullable(),
  unidadeFornecedor: z.string().min(1, 'Unidade é obrigatória').max(6),
  fatorConversao: z.number().positive('Fator deve ser maior que zero'),
  cEAN: z.string().max(14).optional().nullable(),
  cEANTrib: z.string().max(14).optional().nullable(),
  status: z.boolean(),
})

type DeparaForm = z.infer<typeof deparaSchema>

interface Props {
  opened: boolean
  onClose: () => void
  editData?: DeparaFornecedor | null
}

export default function DeparaModal({ opened, onClose, editData }: Props) {
  const isEditing = !!editData
  const criarMut = useDeparaCreate()
  const atualizarMut = useDeparaUpdate()

  const [produtoSearch, setProdutoSearch] = useState('')
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null)

  // Buscar fornecedores
  const { data: fornecedoresResp } = useQuery<{ data: Array<{ id: string; razaoSocial: string }> }>({
    queryKey: ['fornecedores', { limit: 200 }],
    queryFn: async () => {
      const { data } = await api.get('/fornecedores', { params: { limit: 200 } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  // Buscar produtos com autocomplete
  const { data: produtosResp } = useQuery<{ data: Array<{ id: string; codigo: string; nome: string; unidade: string }> }>({
    queryKey: ['produtos', { search: produtoSearch, limit: 30 }],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { search: produtoSearch || undefined, limit: 30 } })
      return data
    },
    staleTime: 1000 * 60 * 2,
  })

  // Buscar SKUs do produto selecionado
  const { data: skusResp } = useQuery<{ data: Array<{ id: string; sequencia: number; unidade: string; codigoBarra?: string }> }>({
    queryKey: ['skus', selectedProdutoId],
    queryFn: async () => {
      const { data } = await api.get('/skus', { params: { produtoId: selectedProdutoId } })
      return data
    },
    enabled: !!selectedProdutoId,
    staleTime: 1000 * 60 * 5,
  })

  const fornecedoresOptions = (fornecedoresResp?.data || []).map(f => ({
    value: f.id,
    label: f.razaoSocial,
  }))

  const produtosOptions = (produtosResp?.data || []).map(p => ({
    value: p.id,
    label: `${p.codigo} — ${p.nome}`,
  }))

  const skusOptions = (skusResp?.data || []).map(s => ({
    value: s.id,
    label: `Seq ${s.sequencia} — ${s.unidade}${s.codigoBarra ? ` (${s.codigoBarra})` : ''}`,
  }))

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<DeparaForm>({
    resolver: zodResolver(deparaSchema),
    defaultValues: {
      fornecedorId: '',
      codigoProdutoFornecedor: '',
      descricaoFornecedor: '',
      produtoId: '',
      skuId: null,
      unidadeFornecedor: 'UN',
      fatorConversao: 1,
      cEAN: '',
      cEANTrib: '',
      status: true,
    },
  })

  const watchedProdutoId = watch('produtoId')

  useEffect(() => {
    setSelectedProdutoId(watchedProdutoId || null)
  }, [watchedProdutoId])

  useEffect(() => {
    if (opened) {
      if (editData) {
        reset({
          fornecedorId: editData.fornecedorId,
          codigoProdutoFornecedor: editData.codigoProdutoFornecedor,
          descricaoFornecedor: editData.descricaoFornecedor || '',
          produtoId: editData.produtoId,
          skuId: editData.skuId || null,
          unidadeFornecedor: editData.unidadeFornecedor,
          fatorConversao: Number(editData.fatorConversao),
          cEAN: editData.cEAN || '',
          cEANTrib: editData.cEANTrib || '',
          status: editData.status,
        })
        setSelectedProdutoId(editData.produtoId)
        setProdutoSearch(editData.produto ? `${editData.produto.codigo} — ${editData.produto.nome}` : '')
      } else {
        reset({
          fornecedorId: '',
          codigoProdutoFornecedor: '',
          descricaoFornecedor: '',
          produtoId: '',
          skuId: null,
          unidadeFornecedor: 'UN',
          fatorConversao: 1,
          cEAN: '',
          cEANTrib: '',
          status: true,
        })
        setSelectedProdutoId(null)
        setProdutoSearch('')
      }
    }
  }, [opened, editData, reset])

  async function onSubmit(data: DeparaForm) {
    try {
      if (isEditing) {
        const payload: DeparaUpdatePayload = {
          id: editData!.id,
          produtoId: data.produtoId,
          skuId: data.skuId || null,
          fatorConversao: data.fatorConversao,
          unidadeFornecedor: data.unidadeFornecedor,
          descricaoFornecedor: data.descricaoFornecedor || null,
          cEAN: data.cEAN || null,
          cEANTrib: data.cEANTrib || null,
          status: data.status,
        }
        await atualizarMut.mutateAsync(payload)
        notifications.show({ title: 'Sucesso', message: 'De-Para atualizado', color: 'green' })
      } else {
        const payload: DeparaCreatePayload = {
          fornecedorId: data.fornecedorId,
          codigoProdutoFornecedor: data.codigoProdutoFornecedor,
          descricaoFornecedor: data.descricaoFornecedor || undefined,
          produtoId: data.produtoId,
          skuId: data.skuId || null,
          unidadeFornecedor: data.unidadeFornecedor,
          fatorConversao: data.fatorConversao,
          cEAN: data.cEAN || null,
          cEANTrib: data.cEANTrib || null,
        }
        await criarMut.mutateAsync(payload)
        notifications.show({ title: 'Sucesso', message: 'De-Para criado', color: 'green' })
      }
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao salvar'
      const status = err?.response?.status
      if (status === 409) {
        notifications.show({ title: 'Duplicata', message: msg, color: 'orange' })
      } else {
        notifications.show({ title: 'Erro', message: msg, color: 'red' })
      }
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Editar De-Para' : 'Novo De-Para'}
      size="lg"
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <Controller
            name="fornecedorId"
            control={control}
            render={({ field }) => (
              <Select
                label={<>Fornecedor <span style={{ color: 'red' }}>*</span></>}
                placeholder="Selecione o fornecedor"
                data={fornecedoresOptions}
                searchable
                error={errors.fornecedorId?.message}
                disabled={isEditing}
                {...field}
              />
            )}
          />
          <Controller
            name="codigoProdutoFornecedor"
            control={control}
            render={({ field }) => (
              <TextInput
                label={<>Código Produto Fornecedor <span style={{ color: 'red' }}>*</span></>}
                placeholder="Ex: PROD-001"
                error={errors.codigoProdutoFornecedor?.message}
                disabled={isEditing}
                {...field}
              />
            )}
          />
        </SimpleGrid>

        <Controller
          name="descricaoFornecedor"
          control={control}
          render={({ field }) => (
            <TextInput
              label="Descrição Fornecedor"
              placeholder="Descrição do produto no fornecedor"
              mb="md"
              {...field}
            />
          )}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <Controller
            name="produtoId"
            control={control}
            render={({ field }) => (
              <Select
                label={<>Produto Interno <span style={{ color: 'red' }}>*</span></>}
                placeholder="Buscar produto..."
                data={produtosOptions}
                searchable
                onSearchChange={setProdutoSearch}
                error={errors.produtoId?.message}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v || '')
                  setValue('skuId', null)
                }}
              />
            )}
          />
          <Controller
            name="skuId"
            control={control}
            render={({ field }) => (
              <Select
                label="SKU"
                placeholder={selectedProdutoId ? 'Selecione o SKU (opcional)' : 'Selecione um produto primeiro'}
                data={skusOptions}
                disabled={!selectedProdutoId}
                clearable
                value={field.value || null}
                onChange={(v) => field.onChange(v || null)}
              />
            )}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Controller
            name="unidadeFornecedor"
            control={control}
            render={({ field }) => (
              <TextInput
                label={<>Unidade Fornecedor <span style={{ color: 'red' }}>*</span></>}
                placeholder="UN, CX, KG..."
                maxLength={6}
                error={errors.unidadeFornecedor?.message}
                {...field}
              />
            )}
          />
          <Controller
            name="fatorConversao"
            control={control}
            render={({ field }) => (
              <NumberInput
                label={<>Fator de Conversão <span style={{ color: 'red' }}>*</span></>}
                min={0.0001}
                decimalScale={4}
                step={0.1}
                error={errors.fatorConversao?.message}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : 1)}
              />
            )}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Status"
                data={[
                  { value: 'true', label: 'Ativo' },
                  { value: 'false', label: 'Inativo' },
                ]}
                value={String(field.value)}
                onChange={(v) => field.onChange(v === 'true')}
              />
            )}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <Controller
            name="cEAN"
            control={control}
            render={({ field }) => (
              <TextInput
                label="cEAN"
                placeholder="Código EAN do produto"
                maxLength={14}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.currentTarget.value || null)}
              />
            )}
          />
          <Controller
            name="cEANTrib"
            control={control}
            render={({ field }) => (
              <TextInput
                label="cEANTrib"
                placeholder="Código EAN tributário"
                maxLength={14}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.currentTarget.value || null)}
              />
            )}
          />
        </SimpleGrid>

        <Text size="xs" c="dimmed" mb="md">
          O fator de conversão indica quantas unidades internas equivalem a 1 unidade do fornecedor.
          Ex: 1 CX do fornecedor = 12 UN internas → fator = 12.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={criarMut.isPending || atualizarMut.isPending}>
            {isEditing ? 'Salvar' : 'Criar De-Para'}
          </Button>
        </Group>
      </form>
    </Modal>
  )
}
