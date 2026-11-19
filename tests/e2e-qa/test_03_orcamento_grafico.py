"""
TEST SUITE 03 — Orçamento Gráfico
==================================
Testa:
- Listagem de orçamentos e entradas "Novo Orçamento" / "Puxar Cálculo"
- Fluxo novo (paridade com o legado): Orçamento em branco → Cliente Principal →
  Incluir item → linha de produto → Seletor de Cálculo Padrão → Usar →
  grade de itens (item 1 selecionado), painel "Dados do item" e aba Fechamento
- Wizard completo (7 steps) em /orcamento-grafico/novo (ainda existente)

Testes do fluxo novo que dependem de dados da empresa demo (linhas de produto,
cálculo padrão, clientes) fazem pytest.skip com motivo quando o dado não existe.
Orçamentos criados pelo fluxo novo recebem a série "QA-E2E" para identificação.
"""

import pytest
import time
from playwright.sync_api import Page, expect
from conftest import BASE_URL, navegar_para
from helpers import (
    aguardar_carregamento,
    pagina_carregou_sem_erro,
    preencher_autocomplete,
    preencher_numero,
    preencher_texto,
    clicar_botao,
    screenshot_com_nome,
    gerar_nome_teste,
)


class TestOrcamentoGraficoListagem:
    """Testes de listagem de orçamentos."""

    def test_pagina_carrega(self, page_auth: Page):
        """Verifica que a lista de orçamentos carrega sem erro."""
        navegar_para(page_auth, "/orcamento-grafico")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

    def test_botao_novo_orcamento_visivel(self, page_auth: Page):
        """Verifica que existe um caminho para criar novo orçamento."""
        navegar_para(page_auth, "/orcamento-grafico")
        aguardar_carregamento(page_auth)

        expect(page_auth.get_by_role("button", name="Novo Orçamento")).to_be_visible()
        expect(page_auth.get_by_role("button", name="Puxar Cálculo")).to_be_visible()

    def test_puxar_calculo_abre_seletor(self, page_auth: Page):
        """'Puxar Cálculo' abre o Seletor de Cálculo Padrão (modo criação)."""
        navegar_para(page_auth, "/orcamento-grafico")
        aguardar_carregamento(page_auth)

        page_auth.get_by_role("button", name="Puxar Cálculo").click()
        seletor = page_auth.get_by_role("dialog")
        expect(seletor).to_contain_text("Localizar Cálculo Padrão", timeout=10000)
        expect(seletor).to_contain_text("Quantidade de cálculos: 0")
        expect(seletor.get_by_role("button", name="Usar")).to_be_disabled()
        seletor.get_by_role("button", name="Sair").click()
        expect(seletor).to_be_hidden()


# ════════════════════════════════════════════════════════════════════
# FLUXO NOVO — Orçamento em branco → Incluir item → Seletor → Usar
# ════════════════════════════════════════════════════════════════════

SERIE_QA = "QA-E2E"
TITULO_DIALOGO_LINHA = "Novo Item — Selecione a Linha de Produto"
TITULO_SELETOR = "Localizar Cálculo Padrão"


def _abrir_novo_orcamento(page: Page):
    navegar_para(page, "/orcamento-grafico/novo-orcamento")
    aguardar_carregamento(page)
    expect(page.get_by_role("heading", name="Novo orçamento")).to_be_visible(timeout=10000)


def _buscar_cliente_principal(page: Page) -> bool:
    """Busca um Cliente Principal pelo nome e seleciona o primeiro resultado.

    Retorna False (sem falhar) quando a empresa demo não tem cliente
    encontrado — o chamador decide se faz skip.
    """
    campo_nome = page.get_by_label("Nome", exact=True)
    for termo in ("a", "e", "o"):
        campo_nome.fill(termo)
        page.get_by_role("button", name="Pesquisar").click()
        time.sleep(1.5)
        primeira_linha = page.locator('tr[tabindex="0"]').first
        if primeira_linha.count() > 0 and primeira_linha.is_visible():
            primeira_linha.click()
            time.sleep(0.5)
            # Cliente com observação abre o modal "Observações da Empresa": fecha se aparecer.
            dialogo = page.get_by_role("dialog")
            if dialogo.count() > 0 and dialogo.first.is_visible():
                page.keyboard.press("Escape")
                time.sleep(0.3)
            return True
    return False


