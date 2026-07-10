# Implementation Plan: Redesenho da Tela de Seleção de Empresa

## Overview

A implementação segue a estratégia do design: primeiro extrair toda a lógica não-trivial em funções puras (`selecaoEmpresa.utils.ts`), validadas por testes de propriedade (fast-check + vitest, 11 properties), depois construir os componentes de apresentação (`CardEmpresa`, `RodapeAcessoRapido`) sobre essas funções, e por fim reescrever `SelecionarEmpresaPage` e o `EmpresaProvider`/headers como camada fina de orquestração. Isso permite validar a lógica de negócio antes de tocar em UI, reduzindo risco de regressão no Modo_Gerenciar_Empresas existente.

## Tasks

- [x] 1. Implementar funções puras de seleção automática e visibilidade do controle "Trocar Empresa"
  - [x] 1.1 Criar `src/app/(interna)/selecionar-empresa/selecaoEmpresa.utils.ts` com a interface `EmpresaItem` (campos `cidade`/`uf`/`logo` opcionais) e implementar `deveSelecionarAutomaticamente(quantidade: number): boolean`, `podeTrocarEmpresa(quantidade: number): boolean` e `deveExibirBarraBusca(quantidade: number): boolean`
    - `deveSelecionarAutomaticamente` retorna `true` se e somente se `quantidade === 1`
    - `podeTrocarEmpresa` retorna `true` se e somente se `quantidade > 1`
    - `deveExibirBarraBusca` retorna `true` se e somente se `quantidade >= 2`
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.1_

  - [ ]* 1.2 Escrever teste de propriedade para `deveSelecionarAutomaticamente`
    - **Property 1: Seleção automática ocorre se e somente se há exatamente uma empresa**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6**
    - Gerador: `fc.nat()`, comentário de referência `// Feature: selecao-empresa-redesign, Property 1: ...` acima do `it(...)`

  - [ ]* 1.3 Escrever teste de propriedade para `podeTrocarEmpresa`
    - **Property 2: O controle "Trocar Empresa" só é exibido quando há mais de uma empresa**
    - **Validates: Requirements 1.7**
    - Gerador: `fc.nat()`

  - [ ]* 1.4 Escrever teste de propriedade para `deveExibirBarraBusca`
    - **Property 3: A barra de busca só é exibida com duas ou mais empresas**
    - **Validates: Requirements 2.1**
    - Gerador: `fc.nat()`

- [x] 2. Implementar função de filtragem de busca
  - [x] 2.1 Implementar `filtrarEmpresasPorBusca(empresas: EmpresaItem[], termo: string): EmpresaItem[]` em `selecaoEmpresa.utils.ts`
    - Filtragem case-insensitive por substring em `razaoSocial` OU `nomeFantasia`; termo vazio retorna a lista original inalterada
    - _Requirements: 2.2, 2.4_

  - [ ]* 2.2 Escrever teste de propriedade para `filtrarEmpresasPorBusca`
    - **Property 4: Filtragem de busca é case-insensitive por substring, e string vazia é identidade**
    - **Validates: Requirements 2.2, 2.4**
    - Geradores: `fc.array` de empresas arbitrárias + `fc.string()` (termo), incluindo caso de termo derivado de substring do próprio nome para garantir matches; teste separado de round-trip de identidade para termo `''`

