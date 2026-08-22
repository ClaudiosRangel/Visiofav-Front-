'use client'

import { useState, useEffect } from 'react'
import { UnstyledButton, Stack, Text, Divider, Collapse, Tooltip, Menu, ActionIcon } from '@mantine/core'
import {
  IconArrowLeft, IconChevronDown, IconChevronRight, IconChevronLeft,
  // Compras
  IconFileText, IconTruckDelivery, IconArrowBack, IconArrowsExchange, IconUsers, IconBuildingStore,
  // Vendas
  IconReceipt, IconCash, IconTags, IconChartBar, IconUserCircle, IconFileDescription, IconReportAnalytics, IconCheck,
  // Financeiro
  IconCreditCard, IconWallet,
  // Fiscal
  IconFileInvoice, IconTruck, IconCalculator, IconSearch, IconHash,
  // WMS
  IconHome, IconPackage, IconClipboardCheck, IconBarcode, IconBuildingWarehouse, IconArrowsExchange as IconMovim, IconSettings,
  IconEye, IconDatabase, IconAlertCircle, IconHistory, IconClockPause, IconLock,
  // Integração
  IconKey, IconWebhook, IconUpload, IconCloudDownload, IconDownload, IconPlugConnected,
  // PCP
  IconAssembly, IconListDetails, IconCalendarEvent, IconRoute, IconSitemap, IconTool, IconClock, IconPalette, IconLink, IconCategory,
  // Orçamento Gráfico
  IconPlus,
  // Configurador
  IconBuilding, IconBell,
} from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEmpresaAtual, deveExibirLinkKardex } from '@/hooks/useEmpresaAtual'
import { voltarParaModulos, abrirOuFocarAba } from '@/lib/abasModulo'
import { useModuleSidebarCollapsed } from '@/lib/moduleSidebarStore'
import { confirmarNavegacaoOuBloquear } from '@/lib/navigationGuardStore'

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  /**
   * Quando true, o clique não navega na aba atual — em vez disso abre (ou
   * foca, se já aberta) uma única aba de instância própria, identificada por
   * `href`. Usado pelo PDV: cada clique em "PDV (Caixa)" no menu deve levar
   * para a mesma aba do caixa em vez de abrir/duplicar abas novas.
   */
  abrirEmAbaUnica?: boolean
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
      { icon: IconCash, label: 'PDV (Caixa)', href: '/vendas/pdv', abrirEmAbaUnica: true },
      { icon: IconFileDescription, label: 'Orçamentos', href: '/vendas/orcamentos' },
      { icon: IconReceipt, label: 'Pedidos de Venda', href: '/vendas/pedidos' },
      { icon: IconCash, label: 'Vendas Efetivadas', href: '/vendas/vendas-efetivadas' },
      { icon: IconArrowBack, label: 'Devoluções', href: '/vendas/devolucoes' },
      { icon: IconTruckDelivery, label: 'Entregas', href: '/vendas/entregas' },
      { icon: IconChartBar, label: 'Comissões', href: '/vendas/comissoes' },
      { icon: IconReportAnalytics, label: 'Relatórios', href: '/vendas/relatorios' },
      { icon: IconTags, label: 'Campanhas', href: '/vendas/campanhas' },
      { icon: IconChartBar, label: 'Metas Vendedores', href: '/vendas/metas' },
      { icon: IconCheck, label: 'Aprovações', href: '/vendas/aprovacoes' },
      { icon: IconPackage, label: 'Bonificações', href: '/vendas/bonificacoes' },
      { icon: IconClock, label: 'Encomendas', href: '/vendas/encomendas' },
      { icon: IconArrowsExchange, label: 'Consignadas', href: '/vendas/consignadas' },
      { icon: IconBuildingStore, label: 'E-commerce', href: '/vendas/ecommerce' },
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
      { icon: IconHome, label: 'Dashboard', href: '/fiscal/dashboard' },
      {
        label: 'Documentos', icon: IconFileInvoice, items: [
          { icon: IconFileInvoice, label: 'NF-e', href: '/fiscal/nfe' },
          { icon: IconReceipt, label: 'NFC-e', href: '/fiscal/nfce' },
          { icon: IconTruck, label: 'CT-e', href: '/fiscal/cte' },
          { icon: IconTruck, label: 'MDF-e', href: '/fiscal/mdfe' },
          { icon: IconFileText, label: 'NFS-e', href: '/fiscal/nfse' },
        ],
      },
      {
        label: 'Motor Tributário', icon: IconCalculator, items: [
          { icon: IconCalculator, label: 'Regras', href: '/fiscal/motor-tributario' },
          { icon: IconSearch, label: 'Simular', href: '/fiscal/motor-tributario/simular' },
        ],
      },
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconHash, label: 'NCM', href: '/fiscal/cadastros/ncm' },
          { icon: IconHash, label: 'CFOP', href: '/fiscal/cadastros/cfop' },
          { icon: IconHash, label: 'CEST', href: '/fiscal/cadastros/cest' },
          { icon: IconHash, label: 'CST/CSOSN', href: '/fiscal/cadastros/cst-csosn' },
          { icon: IconFileText, label: 'Natureza Operação', href: '/fiscal/cadastros/natureza-operacao' },
          { icon: IconPalette, label: 'Cores de Veículo', href: '/fiscal/cadastros/cores-veiculo' },
          { icon: IconFileText, label: 'Observações CT-e', href: '/fiscal/cadastros/observacoes-cte' },
          { icon: IconTruck, label: 'Tabela de Serviço', href: '/fiscal/cadastros/tabela-servico' },
        ],
      },
      {
        label: 'Obrigações', icon: IconClipboardCheck, items: [
          { icon: IconFileText, label: 'SPED', href: '/fiscal/sped' },
          { icon: IconChartBar, label: 'Apuração', href: '/fiscal/apuracao' },
          { icon: IconReceipt, label: 'GNRE', href: '/fiscal/gnre' },
        ],
      },
      {
        label: 'Utilitários', icon: IconSettings, items: [
          { icon: IconKey, label: 'Certificados', href: '/fiscal/certificados' },
          { icon: IconAlertCircle, label: 'Contingência', href: '/fiscal/contingencia' },
          { icon: IconUpload, label: 'Importação XML', href: '/fiscal/importacao-xml' },
          { icon: IconDownload, label: 'Baixar / Enviar Arquivos', href: '/fiscal/exportar-xml' },
          { icon: IconCloudDownload, label: 'Notas do Fornecedor (DFe)', href: '/fiscal/distribuicao-dfe' },
          { icon: IconTruckDelivery, label: 'Manifesto Dest.', href: '/fiscal/manifesto-destinatario' },
          { icon: IconEye, label: 'Auditoria', href: '/fiscal/auditoria' },
          { icon: IconSettings, label: 'Config. CT-e', href: '/fiscal/cte/configuracoes' },
        ],
      },
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
          { icon: IconClockPause, label: 'Fila de Exceções', href: '/wms/fila-excecoes' },
          { icon: IconAlertCircle, label: 'Pendências CC-e', href: '/wms/pendencias-cce' },
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
          { icon: IconChartBar, label: 'Classificação ABC', href: '/wms/classificacao-abc' },
          { icon: IconLock, label: 'Bloqueios & Quarentena', href: '/wms/bloqueios' },
          { icon: IconArrowsExchange, label: 'Mudança de Picking', href: '/wms/picking/mudancas' },
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
          { icon: IconPlugConnected, label: 'Integração WMS', href: '/wms/configuracoes/integracao' },
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
      { icon: IconBell, label: 'Notificações (Admin)', href: '/configurador/notificacoes' },
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
      { icon: IconLink, label: 'De/Para (Vínculos)', href: '/pcp/de-para' },
      { icon: IconAssembly, label: 'Kanban', href: '/pcp/kanban' },
      { icon: IconCalendarEvent, label: 'Programação', href: '/pcp/programacao' },
      { icon: IconClock, label: 'Timeline de Produção', href: '/pcp/timeline' },
      { icon: IconCalendarEvent, label: 'Gantt de Produção', href: '/pcp/gantt' },
      { icon: IconEye, label: 'Quadro de Produção', href: '/pcp/quadro-producao' },
      { icon: IconEye, label: 'Painel de Produção (TV)', href: '/pcp/painel-producao' },
      { icon: IconClipboardCheck, label: 'Apontamentos', href: '/pcp/apontamentos' },
      { icon: IconPackage, label: 'Liberação de Materiais', href: '/pcp/liberacoes' },
      { icon: IconArrowsExchange, label: 'Conversão de Unidades', href: '/pcp/conversao' },
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconTool, label: 'Centros de Produção', href: '/pcp/cadastros/centros' },
          { icon: IconCategory, label: 'Tipo de Processo', href: '/pcp/cadastros/tipos-processo' },
          { icon: IconTool, label: 'Recursos', href: '/pcp/cadastros/recursos' },
          { icon: IconClock, label: 'Turnos', href: '/pcp/cadastros/turnos' },
          { icon: IconSitemap, label: 'Estruturas (BOM)', href: '/pcp/cadastros/estruturas' },
          { icon: IconRoute, label: 'Roteiros', href: '/pcp/cadastros/roteiros' },
          { icon: IconPalette, label: 'Atributos Gráficos', href: '/pcp/cadastros/atributos-graficos' },
          { icon: IconPackage, label: 'Produtos (PCP)', href: '/pcp/cadastros/produtos' },
        ],
      },
      { icon: IconSettings, label: 'Configuração PCP', href: '/pcp/configuracao' },
      {
        label: 'Permissões', icon: IconKey, items: [
          { icon: IconKey, label: 'Acesso (Menus)', href: '/pcp/permissoes/acesso' },
          { icon: IconSettings, label: 'Programação', href: '/pcp/permissoes' },
        ],
      },
      { icon: IconHistory, label: 'Logs de Auditoria', href: '/pcp/logs' },
    ],
  },
  'orcamento-grafico': {
    title: 'Orçamento Gráfico',
    entries: [
      { icon: IconListDetails, label: 'Orçamentos', href: '/orcamento-grafico' },
      { icon: IconPlus, label: 'Novo Orçamento', href: '/orcamento-grafico/novo' },
      {
        label: 'Cadastros', icon: IconDatabase, items: [
          { icon: IconPackage, label: 'Tipos de Embalagem', href: '/orcamento-grafico/cadastros/tipos-embalagem' },
          { icon: IconCash, label: 'Preços Materiais', href: '/orcamento-grafico/cadastros/precos-materiais' },
          { icon: IconChartBar, label: 'Parâmetros Perda', href: '/orcamento-grafico/cadastros/parametros-perda' },
          { icon: IconTags, label: 'Tabelas de Margem', href: '/orcamento-grafico/cadastros/tabelas-margem' },
        ],
      },
    ],
  },
}

