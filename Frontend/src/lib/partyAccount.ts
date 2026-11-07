/** Sort a copy so chronological running balances remain attached to their event. */
export function newestFirst<T extends { id: number; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
}
