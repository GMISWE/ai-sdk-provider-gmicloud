import type { JSONObject } from '@ai-sdk/provider';

/**
 * GMI Cloud-specific chat options.
 *
 * Keep standard generation settings in AI SDK call options. Use `extraBody`
 * only for documented GMI Cloud request fields that are not standardized yet.
 */
export type GmicloudLanguageModelOptions = {
  extraBody?: JSONObject;
};
