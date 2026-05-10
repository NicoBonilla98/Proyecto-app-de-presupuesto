export function createId(cryptoApi = globalThis.crypto) {
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoApi.getRandomValues(values);
    return `${Date.now().toString(36)}-${values[0].toString(36)}-${values[1].toString(36)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
