#!/usr/bin/env node
/**
 * Chrome을 원격 디버깅 모드로 실행해 countthefingers.com을 엽니다.
 * 해당 창에서 F12로 DevTools를 사용할 수 있습니다.
 *
 * 사용법: npm run open:devtools  또는  node scripts/open-chrome-devtools.js
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { platform } from 'os';

const TARGET_URL = process.env.DEVTOOLS_URL || 'https://countthefingers.com';
const DEBUG_PORT = process.env.DEBUG_PORT || '9222';

function getChromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const isWin = platform() === 'win32';
  if (isWin) {
    const candidates = [
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean);
    for (const p of candidates) {
      if (p && existsSync(p)) return p;
    }
    return 'chrome'; // PATH에 있으면
  }
  // macOS / Linux
  const unixPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of unixPaths) {
    if (existsSync(p)) return p;
  }
  return 'google-chrome';
}

const chromePath = getChromePath();
const args = [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  TARGET_URL,
];

console.log('Chrome DevTools용 실행');
console.log('  URL:', TARGET_URL);
console.log('  디버깅 포트:', DEBUG_PORT);
console.log('');
console.log('해당 창에서 F12를 누르면 DevTools를 사용할 수 있습니다.');
console.log('원격 연결: http://localhost:' + DEBUG_PORT);

const child = spawn(chromePath, args, {
  detached: true,
  stdio: 'ignore',
});
child.unref();
