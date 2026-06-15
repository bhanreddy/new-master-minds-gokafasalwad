export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const normalize = (version: string) =>
    String(version || '0.0.0')
      .split('.')
      .map((part) => {
        const parsed = Number.parseInt(part.replace(/[^\d].*$/, ''), 10);
        return Number.isFinite(parsed) ? parsed : 0;
      });

  const left = normalize(a);
  const right = normalize(b);
  const length = Math.max(left.length, right.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;

    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }

  return 0;
}
