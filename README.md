# LinkMonitor — Traffic Distribution Tracker

Sistema profissional para monitorar automaticamente a distribuição de tráfego entre URLs.

---

## Estrutura

```
linkmonitor/
├── backend/          → Node.js + Express + Playwright
│   ├── server.js     → API REST
│   ├── tester.js     → Motor de testes com Playwright
│   └── package.json
└── frontend/
    └── public/
        └── index.html → Dashboard completo
```

---

## Como rodar localmente

### Backend
```bash
cd backend
npm install
npx playwright install chromium
node server.js
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Acesse: http://localhost:3000

---

## Deploy na nuvem (Railway + Vercel)

### 1. GitHub
1. Crie um repositório no GitHub
2. Faça upload das pastas `backend/` e `frontend/`

### 2. Backend no Railway
1. Acesse railway.app
2. Clique em "New Project" → "Deploy from GitHub repo"
3. Selecione seu repositório
4. Configure o Root Directory como `backend`
5. O Railway detecta automaticamente o Node.js
6. Vá em Settings → Add Variable:
   - `PORT` = `3001`
7. Copie a URL gerada (ex: https://seu-app.railway.app)

### 3. Atualizar API URL no frontend
No arquivo `frontend/public/index.html`, linha com `const API = ...`:
```js
const API = 'https://seu-app.railway.app/api';
```

### 4. Frontend no Vercel
1. Acesse vercel.com
2. "New Project" → Import do GitHub
3. Configure Root Directory como `frontend`
4. Framework Preset: "Other"
5. Deploy!

---

## Funcionalidades

- Monitorar múltiplos links simultaneamente
- Dashboard individual por link com gráficos
- Teste automático a cada 7 dias (100 tentativas)
- Teste manual sob demanda
- Histórico dos últimos 10 testes
- Anti-detecção de bot integrado
- Ignora parâmetros de rastreamento (fbclid, utm_*, rtkcid, etc.)
- Polling automático — atualiza em tempo real durante testes

---

## Tecnologias

- **Backend**: Node.js, Express, Playwright
- **Frontend**: HTML/CSS/JS puro, Chart.js
- **Deploy**: Railway (backend), Vercel (frontend)
