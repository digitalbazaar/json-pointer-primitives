/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {describe, expect, it} from 'vitest';
import {matches, toJsonPointerMap} from '../lib/index.js';

// Build a map the way a caller would: either from a nested example, or by
// hand from flat pointers. Both are the same `Map` in the end.
const fromExample = obj => toJsonPointerMap({obj});
const fromPointers = obj => new Map(Object.entries(obj));

const CREDENTIAL = {
  type: ['VerifiableCredential', 'MovieTicketCredential'],
  issuer: {id: 'did:example:issuer', name: 'Utopia Cinemas'},
  credentialSubject: {name: 'John Doe', seat: 'A1', row: 12, tags: []}
};

const RENDER_METHOD = {
  type: 'TemplateRenderMethod',
  renderSuite: 'html',
  name: 'front',
  template: {mediaType: 'text/html'}
};

describe('matching an object against a pointer map', () => {
  describe('conjunction — every entry must match', () => {
    it('matches when all pointers match', () => {
      expect(matches({
        object: CREDENTIAL,
        map: fromPointers({
          '/issuer/id': 'did:example:issuer',
          '/credentialSubject/seat': 'A1'
        })
      })).toBe(true);
    });

    it('does not match when one pointer of several fails', () => {
      expect(matches({
        object: CREDENTIAL,
        map: fromPointers({
          '/issuer/id': 'did:example:issuer',
          '/credentialSubject/seat': 'B2'
        })
      })).toBe(false);
    });

    it('does not match a pointer that resolves to nothing', () => {
      expect(matches({
        object: CREDENTIAL, map: fromPointers({'/absent': 'anything'})
      })).toBe(false);
    });

    it('matches an empty map, which asks for nothing', () => {
      expect(matches({object: CREDENTIAL, map: fromExample({})})).toBe(true);
    });
  });

  describe('arrays', () => {
    it('matches a value inside an array at the pointer', () => {
      // `/type` resolves to an array; any member matching is a match
      expect(matches({
        object: CREDENTIAL,
        map: fromPointers({'/type': 'MovieTicketCredential'})
      })).toBe(true);
    });

    it('does not match a value absent from the array', () => {
      expect(matches({
        object: CREDENTIAL, map: fromPointers({'/type': 'DriversLicense'})
      })).toBe(false);
    });
  });

  describe('alternation — a Set means any member may match', () => {
    it('matches when one member of the set matches', () => {
      const map = new Map([['/credentialSubject/seat', new Set(['B2', 'A1'])]]);
      expect(matches({object: CREDENTIAL, map})).toBe(true);
    });

    it('does not match when no member matches', () => {
      const map = new Map([['/credentialSubject/seat', new Set(['B2', 'C3'])]]);
      expect(matches({object: CREDENTIAL, map})).toBe(false);
    });
  });

  describe('wildcards', () => {
    // an empty Map is what `{}` in an example becomes -- the preferred form.
    // The empty string is QueryByExample's `"firstName": ""` convention.
    it.each([
      ['an empty Map', new Map()],
      ['an empty Set', new Set()],
      ['an empty string', '']
    ])('treats %s as "any value at this pointer"', (_label, wildcard) => {
      const map = new Map([['/credentialSubject/name', wildcard]]);
      expect(matches({object: CREDENTIAL, map})).toBe(true);
    });

    it('cannot tell "any value" from "the empty string"', () => {
      const map = new Map([['/credentialSubject/seat', '']]);
      expect(matches({object: CREDENTIAL, map})).toBe(true);
      expect(matches({
        object: {credentialSubject: {seat: ''}}, map
      })).toBe(true);
    });

    it('still requires the pointer to resolve', () => {
      const map = new Map([['/absent', '']]);
      expect(matches({object: CREDENTIAL, map})).toBe(false);
    });

    it('matches an empty array against the empty-array wildcard', () => {
      expect(matches({
        object: CREDENTIAL, map: fromExample({credentialSubject: {tags: []}})
      })).toBe(true);
    });
  });

  describe('number coercion', () => {
    it('compares a numeric string equal to a number by default', () => {
      expect(matches({
        object: CREDENTIAL, map: fromPointers({'/credentialSubject/row': '12'})
      })).toBe(true);
    });

    it('does not coerce when told not to', () => {
      expect(matches({
        object: CREDENTIAL,
        map: fromPointers({'/credentialSubject/row': '12'}),
        options: {coerceNumbers: false}
      })).toBe(false);
    });
  });

  describe('what it refuses', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', 'not an object'],
      ['an array', [1, 2]]
    ])('does not match %s', (_label, object) => {
      expect(matches({object, map: fromExample({})})).toBe(false);
    });
  });

  // The reason this package exists apart from any credential library: the
  // matcher has no idea what it is matching.
  describe('objects that are not credentials', () => {
    it('matches a render method by its declared fields', () => {
      expect(matches({
        object: RENDER_METHOD,
        map: fromPointers({
          '/type': 'TemplateRenderMethod',
          '/renderSuite': 'html',
          '/template/mediaType': 'text/html'
        })
      })).toBe(true);
    });

    it('rejects a render method the caller cannot display', () => {
      expect(matches({
        object: {...RENDER_METHOD, renderSuite: 'nfc'},
        map: fromPointers({'/renderSuite': 'html'})
      })).toBe(false);
    });

    it('accepts a map built from a nested example just the same', () => {
      expect(matches({
        object: RENDER_METHOD,
        map: fromExample({
          renderSuite: 'html', template: {mediaType: 'text/html'}
        })
      })).toBe(true);
    });
  });
});
