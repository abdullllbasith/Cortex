/** Remove characters that Postgres UTF8 text columns reject */
export function sanitizePostgresText(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .trim()
}
