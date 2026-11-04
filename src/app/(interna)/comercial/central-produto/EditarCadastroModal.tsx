'use client'

/**
 * Modal de edição do cadastro do produto na Central do Produto/Acabado.
 * Edita: descrição, arte (imagemUrl) e vínculos de CÓDIGO DE ACABADO
 * (adicionar/remover). A ficha técnica (atributos gráficos) depende de
 * cadastros sem endpoint dedicado hoje — fica como follow-up (ver tasks).
 * Só é renderizado quando o usuário tem permissão de edição.
 */
import { useEffect, useState } from 'react'
import {
  Modal, Stack, TextInput, Textarea, Button, Group, Text, Badge,
  ActionIcon, TagsInput, Alert,
} from '@mantine/core'
import { IconTrash, IconInfoCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { DetalheProduto } from './page'

interface Props {
  opened: boolean
  onClose: () => void
  produtoId: string
  detalheAtual: DetalheProduto
  onSalvo: (novo: DetalheProduto) => void
}

export function EditarCadastroModal({ opened, onClose, produtoId, detalheAtual, onSalvo }: Props) {
  const [descricao, setDescricao] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [acabadosAtuais, setAcabadosAtuais] = useState<string[]>([])
  const [novosAcabados, setNovosAcabados] = useState<string[]>([])
  const [removerAcabados, setRemoverAcabados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (opened) {
      setDescricao(detalheAtual.identificacao.descricao ?? '')
      setImagemUrl(detalheAtual.arte.fonte === 'PRODUTO' ? (detalheAtual.arte.imagemUrl ?? '') : '')
      setAcabadosAtuais(detalheAtual.identificacao.codigosAcabado)
      setNovosAcabados([])
      setRemoverAcabados([])
      setErro(null)
    }
  }, [opened, detalheAtual])

  const marcarRemocao = (cod: string) => {
    setRemoverAcabados((prev) => (prev.includes(cod) ? prev.filter((c) => c !== cod) : [...prev, cod]))
  }

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const body: Record<string, unknown> = {}
      if (descricao !== (detalheAtual.identificacao.descricao ?? '')) body.descricao = descricao
      const imgAtual = detalheAtual.arte.fonte === 'PRODUTO' ? (detalheAtual.arte.imagemUrl ?? '') : ''
      if (imagemUrl !== imgAtual) body.imagemUrl = imagemUrl.trim() === '' ? null : imagemUrl
      if (novosAcabados.length > 0) body.adicionarAcabados = novosAcabados
      if (removerAcabados.length > 0) body.removerAcabados = removerAcabados

      const { data } = await api.patch<DetalheProduto>(
        `/comercial/central-produto/produto/${produtoId}`,
        body,
      )
      onSalvo(data)
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErro(msg || 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Editar cadastro do produto" size="lg">
      <Stack gap="md">
        {erro && <Alert color="red" icon={<IconInfoCircle size={16} />}>{erro}</Alert>}

        <Textarea
          label="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.currentTarget.value)}
          maxLength={200}
          autosize
          minRows={2}
        />

        <TextInput
          label="Arte (URL ou data URL da imagem)"
          placeholder="https://... ou data:image/png;base64,..."
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.currentTarget.value)}
          maxLength={500}
        />

        <div>
          <Text size="sm" fw={500} mb={4}>Códigos de acabado vinculados</Text>
          {acabadosAtuais.length === 0 ? (
            <Text size="xs" c="dimmed">Nenhum código vinculado.</Text>
          ) : (
            <Group gap={6}>
              {acabadosAtuais.map((cod) => {
                const marcado = removerAcabados.includes(cod)
                return (
                  <Badge
                    key={cod}
                    variant={marcado ? 'light' : 'outline'}
                    color={marcado ? 'red' : 'grape'}
                    rightSection={
                      <ActionIcon size="xs" variant="transparent" color={marcado ? 'red' : 'gray'} onClick={() => marcarRemocao(cod)}>
                        <IconTrash size={12} />
                      </ActionIcon>
                    }
                  >
                    {cod}{marcado ? ' (remover)' : ''}
                  </Badge>
                )
              })}
            </Group>
          )}
        </div>

        <TagsInput
          label="Adicionar códigos de acabado"
          placeholder="Digite e Enter"
          value={novosAcabados}
          onChange={setNovosAcabados}
          splitChars={[',', ' ', ';']}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} loading={salvando}>Salvar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
