# AI SDK Community Provider PR Draft

## PR Title

```text
docs: add GMI Cloud community provider
```

## PR Body

```md
## Summary

Adds GMI Cloud to the AI SDK Community Providers documentation.

GMI Cloud provides hosted language models through an OpenAI-compatible chat completions API. The provider package implements the AI SDK Provider V3 language model interface and is maintained by GMI Cloud.

## Links

- NPM package: https://www.npmjs.com/package/@gmicloud/ai-sdk-provider
- GitHub repository: https://github.com/GMISWE/ai-sdk-provider-gmicloud
- Maintainer: GMI Cloud

## Supported Capabilities

- Text generation with `generateText`
- Streaming with `streamText`
- Function tool calling
- Multi-step tool loops
- Native `reasoning_content` mapped to AI SDK V3 reasoning content

## Verification

- `npm run verify`
- TypeScript strict typecheck
- Mock fetch tests for request/response/streaming/tool/error behavior
- Live GMI Cloud API smoke tests for `generateText`, `streamText`, tool calling, tool loop, and reasoning content

## Package

```bash
npm install @gmicloud/ai-sdk-provider
```

```ts
import { gmicloud } from '@gmicloud/ai-sdk-provider';
```
```

## Suggested Documentation Page

Use the OpenRouter community provider page as the template.

```md
# GMI Cloud

GMI Cloud provides hosted language models through an OpenAI-compatible API.

## Setup

The GMI Cloud provider is available via the `@gmicloud/ai-sdk-provider` module. You can install it with:

```bash
npm install @gmicloud/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `gmicloud` from `@gmicloud/ai-sdk-provider`:

```ts
import { gmicloud } from '@gmicloud/ai-sdk-provider';
```

If you need a customized setup, import `createGmicloud` and create a provider instance with your settings:

```ts
import { createGmicloud } from '@gmicloud/ai-sdk-provider';

const gmicloud = createGmicloud({
  apiKey: process.env.GMI_CLOUD_APIKEY ?? '',
});
```

You can use the following optional settings to customize the GMI Cloud provider instance:

- `baseURL` string: Use a different URL prefix for API calls. The default prefix is `https://api.gmi-serving.com/v1`.
- `apiKey` string: API key sent using the `Authorization` header. It defaults to the `GMI_CLOUD_APIKEY` environment variable.
- `headers` `Record<string, string>`: Custom headers to include in the requests.
- `fetch` `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`: Custom fetch implementation.

## Language Models

You can create GMI Cloud language models using a provider instance. The first argument is the model id:

```ts
const model = gmicloud('zai-org/GLM-5.1-FP8');
```

## Example

You can use GMI Cloud language models to generate text with the `generateText` function:

```ts
import { generateText } from 'ai';
import { gmicloud } from '@gmicloud/ai-sdk-provider';

const { text } = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

GMI Cloud language models can also be used with `streamText`.

## Tool Calling

GMI Cloud supports AI SDK function tools through the provider's OpenAI-compatible `tools` and `tool_choice` mapping.

## Reasoning Models

When GMI Cloud returns native `reasoning_content` in chat completion responses or stream deltas, the provider maps it to AI SDK V3 reasoning content.

## Model Capabilities

| Model | Image Input | Object Generation | Tool Usage | Tool Streaming |
| --- | --- | --- | --- | --- |
| `zai-org/GLM-5.1-FP8` | Not enabled | Supported through JSON mode | Supported | Supported |
```
