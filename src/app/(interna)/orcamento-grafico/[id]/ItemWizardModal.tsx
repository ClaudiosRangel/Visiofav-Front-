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
  Modal, Stack, Stepper, Group, Button, Paper, LoadingOverlay, Divider,
} from '@mantine/core'
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import type { WizardFormData } from '../novo/page'
import { extrairTiragensDasObservacoes } from '../novo/page'
import StepTipo from '../novo/StepTipo'
import StepMedidas from '../novo/StepMedidas'
import StepPapel from '../novo/StepPapel'
import StepCores from '../novo/StepCores'
import StepAcabamentos from '../novo/StepAcabamentos'
import StepItensDiversos from '../novo/StepItensDiversos'
import StepDadosTecnicos from '../novo/StepDadosTecnicos'
import StepRevisao from '../novo/StepRevisao'
// Lógica compartilhada (extraída sem alterar comportamento) — a MESMA usada
// pelo EditorItem (experiência Calcgraf), para não duplicar salvar/hidratar.
import {
  INITIAL_ITEM,
  type ItemParaEditar,
  itemParaForm,
  salvarItem,
} from './itemFormShared'

// Re-exporta o tipo para compatibilidade com quem importa de ItemWizardModal.
export type { ItemParaEditar }

// Steps alinhados ao wizard /novo: "Produto" funde Tipo + Medidas + Papel numa
// única tela (antes eram 3 steps). 'Revisão' continua o último.
const STEP_LABELS = ['Produto', 'Cores', 'Dados Técnicos', 'Acabamentos', 'Diversos', 'Revisão']

interface Props {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  /** Item a editar; se ausente, o modal cria um item novo. */
  item?: ItemParaEditar | null
  /** Observações do orçamento (p/ extrair as tiragens da proposta e pré-preencher
   *  a grade de comparação da Revisão). */
  observacoesOrcamento?: string | null
  /** Imagem da faca do orçamento (dataURL) — exibida em Dados Técnicos e na Revisão. */
  imagemFacaOrcamento?: string | null
  /** Foto do produto cadastrado (URL) — exibida ao lado da faca. */
  imagemProdutoOrcamento?: string | null
  /** Chamado após salvar com sucesso (para a página recarregar o GET /:id). */
  onSaved: () => void
}

export default function ItemWizardModal({ opened, onClose, orcamentoId, item, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento, onSaved }: Props) {
  const isEditing = !!item
  const [active, setActive] = useState(0)
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_ITEM)
  const [saving, setSaving] = useState(false)

  // (Re)inicializa o estado sempre que o modal abre.
  useEffect(() => {
    if (!opened) return
    setActive(0)
    setFormData(
      item
        ? itemParaForm(item, orcamentoId, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento)
        : {
            ...INITIAL_ITEM,
            _faixasTiragemIniciais: extrairTiragensDasObservacoes(observacoesOrcamento) || null,
            _imagemFaca: imagemFacaOrcamento ?? null,
            _imagemProdutoUrl: imagemProdutoOrcamento ?? null,
          },
    )
  }, [opened, item, orcamentoId, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento])

  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }))
  }, [])

  const nextStep = () => setActive(prev => Math.min(prev + 1, STEP_LABELS.length - 1))
  const prevStep = () => setActive(prev => Math.max(prev - 1, 0))

  const canAdvance = (): boolean => {
    switch (active) {
      case 0: {
        // Produto = Tipo + Medidas + Papel (fundidos). Exige os três.
        if (!formData.tipoEmbalagemId) return false
        const params = (formData.tipoEmbalagem?.parametros as any[]) || []
        const medidasOk = params.filter((p: any) => p.obrigatorio).every((p: any) => formData.medidas[p.nome] > 0)
        // Em edição, o papel pode já estar resolvido no backend; não bloquear.
        const papelOk = isEditing || (!!formData.suporteId && !!formData.papelId && formData.gramatura > 0 && formData.precoKg > 0)
        return medidasOk && papelOk
      }
      case 1: return formData.cores.length > 0
      case 2: return true // Dados Técnicos é opcional
      case 3: return true // Acabamentos
      case 4: return true // Diversos é opcional
      case 5: return formData.quantidade > 0
      default: return true
    }
  }

  const salvar = async () => {
    setSaving(true)
    try {
      // Reaproveita a lógica compartilhada (mesmo payload/chamada do EditorItem).
      await salvarItem(orcamentoId, formData, isEditing ? item!.id : null)
      notifications.show(
        isEditing
          ? { title: 'Item atualizado', message: 'Item recalculado e salvo.', color: 'green' }
          : { title: 'Item adicionado', message: 'Novo item calculado e salvo.', color: 'green' },
      )

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

          {active === 0 && (
            // Step "Produto" — Tipo + Medidas + Papel numa única tela.
            <Stack gap="xl">
              <StepTipo formData={formData} updateForm={updateForm} />
              <Divider label="Medidas" labelPosition="center" />
              <StepMedidas formData={formData} updateForm={updateForm} />
              <Divider label="Papel / Cartão" labelPosition="center" />
              <StepPapel formData={formData} updateForm={updateForm} />
            </Stack>
          )}
          {active === 1 && <StepCores formData={formData} updateForm={updateForm} />}
          {active === 2 && <StepDadosTecnicos formData={formData} updateForm={updateForm} />}
          {active === 3 && <StepAcabamentos formData={formData} updateForm={updateForm} />}
          {active === 4 && <StepItensDiversos formData={formData} updateForm={updateForm} />}
          {active === 5 && <StepRevisao formData={formData} updateForm={updateForm} />}
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
