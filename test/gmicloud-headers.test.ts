import { describe, expect, it } from 'vitest';

import { createGmicloud } from '../src/index.js';

describe.each(['doGenerate', 'doStream'] as const)('%s headers', method => {
  it.each<{
    name: string;
    provider: Record<string, string>;
    call: Record<string, string | undefined>;
    expected: string | null;
  }>([
    { name: 'provider lowercase override', provider: { authorization: 'Bearer provider' }, call: {}, expected: 'Bearer provider' },
    { name: 'provider uppercase override', provider: { AUTHORIZATION: 'Bearer provider' }, call: {}, expected: 'Bearer provider' },
    { name: 'call override wins', provider: { authorization: 'Bearer provider' }, call: { Authorization: 'Bearer call' }, expected: 'Bearer call' },
    { name: 'undefined call override removes the header', provider: { authorization: 'Bearer provider' }, call: { AUTHORIZATION: undefined }, expected: null },
  ])('$name', async ({ provider, call, expected }) => {
    let capturedHeaders: Headers | undefined;
    const model = createGmicloud({
      apiKey: 'default-key',
      headers: { ...provider, 'content-type': 'text/plain', 'X-Custom': 'provider', 'X-Keep': 'kept' },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        return method === 'doGenerate'
          ? Response.json({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] })
          : new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
      },
    })('zai-org/GLM-5.1-FP8');

    const result = await model[method]({
      prompt: [],
      headers: { ...call, 'CONTENT-TYPE': 'application/xml', 'x-custom': 'call' },
    });
    if ('stream' in result) {
      for await (const _part of result.stream) {
        // Consume the mocked response.
      }
    }

    expect(capturedHeaders?.get('authorization')).toBe(expected);
    expect(capturedHeaders?.get('content-type')).toBe('application/json');
    expect(capturedHeaders?.get('x-custom')).toBe('call');
    expect(capturedHeaders?.get('x-keep')).toBe('kept');
  });
});
