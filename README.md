# @digitalbazaar/json-pointer-primitives

Building blocks for matching objects against JSON pointers: convert a nested
object into a map of pointers to values, resolve a pointer, and test whether an
object satisfies such a map.

It does not know what it is matching. Give it any object and any map.

```js
import {matches} from '@digitalbazaar/json-pointer-primitives';

matches({
  object: credential,
  map: new Map([
    ['/type', 'MovieTicketCredential'],
    ['/issuer/id', 'did:example:issuer']
  ])
});
// true — every entry matched
```

One runtime dependency, `json-pointer`. Runs on node and in a browser.

## Semantics

Every entry in the map must match, so entries are a conjunction:

```js
const credential = {
  type: ['VerifiableCredential', 'MovieTicketCredential'],
  issuer: {id: 'did:example:issuer'},
  credentialSubject: {seat: 'A1', row: 12}
};

matches({object: credential, map: new Map([
  ['/issuer/id', 'did:example:issuer'],
  ['/credentialSubject/seat', 'A1']
])});                                              // true

matches({object: credential, map: new Map([
  ['/issuer/id', 'did:example:issuer'],
  ['/credentialSubject/seat', 'B2']
])});                                              // false — one entry failed
```

A `Set` value is an alternation, nested inside that conjunction — any member
may match:

```js
new Map([['/credentialSubject/seat', new Set(['A1', 'B2'])]]);   // either seat
```

A pointer that resolves to an array matches if any element does:

```js
new Map([['/type', 'MovieTicketCredential']]);     // true — one of two types
```

An empty `Map` is a wildcard: any value, so long as the pointer resolves. An
empty `Set` and `''` mean the same; prefer the empty `Map`, which is what `{}`
in an example becomes.

```js
new Map([['/issuer/id', new Map()]]);              // true  — an issuer id exists
new Map([['/absent', new Map()]]);                 // false — nothing there
```

A numeric string and a number compare equal by default:

```js
new Map([['/credentialSubject/row', '12']]);       // true
matches({object: credential, map, options: {coerceNumbers: false}});  // false
```

`@context` is the exception to array handling: it stays ordered, and each
element must equal the element at the same index. The object may carry more.

A pointer that resolves to nothing never matches. Pointers read own properties
only, so `/constructor` and `/toString` resolve to nothing.

## Building a map

From a nested example that mirrors the object's shape:

```js
toJsonPointerMap({obj: {credentialSubject: {name: 'John Doe'}}});
// Map { '/credentialSubject/name' => 'John Doe' }
```

or by hand, from flat pointers:

```js
new Map([
  ['/renderSuite', 'html'],
  ['/template/mediaType', 'text/html']
]);
```

`fromJsonPointerMap({map})` rebuilds an object from a map.

```js
resolvePointer({issuer: {id: 'did:example:issuer'}}, '/issuer/id');
// 'did:example:issuer'
```

## License

See [LICENSE.md](./LICENSE.md).
