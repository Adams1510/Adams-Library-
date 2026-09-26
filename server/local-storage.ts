import {mkdir, readFile, writeFile, rename, readdir, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Storage} from './storage.ts';
export function localStorage(directory: string): Storage {
  const resolve = (name: string) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) throw new Error('Invalid storage key.');
    return path.join(directory, name);
  };
  const storage: Storage = {
    async read(name, fallback = null) {
      try {return JSON.parse(await readFile(resolve(name), 'utf8'));}
      catch (error: any) {if (error.code === 'ENOENT') return fallback; throw error;}
    },
    async write(name, value) {
      await mkdir(directory, {recursive: true});
      const target = resolve(name), temp = target + '.' + randomUUID() + '.tmp';
      try {await writeFile(temp, JSON.stringify(value), 'utf8'); await rename(temp, target);}
      finally {await unlink(temp).catch(() => {});}
    },
    async remove(name) {
      try {await unlink(resolve(name));} catch (error: any) {if (error.code !== 'ENOENT') throw error;}
    },
    async entries(prefix) {
      await mkdir(directory, {recursive:true});
      const names = (await readdir(directory)).filter(name => name.startsWith(prefix) && name.endsWith('.json'));
      const results: any[] = [];
      for (let i = 0; i < names.length; i += 20) results.push(...await Promise.all(names.slice(i, i + 20).map(name => storage.read(name))));
      return results.filter(Boolean);
    },
  };
  return storage;
}
