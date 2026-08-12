/* global IDBKeyRange, indexedDB, self */

(() => {
  const DATABASE = "BrowserSnaps";
  const VERSION = 1;
  const SESSION_STORE = "sessions";
  const CAPTURE_STORE = "captures";
  const MAX_AGE = 24 * 60 * 60 * 1000;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Storage transaction was aborted."));
    });
  }

  async function openDatabase() {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CAPTURE_STORE)) {
        const store = database.createObjectStore(CAPTURE_STORE, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    return requestResult(request);
  }

  async function saveSession(session, captures) {
    const database = await openDatabase();
    const transaction = database.transaction([SESSION_STORE, CAPTURE_STORE], "readwrite");
    transaction.objectStore(SESSION_STORE).put(session);
    for (const capture of captures) transaction.objectStore(CAPTURE_STORE).put(capture);
    await transactionDone(transaction);
    database.close();
  }

  async function getSession(id) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readonly");
    const result = await requestResult(transaction.objectStore(SESSION_STORE).get(id));
    database.close();
    return result;
  }

  async function getCapture(id) {
    const database = await openDatabase();
    const transaction = database.transaction(CAPTURE_STORE, "readonly");
    const result = await requestResult(transaction.objectStore(CAPTURE_STORE).get(id));
    database.close();
    return result;
  }

  async function deleteSession(id) {
    const database = await openDatabase();
    const transaction = database.transaction([SESSION_STORE, CAPTURE_STORE], "readwrite");
    transaction.objectStore(SESSION_STORE).delete(id);
    const index = transaction.objectStore(CAPTURE_STORE).index("sessionId");
    const request = index.openKeyCursor(IDBKeyRange.only(id));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(CAPTURE_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionDone(transaction);
    database.close();
  }

  async function cleanup() {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readonly");
    const sessions = await requestResult(transaction.objectStore(SESSION_STORE).getAll());
    database.close();
    const cutoff = Date.now() - MAX_AGE;
    for (const session of sessions.filter((item) => item.createdAt < cutoff)) await deleteSession(session.id);
  }

  self.BrowserSnapsStore = { cleanup, deleteSession, getCapture, getSession, saveSession };
})();
