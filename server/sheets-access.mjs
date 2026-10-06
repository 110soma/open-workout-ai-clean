// v0.1 is an optional single-owner gateway, not a shared multi-user workbook.
// Missing/malformed configuration never authorizes any account.
export function isSheetsOwnerAllowed(userId, configuredOwner) {
  return typeof userId === 'string' && typeof configuredOwner === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(configuredOwner)
    && userId === configuredOwner;
}
