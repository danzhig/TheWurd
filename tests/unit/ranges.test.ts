import { describe, expect, it } from 'vitest';
import { expandRange, parseRange, type Inventory } from '@/scripts/lib/ranges';

const inv: Inventory = new Map([
  ['1', [1, 2, 3]],
  ['2', [1, 2, 3, 4]],
  ['3', [1, 2]],
  ['A', [1, 2, 3]],
]);

describe('plan range notation', () => {
  it('parses every form in rangeNotation', () => {
    expect(parseRange('6-9')).toHaveLength(1);
    expect(parseRange('3; B:1-7')).toHaveLength(2);
    expect(() => parseRange('6 to 9')).toThrow();
  });

  it('expands whole chapters, verse ranges and end', () => {
    expect(expandRange('2', inv)).toEqual(['2:1', '2:2', '2:3', '2:4']);
    expect(expandRange('1-2', inv)).toHaveLength(7);
    expect(expandRange('1:2-2:end', inv)).toEqual(['1:2', '1:3', '2:1', '2:2', '2:3', '2:4']);
    expect(expandRange('2:3-end', inv)).toEqual(['2:3', '2:4']);
    expect(expandRange('2:2-3:1', inv)).toEqual(['2:2', '2:3', '2:4', '3:1']);
    expect(expandRange('3; A:1-2', inv)).toEqual(['3:1', '3:2', 'A:1', 'A:2']);
  });

  it('refuses bounds that do not exist', () => {
    expect(() => expandRange('2:5-9', inv)).toThrow(/2:5 does not exist/);
    expect(() => expandRange('4', inv)).toThrow(/chapter 4/);
  });
});
