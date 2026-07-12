/**
 * IndexedDB 封装层 — 记一笔 PWA
 *
 * 提供 key-value 存储，替代 localStorage 存储较大的数据（主数据缓存、草稿、年份文件缓存）。
 * 当 IndexedDB 不可用时自动降级到 localStorage。
 */
const IDB = (() => {
    const DB_NAME = 'jiyibi-db';
    const DB_VERSION = 1;
    const STORE_KV = 'kv';

    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_KV)) {
                    db.createObjectStore(STORE_KV);
                }
            };
        });
        return dbPromise;
    }

    async function get(key) {
        try {
            const db = await openDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_KV, 'readonly');
                const req = tx.objectStore(STORE_KV).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            // 降级到 localStorage
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : undefined;
        }
    }

    async function set(key, value) {
        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_KV, 'readwrite');
                tx.objectStore(STORE_KV).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            // 降级到 localStorage
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e2) { /* quota exceeded — 静默失败 */ }
        }
    }

    async function del(key) {
        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_KV, 'readwrite');
                tx.objectStore(STORE_KV).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

    async function keys(prefix) {
        try {
            const db = await openDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_KV, 'readonly');
                const req = tx.objectStore(STORE_KV).getAllKeys();
                req.onsuccess = () => {
                    const allKeys = req.result.map(k => String(k));
                    resolve(prefix ? allKeys.filter(k => k.startsWith(prefix)) : allKeys);
                };
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            // 降级到 localStorage
            const result = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (!prefix || k.startsWith(prefix))) result.push(k);
            }
            return result;
        }
    }

    return { get, set, del, keys };
})();
