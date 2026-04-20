(function () {
    'use strict';

    const BACKEND_STORAGE_KEYS = Object.freeze({
        auth: 'auralis_backend_auth_v1',
        autoSync: 'auralis_backend_auto_sync_v1',
        deviceId: 'auralis_backend_device_id_v1',
        syncMeta: 'auralis_backend_sync_meta_v1'
    });

    const backendState = {
        auth: loadJson(BACKEND_STORAGE_KEYS.auth, null),
        autoSync: localStorage.getItem(BACKEND_STORAGE_KEYS.autoSync) !== '0',
        syncMeta: loadJson(BACKEND_STORAGE_KEYS.syncMeta, {}),
        syncTimerId: 0,
        syncing: false,
        lastFingerprint: '',
        metrics: null,
        sessions: []
    };

    function loadJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem(BACKEND_STORAGE_KEYS.deviceId);
        if (!deviceId) {
            deviceId = `device_${Math.random().toString(36).slice(2, 12)}`;
            localStorage.setItem(BACKEND_STORAGE_KEYS.deviceId, deviceId);
        }
        return deviceId;
    }

    function getDeviceName() {
        const platform = navigator.userAgentData?.platform || navigator.platform || 'Browser';
        return `Auralis ${platform}`.trim();
    }

    function toast(message) {
        if (window.AuralisApp?.toast) window.AuralisApp.toast(message);
    }

    function getEl(id) {
        return document.getElementById(id);
    }

    function setBackendStatus(text, tone = 'muted') {
        const el = getEl('backend-status');
        if (!el) return;
        el.textContent = text;
        el.dataset.tone = tone;
        const colors = {
            muted: 'var(--text-secondary)',
            danger: 'var(--sys-error)',
            success: 'var(--sys-success)',
            warning: 'var(--sys-warning)'
        };
        el.style.color = colors[tone] || colors.muted;
    }

    function getAuthHeaders(includeJson = false) {
        const headers = {};
        if (backendState.auth?.token) headers.Authorization = `Bearer ${backendState.auth.token}`;
        if (includeJson) headers['Content-Type'] = 'application/json';
        return headers;
    }

    async function backendFetch(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {
                ...getAuthHeaders(options.body != null),
                ...(options.headers || {})
            }
        });

        const contentType = response.headers.get('content-type') || '';
        const body = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const error = new Error(body?.error || response.statusText || 'Request failed');
            error.status = response.status;
            error.payload = body;
            throw error;
        }

        return body;
    }

    function persistAuth(auth) {
        backendState.auth = auth;
        if (auth) saveJson(BACKEND_STORAGE_KEYS.auth, auth);
        else localStorage.removeItem(BACKEND_STORAGE_KEYS.auth);
        renderBackendAuth();
        scheduleBackendSync();
    }

    function persistSyncMeta(sync) {
        backendState.syncMeta = {
            userStateEtag: sync?.userState?.etag || backendState.syncMeta.userStateEtag || '',
            librarySnapshotEtag: sync?.librarySnapshot?.etag || backendState.syncMeta.librarySnapshotEtag || ''
        };
        saveJson(BACKEND_STORAGE_KEYS.syncMeta, backendState.syncMeta);
    }

    function exportBackendPayload() {
        const payload = window.AuralisApp?._exportBackendPayload?.();
        if (!payload) return null;
        if (payload.playbackSession) {
            payload.playbackSession.deviceId = getDeviceId();
            payload.playbackSession.deviceName = getDeviceName();
        }
        return payload;
    }

    function fingerprintPayload(payload) {
        if (!payload) return '';
        const playback = payload.playbackSession || {};
        return JSON.stringify({
            userState: payload.userState || {},
            librarySignature: [
                payload.librarySnapshot?.albums?.length || 0,
                payload.librarySnapshot?.tracks?.length || 0,
                payload.librarySnapshot?.artists?.length || 0
            ],
            playbackSession: {
                nowPlaying: playback.nowPlaying ? [playback.nowPlaying.title, playback.nowPlaying.artist, playback.nowPlaying.albumTitle] : null,
                queueLength: playback.queue?.length || 0,
                queueIndex: playback.queueIndex || 0,
                repeatMode: playback.repeatMode || 'off',
                shuffleMode: Boolean(playback.shuffleMode),
                isPlaying: Boolean(playback.isPlaying),
                positionBucket: Math.floor(Number(playback.positionMs || 0) / 5000)
            }
        });
    }

    function applyRemoteSync(sync) {
        if (!sync) return;
        persistSyncMeta(sync);
        window.AuralisApp?._applyBackendPayload?.({
            userState: sync.userState?.payload,
            librarySnapshot: sync.librarySnapshot?.payload,
            playbackSession: sync.playbackSessions?.[0]?.payload || null
        });
        backendState.sessions = Array.isArray(sync.playbackSessions) ? sync.playbackSessions : [];
        renderBackendSessions();
    }

    async function backendPullRemote(options = {}) {
        if (!backendState.auth?.token) return;
        setBackendStatus('Pulling remote state…');
        const result = await backendFetch('/api/sync/full');
        applyRemoteSync(result.sync);
        if (!options.silent) {
            setBackendStatus(`Remote state loaded at ${new Date().toLocaleTimeString()}`, 'success');
            toast('Remote library state applied');
        }
    }

    async function backendSyncNow(options = {}) {
        if (!backendState.auth?.token || backendState.syncing) return;
        const payload = exportBackendPayload();
        if (!payload) return;

        const fingerprint = fingerprintPayload(payload);
        if (!options.force && options.silent && fingerprint === backendState.lastFingerprint) {
            return;
        }

        backendState.syncing = true;
        setBackendStatus(options.silent ? 'Background sync running…' : 'Syncing backend…');
        try {
            const result = await backendFetch('/api/sync/full', {
                method: 'PUT',
                body: JSON.stringify({
                    userState: {
                        ifMatch: backendState.syncMeta.userStateEtag || '*',
                        payload: payload.userState
                    },
                    librarySnapshot: {
                        ifMatch: backendState.syncMeta.librarySnapshotEtag || '*',
                        payload: payload.librarySnapshot
                    },
                    playbackSession: {
                        payload: payload.playbackSession
                    }
                })
            });
            backendState.lastFingerprint = fingerprint;
            applyRemoteSync(result.sync);
            setBackendStatus(`Synced at ${new Date().toLocaleTimeString()}`, 'success');
            if (!options.silent) toast('Backend sync complete');
        } catch (error) {
            if (error.status === 409 && error.payload?.sync) {
                applyRemoteSync(error.payload.sync);
                backendState.lastFingerprint = fingerprintPayload(exportBackendPayload());
                setBackendStatus('Conflict detected. Remote state was applied.', 'warning');
                toast('Backend conflict resolved using remote state');
            } else {
                setBackendStatus(error.message || 'Backend sync failed', 'danger');
                if (!options.silent) toast(error.message || 'Backend sync failed');
            }
        } finally {
            backendState.syncing = false;
        }
    }

    async function backendRefreshSessions() {
        if (!backendState.auth?.token) return;
        const result = await backendFetch('/api/playback/sessions');
        backendState.sessions = Array.isArray(result.sessions) ? result.sessions : [];
        renderBackendSessions();
    }

    async function backendRefreshMetrics() {
        const [metrics, audit] = await Promise.all([
            backendFetch('/api/metrics'),
            backendState.auth?.token ? backendFetch('/api/audit?limit=8') : Promise.resolve({ entries: [] })
        ]);
        backendState.metrics = metrics;
        renderBackendMetrics(audit.entries || []);
    }

    async function backendRegister() {
        const email = String(getEl('backend-email')?.value || '').trim();
        const password = String(getEl('backend-password')?.value || '');
        const displayName = String(getEl('backend-display-name')?.value || '').trim();
        const result = await backendFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                displayName,
                deviceId: getDeviceId()
            })
        });
        persistAuth(result);
        setBackendStatus(`Signed in as ${result.user.displayName}`, 'success');
        await backendPullRemote({ silent: true });
        await backendSyncNow({ force: true, silent: true });
        await backendRefreshMetrics();
        toast('Backend account created');
    }

    async function backendLogin() {
        const email = String(getEl('backend-email')?.value || '').trim();
        const password = String(getEl('backend-password')?.value || '');
        const result = await backendFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                deviceId: getDeviceId()
            })
        });
        persistAuth(result);
        setBackendStatus(`Signed in as ${result.user.displayName}`, 'success');
        await backendPullRemote({ silent: true });
        await backendSyncNow({ force: true, silent: true });
        await backendRefreshMetrics();
        toast('Signed into backend');
    }

    async function backendLogout() {
        if (backendState.auth?.token) {
            await backendFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        }
        persistAuth(null);
        backendState.sessions = [];
        backendState.syncMeta = {};
        backendState.lastFingerprint = '';
        localStorage.removeItem(BACKEND_STORAGE_KEYS.syncMeta);
        renderBackendSessions();
        setBackendStatus('Signed out of backend');
        toast('Backend session cleared');
    }

    function renderBackendAuth() {
        const status = getEl('backend-account-status');
        const authOnly = document.querySelectorAll('[data-backend-auth]');
        const guestOnly = document.querySelectorAll('[data-backend-guest]');

        if (status) {
            status.textContent = backendState.auth?.user
                ? `${backendState.auth.user.displayName} (${backendState.auth.user.email})`
                : 'Not connected';
        }

        authOnly.forEach((el) => {
            el.style.display = backendState.auth?.token ? '' : 'none';
        });

        guestOnly.forEach((el) => {
            el.style.display = backendState.auth?.token ? 'none' : '';
        });

        const checkbox = getEl('backend-auto-sync');
        if (checkbox) checkbox.checked = backendState.autoSync;
    }

    function renderBackendSessions() {
        const list = getEl('backend-session-list');
        if (!list) return;
        if (!backendState.sessions.length) {
            list.innerHTML = '<div style="color:var(--text-tertiary); font-size:13px;">No active sessions published yet.</div>';
            return;
        }
        list.innerHTML = backendState.sessions.map((session) => {
            const nowPlaying = session.payload?.nowPlaying;
            const line = nowPlaying
                ? `${nowPlaying.title || 'Unknown Track'} · ${nowPlaying.artist || 'Unknown Artist'}`
                : 'Idle';
            return (
                `<div class="list-item" style="padding:12px 0; border-color:var(--border-default);">` +
                    `<div class="item-content">` +
                        `<h3 style="margin-bottom:4px;">${escapeHtml(session.deviceName || session.payload?.deviceName || 'Auralis Device')}</h3>` +
                        `<span>${escapeHtml(line)}</span>` +
                        `<span style="display:block; margin-top:4px; color:var(--text-tertiary); font-size:11px;">Updated ${escapeHtml(new Date(session.updatedAt || Date.now()).toLocaleTimeString())}</span>` +
                    `</div>` +
                `</div>`
            );
        }).join('');
    }

    function renderBackendMetrics(auditEntries = []) {
        const summary = getEl('backend-metrics-summary');
        const audit = getEl('backend-audit-log');
        if (summary) {
            if (!backendState.metrics) {
                summary.innerHTML = '<span style="color:var(--text-tertiary);">Metrics unavailable.</span>';
            } else {
                const counts = backendState.metrics.counts || {};
                summary.innerHTML =
                    `<div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">` +
                        `<div class="card" style="padding:12px;"><strong>${counts.users || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Users</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.librarySnapshots || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Libraries</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.playbackSessions || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Sessions</div></div>` +
                        `<div class="card" style="padding:12px;"><strong>${counts.auditLogs || 0}</strong><div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Audit Logs</div></div>` +
                    `</div>`;
            }
        }
        if (audit) {
            if (!auditEntries.length) {
                audit.innerHTML = '<div style="color:var(--text-tertiary); font-size:13px;">No audit events yet.</div>';
            } else {
                audit.innerHTML = auditEntries.map((entry) => (
                    `<div style="padding:8px 0; border-bottom:1px solid var(--border-default);">` +
                        `<div style="font-size:12px; font-weight:700; color:var(--text-primary);">${escapeHtml(entry.kind)}</div>` +
                        `<div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">${escapeHtml(new Date(entry.createdAt).toLocaleString())}</div>` +
                    `</div>`
                )).join('');
            }
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function scheduleBackendSync() {
        if (backendState.syncTimerId) {
            clearInterval(backendState.syncTimerId);
            backendState.syncTimerId = 0;
        }
        if (!backendState.auth?.token || !backendState.autoSync) return;
        backendState.syncTimerId = window.setInterval(() => {
            void backendSyncNow({ silent: true });
        }, 15000);
    }

    function bindBackendUi() {
        const autoSync = getEl('backend-auto-sync');
        if (autoSync) {
            autoSync.addEventListener('change', () => {
                backendState.autoSync = Boolean(autoSync.checked);
                localStorage.setItem(BACKEND_STORAGE_KEYS.autoSync, backendState.autoSync ? '1' : '0');
                scheduleBackendSync();
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && backendState.auth?.token) {
                void backendPullRemote({ silent: true }).catch(() => {});
                void backendRefreshSessions().catch(() => {});
            }
        });

        window.addEventListener('beforeunload', () => {
            if (backendState.auth?.token) {
                void backendSyncNow({ silent: true, force: true });
            }
        });
    }

    async function initBackendIntegration() {
        renderBackendAuth();
        renderBackendSessions();
        bindBackendUi();

        if (window.location.protocol === 'file:') {
            setBackendStatus('Backend unavailable (file:// origin)', 'muted');
            return;
        }

        if (backendState.auth?.token) {
            try {
                const session = await backendFetch('/api/auth/session');
                backendState.auth.user = session.user;
                persistAuth(backendState.auth);
                await backendPullRemote({ silent: true });
                await backendRefreshSessions();
                await backendRefreshMetrics();
                scheduleBackendSync();
                setBackendStatus(`Connected as ${session.user.displayName}`, 'success');
            } catch (_) {
                persistAuth(null);
                setBackendStatus('Saved backend session expired', 'warning');
            }
        } else {
            setBackendStatus('Backend ready. Sign in to sync.', 'muted');
            await backendRefreshMetrics().catch(() => {});
        }
    }

    window.backendRegister = () => void backendRegister().catch((error) => {
        setBackendStatus(error.message || 'Registration failed', 'danger');
        toast(error.message || 'Registration failed');
    });
    window.backendLogin = () => void backendLogin().catch((error) => {
        setBackendStatus(error.message || 'Login failed', 'danger');
        toast(error.message || 'Login failed');
    });
    window.backendLogout = () => void backendLogout().catch((error) => {
        setBackendStatus(error.message || 'Logout failed', 'danger');
    });
    window.backendSyncNow = () => void backendSyncNow({ force: true }).catch((error) => {
        setBackendStatus(error.message || 'Sync failed', 'danger');
    });
    window.backendPullRemote = () => void backendPullRemote().catch((error) => {
        setBackendStatus(error.message || 'Remote pull failed', 'danger');
    });
    window.backendRefreshMetrics = () => void backendRefreshMetrics().catch((error) => {
        setBackendStatus(error.message || 'Metrics unavailable', 'warning');
    });
    window.backendRefreshSessions = () => void backendRefreshSessions().catch((error) => {
        setBackendStatus(error.message || 'Session refresh failed', 'warning');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            void initBackendIntegration();
        }, { once: true });
    } else {
        void initBackendIntegration();
    }
})();
