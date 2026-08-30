"""Sondagem: docas e config de agenda na demo. python _sondar_agenda.py"""
from playwright.sync_api import sync_playwright
from conftest import BASE_URL, EMAIL, PASSWORD, API_URL
from wms_api import WmsApiClient


def main():
    p = sync_playwright().start(); b = p.chromium.launch(headless=True)
    c = b.new_context(ignore_https_errors=True); pg = c.new_page()
    pg.goto(f"{BASE_URL}/login"); pg.wait_for_load_state("networkidle")
    pg.get_by_label("Email").fill(EMAIL); pg.get_by_label("Senha").fill(PASSWORD)
    pg.get_by_role("button", name="Entrar").click()
    pg.wait_for_url("**/selecionar-empresa", timeout=20000); pg.wait_for_load_state("networkidle")
    cards = pg.locator('[class*="Card"]'); cards.first.wait_for(timeout=15000); cards.first.click()
    pg.wait_for_url("**/modulos", timeout=15000)
    tok = pg.evaluate("() => localStorage.getItem('visiofab-wms-token')")
    api = WmsApiClient(c.request, API_URL, tok)

    docas = api.listar_docas(limit=50)
    print(f"docas: {len(docas)}")
    for d in docas[:8]:
        print(f"  - {d.get('id')} desc={d.get('descricao') or d.get('nome')} tipo={d.get('tipo')}")
    rc = api._get("/agenda-doca/config")
    print(f"config agenda: {rc.json() if rc.ok else rc.status}")
    c.close(); b.close(); p.stop()


if __name__ == "__main__":
    main()
