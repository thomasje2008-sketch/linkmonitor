const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { runTest } = require('./tester');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');
const progressMap = {};

// Credenciais e tokens ficam APENAS no servidor
const USUARIO = process.env.AUTH_EMAIL || 'squad7d.s7d@gmail.com';
const SENHA = process.env.AUTH_SENHA || '$7D_senhacompartilhada';
const tokens = new Set();

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ links: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Middleware de autenticação
function auth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// POST login
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (email === USUARIO && senha === SENHA) {
    const token = uuidv4();
    tokens.add(token);
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ error: 'Credenciais inválidas' });
});

// POST logout
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) tokens.delete(token);
  res.json({ ok: true });
});

// GET todos os links monitorados
app.get('/api/links', auth, (req, res) => {
  const db = loadDB();
  res.json(db.links);
});

// POST adicionar novo link
app.post('/api/links', auth, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
  const db = loadDB();
  const newLink = {
    id: uuidv4(),
    name,
    url,
    createdAt: new Date().toISOString(),
    lastTest: null,
    nextTest: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'idle',
    history: []
  };
  db.links.push(newLink);
  saveDB(db);
  res.json(newLink);
});

// DELETE remover link
app.delete('/api/links/:id', auth, (req, res) => {
  const db = loadDB();
  db.links = db.links.filter(l => l.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// GET progresso do teste
app.get('/api/links/:id/progress', auth, (req, res) => {
  const progress = progressMap[req.params.id];
  if (!progress) return res.json({ running: false, done: 0, total: 100, results: [] });
  res.json(progress);
});

// POST rodar teste manual
app.post('/api/links/:id/test', auth, async (req, res) => {
  const db = loadDB();
  const link = db.links.find(l => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Link não encontrado' });

  link.status = 'running';
  saveDB(db);

  progressMap[req.params.id] = { running: true, done: 0, total: 100, results: [] };

  res.json({ ok: true, message: 'Teste iniciado' });

  const onProgress = (done, total, parcial) => {
    progressMap[req.params.id] = { running: true, done, total, results: parcial };
  };

  try {
    console.log(`Iniciando teste para: ${link.name}`);
    const result = await runTest(link.url, 100, onProgress);
    console.log(`Teste concluído:`, JSON.stringify(result));
    progressMap[req.params.id] = { running: false, done: 100, total: 100, results: result.results };
    const db2 = loadDB();
    const l = db2.links.find(x => x.id === req.params.id);
    if (l) {
      l.status = 'idle';
      l.lastTest = new Date().toISOString();
      l.nextTest = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      l.history.unshift({ date: new Date().toISOString(), results: result });
      if (l.history.length > 10) l.history = l.history.slice(0, 10);
      saveDB(db2);
    }
  } catch (e) {
    console.error('ERRO AO RODAR TESTE:', e.message);
    progressMap[req.params.id] = { running: false, done: 0, total: 100, results: [] };
    const db2 = loadDB();
    const l = db2.links.find(x => x.id === req.params.id);
    if (l) { l.status = 'error'; saveDB(db2); }
  }
});

// GET status de um link
app.get('/api/links/:id', auth, (req, res) => {
  const db = loadDB();
  const link = db.links.find(l => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Link não encontrado' });
  res.json(link);
});

// Verificação automática a cada hora
setInterval(async () => {
  const db = loadDB();
  const now = new Date();
  for (const link of db.links) {
    if (link.status === 'idle' && link.nextTest && new Date(link.nextTest) <= now) {
      console.log(`Auto-testando: ${link.name}`);
      link.status = 'running';
      saveDB(db);
      try {
        const result = await runTest(link.url, 100, () => {});
        const db2 = loadDB();
        const l = db2.links.find(x => x.id === link.id);
        if (l) {
          l.status = 'idle';
          l.lastTest = new Date().toISOString();
          l.nextTest = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          l.history.unshift({ date: new Date().toISOString(), results: result });
          if (l.history.length > 10) l.history = l.history.slice(0, 10);
          saveDB(db2);
        }
      } catch (e) {
        console.error(`Erro ao testar ${link.name}:`, e.message);
        const db2 = loadDB();
        const l = db2.links.find(x => x.id === link.id);
        if (l) { l.status = 'error'; saveDB(db2); }
      }
    }
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
