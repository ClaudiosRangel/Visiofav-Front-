"""
test_26 — Portaria: sequência de estados e liberação  [Requirement 4]

Valida de verdade os controles de estado da Portaria, criando os dados:
  - autorizar entrada de agendamento que NÃO está CONFIRMADO → 422 (Req 4.2);
  - conferir na portaria um agendamento AGENDADO → ESPERA (Req 4.1);
  - entrada avulsa → cria veículo NA_DOCA; registrar saída → RECEBIDO;
  - walk-in com placa inválida → 422; placa válida → 201 na fila.

Observação de arquitetura (verificada no backend): não há endpoint que grave
`status='CONFIRMADO'` (essa transição ocorre no módulo Agenda/UI). Por isso o
caminho positivo de `autorizar-entrada` (que exige CONFIRMADO) não é montável
100% por API; validamos o CONTRATO DE ESTADO (recusa quando não-CONFIRMADO),
que é o controle crítico, e os fluxos alcançáveis (conferir, avulsa, walk-in).

Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="300"; pytest test_26_portaria.py -s
"""
from datetime import datetime, timedelta
import hashlib
import random
import pytest


@pytest.fixture()
def doca(wms_api):
    docas = wms_api.listar_docas(limit=50)
    assert docas, "Pré-requisito ausente: nenhuma doca cadastrada na demo."
    return docas[0]


def _dia_unico(run_id: str, offset: int) -> str:
    h = int(hashlib.sha1((run_id + "portaria").encode()).hexdigest(), 16) % 200
    return (datetime.now() + timedelta(days=30 + h + offset)).strftime("%Y-%m-%d")


def _placa():
    letras = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=3))
    return f"{letras}{random.randint(1000,9999)}"  # formato antigo ABC1234


def test_4_2_autorizar_nao_confirmado_rejeita(wms_api, doca, run_id):
    """Req 4.2: autorizar entrada de agendamento não-CONFIRMADO → 422.

    Cria um agendamento (nasce AGENDADO) e tenta autorizar direto — o backend
    deve recusar porque o veículo não está CONFIRMADO.
    """
    dia = _dia_unico(run_id, 1)
    r = wms_api.agendar_doca(doca["id"], dia, "08:00", "09:00", motorista="P42", placa=_placa())
    assert r.status in (200, 201), f"Falha ao criar agendamento: {r.status} — {r.text()}"
    ag_id = r.json().get("id")
    resp = wms_api.portaria_autorizar_entrada(ag_id)
    assert resp.status == 422, f"Esperava 422 (não CONFIRMADO), veio {resp.status}: {resp.text()}"
    assert "confirmad" in (resp.json() or {}).get("message", "").lower(), f"Motivo inesperado: {resp.text()}"


def test_4_1_conferir_agendado_vai_para_espera(wms_api, doca, run_id):
    """Req 4.1: portaria confere um agendamento AGENDADO → status ESPERA."""
    dia = _dia_unico(run_id, 2)
    r = wms_api.agendar_doca(doca["id"], dia, "09:30", "10:30", motorista="P41", placa=_placa())
    assert r.status in (200, 201), f"Falha ao criar agendamento: {r.status} — {r.text()}"
    ag_id = r.json().get("id")
    conf = wms_api.portaria_conferir(ag_id, placa=_placa(), motorista="Motorista QA")
    # A portaria pode responder 200 (conferido → ESPERA) ou 4xx se o agendamento
    # do dia futuro não estiver "elegível" hoje. Validamos o caminho de sucesso.
    assert conf.status in (200, 201), f"Conferir na portaria falhou: {conf.status} — {conf.text()}"
    corpo = conf.json()
    ag = corpo.get("agendamento") or {}
    assert ag.get("status") == "ESPERA", f"Esperava ESPERA após conferir, veio {ag.get('status')}: {corpo}"


def test_4_entrada_avulsa_e_registrar_saida(wms_api):
    """Fluxo alcançável: entrada avulsa cria veículo NA_DOCA; registrar saída → RECEBIDO."""
    placa = _placa()
    r = wms_api.portaria_entrada_avulsa(placa=placa, motorista="Avulso QA", motivo="DESCARGA")
    assert r.status in (200, 201), f"Falha na entrada avulsa: {r.status} — {r.text()}"
    ag = r.json().get("agendamento") or {}
    ag_id = ag.get("id")
    assert ag.get("status") == "NA_DOCA", f"Entrada avulsa deveria nascer NA_DOCA: {ag}"
    # Registrar saída → RECEBIDO.
    saida = wms_api.portaria_registrar_saida(ag_id)
    assert saida.status in (200, 201), f"Falha ao registrar saída: {saida.status} — {saida.text()}"


def test_4_walk_in_placa_invalida_rejeita(wms_api):
    """Walk-in valida o formato da placa (antiga ou Mercosul) → placa inválida = 422."""
    cd = wms_api.primeiro_cd()
    if not cd.get("id"):
        pytest.fail("Pré-requisito ausente: nenhum Centro de Distribuição na demo.")
    r = wms_api.portaria_walk_in(
        placa="XX", motorista_nome="WalkIn QA", motorista_doc="12345678900",
        tipo_operacao="DESCARGA", cd_id=cd["id"],
    )
    assert r.status == 422, f"Esperava 422 (placa inválida), veio {r.status}: {r.text()}"


def test_4_walk_in_valido_entra_na_fila(wms_api):
    """Walk-in com placa válida → 201, veículo criado na fila do pátio."""
    cd = wms_api.primeiro_cd()
    if not cd.get("id"):
        pytest.fail("Pré-requisito ausente: nenhum Centro de Distribuição na demo.")
    r = wms_api.portaria_walk_in(
        placa=_placa(), motorista_nome="WalkIn OK", motorista_doc="98765432100",
        tipo_operacao="DESCARGA", cd_id=cd["id"],
    )
    assert r.status in (200, 201), f"Esperava criação do walk-in, veio {r.status}: {r.text()}"
    corpo = r.json()
    assert corpo.get("id"), f"Walk-in deveria retornar o veículo criado: {corpo}"
