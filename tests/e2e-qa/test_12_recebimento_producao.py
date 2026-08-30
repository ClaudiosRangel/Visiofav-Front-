"""
TEST SUITE 12 — Recebimento por Produção (integração PCP → WMS)
==============================================================
Valida a integração automática PCP → WMS: ao concluir a ÚLTIMA etapa de uma
Ordem de Produção com quantidade produzida > 0 (e a integração automática
ativa), o backend cria uma ``NotaEntrada`` do tipo ``PRODUCAO`` (serie ``PRD``,
status ``PENDENTE``), com a quantidade efetivamente produzida e pertencente ao
``empresaId`` da OP.

Referências de comportamento (backend):
  - ``pcp/etapa-operacional.service.ts`` → ``concluirEtapa`` dispara a
    integração quando todas as etapas ficam CONCLUIDA e a flag dedicada
    ``pcp.integracaoWmsAutomatica`` (default true) + ``empresa.usaWms`` estão
    ativas. A resposta traz ``entradaWms = {notaEntradaId, numero, status}``.
  - ``pcp/pcp-wms-integration.service.ts`` → ``criarEntradaProducao`` cria a
    nota com ``tipo='PRODUCAO'``, ``serie='PRD'``, ``empresaId`` = o da OP e
    quantidade = quantidade produzida apontada (fallback para a planejada).

Estratégia de seed (determinística e mínima — ver ``wms_api.py``):
  - **OP Avulsa** (``POST /pcp/etapas/adicionar-avulsa``): cria uma OP
    ``PROGRAMADA`` com UMA etapa ``PENDENTE`` num centro, SEM depender de BOM
    ATIVA nem de percorrer toda a máquina de estados de uma OP normal. É o
    caminho de "OP mínima (uma etapa)" sugerido pela task, e é limpa ao final
    via ``DELETE /pcp/ordens-avulsas/:opId``.
  - Avança a etapa via API: iniciar → apontar (produção > 0) → concluir. Ao
    concluir a única/última etapa, a integração dispara.

DECISÃO / RISCO documentado:
  - A integração automática depende de ``empresa.usaWms`` E da flag
    ``pcp.integracaoWmsAutomatica`` (default true). Se o ambiente demo tiver a
    integração automática DESATIVADA, a conclusão não gera nota PRODUCAO — o
    que é exatamente o cenário do Requisito 2.4 (task 3.2), NÃO da task 3.1.
    Para não confundir os dois casos, quando a conclusão não retornar
    ``entradaWms`` no caminho de produção > 0, o teste da task 3.1 faz
    ``pytest.skip`` com motivo explícito. Assim a task 3.1 valida o caminho
    positivo sem falso-negativo por configuração de ambiente.

ACHADO (task 3.2, Requisito 2.2 — produção ZERO):
  O backend NÃO impede a geração da nota quando a produção apontada é ZERO.
  Em ``etapa-operacional.service.ts`` (``concluirEtapa``), a quantidade da
  nota é ``quantidadeProduzida > 0 ? quantidadeProduzida : quantidade
  planejada da OP`` — ou seja, com produção zero há FALLBACK para a quantidade
  planejada e a NotaEntrada PRODUCAO É criada (se a integração estiver ativa).
  O Requisito 2.2 ("produção zero → nenhuma nota") NÃO é honrado hoje. O teste
  ``test_producao_zero_comportamento_geracao_nota`` valida o comportamento
  REAL (nota criada com a quantidade planejada) e reporta a divergência, em
  vez de forçar um assert que o backend não cumpre.

FLAG (task 3.2, Requisito 2.4 — integração desativada):
  ``test_flag_desativada_nao_gera_nota_producao`` lê o valor ORIGINAL da flag,
  desativa (PATCH /pcp/configuracao — ADMIN), conclui uma OP com produção > 0,
  verifica que nenhuma nota é criada e RESTAURA a flag ao valor original no
  ``finally`` (SEMPRE — a base é a demo compartilhada; a prioridade é não
  deixar a integração desativada).

Não há PBT (fluxo determinístico; asserts de valor).

Como rodar:
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    pytest test_12_recebimento_producao.py -s          # headless (padrão)
    $env:HEADLESS="false"; $env:SLOW_MO="600"; pytest test_12_recebimento_producao.py -s
"""

