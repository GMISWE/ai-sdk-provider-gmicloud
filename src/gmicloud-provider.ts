import {
  NoSuchModelError,
  type EmbeddingModelV3,
  type ImageModelV3,
  type LanguageModelV3,
  type ProviderV3,
} from '@ai-sdk/provider';
import { generateId, loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';

import { GmicloudChatLanguageModel } from './gmicloud-chat-language-model.js';

export interface GmicloudProviderSettings {
  /**
   * Base URL for GMI Cloud API calls.
   *
   * @default 'https://api.gmi-serving.com/v1'
   */
  baseURL?: string;

  /**
   * API key sent with the Authorization header.
   *
   * Defaults to the `GMI_CLOUD_APIKEY` environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include in every request.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation for tests, proxies, or instrumentation.
   */
  fetch?: typeof fetch;
}

export interface GmicloudProvider extends ProviderV3 {
  (modelId: string): LanguageModelV3;
  languageModel(modelId: string): LanguageModelV3;
}

type GmicloudConfig = ConstructorParameters<typeof GmicloudChatLanguageModel>[2];

function unsupportedModel(modelId: string, modelType: NoSuchModelError['modelType']): never {
  throw new NoSuchModelError({
    modelId,
    modelType,
    message: `GMI Cloud ${modelType} models are not supported by this provider yet.`,
  });
}

export function createGmicloud(options: GmicloudProviderSettings = {}): GmicloudProvider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? 'https://api.gmi-serving.com/v1';

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'GMI_CLOUD_APIKEY',
      description: 'GMI Cloud',
    })}`,
    ...options.headers,
  });

  const config: GmicloudConfig = {
    provider: 'gmicloud',
    baseURL,
    headers: getHeaders,
    fetch: options.fetch,
    generateId,
  };

  const createChatModel = (modelId: string) =>
    new GmicloudChatLanguageModel(modelId, {}, config);

  const providerFunction = function (modelId: string) {
    if (new.target) {
      throw new Error(
        'The GMI Cloud model factory function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId);
  };

  const provider = Object.assign(providerFunction, {
    specificationVersion: 'v3' as const,
    languageModel: createChatModel,
    embeddingModel: (modelId: string): EmbeddingModelV3 =>
      unsupportedModel(modelId, 'embeddingModel'),
    imageModel: (modelId: string): ImageModelV3 =>
      unsupportedModel(modelId, 'imageModel'),
  }) as GmicloudProvider;

  return provider;
}

export const gmicloud = createGmicloud();
