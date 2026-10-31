import * as React from 'react';
import { request } from './api.js';
const POLL_INTERVAL = 5000;
const MAX_POLL_INTERVAL = 60000;
export function useSettings() {
    const [state, setState] = React.useState(null);
    // Polling only ever clears its own connection error; an action's error stays until dismissed
    // or until the next action, so a failed save is never wiped by the next 5-second refresh.
    const [connectionError, setConnectionError] = React.useState('');
    const [actionError, setActionError] = React.useState('');
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
    const stateKeyRef = React.useRef('');
    /** force: skip the `since` key, for an explicit refresh. */
    const loadSettings = React.useCallback(async (signal, force = false) => {
        const requestedPersonaId = viewedPersonaRef.current;
        const params = [];
        if (requestedPersonaId) {
            params.push('persona=' + encodeURIComponent(requestedPersonaId));
        }
        if (!force && stateKeyRef.current) {
            params.push('since=' + encodeURIComponent(stateKeyRef.current));
        }
        const query = params.length ? '?' + params.join('&') : '';
        const response = await request('state' + query, undefined, undefined, signal);
        if (!isMountedRef.current ||
            signal?.aborted ||
            requestedPersonaId !== viewedPersonaRef.current) {
            return;
        }
        setConnectionError('');
        if ('unchanged' in response) {
            return;
        }
        stateKeyRef.current = response.stateKey;
        // Skipping identical snapshots keeps open folds, inputs and scroll position perfectly still.
        const fingerprint = JSON.stringify(response);
        if (fingerprint !== fingerprintRef.current) {
            fingerprintRef.current = fingerprint;
            setState(response);
        }
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
                setConnectionError(error instanceof Error ? error.message : '记忆服务连接失败');
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
            await loadSettings(undefined, true);
            notify('已刷新', 'info');
        }
        catch (error) {
            setConnectionError(error instanceof Error ? error.message : '刷新失败');
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
        setActionError('');
        try {
            const result = await request(endpoint, body, state.token);
            await loadSettings();
            return result;
        }
        catch (error) {
            setActionError(error instanceof Error ? error.message : '操作失败');
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
        setActionError('');
        try {
            await request('settings', { [key]: value }, state.token);
            await loadSettings();
        }
        catch (error) {
            setActionError(error instanceof Error ? error.message : '设置保存失败，已恢复原状态');
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
        errorMessage: actionError || connectionError,
        dismissError: () => {
            setActionError('');
            setConnectionError('');
        },
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