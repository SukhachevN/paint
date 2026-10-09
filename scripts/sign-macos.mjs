import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Local integrity signature. Distribution outside this Mac can use Developer ID.
if (process.platform === 'darwin') {
  const app = resolve('src-tauri/target/release/bundle/macos/Paint.app');
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log('Paint.app: локальная подпись проверена');
}
