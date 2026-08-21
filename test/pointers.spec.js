/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {
  assert, fromJsonPointerMap, isNumber, resolvePointer, toIntegerIfInteger,
  toJsonPointerMap
} from '../lib/index.js';
import {describe, expect, it} from 'vitest';

// These pin the pointer behaviour this package inherits from `json-pointer`.
// Nothing above the dependency enforces it, so a bump could change any of it
// silently; that is what these tests are for.
//
// One limit worth stating: `resolvePointer` catches every error and returns
// `undefined` (lib/util.js:36), so what is pinned there is its own output
// contract, not the dependency's. A bump that starts throwing where it used
// to return `undefined` would keep these green. The map-building tests have
// no such catch, so those do pin the dependency directly.

describe('resolving a pointer', () => {
  // RFC 6901: `-` names the element after the last one. It exists so JSON
  // Patch can append, and must never resolve to a value on a read.
  describe('the `-` token', () => {
    it('resolves to nothing on an array', () => {
      expect(resolvePointer({foo: ['a', 'b']}, '/foo/-')).toBeUndefined();
    });

    it('resolves a literal `-` key on an object', () => {
      // the special meaning belongs to arrays only
      expect(resolvePointer({foo: {'-': 'dash'}}, '/foo/-')).toBe('dash');
    });
  });

  describe('escaping', () => {
    // `~1` must be decoded before `~0`, or `~01` wrongly yields `/`
    it.each([
      ['/m~0n', {'m~n': 'tilde'}, 'tilde'],
      ['/a~1b', {'a/b': 'slash'}, 'slash'],
      ['/~01', {'~1': 'escaped tilde-one'}, 'escaped tilde-one']
    ])('decodes %s', (pointer, object, expected) => {
      expect(resolvePointer(object, pointer)).toBe(expected);
    });
  });

  describe('array indices', () => {
    it('resolves an in-range index', () => {
      expect(resolvePointer({foo: ['a', 'b']}, '/foo/1')).toBe('b');
    });

    it('resolves to nothing past the end', () => {
      expect(resolvePointer({foo: ['a', 'b']}, '/foo/2')).toBeUndefined();
    });

    it('rejects a leading zero rather than reading it as an index', () => {
      // RFC 6901 array tokens are base-10 with no leading zeros
      expect(resolvePointer({foo: ['a', 'b']}, '/foo/01')).toBeUndefined();
    });
  });

  // The bug fixed in bedrock-vue-wallet #155: a missing segment must abandon
  // the whole pointer, not fall back to the document root and keep walking.
  // The root must carry a value for the remaining token, or an implementation
  // that re-roots and one that abandons are indistinguishable.
  it('resolves to nothing when a segment is missing', () => {
    const doc = {b: 'a value the root would supply', a: {}};
    expect(resolvePointer(doc, '/absent/b')).toBeUndefined();
  });

  // A deliberate departure from RFC 6901, relied on across vc-query: there,
  // `""` is the whole document and `"/"` is the value under the empty-string
  // key. Here both mean the whole document, so an empty-string key cannot be
  // addressed. Pinned because it is a convention, not an oversight.
  describe('the root pointer convention', () => {
    const DOC = {'': 'under the empty key', a: 1};

    it.each([['the empty string', ''], ['a lone slash', '/']])(
      'treats %s as the whole document', (_label, pointer) => {
        expect(resolvePointer(DOC, pointer)).toEqual(DOC);
      });
  });
});

describe('recognising integer tokens', () => {
  it.each([
    ['a plain integer string', '12', 12, true],
    ['a negative integer string', '-5', -5, true],
    ['a number', 12, 12, true],
    ['a leading zero', '01', '01', false],
    ['a decimal', '1.5', '1.5', false],
    ['a trailing-garbage number', '12abc', '12abc', false],
    ['the dash token', '-', '-', false],
    ['an empty string', '', '', false],
    ['a word', 'abc', 'abc', false]
  ])('%s', (_label, input, converted, numeric) => {
    expect(toIntegerIfInteger(input)).toBe(converted);
    expect(isNumber(input)).toBe(numeric);
  });
});

