import { createAuralisServer } from './app.mjs';

const backend = createAuralisServer();
const { port, origin } = await backend.start();

process.on('SIGINT', async () => {
  await backend.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await backend.stop();
  process.exit(0);
});

console.log(`Auralis backend listening on ${origin} (port ${port})`);
