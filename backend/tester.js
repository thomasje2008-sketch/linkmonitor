const puppeteer = require('puppeteer');

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
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-extensions',
      '--disable-software-rasterizer',
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  try {
    await page.goto(urlInicial, { waitUntil: 'load', timeout: 30000 });
    await delay(3000);
    const urlFinal = page.url();
    return { sucesso: true, urlFinal: normalizarUrl(urlFinal) };
  } catch (erro) {
    return { sucesso: false, urlFinal: 'ERRO', erro: erro.message };
  } finally {
    await browser.close();
  }
}

function calcularParcial(contagem, tentativas) {
  return Object.entries(contagem).map(([dest, count]) => ({
    url: dest,
    count,
    percentage: parseFloat(((count / tentativas) * 100).toFixed(2))
  })).sort((a, b) => b.percentage - a.percentage);
}

async function runTest(url, tentativas = 100, onProgress = () => {}) {
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

    // Notifica progresso a cada tentativa
    const parcial = calcularParcial(contagem, i + 1);
    onProgress(i + 1, tentativas, parcial);

    if (i < tentativas - 1) {
      await delay(Math.floor(Math.random() * 1500) + 1000);
    }
  }

  const results = calcularParcial(contagem, tentativas);
  return { results, total: tentativas, errors: erros };
}

module.exports = { runTest };
