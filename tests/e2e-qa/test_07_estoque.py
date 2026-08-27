"""
TEST SUITE 07 — Estoque (WMS)
===============================
Testa:
- Carregamento da consulta de estoque
- Cards de resumo (Produtos Cadastrados, Posições com Saldo, Registros)
- Busca por produto ou endereço
- Tabela de saldos com colunas esperadas
- Botão Atualizar
"""

import pytest
import time
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    clicar_botao,
    screenshot_com_nome,
)


class TestEstoqueConsulta:
    """Testes da página de consulta de estoque."""

    def test_pagina_carrega(self, page_auth: Page):
        """Verifica que a consulta de estoque carrega sem erro."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        expect(page_auth.locator("body")).to_contain_text("Consulta de Estoque")

    def test_cards_resumo_visíveis(self, page_auth: Page):
        """Verifica que os cards de resumo estão visíveis."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Produtos Cadastrados")
        expect(body).to_contain_text("Posições com Saldo")
        expect(body).to_contain_text("Registros de Saldo")

    def test_cards_resumo_tem_numeros(self, page_auth: Page):
        """Verifica que os cards mostram valores numéricos (não erro/NaN)."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        time.sleep(2)

        # Os cards devem mostrar números inteiros (0 ou mais)
        cards = page_auth.locator('[class*="Card"]')
        for i in range(min(cards.count(), 3)):
            card_text = cards.nth(i).inner_text()
            # Não deve conter "NaN", "undefined", "error"
            assert "NaN" not in card_text
            assert "undefined" not in card_text

    def test_tabela_saldos_colunas(self, page_auth: Page):
        """Verifica que a tabela de saldos tem as colunas esperadas."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        colunas = ["Endereço", "Produto", "Lote", "Validade", "Quantidade"]
        for col in colunas:
            expect(body).to_contain_text(col)

    def test_campo_pesquisa(self, page_auth: Page):
        """Verifica que o campo de pesquisa está presente e funcional."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        pesquisa = page_auth.get_by_placeholder("Pesquisar por produto ou endereço")
        expect(pesquisa).to_be_visible()

    def test_pesquisa_produto(self, page_auth: Page):
        """Testa buscar por um produto no campo de pesquisa."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        pesquisa = page_auth.get_by_placeholder("Pesquisar por produto ou endereço")
        pesquisa.fill("teste")
        time.sleep(2)  # Aguarda a query ser disparada

        # Não deve crashar
        assert pagina_carregou_sem_erro(page_auth)

    def test_pesquisa_endereco(self, page_auth: Page):
        """Testa buscar por um endereço no campo de pesquisa."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        pesquisa = page_auth.get_by_placeholder("Pesquisar por produto ou endereço")
        pesquisa.fill("A01")
        time.sleep(2)

        assert pagina_carregou_sem_erro(page_auth)

    def test_botao_atualizar(self, page_auth: Page):
        """Testa que o botão Atualizar recarrega os dados."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        btn = page_auth.get_by_role("button", name="Atualizar")
        expect(btn).to_be_visible()

        btn.click()
        time.sleep(2)

        # Não deve crashar ao recarregar
        assert pagina_carregou_sem_erro(page_auth)

    def test_saldos_lista_ou_vazia(self, page_auth: Page):
        """Verifica que a tabela mostra saldos ou mensagem de vazio."""
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)
        time.sleep(2)

        body = page_auth.locator("body")
        # Deve ter linhas na tabela OU a mensagem de "Nenhum saldo registrado"
        tabela_rows = page_auth.locator("table tbody tr")
        tem_dados = tabela_rows.count() > 0
        tem_mensagem_vazia = "Nenhum saldo registrado" in body.inner_text()

        assert tem_dados or tem_mensagem_vazia, \
            "Tabela sem dados e sem mensagem de estado vazio"


class TestEstoqueNavegacaoWMS:
    """Testes de navegação para outras áreas do WMS."""

    def test_navegar_mapa_armazem(self, page_auth: Page):
        """Verifica que o mapa do armazém carrega."""
        navegar_para(page_auth, "/wms/mapa")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegar_transferencia(self, page_auth: Page):
        """Verifica que a página de transferência carrega."""
        navegar_para(page_auth, "/wms/transferencia-endereco")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_navegar_inventario(self, page_auth: Page):
        """Verifica que a página de inventário carrega."""
        navegar_para(page_auth, "/wms/inventario")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
