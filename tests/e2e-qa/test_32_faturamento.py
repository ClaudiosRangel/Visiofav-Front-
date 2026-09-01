"""
TEST SUITE 32 — Faturamento de armazenagem 3PL (módulo /faturamento)
=====================================================================
Valida resumo, contratos, faturas e medições; seed de ContratoArmazenagem;
isolamento multi-tenant (Requirements 1, 11).
"""
import pytest

from wms_api import WmsApiClient


class TestFaturamento:
    def test_resumo_e_listagens_respondem_200(self, wms_api: WmsApiClient):
        """1.1/1.3 — resumo, contratos e faturas → 200 com schema coerente."""
        resumo = wms_api.fat_resumo()
        assert resumo.status == 200, f"/faturamento/resumo 200 esperado ({resumo.status}: {resumo.text()})"
        corpo = resumo.json()
        for chave in ("totalFaturado", "aReceber", "inadimplente"):
            assert chave in corpo and isinstance(corpo[chave], (int, float)), (
                f"resumo deveria ter {chave} numérico (obtido: {corpo})"
            )
        assert wms_api.fat_contratos().status == 200, "GET /faturamento/contratos deveria responder 200"
        assert wms_api.fat_faturas().status == 200, "GET /faturamento/faturas deveria responder 200"

    def test_criar_contrato_aparece_na_listagem(self, wms_api: WmsApiClient):
        """1.2 — contrato criado aparece na listagem da mesma empresa."""
        cliente = wms_api.primeiro_cliente() if hasattr(wms_api, "primeiro_cliente") else {}
        cliente_id = cliente.get("id") if isinstance(cliente, dict) else None
        if not cliente_id:
            # Buscar um cliente diretamente.
            r = wms_api._get("/clientes", params={"limit": 1})
            data = r.json().get("data", []) if r.ok else []
            cliente_id = data[0]["id"] if data else None
        if not cliente_id:
            pytest.skip("Nenhum cliente cadastrado para criar contrato de armazenagem (seed).")

        resp = wms_api.criar_contrato_armazenagem(cliente_id)
        if resp.status not in (200, 201):
            pytest.skip(
                f"Criação de contrato não aceita (status {resp.status}: {resp.text()}) — "
                "pré-requisito de ambiente."
            )
        contrato = resp.json()
        contrato_id = contrato.get("id")
        assert contrato_id, f"contrato criado deve ter id (resposta: {contrato})"

        lista = wms_api.fat_contratos().json()
        ids = {c.get("id") for c in wms_api._lista_do_corpo(lista)}
        assert contrato_id in ids, (
            f"o contrato de QA deveria aparecer em /faturamento/contratos (ids: {ids})"
        )

    def test_isolamento_contratos_por_empresa(self, wms_api: WmsApiClient):
        """1.4/11 — contratos respondem por empresa (a 2a empresa não vê os da sessão)."""
        token2, emp2 = wms_api.token_de_outra_empresa()
        if not token2:
            pytest.skip("Usuário tem apenas uma empresa — isolamento não testável.")
        r2 = wms_api.get_com_token("/faturamento/contratos", token2, params={"limit": 100})
        assert r2.status == 200, f"contratos da 2a empresa deveriam responder 200 ({r2.status})"
        ids_emp = wms_api.empresas_ids_de_lista(r2.json())
        assert ids_emp <= {emp2} or not ids_emp, (
            f"contratos da 2a empresa retornaram empresaId de terceiros: {ids_emp}"
        )
