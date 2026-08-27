"""
Configuração central do pytest-playwright para a suite de QA do Vizor ERP.
Gerencia login, seleção de empresa e navegação comum.
"""

import os
import pytest
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import Page, BrowserContext, expect

# Carrega .env do diretório da suite
load_dotenv(Path(__file__).parent / ".env")

BASE_URL = os.getenv("BASE_URL", "https://visiofav-front-wofr.vercel.app")
EMAIL = os.getenv("EMAIL", "admin@visiofab.com")
PASSWORD = os.getenv("PASSWORD", "987123")
EMPRESA_NOME = os.getenv("EMPRESA_NOME", "VisioFab Demo")


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
