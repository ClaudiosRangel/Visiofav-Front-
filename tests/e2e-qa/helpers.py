"""
Helpers reutilizáveis para os testes de QA.
Funções para aguardar, preencher campos Mantine, validar notificações, etc.
"""

import time
import random
import string
from datetime import datetime, timedelta
from playwright.sync_api import Page, Locator, expect


# ════════════════════════════════════════════════════════════════════
# ESPERAS E VERIFICAÇÕES
# ════════════════════════════════════════════════════════════════════


def aguardar_carregamento(page: Page, timeout: int = 10000):
    """Aguarda até que não haja mais overlays de loading visíveis."""
    # Mantine usa LoadingOverlay com role="progressbar" ou com classe mantine-LoadingOverlay
    page.wait_for_load_state("networkidle")
    # Aguarda os overlays sumirem
    overlay = page.locator('[class*="LoadingOverlay"]')
    if overlay.count() > 0:
        overlay.first.wait_for(state="hidden", timeout=timeout)


def aguardar_notificacao(page: Page, texto: str = None, cor: str = None, timeout: int = 8000):
    """
    Aguarda uma notificação Mantine aparecer.
    Opcionalmente filtra por texto contido e cor (green, red, orange).
    """
    notif_container = page.locator('[class*="Notifications"]')
    notif_container.wait_for(timeout=timeout)

    if texto:
        notif = page.locator(f'[class*="Notification"]:has-text("{texto}")')
        notif.first.wait_for(timeout=timeout)
        return notif.first

    time.sleep(1)  # fallback
    return None


def verificar_notificacao_sucesso(page: Page, texto_parcial: str = "sucesso", timeout: int = 8000):
    """Verifica que apareceu notificação de sucesso (verde)."""
    notif = page.locator(f'[class*="Notification"]').filter(has_text=texto_parcial)
    expect(notif.first).to_be_visible(timeout=timeout)


def verificar_notificacao_erro(page: Page, timeout: int = 5000):
    """Verifica se apareceu notificação de erro (vermelha)."""
    notif = page.locator('[data-mantine-color-scheme] [class*="Notification"]')
    # Notificações de erro têm color="red" — verificar texto "Erro"
    erro = page.locator('[class*="Notification"]').filter(has_text="Erro")
    if erro.count() > 0:
        return erro.first.inner_text()
    return None


def pagina_carregou_sem_erro(page: Page) -> bool:
    """
    Verifica que a página não caiu em erro 500 ou tela em branco.
    Retorna True se tudo ok, False se detectou problema.
    """
    body_text = page.locator("body").inner_text()
    # Frases exatas de erro de página (não números soltos como "500 peças")
    erros_fatais = [
        "Internal Server Error",
        "Application error",
        "This page could not be found",
        "404 | This page could not be found",
        "Server Error",
        "Unexpected Application Error",
    ]
    body_lower = body_text.lower()
    for erro in erros_fatais:
        if erro.lower() in body_lower:
            return False
    return True


# ════════════════════════════════════════════════════════════════════
# PREENCHIMENTO DE CAMPOS MANTINE
# ════════════════════════════════════════════════════════════════════


def preencher_select(page: Page, label: str, opcao: str, exact_label: bool = False):
    """
    Preenche um Select Mantine (combobox):
    1. Clica no input do select para abrir o dropdown
    2. Digita o texto para filtrar (se searchable)
    3. Clica na opção desejada
    """
    # Localiza pelo label
    if exact_label:
        select_input = page.locator(f'label:has-text("{label}")').locator("..").locator("input")
    else:
        select_input = page.get_by_label(label, exact=False).first

    select_input.click()
    time.sleep(0.3)

    # Se é searchable, digita para filtrar
    select_input.fill(opcao)
    time.sleep(0.5)

    # Clica na opção do dropdown
    dropdown_option = page.locator(f'[role="option"]:has-text("{opcao}")').first
    dropdown_option.wait_for(timeout=5000)
    dropdown_option.click()
    time.sleep(0.3)


