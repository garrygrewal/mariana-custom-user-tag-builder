#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(name) {
  try {
    for (const line of readFileSync(resolve(root, name), 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const issueKey = process.argv[2];
if (!issueKey) {
  console.error('Usage: node scripts/process-issue.mjs <ISSUE-KEY>');
  process.exit(1);
}

const { processTicket } = await import('../server/processTicket.ts');

console.log(`Processing ${issueKey}...`);
const result = await processTicket(issueKey);
console.log(JSON.stringify(result, null, 2));
