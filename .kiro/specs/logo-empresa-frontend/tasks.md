# Implementation Plan: Logo da Empresa (Frontend)

## Overview

A implementação segue a estratégia do design: primeiro extrair a validação client-side e a decisão de payload em funções puras (`logoEmpresa.utils.ts`), validadas por testes de propriedade (fast-check + vitest, 7 properties), e só depois modificar `EmpresaModal.tsx` para consumir essas funções através do Campo_Logo (Avatar + FileButton + ActionIcon), do schema Zod, do sinalizador de "campo tocado" e do ajuste das mutations. Isso permite validar toda a lógica de negócio (validação de arquivo, decisão de payload, round-trip de base64) antes de tocar na UI do modal já existente, reduzindo risco de regressão no fluxo de criação/edição de Empresa.

## Tasks

- [x] 1. Implementar funções puras de validação e decisão de payload do logo
  - [x] 1.1 Criar `src/app/(interna)/selecionar-empresa/logoEmpresa.utils.ts` com as constantes `MIMETYPES_LOGO_PERMITIDOS = ['image/png', 'image/jpeg']` e `TAMANHO_MAXIMO_LOGO_CLIENT_BYTES = 2_097_152`, os tipos `MotivoRejeicaoLogoClient`, `ResultadoValidacaoLogoClient`, `ModoFormularioEmpresa` e `DecisaoPayloadLogo`, e implementar `validarArquivoLogoClient(mimetype: string, tamanhoBytes: number): ResultadoValidacaoLogoClient`
    - Verifica tipo MIME antes de tamanho; retorna `{ aprovado: false, motivo: 'TIPO_INVALIDO' }` quando o mimetype não pertence ao conjunto permitido, `{ aprovado: false, motivo: 'TAMANHO_EXCEDIDO' }` quando o tamanho excede o limite, e `{ aprovado: true }` caso contrário
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.2 Implementar `mensagemErroLogoClient(motivo: MotivoRejeicaoLogoClient): string` em `logoEmpresa.utils.ts`
    - Retorna a mensagem em português correspondente a cada motivo de rejeição, usada pela Notificação_Erro
    - _Requirements: 2.2, 2.3_

  - [ ]* 1.3 Escrever teste de propriedade para `validarArquivoLogoClient`
    - **Property 4: `validarArquivoLogoClient` classifica corretamente por tipo MIME e tamanho**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
    - Geradores: `fc.constantFrom('image/png', 'image/jpeg')` combinado com `fc.string().filter(s => !MIMETYPES_LOGO_PERMITIDOS.includes(s))` para mimetype, e `fc.integer({ min: 0, max: 2_097_152 })` combinado com `fc.integer({ min: 2_097_153, max: Number.MAX_SAFE_INTEGER })` para tamanho

  - [x] 1.4 Implementar `determinarLogoParaPayload(estadoLogo: string | null, modo: ModoFormularioEmpresa, logoFoiTocado: boolean): DecisaoPayloadLogo` em `logoEmpresa.utils.ts`
    - Retorna `{ incluirCampo: false }` quando `modo === 'editar'` e `logoFoiTocado === false`; caso contrário retorna `{ incluirCampo: true, valor: estadoLogo }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_

  - [ ]* 1.5 Escrever teste de propriedade para `determinarLogoParaPayload`
    - **Property 6: `determinarLogoParaPayload` é consistente com o contrato do backend**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2**
    - Geradores: `fc.oneof(fc.constant(null), fc.string())` para `estadoLogo`, `fc.constantFrom('criar', 'editar')` para `modo`, `fc.boolean()` para `logoFoiTocado`

- [~] 2. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implementar e testar as funções puras de decisão visual do Campo_Logo (preview e botão de remover)
  - [x] 3.1 Implementar `deveExibirPreviewLogo(estadoLogo: string | null | undefined): boolean` e `deveExibirBotaoRemoverLogo(estadoLogo: string | null | undefined): boolean` em `logoEmpresa.utils.ts`
    - Ambas retornam `true` se e somente se `estadoLogo` é uma string com comprimento maior que zero
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 3.2 Escrever teste de propriedade para `deveExibirPreviewLogo`
    - **Property 1: Preview é exibido se e somente se o Estado_Logo é uma string não vazia**
    - **Validates: Requirements 1.3, 1.4**
    - Gerador: `fc.oneof(fc.constant(null), fc.constant(undefined), fc.string())`

  - [ ]* 3.3 Escrever teste de propriedade para `deveExibirBotaoRemoverLogo`
    - **Property 2: Botão de remover é exibido se e somente se há um logo definido**
    - **Validates: Requirements 1.5**
    - Gerador: `fc.oneof(fc.constant(null), fc.constant(undefined), fc.string())`

  - [x] 3.4 Implementar `removerLogo(): null` (ou constante equivalente) e a função de inicialização `inicializarEstadoLogo(logoEditData: string | null | undefined): string | null` em `logoEmpresa.utils.ts`
    - `inicializarEstadoLogo` retorna `null` quando `logoEditData` é `undefined` ou `null`, e a mesma string quando `logoEditData` é uma string
    - _Requirements: 1.6, 5.4, 5.5_

  - [ ]* 3.5 Escrever teste de propriedade para o comportamento de remoção
    - **Property 3: Remover sempre resulta em Estado_Logo igual a `null`**
    - **Validates: Requirements 1.6**
    - Gerador: `fc.oneof(fc.constant(null), fc.string())` para o valor atual de Estado_Logo antes da remoção

  - [ ]* 3.6 Escrever teste de propriedade para `inicializarEstadoLogo`
    - **Property 7: Inicialização do Estado_Logo ao reabrir em modo edição reflete `editData.logo`**
    - **Validates: Requirements 5.4, 5.5**
    - Gerador: `fc.oneof(fc.constant(undefined), fc.constant(null), fc.string())`

- [x] 4. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar e testar a conversão File → base64
  - [x] 5.1 Implementar `arquivoParaBase64(file: File): Promise<string>` inline em `src/app/(interna)/selecionar-empresa/EmpresaModal.tsx`, usando `FileReader.readAsDataURL`
    - Resolve com `reader.result` em caso de sucesso; rejeita com `reader.error` (ou erro genérico) em caso de falha de leitura
    - _Requirements: 3.1, 3.3_

  - [ ]* 5.2 Escrever teste de propriedade para `arquivoParaBase64`
    - **Property 5: Conversão File → base64 é um round-trip fiel ao conteúdo original**
    - **Validates: Requirements 3.1**
    - Gerador: `fc.uint8Array()` mapeado para `new File([bytes], 'logo.png', { type: 'image/png' })`; asserta que decodificar a porção base64 do data-URL resultante (removendo o prefixo `data:image/png;base64,`) produz um buffer idêntico byte a byte ao array original

- [x] 6. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Adicionar o campo `logo` ao schema Zod e ao estado inicializado por `reset()` em `EmpresaModal.tsx`
  - [x] 7.1 Adicionar `logo: z.string().nullable().optional()` ao objeto `schema` (Zod) já existente em `EmpresaModal.tsx`
    - _Requirements: 3.2_

  - [x] 7.2 Adicionar `logoFoiTocadoRef` (`useRef<boolean>(false)`) em `EmpresaModal.tsx`, e no `useEffect` já existente (disparado por `[editData, reset, opened]`) incluir `logo: editData?.logo ?? null` na chamada de `reset(...)` e resetar `logoFoiTocadoRef.current = false` imediatamente após
    - Usa `inicializarEstadoLogo(editData?.logo)` da task 3.4 para determinar o valor passado a `reset`
    - _Requirements: 4.1, 5.4, 5.5_

- [x] 8. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Adicionar o Campo_Logo (JSX) ao bloco MAIN FIELDS de `EmpresaModal.tsx`
  - [x] 9.1 No bloco "MAIN FIELDS" de `EmpresaModal.tsx`, adicionar o `Controller` `name="logo"` renderizando `Avatar` (preview via `field.value`, placeholder com ícone quando vazio), `FileButton` (label "Enviar"/"Trocar" conforme `field.value`, `accept="image/png,image/jpeg"`) e `ActionIcon` com `IconTrash` (visível apenas quando `field.value` é uma string não vazia), posicionado ao lado dos campos Razão Social, Nome Fantasia e CNPJ
    - O handler de `FileButton.onChange` chama `validarArquivoLogoClient`; se rejeitado, exibe `notifications.show` com `mensagemErroLogoClient(resultado.motivo)` e retorna sem alterar o campo; se aprovado, chama `arquivoParaBase64`, seta `logoFoiTocadoRef.current = true` e `field.onChange(base64)`; em caso de rejeição da promise, exibe `notifications.show` de falha de leitura
    - O handler do `ActionIcon` de remoção seta `logoFoiTocadoRef.current = true` e `field.onChange(null)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3_

  - [x] 9.2 Escrever testes unitários para o Campo_Logo dentro de `EmpresaModal.test.tsx` (novo, `@testing-library/react`)
    - Caso: seleção de arquivo com mimetype/tamanho inválido exibe Notificação_Erro e não altera o preview
    - Caso: mock de `FileReader` disparando `onerror` exibe Notificação_Erro informando falha de leitura e mantém o Estado_Logo inalterado
    - Caso: clique no `ActionIcon` de remoção limpa o preview para o placeholder padrão
    - _Requirements: 2.2, 2.3, 3.3, 1.6_

