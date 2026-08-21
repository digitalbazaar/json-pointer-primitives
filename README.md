# @digitalbazaar/json-pointer-primitives

Building blocks for matching objects against JSON pointers: convert a nested
object into a map of pointers to values, resolve a pointer, and test whether an
object satisfies such a map.

```js
import {matches, toJsonPointerMap} from '@digitalbazaar/json-pointer-primitives';

matches({
  object: credential,
  map: new Map([
    ['/type', 'MovieTicketCredential'],
    ['/issuer/id', 'did:example:issuer']
  ])
});
```

## Semantics

| in the map | means |
|---|---|
| every entry | all must match — conjunction |
| a `Set` value | any member may match — alternation nested inside conjunction |
| `''`, empty `Map`, empty `Set` | wildcard: any value, but the pointer must resolve |
| a pointer resolving to an array | matches if any element matches |
| a numeric string vs a number | equal by default; `{coerceNumbers: false}` to disable |

A pointer that resolves to nothing never matches.

## Building a map

From a nested example that mirrors the object's shape:

```js
toJsonPointerMap({obj: {credentialSubject: {name: 'John Doe'}}});
// Map { '/credentialSubject/name' => 'John Doe' }
```

or by hand, from flat pointers:

```js
new Map(Object.entries({'/renderSuite': 'html', '/template/mediaType': 'text/html'}));
```

`fromJsonPointerMap({map})` is the inverse.

## Why this is its own package

It does not know what it is matching, and that is the point. It was extracted
from [`vc-query`](https://github.com/digitalbazaar/vc-query), where the same
function was called `credentialMatches` — but the matcher never looked at a
credential, only at an object and a map.

Two libraries need it, at two stages of the same flow. A wallet matches its
credentials against a verifier's request to decide *which credentials* to
present, then matches each credential's render methods against what it can
display to decide *how to show them*. QueryByExample, DCQL and Presentation
Exchange all normalise into the same pointer map, so the first stage already
had this logic; the second stage would otherwise have written it again.

Two copies in one pipeline is the failure worth avoiding. A divergence in how a
wildcard behaves, or whether numbers coerce, would mean a credential selected
under one set of rules and its rendering selected under another, with nothing
to make the difference visible.

One runtime dependency, `json-pointer`.

## License

See [LICENSE.md](./LICENSE.md).
