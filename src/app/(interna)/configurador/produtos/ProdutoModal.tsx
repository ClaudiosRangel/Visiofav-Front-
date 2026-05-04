'use client'

import { Modal, TextInput, Button, Group, Select, NumberInput, Tabs, Text, Divider } from '@mantine/core'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const UNIDADES = [
  { value: 'UN', label: 'UN - Unidade' }, { value: 'CX', label: 'CX - Caixa' },
  { value: 'KG', label: 'KG - Quilograma' }, { value: 'PC', label: 'PC - Peça' },
  { value: 'FD', label: 'FD - Fardo' }, { value: 'PT', label: 'PT - Pacote' },
  { value: 'LT', label: 'LT - Litro' }, { value: 'MT', label: 'MT - Metro' },
  { value: 'M2', label: 'M2 - Metro²' }, { value: 'M3', label: 'M3 - Metro³' },
  { value: 'TON', label: 'TON - Tonelada' }, { value: 'PAR', label: 'PAR - Par' },
]

const ORIGENS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (mercado interno)' },
  { value: '3', label: '3 - Nacional com conteúdo importado > 40%' },
  { value: '5', label: '5 - Nacional com conteúdo importado ≤ 40%' },
  { value: '6', label: '6 - Estrangeira (importação direta, sem similar)' },
  { value: '7', label: '7 - Estrangeira (mercado interno, sem similar)' },
  { value: '8', label: '8 - Nacional com conteúdo importado > 70%' },
]

