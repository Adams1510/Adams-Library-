import {spawnSync} from 'node:child_process';
import process from 'node:process';

const result = spawnSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner', '--config', 'vite.worker.config.ts',
], {stdio:'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