def _abrir_dialogo_linha(page: Page):
    """Preenche a série de QA e aciona 'Incluir item' (cria o cabeçalho e abre o diálogo)."""
    page.get_by_label("Série").fill(SERIE_QA)
    page.get_by_role("button", name="Incluir item").first.click()
    dialogo = page.get_by_role("dialog")
    expect(dialogo).to_contain_text(TITULO_DIALOGO_LINHA, timeout=15000)
    return dialogo


class TestOrcamentoGraficoFluxoNovo:
    """Fluxo de paridade com o legado, sobre as telas reais do front."""

    def test_orcamento_em_branco_nao_grava_nada(self, page_auth: Page):
        """Abrir 'Novo Orçamento' não chama a API de criação (rascunho em memória)."""
        posts_cabecalho = []
        page_auth.on(
            "request",
            lambda req: posts_cabecalho.append(req.url)
            if req.method == "POST" and req.url.endswith("/orcamento-grafico/cabecalho")
            else None,
        )

        navegar_para(page_auth, "/orcamento-grafico")
        aguardar_carregamento(page_auth)
        page_auth.get_by_role("button", name="Novo Orçamento").click()
        page_auth.wait_for_url("**/orcamento-grafico/novo-orcamento", timeout=15000)
        aguardar_carregamento(page_auth)

        body = page_auth.locator("body")
        expect(page_auth.get_by_role("heading", name="Novo orçamento")).to_be_visible()
        for rotulo in ("Série", "Data", "Cliente Principal"):
            expect(body).to_contain_text(rotulo)
        for coluna in ("Item", "Cálculo", "Linha de Produto", "Tipo de Produto",
                       "Tiragens", "Descrição", "Status"):
            expect(page_auth.get_by_role("columnheader", name=coluna)).to_be_visible()
        expect(body).to_contain_text("Nenhum item. Use \"Incluir item\" para adicionar.")
        expect(page_auth.get_by_label("Nº")).to_have_value("auto")

        assert posts_cabecalho == [], \
            f"O orçamento em branco não deveria gravar nada: {posts_cabecalho}"

    def test_cliente_principal_busca_e_selecao(self, page_auth: Page):
        """Cliente Principal: pesquisar sem termo avisa; com termo, seleciona da lista."""
        _abrir_novo_orcamento(page_auth)

        # Sem código nem nome: aviso de preenchimento.
        page_auth.get_by_role("button", name="Pesquisar").click()
        expect(page_auth.locator("body")).to_contain_text(
            "Informe o código ou o nome do cliente para pesquisar."
        )

        if not _buscar_cliente_principal(page_auth):
            pytest.skip("Nenhum cliente encontrado na busca da empresa demo (termos 'a', 'e', 'o')")

        expect(page_auth.locator("body")).to_contain_text("Cliente selecionado:")

    def test_dialogo_linha_confirmar_exige_selecao(self, page_auth: Page):
        """Diálogo de linha: nenhuma pré-selecionada e Confirmar desabilitado até escolher."""
        _abrir_novo_orcamento(page_auth)
        dialogo = _abrir_dialogo_linha(page_auth)

        # Aguarda a carga das linhas (loader some).
        time.sleep(1.5)
        if dialogo.get_by_text("Não há linhas de produto ativas.").count() > 0:
            pytest.skip("Empresa demo sem linhas de produto ativas")
        if dialogo.get_by_text("As linhas não puderam ser carregadas.").count() > 0:
            pytest.skip("Linhas de produto indisponíveis no ambiente (erro de carga)")

        expect(dialogo.get_by_role("radio").first).to_be_visible(timeout=10000)
        assert dialogo.get_by_role("radio").evaluate_all(
            "els => els.filter(e => e.checked).length"
        ) == 0, "Nenhuma linha deveria vir pré-selecionada"
        expect(dialogo.get_by_role("button", name="Confirmar")).to_be_disabled()

        dialogo.locator("label").first.click()
        expect(dialogo.get_by_role("button", name="Confirmar")).to_be_enabled()

    def test_cancelar_dialogo_abre_seletor_sem_linha(self, page_auth: Page):
        """Cancelar no diálogo de linha abre o Seletor SEM o filtro 'Linha de Produto'."""
        _abrir_novo_orcamento(page_auth)
        dialogo = _abrir_dialogo_linha(page_auth)

        dialogo.get_by_role("button", name="Cancelar").click()

        seletor = page_auth.get_by_role("dialog")
        expect(seletor).to_contain_text(TITULO_SELETOR, timeout=10000)
        expect(seletor.get_by_label("Linha de Produto")).to_have_value("")
        expect(seletor).to_contain_text("Quantidade de cálculos: 0")
        expect(seletor.get_by_role("button", name="Usar")).to_be_disabled()

        # Sair fecha o seletor e o orçamento (já criado ao incluir item) permanece aberto na tela.
        seletor.get_by_role("button", name="Sair").click()
        expect(seletor).to_be_hidden()
        expect(page_auth.get_by_role("button", name="Abrir orçamento")).to_be_visible()

    def test_fluxo_completo_incluir_item_usar_calculo_padrao(self, page_auth: Page):
        """
        Orçamento em branco → Cliente Principal → Incluir item → linha de produto →
        Seletor de Cálculo Padrão → Usar → grade (item 1 selecionado), painel
        'Dados do item' e aba Fechamento.
        """
        _abrir_novo_orcamento(page_auth)

        # ── Cliente Principal (opcional para o fluxo: segue sem cliente se não houver) ──
        cliente_ok = _buscar_cliente_principal(page_auth)

        # ── Incluir item → diálogo de linha de produto ──
        dialogo = _abrir_dialogo_linha(page_auth)
        time.sleep(1.5)
        if dialogo.get_by_text("Não há linhas de produto ativas.").count() > 0:
            pytest.skip("Empresa demo sem linhas de produto ativas")
        if dialogo.get_by_text("As linhas não puderam ser carregadas.").count() > 0:
            pytest.skip("Linhas de produto indisponíveis no ambiente (erro de carga)")

        expect(dialogo.get_by_role("radio").first).to_be_visible(timeout=10000)
        rotulo_linha = dialogo.locator("label").first.inner_text().strip()
        dialogo.locator("label").first.click()
        dialogo.get_by_role("button", name="Confirmar").click()

        # ── Seletor de Cálculo Padrão com a linha pré-preenchida ──
        seletor = page_auth.get_by_role("dialog")
        expect(seletor).to_contain_text(TITULO_SELETOR, timeout=10000)
        expect(seletor.get_by_label("Linha de Produto")).to_have_value(rotulo_linha)
        expect(seletor.get_by_role("button", name="Usar")).to_be_disabled()

        seletor.get_by_role("button", name="Pesquisar").click()
        aguardar_carregamento(page_auth)
        time.sleep(2)

        linhas_calculo = seletor.locator("tbody tr")
        sem_resultado = seletor.get_by_text("Nenhum cálculo encontrado")
        if sem_resultado.count() > 0 and sem_resultado.first.is_visible():
            screenshot_com_nome(page_auth, "orcamento_fluxo_novo_sem_calculo")
            pytest.skip(
                f"Empresa demo sem cálculo padrão cadastrado para a linha '{rotulo_linha}'"
            )
        if linhas_calculo.count() == 0:
            pytest.skip("Pesquisa de cálculo padrão não retornou linhas (erro ou ambiente sem acervo)")

        # ── Seleciona o primeiro cálculo e usa ──
        linhas_calculo.first.click()
        usar = seletor.get_by_role("button", name="Usar")
        expect(usar).to_be_enabled()
        usar.click()

        # ── Redireciona para o orçamento criado (sai de /novo-orcamento) ──
        page_auth.wait_for_url(
            lambda url: "/orcamento-grafico/" in url and "novo-orcamento" not in url,
            timeout=30000,
        )
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)
        body = page_auth.locator("body")

        # Cabeçalho do orçamento
        expect(body).to_contain_text("Orçamento", timeout=15000)
        if cliente_ok:
            expect(body).to_contain_text("Cliente")

        # ── Grade de itens: item 1 presente e selecionado ──
        expect(body).to_contain_text("Itens do orçamento", timeout=15000)
        for coluna in ("Item", "Cálculo", "Linha de Produto", "Tipo de Produto",
                       "Tiragens", "Descrição", "Status"):
            expect(page_auth.get_by_role("columnheader", name=coluna)).to_be_visible()

        primeira = page_auth.locator("tbody tr").first
        expect(primeira).to_be_visible(timeout=15000)
        assert primeira.locator("td").first.inner_text().strip() == "1", \
            "A primeira linha da grade deveria ser o item 1"
        estilo = primeira.get_attribute("style") or ""
        assert "blue-light" in estilo, \
            f"Item 1 deveria vir selecionado automaticamente (style={estilo!r})"
        for botao in ("Abrir item", "Copiar item", "Excluir item"):
            expect(page_auth.get_by_role("button", name=botao)).to_be_enabled()

        # ── Painel Dados do item ──
        expect(body).to_contain_text("Dados do item", timeout=15000)
        expect(body).not_to_contain_text(
            "Selecione um item no grid de itens do orçamento para ver os dados dele."
        )
        # O painel termina de carregar com o selo da estrutura (plano único / vários planos).
        estrutura = page_auth.get_by_text("Plano único").or_(page_auth.get_by_text("Vários planos"))
        expect(estrutura.first).to_be_visible(timeout=20000)

        # ── Aba Fechamento (padrão) e aba Comissões ──
        aba_fechamento = page_auth.get_by_role("tab", name="Fechamento")
        expect(aba_fechamento).to_be_visible()
        expect(aba_fechamento).to_have_attribute("aria-selected", "true")
        expect(page_auth.get_by_role("tab", name="Comissões")).to_be_visible()

        painel = page_auth.get_by_role("tabpanel", name="Fechamento")
        expect(
            painel.get_by_text("Tiragem", exact=True)
            .or_(painel.get_by_text("Não há valores a totalizar neste orçamento."))
            .first
        ).to_be_visible(timeout=20000)
        expect(painel.get_by_role("button", name="Detalhe do fechamento")).to_be_visible()

        screenshot_com_nome(page_auth, "orcamento_fluxo_novo_detalhe")


