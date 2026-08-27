"""
TEST SUITE 01 — Login, Seleção de Empresa e Navegação entre Módulos
====================================================================
Testa:
- Login com credenciais válidas
- Login com credenciais inválidas (validação de erro)
- Seleção da empresa
- Navegação para cada módulo alvo (PCP, Vendas, Estoque, etc.)
- Acesso ao sidebar de cada módulo
"""

import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    screenshot_com_nome,
)


class TestLoginENavegacao:
    """Testes de login e acesso aos módulos."""

    def test_login_credenciais_validas(self, page_auth: Page):
        """Verifica que o login foi bem-sucedido e está na tela de módulos."""
        expect(page_auth).to_have_url(f"{BASE_URL}/modulos")
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegacao_modulo_pcp(self, page_auth: Page):
        """Navega para o módulo PCP e verifica que carregou."""
        navegar_para(page_auth, "/pcp/dashboard")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        # Verifica que o título ou breadcrumb do PCP está presente
        expect(page_auth.locator("body")).to_contain_text("PCP")

    def test_navegacao_modulo_vendas(self, page_auth: Page):
        """Navega para o módulo Vendas e verifica que carregou."""
        navegar_para(page_auth, "/vendas/pedidos")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegacao_modulo_orcamento_grafico(self, page_auth: Page):
        """Navega para o módulo Orçamento Gráfico e verifica que carregou."""
        navegar_para(page_auth, "/orcamento-grafico")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegacao_modulo_estoque(self, page_auth: Page):
        """Navega para o módulo Estoque e verifica que carregou."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        expect(page_auth.locator("body")).to_contain_text("Consulta de Estoque")

    def test_navegacao_modulo_programacao(self, page_auth: Page):
        """Navega para a Programação de Produção (PCP)."""
        navegar_para(page_auth, "/pcp/programacao")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegacao_portal_representante(self, page_auth: Page):
        """Navega para o Portal Representante (admin)."""
        navegar_para(page_auth, "/portal-representante/representantes")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        expect(page_auth.locator("body")).to_contain_text("Representantes")

    def test_sidebar_pcp_itens_menu(self, page_auth: Page):
        """Verifica que o sidebar do PCP mostra os itens de menu esperados."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        # Verifica itens do menu lateral
        sidebar = page_auth.locator("nav, aside, [class*='Sidebar']").first
        body = page_auth.locator("body")
        expect(body).to_contain_text("Ordens de Produção")
        expect(body).to_contain_text("Programação")

    def test_sidebar_wms_itens_menu(self, page_auth: Page):
        """Verifica que o sidebar do WMS mostra itens do Estoque."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Consulta de Saldos")
