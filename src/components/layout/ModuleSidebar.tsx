'use client'

import { useState } from 'react'
import { UnstyledButton, Stack, Text, Divider, Collapse } from '@mantine/core'
import {
  IconArrowLeft, IconChevronDown, IconChevronRight,
  // Compras
  IconFileText, IconTruckDelivery, IconArrowBack, IconArrowsExchange, IconUsers, IconBuildingStore,
  // Vendas
  IconReceipt, IconCash, IconTags, IconChartBar, IconUserCircle,
  // Financeiro
  IconCreditCard, IconWallet,
  // Fiscal
  IconFileInvoice, IconTruck,
  // WMS
  IconHome, IconPackage, IconClipboardCheck, IconBarcode, IconBuildingWarehouse, IconArrowsExchange as IconMovim, IconSettings,
  IconEye, IconDatabase,
  // Integração
  IconKey, IconWebhook, IconUpload,
  // PCP
  IconAssembly, IconListDetails, IconCalendarEvent, IconRoute, IconSitemap, IconTool, IconClock, IconPalette,
  // Configurador
  IconBuilding,
} from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

interface NavGroup {
  label: string
  icon: React.ElementType
  items: NavItem[]
}

type MenuEntry = NavItem | NavGroup

function isGroup(entry: MenuEntry): entry is NavGroup {
  return 'items' in entry
}

interface ModuleConfig {
  title: string
  entries: MenuEntry[]
}

