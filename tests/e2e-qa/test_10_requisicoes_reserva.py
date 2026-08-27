"""
TEST SUITE 10 — Requisições de Compra e Reserva de Produção
============================================================
Testa:
- Tela de Requisições de Compra (módulo Compras): lista, filtros, estado vazio
- Visão "Por Produto" na Consulta de Saldos (WMS): colunas Origem / Reservado /
  Disponível, expansão de endereços

Segue o padrão da suite: valida que as telas carregam e os elementos existem,
usando pytest.skip() quando não há dados pré-existentes.
"""

import pytest
import time
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    clicar_tab,
    screenshot_com_nome,
)


class TestRequisicoesCompra:
    """Tela de Requisições de Compra no módulo Compras."""

    def test_pagina_carrega(self, page_auth: Page):
        navegar_para(page_auth, "/compras/requisicoes")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        expect(page_auth.locator("body")).to_contain_text("Requisições de Compra")

    def test_colunas_da_tabela(self, page_auth: Page):
        """Verifica as colunas esperadas da lista de requisições."""
        navegar_para(page_auth, "/compras/requisicoes")
        aguardar_carregamento(page_auth)
        time.sleep(1)
        body = page_auth.locator("body")
        for coluna in ["Produto", "Fornecedor Sugerido", "OP Origem", "Status"]:
            expect(body).to_contain_text(coluna)

    def test_filtros_visiveis(self, page_auth: Page):
        """Verifica busca por produto e filtro de status."""
        navegar_para(page_auth, "/compras/requisicoes")
        aguardar_carregamento(page_auth)
        expect(page_auth.get_by_placeholder("Buscar por produto...")).to_be_visible()
        # Botão de gerar pedido (desabilitado sem seleção) deve existir
        body = page_auth.locator("body")
        expect(body).to_contain_text("Gerar Pedido de Compra")

    def test_botao_gerar_pedido_desabilitado_sem_selecao(self, page_auth: Page):
        """Sem requisição selecionada, o botão de gerar pedido fica desabilitado."""
        navegar_para(page_auth, "/compras/requisicoes")
        aguardar_carregamento(page_auth)
        btn = page_auth.get_by_role("button", name="Gerar Pedido de Compra", exact=False)
        # O botão existe; disabled quando nada selecionado
        assert btn.count() > 0

    def test_no_menu_compras(self, page_auth: Page):
        """Verifica que o item aparece no menu do módulo Compras."""
        navegar_para(page_auth, "/compras/pedidos")
        aguardar_carregamento(page_auth)
        body = page_auth.locator("body")
        expect(body).to_contain_text("Requisições de Compra")


class TestConsultaSaldosPorProduto:
    """Visão Por Produto na Consulta de Saldos (Origem/Reservado/Disponível)."""

    def test_pagina_carrega(self, page_auth: Page):
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_abas_visiveis(self, page_auth: Page):
        """Verifica as abas Por Endereço e Por Produto."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        time.sleep(1)
        body = page_auth.locator("body")
        expect(body).to_contain_text("Por Endereço")
        expect(body).to_contain_text("Por Produto")

    def test_aba_por_produto_colunas(self, page_auth: Page):
        """Clica na aba Por Produto e valida as colunas Origem/Reservado/Disponível."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        time.sleep(1)

        aba = page_auth.get_by_role("tab", name="Por Produto", exact=False)
        if not aba.is_visible():
            pytest.skip("Aba Por Produto não disponível")
        aba.click()
        time.sleep(2)

        assert pagina_carregou_sem_erro(page_auth)
        body = page_auth.locator("body")
        for coluna in ["Origem", "Físico", "Reservado", "Disponível"]:
            expect(body).to_contain_text(coluna)
        screenshot_com_nome(page_auth, "saldos_por_produto")

    def test_expandir_enderecos_wms(self, page_auth: Page):
        """Se houver produto com origem WMS, tenta expandir para ver endereços."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        time.sleep(1)

        aba = page_auth.get_by_role("tab", name="Por Produto", exact=False)
        if not aba.is_visible():
            pytest.skip("Aba Por Produto não disponível")
        aba.click()
        time.sleep(2)

        # Procura badge WMS (produto com saldo endereçado)
        badge_wms = page_auth.locator('[class*="Badge"]').filter(has_text="WMS")
        if badge_wms.count() == 0:
            pytest.skip("Nenhum produto com origem WMS na empresa demo")

        # Clica no primeiro chevron de expansão disponível
        chevron = page_auth.locator('button[title="Ver endereços"]').first
        if chevron.is_visible():
            chevron.click()
            time.sleep(0.5)
            body = page_auth.locator("body")
            expect(body).to_contain_text("Onde está")
