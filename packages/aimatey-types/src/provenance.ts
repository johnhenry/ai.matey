/**
 * Provenance helpers.
 *
 * `IRProvenance` is defined in `ir.ts` alongside the rest of the IR. This module holds the
 * operations that are easy to get wrong: recording that the backend which answered was a
 * proxy rather than the thing that actually ran the model, and reading back out of a
 * nested chain which model that was.
 *
 * @module
 */

import type { IRProvenance } from './ir.js';

/**
 * True when a provenance says anything at all.
 *
 * Backend adapters that report no provenance conventionally return `{}` rather than
 * `undefined` (see every shipped adapter's `execute()`), so "the far side told us nothing"
 * arrives as an empty object about as often as it arrives as `undefined`.
 */
function isEmptyProvenance(provenance: IRProvenance): boolean {
  return Object.values(provenance).every((value) => value === undefined);
}

/**
 * Attach the provenance a proxied hop reported underneath this hop's own.
 *
 * A backend adapter that fronts another aimatey instance -- a tunnel, a gateway, a
 * self-hosted relay, a test double wrapping a real `Router` -- gets back a full
 * `IRProvenance` describing what the *far* side did. Forwarding that upward unchanged is
 * the bug this function exists to prevent:
 *
 * ```typescript
 * // WRONG -- the far side's backend becomes this process's backend.
 * metadata: { ...farResponse.metadata }
 * // A phone then reports `backend: 'llama-cpp'` for a request its desktop ran, which is
 * // indistinguishable from having run llama-cpp locally. Only one of those is true.
 * ```
 *
 * The near hop's own fields must stay authoritative, because that is what every existing
 * reader means: the Bridge's circuit breaker and usage counter key off `provenance.backend`
 * to decide which adapter to stop calling, and stopping `llama-cpp` on a far-side failure
 * would blame a backend this process cannot even reach.
 *
 * ```typescript
 * // RIGHT -- this adapter names itself, and the far side nests beneath it.
 * provenance: withUpstreamProvenance(
 *   { backend: this.metadata.name },
 *   farResponse.metadata.provenance
 * )
 * ```
 *
 * An `upstream` that is `undefined`, `{}`, or carries only undefined values is dropped
 * rather than recorded: an empty link would claim a hop exists while saying nothing about
 * it, and a consumer walking the chain to find the far end would stop on a link that names
 * nothing. A far side that itself proxied arrives with its own `upstream` already nested,
 * so chains longer than two hops need no special handling here.
 *
 * @param local Provenance for this hop -- the proxying adapter's own name, at minimum.
 * @param upstream What the far side reported, as-is; nested untouched when it says anything.
 * @returns `local` with `upstream` attached, or `local` unchanged when there is nothing to
 *   attach. Any `upstream` already on `local` is replaced.
 *
 * @example
 * ```typescript
 * // Inside a proxying BackendAdapter's execute():
 * const farResponse = await this.forwardOverTunnel(request);
 *
 * return {
 *   ...farResponse,
 *   metadata: {
 *     ...farResponse.metadata,
 *     provenance: withUpstreamProvenance(
 *       { backend: this.metadata.name },
 *       farResponse.metadata.provenance
 *     ),
 *   },
 * };
 * // => { backend: 'tunnel', upstream: { frontend: 'openai', backend: 'llama-cpp' } }
 * ```
 */
export function withUpstreamProvenance(
  local: IRProvenance,
  upstream: IRProvenance | undefined
): IRProvenance {
  if (upstream === undefined || isEmptyProvenance(upstream)) {
    return local;
  }

  return { ...local, upstream };
}

/**
 * The model that actually generated a response, read out of a provenance chain.
 *
 * `IRProvenance.servedModel` is a per-hop fact, so a proxied response holds more than one
 * hop and at most one of them served. This resolves the chain to a single answer for the
 * consumers that want one -- tracing (`ai.response.model`), a frontend adapter projecting
 * the IR back onto a provider wire shape, a UI reporting what answered.
 *
 * **Nearest-first.** The walk starts at the near hop and returns the first `servedModel` it
 * finds. In the canonical proxy chain that *is* the far end, because a hop that forwarded
 * rather than served leaves its own `servedModel` unset -- so `phone -> desktop ->
 * llama-cpp` resolves to llama-cpp's model without the walk needing to know which hop was
 * the last one.
 *
 * Nearest-first rather than strictly-last-link is deliberate. A hop's `servedModel` is a
 * true claim about that hop, so the nearest one is never *wrong* -- only potentially less
 * specific. Preferring it means a chain whose far hop is a provider that does not report
 * the served model at all (Cohere, Bedrock, HuggingFace, Replicate) can still resolve to a
 * nearer hop that does -- an HTTP-proxying adapter that parsed the served model off the
 * response body, say. Last-link-only would discard that and return `undefined`, trading
 * real coverage for purity.
 *
 * Returns `undefined` when no hop reported one. That is a load-bearing outcome, not a
 * failure: a consumer must be able to tell "not reported" from "reported as X", so callers
 * must leave their attribute or field **absent** rather than substituting the requested
 * model.
 *
 * @param provenance The near hop, or `undefined`.
 * @returns The nearest reported served model, or `undefined` if no hop reported one.
 *
 * @example
 * ```typescript
 * resolveServedModel({ backend: 'openai', servedModel: 'gpt-4-0613' });
 * // => 'gpt-4-0613'
 *
 * resolveServedModel({
 *   backend: 'tunnel',                       // forwarded; served nothing
 *   upstream: { backend: 'llama-cpp', servedModel: 'qwen2.5-7b-instruct' },
 * });
 * // => 'qwen2.5-7b-instruct'
 *
 * resolveServedModel({ backend: 'cohere' });
 * // => undefined -- Cohere does not echo the served model
 * ```
 */
export function resolveServedModel(provenance: IRProvenance | undefined): string | undefined {
  for (let hop = provenance; hop !== undefined; hop = hop.upstream) {
    if (hop.servedModel !== undefined && hop.servedModel.length > 0) {
      return hop.servedModel;
    }
  }

  return undefined;
}
