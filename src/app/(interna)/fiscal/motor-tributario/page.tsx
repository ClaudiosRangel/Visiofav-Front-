'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  ActionIcon,
  Tooltip,
  Switch,
  SimpleGrid,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { motorTributarioCrud, type RegraTributaria } from '@/data/hooks/fiscal/useCadastrosFiscais'
import { useCfopOptions } from '@/data/hooks/fiscal/useCfopOptions'
import { useNcmOptions } from '@/data/hooks/fiscal/useNcmOptions'
import { useCstOptions, useCsosnOptions } from '@/data/hooks/fiscal/useCstCsosnOptions'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
].map((uf) => ({ value: uf, label: uf }))

const REGIME_OPTIONS = [
  { value: '1', label: '1 - Simples Nacional' },
  { value: '2', label: '2 - Simples Nacional (excesso)' },
  { value: '3', label: '3 - Regime Normal' },
]

export default function MotorTributarioPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Motor Tributário' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<RegraTributaria | null>(null)

  // Form state
  const [ncm, setNcm] = useState('')
  const [cfop, setCfop] = useState('')
  const [ufOrigem, setUfOrigem] = useState<string | null>(null)
  const [ufDestino, setUfDestino] = useState<string | null>(null)
  const [regimeTributario, setRegimeTributario] = useState<string | null>(null)
  const [icmsAliquota, setIcmsAliquota] = useState<number | string>(0)
  const [icmsCst, setIcmsCst] = useState('')
  const [icmsCsosn, setIcmsCsosn] = useState('')
  const [pisAliquota, setPisAliquota] = useState<number | string>(0)
  const [pisCst, setPisCst] = useState('')
  const [cofinsAliquota, setCofinsAliquota] = useState<number | string>(0)
  const [cofinsCst, setCofinsCst] = useState('')
  const [ipiAliquota, setIpiAliquota] = useState<number | string>(0)
  const [ipiCst, setIpiCst] = useState('')
  const [ativo, setAtivo] = useState(true)

  const criar = motorTributarioCrud.useCriar()
  const atualizar = motorTributarioCrud.useAtualizar()
  const excluir = motorTributarioCrud.useExcluir()

  // Busca de NCM é server-side (>10 mil códigos) — conforme o usuário digita.
  const [ncmSearch, setNcmSearch] = useState('')
  const { options: ncmOptions, isLoading: ncmLoading } = useNcmOptions(ncmSearch)
  // CFOP (qualquer direção — a regra tributária não distingue entrada/saída
  // no cadastro, o CFOP em si já define a direção), CST/CSOSN carregam a
  // lista inteira de uma vez (poucas centenas/dezenas de códigos).
  const { options: cfopOptions, isLoading: cfopLoading } = useCfopOptions()
  const { options: cstIcmsOptions, isLoading: cstIcmsLoading } = useCstOptions('ICMS')
  const { options: csosnOptions, isLoading: csosnLoading } = useCsosnOptions()
  const { options: cstPisOptions, isLoading: cstPisLoading } = useCstOptions('PIS')
  const { options: cstCofinsOptions, isLoading: cstCofinsLoading } = useCstOptions('COFINS')
  const { options: cstIpiOptions, isLoading: cstIpiLoading } = useCstOptions('IPI')

  function resetForm() {
    setNcm('')
    setNcmSearch('')
    setCfop('')
    setUfOrigem(null)
    setUfDestino(null)
    setRegimeTributario(null)
    setIcmsAliquota(0)
    setIcmsCst('')
    setIcmsCsosn('')
    setPisAliquota(0)
    setPisCst('')
    setCofinsAliquota(0)
    setCofinsCst('')
    setIpiAliquota(0)
    setIpiCst('')
    setAtivo(true)
  }

  function abrirNovo() {
    setEditando(null)
    resetForm()
    setModalOpen(true)
  }

  function abrirEditar(regra: RegraTributaria) {
    setEditando(regra)
    setNcm(regra.ncm || '')
    setNcmSearch(regra.ncm || '')
    setCfop(regra.cfop || '')
    setUfOrigem(regra.ufOrigem || null)
    setUfDestino(regra.ufDestino || null)
    setRegimeTributario(regra.regimeTributario != null ? String(regra.regimeTributario) : null)
    setIcmsAliquota(regra.icmsAliquota ?? 0)
    setIcmsCst(regra.icmsCst || '')
    setIcmsCsosn(regra.icmsCsosn || '')
    setPisAliquota(regra.pisAliquota ?? 0)
    setPisCst(regra.pisCst || '')
    setCofinsAliquota(regra.cofinsAliquota ?? 0)
    setCofinsCst(regra.cofinsCst || '')
    setIpiAliquota(regra.ipiAliquota ?? 0)
    setIpiCst(regra.ipiCst || '')
    setAtivo(regra.ativo ?? true)
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
  }

  function handleSalvar() {
    const payload: any = {
      ncm,
      cfop,
      ufOrigem: ufOrigem || '',
      ufDestino: ufDestino || '',
      regimeTributario: regimeTributario ? Number(regimeTributario) : 3,
      icmsAliquota: Number(icmsAliquota) || 0,
      icmsCst: icmsCst || null,
      icmsCsosn: icmsCsosn || null,
      pisAliquota: Number(pisAliquota) || 0,
      pisCst: pisCst || null,
      cofinsAliquota: Number(cofinsAliquota) || 0,
      cofinsCst: cofinsCst || null,
      ipiAliquota: Number(ipiAliquota) || 0,
      ipiCst: ipiCst || null,
      ativo,
    }

    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({ title: 'Sucesso', message: 'Regra atualizada', color: 'green' })
            fecharModal()
          },
          onError: (err: any) => {
            notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar regra', color: 'red' })
          },
        },
      )
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'Regra criada', color: 'green' })
          fecharModal()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar regra', color: 'red' })
        },
      })
    }
  }

  function handleExcluir(regra: RegraTributaria) {
    if (!confirm(`Excluir regra NCM ${regra.ncm} / CFOP ${regra.cfop}?`)) return
    excluir.mutate(regra.id, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Regra excluída', color: 'green' })
      },
      onError: (err: any) => {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir regra', color: 'red' })
      },
    })
  }

  const columns: ColumnDef<RegraTributaria>[] = [
    { key: 'ncm', label: 'NCM' },
    { key: 'cfop', label: 'CFOP' },
    { key: 'ufOrigem', label: 'UF Origem' },
    { key: 'ufDestino', label: 'UF Destino' },
    {
      key: 'regimeTributario',
      label: 'Regime',
      render: (value: number) => {
        const map: Record<number, string> = { 1: 'SN', 2: 'SN Excesso', 3: 'Normal' }
        return map[value] || String(value)
      },
    },
    {
      key: 'icmsCst',
      label: 'CST/CSOSN',
      render: (_value: string | null, item: RegraTributaria) => item.icmsCst || item.icmsCsosn || '—',
    },
    {
      key: 'icmsAliquota',
      label: 'Alíq. ICMS',
      render: (value: number) => value != null ? `${value}%` : '—',
    },
    {
      key: 'pisAliquota',
      label: 'Alíq. PIS',
      render: (value: number) => value != null ? `${value}%` : '—',
    },
    {
      key: 'cofinsAliquota',
      label: 'Alíq. COFINS',
      render: (value: number) => value != null ? `${value}%` : '—',
    },
  ]

  const isFormValid = ncm && cfop && ufOrigem && ufDestino && regimeTributario

  return (
    <div>
      <Group justify="flex-end" mb="sm">
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
          Nova Regra
        </Button>
      </Group>

      <ListagemFiscal<RegraTributaria>
        queryKey={['fiscal-motor-tributario']}
        endpoint="/fiscal/motor-tributario"
        columns={columns}
        title="Motor Tributário — Regras"
        breadcrumb="Início / Fiscal / Motor Tributário"
        actions={(item) => (
          <Group gap={4}>
            <Tooltip label="Editar">
              <ActionIcon variant="light" color="blue" onClick={() => abrirEditar(item)}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excluir">
              <ActionIcon variant="light" color="red" onClick={() => handleExcluir(item)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      />

      {/* Modal Criar/Editar Regra */}
      <Modal
        opened={modalOpen}
        onClose={fecharModal}
        title={editando ? 'Editar Regra Tributária' : 'Nova Regra Tributária'}
        size="xl"
        centered
      >
        <SimpleGrid cols={2} spacing="sm" mb="sm">
          <Select
            label="NCM *"
            placeholder="Digite código ou descrição"
            data={ncmOptions}
            value={ncm || null}
            onChange={(v) => setNcm(v || '')}
            searchable
            searchValue={ncmSearch}
            onSearchChange={setNcmSearch}
            disabled={ncmLoading && ncmOptions.length === 0}
            nothingFoundMessage={ncmSearch ? 'Nenhum NCM encontrado' : 'Digite para buscar'}
          />
          <Select
            label="CFOP *"
            placeholder="Selecione"
            data={cfopOptions}
            value={cfop || null}
            onChange={(v) => setCfop(v || '')}
            searchable
            disabled={cfopLoading}
            nothingFoundMessage="Nenhum CFOP encontrado"
          />
          <Select
            label="UF Origem *"
            placeholder="Selecione"
            data={UF_OPTIONS}
            value={ufOrigem}
            onChange={setUfOrigem}
            searchable
          />
          <Select
            label="UF Destino *"
            placeholder="Selecione"
            data={UF_OPTIONS}
            value={ufDestino}
            onChange={setUfDestino}
            searchable
          />
          <Select
            label="Regime Tributário *"
            placeholder="Selecione"
            data={REGIME_OPTIONS}
            value={regimeTributario}
            onChange={setRegimeTributario}
          />
          <Select
            label="CST ICMS"
            placeholder="Selecione (opcional)"
            data={cstIcmsOptions}
            value={icmsCst || null}
            onChange={(v) => setIcmsCst(v || '')}
            searchable
            clearable
            disabled={cstIcmsLoading}
            nothingFoundMessage="Nenhum CST de ICMS encontrado"
          />
          <Select
            label="CSOSN"
            placeholder="Selecione (opcional)"
            data={csosnOptions}
            value={icmsCsosn || null}
            onChange={(v) => setIcmsCsosn(v || '')}
            searchable
            clearable
            disabled={csosnLoading}
            nothingFoundMessage="Nenhum CSOSN encontrado"
          />
          <NumberInput
            label="Alíquota ICMS (%)"
            value={icmsAliquota}
            onChange={setIcmsAliquota}
            min={0}
            max={100}
            decimalScale={2}
          />
          <NumberInput
            label="Alíquota PIS (%)"
            value={pisAliquota}
            onChange={setPisAliquota}
            min={0}
            max={100}
            decimalScale={2}
          />
          <Select
            label="CST PIS"
            placeholder="Selecione (opcional)"
            data={cstPisOptions}
            value={pisCst || null}
            onChange={(v) => setPisCst(v || '')}
            searchable
            clearable
            disabled={cstPisLoading}
            nothingFoundMessage="Nenhum CST de PIS encontrado"
          />
          <NumberInput
            label="Alíquota COFINS (%)"
            value={cofinsAliquota}
            onChange={setCofinsAliquota}
            min={0}
            max={100}
            decimalScale={2}
          />
          <Select
            label="CST COFINS"
            placeholder="Selecione (opcional)"
            data={cstCofinsOptions}
            value={cofinsCst || null}
            onChange={(v) => setCofinsCst(v || '')}
            searchable
            clearable
            disabled={cstCofinsLoading}
            nothingFoundMessage="Nenhum CST de COFINS encontrado"
          />
          <NumberInput
            label="Alíquota IPI (%)"
            value={ipiAliquota}
            onChange={setIpiAliquota}
            min={0}
            max={100}
            decimalScale={2}
          />
          <Select
            label="CST IPI"
            placeholder="Selecione (opcional)"
            data={cstIpiOptions}
            value={ipiCst || null}
            onChange={(v) => setIpiCst(v || '')}
            searchable
            clearable
            disabled={cstIpiLoading}
            nothingFoundMessage="Nenhum CST de IPI encontrado"
          />
        </SimpleGrid>

        <Switch
          label="Ativo"
          checked={ativo}
          onChange={(e) => setAtivo(e.currentTarget.checked)}
          mb="md"
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            loading={criar.isPending || atualizar.isPending}
            disabled={!isFormValid}
          >
            {editando ? 'Salvar' : 'Criar'}
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
