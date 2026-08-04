/*
  Italian counts read "1 cane" and "2 cani". Written inline the plural form
  wins by default and every count of one comes out wrong, which is how the
  admin calendar ended up saying "1 cani".
*/
export function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

export function pluralWord(count: number, singular: string, many: string): string {
  return count === 1 ? singular : many;
}
