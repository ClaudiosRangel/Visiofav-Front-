'use client'

/**
 * RestricoesEMateriais — Restrições e Materiais da atividade em foco (R11).
 *
 * Duas listas lado a lado, cada uma com título próprio: Restrições (`RestricaoAcabamento`) e
 * Materiais (`MaterialAcabamento`), lidas por `useRestricoesMateriais` (catálogo do plano ou
 * consulta da atividade). Estados: sem atividade em foco (texto de orientação), carregando, erro com
 * "Tentar novamente" (as seleções do item não são tocadas), vazio ("Nenhuma restrição cadastrada",
 * "Nenhum material cadastrado") e, com `restricoesRecolhidas`, a lista de Restrições aparece
 * recolhida mostrando só o título e a quantidade, com expandir/recolher.
 *
 * Componente CONTROLADO: não grava nada por conta própria. A escolha de restrição e de material sai
 * por `onRestricaoChange`/`onMaterialChange` (quem usa grava pelas estruturas existentes). O campo de
 * parâmetro do material tem o rótulo do `tipoParam` e só é enviado quando passa na validação; se a
 * gravação falhar (`onMaterialChange` devolve `false`), os campos voltam ao valor da seleção anterior.
 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Anchor, Badge, Button, Checkbox, Group, Loader, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

import { useRestricoesMateriais } from '../../../_hooks/useRestricoesMateriais'
import type { CatalogoPlano } from '../../../../cadastros/_shared/cadastros-graficos.types'
import type { ErroSelecaoMaterial } from '../../../editor/catalogo/catalogo-puro'
import type { EscolhaAtual, RestricaoEscolhida } from './acabamento-item'
import {
  camposDoMaterial,
  escolhaDosParametros,
  escolhaInicial,
  mesmaEscolha,
  rascunhoDaSelecao,
  rascunhoVazio,
  type ErrosParametros,
  type EscolhaMaterial,
  type RascunhoParametros,
} from './parametro-material'

export const TEXTO_SEM_ATIVIDADE = 'Selecione uma atividade para ver as restrições e os materiais.'
export const TEXTO_SEM_RESTRICAO = 'Nenhuma restrição cadastrada'
export const TEXTO_SEM_MATERIAL = 'Nenhum material cadastrado'
export const TEXTO_MARCAR_ATIVIDADE = 'Marque a atividade para escolher restrição ou material.'
export const TEXTO_NAO_GRAVADA = 'A seleção não foi gravada. O valor anterior foi mantido.'

export interface RestricoesEMateriaisProps {
  /** Atividade em foco (null = nenhuma). Troque a `key` ao mudar de atividade. */
  atividade: { id: string; nome: string } | null
  /** A atividade está marcada no item; só então dá para escolher restrição e material. */
  marcada?: boolean
  /** Catálogo do plano fixo (evita consulta quando a atividade está nele). */
  catalogoDoPlano?: Pick<CatalogoPlano, 'atividades'> | null
  /** Restrições recolhidas ao abrir (cadastro do produto com `exibeRestricoes` falso). */
  restricoesRecolhidas?: boolean
  /** Restrição escolhida da atividade. */
  restricaoId?: string | null
  /** Grava a restrição (ou limpa, com `null`). Devolver `false` indica que a gravação falhou. */
  onRestricaoChange?: (restricao: RestricaoEscolhida | null) => Promise<boolean | void> | boolean | void
  /** Seleção de material atual (gravada ou pendente). */
  escolhaAtual?: EscolhaAtual | null
  /** Gravação em andamento. */
  ocupado?: boolean
  /** Último erro de gravação da seleção (inclui os materiais permitidos do 422). */
  erroSelecao?: ErroSelecaoMaterial | null
  /** Grava (ou limpa, com `null`) a escolha de material. Devolve `false` se a gravação falhar. */
  onMaterialChange?: (escolha: EscolhaMaterial | null) => Promise<boolean> | boolean
  disabled?: boolean
}

function Titulo({ children, contagem }: { children: string; contagem?: number | null }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Title order={6}>{children}</Title>
      {contagem != null && (
        <Badge variant="light" color="gray" size="sm">
          {contagem}
        </Badge>
      )}
    </Group>
  )
}

