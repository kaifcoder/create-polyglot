import express from 'express';

const app = express();
const port = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'node' });
});

app.listen(port, () => {
  console.log(`[node] service listening on :${port}`);
});
