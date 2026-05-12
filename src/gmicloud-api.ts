import { APICallError, InvalidResponseDataError, type JSONObject } from '@ai-sdk/provider';
import { combineHeaders, extractResponseHeaders } from '@ai-sdk/provider-utils';

import type { GmicloudErrorResponse } from './gmicloud-types.js';

export type GmicloudRequestConfig = {
  headers: () => Record<string, string>;
  fetch?: typeof fetch;
};

export async function postJsonToGmicloud<T>({
  url,
  body,
  config,
  abortSignal,
  headers,
}: {
  url: string;
  body: unknown;
  config: GmicloudRequestConfig;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
}): Promise<{
  value: T;
  responseHeaders: Record<string, string>;
}> {
  const response = await (config.fetch ?? globalThis.fetch)(url, {
    method: 'POST',
    headers: cleanHeaders(combineHeaders(config.headers(), headers, {
      'Content-Type': 'application/json',
    })),
    body: JSON.stringify(body),
    signal: abortSignal,
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

  const text = await response.text();

  try {
    return {
      value: JSON.parse(text) as T,
      responseHeaders,
    };
  } catch (error) {
    throw new InvalidResponseDataError({
      data: text,
      message: `GMI Cloud API returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function createApiCallError({
  response,
  responseHeaders,
  url,
  requestBodyValues,
}: {
  response: Response;
  responseHeaders: Record<string, string>;
  url: string;
  requestBodyValues: unknown;
}): Promise<APICallError> {
  const responseBody = await response.text();
  const data = parseMaybeJson(responseBody);
  const message = getErrorMessage(data) ?? response.statusText;

  return new APICallError({
    message,
    url,
    requestBodyValues,
    statusCode: response.status,
    responseHeaders,
    responseBody,
    isRetryable: response.status === 429 || response.status >= 500,
    data,
  });
}

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data.length > 0 ? data : undefined;
  }

  if (data != null && typeof data === 'object') {
    const error = data as GmicloudErrorResponse;

    return error.error?.message ?? error.message ?? stringifyCode(error.error);
  }

  return undefined;
}

function stringifyCode(error: GmicloudErrorResponse['error']): string | undefined {
  if (error?.code == null) {
    return undefined;
  }

  return String(error.code);
}

export function toJSONObject(value: unknown): JSONObject | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as JSONObject;
}

export function cleanHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => entry[1] != null),
  );
}
