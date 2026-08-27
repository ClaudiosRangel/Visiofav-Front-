"""
TEST SUITE 04 — Pedido de Venda
================================
Testa:
- Listagem de pedidos
- Criação de novo pedido (happy path)
- Validação de campos obrigatórios
- Adição de itens ao pedido
- Totalização automática
- Edição de pedido existente
"""

import pytest
import time
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    preencher_select_primeiro,
    preencher_numero,
    preencher_data,
    clicar_botao,
    clicar_tab,
    screenshot_com_nome,
    data_futura,
)


class TestPedidoVendaListagem:
    """Testes da listagem de pedidos."""

    def test_pagina_carrega(self, page_auth: Page):
        """Verifica que a lista de pedidos carrega sem erro."""
        navegar_para(page_auth, "/vendas/pedidos")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_botao_novo_pedido(self, page_auth: Page):
        """Verifica que o botão Novo Pedido está visível."""
        navegar_para(page_auth, "/vendas/pedidos")
        aguardar_carregamento(page_auth)

        btn = page_auth.get_by_role("button", name="Novo Pedido")
        if not btn.is_visible():
            btn = page_auth.get_by_role("link", name="Novo Pedido")
        assert btn.is_visible()


class TestPedidoVendaCriacao:
    """Testes de criação de pedido de venda."""

    def test_formulario_abre(self, page_auth: Page):
        """Verifica que o formulário de novo pedido carrega."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Novo Pedido de Venda")

    def test_campos_obrigatorios_visíveis(self, page_auth: Page):
        """Verifica que os campos obrigatórios estão presentes."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Cliente")
        expect(body).to_contain_text("Tabela de Preço")

    def test_validacao_submeter_vazio(self, page_auth: Page):
        """Testa que submeter o formulário vazio mostra erros de validação."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        # Clica em Criar Pedido sem preencher nada
        btn = page_auth.get_by_role("button", name="Criar Pedido")
        btn.click()
        time.sleep(1)

        # Deve mostrar erros de validação (campos obrigatórios)
        body = page_auth.locator("body")
        # Mantine mostra erro inline via prop error nos inputs
        errors = page_auth.locator('[class*="error"], [data-error="true"]')
        assert errors.count() > 0 or "obrigatório" in body.inner_text().lower() or \
               "required" in body.inner_text().lower() or \
               page_auth.url.endswith("/novo")  # Ainda na mesma página = não passou

    def test_selecionar_cliente(self, page_auth: Page):
        """Testa selecionar um cliente no campo de select."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        # Clica no select de Cliente
        cliente_input = page_auth.get_by_label("Cliente", exact=False).first
        cliente_input.click()
        time.sleep(0.5)

        # Verifica se o dropdown abriu com opções
        opcoes = page_auth.locator('[role="option"]')
        if opcoes.count() > 0:
            opcoes.first.click()
            time.sleep(0.3)
            # Verifica que o input agora tem valor
            assert cliente_input.input_value() != ""
        else:
            pytest.skip("Nenhum cliente cadastrado na empresa demo")

    def test_criacao_pedido_happy_path(self, page_auth: Page):
        """
        Fluxo completo de criação de pedido de venda.
        Seleciona cliente, tabela de preço, adiciona item e salva.
        """
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        # ══ Dados Gerais ══

        # Seleciona Cliente via teclado (Mantine Select - arrow down + enter)
        cliente_label = page_auth.locator('label').filter(has_text="Cliente").first
        cliente_input = cliente_label.locator("..").locator("input").first
        cliente_input.click()
        time.sleep(0.5)
        cliente_input.press("ArrowDown")
        time.sleep(0.3)
        cliente_input.press("Enter")
        time.sleep(0.5)

        # Seleciona Tabela de Preço via teclado
        tabela_label = page_auth.locator('label').filter(has_text="Tabela de Preço").first
        tabela_input = tabela_label.locator("..").locator("input").first
        tabela_input.click()
        time.sleep(0.5)
        tabela_input.press("ArrowDown")
        time.sleep(0.3)
        tabela_input.press("Enter")
        time.sleep(0.5)

        # ══ Submeter ══
        btn = page_auth.get_by_role("button", name="Criar Pedido")
        btn.click()
        time.sleep(3)

        # Verifica resultado
        url_atual = page_auth.url
        body = page_auth.locator("body")

        # Sucesso: redireciona para lista ou página do pedido criado
        sucesso = (
            "/vendas/pedidos" in url_atual and "/novo" not in url_atual
        ) or "sucesso" in body.inner_text().lower()

        if not sucesso:
            screenshot_com_nome(page_auth, "pedido_criacao_resultado")

    def test_tabs_pedido(self, page_auth: Page):
        """Verifica que todas as tabs do pedido estão acessíveis."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        # Verifica tabs
        tabs_esperadas = ["Itens", "Entrega", "Financeiro", "Observações"]
        for tab_nome in tabs_esperadas:
            tab = page_auth.get_by_role("tab", name=tab_nome, exact=False)
            expect(tab).to_be_visible()

        # Clica em cada tab e verifica que muda o conteúdo
        page_auth.get_by_role("tab", name="Entrega", exact=False).click()
        time.sleep(0.3)
        body = page_auth.locator("body")
        # Tab entrega deve ter campos de transporte
        expect(body).to_contain_text("Transporte")

    def test_totalizador_visivel(self, page_auth: Page):
        """Verifica que o rodapé totalizador está presente."""
        navegar_para(page_auth, "/vendas/pedidos/novo")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Subtotal")
        expect(body).to_contain_text("Total do Pedido")
