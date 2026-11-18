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
import { ActionIcon, Checkbox, Group, Loader, Paper, ScrollArea, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { IconBoxSeam, IconX } from '@tabler/icons-react'

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
    <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="acondicionamento-bloco">
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="grape" size={32} radius="md">
            <IconBoxSeam size={18} stroke={1.5} />
          </ThemeIcon>
          <Title order={5}>Acondicionamento</Title>
          {carregando && <Loader size="xs" />}
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default)">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
              Opções
            </Text>
            <ScrollArea.Autosize mah={220}>
              {opcoes.length === 0 ? (
                <Text size="sm" c="dimmed" data-testid="acondicionamento-sem-opcoes">
                  {carregando ? 'Carregando…' : 'Este produto não tem acondicionamento cadastrado.'}
                </Text>
              ) : (
                <Stack gap={6}>
                  {opcoes.map((o) => (
                    <Checkbox
                      key={o.id}
                      label={o.nome}
                      disabled={disabled}
                      checked={estaEscolhido(value.escolhidos, o.nome)}
                      onChange={(e) =>
                        onChange({
                          escolhidos: e.currentTarget.checked
                            ? escolher(value.escolhidos, o.nome)
                            : descartar(value.escolhidos, o.nome),
                        })
                      }
                    />
                  ))}
                </Stack>
              )}
            </ScrollArea.Autosize>
          </Paper>

          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default)">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
              Escolhidos
            </Text>
            <ScrollArea.Autosize mah={220}>
              {value.escolhidos.length === 0 ? (
                <Text size="sm" c="dimmed" data-testid="acondicionamento-sem-escolhidos">
                  Nenhum acondicionamento escolhido.
                </Text>
              ) : (
                <Stack gap={6}>
                  {value.escolhidos.map((e) => (
                    <Group key={e.descricao} justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" lineClamp={1}>
                        {e.descricao}
                      </Text>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        aria-label={`Remover ${e.descricao}`}
                        disabled={disabled}
                        onClick={() => onChange({ escolhidos: descartar(value.escolhidos, e.descricao) })}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )}
            </ScrollArea.Autosize>
          </Paper>
        </SimpleGrid>

        <TextInput
          label="Conteúdo por volume"
          placeholder="Ex.: 500"
          inputMode="numeric"
          description="Inteiro de 1 a 999.999"
          value={value.conteudoVolume}
          onChange={(e) => onChange({ conteudoVolume: e.currentTarget.value })}
          error={erros.conteudoVolume}
          disabled={disabled}
          maw={260}
        />
      </Stack>
    </Paper>
  )
}
