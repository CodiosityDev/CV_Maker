/**
 * Dependency-free storage constant, kept apart from idb-backend.ts so the home page's light
 * `core/home` module can open the database without pulling in `idb`.
 */

/** IndexedDB database name (see idb-backend.ts). */
export const DB_NAME = 'cvmaker';
