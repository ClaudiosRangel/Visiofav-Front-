'use client'

/**
 * SecaoProduto — seção "Produto" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.1)
 * _Requirements: 1.1, 1.5, 1.6_
 *
 * Agrupa numa única seção os sub-forms de engenharia de PRODUTO que no wizard
 * atual (`../../novo/`) eram três telas separadas: Tipo → Medidas → Papel.
 * Replica a composição do step 0 ("Produto") do `ItemWizardModal` — os três
 * `Step*` empilhados num `Stack`, com `Divider` separando as subdivisões
 * "Medidas" e "Papel / Cartão".
 *
 * Componente de APRESENTAÇÃO: apenas compõe os sub-forms existentes e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo, salvamento ou recálculo
 * implícito. O título da seção fica a cargo do `EditorItem` (não é repetido
 * aqui).
 */

import { Stack, Divider, Paper, Group, Image, ThemeIcon, Text, Badge } from '@mantine/core'
import { IconPackage } from '@tabler/icons-react'

import type { WizardFormData } from '../../novo/page'
import StepTipo from '../../novo/StepTipo'
import StepMedidas from '../../novo/StepMedidas'
import StepPapel from '../../novo/StepPapel'
import type { CampoCondicional } from './campos-por-linha'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /**
   * Campos condicionais por Linha de Produto a exibir. Recebido do EditorItem
   * para consistência de assinatura; a ocultação de campos condicionais da
   * seção Produto (ex.: alça/fundo) fica para depois — os campos condicionais
   * mapeáveis hoje vivem em Dados Técnicos (ver SecaoDadosTecnicos). A seção
   * Produto segue exibindo Tipo/Medidas/Papel na íntegra.
   */
  mostrarCampo?: (campo: CampoCondicional) => boolean
}

export default function SecaoProduto({ formData, updateForm }: Props) {
  // Resumo do produto/embalagem selecionado (informação do produto no topo da
  // seção — Req 4). Usa o tipo de embalagem escolhido + nome/foto do produto
  // cadastrado quando houver. Estado vazio quando nada foi selecionado ainda.
  const tipo = formData.tipoEmbalagem as { descricao?: string; codigo?: string } | null | undefined
  const nomeProduto = formData.produtoNome?.trim() || undefined
  const fotoProduto = formData._imagemProdutoUrl
  const temProduto = !!(tipo?.descricao || nomeProduto || fotoProduto)

  return (
    <Stack gap="xl">
      {/* Resumo "Informação do Produto" */}
      <Paper withBorder p="md" bg="var(--mantine-color-default)">
        {temProduto ? (
          <Group gap="md" wrap="nowrap">
            {fotoProduto ? (
              <Image src={fotoProduto} alt={nomeProduto ?? 'Produto'} w={56} h={56} fit="contain" radius="sm" />
            ) : (
              <ThemeIcon variant="light" color="gray" size={56} radius="sm">
                <IconPackage size={32} stroke={1.5} />
              </ThemeIcon>
            )}
            <div style={{ flex: 1 }}>
              <Text size="xs" c="dimmed">Produto deste orçamento</Text>
              <Text fw={600}>{nomeProduto ?? tipo?.descricao ?? 'Produto'}</Text>
              {tipo?.descricao && (
                <Group gap={6} mt={4}>
                  <Badge size="sm" variant="light" color="teal">{tipo.descricao}</Badge>
                  {tipo.codigo && <Badge size="sm" variant="light" color="gray">{tipo.codigo}</Badge>}
                </Group>
              )}
            </div>
          </Group>
        ) : (
          <Group gap="md" wrap="nowrap">
            <ThemeIcon variant="light" color="gray" size={56} radius="sm">
              <IconPackage size={32} stroke={1.5} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Nenhum produto selecionado</Text>
              <Text size="sm" c="dimmed">Escolha o Tipo de Embalagem abaixo para montar o produto.</Text>
            </div>
          </Group>
        )}
      </Paper>

      <StepTipo formData={formData} updateForm={updateForm} />
      <Divider label="Medidas" labelPosition="center" />
      <StepMedidas formData={formData} updateForm={updateForm} />
      <Divider label="Papel / Cartão" labelPosition="center" />
      <StepPapel formData={formData} updateForm={updateForm} />
    </Stack>
  )
}
