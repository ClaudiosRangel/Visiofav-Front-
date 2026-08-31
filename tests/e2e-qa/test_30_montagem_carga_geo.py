"""
TEST SUITE 30 — Montagem de Carga (Mapa) + Geocodificação e Otimização de Rota
==============================================================================
Cobre duas áreas do WMS integrado ao ERP Vizor que até então não tinham QA:

  A) GEOCODIFICAÇÃO de clientes (módulo ``geolocalizacao``):
     - Geocodificar um cliente com endereço válido persiste lat/lng plausíveis.
     - Cliente sem endereço → erro claro (não quebra).
     - Distância empresa→cliente é calculada sobre a coordenada geocodificada.

  B) MONTAGEM DE CARGA (módulo ``mapa-carregamento``):
     - NFs disponíveis por rota aparecem para montagem.
     - Totalização agrupa por rota e distingue clientes geocodificados dos não
       geocodificados.
     - Geração do mapa a partir das NFs marcadas.
     - Otimização da sequência de entrega (nearest-neighbor): clientes
       geocodificados entram na sequência; clientes SEM geolocalização caem ao
       final (lista ``clientesSemGeolocalizacao``).
     - Ciclo de status do mapa: AGUARDANDO_SEPARACAO → EM_CARREGAMENTO →
       FINALIZADO (via fechar).

── HABILITADOR SEM NF-e REAL (decisão registrada) ────────────────────────────
A montagem de carga parte de NFs (``DocumentoFiscal`` tipo NFE ligado a
``VendaEfetivada→PedidoVenda``), estado que em produção só nasce por emissão de
NF-e à SEFAZ — inviável numa suíte de QA. Por isso usamos a rota de seed
restrita ``POST /api/qa-seed/nfe-para-mapa`` (protegida por JWT + perfil
ADMIN/SUPER_ADMIN + header ``x-qa-seed-key``), que cria a cadeia fiscal fake
sem SEFAZ, com o cliente podendo ter coordenadas e rota. Assim exercitamos a
montagem de carga DE VERDADE, ponta a ponta.

A geocodificação usa a API pública Nominatim (OpenStreetMap). Quando o serviço
externo estiver indisponível (timeout/5xx), o backend responde 503 e o teste
de geo faz ``pytest.skip`` do pré-requisito externo — nunca um assert falso.

Limpeza best-effort: mapas de QA são cancelados e clientes/NFs de QA ficam
rastreáveis (docs ``QANFE...``, rota ``QA-MAPA``). Nenhuma falha de limpeza
derruba o teste.
"""

import time

import pytest

from playwright.sync_api import Page

from wms_api import WmsApiClient
from helpers import screenshot_com_nome


TOLERANCIA = 0.001

# Faixa aproximada do Brasil para validar que a coordenada geocodificada é
# plausível (não um valor lixo). Brasil ~ lat [-34, 6], lng [-74, -34].
BR_LAT = (-34.0, 6.0)
BR_LNG = (-74.0, -34.0)