describe('building a pointer map from an object', () => {
  const EXAMPLE = {
    type: ['A', 'B'], sub: {seat: 'A1'}, tags: [], empty: {}
  };

  it('turns an array into a Set of candidate values', () => {
    // the nested form is what alternation matching consumes
    expect(toJsonPointerMap({obj: EXAMPLE}).get('/type'))
      .toEqual(new Set(['A', 'B']));
  });

  it('turns an array into indexed pointers when flat', () => {
    const map = toJsonPointerMap({obj: EXAMPLE, flat: true});
    expect([...map]).toEqual(expect.arrayContaining([
      ['/type/0', 'A'], ['/type/1', 'B']
    ]));
  });

  it('escapes reserved characters on the way out', () => {
    const map = toJsonPointerMap({obj: {'m~n': 1, 'a/b': 2}, flat: true});
    expect([...map.keys()]).toEqual(['/m~0n', '/a~1b']);
  });

  // Presence is not enough: `_isWildcard` keys off size, so the container has
  // to arrive empty or every wildcard match against one breaks.
  it.each([
    ['an empty array', 'tags', new Set()],
    ['an empty object', 'empty', new Map()]
  ])('represents %s as an empty container', (_label, key, expected) => {
    expect(toJsonPointerMap({obj: EXAMPLE}).get(`/${key}`)).toEqual(expected);
  });
});

describe('rebuilding an object from a pointer map', () => {
  it('round-trips a nested object', () => {
    const obj = {issuer: {id: 'did:example:1'}, type: ['A', 'B']};
    const map = toJsonPointerMap({obj, flat: true});
    expect(fromJsonPointerMap({map})).toEqual(obj);
  });

  it('round-trips escaped keys', () => {
    const obj = {'m~n': 1, 'a/b': 2};
    const map = toJsonPointerMap({obj, flat: true});
    expect(fromJsonPointerMap({map})).toEqual(obj);
  });

  it('expands a Set into an array', () => {
    const map = new Map([['/type', new Set(['A', 'B'])]]);
    expect(fromJsonPointerMap({map})).toEqual({type: ['A', 'B']});
  });

  it('returns the value itself for the root pointer', () => {
    const map = new Map([['/', {whole: 'document'}]]);
    expect(fromJsonPointerMap({map})).toEqual({whole: 'document'});
  });

  // Container type is inferred from the *next* token's shape. vc-query's
  // dcql.js depends on this: it compiles DCQL's `null` ("any array index")
  // to the literal token `0` precisely so an array is rebuilt here.
  describe('inferring a container from the next token', () => {
    it('builds an array from a numeric token', () => {
      const map = new Map([['/a/0', 'x'], ['/a/1', 'y']]);
      expect(fromJsonPointerMap({map})).toEqual({a: ['x', 'y']});
    });

    it('builds an array from the `-` token, appending', () => {
      expect(fromJsonPointerMap({map: new Map([['/a/-', 'x']])}))
        .toEqual({a: ['x']});
    });

    it('builds an object from a non-numeric token', () => {
      expect(fromJsonPointerMap({map: new Map([['/a/b', 'x']])}))
        .toEqual({a: {b: 'x'}});
    });

    // The consequence: an object keyed by numeric strings does not survive
    // the trip. Unreachable from DCQL, which never emits such keys.
    it('cannot rebuild an object whose keys are numeric strings', () => {
      const map = toJsonPointerMap({obj: {a: {0: 'x'}}, flat: true});
      expect(fromJsonPointerMap({map})).toEqual({a: ['x']});
    });
  });
});

describe('asserting a value type', () => {
  it('accepts a value of the named primitive type', () => {
    expect(() => assert({}, 'name', 'object')).not.toThrow();
  });

  it('accepts an instance of the named class', () => {
    expect(() => assert(new Map(), 'name', Map)).not.toThrow();
  });

  it.each([
    ['a primitive mismatch', 'a string', 'object', /must be an object/],
    ['a class mismatch', {}, Map, /must be a Map/]
  ])('rejects %s', (_label, value, type, message) => {
    expect(() => assert(value, 'name', type)).toThrow(TypeError);
    expect(() => assert(value, 'name', type)).toThrow(message);
  });

  it('names the offending parameter', () => {
    expect(() => assert('a string', 'credentialQuery', 'object'))
      .toThrow(/credentialQuery/);
  });

  describe('a missing value', () => {
    it('is refused when the parameter is not optional', () => {
      expect(() => assert(undefined, 'name', Map)).toThrow(/required/);
    });

    it('is accepted when the parameter is optional', () => {
      expect(() => assert(undefined, 'name', Map, true)).not.toThrow();
    });
  });

  it('prefixes the message only when marked optional', () => {
    expect(() => assert('a string', 'name', 'object', true))
      .toThrow(/When present,/);
    expect(() => assert('a string', 'name', 'object', false))
      .not.toThrow(/When present,/);
  });
});
