import {
  InvalidResponseDataError,
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3Content,
  type LanguageModelV3GenerateResult,
  type LanguageModelV3StreamPart,
  type LanguageModelV3StreamResult,
  type LanguageModelV3Usage,
  type SharedV3Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  type EventSourceMessage,
  EventSourceParserStream,
  extractResponseHeaders,
  type IdGenerator,
} from '@ai-sdk/provider-utils';

import type { GmicloudLanguageModelOptions } from './gmicloud-chat-options.js';
import {
  cleanHeaders,
  createApiCallError,
  postJsonToGmicloud,
  toJSONObject,
} from './gmicloud-api.js';
import { convertToGmicloudChatMessages } from './convert-to-gmicloud-chat-messages.js';
import {
  convertToGmicloudToolChoice,
  convertToGmicloudTools,
} from './convert-to-gmicloud-tools.js';
import { mapGmicloudFinishReason } from './map-gmicloud-finish-reason.js';
import type {
  GmicloudChatCompletionChunk,
  GmicloudChatCompletionRequest,
  GmicloudChatCompletionResponse,
  GmicloudToolCall,
  GmicloudUsage,
} from './gmicloud-types.js';

export type GmicloudChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: typeof fetch;
  generateId: IdGenerator;
};

type StreamToolState = {
  id?: string;
  toolName?: string;
  input: string;
  started: boolean;
  ended: boolean;
};

