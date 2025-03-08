import { DeriveOptions, EffectFunction, EventHandler, EventType, NestedKeyOf, NestedValue, Resin, ResinArray, ResinError, ResinEvent, ResinMap, ResinOptions } from "./types";

let effectStack: Array<EffectFunction> = [];
let batchDepth = 0;
let DEBUG = false;
const pendingEffects = new Set<EffectFunction>();

/**
 * Creates a reactive `Resin` instance for tracking and managing state.
 * Provides properties for value access, error tracking, and loading state.
 *
 * @example
 * const counter = resin(0);
 * counter.value = 5; // Reactive update for subscribers
 */
export function resin<T extends any[]>(array: T): Resin<T> & ResinArray<T[number]>;
export function resin<K, V>(map: Map<K, V>): Resin<Map<K, V>> & ResinMap<K, V>;
export function resin<T>(value: T, options?: ResinOptions<T>): Resin<T>;
export function resin<T>(initialValue: T, options?: ResinOptions<T>): any {
    let value = initialValue;
    if (options?.persist) {
        const persist = options.persist;
        const stored = localStorage.getItem(persist.key);
        if (stored) {
            try {
                value = persist.deserialize
                    ? persist.deserialize(stored)
                    : JSON.parse(stored);
            } catch (err) {
                console.warn(`Failed to restore value for key "${persist.key}":`, err);
            }
        }
    }

    let loading = false;
    let error: Error | null = null;
    let disposed = false;
    const subscribers = new Set<() => void>();
    const eventHandlers = new Map<EventType, Set<EventHandler<T, any>>>();

    const validateValue = (newValue: T) => {
        if (!options?.validate) return { valid: true };

        const result = options.validate(newValue);
        return typeof result === 'boolean'
            ? { valid: result }
            : result;
    };

    const notify = (oldValue: T) => {
        if (disposed) {
            return;
        }
        if (batchDepth > 0) {
            subscribers.forEach((effect) => pendingEffects.add(effect));
        } else {
            subscribers.forEach((effect) => effect());
        }

        emitEvent('change', { value, oldValue });

        const persist = options?.persist;

        if (persist) {
            try {
                const serialized = persist.serialize
                    ? persist.serialize(value)
                    : JSON.stringify(value);
                localStorage.setItem(persist.key, serialized);
            } catch (err) {
                console.warn(`Failed to persist value for key "${persist.key}":`, err);
            }
        }
    };

    const transformValue = (newValue: T) => {
        if (!options?.transform) {
            return newValue;
        }
        return options.transform.reduce((val, fn) => fn(val), newValue);
    };

    const emitEvent = <E extends EventType>(
        type: E,
        event: ResinEvent<T>[E]
    ) => {
        eventHandlers.get(type)?.forEach(handler => {
            try {
                handler(event);
            } catch (err) {
                console.error(`Error in ${type} handler:`, err);
                error = err as Error;
                emitEvent('error', { error });
            }
        });
    };

    queueMicrotask(() => {
        emitEvent('init', { value });
    })

    const resinInstance: Resin<T> = {
        get value() {
            if (disposed) {
                throw new Error('Attempted to access disposed resin');
            }

            const currentEffect = effectStack[effectStack.length - 1];
            if (currentEffect) {
                subscribers.add(currentEffect);
                if (DEBUG) {
                    console.log(`[Resin Debug] Get "${options?.debugName || ''}"`, value);
                }
            }
            return value;
        },
        set value(newValue: T) {
            if (disposed) {
                throw new Error('Attempted to modify disposed resin');
            }

            try {
                if (DEBUG) {
                    console.log(`[Resin Debug] Set "${options?.debugName || ''}"`, {
                        oldValue: value,
                        newValue,
                        stack: new Error().stack
                    });
                }
                if (value === newValue) {
                    return;
                }

                const transformed = transformValue(newValue);
                const validation = validateValue(newValue);
                if (!validation.valid) {
                    const error = new Error(validation.error || 'Validation failed');
                    emitEvent('error', { error });
                    return;
                }

                value = newValue;
                notify(transformed);
            } catch (err) {
                error = createResinError(
                    `Error in Resin${options?.debugName ? ` "${options.debugName}"` : ''}`,
                    options?.debugName,
                    err
                );
                emitEvent('error', { error });
            }
        },
        get loading() {
            return loading;
        },
        get error() {
            return error;
        },
        on<E extends EventType>(event: E, handler: EventHandler<T, E>) {
            if (!eventHandlers.has(event)) {
                eventHandlers.set(event, new Set());
            }
            eventHandlers.get(event)!.add(handler);

            return () => {
                eventHandlers.get(event)?.delete(handler);
            };
        },
        dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            emitEvent('dispose', { value });
            subscribers.clear();
            eventHandlers.clear();
        },
        _subscribers: subscribers,
    };

    if (Array.isArray(initialValue)) {
        return enhanceArray(resinInstance as Resin<T[]>);
    } else if (initialValue instanceof Map) {
        return enhanceMap(resinInstance as Resin<Map<unknown, unknown>>);
    }

    return resinInstance;
}

