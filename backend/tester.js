const { chromium } = require('playwright');

const TRACKING_PARAMS = [
  'fbclid', 'twrclid', 'utm_source', 'utm_medium', 'utm_campaign',
  'utm_content', 'utm_term', 'utm_id', 'xid', 'campaign_id',
  'rtkcid', 'rtkcmpid', 'gclid', 'msclkid', 'ttclid'
];

function normalizarUrl(urlBruta) {
  try {
    const parsed = new URL(urlBruta);
    TRACKING_PARAMS.forEach(p => parsed.searchParams.delete(p));
    const resultado = parsed.toString();
    return resultado.endsWith('?') ? resultado.slice(0, -1) : resultado;
  } catch {
    return urlBruta;
  }
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function testarUmaVez(urlInicial) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
  });

  const page = await context.newPage();

  try {
    await page.goto(urlInicial, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    const urlFinal = page.url();
    return { sucesso: true, urlFinal: normalizarUrl(urlFinal) };
  } catch (erro) {
    return { sucesso: false, urlFinal: 'ERRO', erro: erro.message };
  } finally {
    await browser.close();
  }
}

async function runTest(url, tentativas = 100) {
  const contagem = {};
  let erros = 0;

  for (let i = 0; i < tentativas; i++) {
    const resultado = await testarUmaVez(url);

    if (resultado.sucesso) {
      const dest = resultado.urlFinal;
      contagem[dest] = (contagem[dest] || 0) + 1;
    } else {
      erros++;
    }

    if (i < tentativas - 1) {
      await delay(Math.floor(Math.random() * 1500) + 1000);
    }
  }

  const total = tentativas - erros;
  const results = Object.entries(contagem).map(([dest, count]) => ({
    url: dest,
    count,
    percentage: total > 0 ? parseFloat(((count / tentativas) * 100).toFixed(2)) : 0
  })).sort((a, b) => b.percentage - a.percentage);

  return { results, total: tentativas, errors: erros };
}

module.exports = { runTest };
