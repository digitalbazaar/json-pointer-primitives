# @digitalbazaar/json-pointer-primitives ChangeLog

## 0.1.0 - TBD

### Added
- Initial release, extracted from `@digitalbazaar/vc-query`.
- `matches({object, map, options})` — conjunction over a pointer map,
  alternation over a `Set`, wildcards, array matching, optional number
  coercion.
- `toJsonPointerMap`, `fromJsonPointerMap`, `resolvePointer`, the predicates
  `isObject` and `isNumber`, the coercion helper `toIntegerIfInteger`, and the
  type assertion `assert`.

### Changed
- `credentialMatches({credential, map})` is now `matches({object, map})`. It
  never inspected a credential; the name said otherwise.
- `MDOC_MDL` is not carried over. It is credential-specific and stays in
  `vc-query`.

### Fixed
Five defects inherited from `vc-query`. Each throws where it used to return a
value, so a caller relying on the old behaviour must handle the error — see
"Migrating from vc-query" below.

- `matches` asserts that `map` is a `Map`. `_isWildcard` tested a bare `size`,
  so any value carrying `size: 0` — including a `''` or a `{"size": 0}` parsed
  from JSON — made every constraint match. A malformed map now throws instead
  of reading as "matched everything".
- `resolvePointer` walks tokens against own properties. `jsonpointer.get` gates
  each hop on `in`, so `/toString`, `/constructor` and `/valueOf` resolved on
  every plain object and satisfied a presence check against a document with no
  such field.
- `fromJsonPointerMap` refuses `__proto__`, `constructor` and `prototype` in a
  pointer. `jsonpointer.set` assigns through `__proto__` as a final token,
  which replaced the prototype of the object being rebuilt: it stringified as
  `{}` while its properties still read back.
- `toJsonPointerMap` always returns a `Map`. It returned the walk cursor, so
  `undefined`, `null` and a top-level array came back as something with no
  `.get`. A `null` `obj` now throws.
- `fromJsonPointerMap` refuses a root pointer alongside other pointers. The
  root entry returned from inside the loop, silently discarding every other
  entry in either key order.

### Migrating from vc-query
- `exampleToJsonPointerMap({example: null})` threw nothing and produced `null`,
  which then matched no credentials. `toJsonPointerMap` now throws on a `null`
  `obj`, so the caller has to reject a malformed example itself. There is no
  map value meaning "match nothing" — an empty `Map` is a wildcard.
