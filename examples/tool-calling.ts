import { generateText, tool } from 'ai';
import { z } from 'zod';

import { gmicloud } from '../src/index.js';

const result = await generateText({
  model: gmicloud('zai-org/GLM-5.1-FP8'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the weather for a city.',
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async ({ city }) => ({
        city,
        temperature: '18C',
        condition: 'Partly cloudy',
      }),
    }),
  },
});

console.log(result.text);
