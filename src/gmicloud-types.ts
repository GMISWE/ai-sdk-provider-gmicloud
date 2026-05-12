import type { JSONSchema7 } from '@ai-sdk/provider';

export type GmicloudChatMessage =
  | {
      role: 'system';
      content: string;
    }
  | {
      role: 'user';
      content: string | Array<GmicloudTextContent | GmicloudImageContent>;
    }
  | {
      role: 'assistant';
      content?: string | null;
      tool_calls?: GmicloudToolCall[];
    }
  | {
      role: 'tool';
      tool_call_id: string;
      name?: string;
      content: string;
    };

export type GmicloudTextContent = {
  type: 'text';
  text: string;
};

export type GmicloudImageContent = {
  type: 'image_url';
  image_url: {
    url: string;
  };
};

export type GmicloudTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: JSONSchema7;
    strict?: boolean;
  };
};

export type GmicloudToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export type GmicloudToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type GmicloudChatCompletionRequest = {
  model: string;
  messages: GmicloudChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
  response_format?: { type: 'text' | 'json_object' };
  tools?: GmicloudTool[];
  tool_choice?: GmicloudToolChoice;
  [key: string]: unknown;
};

export type GmicloudUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  [key: string]: unknown;
};

export type GmicloudChatCompletionResponse = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index?: number;
    message: {
      role?: 'assistant';
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: GmicloudToolCall[];
    };
    finish_reason?: string | null;
  }>;
  usage?: GmicloudUsage;
};

export type GmicloudChatCompletionChunk = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      role?: 'assistant';
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: GmicloudUsage;
};

export type GmicloudErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
  message?: string;
};
