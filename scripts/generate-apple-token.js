#!/usr/bin/env node
/**
 * Generate Apple Music (MusicKit) developer token for StreamSwap.
 * Run from project root: node scripts/generate-apple-token.js
 *
 * Requires: npm install -D jsonwebtoken
 * Uses: APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_P8_PATH from env, or prompts.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function ask(rl, question, def = '') {
  const defStr = def ? ` (${def})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${defStr}: `, (answer) => resolve((answer || def).trim()));
  });
}

async function main() {
  let keyId = process.env.APPLE_KEY_ID;
  let teamId = process.env.APPLE_TEAM_ID;
  let p8Path = process.env.APPLE_P8_PATH;

  if (!keyId || !teamId || !p8Path) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Apple Music Developer Token generator for StreamSwap\n');
    if (!keyId) keyId = await ask(rl, 'Key ID (from Keys in developer.apple.com)');
    if (!teamId) teamId = await ask(rl, 'Team ID (from Membership)');
    if (!p8Path) p8Path = await ask(rl, 'Path to .p8 file', './AuthKey_XXXXX.p8');
    rl.close();
  }

  const resolvedPath = path.resolve(process.cwd(), p8Path);
  if (!fs.existsSync(resolvedPath)) {
    console.error('Error: .p8 file not found at', resolvedPath);
    process.exit(1);
  }

  let jwt;
  try {
    jwt = require('jsonwebtoken');
  } catch (_) {
    console.error('Missing dependency. Run: npm install -D jsonwebtoken');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(resolvedPath, 'utf8');
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: teamId,
    header: { alg: 'ES256', kid: keyId },
  });

  console.log('\n--- Copy this token into your .env as APPLE_MUSIC_DEVELOPER_TOKEN ---\n');
  console.log(token);
  console.log('\n--- End token ---\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
