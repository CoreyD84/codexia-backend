const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('Codexia backend is running');
});

// Transform code endpoint
app.post('/transformCode', (req, res) => {
  const { code, instructions } = req.body;

  // Basic validation
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: "code" field is required and must be a string'
    });
  }

  if (!instructions || typeof instructions !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: "instructions" field is required and must be a string'
    });
  }

  // Placeholder response (no AI integration yet)
  res.json({
    success: true,
    message: 'Code transformation request received',
    originalCode: code,
    instructions: instructions,
    transformedCode: '// Placeholder: AI transformation will be implemented here',
    note: 'This is a placeholder response. AI integration coming soon.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Codexia backend is running on port ${PORT}`);
});
