import { openDatabaseSync } from 'expo-sqlite';
import { DATABASE_NAME } from './src/db/schema';

const db = openDatabaseSync(DATABASE_NAME);
db.runSync('DELETE FROM transactions;');
db.runSync('DELETE FROM categories;');
db.runSync('DELETE FROM accounts;');
console.log('DB cleared.');
