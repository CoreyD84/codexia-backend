

# 🌟 Codexia Backend — Multi‑File AI Transformation Engine
*A human‑centered code transformation engine built for clarity, trust, and emotional resonance.*

Codexia is a next‑generation AI transformation engine that converts **Android/Kotlin projects into Swift/SwiftUI**, using a hybrid of deterministic rules, project‑level intelligence, and LLM‑powered reasoning.

This backend powers the transformation pipeline — handling ZIP uploads, GitHub repositories, multi‑file orchestration, streaming output, and full‑project context analysis.

Codexia isn’t just a tool.  
It’s a promise: **technology that feels protective, predictable, and emotionally grounded.**

---

# 🚀 Features

### 🔹 Multi‑File Transformation Engine
Transforms entire Android projects — not just single files — using a hybrid sequential/parallel pipeline.

### 🔹 Full Project Context
Builds a project‑wide understanding:
- Class map  
- Navigation graph  
- File summaries  
- Dependency relationships  

### 🔹 Hybrid Classification
Determines which files require sequential reasoning vs. parallel processing.

### 🔹 Streaming Output
Real‑time transformation results with `[END_FILE]` and `[END]` markers.

### 🔹 ZIP, GitHub, and JSON Input
Supports:
- ZIP uploads  
- GitHub repo URLs  
- Raw JSON multi‑file payloads  

### 🔹 Deterministic Prompting
Uses a structured system prompt + user prompt for predictable, stable output.

### 🔹 Clean, Modular Architecture
Every component is isolated, testable, and built for long‑term evolution.

---

# 📁 Folder Structure

```
codexia-backend/
│ server.js
│ package.json
│ .env
│ README.md
│
├── openaiClient/
│   └── openaiClient.js
│
├── prompt/
│   ├── buildSystemPrompt.js
│   └── buildUserPrompt.js
│
├── types/
│   └── TransformOptions.js
│
└── utils/
    ├── codeTransformers.js
    ├── fileClassifier.js
    ├── fileHandlers.js
    ├── logger.js
    ├── multiFileOrchestrator.js
    ├── projectContext.js
    └── streamingHelpers.js
```

This is the **final, validated, production‑grade structure**.

---

# ⚙️ Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env`
```
OPENAI_API_KEY=your_key_here
PORT=3000
```

### 3. Start the server
```bash
node server.js
```

---

# 🔌 API Endpoints

## **POST /transformCode**
Transforms a single file or multi‑file JSON payload.

## **POST /transformCode/stream**
Streams transformation output for a single file.

## **POST /transformCode/stream/multi**
Streams multi‑file output with `[END_FILE]` and `[END]` markers.

## **POST /transformCode/zip**
Uploads and transforms a ZIP project.

## **POST /transformCode/github**
Transforms a GitHub repository.

---

# 🧪 Test Payloads

## **1. JSON Multi‑File Payload**
```json
{
  "files": [
    {
      "path": "MainActivity.kt",
      "content": "package com.example..."
    },
    {
      "path": "ui/HomeScreen.kt",
      "content": "package com.example.ui..."
    }
  ]
}
```

---

## **2. ZIP Upload (Thunder Client / Postman)**
Form‑data:
```
file: <your zip>
```

---

## **3. GitHub Repo Payload**
```json
{
  "repoUrl": "https://github.com/your/repo"
}
```

---

# 🌀 Streaming Examples

## **Single‑File Streaming (curl)**
```bash
curl -N -X POST http://localhost:3000/transformCode/stream \
  -H "Content-Type: application/json" \
  -d '{"code": "fun main() { println(\"Hello\") }"}'
```

---

## **Multi‑File Streaming (curl)**
```bash
curl -N -X POST http://localhost:3000/transformCode/stream/multi \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      { "path": "MainActivity.kt", "content": "..." },
      { "path": "ui/Home.kt", "content": "..." }
    ]
  }'
```

Streaming output will look like:

```
--- FILE: MainActivity.kt ---
<SwiftUI output>
[END_FILE]

--- FILE: ui/Home.kt ---
<SwiftUI output>
[END_FILE]

[END]
```

---

# ❤️ Health & Version Endpoints

Add these to `server.js`:

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/version', (req, res) => {
  res.json({ version: '2.0.0', build: 'multi-file-engine' });
});
```

---

# 🧵 Request‑ID Logging

Add this middleware to `server.js`:

```js
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 10);
  console.log(`[${req.id}] ${req.method} ${req.url}`);
  next();
});
```

Then update logs like:

```js
console.log(`[${req.id}] Starting multi-file transform`);
```

This gives you **traceable, production‑grade logs**.

---

# 🌱 The Philosophy Behind Codexia

Codexia isn’t just a code transformer.  
It’s a commitment to:

- clarity  
- emotional safety  
- predictable output  
- human‑centered engineering  

Every architectural decision — from the orchestrator to the prompt design — reinforces that promise.

This backend is the foundation of that vision.

---

