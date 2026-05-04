'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay,
  Checkbox, NumberInput, Select, TextInput, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import {
  IconPrinter, IconBarcode, IconPackage, IconMapPin,
  IconSearch, IconRefresh, IconCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

export default function EtiquetasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Etiquetas' }, [])

  const [selectedEnderecos, setSelectedEnderecos] = useState<Set<string>>(new Set())
  const [selectedProdutos, setSelectedProdutos] = useState<Set<string>>(new Set())
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set())
  const [copias, setCopias] = useState<number>(1)
  const [searchProd, setSearchProd] = useState('')
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<any[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  // Endereços
  const { data: enderecosResp, isLoading: loadEnd } = useQuery<any>({
    queryKey: ['etiq-enderecos'],
    queryFn: async () => { const { data } = await api.get('/etiquetas/enderecos', { params: { limit: 100 } }); return data },
  })

  // Produtos
  const { data: produtosResp, isLoading: loadProd } = useQuery<any>({
    queryKey: ['etiq-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/etiquetas/produtos', { params: { limit: 100, search: searchProd || undefined } }); return data },
  })

  // Volumes
  const { data: volumesResp, isLoading: loadVol } = useQuery<any>({
    queryKey: ['etiq-volumes'],
    queryFn: async () => { const { data } = await api.get('/etiquetas/volumes', { params: { limit: 50 } }); return data },
  })

  // Gerar etiquetas
  const gerarEtiquetas = useMutation({
    mutationFn: async ({ tipo, ids }: { tipo: string; ids: string[] }) => {
      const { data } = await api.post('/etiquetas/gerar', { tipo, ids, quantidade: copias })
      return data
    },
    onSuccess: (data) => {
      setEtiquetasGeradas(data.etiquetas || [])
      notifications.show({ title: '✅ Etiquetas geradas', message: `${data.total} etiqueta(s)`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function toggleSelection(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const newSet = new Set(set)
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id)
    setFn(newSet)
  }

  function selectAll(items: any[], set: Set<string>, setFn: (s: Set<string>) => void) {
    if (set.size === items.length) setFn(new Set())
    else setFn(new Set(items.map((i: any) => i.id)))
  }

  function handlePrint() {
    if (printRef.current) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Etiquetas</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
            .etiqueta { border: 1px dashed #ccc; padding: 10px; margin: 5px; display: inline-block; width: 280px; text-align: center; page-break-inside: avoid; }
            .etiqueta .linha1 { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
            .etiqueta .linha2 { font-size: 11px; color: #555; margin-bottom: 4px; }
            .etiqueta .linha3 { font-size: 10px; color: #888; margin-bottom: 8px; }
            .etiqueta img { max-width: 260px; height: 50px; }
            @media print { .etiqueta { border: 1px solid #000; } }
          </style></head><body>
          ${printRef.current.innerHTML}
          <script>window.print(); window.close();</script>
          </body></html>
        `)
        printWindow.document.close()
      }
    }
  }

  const enderecos = enderecosResp?.data || []
  const produtos = produtosResp?.data || []
  const volumes = volumesResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Etiquetas</Text>
      <Text size="xl" fw={600} mb="lg">Geração de Etiquetas</Text>

      <Card>
        <Tabs defaultValue="enderecos">
          <Tabs.List mb="md">
            <Tabs.Tab value="enderecos" leftSection={<IconMapPin size={16} />}>Endereços ({enderecos.length})</Tabs.Tab>
            <Tabs.Tab value="produtos" leftSection={<IconBarcode size={16} />}>Produtos ({produtos.length})</Tabs.Tab>
            <Tabs.Tab value="volumes" leftSection={<IconPackage size={16} />}>Volumes ({volumes.length})</Tabs.Tab>
            {etiquetasGeradas.length > 0 && (
              <Tabs.Tab value="preview" leftSection={<IconPrinter size={16} />}>
                Preview ({etiquetasGeradas.length})
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* ENDEREÇOS */}
          <Tabs.Panel value="enderecos">
            <Group justify="space-between" mb="md">
              <Text fw={500}>Selecione os endereços para gerar etiquetas</Text>
              <Group>
                <NumberInput label="Cópias" min={1} max={10} value={copias} onChange={(v) => setCopias(typeof v === 'number' ? v : 1)} className="w-24" size="xs" />
                <Button leftSection={<IconPrinter size={16} />} disabled={selectedEnderecos.size === 0}
                  onClick={() => gerarEtiquetas.mutate({ tipo: 'ENDERECO', ids: Array.from(selectedEnderecos) })}
                  loading={gerarEtiquetas.isPending}>
                  Gerar ({selectedEnderecos.size})
                </Button>
              </Group>
            </Group>
            <LoadingOverlay visible={loadEnd} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th><Checkbox checked={selectedEnderecos.size === enderecos.length && enderecos.length > 0} onChange={() => selectAll(enderecos, selectedEnderecos, setSelectedEnderecos)} /></Table.Th>
                  <Table.Th>Endereço</Table.Th><Table.Th>Rua</Table.Th><Table.Th>Prédio</Table.Th><Table.Th>Nível</Table.Th><Table.Th>Tipo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {enderecos.map((e: any) => (
                  <Table.Tr key={e.id}>
                    <Table.Td><Checkbox checked={selectedEnderecos.has(e.id)} onChange={() => toggleSelection(selectedEnderecos, setSelectedEnderecos, e.id)} /></Table.Td>
                    <Table.Td className="font-mono fw-500">{e.enderecoCompleto}</Table.Td>
                    <Table.Td>{e.rua}</Table.Td><Table.Td>{e.predio}</Table.Td><Table.Td>{e.nivel}</Table.Td>
                    <Table.Td><Badge variant="light" size="sm">{e.tipo}</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {enderecos.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum endereço</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* PRODUTOS */}
          <Tabs.Panel value="produtos">
            <Group justify="space-between" mb="md">
              <TextInput placeholder="Buscar produto..." leftSection={<IconSearch size={16} />} value={searchProd} onChange={(e) => setSearchProd(e.currentTarget.value)} className="w-72" />
              <Group>
                <NumberInput label="Cópias" min={1} max={10} value={copias} onChange={(v) => setCopias(typeof v === 'number' ? v : 1)} className="w-24" size="xs" />
                <Button leftSection={<IconPrinter size={16} />} disabled={selectedProdutos.size === 0}
                  onClick={() => gerarEtiquetas.mutate({ tipo: 'PRODUTO', ids: Array.from(selectedProdutos) })}
                  loading={gerarEtiquetas.isPending}>
                  Gerar ({selectedProdutos.size})
                </Button>
              </Group>
            </Group>
            <LoadingOverlay visible={loadProd} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th><Checkbox checked={selectedProdutos.size === produtos.length && produtos.length > 0} onChange={() => selectAll(produtos, selectedProdutos, setSelectedProdutos)} /></Table.Th>
                  <Table.Th>Código</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>EAN</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {produtos.map((p: any) => (
                  <Table.Tr key={p.id}>
                    <Table.Td><Checkbox checked={selectedProdutos.has(p.id)} onChange={() => toggleSelection(selectedProdutos, setSelectedProdutos, p.id)} /></Table.Td>
                    <Table.Td className="font-mono">{p.codigo}</Table.Td>
                    <Table.Td fw={500}>{p.nome}</Table.Td>
                    <Table.Td>{p.unidade}</Table.Td>
                    <Table.Td className="font-mono text-sm">{p.ean || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {produtos.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum produto</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* VOLUMES */}
          <Tabs.Panel value="volumes">
            <Group justify="space-between" mb="md">
              <Text fw={500}>Volumes para etiquetas</Text>
              <Group>
                <NumberInput label="Cópias" min={1} max={10} value={copias} onChange={(v) => setCopias(typeof v === 'number' ? v : 1)} className="w-24" size="xs" />
                <Button leftSection={<IconPrinter size={16} />} disabled={selectedVolumes.size === 0}
                  onClick={() => gerarEtiquetas.mutate({ tipo: 'VOLUME', ids: Array.from(selectedVolumes) })}
                  loading={gerarEtiquetas.isPending}>
                  Gerar ({selectedVolumes.size})
                </Button>
              </Group>
            </Group>
            <LoadingOverlay visible={loadVol} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th><Checkbox checked={selectedVolumes.size === volumes.length && volumes.length > 0} onChange={() => selectAll(volumes, selectedVolumes, setSelectedVolumes)} /></Table.Th>
                  <Table.Th>Código</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Peso</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {volumes.map((v: any) => (
                  <Table.Tr key={v.id}>
                    <Table.Td><Checkbox checked={selectedVolumes.has(v.id)} onChange={() => toggleSelection(selectedVolumes, setSelectedVolumes, v.id)} /></Table.Td>
                    <Table.Td className="font-mono fw-500">{v.codigo}</Table.Td>
                    <Table.Td>{v.tipo}</Table.Td>
                    <Table.Td>{v.peso ? `${v.peso} kg` : '—'}</Table.Td>
                    <Table.Td>{v.totalItens}</Table.Td>
                    <Table.Td><Badge variant="light" size="sm">{v.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {volumes.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum volume</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* PREVIEW */}
          {etiquetasGeradas.length > 0 && (
            <Tabs.Panel value="preview">
              <Group justify="space-between" mb="md">
                <Text fw={500}>Preview das Etiquetas ({etiquetasGeradas.length})</Text>
                <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Imprimir</Button>
              </Group>

              <div ref={printRef}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {etiquetasGeradas.map((etq, idx) => (
                    <div key={idx} className="etiqueta" style={{
                      border: '1px dashed #ccc', padding: 12, width: 290, textAlign: 'center',
                      borderRadius: 4, background: '#fff',
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>{etq.linha1}</div>
                      <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{etq.linha2}</div>
                      {etq.linha3 && <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>{etq.linha3}</div>}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_URL}/api/etiquetas/barcode/${encodeURIComponent(etq.barcode)}?tipo=code128`}
                        alt={etq.barcode}
                        style={{ maxWidth: 260, height: 50 }}
                      />
                      <div style={{ fontSize: 9, color: '#aaa', marginTop: 4 }}>{etq.tipo}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Tabs.Panel>
          )}
        </Tabs>
      </Card>
    </div>
  )
}