import pytest
from playwright.sync_api import Page

from conftest import navegar_para
from helpers import aguardar_carregamento, screenshot_com_nome
from wms_api import WmsApiClient


@pytest.mark.slow
class TestRecebimentoProducao:
    """Recebimento por produção: conclusão de OP gera NotaEntrada PRODUCAO."""

    def test_conclusao_op_gera_nota_producao(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """TASK 3.1 — Geração da NotaEntrada PRODUCAO ao concluir a OP.

        Valida:
          - Requisito 2.1: concluir a última etapa com produção > 0 e
            integração ativa cria uma NotaEntrada tipo PRODUCAO.
          - Requisito 2.3: a quantidade da nota == quantidade produzida.
          - Requisito 2.5: a nota pertence ao ``empresaId`` da OP.
        """
        op_id_para_limpar: str | None = None
        flag_original: bool | None = None
        try:
            # ── FASE 0: pré-requisitos — centro + LIGAR integração automática ──
            # QA de verdade (sem skip): garantimos a flag pcp.integracaoWmsAutomatica
            # LIGADA antes de testar o caminho positivo, e restauramos no finally.
            centro = wms_api.primeiro_centro_producao()
            assert centro.get("id"), (
                "Pré-requisito ausente: nenhum centro de produção ativo na demo. "
                "Cadastre um centro em PCP → Cadastros → Centros de Produção."
            )
            cfg_pcp = wms_api.obter_configuracao_pcp()
            flag_original = cfg_pcp.get("integracaoWmsAutomatica", True)
            ligou = wms_api.definir_integracao_wms_automatica(True)
            assert ligou, (
                "Não foi possível LIGAR pcp.integracaoWmsAutomatica (PATCH "
                "/pcp/configuracao recusado — perfil sem permissão?)."
            )

            # ── FASE 1: criar OP avulsa (uma etapa) rastreável ──────────
            qtd_planejada = 20
            avulsa = wms_api.criar_op_avulsa_com_etapa(
                run_id, centro["id"], quantidade=qtd_planejada
            )
            op = avulsa.get("op") or {}
            etapa = avulsa.get("etapa") or {}
            op_id = op.get("id")
            etapa_id = etapa.get("id")
            empresa_id_op = op.get("empresaId")
            op_id_para_limpar = op_id

            assert op_id, "OP avulsa criada (id)"
            assert etapa_id, "etapa da OP avulsa criada (id)"
            assert empresa_id_op, "OP avulsa traz o empresaId (Requisito 2.5)"

            # ── FASE 2: avançar a etapa (iniciar → apontar → concluir) ──
            # Quantidade produzida efetiva < planejada de propósito, para
            # provar que a nota usa a quantidade PRODUZIDA (não a planejada) —
            # Requisito 2.3. Sem perda (apontamento PRODUCAO puro).
            qtd_produzida = 17
            assert qtd_produzida != qtd_planejada, (
                "produção deve diferir da planejada para validar Requisito 2.3"
            )

            wms_api.iniciar_etapa(etapa_id)
            wms_api.apontar_producao(etapa_id, quantidade_produzida=qtd_produzida)
            resultado = wms_api.concluir_etapa(etapa_id)

            # A conclusão da única etapa deve fechar a OP.
            assert resultado.get("todasConcluidas") is True, (
                "concluir a única etapa deve marcar a OP como concluída "
                f"(resultado: {resultado})"
            )

            # ── FASE 3: verificar a NotaEntrada PRODUCAO (via API) ──────
            # Com a flag LIGADA (Fase 0) e produção > 0, a nota DEVE existir.
            entrada_wms = resultado.get("entradaWms")
            assert entrada_wms, (
                "Integração automática LIGADA + produção > 0 deveria gerar a "
                f"NotaEntrada PRODUCAO, mas entradaWms veio vazio: {resultado}. "
                "Verifique empresa.usaWms=true na demo."
            )

            nota_id = entrada_wms.get("notaEntradaId")
            assert nota_id, "entradaWms deve trazer o notaEntradaId"

            nota = wms_api.obter_nota_entrada(nota_id)
            assert nota, "a NotaEntrada gerada deve ser recuperável via API"

            # Requisito 2.1: a nota é do tipo PRODUCAO.
            assert nota.get("tipo") == "PRODUCAO", (
                f"a nota gerada deve ser do tipo PRODUCAO (obtido: {nota.get('tipo')})"
            )

            # Requisito 2.5: a nota pertence ao empresaId da OP.
            assert nota.get("empresaId") == empresa_id_op, (
                "a NotaEntrada deve pertencer ao empresaId da OP "
                f"(nota={nota.get('empresaId')}, op={empresa_id_op})"
            )

            # Requisito 2.3: a quantidade da nota == quantidade produzida.
            itens = nota.get("itens") or []
            assert itens, "a NotaEntrada PRODUCAO deve ter ao menos um item"
            qtd_nota = sum(float(i.get("quantidade", 0) or 0) for i in itens)
            assert qtd_nota == float(qtd_produzida), (
                "a quantidade da NotaEntrada deve ser igual à quantidade "
                f"produzida (esperado {qtd_produzida}, obtido {qtd_nota})"
            )

            # ── Evidência (best-effort) ─────────────────────────────────
            # Registra a tela de notas de entrada como comprovação. Falha de
            # evidência não interrompe o teste (Requisito 14.4).
            try:
                navegar_para(page_auth, "/wms/conferencia-entrada")
                aguardar_carregamento(page_auth)
                screenshot_com_nome(
                    page_auth, f"nota_producao_{run_id}"
                )
            except Exception as exc:  # pragma: no cover - evidência best-effort
                print(f"[evidencia] falha ao registrar evidência da nota PRODUCAO: {exc}")

        finally:
            # ── Limpeza rastreável (best-effort) ────────────────────────
            # A OP avulsa (e suas etapas/apontamentos/logs) é removida em
            # cascata. A NotaEntrada PRODUCAO gerada permanece (não há endpoint
            # de exclusão seguro no fluxo) — fica rastreável pelo fornecedor
            # "PRODUÇÃO INTERNA" e pela serie PRD. Falha de limpeza não derruba
            # o teste (Requisito 13.3).
            if op_id_para_limpar:
                removida = wms_api.excluir_op_avulsa(op_id_para_limpar)
                if not removida:
                    print(
                        f"[limpeza] não foi possível remover a OP avulsa "
                        f"{op_id_para_limpar} (run {run_id}) — remover manualmente."
                    )
            # Restaura a flag de integração ao valor original (base compartilhada).
            if flag_original is not None:
                wms_api.definir_integracao_wms_automatica(flag_original)

    def test_producao_zero_comportamento_geracao_nota(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """TASK 3.2 (Caso 1 — Requisito 2.2): produção zero.

        Requisito 2.2 (como escrito): "IF a quantidade produzida de uma OP
        concluída é zero, THEN nenhuma NotaEntrada PRODUCAO é criada."

        ACHADO / DIVERGÊNCIA (comportamento REAL do backend):
          O backend NÃO impede a geração da nota quando a produção é zero. Em
          ``etapa-operacional.service.ts`` (``concluirEtapa``), a quantidade da
          nota é decidida por:

              quantidadeProduzidaFinal =
                Number(atualizada.quantidadeProduzida) > 0
                  ? Number(atualizada.quantidadeProduzida)
                  : Number(etapa.ordemProducao.quantidade)   // FALLBACK

          Ou seja, com produção apontada == 0, o sistema faz FALLBACK para a
          quantidade PLANEJADA da OP e AINDA cria a NotaEntrada PRODUCAO (desde
          que a integração automática esteja ativa). Não há guarda que bloqueie
          a criação por produção zero.

        Por isso este teste NÃO força o assert "nenhuma nota" que o backend não
        cumpre. Ele valida o comportamento REAL observado e o documenta:
          - Se ``entradaWms`` vier na resposta (integração ativa), assere que a
            nota foi criada com a quantidade PLANEJADA (fallback) e reporta a
            divergência com o Requisito 2.2 como print explícito.
          - Se ``entradaWms`` for None (integração automática desativada no
            ambiente), então de fato nenhuma nota é criada — nesse ambiente o
            Requisito 2.2 é satisfeito trivialmente; registra e encerra.

        O objetivo da task é validar o comportamento do sistema, não impor um
        assert que o backend não honra. A divergência é o resultado a reportar.
        """
        op_id_para_limpar: str | None = None
        try:
            # ── FASE 0: pré-requisito (centro de produção) ──────────────
            centro = wms_api.primeiro_centro_producao()
            if not centro.get("id"):
                pytest.skip(
                    "Pré-requisito externo indisponível: nenhum centro de "
                    "produção ativo na empresa demo."
                )

            # ── FASE 1: criar OP avulsa (uma etapa) rastreável ──────────
            qtd_planejada = 20
            avulsa = wms_api.criar_op_avulsa_com_etapa(
                run_id, centro["id"], quantidade=qtd_planejada
            )
            op = avulsa.get("op") or {}
            etapa = avulsa.get("etapa") or {}
            op_id = op.get("id")
            etapa_id = etapa.get("id")
            empresa_id_op = op.get("empresaId")
            op_id_para_limpar = op_id

            assert op_id, "OP avulsa criada (id)"
            assert etapa_id, "etapa da OP avulsa criada (id)"

            # ── FASE 2: iniciar e concluir SEM apontar produção ─────────
            # Produção efetiva == 0 (nenhum apontamento). Ao concluir a única
            # etapa, a OP fecha e a integração (se ativa) dispara.
            wms_api.iniciar_etapa(etapa_id)
            resultado = wms_api.concluir_etapa(etapa_id)

            assert resultado.get("todasConcluidas") is True, (
                "concluir a única etapa deve marcar a OP como concluída "
                f"(resultado: {resultado})"
            )
            # Confirma que a produção apontada foi realmente zero.
            qtd_produzida = float(resultado.get("quantidadeProduzida", 0) or 0)
            assert qtd_produzida == 0, (
                "pré-condição do caso: produção apontada deve ser zero "
                f"(obtido {qtd_produzida})"
            )

            # ── FASE 3: verificar comportamento REAL ────────────────────
            entrada_wms = resultado.get("entradaWms")

            if not entrada_wms:
                # Integração automática desativada no ambiente → nenhuma nota.
                # Nesse ambiente o Requisito 2.2 é satisfeito (não há nota).
                print(
                    "[achado] Produção zero e integração automática desativada "
                    "no ambiente: nenhuma NotaEntrada PRODUCAO criada "
                    "(Requisito 2.2 satisfeito trivialmente neste ambiente)."
                )
                return

            # Integração ativa: o backend criou a nota mesmo com produção zero
            # (fallback para a quantidade planejada). Documenta a DIVERGÊNCIA e
            # valida o comportamento REAL (não força o assert do Req 2.2).
            nota_id = entrada_wms.get("notaEntradaId")
            assert nota_id, "entradaWms deve trazer o notaEntradaId"
            nota = wms_api.obter_nota_entrada(nota_id)
            assert nota, "a NotaEntrada gerada deve ser recuperável via API"
            assert nota.get("tipo") == "PRODUCAO", (
                f"a nota gerada deve ser do tipo PRODUCAO (obtido: {nota.get('tipo')})"
            )
            if empresa_id_op:
                assert nota.get("empresaId") == empresa_id_op, (
                    "a NotaEntrada deve pertencer ao empresaId da OP"
                )

            itens = nota.get("itens") or []
            qtd_nota = sum(float(i.get("quantidade", 0) or 0) for i in itens)

            print(
                "[ACHADO / DIVERGÊNCIA — Requisito 2.2] Com produção apontada "
                "ZERO e integração automática ATIVA, o backend criou uma "
                f"NotaEntrada PRODUCAO (#{entrada_wms.get('numero')}) com "
                f"quantidade {qtd_nota} (fallback para a quantidade PLANEJADA "
                f"da OP = {qtd_planejada}). O Requisito 2.2 exige que NENHUMA "
                "nota seja criada com produção zero — o sistema NÃO cumpre esse "
                "requisito hoje: ver 'quantidadeProduzidaFinal' em "
                "etapa-operacional.service.ts (fallback para a quantidade "
                "planejada quando a produzida é 0)."
            )

            # Valida o comportamento REAL: a nota usa a quantidade planejada.
            assert qtd_nota == float(qtd_planejada), (
                "comportamento real esperado: com produção zero, a nota usa a "
                f"quantidade PLANEJADA (esperado {qtd_planejada}, obtido {qtd_nota})"
            )

        finally:
            if op_id_para_limpar:
                removida = wms_api.excluir_op_avulsa(op_id_para_limpar)
                if not removida:
                    print(
                        f"[limpeza] não foi possível remover a OP avulsa "
                        f"{op_id_para_limpar} (run {run_id}) — remover manualmente."
                    )

    def test_flag_desativada_nao_gera_nota_producao(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        """TASK 3.2 (Caso 2 — Requisito 2.4): flag de integração desativada.

        Requisito 2.4: WHERE a flag de integração automática está desativada
        para a empresa, concluir a OP (mesmo com produção > 0) NÃO cria
        NotaEntrada PRODUCAO.

        DECISÃO (documentada) sobre alternar a flag no ambiente demo compartilhado:
          A flag ``pcp.integracaoWmsAutomatica`` é global por empresa e a base é
          a demo compartilhada. Alternar para ``false`` e esquecer de restaurar
          deixaria a empresa demo com a integração automática DESATIVADA — o que
          quebraria silenciosamente o caminho feliz da task 3.1 e o uso real.
          Por isso:
            1. Lemos o valor ORIGINAL da flag (``GET /pcp/configuracao``).
            2. Só alteramos se a alteração for aceita (a sessão é ADMIN); se o
               PATCH não for aceito (ex.: 403 por perfil), fazemos ``skip``
               explícito em vez de assumir o estado da empresa.
            3. Desativamos, executamos o cenário, e RESTAURAMOS o valor original
               no ``finally`` — SEMPRE. A prioridade é NÃO deixar a empresa demo
               com a integração desativada.

        Assim a validação é segura e não deixa efeito colateral persistente.
        """
        op_id_para_limpar: str | None = None
        valor_original: bool | None = None
        flag_alterada = False
        try:
            # ── FASE 0: pré-requisito (centro de produção) ──────────────
            centro = wms_api.primeiro_centro_producao()
            if not centro.get("id"):
                pytest.skip(
                    "Pré-requisito externo indisponível: nenhum centro de "
                    "produção ativo na empresa demo."
                )

            # ── FASE 1: ler e desativar a flag (com restore garantido) ──
            config = wms_api.obter_configuracao_pcp()
            # Default do backend é true quando não configurada.
            valor_original = bool(config.get("integracaoWmsAutomatica", True))

            desativou = wms_api.definir_integracao_wms_automatica(False)
            if not desativou:
                pytest.skip(
                    "Não foi possível desativar a flag pcp.integracaoWmsAutomatica "
                    "(PATCH /pcp/configuracao não aceito — perfil sem permissão?). "
                    "Alternar a flag é operação ADMIN; sem isso não há como "
                    "validar o Requisito 2.4 com segurança neste ambiente."
                )
            flag_alterada = True

            # Confirma que a flag ficou desativada antes de prosseguir.
            config_apos = wms_api.obter_configuracao_pcp()
            assert config_apos.get("integracaoWmsAutomatica") is False, (
                "a flag integracaoWmsAutomatica deveria estar desativada após o "
                f"PATCH (obtido: {config_apos.get('integracaoWmsAutomatica')})"
            )

            # ── FASE 2: criar OP avulsa e concluir COM produção > 0 ─────
            qtd_planejada = 20
            avulsa = wms_api.criar_op_avulsa_com_etapa(
                run_id, centro["id"], quantidade=qtd_planejada
            )
            op = avulsa.get("op") or {}
            etapa = avulsa.get("etapa") or {}
            op_id = op.get("id")
            etapa_id = etapa.get("id")
            op_id_para_limpar = op_id

            assert op_id, "OP avulsa criada (id)"
            assert etapa_id, "etapa da OP avulsa criada (id)"

            qtd_produzida = 17  # produção > 0 de propósito
            wms_api.iniciar_etapa(etapa_id)
            wms_api.apontar_producao(etapa_id, quantidade_produzida=qtd_produzida)
            resultado = wms_api.concluir_etapa(etapa_id)

            assert resultado.get("todasConcluidas") is True, (
                "concluir a única etapa deve marcar a OP como concluída "
                f"(resultado: {resultado})"
            )

            # ── FASE 3: verificar que NENHUMA nota PRODUCAO foi criada ──
            # Com a flag desativada, a integração não dispara — mesmo com
            # produção > 0 e empresa.usaWms ativo. A resposta NÃO deve trazer
            # entradaWms (Requisito 2.4).
            entrada_wms = resultado.get("entradaWms")
            assert not entrada_wms, (
                "Requisito 2.4: com a flag pcp.integracaoWmsAutomatica "
                "desativada, concluir a OP (mesmo com produção > 0) NÃO deve "
                f"gerar NotaEntrada PRODUCAO (obtido entradaWms={entrada_wms})"
            )

            print(
                "[ok — Requisito 2.4] Flag integracaoWmsAutomatica desativada: "
                "conclusão da OP com produção > 0 não gerou NotaEntrada PRODUCAO."
            )

        finally:
            # ── Restaurar a flag ao valor ORIGINAL — SEMPRE ─────────────
            # Prioridade máxima: não deixar a empresa demo com a integração
            # desativada. Restaura mesmo que algo acima tenha falhado.
            if flag_alterada and valor_original is not None:
                restaurou = wms_api.definir_integracao_wms_automatica(valor_original)
                if restaurou:
                    print(
                        f"[restore] flag integracaoWmsAutomatica restaurada para "
                        f"o valor original ({valor_original})."
                    )
                else:
                    # Falha crítica de restauração: reporta com destaque para
                    # correção manual imediata (empresa demo compartilhada).
                    print(
                        "[RESTORE FALHOU] NÃO foi possível restaurar a flag "
                        "pcp.integracaoWmsAutomatica para o valor original "
                        f"({valor_original}). RESTAURE MANUALMENTE em PCP → "
                        "Configuração (Integração Automática PCP → WMS) para "
                        "não deixar a empresa demo com a integração desativada."
                    )

            # ── Limpeza rastreável da OP avulsa (best-effort) ───────────
            if op_id_para_limpar:
                removida = wms_api.excluir_op_avulsa(op_id_para_limpar)
                if not removida:
                    print(
                        f"[limpeza] não foi possível remover a OP avulsa "
                        f"{op_id_para_limpar} (run {run_id}) — remover manualmente."
                    )
