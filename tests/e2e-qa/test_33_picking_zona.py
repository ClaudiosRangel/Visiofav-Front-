"""
TEST SUITE 33 — Picking Zona (módulo /picking-zona)
====================================================
Valida zonas de picking com dados reais: estrutura, seed de ZonaPicking e
isolamento multi-tenant (Requirements 2, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestPickingZona:
    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """2.2 — zonas, separadores, pontos-consolidacao, sub-ondas, painel → 200."""
        for path in [
            "/picking-zona/zonas",
            "/picking-zona/separadores",
            "/picking-zona/pontos-consolidacao",
            "/picking-zona/sub-ondas",
            "/picking-zona/painel",
        ]:
            resp = wms_api._get(path, params={"limit": 50} if "sub-ondas" in path or "zonas" in path else None)
            assert resp.status == 200, (
                f"GET {path} deveria responder 200 (status {resp.status}: {resp.text()})"
            )

    def test_criar_zona_aparece_na_listagem_e_por_id(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """2.1 — zona criada aparece em /zonas e é recuperável por id."""
        resp = wms_api.criar_zona_picking(run_id)
        if resp.status not in (200, 201):
            pytest.skip(
                f"Não foi possível criar ZonaPicking de QA (status {resp.status}: "
                f"{resp.text()})."
            )
        zona = resp.json()
        zona_id = zona.get("id")
        assert zona_id, f"zona criada deve ter id (resposta: {zona})"

        lista = wms_api.pz_zonas().json()
        ids = {z.get("id") for z in wms_api._lista_do_corpo(lista)}
        assert zona_id in ids, (
            f"a zona de QA deveria aparecer em GET /picking-zona/zonas (ids: {ids})"
        )

        detalhe = wms_api.pz_zona(zona_id)
        assert detalhe.status == 200, (
            f"a zona deveria ser recuperável por id (status {detalhe.status})"
        )

    def test_isolamento_zona_nao_vaza_para_outra_empresa(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """2.3/11 — zona de QA da sessão não aparece para a Segunda_Empresa."""
        resp = wms_api.criar_zona_picking(run_id)
        if resp.status not in (200, 201):
            pytest.skip("Não foi possível semear a zona para o teste de isolamento.")
        zona_id = resp.json().get("id")

        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")

        r2 = wms_api.get_com_token("/picking-zona/zonas", token2, params={"limit": 100})
        assert r2.status == 200, f"listagem da 2a empresa deveria responder 200 ({r2.status})"
        ids2 = {z.get("id") for z in wms_api._lista_do_corpo(r2.json())}
        assert zona_id not in ids2, (
            f"VAZAMENTO: zona da Empresa_Sessao apareceu para a Segunda_Empresa ({emp2})."
        )
