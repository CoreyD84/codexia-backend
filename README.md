# codexia-backend

AI-powered backend for Codexia — transforms Android/Java/Kotlin codebases into native Swift/SwiftUI iOS projects using LLM-driven analysis, file chunking, and multi-file generation.

## Features

### Multi-format Input Support
- **Single File JSON**: Send code directly as JSON (backward compatible)
- **Zip File Upload**: Upload `.zip` files containing multiple source files
- **GitHub Repository URL**: Provide a GitHub repository URL to process entire repos

### Kotlin → SwiftUI Conversion
- Specialized transformation logic for Kotlin syntax patterns
- Intelligent detection of Kotlin code features:
  - Data classes → Swift structs with Codable
  - Activities/Fragments → SwiftUI Views
  - Coroutines → async/await
  - Composables → SwiftUI Views
  - Lambdas → Swift closures

### Streaming Responses
- Server-Sent Events (SSE) for real-time code transformation
- Progressive output with live updates
- Progress indicators and metadata

### Error Handling
- Comprehensive validation and error messages
- Structured logging with Winston
- User-friendly error responses with technical details

## API Endpoints

### `POST /transformCode`

Main endpoint supporting multiple input formats.

#### Single File (JSON)
```bash
curl -X POST http://localhost:3000/transformCode \
  -H "Content-Type: application/json" \
  -d '{
    "code": "data class User(val name: String, val age: Int)",
    "instructions": "Convert to SwiftUI"
  }'
```

#### Zip File Upload
```bash
curl -X POST http://localhost:3000/transformCode \
  -F "file=@project.zip" \
  -F "instructions=Convert all Kotlin files to SwiftUI"
```

#### GitHub Repository URL
```bash
curl -X POST http://localhost:3000/transformCode \
  -H "Content-Type: application/json" \
  -d '{
    "githubUrl": "https://github.com/user/kotlin-app",
    "instructions": "Convert to SwiftUI, focus on UI components"
  }'
```

### `POST /transformCode/stream`

Streaming endpoint with Server-Sent Events (SSE).

```bash
curl -N -X POST http://localhost:3000/transformCode/stream \
  -H "Content-Type: application/json" \
  -d '{
    "code": "data class User(val name: String)",
    "instructions": "Convert to SwiftUI with streaming"
  }'
```

### `GET /health`

Health check endpoint.

```bash
curl http://localhost:3000/health
```

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server will start on port 3000 by default. You can override this with the `PORT` environment variable.

## Development

```bash
npm run dev
```

## Project Structure

```
codexia-backend/
├── server.js                   # Main Express server (route orchestration)
├── codexiaPrompt.js           # Codexia system prompt for OpenAI
├── openaiClient.js            # OpenAI API wrapper and helper functions
├── utils/
│   ├── promptTemplates.js     # Legacy prompt templates (deprecated in favor of codexiaPrompt.js)
│   ├── fileHandlers.js        # Zip and GitHub repository handling
│   ├── transformers.js        # Code transformation logic with OpenAI integration
│   ├── streamingHelpers.js   # SSE streaming utilities
│   └── logger.js              # Winston logger configuration
├── package.json
└── README.md
```

### Module Responsibilities

- **server.js**: Route orchestration, request validation, and response handling
- **codexiaPrompt.js**: Defines the Codexia system prompt that guides AI transformations
- **openaiClient.js**: Reusable OpenAI API wrapper with error handling and mock fallbacks
- **utils/transformers.js**: Integrates with OpenAI client for code transformations
- **utils/fileHandlers.js**: Handles file extraction from zips and GitHub repos
- **utils/streamingHelpers.js**: SSE implementation for real-time streaming responses

## Supported File Types

- `.kt` - Kotlin
- `.java` - Java
- `.swift` - Swift
- `.js` - JavaScript
- `.ts` - TypeScript
- `.py` - Python
- `.go` - Go
- `.xml` - XML layouts

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging level (default: info)
- `OPENAI_API_KEY` - OpenAI API key for code transformations (optional, uses mock responses if not set)

### OpenAI Integration

The backend uses OpenAI's GPT-4 to perform actual code transformations. To enable this feature:

1. Obtain an OpenAI API key from [https://platform.openai.com](https://platform.openai.com)
2. Set the `OPENAI_API_KEY` environment variable:
   ```bash
   export OPENAI_API_KEY='your-api-key-here'
   npm start
   ```

If no API key is configured, the server will return mock SwiftUI transformations for testing purposes.

#### Codexia System Prompt

The transformation uses a specialized system prompt (`codexiaPrompt.js`) that guides the AI to:
- Transform Android/Kotlin code into idiomatic SwiftUI
- Follow Apple's best practices and design patterns
- Map Kotlin patterns to Swift equivalents (coroutines → async/await, data classes → structs, etc.)
- Return production-ready iOS code

#### OpenAI Client

The `openaiClient.js` module provides a clean, reusable wrapper for OpenAI API calls:
- Handles both streaming and non-streaming responses
- Provides detailed error messages for common issues
- Falls back to mock responses when API key is not configured
- Supports customizable model, temperature, and token limits

### File Size Limits

- Maximum upload size: 10MB
- Maximum chunk size for LLM processing: 5000 characters

## Error Response Format

```json
{
  "success": false,
  "error": "User-friendly error message",
  "details": "Technical details for debugging"
}
```

## Future Enhancements

- Real-time streaming transformations with OpenAI streaming API
- More language transformations (Java → Swift, React Native → SwiftUI)
- Advanced code analysis and optimization suggestions
- Syntax preservation options
- Custom transformation templates
- Batch processing for large repositories
- Support for more LLM providers (Anthropic Claude, local models)

## License

ISC