const produtoSchema = z.object({
  // Dados gerais
  codigo: z.string().min(1, 'Código é obrigatório'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  unidade: z.string().min(1, 'Unidade é obrigatória'),
  precoBase: z.number().min(0).optional(),
  status: z.boolean().default(true),
  // Código de barras
  cEAN: z.string().max(14).optional(),
  // Fiscal
  ncm: z.string().max(8).optional(),
  cfopEstadual: z.string().max(4).optional(),
  cfopInterest: z.string().max(4).optional(),
  cst: z.string().max(3).optional(),
  csosn: z.string().max(4).optional(),
  aliqICMS: z.number().min(0).max(100).optional(),
  aliqIPI: z.number().min(0).max(100).optional(),
  cstPIS: z.string().max(2).optional(),
  aliqPIS: z.number().min(0).max(100).optional(),
  cstCOFINS: z.string().max(2).optional(),
  aliqCOFINS: z.number().min(0).max(100).optional(),
  origemProd: z.number().int().min(0).max(8).optional(),
})

type ProdutoForm = z.infer<typeof produtoSchema>

interface Props { opened: boolean; onClose: () => void; editData?: Record<string, any> | null }

export default function ProdutoModal({ opened, onClose, editData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!editData

  const criar = useMutation({
    mutationFn: async (body: any) => { const { data } = await api.post('/produtos', body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: any) => { const { data } = await api.put(`/produtos/${id}`, body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: { codigo: '', nome: '', unidade: 'UN', precoBase: 0, status: true, origemProd: 0, aliqICMS: 0, aliqIPI: 0, aliqPIS: 0, aliqCOFINS: 0 },
  })

  useEffect(() => {
    if (editData) {
      reset({
        codigo: editData.codigo || '',
        nome: editData.nome || editData.descricao || '',
        descricao: editData.descricao || '',
        unidade: editData.unidade || 'UN',
        precoBase: Number(editData.precoBase) || 0,
        status: editData.status ?? true,
        cEAN: editData.cEAN || editData.codigoBarra || '',
        ncm: editData.ncm || '',
        cfopEstadual: editData.cfopEstadual || '',
        cfopInterest: editData.cfopInterest || '',
        cst: editData.cst || '',
        csosn: editData.csosn || '',
        aliqICMS: Number(editData.aliqICMS) || 0,
        aliqIPI: Number(editData.aliqIPI) || 0,
        cstPIS: editData.cstPIS || '',
        aliqPIS: Number(editData.aliqPIS) || 0,
        cstCOFINS: editData.cstCOFINS || '',
        aliqCOFINS: Number(editData.aliqCOFINS) || 0,
        origemProd: editData.origemProd ?? 0,
      })
    } else {
      reset({ codigo: '', nome: '', unidade: 'UN', precoBase: 0, status: true, origemProd: 0, aliqICMS: 0, aliqIPI: 0, aliqPIS: 0, aliqCOFINS: 0 })
    }
  }, [editData, reset, opened])

  async function onSubmit(data: ProdutoForm) {
    try {
      if (isEditing) {
        await atualizar.mutateAsync({ id: editData!.id, ...data })
      } else {
        await criar.mutateAsync(data)
      }
      notifications.show({ title: 'Sucesso', message: isEditing ? 'Produto atualizado' : 'Produto criado', color: 'green' })
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isEditing ? 'Editar Produto' : 'Novo Produto'} size="xl" centered closeOnClickOutside={false}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="geral">
          <Tabs.List mb="md">
            <Tabs.Tab value="geral">Dados Gerais</Tabs.Tab>
            <Tabs.Tab value="fiscal">Dados Fiscais / NF-e</Tabs.Tab>
          </Tabs.List>

          {/* ABA GERAL */}
          <Tabs.Panel value="geral">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <Controller name="codigo" control={control} render={({ field }) => (
                  <TextInput label={<>Código <span style={{ color: 'red' }}>*</span></>} placeholder="PROD001" error={errors.codigo?.message} {...field} />
                )} />
                <div className="col-span-2">
                  <Controller name="nome" control={control} render={({ field }) => (
                    <TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} placeholder="Nome do produto" error={errors.nome?.message} {...field} />
                  )} />
                </div>
              </div>

              <Controller name="descricao" control={control} render={({ field }) => (
                <TextInput label="Descrição detalhada" placeholder="Descrição completa do produto" {...field} />
              )} />

              <div className="grid grid-cols-4 gap-4">
                <Controller name="unidade" control={control} render={({ field }) => (
                  <Select label={<>Unidade <span style={{ color: 'red' }}>*</span></>} data={UNIDADES} error={errors.unidade?.message} {...field} />
                )} />
                <Controller name="precoBase" control={control} render={({ field }) => (
                  <NumberInput label="Preço Base" prefix="R$ " decimalScale={4} min={0} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
                )} />
                <Controller name="cEAN" control={control} render={({ field }) => (
                  <TextInput label="EAN / GTIN" placeholder="7891234560012" maxLength={14} {...field} />
                )} />
                <Controller name="status" control={control} render={({ field }) => (
                  <Select label="Status" data={[{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }]} value={String(field.value)} onChange={(v) => field.onChange(v === 'true')} />
                )} />
              </div>
            </div>
          </Tabs.Panel>

          {/* ABA FISCAL */}
          <Tabs.Panel value="fiscal">
            <div className="flex flex-col gap-4">
              <Text size="sm" fw={600} c="primary">Classificação Fiscal</Text>
              <div className="grid grid-cols-3 gap-4">
                <Controller name="ncm" control={control} render={({ field }) => (
                  <TextInput label={<>NCM <span style={{ color: 'red' }}>*</span></>} placeholder="10063021" maxLength={8} description="8 dígitos" {...field} />
                )} />
                <Controller name="cfopEstadual" control={control} render={({ field }) => (
                  <TextInput label="CFOP Estadual" placeholder="5102" maxLength={4} description="Venda dentro do estado" {...field} />
                )} />
                <Controller name="cfopInterest" control={control} render={({ field }) => (
                  <TextInput label="CFOP Interestadual" placeholder="6102" maxLength={4} description="Venda fora do estado" {...field} />
                )} />
              </div>

              <Controller name="origemProd" control={control} render={({ field }) => (
                <Select label="Origem da Mercadoria" data={ORIGENS} value={String(field.value ?? 0)} onChange={(v) => field.onChange(parseInt(v || '0'))} />
              )} />

              <Divider label="ICMS" labelPosition="left" />
              <div className="grid grid-cols-3 gap-4">
                <Controller name="cst" control={control} render={({ field }) => (
                  <TextInput label="CST ICMS" placeholder="00" maxLength={3} description="Regime Normal" {...field} />
                )} />
                <Controller name="csosn" control={control} render={({ field }) => (
                  <TextInput label="CSOSN" placeholder="102" maxLength={4} description="Simples Nacional" {...field} />
                )} />
                <Controller name="aliqICMS" control={control} render={({ field }) => (
                  <NumberInput label="Alíquota ICMS (%)" min={0} max={100} decimalScale={2} suffix="%" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
                )} />
              </div>

              <Divider label="IPI" labelPosition="left" />
              <div className="grid grid-cols-3 gap-4">
                <Controller name="aliqIPI" control={control} render={({ field }) => (
                  <NumberInput label="Alíquota IPI (%)" min={0} max={100} decimalScale={2} suffix="%" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
                )} />
              </div>

              <Divider label="PIS / COFINS" labelPosition="left" />
              <div className="grid grid-cols-4 gap-4">
                <Controller name="cstPIS" control={control} render={({ field }) => (
                  <TextInput label="CST PIS" placeholder="01" maxLength={2} {...field} />
                )} />
                <Controller name="aliqPIS" control={control} render={({ field }) => (
                  <NumberInput label="Alíq. PIS (%)" min={0} max={100} decimalScale={2} suffix="%" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
                )} />
                <Controller name="cstCOFINS" control={control} render={({ field }) => (
                  <TextInput label="CST COFINS" placeholder="01" maxLength={2} {...field} />
                )} />
                <Controller name="aliqCOFINS" control={control} render={({ field }) => (
                  <NumberInput label="Alíq. COFINS (%)" min={0} max={100} decimalScale={2} suffix="%" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
                )} />
              </div>
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
