import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { streamText } from 'ai';
import { describe, expect, it } from 'vitest';

import { createGmicloud } from '../src/index.js';

const error = { message: 'Upstream inference failed', type: 'server_error', code: 'internal_error' };

function createModel(events: unknown[], done: boolean) {
  return createGmicloud({
    apiKey: 'test-api-key',
    fetch: async () => new Response(
      events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') +
        (done ? 'data: [DONE]\n\n' : ''),
      { headers: { 'content-type': 'text/event-stream' } },
    ),
  })('zai-org/GLM-5.1-FP8');
}

describe('stream error envelopes', () => {
  it.each([true, false])('surfaces errors and finishes with error (DONE: %s)', async done => {
    const events = [
      { choices: [{ delta: { content: 'Partial answer' } }] },
      { error },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } },
    ];
    const result = await createModel(events, done).doStream({ prompt: [], includeRawChunks: true });
    const parts: LanguageModelV3StreamPart[] = [];
    for await (const part of result.stream) {
      parts.push(part);
    }

    expect(parts.filter(part => part.type === 'error')).toEqual([{ type: 'error', error }]);
    expect(parts).toContainEqual({ type: 'raw', rawValue: { error } });
    expect(parts.filter(part => part.type === 'text-end')).toHaveLength(1);
    expect(parts.filter(part => part.type === 'finish')).toEqual([{
      type: 'finish',
      finishReason: { unified: 'error', raw: undefined },
      usage: expect.objectContaining({
        inputTokens: expect.objectContaining({ total: 2 }),
        outputTokens: expect.objectContaining({ total: 1 }),
      }),
    }]);
  });

  it('does not emit completion metadata for an error-only stream', async () => {
    const result = await createModel([{ error }], true).doStream({ prompt: [] });
    const parts: LanguageModelV3StreamPart[] = [];
    for await (const part of result.stream) {
      parts.push(part);
    }
    expect(parts.map(part => part.type)).toEqual(['stream-start', 'error', 'finish']);
    expect(parts.at(-1)).toMatchObject({ finishReason: { unified: 'error' } });
  });

  it('notifies AI SDK streamText callers', async () => {
    const errors: unknown[] = [];
    const result = streamText({
      model: createModel([
        { choices: [{ delta: { content: 'Partial answer' } }] },
        { error },
      ], true),
      prompt: 'Hello',
      onError: event => { errors.push(event.error); },
    });
    for await (const _part of result.fullStream) {
      // Consume the stream so the final reason and error callback are available.
    }
    expect(errors).toEqual([error]);
    expect(await result.text).toBe('Partial answer');
    expect(await result.finishReason).toBe('error');
  });
});