export class GmicloudChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly supportedUrls = {};
  readonly provider: string;
  readonly modelId: string;

  constructor(
    modelId: string,
    private readonly settings: GmicloudLanguageModelOptions,
    private readonly config: GmicloudChatConfig,
  ) {
    this.modelId = modelId;
    this.provider = config.provider;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const { args, warnings } = this.getArgs(options);
    const { value: response, responseHeaders } =
      await postJsonToGmicloud<GmicloudChatCompletionResponse>({
        url: `${this.config.baseURL}/chat/completions`,
        body: args,
        config: this.config,
        abortSignal: options.abortSignal,
        headers: options.headers,
      });

    const choice = response.choices[0];

    if (choice == null) {
      throw new InvalidResponseDataError({
        data: response,
        message: 'GMI Cloud API response did not include a completion choice.',
      });
    }

    const content = this.mapContent(choice.message);

    return {
      content,
      finishReason: mapGmicloudFinishReason(choice.finish_reason),
      usage: mapUsage(response.usage),
      request: { body: args },
      response: {
        id: response.id,
        modelId: response.model,
        timestamp: response.created == null ? undefined : new Date(response.created * 1000),
        headers: responseHeaders,
        body: response,
      },
      warnings,
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const { args, warnings } = this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: { include_usage: true },
    };
    const url = `${this.config.baseURL}/chat/completions`;
    const response = await (this.config.fetch ?? globalThis.fetch)(url, {
      method: 'POST',
      headers: cleanHeaders(combineHeaders(this.config.headers(), options.headers, {
        'Content-Type': 'application/json',
      })),
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });
    const responseHeaders = extractResponseHeaders(response);

    if (!response.ok) {
      throw await createApiCallError({
        response,
        responseHeaders,
        url,
        requestBodyValues: body,
      });
    }

    if (response.body == null) {
      throw new InvalidResponseDataError({
        data: response,
        message: 'GMI Cloud streaming response did not include a body.',
      });
    }

    const stream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(this.createStreamTransformer({ warnings, includeRawChunks: options.includeRawChunks }));

    return {
      stream,
      request: { body },
      response: { headers: responseHeaders },
    };
  }

  private getArgs(options: LanguageModelV3CallOptions): {
    args: GmicloudChatCompletionRequest;
    warnings: SharedV3Warning[];
  } {
    const warnings: SharedV3Warning[] = [];
    const providerOptions = this.getProviderOptions(options);
    const responseFormat = getResponseFormat(options, warnings);
    const tools = convertToGmicloudTools(options.tools);

    if (options.topK != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'topK',
        details: 'GMI Cloud chat completions do not expose a top_k request parameter.',
      });
    }

    const args: GmicloudChatCompletionRequest = {
      model: this.modelId,
      messages: convertToGmicloudChatMessages(options.prompt),
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      presence_penalty: options.presencePenalty,
      frequency_penalty: options.frequencyPenalty,
      seed: options.seed,
      response_format: responseFormat,
      tools,
      tool_choice: tools == null ? undefined : convertToGmicloudToolChoice(options.toolChoice),
      ...this.settings.extraBody,
      ...providerOptions?.extraBody,
    };

    return {
      args: removeUndefinedEntries(args),
      warnings,
    };
  }

  private getProviderOptions(
    options: LanguageModelV3CallOptions,
  ): GmicloudLanguageModelOptions | undefined {
    const providerOptions = options.providerOptions?.gmicloud as GmicloudLanguageModelOptions | undefined;

    if (providerOptions == null) {
      return undefined;
    }

    return {
      extraBody: toJSONObject(providerOptions.extraBody),
    };
  }

  private mapContent(message: GmicloudChatCompletionResponse['choices'][number]['message']) {
    const content: LanguageModelV3Content[] = [];

    if (message.reasoning_content != null && message.reasoning_content.length > 0) {
      content.push({ type: 'reasoning', text: message.reasoning_content });
    }

    if (message.content != null && message.content.length > 0) {
      content.push({ type: 'text', text: message.content });
    }

    for (const toolCall of message.tool_calls ?? []) {
      content.push(mapToolCall(toolCall));
    }

    return content;
  }

  private createStreamTransformer({
    warnings,
    includeRawChunks,
  }: {
    warnings: SharedV3Warning[];
    includeRawChunks: boolean | undefined;
  }): TransformStream<EventSourceMessage, LanguageModelV3StreamPart> {
    const textId = this.config.generateId();
    const reasoningId = this.config.generateId();
    const toolStates = new Map<number, StreamToolState>();
    let textStarted = false;
    let textEnded = false;
    let reasoningStarted = false;
    let reasoningEnded = false;
    let metadataSent = false;
    let finishSent = false;
    let pendingFinishReason: string | null | undefined;
    let lastUsage: GmicloudUsage | undefined;

    const startText = (controller: TransformStreamDefaultController<LanguageModelV3StreamPart>) => {
      if (!textStarted) {
        controller.enqueue({ type: 'text-start', id: textId });
        textStarted = true;
      }
    };

    const endText = (controller: TransformStreamDefaultController<LanguageModelV3StreamPart>) => {
      if (textStarted && !textEnded) {
        controller.enqueue({ type: 'text-end', id: textId });
        textEnded = true;
      }
    };

    const startReasoning = (controller: TransformStreamDefaultController<LanguageModelV3StreamPart>) => {
      if (!reasoningStarted) {
        controller.enqueue({ type: 'reasoning-start', id: reasoningId });
        reasoningStarted = true;
      }
    };

    const endReasoning = (controller: TransformStreamDefaultController<LanguageModelV3StreamPart>) => {
      if (reasoningStarted && !reasoningEnded) {
        controller.enqueue({ type: 'reasoning-end', id: reasoningId });
        reasoningEnded = true;
      }
    };

    const endTools = (controller: TransformStreamDefaultController<LanguageModelV3StreamPart>) => {
      for (const toolState of toolStates.values()) {
        if (toolState.id == null || toolState.toolName == null) {
          continue;
        }

        if (toolState.started && !toolState.ended) {
          controller.enqueue({ type: 'tool-input-end', id: toolState.id });
          toolState.ended = true;
        }

        controller.enqueue({
          type: 'tool-call',
          toolCallId: toolState.id,
          toolName: toolState.toolName,
          input: toolState.input,
        });
      }
    };

    const finish = (
      controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
      rawFinishReason: string | null | undefined,
    ) => {
      if (finishSent) {
        return;
      }

      endReasoning(controller);
      endText(controller);
      endTools(controller);
      controller.enqueue({
        type: 'finish',
        finishReason: mapGmicloudFinishReason(rawFinishReason),
        usage: mapUsage(lastUsage),
      });
      finishSent = true;
    };

    return new TransformStream<EventSourceMessage, LanguageModelV3StreamPart>({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings });
      },
      transform: (event, controller) => {
        if (event.data === '[DONE]') {
          finish(controller, pendingFinishReason);
          return;
        }

        let chunk: GmicloudChatCompletionChunk;
        try {
          chunk = JSON.parse(event.data) as GmicloudChatCompletionChunk;
        } catch (error) {
          controller.enqueue({ type: 'error', error });
          return;
        }

        if (includeRawChunks) {
          controller.enqueue({ type: 'raw', rawValue: chunk });
        }

        if (!metadataSent) {
          controller.enqueue({
            type: 'response-metadata',
            id: chunk.id,
            modelId: chunk.model,
            timestamp: chunk.created == null ? undefined : new Date(chunk.created * 1000),
          });
          metadataSent = true;
        }

        if (chunk.usage != null) {
          lastUsage = chunk.usage;
        }

        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        if (delta?.reasoning_content != null && delta.reasoning_content.length > 0) {
          startReasoning(controller);
          controller.enqueue({
            type: 'reasoning-delta',
            id: reasoningId,
            delta: delta.reasoning_content,
          });
        }

        if (delta?.content != null && delta.content.length > 0) {
          endReasoning(controller);
          startText(controller);
          controller.enqueue({ type: 'text-delta', id: textId, delta: delta.content });
        }

        for (const toolCallDelta of delta?.tool_calls ?? []) {
          const index = toolCallDelta.index ?? 0;
          const toolState = toolStates.get(index) ?? {
            input: '',
            started: false,
            ended: false,
          };

          toolState.id = toolCallDelta.id ?? toolState.id;
          toolState.toolName = toolCallDelta.function?.name ?? toolState.toolName;

          if (!toolState.started && toolState.id != null && toolState.toolName != null) {
            controller.enqueue({
              type: 'tool-input-start',
              id: toolState.id,
              toolName: toolState.toolName,
            });
            toolState.started = true;
          }

          if (toolCallDelta.function?.arguments != null) {
            toolState.input += toolCallDelta.function.arguments;

            if (toolState.started && toolState.id != null) {
              controller.enqueue({
                type: 'tool-input-delta',
                id: toolState.id,
                delta: toolCallDelta.function.arguments,
              });
            }
          }

          toolStates.set(index, toolState);
        }

        if (choice?.finish_reason != null) {
          pendingFinishReason = choice.finish_reason;
        }
      },
      flush(controller) {
        finish(controller, pendingFinishReason);
      },
    });
  }
}

