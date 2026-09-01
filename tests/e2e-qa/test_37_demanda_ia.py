"""
TEST SUITE 37 — Demanda / IA (módulo /demanda)
===============================================
Valida previsão, curva ABC, slotting e produtos críticos: estrutura,
degradação graciosa e isolamento (Requirements 6, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestDemandaIa:
    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """6.1 — dashboard, abc, previsoes, slotting, produtos-criticos, config → 200."""
        checks = [
            ("/demanda/dashboard", wms_api.demanda_dashboard()),
            ("/demanda/abc", wms_api.demanda_abc()),
            ("/demanda/previsoes", wms_api.demanda_previsoes()),
            ("/demanda/slotting/sugestoes", wms_api.demanda_slotting()),
            ("/demanda/produtos-criticos", wms_api._get("/demanda/produtos-criticos")),
            ("/demanda/config", wms_api.demanda_config()),
        ]
        for path, r in checks:
            assert r.status == 200, f"GET {path} 200 esperado ({r.status}: {r.text()})"

    def test_degradacao_graciosa_sem_historico(self, wms_api: WmsApiClient):
        """6.4 — sem histórico/worker, previsões e sugestões vêm vazias sem erro."""
        prev = wms_api.demanda_previsoes()
        assert prev.status == 200
        slot = wms_api.demanda_slotting()
        assert slot.status == 200
        # Ambos degradam para lista (possivelmente vazia), nunca 5xx.
        assert isinstance(wms_api._lista_do_corpo(prev.json()), list)
        assert isinstance(wms_api._lista_do_corpo(slot.json()), list)

    def test_isolamento_abc_por_empresa(self, wms_api: WmsApiClient):
        """6.2/6.3/11 — curva ABC responde por empresa (a 2a empresa é independente)."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/demanda/abc", token2, params={"criterio": "VALOR"})
        assert r2.status == 200, f"ABC da 2a empresa deveria responder 200 ({r2.status})"
        # Se os itens expõem empresaId, todos devem ser da 2a empresa.
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"curva ABC da 2a empresa retornou empresaId de terceiros: {ids_emp}"
        )
