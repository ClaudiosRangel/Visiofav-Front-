'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import {
  IconFileText,
  IconUser,
  IconPackage,
  IconCash,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { FormularioEmissao, type StepConfig } from '@/components/fiscal/FormularioEmissao'
import { useCte } from '@/data/hooks/fiscal/useCte'

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
        name: 'tipoServico',
        label: 'Tipo de Serviço',
        type: 'select',
        required: true,
        span: 6,
        options: [
          { value: '0', label: '0 - Normal' },
          { value: '1', label: '1 - Subcontratação' },
          { value: '2', label: '2 - Redespacho' },
          { value: '3', label: '3 - Redespacho Intermediário' },
          { value: '4', label: '4 - Serviço Vinculado a Multimodal' },
        ],
      },
      {
        name: 'cfop',
        label: 'CFOP',
        type: 'text',
        required: true,
        span: 6,
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
    label: 'Tomador',
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
    label: 'Dados da Carga',
    icon: IconPackage,
    fields: [
      {
        name: 'valorCarga',
        label: 'Valor da Carga',
        type: 'number',
        required: true,
        span: 6,
      },
      {
        name: 'descricaoProduto',
        label: 'Descrição do Produto Predominante',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'pesoBruto',
        label: 'Peso Bruto (kg)',
        type: 'number',
        span: 6,
      },
      {
        name: 'ufOrigem',
        label: 'UF Origem',
        type: 'text',
        required: true,
        span: 6,
      },
      {
        name: 'ufDestino',
        label: 'UF Destino',
        type: 'text',
        required: true,
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
          { value: '15', label: '15 - Boleto Bancário' },
          { value: '16', label: '16 - Depósito Bancário' },
          { value: '17', label: '17 - PIX' },
          { value: '90', label: '90 - Sem Pagamento' },
          { value: '99', label: '99 - Outros' },
        ],
      },
      {
        name: 'valorPrestacao',
        label: 'Valor da Prestação de Serviço',
        type: 'number',
        required: true,
        span: 6,
      },
    ],
  },
]

export default function CteNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Novo CT-e' }, [])

  const router = useRouter()
  const { useEmitir } = useCte()
  const emitirMutation = useEmitir()

  async function handleSubmit(dados: Record<string, any>) {
    const payload = {
      naturezaOp: dados.naturezaOp || '',
      tipoServico: Number(dados.tipoServico) || 0,
      cfop: dados.cfop || '',
      dataEmissao: dados.dataEmissao
        ? new Date(dados.dataEmissao).toISOString()
        : new Date().toISOString(),
      tomador: {
        cpfCnpj: dados.cpfCnpj || '',
        razaoSocial: dados.razaoSocial || '',
        ie: dados.ie || undefined,
        uf: dados.uf || '',
      },
      carga: {
        valorCarga: Number(dados.valorCarga) || 0,
        descricaoProduto: dados.descricaoProduto || '',
        pesoBruto: dados.pesoBruto ? Number(dados.pesoBruto) : undefined,
        ufOrigem: dados.ufOrigem || '',
        ufDestino: dados.ufDestino || '',
      },
      pagamento: {
        formaPagamento: dados.formaPagamento || '01',
        valorPrestacao: Number(dados.valorPrestacao) || 0,
      },
    }

    return new Promise<void>((resolve, reject) => {
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          const status = response?.status || response?.documento?.status

          if (status === 'AUTORIZADA') {
            notifications.show({
              title: 'CT-e Autorizado',
              message: `Protocolo: ${response?.protocolo || response?.documento?.protocolo || 'N/A'}`,
              color: 'green',
            })
            router.push('/fiscal/cte')
          } else if (status === 'REJEITADA') {
            notifications.show({
              title: 'CT-e Rejeitado',
              message: response?.motivo || response?.erros?.[0] || 'Documento rejeitado pela SEFAZ',
              color: 'red',
            })
          } else if (status === 'CONTINGENCIA') {
            notifications.show({
              title: 'Contingência',
              message: 'Documento enfileirado para retransmissão quando o serviço normalizar',
              color: 'blue',
            })
            router.push('/fiscal/cte')
          } else {
            notifications.show({
              title: 'Sucesso',
              message: 'CT-e enviado para processamento',
              color: 'green',
            })
            router.push('/fiscal/cte')
          }

          resolve()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na Emissão',
            message: err?.response?.data?.message || 'Erro ao emitir CT-e',
            color: 'red',
          })
          reject(err)
        },
      })
    })
  }

  return (
    <FormularioEmissao
      tipo="CTE"
      steps={steps}
      onSubmit={handleSubmit}
      title="Emissão de CT-e"
      breadcrumb="Início / Fiscal / CT-e / Nova"
    />
  )
}