/** Rótulo em português de cada módulo, para compor o título da aba do
 * navegador ("Vizor - <Módulo>") como fallback nas páginas que ainda não
 * definem seu próprio `document.title` mais específico — ver `(interna)/layout.tsx`. */
export const MODULE_LABELS: Record<string, string> = {
  compras: 'Compras',
  vendas: 'Vendas',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  wms: 'WMS',
  configurador: 'Configurador',
  pcp: 'PCP',
  'orcamento-grafico': 'Orçamento Gráfico',
}

export function detectModule(pathname: string): string | null {
  if (pathname.startsWith('/orcamento-grafico')) return 'orcamento-grafico'
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
  if (pathname.startsWith('/wms') || pathname.startsWith('/recebimento') || pathname.startsWith('/expedicao') || pathname.startsWith('/picking') || pathname.startsWith('/movimentacao') || pathname.startsWith('/inventario') || pathname.startsWith('/estoque') || pathname.startsWith('/gestao')) return 'wms'
  return null
}

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed?: boolean }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  const className = `flex items-center rounded-md transition-colors text-sm ${
    collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3 py-2'
  } ${
    isActive
      ? 'bg-teal-50 text-teal-700 font-medium'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
  }`

  const content = (
    <>
      <item.icon size={collapsed ? 20 : 16} stroke={1.5} />
      {!collapsed && <Text size="sm">{item.label}</Text>}
    </>
  )

  const button = item.abrirEmAbaUnica ? (
    <UnstyledButton onClick={() => abrirOuFocarAba(item.href, item.href)} className={className}>
      {content}
    </UnstyledButton>
  ) : (
    <UnstyledButton
      component={Link}
      href={item.href}
      className={className}
      // Guarda de navegação: se a página atual tiver uma operação em
      // andamento (ex.: conferência de entrada iniciada), pede confirmação
      // antes de deixar o clique no menu lateral navegar para outra tela.
      onClick={(e) => { if (!confirmarNavegacaoOuBloquear()) e.preventDefault() }}
    >
      {content}
    </UnstyledButton>
  )

  if (!collapsed) return button

  return (
    <Tooltip label={item.label} position="right" withArrow>
      {button}
    </Tooltip>
  )
}

