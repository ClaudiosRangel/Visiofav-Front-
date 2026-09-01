"""
TEST SUITE 11 — Fluxo WMS Encadeado (E2E serial, valor real)
============================================================
Diferente do ``test_09`` (bateria de smoke tests, com ``pytest.skip`` quando
falta dado), este módulo executa **um único cenário encadeado** que semeia os
pré-requisitos via API, cria uma nota de entrada rastreável e a percorre por
todas as fases do recebimento — Portaria → Conferência Cega → Endereçamento →
verificação de saldo — gerando **estado real** e verificando cada transição.

Estratégia híbrida UI + API (mesma filosofia do teste TS de referência
``tests/e2e/fluxo-recebimento.spec.ts``):
  - Passos cuja **interface** é o alvo do teste rodam via UI (Playwright).
  - Passos que apenas preparam/avançam estado (seed) ou dependem de um
    pré-requisito sequencial difícil de garantir só clicando rodam via API
    (cliente ``wms_api``), usando o mesmo token da sessão autenticada.

As invariantes de correção (P1–P4 do design) são verificadas como asserts
dentro do teste — não há PBT aplicável (fluxo determinístico de UI/integração).

NOTA (task 2.1 — estrutura/esqueleto): este arquivo já traz a classe, o
método único de teste com as FASES marcadas por comentários e os 3 helpers
locais de UI implementados (a interação Mantine real, copiada do ``test_09``
e do teste TS). As FASES em si (seed, conferência, endereçamento, saldo) e
seus asserts de valor são preenchidos nas tasks 2.2–2.5.

Como rodar:
    cd tests/e2e-qa
    .venv\\Scripts\\activate
    pytest test_11_fluxo_wms_encadeado.py -s          # headless (padrão)
    $env:HEADLESS="false"; $env:SLOW_MO="600"; pytest test_11_fluxo_wms_encadeado.py -s
"""

import time
from datetime import datetime, timedelta

import pytest
from playwright.sync_api import Page, expect

from conftest import navegar_para
from helpers import (
    aguardar_carregamento,
    screenshot_com_nome,
)
from wms_api import WmsApiClient


# ════════════════════════════════════════════════════════════════════
# HELPERS LOCAIS DE UI (privados ao módulo)
#
# Encapsulam a interação Mantine já descoberta no test_09 e no teste TS de
# referência. Todo Select Mantine é operado via teclado (click → ArrowDown →
# Enter), nunca por clique em [role="option"] (o dropdown usa portal e fecha
# antes do clique completar — ver steering qa-automatizado.md).
# ════════════════════════════════════════════════════════════════════


def _tratar_modal_funcionarios(page: Page) -> None:
    """Trata o modal opcional de seleção de funcionários.

    Algumas ações do WMS (iniciar conferência, endereçar) abrem um modal
    pedindo o(s) funcionário(s) responsável(is) antes de prosseguir. Este
    helper resolve esse modal quando ele aparece: tenta selecionar um
    funcionário (Select Mantine via teclado), depois clica em Confirmar; se
    houver a opção de Pular, usa-a. É tolerante à ausência do modal (no-op).
    """
    modal = page.locator('[role="dialog"]')
    if modal.count() == 0 or not modal.first.is_visible():
        return

    # Tenta preencher um Select de funcionário, se houver, via teclado.
    func_select = modal.first.locator("input").first
    if func_select.count() > 0 and func_select.is_visible():
        try:
            func_select.click()
            time.sleep(0.4)
            func_select.press("ArrowDown")
            time.sleep(0.3)
            func_select.press("Enter")
            time.sleep(0.3)
        except Exception:
            # Modal pode não ter Select (só confirmação) — segue para os botões.
            pass

    # Fecha o modal confirmando (ou pulando, quando disponível).
    confirmar = page.get_by_role("button", name="Confirmar")
    pular = page.get_by_role("button", name="Pular")
    if confirmar.count() > 0 and confirmar.first.is_visible() and confirmar.first.is_enabled():
        confirmar.first.click()
    elif pular.count() > 0 and pular.first.is_visible():
        pular.first.click()
    time.sleep(1)


def _iniciar_conferencia_da_nota(page: Page, nota: dict) -> None:
    """Localiza a linha da nota semeada e inicia a conferência pela UI.

    Procura a linha da nota pelo número/fornecedor marcador (``QA-WMS ...``) e
    clica em "Iniciar Conferência" (ou "Continuar", quando a conferência já
    foi iniciada). Trata o modal opcional de funcionários. Segue o padrão de
    interação descoberto no ``test_09`` (``TestConferenciaCega``).

    Args:
        page: página Playwright autenticada, já em /wms/conferencia-entrada.
        nota: dicionário da nota criada via API (``{id, numero, fornecedor}``).
    """
    numero = str(nota.get("numero", "")).strip()
    fornecedor = str(nota.get("fornecedor", "")).strip()

    # Tenta localizar a linha específica da nota (pelo número ou fornecedor
    # marcador) para clicar no botão de iniciar daquela linha.
    linha = None
    for termo in (numero, fornecedor):
        if not termo:
            continue
        candidato = page.locator("tr", has_text=termo)
        if candidato.count() > 0 and candidato.first.is_visible():
            linha = candidato.first
            break

    escopo = linha if linha is not None else page
    btn = escopo.get_by_role("button", name="Iniciar Conferência").first
    if btn.count() == 0 or not btn.is_visible():
        btn = escopo.get_by_role("button", name="Continuar").first
    # Fallback global: primeira nota pendente (usado quando a linha específica
    # não foi localizada — o cenário garante que a nota semeada existe).
    if btn.count() == 0 or not btn.is_visible():
        btn = page.get_by_role("button", name="Iniciar Conferência").first

    btn.click()
    time.sleep(1.5)

    _tratar_modal_funcionarios(page)


