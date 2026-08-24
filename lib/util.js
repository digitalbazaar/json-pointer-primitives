/*!
 * Copyright (c) 2022-2026 Digital Bazaar, Inc. All rights reserved.
 */
import jsonpointer from 'json-pointer';

// tokens that reach an object's prototype instead of its own properties;
// refused on both the read and the write path
const UNSAFE_TOKENS = new Set(['__proto__', 'constructor', 'prototype']);

export function assert(x, name, type, optional = false) {
  const article = type === 'object' ? 'an' : 'a';
  const expected = `${article} ${type?.name ?? type}`;
  if(x === undefined) {
    if(optional) {
      return;
    }
    throw new TypeError(`"${name}" is required and must be ${expected}.`);
  }
  const xType = typeof type === 'string' ?
    typeof x : (x instanceof type && type);
  if(xType !== type) {
    throw new TypeError(
      `${optional ? 'When present, ' : ''}"${name}" must be ${expected}.`);
  }
}

export function fromJsonPointerMap({map} = {}) {
  assert(map, 'map', Map);
  // the root pointer returns immediately, so anything beside it is silently
  // discarded; refuse the combination rather than pick a winner
  if(map.size > 1 && map.has('/')) {
    throw new Error(
      'A root pointer "/" cannot be combined with other pointers.');
  }
  return _fromPointers({map});
}

export function isNumber(x) {
  return typeof toIntegerIfInteger(x) === 'number';
}

export function isObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

export function resolvePointer(obj, pointer) {
  if(pointer === '/') {
    return obj;
  }
  let tokens;
  try {
    tokens = jsonpointer.parse(pointer);
  } catch{
    return undefined;
  }
  // walked here rather than through `jsonpointer.get`, which gates each hop
  // on `in` and so resolves inherited properties -- `/toString` would satisfy
  // a presence check against a document that has no such field
  let cursor = obj;
  for(const token of tokens) {
    if(UNSAFE_TOKENS.has(token) || cursor === null ||
      typeof cursor !== 'object' || !Object.hasOwn(cursor, token)) {
      return undefined;
    }
    cursor = cursor[token];
  }
  return cursor;
}

// produces a map of deep pointers to primitives and sets; the values in each
// set share the same pointer value and if any value in the set is an object,
// it becomes a new map of deep pointers from that starting place; the pointer
// value for an empty objects will be an empty map
export function toJsonPointerMap({obj, flat = false} = {}) {
  assert(obj, 'obj', 'object');
  if(obj === null) {
    throw new TypeError('"obj" must not be null.');
  }
  // `_toPointers` returns the cursor, not the map, for a primitive or a
  // top-level array; the map is what every caller wants back
  const map = new Map();
  _toPointers({cursor: obj, map, flat});
  return map;
}

export function toIntegerIfInteger(x) {
  if(typeof x === 'string') {
    const i = parseInt(x, 10);
    return i.toString() === x ? i : x;
  }
  return x;
}

// `jsonpointer.set` skips `__proto__` in intermediate positions but assigns
// through it as the final token, which swaps the prototype of the object being
// rebuilt: the result then stringifies as `{}` while its properties still read
function _assertSafePointer(pointer) {
  for(const token of jsonpointer.parse(pointer)) {
    if(UNSAFE_TOKENS.has(token)) {
      throw new Error(
        `JSON pointer "${pointer}" contains unsafe token "${token}".`);
    }
  }
}

function _fromPointers({map} = {}) {
  const result = {};

  for(const [pointer, value] of map) {
    // convert any non-primitive values
    let val = value;
    if(value instanceof Map) {
      val = _fromPointers({map: value});
    } else if(value instanceof Set || Array.isArray(value)) {
      // an array is the ordered `@context` container; a `Set` is every other
      // array. Both may hold maps built from inline objects
      val = [...value].map(e => e instanceof Map ? _fromPointers({map: e}) : e);
    }

    // if root pointer is used, `value` is result
    if(pointer === '/') {
      return val;
    }

    _assertSafePointer(pointer);
    jsonpointer.set(result, pointer, val);
  }

  return result;
}

function _toPointers({
  cursor, map, tokens = [], pointer = '/', flat = false
}) {
  if(!flat && Array.isArray(cursor)) {
    // when producing non-flat output, every array is treated as a `Set` except
    // if the pointer points at an `@context` array (this is the only ordered
    // list case)
    let container;
    let add;
    if(pointer.endsWith('/@context')) {
      container = [];
      add = container.push;
    } else {
      container = new Set();
      add = container.add;
    }
    add = add.bind(container);
    // result is `container` if `map` is defined, if not, then case is
    // array of arrays and result is a new map
    const result = map ? container : (map = new Map());
    map.set(pointer, container);
    for(const element of cursor) {
      // reset map, tokens, and pointer for array elements
      add(_toPointers({cursor: element, flat}));
    }
    return result;
  }
  if(cursor !== null && typeof cursor === 'object') {
    map = map ?? new Map();
    const entries = Object.entries(cursor);
    if(entries.length === 0) {
      // ensure empty object / array case is represented
      map.set(pointer, Array.isArray(cursor) ? new Set() : new Map());
    }
    for(const [token, value] of entries) {
      tokens.push(String(token));
      pointer = jsonpointer.compile(tokens);
      _toPointers({cursor: value, map, tokens, pointer, flat});
      tokens.pop();
    }
    return map;
  }
  map?.set(pointer, cursor);
  return cursor;
}