- [x] 3. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar funções puras de exibição do Card_Empresa
  - [x] 4.1 Implementar `obterNomeExibicaoEmpresa(empresa: EmpresaItem): string` e `obterIniciaisEmpresa(empresa: EmpresaItem): string` em `selecaoEmpresa.utils.ts`
    - Nome de exibição: `nomeFantasia` após `trim()` quando não vazio, senão `razaoSocial`; iniciais derivadas do nome de exibição resultante
    - _Requirements: 3.1, 3.3_

  - [ ]* 4.2 Escrever teste de propriedade para `obterNomeExibicaoEmpresa`
    - **Property 6: O nome de exibição usa nome fantasia com fallback para razão social**
    - **Validates: Requirements 3.3**
    - Geradores: `fc.string({minLength:1})` para `razaoSocial`, `fc.option(fc.string())` para `nomeFantasia` (incluindo vazio/whitespace)

  - [x] 4.3 Implementar `formatarCnpj(cnpj: string): string` em `selecaoEmpresa.utils.ts`
    - Para entradas de exatamente 14 dígitos, aplica o padrão `XX.XXX.XXX/XXXX-XX`; para qualquer outro formato, retorna a string original sem lançar exceção
    - _Requirements: 3.3_

  - [ ]* 4.4 Escrever teste de propriedade para `formatarCnpj`
    - **Property 7: Formatação de CNPJ segue sempre o padrão XX.XXX.XXX/XXXX-XX**
    - **Validates: Requirements 3.3**
    - Gerador: `fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), {minLength:14, maxLength:14})`

  - [x] 4.5 Implementar `obterLocalizacaoEmpresa(empresa: EmpresaItem): string | null` e a função de decisão de exibição da linha de localização (considerando a flag `ocultarLocalizacao`) em `selecaoEmpresa.utils.ts`
    - Retorna `${cidade}/${uf}` apenas quando ambos existem e não são vazios após `trim()`; a linha só é exibida quando `!ocultarLocalizacao && obterLocalizacaoEmpresa(empresa) !== null`
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ]* 4.6 Escrever teste de propriedade para a decisão de exibição da linha de localização
    - **Property 8: A linha de localização é exibida se e somente se não suprimida pela variação visual e cidade/UF estão presentes**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Geradores: `fc.record` de empresa com `cidade`/`uf` opcionais + `fc.boolean()` para `ocultarLocalizacao`

  - [x] 4.7 Implementar a função de decisão de avatar (`deveExibirLogoNoAvatar(empresa: EmpresaItem): boolean`) em `selecaoEmpresa.utils.ts`
    - Retorna `true` se e somente se `empresa.logo` é uma string não-vazia após `trim()`; usada junto com `obterIniciaisEmpresa` como fallback no `CardEmpresa`
    - _Requirements: 3.1, 3.2_

  - [ ]* 4.8 Escrever teste de propriedade para `deveExibirLogoNoAvatar`
    - **Property 5: O avatar exibe o logotipo quando presente, e iniciais derivadas do nome de exibição quando ausente**
    - **Validates: Requirements 3.1, 3.2**
    - Gerador: `fc.record` de empresa com `logo` opcional (`fc.option` de string arbitrária/URL)

- [x] 5. Implementar funções puras de controle administrativo e exclusão mútua com o Modo_Gerenciar_Empresas
  - [x] 5.1 Implementar `deveExibirAtalhoNovaEmpresa(perfil: string | null): boolean` em `selecaoEmpresa.utils.ts`, reaproveitando a constante `ADMIN_PROFILES = ['SUPER_ADMIN', 'ADMIN', 'DIRETOR']`
    - Retorna `true` se e somente se `perfil` está contido em `ADMIN_PROFILES`; usada tanto para o atalho "Nova Empresa" quanto para o botão "Gerenciar Empresas"
    - _Requirements: 4.3, 5.1, 5.2_

  - [ ]* 5.2 Escrever teste de propriedade para `deveExibirAtalhoNovaEmpresa`
    - **Property 10: Controles administrativos (Nova Empresa / Gerenciar Empresas) são exibidos se e somente se o perfil é administrativo**
    - **Validates: Requirements 4.3, 5.1, 5.2**
    - Gerador: `fc.option(fc.constantFrom('SUPER_ADMIN','ADMIN','DIRETOR','OPERADOR','SUPERVISOR', ''))` combinado com `fc.string()` arbitrária para perfis desconhecidos

  - [x] 5.3 Implementar `deveExibirElementosRedesign(modoGerenciar: boolean): boolean` em `selecaoEmpresa.utils.ts`
    - Retorna `false` (oculta busca e rodapé) sempre que `modoGerenciar` for `true`, independentemente do número de empresas
    - _Requirements: 5.5_

  - [ ]* 5.4 Escrever teste de propriedade para `deveExibirElementosRedesign`
    - **Property 11: Modo Gerenciar Empresas e os elementos do redesenho (busca, rodapé) são mutuamente exclusivos**
    - **Validates: Requirements 5.5**
    - Geradores: `fc.boolean()` (modoGerenciar) + `fc.nat()` (quantidade de empresas, usado apenas para reforçar independência do resultado)

