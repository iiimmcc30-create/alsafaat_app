// Load .env before any module reads process.env (standalone ts-node entry points).
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