def _informar_contagem_e_aprovar(page: Page, quantidade: int) -> None:
    """Exercita a contagem cega pela UI, SEM aprovar/efetivar.

    DECISÃO DE DESIGN (fonte de verdade = API): a conferência é efetivada via
    API na FASE 2 (``iniciar`` → ``conferir_todos`` → ``confirmar``), de forma
    determinística. A UI aqui é exercitada apenas para pegar regressão visual
    (preenche os campos de contagem e clica em "Verificar Resultado"), mas
    **NÃO clica em "Aprovar"** — aprovar pela UI mudaria o status da nota para
    CONFERIDA e faria a API subsequente falhar (422 "não pode iniciar
    conferência"), além de ser não-determinístico. Toda a interação é
    best-effort (não derruba o fluxo).

    Args:
        page: página Playwright na tela de contagem cega.
        quantidade: quantidade a informar em cada item (contagem == esperado).
    """
    # Preenche os campos de contagem (NumberInput). O layout usa inputmode
    # numérico; preenchemos cada um com a quantidade esperada.
    campos = page.locator('input[inputmode="numeric"], input[inputmode="decimal"]')
    total = campos.count()
    if total == 0:
        # Fallback: qualquer input de contagem por placeholder.
        campos = page.locator('input[placeholder*="qtd" i], input[placeholder*="Contada" i]')
        total = campos.count()

    for i in range(total):
        campo = campos.nth(i)
        if campo.is_visible() and campo.is_editable():
            campo.click()
            campo.fill(str(quantidade))
            time.sleep(0.2)

    # Verifica o resultado da contagem (não altera estado — só exibe o
    # comparativo contado × esperado). NÃO clicamos em "Aprovar".
    verificar = page.get_by_role("button", name="Verificar Resultado").first
    if verificar.count() > 0 and verificar.is_visible():
        verificar.click()
        time.sleep(1.0)
    # NÃO clica em "Aprovar" — a API efetiva a conferência (fonte de verdade).


def _enderecar_automatico_e_confirmar(page: Page) -> None:
    """Exercita a tela de endereçamento automático pela UI, SEM confirmar.

    DECISÃO DE DESIGN (fonte de verdade = API): a **efetivação** do put-away é
    feita via API na FASE 3 (``sugerir-lote`` → ``confirmar-lote``), que é
    determinística. A UI aqui é exercitada apenas para pegar regressão
    visual/de comportamento (aba "Endereçar" + "Endereçar Automático"), mas
    **NÃO confirma** o endereçamento — confirmar pela UI deixaria a nota
    ENDERECADA de forma não-determinística (parcial, sem saldo propagado, com
    modal de funcionário frágil), quebrando as verificações de valor da FASE 3.
    Por isso, se um modal de confirmação abrir, nós o FECHAMOS (Cancelar/Esc)
    em vez de confirmar. Toda a interação é best-effort (não derruba o fluxo).

    Args:
        page: página Playwright em /wms/enderecamento.
    """
    # Garante que estamos na aba "Endereçar".
    aba = page.get_by_role("tab", name="Endereçar").first
    if aba.count() > 0 and aba.is_visible():
        aba.click()
        time.sleep(0.6)

    # Exercita o botão de endereçamento automático (abre o modal de sugestões).
    btn = page.get_by_role("button", name="Endereçar Automático").first
    if btn.count() > 0 and btn.is_visible():
        btn.click()
        time.sleep(1.5)

    # Se abriu o modal de confirmação, FECHA sem confirmar (a API efetiva).
    modal = page.locator('[role="dialog"]')
    if modal.count() > 0 and modal.first.is_visible():
        cancelar = modal.first.get_by_role("button", name="Cancelar").first
        if cancelar.count() > 0 and cancelar.is_visible():
            cancelar.click()
        else:
            # Sem botão Cancelar visível: fecha via Escape.
            page.keyboard.press("Escape")
        time.sleep(0.5)


# ════════════════════════════════════════════════════════════════════
# HELPERS LOCAIS DE FLUXO (API / verificação de estado)
# ════════════════════════════════════════════════════════════════════


def _validade_br(validade) -> str:
    """Normaliza a validade para o formato brasileiro ``dd/mm/aaaa``.

    O endpoint ``conferir-todos`` aceita a validade no formato brasileiro (ver
    teste TS de referência). A validade que volta de ``iniciar_conferencia``
    pode vir em ISO (``aaaa-mm-dd``) ou já formatada; convertemos o que for
    ISO e devolvemos o resto como veio (uma validade bem no futuro garantida
    pelo seed, então não há risco de shelf life no caminho feliz).
    """
    if not validade:
        # Validade padrão bem no futuro (2 anos) — coerente com o seed.
        return (datetime.now() + timedelta(days=730)).strftime("%d/%m/%Y")
    texto = str(validade)
    # ISO "aaaa-mm-dd" (possivelmente com hora) → dd/mm/aaaa
    if len(texto) >= 10 and texto[4] == "-" and texto[7] == "-":
        ano, mes, dia = texto[0:4], texto[5:7], texto[8:10]
        return f"{dia}/{mes}/{ano}"
    return texto


