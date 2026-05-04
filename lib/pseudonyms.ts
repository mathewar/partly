const ADJECTIVES = [
  'Swift', 'Brave', 'Witty', 'Bold', 'Keen',
  'Cool', 'Wild', 'Calm', 'Jolly', 'Sly',
];

const ANIMALS = [
  'Panda', 'Otter', 'Fox', 'Bear', 'Wolf',
  'Hawk', 'Deer', 'Seal', 'Crane', 'Lynx',
];

export function generatePseudonym(existingPseudonyms: string[]): string {
  const all: string[] = [];
  for (const adj of ADJECTIVES) {
    for (const animal of ANIMALS) {
      all.push(`${adj} ${animal}`);
    }
  }
  const available = all.filter(p => !existingPseudonyms.includes(p));
  if (available.length === 0) return `Guest ${Date.now()}`;
  return available[Math.floor(Math.random() * available.length)];
}
