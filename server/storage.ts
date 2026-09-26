export interface Storage {
  read(name: string, fallback?: any): Promise<any>;
  write(name: string, value: unknown): Promise<void>;
  remove(name: string): Promise<void>;
  entries(prefix: string): Promise<any[]>;
}
// D1 holds the small catalog/reading records; R2 holds complete book bodies.
export function cloudStorage(env: {DB: any; BUCKET: any}): Storage {
  if (!env.DB || !env.BUCKET) throw new Error('Library storage is not configured.');
  return {
    async read(name, fallback = null) {
      if (name.startsWith('book-')) {const object = await env.BUCKET.get(name); return object ? object.json() : fallback;}
      const record = await env.DB.prepare('SELECT value FROM library_records WHERE key = ?').bind(name).first();
      return record ? JSON.parse(record.value) : fallback;
    },
    async write(name, value) {
      if (name.startsWith('book-')) {await env.BUCKET.put(name, JSON.stringify(value), {httpMetadata: {contentType: 'application/json'}}); return;}
      await env.DB.prepare('INSERT INTO library_records (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(name, JSON.stringify(value)).run();
    },
    async remove(name) {
      if (name.startsWith('book-')) {await env.BUCKET.delete(name); return;}
      await env.DB.prepare('DELETE FROM library_records WHERE key = ?').bind(name).run();
    },
    async entries(prefix) {
      const {results} = await env.DB.prepare('SELECT value FROM library_records WHERE key >= ? AND key < ? ORDER BY key').bind(prefix, prefix + '\uffff').all();
      return results.map((row: any) => JSON.parse(row.value));
    },
  };
}