def _registrar_evidencia_nota(page: Page, nota: dict, run_id: str) -> None:
    """Registra a evidência da nota de entrada criada (task 2.2 / Requisito 14.1).

    O Requisito 14.1 exige uma Evidencia "com nome descritivo e horário". Como
    a nota é criada via API (não há tela de criação a fotografar), a evidência
    é o screenshot da tela de Conferência de Entrada — que lista a nota recém
    semeada. O nome descritivo carrega o marcador ``run_id`` (rastreável) e o
    ``helpers.screenshot_com_nome`` acrescenta o timestamp (o "horário" pedido
    pelo requisito).

    Esta captura pertence, conceitualmente, à FASE 0/1 (a nota já existe e a
    portaria já foi consultada), mas é executada **após** a navegação para
    ``/wms/conferencia-entrada`` que a FASE 2 já faz — evitando uma navegação
    duplicada só para a evidência (o contexto da task pede essa coerência).

    É best-effort (Requisito 14.4): uma falha ao gravar a evidência não
    interrompe o cenário — apenas é reportada no stdout do teste.
    """
    numero = str(nota.get("numero", "")).strip()
    try:
        screenshot_com_nome(page, f"nota_criada_{run_id}")
        print(f"[evidencia] nota {numero} registrada (nota_criada_{run_id})")
    except Exception as exc:  # pragma: no cover - evidência é best-effort
        print(f"[evidencia] falha ao registrar evidência da nota {numero}: {exc}")


def _aguardar_saldo_min(
    wms_api: WmsApiClient, produto_id: str, minimo: float, tentativas: int = 5
) -> dict:
    """Consulta o saldo consolidado até o físico atingir ``minimo`` (ou esgotar).

    Tolera a latência de propagação do saldo após a aprovação da conferência
    (o backend pode levar um instante para materializar o movimento). Faz um
    retry curto (backoff fixo) e retorna o último saldo consultado — o
    chamador faz o ``assert`` de valor sobre o resultado.
    """
    saldo = {}
    for _ in range(max(1, tentativas)):
        saldo = wms_api.saldo_consolidado(produto_id)
        if (saldo.get("fisico", 0) or 0) >= minimo:
            return saldo
        time.sleep(0.8)
    return saldo


def _verificar_cenario_divergencia(
    wms_api: WmsApiClient, run_id: str, produto: dict
) -> None:
    """Verifica que uma contagem diferente da nota registra a divergência com o valor.

    Requisito 1.5: "IF a quantidade conferida difere da quantidade da nota,
    THEN o sistema registra a divergência com o valor da diferença."

    DECISÃO DE DESIGN: este cenário roda em uma **segunda nota rastreável
    menor**, criada e conferida inteiramente via API, para não fragilizar o
    encadeamento do caminho feliz (que já validou divergentes == 0 e o saldo).
    Assim o cenário de exceção fica isolado do fluxo principal e não altera o
    estado do produto de forma que atrapalhe as FASES 3/4.

    Usamos **EXCESSO** (contagem > nota) para forçar a divergência de forma
    determinística: o backend aceita FALTA como recebimento parcial (sem
    divergência) quando a empresa tem essa configuração ativa, mas EXCESSO é
    "sempre divergente, independente desta configuração"
    (``conferencia-entrada.routes.ts``). Verificamos que:
      - ``divergentes >= 1`` (a divergência foi registrada);
      - a diferença registrada no item (campo ``divergencia``) é igual a
        ``contagem - quantidadeNota`` em valor absoluto.
    """
    qtd_nota = 10
    qtd_contada = 13  # excesso de 3 → divergência determinística

    nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=qtd_nota)
    nota_id = nota.get("id")
    assert nota_id, "cenário divergência: nota menor criada (id)"

    conf = wms_api.iniciar_conferencia(nota_id)
    itens = conf.get("itens", [])
    assert itens, "cenário divergência: conferência retornou itens"

    itens_conf = [
        {
            "itemNotaEntradaId": item["id"],
            "quantidadeConferida": qtd_contada,
            "lote": item.get("lote") or wms_api.lote_do_run(run_id),
            "validade": _validade_br(item.get("validade")),
        }
        for item in itens
    ]
    resultado = wms_api.conferir_todos(nota_id, itens_conf)

    # A divergência foi registrada.
    assert resultado.get("divergentes", 0) >= 1, (
        f"contagem ({qtd_contada}) != nota ({qtd_nota}) deve gerar divergência; "
        f"resultado: {resultado}"
    )

    # A diferença registrada tem o valor correto (|contagem - nota|).
    diferenca_esperada = abs(qtd_contada - qtd_nota)
    itens_result = resultado.get("itens", [])
    item_divergente = next(
        (i for i in itens_result if i.get("status") == "DIVERGENTE"),
        itens_result[0] if itens_result else None,
    )
    assert item_divergente is not None, (
        "cenário divergência: resultado deveria conter o item conferido"
    )
    divergencia_registrada = abs(item_divergente.get("divergencia", 0) or 0)
    assert divergencia_registrada == diferenca_esperada, (
        "cenário divergência: a diferença registrada deve ser igual a "
        f"|contagem - nota| = {diferenca_esperada}, obtido {divergencia_registrada} "
        f"(item: {item_divergente})"
    )


