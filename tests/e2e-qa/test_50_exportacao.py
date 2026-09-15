"""
TEST SUITE 50 — Exportação Contábil (Fase D5)
=============================================
Valida a exportação da contabilidade:
- geração do SPED Contábil (ECD) para um período (200 + nome de arquivo);
- exportação CSV do balancete (200, começa com o cabeçalho esperado);
- exportação CSV do diário (200, cabeçalho esperado);
- isolamento (a exportação usa apenas a empresa da sessão).

Roda 100% por API. A ECD usa a contabilidade real (D4) quando existe, senão o
fallback fiscal — em ambos os casos deve gerar arquivo válido.
"""
import time
from datetime import datetime, timezone
import pytest

from wms_api import WmsApiClient


class TestGeracaoECD:
    def test_gera_ecd_do_periodo(self, wms_api: WmsApiClient):
        empresa_id = wms_api.empresa_id_sessao()
        assert empresa_id, "não foi possível resolver a empresa da sessão"
        agora = datetime.now(timezone.utc)
        r = wms_api.gerar_ecd(empresa_id, agora.year, agora.month)
        assert r.status in (200, 201), f"gerar ECD ({r.status}: {r.text()})"
        body = r.json()
        assert body.get("tipo") == "ECD"
        assert body.get("nomeArquivo", "").startswith("ECD_")
        assert body.get("valido") is True


class TestExportacaoCSV:
    def test_balancete_csv_tem_cabecalho(self, wms_api: WmsApiClient):
        r = wms_api.exportar_balancete_csv()
        assert r.status == 200, f"balancete csv ({r.status})"
        texto = r.text()
        assert texto.startswith("Codigo;Conta;Debito;Credito;Saldo"), f"cabeçalho inesperado: {texto[:60]}"

    def test_diario_csv_tem_cabecalho(self, wms_api: WmsApiClient):
        r = wms_api.exportar_diario_csv()
        assert r.status == 200, f"diario csv ({r.status})"
        texto = r.text()
        assert texto.startswith("Data;Historico;Conta;Tipo;Valor"), f"cabeçalho inesperado: {texto[:60]}"


class TestIsolamentoExportacao:
    def test_balancete_usa_apenas_empresa_da_sessao(self, wms_api: WmsApiClient):
        # a rota é autenticada e filtra por empresaId da sessão; garantimos 200
        # e que não vaza erro. O conteúdo por empresa é validado no test_48.
        r = wms_api.exportar_balancete_csv()
        assert r.status == 200
