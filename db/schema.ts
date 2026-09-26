import {sqliteTable, text} from 'drizzle-orm/sqlite-core';
export const libraryRecords = sqliteTable('library_records', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
