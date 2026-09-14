'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, Group, Text, Switch, Button, LoadingOverlay, Stack, Divider, Alert } from '@mantine/core'
import { IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { listarItensMenuWms } from '@/components/layout/ModuleSidebar'
import { idGrupo, MENU_CONFIG_PROTEGIDO_HREF } from '@/lib/wms-menu-filter'

/**
 * Configuração de Menus do WMS (spec wms-configurar-menus).
 * Admin liga/desliga itens e grupos do menu lateral do WMS. Itens desabilitados
 * somem da barra. O item desta própria tela nunca pode ser desabilitado.
 */
export default function WmsConfigMenusPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração de Menus' }, [])
  const queryClient = useQueryClient()

  // Lista fixa de itens do menu WMS (fonte única compartilhada com a sidebar).
  const itens = useMemo(() => listarItensMenuWms(), [])

  // Agrupa por grupo preservando a ordem de aparição.
  const grupos = useMemo(() => {
    const ordem: string[] = []
    const map = new Map<string, { grupoLabel: string; itens: typeof itens }>()
    for (const it of itens) {
      const chave = it.grupoLabel ?? '__soltos__'
      if (!map.has(chave)) {
        map.set(chave, { grupoLabel: it.grupoLabel ?? 'Geral', itens: [] })
        ordem.push(chave)
      }
      map.get(chave)!.itens.push(it)
    }
    return ordem.map((c) => map.get(c)!)
  }, [itens])

  const [desabilitados, setDesabilitados] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery<{ menusDesabilitados: string[] }>({
    queryKey: ['wms-config-menus'],
    queryFn: async () => { const { data } = await api.get('/wms/config-menus'); return data },
  })

  useEffect(() => {
    if (data?.menusDesabilitados) setDesabilitados(new Set(data.menusDesabilitados))
  }, [data])

  const salvar = useMutation({
    mutationFn: async () => {
      const lista = Array.from(desabilitados).filter((id) => id !== MENU_CONFIG_PROTEGIDO_HREF)
      const { data } = await api.put('/wms/config-menus', { menusDesabilitados: lista })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-config-menus'] })
      notifications.show({ title: 'Sucesso', message: 'Configuração de menus salva. A barra será atualizada.', color: 'green' })
    },
    onError: (err: any) => {
      const msg = err?.response?.status === 403
        ? 'Somente administradores podem alterar esta configuração.'
        : err?.response?.data?.message || 'Falha ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    },
  })

  function toggleItem(href: string, habilitado: boolean) {
    if (href === MENU_CONFIG_PROTEGIDO_HREF) return // protegido
    setDesabilitados((prev) => {
      const next = new Set(prev)
      if (habilitado) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function toggleGrupo(grupoLabel: string, habilitado: boolean) {
    const gid = idGrupo(grupoLabel)
    setDesabilitados((prev) => {
      const next = new Set(prev)
      if (habilitado) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Text size="xs" c="dimmed" mb={4}>WMS / Configuração / Menus</Text>
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={600}>Configuração de Menus</Text>
        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={() => salvar.mutate()} loading={salvar.isPending}>
          Salvar
        </Button>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
        Itens desativados somem da barra lateral do WMS para todos os usuários desta empresa.
        Desativar um grupo oculta todas as suas telas.
      </Alert>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Stack gap="lg">
          {grupos.map((grupo) => {
            const gid = idGrupo(grupo.grupoLabel)
            const grupoHabilitado = !desabilitados.has(gid)
            const temGrupoReal = grupo.itens.some((i) => i.grupoLabel !== null)
            return (
              <div key={grupo.grupoLabel}>
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>{grupo.grupoLabel}</Text>
                  {temGrupoReal && (
                    <Switch
                      label={grupoHabilitado ? 'Grupo ativo' : 'Grupo oculto'}
                      checked={grupoHabilitado}
                      onChange={(e) => toggleGrupo(grupo.grupoLabel, e.currentTarget.checked)}
                    />
                  )}
                </Group>
                <Divider mb="xs" />
                <Stack gap={6} pl="sm">
                  {grupo.itens.map((it) => {
                    const protegido = it.href === MENU_CONFIG_PROTEGIDO_HREF
                    const itemHabilitado = !desabilitados.has(it.href)
                    // Se o grupo está oculto, os itens aparecem esmaecidos (o grupo manda).
                    return (
                      <Group key={it.href} justify="space-between" opacity={grupoHabilitado ? 1 : 0.5}>
                        <Text size="sm">{it.label}{protegido ? ' (não pode ser ocultado)' : ''}</Text>
                        <Switch
                          checked={itemHabilitado && grupoHabilitado}
                          disabled={protegido || !grupoHabilitado}
                          onChange={(e) => toggleItem(it.href, e.currentTarget.checked)}
                        />
                      </Group>
                    )
                  })}
                </Stack>
              </div>
            )
          })}
        </Stack>
      </Card>
    </div>
  )
}
