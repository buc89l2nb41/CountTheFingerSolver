#!/usr/bin/env node
/**
 * 숫자를 입력하면 ./answer 폴더에서 해당 번호 파일을 찾아 내용을 보여줌.
 * 없으면 NONE 출력.
 *
 * 사용법: node lookup-answer.js <숫자>
 * 예: node lookup-answer.js 181
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const answerDir = path.join(__dirname, 'answer');

const num = process.argv[2];

if (num === undefined || num === '') {
  console.log('NONE');
  process.exit(0);
}

// 숫자만 허용 (정수)
const trimmed = String(num).trim();
if (!/^\d+$/.test(trimmed)) {
  console.log('NONE');
  process.exit(0);
}

const filePath = path.join(answerDir, `${trimmed}.txt`);

if (!existsSync(filePath)) {
  console.log('NONE');
  process.exit(0);
}

try {
  const content = await readFile(filePath, 'utf-8');
  console.log(content.trimEnd());
} catch (err) {
  console.log('NONE');
  process.exitCode = 1;
}
