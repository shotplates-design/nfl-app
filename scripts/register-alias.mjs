// Lets node tests import the app's TypeScript with the @/ path alias and JSON modules.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