function NavGroupComponent({ group, pathname, collapsed }: { group: NavGroup; pathname: string; collapsed?: boolean }) {
  const hasActiveChild = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  )
  const [opened, setOpened] = useState(hasActiveChild)

  // Menu recolhido: sem espaço para expandir a lista inline — cada grupo
  // ("Cadastros" etc.) vira um flyout (Menu do Mantine) que abre para a
  // direita ao clicar no ícone, mantendo os subitens acessíveis.
  if (collapsed) {
    return (
      <Menu position="right-start" withArrow shadow="md" trigger="click-hover">
        <Menu.Target>
          <UnstyledButton
            className={`flex items-center justify-center w-11 h-11 mx-auto rounded-md transition-colors ${
              hasActiveChild ? 'bg-teal-50 text-teal-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <Tooltip label={group.label} position="right" withArrow>
              <group.icon size={20} stroke={1.5} />
            </Tooltip>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{group.label}</Menu.Label>
          {group.items.map((item) => (
            <Menu.Item
              key={item.href}
              component={Link}
              href={item.href}
              leftSection={<item.icon size={14} stroke={1.5} />}
              onClick={(e) => { if (!confirmarNavegacaoOuBloquear()) e.preventDefault() }}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    )
  }

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
  const { usaWms } = useEmpresaAtual()
  const { collapsed, toggle } = useModuleSidebarCollapsed()
  const [acessoMenusPcp, setAcessoMenusPcp] = useState<Record<string, { habilitado: boolean }> | null>(null)

  // Carregar permissões de acesso a menus do PCP (uma vez)
  useEffect(() => {
    if (typeof window === 'undefined') return
    import('@/lib/api').then(({ api }) => {
      api.get('/pcp/permissoes/minha').then((res) => {
        if (res.data?.acessoMenus) setAcessoMenusPcp(res.data.acessoMenus)
      }).catch(() => {})
    })
  }, [])

  if (!moduleName) return null

  const moduleConfig = MODULE_MENUS[moduleName]
  if (!moduleConfig) return null

  // Requirements 9.1, 9.2 — o link para a Tela_Kardex só aparece no grupo "Estoque" do
  // módulo WMS quando a empresa autenticada não usa WMS (deveExibirLinkKardex).
  let entries: MenuEntry[] = moduleName === 'wms'
    ? moduleConfig.entries.map((entry): MenuEntry => {
      if (isGroup(entry) && entry.label === 'Estoque' && deveExibirLinkKardex(usaWms)) {
        const group: NavGroup = {
          ...entry,
          items: [...entry.items, { icon: IconHistory, label: 'Kardex', href: '/estoque/kardex' }],
        }
        return group
      }
      return entry
    })
    : moduleConfig.entries

  // Filtrar menus do PCP com base nas permissões de acesso configuradas pelo admin
  if (moduleName === 'pcp' && acessoMenusPcp) {
    // Map href suffix → menu ID usado na tela de Acesso
    const hrefToMenuId: Record<string, string> = {
      '/pcp/dashboard': 'dashboard',
      '/pcp/ordens-producao': 'ordens-producao',
      '/pcp/importar-op': 'importar-op',
      '/pcp/de-para': 'de-para',
      '/pcp/kanban': 'kanban',
      '/pcp/programacao': 'programacao',
      '/pcp/timeline': 'timeline',
      '/pcp/gantt': 'gantt',
      '/pcp/quadro-producao': 'quadro-producao',
      '/pcp/painel-producao': 'painel-producao',
      '/pcp/apontamentos': 'apontamentos',
      '/pcp/liberacoes': 'liberacoes',
      '/pcp/conversao': 'conversao',
      '/pcp/configuracao': 'configuracao',
      '/pcp/logs': 'logs',
    }
    entries = entries.filter((entry) => {
      if (isGroup(entry)) {
        // Grupos (Cadastros, Permissões): verificar pelo label
        const menuId = entry.label === 'Cadastros' ? 'cadastros' : entry.label === 'Permissões' ? 'permissoes' : null
        if (menuId && acessoMenusPcp[menuId]?.habilitado === false) return false
        return true
      }
      const menuId = hrefToMenuId[entry.href]
      if (menuId && acessoMenusPcp[menuId]?.habilitado === false) return false
      return true
    })
  }

  return (
    <nav
      className={`hidden md:flex fixed left-0 top-0 h-screen bg-white dark:bg-[#1a1b1e] border-r border-gray-200 dark:border-gray-800 flex-col py-4 z-50 overflow-y-auto transition-[width] duration-150 ${
        collapsed ? 'w-[64px]' : 'w-[220px]'
      }`}
    >
      {collapsed ? (
        <Tooltip label="Módulos" position="right" withArrow>
          <UnstyledButton
            onClick={() => { if (confirmarNavegacaoOuBloquear()) voltarParaModulos(router) }}
            className="flex items-center justify-center w-11 h-11 mx-auto mb-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors rounded-md"
          >
            <IconArrowLeft size={18} />
          </UnstyledButton>
        </Tooltip>
      ) : (
        <UnstyledButton
          onClick={() => { if (confirmarNavegacaoOuBloquear()) voltarParaModulos(router) }}
          className="flex items-center gap-2 px-4 py-2 mb-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <IconArrowLeft size={18} />
          <Text size="sm">Módulos</Text>
        </UnstyledButton>
      )}

      <Divider mb="sm" />

      {!collapsed && (
        <Text size="xs" fw={700} c="primary" className="px-4 mb-3" tt="uppercase">
          {moduleConfig.title}
        </Text>
      )}

      <Stack gap={2} className="flex-1 px-2">
        {entries.map((entry, idx) =>
          isGroup(entry) ? (
            <NavGroupComponent key={entry.label} group={entry} pathname={pathname} collapsed={collapsed} />
          ) : (
            <NavLink key={entry.href} item={entry} pathname={pathname} collapsed={collapsed} />
          ),
        )}
      </Stack>

      <Divider mt="sm" />

      <Tooltip label={collapsed ? 'Expandir menu' : 'Recolher menu'} position="right" withArrow>
        <ActionIcon
          onClick={toggle}
          variant="subtle"
          color="gray"
          size="lg"
          className={collapsed ? 'mx-auto mt-2' : 'ml-auto mr-2 mt-2'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
        </ActionIcon>
      </Tooltip>
    </nav>
  )
}
