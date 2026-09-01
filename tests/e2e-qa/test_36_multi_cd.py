"""
TEST SUITE 36 — Multi-CD (módulo /multi-cd)
============================================
Valida painel, solicitações e trânsito de transferências entre centros, mais
isolamento (Requirements 5, 11). A criação de SolicitacaoTransferencia exige
2 CDs distintos + produto; quando o ambiente não tem 2 CDs, o seed faz skip.
"""
import pytest

from wms_api import WmsApiClient


class TestMultiCd:
    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """5.1 — painel, solicitacoes e transito → 200."""
        assert wms_api.multicd_painel().status == 200, "GET /multi-cd/painel deveria responder 200"
        assert wms_api.multicd_solicitacoes().status == 200, "GET /multi-cd/solicitacoes deveria responder 200"
        assert wms_api.multicd_transito().status == 200, "GET /multi-cd/transito deveria responder 200"

    def test_isolamento_solicitacoes_por_empresa(self, wms_api: WmsApiClient):
        """5.3/11 — solicitações respondem por empresa (a 2a empresa é independente)."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/multi-cd/solicitacoes", token2, params={"limit": 100})
        assert r2.status == 200, f"solicitações da 2a empresa deveriam responder 200 ({r2.status})"
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"solicitações da 2a empresa retornaram empresaId de terceiros: {ids_emp}"
        )