export default function RestricoesEMateriais({
  atividade,
  marcada = true,
  catalogoDoPlano,
  restricoesRecolhidas = false,
  restricaoId,
  onRestricaoChange,
  escolhaAtual,
  ocupado = false,
  erroSelecao,
  onMaterialChange,
  disabled = false,
}: RestricoesEMateriaisProps) {
  const { restricoes, materiais, carregando, erro, tentarNovamente } = useRestricoesMateriais(
    atividade?.id ?? null,
    catalogoDoPlano,
  )

  const [expandido, setExpandido] = useState(false)
  const [rascunho, setRascunho] = useState<RascunhoParametros>(() => rascunhoDaSelecao(escolhaAtual))
  const [errosParametros, setErrosParametros] = useState<ErrosParametros>({})
  const [naoGravada, setNaoGravada] = useState(false)

  // A seleção gravada é a fonte da verdade dos campos: mudou (gravou, falhou, trocou), volta a ela.
  const chaveEscolha = JSON.stringify(escolhaAtual ?? null)
  useEffect(() => {
    setRascunho(rascunhoDaSelecao(escolhaAtual))
    setErrosParametros({})
  }, [chaveEscolha]) // eslint-disable-line react-hooks/exhaustive-deps

  const bloqueado = disabled || ocupado || !marcada
  const restricoesAbertas = !restricoesRecolhidas || expandido
  const materialEscolhido = useMemo(
    () => materiais.find((m) => m.id === escolhaAtual?.materialId) ?? null,
    [materiais, escolhaAtual?.materialId],
  )

  /** Envia a escolha; se a gravação falhar, restaura os campos para a seleção anterior. */
  async function enviar(escolha: EscolhaMaterial | null) {
    const ok = await onMaterialChange?.(escolha)
    if (ok === false) {
      setRascunho(rascunhoDaSelecao(escolhaAtual))
      setErrosParametros({})
      setNaoGravada(true)
    } else {
      setNaoGravada(false)
    }
  }

  async function alternarMaterial(id: string, marcarMaterial: boolean) {
    if (!marcarMaterial) return enviar(null)
    const material = materiais.find((m) => m.id === id)
    if (material) await enviar(escolhaInicial(material, restricaoId))
  }

  async function confirmarParametros() {
    if (!materialEscolhido) return
    const { escolha, erros } = escolhaDosParametros(materialEscolhido, rascunho, restricaoId)
    setErrosParametros(erros)
    if (!escolha) return // inválido: não grava e a seleção anterior permanece
    if (mesmaEscolha(escolha, escolhaAtual)) return
    await enviar(escolha)
  }

  async function alternarRestricao(r: { id: string; nome: string }, marcarRestricao: boolean) {
    const ok = await onRestricaoChange?.(marcarRestricao ? { id: r.id, nome: r.nome } : null)
    setNaoGravada(ok === false)
  }

  const camposMaterial = camposDoMaterial(materialEscolhido)

  let corpo
  if (!atividade) {
    corpo = (
      <Text size="sm" c="dimmed" data-testid="restricoes-materiais-orientacao">
        {TEXTO_SEM_ATIVIDADE}
      </Text>
    )
  } else if (erro) {
    corpo = (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} data-testid="restricoes-materiais-erro">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm">{erro}</Text>
          <Button size="xs" variant="default" onClick={tentarNovamente}>
            Tentar novamente
          </Button>
        </Group>
      </Alert>
    )
  } else if (carregando) {
    corpo = (
      <Group gap="xs" py="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          Carregando restrições e materiais…
        </Text>
      </Group>
    )
  } else {
    corpo = (
      <Stack gap="sm">
        {!marcada && (
          <Text size="xs" c="dimmed">
            {TEXTO_MARCAR_ATIVIDADE}
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap={6} data-testid="lista-restricoes">
            <Group justify="space-between" wrap="nowrap">
              <Titulo contagem={restricoes.length}>Restrições</Titulo>
              {restricoesRecolhidas && (
                <Anchor
                  size="xs"
                  component="button"
                  type="button"
                  aria-expanded={expandido}
                  onClick={() => setExpandido((v) => !v)}
                >
                  {expandido ? 'Recolher' : 'Expandir'}
                </Anchor>
              )}
            </Group>
            {restricoesAbertas &&
              (restricoes.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {TEXTO_SEM_RESTRICAO}
                </Text>
              ) : (
                restricoes.map((r) => (
                  <Checkbox
                    key={r.id}
                    label={r.nome}
                    checked={restricaoId === r.id}
                    disabled={bloqueado}
                    onChange={(e) => void alternarRestricao(r, e.currentTarget.checked)}
                  />
                ))
              ))}
          </Stack>

          <Stack gap={6} data-testid="lista-materiais">
            <Titulo contagem={materiais.length}>Materiais</Titulo>
            {materiais.length === 0 ? (
              <Text size="sm" c="dimmed">
                {TEXTO_SEM_MATERIAL}
              </Text>
            ) : (
              materiais.map((m) => {
                const escolhido = escolhaAtual?.materialId === m.id
                return (
                  <Stack key={m.id} gap={4}>
                    <Checkbox
                      label={m.nome}
                      checked={escolhido}
                      disabled={bloqueado}
                      onChange={(e) => void alternarMaterial(m.id, e.currentTarget.checked)}
                    />
                    {escolhido && camposMaterial.length > 0 && (
                      <Group gap="xs" align="flex-start" wrap="wrap" pl="xl">
                        {camposMaterial.map((c) => (
                          <TextInput
                            key={c.chave}
                            label={c.rotulo}
                            size="xs"
                            inputMode="decimal"
                            w={150}
                            value={rascunho[c.chave]}
                            onChange={(e) => setRascunho((r) => ({ ...r, [c.chave]: e.currentTarget.value }))}
                            onBlur={() => void confirmarParametros()}
                            error={errosParametros[c.chave]}
                            disabled={bloqueado}
                          />
                        ))}
                      </Group>
                    )}
                    {escolhido && escolhaAtual?.pendente && (
                      <Text size="xs" c="dimmed" pl="xl">
                        Será gravado ao salvar o item.
                      </Text>
                    )}
                  </Stack>
                )
              })
            )}
          </Stack>
        </SimpleGrid>

        {(erroSelecao || naoGravada) && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} data-testid="restricoes-materiais-nao-gravada">
            <Text size="sm">{naoGravada ? TEXTO_NAO_GRAVADA : erroSelecao?.mensagem}</Text>
            {erroSelecao && erroSelecao.permitidos.length > 0 && (
              <Text size="xs" mt={2}>
                Permitidos: {erroSelecao.permitidos.join(', ')}
              </Text>
            )}
            {naoGravada && erroSelecao?.mensagem && <Text size="xs" mt={2}>{erroSelecao.mensagem}</Text>}
          </Alert>
        )}
      </Stack>
    )
  }

  return (
    <Paper withBorder radius="md" p="md" data-testid="restricoes-e-materiais">
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <Title order={6}>{atividade ? `Atividade em foco: ${atividade.nome}` : 'Restrições e materiais'}</Title>
          {ocupado && <Loader size="xs" />}
        </Group>
        {corpo}
      </Stack>
    </Paper>
  )
}
