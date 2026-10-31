import { resolve } from 'node:path';
import { Engine } from '../companion/index.js';
import { createDashboard } from '../dashboard/index.js';
import { Store } from '../storage/index.js';
import { seedDemo } from './fixtures.js';
const demo = process.env.FEED_THE_SEEK_DEMO !== '0';
const port = Number(process.env.FEED_THE_SEEK_PORT || 4318);
const store = new Store(resolve(process.env.FEED_THE_SEEK_DATA_DIR || '.feed-the-seek', demo ? 'demo.sqlite' : 'memory.sqlite'));
const engine = new Engine(store);
if (demo) {
    seedDemo(engine);
}
const dashboard = createDashboard(engine, { demo, port });
await dashboard.listen();
console.log(`dsh-feed-the-seek ${demo ? '演示空间' : '本地记忆'} http://127.0.0.1:${port}`);
const shutdown = () => dashboard.server.close(() => {
    store.close();
    process.exit(0);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
//# sourceMappingURL=main.js.map