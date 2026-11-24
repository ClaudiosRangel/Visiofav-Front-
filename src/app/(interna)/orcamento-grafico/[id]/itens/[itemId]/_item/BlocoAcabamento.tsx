'use client'

/**
 * BlocoAcabamento — bloco "Acabamento" do Item de PLANO ÚNICO (R8.3, R11).
 *
 * À esquerda, as Atividades ativas do cadastro, marcáveis e desmarcáveis (com busca); as
 * pré-marcadas do cadastro do produto entram marcadas em item novo (ver `aplicarPreMarcadas`, a cargo
 * de quem monta a tela). À direita, `RestricoesEMateriais` da atividade em foco, que é a última
 * marcada ou clicada.
 *
 * Marcações e restrição escolhida ficam em `acabamentosRicos` (estado no pai, via `value`/`onChange`).
 * A escolha de material grava pela seleção de material já existente (`selecao`, o mesmo controle do
 * editor atual); se a gravação da restrição falhar, a restrição volta ao valor anterior. Nada aqui
 * recalcula custo nem cria plano.
 */

import { useRef, useState } from 'react'
import { Alert, Badge, Box, Button, Checkbox, Group, Loader, ScrollArea, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle, IconSearch, IconTool } from '@tabler/icons-react'
import CartaoSecao from './CartaoSecao'

import type { WizardFormData } from '../../../../novo/page'
import type { LayoutItem } from '../../../_layout/resolver-layout-item'
import type { CatalogoPlano } from '../../../../cadastros/_shared/cadastros-graficos.types'
import { chaveSelecao } from '../../../editor/catalogo/catalogo-puro'
import { escolhaPadraoDaAtividade } from '../../../editor/catalogo/atividades-do-plano-puro'
import type { ControleSelecao } from '../../../editor/catalogo/useSelecaoMaterial'
import {
  alternarAtividade,
  definirRestricao,
  estaMarcada,
  filtrarAtividades,
  restricaoDaAtividade,
  selecaoDaAtividade,
  type AtividadeCadastro,
  type RestricaoEscolhida,
} from './acabamento-item'
import type { EscolhaMaterial } from './parametro-material'
import RestricoesEMateriais from './RestricoesEMateriais'

type CamposAcabamento = Pick<WizardFormData, 'acabamentosRicos'>

export interface BlocoAcabamentoProps {
  /** Atividades ativas do cadastro, já ordenadas (o catálogo do produto manda na ordem). */
  atividades: ReadonlyArray<AtividadeCadastro>
  value: CamposAcabamento
  onChange: (parcial: CamposAcabamento) => void
  /** `RECOLHIDA` quando o cadastro do produto tem `exibeRestricoes` falso. */
  layout: Pick<LayoutItem, 'restricoes'>
  /** Catálogo do plano fixo: materiais permitidos e atividades pré-marcadas. */
  catalogoDoPlano?: Pick<CatalogoPlano, 'atividades'> | null
  /** Controle da seleção de material (`useSelecaoMaterial`). Sem ele a escolha de material não é gravada. */
  selecao?: Pick<ControleSelecao, 'selecoes' | 'pendentes' | 'ocupados' | 'erros' | 'escolher' | 'limpar'>
  /** A lista de atividades ainda carrega pela primeira vez. */
  carregandoLista?: boolean
  /** Aviso de lista incompleta. */
  avisoLista?: string | null
  onTentarNovamente?: () => void
  disabled?: boolean
}