- [x] 6. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Atualizar `EmpresaProvider` para expor `podeTrocarEmpresa`
  - [x] 7.1 Adicionar `podeTrocarEmpresa: boolean` a `EmpresaContextType` em `src/providers/EmpresaProvider.tsx`, carregado via `useQuery` com `queryKey: ['empresas-minhas']` (mesma chave usada pela página de seleção, evitando refetch duplicado) e derivado com `podeTrocarEmpresa(empresas?.length ?? 0)`
    - Enquanto a contagem não foi carregada (`isLoading`), o valor padrão exposto deve ser `true` (fail-safe)
    - _Requirements: 1.7_

  - [ ]* 7.2 Escrever testes unitários para o novo campo `podeTrocarEmpresa` do `EmpresaProvider`
    - Caso: enquanto a query está carregando, `podeTrocarEmpresa` é `true`
    - Caso: com exatamente 1 empresa retornada, `podeTrocarEmpresa` é `false`
    - Caso: com 2+ empresas retornadas, `podeTrocarEmpresa` é `true`
    - _Requirements: 1.7_

- [x] 8. Ocultar o controle "Trocar Empresa" nos headers quando não há empresa alternativa
  - [x] 8.1 Atualizar `src/components/layout/Header.tsx` para condicionar a exibição do `ActionIcon` e do `Menu.Item` "Trocar Empresa" a `empresa !== null && podeTrocarEmpresa` (consumindo `podeTrocarEmpresa` de `useEmpresa()`)
    - _Requirements: 1.7_

  - [x] 8.2 Atualizar `src/components/modules/ModulesHeader.tsx` para aplicar a mesma condição (`empresa !== null && podeTrocarEmpresa`) ao `Menu.Item` "Trocar Empresa"
    - _Requirements: 1.7_

  - [ ]* 8.3 Escrever testes unitários para `Header.tsx` e `ModulesHeader.tsx`
    - Caso: com `podeTrocarEmpresa = false`, o ícone/item "Trocar Empresa" não está presente no DOM
    - Caso: com `podeTrocarEmpresa = true` e `empresa` definida, o ícone/item está presente e aciona `trocarEmpresa` ao clicar
    - _Requirements: 1.7_