function getResponseFormat(
  options: LanguageModelV3CallOptions,
  warnings: SharedV3Warning[],
): GmicloudChatCompletionRequest['response_format'] {
  if (options.responseFormat == null || options.responseFormat.type === 'text') {
    return undefined;
  }

  if (options.responseFormat.schema != null) {
    warnings.push({
      type: 'compatibility',
      feature: 'responseFormat.schema',
      details:
        'GMI Cloud OpenAI-compatible chat completions use JSON object mode; JSON schema is not sent.',
    });
  }

  return { type: 'json_object' };
}

function mapToolCall(toolCall: GmicloudToolCall): LanguageModelV3Content {
  return {
    type: 'tool-call',
    toolCallId: toolCall.id,
    toolName: toolCall.function.name,
    input: toolCall.function.arguments,
  };
}

function mapUsage(usage: GmicloudUsage | undefined): LanguageModelV3Usage {
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens;
  const outputTokens = usage?.completion_tokens;
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;

  return {
    inputTokens: {
      total: usage?.prompt_tokens,
      noCache:
        usage?.prompt_tokens == null
          ? undefined
          : usage.prompt_tokens - (cachedInputTokens ?? 0),
      cacheRead: cachedInputTokens,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokens,
      text:
        outputTokens == null
          ? undefined
          : Math.max(outputTokens - (reasoningTokens ?? 0), 0),
      reasoning: reasoningTokens,
    },
    raw: toJSONObject(usage),
  };
}

function removeUndefinedEntries<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

