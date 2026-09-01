"""
TEST SUITE 39 — Wave Planning (módulo /wave)
=============================================
Valida o Wave Planning com dados reais:
  - Estrutura: /dashboard, /regras, /planejamentos, /painel respondem 200.
  - Seed + valor: cria uma RegraOnda de QA e confirma que aparece na listagem.
  - Isolamento multi-tenant: a regra de QA da Empresa_Sessao NÃO aparece para
    uma Segunda_Empresa (Requirement 8, 11).

Todos os endpoints do módulo aplicam authenticate + moduloGuard('WMS') e
filtram por empresaId. Padrão da suíte: skip honesto no seed; nunca assert
falso.
"""
import pytest

from wms_api import WmsApiClient


class TestWavePlanning:
    """Wave Planning — estrutura, seed e isolamento."""

    def test_estrutura_endpoints_respondem_200(self, wms_api: WmsApiClient):
        """8.2 — dashboard, regras, planejamentos e painel respondem 200."""
        for nome, resp in [
            ("dashboard", wms_api.wave_dashboard()),
            ("regras", wms_api.wave_regras()),
            ("planejamentos", wms_api.wave_planejamentos()),
            ("painel", wms_api._get("/wave/painel")),
        ]:
            assert resp.status == 200, (
                f"GET /wave/{nome} deveria responder 200 "
                f"(status {resp.status}: {resp.text()})"
            )

    def test_criar_regra_onda_aparece_na_listagem(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """8.1 — regra de onda criada aparece na listagem da mesma empresa."""
        resp = wms_api.criar_regra_onda(run_id)
        if resp.status not in (200, 201):
            pytest.skip(
                "Não foi possível criar RegraOnda de QA "
                f"(status {resp.status}: {resp.text()}) — pré-requisito de ambiente."
            )
        regra = resp.json()
        regra_id = regra.get("id")
        assert regra_id, f"regra criada deve ter id (resposta: {regra})"

        lista = wms_api.wave_regras().json()
        ids = {r.get("id") for r in wms_api._lista_do_corpo(lista)}
        assert regra_id in ids, (
            "a RegraOnda de QA recém-criada deveria aparecer em GET /wave/regras "
            f"(ids retornados: {ids})"
        )

    def test_isolamento_regra_nao_vaza_para_outra_empresa(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """8.3/11 — a regra de QA da sessão não aparece para a Segunda_Empresa."""
        resp = wms_api.criar_regra_onda(run_id)
        if resp.status not in (200, 201):
            pytest.skip("Não foi possível semear a regra para o teste de isolamento.")
        regra_id = resp.json().get("id")

        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip(
                "Usuário tem apenas uma empresa — isolamento multi-tenant não "
                "é testável neste ambiente."
            )

        r2 = wms_api.get_com_token("/wave/regras", token2, params={"limit": 100})
        assert r2.status == 200, f"listagem com a 2a empresa deveria responder 200 ({r2.status})"
        ids2 = {r.get("id") for r in wms_api._lista_do_corpo(r2.json())}
        assert regra_id not in ids2, (
            "VAZAMENTO multi-tenant: a RegraOnda criada na Empresa_Sessao "
            f"apareceu na listagem da Segunda_Empresa ({emp2})."
        )
        # Reforço: todo empresaId retornado para a 2a empresa é dela (se exposto).
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"listagem da 2a empresa retornou empresaId de terceiros: {ids_emp}"
        )
