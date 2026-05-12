import { streamText } from 'ai';
import { gmicloud } from '../src/index.js';

const result = streamText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'Write a short introduction to GMI Cloud.',
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
