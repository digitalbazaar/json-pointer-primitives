/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {describe, expect, it} from 'vitest';
import {
  fromJsonPointerMap, matches, resolvePointer, toJsonPointerMap
} from '../lib/index.js';

// Five defects carried over from vc-query, each reachable with a pointer map
// or a document supplied by another party. A verifier authors the map in the
// query flow this package was extracted from, so neither side is trusted.

describe('a map that is not a Map', () => {
  // `_isWildcard` keys off `size`, so before this every one of these read as
  // "matched everything" rather than "bad argument"
  it.each([
    ['an empty string', ''],
    ['an object carrying size: 0', {size: 0}],
    ['a Set', new Set(['/a'])],
    ['a plain object of pointers', {'/a': 1}]
  ])('is refused rather than treated as a wildcard: %s', (_label, map) => {
    expect(() => matches({object: {a: 1}, map})).toThrow(TypeError);
  });

  it('is refused when absent entirely', () => {
    expect(() => matches({object: {a: 1}})).toThrow(/required/);
  });

  it('still matches normally once it is a real Map', () => {
    expect(matches({object: {a: 1}, map: new Map([['/a', 1]])})).toBe(true);
  });
});

describe('pointers that reach the prototype', () => {
  const DOCUMENT = {a: 1};

  // `jsonpointer.get` gates each hop on `in`, which walks the prototype
  // chain, so these all resolved to functions on any plain object
  it.each(['/toString', '/valueOf', '/hasOwnProperty', '/isPrototypeOf'])(
    'does not resolve %s on a document that has no such field', pointer => {
      expect(resolvePointer(DOCUMENT, pointer)).toBeUndefined();
    });

  it.each(['/__proto__', '/constructor', '/a/constructor'])(
    'refuses the unsafe token in %s', pointer => {
      expect(resolvePointer(DOCUMENT, pointer)).toBeUndefined();
    });

  // the presence check is the reachable consequence: a wildcard entry on an
  // inherited name would have matched every object alive
  it('does not let an inherited name satisfy a wildcard', () => {
    const map = new Map([['/toString', '']]);
    expect(matches({object: DOCUMENT, map})).toBe(false);
  });

  it('still resolves an own property that shadows an inherited one', () => {
    expect(resolvePointer({toString: 'mine'}, '/toString')).toBe('mine');
  });
});

describe('rebuilding through a prototype-swapping pointer', () => {
  // `jsonpointer.set` skips `__proto__` in intermediate positions but assigns
  // through it as the final token: the result stringified as `{}` while its
  // properties still read back
  it.each([
    ['a Map value', new Map([['/polluted', 'yes']])],
    ['a primitive value', 'yes']
  ])('throws instead of swapping the prototype — %s', (_label, value) => {
    const map = new Map([['/a/__proto__', value]]);
    expect(() => fromJsonPointerMap({map})).toThrow(/unsafe token/);
  });

  it.each(['/constructor/x', '/a/prototype'])('throws on %s', pointer => {
    expect(() => fromJsonPointerMap({map: new Map([[pointer, 1]])}))
      .toThrow(/unsafe token/);
  });
});

describe('what toJsonPointerMap hands back', () => {
  // it returned the walk cursor, so three inputs its own assert allowed came
  // back as something without `.get`
  it('is a Map even for a top-level array', () => {
    expect(toJsonPointerMap({obj: ['a', 'b']})).toBeInstanceOf(Map);
  });

  it.each([
    ['no argument', undefined, /required/],
    ['null', {obj: null}, /must not be null/]
  ])('refuses %s', (_label, args, message) => {
    expect(() => toJsonPointerMap(args)).toThrow(message);
  });
});

describe('a root pointer beside other pointers', () => {
  // the root entry returns from inside the loop, so whatever else the map
  // held was discarded — in either key order
  it.each([
    ['root last', [['/a', 1], ['/', {x: 2}]]],
    ['root first', [['/', {x: 2}], ['/a', 1]]]
  ])('is refused rather than silently dropping entries — %s',
    (_label, entries) => {
      expect(() => fromJsonPointerMap({map: new Map(entries)}))
        .toThrow(/cannot be combined/);
    });

  it('is still accepted on its own', () => {
    const map = new Map([['/', {x: 2}]]);
    expect(fromJsonPointerMap({map})).toEqual({x: 2});
  });
});
