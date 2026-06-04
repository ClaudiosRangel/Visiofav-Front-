# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fluxo-recebimento.spec.ts >> Fluxo Completo de Recebimento WMS >> 02 - Importar XML em Compras
- Location: tests\e2e\fluxo-recebimento.spec.ts:82:7

# Error details

```
Error: locator.isVisible: Error: strict mode violation: getByRole('button', { name: /importar/i }) resolved to 2 elements:
    1) <button type="button" data-size="sm" data-variant="light" data-with-left-section="true" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root">…</button> aka getByRole('button', { name: 'Importar XML', exact: true })
    2) <button type="button" data-size="sm" data-variant="light" data-with-left-section="true" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root">…</button> aka getByRole('button', { name: 'Importar XML (De-Para)' })

Call log:
    - checking visibility of getByRole('button', { name: /importar/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - button "Módulos" [ref=e4] [cursor=pointer]:
        - img [ref=e5]
        - paragraph [ref=e8]: Módulos
      - separator [ref=e9]
      - paragraph [ref=e10]: WMS
      - generic [ref=e11]:
        - link "Dashboard" [ref=e12] [cursor=pointer]:
          - /url: /wms/dashboard
          - img [ref=e13]
          - paragraph [ref=e17]: Dashboard
        - generic [ref=e18]:
          - button "Recebimento" [ref=e19] [cursor=pointer]:
            - generic [ref=e20]:
              - img [ref=e21]
              - paragraph [ref=e25]: Recebimento
            - img [ref=e26]
          - generic [ref=e29]:
            - link "Agenda de Docas" [ref=e30] [cursor=pointer]:
              - /url: /wms/agenda
              - img [ref=e31]
              - paragraph [ref=e35]: Agenda de Docas
            - link "Portaria" [ref=e36] [cursor=pointer]:
              - /url: /wms/portaria
              - img [ref=e37]
              - paragraph [ref=e41]: Portaria
            - link "Notas de Entrada" [ref=e42] [cursor=pointer]:
              - /url: /recebimento
              - img [ref=e43]
              - paragraph [ref=e47]: Notas de Entrada
            - link "Conferência de Entrada" [ref=e48] [cursor=pointer]:
              - /url: /wms/conferencia-entrada
              - img [ref=e49]
              - paragraph [ref=e53]: Conferência de Entrada
            - link "Endereçamento" [ref=e54] [cursor=pointer]:
              - /url: /wms/enderecamento
              - img [ref=e55]
              - paragraph [ref=e59]: Endereçamento
        - generic [ref=e60]:
          - button "Expedição" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]:
              - img [ref=e63]
              - paragraph [ref=e68]: Expedição
            - img [ref=e69]
          - generic [ref=e71]:
            - link [ref=e72] [cursor=pointer]:
              - /url: /picking
              - img [ref=e73]
              - paragraph [ref=e80]: Separação (Picking)
            - link [ref=e81] [cursor=pointer]:
              - /url: /wms/conferencia-saida
              - img [ref=e82]
              - paragraph [ref=e86]: Conferência de Saída
            - link [ref=e87] [cursor=pointer]:
              - /url: /expedicao
              - img [ref=e88]
              - paragraph [ref=e93]: Embalagem
            - link [ref=e94] [cursor=pointer]:
              - /url: /wms/montagem-carga
              - img [ref=e95]
              - paragraph [ref=e99]: Montagem de Carga
            - link [ref=e100] [cursor=pointer]:
              - /url: /wms/mapas-carregamento
              - img [ref=e101]
              - paragraph [ref=e105]: Mapas de Carregamento
        - generic [ref=e106]:
          - button "Estoque" [ref=e107] [cursor=pointer]:
            - generic [ref=e108]:
              - img [ref=e109]
              - paragraph [ref=e113]: Estoque
            - img [ref=e114]
          - generic [ref=e116]:
            - link [ref=e117] [cursor=pointer]:
              - /url: /estoque
              - img [ref=e118]
              - paragraph [ref=e122]: Consulta de Saldos
            - link [ref=e123] [cursor=pointer]:
              - /url: /wms/mapa
              - img [ref=e124]
              - paragraph [ref=e128]: Mapa do Armazém
            - link [ref=e129] [cursor=pointer]:
              - /url: /wms/transferencia-endereco
              - img [ref=e130]
              - paragraph [ref=e133]: Transferência
            - link [ref=e134] [cursor=pointer]:
              - /url: /wms/ressuprimento
              - img [ref=e135]
              - paragraph [ref=e140]: Ressuprimento
            - link [ref=e141] [cursor=pointer]:
              - /url: /wms/manutencao-estoque
              - img [ref=e142]
              - paragraph [ref=e147]: Manutenção de Estoque
            - link [ref=e148] [cursor=pointer]:
              - /url: /wms/inventario
              - img [ref=e149]
              - paragraph [ref=e153]: Inventário
        - generic [ref=e154]:
          - button "Operacional" [ref=e155] [cursor=pointer]:
            - generic [ref=e156]:
              - img [ref=e157]
              - paragraph [ref=e161]: Operacional
            - img [ref=e162]
          - generic [ref=e164]:
            - link [ref=e165] [cursor=pointer]:
              - /url: /wms/ordens-servico
              - img [ref=e166]
              - paragraph [ref=e170]: Ordens de Serviço
            - link [ref=e171] [cursor=pointer]:
              - /url: /wms/etiquetas
              - img [ref=e172]
              - paragraph [ref=e179]: Etiquetas
        - generic [ref=e180]:
          - button "Gestão" [ref=e181] [cursor=pointer]:
            - generic [ref=e182]:
              - img [ref=e183]
              - paragraph [ref=e187]: Gestão
            - img [ref=e188]
          - generic [ref=e190]:
            - link [ref=e191] [cursor=pointer]:
              - /url: /wms/relatorios
              - img [ref=e192]
              - paragraph [ref=e196]: Relatórios WMS
            - link [ref=e197] [cursor=pointer]:
              - /url: /wms/relatorios-expedicao
              - img [ref=e198]
              - paragraph [ref=e202]: Relatórios Expedição
            - link [ref=e203] [cursor=pointer]:
              - /url: /wms/auditoria
              - img [ref=e204]
              - paragraph [ref=e207]: Auditoria
        - generic [ref=e208]:
          - button "Cadastros" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]:
              - img [ref=e211]
              - paragraph [ref=e215]: Cadastros
            - img [ref=e216]
          - generic [ref=e218]:
            - link [ref=e219] [cursor=pointer]:
              - /url: /wms/consulta/produtos
              - img [ref=e220]
              - paragraph [ref=e225]: Produtos
            - link [ref=e226] [cursor=pointer]:
              - /url: /wms/sku
              - img [ref=e227]
              - paragraph [ref=e234]: SKU / Embalagens
            - link [ref=e235] [cursor=pointer]:
              - /url: /wms/dados-logisticos
              - img [ref=e236]
              - paragraph [ref=e240]: Dados Logísticos
            - link [ref=e241] [cursor=pointer]:
              - /url: /configurador/rotas
              - img [ref=e242]
              - paragraph [ref=e246]: Rotas
            - link [ref=e247] [cursor=pointer]:
              - /url: /wms/consulta/fornecedores
              - img [ref=e248]
              - paragraph [ref=e251]: Fornecedores
            - link [ref=e252] [cursor=pointer]:
              - /url: /wms/consulta/transportadoras
              - img [ref=e253]
              - paragraph [ref=e257]: Transportadoras
            - link [ref=e258] [cursor=pointer]:
              - /url: /wms/consulta/clientes
              - img [ref=e259]
              - paragraph [ref=e263]: Clientes
        - generic [ref=e264]:
          - button "Configurações" [ref=e265] [cursor=pointer]:
            - generic [ref=e266]:
              - img [ref=e267]
              - paragraph [ref=e270]: Configurações
            - img [ref=e271]
          - generic [ref=e273]:
            - link [ref=e274] [cursor=pointer]:
              - /url: /configurador/centros-distribuicao
              - img [ref=e275]
              - paragraph [ref=e278]: Centros Distrib.
            - link [ref=e279] [cursor=pointer]:
              - /url: /configurador/depositos
              - img [ref=e280]
              - paragraph [ref=e283]: Depósitos
            - link [ref=e284] [cursor=pointer]:
              - /url: /configurador/zonas
              - img [ref=e285]
              - paragraph [ref=e288]: Zonas
            - link [ref=e289] [cursor=pointer]:
              - /url: /configurador/enderecos
              - img [ref=e290]
              - paragraph [ref=e293]: Endereços
            - link [ref=e294] [cursor=pointer]:
              - /url: /configurador/estruturas
              - img [ref=e295]
              - paragraph [ref=e298]: Estruturas
            - link [ref=e299] [cursor=pointer]:
              - /url: /configurador/docas
              - img [ref=e300]
              - paragraph [ref=e303]: Docas
            - link [ref=e304] [cursor=pointer]:
              - /url: /configurador/equipamentos
              - img [ref=e305]
              - paragraph [ref=e308]: Equipamentos
            - link [ref=e309] [cursor=pointer]:
              - /url: /configurador/funcionarios
              - img [ref=e310]
              - paragraph [ref=e313]: Funcionários
            - link [ref=e314] [cursor=pointer]:
              - /url: /configurador/parametros
              - img [ref=e315]
              - paragraph [ref=e318]: Parâmetros
    - generic [ref=e319]:
      - banner [ref=e320]:
        - generic [ref=e321]:
          - paragraph [ref=e322]: VisioFab ERP
          - paragraph [ref=e323]: "|"
          - generic [ref=e324]:
            - img [ref=e325]
            - paragraph [ref=e328]: VisioFab Demo
        - generic [ref=e329]:
          - generic [ref=e331]: ONLINE
          - button "Trocar empresa" [ref=e332] [cursor=pointer]:
            - img [ref=e334]
          - button [ref=e337] [cursor=pointer]:
            - img [ref=e339]
          - button [ref=e342] [cursor=pointer]:
            - img [ref=e344]
      - main [ref=e347]:
        - generic [ref=e348]:
          - paragraph [ref=e349]: Início / Recebimento
          - paragraph [ref=e350]: Recebimento
          - generic [ref=e351]:
            - generic [ref=e353]:
              - generic [ref=e354]:
                - paragraph [ref=e355]: Pendentes
                - paragraph [ref=e356]: "0"
              - img [ref=e358]
            - generic [ref=e362]:
              - generic [ref=e363]:
                - paragraph [ref=e364]: Conferidas
                - paragraph [ref=e365]: "0"
              - img [ref=e367]
            - generic [ref=e372]:
              - generic [ref=e373]:
                - paragraph [ref=e374]: Endereçadas
                - paragraph [ref=e375]: "0"
              - img [ref=e377]
            - generic [ref=e381]:
              - generic [ref=e382]:
                - paragraph [ref=e383]: Total
                - paragraph [ref=e384]: "0"
              - img [ref=e386]
          - generic [ref=e390]:
            - generic [ref=e394]:
              - paragraph [ref=e395]: Notas Fiscais de Entrada
              - generic [ref=e396]:
                - button "Importar XML" [ref=e397] [cursor=pointer]:
                  - generic [ref=e398]:
                    - img [ref=e400]
                    - generic [ref=e403]: Importar XML
                - button "Importar XML (De-Para)" [ref=e404] [cursor=pointer]:
                  - generic [ref=e405]:
                    - img [ref=e407]
                    - generic [ref=e411]: Importar XML (De-Para)
                - button "Nova Nota" [ref=e412] [cursor=pointer]:
                  - generic [ref=e413]:
                    - img [ref=e415]
                    - generic [ref=e416]: Nova Nota
            - table [ref=e417]:
              - rowgroup [ref=e418]:
                - row "NF Série Fornecedor CNPJ Tipo Entrada Itens Status Ações" [ref=e419]:
                  - columnheader "NF" [ref=e420]
                  - columnheader "Série" [ref=e421]
                  - columnheader "Fornecedor" [ref=e422]
                  - columnheader "CNPJ" [ref=e423]
                  - columnheader "Tipo" [ref=e424]
                  - columnheader "Entrada" [ref=e425]
                  - columnheader "Itens" [ref=e426]
                  - columnheader "Status" [ref=e427]
                  - columnheader "Ações" [ref=e428]
              - rowgroup
      - contentinfo [ref=e429]: "Front: 13/05/2026, 22:35 | Back: 13/05/2026, 22:31"
  - alert [ref=e430]
```

