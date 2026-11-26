'use client'

/**
 * PreImpressaoModal — janela "Pré-Impressão" aberta pelo botão Pré: CTP, Fotolito, Contatos e Montagem.
 * Só grava a escolha no item/plano (`onConfirmar`); não altera o preço. Inclui o atalho para aplicar o
 * processo de impressão padrão do produto, que era a função antiga do botão Pré.
 */

import { useEffect, useState } from 'react'
import { Button, Checkbox, Group, Modal, Select, Stack, Text } from '@mantine/core'

import {
  OPCOES_CONTATOS,
  OPCOES_FOTOLITO,
  OPCOES_MONTAGEM,
  PRE_IMPRESSAO_PADRAO,
  type OpcaoContatos,
  type OpcaoFotolito,
  type OpcaoMontagem,
  type PreImpressao,
} from './pre-impressao'

export interface PreImpressaoModalProps {
  opened: boolean
  onClose: () => void
  /** Valor atual (null = ainda não definido: a janela abre com o padrão). */
  value: PreImpressao | null | undefined
  onConfirmar: (valor: PreImpressao) => void
  /** Processo de impressão padrão do produto; habilita "Aplicar o processo padrão". */
  processoPadrao?: string | null
  onAplicarProcessoPadrao?: (processo: string) => void
  disabled?: boolean
}

export default function PreImpressaoModal({
  opened,
  onClose,
  value,
  onConfirmar,
  processoPadrao,
  onAplicarProcessoPadrao,
  disabled,
}: PreImpressaoModalProps) {
  const [form, setForm] = useState<PreImpressao>(value ?? PRE_IMPRESSAO_PADRAO)

  useEffect(() => {
    if (opened) setForm(value ?? PRE_IMPRESSAO_PADRAO)
  }, [opened, value])

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Pré-Impressão</Text>} size="sm" centered>
      <Stack gap="sm">
        <Checkbox
          label="CTP"
          checked={form.ctp}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, ctp: e.currentTarget.checked })}
        />
        <Select
          label="Fotolito"
          data={[...OPCOES_FOTOLITO]}
          value={form.fotolito}
          allowDeselect={false}
          disabled={disabled}
          onChange={(v) => v && setForm({ ...form, fotolito: v as OpcaoFotolito })}
          comboboxProps={{ withinPortal: true }}
        />
        <Select
          label="Contatos"
          data={[...OPCOES_CONTATOS]}
          value={form.contatos}
          allowDeselect={false}
          disabled={disabled}
          onChange={(v) => v && setForm({ ...form, contatos: v as OpcaoContatos })}
          comboboxProps={{ withinPortal: true }}
        />
        <Select
          label="Montagem"
          data={[...OPCOES_MONTAGEM]}
          value={form.montagem}
          allowDeselect={false}
          disabled={disabled}
          onChange={(v) => v && setForm({ ...form, montagem: v as OpcaoMontagem })}
          comboboxProps={{ withinPortal: true }}
        />
        <Text size="xs" c="dimmed">
          Estas escolhas ficam registradas no item e seguem para a Pré-Impressão. Não alteram o preço.
        </Text>
        <Group justify="space-between">
          {processoPadrao && onAplicarProcessoPadrao ? (
            <Button
              variant="subtle"
              size="xs"
              disabled={disabled}
              onClick={() => {
                onAplicarProcessoPadrao(processoPadrao)
                onClose()
              }}
            >
              Aplicar o processo padrão ({processoPadrao})
            </Button>
          ) : (
            <span />
          )}
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                onConfirmar(form)
                onClose()
              }}
            >
              Confirmar
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
