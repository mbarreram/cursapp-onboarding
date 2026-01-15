/**
 * Cursapp Demo Auth (solo front-end)
 * - Guarda un "user" en localStorage
 * - Protege dashboard.html
 */
(function () {
  const STORAGE_KEY = "cursapp_user";

  function normalizeRole(input) {
    return String(input || "")
      .trim()
      .toLowerCase();
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function requireAuth() {
    const user = getUser();
    if (!user) {
      window.location.replace("login.html");
      return null;
    }
    // Normalizamos role siempre
    user.role = normalizeRole(user.role);
    return user;
  }

  // Exponemos una API mínima
  window.CursappAuth = {
    STORAGE_KEY,
    normalizeRole,
    getUser,
    setUser,
    clearUser,
    requireAuth
  };
})();
