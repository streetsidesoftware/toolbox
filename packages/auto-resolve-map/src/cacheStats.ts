/** How often a cache was used, since it was created or its stats were reset. */
export interface CacheStats {
  /**
   * The number of lookups that found a value.
   *
   * A lookup is `get`, `getOrInsert` or `getOrInsertComputed`, not `has`.
   */
  hits: number;
  /** The number of lookups that found no value. */
  misses: number;
  /** The number of values a callback computed and the cache stored. */
  resolved: number;
  /**
   * The number of values stored without a callback, by `set` or `getOrInsert`.
   *
   * The entries a cache starts with aren't included.
   */
  sets: number;
  /** The number of calls to `delete`. */
  deletes: number;
  /** The number of calls to `clear`. */
  clears: number;
}

export interface CacheMethods {
  /**
   * Get the stats as they are now.
   *
   * Later use of the cache doesn't change the result.
   */
  stats(): Readonly<CacheStats>;
  /**
   * Set every count in the stats to 0.
   *
   * The entries stay.
   */
  resetStats(): void;
}

export class StatsTracker implements CacheStats {
  hits = 0;
  misses = 0;
  resolved = 0;
  sets = 0;
  deletes = 0;
  clears = 0;

  /** Count a lookup as a hit or a miss. */
  lookup(found: boolean): void {
    if (found) ++this.hits;
    else ++this.misses;
  }

  snapshot(): CacheStats {
    return { ...this };
  }

  reset(): void {
    Object.assign(this, new StatsTracker());
  }
}
