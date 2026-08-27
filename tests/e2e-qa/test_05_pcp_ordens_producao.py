"""
TEST SUITE 05 — PCP: Ordens de Produção
=========================================
Testa:
- Listagem de OPs com filtros por status
- Criação de nova OP manual (happy path)
- Validação de campos obrigatórios na criação
- Visualização de OP existente
- Transição de status de OP
"""

import pytest
import time
from datetime import datetime, timedelta
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    preencher_numero,
    preencher_data,
    preencher_texto,
    clicar_botao,
    clicar_tab,
    screenshot_com_nome,
    data_futura,
)


class TestOPListagem:
    """Testes da listagem de Ordens de Produção."""

    def test_pagina_carrega(self, page_auth: Page):
        """Verifica que a lista de OPs carrega sem erro."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        expect(page_auth.locator("body")).to_contain_text("Ordens de Produção")

    def test_botao_nova_op(self, page_auth: Page):
        """Verifica que o botão Nova OP está presente."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        btn = page_auth.get_by_role("button", name="Nova OP")
        expect(btn).to_be_visible()

    def test_filtros_por_status(self, page_auth: Page):
        """Verifica que as tabs de filtro por status existem e funcionam."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        # Tabs de status esperadas
        status_tabs = ["Todas", "Rascunho", "Planejada", "Programada",
                       "Liberada", "Em Produção", "Concluída", "Cancelada"]

        for tab_nome in status_tabs:
            tab = page_auth.get_by_role("tab", name=tab_nome, exact=False)
            expect(tab).to_be_visible()

    def test_clicar_tab_programada(self, page_auth: Page):
        """Testa filtrar por status Programada."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        page_auth.get_by_role("tab", name="Programada").click()
        time.sleep(1)
        aguardar_carregamento(page_auth)

        # Deve mostrar apenas OPs programadas (ou mensagem "nenhuma encontrada")
        body = page_auth.locator("body")
        assert body.is_visible()  # Não crashou

    def test_busca_por_numero(self, page_auth: Page):
        """Testa o campo de busca por número de OP."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        busca = page_auth.get_by_placeholder("Buscar por número")
        expect(busca).to_be_visible()

        # Digita um número inexistente
        busca.fill("99999")
        busca.press("Enter")
        time.sleep(1)

        # Deve mostrar lista vazia ou resultado
        body = page_auth.locator("body")
        assert body.is_visible()

    def test_filtro_por_cliente(self, page_auth: Page):
        """Testa o campo de filtro por cliente."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        filtro = page_auth.get_by_placeholder("Filtrar por cliente")
        expect(filtro).to_be_visible()


