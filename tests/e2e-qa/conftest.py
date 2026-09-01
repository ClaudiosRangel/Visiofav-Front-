"""
Configuração central do pytest-playwright para a suite de QA do Vizor ERP.
Gerencia login, seleção de empresa e navegação comum.
"""

import os
import random
import string
import pytest
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import Page, BrowserContext, expect

from wms_api import WmsApiClient

# Carrega .env do diretório da suite
load_dotenv(Path(__file__).parent / ".env")

BASE_URL = os.getenv("BASE_URL", "https://visiofav-front-wofr.vercel.app")
EMAIL = os.getenv("EMAIL", "admin@visiofab.com")
PASSWORD = os.getenv("PASSWORD", "987123")
EMPRESA_NOME = os.getenv("EMPRESA_NOME", "VisioFab Demo")


def _derivar_api_url() -> str:
    """Deriva a URL da API a partir do BASE_URL ou de env dedicada.

    Centraliza a lógica que antes era feita com um `replace` frágil de string
    dentro dos testes (ver test_09). Ordem de precedência:
      1. Variável de ambiente `API_URL`, se definida.
      2. Produção (Vercel) -> API do Render (`https://api.vizorerp.com.br/api`).
      3. Ambiente local -> `http://localhost:3333/api`.
    """
    explicit = os.getenv("API_URL")
    if explicit:
        return explicit.rstrip("/")
    # produção padrão do projeto (frontend na Vercel)
    if "vercel" in BASE_URL or "visiofav-front" in BASE_URL:
        return "https://api.vizorerp.com.br/api"
    # ambiente local
    return "http://localhost:3333/api"


# URL da API exposta no módulo para reuso pelos testes e pelo cliente de API.
API_URL = _derivar_api_url()


# ════════════════════════════════════════════════════════════════════
# EVIDÊNCIA EM FALHA (task 13.2 — Requisitos 14.2/14.4)
#
# Hook do pytest que, quando um teste FALHA na fase "call", captura
# automaticamente um screenshot da página ativa (se o teste usa uma fixture
# ``page`` / ``page_auth`` do Playwright) na pasta ``evidencias/`` com nome
# descritivo (nome do teste + horário). Tudo em try/except: a falha ao gravar
# a evidência NUNCA interrompe/altera o resultado do teste — é apenas reportada
# separadamente (impressa no log, que o pytest-html consolida no relatório).
#
# Coexiste com o pytest-html: o pytest-html tem seu próprio hookwrapper de
# ``pytest_runtest_makereport``; este apenas adiciona o nosso, sem substituí-lo
# (ambos os hookwrappers recebem o mesmo ``outcome`` e são compostos pelo
# pluggy sem conflito).
# ════════════════════════════════════════════════════════════════════


def _capturar_evidencia_falha(item, page) -> None:
    """Captura screenshot da página no momento da falha (best-effort).

    Nomeia a evidência com o nome do teste + horário. Qualquer erro aqui é
    engolido (só impresso) — a evidência é opcional e não pode afetar o teste.
    """
    try:
        pasta = Path(__file__).parent / "evidencias"
        pasta.mkdir(exist_ok=True)
        # Sanitiza o nome do teste para virar nome de arquivo válido.
        nome_bruto = getattr(item, "name", "teste")
        nome_seguro = "".join(
            c if (c.isalnum() or c in ("-", "_")) else "_" for c in nome_bruto
        )
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        destino = pasta / f"FALHA_{nome_seguro}_{timestamp}.png"
        page.screenshot(path=str(destino), full_page=True)
        print(f"[evidencia] screenshot de falha gravado em {destino}")
    except Exception as exc:  # Req 14.4: falha de evidência não interrompe nada
        print(
            f"[evidencia] falha ao gravar screenshot de falha do teste "
            f"'{getattr(item, 'name', '?')}': {type(exc).__name__}: {exc}"
        )


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Captura evidência automática quando um teste falha na fase 'call'.

    Usa ``hookwrapper=True`` para acessar o resultado (``report``) depois que
    o pytest o produz, e então — só em caso de falha na fase de execução do
    teste — procura uma fixture de página do Playwright ativa
    (``page_auth`` ou ``page``) em ``item.funcargs`` e captura a tela.

    Não altera o ``outcome`` nem o ``report`` — apenas observa. Todo o corpo é
    protegido por try/except para garantir que jamais interfira no resultado
    do teste ou no relatório (Requisito 14.4).
    """
    outcome = yield
    try:
        report = outcome.get_result()
        # Só nos interessa a falha na execução do teste em si (não em setup/teardown).
        if report.when != "call" or not report.failed:
            return
        funcargs = getattr(item, "funcargs", {}) or {}
        page = funcargs.get("page_auth") or funcargs.get("page")
        if page is None:
            return
        _capturar_evidencia_falha(item, page)
    except Exception as exc:  # pragma: no cover - o hook nunca pode derrubar nada
        print(f"[evidencia] erro inesperado no hook de evidência de falha: {exc}")


def navegar_para(page: Page, caminho: str):
    """Navega diretamente para uma rota interna."""
    page.goto(f"{BASE_URL}{caminho}")
    page.wait_for_load_state("networkidle")


def _fazer_login(page: Page):
    """Realiza login no sistema."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")

    page.get_by_label("Email").fill(EMAIL)
    page.get_by_label("Senha").fill(PASSWORD)
    page.get_by_role("button", name="Entrar").click()

    # Aguarda redirecionamento
    page.wait_for_url("**/selecionar-empresa", timeout=20000)