def _num(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


class TestGeocodificacaoCliente:
    """Geocodificação de clientes e distância (módulo geolocalizacao)."""

    def test_geocodificar_cliente_com_endereco_valido_persiste_coordenadas(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """Geocodificar um cliente com endereço válido grava lat/lng plausíveis.

        Cria um cliente com endereço real (Av. Paulista, São Paulo/SP) SEM
        coordenadas, chama a geocodificação e verifica que:
          - a resposta traz ``success=true`` com lat/lng dentro do Brasil;
          - as coordenadas ficam PERSISTIDAS no cliente.

        Se o serviço externo (Nominatim) estiver indisponível (503), faz
        ``pytest.skip`` do pré-requisito externo — nunca um assert falso.
        """
        cliente_id = None
        try:
            resp_cli = wms_api.criar_cliente(
                {
                    "razaoSocial": f"CLIENTE GEO QA {run_id}",
                    "cpfCnpj": f"GEO{run_id[-8:]}",
                    "logradouro": "Avenida Paulista",
                    "numero": "1578",
                    "cidade": "Sao Paulo",
                    "uf": "SP",
                    "cep": "01310-200",
                }
            )
            assert resp_cli.status in (200, 201), (
                f"seed: criação do cliente deveria ser aceita (status "
                f"{resp_cli.status}: {resp_cli.text()})"
            )
            cliente = resp_cli.json()
            cliente_id = cliente.get("id")
            assert cliente_id, "seed: cliente criado deve ter id"
            # O cadastro NÃO geocodifica sozinho — nasce sem coordenadas.
            assert cliente.get("latitude") in (None, "", 0, "0") or _num(
                cliente.get("latitude")
            ) == 0.0, "o cadastro de cliente não deve geocodificar automaticamente"

            resp_geo = wms_api.geocodificar_cliente(cliente_id)
            if resp_geo.status == 503:
                pytest.skip(
                    "Serviço externo de geocodificação (Nominatim) indisponível "
                    "no momento (503) — pré-requisito externo. Geocodificação é "
                    "um passo sob demanda; tentar novamente mais tarde."
                )
            assert resp_geo.status in (200, 201), (
                f"a geocodificação de um endereço válido deveria ser aceita "
                f"(status {resp_geo.status}: {resp_geo.text()})"
            )
            corpo = resp_geo.json()
            assert corpo.get("success") is True, (
                f"geocodificação deveria retornar success=true (obtido: {corpo})"
            )
            lat = _num(corpo.get("latitude"))
            lng = _num(corpo.get("longitude"))
            assert BR_LAT[0] <= lat <= BR_LAT[1], (
                f"latitude geocodificada fora do Brasil: {lat}"
            )
            assert BR_LNG[0] <= lng <= BR_LNG[1], (
                f"longitude geocodificada fora do Brasil: {lng}"
            )

            # PERSISTÊNCIA: relê o cliente e confere que as coordenadas ficaram.
            det = wms_api.obter_cliente(cliente_id, busca=f"CLIENTE GEO QA {run_id}")
            assert abs(_num(det.get("latitude")) - lat) <= TOLERANCIA, (
                "a latitude geocodificada deve ser persistida no cliente "
                f"(esperado {lat}, obtido {det.get('latitude')})"
            )
            assert abs(_num(det.get("longitude")) - lng) <= TOLERANCIA, (
                "a longitude geocodificada deve ser persistida no cliente "
                f"(esperado {lng}, obtido {det.get('longitude')})"
            )
        finally:
            if cliente_id:
                wms_api.excluir_cliente(cliente_id)

    def test_geocodificar_cliente_sem_endereco_retorna_erro_claro(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """Cliente sem endereço → geocodificação falha com mensagem clara (não quebra)."""
        cliente_id = None
        try:
            resp_cli = wms_api.criar_cliente(
                {
                    "razaoSocial": f"CLIENTE SEM ENDERECO QA {run_id}",
                    "cpfCnpj": f"SEM{run_id[-8:]}",
                }
            )
            assert resp_cli.status in (200, 201), (
                f"seed: criação do cliente deveria ser aceita ({resp_cli.text()})"
            )
            cliente_id = resp_cli.json().get("id")
            assert cliente_id, "seed: cliente criado deve ter id"

            resp_geo = wms_api.geocodificar_cliente(cliente_id)
            if resp_geo.status == 503:
                pytest.skip(
                    "Serviço externo de geocodificação indisponível (503) — "
                    "pré-requisito externo."
                )
            corpo = {}
            try:
                corpo = resp_geo.json() or {}
            except Exception:
                corpo = {}
            # O backend sinaliza a ausência de endereço com success=false (200)
            # OU um 4xx com mensagem — ambos são "erro claro, sem quebrar".
            houve_erro = (
                corpo.get("success") is False
                or (400 <= resp_geo.status < 500)
            )
            mensagem = (corpo.get("error") or corpo.get("message") or "")
            assert houve_erro, (
                "cliente sem endereço deveria falhar a geocodificação de forma "
                f"clara (status {resp_geo.status}, corpo {corpo})"
            )
            assert "endereço" in mensagem.lower() or "endereco" in mensagem.lower(), (
                "a mensagem de erro deveria mencionar a ausência de endereço "
                f"(obtido: {mensagem})"
            )
            # E o cliente continua SEM coordenadas.
            det = wms_api.obter_cliente(
                cliente_id, busca=f"CLIENTE SEM ENDERECO QA {run_id}"
            )
            assert _num(det.get("latitude")) == 0.0, (
                "cliente sem endereço não deveria ter latitude após falha"
            )
        finally:
            if cliente_id:
                wms_api.excluir_cliente(cliente_id)

    def test_distancia_empresa_cliente_usa_coordenada_geocodificada(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """Distância empresa→cliente é calculada sobre a coordenada geocodificada.

        Geocodifica um cliente e verifica que ``GET /geo/distancia/cliente/:id``
        retorna uma distância numérica >= 0. Se a empresa não tiver
        geolocalização configurada (422), faz ``pytest.skip`` do pré-requisito.
        """
        cliente_id = None
        try:
            resp_cli = wms_api.criar_cliente(
                {
                    "razaoSocial": f"CLIENTE DIST QA {run_id}",
                    "cpfCnpj": f"DIST{run_id[-7:]}",
                    "logradouro": "Rua da Consolacao",
                    "numero": "2000",
                    "cidade": "Sao Paulo",
                    "uf": "SP",
                    "cep": "01301-000",
                }
            )
            assert resp_cli.status in (200, 201)
            cliente_id = resp_cli.json().get("id")

            resp_geo = wms_api.geocodificar_cliente(cliente_id)
            if resp_geo.status == 503:
                pytest.skip("Serviço externo de geocodificação indisponível (503).")
            assert resp_geo.status in (200, 201), (
                f"geocodificação deveria ser aceita ({resp_geo.text()})"
            )

            resp_dist = wms_api.distancia_empresa_cliente(cliente_id)
            if resp_dist.status == 422:
                pytest.skip(
                    "Pré-requisito de ambiente: a empresa não tem geolocalização "
                    "configurada para calcular distâncias (Requirement — geo)."
                )
            assert resp_dist.status in (200, 201), (
                f"distância empresa→cliente deveria ser calculada "
                f"({resp_dist.status}: {resp_dist.text()})"
            )
            dist = _num(resp_dist.json().get("distanciaKm"))
            assert dist >= 0, f"distância deveria ser >= 0 (obtido {dist})"
        finally:
            if cliente_id:
                wms_api.excluir_cliente(cliente_id)


@pytest.mark.slow
class TestMontagemCarga:
    """Montagem de carga (mapa) ponta a ponta: NFs → mapa → otimização → fechar."""

    def _skip_se_seed_indisponivel(self, resp) -> None:
        if resp.status == 403:
            pytest.skip(
                "Rota de seed de QA não autorizada (perfil sem permissão ou "
                "chave inválida) — não é possível semear NFs para montagem de "
                "carga neste ambiente."
            )

    def test_montagem_carga_ponta_a_ponta_com_otimizacao_de_rota(
        self, wms_api: WmsApiClient, page_auth: "Page", run_id: str
    ):
        """Fluxo completo da montagem de carga, incluindo geo na otimização.

        Semeia (sem SEFAZ) 2 NFs na MESMA rota: uma com cliente geocodificado e
        outra com cliente SEM geolocalização. Então:
          1. as NFs aparecem em ``nfs-disponiveis`` da rota;
          2. marca as NFs → totalização por rota distingue geocodificado (1) de
             não geocodificado (1);
          3. gera o mapa (``podeOtimizar=true``, pois há cliente geocodificado);
          4. otimiza a rota → o geocodificado entra na sequência e o SEM
             geolocalização cai na lista ``clientesSemGeolocalizacao``;
          5. transição de status e fechar → mapa ``FINALIZADO``.
        """
        prod = wms_api.produto_com_saldo_endereco(minimo=1)
        produto_id = prod.get("produtoId")
        if not produto_id:
            # Qualquer produto serve para a NFE (a montagem não exige saldo).
            resp_prod = wms_api._get("/produtos", params={"limit": 1})
            data = resp_prod.json().get("data", []) if resp_prod.ok else []
            produto_id = data[0]["id"] if data else None
        if not produto_id:
            pytest.skip("Pré-requisito de ambiente: nenhum produto cadastrado.")

        # Rota de QA para agrupar as NFs.
        rota = wms_api.seed_rota_qa("QA-MAPA")
        rota_id = rota.get("id")
        if not rota_id:
            pytest.skip("Não foi possível criar/reaproveitar a rota de QA (seed).")

        mapa_id = None
        try:
            # ── Seed: 2 NFs na mesma rota (uma geo, uma sem geo) ──
            doc_base = f"QAMAPA{run_id[-6:]}"
            r1 = wms_api.seed_nfe_para_mapa(
                [{"produtoId": produto_id, "quantidade": 5}],
                rota_id=rota_id,
                latitude=-23.5505,
                longitude=-46.6333,
                cliente_doc=doc_base + "A",
            )
            self._skip_se_seed_indisponivel(r1)
            assert r1.status in (200, 201), (
                f"seed NFE 1 deveria ser aceito ({r1.status}: {r1.text()})"
            )
            nfe1 = r1.json().get("nfeId")

            r2 = wms_api.seed_nfe_para_mapa(
                [{"produtoId": produto_id, "quantidade": 3}],
                rota_id=rota_id,
                cliente_doc=doc_base + "B",  # sem lat/lng → sem geolocalização
            )
            assert r2.status in (200, 201), (
                f"seed NFE 2 deveria ser aceito ({r2.status}: {r2.text()})"
            )
            nfe2 = r2.json().get("nfeId")
            assert nfe1 and nfe2, "seed: ambas as NFs devem ter nfeId"

            # ── 1) NFs disponíveis na rota ──
            disp = wms_api.nfs_disponiveis_mapa(rota_id=rota_id)
            ids_disp = {n.get("nfeId") for n in disp.get("data", [])}
            assert nfe1 in ids_disp and nfe2 in ids_disp, (
                "as 2 NFs semeadas deveriam aparecer em nfs-disponiveis da rota "
                f"(disponíveis: {ids_disp})"
            )

            # ── 2) Marcar + totalização (distinção de geo) ──
            wms_api.marcar_nfs_mapa([nfe1, nfe2])
            tot = wms_api.totalizacao_mapa()
            geral = tot.get("geral", {})
            assert geral.get("quantidadeNfs", 0) >= 2, (
                f"totalização deveria contar as 2 NFs marcadas (geral={geral})"
            )
            assert geral.get("clientesGeocodificados", 0) >= 1, (
                "totalização deveria contar ao menos 1 cliente geocodificado "
                f"(geral={geral})"
            )
            assert geral.get("clientesNaoGeocodificados", 0) >= 1, (
                "totalização deveria contar ao menos 1 cliente NÃO geocodificado "
                f"(geral={geral})"
            )

            # ── 3) Gerar o mapa ──
            resp_mapa = wms_api.gerar_mapa(placa="QAM0001", rota_id=rota_id)
            assert resp_mapa.status in (200, 201), (
                f"geração do mapa deveria ser aceita ({resp_mapa.text()})"
            )
            mapa = resp_mapa.json()
            mapa_id = mapa.get("id")
            assert mapa_id, "mapa gerado deve ter id"
            assert mapa.get("status") == "AGUARDANDO_SEPARACAO", (
                f"mapa deveria nascer AGUARDANDO_SEPARACAO (obtido {mapa.get('status')})"
            )
            assert mapa.get("podeOtimizar") is True, (
                "com um cliente geocodificado, o mapa deveria poder ser otimizado"
            )

            # ── 4) Otimizar a rota (geo/nearest-neighbor) ──
            resp_ot = wms_api.otimizar_rota_mapa(mapa_id)
            if resp_ot.status == 422:
                pytest.skip(
                    "Pré-requisito de ambiente: empresa sem geolocalização "
                    "configurada para otimizar rotas (422)."
                )
            assert resp_ot.status in (200, 201), (
                f"otimização da rota deveria ser aceita ({resp_ot.text()})"
            )
            ot = resp_ot.json()
            # O geocodificado entra na sequência; o SEM geo cai ao final.
            assert len(ot.get("sequencia", [])) >= 1, (
                "a sequência otimizada deveria ter ao menos o cliente geocodificado"
            )
            assert len(ot.get("clientesSemGeolocalizacao", [])) >= 1, (
                "o cliente SEM geolocalização deveria cair na lista de não "
                f"geolocalizados (obtido: {ot.get('clientesSemGeolocalizacao')})"
            )
            assert _num(ot.get("distanciaTotalKm")) >= 0, (
                "distância total da rota otimizada deveria ser >= 0"
            )

            # ── 5) Status → EM_CARREGAMENTO → fechar → FINALIZADO ──
            resp_st = wms_api.transicao_status_mapa(mapa_id, "EM_CARREGAMENTO")
            assert resp_st.status in (200, 201), (
                f"transição para EM_CARREGAMENTO deveria ser aceita ({resp_st.text()})"
            )
            resp_fechar = wms_api.fechar_mapa(
                mapa_id,
                [
                    {"nfeId": nfe1, "statusEntrega": "ENTREGUE"},
                    {"nfeId": nfe2, "statusEntrega": "ENTREGUE"},
                ],
            )
            assert resp_fechar.status in (200, 201), (
                f"fechamento do mapa deveria ser aceito ({resp_fechar.text()})"
            )
            det = wms_api.obter_mapa(mapa_id)
            assert det.get("status") == "FINALIZADO", (
                f"mapa deveria ficar FINALIZADO após fechar (obtido {det.get('status')})"
            )

            # Evidência (best-effort).
            try:
                screenshot_com_nome(page_auth, f"montagem_carga_{run_id}")
            except Exception as exc:  # não derruba o teste
                print(f"[montagem carga] evidência: {exc}")

            mapa_id = None  # fechado com sucesso — nada a cancelar na limpeza
        finally:
            # Limpeza: cancela o mapa se ficou pendente (não FINALIZADO/CANCELADO).
            if mapa_id:
                wms_api.cancelar_mapa(mapa_id, motivo="Limpeza de QA")
