'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import {
  IconFileText,
  IconUser,
  IconPackage,
  IconTruck,
  IconCash,
  IconInfoCircle,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { FormularioEmissao, type StepConfig } from '@/components/fiscal/FormularioEmissao'
import { useNfe } from '@/data/hooks/fiscal/useNfe'
import type { EmissaoNfePayload } from '@/data/hooks/fiscal/types'

const steps: StepConfig[] = [
  {
    label: 'Dados Gerais',
    icon: IconFileText,
    fields: [
      {
        name: 'naturezaOp',
        label: 'Natureza da Operação',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'tipoOperacao',
        label: 'Tipo de Operação',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '0', label: '0 - Entrada' },
          { value: '1', label: '1 - Saída' },
        ],
      },
      {
        name: 'finalidade',
        label: 'Finalidade',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '1', label: '1 - Normal' },
          { value: '2', label: '2 - Complementar' },
          { value: '3', label: '3 - Ajuste' },
          { value: '4', label: '4 - Devolução' },
        ],
      },
      {
        name: 'dataEmissao',
        label: 'Data de Emissão',
        type: 'date',
        required: true,
        span: 6,
      },
    ],
  },
  {
    label: 'Destinatário',
    icon: IconUser,
    fields: [
      {
        name: 'cpfCnpj',
        label: 'CPF/CNPJ',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'razaoSocial',
        label: 'Razão Social',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'ie',
        label: 'Inscrição Estadual',
        type: 'text',
        span: 6,
      },
      {
        name: 'uf',
        label: 'UF',
        type: 'text',
        required: true,
        span: 6,
      },
    ],
  },
  {
    label: 'Itens',
    icon: IconPackage,
    fields: [
      {
        name: 'produtoBusca',
        label: 'Buscar Produto (NCM / Descrição)',
        type: 'product-search',
        span: 12,
      },
      {
        name: 'itemDescricao',
        label: 'Descrição do Item',
        type: 'text',
        span: 6,
      },
      {
        name: 'itemNcm',
        label: 'NCM',
        type: 'text',
        span: 3,
      },
      {
        name: 'itemCfop',
        label: 'CFOP',
        type: 'text',
        span: 3,
      },
      {
        name: 'itemUnidade',
        label: 'Unidade',
        type: 'text',
        span: 3,
      },
      {
        name: 'itemQuantidade',
        label: 'Quantidade',
        type: 'number',
        span: 3,
      },
      {
        name: 'itemValorUnitario',
        label: 'Valor Unitário',
        type: 'number',
        span: 3,
      },
      {
        name: 'itemDesconto',
        label: 'Desconto',
        type: 'number',
        span: 3,
      },
    ],
  },
  {
    label: 'Transporte',
    icon: IconTruck,
    fields: [
      {
        name: 'modalidadeFrete',
        label: 'Modalidade do Frete',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '0', label: '0 - Contratação por conta do Remetente (CIF)' },
          { value: '1', label: '1 - Contratação por conta do Destinatário (FOB)' },
          { value: '2', label: '2 - Contratação por conta de Terceiros' },
          { value: '3', label: '3 - Transporte Próprio por conta do Remetente' },
          { value: '4', label: '4 - Transporte Próprio por conta do Destinatário' },
          { value: '9', label: '9 - Sem Ocorrência de Transporte' },
        ],
      },
      {
        name: 'transportadoraCpfCnpj',
        label: 'CPF/CNPJ Transportadora',
        type: 'text',
        span: 6,
      },
      {
        name: 'placa',
        label: 'Placa do Veículo',
        type: 'text',
        span: 6,
      },
    ],
  },
  {
    label: 'Pagamento',
    icon: IconCash,
    fields: [
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '01', label: '01 - Dinheiro' },
          { value: '02', label: '02 - Cheque' },
          { value: '03', label: '03 - Cartão de Crédito' },
          { value: '04', label: '04 - Cartão de Débito' },
          { value: '05', label: '05 - Crédito Loja' },
          { value: '10', label: '10 - Vale Alimentação' },
          { value: '11', label: '11 - Vale Refeição' },
          { value: '12', label: '12 - Vale Presente' },
          { value: '13', label: '13 - Vale Combustível' },
          { value: '15', label: '15 - Boleto Bancário' },
          { value: '16', label: '16 - Depósito Bancário' },
          { value: '17', label: '17 - PIX' },
          { value: '90', label: '90 - Sem Pagamento' },
          { value: '99', label: '99 - Outros' },
        ],
      },
      {
        name: 'valorPagamento',
        label: 'Valor',
        type: 'number',
        required: true,
        span: 6,
      },
    ],
  },
  {
    label: 'Info Complementares',
    icon: IconInfoCircle,
    fields: [
      {
        name: 'informacoesComplementares',
        label: 'Informações Complementares',
        type: 'textarea',
        span: 12,
      },
    ],
  },
]

