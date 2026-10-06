// Local mock integration server; never connects to a real Supabase project.
import { createServer } from 'vite';
process.env.VITE_DEMO_MODE = 'false';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_example_key';
process.env.VITE_WORKOUT_RECORD_MODE = 'test';
process.env.VITE_AUTO_FINALIZE = 'false';
const server = await createServer({ server: { host: '127.0.0.1', port: 4175, strictPort: true } });
await server.listen();
server.printUrls();
