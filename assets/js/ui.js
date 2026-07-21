/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Verantwortlich für sämtliches DOM-Rendering und die direkte Interaktion
 * mit dem Nutzer: Header-Statistiken, Hero-Bereich (Fortschrittsring),
 * Filterleiste, Suchfeld sowie die Timeline mit den Versionskarten.
 *
 * Arbeitet ausschließlich mit bereits verarbeiteten Daten aus roadmap.js.
 * DOM-Erzeugung erfolgt über String-Templates + innerHTML für Kompaktheit;
 * alle dynamischen Werte werden vor dem Einsetzen escaped, um versehentliches
 * HTML-Markup aus roadmap.json unschädlich zu machen.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  var SELECTORS = {
    heroProgressValue: '#hero-progress-value',
    heroProgressRingFg: '#hero-progress-ring-fg',
    statVersions: '#stat-versions',
    statFeatures: '#stat-features',
    statUpdate: '#stat-update',
    statOverall: '#stat-overall',
    projectTagline: '#project-tagline',
    searchInput: '#search-input',
    searchClear: '#search-clear',
    statusFilterBar: '#status-filter-bar',
    categoryFilterBar: '#category-filter-bar',
    timelineTrack: '#timeline-track',
    emptyState: '#empty-state',
    resultCount: '#result-count',
    themeToggle: '#theme-toggle'
  };

  var RING_RADIUS = 54;
  var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  /**
   * Escaped potenziell gefährliche Zeichen, bevor Freitext aus
   * roadmap.json in innerHTML eingesetzt wird. Verhindert, dass
   * Sonderzeichen in Beschreibungen das Markup brechen oder
   * ungewollt als HTML interpretiert werden.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Erzeugt einen wiederverwendbaren Inline-SVG-Icon-String.
   * @param {string} name Icon-Name aus der roadmap.js Icon-Registry
   * @param {string} [extraClass]
   * @returns {string}
   */
  function renderIcon(name, extraClass) {
    var path = window.JarvisRoadmap.getIconPath(name);
    return '<svg class="icon ' + (extraClass || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + path + '</svg>';
  }

  /**
   * Formatiert ein ISO-Datum (YYYY-MM-DD) in ein deutsches Anzeigeformat.
   * Freitext-Daten ("Q3 2026", "TBA") werden unverändert durchgereicht.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!isoMatch) return dateStr;
    var monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    var year = isoMatch[1];
    var month = parseInt(isoMatch[2], 10) - 1;
    var day = parseInt(isoMatch[3], 10);
    return day + '. ' + monthNames[month] + ' ' + year;
  }

  // ---------------------------------------------------------------------
  // Header & Hero Rendering
  // ---------------------------------------------------------------------

  /**
   * Rendert die Kennzahlen im Kopfbereich sowie den Fortschrittsring im
   * Hero-Bereich. Die eigentliche Zahlen-Hochzähl-Animation übernimmt
   * animations.js; hier werden nur die finalen Zielwerte als
   * data-Attribute hinterlegt.
   */
  function renderHeaderAndHero() {
    var summary = window.JarvisRoadmap.computeSummary();
    var meta = window.JarvisState.meta;

    setText(SELECTORS.projectTagline, meta.tagline || '');
    setText(SELECTORS.statUpdate, formatDate(meta.lastUpdate));

    var statVersionsEl = document.querySelector(SELECTORS.statVersions);
    if (statVersionsEl) statVersionsEl.setAttribute('data-target', String(summary.versionCount));

    var statFeaturesEl = document.querySelector(SELECTORS.statFeatures);
    if (statFeaturesEl) statFeaturesEl.setAttribute('data-target', String(summary.featureCount));

    var heroProgressEl = document.querySelector(SELECTORS.heroProgressValue);
    if (heroProgressEl) heroProgressEl.setAttribute('data-target', String(summary.overallProgress));

    var statOverallEl = document.querySelector(SELECTORS.statOverall);
    if (statOverallEl) statOverallEl.setAttribute('data-target', String(summary.overallProgress));

    // Hero-Meta-Zeile: "X bereits released" (kein Count-Up nötig, da
    // dieser Wert klein und unmittelbar verständlich ist).
    setText('#stat-released-inline', String(summary.releasedCount));

    // Fortschrittsring vorbereiten (stroke-dasharray/offset), Animation
    // des Übergangs übernimmt animations.js beim Initial-Reveal.
    var ringFg = document.querySelector(SELECTORS.heroProgressRingFg);
    if (ringFg) {
      ringFg.style.strokeDasharray = String(RING_CIRCUMFERENCE);
      ringFg.setAttribute('data-target-offset', String(RING_CIRCUMFERENCE * (1 - summary.overallProgress / 100)));
      ringFg.style.strokeDashoffset = String(RING_CIRCUMFERENCE); // Startzustand: leerer Ring
    }
  }

  function setText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  // ---------------------------------------------------------------------
  // Filterleiste Rendering
  // ---------------------------------------------------------------------

  /**
   * Rendert die Status-Filter-Chips basierend auf den in roadmap.json
   * definierten Status-Typen, plus einem "Alle"-Chip.
   */
  function renderStatusFilters() {
    var container = document.querySelector(SELECTORS.statusFilterBar);
    if (!container) return;

    var statuses = window.JarvisState.statuses;
    var currentFilter = window.JarvisState.filters.status;

    var html = buildFilterChip('all', 'Alle Status', currentFilter === 'all', null);

    Object.keys(statuses).forEach(function (key) {
      var config = statuses[key];
      html += buildFilterChip(key, config.label || key, currentFilter === key, config.color);
    });

    container.innerHTML = html;
  }

  /**
   * Rendert die Kategorie-Filter-Chips.
   */
  function renderCategoryFilters() {
    var container = document.querySelector(SELECTORS.categoryFilterBar);
    if (!container) return;

    var categories = window.JarvisState.categories;
    var currentFilter = window.JarvisState.filters.category;

    var html = buildFilterChip('all', 'Alle Kategorien', currentFilter === 'all', null);

    categories.forEach(function (cat) {
      html += buildFilterChip(cat, cat, currentFilter === cat, null);
    });

    container.innerHTML = html;
  }

  /**
   * Baut das Markup für einen einzelnen Filter-Chip.
   * @param {string} value
   * @param {string} label
   * @param {boolean} isActive
   * @param {?string} accentColor
   * @returns {string}
   */
  function buildFilterChip(value, label, isActive, accentColor) {
    var style = accentColor ? ' style="--chip-accent:' + accentColor + '"' : '';
    return '<button type="button" class="filter-chip' + (isActive ? ' filter-chip--active' : '') + '" ' +
      'data-value="' + escapeHTML(value) + '"' + style + '>' +
      '<span class="filter-chip__label">' + escapeHTML(label) + '</span>' +
      '</button>';
  }

  // ---------------------------------------------------------------------
  // Timeline & Versionskarten Rendering
  // ---------------------------------------------------------------------

  /**
   * Rendert die komplette Timeline neu, basierend auf den aktuell
   * gesetzten Filtern. Zeigt bei leerem Ergebnis einen Empty State an.
   */
  function renderTimeline() {
    var track = document.querySelector(SELECTORS.timelineTrack);
    var emptyState = document.querySelector(SELECTORS.emptyState);
    if (!track) return;

    var filtered = window.JarvisRoadmap.getFilteredVersions();

    setText(SELECTORS.resultCount, String(filtered.length));

    if (filtered.length === 0) {
      track.innerHTML = '';
      track.setAttribute('aria-hidden', 'true');
      if (emptyState) emptyState.classList.add('is-visible');
      return;
    }

    if (emptyState) emptyState.classList.remove('is-visible');
    track.removeAttribute('aria-hidden');

    var html = filtered.map(function (version, index) {
      return buildVersionCard(version, index);
    }).join('');

    track.innerHTML = html;
  }

  /**
   * Baut das vollständige Markup einer einzelnen Versionskarte inklusive
   * Timeline-Knoten, Statusbadge, Fortschrittsbalken und aufklappbarer
   * Feature-Liste.
   * @param {Object} version
   * @param {number} index Position in der aktuell gefilterten Liste (für
   *   die gestaffelte Einfahr-Animation).
   * @returns {string}
   */
  function buildVersionCard(version, index) {
    var statusConfig = window.JarvisRoadmap.getStatusConfig(version.status);
    var isExpanded = window.JarvisState.expandedCards.has(version.id);
    var featureCount = Array.isArray(version.features) ? version.features.length : 0;

    var featuresHTML = (version.features || []).map(function (feature) {
      return '<li class="feature-item">' +
        '<span class="feature-item__dot"></span>' +
        '<span>' + escapeHTML(feature) + '</span>' +
        '</li>';
    }).join('');

    // Optionales Symbol pro Version (roadmap.json: "icon"-Feld). Fällt auf
    // ein generisches Icon zurück, falls kein Icon-Feld gepflegt wurde.
    var iconBadgeHTML = '<div class="version-card__icon-badge" style="--status-color:' + statusConfig.color + '; --status-glow:' + statusConfig.glow + '">' +
      renderIcon(version.icon || 'tag') +
      '</div>';

    // Optionaler Screenshot pro Version (roadmap.json: "image"-Feld, Pfad
    // relativ zu assets/images/). Wird nur gerendert, wenn das Feld gesetzt
    // ist; ein onerror-Handler blendet den Container unauffällig aus, falls
    // die referenzierte Datei fehlt, statt ein kaputtes Bild-Icon zu zeigen.
    var screenshotHTML = version.image
      ? '<div class="version-card__screenshot">' +
        '<img src="assets/images/' + escapeHTML(version.image) + '" alt="Screenshot ' + escapeHTML(version.version) + '" loading="lazy" ' +
        'onerror="this.closest(&quot;.version-card__screenshot&quot;).style.display=&quot;none&quot;" />' +
        '</div>'
      : '';

    return (
      '<article class="version-card" data-id="' + escapeHTML(version.id) + '" ' +
      'data-status="' + escapeHTML(version.status) + '" style="--card-delay:' + (index * 70) + 'ms; --status-color:' + statusConfig.color + '; --status-glow:' + statusConfig.glow + '">' +

        '<div class="version-card__node" aria-hidden="true"></div>' +

        '<div class="version-card__surface">' +

          '<header class="version-card__header">' +
            '<div class="version-card__title-row">' +
              iconBadgeHTML +
              '<div class="version-card__title-group">' +
                '<span class="version-card__category">' + renderIcon('tag', 'icon--tiny') + escapeHTML(version.category || '') + '</span>' +
                '<h3 class="version-card__version">' + escapeHTML(version.version) + '</h3>' +
              '</div>' +
            '</div>' +
            '<span class="status-badge" style="--status-color:' + statusConfig.color + '; --status-glow:' + statusConfig.glow + '">' +
              renderIcon(statusConfig.icon, 'icon--tiny') +
              escapeHTML(statusConfig.label) +
            '</span>' +
          '</header>' +

          '<p class="version-card__description">' + escapeHTML(version.description || '') + '</p>' +

          '<div class="version-card__progress-row">' +
            '<div class="progress-bar">' +
              '<div class="progress-bar__fill" data-target="' + version.progress + '" style="--status-color:' + statusConfig.color + '"></div>' +
            '</div>' +
            '<span class="progress-bar__value">' + version.progress + '%</span>' +
          '</div>' +

          '<footer class="version-card__footer">' +
            '<span class="version-card__meta">' + renderIcon('clock', 'icon--tiny') + formatDate(version.releaseDate) + '</span>' +
            '<span class="version-card__meta">' + renderIcon('layers', 'icon--tiny') + featureCount + ' Feature' + (featureCount === 1 ? '' : 's') + '</span>' +
            '<button type="button" class="version-card__toggle" data-toggle-id="' + escapeHTML(version.id) + '" aria-expanded="' + isExpanded + '">' +
              '<span>' + (isExpanded ? 'Weniger' : 'Details') + '</span>' +
              renderIcon('chevron', 'icon--tiny icon--chevron' + (isExpanded ? ' icon--chevron-open' : '')) +
            '</button>' +
          '</footer>' +

          '<div class="version-card__details' + (isExpanded ? ' is-expanded' : '') + '">' +
            '<div class="version-card__details-inner">' +
              screenshotHTML +
              '<ul class="feature-list">' + featuresHTML + '</ul>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</article>'
    );
  }

  // ---------------------------------------------------------------------
  // Event Bindings
  // ---------------------------------------------------------------------

  /**
   * Bindet alle interaktiven Event-Handler. Nutzt Event-Delegation für
   * dynamisch erzeugte Elemente (Filter-Chips, Karten-Toggles), damit
   * Handler nach jedem Re-Render nicht neu gebunden werden müssen.
   */
  function bindEvents() {
    var searchInput = document.querySelector(SELECTORS.searchInput);
    var searchClear = document.querySelector(SELECTORS.searchClear);

    if (searchInput) {
      searchInput.addEventListener('input', function (evt) {
        window.JarvisState.filters.search = evt.target.value;
        toggleSearchClearVisibility();
        renderTimeline();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        window.JarvisState.filters.search = '';
        if (searchInput) searchInput.value = '';
        toggleSearchClearVisibility();
        renderTimeline();
        if (searchInput) searchInput.focus();
      });
    }

    // Delegierter Klick-Handler für Status-Filter, Kategorie-Filter und
    // Karten-Toggle-Buttons, da diese Elemente bei jedem Filterwechsel
    // neu erzeugt werden.
    document.addEventListener('click', function (evt) {
      var statusChip = evt.target.closest(SELECTORS.statusFilterBar + ' .filter-chip');
      if (statusChip) {
        window.JarvisState.filters.status = statusChip.getAttribute('data-value');
        renderStatusFilters();
        renderTimeline();
        return;
      }

      var categoryChip = evt.target.closest(SELECTORS.categoryFilterBar + ' .filter-chip');
      if (categoryChip) {
        window.JarvisState.filters.category = categoryChip.getAttribute('data-value');
        renderCategoryFilters();
        renderTimeline();
        return;
      }

      var toggleBtn = evt.target.closest('.version-card__toggle');
      if (toggleBtn) {
        var cardId = toggleBtn.getAttribute('data-toggle-id');
        toggleCard(cardId);
        return;
      }

      var themeToggle = evt.target.closest(SELECTORS.themeToggle);
      if (themeToggle) {
        window.JarvisUI.toggleTheme();
      }
    });
  }

  /**
   * Klappt eine einzelne Versionskarte auf bzw. zu, ohne die komplette
   * Timeline neu zu rendern (nur die betroffene Karte wird aktualisiert),
   * um unnötiges Re-Rendering und Layout-Sprünge zu vermeiden.
   * @param {string} cardId
   */
  function toggleCard(cardId) {
    var expanded = window.JarvisState.expandedCards;
    var cardEl = document.querySelector('.version-card[data-id="' + cssEscape(cardId) + '"]');
    if (!cardEl) return;

    var detailsEl = cardEl.querySelector('.version-card__details');
    var toggleBtn = cardEl.querySelector('.version-card__toggle');
    var chevron = toggleBtn ? toggleBtn.querySelector('.icon--chevron') : null;
    var labelSpan = toggleBtn ? toggleBtn.querySelector('span') : null;

    if (expanded.has(cardId)) {
      expanded.delete(cardId);
      if (detailsEl) detailsEl.classList.remove('is-expanded');
      if (chevron) chevron.classList.remove('icon--chevron-open');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      if (labelSpan) labelSpan.textContent = 'Details';
    } else {
      expanded.add(cardId);
      if (detailsEl) detailsEl.classList.add('is-expanded');
      if (chevron) chevron.classList.add('icon--chevron-open');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      if (labelSpan) labelSpan.textContent = 'Weniger';
    }
  }

  /**
   * Minimales CSS.escape-Polyfill für Attribut-Selektoren, um Bindestriche
   * und andere Sonderzeichen in IDs sicher zu behandeln, ohne auf die
   * native (nicht überall verfügbare) CSS.escape-Funktion angewiesen zu sein.
   * @param {string} value
   * @returns {string}
   */
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function toggleSearchClearVisibility() {
    var searchClear = document.querySelector(SELECTORS.searchClear);
    var searchInput = document.querySelector(SELECTORS.searchInput);
    if (!searchClear || !searchInput) return;
    searchClear.classList.toggle('is-visible', searchInput.value.length > 0);
  }

  /**
   * Schaltet zwischen Dark Theme (Standard) und optionalem Light Theme um.
   * Der aktuelle Zustand wird über ein data-Attribut am <html>-Element
   * gesteuert, das sämtliche Farbvariablen in main.css umschaltet.
   */
  function toggleTheme() {
    var root = document.documentElement;
    var isLight = root.getAttribute('data-theme') === 'light';
    root.setAttribute('data-theme', isLight ? 'dark' : 'light');
    try {
      window.localStorage.setItem('jarvis-theme', isLight ? 'dark' : 'light');
    } catch (e) {
      // localStorage kann in manchen file://-Kontexten blockiert sein;
      // die Theme-Wahl wird dann einfach nicht persistiert, was
      // unkritisch ist.
    }
  }

  /**
   * Stellt beim Start ein zuvor gespeichertes Theme wieder her, falls
   * vorhanden.
   */
  function restoreTheme() {
    try {
      var saved = window.localStorage.getItem('jarvis-theme');
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch (e) {
      // Ignorieren — Standard-Theme (dark) bleibt aktiv.
    }
  }

  // ---------------------------------------------------------------------
  // Öffentliche Schnittstelle
  // ---------------------------------------------------------------------

  window.JarvisUI = {
    init: function () {
      restoreTheme();
      renderHeaderAndHero();
      renderStatusFilters();
      renderCategoryFilters();
      renderTimeline();
      bindEvents();

      // Signalisiert animations.js, dass alle initialen Inhalte im DOM
      // vorhanden sind und die Reveal-Sequenz gestartet werden kann.
      document.dispatchEvent(new CustomEvent('jarvis:ui-ready'));
    },
    renderTimeline: renderTimeline,
    toggleTheme: toggleTheme,
    escapeHTML: escapeHTML,
    renderIcon: renderIcon
  };
})();
