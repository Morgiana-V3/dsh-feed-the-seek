import * as React from 'react';
import { request } from './api.js';
const POLL_INTERVAL = 5000;
const MAX_POLL_INTERVAL = 60000;
export function useSettings() {
    const [state, setState] = React.useState(null);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isBusy, setIsBusy] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [viewedPersonaId, setViewedPersonaId] = React.useState('');
    const [pendingSettings, setPendingSettings] = React.useState({});
    const [notice, setNotice] = React.useState(null);
    const isMountedRef = React.useRef(true);
    const viewedPersonaRef = React.useRef('');
    const fingerprintRef = React.useRef('');
    const noticeTimerRef = React.useRef(undefined);
    viewedPersonaRef.current = viewedPersonaId;
    const loadSettings = React.useCallback(async (signal) => {
        const requestedPersonaId = viewedPersonaRef.current;
        const query = requestedPersonaId ? '?persona=' + encodeURIComponent(requestedPersonaId) : '';
        const nextState = await request('state' + query, undefined, undefined, signal);
        if (isMountedRef.current &&
            !signal?.aborted &&
            requestedPersonaId === viewedPersonaRef.current) {
            // Polling returns the full snapshot every few seconds. Skipping identical
            // snapshots keeps open folds, inputs and scroll position perfectly still.
            const fingerprint = JSON.stringify(nextState);
            if (fingerprint !== fingerprintRef.current) {
                fingerprintRef.current = fingerprint;
                setState(nextState);
            }
            setErrorMessage('');
        }
        return nextState;
    }, []);
    React.useEffect(() => {
        isMountedRef.current = true;
        const controller = new AbortController();
        let timer;
        let delay = POLL_INTERVAL;
        const schedule = () => {
            clearTimeout(timer);
            if (!controller.signal.aborted && !document.hidden) {
                timer = setTimeout(poll, delay);
            }
        };
        const poll = async () => {
            try {
                await loadSettings(controller.signal);
                delay = POLL_INTERVAL;
            }
            catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                setErrorMessage(error instanceof Error ? error.message : '记忆服务连接失败');
                // Back off while the service is unavailable instead of hammering it.
                delay = Math.min(delay * 2, MAX_POLL_INTERVAL);
            }
            schedule();
        };
        // Hidden settings pages do not poll; coming back refreshes immediately.
        const onVisibilityChange = () => {
            if (document.hidden) {
                clearTimeout(timer);
            }
            else {
                delay = POLL_INTERVAL;
                void poll();
            }
        };
        void poll();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            isMountedRef.current = false;
            controller.abort();
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [loadSettings, viewedPersonaId]);
    React.useEffect(() => () => clearTimeout(noticeTimerRef.current), []);
    const notify = React.useCallback((message, tone = 'success') => {
        clearTimeout(noticeTimerRef.current);
        setNotice({ id: Date.now(), message, tone });
        noticeTimerRef.current = setTimeout(() => setNotice(null), 2600);
    }, []);
    async function refreshSettings() {
        setIsRefreshing(true);
        try {
            await loadSettings();
            notify('已刷新', 'info');
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '刷新失败');
        }
        finally {
            setIsRefreshing(false);
        }
    }
    async function submitAction(endpoint, body) {
        if (!state || isBusy) {
            return null;
        }
        setIsBusy(true);
        setErrorMessage('');
        try {
            const result = await request(endpoint, body, state.token);
            await loadSettings();
            return result;
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '操作失败');
            return null;
        }
        finally {
            setIsBusy(false);
        }
    }
    /** Switches flip immediately; the request runs in the background and reverts on failure. */
    async function updateSetting(key, value) {
        if (!state) {
            return;
        }
        setPendingSettings((pending) => ({ ...pending, [key]: value }));
        setErrorMessage('');
        try {
            await request('settings', { [key]: value }, state.token);
            await loadSettings();
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '设置保存失败，已恢复原状态');
        }
        finally {
            setPendingSettings(({ [key]: _done, ...rest }) => rest);
        }
    }
    const displayedState = state && Object.keys(pendingSettings).length > 0
        ? { ...state, settings: { ...state.settings, ...pendingSettings } }
        : state;
    return {
        state: displayedState,
        errorMessage,
        dismissError: () => setErrorMessage(''),
        isBusy,
        isRefreshing,
        pendingSettings,
        notice,
        notify,
        setViewedPersonaId,
        refreshSettings,
        submitAction,
        updateSetting,
    };
}
//# sourceMappingURL=use-settings.js.map