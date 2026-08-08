(function () {
  "use strict";

  var SAVE_DELAY_MS = 700;
  var firebase = window.firebase;
  var auth = null;
  var db = null;
  var currentUser = null;
  var isConfigured = false;
  var saveTimer = null;
  var pendingData = null;
  var pendingSaveCallbacks = [];

  function emit(name, detail) {
    if (typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function emitSyncState(state, message) {
    emit("levelup:sync-state", {
      state: state,
      message: message || "",
    });
  }

  function publicUser(user) {
    if (!user) return null;

    return {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
    };
  }

  function emitAuthChange() {
    emit("levelup:auth-change", {
      user: publicUser(currentUser),
      configured: isConfigured,
    });
  }

  function hasFirebaseConfig(config) {
    if (!config || typeof config !== "object") return false;

    return ["apiKey", "authDomain", "projectId", "appId"].every(function (key) {
      return typeof config[key] === "string" && config[key].trim() !== "";
    });
  }

  function withoutPhotos(data) {
    if (!data || Object.prototype.toString.call(data) !== "[object Object]") {
      throw new TypeError("Cloud data must be an object");
    }

    var result = {};
    Object.keys(data).forEach(function (key) {
      if (key !== "photos") result[key] = data[key];
    });
    return result;
  }

  function userDocument(uid) {
    return db.collection("users").doc(uid);
  }

  function settleSave(callbacks, error, value) {
    callbacks.forEach(function (callback) {
      if (error) callback.reject(error);
      else callback.resolve(value);
    });
  }

  function flushPendingSave() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (!pendingData) return Promise.resolve(false);

    var data = pendingData;
    var callbacks = pendingSaveCallbacks;
    var user = getUser();
    pendingData = null;
    pendingSaveCallbacks = [];

    if (!isConfigured || !db || !user) {
      var unavailableError = new Error("Sign in before saving cloud data");
      emitSyncState("error", unavailableError.message);
      settleSave(callbacks, unavailableError);
      return Promise.resolve(false);
    }

    emitSyncState("saving", "Saving data to Firebase");

    return userDocument(user.uid)
      .set(data, { merge: true })
      .then(function () {
        emitSyncState("saved", "Cloud data is up to date");
        settleSave(callbacks, null, true);
        return true;
      })
      .catch(function (error) {
        emitSyncState("error", error.message || "Unable to save cloud data");
        settleSave(callbacks, error);
        return false;
      });
  }

  function save(data) {
    if (!isConfigured || !db) {
      emitSyncState("unavailable", "Firebase is not configured");
      return Promise.resolve(false);
    }

    if (!getUser()) {
      emitSyncState("signed-out", "Sign in before saving cloud data");
      return Promise.resolve(false);
    }

    try {
      pendingData = withoutPhotos(data);
    } catch (error) {
      emitSyncState("error", error.message);
      return Promise.reject(error);
    }

    if (saveTimer !== null) window.clearTimeout(saveTimer);
    emitSyncState("queued", "Cloud save queued");

    return new Promise(function (resolve, reject) {
      pendingSaveCallbacks.push({ resolve: resolve, reject: reject });
      saveTimer = window.setTimeout(flushPendingSave, SAVE_DELAY_MS);
    });
  }

  function load() {
    var user = getUser();

    if (!isConfigured || !db) {
      emitSyncState("unavailable", "Firebase is not configured");
      return Promise.resolve(null);
    }

    if (!user) {
      emitSyncState("signed-out", "Sign in to load cloud data");
      return Promise.resolve(null);
    }

    var requestedUid = user.uid;
    emitSyncState("loading", "Loading data from Firebase");

    return userDocument(requestedUid)
      .get()
      .then(function (snapshot) {
        if (!getUser() || getUser().uid !== requestedUid) return null;

        var data = snapshot.exists ? snapshot.data() : null;
        emit("levelup:remote-data", { data: data });
        emitSyncState("loaded", snapshot.exists ? "Cloud data loaded" : "No cloud data found");
        return data;
      })
      .catch(function (error) {
        emitSyncState("error", error.message || "Unable to load cloud data");
        return null;
      });
  }

  function getUser() {
    return currentUser || (auth && auth.currentUser) || null;
  }

  function signInGoogle() {
    if (!isConfigured || !auth) {
      emitSyncState("unavailable", "Firebase is not configured");
      return Promise.resolve(null);
    }

    emitSyncState("signing-in", "Opening Google sign-in");
    var provider = new firebase.auth.GoogleAuthProvider();

    return auth
      .signInWithPopup(provider)
      .then(function (result) {
        return result.user || null;
      })
      .catch(function (error) {
        emitSyncState("error", error.message || "Google sign-in failed");
        return null;
      });
  }

  function signOut() {
    if (!isConfigured || !auth) {
      emitSyncState("unavailable", "Firebase is not configured");
      return Promise.resolve(false);
    }

    return flushPendingSave()
      .then(function () {
        return auth.signOut();
      })
      .then(function () {
        return true;
      })
      .catch(function (error) {
        emitSyncState("error", error.message || "Sign-out failed");
        return false;
      });
  }

  var api = {
    configured: false,
    signInGoogle: signInGoogle,
    signOut: signOut,
    save: save,
    getUser: getUser,
    load: load,
  };

  window.LevelUpCloud = api;

  function markUnavailable(message) {
    isConfigured = false;
    api.configured = false;
    window.setTimeout(function () {
      emitAuthChange();
      emitSyncState("unavailable", message);
    }, 0);
  }

  var config = window.LEVELUP_FIREBASE_CONFIG;
  if (!firebase || typeof firebase.initializeApp !== "function") {
    markUnavailable("Firebase CDN scripts were not loaded");
    return;
  }

  if (!hasFirebaseConfig(config)) {
    markUnavailable("Firebase config is incomplete");
    return;
  }

  if (typeof firebase.auth !== "function" || typeof firebase.firestore !== "function") {
    markUnavailable("Firebase Auth or Firestore compat script was not loaded");
    return;
  }

  try {
    if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    isConfigured = true;
    api.configured = true;

    auth.onAuthStateChanged(
      function (user) {
        currentUser = user || null;
        emitAuthChange();

        if (currentUser) load();
        else emitSyncState("signed-out", "Not signed in");
      },
      function (error) {
        emitSyncState("error", error.message || "Unable to read authentication state");
      }
    );
  } catch (error) {
    auth = null;
    db = null;
    markUnavailable(error.message || "Firebase initialization failed");
  }
})();
