import {
  UnsupportedFunctionalityError,
  type JSONValue,
  type LanguageModelV3Prompt,
  type LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';

import type { GmicloudChatMessage, GmicloudToolCall } from './gmicloud-types.js';

function stringifyToolOutput(output: LanguageModelV3ToolResultOutput): string {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    case 'execution-denied':
      return output.reason ?? 'Tool execution was denied.';
    case 'content':
      return JSON.stringify(output.value);
  }
}

function toJsonValue(value: unknown): JSONValue {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as JSONValue;
}

export function convertToGmicloudChatMessages(prompt: LanguageModelV3Prompt): GmicloudChatMessage[] {
  const messages: GmicloudChatMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        messages.push({ role: 'system', content: message.content });
        break;
      }

      case 'user': {
        const content: string[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              content.push(part.text);
              break;
            case 'file':
              throw new UnsupportedFunctionalityError({
                functionality:
                  'File and image prompt parts are not enabled in the GMI Cloud provider yet.',
              });
          }
        }

        messages.push({ role: 'user', content: content.join('') });
        break;
      }

      case 'assistant': {
        const content: string[] = [];
        const toolCalls: GmicloudToolCall[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              content.push(part.text);
              break;
            case 'tool-call':
              if (part.providerExecuted) {
                throw new UnsupportedFunctionalityError({
                  functionality: 'Provider-executed tools are not supported by GMI Cloud chat completions.',
                });
              }

              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(toJsonValue(part.input)),
                },
              });
              break;
            case 'reasoning':
              break;
            case 'file':
              throw new UnsupportedFunctionalityError({
                functionality:
                  'Assistant file prompt parts are not enabled in the GMI Cloud provider yet.',
              });
            case 'tool-result':
              messages.push({
                role: 'tool',
                tool_call_id: part.toolCallId,
                name: part.toolName,
                content: stringifyToolOutput(part.output),
              });
              break;
          }
        }

        if (content.length > 0 || toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: content.length > 0 ? content.join('') : null,
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          });
        }
        break;
      }

      case 'tool': {
        for (const part of message.content) {
          if (part.type === 'tool-approval-response') {
            throw new UnsupportedFunctionalityError({
              functionality: 'Tool approval responses are not supported by GMI Cloud chat completions.',
            });
          }

          messages.push({
            role: 'tool',
            tool_call_id: part.toolCallId,
            name: part.toolName,
            content: stringifyToolOutput(part.output),
          });
        }
        break;
      }
    }
  }

  return messages;
}
