'use client'

// Menu "Cálculo Padrão" (spec orcamento-grafico-paridade-fluxo-legado, tarefa 9.1).
// A rota `biblioteca-calculos` é mantida só como URL; o texto visível é "Cálculo Padrão".

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, Modal, Pagination, Stack, Text, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconBan, IconCopy, IconEdit, IconPlayerPlay, IconPlus,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import FiltrosCalculo, {
  filtrosCalculoVazios,
  montarParamsBuscaCalculo,
  validarNumeroCalculo,
  type FiltrosCalculoValores,
} from '../_calculo-padrao/FiltrosCalculo'
import GradeCalculos, {
  type ResumoCalculo,
} from '../_calculo-padrao/ColunasCalculo'
import {
  DICA_INCLUIR_SEM_REFERENCIA,
  acoesPermitidas,
  mensagemErroAcao,
  podeIncluir,
  type AcaoCalculoPadrao,
} from '../_calculo-padrao/acoesCalculoPadrao'

const TAMANHO_PAGINA = 50

interface RespostaMenu {
  itens: ResumoCalculo[]
  total: number
  quantidadeCalculos?: number
}

export default function CalculoPadraoPage() {
  useEffect(() => { document.title = 'Cálculo Padrão' }, [])

  const [filtros, setFiltros] = useState<FiltrosCalculoValores>(() => filtrosCalculoVazios())
  const [itens, setItens] = useState<ResumoCalculo[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)
  const [buscou, setBuscou] = useState(false)
  const [selecionado, setSelecionado] = useState<ResumoCalculo | null>(null)
  const [executando, setExecutando] = useState<AcaoCalculoPadrao | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const requisicao = useRef(0)

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))

  const buscar = useCallback(
    async (paginaAlvo: number, filtrosAlvo: FiltrosCalculoValores) => {
      if (validarNumeroCalculo(filtrosAlvo.numero)) return
      const id = ++requisicao.current
      setCarregando(true)
      setErroBusca(null)
      try {
        const res = await api.get('/calculo-grafico', {
          params: { modo: 'MENU', pagina: paginaAlvo, ...montarParamsBuscaCalculo(filtrosAlvo) },
        })
        if (id !== requisicao.current) return
        const data: RespostaMenu = res.data
        setItens(data.itens ?? [])
        setTotal(data.total ?? data.itens?.length ?? 0)
        setPagina(paginaAlvo)
        setBuscou(true)
        setSelecionado(null)
      } catch (err: any) {
        if (id !== requisicao.current) return
        // Erro preserva filtros e a grade anterior.
        setErroBusca(err?.response?.data?.message || 'Falha ao buscar cálculos. Tente novamente.')
      } finally {
        if (id === requisicao.current) setCarregando(false)
      }
    },
    [],
  )

  // Pesquisa enquanto digita (espera 300 ms), sem botão; a carga inicial usa os filtros vazios.
  const [filtrosAtrasados] = useDebouncedValue(filtros, 300)
  useEffect(() => { void buscar(1, filtrosAtrasados) }, [buscar, filtrosAtrasados])

  const pesquisar = () => void buscar(1, filtros)
  const recarregar = () => buscar(pagina, filtros)

  const acoes = selecionado ? acoesPermitidas(selecionado) : []
  const incluirHabilitado = podeIncluir(selecionado)

  const executar = async (acao: AcaoCalculoPadrao) => {
    if (!selecionado) return
    const id = selecionado.id
    setExecutando(acao)
    try {
      switch (acao) {
        case 'INCLUIR': {
          const res = await api.post(`/calculo-grafico/${id}/incluir`, {})
          notifications.show({
            title: 'Cálculo incluído',
            message: `Cálculo ${res.data?.numeroCalculo ?? ''} criado.`.replace('  ', ' '),
            color: 'green',
          })
          break
        }
        case 'COPIAR': {
          const res = await api.post(`/calculo-grafico/${id}/copiar`, {})
          notifications.show({
            title: 'Cálculo copiado',
            message: `Cópia criada com o número ${res.data?.numeroCalculo ?? ''}.`,
            color: 'green',
          })
          break
        }
        case 'EDITAR': {
          // A navegação ao editor virá em tarefa seguinte; por ora só informa o número.
          const res = await api.post(`/calculo-grafico/${id}/editar`, {})
          const numero = res.data?.numeroCalculo ?? ''
          notifications.show({
            title: 'Cálculo para edição',
            message: res.data?.copiado
              ? `Uma cópia foi criada com o número ${numero}. O cálculo original foi mantido.`
              : `Cálculo ${numero} disponível para edição.`,
            color: 'green',
          })
          break
        }
        case 'CANCELAR':
          await api.post(`/calculo-grafico/${id}/cancelar`, {})
          notifications.show({ title: 'Cálculo cancelado', message: 'O cálculo foi cancelado.', color: 'green' })
          break
        case 'REATIVAR':
          await api.post(`/calculo-grafico/${id}/reativar`, {})
          notifications.show({ title: 'Cálculo reativado', message: 'O cálculo foi reativado.', color: 'green' })
          break
      }
      await recarregar()
    } catch (err: any) {
      // Erro mantém a grade como está.
      notifications.show({
        title: 'Erro',
        message: mensagemErroAcao(err?.response?.status, err?.response?.data?.message),
        color: 'red',
      })
    } finally {
      setExecutando(null)
    }
  }

  const ocupado = executando !== null

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Cálculo Padrão</Title>
        <Text size="sm" c="dimmed">
          {total} cálculo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </Text>
      </div>

      <FiltrosCalculo valores={filtros} onChange={setFiltros} onEnter={pesquisar} disabled={ocupado} />

      <Group justify="space-between">
        <Group gap="xs">
          <Button
            leftSection={<IconPlus size={16} />}
            disabled={!incluirHabilitado || ocupado}
            loading={executando === 'INCLUIR'}
            onClick={() => void executar('INCLUIR')}
          >
            Incluir
          </Button>
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            disabled={!acoes.includes('EDITAR') || ocupado}
            loading={executando === 'EDITAR'}
            onClick={() => void executar('EDITAR')}
          >
            Editar
          </Button>
          <Button
            variant="light"
            leftSection={<IconCopy size={16} />}
            disabled={!acoes.includes('COPIAR') || ocupado}
            loading={executando === 'COPIAR'}
            onClick={() => void executar('COPIAR')}
          >
            Copiar
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconBan size={16} />}
            disabled={!acoes.includes('CANCELAR') || ocupado}
            loading={executando === 'CANCELAR'}
            onClick={() => setConfirmarCancelar(true)}
          >
            Cancelar
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconPlayerPlay size={16} />}
            disabled={!acoes.includes('REATIVAR') || ocupado}
            loading={executando === 'REATIVAR'}
            onClick={() => void executar('REATIVAR')}
          >
            Reativar
          </Button>
        </Group>
        {carregando && <Loader size="xs" aria-label="Pesquisando" />}
      </Group>

      {!incluirHabilitado && (
        <Text size="xs" c="dimmed">{DICA_INCLUIR_SEM_REFERENCIA}</Text>
      )}

      {erroBusca && (
        <Alert color="red" title="Erro na busca">
          {erroBusca}
        </Alert>
      )}

      <GradeCalculos
        itens={itens}
        selecionadoId={selecionado?.id ?? null}
        onSelecionar={setSelecionado}
        mensagemVazia={buscou ? 'Nenhum cálculo encontrado' : ''}
      />

      {total > TAMANHO_PAGINA && (
        <Group justify="center">
          <Pagination
            value={pagina}
            total={totalPaginas}
            onChange={(p) => void buscar(p, filtros)}
            disabled={carregando || ocupado}
          />
        </Group>
      )}

      <Modal
        opened={confirmarCancelar}
        onClose={() => setConfirmarCancelar(false)}
        title="Cancelar cálculo"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Deseja cancelar o cálculo {selecionado?.numero ?? ''}? Ele continuará na lista dos cancelados e poderá ser reativado.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmarCancelar(false)}>
              Voltar
            </Button>
            <Button
              color="red"
              onClick={() => {
                setConfirmarCancelar(false)
                void executar('CANCELAR')
              }}
            >
              Confirmar cancelamento
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
