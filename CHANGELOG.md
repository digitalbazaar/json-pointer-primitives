# @digitalbazaar/json-pointer-primitives ChangeLog

## 0.1.0 - TBD

### Added
- Initial release, extracted from `@digitalbazaar/vc-query`.
- `matches({object, map, options})` — conjunction over a pointer map,
  alternation over a `Set`, wildcards, array matching, optional number
  coercion.
- `toJsonPointerMap`, `fromJsonPointerMap`, `resolvePointer`, and the shared
  predicates `isObject`, `isNumber`, `toIntegerIfInteger`, `assert`.

### Changed
- `credentialMatches({credential, map})` is now `matches({object, map})`. It
  never inspected a credential; the name said otherwise.
- `MDOC_MDL` is not carried over. It is credential-specific and stays in
  `vc-query`.