def preencher_select_primeiro(page: Page, label: str):
    """Preenche um Select Mantine clicando no input e selecionando a primeira opção."""
    select_input = page.get_by_label(label, exact=False).first
    select_input.click()
    time.sleep(0.5)

    # Seleciona a primeira opção disponível
    primeira = page.locator('[role="option"]').first
    primeira.wait_for(timeout=5000)
    primeira.click()
    time.sleep(0.3)


def preencher_autocomplete(page: Page, label: str, texto: str, selecionar_primeiro: bool = True):
    """
    Preenche um Autocomplete Mantine:
    1. Foca o input
    2. Digita o texto
    3. Aguarda sugestões e seleciona a primeira
    """
    input_field = page.get_by_label(label, exact=False).first
    input_field.click()
    input_field.fill(texto)
    time.sleep(1)  # Aguarda debounce da busca

    if selecionar_primeiro:
        opcao = page.locator('[role="option"]').first
        if opcao.is_visible():
            opcao.click()
            time.sleep(0.3)


def preencher_numero(page: Page, label: str, valor: float):
    """Preenche um NumberInput Mantine."""
    input_field = page.get_by_label(label, exact=False).first
    input_field.click()
    input_field.fill(str(valor))


def preencher_texto(page: Page, label: str, texto: str):
    """Preenche um TextInput ou Textarea Mantine."""
    input_field = page.get_by_label(label, exact=False).first
    input_field.click()
    input_field.fill(texto)


def preencher_data(page: Page, label: str, data: datetime = None):
    """Preenche um DateInput Mantine no formato DD/MM/AAAA."""
    if data is None:
        data = datetime.now() + timedelta(days=30)

    input_field = page.get_by_label(label, exact=False).first
    input_field.click()
    input_field.fill(data.strftime("%d/%m/%Y"))
    # Pressiona Enter para confirmar a data
    input_field.press("Enter")
    time.sleep(0.3)


# ════════════════════════════════════════════════════════════════════
# GERADORES DE DADOS DE TESTE
# ════════════════════════════════════════════════════════════════════


def gerar_email_teste() -> str:
    """Gera um email único para testes."""
    sufixo = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"qa-test-{sufixo}@visiofab-teste.com"


def gerar_nome_teste(prefixo: str = "QA") -> str:
    """Gera um nome único com prefixo para identificar dados de teste."""
    sufixo = "".join(random.choices(string.digits, k=4))
    timestamp = datetime.now().strftime("%H%M")
    return f"{prefixo}-{timestamp}-{sufixo}"


def data_futura(dias: int = 30) -> datetime:
    """Retorna uma data N dias no futuro."""
    return datetime.now() + timedelta(days=dias)


# ════════════════════════════════════════════════════════════════════
# NAVEGAÇÃO
# ════════════════════════════════════════════════════════════════════


def clicar_botao(page: Page, nome: str):
    """Clica em um botão pelo texto visível."""
    page.get_by_role("button", name=nome).click()
    time.sleep(0.5)


def clicar_tab(page: Page, nome: str):
    """Clica em uma tab Mantine pelo texto."""
    page.get_by_role("tab", name=nome).click()
    time.sleep(0.5)


def abrir_modal(page: Page, botao_nome: str) -> Locator:
    """Clica no botão que abre um modal e retorna o locator do modal."""
    clicar_botao(page, botao_nome)
    modal = page.locator('[role="dialog"]')
    modal.wait_for(timeout=5000)
    return modal


def confirmar_dialog(page: Page):
    """Aceita um confirm() nativo do browser."""
    page.on("dialog", lambda dialog: dialog.accept())


def screenshot_com_nome(page: Page, nome: str):
    """Tira screenshot com nome descritivo na pasta de evidências."""
    pasta = Path(__file__).parent / "evidencias"
    pasta.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    page.screenshot(path=str(pasta / f"{nome}_{timestamp}.png"), full_page=True)


# Importar Path aqui para não poluir o topo
from pathlib import Path
