'use client'

import { Card, Text, Timeline, ThemeIcon } from '@mantine/core'
import { IconTruckDelivery, IconClipboardCheck, IconMapPin, IconPackage, IconTruck } from '@tabler/icons-react'

export default function FluxoPage() {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Fluxo de Processos</Text>
      <Text size="xl" fw={600} mb="lg">Fluxo de Processos WMS</Text>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Text fw={600} mb="md">Fluxo de Entrada (Recebimento)</Text>
          <Timeline active={-1} bulletSize={32} lineWidth={2}>
            <Timeline.Item bullet={<IconTruckDelivery size={16} />} title="1. Agendamento de Doca">
              <Text size="sm" c="dimmed">Fornecedor agenda horário e doca para descarga</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconTruckDelivery size={16} />} title="2. Portaria / Registro de Veículo">
              <Text size="sm" c="dimmed">Veículo chega, é registrado e direcionado à doca</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconClipboardCheck size={16} />} title="3. Recepção da Nota Fiscal">
              <Text size="sm" c="dimmed">NF é registrada no sistema com itens e quantidades</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconClipboardCheck size={16} />} title="4. Conferência (Cega/Normal)">
              <Text size="sm" c="dimmed">Conferente valida quantidades e qualidade dos itens</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconMapPin size={16} />} title="5. Endereçamento">
              <Text size="sm" c="dimmed">Produtos são direcionados aos endereços de armazenagem</Text>
            </Timeline.Item>
          </Timeline>
        </Card>

        <Card>
          <Text fw={600} mb="md">Fluxo de Saída (Expedição)</Text>
          <Timeline active={-1} bulletSize={32} lineWidth={2}>
            <Timeline.Item bullet={<IconClipboardCheck size={16} />} title="1. Recebimento do Pedido">
              <Text size="sm" c="dimmed">Pedido de venda é recebido e gera ordem de expedição</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconPackage size={16} />} title="2. Separação (Picking)">
              <Text size="sm" c="dimmed">Itens são separados dos endereços de picking/armazenagem</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconClipboardCheck size={16} />} title="3. Conferência de Saída">
              <Text size="sm" c="dimmed">Validação dos itens separados contra o pedido</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconTruck size={16} />} title="4. Montagem de Carga">
              <Text size="sm" c="dimmed">Pedidos são agrupados por rota e montados no veículo</Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconTruck size={16} />} title="5. Expedição / Despacho">
              <Text size="sm" c="dimmed">Veículo é liberado com mapa de carregamento</Text>
            </Timeline.Item>
          </Timeline>
        </Card>
      </div>
    </div>
  )
}