/**
 * Groups multiple updates together.
 * Executes updates within the batch in a single cycle.
 *
 * @example
 * batch(() => {
 *   resinInstance1.value = 1;
 *   resinInstance2.value = 2;
 * });
 */
export function batch(fn: () => void) {
    batchDepth++;
    try {
        fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            pendingEffects.forEach(effect => effect());
            pendingEffects.clear();
        }
    }
}

/**
 * Creates a computed `Resin` instance that derives its value from a function.
 * Automatically updates when dependent `Resin` instances change.
 *
 * @example
 * const count = resin(2);
 * const doubleCount = computed(() => count.value * 2);
 */
export function computed<T>(fn: () => T): Resin<T> {
    const computedResin = resin<T>(fn());

    watchEffect(() => {
        computedResin.value = fn();
    });

    return computedResin;
}

/**
 * Creates a derived `Resin` instance based on multiple source `Resin` values.
 * Automatically recomputes when any source value changes.
 *
 * @example
 * const firstName = resin('John');
 * const lastName = resin('Doe');
 * const fullName = derive({
 *   from: [firstName, lastName],
 *   compute: (first, last) => `${first} ${last}`
 * });
 */
export function derive<Sources extends Resin<any>[], Result>(
    options: DeriveOptions<Sources, Result>
): Resin<Result> {
    const { from, compute } = options;
    const derivedResin = resin<Result>(
        compute(...(from.map(dep => dep.value) as any))
    );

    const effect = () => {
        try {
            derivedResin.value = compute(...(from.map(dep => dep.value) as any));
        } catch (error) {
            console.error('Error in derived computation:', error);
        }
    };

    watchEffect(effect);

    return {
        ...derivedResin,
        dispose() {
            derivedResin.dispose();
            from.forEach(dep => dep._subscribers.delete(effect));
        }
    };
}

/**
 * Creates a reactive view of a nested property from a Resin state object.
 * Returns a derived Resin that updates when the source property changes.
 * 
 * @param {Resin<T>} state The source Resin object
 * @param {P} path Dot-notation path to the nested property (e.g., 'user.profile.name')
 * @returns {Resin<NestedValue<T, P>>} A reactive Resin containing the value at the specified path
 * 
 * @example
 * const user = resin({ profile: { name: 'John' } });
 * const name = select(user, 'profile.name');
 * console.log(name.value); // 'John'
 * 
 * // When the original object changes, the selected property updates
 * user.value.profile.name = 'Jane';
 * console.log(name.value); // 'Jane'
 */
export function select<T extends object, P extends NestedKeyOf<T>>(
    state: Resin<T>,
    path: P
): Resin<NestedValue<T, P>> {
    const cache = new WeakMap<Resin<T>, Map<string, Resin<any>>>();

    if (!cache.has(state)) {
        cache.set(state, new Map());
    }

    const pathCache = cache.get(state)!;
    if (pathCache.has(path)) {
        return pathCache.get(path)!;
    }

    const selected = computed(() => getValueByPath(state.value, path));
    pathCache.set(path, selected);

    return selected;
}
/**
 * Watches a function for changes in dependent `Resin` instances, rerunning it reactively.
 *
 * @example
 * watchEffect(() => {
 *   console.log(resinInstance.value);
 * });
 */
export function watchEffect(effect: EffectFunction) {
    effectStack.push(effect);
    effect();
    effectStack.pop();
}

