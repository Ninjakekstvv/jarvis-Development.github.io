/**
 * roadmap.js
 * ---------------------------------------------------------------------------
 * Enthält die gesamte Geschäftslogik rund um die Roadmap-Daten:
 *  - Icon-Registry (Inline-SVG-Pfade, keine externen Icon-Bibliotheken)
 *  - Filterlogik (Suche, Status, Kategorie)
 *  - Aggregierte Kennzahlen (Gesamtfortschritt, Versionsanzahl, Feature-Anzahl)
 *  - Sortierung der Versionen für die Timeline-Darstellung
 *
 * Dieses Modul manipuliert KEIN DOM. Es liefert ausschließlich verarbeitete
 * Daten an ui.js, das für das Rendering zuständig ist. Diese Trennung hält
 * die Codebasis wartbar und testbar.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /**
   * Zentrale Icon-Registry. Jedes Icon ist ein reiner SVG-Pfad-String,
   * der in ui.js in einen <svg>-Wrapper eingesetzt wird. So bleibt die
   * Anwendung frei von externen Icon-Fonts oder Bildern.
   */
  var ICONS = {
    rocket: '<path d="M12 2c2.5 2.5 4 6 4 10 0 1.5-.3 3-1 4.3L12 19l-3-2.7c-.7-1.3-1-2.8-1-4.3 0-4 1.5-7.5 4-10z"/><circle cx="12" cy="9" r="1.6"/><path d="M8 15.5 5.5 18M16 15.5 18.5 18M9.5 19 8 22M14.5 19 16 22"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.8"/><path d="M5 5.5v6c0 1.5 3 2.8 7 2.8s7-1.3 7-2.8v-6"/><path d="M5 11.5v6c0 1.5 3 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
    brain: '<path d="M9 3.5c-2 0-3.5 1.6-3.5 3.5 0 .5.1 1 .3 1.4C4.6 8.9 4 9.9 4 11c0 1.2.7 2.2 1.7 2.7-.2.4-.2.9-.2 1.3 0 1.9 1.6 3.5 3.5 3.5.3 0 .6 0 .9-.1.5 1.1 1.6 1.9 2.9 1.9v-17c-1.1 0-2 .6-2.4 1.4-.4-.1-.9-.2-1.4-.2z"/><path d="M15 3.5c2 0 3.5 1.6 3.5 3.5 0 .5-.1 1-.3 1.4 1.2.5 1.8 1.5 1.8 2.6 0 1.2-.7 2.2-1.7 2.7.2.4.2.9.2 1.3 0 1.9-1.6 3.5-3.5 3.5-.3 0-.6 0-.9-.1-.5 1.1-1.6 1.9-2.9 1.9v-17c1.1 0 2 .6 2.4 1.4.4-.1.9-.2 1.4-.2z"/>',
    waveform: '<path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4M21 12h1"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5 12 22.5l9-5"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    flask: '<path d="M9 2v6.2L4.3 17.8A2 2 0 0 0 6.1 21h11.8a2 2 0 0 0 1.8-3.2L15 8.2V2"/><path d="M9 2h6M6.5 15h11"/>',
    gauge: '<circle cx="12" cy="13" r="8.5"/><path d="M12 13 16 9"/><path d="M12 5.5v1.3M6 8l1 1M18 8l-1 1"/>',
    pause: '<rect x="7" y="5" width="3.4" height="14" rx="1"/><rect x="13.6" y="5" width="3.4" height="14" rx="1"/>',
    cross: '<path d="M6 6l12 12M18 6 6 18"/>',
    shield: '<path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6L12 2.5z"/><path d="M8.5 12 11 14.5 15.7 9.5"/>',
    check: '<path d="M4 12.5 9.5 18 20 6"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5 15 15"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    tag: '<path d="M11.5 3H4v7.5L13.5 20l7.5-7.5L11.5 3z"/><circle cx="8" cy="7.5" r="1.4"/>'
  };

  /**
   * Liefert den rohen SVG-Pfad für einen Icon-Namen. Fällt auf ein
   * generisches "Tag"-Icon zurück, falls der Name unbekannt ist, damit die
   * Anwendung niemals wegen eines fehlenden Icons abbricht.
   * @param {string} name
   * @returns {string}
   */
  function getIconPath(name) {
    return ICONS[name] || ICONS.tag;
  }

  /**
   * Wendet die aktuell im State gesetzten Filter (Suche, Status, Kategorie)
   * auf die vollständige Versionsliste an.
   * @returns {Array<Object>} Gefilterte und sortierte Versionsliste.
   */
  function getFilteredVersions() {
    var state = window.JarvisState;
    var filters = state.filters;
    var searchTerm = (filters.search || '').trim().toLowerCase();

    var result = state.versions.filter(function (item) {
      var matchesStatus = filters.status === 'all' || item.status === filters.status;
      var matchesCategory = filters.category === 'all' || item.category === filters.category;

      var matchesSearch = true;
      if (searchTerm.length > 0) {
        var haystack = [
          item.version,
          item.description,
          item.category,
          item.status
        ].concat(item.features || []).join(' ').toLowerCase();
        matchesSearch = haystack.indexOf(searchTerm) !== -1;
      }

      return matchesStatus && matchesCategory && matchesSearch;
    });

    return sortVersions(result);
  }

  /**
   * Sortiert Versionen für eine sinnvolle Timeline-Darstellung:
   * Released/In Development zuerst (nach Datum absteigend wo möglich),
   * gefolgt von Planned/Research/On Hold/Cancelled. Die Sortierung erfolgt
   * primär über die Reihenfolge in roadmap.json (Autoren-Intention), da
   * Datumsangaben teils als Freitext ("Q3 2026", "TBA") vorliegen und sich
   * nicht zuverlässig chronologisch parsen lassen.
   * @param {Array<Object>} versions
   * @returns {Array<Object>}
   */
  function sortVersions(versions) {
    // Reihenfolge aus roadmap.json wird beibehalten (stabile Sortierung),
    // da sie die vom Projektverantwortlichen intendierte Chronologie abbildet.
    return versions.slice();
  }

  /**
   * Berechnet aggregierte Kennzahlen über die GESAMTE (ungefilterte)
   * Versionsliste für die Kopfzeile und den Hero-Bereich.
   * @returns {{overallProgress: number, versionCount: number, featureCount: number, releasedCount: number}}
   */
  function computeSummary() {
    var versions = window.JarvisState.versions;
    var relevant = versions.filter(function (v) {
      return v.status !== 'Cancelled';
    });

    var totalProgress = relevant.reduce(function (sum, v) {
      return sum + (typeof v.progress === 'number' ? v.progress : 0);
    }, 0);

    var overallProgress = relevant.length > 0 ? Math.round(totalProgress / relevant.length) : 0;

    var featureCount = versions.reduce(function (sum, v) {
      return sum + (Array.isArray(v.features) ? v.features.length : 0);
    }, 0);

    var releasedCount = versions.filter(function (v) {
      return v.status === 'Released';
    }).length;

    return {
      overallProgress: overallProgress,
      versionCount: versions.length,
      featureCount: featureCount,
      releasedCount: releasedCount
    };
  }

  /**
   * Liefert die Konfiguration (Farbe, Glow, Icon, Label) für einen
   * bestimmten Status-Schlüssel. Liefert sinnvolle Defaults, falls ein
   * Status in roadmap.json nicht in der "statuses"-Sektion definiert ist.
   * @param {string} statusKey
   * @returns {{color: string, glow: string, icon: string, label: string}}
   */
  function getStatusConfig(statusKey) {
    var config = window.JarvisState.statuses[statusKey];
    if (config) return config;
    return {
      color: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.35)',
      icon: 'tag',
      label: statusKey || 'Unbekannt'
    };
  }

  // Öffentliche Schnittstelle des Moduls
  window.JarvisRoadmap = {
    init: function () {
      // Derzeit kein asynchrones Setup nötig; Platzhalter für zukünftige
      // Erweiterungen (z. B. Nachladen zusätzlicher Datenquellen), damit
      // app.js unabhängig von der internen Implementierung bleibt.
    },
    getIconPath: getIconPath,
    getFilteredVersions: getFilteredVersions,
    computeSummary: computeSummary,
    getStatusConfig: getStatusConfig
  };
})();
