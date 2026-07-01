'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import {
  IconUser,
  IconPackage,
  IconCash,
} from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { FormularioEmissao, type StepConfig } from '@/components/fiscal/FormularioEmissao'
import { useNfce } from '@/data/hooks/fiscal/useNfce'

const steps: StepConfig[] = [
  {
    label: 'Consumidor',
    icon: IconUser,
    fields: [
      {
        name: 'cpfCnpj',
        label: 'CPF/CNPJ (opcional)',
        type: 'text',
        span: 6,
      },
      {
        name: 'nomeConsumidor',
        label: 'Nome do Consumidor (opcional)',
        type: 'text',
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
        required: true,
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
        required: true,
        span: 3,
      },
      {
        name: 'itemValorUnitario',
        label: 'Valor Unitário',
        type: 'number',
        required: true,
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
]

export default function NfceNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Nova NFC-e' }, [])

  const router = useRouter()
  const { useEmitir } = useNfce()
  const emitirMutation = useEmitir()

  async function handleSubmit(dados: Record<string, any>) {
    const payload = {
      consumidor: dados.cpfCnpj
        ? { cpfCnpj: dados.cpfCnpj, nome: dados.nomeConsumidor || undefined }
        : undefined,
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
      pagamento: {
        formaPagamento: dados.formaPagamento || '01',
        valor: Number(dados.valorPagamento) || 0,
      },
    }

    return new Promise<void>((resolve, reject) => {
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          const status = response?.status || response?.documento?.status

          if (status === 'AUTORIZADA') {
            notifications.show({
              title: 'NFC-e Autorizada',
              message: response?.danfceUrl
                ? 'Documento autorizado. Clique na notificação para imprimir o DANFCE.'
                : `Protocolo: ${response?.protocolo || response?.documento?.protocolo || 'N/A'}`,
              color: 'green',
              autoClose: 10000,
            })
            // If DANFCE URL is available, open it for printing
            if (response?.danfceUrl) {
              window.open(response.danfceUrl, '_blank')
            }
            router.push('/fiscal/nfce')
          } else if (status === 'REJEITADA') {
            notifications.show({
              title: 'NFC-e Rejeitada',
              message: response?.motivo || response?.erros?.[0] || 'Documento rejeitado pela SEFAZ',
              color: 'red',
            })
          } else if (status === 'CONTINGENCIA') {
            notifications.show({
              title: 'Contingência',
              message: 'Documento enfileirado para retransmissão quando o serviço normalizar',
              color: 'blue',
            })
            router.push('/fiscal/nfce')
          } else {
            notifications.show({
              title: 'Sucesso',
              message: 'NFC-e enviada para processamento',
              color: 'green',
            })
            router.push('/fiscal/nfce')
          }

          resolve()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na Emissão',
            message: err?.response?.data?.message || 'Erro ao emitir NFC-e',
            color: 'red',
          })
          reject(err)
        },
      })
    })
  }

  return (
    <FormularioEmissao
      tipo="NFCE"
      steps={steps}
      onSubmit={handleSubmit}
      title="Emissão de NFC-e"
      breadcrumb="Início / Fiscal / NFC-e / Nova"
    />
  )
}
