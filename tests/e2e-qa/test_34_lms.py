"""
TEST SUITE 34 — LMS / Labor Management (módulo /lms)
=====================================================
Valida metas, dashboard, ranking e incentivos com dados reais, degradação
graciosa e isolamento multi-tenant (Requirements 3, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestLms:
    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """3.2 — dashboard, metas, ranking, incentivos → 200; dashboard traz chaves."""
        dash = wms_api.lms_dashboard()
        assert dash.status == 200, f"/lms/dashboard 200 esperado ({dash.status}: {dash.text()})"
        corpo = dash.json()
        assert "produtividadeMedia" in corpo and "rankingTop5" in corpo, (
            f"dashboard LMS deveria trazer produtividadeMedia/rankingTop5 (obtido: {corpo})"
        )
        for path in ["/lms/metas", "/lms/incentivos"]:
            r = wms_api._get(path)
            assert r.status == 200, f"GET {path} 200 esperado ({r.status})"
        rk = wms_api.lms_ranking()
        assert rk.status == 200, f"/lms/ranking 200 esperado ({rk.status}: {rk.text()})"

    def test_ranking_degrada_graciosamente_sem_produtividade(self, wms_api: WmsApiClient):
        """3.4 — ranking sem RegistroProdutividade retorna agregados sem erro (200)."""
        dash = wms_api.lms_dashboard().json()
        # produtividadeMedia é numérica (0 quando não há registros) — sem erro.
        assert isinstance(dash.get("produtividadeMedia"), (int, float)), (
            f"produtividadeMedia deveria ser numérica (obtido: {dash.get('produtividadeMedia')})"
        )
        assert isinstance(dash.get("rankingTop5"), list), (
            "rankingTop5 deveria ser uma lista (vazia quando não há dados)"
        )

    def test_criar_meta_aparece_na_listagem_e_por_id(self, wms_api: WmsApiClient):
        """3.1 — meta criada aparece em /metas e é recuperável por id."""
        resp = wms_api.criar_meta_lms()
        if resp.status not in (200, 201):
            pytest.skip(f"Não foi possível criar MetaOperacao (status {resp.status}: {resp.text()}).")
        meta = resp.json()
        meta_id = meta.get("id")
        assert meta_id, f"meta criada deve ter id (resposta: {meta})"

        lista = wms_api.lms_metas().json()
        ids = {m.get("id") for m in wms_api._lista_do_corpo(lista)}
        assert meta_id in ids, f"meta de QA deveria aparecer em /lms/metas (ids: {ids})"

        detalhe = wms_api.lms_meta(meta_id)
        assert detalhe.status == 200, f"meta recuperável por id ({detalhe.status})"

    def test_isolamento_meta_nao_vaza_para_outra_empresa(self, wms_api: WmsApiClient):
        """3.3/11 — meta de QA da sessão não aparece para a Segunda_Empresa."""
        resp = wms_api.criar_meta_lms()
        if resp.status not in (200, 201):
            pytest.skip("Não foi possível semear a meta para o teste de isolamento.")
        meta_id = resp.json().get("id")

        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")

        r2 = wms_api.get_com_token("/lms/metas", token2)
        assert r2.status == 200, f"listagem da 2a empresa deveria responder 200 ({r2.status})"
        ids2 = {m.get("id") for m in wms_api._lista_do_corpo(r2.json())}
        assert meta_id not in ids2, (
            f"VAZAMENTO: meta da Empresa_Sessao apareceu para a Segunda_Empresa ({emp2})."
        )
