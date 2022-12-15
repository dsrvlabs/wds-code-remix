export function isEmptyList(list: unknown): boolean {
  return !Array.isArray(list) || list.length === 0;
}

export function isNotEmptyList(list: unknown): boolean {
  return !isEmptyList(list);
}

export function range(len: number) {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
}

export function numbers(first: number, last: number): number[] {
  if (last - first < 0) {
    return [];
  }

  return Array.from({ length: last - first + 1 }, (_, i) => i + first);
}
