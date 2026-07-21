/**
 * app.js
 * ---------------------------------------------------------------------------
 * Einstiegspunkt der Anwendung. Verantwortlich für:
 *  - Laden der Roadmap-Daten (roadmap.json) auf eine Weise, die sowohl über
 *    file:// (Doppelklick auf index.html) als auch über einen lokalen Server
 *    funktioniert.
 *  - Initialisieren des globalen Anwendungszustands (JarvisState).
 *  - Orchestrieren der Modul-Initialisierung in der richtigen Reihenfolge.
 *
 * Kein Framework, keine externen Bibliotheken. Reines Vanilla JavaScript.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /**
   * Globaler, gekapselter Anwendungszustand.
   * Andere Module (roadmap.js, ui.js, animations.js) lesen/schreiben
   * ausschließlich über dieses Objekt, um Race Conditions zu vermeiden.
   */
  window.JarvisState = {
    raw: null,            // Rohdaten aus roadmap.json
    versions: [],         // Array aller Versionskarten-Objekte
    statuses: {},          // Status-Konfiguration (Farben, Icons, Labels)
    categories: [],        // Liste aller Kategorien
    meta: {},              // Projekt-Metadaten (Name, Tagline, Datum)
    filters: {
      search: '',
      status: 'all',
      category: 'all'
    },
    expandedCards: new Set(), // IDs aktuell aufgeklappter Versionskarten
    isLoaded: false
  };

  var DATA_PATH = 'assets/data/roadmap.json';

  /**
   * Lädt die Roadmap-Daten. Es werden zwei Strategien versucht:
   *   1) fetch() — funktioniert zuverlässig, wenn die Seite über http(s)://
   *      (z. B. einen lokalen Dev-Server) ausgeliefert wird.
   *   2) synchroner XMLHttpRequest gegen file:// — funktioniert in Chrome/
   *      Edge/Firefox in den meisten Standard-Konfigurationen auch beim
   *      direkten Öffnen der index.html per Doppelklick.
   * Schlagen beide fehl (z. B. durch strikte Browser-Sicherheitsrichtlinien),
   * wird eine klar sichtbare Fehlermeldung im Interface angezeigt, statt
   * stillschweigend mit leeren Daten weiterzumachen.
   *
   * @returns {Promise<Object>} Das geparste Roadmap-Datenobjekt.
   */
  function loadRoadmapData() {
    // Strategie 1: fetch (bevorzugt, modernste Methode)
    if (window.fetch) {
      return fetch(DATA_PATH, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        })
        .catch(function () {
          // Fällt auf die synchrone XHR-Methode zurück (typischer file://-Fall)
          return loadViaXHR();
        });
    }
    return loadViaXHR();
  }

  /**
   * Fallback-Lademethode über XMLHttpRequest. Wird synchron ausgeführt,
   * da dies unter file:// deutlich zuverlässiger funktioniert als
   * asynchrone Varianten in älteren Browser-Implementierungen.
   *
   * @returns {Promise<Object>}
   */
  function loadViaXHR() {
    return new Promise(function (resolve, reject) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', DATA_PATH, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) {
              // status 0 tritt bei file:// häufig auf, obwohl der Request
              // technisch erfolgreich war.
              try {
                var parsed = JSON.parse(xhr.responseText);
                resolve(parsed);
              } catch (parseErr) {
                reject(parseErr);
              }
            } else {
              reject(new Error('XHR Status ' + xhr.status));
            }
          }
        };
        xhr.onerror = function () {
          reject(new Error('XHR Netzwerkfehler'));
        };
        xhr.send(null);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Zeigt einen blockierenden, aber klar verständlichen Fehlerzustand an,
   * falls roadmap.json unter keinen Umständen geladen werden konnte.
   * @param {Error} err
   */
  function renderFatalError(err) {
    var root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML =
      '<div class="fatal-error">' +
      '<div class="fatal-error__icon">&#9888;</div>' +
      '<h1 class="fatal-error__title">Roadmap-Daten konnten nicht geladen werden</h1>' +
      '<p class="fatal-error__message">Die Datei <code>assets/data/roadmap.json</code> ' +
      'konnte nicht gelesen werden. Falls Sie die Seite direkt per Doppelklick geöffnet haben, ' +
      'aktivieren Sie bitte lokale Dateizugriffe in Ihrem Browser oder starten Sie einen einfachen ' +
      'lokalen Server (z. B. <code>npx serve</code>) im Projektordner.</p>' +
      '<p class="fatal-error__detail">Technische Details: ' + (err && err.message ? err.message : 'Unbekannter Fehler') + '</p>' +
      '</div>';
  }

  /**
   * Verteilt die geladenen Rohdaten in das globale State-Objekt.
   * @param {Object} data
   */
  function hydrateState(data) {
    window.JarvisState.raw = data;
    window.JarvisState.meta = data.meta || {};
    window.JarvisState.statuses = data.statuses || {};
    window.JarvisState.categories = data.categories || [];
    window.JarvisState.versions = Array.isArray(data.versions) ? data.versions : [];
    window.JarvisState.isLoaded = true;
  }

  /**
   * Haupteinstiegspunkt. Wird nach DOMContentLoaded ausgeführt.
   */
  function init() {
    loadRoadmapData()
      .then(function (data) {
        hydrateState(data);

        // Reihenfolge ist wichtig:
        // 1) roadmap.js bereitet die Daten auf.
        // 2) animations.js registriert seinen Listener auf das
        //    'jarvis:ui-ready'-Event, BEVOR dieses Event gefeuert wird.
        // 3) ui.js rendert das DOM und feuert 'jarvis:ui-ready' synchron
        //    als letzten Schritt seines init() — der Listener aus Schritt 2
        //    muss zu diesem Zeitpunkt bereits aktiv sein, sonst verpufft
        //    das Event und keine Animation (Count-Up, Ring, Balken) startet.
        window.JarvisRoadmap.init();
        window.JarvisAnimations.init();
        window.JarvisUI.init();
      })
      .catch(function (err) {
        renderFatalError(err);
        // eslint-disable-next-line no-console
        console.error('[Jarvis] Kritischer Fehler beim Laden der Roadmap-Daten:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
