# @digitalbazaar/json-pointer-primitives ChangeLog

## 1.0.0 - TBD

### Added
- Initial release.
- `matches({object, map})` — tests any object against a map of JSON pointers to
  expected values. Every entry must match; a `Set` as a value means any of its
  members may match; an empty `Map`, `Set` or string is a wildcard. An array is
  the ordered `@context` case, where each element must equal the element at the
  same index and the object may carry more.
- Prefer an empty `Map` as the wildcard — `{}` in a JSON-LD example, matching
  JSON-LD Framing. The empty string means the same for QueryByExample
  compatibility, but conflates "any value" with "the empty string".
- `toJsonPointerMap({obj, flat})` and `fromJsonPointerMap({map})` — build a
  pointer map from an object and rebuild an object from one. Non-flat output
  expresses arrays as a `Set`, except at `@context`, which stays ordered.
- `resolvePointer(obj, pointer)` — reads one pointer against own properties.
- `isObject`, `isNumber`, `toIntegerIfInteger`, `assert`.
