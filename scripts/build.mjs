// 빌드: 공용 코어 + 플랫폼 파일을 dist/<platform>/ 으로 모은다.
// 사용법: node scripts/build.mjs [chrome]
import { cp, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const targets = {
  async chrome() {
    const out = join(DIST, 'chrome');
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    await cp(join(SRC, 'platforms', 'chrome'), out, { recursive: true });
    await cp(join(SRC, 'core'), join(out, 'core'), { recursive: true });
    return out;
  },
};

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(targets)) {
  if (!targets[name]) {
    console.error(`unknown target: ${name}`);
    process.exit(1);
  }
  console.log(`built ${name} -> ${await targets[name]()}`);
}
