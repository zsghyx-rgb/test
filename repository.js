/**
 * Repository 层 — 记一笔 PWA
 *
 * 封装数据访问，统一通过 IndexedDB 缓存主数据、草稿、年份文件。
 * 业务逻辑通过 Repository 读写本地缓存，不再直接操作 localStorage 的大数据。
 */
const Repository = (() => {
    // ── 存储键 ──
    const KEY_MAIN_CACHE     = 'main_data_cache';     // data.enc 原文缓存（离线优先秒开）
    const KEY_MAIN_VERSION   = 'main_data_version';   // Drive 上 data.enc 的版本号
    const KEY_DRAFT_PREFIX   = 'draft_';              // draft_<user>
    const KEY_DRAFT_TIME     = 'draft_time_';         // draft_time_<user>
    const KEY_YEAR_PREFIX    = 'year_';               // year_<YYYY> 年份文件缓存

    // ── 主数据缓存 ──
    async function getMainCache() {
        return await IDB.get(KEY_MAIN_CACHE);
    }

    async function setMainCache(content) {
        await IDB.set(KEY_MAIN_CACHE, content);
    }

    async function clearMainCache() {
        await IDB.del(KEY_MAIN_CACHE);
    }

    // ── 版本号 ──
    async function getMainVersion() {
        const v = await IDB.get(KEY_MAIN_VERSION);
        return v || '0';
    }

    async function setMainVersion(version) {
        await IDB.set(KEY_MAIN_VERSION, version);
    }

    async function clearMainVersion() {
        await IDB.del(KEY_MAIN_VERSION);
    }

    // ── 草稿管理 ──
    async function saveDraft(user, data) {
        await IDB.set(KEY_DRAFT_PREFIX + user, data);
        await IDB.set(KEY_DRAFT_TIME + user, Date.now());
    }

    async function getDraft(user) {
        return await IDB.get(KEY_DRAFT_PREFIX + user);
    }

    async function getDraftTime(user) {
        return await IDB.get(KEY_DRAFT_TIME + user);
    }

    async function clearAllDrafts() {
        const draftKeys = await IDB.keys(KEY_DRAFT_PREFIX);
        const timeKeys  = await IDB.keys(KEY_DRAFT_TIME);
        for (const k of draftKeys) await IDB.del(k);
        for (const k of timeKeys)  await IDB.del(k);
    }

    async function hasAnyDraft() {
        const ks = await IDB.keys(KEY_DRAFT_PREFIX);
        return ks.length > 0;
    }

    async function getAllDraftUsers() {
        const ks = await IDB.keys(KEY_DRAFT_PREFIX);
        return ks.map(k => k.replace(KEY_DRAFT_PREFIX, ''));
    }

    // ── 年份文件缓存 ──
    async function getYearCache(year) {
        return await IDB.get(KEY_YEAR_PREFIX + year);
    }

    async function setYearCache(year, data) {
        await IDB.set(KEY_YEAR_PREFIX + year, data);
    }

    async function clearYearCache(year) {
        await IDB.del(KEY_YEAR_PREFIX + year);
    }

    // ── 从 localStorage 迁移旧数据（一次性） ──
    async function migrateFromLocalStorage() {
        let migrated = false;

        // 主数据缓存
        const oldCache = localStorage.getItem('APP_raw_cache');
        if (oldCache) {
            const existing = await IDB.get(KEY_MAIN_CACHE);
            if (!existing) {
                await IDB.set(KEY_MAIN_CACHE, oldCache);
                migrated = true;
            }
        }

        // 版本号
        const oldVersion = localStorage.getItem('APP_drive_version');
        if (oldVersion) {
            const existing = await IDB.get(KEY_MAIN_VERSION);
            if (!existing) {
                await IDB.set(KEY_MAIN_VERSION, oldVersion);
                migrated = true;
            }
        }

        // 草稿
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('APP_local_draft_') && !k.includes('_time_')) {
                const user = k.replace('APP_local_draft_', '');
                const data = localStorage.getItem(k);
                const time = localStorage.getItem('APP_local_draft_time_' + user);
                if (data) {
                    try {
                        const existing = await IDB.get(KEY_DRAFT_PREFIX + user);
                        if (!existing) {
                            await IDB.set(KEY_DRAFT_PREFIX + user, JSON.parse(data));
                            if (time) await IDB.set(KEY_DRAFT_TIME + user, parseInt(time));
                            migrated = true;
                        }
                    } catch (e) { /* 草稿损坏，跳过 */ }
                }
            }
        }

        return migrated;
    }

    return {
        getMainCache, setMainCache, clearMainCache,
        getMainVersion, setMainVersion, clearMainVersion,
        saveDraft, getDraft, getDraftTime, clearAllDrafts, hasAnyDraft, getAllDraftUsers,
        getYearCache, setYearCache, clearYearCache,
        migrateFromLocalStorage
    };
})();
