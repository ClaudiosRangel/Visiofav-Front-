'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Title, Stack, Stepper, Group, Button, Paper, Container, LoadingOverlay,
} from '@mantine/core'
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy, IconSend } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

import StepCliente from './StepCliente'
import StepTipo from './StepTipo'
import StepMedidas from './StepMedidas'
import StepPapel from './StepPapel'
import StepCores from './StepCores'
import StepAcabamentos from './StepAcabamentos'
import StepRevisao from './StepRevisao'

// ============================================================================
// Tipos do Wizard
// ============================================================================

export interface CorItem {
  nome: string
  tipo: 'CMYK' | 'PANTONE'
  coberturaPercent: number
  precoKg: number
  rendimentoM2Kg: number
}

export interface AcabamentoItem {
  tipo: string
  label: string
  ativo: boolean
  custoHora: number
  velocidade: number
  custoMaterialM2: number
}

export interface WizardFormData {
  // Step 1 — Cliente
  clienteId: string | null
  clienteNome: string
  vendedorId: string | null
  // Step 2 — Tipo
  tipoEmbalagemId: string | null
  tipoEmbalagem: any | null
  // Step 3 — Medidas
  medidas: Record<string, number>
  // Step 4 — Papel
  papelId: string | null
  papelDescricao: string
  gramatura: number
  precoKg: number
  // Step 5 — Cores
  cores: CorItem[]
  // Step 6 — Acabamentos
  acabamentos: AcabamentoItem[]
  // Step 7 — Revisão
  quantidade: number
  tabelaMargemId: string | null
}

const INITIAL_FORM: WizardFormData = {
  clienteId: null,
  clienteNome: '',
  vendedorId: null,
  tipoEmbalagemId: null,
  tipoEmbalagem: null,
  medidas: {},
  papelId: null,
  papelDescricao: '',
  gramatura: 0,
  precoKg: 0,
  cores: [
    { nome: 'Ciano', tipo: 'CMYK', coberturaPercent: 30, precoKg: 45, rendimentoM2Kg: 15000 },
    { nome: 'Magenta', tipo: 'CMYK', coberturaPercent: 30, precoKg: 45, rendimentoM2Kg: 15000 },
    { nome: 'Amarelo', tipo: 'CMYK', coberturaPercent: 30, precoKg: 40, rendimentoM2Kg: 15000 },
    { nome: 'Preto', tipo: 'CMYK', coberturaPercent: 40, precoKg: 35, rendimentoM2Kg: 18000 },
  ],
  acabamentos: [
    { tipo: 'CORTE_VINCO', label: 'Corte e Vinco', ativo: true, custoHora: 180, velocidade: 4000, custoMaterialM2: 0 },
    { tipo: 'COLAGEM', label: 'Colagem', ativo: true, custoHora: 150, velocidade: 8000, custoMaterialM2: 0 },
    { tipo: 'VERNIZ_UV', label: 'Verniz UV', ativo: false, custoHora: 200, velocidade: 5000, custoMaterialM2: 0.12 },
    { tipo: 'LAMINACAO_BOPP', label: 'Laminação BOPP', ativo: false, custoHora: 220, velocidade: 3000, custoMaterialM2: 0.18 },
    { tipo: 'HOT_STAMPING', label: 'Hot Stamping', ativo: false, custoHora: 250, velocidade: 2000, custoMaterialM2: 0.25 },
  ],
  quantidade: 10000,
  tabelaMargemId: null,
}

const STEP_LABELS = ['Cliente', 'Tipo', 'Medidas', 'Papel', 'Cores', 'Acabamentos', 'Revisão']

export default function NovoOrcamentoGraficoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('editId')
  const isEditing = !!editId

  const [active, setActive] = useState(0)
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

  // Carregar dados do orçamento existente quando em modo edição
  useEffect(() => {
    if (!editId) return

    const carregarOrcamento = async () => {
      setLoadingEdit(true)
      try {
        const { data } = await api.get(`/orcamento-grafico/${editId}`)

        // Mapear cores da API para CorItem[]
        const coresMapeadas: CorItem[] = (data.cores || []).map((c: any) => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg ?? 45,
          rendimentoM2Kg: c.rendimentoM2Kg ?? 15000,
        }))

        // Mapear acabamentos da API para AcabamentoItem[]
        const acabamentosDaApi = data.acabamentos || []
        const acabamentosMapeados: AcabamentoItem[] = INITIAL_FORM.acabamentos.map(acabDefault => {
          const encontrado = acabamentosDaApi.find((a: any) => a.tipo === acabDefault.tipo)
          if (encontrado) {
            return {
              ...acabDefault,
              ativo: true,
              custoHora: encontrado.custoHora ?? acabDefault.custoHora,
              velocidade: encontrado.velocidade ?? acabDefault.velocidade,
              custoMaterialM2: encontrado.custoMaterialM2 ?? acabDefault.custoMaterialM2,
            }
          }
          return { ...acabDefault, ativo: false }
        })

        // Acabamentos da resposta que não estão no default
        for (const acab of acabamentosDaApi) {
          const jaExiste = acabamentosMapeados.some(a => a.tipo === acab.tipo)
          if (!jaExiste) {
            acabamentosMapeados.push({
              tipo: acab.tipo,
              label: acab.tipo,
              ativo: true,
              custoHora: acab.custoHora ?? 0,
              velocidade: acab.velocidade ?? 0,
              custoMaterialM2: acab.custoMaterialM2 ?? 0,
            })
          }
        }

        const formCarregado: WizardFormData = {
          clienteId: data.clienteId ?? null,
          clienteNome: data.clienteNome ?? '',
          vendedorId: data.vendedorId ?? null,
          tipoEmbalagemId: data.tipoEmbalagemId ?? null,
          tipoEmbalagem: data.tipoEmbalagem ?? null,
          medidas: data.medidas ?? {},
          papelId: data.papelId ?? null,
          papelDescricao: data.papelDescricao ?? '',
          gramatura: data.gramatura ?? 0,
          precoKg: 0, // não vem da API, usuário re-informa
          cores: coresMapeadas.length > 0 ? coresMapeadas : INITIAL_FORM.cores,
          acabamentos: acabamentosMapeados,
          quantidade: data.quantidade ?? 10000,
          tabelaMargemId: formData.tabelaMargemId,
        }

        setFormData(formCarregado)
      } catch (err: any) {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Erro ao carregar orçamento para edição.',
          color: 'red',
        })
      } finally {
        setLoadingEdit(false)
      }
    }

    carregarOrcamento()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }))
  }, [])

  // Navegação
  const nextStep = () => setActive(prev => Math.min(prev + 1, 6))
  const prevStep = () => setActive(prev => Math.max(prev - 1, 0))

  // Validação simples por step
  const canAdvance = (): boolean => {
    switch (active) {
      case 0: return !!(formData.clienteId || formData.clienteNome.trim())
      case 1: return !!formData.tipoEmbalagemId
      case 2: {
        if (!formData.tipoEmbalagem?.parametros) return true
        const params = formData.tipoEmbalagem.parametros as any[]
        return params.filter((p: any) => p.obrigatorio).every((p: any) => formData.medidas[p.nome] > 0)
      }
      case 3: return formData.gramatura > 0 && formData.precoKg > 0
      case 4: return formData.cores.length > 0
      case 5: return true
      case 6: return formData.quantidade > 0
      default: return true
    }
  }

  // Salvar orçamento
  const salvar = async (enviar: boolean) => {
    setSaving(true)
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter(a => a.ativo)
        .map(a => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const payload = {
        clienteId: formData.clienteId || undefined,
        clienteNome: formData.clienteNome || undefined,
        vendedorId: formData.vendedorId || undefined,
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        papelId: formData.papelId || undefined,
        papelDescricao: formData.papelDescricao || undefined,
        gramatura: formData.gramatura,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        quantidade: formData.quantidade,
        tabelaMargemId: formData.tabelaMargemId || undefined,
        precoKg: formData.precoKg,
      }

      const { data } = isEditing
        ? await api.put(`/orcamento-grafico/${editId}`, payload)
        : await api.post('/orcamento-grafico', payload)
      const orcamentoId = data.id

      if (enviar) {
        await api.post(`/orcamento-grafico/${orcamentoId}/enviar`)
        notifications.show({ title: 'Proposta enviada', message: 'Proposta enviada com sucesso!', color: 'green' })
      } else {
        notifications.show({ title: 'Salvo', message: 'Orçamento salvo como rascunho.', color: 'blue' })
      }

      router.push(`/orcamento-grafico/${orcamentoId}`)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao salvar orçamento.',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <Title order={2}>{isEditing ? 'Editar Orçamento Gráfico' : 'Novo Orçamento Gráfico'}</Title>

        <Paper shadow="xs" p="md" pos="relative">
          <LoadingOverlay visible={saving || loadingEdit} />

          <Stepper active={active} onStepClick={setActive} size="sm" mb="xl">
            {STEP_LABELS.map((label, i) => (
              <Stepper.Step key={i} label={label} />
            ))}
          </Stepper>

          {active === 0 && <StepCliente formData={formData} updateForm={updateForm} />}
          {active === 1 && <StepTipo formData={formData} updateForm={updateForm} />}
          {active === 2 && <StepMedidas formData={formData} updateForm={updateForm} />}
          {active === 3 && <StepPapel formData={formData} updateForm={updateForm} />}
          {active === 4 && <StepCores formData={formData} updateForm={updateForm} />}
          {active === 5 && <StepAcabamentos formData={formData} updateForm={updateForm} />}
          {active === 6 && <StepRevisao formData={formData} updateForm={updateForm} />}
        </Paper>

        {/* Navigation */}
        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={prevStep}
            disabled={active === 0}
          >
            Anterior
          </Button>

          <Group>
            {active === 6 ? (
              <>
                <Button
                  variant="outline"
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={() => salvar(false)}
                  loading={saving}
                >
                  Salvar Rascunho
                </Button>
                <Button
                  leftSection={<IconSend size={16} />}
                  onClick={() => salvar(true)}
                  loading={saving}
                >
                  Enviar Proposta
                </Button>
              </>
            ) : (
              <Button
                rightSection={<IconArrowRight size={16} />}
                onClick={nextStep}
                disabled={!canAdvance()}
              >
                Próximo
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Container>
  )
}
