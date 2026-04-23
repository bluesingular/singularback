import { BaseSubscribable } from "../../subscribable/subscribable.js";
const pipeTransforms = (initialState, extraParam, transforms) => {
    return transforms.reduce((state, transform) => {
        return transform?.(state, extraParam) ?? state;
    }, initialState);
};
export class OptimisticState extends BaseSubscribable {
    _pendingTransforms = [];
    /**
     * `optimistic` callbacks from transforms that have already resolved.
     * Re-applied after every `then` callback so that a wholesale state
     * replacement (e.g. list()) cannot erase earlier completed effects
     * (e.g. delete). Cleared when no pending transforms remain.
     *
     * Correctness requirement: `optimistic` callbacks must be idempotent.
     */
    _completedOptimistics = [];
    _baseValue;
    _cachedValue;
    constructor(initialState) {
        super();
        this._baseValue = initialState;
        this._cachedValue = initialState;
    }
    _updateState() {
        this._cachedValue = this._pendingTransforms.reduce((state, transform) => {
            return pipeTransforms(state, transform.task, [
                transform.loading,
                transform.optimistic,
            ]);
        }, this._baseValue);
        this._notifySubscribers();
    }
    get baseValue() {
        return this._baseValue;
    }
    get value() {
        return this._cachedValue;
    }
    update(state) {
        this._baseValue = state;
        this._updateState();
    }
    async optimisticUpdate(transform) {
        const task = transform.execute();
        const pendingTransform = { ...transform, task };
        try {
            this._pendingTransforms.push(pendingTransform);
            this._updateState();
            const result = await task;
            this._baseValue = pipeTransforms(this._baseValue, result, [
                transform.optimistic,
                transform.then,
            ]);
            // Re-apply previously completed optimistic callbacks so that a
            // then() that does wholesale replacement cannot erase their effects.
            for (const fn of this._completedOptimistics) {
                this._baseValue = fn(this._baseValue);
            }
            if (transform.optimistic) {
                this._completedOptimistics.push(transform.optimistic);
            }
            return result;
        }
        finally {
            const index = this._pendingTransforms.indexOf(pendingTransform);
            if (index > -1) {
                this._pendingTransforms.splice(index, 1);
            }
            if (this._pendingTransforms.length === 0) {
                this._completedOptimistics.length = 0;
            }
            this._updateState();
        }
    }
}
//# sourceMappingURL=optimistic-state.js.map