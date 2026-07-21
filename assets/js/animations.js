/**
 * animations.js
 * ---------------------------------------------------------------------------
 * Bündelt sämtliche Animationslogik der Anwendung:
 *  - Initiale Reveal-Sequenz (Hero Fade, Header, Filterleiste)
 *  - Gestaffeltes Einfahren der Timeline/Versionskarten beim Scrollen
 *    (IntersectionObserver, damit Karten außerhalb des Viewports nicht
 *    vorzeitig animiert werden und die Performance hoch bleibt)
 *  - Zahlenanimationen (Count-Up) für alle Kennzahlen
 *  - Animierter Fortschrittsring im Hero-Bereich
 *  - Animierte Fortschrittsbalken in den Versionskarten
 *  - Dezenter Parallax-Effekt auf den Hintergrund-Glow-Ebenen
 *  - Sanftes Scrollverhalten für Anker-Links
 *
 * Alle Animationen nutzen CSS-Transitions/Transforms bzw.
 * requestAnimationFrame und vermeiden Layout-Thrashing, um durchgehend
 * 60 FPS zu ermöglichen.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------
  // Zahlenanimation (Count-Up)
  // ---------------------------------------------------------------------

  /**
   * Animiert den Zähler eines einzelnen Elements von 0 (bzw. seinem
   * aktuellen Textinhalt) zum Zielwert im data-target-Attribut.
   * @param {Element} el
   * @param {number} duration Dauer in Millisekunden
   */
  function animateCountUp(el, duration) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;

    if (prefersReducedMotion) {
      el.textContent = String(target);
      return;
    }

    var startTime = null;
    var startValue = 0;

    function step(timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out-cubic für ein weiches Abbremsen gegen Ende der Animation.
      var eased = 1 - Math.pow(1 - progress, 3);
      var currentValue = Math.round(startValue + (target - startValue) * eased);
      el.textContent = String(currentValue);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
      }
    }

    window.requestAnimationFrame(step);
  }

  /**
   * Startet die Count-Up-Animation für alle Elemente mit [data-target]
   * innerhalb eines gegebenen Containers (oder global, falls kein
   * Container übergeben wird).
   * @param {ParentNode} [scope]
   */
  function runAllCountUps(scope) {
    var root = scope || document;
    var elements = root.querySelectorAll('[data-target]');
    elements.forEach(function (el) {
      // Fortschrittsbalken (.progress-bar__fill) und der Ring-Offset
      // werden gesondert behandelt, da sie keine reinen Textzähler sind.
      if (el.classList.contains('progress-bar__fill') || el.id === 'hero-progress-ring-fg') {
        return;
      }
      animateCountUp(el, 1400);
    });
  }

  // ---------------------------------------------------------------------
  // Fortschrittsring & Fortschrittsbalken
  // ---------------------------------------------------------------------

  /**
   * Animiert den kreisförmigen Gesamtfortschritts-Ring im Hero-Bereich
   * von einem leeren Zustand zum berechneten Zielwert.
   */
  function animateProgressRing() {
    var ringFg = document.getElementById('hero-progress-ring-fg');
    if (!ringFg) return;
    var targetOffset = ringFg.getAttribute('data-target-offset');
    if (targetOffset === null) return;

    if (prefersReducedMotion) {
      ringFg.style.strokeDashoffset = targetOffset;
      return;
    }

    // Kurzer Timeout, damit der Browser den Startzustand (voller Offset)
    // sicher gerendert hat, bevor der Übergang zum Zielwert beginnt —
    // notwendig, damit die CSS-Transition tatsächlich sichtbar greift.
    window.setTimeout(function () {
      ringFg.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1)';
      ringFg.style.strokeDashoffset = targetOffset;
    }, 300);
  }

  /**
   * Animiert alle Fortschrittsbalken innerhalb eines Containers (oder
   * global) von 0% auf ihren jeweiligen Zielwert.
   * @param {ParentNode} [scope]
   */
  function animateProgressBars(scope) {
    var root = scope || document;
    var bars = root.querySelectorAll('.progress-bar__fill[data-target]');
    bars.forEach(function (bar) {
      var target = bar.getAttribute('data-target');
      if (prefersReducedMotion) {
        bar.style.width = target + '%';
        return;
      }
      // Startbreite 0, danach im nächsten Frame auf Zielbreite animieren.
      bar.style.width = '0%';
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          bar.style.width = target + '%';
        });
      });
    });
  }

  // ---------------------------------------------------------------------
  // Scroll-Reveal für Versionskarten (IntersectionObserver)
  // ---------------------------------------------------------------------

  var cardObserver = null;

  /**
   * Initialisiert (bzw. reinitialisiert nach jedem Timeline-Re-Render)
   * einen IntersectionObserver, der Versionskarten erst dann einfahren
   * lässt, wenn sie in den sichtbaren Bereich scrollen. Das spart
   * Rechenleistung bei langen Listen und sorgt für einen ansprechenden
   * "Karten sliden ein"-Effekt beim Scrollen.
   */
  function observeVersionCards() {
    if (cardObserver) {
      cardObserver.disconnect();
    }

    var cards = document.querySelectorAll('.version-card:not(.is-revealed)');
    if (cards.length === 0) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      cards.forEach(function (card) {
        card.classList.add('is-revealed');
      });
      cards.forEach(function (card) {
        animateProgressBars(card);
      });
      return;
    }

    cardObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          animateProgressBars(entry.target);
          cardObserver.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.15
    });

    cards.forEach(function (card) {
      cardObserver.observe(card);
    });
  }

  // ---------------------------------------------------------------------
  // Initiale Reveal-Sequenz (Hero, Header, Filterleiste)
  // ---------------------------------------------------------------------

  /**
   * Fügt die "is-visible"-Klasse zu den obersten strukturellen Bereichen
   * hinzu, die per CSS-Transition (Opacity + Transform) auf diese Klasse
   * reagieren. Die Verzögerungen zwischen den Abschnitten sind über
   * CSS-Custom-Properties (--reveal-delay) in main.css/animations.css
   * gesteuert, um die Werte an einer Stelle zu pflegen.
   */
  function runInitialReveal() {
    var header = document.querySelector('.app-header');
    var hero = document.querySelector('.hero');
    var filterBar = document.querySelector('.filter-section');
    var timelineHeader = document.querySelector('.timeline-header');

    [header, hero, filterBar, timelineHeader].forEach(function (el) {
      if (el) el.classList.add('is-visible');
    });
  }

  // ---------------------------------------------------------------------
  // Parallax-Effekt für Hintergrund-Glow-Ebenen
  // ---------------------------------------------------------------------

  var parallaxLayers = [];
  var ticking = false;
  var lastScrollY = 0;

  /**
   * Registriert die Hintergrund-Glow-Ebenen für einen dezenten
   * Parallax-Effekt beim Scrollen. Nutzt requestAnimationFrame-Throttling,
   * um die Scroll-Performance nicht zu beeinträchtigen.
   */
  function setupParallax() {
    parallaxLayers = Array.prototype.slice.call(document.querySelectorAll('.bg-glow'));
    if (parallaxLayers.length === 0 || prefersReducedMotion) return;

    window.addEventListener('scroll', function () {
      lastScrollY = window.scrollY;
      requestParallaxTick();
    }, { passive: true });
  }

  function requestParallaxTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  function updateParallax() {
    parallaxLayers.forEach(function (layer, index) {
      // Unterschiedliche Geschwindigkeitsfaktoren je Ebene erzeugen die
      // Tiefenwirkung des Parallax-Effekts.
      var speed = 0.04 + index * 0.03;
      var offset = lastScrollY * speed;
      layer.style.transform = 'translate3d(0, ' + offset.toFixed(1) + 'px, 0)';
    });
    ticking = false;
  }

  // ---------------------------------------------------------------------
  // Smooth Scrolling für Anker-Links
  // ---------------------------------------------------------------------

  function setupSmoothScrollLinks() {
    document.addEventListener('click', function (evt) {
      var link = evt.target.closest('a[href^="#"]');
      if (!link) return;
      var targetId = link.getAttribute('href').slice(1);
      if (!targetId) return;
      var targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      evt.preventDefault();
      targetEl.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }

  // ---------------------------------------------------------------------
  // Re-Bind nach Timeline-Re-Rendering
  // ---------------------------------------------------------------------

  /**
   * Wird jedes Mal aufgerufen, wenn ui.js die Timeline neu gerendert hat
   * (z. B. durch einen Filterwechsel), damit neu erzeugte Karten erneut
   * an den IntersectionObserver angehängt werden.
   */
  function rebindAfterRender() {
    observeVersionCards();
  }

  // ---------------------------------------------------------------------
  // Initialisierung
  // ---------------------------------------------------------------------

  function init() {
    // Wartet auf das "jarvis:ui-ready"-Event aus ui.js, um sicherzustellen,
    // dass das komplette initiale Markup im DOM vorhanden ist, bevor
    // irgendeine Animation gestartet wird.
    document.addEventListener('jarvis:ui-ready', function () {
      runInitialReveal();
      runAllCountUps();
      animateProgressRing();
      observeVersionCards();
      setupParallax();
      setupSmoothScrollLinks();
    });

    // Überwacht Änderungen an der Timeline (Filterwechsel), um die
    // Scroll-Reveal-Beobachtung auf neu erzeugte Karten anzuwenden.
    var track = document.getElementById('timeline-track');
    if (track && 'MutationObserver' in window) {
      var mutationObserver = new MutationObserver(function () {
        rebindAfterRender();
      });
      mutationObserver.observe(track, { childList: true });
    }
  }

  window.JarvisAnimations = {
    init: init
  };
})();
