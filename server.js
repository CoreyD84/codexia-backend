const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('Codexia backend is running');
});

// Transform code endpoint
app.post('/transformCode', async (req, res) => {
  try {
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

    // Build prompt for OpenAI
    const prompt = `You are an expert iOS developer specializing in Swift and SwiftUI. Transform the following code according to the user's instructions. Return ONLY the transformed Swift/SwiftUI code without any explanations, markdown formatting, or code blocks.

User Instructions:
${instructions}

Original Code:
${code}

Transformed Swift/SwiftUI Code:`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert iOS developer that transforms code into Swift/SwiftUI. Return only the transformed code without any explanations or markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    // Extract transformed code
    const transformedCode = completion.choices[0].message.content.trim();

    // Return only the transformed code
    res.json({
      transformedCode
    });
  } catch (error) {
    console.error('Error transforming code:', error);
    res.status(500).json({
      error: 'Failed to transform code. Please try again later.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Codexia backend is running on port ${PORT}`);
});