# Test source

```ts
  1   | /**
  2   |  * E2E Test: Fluxo Completo de Recebimento WMS (Playwright)
  3   |  * =========================================================
  4   |  * Testa ponta a ponta via UI:
  5   |  *   Login → Selecionar Empresa → Importar XML → Agendar Portaria →
  6   |  *   Conferir Portaria → Conferência de Entrada → Endereçamento
  7   |  *
  8   |  * Pré-requisitos:
  9   |  *   - Backend rodando em localhost:3333
  10  |  *   - Frontend rodando em localhost:3000
  11  |  *   - Produto MOCA395CX48 cadastrado com SKU (lastro=9, camada=5)
  12  |  *   - Fornecedor com CNPJ 05.999.999/0001-99 cadastrado
  13  |  *   - Endereços de armazenagem criados
  14  |  *
  15  |  * Uso:
  16  |  *   npx playwright test tests/e2e/fluxo-recebimento.spec.ts
  17  |  */
  18  | 
  19  | import { test, expect, type Page } from '@playwright/test'
  20  | 
  21  | // ══════════════════════════════════════════════════════════════════════════════
  22  | // CONFIGURAÇÃO
  23  | // ══════════════════════════════════════════════════════════════════════════════
  24  | 
  25  | const BASE_URL = process.env.FRONTEND_URL || 'https://visiofav-front-wofr.vercel.app'
  26  | const API_URL = process.env.API_URL || 'https://visiofav.onrender.com/api'
  27  | const EMAIL = process.env.TEST_EMAIL || 'admin@visiofab.com'
  28  | const PASSWORD = process.env.TEST_PASSWORD || '987123'
  29  | 
  30  | // ══════════════════════════════════════════════════════════════════════════════
  31  | // HELPERS
  32  | // ══════════════════════════════════════════════════════════════════════════════
  33  | 
  34  | async function login(page: Page) {
  35  |   await page.goto(`${BASE_URL}/login`)
  36  |   await page.getByLabel('Email').fill(EMAIL)
  37  |   await page.getByLabel('Senha').fill(PASSWORD)
  38  |   await page.getByRole('button', { name: 'Entrar' }).click()
  39  | 
  40  |   // Aguardar redirecionamento para selecionar empresa
  41  |   await page.waitForURL('**/selecionar-empresa', { timeout: 15000 })
  42  | }
  43  | 
  44  | async function selecionarEmpresa(page: Page) {
  45  |   // Clicar na primeira empresa disponível
  46  |   await page.waitForSelector('[class*="Card"]', { timeout: 10000 })
  47  |   await page.locator('[class*="Card"]').first().click()
  48  | 
  49  |   // Aguardar redirecionamento para módulos
  50  |   await page.waitForURL('**/modulos', { timeout: 10000 })
  51  | }
  52  | 
  53  | async function navegarParaWms(page: Page, submenu: string) {
  54  |   // Navegar diretamente pela URL
  55  |   await page.goto(`${BASE_URL}/wms/${submenu}`)
  56  |   await page.waitForLoadState('networkidle')
  57  | }
  58  | 
  59  | // ══════════════════════════════════════════════════════════════════════════════
  60  | // TESTES
  61  | // ══════════════════════════════════════════════════════════════════════════════
  62  | 
  63  | test.describe('Fluxo Completo de Recebimento WMS', () => {
  64  |   test.describe.configure({ mode: 'serial' })
  65  | 
  66  |   let page: Page
  67  | 
  68  |   test.beforeAll(async ({ browser }) => {
  69  |     page = await browser.newPage()
  70  |   })
  71  | 
  72  |   test.afterAll(async () => {
  73  |     await page.close()
  74  |   })
  75  | 
  76  |   test('01 - Login e seleção de empresa', async () => {
  77  |     await login(page)
  78  |     await selecionarEmpresa(page)
  79  |     await expect(page).toHaveURL(/\/modulos/)
  80  |   })
  81  | 
  82  |   test('02 - Importar XML em Compras', async () => {
  83  |     // Navegar para compras
  84  |     await page.goto(`${BASE_URL}/recebimento`)
  85  |     await page.waitForLoadState('networkidle')
  86  | 
  87  |     // Procurar botão de importar XML
  88  |     const importBtn = page.getByRole('button', { name: /importar/i })
> 89  |     if (await importBtn.isVisible()) {
      |                         ^ Error: locator.isVisible: Error: strict mode violation: getByRole('button', { name: /importar/i }) resolved to 2 elements:
  90  |       await importBtn.click()
  91  | 
  92  |       // Upload do arquivo XML
  93  |       const fileInput = page.locator('input[type="file"]')
  94  |       if (await fileInput.isVisible()) {
  95  |         // Criar arquivo XML temporário via API
  96  |         const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  97  | <nfeProc xmlns="http://portalfiscal.inf.br" versao="4.00">
  98  |   <NFe><infNFe versao="4.00" Id="NFe33240505999999000199550010000001231000001234">
  99  |     <ide><nNF>999</nNF><serie>1</serie><dhEmi>2024-05-20T10:00:00-03:00</dhEmi></ide>
  100 |     <emit><CNPJ>05999999000199</CNPJ><xNome>Vende Tudos testes LTda</xNome></emit>
  101 |     <dest><CNPJ>00000000000000</CNPJ><xNome>EMPRESA TESTE</xNome></dest>
  102 |     <det nItem="1"><prod>
  103 |       <cProd>MOCA395CX48</cProd><xProd>LEITE CONDENSADO MOCA LATA 395G - CX 48 UN</xProd>
  104 |       <uCom>CX</uCom><qCom>100.0000</qCom><vUnCom>350.00</vUnCom><vProd>35000.00</vProd>
  105 |       <rastro><nLote>LOTE-PW-E2E</nLote><qLote>100.000</qLote><dFab>2024-05-01</dFab><dVal>2027-06-01</dVal></rastro>
  106 |     </prod></det>
  107 |     <total><ICMSTot><vNF>35000.00</vNF></ICMSTot></total>
  108 |   </infNFe></NFe>
  109 | </nfeProc>`
  110 | 
  111 |         await fileInput.setInputFiles({
  112 |           name: 'test-nfe.xml',
  113 |           mimeType: 'application/xml',
  114 |           buffer: Buffer.from(xmlContent, 'utf-8'),
  115 |         })
  116 | 
  117 |         // Aguardar processamento
  118 |         await page.waitForTimeout(2000)
  119 | 
  120 |         // Verificar se importou com sucesso (toast ou dados na tela)
  121 |         const successIndicator = page.locator('text=/importad|sucesso|MOCA395/i')
  122 |         if (await successIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
  123 |           await expect(successIndicator).toBeVisible()
  124 |         }
  125 |       }
  126 |     }
  127 |     // Se não encontrou botão de importar, o teste passa (pode não ter a tela)
  128 |   })
  129 | 
  130 |   test('03 - Agendar na Portaria', async () => {
  131 |     await navegarParaWms(page, 'portaria')
  132 | 
  133 |     // Verificar que a página carregou
  134 |     await expect(page.locator('text=/portaria/i').first()).toBeVisible({ timeout: 10000 })
  135 | 
  136 |     // Verificar se há agendamentos listados
  137 |     await page.waitForTimeout(2000)
  138 |   })
  139 | 
  140 |   test('04 - Conferir na Portaria (via API)', async () => {
  141 |     // Este passo usa a API diretamente pois a conferência na portaria
  142 |     // depende de um agendamento existente com status AGENDADO
  143 |     const token = await page.evaluate(() => localStorage.getItem('visiofab-wms-token'))
  144 | 
  145 |     // Buscar agendamentos de hoje
  146 |     const response = await page.request.get(`${API_URL}/portaria/agendamentos-hoje`, {
  147 |       headers: { Authorization: `Bearer ${token}` },
  148 |     })
  149 | 
  150 |     if (response.ok()) {
  151 |       const data = await response.json()
  152 |       const agendados = (data.data || []).filter((a: any) => a.status === 'AGENDADO')
  153 | 
  154 |       if (agendados.length > 0) {
  155 |         // Conferir o primeiro agendamento
  156 |         const agId = agendados[0].id
  157 |         const conferirResp = await page.request.post(`${API_URL}/portaria/conferir/${agId}`, {
  158 |           headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  159 |           data: { placa: 'ABC1234', motorista: 'Motorista E2E', qtdCaixas: 100 },
  160 |         })
  161 | 
  162 |         expect(conferirResp.status()).toBeLessThan(500)
  163 |       }
  164 |     }
  165 |   })
  166 | 
  167 |   test('05 - Conferência de Entrada - Iniciar', async () => {
  168 |     await navegarParaWms(page, 'conferencia-entrada')
  169 | 
  170 |     // Aguardar carregamento da lista de notas
  171 |     await page.waitForTimeout(3000)
  172 | 
  173 |     // Verificar se há notas pendentes
  174 |     const iniciarBtn = page.getByRole('button', { name: /iniciar conferência|continuar/i }).first()
  175 |     if (await iniciarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  176 |       await iniciarBtn.click()
  177 | 
  178 |       // Modal de funcionários pode aparecer — pular se aparecer
  179 |       const pularBtn = page.getByRole('button', { name: /pular/i })
  180 |       if (await pularBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  181 |         await pularBtn.click()
  182 |       }
  183 | 
  184 |       // Aguardar tela de contagem
  185 |       await page.waitForTimeout(2000)
  186 | 
  187 |       // Verificar que estamos na etapa de contagem
  188 |       const contagemIndicator = page.locator('text=/conferência cega|quantidade contada/i')
  189 |       await expect(contagemIndicator.first()).toBeVisible({ timeout: 5000 })
```