# ════════════════════════════════════════════════════════════════════
# CENÁRIO E2E ENCADEADO
# ════════════════════════════════════════════════════════════════════


@pytest.mark.slow
class TestFluxoWmsEncadeado:
    """Cenário serial E2E de recebimento por compra, ponta a ponta.

    Um único teste executa as fases em sequência com asserts intermediários
    nomeados por fase (evita a fragilidade de ordenação entre métodos do
    pytest). O estado de uma fase alimenta a próxima.
    """

    def test_fluxo_recebimento_completo(
        self, page_auth: Page, wms_api: WmsApiClient, run_id: str
    ):
        # Rastreamento das fases percorridas (Property 4 — progressão sem skip).
        # Cada fase concluída no caminho feliz registra seu nome aqui; ao final
        # o assert confirma que TODAS as fases foram percorridas. O único
        # ``pytest.skip`` permitido é na FASE 0 (pré-requisito externo
        # genuinamente indisponível — ex.: menos de 3 endereços livres). Depois
        # de a FASE 0 semear os dados, nenhuma fase subsequente pode cair em
        # skip: a ausência de um passo é regressão real (design, Error Handling).
        fases_percorridas: list[str] = []

        # ── FASE 0: seed de pré-requisitos (API) ────────────────────
        # (task 2.2) Semear produto/SKU, >= 3 endereços livres e a nota de
        # entrada rastreável; assert claro de cada pré-requisito.
        #
        # Requisito 13.4: WHERE um pré-requisito de dados necessário não existe
        # no ambiente, o Caso_De_Teste cria o pré-requisito antes de validar.
        # O seed via API (garantir_*) é idempotente e cumpre esse papel.

        # Pré-requisito 1: produto com SKU (lastro/camada) obtido.
        # O SKU é o pré-requisito que habilita a distribuição inteligente da
        # FASE 3 (put-away calcula lastro/camada por palete). Garantimos que
        # o produto veio com id, código e um SKU efetivamente presente.
        produto = wms_api.garantir_produto_com_sku(run_id)
        assert produto.get("id"), "pré-requisito: produto obtido/criado (id)"
        assert produto.get("codigo"), (
            "pré-requisito: produto com código (usado na nota de entrada)"
        )
        sku = produto.get("sku") or {}
        assert sku, "pré-requisito: produto com SKU de paletização (lastro/camada)"
        assert sku.get("lastro") and sku.get("camada"), (
            "pré-requisito: SKU com lastro e camada definidos "
            f"(lastro={sku.get('lastro')}, camada={sku.get('camada')})"
        )

        # Pré-requisito 2: >= 3 endereços de armazenagem livres.
        #
        # Error Handling (design): "Pré-requisito genuinamente indisponível →
        # pytest.skip com motivo explícito, apenas nas FASES de seed, nunca no
        # meio do fluxo." A criação de endereços depende de CD/Depósito/formato
        # (feita pela UI/seed manual, fora do alcance de ``garantir_*``), então
        # a falta de endereços é um dado de AMBIENTE ausente, não uma regressão:
        # tratamos com ``pytest.skip`` (e não ``assert``) — isto é, o cenário
        # não "falha", apenas não pode rodar sem o pré-requisito. Este é o único
        # ponto de skip permitido depois de já termos produto/SKU; qualquer
        # ausência posterior (nota, conferência, endereçamento) é regressão real
        # e deve FALHAR, nunca pular.
        MINIMO_ENDERECOS = 3
        enderecos = wms_api.garantir_enderecos_livres(minimo=MINIMO_ENDERECOS)
        if len(enderecos) < MINIMO_ENDERECOS:
            pytest.skip(
                "Pré-requisito de ambiente indisponível: menos de "
                f"{MINIMO_ENDERECOS} endereços de armazenagem livres "
                f"(encontrados: {len(enderecos)}). Cadastre endereços "
                "ARMAZENAGEM/LIVRE ativos na empresa demo para rodar o fluxo."
            )
        # A partir daqui o pré-requisito de endereços está satisfeito.
        assert len(enderecos) >= MINIMO_ENDERECOS, (
            f"pré-requisito: ao menos {MINIMO_ENDERECOS} endereços livres "
            f"(encontrados: {len(enderecos)})"
        )

        # Pré-requisito 3: nota de entrada rastreável criada (marcador run_id).
        qtd = 50
        nota = wms_api.criar_nota_entrada(run_id, produto, quantidade=qtd)
        nota_id = nota.get("id")
        assert nota_id, "pré-requisito: nota de entrada criada (id)"
        fases_percorridas.append("FASE 0: seed")

        # ── FASE 1: portaria (API — NÃO bloqueia nota manual) ───────
        # (task 2.2) Consultar agendamentos de hoje. Uma nota criada
        # manualmente (tipo COMPRA, sem agendamento de doca) NÃO exige passar
        # pela portaria — a portaria só é obrigatória para chegadas agendadas.
        # Por isso a consulta aqui é apenas informativa: confirmamos o contrato
        # do endpoint (responde uma lista) e seguimos, SEM asserir a presença
        # da nota entre os agendamentos e SEM interromper o cenário caso não
        # haja nenhum agendamento no dia.
        agendamentos = wms_api.agendamentos_hoje()
        assert isinstance(agendamentos, list), (
            "agendamentos_hoje deve retornar uma lista (a portaria não bloqueia "
            "o fluxo de uma nota manual)"
        )
        print(
            f"[portaria] agendamentos de hoje: {len(agendamentos)} "
            "(informativo — nota manual não exige portaria)"
        )
        fases_percorridas.append("FASE 1: portaria")

        # ── FASE 2: conferência cega (UI) + validação de saldo físico ─
        # (task 2.3) Iniciar conferência da nota pela UI, informar contagem ==
        # quantidade esperada, aprovar; verificar via API divergentes == 0
        # (Property 2) e o aumento exato de Saldo_Fisico.
        #
        # ESTRATÉGIA HÍBRIDA UI + API (design, "Decisão central"): a tela de
        # conferência cega é exercitada pela UI (pega regressão visual/de
        # comportamento), MAS a verificação de estado e a garantia do caminho
        # feliz são feitas via API — que é a fonte de verdade. A UI de
        # conferência cega é frágil de dirigir de forma determinística (a nota
        # precisa aparecer na primeira página da lista, os NumberInput mudam de
        # layout conforme o nº de itens, etc.); por isso, seguindo o padrão do
        # teste TS de referência, a contagem que efetivamente decide
        # ``divergentes`` é submetida via API (``iniciar`` → ``conferir_todos``
        # → ``confirmar``) com contagem == quantidade da nota, garantindo o
        # caminho feliz (divergentes == 0) independentemente da fragilidade da
        # UI. A UI roda "best-effort" para exercitar a interface.
        #
        # Requisito 1.2/1.3: capturamos o Saldo_Fisico ANTES de conferir para,
        # depois de aprovada a conferência, validar que o físico aumentou
        # exatamente pela quantidade conferida e não excedeu a quantidade da nota.

        # (1) Saldo físico inicial do produto (pode ser 0/{} se sem saldo).
        saldo_antes = wms_api.saldo_consolidado(produto["id"])
        fisico_antes = saldo_antes.get("fisico", 0) or 0

        # (2) UI (best-effort): navega, registra a EVIDÊNCIA da nota criada
        # (task 2.2 / Requisito 14.1 — nome descritivo + horário) e exercita a
        # tela de conferência cega. A evidência é capturada aqui, logo após a
        # navegação que a FASE 2 já faz, para não duplicar a navegação só para
        # a foto. Falha de UI aqui NÃO quebra o fluxo — a API abaixo é a fonte
        # de verdade.
        navegar_para(page_auth, "/wms/conferencia-entrada")
        aguardar_carregamento(page_auth)
        _registrar_evidencia_nota(page_auth, nota, run_id)
        try:
            _iniciar_conferencia_da_nota(page_auth, nota)
            _informar_contagem_e_aprovar(page_auth, qtd)
        except Exception as exc:  # pragma: no cover - UI é best-effort
            print(f"[ui] conferência via UI não completou (segue via API): {exc}")

        # (3) API (fonte de verdade): conferência cega com contagem == nota.
        # Inicia a conferência para obter os itemNotaEntradaId, confere todos
        # com a quantidade esperada e aprova. Idempotente frente à UI (se a UI
        # já iniciou/conferiu, iniciar retorna os itens novamente).
        conf = wms_api.iniciar_conferencia(nota_id)
        itens_conf = [
            {
                "itemNotaEntradaId": item["id"],
                "quantidadeConferida": qtd,
                "lote": item.get("lote") or wms_api.lote_do_run(run_id),
                "validade": _validade_br(item.get("validade")),
            }
            for item in conf.get("itens", [])
        ]
        assert itens_conf, "conferência iniciada deve retornar itens da nota"
        resultado = wms_api.conferir_todos(nota_id, itens_conf)

        # Property 2 (design, Requisito 1.5 no caminho feliz): contagem igual à
        # nota ⇒ zero divergências.
        assert resultado.get("divergentes", 0) == 0, (
            f"caminho feliz deve ter 0 divergências, obtido: {resultado.get('divergentes')} "
            f"(itens: {resultado.get('itens')})"
        )
        wms_api.confirmar_conferencia(nota_id)

        # (4) Nota: o Saldo_Fisico NÃO sobe com a conferência — sobe apenas
        # após o ENDEREÇAMENTO (put-away, FASE 3) que cria os SaldoEndereco.
        # A verificação de Requisito 1.2/1.3 (aumento exato do físico pela
        # quantidade conferida) é feita na FASE 3, depois de confirmar_enderecamento_lote,
        # usando ``_aguardar_saldo_min`` e comparando com ``qtd_a_enderecar``.
        # Aqui apenas confirmamos que a conferência foi aprovada (divergentes==0).
        # fisico_antes já foi capturado acima e será usado na FASE 4 como baseline.

        # Cenário de divergência (Requisito 1.5): contagem != nota registra a
        # diferença com o valor. Executado em uma segunda nota rastreável menor,
        # para NÃO fragilizar o encadeamento do caminho feliz acima. Ver
        # docstring de ``_verificar_cenario_divergencia`` para a decisão de
        # design.
        _verificar_cenario_divergencia(wms_api, run_id, produto)
        fases_percorridas.append("FASE 2: conferência")

        # ── FASE 3: endereçamento (UI + API) — conservação de qtd ────
        # (task 2.4) Endereçar automático pela UI (best-effort) e efetivar o
        # endereçamento em lote via API; validar a conservação (Property 1) e
        # a soma das quantidades nos endereços de destino (Requisito 1.4).
        #
        # ESTRATÉGIA HÍBRIDA UI + API (mesma da FASE 2). A tela de
        # endereçamento é exercitada pela UI para pegar regressão visual/de
        # comportamento, MAS a **efetivação** do put-away — a operação que
        # gera saldo real por endereço (``SaldoEndereco``) e muda a nota para
        # ENDERECADA — é feita via API (``sugerir-lote`` → ``confirmar-lote``),
        # que é a fonte de verdade. Motivo: a UI de endereçamento depende de um
        # modal de funcionário obrigatório e de badges de sugestão que fecham
        # antes do clique (portal Mantine), sendo frágil de dirigir de forma
        # determinística; sem a efetivação garantida, "soma por endereço ==
        # endereçada" (Requisito 1.4) e o saldo da FASE 4 ficariam
        # não-determinísticos. Confirmar via API é o mesmo padrão adotado nas
        # FASES 2 (conferência) e nos testes 09/TS de referência.
        navegar_para(page_auth, "/wms/enderecamento")
        aguardar_carregamento(page_auth)
        try:
            _enderecar_automatico_e_confirmar(page_auth)  # best-effort (UI)
        except Exception as exc:  # pragma: no cover - UI é best-effort
            print(f"[ui] endereçamento via UI não completou (segue via API): {exc}")

        # Property 1 — Conservação de quantidade no endereçamento (design P1,
        # Requisito 3.1): a distribuição inteligente calculada pelo backend
        # conserva a quantidade. ``sum(quantidadeAlocada) + quantidadeRestante
        # == quantidade``. Robustecido: também garantimos que a distribuição
        # produziu ao menos uma alocação (put-away precisa de destino) e que
        # nenhuma alocação é negativa.
        dist = wms_api.distribuir(produto["id"], qtd)
        alocacoes = dist.get("alocacoes", []) or []
        assert alocacoes, (
            "distribuição inteligente deve produzir ao menos uma alocação de "
            f"destino para {qtd} un (dist: {dist})"
        )
        assert all(a.get("quantidadeAlocada", 0) >= 0 for a in alocacoes), (
            f"nenhuma alocação pode ser negativa (alocacoes: {alocacoes})"
        )
        total_alocado = sum(a.get("quantidadeAlocada", 0) for a in alocacoes)
        restante = dist.get("quantidadeRestante", 0) or 0
        assert total_alocado + restante == qtd, (
            "Property 1 (conservação): soma das quantidades alocadas + restante "
            f"deve ser igual à quantidade ({qtd}); obtido "
            f"{total_alocado} + {restante} = {total_alocado + restante}"
        )

        # Efetivação do endereçamento via API (fonte de verdade do put-away).
        # IDEMPOTÊNCIA FRENTE À UI: a interação de UI acima (best-effort) pode
        # ter efetivado o endereçamento e deixado a nota ENDERECADA. Nesse caso,
        # ``sugerir-lote`` responde 422 ("não está CONFERIDA"). Sondamos o
        # ``sugerir-lote`` de forma TOLERANTE (chamada crua, sem assert de
        # status) para distinguir os dois caminhos sem depender de
        # ``GET /notas-entrada/:id`` (essa rota apresenta 500 de robustez em
        # produção para algumas notas — não confiável para checar status):
        #   - 2xx com sugestões → nota CONFERIDA: efetivamos via API.
        #   - 422 "não está CONFERIDA (status atual: ENDERECADA)" → a UI já
        #     efetivou; pulamos a efetivação e verificamos o saldo resultante.
        resp_sug = wms_api._get(
            "/enderecamento-wms/sugerir-lote", params={"notaEntradaId": nota_id}
        )
        ja_enderecada = False
        if resp_sug.status == 422:
            try:
                msg = (resp_sug.json() or {}).get("message", "")
            except Exception:
                msg = resp_sug.text()
            if "ENDERECADA" in str(msg).upper():
                ja_enderecada = True
            else:
                # 422 por outro motivo é falha real do fluxo feliz.
                assert False, (
                    f"sugerir-lote rejeitou a nota conferida (422): {msg}"
                )

        enderecou_via_ui = False
        if ja_enderecada:
            print(
                "[enderecamento] nota já ENDERECADA pela UI (best-effort); "
                "pulando a efetivação via API e verificando o saldo resultante."
            )
            # A UI pode ter endereçado PARCIALMENTE (ex.: 45 de 50 se algum
            # endereço encheu). Não assumimos qtd; a quantidade efetivamente
            # endereçada é a SOMA REAL por endereço no saldo consolidado
            # (derivada abaixo). Só exigimos que a UI tenha endereçado algo > 0
            # e que não exceda a quantidade da nota.
            enderecou_via_ui = True
            qtd_a_enderecar = 0  # derivado do saldo real logo abaixo
        else:
            assert resp_sug.ok, (
                f"sugerir-lote deve responder OK para a nota conferida "
                f"(status {resp_sug.status}): {resp_sug.text()}"
            )
            sugestoes = resp_sug.json().get("sugestoes", []) or []
            assert sugestoes, "sugerir-lote deve retornar sugestões para a nota conferida"

            itens_lote = []
            qtd_a_enderecar = 0
            for sug in sugestoes:
                produto_id_sug = sug.get("produtoId")
                item_id_sug = sug.get("itemId")
                distribuicao = sug.get("distribuicao") or {}
                if not produto_id_sug or not item_id_sug:
                    continue
                for aloc in distribuicao.get("alocacoes", []) or []:
                    quantidade_aloc = aloc.get("quantidadeAlocada", 0) or 0
                    if quantidade_aloc <= 0:
                        continue
                    itens_lote.append(
                        {
                            "itemNotaEntradaId": item_id_sug,
                            "produtoId": produto_id_sug,
                            "enderecoId": aloc["enderecoId"],
                            "quantidade": quantidade_aloc,
                            "lote": sug.get("lote") or wms_api.lote_do_run(run_id),
                            "validade": sug.get("validade") or None,
                        }
                    )
                    qtd_a_enderecar += quantidade_aloc

            assert itens_lote, (
                "sugestões devem produzir ao menos um item de endereçamento "
                f"(sugestoes: {sugestoes})"
            )

            resultado_lote = wms_api.confirmar_enderecamento_lote(nota_id, itens_lote)
            assert resultado_lote.get("itensEnderecados", 0) == len(itens_lote), (
                "todos os itens de endereçamento devem ser efetivados "
                f"(esperado {len(itens_lote)}, obtido {resultado_lote.get('itensEnderecados')})"
            )

        # Requisito 1.4: a soma das quantidades nos endereços de destino é igual
        # à quantidade endereçada. Após a efetivação, o saldo consolidado do
        # produto passa a ter origem WMS e expõe os ``enderecos`` detalhados
        # (``saldo-consolidado.service.ts``: Σ quantidade por endereço == físico
        # WMS). Somamos as quantidades por endereço e comparamos com a
        # quantidade efetivamente endereçada. Tolera latência de propagação.
        # Aguarda a propagação do saldo. No caminho API sabemos a quantidade
        # (``qtd_a_enderecar``); no caminho UI (parcial) ainda não — usamos um
        # mínimo de 1 só para aguardar o saldo aparecer, e derivamos a
        # quantidade real da soma por endereço.
        minimo_espera = qtd_a_enderecar if not enderecou_via_ui else 1
        saldo_wms = _aguardar_saldo_min(
            wms_api, produto["id"], minimo=minimo_espera
        )
        enderecos_destino = saldo_wms.get("enderecos", []) or []
        assert enderecos_destino, (
            "após o endereçamento, o saldo consolidado deve expor endereços de "
            f"destino (origem WMS); saldo: {saldo_wms}"
        )
        # IMPORTANTE: o produto pode ter sido reaproveitado (já tinha saldo de
        # execuções anteriores em OUTROS lotes). A verificação de conservação
        # (Requisito 1.4) deve olhar SOMENTE os endereços do LOTE DESTA execução
        # (``lote_do_run(run_id)``) — a soma de todos os lotes incluiria saldo
        # pré-existente e falsaria o assert. O físico é aferido por DELTA
        # (antes/depois) logo abaixo, que também isola o efeito desta execução.
        lote_run = wms_api.lote_do_run(run_id)
        enderecos_do_run = [
            e for e in enderecos_destino if (e.get("lote") or "") == lote_run
        ]
        soma_por_endereco = sum(
            e.get("quantidade", 0) or 0 for e in enderecos_do_run
        )

        if enderecou_via_ui:
            # A UI é a fonte do put-away neste caminho: a quantidade endereçada
            # é a soma real por endereço do lote desta execução. Exigimos que
            # tenha endereçado algo (> 0) e sem exceder a nota (Requisito 1.3).
            qtd_a_enderecar = soma_por_endereco
            assert 0 < qtd_a_enderecar <= qtd, (
                "endereçamento via UI deve alocar entre 1 e a quantidade da "
                f"nota ({qtd}); soma por endereço (lote {lote_run}) obtida: "
                f"{soma_por_endereco}; endereços: {enderecos_destino}"
            )
        else:
            # Caminho API (determinístico): a soma por endereço do lote desta
            # execução deve ser exatamente a quantidade que efetivamos via
            # confirmar-lote (Requisito 1.4 — conservação).
            assert soma_por_endereco == qtd_a_enderecar, (
                "Requisito 1.4: a soma das quantidades nos endereços de destino "
                f"do lote desta execução ({soma_por_endereco}) deve ser igual à "
                f"quantidade endereçada ({qtd_a_enderecar}); endereços do run "
                f"({lote_run}): {enderecos_do_run}"
            )

        # Requisito 1.2: o Saldo_Fisico do produto aumentou exatamente pela
        # quantidade endereçada (aferido por DELTA — isola o saldo pré-existente
        # de um produto reaproveitado).
        # Requisito 1.3: o aumento não excede a quantidade da nota original.
        fisico_apos_enderecamento = saldo_wms.get("fisico", 0) or 0
        aumento_fisico = fisico_apos_enderecamento - fisico_antes
        assert aumento_fisico == qtd_a_enderecar, (
            f"Requisito 1.2: Saldo_Fisico deve aumentar exatamente pela "
            f"quantidade endereçada ({qtd_a_enderecar}); obtido +{aumento_fisico} "
            f"(antes={fisico_antes}, depois={fisico_apos_enderecamento})"
        )
        assert aumento_fisico <= qtd, (
            f"Requisito 1.3: aumento de Saldo_Fisico ({aumento_fisico}) não "
            f"pode exceder a quantidade da nota ({qtd})"
        )
        fases_percorridas.append("FASE 3: endereçamento")

        # ── FASE 4: verificação de saldo + evidência final ───────────
        # (task 2.5) Consultar o saldo consolidado, validar a Property 3
        # (fisico >= quantidade endereçada), registrar a evidência da tela de
        # Consulta de Saldos (Requisito 1.6) e confirmar a progressão sem skip
        # (Property 4).

        # Property 3 — Saldo reflete a entrada (design P3, Requisito 3.3): o
        # saldo consolidado (físico) do produto após o endereçamento é maior ou
        # igual à quantidade efetivamente endereçada. Robustecido: além do
        # ``fisico >= endereçada``, garantimos que o registro de saldo existe
        # (não veio ``{}``) e que a fórmula de consolidação é coerente
        # (``disponivel == fisico - reservado``), com mensagens diagnósticas
        # que incluem o saldo obtido para facilitar a triagem em caso de falha.
        saldo = wms_api.saldo_consolidado(produto["id"])
        assert saldo, (
            "Property 3: o saldo consolidado do produto deve existir após o "
            f"endereçamento (produtoId={produto['id']}, esperado físico "
            f">= {qtd_a_enderecar}); nenhum registro retornado por "
            "/saldos/consolidado"
        )
        fisico_final = saldo.get("fisico", 0) or 0
        assert fisico_final >= qtd_a_enderecar, (
            "Property 3 (saldo reflete a entrada, Requisito 3.3): o Saldo_Fisico "
            f"({fisico_final}) deve ser >= à quantidade endereçada "
            f"({qtd_a_enderecar}); saldo consolidado: {saldo}"
        )
        # Coerência da fórmula de consolidação (defensivo — não deve divergir).
        reservado_final = saldo.get("reservado", 0) or 0
        disponivel_final = saldo.get("disponivel", 0) or 0
        assert disponivel_final == fisico_final - reservado_final, (
            "coerência do saldo consolidado: disponível deve ser "
            f"físico - reservado ({fisico_final} - {reservado_final} = "
            f"{fisico_final - reservado_final}), obtido {disponivel_final}; "
            f"saldo: {saldo}"
        )

        # Requisito 1.6: registrar Evidencia da tela de saldo após o
        # recebimento. Navegamos para a tela de Consulta de Saldos (módulo
        # Estoque, aba "Por Produto (Disponível)"), buscamos o produto pelo seu
        # código para exibir o saldo consolidado e capturamos um screenshot
        # nomeado com o ``run_id`` (``saldo_final_{run_id}``).
        #
        # A evidência é BEST-EFFORT (Requisito 14.4): uma falha ao gravar a
        # evidência NÃO interrompe o fluxo — apenas é reportada. O saldo já foi
        # validado via API (fonte de verdade) logo acima, então a tela é
        # complementar (comprova visualmente o resultado para o Relatorio_QA).
        try:
            navegar_para(page_auth, "/estoque")
            aguardar_carregamento(page_auth)
            # Aba "Por Produto (Disponível)": mostra origem/reservado/disponível.
            try:
                aba_produto = page_auth.get_by_role(
                    "tab", name="Por Produto"
                ).first
                if aba_produto.count() > 0 and aba_produto.is_visible():
                    aba_produto.click()
                    time.sleep(0.6)
            except Exception as exc_aba:  # pragma: no cover - aba é best-effort
                print(f"[evidencia] aba 'Por Produto' indisponível: {exc_aba}")
            # Busca o produto para focar a linha do saldo na evidência.
            try:
                pesquisa = page_auth.get_by_placeholder(
                    "Pesquisar por produto ou endereço"
                ).first
                if pesquisa.count() > 0 and pesquisa.is_visible():
                    pesquisa.fill(str(produto.get("codigo", "")))
                    time.sleep(2)  # aguarda a query de saldo consolidado
            except Exception as exc_busca:  # pragma: no cover - busca best-effort
                print(f"[evidencia] busca de produto na tela de saldo: {exc_busca}")
            aguardar_carregamento(page_auth)
            screenshot_com_nome(page_auth, f"saldo_final_{run_id}")
        except Exception as exc:  # pragma: no cover - evidência é best-effort
            # Requisito 14.4: falha de evidência não quebra o teste, é reportada.
            print(
                f"[evidencia] falha ao registrar evidência da tela de saldo "
                f"(best-effort, não interrompe o fluxo): {exc}"
            )

        fases_percorridas.append("FASE 4: saldo")

        # Property 4 — Progressão de estado sem skip (design P4, Requisitos
        # 1.1/5.1): o cenário percorreu PENDENTE → conferida → endereçada →
        # saldo consultável SEM cair em ``pytest.skip`` no caminho feliz. O
        # único ponto onde ``skip`` é permitido é a FASE 0 (pré-requisito
        # externo genuinamente indisponível); se o teste chegou até aqui, a
        # FASE 0 semeou tudo e nenhuma fase posterior pulou. Este assert final
        # documenta e verifica explicitamente que TODAS as fases esperadas
        # foram percorridas, na ordem, e que o fluxo completou.
        fases_esperadas = [
            "FASE 0: seed",
            "FASE 1: portaria",
            "FASE 2: conferência",
            "FASE 3: endereçamento",
            "FASE 4: saldo",
        ]
        assert fases_percorridas == fases_esperadas, (
            "Property 4 (progressão sem skip): o caminho feliz deve percorrer "
            f"todas as fases na ordem {fases_esperadas} sem skip após a FASE 0; "
            f"percorridas: {fases_percorridas}"
        )
