/**
 * Server configuration from environment variables (loaded with `node --env-file=…`).
 * Secrets (AI key, DB password, APP_SECRET) live ONLY in that env file on the VPS — never in the
 * repo, logs or responses. See server/README.md.
 */
export interface ServerConfig {
	port: number;
	/** Public origin of the site; POSTs from other origins are rejected. */
	appOrigin: string;
	/** ≥ 32 chars. Signs device tokens and hashes IPs. Changing it resets every device token. */
	appSecret: string;
	ai: {
		/** OpenAI-compatible base URL, e.g. https://router.example.com/v1 */
		baseUrl: string;
		apiKey: string;
		/** Tried in order; the next one is used when a model fails or times out. */
		models: string[];
		timeoutMs: number;
	};
	limits: {
		/** Free uses per device per day (owner: 3). */
		device: number;
		/** Per IP per day: a warnet/campus lab shares one IP. */
		ip: number;
		/** New device tokens per IP per day. */
		devicesPerIp: number;
		/** All users together per day: a cost ceiling. */
		global: number;
	};
	/** Unset → in-memory quota (development only: resets on restart). */
	db?: { host: string; port: number; user: string; password: string; database: string };
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`Missing environment variable ${name}`);
	return value;
}

function int(env: Env, name: string, fallback: number, min = 0): number {
	const raw = env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min)
		throw new Error(`${name} must be an integer ≥ ${min}`);
	return value;
}

export function loadConfig(env: Env = process.env): ServerConfig {
	const appSecret = required(env, 'APP_SECRET');
	if (appSecret.length < 32) throw new Error('APP_SECRET must be at least 32 characters');
	const baseUrl = required(env, 'AI_BASE_URL').replace(/\/+$/, '');
	if (!/^https?:\/\//.test(baseUrl)) throw new Error('AI_BASE_URL must start with http(s)://');
	const models = (env.AI_MODELS ?? 'cx/gpt-6.1-terra')
		.split(',')
		.map((model) => model.trim())
		.filter(Boolean);
	if (!models.length) throw new Error('AI_MODELS is empty');

	const dbName = env.DB_NAME?.trim();
	return {
		port: int(env, 'PORT', 8787, 1),
		appOrigin: (env.APP_ORIGIN ?? 'https://cvmaker.codiosity.com').replace(/\/+$/, ''),
		appSecret,
		ai: {
			baseUrl,
			apiKey: required(env, 'AI_API_KEY'),
			models,
			timeoutMs: int(env, 'AI_TIMEOUT_MS', 30_000, 1000)
		},
		limits: {
			device: int(env, 'AI_LIMIT_DEVICE', 3),
			ip: int(env, 'AI_LIMIT_IP', 30),
			devicesPerIp: int(env, 'AI_LIMIT_DEVICES_PER_IP', 10),
			global: int(env, 'AI_LIMIT_GLOBAL', 1500)
		},
		db: dbName
			? {
					host: env.DB_HOST?.trim() || 'localhost',
					port: int(env, 'DB_PORT', 3306, 1),
					user: required(env, 'DB_USER'),
					password: required(env, 'DB_PASSWORD'),
					database: dbName
				}
			: undefined
	};
}
