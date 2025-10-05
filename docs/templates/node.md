# Node Template

Express service with `/health` endpoint.

`src/index.js`:
```js
app.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'node' }); });
```
Dev script: `npm run dev` (plain Node).