/**
 * Registers an effect to run independent of binding.
 * 
 * @example
 * //
 * const count = resin<number>(0);
 * subscribe(count, (value: number) => {
 *      if (number % 2 === 0) {
 *          console.log('even');
 *      } else {
 *          console.log('odd');
 *      }
 * });
 */
export function subscribe(effect: () => void) {
    watchEffect(effect);
}

export function createResinError(message: string, resinName?: string, value?: any): ResinError {
    const error = new Error(message) as ResinError;
    error.resinName = resinName;
    error.value = value;
    return error;
}

export function enableDebug() {
    DEBUG = true;
}

function enhanceArray<T>(baseResin: Resin<T[]>): Resin<T[]> & ResinArray<T> {
    const array = baseResin.value;

    const handler: ProxyHandler<T[]> = {
        get(target: T[], prop: string | symbol) {
            const value = target[prop as keyof typeof target];
            if (typeof value === 'function') {
                return function (...args: any[]) {
                    const result = Array.prototype[prop as keyof typeof Array.prototype]
                        .apply(target, args);

                    const mutatingMethods = [
                        'push', 'pop', 'shift', 'unshift',
                        'splice', 'sort', 'reverse'
                    ];

                    if (mutatingMethods.includes(prop as string)) {
                        baseResin.value = [...target];
                    }

                    return result;
                };
            }
            return value;
        },
        set(target: T[], prop: string | symbol, value: any): boolean {
            if (typeof prop === 'number' || prop === 'length') {
                target[prop] = value;
                baseResin.value = [...target];
            }
            return true;
        }
    };

    const enhanced = new Proxy(array, handler) as T[] & ResinArray<T>;

    enhanced.rFind = (predicate: (item: T) => boolean) => {
        return computed(() => baseResin.value.find(predicate));
    };

    enhanced.rFilter = (predicate: (item: T) => boolean) => {
        return computed(() => baseResin.value.filter(predicate));
    };

    enhanced.rMap = <R>(transform: (item: T) => R) => {
        return computed(() => baseResin.value.map(transform));
    };

    enhanced.rSort = (compareFn?: (a: T, b: T) => number) => {
        return computed(() => [...baseResin.value].sort(compareFn));
    };

    enhanced.rSlice = (start?: number, end?: number) => {
        return computed(() => baseResin.value.slice(start, end));
    };

    return Object.assign(baseResin, enhanced);
}

function enhanceMap<K, V>(baseResin: Resin<Map<K, V>>): Resin<Map<K, V>> & ResinMap<K, V> {
    const map = baseResin.value;

    const handler: ProxyHandler<Map<K, V>> = {
        get(target: Map<K, V>, prop: string | symbol) {
            const value = Reflect.get(target, prop);

            if (typeof value === 'function') {
                return function (this: Map<K, V>, ...args: any[]) {
                    const method = Map.prototype[prop as keyof typeof Map.prototype] as Function;
                    const result = method.apply(this, args);

                    const mutatingMethods = new Set([
                        'set', 'delete', 'clear'
                    ]);

                    if (mutatingMethods.has(prop.toString())) {
                        baseResin.value = new Map(target);
                    }

                    return result;
                }.bind(target);
            }

            return value;
        }
    };

    const enhanced = new Proxy(map, handler) as Map<K, V> & ResinMap<K, V>;
    const methods: Partial<ResinMap<K, V>> = {
        rGet(key: K) {
            return computed(() => baseResin.value.get(key));
        },

        rEntries() {
            return computed(() => Array.from(baseResin.value.entries()));
        },

        rKeys() {
            return computed(() => Array.from(baseResin.value.keys()));
        },

        rValues() {
            return computed(() => Array.from(baseResin.value.values()));
        }
    };

    return Object.assign(baseResin, enhanced, methods);
}


function getValueByPath<T extends object, P extends string>(obj: T, path: P): any {
    if (!obj) return undefined;

    const segments = path.split('.');
    let current: any = obj;

    for (const key of segments) {
        if (Array.isArray(current) && /^\d+$/.test(key)) {
            const index = parseInt(key, 10);
            current = current[index];
        } else {
            current = current[key];
        }

        if (current === undefined || current === null) {
            return undefined;
        }
    }

    return current;
}
