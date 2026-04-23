export function createThreadMappingId(id) {
    return id;
}
export const getThreadData = (state, threadIdOrRemoteId) => {
    const idx = state.threadIdMap[threadIdOrRemoteId];
    if (idx === undefined)
        return undefined;
    return state.threadData[idx];
};
export const updateStatusReducer = (state, threadIdOrRemoteId, newStatus) => {
    const data = getThreadData(state, threadIdOrRemoteId);
    if (!data)
        return state;
    const { id, remoteId, status: lastStatus } = data;
    if (lastStatus === newStatus)
        return state;
    const newState = { ...state };
    // lastStatus
    switch (lastStatus) {
        case "new":
            newState.newThreadId = undefined;
            break;
        case "regular":
            newState.threadIds = newState.threadIds.filter((t) => t !== id);
            break;
        case "archived":
            newState.archivedThreadIds = newState.archivedThreadIds.filter((t) => t !== id);
            break;
        default: {
            const _exhaustiveCheck = lastStatus;
            throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
        }
    }
    // newStatus
    switch (newStatus) {
        case "regular":
            newState.threadIds = [id, ...newState.threadIds];
            break;
        case "archived":
            newState.archivedThreadIds = [id, ...newState.archivedThreadIds];
            break;
        case "deleted":
            newState.threadData = Object.fromEntries(Object.entries(newState.threadData).filter(([key]) => key !== id));
            newState.threadIdMap = Object.fromEntries(Object.entries(newState.threadIdMap).filter(([key]) => key !== id && key !== remoteId));
            break;
        default: {
            const _exhaustiveCheck = newStatus;
            throw new Error(`Unsupported state: ${_exhaustiveCheck}`);
        }
    }
    if (newStatus !== "deleted") {
        newState.threadData = {
            ...newState.threadData,
            [id]: {
                ...data,
                status: newStatus,
            },
        };
    }
    return newState;
};
//# sourceMappingURL=remote-thread-state.js.map