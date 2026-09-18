/**
 * Unified Platform Auth SDK for Prevention V3 PWA apps.
 * Handles Supabase session, token exchange via auth.prevention.school,
 * local token storage, and automatic background refresh.
 */
class PlatformAuth {
  /**
   * @param {object} config
   * @param {string} config.authBaseUrl - e.g. "https://auth.prevention.school"
   * @param {string} config.appId - e.g. "parent_navigator", "ida_companion"
   * @param {object} config.supabaseClient - instantiated Supabase client
   */
  constructor({ authBaseUrl, appId, supabaseClient }) {
    this.authBaseUrl = (authBaseUrl || "https://auth.prevention.school").replace(/\/$/, "");
    this.appId = appId;
    this.supabase = supabaseClient;
    this.refreshTimer = null;
    this._onUserChange = [];
  }

  /**
   * Initialize local tokens and start background refresh if authenticated.
   */
  async init() {
    const token = this.getAccessToken();
    if (token) {
      this._scheduleRefresh();
    }
  }

  /**
   * Listen to auth state updates.
   * @param {function} callback - ({ user_id, email, profile, access_token })
   */
  onAuthStateChange(callback) {
    this._onUserChange.push(callback);
    if (this.isAuthenticated()) {
      callback({
        user_id: localStorage.getItem("platform_user_id"),
        email: localStorage.getItem("platform_email"),
        profile: this.getProfile(),
        access_token: this.getAccessToken(),
      });
    } else {
      callback(null);
    }
    return () => {
      this._onUserChange = this._onUserChange.filter((cb) => cb !== callback);
    };
  }

  /**
   * Exchange active Supabase session for a Platform JWT.
   */
  async exchangeSession() {
    try {
      let session = null;
      const hasHash = window.location.hash && (window.location.hash.includes("access_token=") || window.location.hash.includes("id_token="));
      const hasCode = window.location.search && window.location.search.includes("code=");
      const maxAttempts = (hasHash || hasCode) ? 30 : 1;

      for (let i = 0; i < maxAttempts; i++) {
        const { data, error } = await this.supabase.auth.getSession();
        if (data && data.session) {
          session = data.session;
          break;
        }
        if (hasHash || hasCode) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      if (!session) {
        if (!hasHash && !hasCode) {
          this.clearSession();
        }
        return null;
      }

      const res = await fetch(`${this.authBaseUrl}/auth/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_jwt: session.access_token,
          app_id: this.appId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.clearSession();
        throw new Error(err.message || "Failed to exchange token");
      }

      const data = await res.json();
      this.saveSession(data);
      this._notifyChange(data);
      return data;
    } catch (err) {
      this.clearSession();
      console.error("[AuthSDK] Exchange session failed:", err);
      return null;
    }
  }

  /**
   * Refresh Platform JWT using the refresh token.
   */
  async refresh() {
    const refreshToken = localStorage.getItem("platform_refresh_token");
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${this.authBaseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        this.clearSession();
        this._notifyChange(null);
        return null;
      }

      const data = await res.json();
      localStorage.setItem("platform_access_token", data.access_token);
      
      this._scheduleRefresh();
      
      const payload = {
        user_id: localStorage.getItem("platform_user_id"),
        email: localStorage.getItem("platform_email"),
        profile: this.getProfile(),
        access_token: data.access_token,
      };
      this._notifyChange(payload);
      return data.access_token;
    } catch (err) {
      console.error("[AuthSDK] Token refresh failed:", err);
      return null;
    }
  }

  isAuthenticated() {
    return !!this.getAccessToken();
  }

  getAccessToken() {
    return localStorage.getItem("platform_access_token");
  }

  getProfile() {
    try {
      const prof = localStorage.getItem("platform_profile");
      return prof ? JSON.parse(prof) : null;
    } catch {
      return null;
    }
  }

  saveSession(data) {
    localStorage.setItem("platform_access_token", data.access_token);
    localStorage.setItem("platform_refresh_token", data.refresh_token);
    localStorage.setItem("platform_user_id", data.user_id);
    localStorage.setItem("platform_email", data.email);
    localStorage.setItem("platform_profile", JSON.stringify(data.profile));
    this._scheduleRefresh();
  }

  clearSession() {
    localStorage.removeItem("platform_access_token");
    localStorage.removeItem("platform_refresh_token");
    localStorage.removeItem("platform_user_id");
    localStorage.removeItem("platform_email");
    localStorage.removeItem("platform_profile");
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async signOut() {
    this.clearSession();
    await this.supabase.auth.signOut();
    this._notifyChange(null);
  }

  /**
   * Initiate Google OAuth sign‑in via Supabase.
   * Returns the result of supabase.auth.signInWithOAuth which may redirect.
   */
  async signInWithGoogle() {
    const redirectTo = window.location.href.split('#')[0];
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  }

  _scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    
    const token = this.getAccessToken();
    if (!token) return;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) return;
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      
      const delay = Math.max(0, exp - now - 5 * 60 * 1000);
      this.refreshTimer = setTimeout(() => this.refresh(), delay);
    } catch (e) {
      console.error("[AuthSDK] Error parsing JWT expiration:", e);
    }
  }

  _notifyChange(state) {
    this._onUserChange.forEach((cb) => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }
}

// Make it globally accessible for unified build
window.PlatformAuth = PlatformAuth;
