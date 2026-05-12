import {
  UnsupportedFunctionalityError,
  type LanguageModelV3CallOptions,
  type LanguageModelV3FunctionTool,
} from '@ai-sdk/provider';

import type { GmicloudTool, GmicloudToolChoice } from './gmicloud-types.js';

export function convertToGmicloudTools(
  tools: LanguageModelV3CallOptions['tools'],
): GmicloudTool[] | undefined {
  if (tools == null || tools.length === 0) {
    return undefined;
  }

  return tools.map(tool => {
    if (tool.type !== 'function') {
      throw new UnsupportedFunctionalityError({
        functionality: 'Provider-defined tools are not supported by GMI Cloud chat completions.',
      });
    }

    return convertFunctionTool(tool);
  });
}

function convertFunctionTool(tool: LanguageModelV3FunctionTool): GmicloudTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      ...(tool.strict == null ? {} : { strict: tool.strict }),
    },
  };
}

export function convertToGmicloudToolChoice(
  toolChoice: LanguageModelV3CallOptions['toolChoice'],
): GmicloudToolChoice | undefined {
  if (toolChoice == null) {
    return undefined;
  }

  switch (toolChoice.type) {
    case 'auto':
      return 'auto';
    case 'none':
      return 'none';
    case 'required':
      return 'required';
    case 'tool':
      return {
        type: 'function',
        function: {
          name: toolChoice.toolName,
        },
      };
  }
}
