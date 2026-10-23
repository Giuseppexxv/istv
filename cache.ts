export class BoundedCache<K, V extends { expires: number }> extends Map<K, V> {
  constructor(private limit = 250) { super(); }
  override get(key: K): V | undefined {
    const value = super.get(key);
    if (value && value.expires <= Date.now()) { this.delete(key); return undefined; }
    return value;
  }
  override set(key: K, value: V): this {
    const now = Date.now();
    for (const [entry, cached] of this) if (cached.expires <= now) this.delete(entry);
    this.delete(key);
    while (this.size >= this.limit) this.delete(this.keys().next().value!);
    return super.set(key, value);
  }
}
