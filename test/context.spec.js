/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {describe, expect, it} from 'vitest';
import {
  fromJsonPointerMap, matches, toJsonPointerMap
} from '../lib/index.js';

// `@context` is the one ordered array in a credential — later entries override
// earlier ones, so expressing it as a `Set` loses the thing that makes it mean
// anything. Every other array is a bag of candidates.
// Ported from oid4-client 1654f43, "Fix `@context` matching" (v5.13.2).

const V2 = 'https://www.w3.org/ns/credentials/v2';
const EXAMPLES = 'https://www.w3.org/ns/credentials/examples/v2';

const CREDENTIAL = {
  '@context': [V2, EXAMPLES],
  type: ['VerifiableCredential', 'ExampleCredential']
};

const asMap = obj => toJsonPointerMap({obj});

describe('building a map from an ordered array', () => {
  it('keeps @context as an array', () => {
    expect(asMap({'@context': [V2, EXAMPLES]}).get('/@context'))
      .toEqual([V2, EXAMPLES]);
  });

  it('still makes a Set of every other array', () => {
    expect(asMap({type: ['A', 'B']}).get('/type')).toEqual(new Set(['A', 'B']));
  });

  it('keys off the pointer, not the property name alone', () => {
    // a nested `@context` is ordered for the same reason the top-level one is
    const map = asMap({credentialSubject: {'@context': [V2]}});
    expect(map.get('/credentialSubject/@context')).toEqual([V2]);
  });
});

describe('matching an ordered @context', () => {
  it('matches when the order agrees', () => {
    expect(matches({
      object: CREDENTIAL, map: asMap({'@context': [V2, EXAMPLES]})
    })).toBe(true);
  });

  // the whole point: a `Set` would have called this a match
  it('does not match when the same entries are reordered', () => {
    expect(matches({
      object: CREDENTIAL, map: asMap({'@context': [EXAMPLES, V2]})
    })).toBe(false);
  });

  it('matches a leading subset, since the object may carry more', () => {
    expect(matches({
      object: CREDENTIAL, map: asMap({'@context': [V2]})
    })).toBe(true);
  });

  it('does not match a subset that is not the leading one', () => {
    expect(matches({
      object: CREDENTIAL, map: asMap({'@context': [EXAMPLES]})
    })).toBe(false);
  });

  it('leaves other arrays unordered', () => {
    expect(matches({
      object: CREDENTIAL,
      map: asMap({type: ['ExampleCredential', 'VerifiableCredential']})
    })).toBe(true);
  });
});

describe('rebuilding an ordered @context', () => {
  it('round-trips the order', () => {
    const obj = {'@context': [V2, EXAMPLES]};
    expect(fromJsonPointerMap({map: asMap(obj)})).toEqual(obj);
  });

  // `_fromPointers` converted maps inside a `Set` but not inside an array, so
  // an inline context object came back as a raw `Map` — which stringifies to
  // `{}`, so the loss was invisible to anything that logged the result
  it('rebuilds an inline context object rather than leaving a Map', () => {
    const obj = {'@context': [V2, {ex: 'https://example.com/#'}]};
    const rebuilt = fromJsonPointerMap({map: asMap(obj)});
    expect(rebuilt['@context'][1]).not.toBeInstanceOf(Map);
    expect(rebuilt).toEqual(obj);
  });
});