const MODULE_MENUS: Record<string, ModuleConfig> = {
  compras: {
    title: 'Compras',
    entries: [
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconBuildingStore, label: 'Fornecedores', href: '/configurador/fornecedores' },
          { icon: IconPackage, label: 'Produtos', href: '/configurador/produtos' },
          { icon: IconUsers, label: 'Representantes', href: '/configurador/vendedores' },
        ],
      },
      { icon: IconFileText, label: 'Pedidos de Compra', href: '/compras/pedidos' },
      { icon: IconUpload, label: 'Importar XML (NF-e)', href: '/compras/importar-xml' },
      { icon: IconTruckDelivery, label: 'Compras Efetivadas', href: '/compras/compras-efetivadas' },
      { icon: IconArrowBack, label: 'Devoluções', href: '/compras/devolucoes' },
      { icon: IconArrowsExchange, label: 'Transferências', href: '/compras/transferencias' },
    ],
  },
  vendas: {
    title: 'Vendas',
    entries: [
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconUserCircle, label: 'Clientes', href: '/configurador/clientes' },
          { icon: IconUsers, label: 'Vendedores', href: '/configurador/vendedores' },
          { icon: IconTags, label: 'Tabelas de Preço', href: '/vendas/tabelas-preco' },
        ],
      },
      { icon: IconReceipt, label: 'Pedidos de Venda', href: '/vendas/pedidos' },
      { icon: IconCash, label: 'Vendas Efetivadas', href: '/vendas/vendas-efetivadas' },
      { icon: IconTruckDelivery, label: 'Entregas', href: '/vendas/entregas' },
      { icon: IconChartBar, label: 'Comissões', href: '/vendas/comissoes' },
    ],
  },
  financeiro: {
    title: 'Financeiro',
    entries: [
      { icon: IconCreditCard, label: 'Contas a Pagar', href: '/financeiro/contas-pagar' },
      { icon: IconWallet, label: 'Contas a Receber', href: '/financeiro/contas-receber' },
    ],
  },
  fiscal: {
    title: 'Fiscal',
    entries: [
      { icon: IconFileInvoice, label: 'NF-e', href: '/fiscal/nfe' },
      { icon: IconTruck, label: 'CT-e', href: '/fiscal/cte' },
      { icon: IconSettings, label: 'Tributação', href: '/configurador/tributacao' },
    ],
  },
  wms: {
    title: 'WMS',
    entries: [
      { icon: IconHome, label: 'Dashboard', href: '/wms/dashboard' },

      // ── ENTRADA (Inbound) ──
      {
        label: 'Recebimento', icon: IconTruckDelivery, items: [
          { icon: IconClipboardCheck, label: 'Agenda de Docas', href: '/wms/agenda' },
          { icon: IconCalendarEvent, label: 'Agenda Avançada', href: '/wms/agenda-doca' },
          { icon: IconTruckDelivery, label: 'Portaria', href: '/wms/portaria' },
          { icon: IconTruckDelivery, label: 'Notas de Entrada', href: '/recebimento' },
          { icon: IconClipboardCheck, label: 'Conferência de Entrada', href: '/wms/conferencia-entrada' },
          { icon: IconBuildingWarehouse, label: 'Endereçamento', href: '/wms/enderecamento' },
        ],
      },

      // ── SAÍDA (Outbound) — Fluxo sequencial ──
      {
        label: 'Expedição', icon: IconPackage, items: [
          { icon: IconBarcode, label: 'Separação (Picking)', href: '/picking' },
          { icon: IconClipboardCheck, label: 'Conferência de Saída', href: '/wms/conferencia-saida' },
          { icon: IconPackage, label: 'Embalagem', href: '/expedicao' },
          { icon: IconTruckDelivery, label: 'Montagem de Carga', href: '/wms/montagem-carga' },
          { icon: IconTruck, label: 'Mapas de Carregamento', href: '/wms/mapas-carregamento' },
          { icon: IconArrowsExchange, label: 'Cross-Docking', href: '/wms/cross-dock' },
        ],
      },

      // ── ESTOQUE ──
      {
        label: 'Estoque', icon: IconBuildingWarehouse, items: [
          { icon: IconBuildingWarehouse, label: 'Consulta de Saldos', href: '/estoque' },
          { icon: IconBuildingWarehouse, label: 'Mapa do Armazém', href: '/wms/mapa' },
          { icon: IconArrowsExchange, label: 'Transferência', href: '/wms/transferencia-endereco' },
          { icon: IconPackage, label: 'Ressuprimento', href: '/wms/ressuprimento' },
          { icon: IconPackage, label: 'Manutenção de Estoque', href: '/wms/manutencao-estoque' },
          { icon: IconClipboardCheck, label: 'Inventário', href: '/wms/inventario' },
        ],
      },

      // ── OPERACIONAL ──
      {
        label: 'Operacional', icon: IconClipboardCheck, items: [
          { icon: IconClipboardCheck, label: 'Ordens de Serviço', href: '/wms/ordens-servico' },
          { icon: IconBarcode, label: 'Etiquetas', href: '/wms/etiquetas' },
        ],
      },

      // ── CONFIGURAÇÃO WMS ──
      {
        label: 'Configuração WMS', icon: IconSettings, items: [
          { icon: IconBarcode, label: 'Etiquetas ZPL', href: '/wms/etiquetas/templates' },
          { icon: IconBarcode, label: 'Impressoras', href: '/wms/etiquetas/impressoras' },
          { icon: IconBarcode, label: 'Fila de Impressão', href: '/wms/etiquetas/fila' },
        ],
      },

      // ── FASE 2 — ESCALAR ──
      {
        label: 'Faturamento', icon: IconCash, items: [
          { icon: IconCash, label: 'Dashboard', href: '/wms/faturamento' },
          { icon: IconCash, label: 'Contratos', href: '/wms/faturamento/contratos' },
          { icon: IconCash, label: 'Faturas', href: '/wms/faturamento/faturas' },
          { icon: IconChartBar, label: 'Relatórios', href: '/wms/faturamento/relatorios' },
        ],
      },
      {
        label: 'Picking Zona', icon: IconPackage, items: [
          { icon: IconPackage, label: 'Zonas', href: '/wms/picking-zona' },
          { icon: IconPackage, label: 'Separadores', href: '/wms/picking-zona/separadores' },
          { icon: IconPackage, label: 'Painel', href: '/wms/picking-zona/painel' },
          { icon: IconPackage, label: 'Dividir Onda', href: '/wms/picking-zona/dividir-onda' },
        ],
      },
      {
        label: 'LMS', icon: IconChartBar, items: [
          { icon: IconChartBar, label: 'Dashboard', href: '/wms/lms' },
          { icon: IconChartBar, label: 'Metas', href: '/wms/lms/metas' },
          { icon: IconChartBar, label: 'Ranking', href: '/wms/lms/ranking' },
          { icon: IconChartBar, label: 'Incentivos', href: '/wms/lms/incentivos' },
          { icon: IconChartBar, label: 'Pausas', href: '/wms/lms/pausas' },
        ],
      },
      {
        label: 'Pátio', icon: IconTruckDelivery, items: [
          { icon: IconTruckDelivery, label: 'Painel', href: '/wms/patio' },
          { icon: IconTruckDelivery, label: 'Entrada', href: '/wms/patio/entrada' },
          { icon: IconTruckDelivery, label: 'Fila', href: '/wms/patio/fila' },
          { icon: IconTruckDelivery, label: 'Chamada Doca', href: '/wms/patio/chamada' },
          { icon: IconTruckDelivery, label: 'Relatórios', href: '/wms/patio/relatorios' },
          { icon: IconSettings, label: 'Configuração', href: '/wms/patio/config' },
        ],
      },
      {
        label: 'Multi-CD', icon: IconArrowsExchange, items: [
          { icon: IconArrowsExchange, label: 'Transferências', href: '/wms/multi-cd' },
          { icon: IconArrowsExchange, label: 'Nova Solicitação', href: '/wms/multi-cd/nova-solicitacao' },
          { icon: IconArrowsExchange, label: 'Estoque Trânsito', href: '/wms/multi-cd/transito' },
          { icon: IconArrowsExchange, label: 'Aprovações', href: '/wms/multi-cd/aprovacoes' },
        ],
      },

      // ── FASE 3 — DIFERENCIAR ──
      {
        label: 'Demanda/IA', icon: IconChartBar, items: [
          { icon: IconChartBar, label: 'Dashboard', href: '/wms/demanda' },
          { icon: IconChartBar, label: 'Classificação ABC', href: '/wms/demanda/abc' },
          { icon: IconChartBar, label: 'Slotting', href: '/wms/demanda/slotting' },
          { icon: IconChartBar, label: 'Previsões', href: '/wms/demanda/previsoes' },
          { icon: IconChartBar, label: 'Simulação', href: '/wms/demanda/simulacao' },
        ],
      },
      {
        label: 'BI Avançado', icon: IconChartBar, items: [
          { icon: IconChartBar, label: 'Dashboard', href: '/wms/bi' },
          { icon: IconCash, label: 'Custos', href: '/wms/bi/custos' },
          { icon: IconChartBar, label: 'Correlação', href: '/wms/bi/correlacao' },
          { icon: IconChartBar, label: 'Alertas', href: '/wms/bi/alertas' },
          { icon: IconSettings, label: 'Config Custos', href: '/wms/bi/config' },
        ],
      },
      {
        label: 'Wave Planning', icon: IconPackage, items: [
          { icon: IconPackage, label: 'Painel', href: '/wms/wave' },
          { icon: IconPackage, label: 'Regras', href: '/wms/wave/regras' },
          { icon: IconPackage, label: 'Simular', href: '/wms/wave/simular' },
          { icon: IconPackage, label: 'Planejamentos', href: '/wms/wave/planejamentos' },
        ],
      },
      {
        label: 'Portal 3PL', icon: IconEye, items: [
          { icon: IconEye, label: 'Admin Portal', href: '/wms/portal' },
          { icon: IconEye, label: 'Usuários', href: '/wms/portal/usuarios' },
          { icon: IconEye, label: 'Solicitações', href: '/wms/portal/solicitacoes' },
        ],
      },

      // ── RELATÓRIOS E GESTÃO ──
      {
        label: 'Gestão', icon: IconChartBar, items: [
          { icon: IconChartBar, label: 'KPI / SLA', href: '/wms/kpi' },
          { icon: IconChartBar, label: 'Relatórios WMS', href: '/wms/relatorios' },
          { icon: IconTruckDelivery, label: 'Relatórios Expedição', href: '/wms/relatorios-expedicao' },
          { icon: IconArrowBack, label: 'Devoluções', href: '/wms/logistica-reversa' },
          { icon: IconEye, label: 'Auditoria', href: '/wms/auditoria' },
        ],
      },

      // ── CADASTROS ──
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconPackage, label: 'Produtos', href: '/wms/consulta/produtos' },
          { icon: IconBarcode, label: 'SKU / Embalagens', href: '/wms/sku' },
          { icon: IconDatabase, label: 'Dados Logísticos', href: '/wms/dados-logisticos' },
          { icon: IconTruckDelivery, label: 'Rotas', href: '/configurador/rotas' },
          { icon: IconBuildingStore, label: 'Fornecedores', href: '/wms/consulta/fornecedores' },
          { icon: IconTruck, label: 'Transportadoras', href: '/wms/consulta/transportadoras' },
          { icon: IconUserCircle, label: 'Clientes', href: '/wms/consulta/clientes' },
        ],
      },

      // ── CONFIGURAÇÕES ──
      {
        label: 'Configurações', icon: IconSettings, items: [
          { icon: IconSettings, label: 'Empresa', href: '/configurador/empresa' },
          { icon: IconSettings, label: 'Centros Distrib.', href: '/configurador/centros-distribuicao' },
          { icon: IconSettings, label: 'Depósitos', href: '/configurador/depositos' },
          { icon: IconSettings, label: 'Zonas', href: '/configurador/zonas' },
          { icon: IconSettings, label: 'Endereços', href: '/configurador/enderecos' },
          { icon: IconSettings, label: 'Estruturas', href: '/configurador/estruturas' },
          { icon: IconSettings, label: 'Docas', href: '/configurador/docas' },
          { icon: IconSettings, label: 'Equipamentos', href: '/configurador/equipamentos' },
          { icon: IconSettings, label: 'Funcionários', href: '/configurador/funcionarios' },
          { icon: IconSettings, label: 'Parâmetros', href: '/configurador/parametros' },
        ],
      },
    ],
  },
  configurador: {
    title: 'Configurador',
    entries: [
      { icon: IconBuilding, label: 'Empresa', href: '/configurador/empresa' },
      { icon: IconUsers, label: 'Vendedores', href: '/configurador/vendedores' },
      { icon: IconSettings, label: 'Tributação', href: '/configurador/tributacao' },
      {
        label: 'Integração', icon: IconKey, items: [
          { icon: IconKey, label: 'API Keys', href: '/configurador/integracao/api-keys' },
          { icon: IconWebhook, label: 'Webhooks', href: '/configurador/integracao/webhooks' },
          { icon: IconUpload, label: 'Importar', href: '/configurador/integracao/importar' },
        ],
      },
    ],
  },
  pcp: {
    title: 'PCP',
    entries: [
      { icon: IconHome, label: 'Dashboard', href: '/pcp/dashboard' },
      { icon: IconListDetails, label: 'Ordens de Produção', href: '/pcp/ordens-producao' },
      { icon: IconUpload, label: 'Importar OP (PDF)', href: '/pcp/importar-op' },
      { icon: IconAssembly, label: 'Kanban', href: '/pcp/kanban' },
      { icon: IconCalendarEvent, label: 'Programação', href: '/pcp/programacao' },
      { icon: IconClipboardCheck, label: 'Apontamentos', href: '/pcp/apontamentos' },
      { icon: IconPackage, label: 'Liberação de Materiais', href: '/pcp/liberacoes' },
      { icon: IconArrowsExchange, label: 'Conversão de Unidades', href: '/pcp/conversao' },
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconTool, label: 'Centros de Produção', href: '/pcp/cadastros/centros' },
          { icon: IconTool, label: 'Recursos', href: '/pcp/cadastros/recursos' },
          { icon: IconClock, label: 'Turnos', href: '/pcp/cadastros/turnos' },
          { icon: IconSitemap, label: 'Estruturas (BOM)', href: '/pcp/cadastros/estruturas' },
          { icon: IconRoute, label: 'Roteiros', href: '/pcp/cadastros/roteiros' },
          { icon: IconPalette, label: 'Atributos Gráficos', href: '/pcp/cadastros/atributos-graficos' },
          { icon: IconPackage, label: 'Produtos (PCP)', href: '/pcp/cadastros/produtos' },
        ],
      },
      { icon: IconSettings, label: 'Configuração PCP', href: '/pcp/configuracao' },
    ],
  },
}

