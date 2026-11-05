import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint recommends disabling no-undef for TS projects.
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Security & a11y: never render user data as HTML; buttons must declare a type.
		files: ['**/*.svelte'],
		rules: {
			'svelte/no-at-html-tags': 'error',
			'svelte/button-has-type': 'error',
			'svelte/no-target-blank': 'error'
		}
	},
	{
		// Architecture boundary: core is UI-agnostic and must not depend on UI, templates or routes.
		files: ['src/lib/core/**/*.{ts,js}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['#lib/ui', '#lib/ui/*', '#lib/templates', '#lib/templates/*'],
							message: 'core/ must not import from ui/ or templates/.'
						},
						{
							group: ['**/routes/**', '$app/*'],
							message: 'core/ must not depend on routes or SvelteKit runtime modules.'
						},
						{ group: ['*.svelte'], message: 'core/ must not import Svelte components.' }
					]
				}
			]
		}
	}
);
