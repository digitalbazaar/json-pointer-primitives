/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc.
 */
import {assert, isObject, resolvePointer, toIntegerIfInteger} from './util.js';

/**
 * Returns whether an object matches against a JSON pointer map.
 *
 * The map is a `Map` of JSON pointer to expected value. Every entry must
 * match. A `Set` as a value means any of its members may match, so alternation
 * nests inside conjunction.
 *
 * An empty `Map`, `Set` or string is a wildcard: any value, but the pointer
 * must still resolve. Prefer the empty `Map` -- `{}` in a JSON-LD example.
 * The empty string means the same, for QueryByExample compatibility.
 *
 * Nothing here knows what it is matching. Callers build the map from whatever
 * they have -- a QueryByExample `example`, a DCQL credential query, a
 * Presentation Exchange input descriptor, or a hand-written set of pointers --
 * and match credentials, render methods or anything else against it. Building
 * the map once and reusing it across candidates is the cheaper order.
 *
 * @param {object} options - The options.
 * @param {object} options.object - The object to try to match.
 * @param {Map} options.map - The JSON pointer map.
 * @param {object} [options.options] - Match options:
 *   [coerceNumbers=true] - Numeric strings and numbers compare equal.
 *
 * @returns {boolean} `true` if the object matches, `false` if not.
 */
export function matches({object, map, options = {coerceNumbers: true}} = {}) {
  // a bad `map` must not read as "matched everything"
  assert(map, 'map', Map);
  // only an object can match
  if(!isObject(object)) {
    return false;
  }
  return _match({cursor: object, matchValue: map, options});
}

function _match({cursor, matchValue, options}) {
  // handle wildcard matching
  if(_isWildcard(matchValue)) {
    return true;
  }

  if(matchValue instanceof Set) {
    // some element in the set must match `cursor`
    return [...matchValue].some(e => _match({cursor, matchValue: e, options}));
  }

  if(matchValue instanceof Map) {
    // all pointers and values in the map must match `cursor`
    return [...matchValue.entries()].every(([pointer, matchValue]) => {
      const value = resolvePointer(cursor, pointer);
      if(value === undefined) {
        // no value at `pointer`; no match
        return false;
      }
      // handles case where `value` is an empty array + wildcard `matchValue`
      if(_isWildcard(matchValue)) {
        return true;
      }
      // normalize value to an array for matching
      const values = Array.isArray(value) ? value : [value];
      // `matchValue` can only be an array for the `@context` case
      if(Array.isArray(matchValue)) {
        // each element of `matchValue` must be equal to the element in
        // `values` at the same index (note: `values` may have more elements
        // than `matchValue` and still match)
        return matchValue.every((mv, i) => values[i] === mv);
      }
      // handle matching each individual value on its own
      return values.some(v => _match({cursor: v, matchValue, options}));
    });
  }

  // primitive comparison
  if(cursor === matchValue) {
    return true;
  }

  // string/number coercion
  if(options.coerceNumbers) {
    const cursorNumber = toIntegerIfInteger(cursor);
    const matchNumber = toIntegerIfInteger(matchValue);
    return cursorNumber !== undefined && cursorNumber === matchNumber;
  }

  return false;
}

function _isWildcard(value) {
  // by type, not a bare `size`, which any object can carry
  return value === '' ||
    (value instanceof Map && value.size === 0) ||
    (value instanceof Set && value.size === 0);
}
