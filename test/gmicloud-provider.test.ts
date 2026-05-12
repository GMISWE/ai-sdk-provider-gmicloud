import {
  APICallError,
  UnsupportedFunctionalityError,
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3StreamPart,
} from '@ai-sdk/provider';
import { generateText, streamText } from 'ai';
import { describe, expect, it } from 'vitest';

import { createGmicloud } from '../src/index.js';

function createModel(fetch: typeof globalThis.fetch): LanguageModelV3 {
  return createGmicloud({
    apiKey: 'test-api-key',
    fetch,
  })('zai-org/GLM-5.1-FP8');
}

function baseOptions(
  overrides: Partial<LanguageModelV3CallOptions> = {},
): LanguageModelV3CallOptions {
  return {
    prompt: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_123',
      ...init.headers,
    },
  });
}

function eventStreamResponse(events: string[]) {
  return new Response(events.map(event => `data: ${event}\n\n`).join(''), {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'x-request-id': 'req_stream',
    },
  });
}

async function collectStream(stream: ReadableStream<LanguageModelV3StreamPart>) {
  const reader = stream.getReader();
  const parts: LanguageModelV3StreamPart[] = [];

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    parts.push(result.value);
  }

  return parts;
}

describe('GMI Cloud provider', () => {
  it('works through AI SDK generateText', async () => {
    const fetchMock: typeof fetch = async () =>
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Generated through the AI SDK.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 5,
          total_tokens: 9,
        },
      });

    const result = await generateText({
      model: createModel(fetchMock),
      prompt: 'Hello',
    });

    expect(result.text).toBe('Generated through the AI SDK.');
  });

  it('works through AI SDK streamText', async () => {
    const fetchMock: typeof fetch = async () =>
      eventStreamResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Stream' } }] }),
        JSON.stringify({ choices: [{ delta: { content: ' works' } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        JSON.stringify({
          choices: [],
          usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
        }),
        '[DONE]',
      ]);

    const result = streamText({
      model: createModel(fetchMock),
      prompt: 'Hello',
    });

    let text = '';
    for await (const delta of result.textStream) {
      text += delta;
    }

    expect(text).toBe('Stream works');
  });

  it('maps generateText requests and responses', async () => {
    let capturedRequest: {
      url: string;
      headers: Headers;
      body: unknown;
    } | undefined;

    const fetchMock: typeof fetch = async (input, init) => {
      capturedRequest = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      };

      return jsonResponse({
        id: 'chatcmpl_123',
        created: 1_700_000_000,
        model: 'zai-org/GLM-5.1-FP8',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from GMI Cloud.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 6,
          total_tokens: 11,
        },
      });
    };

    const result = await createModel(fetchMock).doGenerate(
      baseOptions({
        temperature: 0.7,
        maxOutputTokens: 800,
        stopSequences: ['END'],
      }),
    );

    expect(capturedRequest).toMatchObject({
      url: 'https://api.gmi-serving.com/v1/chat/completions',
      body: {
        model: 'zai-org/GLM-5.1-FP8',
        temperature: 0.7,
        max_tokens: 800,
        stop: ['END'],
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
      },
    });
    expect(capturedRequest?.headers.get('authorization')).toBe('Bearer test-api-key');
    expect(result.content).toEqual([{ type: 'text', text: 'Hello from GMI Cloud.' }]);
    expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
    expect(result.usage.inputTokens.total).toBe(5);
    expect(result.usage.outputTokens.total).toBe(6);
    expect(result.response?.id).toBe('chatcmpl_123');
  });

  it('maps function tools and generated tool calls', async () => {
    let requestBody: unknown;
    const fetchMock: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));

      return jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"city":"San Francisco"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });
    };

    const result = await createModel(fetchMock).doGenerate(
      baseOptions({
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a city.',
            inputSchema: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        ],
        toolChoice: { type: 'tool', toolName: 'get_weather' },
      }),
    );

    expect(requestBody).toMatchObject({
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a city.',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'get_weather' },
      },
    });
    expect(result.content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'get_weather',
        input: '{"city":"San Francisco"}',
      },
    ]);
    expect(result.finishReason).toEqual({ unified: 'tool-calls', raw: 'tool_calls' });
  });

  it('maps reasoning_content to V3 reasoning content', async () => {
    const fetchMock: typeof fetch = async () =>
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              reasoning_content: 'I should answer briefly.',
              content: 'A brief answer.',
            },
            finish_reason: 'stop',
          },
        ],
      });

    const result = await createModel(fetchMock).doGenerate(baseOptions());

    expect(result.content).toEqual([
      { type: 'reasoning', text: 'I should answer briefly.' },
      { type: 'text', text: 'A brief answer.' },
    ]);
  });

  it('streams text deltas and waits for final usage', async () => {
    const fetchMock: typeof fetch = async () =>
      eventStreamResponse([
        JSON.stringify({
          id: 'chatcmpl_stream',
          created: 1_700_000_000,
          model: 'zai-org/GLM-5.1-FP8',
          choices: [{ delta: { content: 'Hel' } }],
        }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        JSON.stringify({
          choices: [],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        '[DONE]',
      ]);

    const result = await createModel(fetchMock).doStream(baseOptions());
    const parts = await collectStream(result.stream);

    expect(parts).toEqual([
      { type: 'stream-start', warnings: [] },
      {
        type: 'response-metadata',
        id: 'chatcmpl_stream',
        modelId: 'zai-org/GLM-5.1-FP8',
        timestamp: new Date(1_700_000_000 * 1000),
      },
      { type: 'text-start', id: expect.any(String) },
      { type: 'text-delta', id: expect.any(String), delta: 'Hel' },
      { type: 'text-delta', id: expect.any(String), delta: 'lo' },
      { type: 'text-end', id: expect.any(String) },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: 2,
            noCache: 2,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 1,
            text: 1,
            reasoning: undefined,
          },
          raw: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        },
      },
    ]);
  });

  it('streams reasoning_content deltas into V3 reasoning parts', async () => {
    const fetchMock: typeof fetch = async () =>
      eventStreamResponse([
        JSON.stringify({
          id: 'chatcmpl_reasoning_stream',
          model: 'zai-org/GLM-5.1-FP8',
          choices: [{ delta: { reasoning_content: 'Think' } }],
        }),
        JSON.stringify({ choices: [{ delta: { reasoning_content: ' first.' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'Answer.' } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        '[DONE]',
      ]);

    const result = await createModel(fetchMock).doStream(baseOptions());
    const parts = await collectStream(result.stream);

    expect(parts).toEqual([
      { type: 'stream-start', warnings: [] },
      {
        type: 'response-metadata',
        id: 'chatcmpl_reasoning_stream',
        modelId: 'zai-org/GLM-5.1-FP8',
        timestamp: undefined,
      },
      { type: 'reasoning-start', id: expect.any(String) },
      { type: 'reasoning-delta', id: expect.any(String), delta: 'Think' },
      { type: 'reasoning-delta', id: expect.any(String), delta: ' first.' },
      { type: 'reasoning-end', id: expect.any(String) },
      { type: 'text-start', id: expect.any(String) },
      { type: 'text-delta', id: expect.any(String), delta: 'Answer.' },
      { type: 'text-end', id: expect.any(String) },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: undefined,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: undefined,
            text: undefined,
            reasoning: undefined,
          },
          raw: undefined,
        },
      },
    ]);
  });

  it('streams tool call deltas into V3 tool parts', async () => {
    const fetchMock: typeof fetch = async () =>
      eventStreamResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'get_weather', arguments: '{"city"' },
                  },
                ],
              },
            },
          ],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: ':"San Francisco"}' },
                  },
                ],
              },
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        JSON.stringify({
          choices: [],
          usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
        }),
        '[DONE]',
      ]);

    const result = await createModel(fetchMock).doStream(baseOptions());
    const parts = await collectStream(result.stream);

    expect(parts.filter(part => part.type !== 'stream-start' && part.type !== 'response-metadata')).toEqual([
      { type: 'tool-input-start', id: 'call_1', toolName: 'get_weather' },
      { type: 'tool-input-delta', id: 'call_1', delta: '{"city"' },
      { type: 'tool-input-delta', id: 'call_1', delta: ':"San Francisco"}' },
      { type: 'tool-input-end', id: 'call_1' },
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'get_weather',
        input: '{"city":"San Francisco"}',
      },
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage: expect.any(Object),
      },
    ]);
  });

  it('maps HTTP errors to APICallError', async () => {
    const fetchMock: typeof fetch = async () =>
      jsonResponse(
        { error: { message: 'Rate limit exceeded', type: 'rate_limit' } },
        { status: 429, statusText: 'Too Many Requests' },
      );

    await expect(createModel(fetchMock).doGenerate(baseOptions())).rejects.toBeInstanceOf(
      APICallError,
    );
    await expect(createModel(fetchMock).doGenerate(baseOptions())).rejects.toMatchObject({
      message: 'Rate limit exceeded',
      statusCode: 429,
      isRetryable: true,
    });
  });

  it('rejects file inputs until multimodal support is verified', async () => {
    const fetchMock: typeof fetch = async () => jsonResponse({});

    await expect(
      createModel(fetchMock).doGenerate(
        baseOptions({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: 'abc',
                  mediaType: 'image/png',
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(UnsupportedFunctionalityError);
  });
});
