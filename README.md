# GMI Cloud Provider

The GMI Cloud provider enables access to GMI Cloud hosted language models through the AI SDK.

This package currently implements the AI SDK Provider V3 language model interface for GMI Cloud's OpenAI-compatible chat completions API.

## Setup

Install the provider:

```bash
npm install @gmicloud/ai-sdk-provider
```

Set your API key:

```bash
export GMI_CLOUD_APIKEY="your-api-key"
```

## Provider Instance

You can import the default provider instance `gmicloud`:

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

The following optional settings are available:

- `baseURL` string: Use a different URL prefix for API calls. Defaults to `https://api.gmi-serving.com/v1`.
- `apiKey` string: API key sent using the `Authorization` header. Defaults to the `GMI_CLOUD_APIKEY` environment variable.
- `headers` `Record<string, string>`: Custom headers to include in requests.
- `fetch` `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`: Custom fetch implementation for testing, proxies, or instrumentation.

## Language Models

You can create GMI Cloud language models using a provider instance. The first argument is the model id:

```ts
const model = gmicloud('zai-org/GLM-5.1-FP8');
```

## Example

Use GMI Cloud language models with `generateText`:

```ts
import { generateText } from 'ai';
import { gmicloud } from '@gmicloud/ai-sdk-provider';

const { text } = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  system: 'You are a knowledgeable AI assistant.',
  prompt: 'Explain the concept of quantum entanglement in simple terms.',
});
```

GMI Cloud language models can also be used with `streamText`:

```ts
import { streamText } from 'ai';
import { gmicloud } from '@gmicloud/ai-sdk-provider';

const result = streamText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'Write a short introduction to GMI Cloud.',
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

## Tool Calling

Function tools are mapped to GMI Cloud's OpenAI-compatible `tools` and `tool_choice` request fields:

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { gmicloud } from '@gmicloud/ai-sdk-provider';

const result = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the weather for a city.',
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async ({ city }) => ({
        city,
        temperature: '18C',
        condition: 'Partly cloudy',
      }),
    }),
  },
});

console.log(result.text);
```

## Provider Options

GMI Cloud chat models support an escape hatch for documented provider-specific request fields that are not part of the standard AI SDK call settings:

```ts
import {
  gmicloud,
  type GmicloudLanguageModelOptions,
} from '@gmicloud/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'Write a concise product description.',
  providerOptions: {
    gmicloud: {
      extraBody: {
        // documented GMI Cloud request fields can be passed here
      },
    } satisfies GmicloudLanguageModelOptions,
  },
});
```

Prefer standard AI SDK settings such as `temperature`, `maxOutputTokens`, `topP`, `stopSequences`, `tools`, and `toolChoice` whenever possible.

## Reasoning Models

When GMI Cloud returns native `reasoning_content` in chat completion responses or stream deltas, this provider maps it to AI SDK V3 reasoning content. You can access it through AI SDK result content fields:

```ts
import { generateText } from 'ai';
import { gmicloud } from '@gmicloud/ai-sdk-provider';

const result = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'Solve this carefully: 9.11 and 9.9, which is larger?',
});

const reasoning = result.content
  .filter(part => part.type === 'reasoning')
  .map(part => part.text)
  .join('');
```

If a specific model exposes reasoning only inside text using tags such as `<think>`, you can still use the AI SDK `extractReasoningMiddleware` for that model.

## Model Capabilities

The table below lists the provider capabilities implemented by this package. Model-specific availability depends on the selected GMI Cloud model.

| Model | Image Input | Object Generation | Tool Usage | Tool Streaming |
| --- | --- | --- | --- | --- |
| `zai-org/GLM-5.1-FP8` | Not enabled | Supported through JSON mode | Supported | Supported |

This provider does not currently implement embedding models, image generation models, or reranking models. Those should be added only after the corresponding GMI Cloud API contracts are verified.

## Development

Run the full verification suite:

```bash
npm run verify
```

The test suite uses mock `fetch` implementations and does not call the live GMI Cloud API.
