// =============================================================================
// Sentinel
// =============================================================================
export const SKIP_UPDATE = Symbol("skip-update");
// =============================================================================
// Utilities
// =============================================================================
function shallowEqual(objA, objB) {
    if (objA === undefined && objB === undefined)
        return true;
    if (objA === undefined)
        return false;
    if (objB === undefined)
        return false;
    for (const key of Object.keys(objA)) {
        const valueA = objA[key];
        const valueB = objB[key];
        if (!Object.is(valueA, valueB))
            return false;
    }
    return true;
}
// =============================================================================
// Base Subscribable (simple pub-sub)
// =============================================================================
export class BaseSubscribable {
    _subscribers = new Set();
    subscribe(callback) {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }
    waitForUpdate() {
        return new Promise((resolve) => {
            const unsubscribe = this.subscribe(() => {
                unsubscribe();
                resolve();
            });
        });
    }
    _notifySubscribers() {
        const errors = [];
        for (const callback of this._subscribers) {
            try {
                callback();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            if (errors.length === 1) {
                throw errors[0];
            }
            else {
                for (const error of errors) {
                    console.error(error);
                }
                throw new AggregateError(errors);
            }
        }
    }
}
// =============================================================================
// Base Subject (lazy connect/disconnect)
// =============================================================================
export class BaseSubject {
    _subscriptions = new Set();
    _connection;
    get isConnected() {
        return !!this._connection;
    }
    notifySubscribers() {
        for (const callback of this._subscriptions)
            callback();
    }
    _updateConnection() {
        if (this._subscriptions.size > 0) {
            if (this._connection)
                return;
            this._connection = this._connect();
        }
        else {
            this._connection?.();
            this._connection = undefined;
        }
    }
    subscribe(callback) {
        this._subscriptions.add(callback);
        this._updateConnection();
        return () => {
            this._subscriptions.delete(callback);
            this._updateConnection();
        };
    }
}
// =============================================================================
// Subject Implementations
// =============================================================================
export class ShallowMemoizeSubject extends BaseSubject {
    binding;
    get path() {
        return this.binding.path;
    }
    constructor(binding) {
        super();
        this.binding = binding;
        const state = binding.getState();
        if (state === SKIP_UPDATE)
            throw new Error("Entry not available in the store");
        this._previousState = state;
    }
    _previousState;
    getState = () => {
        if (!this.isConnected)
            this._syncState();
        return this._previousState;
    };
    _syncState() {
        const state = this.binding.getState();
        if (state === SKIP_UPDATE)
            return false;
        if (shallowEqual(state, this._previousState))
            return false;
        this._previousState = state;
        return true;
    }
    _connect() {
        const callback = () => {
            if (this._syncState()) {
                this.notifySubscribers();
            }
        };
        return this.binding.subscribe(callback);
    }
}
export class LazyMemoizeSubject extends BaseSubject {
    binding;
    get path() {
        return this.binding.path;
    }
    constructor(binding) {
        super();
        this.binding = binding;
    }
    _previousStateDirty = true;
    _previousState;
    getState = () => {
        if (!this.isConnected || this._previousStateDirty) {
            const newState = this.binding.getState();
            if (newState !== SKIP_UPDATE) {
                this._previousState = newState;
            }
            this._previousStateDirty = false;
        }
        if (this._previousState === undefined)
            throw new Error("Entry not available in the store");
        return this._previousState;
    };
    _connect() {
        const callback = () => {
            this._previousStateDirty = true;
            this.notifySubscribers();
        };
        return this.binding.subscribe(callback);
    }
}
export class NestedSubscriptionSubject extends BaseSubject {
    binding;
    get path() {
        return this.binding.path;
    }
    constructor(binding) {
        super();
        this.binding = binding;
    }
    getState() {
        return this.binding.getState();
    }
    outerSubscribe(callback) {
        return this.binding.subscribe(callback);
    }
    _connect() {
        const callback = () => {
            this.notifySubscribers();
        };
        let lastState = this.binding.getState();
        let innerUnsubscribe = lastState?.subscribe(callback);
        const onRuntimeUpdate = () => {
            const newState = this.binding.getState();
            if (newState === lastState)
                return;
            lastState = newState;
            innerUnsubscribe?.();
            innerUnsubscribe = newState?.subscribe(callback);
            callback();
        };
        const outerUnsubscribe = this.outerSubscribe(onRuntimeUpdate);
        return () => {
            outerUnsubscribe?.();
            innerUnsubscribe?.();
        };
    }
}
export class EventSubscriptionSubject extends BaseSubject {
    config;
    constructor(config) {
        super();
        this.config = config;
    }
    getState() {
        return this.config.binding.getState();
    }
    outerSubscribe(callback) {
        return this.config.binding.subscribe(callback);
    }
    _connect() {
        const callback = () => {
            this.notifySubscribers();
        };
        let lastState = this.config.binding.getState();
        let innerUnsubscribe = lastState?.unstable_on(this.config.event, callback);
        const onRuntimeUpdate = () => {
            const newState = this.config.binding.getState();
            if (newState === lastState)
                return;
            lastState = newState;
            innerUnsubscribe?.();
            innerUnsubscribe = newState?.unstable_on(this.config.event, callback);
        };
        const outerUnsubscribe = this.outerSubscribe(onRuntimeUpdate);
        return () => {
            outerUnsubscribe?.();
            innerUnsubscribe?.();
        };
    }
}
//# sourceMappingURL=subscribable.js.map