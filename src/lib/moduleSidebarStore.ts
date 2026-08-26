'use client'

import { useSyncExternalStore } from 'react'

/**
 * Estado de colapso do ModuleSidebar (menu lateral do módulo), compartilhado
 * entre `ModuleSidebar.tsx` (que renderiza o botão de toggle) e
 * `(interna)/layout.tsx` (que precisa ajustar a margem esquerda do conteúdo
 * para a página realmente "ganhar" o espaço quando o menu recolhe).
 *
 * Usa um store externo simples (padrão useSyncExternalStore) em vez de dois
 * `useState` independentes — com dois estados separados, clicar no botão no
 * sidebar não notificava o layout, então o `<main>` nunca reajustava a
 * margem mesmo com o menu visualmente recolhido.
 */

const STORAGE_KEY = 'vizor-module-sidebar-collapsed'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

let collapsed = readInitial()
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  return collapsed
}

function getServerSnapshot() {
  return false
}

function setCollapsed(value: boolean) {
  collapsed = value
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  }
  listeners.forEach((listener) => listener())
}

export function useModuleSidebarCollapsed() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = () => setCollapsed(!collapsed)

  return { collapsed: isCollapsed, toggle }
}

/**
 * Estado de abertura do menu de módulo em telas pequenas (mobile/tablet).
 *
 * No desktop o `ModuleSidebar` fica fixo à esquerda (`hidden md:flex`). Em
 * telas menores esse `<nav>` é ocultado — sem este store não havia NENHUMA
 * forma de navegar entre as telas de um módulo (ex.: PCP) pelo celular. O
 * botão hambúrguer do `Header` (visível só em `md:hidden`) passa a abrir um
 * `<Drawer>` do Mantine com as MESMAS entries do módulo atual.
 *
 * Store externo próprio (não reaproveita o de colapso do desktop) porque as
 * duas decisões são independentes: recolher a sidebar do desktop não tem
 * relação com abrir/fechar o drawer mobile.
 */
let mobileOpen = false
const mobileListeners = new Set<() => void>()

function subscribeMobile(callback: () => void) {
  mobileListeners.add(callback)
  return () => mobileListeners.delete(callback)
}

function getMobileSnapshot() {
  return mobileOpen
}

function getMobileServerSnapshot() {
  return false
}

function setMobileOpen(value: boolean) {
  mobileOpen = value
  mobileListeners.forEach((listener) => listener())
}

export function useMobileMenuStore() {
  const opened = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot)

  return {
    opened,
    open: () => setMobileOpen(true),
    close: () => setMobileOpen(false),
    toggle: () => setMobileOpen(!mobileOpen),
  }
}
