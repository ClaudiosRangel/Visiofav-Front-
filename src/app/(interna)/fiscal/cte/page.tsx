'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Paper,
  Title,
  Text,
  Group,
  Button,
  ActionIcon,
  Tooltip,
  Menu,
  Modal,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconPlus,
  IconDotsVertical,
  IconFileTypePdf,
  IconFileCode,
  IconCopy,
  IconX,
  IconEdit,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { ListagemFiscal, type ColumnDef } from '@/components/fiscal/ListagemFiscal'
import { StatusBadge } from '@/components/fiscal/StatusBadge'
import { useCte } from '@/data/hooks/fiscal/useCte'

interface CteItem {
  id: string
  numero: number
  serie: number
  tomadorRazao: string | null
  destRazao: string | null
  valorTotal: number
  status: string
  dataEmissao: string
  chaveAcesso: string | null
}

function AcoesMenu({ item }: { item: CteItem }) {
  const { baixarDacte, baixarXml } = useCte()
  const cancelarMutation = useCte().useCancelar()
  const router = useRouter()
  const [cancelarAberto, setCancelarAberto] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [cceAberto, setCceAberto] = useState(false)
  const [textoCorrecao, setTextoCorrecao] = useState('')
  const cartaCorrecaoMutation = useCte().useCartaCorrecao()

  async function handleDacte() {
    try {
      const response = await baixarDacte(item.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível gerar o DACTE', color: 'red' })
    }
  }

  async function handleXml() {
    try {
      const response = await baixarXml(item.id)
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CTe-${item.serie}-${item.numero}.xml`
      a.click()
    } catch {
      notifications.show({ title: 'Erro', message: 'XML não disponível', color: 'red' })
    }
  }

  function handleCancelar() {
    if (justificativa.length < 15) {
      notifications.show({ title: 'Erro', message: 'Justificativa deve ter ao menos 15 caracteres', color: 'red' })
      return
    }
    cancelarMutation.mutate({ id: item.id, justificativa }, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'CT-e cancelado', color: 'green' })
        setCancelarAberto(false)
      },
      onError: (err: any) => {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao cancelar',
          color: 'red',
        })
      },
    })
  }

  function handleCartaCorrecao() {
    if (textoCorrecao.length < 15) {
      notifications.show({ title: 'Erro', message: 'Texto deve ter ao menos 15 caracteres', color: 'red' })
      return
    }
    cartaCorrecaoMutation.mutate({ id: item.id, textoCorrecao }, {
      onSuccess: () => {
        notifications.show({ title: 'Sucesso', message: 'Carta de correção registrada', color: 'green' })
        setCceAberto(false)
      },
      onError: (err: any) => {
        notifications.show({
          title: 'Erro',
          message: err?.response?.data?.message || 'Falha ao registrar CC-e',
          color: 'red',
        })
      },
    })
  }

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {['AUTORIZADO', 'CANCELADO'].includes(item.status) && (
            <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={handleDacte}>
              DACTE (PDF)
            </Menu.Item>
          )}
          {item.status !== 'PENDENTE' && (
            <Menu.Item leftSection={<IconFileCode size={14} />} onClick={handleXml}>
              Baixar XML
            </Menu.Item>
          )}
          {item.status === 'AUTORIZADO' && (
            <>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => setCceAberto(true)}>
                Carta de Correção
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconX size={14} />}
                onClick={() => setCancelarAberto(true)}>
                Cancelar
              </Menu.Item>
            </>
          )}
          <Menu.Item leftSection={<IconCopy size={14} />}
            onClick={() => router.push(`/fiscal/cte/nova?duplicar=${item.id}`)}>
            Duplicar
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Modal Cancelamento */}
      <Modal opened={cancelarAberto} onClose={() => setCancelarAberto(false)} title="Cancelar CT-e">
        <Textarea label="Justificativa (min. 15 caracteres)" value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)} rows={3} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setCancelarAberto(false)}>Voltar</Button>
          <Button color="red" loading={cancelarMutation.isPending} onClick={handleCancelar}>
            Confirmar Cancelamento
          </Button>
        </Group>
      </Modal>

      {/* Modal Carta de Correção */}
      <Modal opened={cceAberto} onClose={() => setCceAberto(false)} title="Carta de Correção (CC-e)">
        <Textarea label="Texto de Correção (min. 15 caracteres)" value={textoCorrecao}
          onChange={(e) => setTextoCorrecao(e.target.value)} rows={4} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setCceAberto(false)}>Voltar</Button>
          <Button color="blue" loading={cartaCorrecaoMutation.isPending} onClick={handleCartaCorrecao}>
            Registrar CC-e
          </Button>
        </Group>
      </Modal>
    </>
  )
}

const columns: ColumnDef<CteItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'serie', label: 'Série' },
  {
    key: 'tomadorRazao',
    label: 'Tomador/Destinatário',
    render: (value: string | null, row: CteItem) => value || row.destRazao || '—',
  },
  {
    key: 'valorTotal',
    label: 'Valor',
    render: (value: number) =>
      value != null
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => <StatusBadge status={value} />,
  },
  {
    key: 'dataEmissao',
    label: 'Data',
    render: (value: string) =>
      value ? new Date(value).toLocaleDateString('pt-BR') : '—',
  },
  {
    key: 'id',
    label: 'Ações',
    render: (_: string, row: CteItem) => <AcoesMenu item={row} />,
  },
]

export default function CtePage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - CT-e' }, [])

  return (
    <>
      <ListagemFiscal<CteItem>
        queryKey={['fiscal', 'cte']}
        endpoint="/fiscal/cte"
        columns={columns}
        title="Conhecimento de Transporte Eletrônico (CT-e)"
        breadcrumb="Início / Fiscal / CT-e"
        createButton={{ label: 'Novo CT-e', href: '/fiscal/cte/nova' }}
      />
      <Group mt="sm" ml="md">
        <Button variant="light" color="blue" size="xs"
          component="a" href="/fiscal/cte/importar"
          leftSection={<IconFileCode size={14} />}>
          Gerar CT-e a partir de NF-e (XML)
        </Button>
      </Group>
    </>
  )
}