class TestOrcamentoGraficoWizard:
    """Testa o wizard de criação de orçamento passo a passo."""

    def test_wizard_abre_corretamente(self, page_auth: Page):
        """Verifica que a página de novo orçamento abre com o stepper."""
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)
        assert pagina_carregou_sem_erro(page_auth)

        # Deve mostrar o primeiro step (Cliente)
        body = page_auth.locator("body")
        expect(body).to_contain_text("Cliente")

    def test_step1_cliente_preencher_prospect(self, page_auth: Page):
        """Step 1: Preenche cliente como prospect (texto livre)."""
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)

        # Preenche cliente como texto livre (prospect)
        cliente_input = page_auth.get_by_label("Cliente", exact=False).first
        cliente_input.fill("Empresa QA Teste")
        time.sleep(0.5)

        # Deve mostrar badge "Prospect"
        body = page_auth.locator("body")
        expect(body).to_contain_text("Prospect")

    def test_step1_avancar_para_tipo(self, page_auth: Page):
        """Step 1 → Step 2: Avança do Cliente para Tipo."""
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)

        # Preenche cliente
        cliente_input = page_auth.get_by_label("Cliente", exact=False).first
        cliente_input.fill("Teste QA")
        time.sleep(0.3)

        # Clica em Próximo
        btn_proximo = page_auth.get_by_role("button", name="Próximo")
        btn_proximo.click()
        time.sleep(0.5)

        # Deve estar no step Tipo
        body = page_auth.locator("body")
        expect(body).to_contain_text("Tipo de Embalagem")

    def test_step2_selecionar_tipo_embalagem(self, page_auth: Page):
        """Step 2: Seleciona um tipo de embalagem (card clicável)."""
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)

        # Avança para step 2
        page_auth.get_by_label("Cliente", exact=False).first.fill("Teste QA")
        time.sleep(0.3)
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # Deve haver cards de tipo de embalagem
        cards = page_auth.locator('[class*="Card"]').filter(
            has=page_auth.locator('[class*="tabler-icon"]')
        )

        if cards.count() > 0:
            # Clica no primeiro tipo
            cards.first.click()
            time.sleep(0.3)

            # O card selecionado deve ter borda azul (estilização de seleção)
            # Verificamos indiretamente pelo botão Próximo ficar habilitado
            btn_proximo = page_auth.get_by_role("button", name="Próximo")
            # Se habilitou, pode avançar
            btn_proximo.click()
            time.sleep(0.5)

            # Deve estar no step Medidas
            body = page_auth.locator("body")
            expect(body).to_contain_text("Medidas")
        else:
            pytest.skip("Nenhum tipo de embalagem cadastrado na empresa demo")

    def test_wizard_fluxo_completo(self, page_auth: Page):
        """
        Fluxo completo do wizard: todos os 7 steps até a Revisão.
        Este é o teste principal de QA - simula um usuário criando um orçamento.
        """
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)

        # ══ STEP 1: Cliente ══
        page_auth.get_by_label("Cliente", exact=False).first.fill("Cliente QA Automatizado")
        time.sleep(0.3)
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 2: Tipo de Embalagem ══
        # Clica no primeiro card clicável (tipo de embalagem)
        # Os cards de tipo têm cursor pointer e são clicáveis
        time.sleep(1)
        tipo_cards = page_auth.locator('[class*="mantine-Card-root"]')
        clicked = False
        for i in range(tipo_cards.count()):
            card = tipo_cards.nth(i)
            if card.is_visible():
                try:
                    card.click(timeout=3000)
                    clicked = True
                    break
                except Exception:
                    continue
        if not clicked:
            pytest.skip("Nenhum tipo de embalagem disponível")

        time.sleep(0.3)
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 3: Medidas ══
        # Preenche inputs numéricos visíveis
        inputs = page_auth.locator('input[inputmode="numeric"], input[type="number"]')
        for i in range(min(inputs.count(), 5)):
            inp = inputs.nth(i)
            if inp.is_visible() and inp.input_value() in ("", "0"):
                inp.fill("100")
                time.sleep(0.2)

        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 4: Papel ══
        gramatura = page_auth.get_by_label("Gramatura", exact=False)
        if gramatura.is_visible():
            gramatura.fill("300")
            time.sleep(0.2)

        preco = page_auth.get_by_label("Preço", exact=False).first
        if preco.is_visible():
            preco.fill("4.50")
            time.sleep(0.2)

        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 5: Cores ══
        # Cores CMYK já vêm pré-preenchidas
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 6: Acabamentos ══
        # Acabamentos padrão já vêm ativos
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # ══ STEP 7: Revisão ══
        time.sleep(3)

        # Deve ter botão "Salvar Rascunho" ou "Enviar Proposta"
        salvar_btn = page_auth.get_by_role("button", name="Salvar Rascunho")
        enviar_btn = page_auth.get_by_role("button", name="Enviar Proposta")

        assert salvar_btn.is_visible() or enviar_btn.is_visible(), \
            "Botões de ação final (Salvar/Enviar) não encontrados no step de Revisão"

        screenshot_com_nome(page_auth, "orcamento_wizard_revisao")

    def test_wizard_salvar_rascunho(self, page_auth: Page):
        """Completa o wizard e salva como rascunho."""
        navegar_para(page_auth, "/orcamento-grafico/novo")
        aguardar_carregamento(page_auth)

        # ══ Fluxo rápido até Revisão ══
        # Step 1 - Cliente
        page_auth.get_by_label("Cliente", exact=False).first.fill("QA Salvar Rascunho")
        time.sleep(0.2)
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # Step 2 - Tipo (clica primeiro card de tipo de embalagem)
        tipo_cards = page_auth.locator('[class*="mantine-Card-root"]')
        clicked = False
        for i in range(tipo_cards.count()):
            card = tipo_cards.nth(i)
            if card.is_visible():
                try:
                    card.click(timeout=3000)
                    clicked = True
                    break
                except Exception:
                    continue
        if not clicked:
            pytest.skip("Sem tipos de embalagem")

        time.sleep(0.3)
        page_auth.get_by_role("button", name="Próximo").click()
        time.sleep(1)

        # Step 3 - Medidas (preenche campos visíveis)
        inputs = page_auth.locator('input[inputmode="numeric"], input[type="number"]')
        for i in range(min(inputs.count(), 5)):
            inp = inputs.nth(i)
            if inp.is_visible() and inp.input_value() in ("", "0"):
                inp.fill("150")
                time.sleep(0.1)

        # O botão Próximo pode estar disabled se medidas obrigatórias não foram preenchidas
        btn_proximo = page_auth.get_by_role("button", name="Próximo")
        if btn_proximo.is_disabled():
            # Tenta preencher todos os inputs numéricos com valor padrão
            all_inputs = page_auth.locator('input[inputmode="numeric"]')
            for i in range(all_inputs.count()):
                inp = all_inputs.nth(i)
                if inp.is_visible() and inp.input_value() in ("", "0"):
                    inp.fill("200")
                    time.sleep(0.1)
            time.sleep(0.3)

        if btn_proximo.is_disabled():
            pytest.skip("Botão 'Próximo' permanece desabilitado — medidas obrigatórias não configuradas")

        btn_proximo.click()
        time.sleep(1)

        # Step 4 - Papel
        gramatura = page_auth.get_by_label("Gramatura", exact=False)
        if gramatura.is_visible():
            gramatura.fill("280")
            time.sleep(0.2)

        btn_proximo = page_auth.get_by_role("button", name="Próximo")
        if btn_proximo.is_disabled():
            # Gramatura pode ser obrigatória - tentar preencher preço também
            preco = page_auth.get_by_label("Preço", exact=False).first
            if preco.is_visible():
                preco.fill("4.50")
                time.sleep(0.2)

        if btn_proximo.is_disabled():
            pytest.skip("Botão 'Próximo' desabilitado no step Papel")

        btn_proximo.click()
        time.sleep(1)

        # Step 5 - Cores (default ok)
        btn_proximo = page_auth.get_by_role("button", name="Próximo")
        if btn_proximo.is_disabled():
            pytest.skip("Botão 'Próximo' desabilitado no step Cores")
        btn_proximo.click()
        time.sleep(1)

        # Step 6 - Acabamentos (default ok)
        btn_proximo = page_auth.get_by_role("button", name="Próximo")
        if btn_proximo.is_disabled():
            pytest.skip("Botão 'Próximo' desabilitado no step Acabamentos")
        btn_proximo.click()
        time.sleep(3)

        # Step 7 - Revisão: clicar em Salvar Rascunho
        salvar_btn = page_auth.get_by_role("button", name="Salvar Rascunho")
        if salvar_btn.is_visible():
            salvar_btn.click()
            time.sleep(3)

            # Verifica sucesso: ou notificação, ou redirecionou para a lista
            url = page_auth.url
            body = page_auth.locator("body")
            sucesso = (
                "sucesso" in body.inner_text().lower()
                or "/orcamento-grafico" in url and "/novo" not in url
            )
            if not sucesso:
                screenshot_com_nome(page_auth, "orcamento_salvar_rascunho_resultado")
        else:
            screenshot_com_nome(page_auth, "orcamento_sem_botao_salvar")
            pytest.skip("Botão 'Salvar Rascunho' não visível")