export default function NfeNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Nova NF-e' }, [])

  const router = useRouter()
  const { useEmitir } = useNfe()
  const emitirMutation = useEmitir()

  async function handleSubmit(dados: Record<string, any>) {
    const payload: EmissaoNfePayload = {
      dadosGerais: {
        naturezaOp: dados.naturezaOp || '',
        tipoOperacao: Number(dados.tipoOperacao) as 0 | 1,
        finalidade: Number(dados.finalidade) as 1 | 2 | 3 | 4,
        dataEmissao: dados.dataEmissao
          ? new Date(dados.dataEmissao).toISOString()
          : new Date().toISOString(),
      },
      destinatario: {
        cpfCnpj: dados.cpfCnpj || '',
        razaoSocial: dados.razaoSocial || '',
        ie: dados.ie || undefined,
        uf: dados.uf || '',
        endereco: {
          logradouro: dados.logradouro || '',
          numero: dados.endNumero || '',
          complemento: dados.complemento || undefined,
          bairro: dados.bairro || '',
          codigoMunicipio: dados.codigoMunicipio || '',
          municipio: dados.municipio || '',
          uf: dados.uf || '',
          cep: dados.cep || '',
        },
      },
      itens: dados.itemDescricao
        ? [
            {
              codigoProd: dados.produtoBusca || '',
              descricao: dados.itemDescricao || '',
              ncm: dados.itemNcm || '',
              cfop: dados.itemCfop || '',
              unidade: dados.itemUnidade || 'UN',
              quantidade: Number(dados.itemQuantidade) || 1,
              valorUnitario: Number(dados.itemValorUnitario) || 0,
              valorDesconto: dados.itemDesconto ? Number(dados.itemDesconto) : undefined,
            },
          ]
        : [],
      transporte: {
        modalidadeFrete: Number(dados.modalidadeFrete) as 0 | 1 | 2 | 3 | 4 | 9,
        transportadoraCpfCnpj: dados.transportadoraCpfCnpj || undefined,
        placa: dados.placa || undefined,
      },
      pagamento: {
        formaPagamento: dados.formaPagamento || '01',
        valor: Number(dados.valorPagamento) || 0,
      },
      informacoesComplementares: dados.informacoesComplementares || undefined,
    }

    return new Promise<void>((resolve, reject) => {
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          const status = response?.status || response?.documento?.status

          if (status === 'AUTORIZADA') {
            notifications.show({
              title: 'NF-e Autorizada',
              message: `Protocolo: ${response?.protocolo || response?.documento?.protocolo || 'N/A'}`,
              color: 'green',
            })
            router.push('/fiscal/nfe')
          } else if (status === 'REJEITADA') {
            notifications.show({
              title: 'NF-e Rejeitada',
              message: response?.motivo || response?.erros?.[0] || 'Documento rejeitado pela SEFAZ',
              color: 'red',
            })
          } else if (status === 'CONTINGENCIA') {
            notifications.show({
              title: 'Contingência',
              message: 'Documento enfileirado para retransmissão quando o serviço normalizar',
              color: 'blue',
            })
            router.push('/fiscal/nfe')
          } else {
            // Default success — document created/queued
            notifications.show({
              title: 'Sucesso',
              message: 'NF-e enviada para processamento',
              color: 'green',
            })
            router.push('/fiscal/nfe')
          }

          resolve()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na Emissão',
            message: err?.response?.data?.message || 'Erro ao emitir NF-e',
            color: 'red',
          })
          reject(err)
        },
      })
    })
  }

  return (
    <FormularioEmissao
      tipo="NFE"
      steps={steps}
      onSubmit={handleSubmit}
      title="Emissão de NF-e"
      breadcrumb="Início / Fiscal / NF-e / Nova"
    />
  )
}
