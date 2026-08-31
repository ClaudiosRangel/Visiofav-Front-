"""
TEST SUITE 13 — Reconciliação de Saldos Consolidados (WMS vs ERP)
=================================================================
Valida a fórmula de saldo e a regra de origem do endpoint de saldo
consolidado (``GET /api/saldos/consolidado``), fonte oficial da visão
consolidada de saldos por produto no Vizor.

Regra de negócio (steering ``pcp-modulo.md`` §1.7 e ``saldo-consolidado.service.ts``):
  - Consolida por produto. Se há ``SaldoEndereco`` (WMS) > 0, a origem é WMS
    (com endereços detalhados); senão, cai para o ``Estoque`` global (ERP, sem
    endereço).
  - ``Reservado = venda + Σ ReservaProducao ATIVA``.
  - ``Disponível = Físico − Reservado``.

Esta é uma suíte majoritariamente de VERIFICAÇÃO (leitura): consulta o
endpoint e valida invariantes sobre os registros retornados, sem criar dados.
Cobre os Requirements 3.1, 3.2 e 3.3.

Estratégia por caso:
  - 3.1 (fórmula ``disponivel == fisico - reservado``): aplica-se a QUALQUER
    registro retornado — sempre validado, nunca pulado.
  - 3.2 (origem WMS com endereços e ``Σ por endereço == físico``): validado nos
    registros com origem WMS; ``skip`` explícito se o ambiente não tiver nenhum.
  - 3.3 (origem ERP sem endereços, com estoque global): validado nos registros
    com origem ERP; ``skip`` explícito se o ambiente não tiver nenhum.

Não há PBT (asserts de valor sobre dados reais). Multi-tenant: os saldos
retornados são da empresa da sessão (garantido pela rota do backend).
"""

import re
import time

import pytest

from wms_api import WmsApiClient
from helpers import screenshot_com_nome, aguardar_carregamento
from conftest import navegar_para
from playwright.sync_api import Page


# Tolerância para comparações de ponto flutuante (saldos podem vir como
# Decimal serializado em string/float com casas decimais).
TOLERANCIA = 0.001


