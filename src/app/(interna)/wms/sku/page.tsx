'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Select, LoadingOverlay, Alert,
} from '@mantine/core'
import { IconPackage, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import SkuPanel from '../../configurador/produtos/SkuPanel'

export default function SkuWmsPage() {
  useModuloGuard('WMS')

  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [searchProd, setSearchProd] = useState('')

  // Produtos
  const { data: produtosResp, isLoading } = useQuery<any>({
    queryKey: ['wms-sku-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  const produtos = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))
  const produtoSelecionado = (produtosResp?.data || []).find((p: any) => p.id === produtoId)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / SKU</Text>
      <Text size="xl" fw={600} mb="lg">SKU / Embalagens dos Produtos</Text>

      <Card mb="md">
        <Select
          label="Selecione o Produto"
          placeholder="Buscar por código ou nome..."
          data={produtos}
          value={produtoId}
          onChange={setProdutoId}
          searchable
          onSearchChange={setSearchProd}
          leftSection={<IconSearch size={16} />}
          className="w-full max-w-lg"
          size="md"
        />
      </Card>

      {!produtoId && (
        <Alert icon={<IconPackage size={16} />} color="blue" variant="light">
          Selecione um produto acima para visualizar e gerenciar seus SKUs (embalagens, dimensões, pesos e paletização).
        </Alert>
      )}

      {produtoId && (
        <SkuPanel produtoId={produtoId} produtoNome={produtoSelecionado?.nome || produtoSelecionado?.codigo || ''} />
      )}
    </div>
  )
}