- [x] 10. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Ajustar `onSubmit` e as mutations de `EmpresaModal.tsx` para usar `determinarLogoParaPayload` e invalidar `['empresas-minhas']`
  - [x] 11.1 Em `onSubmit` de `EmpresaModal.tsx`, chamar `determinarLogoParaPayload(data.logo ?? null, isEditing ? 'editar' : 'criar', logoFoiTocadoRef.current)` e montar o `body` enviado a `criar.mutateAsync`/`atualizar.mutateAsync` incluindo o campo `logo` apenas quando `decisaoLogo.incluirCampo` for `true`
    - O catch genérico já existente (`err?.response?.data?.message`) permanece inalterado, cobrindo a exibição do erro 400 do backend sem fechar o modal nem descartar os demais campos
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 6.1, 6.2_

  - [x] 11.2 Ajustar os callbacks `onSuccess` das mutations `criar` e `atualizar` em `EmpresaModal.tsx` para invalidar tanto `queryClient.invalidateQueries({ queryKey: ['empresas-admin'] })` quanto `queryClient.invalidateQueries({ queryKey: ['empresas-minhas'] })`
    - _Requirements: 5.3_

  - [x] 11.3 Escrever testes unitários para o fluxo integrado de submit em `EmpresaModal.test.tsx`
    - Caso: schema Zod aceita `logo` como `undefined`, `null` e string, sem erro de validação
    - Caso: sucesso de `criar`/`atualizar` dispara `invalidateQueries` com `['empresas-admin']` e `['empresas-minhas']`
    - Caso: reabrir o modal com `editData.logo` preenchido e com `editData.logo` ausente exibe o preview correspondente em cada caso
    - Caso: mock de erro 400 do backend (`err.response.data.message`) exibe Notificação_Erro com essa mensagem, `onClose` não é chamado, e os demais campos do formulário permanecem preenchidos
    - _Requirements: 3.2, 5.3, 5.4, 5.5, 6.1, 6.2_

