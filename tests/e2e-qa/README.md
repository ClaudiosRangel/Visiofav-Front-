# Suite de QA Automatizada — Vizor ERP

Automação de testes E2E em **Python + Playwright** que simula um usuário
real navegando pelo Vizor ERP, testando os módulos:

- Portal Representante
- Orçamento Gráfico (Cálculo)
- Pedido de Venda
- PCP (Ordens de Produção)
- Programação de Produção
- Estoque (WMS)

## Pré-requisitos

- Python 3.10+
- pip

## Instalação

```bash
cd tests/e2e-qa

# Criar ambiente virtual (recomendado)
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Instalar browsers do Playwright
playwright install chromium
```

## Configuração

Edite o arquivo `.env` se necessário:

```env
BASE_URL=https://visiofav-front-wofr.vercel.app
EMAIL=admin@visiofab.com
PASSWORD=987123
EMPRESA_NOME=VisioFab Demo
HEADLESS=true      # false para ver o browser executando
SLOW_MO=0          # milissegundos de delay entre ações (útil para debug)
```

## Executar Testes

### Rodar toda a suite
```bash
pytest
```

### Rodar um módulo específico
```bash
pytest test_01_login_e_navegacao.py
pytest test_02_portal_representante.py
pytest test_03_orcamento_grafico.py
pytest test_04_pedido_venda.py
pytest test_05_pcp_ordens_producao.py
pytest test_06_pcp_programacao.py
pytest test_07_estoque.py
pytest test_08_fluxo_integrado.py
```

### Rodar um teste específico
```bash
pytest test_05_pcp_ordens_producao.py::TestOPCriacao::test_criacao_op_happy_path
```

### Modo visual (ver o browser)
```bash
set HEADLESS=false
pytest test_03_orcamento_grafico.py
```

### Com delay entre ações (debug lento)
```bash
set SLOW_MO=500
set HEADLESS=false
pytest test_04_pedido_venda.py -s
```

## Relatório

Após a execução, o relatório HTML é gerado em:
```
tests/e2e-qa/report.html
```

Screenshots de evidência ficam em:
```
tests/e2e-qa/evidencias/
```

## Estrutura

```
tests/e2e-qa/
├── .env                          # Configurações (URL, credenciais)
├── conftest.py                   # Fixtures do pytest (login, navegação)
├── helpers.py                    # Funções auxiliares reutilizáveis
├── pytest.ini                    # Configuração do pytest
├── requirements.txt              # Dependências Python
├── README.md                     # Este arquivo
├── test_01_login_e_navegacao.py  # Login e acesso aos módulos
├── test_02_portal_representante.py  # Representantes (CRUD)
├── test_03_orcamento_grafico.py  # Wizard de orçamento (7 steps)
├── test_04_pedido_venda.py       # Pedido de Venda (CRUD + tabs)
├── test_05_pcp_ordens_producao.py  # Ordens de Produção (CRUD)
├── test_06_pcp_programacao.py    # Painel de Programação
├── test_07_estoque.py            # Consulta de Estoque/WMS
├── test_08_fluxo_integrado.py    # Fluxo entre módulos
└── evidencias/                   # Screenshots gerados nos testes
```

## Filosofia dos Testes

1. **Happy Path**: Cada módulo tem um teste de fluxo completo (criar, salvar, verificar)
2. **Validação de Erro**: Campos obrigatórios, formatos inválidos, permissões
3. **Resiliência**: URLs inválidas, refresh rápido, bypass de menu
4. **Evidências**: Screenshots automáticos em pontos-chave e em falhas
5. **Independência**: Cada teste pode rodar isoladamente (ordem dos arquivos é sugestão, não dependência)

## Notas

- Os testes rodam contra a **empresa VisioFab Demo em produção** (Vercel).
- Dados criados pelos testes têm prefixo "QA" ou "teste" para fácil identificação e limpeza.
- O login é feito uma vez por sessão (fixture `pagina_autenticada`), não a cada teste.
- Testes que dependem de dados pré-existentes (ex: lista de produtos) usam `pytest.skip()` se não encontrarem o dado, em vez de falhar.
