# Release v0.1.1

Initial public release metadata update for `@gmicloud/ai-sdk-provider`.

## Highlights

- Published package: `@gmicloud/ai-sdk-provider`
- Updated package metadata to point to the official GitHub repository:
  `https://github.com/GMISWE/ai-sdk-provider-gmicloud`
- Supports AI SDK Provider V3 language models through GMI Cloud's OpenAI-compatible chat completions API.

## Supported Capabilities

- Text generation with `generateText`
- Streaming with `streamText`
- Function tool calling
- Multi-step tool loops
- Native GMI Cloud `reasoning_content` mapped to AI SDK V3 reasoning content
- Custom provider settings: `baseURL`, `apiKey`, `headers`, and `fetch`

## Verification

- TypeScript strict typecheck
- Mock `fetch` unit tests
- AI SDK `generateText` and `streamText` integration tests
- Build output for ESM, CJS, and TypeScript declarations

## Links

- NPM: https://www.npmjs.com/package/@gmicloud/ai-sdk-provider
- GitHub: https://github.com/GMISWE/ai-sdk-provider-gmicloud
