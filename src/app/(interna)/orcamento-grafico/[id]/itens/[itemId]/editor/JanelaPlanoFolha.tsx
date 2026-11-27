'use client'

/**
 * JanelaPlanoFolha — janela "Planos" do Editor do cálculo: edita UM Plano do Cálculo (folha).
 * Plano, suporte (com suporte não cadastrado), formato da folha, aproveitamento, quebras, opções,
 * impressão em até 3 processos com as tintas, atividades da folha e o custo do plano.
 * Envia só os campos alterados; os campos que a geração preenche viram "digitado" (o servidor marca).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Badge, Button, Checkbox, Divider, Group, Modal, NumberInput, Paper, SimpleGrid, Stack, Switch, Table, Tabs,
  Text, TextInput, Tooltip,
} from '@mantine/core'
import { IconArrowBackUp } from '@tabler/icons-react'

import SeletorSuportePlano from '../_plano/SeletorSuportePlano'
import BotaoTintas from '../_item/BotaoTintas'
import type { CorGravada } from '../_item/tintas-item'
import {
  lerFormato,
  moeda,
  textoFormato,
  type AtividadeApi,
  type FolhaApi,
  type ImpressaoFolha,
  type OpcoesFolha,
  type SuporteNc,
} from './editor-calculo'

export interface JanelaPlanoFolhaProps {
  folha: FolhaApi | null
  atividades: AtividadeApi[]
  editavel: boolean
  salvando: boolean
  onFechar: () => void
  onSalvar: (dados: Record<string, unknown>) => void
  onVoltarCalculado: (campo: string) => void
  onDetalhes: (atividade: AtividadeApi) => void
}

const ROTULO_CAMPO: Record<string, string> = {
  nome: 'Nome', tiragem: 'Tiragem', ocorrencias: 'Ocorrências', formatoLarguraMm: 'Formato (A)', formatoAlturaMm: 'Formato (A)',
  formatoFolhaLarguraMm: 'Formato (C)', formatoFolhaAlturaMm: 'Formato (C)', suporteId: 'Suporte', gramatura: 'Gramatura',
  impressao: 'Impressão',
}

const n = (v: string | number) => (v === '' || v == null ? null : Number(v))

export default function JanelaPlanoFolha({
  folha, atividades, editavel, salvando, onFechar, onSalvar, onVoltarCalculado, onDetalhes,
}: JanelaPlanoFolhaProps) {
  const [nome, setNome] = useState('')
  const [tiragem, setTiragem] = useState<string | number>('')
  const [ocorrencias, setOcorrencias] = useState<string | number>(1)
  const [fibra, setFibra] = useState('')
  const [formatoA, setFormatoA] = useState('')
  const [formatoC, setFormatoC] = useState('')
  const [suporteId, setSuporteId] = useState<string | null>(null)
  const [suporteNome, setSuporteNome] = useState<string | null>(null)
  const [usaNc, setUsaNc] = useState(false)
  const [nc, setNc] = useState<SuporteNc>({})
  const [aproveitamento, setAproveitamento] = useState<string | number>('')
  const [quebraFixa, setQuebraFixa] = useState<string | number>('')
  const [quebraVariavel, setQuebraVariavel] = useState<string | number>('')
  const [apara, setApara] = useState<string | number>('')
  const [opcoes, setOpcoes] = useState<OpcoesFolha>({})
  const [impressao, setImpressao] = useState<ImpressaoFolha[]>([{}, {}, {}])

  useEffect(() => {
    if (!folha) return
    setNome(folha.nome)
    setTiragem(folha.tiragem ?? '')
    setOcorrencias(folha.ocorrencias ?? 1)
    setFibra(folha.fibra ?? '')
    setFormatoA(folha.formatoLarguraMm && folha.formatoAlturaMm ? `${folha.formatoLarguraMm} x ${folha.formatoAlturaMm}` : '')
    setFormatoC(folha.formatoFolhaLarguraMm && folha.formatoFolhaAlturaMm ? `${folha.formatoFolhaLarguraMm} x ${folha.formatoFolhaAlturaMm}` : '')
    setSuporteId(folha.suporteId)
    setSuporteNome(folha.suporteNome)
    setUsaNc(!!folha.suporteNc)
    setNc(folha.suporteNc ?? {})
    setAproveitamento(folha.aproveitamento ?? '')
    setQuebraFixa(folha.quebraFixa ?? '')
    setQuebraVariavel(folha.quebraVariavel ?? '')
    setApara(folha.apara ?? '')
    setOpcoes(folha.opcoes ?? {})
    const imp = [...(folha.impressao ?? [])]
    while (imp.length < 3) imp.push({})
    setImpressao(imp.slice(0, 3))
  }, [folha])

  const atividadesDaFolha = useMemo(() => atividades.filter((a) => a.folhaId === folha?.id), [atividades, folha])
  if (!folha) return null
  const manuais = new Set(folha.camposManuais)

  const marca = (campo: string) =>
    manuais.has(campo) ? (
      <Group gap={2} wrap="nowrap">
        <Badge size="xs" color="orange" variant="light">digitado</Badge>
        {editavel && (
          <Tooltip label="Voltar ao calculado">
            <ActionIcon size="xs" variant="subtle" aria-label={`Voltar ${ROTULO_CAMPO[campo] ?? campo} ao calculado`} onClick={() => onVoltarCalculado(campo)}>
              <IconArrowBackUp size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    ) : null

  const salvar = () => {
    const dados: Record<string, unknown> = {}
    if (nome.trim() && nome.trim() !== folha.nome) dados.nome = nome.trim()
    if (n(tiragem) !== folha.tiragem) dados.tiragem = n(tiragem)
    if ((n(ocorrencias) ?? 1) !== folha.ocorrencias) dados.ocorrencias = n(ocorrencias) ?? 1
    if ((fibra || null) !== folha.fibra) dados.fibra = fibra || null
    const a = formatoA.trim() ? lerFormato(formatoA) : null
    if (formatoA.trim() && a && (a[0] !== folha.formatoLarguraMm || a[1] !== folha.formatoAlturaMm)) {
      dados.formatoLarguraMm = a[0]
      dados.formatoAlturaMm = a[1]
    }
    const c = formatoC.trim() ? lerFormato(formatoC) : null
    if (formatoC.trim() && c && (c[0] !== folha.formatoFolhaLarguraMm || c[1] !== folha.formatoFolhaAlturaMm)) {
      dados.formatoFolhaLarguraMm = c[0]
      dados.formatoFolhaAlturaMm = c[1]
    }
    if (suporteId !== folha.suporteId) dados.suporteId = suporteId
    const ncNovo = usaNc ? nc : null
    if (JSON.stringify(ncNovo) !== JSON.stringify(folha.suporteNc)) dados.suporteNc = ncNovo
    if (n(aproveitamento) !== folha.aproveitamento) dados.aproveitamento = n(aproveitamento)
    if (n(quebraFixa) !== folha.quebraFixa) dados.quebraFixa = n(quebraFixa)
    if (n(quebraVariavel) !== folha.quebraVariavel) dados.quebraVariavel = n(quebraVariavel)
    if (n(apara) !== folha.apara) dados.apara = n(apara)
    if (JSON.stringify(opcoes) !== JSON.stringify(folha.opcoes ?? {})) dados.opcoes = opcoes
    const impLimpa = impressao.filter((i) => i && (i.cores || i.processoImpressao || (i.tintas?.length ?? 0) > 0 || i.maquinaId))
    const impNova = impLimpa.length > 0 ? impLimpa : null
    if (JSON.stringify(impNova) !== JSON.stringify(folha.impressao ?? null)) dados.impressao = impNova
    if (Object.keys(dados).length === 0) {
      onFechar()
      return
    }
    onSalvar(dados)
  }

  const setImp = (i: number, p: Partial<ImpressaoFolha>) =>
    setImpressao((lista) => lista.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const setOpc = (p: Partial<OpcoesFolha>) => setOpcoes((o) => ({ ...o, ...p }))
  const ro = !editavel

  return (
    <Modal opened onClose={onFechar} size="90%" title={<Text fw={700}>Planos — {folha.nomeExibido}</Text>} centered>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper withBorder p="sm" radius="md">
            <Text fw={600} size="sm" mb="xs">Plano</Text>
            <SimpleGrid cols={2} spacing="xs">
              <TextInput label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} maxLength={60} readOnly={ro} rightSection={marca('nome')} rightSectionWidth={manuais.has('nome') ? 90 : undefined} />
              <NumberInput label="Tiragem" description="Vazio = tiragem do item" value={tiragem} onChange={setTiragem} min={1} thousandSeparator="." decimalSeparator="," readOnly={ro} />
              <TextInput label="Formato (A)" placeholder="490 x 790" value={formatoA} onChange={(e) => setFormatoA(e.currentTarget.value)} readOnly={ro} error={formatoA.trim() && !lerFormato(formatoA) ? 'Use largura x altura' : undefined} />
              <Group grow gap="xs">
                <NumberInput label="Ocorrências" value={ocorrencias} onChange={setOcorrencias} min={1} readOnly={ro} />
                <TextInput label="Fibra" value={fibra} onChange={(e) => setFibra(e.currentTarget.value)} maxLength={20} readOnly={ro} />
              </Group>
            </SimpleGrid>
            {(manuais.has('tiragem') || manuais.has('formatoLarguraMm') || manuais.has('ocorrencias')) && (
              <Group gap="xs" mt={4}>{marca('tiragem')}{marca('formatoLarguraMm')}{marca('ocorrencias')}</Group>
            )}
          </Paper>

          <Paper withBorder p="sm" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">Suporte</Text>
              <Switch size="xs" label="Suporte não cadastrado (NC)" checked={usaNc} onChange={(e) => setUsaNc(e.currentTarget.checked)} disabled={ro} />
            </Group>
            {usaNc ? (
              <SimpleGrid cols={3} spacing="xs">
                <TextInput label="Nome" value={nc.nome ?? ''} onChange={(e) => setNc({ ...nc, nome: e.currentTarget.value })} readOnly={ro} />
                <NumberInput label="Gramatura" value={nc.gramatura ?? ''} onChange={(v) => setNc({ ...nc, gramatura: n(v) })} readOnly={ro} />
                <NumberInput label="Espessura (micras)" value={nc.espessura ?? ''} onChange={(v) => setNc({ ...nc, espessura: n(v) })} readOnly={ro} />
                <TextInput label="Formato" placeholder="815 x 520" value={nc.formato ?? ''} onChange={(e) => setNc({ ...nc, formato: e.currentTarget.value })} readOnly={ro} />
                <NumberInput label="Custo por kg" value={nc.custoKg ?? ''} onChange={(v) => setNc({ ...nc, custoKg: n(v) })} decimalSeparator="," decimalScale={4} readOnly={ro} />
                <NumberInput label="Frete/kg" value={nc.freteKg ?? ''} onChange={(v) => setNc({ ...nc, freteKg: n(v) })} decimalSeparator="," decimalScale={4} readOnly={ro} />
                <NumberInput label="Crédito ICMS (%)" value={nc.creditoIcms ?? ''} onChange={(v) => setNc({ ...nc, creditoIcms: n(v) })} decimalSeparator="," readOnly={ro} />
                <NumberInput label="Crédito IPI (%)" value={nc.creditoIpi ?? ''} onChange={(v) => setNc({ ...nc, creditoIpi: n(v) })} decimalSeparator="," readOnly={ro} />
              </SimpleGrid>
            ) : (
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <SeletorSuportePlano
                    label="Tipo/gramatura"
                    value={suporteId}
                    nomeAtual={suporteNome}
                    onChange={(id, nomeSel) => { setSuporteId(id); setSuporteNome(nomeSel) }}
                    disabled={ro}
                  />
                </div>
                {marca('suporteId')}
              </Group>
            )}
            <SimpleGrid cols={4} spacing="xs" mt="xs">
              <TextInput label="Formato (C)" placeholder="815 x 520" value={formatoC} onChange={(e) => setFormatoC(e.currentTarget.value)} readOnly={ro} error={formatoC.trim() && !lerFormato(formatoC) ? 'Use largura x altura' : undefined} />
              <NumberInput label="Aproveit. (B/C)" description="Peças por folha" value={aproveitamento} onChange={setAproveitamento} min={0} readOnly={ro} />
              <NumberInput label="Quebra fixa %" value={quebraFixa} onChange={setQuebraFixa} decimalSeparator="," readOnly={ro} />
              <NumberInput label="Quebra variável %" value={quebraVariavel} onChange={setQuebraVariavel} decimalSeparator="," readOnly={ro} />
              <NumberInput label="Apara %" value={apara} onChange={setApara} decimalSeparator="," readOnly={ro} />
            </SimpleGrid>
            {manuais.has('formatoFolhaLarguraMm') && <Group mt={4}>{marca('formatoFolhaLarguraMm')}</Group>}
          </Paper>
        </SimpleGrid>

        <Paper withBorder p="sm" radius="md">
          <Group gap="lg" mb="xs">
            <Checkbox label="Não calcular plano" checked={!!opcoes.naoCalcular} onChange={(e) => setOpc({ naoCalcular: e.currentTarget.checked })} disabled={ro} />
            <Checkbox label="Não cobrar impressão" checked={!!opcoes.naoCobrarImpressao} onChange={(e) => setOpc({ naoCobrarImpressao: e.currentTarget.checked })} disabled={ro} />
            <Checkbox label="Não exibir na proposta" checked={!!opcoes.naoExibirProposta} onChange={(e) => setOpc({ naoExibirProposta: e.currentTarget.checked })} disabled={ro} />
          </Group>
          <Table withTableBorder striped verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Atividades</Table.Th>
                <Table.Th>Repetições</Table.Th>
                <Table.Th>Formato (B)</Table.Th>
                <Table.Th ta="right">Produção/hora</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {atividadesDaFolha.length === 0 ? (
                <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">Nenhuma atividade aplicada sobre este plano.</Text></Table.Td></Table.Tr>
              ) : (
                atividadesDaFolha.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td><Text size="sm">{a.nome}</Text></Table.Td>
                    <Table.Td><Text size="sm">{a.detalhes?.repeticoes ?? '1x1'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{a.detalhes?.formatoCorte ?? textoFormato(folha.formatoFolhaLarguraMm, folha.formatoFolhaAlturaMm)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm">{a.detalhes?.producaoHora ?? '—'}</Text></Table.Td>
                    <Table.Td><Button size="compact-xs" variant="subtle" onClick={() => onDetalhes(a)}>Detalhes…</Button></Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
          <Group gap="md" mt="xs" align="flex-end">
            <Checkbox label="Permitir tira/retira" checked={!!opcoes.tiraRetira} onChange={(e) => setOpc({ tiraRetira: e.currentTarget.checked })} disabled={ro} />
            <Checkbox label="Considerar pinça" checked={!!opcoes.pinca} onChange={(e) => setOpc({ pinca: e.currentTarget.checked })} disabled={ro} />
            <NumberInput w={110} size="xs" label="Refile folha" value={opcoes.refileFolha ?? ''} onChange={(v) => setOpc({ refileFolha: n(v) })} readOnly={ro} />
            <NumberInput w={110} size="xs" label="Refile final" value={opcoes.refileFinal ?? ''} onChange={(v) => setOpc({ refileFinal: n(v) })} readOnly={ro} />
            <NumberInput w={110} size="xs" label="Contra-pinça" value={opcoes.contraPinca ?? ''} onChange={(v) => setOpc({ contraPinca: n(v) })} readOnly={ro} />
            <NumberInput w={110} size="xs" label="Corte duplo" value={opcoes.corteDuplo ?? ''} onChange={(v) => setOpc({ corteDuplo: n(v) })} readOnly={ro} />
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm">Impressão</Text>
            {marca('impressao')}
          </Group>
          {folha.papel === 'MICRO' ? (
            <Text size="sm" c="dimmed">O microondulado não é impresso.</Text>
          ) : (
            <Tabs defaultValue="0">
              <Tabs.List>
                {[0, 1, 2].map((i) => <Tabs.Tab key={i} value={String(i)}>{i + 1}</Tabs.Tab>)}
              </Tabs.List>
              {[0, 1, 2].map((i) => (
                <Tabs.Panel key={i} value={String(i)} pt="xs">
                  <Group align="flex-end" gap="xs">
                    <TextInput w={110} label="Cores" placeholder="6x0" value={impressao[i]?.cores ?? ''} onChange={(e) => setImp(i, { cores: e.currentTarget.value })} readOnly={ro} />
                    <TextInput w={220} label="Processo" placeholder="Offset Plana" value={impressao[i]?.processoImpressao ?? ''} onChange={(e) => setImp(i, { processoImpressao: e.currentTarget.value })} readOnly={ro} />
                    <TextInput w={200} label="Cobertura de Tinta" value={String(impressao[i]?.coberturaTinta ?? '')} onChange={(e) => setImp(i, { coberturaTinta: e.currentTarget.value })} readOnly={ro} />
                    <BotaoTintas
                      value={(impressao[i]?.tintas ?? []) as unknown as CorGravada[]}
                      onChange={(cores) => setImp(i, { tintas: cores as unknown as Array<Record<string, unknown>>, numCores: cores.length })}
                      disabled={ro}
                    />
                    <Text size="xs" c="dimmed">{(impressao[i]?.tintas?.length ?? 0)} tinta(s)</Text>
                  </Group>
                </Tabs.Panel>
              ))}
            </Tabs>
          )}
        </Paper>

        <Divider />
        <Group justify="space-between">
          <Paper withBorder px="md" py={6} radius="md">
            <Text size="xs" c="dimmed">Custo do Plano</Text>
            <Text fw={700}>{opcoes.naoCalcular ? 'Não calculado' : moeda(folha.custoTotal)}</Text>
          </Paper>
          <Group>
            <Button variant="default" onClick={onFechar}>{editavel ? 'Cancelar' : 'Fechar'}</Button>
            {editavel && <Button onClick={salvar} loading={salvando}>Salvar plano</Button>}
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
