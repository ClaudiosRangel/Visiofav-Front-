'use client'

/**
 * ItemWizardModal — editor de UM item de orçamento gráfico, embutido num Modal.
 *
 * Reaproveita os Steps existentes do wizard `../novo/` (Tipo → Medidas → Papel →
 * Cores → Acabamentos → Revisão). O Step "Cliente" NÃO é usado aqui: cliente/
 * vendedor são do cabeçalho do orçamento, não do item.
 *
 * Criar item  → POST  /orcamento-grafico/:id/itens
 * Editar item → PUT   /orcamento-grafico/:id/itens/:itemId
 *
 * O payload segue o `itemOrcamentoBodySchema` do backend (mesmos campos que o
 * wizard `/novo` já envia). O cálculo é do backend — este componente apenas
 * coleta os parâmetros do item e os envia.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Modal, Stack, Stepper, Group, Button, Paper, LoadingOverlay,
} from '@mantine/core'
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

import type { WizardFormData, CorItem, AcabamentoItem } from '../novo/page'
import StepTipo from '../novo/StepTipo'
import StepMedidas from '../novo/StepMedidas'
import StepPapel from '../novo/StepPapel'
import StepCores from '../novo/StepCores'
import StepAcabamentos from '../novo/StepAcabamentos'
import StepItensDiversos from '../novo/StepItensDiversos'
import StepRevisao from '../novo/StepRevisao'

// ============================================================================
// Estado inicial do item (espelha o INITIAL_FORM do wizard, sem campos de
// cliente, que são do cabeçalho).
// ============================================================================

const INITIAL_ITEM: WizardFormData = {
  clienteId: null,
  clienteNome: '',
  vendedorId: null,
  produtoId: null,
  produtoNome: '',
  tipoEmbalagemId: null,
  tipoEmbalagem: null,
  medidas: {},
  suporteId: null,
  suporteNome: '',
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
  acabamentosRicos: [],
  quantidade: 10000,
  tabelaMargemId: null,
  maquinaId: null,
  aproveitamentoManual: null,
  modeloFacaId: null,
  matrizQuantidade: null,
  matrizPrecoUnitario: null,
  tintaModo: 'COBERTURA',
  tintaConsumoKg: null,
  tintaPrecoKg: null,
  itensDiversos: [],
  itensFornecidos: [],
  camposLivres: [],
}

const STEP_LABELS = ['Tipo', 'Medidas', 'Papel', 'Cores', 'Acabamentos', 'Diversos', 'Revisão']

export interface ItemParaEditar {
  id: string
  tipoEmbalagemId: string
  tipoEmbalagem?: any | null
  medidas?: Record<string, number> | null
  papelId?: string | null
  papelDescricao?: string | null
  suporteId?: string | null
  gramatura?: number | string | null
  numCores?: number
  cores?: any[] | null
  acabamentosRicos?: any[] | null
  maquinaId?: string | null
  aproveitamentoManual?: number | null
  modeloFacaId?: string | null
  // Fase 4 — matriz / tinta / itens complementares
  matrizQuantidade?: number | string | null
  matrizPrecoUnitario?: number | string | null
  tintaModo?: 'COBERTURA' | 'CONSUMO_DIRETO' | null
  tintaConsumoKg?: number | string | null
  itensDiversos?: Array<{ descricao: string; quantidade: number; valor: number; fixo: boolean }> | null
  itensFornecidos?: Array<{ descricao: string; quantidade: number }> | null
  camposLivres?: Array<{ rotulo: string; conteudo: string }> | null
  quantidade: number
  resultadoCalculo?: { papel?: { precoKg?: number } } | null
}

interface Props {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  /** Item a editar; se ausente, o modal cria um item novo. */
  item?: ItemParaEditar | null
  /** Chamado após salvar com sucesso (para a página recarregar o GET /:id). */
  onSaved: () => void
}

/** Mapeia um item carregado da API de volta para o WizardFormData. */
function itemParaForm(item: ItemParaEditar): WizardFormData {
  const coresMapeadas: CorItem[] = (item.cores || []).map((c: any) => ({
    nome: c.nome,
    tipo: c.tipo,
    coberturaPercent: c.coberturaPercent,
    precoKg: c.precoKg ?? 45,
    rendimentoM2Kg: c.rendimentoM2Kg ?? 15000,
  }))

  let precoKgCarregado = 0
  if (item.resultadoCalculo?.papel?.precoKg) {
    precoKgCarregado = Number(item.resultadoCalculo.papel.precoKg)
  }
  if (precoKgCarregado <= 0) precoKgCarregado = 4.5

  return {
    ...INITIAL_ITEM,
    tipoEmbalagemId: item.tipoEmbalagemId ?? null,
    tipoEmbalagem: item.tipoEmbalagem ?? null,
    medidas: item.medidas ?? {},
    suporteId: item.suporteId ?? null,
    papelId: item.papelId ?? null,
    papelDescricao: item.papelDescricao ?? '',
    gramatura: item.gramatura ? Number(item.gramatura) : 0,
    precoKg: precoKgCarregado,
    cores: coresMapeadas.length > 0 ? coresMapeadas : INITIAL_ITEM.cores,
    acabamentosRicos: (item.acabamentosRicos as any) ?? [],
    quantidade: item.quantidade ?? 10000,
    maquinaId: item.maquinaId ?? null,
    aproveitamentoManual: item.aproveitamentoManual ?? null,
    modeloFacaId: item.modeloFacaId ?? null,
    // Fase 4 — matriz / tinta / itens complementares
    matrizQuantidade: item.matrizQuantidade != null ? Number(item.matrizQuantidade) : null,
    matrizPrecoUnitario: item.matrizPrecoUnitario != null ? Number(item.matrizPrecoUnitario) : null,
    tintaModo: item.tintaModo ?? 'COBERTURA',
    tintaConsumoKg: item.tintaConsumoKg != null ? Number(item.tintaConsumoKg) : null,
    tintaPrecoKg: null, // não vem da API
    itensDiversos: (item.itensDiversos as any) ?? [],
    itensFornecidos: (item.itensFornecidos as any) ?? [],
    camposLivres: (item.camposLivres as any) ?? [],
  }
}

