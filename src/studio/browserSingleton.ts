/** Module URL variants must share one store within a tab, never across server requests. */
export function browserSingleton<T>(key: string, create: () => T, registry: object | undefined = typeof window === 'undefined' ? undefined : window): { value: T; created: boolean } {
  if (!registry) return { value: create(), created: true };
  const symbol = Symbol.for(key);
  const values = registry as Record<symbol, T>;
  if (Object.prototype.hasOwnProperty.call(values, symbol)) return { value: values[symbol], created: false };
  const value = create();
  Object.defineProperty(values, symbol, { value, configurable: true });
  return { value, created: true };
}
