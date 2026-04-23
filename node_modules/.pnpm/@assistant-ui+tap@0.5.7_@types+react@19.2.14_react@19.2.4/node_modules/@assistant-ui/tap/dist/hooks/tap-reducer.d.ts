type Dispatch<A> = (action: A) => void;
export declare function tapReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, Dispatch<A>];
export declare function tapReducer<S, A, I>(reducer: (state: S, action: A) => S, initialArg: I, init: (arg: I) => S): [S, Dispatch<A>];
export declare function tapReducerWithDerivedState<S, A, R extends S>(reducer: (state: S, action: A) => S, getDerivedState: (state: S) => R, initialState: S): [R, Dispatch<A>];
export declare function tapReducerWithDerivedState<S, A, I, R extends S>(reducer: (state: S, action: A) => S, getDerivedState: (state: S) => R, initialArg: I, init: (arg: I) => S): [R, Dispatch<A>];
export {};
//# sourceMappingURL=tap-reducer.d.ts.map