- [x] 12. Checkpoint final - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais (testes de propriedade) e podem ser puladas para um MVP mais rápido, mas recomenda-se não pular os testes de propriedade das 7 properties do design, já que validam toda a lógica de decisão do Campo_Logo e do payload.
- Cada teste de propriedade deve conter o comentário `// Feature: logo-empresa-frontend, Property N: <título>` imediatamente acima do `it(...)`, seguindo o padrão de `selecaoEmpresa.utils.test.ts`.
- Todos os testes de propriedade usam `fc.assert(fc.property(...), { numRuns: 100 })`, seguindo o padrão já estabelecido no repositório.
- `@testing-library/react` já está presente nas devDependencies do projeto (`package.json`), não é necessária nenhuma task de setup adicional.
- Nenhuma alteração é feita em `CardEmpresa.tsx` ou `selecaoEmpresa.utils.ts` (Requirement 7.1) — a exibição do logo na tela de seleção de empresa já está implementada.
- Nenhuma alteração de schema Prisma, migration ou contrato de API é necessária — este spec é 100% frontend, consumindo o contrato já fixo do backend (spec `logo-empresa`).
- A task 11.3 cobre testes de exemplo (não opcionais) exigidos pela orientação do usuário: falha de FileReader (task 9.2), invalidação de queries, inicialização em edição e erro 400 do backend.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5", "3.6", "5.1"] },
    { "id": 5, "tasks": ["5.2", "7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2", "11.1"] },
    { "id": 9, "tasks": ["11.2"] },
    { "id": 10, "tasks": ["11.3"] }
  ]
}
```
