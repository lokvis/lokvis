import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';

const docs = defineCollection({ loader: docsLoader() });

export const collections = { docs };