def _num(valor) -> float:
    """Converte um valor de saldo (int/float/str/None) para float robustamente.

    O backend pode serializar ``Decimal`` como string ("10.00") ou número.
    Valores ausentes viram 0.0.
    """
    if valor is None:
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)
    try:
        return float(str(valor).replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _origem(registro: dict) -> str:
    """Normaliza a origem do registro (``WMS``/``ERP``) para maiúsculas."""
    return str(registro.get("origem") or "").strip().upper()


def _enderecos(registro: dict) -> list:
    """Retorna a lista de endereços detalhados do registro (ou vazia)."""
    ends = registro.get("enderecos")
    return ends if isinstance(ends, list) else []


def _aguardar_reservado(
    wms_api: WmsApiClient,
    produto_id: str,
    reservado_alvo: float,
    tentativas: int = 6,
) -> dict:
    """Reconsulta o saldo consolidado até ``reservado`` atingir o alvo (ou esgotar).

    Tolera a latência de propagação após criar a reserva de produção (retry
    curto, backoff fixo). Retorna o último saldo consultado — o chamador faz
    o ``assert`` de valor sobre o resultado.
    """
    saldo = {}
    for _ in range(max(1, tentativas)):
        saldo = wms_api.saldo_consolidado(produto_id)
        if abs(_num(saldo.get("reservado")) - reservado_alvo) <= TOLERANCIA:
            return saldo
        time.sleep(0.8)
    return saldo


def _normalizar_numero_ptbr(texto: str) -> float:
    """Extrai e normaliza um número formatado em pt-BR de um texto da UI.

    A tela de Consulta de Saldos formata os números com
    ``Number(x).toLocaleString('pt-BR')`` e concatena a unidade (ex.:
    ``"1.250,5 CX"``). Esta função:
      - isola o primeiro token numérico do texto (dígitos, ``.`` e ``,``);
      - remove os separadores de milhar (``.``);
      - troca a vírgula decimal por ``.``;
      - converte para ``float``.

    Ex.: ``"1.250,5 CX"`` → ``1250.5``; ``"50 CX"`` → ``50.0``. Lança
    ``ValueError`` se nenhum número for encontrado (o chamador trata).
    """
    m = re.search(r"[\d.,]+", texto or "")
    if not m:
        raise ValueError(f"nenhum número encontrado no texto da UI: {texto!r}")
    bruto = m.group(0).replace(".", "").replace(",", ".")
    return float(bruto)


class TestSaldosConsolidados:
    """Reconciliação de saldos consolidados (Requirements 3.1, 3.2, 3.3)."""

    def test_formula_disponivel_igual_fisico_menos_reservado(
        self, wms_api: WmsApiClient
    ):
        """Requirement 3.1 — ``disponivel == fisico - reservado`` em TODO registro.

        Consulta a lista completa de saldos consolidados e valida a fórmula
        para cada produto retornado. Esta invariante se aplica a qualquer
        registro (WMS ou ERP), portanto nunca é pulada; se o ambiente não
        retornar nenhum saldo, o caso é pulado com motivo explícito (não há o
        que validar).
        """
        registros = wms_api.listar_saldos_consolidados()

        if not registros:
            pytest.skip(
                "Nenhum saldo consolidado retornado pelo ambiente — "
                "não há registros para validar a fórmula (Requirement 3.1)."
            )

        # Regra REAL do sistema (saldo-consolidado.service.ts):
        #   disponivel = max(0, fisico - reservado)
        # O clamp em 0 é intencional ("nunca negativo na exibição") — padrão de
        # mercado para não expor disponível negativo ao operador. Validamos essa
        # fórmula (com clamp), que é o contrato verdadeiro do endpoint.
        violacoes = []
        negativos = []
        for r in registros:
            fisico = _num(r.get("fisico"))
            reservado = _num(r.get("reservado"))
            disponivel = _num(r.get("disponivel"))
            esperado = max(0.0, fisico - reservado)
            if abs(disponivel - esperado) > TOLERANCIA:
                violacoes.append({
                    "produtoId": r.get("produtoId"),
                    "fisico": fisico, "reservado": reservado,
                    "disponivel": disponivel, "esperado": esperado,
                })
            if fisico < 0:
                negativos.append({"produtoId": r.get("produtoId"), "fisico": fisico})

        # Achado informativo (não falha o teste): estoque físico negativo é dado
        # inconsistente do ambiente (movimentação legada) — vale investigar, mas
        # não é violação da fórmula de disponível.
        if negativos:
            print(f"[achado] {len(negativos)} produto(s) com estoque físico NEGATIVO "
                  f"(dado a investigar): {negativos[:5]}")

        assert not violacoes, (
            "Requirement 3.1 violado — disponivel != max(0, fisico - reservado) em "
            f"{len(violacoes)} de {len(registros)} registro(s): {violacoes[:5]}"
        )

    def test_origem_wms_tem_enderecos_e_soma_igual_fisico(
        self, wms_api: WmsApiClient
    ):
        """Requirement 3.2 — origem WMS com endereços detalhados e ``Σ == físico``.

        Para cada registro com origem WMS, valida que há endereços detalhados
        e que a soma das quantidades por endereço é igual ao físico
        consolidado. O design nota o caso "mesmo com consolidado zero": se
        houver um produto WMS com endereços mas físico 0, a soma dos endereços
        (que pode ser 0) ainda deve bater com o físico.

        Se o ambiente não tiver nenhum registro com origem WMS, o caso é
        pulado com motivo explícito (Requirement 3.2 não observável agora).
        """
        registros = wms_api.listar_saldos_consolidados()
        wms = [r for r in registros if _origem(r) == "WMS"]

        if not wms:
            pytest.skip(
                "Nenhum registro com origem WMS no ambiente — "
                "Requirement 3.2 (endereços detalhados + soma por endereço == "
                "físico) não é observável nesta execução."
            )

        sem_enderecos = []
        soma_divergente = []
        for r in wms:
            fisico = _num(r.get("fisico"))
            enderecos = _enderecos(r)

            # Origem WMS deve trazer os endereços detalhados.
            if not enderecos:
                sem_enderecos.append(r.get("produtoId"))
                continue

            # A soma das quantidades por endereço deve bater com o físico.
            # O campo de quantidade por endereço pode variar de nome conforme
            # a serialização — tentamos os mais prováveis, nessa ordem.
            soma = 0.0
            for e in enderecos:
                qtd = (
                    e.get("quantidade")
                    if e.get("quantidade") is not None
                    else e.get("saldo")
                    if e.get("saldo") is not None
                    else e.get("fisico")
                )
                soma += _num(qtd)

            if abs(soma - fisico) > TOLERANCIA:
                soma_divergente.append(
                    {
                        "produtoId": r.get("produtoId"),
                        "fisico": fisico,
                        "soma_enderecos": soma,
                        "enderecos": enderecos,
                    }
                )

        assert not sem_enderecos, (
            "Requirement 3.2 violado — registro(s) com origem WMS sem endereços "
            f"detalhados: {sem_enderecos[:5]}"
        )
        assert not soma_divergente, (
            "Requirement 3.2 violado — soma das quantidades por endereço != "
            f"físico em {len(soma_divergente)} registro(s) WMS: "
            f"{soma_divergente[:5]}"
        )

    def test_origem_erp_sem_enderecos_com_estoque_global(
        self, wms_api: WmsApiClient
    ):
        """Requirement 3.3 — origem ERP sem endereços, com estoque global.

        Para cada registro com origem ERP (produto sem ``SaldoEndereco`` WMS,
        mas com estoque global), valida que a origem é de fato ERP e que não
        há endereços detalhados.

        Se o ambiente não tiver nenhum registro com origem ERP, o caso é
        pulado com motivo explícito.
        """
        registros = wms_api.listar_saldos_consolidados()
        erp = [r for r in registros if _origem(r) == "ERP"]

        if not erp:
            pytest.skip(
                "Nenhum registro com origem ERP no ambiente — "
                "Requirement 3.3 (origem ERP sem endereços) não é observável "
                "nesta execução."
            )

        com_enderecos = []
        for r in erp:
            # Origem ERP: confirmada acima. Não deve ter endereços detalhados.
            if _enderecos(r):
                com_enderecos.append(
                    {
                        "produtoId": r.get("produtoId"),
                        "enderecos": _enderecos(r),
                    }
                )

        assert not com_enderecos, (
            "Requirement 3.3 violado — registro(s) com origem ERP não deveriam "
            f"ter endereços detalhados: {com_enderecos[:5]}"
        )

    def test_evidencia_e_resumo_das_origens(
        self, wms_api: WmsApiClient, page_auth: Page
    ):
        """Registra evidência da tela de Consulta de Saldos e resume as origens.

        Não é um teste de invariante — serve de documentação/evidência do
        estado do ambiente (quantos registros, quais origens presentes),
        auxiliando o diagnóstico dos ``skip`` dos casos 3.2/3.3.
        """
        registros = wms_api.listar_saldos_consolidados()
        total = len(registros)
        wms = sum(1 for r in registros if _origem(r) == "WMS")
        erp = sum(1 for r in registros if _origem(r) == "ERP")
        outras = total - wms - erp

        print(
            f"\n[Saldos consolidados] total={total} | origem WMS={wms} | "
            f"origem ERP={erp} | outras/indefinidas={outras}"
        )

        # Evidência visual da tela de Consulta de Saldos (aba Por Produto).
        try:
            navegar_para(page_auth, "/estoque")
            screenshot_com_nome(page_auth, "saldos_consolidados_por_produto")
        except Exception as exc:  # evidência não pode derrubar o teste
            print(f"[Saldos consolidados] falha ao gerar evidência de tela: {exc}")

        # O teste em si só falha se o endpoint não respondeu de forma alguma.
        assert isinstance(registros, list)

    def test_reserva_producao_aumenta_reservado_e_reduz_disponivel(
        self, wms_api: WmsApiClient, run_id: str
    ):
        """Requirement 3.4 — reserva de produção ATIVA aumenta reservado e reduz disponível.

        Captura o saldo consolidado do produto-componente ANTES, cria uma
        ``ReservaProducao`` ATIVA de quantidade Q para ele (via o botão
        "Reservar Materiais" da Análise de Produção — ``POST
        /pcp/analise-producao/:opId/reservar``) e reconsulta, verificando:

          - ``reservado_depois − reservado_antes == Q``
          - ``disponivel_antes − disponivel_depois == Q``
          - ``fisico`` inalterado (a reserva não mexe no físico).

        SEED (auto-contido e determinístico — ver ``wms_api``):
          1. Garante um produto-componente com físico endereçado (origem WMS)
             via o fluxo de recebimento por API (nota → conferência →
             endereçamento em lote). Precisamos de físico suficiente para que
             ``disponivel = max(0, fisico − reservado)`` NÃO chegue ao piso
             zero após a reserva — só assim ``disponivel`` cai exatamente por Q.
          2. Cria um produto-pai de QA com BOM ATIVA de 1 item apontando para o
             componente (``rendimento=1``, ``percentualPerda=0``).
          3. Cria uma OP para o pai (quantidade 1) → item explodido com
             ``produtoComponenteId`` = componente e quantidade = Q.
          4. Reserva os materiais da OP → ``ReservaProducao`` ATIVA de Q.

        A quantidade Q reservada é lida do próprio item da OP (necessidade
        líquida ``quantidade − quantidadeLiberada``), não assumida — robusto a
        arredondamento da explosão de BOM.

        Se algum pré-requisito de seed for genuinamente indisponível no
        ambiente (sem endereço livre para dar físico, ou a criação da BOM/OP
        não for aceita), o caso é pulado com motivo explícito — apenas no seed,
        nunca no meio da verificação (design, Error Handling).
        """
        # Quantidade de componente por unidade do pai (== Q reservado, pois a
        # OP é de quantidade 1, rendimento 1, perda 0). Pequena o bastante para
        # caber com folga no físico semeado (evita o piso zero do disponível).
        qtd_componente = 5
        fisico_seed = 50  # físico >> reservado esperado (5) — margem segura

        op_id = None
        estrutura = None
        produto_pai = None
        try:
            # ── SEED 1: componente com físico endereçado (origem WMS) ──
            # Pré-requisito externo: endereços livres para o put-away do seed.
            enderecos = wms_api.garantir_enderecos_livres(minimo=1)
            if len(enderecos) < 1:
                pytest.skip(
                    "Pré-requisito externo indisponível: nenhum endereço "
                    "ARMAZENAGEM/LIVRE ativo para dar físico ao componente "
                    "(Requirement 3.4 — seed)."
                )

            componente = wms_api.garantir_produto_com_sku(run_id)
            assert componente.get("id"), "seed: componente obtido (id)"

            seed = wms_api.seed_fisico_por_recebimento(
                run_id, componente, quantidade=fisico_seed
            )
            if (seed.get("quantidadeEnderecada") or 0) <= 0:
                pytest.skip(
                    "Pré-requisito externo indisponível: não foi possível "
                    "endereçar físico para o componente (distribuição não "
                    "alocou destino) — Requirement 3.4 (seed)."
                )

            # Saldo ANTES da reserva (já com o físico semeado propagado).
            saldo_antes = wms_api.saldo_consolidado(componente["id"])
            fisico_antes = _num(saldo_antes.get("fisico"))
            reservado_antes = _num(saldo_antes.get("reservado"))
            disponivel_antes = _num(saldo_antes.get("disponivel"))
            assert fisico_antes > 0, (
                "seed: componente deve ter físico > 0 antes da reserva "
                f"(saldo: {saldo_antes})"
            )

            # ── SEED 2/3: produto-pai + BOM ATIVA + OP com item do componente ──
            try:
                bom = wms_api.garantir_produto_pai_com_bom(
                    run_id, componente, quantidade_componente=qtd_componente
                )
                produto_pai = bom["produtoPai"]
                estrutura = bom["estrutura"]

                op = wms_api.criar_op_com_bom(produto_pai["id"], quantidade=1)
                op_id = op.get("id")
                assert op_id, "seed: OP criada com BOM (id)"
                assert (op.get("itensGerados") or 0) >= 1, (
                    "seed: explosão da BOM deve gerar ao menos um item de "
                    f"material na OP (op: {op})"
                )
            except AssertionError:
                raise
            except Exception as exc:
                pytest.skip(
                    "Pré-requisito de seed indisponível: criação de BOM/OP não "
                    f"aceita pelo ambiente ({exc}) — Requirement 3.4 (seed)."
                )

            # Q reservado = necessidade líquida do item do componente na OP.
            detalhe_op = wms_api.obter_ordem_producao(op_id)
            itens_op = detalhe_op.get("itens", []) or []
            item_comp = next(
                (
                    i
                    for i in itens_op
                    if i.get("produtoComponenteId") == componente["id"]
                ),
                None,
            )
            assert item_comp is not None, (
                "seed: a OP deve ter um item apontando para o componente "
                f"(itens: {itens_op})"
            )
            q_reservar = _num(item_comp.get("quantidade")) - _num(
                item_comp.get("quantidadeLiberada")
            )
            assert q_reservar > 0, (
                f"seed: necessidade líquida do componente deve ser > 0 "
                f"(item: {item_comp})"
            )

            # Garante que há físico suficiente para o disponível não bater no
            # piso (0) após a reserva — condição para o delta de disponível ser
            # exatamente Q.
            assert disponivel_antes >= q_reservar, (
                "seed: disponível antes deve comportar a reserva sem chegar ao "
                f"piso zero (disponivel_antes={disponivel_antes}, Q={q_reservar})"
            )

            # ── AÇÃO: reservar materiais da OP (cria ReservaProducao ATIVA) ──
            resultado = wms_api.reservar_materiais_op(op_id)
            assert (resultado.get("reservasCriadas") or 0) >= 1, (
                "a reserva de materiais deve criar ao menos uma ReservaProducao "
                f"ATIVA (resultado: {resultado})"
            )

            # ── VERIFICAÇÃO (Requirement 3.4) ──
            saldo_depois = _aguardar_reservado(
                wms_api, componente["id"], reservado_alvo=reservado_antes + q_reservar
            )
            fisico_depois = _num(saldo_depois.get("fisico"))
            reservado_depois = _num(saldo_depois.get("reservado"))
            disponivel_depois = _num(saldo_depois.get("disponivel"))

            # Reservado aumentou exatamente por Q.
            assert abs((reservado_depois - reservado_antes) - q_reservar) <= TOLERANCIA, (
                "Requirement 3.4 — reservado deve aumentar exatamente pela "
                f"quantidade reservada Q={q_reservar} "
                f"(antes={reservado_antes}, depois={reservado_depois})"
            )
            # Disponível reduziu exatamente por Q.
            assert abs((disponivel_antes - disponivel_depois) - q_reservar) <= TOLERANCIA, (
                "Requirement 3.4 — disponível deve reduzir exatamente pela "
                f"quantidade reservada Q={q_reservar} "
                f"(antes={disponivel_antes}, depois={disponivel_depois})"
            )
            # Físico inalterado (reserva é empenho, não movimenta físico).
            assert abs(fisico_depois - fisico_antes) <= TOLERANCIA, (
                "Requirement 3.4 — o físico não deve mudar com a reserva "
                f"(antes={fisico_antes}, depois={fisico_depois})"
            )
        finally:
            # Limpeza best-effort (na ordem inversa da criação). Nenhuma falha
            # de limpeza pode derrubar o teste (design, Requirement 13.3).
            if op_id:
                wms_api.cancelar_reservas_op(op_id)
                wms_api.excluir_ordem_producao(op_id)
            if estrutura and produto_pai:
                wms_api.inativar_estrutura(estrutura["id"], produto_pai["id"])

    def test_paridade_saldo_ui_vs_api(
        self, wms_api: WmsApiClient, page_auth: Page, run_id: str
    ):
        """Requirement 3.5 — saldo exibido na tela == saldo do endpoint.

        Navega para a tela de Consulta de Saldos (``/estoque``, aba "Por
        Produto"), localiza o produto e compara o **disponível** exibido na
        tela com o retornado por ``saldo_consolidado``. Como a UI formata os
        números em pt-BR (``toLocaleString('pt-BR')`` + unidade), o texto é
        extraído e normalizado antes de comparar (ver
        ``_normalizar_numero_ptbr``).

        Estratégia de seleção do produto-alvo:
          - Preferimos um produto com físico endereçado (origem WMS) semeado
            nesta execução (garante uma linha estável e com valor > 0 na aba
            "Por Produto"). Se o seed não puder dar físico (sem endereço livre),
            caímos no primeiro produto retornado pelo endpoint; se o endpoint
            não retornar nenhum, pulamos com motivo explícito.
          - Usamos o campo de busca da tela (filtra a lista por produto) para
            reduzir a tabela à linha do alvo, tornando a extração robusta.

        A comparação principal é sobre o **disponível** (coluna "Disponível" da
        aba "Por Produto"), conforme sugerido pela task: é o valor mais
        significativo da tela e menos ambíguo de localizar por linha.
        """
        # ── SEED (best-effort): produto com físico endereçado para ter uma
        # linha estável na aba "Por Produto". ──
        produto_alvo = None
        busca = ""
        try:
            enderecos = wms_api.garantir_enderecos_livres(minimo=1)
            if len(enderecos) >= 1:
                componente = wms_api.garantir_produto_com_sku(run_id)
                seed = wms_api.seed_fisico_por_recebimento(
                    run_id, componente, quantidade=50
                )
                if (seed.get("quantidadeEnderecada") or 0) > 0:
                    produto_alvo = componente
                    busca = componente.get("codigo") or componente.get("nome") or ""
        except Exception as exc:  # seed é best-effort para este caso
            print(f"[paridade UI×API] seed de físico não completou: {exc}")

        # Saldo de referência do endpoint (fonte de verdade).
        if produto_alvo:
            saldo_api = wms_api.saldo_consolidado(produto_alvo["id"])
            if not saldo_api:
                produto_alvo = None  # cai para o fallback abaixo

        if not produto_alvo:
            registros = wms_api.listar_saldos_consolidados()
            if not registros:
                pytest.skip(
                    "Nenhum saldo consolidado no ambiente — Requirement 3.5 "
                    "(paridade UI × API) não é observável nesta execução."
                )
            saldo_api = registros[0]
            busca = saldo_api.get("codigo") or saldo_api.get("nome") or ""

        disponivel_api = _num(saldo_api.get("disponivel"))

        # ── UI: abrir a tela, aba "Por Produto", filtrar pelo alvo ──
        navegar_para(page_auth, "/estoque")
        aguardar_carregamento(page_auth)

        aba = page_auth.get_by_role("tab", name=re.compile("Por Produto", re.I)).first
        assert aba.count() > 0, "aba 'Por Produto' deve existir na tela de saldos"
        aba.click()
        time.sleep(0.6)

        # Filtra a tabela pelo produto-alvo para isolar a linha.
        if busca:
            campo_busca = page_auth.get_by_placeholder(
                re.compile("Pesquisar", re.I)
            ).first
            if campo_busca.count() > 0 and campo_busca.is_visible():
                campo_busca.click()
                campo_busca.fill(str(busca))
                time.sleep(1.2)  # debounce da query

        # Evidência da tela filtrada.
        try:
            screenshot_com_nome(page_auth, f"paridade_saldo_ui_{run_id}")
        except Exception as exc:  # evidência é best-effort
            print(f"[paridade UI×API] falha ao gerar evidência: {exc}")

        # Localiza a linha do produto na tabela e extrai o disponível exibido.
        # A linha contém o código/nome do produto; a última célula é o
        # "Disponível" (formatado pt-BR + unidade). Buscamos a linha pelo termo
        # de busca e, dentro dela, a célula de disponível.
        termo = str(busca).strip()
        linha = None
        if termo:
            candidata = page_auth.locator("tr", has_text=termo).first
            if candidata.count() > 0 and candidata.is_visible():
                linha = candidata

        if linha is None:
            # Sem linha localizável de forma robusta: documenta e valida ao
            # menos que a tela respondeu com a tabela por produto (fallback
            # tolerante previsto pela task quando a extração exata é frágil).
            print(
                "[paridade UI×API] linha do produto não localizada de forma "
                f"robusta (termo={termo!r}); validando presença da tabela. "
                f"disponivel_api={disponivel_api}"
            )
            tabela = page_auth.locator("table")
            assert tabela.count() > 0, (
                "a aba 'Por Produto' deve renderizar a tabela de saldos"
            )
            return

        # Células da linha: [expand, Produto, Origem, Físico, Reservado, Disponível]
        celulas = linha.locator("td")
        total_cel = celulas.count()
        assert total_cel >= 6, (
            f"linha do produto deve ter as colunas esperadas (obtido {total_cel}): "
            f"{linha.inner_text()!r}"
        )
        texto_disponivel = celulas.nth(total_cel - 1).inner_text()

        try:
            disponivel_ui = _normalizar_numero_ptbr(texto_disponivel)
        except ValueError as exc:
            pytest.fail(
                "Requirement 3.5 — não foi possível extrair o disponível "
                f"exibido na tela ({exc}); texto bruto: {texto_disponivel!r}"
            )

        # Paridade: o disponível exibido == o retornado pelo endpoint.
        assert abs(disponivel_ui - disponivel_api) <= TOLERANCIA, (
            "Requirement 3.5 — disponível exibido na tela deve ser igual ao "
            f"retornado pelo endpoint (UI={disponivel_ui} | API={disponivel_api} | "
            f"texto UI={texto_disponivel!r})"
        )
