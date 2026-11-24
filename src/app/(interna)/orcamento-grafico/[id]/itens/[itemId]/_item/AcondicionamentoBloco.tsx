'use client'

/**
 * AcondicionamentoBloco — Acondicionamento do Item: duas listas e o Conteúdo por volume.
 *
 *  - Lista 1 "Opções": acondicionamentos do cadastro do produto (ex.: Caixa Padrão, Embalar), marcáveis.
 *  - Lista 2 "Escolhidos": o que ficou marcado, na ordem da escolha, com remoção individual.
 *    Valores já gravados que não estão mais nas opções do cadastro continuam aparecendo (e podem sair).
 *  - Conteúdo por volume: inteiro de 1 a 999.999 (vazio permitido).
 *
 * Componente CONTROLADO (`value`/`onChange`): sem estado de dados próprio, sem gravação, sem rede.
 * As opções chegam por prop (catálogo do produto, lido por hook no pai).
 */

import { useMemo } from 'react'
import { Checkbox, Group, Loader, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconBoxSeam } from '@tabler/icons-react'
import CartaoSecao from './CartaoSecao'

import {
  descartar,
  escolher,
  estaEscolhido,
  validarAcondicionamento,
  type ValorAcondicionamento,
} from './produto-final-item'

export interface OpcaoAcondicionamento {
  id: string
  nome: string
}

export interface AcondicionamentoBlocoProps {
  value: ValorAcondicionamento
  onChange: (parcial: Partial<ValorAcondicionamento>) => void
  /** Acondicionamentos do cadastro do produto. */
  opcoes: ReadonlyArray<OpcaoAcondicionamento>
  /** O catálogo do produto ainda está carregando. */
  carregando?: boolean
  disabled?: boolean
}

export default function AcondicionamentoBloco({ value, onChange, opcoes, carregando, disabled }: AcondicionamentoBlocoProps) {
  const { erros } = useMemo(() => validarAcondicionamento(value), [value])

  return (
    <CartaoSecao
      titulo="Acondicionamento"
      icone={<IconBoxSeam size={16} />}
      direita={carregando ? <Loader size="xs" /> : undefined}
      data-testid="acondicionamento-bloco"
    >
      <Stack gap="md">
        {(() => {
          // Opções do cadastro + escolhas gravadas que o cadastro não traz mais (continuam marcáveis).
          const extras = value.escolhidos
            .filter((e) => !opcoes.some((o) => o.nome === e.descricao))
            .map((e) => ({ id: `gravado:${e.descricao}`, nome: e.descricao }))
          const lista = [...opcoes, ...extras]
          if (lista.length === 0) {
            return (
              <Text size="sm" c="dimmed" data-testid="acondicionamento-sem-opcoes">
                {carregando ? 'Carregando…' : 'Este produto não tem acondicionamento cadastrado.'}
              </Text>
            )
          }
          return (
            <ScrollArea.Autosize
              mah={220}
              type="auto"
              style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}
            >
              <Stack gap={0}>
                {lista.map((o, i) => {
                  const marcado = estaEscolhido(value.escolhidos, o.nome)
                  return (
                    <Group
                      key={o.id}
                      justify="space-between"
                      wrap="nowrap"
                      px="sm"
                      py={8}
                      bg={marcado ? 'var(--mantine-primary-color-light)' : undefined}
                      style={i > 0 ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}
                    >
                      <Checkbox
                        label={o.nome}
                        disabled={disabled}
                        checked={marcado}
                        onChange={(e) =>
                          onChange({
                            escolhidos: e.currentTarget.checked
                              ? escolher(value.escolhidos, o.nome)
                              : descartar(value.escolhidos, o.nome),
                          })
                        }
                      />
                      {o.id.startsWith('gravado:') && (
                        <Text size="xs" c="dimmed">
                          fora do cadastro
                        </Text>
                      )}
                    </Group>
                  )
                })}
              </Stack>
            </ScrollArea.Autosize>
          )
        })()}

        <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Text size="sm" fw={600} mt={6}>
              Conteúdo por volume
            </Text>
            <TextInput
              aria-label="Conteúdo por volume"
              placeholder="0"
              inputMode="numeric"
              value={value.conteudoVolume}
              onChange={(e) => onChange({ conteudoVolume: e.currentTarget.value })}
              error={erros.conteudoVolume}
              disabled={disabled}
              rightSection={<Text size="xs" c="dimmed">un.</Text>}
              w={150}
              styles={{ input: { textAlign: 'right' } }}
            />
          </Group>
        </Paper>
      </Stack>
    </CartaoSecao>
  )
}
