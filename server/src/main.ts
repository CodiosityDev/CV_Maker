/**
 * Entry point: `node --env-file=<env file> server.mjs` (started by PM2 from the deploy workflow).
 * Listens on 127.0.0.1 only; nginx proxies https://cvmaker.codiosity.com/api/ to it.
 */
import { createServer } from 'node:http';
import { openAiCompatibleProvider } from './ai';
import { createApp } from './app';
import { loadConfig } from './config';
import { wibDay } from './identity';
import { memoryQuotaStore, type QuotaStore } from './quota';
import { mysqlQuotaStore } from './quota-mysql';

const log = (entry: Record<string, unknown>) =>
	console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));

async function main(): Promise<void> {
	const config = loadConfig();
	let store: QuotaStore;
	if (config.db) {
		store = await mysqlQuotaStore(config.db);
	} else {
		log({ event: 'warning', message: 'DB_NAME not set: quotas kept in memory (development only)' });
		store = memoryQuotaStore();
	}

	const provider = openAiCompatibleProvider({
		...config.ai,
		onAttempt: (info) => {
			if (!info.ok) log({ event: 'ai.attempt_failed', ...info });
		}
	});
	const handle = createApp({ config, store, provider, log });
	const server = createServer((req, res) => void handle(req, res));
	server.requestTimeout = 90_000;
	server.headersTimeout = 15_000;

	const prune = () =>
		store
			.prune(wibDay(Date.now() - 7 * 24 * 60 * 60 * 1000))
			.catch((error: unknown) =>
				log({ event: 'error', message: `prune: ${error instanceof Error ? error.message : error}` })
			);
	await prune();
	const pruneTimer = setInterval(prune, 6 * 60 * 60 * 1000);
	pruneTimer.unref();

	server.listen(config.port, '127.0.0.1', () =>
		log({ event: 'started', port: config.port, models: config.ai.models, db: Boolean(config.db) })
	);

	const shutdown = (signal: string) => {
		log({ event: 'stopping', signal });
		server.close(() => {
			void store.close().finally(() => process.exit(0));
		});
		setTimeout(() => process.exit(0), 10_000).unref();
	};
	process.on('SIGTERM', () => shutdown('SIGTERM'));
	process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
	// Config errors name the variable, never its value.
	log({ event: 'fatal', message: error instanceof Error ? error.message : String(error) });
	process.exit(1);
});
