import { describe, expect, it } from 'vitest';
import { evaluateTest, parseTvtmsCell } from '@/scripts/lib/tvtms';

describe('TVTMS cells', () => {
  it('parses ranges, lists and annotations', () => {
    expect(parseTvtmsCell('Gen.32:2-4')).toEqual([
      { c: 32, v: 2 },
      { c: 32, v: 3 },
      { c: 32, v: 4 },
    ]);
    expect(parseTvtmsCell('1Sa.20:42; 21:1')).toEqual([
      { c: 20, v: 42 },
      { c: 21, v: 1 },
    ]);
    expect(parseTvtmsCell('Dan.4:30.0-3 [=Dan.4:30.1-3]')).toEqual([{ c: 4, v: 30 }]);
    expect(parseTvtmsCell('Absent [=Neh.7:69]')).toBeNull();
    expect(parseTvtmsCell('NoVerse')).toBeNull();
  });

  it('evaluates Last / Exist / NotExist tests', () => {
    const lengths = [10, 32];
    expect(evaluateTest('Gen.2:32=Last', lengths, 'Gen')).toBe('pass');
    expect(evaluateTest('Gen.2:33=Last', lengths, 'Gen')).toBe('fail');
    expect(evaluateTest('Gen.2:33=NotExist', lengths, 'Gen')).toBe('pass');
    expect(evaluateTest('Gen.2:5.1=Exist', lengths, 'Gen')).toBe('fail');
    expect(evaluateTest('Gen.2:5<Gen.2:6', lengths, 'Gen')).toBe('unknown');
  });
});