function detectModule(pathname: string): string | null {
  if (pathname.startsWith('/compras')) return 'compras'
  if (pathname.startsWith('/vendas')) return 'vendas'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/fiscal')) return 'fiscal'
  if (pathname.startsWith('/pcp')) return 'pcp'
  if (pathname.startsWith('/configurador/produtos')) return 'compras'
  if (pathname.startsWith('/configurador/fornecedores')) return 'compras'
  if (pathname.startsWith('/configurador/clientes')) return 'vendas'
  if (pathname.startsWith('/configurador/vendedores')) return 'vendas'
  if (pathname.startsWith('/configurador/tributacao')) return 'fiscal'
  if (pathname.startsWith('/configurador/empresa')) return 'configurador'
  if (pathname.startsWith('/configurador/integracao')) return 'configurador'
  if (pathname.startsWith('/configurador/centros-distribuicao')) return 'wms'
  if (pathname.startsWith('/configurador/depositos')) return 'wms'
  if (pathname.startsWith('/configurador/zonas')) return 'wms'
  if (pathname.startsWith('/configurador/enderecos')) return 'wms'
  if (pathname.startsWith('/configurador/estruturas')) return 'wms'
  if (pathname.startsWith('/configurador/docas')) return 'wms'
  if (pathname.startsWith('/configurador/equipamentos')) return 'wms'
  if (pathname.startsWith('/configurador/funcionarios')) return 'wms'
  if (pathname.startsWith('/configurador/funcoes')) return 'wms'
  if (pathname.startsWith('/configurador/parametros')) return 'wms'
  if (pathname.startsWith('/configurador/rotas')) return 'wms'
  if (pathname.startsWith('/configurador/tipo-carga')) return 'wms'
  if (pathname.startsWith('/configurador/tipo-carroceria')) return 'wms'
  if (pathname.startsWith('/configurador/veiculos')) return 'wms'
  if (pathname.startsWith('/configurador/forma-armazenagem')) return 'wms'
  if (pathname.startsWith('/configurador/ambiente-armazenagem')) return 'wms'
  if (pathname.startsWith('/configurador')) return 'configurador'
  if (pathname.startsWith('/wms') || pathname.startsWith('/recebimento') || pathname.startsWith('/expedicao') || pathname.startsWith('/picking') || pathname.startsWith('/movimentacao') || pathname.startsWith('/inventario') || pathname.startsWith('/estoque') || pathname.startsWith('/gestao') || pathname.startsWith('/dashboard')) return 'wms'
  return null
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  return (
    <UnstyledButton
      component={Link}
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
        isActive
          ? 'bg-teal-50 text-teal-700 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <item.icon size={16} stroke={1.5} />
      <Text size="sm">{item.label}</Text>
    </UnstyledButton>
  )
}