- [x] 9. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implementar o componente `CardEmpresa`
  - [x] 10.1 Criar `src/app/(interna)/selecionar-empresa/CardEmpresa.tsx` com as props `{ empresa: EmpresaItem, onAcessar: (empresa: EmpresaItem) => void, ocultarLocalizacao?: boolean }`
    - Avatar com logo (`deveExibirLogoNoAvatar`) ou iniciais (`obterIniciaisEmpresa`) como fallback
    - Nome de exibição (`obterNomeExibicaoEmpresa`) em destaque, razão social quando diferente do nome de exibição, CNPJ formatado (`formatarCnpj`)
    - Linha de localização condicional (`obterLocalizacaoEmpresa` + `ocultarLocalizacao`)
    - Botão "Acessar empresa →" sempre presente; clique no botão OU em qualquer área do `Card` chama `onAcessar(empresa)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 10.2 Escrever teste de propriedade para o clique do `CardEmpresa`
    - **Property 9: O clique no card propaga exatamente a empresa clicada**
    - **Validates: Requirements 3.8**
    - Renderizar com React Testing Library dentro de `fc.assert`; geradores: `fc.array` de empresas arbitrárias + índice aleatório da empresa clicada; asserta que `onAcessar` foi chamado exatamente uma vez com o mesmo `id`

  - [ ]* 10.3 Escrever testes unitários para `CardEmpresa`
    - Botão "Acessar empresa →" sempre presente no DOM, independentemente dos dados da empresa
    - Iniciais exibidas quando `logo` ausente; imagem exibida quando `logo` presente
    - Linha de localização omitida (sem espaço vazio) quando `cidade`/`uf` ausentes ou `ocultarLocalizacao = true`
    - _Requirements: 3.1, 3.2, 3.6, 3.7_

- [x] 11. Implementar o componente `RodapeAcessoRapido`
  - [x] 11.1 Criar `src/app/(interna)/selecionar-empresa/RodapeAcessoRapido.tsx` com as props `{ isAdmin: boolean, onMeusDados: () => void, onNovaEmpresa: () => void, onCentralDeAjuda: () => void }`
    - Barra fixa (`position: sticky`/`fixed`, `bottom: 0`) com "Meus Dados" e "Central de Ajuda" sempre visíveis, e "Nova Empresa" visível somente quando `isAdmin` (usando `deveExibirAtalhoNovaEmpresa` já aplicado pelo chamador)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 11.2 Escrever testes unitários para `RodapeAcessoRapido`
    - "Meus Dados" e "Central de Ajuda" sempre presentes; clique invoca `onMeusDados`/`onCentralDeAjuda` respectivamente
    - "Nova Empresa" presente somente quando `isAdmin = true`, ausente quando `isAdmin = false`; clique invoca `onNovaEmpresa`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 12. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Reescrever `SelecionarEmpresaPage` para integrar seleção automática, busca, novo card e rodapé
  - [x] 13.1 Em `src/app/(interna)/selecionar-empresa/page.tsx`, substituir a interface `EmpresaItem` local pela importada de `selecaoEmpresa.utils.ts`, adicionar estado `busca` e renderizar `TextInput` (com `IconSearch`) condicionalmente via `deveExibirBarraBusca(empresas?.length ?? 0)`, aplicando `filtrarEmpresasPorBusca` sobre `empresas` para obter `empresasFiltradas`
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 13.2 Adicionar `useEffect` de seleção automática: quando `empresas` chega da query e `deveSelecionarAutomaticamente(empresas.length)` é `true`, chamar `handleSelecionar(empresas[0])`; em caso de rejeição, setar `erroSelecaoAutomatica = true` (sem repetir a tentativa); enquanto a seleção automática está em andamento (`empresas.length === 1 && !erroSelecaoAutomatica`), renderizar apenas um `Loader` centralizado, sem grid/busca/rodapé
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

  - [x] 13.3 Ajustar o estado de "nenhuma empresa disponível" (`empresas.length === 0`) para exibir a mensagem existente sem disparar seleção automática nem o `useEffect` de 13.2
    - _Requirements: 1.3_

  - [x] 13.4 Substituir a renderização manual do `Card` no `SimpleGrid` por `<CardEmpresa empresa={emp} onAcessar={handleSelecionar} />` usando `empresasFiltradas`; exibir mensagem "nenhuma empresa encontrada" quando `busca` não for vazia e `empresasFiltradas.length === 0`
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 13.5 Integrar `RodapeAcessoRapido` (renderizado apenas quando `deveExibirElementosRedesign(modoGerenciar)` é `true` e a página não está em estado de seleção automática/loading), com `onMeusDados` abrindo o `PreferencesDrawer` já existente (`src/components/preferences/PreferencesDrawer.tsx`), `onNovaEmpresa` abrindo `EmpresaModal` sem `editData`, e `onCentralDeAjuda` chamando `router.push('/suporte')`; aplicar `deveExibirElementosRedesign(modoGerenciar)` também para ocultar a barra de busca
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 5.5_

  - [ ]* 13.6 Escrever testes unitários para os comportamentos integrados de `SelecionarEmpresaPage`
    - Nenhuma empresa disponível: mensagem exibida, `selecionarEmpresa` não é chamada
    - Busca sem resultados: mensagem "nenhuma empresa encontrada" exibida
    - Falha na seleção automática (mock de `selecionarEmpresa` rejeitando): tela de seleção renderizada com notificação de erro, e clique manual no único card ainda funciona
    - Modo_Gerenciar_Empresas ativo: busca e rodapé não aparecem
    - Clique em "Meus Dados" abre `PreferencesDrawer`; clique em "Nova Empresa" abre `EmpresaModal` sem `editData`; clique em "Central de Ajuda" chama `router.push('/suporte')`
    - _Requirements: 1.3, 1.5, 2.3, 4.5, 4.6, 4.7, 5.5_

- [x] 14. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Testes de regressão do Modo_Gerenciar_Empresas
  - [ ]* 15.1 Escrever/estender testes de integração confirmando que o fluxo completo de criar/editar/inativar empresa via tabela continua funcionando após o redesenho, e que a barra de busca e o `RodapeAcessoRapido` permanecem ocultos durante o Modo_Gerenciar_Empresas
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 16. Testes de integração E2E (Playwright)
  - [ ]* 16.1 Escrever teste E2E: login com usuário de 1 empresa resulta em redirecionamento direto para `/modulos`, sem exibir visualmente `/selecionar-empresa`
    - _Requirements: 1.1, 1.4, 1.6_

  - [ ]* 16.2 Escrever teste E2E: login com usuário de 2+ empresas exibe a tela de seleção, a busca filtra corretamente, e o clique em um card leva a `/modulos`
    - _Requirements: 1.2, 2.1, 2.2, 3.8_

  - [ ]* 16.3 Escrever teste E2E: fluxo de administrador — acesso a "Gerenciar Empresas", criação de empresa via atalho "Nova Empresa" do rodapé, e retorno à tela de seleção
    - _Requirements: 4.6, 5.1, 5.3, 5.4_

- [x] 17. Checkpoint final - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido, mas recomenda-se não pular os testes de propriedade das 11 properties, já que validam toda a lógica de decisão do redesenho.
- Cada teste de propriedade deve conter o comentário `// Feature: selecao-empresa-redesign, Property N: <título>` imediatamente acima do `it(...)`, seguindo o padrão de `src/utils/produtoSku.test.ts`.
- Todos os testes de propriedade usam `fc.assert(fc.property(...), { numRuns: 100 })`, seguindo o padrão já estabelecido no repositório.
- Nenhuma alteração de schema Prisma, migration ou contrato de API é necessária — este spec é 100% frontend.
- As Acceptance Criteria 3.2 e 3.4 (exibição de logo/localização) dependem da extensão de backend descrita como Assumption 1 nos requirements; o código deve continuar funcionando corretamente mesmo antes dessa extensão estar disponível (campos tratados como opcionais).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "4.1", "7.1"] },
    { "id": 3, "tasks": ["1.4", "4.3", "7.2"] },
    { "id": 4, "tasks": ["2.2", "4.5", "8.1", "8.2"] },
    { "id": 5, "tasks": ["4.2", "4.7", "8.3"] },
    { "id": 6, "tasks": ["4.4", "5.1"] },
    { "id": 7, "tasks": ["4.6", "5.3", "10.1"] },
    { "id": 8, "tasks": ["4.8", "10.2", "11.1"] },
    { "id": 9, "tasks": ["5.2", "10.3", "11.2"] },
    { "id": 10, "tasks": ["5.4", "13.1"] },
    { "id": 11, "tasks": ["13.2"] },
    { "id": 12, "tasks": ["13.3"] },
    { "id": 13, "tasks": ["13.4"] },
    { "id": 14, "tasks": ["13.5"] },
    { "id": 15, "tasks": ["13.6", "15.1"] },
    { "id": 16, "tasks": ["16.1", "16.2", "16.3"] }
  ]
}
```
