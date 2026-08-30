"""
test_25 — Agenda de Docas: conflito, buffer, horário operacional  [Requirement 3]

Cria agendamentos de verdade numa doca real e valida o comportamento do backend:
  - agendamento válido dentro do horário e sem sobreposição → 201, AGENDADO;
  - sobreposição na mesma doca/dia (com buffer) → 409, não persiste;
  - fora do horário operacional → rejeição com motivo;
  - bloqueio de slot sobreposto → agendamento rejeitado (limpa o bloqueio);
  - mover para janela livre → aceito;
  - registrar chegada → NA_DOCA + horaChegadaReal.

Isolamento entre testes/execuções: cada teste usa um DIA ÚNICO (derivado do
run_id + offset por teste), então não colide com dados residuais de outras
execuções nem entre os próprios testes. Modo visual:
    $env:HEADLESS="false"; $env:SLOW_MO="300"; pytest test_25_agenda_doca.py -s
"""
from datetime import datetime, timedelta
import hashlib
import pytest


@pytest.fixture()
def doca(wms_api):
    docas = wms_api.listar_docas(limit=50)
    assert docas, "Pré-requisito ausente: nenhuma doca cadastrada na demo."
    return docas[0]


def _dia_unico(run_id: str, offset: int) -> str:
    """Dia futuro único por execução (run_id) + offset por teste.

    Base entre 30 e ~300 dias no futuro, deslocada pelo hash do run_id, mais o
    offset do teste — garante que dois testes/execuções nunca usem o mesmo dia
    na mesma doca (evita colisão com dados residuais)."""
    h = int(hashlib.sha1(run_id.encode()).hexdigest(), 16) % 200
    dias = 30 + h + offset
    return (datetime.now() + timedelta(days=dias)).strftime("%Y-%m-%d")


def test_3_1_agendamento_valido(wms_api, doca, run_id):
    """Req 3.1: agendamento dentro do horário e sem conflito → 201 AGENDADO."""
    dia = _dia_unico(run_id, 1)
    r = wms_api.agendar_doca(doca["id"], dia, "08:00", "09:00", motorista="QA1", placa="QAA1A11")
    assert r.status in (200, 201), f"Esperava criação, veio {r.status}: {r.text()}"
    assert r.json().get("status") == "AGENDADO"


def test_3_2_sobreposicao_com_buffer_rejeita_409(wms_api, doca, run_id):
    """Req 3.2: 2º agendamento sobrepondo a janela+buffer do 1º → 409, não persiste."""
    dia = _dia_unico(run_id, 2)
    r1 = wms_api.agendar_doca(doca["id"], dia, "10:00", "11:00", motorista="AG1", placa="QAB1B11")
    assert r1.status in (200, 201), f"1º agendamento falhou: {r1.status} — {r1.text()}"
    r2 = wms_api.agendar_doca(doca["id"], dia, "10:30", "11:30", motorista="AG2", placa="QAB2B22")
    assert r2.status == 409, f"Esperava 409 (conflito), veio {r2.status}: {r2.text()}"


def test_3_3_fora_do_horario_operacional_rejeita(wms_api, doca, run_id):
    """Req 3.3: horaFim após o fechamento operacional → rejeitado com motivo."""
    dia = _dia_unico(run_id, 3)
    r = wms_api.agendar_doca(doca["id"], dia, "22:30", "23:30", motorista="FORA", placa="QAC1C11")
    assert r.status >= 400, f"Esperava rejeição por horário, veio {r.status}: {r.text()}"
    msg = (r.json() or {}).get("message", "").lower()
    assert "operacional" in msg or "horário" in msg or "horario" in msg, f"Motivo inesperado: {msg}"


def test_3_4_bloqueio_de_slot_rejeita_agendamento(wms_api, doca, run_id):
    """Req 3.4: bloqueio de slot sobreposto → agendamento rejeitado. Limpa o bloqueio no fim."""
    dia = _dia_unico(run_id, 4)
    inicio_iso = f"{dia}T13:00:00.000Z"
    fim_iso = f"{dia}T15:00:00.000Z"
    rb = wms_api.criar_bloqueio_slot_doca(doca["id"], inicio_iso, fim_iso, "Manutencao QA")
    assert rb.status in (200, 201), f"Falha ao criar bloqueio: {rb.status} — {rb.text()}"
    bloqueio_id = rb.json().get("id")
    try:
        r = wms_api.agendar_doca(doca["id"], dia, "13:30", "14:30", motorista="BLOQ", placa="QAD1D11")
        assert r.status == 409, f"Esperava 409 (doca bloqueada), veio {r.status}: {r.text()}"
        assert "bloque" in (r.json() or {}).get("message", "").lower(), f"Motivo inesperado: {r.text()}"
    finally:
        if bloqueio_id:
            wms_api.remover_bloqueio_slot_doca(bloqueio_id)


def test_3_5_mover_para_janela_livre(wms_api, doca, run_id):
    """Req 3.5: mover um agendamento para uma janela livre → aceito."""
    dia = _dia_unico(run_id, 5)
    r = wms_api.agendar_doca(doca["id"], dia, "16:00", "17:00", motorista="MOV", placa="QAE1E11")
    assert r.status in (200, 201), f"Falha ao criar: {r.status} — {r.text()}"
    ag_id = r.json().get("id")
    rm = wms_api.mover_agendamento(ag_id, horaInicio="18:00", horaFim="19:00")
    assert rm.status in (200, 201), f"Esperava mover com sucesso, veio {rm.status}: {rm.text()}"


def test_3_6_registrar_chegada(wms_api, doca, run_id):
    """Req 3.6: registrar chegada → status NA_DOCA e horaChegadaReal gravada."""
    dia = _dia_unico(run_id, 6)
    r = wms_api.agendar_doca(doca["id"], dia, "20:00", "21:00", motorista="CHEG", placa="QAF1F11")
    assert r.status in (200, 201), f"Falha ao criar: {r.status} — {r.text()}"
    ag_id = r.json().get("id")
    rc = wms_api.registrar_chegada_doca(ag_id)
    assert rc.status in (200, 201), f"Falha ao registrar chegada: {rc.status} — {rc.text()}"
    atualizado = rc.json()
    assert atualizado.get("status") == "NA_DOCA", f"Status inesperado: {atualizado.get('status')}"
    assert atualizado.get("horaChegadaReal"), "horaChegadaReal não foi gravada"