function NavGroupComponent({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActiveChild = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  )
  const [opened, setOpened] = useState(hasActiveChild)

  return (
    <div>
      <UnstyledButton
        onClick={() => setOpened(!opened)}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors text-sm ${
          hasActiveChild ? 'text-teal-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <group.icon size={16} stroke={1.5} />
          <Text size="sm" fw={500}>{group.label}</Text>
        </div>
        {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
      </UnstyledButton>
      <Collapse in={opened}>
        <Stack gap={1} className="pl-4 mt-1">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </Stack>
      </Collapse>
    </div>
  )
}

export default function ModuleSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const moduleName = detectModule(pathname)

  if (!moduleName) return null

  const moduleConfig = MODULE_MENUS[moduleName]
  if (!moduleConfig) return null

  return (
    <nav className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-gray-200 flex-col py-4 z-50 overflow-y-auto">
      <UnstyledButton
        onClick={() => router.push('/modulos')}
        className="flex items-center gap-2 px-4 py-2 mb-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        <IconArrowLeft size={18} />
        <Text size="sm">Módulos</Text>
      </UnstyledButton>

      <Divider mb="sm" />

      <Text size="xs" fw={700} c="primary" className="px-4 mb-3" tt="uppercase">
        {moduleConfig.title}
      </Text>

      <Stack gap={2} className="flex-1 px-2">
        {moduleConfig.entries.map((entry, idx) =>
          isGroup(entry) ? (
            <NavGroupComponent key={entry.label} group={entry} pathname={pathname} />
          ) : (
            <NavLink key={entry.href} item={entry} pathname={pathname} />
          ),
        )}
      </Stack>
    </nav>
  )
}
