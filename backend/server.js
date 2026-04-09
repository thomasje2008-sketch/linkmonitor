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

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ links: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// GET todos os links monitorados
app.get('/api/links', (req, res) => {
  const db = loadDB();
  res.json(db.links);
});

// POST adicionar novo link
app.post('/api/links', (req, res) => {
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
app.delete('/api/links/:id', (req, res) => {
  const db = loadDB();
  db.links = db.links.filter(l => l.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST rodar teste manual
app.post('/api/links/:id/test', async (req, res) => {
  const db = loadDB();
  const link = db.links.find(l => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Link não encontrado' });

  link.status = 'running';
  saveDB(db);

  res.json({ ok: true, message: 'Teste iniciado' });

  // Roda o teste em background
  try {
    const result = await runTest(link.url, 100);
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
    const db2 = loadDB();
    const l = db2.links.find(x => x.id === req.params.id);
    if (l) { l.status = 'error'; saveDB(db2); }
  }
});

// GET status de um link
app.get('/api/links/:id', (req, res) => {
  const db = loadDB();
  const link = db.links.find(l => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Link não encontrado' });
  res.json(link);
});

// Verificação automática a cada 7 dias
setInterval(async () => {
  const db = loadDB();
  const now = new Date();
  for (const link of db.links) {
    if (link.status === 'idle' && link.nextTest && new Date(link.nextTest) <= now) {
      console.log(`Auto-testando: ${link.name}`);
      link.status = 'running';
      saveDB(db);
      try {
        const result = await runTest(link.url, 100);
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
}, 60 * 60 * 1000); // checa a cada hora

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