export default function ItemWizardModal({ opened, onClose, orcamentoId, item, onSaved }: Props) {
  const isEditing = !!item
  const [active, setActive] = useState(0)
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_ITEM)
  const [saving, setSaving] = useState(false)

  // (Re)inicializa o estado sempre que o modal abre.
  useEffect(() => {
    if (!opened) return
    setActive(0)
    setFormData(item ? itemParaForm(item) : INITIAL_ITEM)
  }, [opened, item])

  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }))
  }, [])

  const nextStep = () => setActive(prev => Math.min(prev + 1, STEP_LABELS.length - 1))
  const prevStep = () => setActive(prev => Math.max(prev - 1, 0))

  const canAdvance = (): boolean => {
    switch (active) {
      case 0: return !!formData.tipoEmbalagemId
      case 1: {
        if (!formData.tipoEmbalagem?.parametros) return true
        const params = formData.tipoEmbalagem.parametros as any[]
        return params.filter((p: any) => p.obrigatorio).every((p: any) => formData.medidas[p.nome] > 0)
      }
      // Em edição, o papel pode já estar resolvido no backend; não bloquear.
      case 2: return isEditing || (!!formData.suporteId && !!formData.papelId && formData.gramatura > 0 && formData.precoKg > 0)
      case 3: return formData.cores.length > 0
      case 4: return true
      case 5: return true // Diversos é opcional
      case 6: return formData.quantidade > 0
      default: return true
    }
  }

  const salvar = async () => {
    setSaving(true)
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter((a: AcabamentoItem) => a.ativo)
        .map((a: AcabamentoItem) => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const payload = {
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        suporteId: formData.suporteId || undefined,
        papelId: formData.papelId || undefined,
        papelDescricao: formData.papelDescricao || undefined,
        gramatura: formData.gramatura,
        precoKg: formData.precoKg,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        acabamentosRicos: formData.acabamentosRicos?.length ? formData.acabamentosRicos : undefined,
        quantidade: formData.quantidade,
        tabelaMargemId: formData.tabelaMargemId || undefined,
        maquinaId: formData.maquinaId || undefined,
        aproveitamentoManual: formData.aproveitamentoManual || undefined,
        modeloFacaId: formData.modeloFacaId || undefined,
        // Fase 4 — matriz / tinta / itens complementares
        matriz: (formData.matrizQuantidade ?? 0) > 0
          ? { quantidade: formData.matrizQuantidade as number, precoUnitario: formData.matrizPrecoUnitario ?? 0 }
          : undefined,
        tinta: formData.tintaModo === 'CONSUMO_DIRETO'
          ? { modo: 'CONSUMO_DIRETO' as const, consumoKg: formData.tintaConsumoKg ?? 0, precoKg: formData.tintaPrecoKg ?? 0 }
          : { modo: 'COBERTURA' as const },
        itensDiversos: formData.itensDiversos?.length ? formData.itensDiversos : undefined,
        itensFornecidos: formData.itensFornecidos?.length ? formData.itensFornecidos : undefined,
        camposLivres: formData.camposLivres?.length ? formData.camposLivres : undefined,
      }

      if (isEditing) {
        await api.put(`/orcamento-grafico/${orcamentoId}/itens/${item!.id}`, payload)
        notifications.show({ title: 'Item atualizado', message: 'Item recalculado e salvo.', color: 'green' })
      } else {
        await api.post(`/orcamento-grafico/${orcamentoId}/itens`, payload)
        notifications.show({ title: 'Item adicionado', message: 'Novo item calculado e salvo.', color: 'green' })
      }

      onSaved()
      onClose()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao salvar item',
        message: err?.response?.data?.message || 'Falha ao salvar o item do orçamento.',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Editar Item do Orçamento' : 'Novo Item do Orçamento'}
      size="xl"
      fullScreen
      styles={{ body: { paddingBottom: 0 } }}
    >
      <Stack gap="lg">
        <Paper shadow="xs" p="md" pos="relative">
          <LoadingOverlay visible={saving} />

          <Stepper active={active} onStepClick={setActive} size="sm" mb="xl">
            {STEP_LABELS.map((label, i) => (
              <Stepper.Step key={i} label={label} />
            ))}
          </Stepper>

          {active === 0 && <StepTipo formData={formData} updateForm={updateForm} />}
          {active === 1 && <StepMedidas formData={formData} updateForm={updateForm} />}
          {active === 2 && <StepPapel formData={formData} updateForm={updateForm} />}
          {active === 3 && <StepCores formData={formData} updateForm={updateForm} />}
          {active === 4 && <StepAcabamentos formData={formData} updateForm={updateForm} />}
          {active === 5 && <StepItensDiversos formData={formData} updateForm={updateForm} />}
          {active === 6 && <StepRevisao formData={formData} updateForm={updateForm} />}
        </Paper>

        <Group justify="space-between" pb="md">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={prevStep}
            disabled={active === 0 || saving}
          >
            Anterior
          </Button>

          <Group>
            <Button variant="subtle" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            {active === STEP_LABELS.length - 1 ? (
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={salvar}
                loading={saving}
              >
                {isEditing ? 'Salvar Item' : 'Adicionar Item'}
              </Button>
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
    </Modal>
  )
}