export default function BlocoAcabamento({
  atividades,
  value,
  onChange,
  layout,
  catalogoDoPlano,
  selecao,
  carregandoLista,
  avisoLista,
  onTentarNovamente,
  disabled,
}: BlocoAcabamentoProps) {
  const [foco, setFoco] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  // O estado mais recente do pai, para conferir/restaurar depois de uma gravação assíncrona.
  const valueRef = useRef(value)
  valueRef.current = value

  const marcadas = value.acabamentosRicos ?? []
  const visiveis = filtrarAtividades(atividades, busca)
  const emFoco = atividades.find((a) => a.id === foco) ?? null
  const chaveFoco = emFoco ? chaveSelecao(emFoco.id) : null
  const preMarcadaNoCatalogo = (id: string) => catalogoDoPlano?.atividades.find((a) => a.id === id)?.preMarcada === true

  function alternar(ac: AtividadeCadastro) {
    const jaMarcada = estaMarcada(valueRef.current.acabamentosRicos, ac)
    onChange({ acabamentosRicos: alternarAtividade(valueRef.current.acabamentosRicos, ac) })
    setFoco(ac.id)
    if (!selecao) return
    if (jaMarcada) {
      void selecao.limpar(ac.id)
      return
    }
    // Ao marcar, escolhe o material padrão (ou o único permitido) da atividade, como no editor atual.
    const doPlano = catalogoDoPlano?.atividades.find((a) => a.id === ac.id)
    const escolha = doPlano ? escolhaPadraoDaAtividade(doPlano) : null
    if (escolha) void selecao.escolher({ ...escolha, acabamentoId: ac.id })
  }

  async function mudarRestricao(ac: AtividadeCadastro, restricao: RestricaoEscolhida | null): Promise<boolean> {
    const anterior = restricaoDaAtividade(valueRef.current.acabamentosRicos, ac)
    onChange({ acabamentosRicos: definirRestricao(valueRef.current.acabamentosRicos, ac, restricao) })
    const atual = selecaoDaAtividade(selecao?.selecoes, selecao?.pendentes, ac.id)
    if (!selecao || !atual) return true // sem material escolhido, a restrição fica só no item
    const ok = await selecao.escolher({
      acabamentoId: ac.id,
      materialId: atual.materialId,
      tipoParam: atual.tipoParam,
      param1: atual.param1,
      param2: atual.param2,
      gramaturaKgM2: atual.gramaturaKgM2,
      pecasPorCaixa: atual.pecasPorCaixa,
      restricaoId: restricao?.id ?? null,
    })
    if (!ok) {
      // Gravação falhou: a restrição volta ao que era antes da tentativa.
      onChange({ acabamentosRicos: definirRestricao(valueRef.current.acabamentosRicos, ac, anterior) })
      return false
    }
    return true
  }

  async function mudarMaterial(ac: AtividadeCadastro, escolha: EscolhaMaterial | null): Promise<boolean> {
    if (!selecao) return false
    if (escolha === null) {
      await selecao.limpar(ac.id)
      return true
    }
    return selecao.escolher({ ...escolha, acabamentoId: ac.id })
  }

  return (
    <CartaoSecao
      titulo="Acabamento — Atividades"
      icone={<IconTool size={16} />}
      direita={
        <Badge variant="light" color={marcadas.length > 0 ? 'blue' : 'gray'} data-testid="bloco-acabamento-contagem">
          {marcadas.length === 1 ? '1 marcada' : `${marcadas.length} marcadas`}
        </Badge>
      }
      data-testid="bloco-acabamento"
    >
      <Stack gap="md">

        {avisoLista && (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />} data-testid="bloco-acabamento-aviso">
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm">{avisoLista}</Text>
              {onTentarNovamente && (
                <Button size="xs" variant="default" onClick={onTentarNovamente}>
                  Tentar novamente
                </Button>
              )}
            </Group>
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Stack gap="xs">
            <Title order={6}>Atividades</Title>
            <TextInput
              placeholder="Buscar atividade"
              aria-label="Buscar atividade"
              leftSection={<IconSearch size={14} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
            />

            {carregandoLista && atividades.length === 0 ? (
              <Group gap="xs" py="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  Carregando atividades…
                </Text>
              </Group>
            ) : atividades.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid="bloco-acabamento-vazio">
                Nenhuma atividade cadastrada.
              </Text>
            ) : visiveis.length === 0 ? (
              <Text size="sm" c="dimmed">
                Nenhuma atividade encontrada.
              </Text>
            ) : (
              <ScrollArea.Autosize mah={320} type="auto">
                <Stack gap={2}>
                  {visiveis.map((a) => (
                    <Box
                      key={a.id}
                      px="xs"
                      py={4}
                      onClick={() => setFoco(a.id)}
                      data-em-foco={foco === a.id ? 'true' : undefined}
                      style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: foco === a.id ? 'var(--mantine-color-blue-light)' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <Group gap="xs" wrap="nowrap" justify="space-between">
                        {/* O nome fica fora do rótulo: clicar nele só põe a atividade em foco; a caixa marca. */}
                        <Group gap="xs" wrap="nowrap">
                          <Checkbox
                            aria-label={a.nome}
                            checked={estaMarcada(marcadas, a)}
                            disabled={disabled}
                            onChange={() => alternar(a)}
                          />
                          <Text size="sm">{a.nome}</Text>
                        </Group>
                        {preMarcadaNoCatalogo(a.id) && (
                          <Badge size="xs" variant="light" color="gray">
                            Padrão
                          </Badge>
                        )}
                      </Group>
                    </Box>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>

          <RestricoesEMateriais
            key={emFoco?.id ?? 'sem-foco'}
            atividade={emFoco ? { id: emFoco.id, nome: emFoco.nome } : null}
            marcada={emFoco ? estaMarcada(marcadas, emFoco) : false}
            catalogoDoPlano={catalogoDoPlano}
            restricoesRecolhidas={layout.restricoes === 'RECOLHIDA'}
            restricaoId={emFoco ? (restricaoDaAtividade(marcadas, emFoco)?.id ?? null) : null}
            onRestricaoChange={emFoco ? (r) => mudarRestricao(emFoco, r) : undefined}
            escolhaAtual={emFoco ? selecaoDaAtividade(selecao?.selecoes, selecao?.pendentes, emFoco.id) : null}
            ocupado={chaveFoco ? selecao?.ocupados[chaveFoco] === true : false}
            erroSelecao={chaveFoco ? (selecao?.erros[chaveFoco] ?? null) : null}
            onMaterialChange={emFoco && selecao ? (escolha) => mudarMaterial(emFoco, escolha) : undefined}
            disabled={disabled}
          />
        </SimpleGrid>
      </Stack>
    </CartaoSecao>
  )
}
