/*
 * Auralis JS shard: 00b-strings.js
 * Purpose: Shared user-facing and diagnostic text for the runtime.
 * Populates AuralisStrings (initialized as {} in 00a-runtime-logger.js).
 */
    Object.assign(AuralisStrings, {
        storageReadFailed: 'Browser storage could not be read.',
        storageWriteFailed: 'Browser storage could not be updated.',
        storageRemoveFailed: 'Browser storage entry could not be removed.',
        storageClearFailed: 'Browser storage cleanup could not remove an entry.',
        storageJsonParseFailed: 'Saved browser storage data could not be parsed.',
        storageJsonStringifyFailed: 'Saved browser storage data could not be prepared.',
        storageLargeWrite: 'A large browser storage write was detected.',
        verificationReady: 'Auralis runtime verification is available.'
    });
