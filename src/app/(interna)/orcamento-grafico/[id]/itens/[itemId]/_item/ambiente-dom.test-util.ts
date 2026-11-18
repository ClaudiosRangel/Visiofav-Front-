/**
 * Apoio dos testes de componente desta pasta: o jsdom não tem `ResizeObserver`, que o Mantine usa
 * em ScrollArea e Combobox. Importar este arquivo instala um substituto vazio (só no ambiente de teste).
 */

class ResizeObserverDeTeste {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const global = globalThis as unknown as { ResizeObserver?: unknown }
if (typeof global.ResizeObserver === 'undefined') global.ResizeObserver = ResizeObserverDeTeste

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

export {}
