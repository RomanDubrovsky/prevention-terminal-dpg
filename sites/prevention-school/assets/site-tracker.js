/**
 * Lightweight Zero-PII Telemetry Tracker for Prevention AI & IDA Landings.
 * Transmits page views, reading duration, scroll depth, timezone, and geo (city/country/org) to Supabase.
 */
(function() {
  if (typeof window === 'undefined') return;

  const SUPABASE_URL = "https://ecppmcsceglmqsogijws.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcHBtY3NjZWdsbXFzb2dpandzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzc0NjMsImV4cCI6MjA4NjcxMzQ2M30.ZFUtTkV3fw10CICsXG1LMvLxvu4E9W5q_yWzpeKOOlE";

  function getAnonUserId() {
    let uid = localStorage.getItem('__pa_anon_uid');
    if (!uid) {
      uid = 'v_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('__pa_anon_uid', uid);
    }
    return uid;
  }

  function getSessionId() {
    let sid = sessionStorage.getItem('__pa_session_id');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      sessionStorage.setItem('__pa_session_id', sid);
    }
    return sid;
  }

  const userId = getAnonUserId();
  const sessionId = getSessionId();
  const startTime = Date.now();
  let maxScroll = 0;
  let sentLeave = false;

  const userTimezone = (function() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    } catch(e) {
      return 'unknown';
    }
  })();

  function getCachedGeo() {
    try {
      const g = sessionStorage.getItem('__pa_geo');
      return g ? JSON.parse(g) : null;
    } catch(e) {
      return null;
    }
  }

  function setCachedGeo(geoData) {
    try {
      sessionStorage.setItem('__pa_geo', JSON.stringify(geoData));
    } catch(e) {}
  }

  function determineAppId() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('ida-psy')) return 'ida_landing';
    if (host.includes('teenology')) return 'teenology_landing';
    return 'prevention_landing';
  }

  function sendEvent(eventType, extraPayload = {}) {
    const cachedGeo = getCachedGeo() || {};

    const payload = {
      app_id: determineAppId(),
      event_type: eventType,
      user_id_hash: userId,
      session_id: sessionId,
      url: window.location.pathname + window.location.search,
      title: document.title,
      referrer: document.referrer || '(direct)',
      screen: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'ru',
      timezone: userTimezone,
      country: cachedGeo.country || null,
      city: cachedGeo.city || null,
      org: cachedGeo.org || null,
      ...extraPayload
    };

    const body = JSON.stringify({
      app_id: determineAppId(),
      event_type: eventType,
      payload: payload
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${SUPABASE_URL}/rest/v1/analytics_events_staging`, blob);
    } else {
      fetch(`${SUPABASE_URL}/rest/v1/analytics_events_staging`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: body,
        keepalive: true
      }).catch(function() {});
    }
  }

  // 1. Initial Page View
  sendEvent('page_view', { ts: Date.now() });

  // Asynchronously resolve Geo if not cached yet
  if (!getCachedGeo()) {
    fetch('https://ipapi.co/json/', { mode: 'cors' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.country_name) {
          const geoInfo = {
            country: data.country_name,
            country_code: data.country_code,
            city: data.city,
            region: data.region,
            org: data.org
          };
          setCachedGeo(geoInfo);
          // Send update event with enriched geo
          sendEvent('geo_resolved', {
            ts: Date.now(),
            ...geoInfo
          });
        }
      })
      .catch(function() {});
  }

  // 2. Track scroll depth
  function trackScroll() {
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
    if (docHeight <= 0) {
      maxScroll = 100;
      return;
    }
    const currentScroll = Math.round((window.scrollY / docHeight) * 100);
    if (currentScroll > maxScroll) {
      maxScroll = Math.min(100, currentScroll);
    }
  }
  window.addEventListener('scroll', trackScroll, { passive: true });

  // 3. Heartbeat / Leave event
  function sendReadingSummary() {
    if (sentLeave) return;
    sentLeave = true;
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    if (durationSeconds >= 2) {
      sendEvent('page_read_summary', {
        duration_seconds: durationSeconds,
        scroll_depth_percent: maxScroll,
        ts: Date.now()
      });
    }
  }

  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      sendReadingSummary();
    }
  });
  window.addEventListener('beforeunload', sendReadingSummary);

})();
