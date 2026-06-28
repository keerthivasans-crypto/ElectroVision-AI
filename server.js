/* ===================================================
   ElectroVision AI — server.js
   Minimal Express static server (for local run + Vercel/Node hosting)
=================================================== */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'ElectroVision AI', timestamp: Date.now() });
});

// Fallback to index.html for any unmatched route (SPA-style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚡ ElectroVision AI server running at http://localhost:${PORT}`);
});