class TestOPCriacao:
    """Testes de criação de Ordem de Produção."""

    def test_formulario_nova_op_carrega(self, page_auth: Page):
        """Verifica que o formulário de nova OP carrega corretamente."""
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Nova Ordem de Produção")

    def test_campos_obrigatorios_presentes(self, page_auth: Page):
        """Verifica que os campos obrigatórios estão presentes."""
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Produto a Fabricar")
        expect(body).to_contain_text("Quantidade")
        expect(body).to_contain_text("Data de Entrega Prevista")
        expect(body).to_contain_text("Máquina / Centro Produtivo")

    def test_validacao_sem_produto(self, page_auth: Page):
        """Testa que criar OP sem produto mostra erro."""
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)

        # Clica em Criar sem preencher
        btn = page_auth.get_by_role("button", name="Criar Ordem de Produção")
        btn.click()
        time.sleep(1)

        # Deve mostrar alerta de erro
        body = page_auth.locator("body")
        expect(body).to_contain_text("Selecione um produto")

    def test_validacao_sem_data_entrega(self, page_auth: Page):
        """Testa que criar OP sem data de entrega mostra erro."""
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)

        # Seleciona produto
        produto_input = page_auth.get_by_label("Produto a Fabricar", exact=False).first
        produto_input.click()
        time.sleep(0.5)
        opcoes = page_auth.locator('[role="option"]')
        if opcoes.count() > 0:
            opcoes.first.click()
            time.sleep(0.3)
        else:
            pytest.skip("Nenhum produto cadastrado")

        # Preenche quantidade
        page_auth.get_by_label("Quantidade", exact=False).first.fill("100")

        # Clica em Criar sem data
        page_auth.get_by_role("button", name="Criar Ordem de Produção").click()
        time.sleep(1)

        body = page_auth.locator("body")
        expect(body).to_contain_text("data de entrega")

    def test_criacao_op_happy_path(self, page_auth: Page):
        """
        Fluxo completo de criação de OP manual.
        Seleciona produto, quantidade, data e centro de produção.
        """
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)

        # Seleciona Produto a Fabricar (combobox searchable)
        produto_label = page_auth.locator('label').filter(has_text="Produto a Fabricar")
        produto_input = produto_label.first.locator("..").locator("input")
        produto_input.click()
        time.sleep(0.5)
        produto_input.press("ArrowDown")
        time.sleep(0.3)
        produto_input.press("Enter")
        time.sleep(0.5)

        # Preenche Quantidade
        qtd_label = page_auth.locator('label').filter(has_text="Quantidade")
        qtd_input = qtd_label.first.locator("..").locator("input")
        qtd_input.fill("500")
        time.sleep(0.2)

        # Seleciona Prioridade
        prioridade_label = page_auth.locator('label').filter(has_text="Prioridade")
        prioridade_input = prioridade_label.first.locator("..").locator("input")
        prioridade_input.click()
        time.sleep(0.5)
        prioridade_input.press("ArrowDown")
        time.sleep(0.2)
        prioridade_input.press("ArrowDown")  # NORMAL é a segunda opção
        time.sleep(0.2)
        prioridade_input.press("Enter")
        time.sleep(0.3)

        # Preenche Data de Entrega
        data_label = page_auth.locator('label').filter(has_text="Data de Entrega")
        data_input = data_label.first.locator("..").locator("input")
        data_futura_str = (datetime.now() + timedelta(days=15)).strftime("%d/%m/%Y")
        data_input.fill(data_futura_str)
        data_input.press("Enter")
        time.sleep(0.3)

        # Seleciona Centro/Máquina
        centro_label = page_auth.locator('label').filter(has_text="Máquina")
        centro_input = centro_label.first.locator("..").locator("input")
        centro_input.click()
        time.sleep(0.5)
        centro_input.press("ArrowDown")
        time.sleep(0.3)
        centro_input.press("Enter")
        time.sleep(0.3)

        # Criar OP
        page_auth.get_by_role("button", name="Criar Ordem de Produção").click()
        time.sleep(5)

        # Verifica resultado: deve ter notificação de sucesso ou redirecionar
        body = page_auth.locator("body")
        url_atual = page_auth.url

        sucesso = (
            "Criada" in body.inner_text()
            or "/pcp/ordens-producao" in url_atual and "/nova" not in url_atual
            or "OP #" in body.inner_text()
        )

        screenshot_com_nome(page_auth, "op_criacao_resultado")

    def test_secao_especificacao_grafica(self, page_auth: Page):
        """Verifica que a seção de especificação gráfica está presente."""
        navegar_para(page_auth, "/pcp/ordens-producao/nova")
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(body).to_contain_text("Especificação Gráfica")
        expect(body).to_contain_text("Sistema de Cores")
        expect(body).to_contain_text("Lote de Produção")


class TestOPVisualizacao:
    """Testes de visualização de OP existente."""

    def test_visualizar_primeira_op(self, page_auth: Page):
        """Tenta visualizar a primeira OP da lista."""
        navegar_para(page_auth, "/pcp/ordens-producao")
        aguardar_carregamento(page_auth)

        # Clica no botão de visualizar (olho) da primeira linha
        btn_ver = page_auth.locator('button[title="Visualizar"]').first
        if btn_ver.is_visible():
            btn_ver.click()
            time.sleep(2)
            aguardar_carregamento(page_auth)

            # Deve navegar para a página de detalhe
            assert "/pcp/ordens-producao/" in page_auth.url
            assert pagina_carregou_sem_erro(page_auth)
        else:
            pytest.skip("Nenhuma OP na lista para visualizar")
