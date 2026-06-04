'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Group, NumberInput, Select, Button, Text, Alert, SimpleGrid } from '@mantine/core'
import { IconArrowsShuffle, IconInfoCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'

export default function ConversaoPage() {
  useEffect(() => { document.title = 'PCP - Conversão de Unidades' }, [])

  const [valorOrigem, setValorOrigem] = useState<number | ''>(0)
  const [unidadeOrigem, setUnidadeOrigem] = useState<string | null>(null)
  const [unidadeDestino, setUnidadeDestino] = useState<string | null>(null)
  const [gramaturaGm2, setGramaturaGm2] = useState<number | ''>(150)
  const [larguraMm, setLarguraMm] = useState<number | ''>(1000)
  const [comprimentoMm, setComprimentoMm] = useState<number | ''>(700)
  const [folhasPorResma, setFolhasPorResma] = useState<number | ''>(500)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  const unidades = ['kg', 'm2', 'metros_lineares', 'folhas', 'resmas']

  async function converter() {
    setErro(null)
    setResultado(null)
    if (!valorOrigem || !unidadeOrigem || !unidadeDestino) return

    try {
      const res = await api.post('/pcp/conversao-unidades', {
        valorOrigem: Number(valorOrigem),
        unidadeOrigem,
        unidadeDestino,
        gramaturaGm2: gramaturaGm2 ? Number(gramaturaGm2) : undefined,
        larguraMm: larguraMm ? Number(larguraMm) : undefined,
        comprimentoMm: comprimentoMm ? Number(comprimentoMm) : undefined,
        folhasPorResma: folhasPorResma ? Number(folhasPorResma) : undefined,
      })
      setResultado(res.data)
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro na conversão')
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Conversão de Unidades — Indústria Gráfica</Title>

      <Card withBorder>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput label="Valor" value={valorOrigem} onChange={setValorOrigem} min={0} decimalScale={4} />
            <Select label="De" data={unidades} value={unidadeOrigem} onChange={setUnidadeOrigem} placeholder="Unidade origem" />
            <Select label="Para" data={unidades} value={unidadeDestino} onChange={setUnidadeDestino} placeholder="Unidade destino" />
          </SimpleGrid>

          <Text size="sm" fw={600} c="dimmed">Parâmetros (informe conforme necessário):</Text>

          <SimpleGrid cols={{ base: 1, sm: 4 }}>
            <NumberInput label="Gramatura (g/m²)" value={gramaturaGm2} onChange={setGramaturaGm2} min={1} />
            <NumberInput label="Largura (mm)" value={larguraMm} onChange={setLarguraMm} min={1} />
            <NumberInput label="Comprimento (mm)" value={comprimentoMm} onChange={setComprimentoMm} min={1} />
            <NumberInput label="Folhas/Resma" value={folhasPorResma} onChange={setFolhasPorResma} min={1} />
          </SimpleGrid>

          <Button leftSection={<IconArrowsShuffle size={16} />} onClick={converter} w="fit-content">
            Converter
          </Button>
        </Stack>
      </Card>

      {erro && (
        <Alert color="red" icon={<IconInfoCircle />} title="Erro">
          {erro}
        </Alert>
      )}

      {resultado && (
        <Card withBorder bg="green.0">
          <Stack gap="xs">
            <Text size="lg" fw={700} c="green.8">
              {resultado.valorOrigem} {resultado.unidadeOrigem} = {resultado.valorConvertido} {resultado.unidadeDestino}
            </Text>
            <Text size="sm" c="dimmed">
              Parâmetros: {Object.entries(resultado.parametrosUtilizados || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
