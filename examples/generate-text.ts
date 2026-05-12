import { generateText } from 'ai';
import { gmicloud } from '../src/index.js';

const { text } = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  system: 'You are a knowledgeable AI assistant.',
  prompt: 'Explain the concept of quantum entanglement in simple terms.',
});

console.log(text);
