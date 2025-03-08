type NonObject = string | number | boolean | null | undefined | symbol | bigint | Function;

/**
 * Utility type for obtaining nested keys of an object.
 * Useful for selecting nested properties in reactive bindings.
 *
 * @example
 * type Key = NestedKeyOf<{ user: { name: string } }>; // "user" | "user.name"
 */
export type NestedKeyOf<ObjectType extends object> = {
    [Key in keyof ObjectType & (string | number)]:
    ObjectType[Key] extends NonObject
    ? `${Key}`
    : ObjectType[Key] extends Array<any>
    ? `${Key}` | `${Key}.${number}` | `${Key}.${number}.${NestedKeyOf<ObjectType[Key][number]>}`
    : ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : never;
}[keyof ObjectType & (string | number)];

/**
 * Utility type for resolving the type of a nested property path.
 *
 * @template ObjectType The object type being queried.
 * @template Path The string path of the property.
 *
 * @example
 * type Value = NestedValue<{ user: { name: string } }, 'user.name'>; // string
 */
export type NestedValue<
    ObjectType extends object,
    Path extends string
> = Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof ObjectType
    ? NestedValue<
        ObjectType[Key] extends object ? ObjectType[Key] : never,
        Rest
    >
    : never
    : Path extends keyof ObjectType
    ? ObjectType[Path]
    : never;

/**
* Represents a function that runs reactively when dependencies change.
*
* @example
* const effect: EffectFunction = () => console.log('Effect triggered');
*/
export type EffectFunction = () => void;

/**
 * Represents a reactive state container.
 *
 * @template T The type of value the Resin holds.
 *
 * @example
 * const resinInstance = resin('Hello');
 * console.log(resinInstance.value); // 'Hello'
 */
export interface Resin<T> {
    value: T;
    loading: boolean;
    error: Error | null;
    dispose: () => void;
    _subscribers: Set<() => void>;
    on<E extends EventType>(event: E, handler: EventHandler<T, E>): () => void;
}

/**
 * Extends Error to provide additional debugging information for `Resin` errors.
 *
 * @example
 * const error = createResinError('An error occurred', 'resinInstance', value);
 */
export interface ResinError extends Error {
    resinName?: string;
    value?: any;
}

/**
 * Options for creating a derived `Resin` instance from multiple source `Resin` instances.
 *
 * @template Sources The source `Resin` types.
 * @template Result The type of the derived result.
 *
 * @example
 * const options: DeriveOptions<[Resin<number>, Resin<number>], number> = {
 *   from: [source1, source2],
 *   compute: (a, b) => a + b
 * };
 */
export interface DeriveOptions<Sources extends Resin<any>[], Result> {
    from: [...Sources];
    compute: (...args: { [K in keyof Sources]: Sources[K] extends Resin<infer U> ? U extends Promise<any> ? never : U : never }) => Result;
}

/**
 * Extends array operations for reactive arrays.
 * Provides reactive versions of common array methods, such as `filter`, `map`, and `sort`.
 *
 * @example
 * const items = bindArray([{ id: 1 }, { id: 2 }]);
 * const reactiveItem = items.findReactive(item => item.id === 1);
 */
export interface ArrayMethods<T> {
    filter(predicate: (item: T) => boolean): T[];
    map<R>(transform: (item: T) => R): R[];
    findReactive(predicate: (item: T) => boolean): Resin<T | undefined>;
    update(updates: (array: T[]) => void): void;
    sort(compareFn?: (a: T, b: T) => number): T[];
    _resin: Resin<T[]>;
}

export type ResinOptions<T> = {
    debugName?: string;
    persist?: {
        key: string;
        serialize?: (value: T) => string;
        deserialize?: (value: string) => T;
    };
    validate?: (value: T) => boolean | { valid: boolean; error?: string };
    transform?: Array<(value: T) => T>;
    compare: 'deep' | 'shallow';
};

export type BindOptions<T> = {
    bindInnerText?: boolean;
    if?: (value: T) => boolean;
    map?: (value: T) => any;
    class?: {
        [className: string]: (value: T) => boolean;
    };
    attr?: {
        [attrName: string]: (value: T) => string | boolean | number;
    };
};

export type ResinEvent<T> = {
    'init': { value: T };
    'change': { value: T; oldValue: T };
    'dispose': { value: T };
    'error': { error: Error };
};

export interface ResinArray<T> extends Array<T> {
    rFind: (predicate: (item: T) => boolean) => Resin<T | undefined>;
    rFilter: (predicate: (item: T) => boolean) => Resin<T[]>;
    rMap: <R>(transform: (item: T) => R) => Resin<R[]>;
    rSort: (compareFn?: (a: T, b: T) => number) => Resin<T[]>;
    rSlice: (start?: number, end?: number) => Resin<T[]>;
}

export interface ResinMap<K, V> extends Map<K, V> {
    rGet: (key: K) => Resin<V | undefined>;
    rEntries: () => Resin<[K, V][]>;
    rKeys: () => Resin<K[]>;
    rValues: () => Resin<V[]>;
}

export type EventType = keyof ResinEvent<any>;
export type EventHandler<T, E extends EventType> = (event: ResinEvent<T>[E]) => void;