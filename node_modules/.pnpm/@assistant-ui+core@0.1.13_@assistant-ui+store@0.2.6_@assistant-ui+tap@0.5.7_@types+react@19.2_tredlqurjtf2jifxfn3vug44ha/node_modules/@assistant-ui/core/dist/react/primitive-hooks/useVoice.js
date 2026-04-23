import { useCallback, useSyncExternalStore } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";
export const useVoiceState = () => {
    return useAuiState((s) => s.thread.voice);
};
const getServerVolume = () => 0;
export const useVoiceVolume = () => {
    const aui = useAui();
    const thread = aui.thread();
    return useSyncExternalStore(thread.subscribeVoiceVolume, thread.getVoiceVolume, getServerVolume);
};
export const useVoiceControls = () => {
    const aui = useAui();
    const connect = useCallback(() => {
        aui.thread().connectVoice();
    }, [aui]);
    const disconnect = useCallback(() => {
        aui.thread().disconnectVoice();
    }, [aui]);
    const mute = useCallback(() => {
        aui.thread().muteVoice();
    }, [aui]);
    const unmute = useCallback(() => {
        aui.thread().unmuteVoice();
    }, [aui]);
    return { connect, disconnect, mute, unmute };
};
//# sourceMappingURL=useVoice.js.map