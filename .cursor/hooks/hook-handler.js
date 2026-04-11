#!/usr/bin/env node

/**
 * Cursor Hooks — Integração com Langfuse.
 * Ponto de entrada que lê dados do stdin, cria traces e roteia para o handler correto.
 *
 * @version 1.2.0
 * @see https://cursor.com/docs/agent/hooks
 * @see https://langfuse.com/docs
 */

import { readStdin } from './lib/utils.js';
import {
  getOrCreateTrace,
  flushLangfuse,
  HOOK_HANDLER_VERSION,
} from './lib/langfuse-client.js';
import { routeHookHandler } from './lib/handlers.js';

async function main() {
  try {
    const input = await readStdin();
    const trace = getOrCreateTrace(input);
    const hookName = input.hook_event_name;
    const response = routeHookHandler(hookName, trace, input);

    if (response !== null && response !== undefined) {
      console.log(JSON.stringify(response));
    }

    await flushLangfuse();
  } catch (error) {
    console.error(`[Langfuse Hook v${HOOK_HANDLER_VERSION}] Error: ${error.message}`);
    console.log(JSON.stringify({ continue: true, permission: 'allow' }));
    process.exit(1);
  }
}

main();
