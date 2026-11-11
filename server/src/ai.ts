/**
 * OpenAI-compatible chat completions (the owner's router). Tries each configured model in order
 * until one answers in time. Never logs prompts or answers (they contain CV content).
 */
export interface ChatMessage {
	role: 'system' | 'user';
	content: string;
}

export interface ChatProvider {
	/** The model's text answer; throws when every model failed. */
	complete(
		messages: ChatMessage[],
		options?: { maxTokens?: number; timeoutMs?: number; temperature?: number }
	): Promise<{ text: string; model: string }>;
}

export interface OpenAiCompatibleOptions {
	baseUrl: string;
	apiKey: string;
	models: string[];
	timeoutMs: number;
	fetch?: typeof fetch;
	/** Called with metadata only (model, ms, outcome) — for server logs. */
	onAttempt?: (info: { model: string; ms: number; ok: boolean; status?: number }) => void;
}

interface CompletionBody {
	choices?: { message?: { content?: unknown } }[];
}

export function openAiCompatibleProvider(options: OpenAiCompatibleOptions): ChatProvider {
	const doFetch = options.fetch ?? globalThis.fetch;
	return {
		async complete(messages, completeOptions) {
			for (const model of options.models) {
				const started = Date.now();
				const controller = new AbortController();
				const timer = setTimeout(
					() => controller.abort(),
					completeOptions?.timeoutMs ?? options.timeoutMs
				);
				try {
					const response = await doFetch(`${options.baseUrl}/chat/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${options.apiKey}`
						},
						body: JSON.stringify({
							model,
							messages,
							temperature: completeOptions?.temperature ?? 0.4,
							max_tokens: completeOptions?.maxTokens ?? 700
						}),
						signal: controller.signal
					});
					if (!response.ok) {
						options.onAttempt?.({
							model,
							ms: Date.now() - started,
							ok: false,
							status: response.status
						});
						continue;
					}
					const body = (await response.json()) as CompletionBody;
					const text = body.choices?.[0]?.message?.content;
					if (typeof text !== 'string' || !text.trim()) {
						options.onAttempt?.({ model, ms: Date.now() - started, ok: false });
						continue;
					}
					options.onAttempt?.({ model, ms: Date.now() - started, ok: true });
					return { text, model };
				} catch {
					options.onAttempt?.({ model, ms: Date.now() - started, ok: false });
				} finally {
					clearTimeout(timer);
				}
			}
			throw new Error('All AI models failed');
		}
	};
}