def _selecionar_empresa(page: Page):
    """Seleciona a empresa demo (primeira disponível)."""
    page.wait_for_load_state("networkidle")
    # Clica no primeiro card de empresa
    cards = page.locator('[class*="Card"]')
    cards.first.wait_for(timeout=15000)
    cards.first.click()

    # Aguarda ir para a tela de módulos
    page.wait_for_url("**/modulos", timeout=15000)


# ════════════════════════════════════════════════════════════════════
# FIXTURES PYTEST-PLAYWRIGHT
# ════════════════════════════════════════════════════════════════════


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    """Configura argumentos de lançamento do browser."""
    headless = os.getenv("HEADLESS", "true").lower() == "true"
    slow_mo = int(os.getenv("SLOW_MO", "0"))
    return {
        **browser_type_launch_args,
        "headless": headless,
        "slow_mo": slow_mo,
    }


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configura contexto do browser."""
    return {
        **browser_context_args,
        "viewport": {"width": 1440, "height": 900},
        "ignore_https_errors": True,
        "base_url": BASE_URL,
    }


@pytest.fixture(scope="session")
def _autenticado(browser_type, browser_type_launch_args):
    """
    Fixture de sessão: faz login uma vez e salva o storage state.
    Todos os testes reutilizam esta sessão autenticada.
    """
    browser = browser_type.launch(**browser_type_launch_args)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        ignore_https_errors=True,
    )
    page = context.new_page()

    _fazer_login(page)
    _selecionar_empresa(page)

    # Salva estado (cookies + localStorage) para reutilizar
    storage_path = Path(__file__).parent / ".auth-state.json"
    context.storage_state(path=str(storage_path))

    context.close()
    browser.close()

    yield str(storage_path)


@pytest.fixture()
def page_auth(_autenticado, browser):
    """
    Fixture por teste: cria um novo contexto com o estado autenticado.
    Cada teste recebe uma page limpa mas já logada.
    """
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        ignore_https_errors=True,
        storage_state=_autenticado,
    )
    page = context.new_page()

    # Navega para módulos como ponto de partida
    page.goto(f"{BASE_URL}/modulos")
    page.wait_for_load_state("networkidle")

    yield page

    context.close()


# ════════════════════════════════════════════════════════════════════
# FIXTURES DO FLUXO WMS (marcador de execução + token de API)
# ════════════════════════════════════════════════════════════════════


@pytest.fixture(scope="session")
def run_id() -> str:
    """Marcador único de execução da suite (um por run).

    Formato: ``QA-WMS-{YYYYMMDD-HHMMSS}-{RAND4}``. Propagado para os campos
    rastreáveis dos dados criados (fornecedor da nota, lote do item, etc.),
    permitindo localizar e limpar os artefatos depois e evitar colisão entre
    execuções concorrentes.
    """
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"QA-WMS-{ts}-{rand}"


@pytest.fixture()
def api_token(page_auth: Page) -> str:
    """Lê o JWT persistido no localStorage pela sessão autenticada.

    A chave usada pelo frontend é ``visiofab-wms-token`` (mesma consultada
    pelos testes existentes). Falha cedo, com mensagem clara, se a sessão não
    tiver autenticado.
    """
    token = page_auth.evaluate(
        "() => localStorage.getItem('visiofab-wms-token')"
    )
    assert token, "Token de autenticação não encontrado no localStorage (chave 'visiofab-wms-token')"
    return token


@pytest.fixture()
def wms_api(page_auth: Page, api_token: str) -> WmsApiClient:
    """Cliente de API do fluxo WMS (por teste).

    Construído a partir do ``APIRequestContext`` do Playwright
    (``page_auth.request``), da ``API_URL`` derivada do ambiente e do
    ``api_token`` lido do localStorage — reaproveitando a mesma sessão
    autenticada do navegador.
    """
    return WmsApiClient(page_auth.request, API_URL, api_token)


# ════════════════════════════════════════════════════════════════════
# LIMPEZA RASTREÁVEL POR MARCADOR (task 13.1 — Requisitos 13.1/13.2/13.3)
#
# Mecanismo CENTRALIZADO de limpeza: em vez de depender de cada teste lembrar
# de limpar (os testes já fazem limpeza best-effort no ``finally`` de cada um,
# o que continua valendo), esta camada garante uma varredura final por
# marcador ``run_id`` ao término da sessão da suíte.
#
# Como funciona:
#   1. ``cleanup_registry`` (escopo de SESSÃO) é um coletor em memória onde os
#      testes/helpers PODEM registrar identificadores de dados criados
#      (notas, OPs avulsas, OPs normais, reservas, webhooks, estruturas,
#      lotes bloqueados). É opcional — nenhum teste é obrigado a usá-lo.
#   2. No teardown da sessão, o coletor:
#        a) Reconstrói um ``WmsApiClient`` autenticado a partir do
#           ``storage_state`` salvo (a fixture ``wms_api`` é por-teste e já não
#           existe no teardown de sessão) — mesmo padrão de ``_autenticado``.
#        b) Localiza as notas de QA da execução via
#           ``listar_notas_por_marcador(run_id)`` e tenta removê-las
#           (``DELETE /notas-entrada/:id``, quando o backend permite).
#        c) Executa os itens explicitamente registrados (best-effort), usando
#           os helpers de exclusão já existentes no cliente.
#        d) Grava um relatório em ``evidencias/limpeza_{run_id}.txt`` listando
#           o que foi removido e — o mais importante para o Requisito 13.3 — o
#           que NÃO pôde ser removido (identificador rastreável), sem nunca
#           derrubar a suíte (try/except em tudo).
#
# Endpoints de exclusão disponíveis (confirmados no backend):
#   - DELETE /notas-entrada/:id            (nota + itens; 404 se de outra empresa;
#                                            pode falhar por FK se já gerou saldo)
#   - DELETE /pcp/ordens-avulsas/:opId     (OP avulsa em cascata, sem restrição)
#   - DELETE /ordens-producao/:id          (OP normal; bloqueia CONCLUIDA/com apontamentos)
#   - DELETE /pcp/analise-producao/:opId/reservar   (cancela reservas ATIVAS)
#   - DELETE /bloqueios/lote               (libera lote bloqueado)
#   - DELETE /api/webhooks/:id             (remove webhook)
#   - PUT    /estruturas-produto/:id {INATIVA}       (inativa estrutura — não há DELETE)
# ════════════════════════════════════════════════════════════════════


class RegistroLimpeza:
    """Coletor em memória (escopo de sessão) de dados criados pela suíte.

    Os testes registram os identificadores que criaram para que a varredura
    final de limpeza os remova, mesmo que o ``finally`` do próprio teste não
    tenha conseguido (ex.: falha antes de chegar na limpeza). Todos os métodos
    são tolerantes: registrar é apenas guardar em lista, nunca faz I/O.
    """

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.notas: list[str] = []
        self.ops_avulsas: list[str] = []
        self.ops_normais: list[str] = []
        self.reservas_op: list[str] = []
        self.webhooks: list[str] = []
        self.estruturas: list[tuple] = []  # (estrutura_id, produto_id)
        self.lotes_bloqueados: list[tuple] = []  # (produto_id, lote)
        # Identificadores que a limpeza não conseguiu remover (Requisito 13.3).
        self.nao_removidos: list[str] = []
        # Identificadores efetivamente removidos (para o relatório).
        self.removidos: list[str] = []

    # -- registro (chamado pelos testes; best-effort, nunca levanta) --
    def registrar_nota(self, nota_id: str) -> None:
        if nota_id and nota_id not in self.notas:
            self.notas.append(nota_id)

    def registrar_op_avulsa(self, op_id: str) -> None:
        if op_id and op_id not in self.ops_avulsas:
            self.ops_avulsas.append(op_id)

    def registrar_op_normal(self, op_id: str) -> None:
        if op_id and op_id not in self.ops_normais:
            self.ops_normais.append(op_id)

    def registrar_reservas_op(self, op_id: str) -> None:
        if op_id and op_id not in self.reservas_op:
            self.reservas_op.append(op_id)

    def registrar_webhook(self, webhook_id: str) -> None:
        if webhook_id and webhook_id not in self.webhooks:
            self.webhooks.append(webhook_id)

    def registrar_estrutura(self, estrutura_id: str, produto_id: str) -> None:
        par = (estrutura_id, produto_id)
        if estrutura_id and par not in self.estruturas:
            self.estruturas.append(par)

    def registrar_lote_bloqueado(self, produto_id: str, lote: str) -> None:
        par = (produto_id, lote)
        if produto_id and lote and par not in self.lotes_bloqueados:
            self.lotes_bloqueados.append(par)


def _construir_cliente_limpeza(browser, storage_path: str):
    """Constrói um ``WmsApiClient`` autenticado para o teardown de sessão.

    A fixture ``wms_api`` é por-teste e não existe mais no teardown de sessão.
    Reaproveitamos o ``browser`` de sessão do pytest-playwright (mantido vivo
    porque ``cleanup_registry`` depende dele — logo é finalizado ANTES do
    ``browser``) e o ``storage_state`` salvo por ``_autenticado`` para abrir um
    contexto novo, ler o token do ``localStorage`` e montar o cliente sobre o
    ``APIRequestContext`` desse contexto.

    Não podemos usar ``sync_playwright().start()`` aqui: o pytest-playwright já
    roda dentro de um loop asyncio e o Sync API recusa ser reinicializado
    nesse contexto ("using Playwright Sync API inside the asyncio loop").

    Retorna ``(cliente, contexto)`` — o chamador fecha o contexto ao final. Em
    qualquer falha, retorna ``(None, contexto?)`` (a limpeza é best-effort).
    """
    context = None
    try:
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
            storage_state=storage_path,
        )
        page = context.new_page()
        page.goto(f"{BASE_URL}/modulos")
        page.wait_for_load_state("networkidle")
        token = page.evaluate("() => localStorage.getItem('visiofab-wms-token')")
        if not token:
            return None, context
        cliente = WmsApiClient(context.request, API_URL, token)
        return cliente, context
    except Exception as exc:  # pragma: no cover - limpeza best-effort
        print(f"[limpeza] falha ao construir cliente de limpeza: {type(exc).__name__}: {exc}")
        return None, context


def _gravar_relatorio_limpeza(registro: "RegistroLimpeza") -> None:
    """Grava o relatório de limpeza em ``evidencias/limpeza_{run_id}.txt``.

    Lista o que foi removido e o que NÃO pôde ser removido (Requisito 13.3).
    A falha ao gravar o relatório não pode derrubar nada — só imprime aviso.
    """
    try:
        pasta = Path(__file__).parent / "evidencias"
        pasta.mkdir(exist_ok=True)
        destino = pasta / f"limpeza_{registro.run_id}.txt"
        agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        linhas = [
            f"Relatório de limpeza de dados de QA — {registro.run_id}",
            f"Gerado em: {agora}",
            "",
            f"Removidos ({len(registro.removidos)}):",
        ]
        linhas += [f"  - {item}" for item in registro.removidos] or ["  (nenhum)"]
        linhas += [
            "",
            f"NÃO removidos ({len(registro.nao_removidos)}):",
        ]
        linhas += [f"  - {item}" for item in registro.nao_removidos] or ["  (nenhum)"]
        linhas.append("")
        destino.write_text("\n".join(linhas), encoding="utf-8")
        print(f"[limpeza] relatório gravado em {destino}")
    except Exception as exc:  # pragma: no cover - relatório best-effort
        print(f"[limpeza] falha ao gravar relatório de limpeza: {exc}")


@pytest.fixture(scope="session", autouse=True)
def cleanup_registry(run_id: str, _autenticado: str, browser):
    """Coletor de limpeza (escopo de sessão) + varredura final por marcador.

    ``autouse=True``: a varredura final acontece SEMPRE ao término da sessão,
    sem depender de cada teste lembrar de solicitar a fixture ou de limpar —
    é o mecanismo centralizado exigido pela task 13.1. Ainda assim, os testes
    PODEM injetar ``cleanup_registry`` como parâmetro para registrar
    explicitamente os identificadores que criaram (notas, OPs, reservas,
    webhooks, etc.), reforçando a varredura.

    Yields o ``RegistroLimpeza``. No teardown da sessão, reconstrói um cliente
    autenticado, remove as notas de QA pelo marcador ``run_id`` e os itens
    registrados, e grava o relatório em ``evidencias/limpeza_{run_id}.txt``
    (registrando o que não pôde ser removido). Nenhuma falha de limpeza derruba
    a suíte (try/except em tudo).
    """
    registro = RegistroLimpeza(run_id)

    yield registro

    # ── Teardown de sessão: varredura de limpeza rastreável ──────────
    context = None
    cliente = None
    try:
        cliente, context = _construir_cliente_limpeza(browser, _autenticado)
    except Exception as exc:  # pragma: no cover - limpeza best-effort
        print(f"[limpeza] não foi possível construir o cliente de limpeza: {exc}")
        cliente = None

    def _fechar_recursos():
        if context is not None:
            try:
                context.close()
            except Exception:
                pass

    if cliente is None:
        # Sem cliente, registramos os pendentes como não removidos e saímos.
        for nid in registro.notas:
            registro.nao_removidos.append(f"nota:{nid}")
        for oid in registro.ops_avulsas:
            registro.nao_removidos.append(f"op_avulsa:{oid}")
        for oid in registro.ops_normais:
            registro.nao_removidos.append(f"op_normal:{oid}")
        _fechar_recursos()
        _gravar_relatorio_limpeza(registro)
        return

    try:
        # 1) Notas localizadas pelo marcador (fonte de verdade rastreável) +
        #    notas explicitamente registradas pelos testes.
        ids_notas = set(registro.notas)
        try:
            for nota in cliente.listar_notas_por_marcador(run_id):
                if nota.get("id"):
                    ids_notas.add(nota["id"])
        except Exception as exc:  # pragma: no cover
            print(f"[limpeza] falha ao listar notas por marcador: {exc}")

        for nid in sorted(ids_notas):
            ok = cliente.excluir_nota_entrada(nid)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"nota:{nid}"
            )

        # 2) Reservas de OP (cancelar antes de excluir a OP).
        for oid in registro.reservas_op:
            ok = cliente.cancelar_reservas_op(oid)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"reservas_op:{oid}"
            )

        # 3) OPs avulsas (exclusão em cascata, sem restrição de status).
        for oid in registro.ops_avulsas:
            ok = cliente.excluir_op_avulsa(oid)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"op_avulsa:{oid}"
            )

        # 4) OPs normais (podem estar bloqueadas p/ exclusão — best-effort).
        for oid in registro.ops_normais:
            ok = cliente.excluir_ordem_producao(oid)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"op_normal:{oid}"
            )

        # 5) Lotes bloqueados (liberar).
        for produto_id, lote in registro.lotes_bloqueados:
            ok = cliente.liberar_lote(produto_id=produto_id, lote=lote)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"lote_bloqueado:{produto_id}/{lote}"
            )

        # 6) Webhooks.
        for wid in registro.webhooks:
            try:
                resp = cliente.remover_webhook(wid)
                ok = getattr(resp, "status", 0) in (200, 204)
            except Exception:
                ok = False
            (registro.removidos if ok else registro.nao_removidos).append(
                f"webhook:{wid}"
            )

        # 7) Estruturas (inativar — não há DELETE).
        for estrutura_id, produto_id in registro.estruturas:
            ok = cliente.inativar_estrutura(estrutura_id, produto_id)
            (registro.removidos if ok else registro.nao_removidos).append(
                f"estrutura:{estrutura_id}"
            )
    except Exception as exc:  # pragma: no cover - a limpeza não pode derrubar nada
        print(f"[limpeza] erro inesperado durante a varredura de limpeza: {exc}")
    finally:
        _fechar_recursos()
        _gravar_relatorio_limpeza(registro)
