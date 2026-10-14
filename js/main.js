/* ==========================================================================
   WebCraft Solutions — script unique (index.html + inscription.html)
   jQuery pour le DOM / les événements, Bootstrap pour les modals,
   fetch() + async/await pour les appels aux API.
   ========================================================================== */

'use strict';

/* ---------- 1. Configuration ---------- */
const API = {
  projects: 'https://webcraft-api.vercel.app/data/projects.json',
  courses: 'https://webcraft-api.vercel.app/data/courses.json'
};

const DEBOUNCE_DELAY = 300; // ms

// Image de remplacement si une image distante ne se charge pas
const PLACEHOLDER_IMG = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
  '<rect width="100%" height="100%" fill="#e2e8f0"/>' +
  '<text x="50%" y="50%" fill="#64748b" font-family="sans-serif" font-size="32" ' +
  'text-anchor="middle" dominant-baseline="middle">WebCraft Solutions</text></svg>'
);

/* ---------- 2. Utilitaires ---------- */

/**
 * Cache mémoire des réponses API : chaque URL n'est demandée qu'une seule fois
 * (pas de requêtes redondantes). On stocke la promesse pour mutualiser
 * aussi les appels simultanés.
 */
const apiCache = new Map();

/**
 * Récupère un JSON avec fetch() et lève une erreur explicite si la réponse est KO.
 * @param {string} url
 * @returns {Promise<object>}
 */
const fetchJSON = async (url) => {
  if (apiCache.has(url)) return apiCache.get(url);

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }
    return response.json();
  })();

  apiCache.set(url, request);
  // En cas d'échec, on retire la promesse du cache pour permettre un nouvel essai
  request.catch(() => apiCache.delete(url));
  return request;
};

/** Retarde l'exécution d'une fonction tant que l'utilisateur tape. */
const debounce = (fn, delay = DEBOUNCE_DELAY) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/** Échappe les caractères HTML des données externes (protection XSS). */
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

/** Normalise une chaîne pour la recherche : minuscules, sans accents. */
const normalize = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

/** Transforme "Intermédiaire" en "intermediaire" (classe CSS). */
const slug = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-');

const formatPrice = (price) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
}).format(price);

const formatNumber = (n) => new Intl.NumberFormat('fr-FR').format(n);

/** Remplit un <select> avec une liste de valeurs (en conservant la 1re option). */
const fillSelect = ($select, values) => {
  const options = [...values]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`)
    .join('');
  $select.append(options);
};

/** Génère la liste des badges technologies. */
const techBadges = (technologies = []) => `
  <ul class="tech-list" aria-label="Technologies">
    ${technologies.map((tech) => `<li><span class="badge badge-tech">${escapeHTML(tech)}</span></li>`).join('')}
  </ul>`;

/** Affiche / masque le loader d'une section. */
const toggleLoader = ($loader, visible) => {
  $loader.toggleClass('is-hidden', !visible).attr('aria-busy', visible);
};

/** Affiche un message d'erreur API avec un bouton "Réessayer". */
const showApiError = ($container, label, onRetry) => {
  $container
    .html(`
      <p class="mb-2"><strong>Impossible de charger ${label}.</strong>
      Le service est peut-être momentanément indisponible ou votre connexion est interrompue.</p>
      <button type="button" class="btn btn-sm btn-outline-danger">Réessayer</button>`)
    .removeClass('d-none');
  $container.find('button').one('click', () => {
    $container.addClass('d-none').empty();
    onRetry();
  });
};

/** Remplace une image cassée par l'image de remplacement. */
const handleBrokenImages = ($scope) => {
  $scope.find('img').on('error', function onImgError() {
    $(this).off('error').attr('src', PLACEHOLDER_IMG);
  });
};

/* ==========================================================================
   3. PAGE D'ACCUEIL — Projets (API 1) et Formations (API 2)
   ========================================================================== */

const state = {
  projects: [],
  courses: []
};

/* ---------- 3.1 Projets ---------- */

const renderProjectCard = (project) => `
  <div class="col-12 col-md-6 col-lg-4">
    <article class="card wc-card" aria-labelledby="projet-${project.id}-titre">
      <div class="wc-card-img-wrapper">
        <img class="wc-card-img" src="${escapeHTML(project.image)}" alt="Aperçu du projet ${escapeHTML(project.title)}" loading="lazy">
        <span class="badge badge-category badge-overlay">${escapeHTML(project.category)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title" id="projet-${project.id}-titre">${escapeHTML(project.title)}</h3>
        <p class="card-client">Client : <strong>${escapeHTML(project.client)}</strong></p>
        <p class="card-meta"><span>Catégorie : ${escapeHTML(project.category)}</span><span>${escapeHTML(project.year)}</span></p>
        ${techBadges(project.technologies)}
        <div class="card-actions">
          <button type="button" class="btn btn-primary js-project-details" data-id="${project.id}"
                  aria-label="Voir les détails du projet ${escapeHTML(project.title)}">Voir détails</button>
        </div>
      </div>
    </article>
  </div>`;

/** Filtre combiné : recherche texte + technologie + catégorie. */
const filterProjects = () => {
  const query = normalize($('#projets-recherche').val().trim());
  const tech = $('#projets-techno').val();
  const category = $('#projets-categorie').val();

  return state.projects.filter((p) => {
    const haystack = normalize([p.title, p.client, p.description, p.category, ...p.technologies].join(' '));
    return (!query || haystack.includes(query))
      && (!tech || p.technologies.includes(tech))
      && (!category || p.category === category);
  });
};

const renderProjects = () => {
  const results = filterProjects();
  const $grid = $('#projets-grille');

  $grid.html(results.length
    ? results.map(renderProjectCard).join('')
    : '<div class="col-12"><p class="empty-state">Aucun projet ne correspond à vos critères.</p></div>');

  handleBrokenImages($grid);
  $('#projets-compteur').text(`${results.length} projet${results.length > 1 ? 's' : ''} sur ${state.projects.length}`);
};

const openProjectModal = (id) => {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;

  $('#modal-projet-titre').text(project.title);
  const $body = $('#modal-projet-contenu').html(`
    <img class="modal-img" src="${escapeHTML(project.image)}" alt="Aperçu du projet ${escapeHTML(project.title)}">
    <p>${escapeHTML(project.description)}</p>
    <dl class="detail-list">
      <div><dt>Client</dt><dd>${escapeHTML(project.client)}</dd></div>
      <div><dt>Catégorie</dt><dd>${escapeHTML(project.category)}</dd></div>
      <div><dt>Année</dt><dd>${escapeHTML(project.year)}</dd></div>
      <div><dt>Durée</dt><dd>${escapeHTML(project.duration)}</dd></div>
    </dl>
    <h3 class="h6">Technologies</h3>
    ${techBadges(project.technologies)}
    <h3 class="h6 mt-3">Fonctionnalités</h3>
    <ul class="check-list">
      ${(project.features ?? []).map((f) => `<li>${escapeHTML(f)}</li>`).join('')}
    </ul>
    <a class="btn btn-primary" href="${escapeHTML(project.url)}" target="_blank" rel="noopener">
      Visiter le site <span class="visually-hidden">(nouvel onglet)</span>
    </a>`);

  handleBrokenImages($body);
  bootstrap.Modal.getOrCreateInstance('#modal-projet').show();
};

const loadProjects = async () => {
  const $loader = $('#projets-loader');
  toggleLoader($loader, true);

  try {
    const data = await fetchJSON(API.projects);
    state.projects = data.projects ?? [];

    // Filtres alimentés par les listes renvoyées par l'API
    fillSelect($('#projets-techno'), data.technologies ?? []);
    fillSelect($('#projets-categorie'), data.categories ?? []);
    $('#projets-filtres').find('input, select').prop('disabled', false);

    renderProjects();
  } catch (error) {
    console.error('API projets :', error);
    $('#projets-compteur').text('');
    showApiError($('#projets-erreur'), 'les projets', loadProjects);
  } finally {
    toggleLoader($loader, false);
  }
};

/* ---------- 3.2 Formations ---------- */

const renderCourseCard = (course) => `
  <div class="col-12 col-md-6 col-lg-4">
    <article class="card wc-card" aria-labelledby="formation-${course.id}-titre">
      <div class="wc-card-img-wrapper">
        <img class="wc-card-img" src="${escapeHTML(course.image)}" alt="Illustration de la formation ${escapeHTML(course.title)}" loading="lazy">
        <span class="badge badge-category badge-overlay">${escapeHTML(course.category)}</span>
        <span class="badge badge-status ${course.available ? 'badge-available' : 'badge-full'}">
          ${course.available ? 'Disponible' : 'Complet'}
        </span>
      </div>
      <div class="card-body">
        <h3 class="card-title" id="formation-${course.id}-titre">${escapeHTML(course.title)}</h3>
        <p class="card-meta">
          <span class="badge badge-level level-${slug(course.level)}">${escapeHTML(course.level)}</span>
          <span>Durée : ${escapeHTML(course.duration)}</span>
          <span>${escapeHTML(course.category)}</span>
        </p>
        <p class="card-meta">
          <span class="rating"><span aria-hidden="true">&#9733;</span> ${escapeHTML(course.rating)}<span class="visually-hidden"> sur 5</span></span>
          <span>${formatNumber(course.students)} étudiants</span>
        </p>
        ${techBadges(course.technologies)}
        <p class="card-price mb-0">${formatPrice(course.price)}</p>
        <div class="card-actions">
          <button type="button" class="btn btn-outline-primary js-course-details" data-id="${course.id}"
                  aria-label="Voir les détails de la formation ${escapeHTML(course.title)}">Voir détails</button>
          ${course.available
            ? `<a class="btn btn-primary" href="inscription.html?formation=${course.id}"
                  aria-label="S'inscrire à la formation ${escapeHTML(course.title)}">S'inscrire</a>`
            : '<button type="button" class="btn btn-secondary" disabled>Complet</button>'}
        </div>
      </div>
    </article>
  </div>`;

/** Filtre combiné : recherche + catégorie + niveau + technologie. */
const filterCourses = () => {
  const query = normalize($('#formations-recherche').val().trim());
  const category = $('#formations-categorie').val();
  const level = $('#formations-niveau').val();
  const tech = $('#formations-techno').val();

  return state.courses.filter((c) => {
    const haystack = normalize([c.title, c.description, c.instructor, c.category, ...c.technologies].join(' '));
    return (!query || haystack.includes(query))
      && (!category || c.category === category)
      && (!level || c.level === level)
      && (!tech || c.technologies.includes(tech));
  });
};

const renderCourses = () => {
  const results = filterCourses();
  const $grid = $('#formations-grille');

  $grid.html(results.length
    ? results.map(renderCourseCard).join('')
    : '<div class="col-12"><p class="empty-state">Aucune formation ne correspond à vos critères.</p></div>');

  handleBrokenImages($grid);
  $('#formations-compteur').text(`${results.length} formation${results.length > 1 ? 's' : ''} sur ${state.courses.length}`);
};

const openCourseModal = (id) => {
  const course = state.courses.find((c) => c.id === id);
  if (!course) return;

  const initials = course.instructor.split(' ').map((part) => part[0]).join('').slice(0, 2);

  $('#modal-formation-titre').text(course.title);
  const $body = $('#modal-formation-contenu').html(`
    <img class="modal-img" src="${escapeHTML(course.image)}" alt="Illustration de la formation ${escapeHTML(course.title)}">
    <p>${escapeHTML(course.description)}</p>
    <dl class="detail-list">
      <div><dt>Catégorie</dt><dd>${escapeHTML(course.category)}</dd></div>
      <div><dt>Niveau</dt><dd><span class="badge badge-level level-${slug(course.level)}">${escapeHTML(course.level)}</span></dd></div>
      <div><dt>Durée</dt><dd>${escapeHTML(course.duration)}</dd></div>
      <div><dt>Prix</dt><dd>${formatPrice(course.price)}</dd></div>
      <div><dt>Note</dt><dd class="rating">&#9733; ${escapeHTML(course.rating)} / 5</dd></div>
      <div><dt>Étudiants</dt><dd>${formatNumber(course.students)}</dd></div>
      <div><dt>Disponibilité</dt><dd>
        <span class="badge ${course.available ? 'badge-available' : 'badge-full'}">${course.available ? 'Disponible' : 'Complet'}</span>
      </dd></div>
    </dl>
    <h3 class="h6">Technologies</h3>
    ${techBadges(course.technologies)}
    <h3 class="h6 mt-3">Programme</h3>
    <ol class="modules-list">
      ${(course.modules ?? []).map((m) => `<li>${escapeHTML(m)}</li>`).join('')}
    </ol>
    <h3 class="h6 mt-3">Formateur</h3>
    <div class="instructor">
      <span class="instructor-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
      <span><strong>${escapeHTML(course.instructor)}</strong><br><small class="text-muted">Formateur expert ${escapeHTML(course.category)}</small></span>
    </div>`);

  handleBrokenImages($body);

  // Bouton "S'inscrire maintenant" : lien pré-rempli ou désactivé si complet
  const $cta = $('#modal-formation-inscription');
  if (course.available) {
    $cta.attr('href', `inscription.html?formation=${course.id}`)
      .removeClass('disabled').removeAttr('aria-disabled tabindex').text("S'inscrire maintenant");
  } else {
    $cta.attr({ href: '#', 'aria-disabled': 'true', tabindex: '-1' })
      .addClass('disabled').text('Formation complète');
  }

  bootstrap.Modal.getOrCreateInstance('#modal-formation').show();
};

const loadCourses = async () => {
  const $loader = $('#formations-loader');
  toggleLoader($loader, true);

  try {
    const data = await fetchJSON(API.courses);
    state.courses = data.courses ?? [];

    fillSelect($('#formations-categorie'), data.categories ?? []);
    // Les niveaux gardent l'ordre logique de l'API (pas de tri alphabétique)
    $('#formations-niveau').append((data.levels ?? [])
      .map((lvl) => `<option value="${escapeHTML(lvl)}">${escapeHTML(lvl)}</option>`).join(''));
    fillSelect($('#formations-techno'), data.technologies ?? []);
    $('#formations-filtres').find('input, select').prop('disabled', false);

    renderCourses();
  } catch (error) {
    console.error('API formations :', error);
    $('#formations-compteur').text('');
    showApiError($('#formations-erreur'), 'les formations', loadCourses);
  } finally {
    toggleLoader($loader, false);
  }
};

/* ---------- 3.3 Initialisation de la page d'accueil ---------- */

const initHomePage = () => {
  // Filtres désactivés tant que les données ne sont pas chargées
  $('#projets-filtres, #formations-filtres').find('input, select').prop('disabled', true);

  // Les deux API sont chargées en parallèle ; l'échec de l'une n'empêche pas l'autre
  Promise.allSettled([loadProjects(), loadCourses()]);

  // Recherche temps réel avec debounce ; filtres <select> immédiats
  $('#projets-recherche').on('input', debounce(renderProjects));
  $('#projets-techno, #projets-categorie').on('change', renderProjects);

  $('#formations-recherche').on('input', debounce(renderCourses));
  $('#formations-categorie, #formations-niveau, #formations-techno').on('change', renderCourses);

  // Les formulaires de filtres ne doivent pas recharger la page (touche Entrée)
  $('#projets-filtres, #formations-filtres').on('submit', (e) => e.preventDefault());

  // Réinitialisation des filtres
  $('.btn-reset').on('click', function onReset() {
    const section = $(this).data('reset');
    $(`#${section}-filtres`)[0].reset();
    section === 'projets' ? renderProjects() : renderCourses();
  });

  // Ouverture des modals (délégation d'événements : cartes générées dynamiquement)
  $('#projets-grille').on('click', '.js-project-details', function onProjectClick() {
    openProjectModal(Number($(this).data('id')));
  });
  $('#formations-grille').on('click', '.js-course-details', function onCourseClick() {
    openCourseModal(Number($(this).data('id')));
  });

  // Lien du modal désactivé : on bloque la navigation
  $('#modal-formation-inscription').on('click', function onCtaClick(e) {
    if ($(this).hasClass('disabled')) e.preventDefault();
  });

  // Fermeture du menu mobile après un clic sur un lien
  $('#menu-principal .nav-link').on('click', () => {
    const menu = bootstrap.Collapse.getInstance('#menu-principal');
    if (menu) menu.hide();
  });

  // Lien actif du menu selon la section visible
  const $navLinks = $('#menu-principal .nav-link[href^="#"]');
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      $navLinks.removeClass('active').removeAttr('aria-current');
      $navLinks.filter(`[href="#${entry.target.id}"]`).addClass('active').attr('aria-current', 'page');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $('#accueil, #projets, #formations').each((_, section) => observer.observe(section));
};

/* ==========================================================================
   4. PAGE D'INSCRIPTION — formulaire et validation
   ========================================================================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Format international : "+" puis indicatif (1 à 3 chiffres) et numéro, 8 à 15 chiffres au total (norme E.164)
const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const MOTIVATION_MIN = 50;

/**
 * Règles de validation : chaque fonction renvoie un message d'erreur,
 * ou une chaîne vide si le champ est valide.
 */
const validators = {
  prenom: (value) => {
    if (!value.trim()) return 'Veuillez saisir votre prénom.';
    if (value.trim().length < 2) return 'Le prénom doit contenir au moins 2 caractères.';
    return '';
  },
  nom: (value) => {
    if (!value.trim()) return 'Veuillez saisir votre nom.';
    if (value.trim().length < 2) return 'Le nom doit contenir au moins 2 caractères.';
    return '';
  },
  email: (value) => {
    if (!value.trim()) return 'Veuillez saisir votre adresse email.';
    if (!EMAIL_REGEX.test(value.trim())) return 'Adresse email invalide (exemple : nom@domaine.com).';
    return '';
  },
  telephone: (value) => {
    if (!value.trim()) return 'Veuillez saisir votre numéro de téléphone.';
    // On tolère espaces, points, tirets et parenthèses pour la saisie
    const cleaned = value.replace(/[\s.\-()]/g, '');
    if (!cleaned.startsWith('+')) return "Le numéro doit commencer par l'indicatif international (ex : +33).";
    if (!PHONE_REGEX.test(cleaned)) return 'Numéro invalide : indicatif + 8 à 15 chiffres (ex : +33 6 12 34 56 78).';
    return '';
  },
  formation: (value) => (value ? '' : 'Veuillez choisir une formation.'),
  niveau: (value) => (value ? '' : 'Veuillez indiquer votre niveau.'),
  motivation: (value) => {
    const length = value.trim().length;
    if (!length) return 'Veuillez expliquer votre motivation.';
    if (length < MOTIVATION_MIN) return `Encore ${MOTIVATION_MIN - length} caractère(s) : ${MOTIVATION_MIN} minimum requis.`;
    return '';
  },
  // Champ optionnel : validé seulement s'il est rempli
  experience: (value) => {
    if (value === '') return '';
    const years = Number(value);
    if (!Number.isInteger(years) || years < 0 || years > 50) return "L'expérience doit être un nombre entier entre 0 et 50.";
    return '';
  }
};

/**
 * Valide un champ, met à jour son état visuel et son message d'erreur.
 * @returns {boolean} true si le champ est valide
 */
const validateField = ($field) => {
  const name = $field.attr('name');
  const validator = validators[name];
  if (!validator) return true;

  const value = String($field.val() ?? '');
  const message = validator(value);
  const isOptionalEmpty = name === 'experience' && value === '';

  $field
    .toggleClass('is-invalid', Boolean(message))
    .toggleClass('is-valid', !message && !isOptionalEmpty)
    .attr('aria-invalid', Boolean(message));
  $(`#${name}-erreur`).text(message);

  return !message;
};

/** Met à jour le compteur de caractères de la motivation. */
const updateMotivationCounter = () => {
  const length = $('#motivation').val().trim().length;
  $('#motivation-compteur')
    .text(`${length} / ${MOTIVATION_MIN} caractères minimum`)
    .toggleClass('is-ok', length >= MOTIVATION_MIN);
};

/** Remplit le <select> des formations depuis l'API 2. */
const loadCourseOptions = async () => {
  const $select = $('#formation');
  const $loader = $('#formation-loader');
  toggleLoader($loader, true);

  try {
    const data = await fetchJSON(API.courses);
    const courses = data.courses ?? [];

    const options = courses.map((c) => `
      <option value="${c.id}" ${c.available ? '' : 'disabled'}>
        ${escapeHTML(c.title)} — ${escapeHTML(c.level)}${c.available ? '' : ' (complet)'}
      </option>`).join('');
    $select.html(`<option value="">Choisissez une formation</option>${options}`).prop('disabled', false);

    // Pré-sélection si on arrive depuis une carte "S'inscrire" (?formation=id)
    const preselected = new URLSearchParams(window.location.search).get('formation');
    const course = courses.find((c) => String(c.id) === preselected && c.available);
    if (course) {
      $select.val(String(course.id));
      $('#niveau').val(course.level);
    }
  } catch (error) {
    console.error('API formations :', error);
    $select.html('<option value="">Formations indisponibles</option>');
    $('#formation-erreur')
      .html('Impossible de charger la liste des formations. <button type="button" class="btn btn-link btn-sm p-0 align-baseline">Réessayer</button>')
      .show()
      .find('button').one('click', () => {
        $('#formation-erreur').hide().empty();
        loadCourseOptions();
      });
  } finally {
    toggleLoader($loader, false);
  }
};

const initRegistrationPage = () => {
  const $form = $('#form-inscription');
  const $fields = $form.find('input, select, textarea').filter((_, el) => validators[el.name]);

  loadCourseOptions();

  // Validation en temps réel : à la saisie (debounce) et à la sortie du champ
  $fields.each((_, el) => {
    const $field = $(el);
    const validateLater = debounce(() => validateField($field), 250);
    $field.on('input', () => {
      // On n'affiche l'erreur pendant la frappe qu'une fois le champ "touché"
      if ($field.data('touched')) validateLater();
    });
    $field.on('blur change', () => {
      $field.data('touched', true);
      validateField($field);
    });
  });

  $('#motivation').on('input', updateMotivationCounter);

  // Validation globale avant soumission
  $form.on('submit', (e) => {
    e.preventDefault();

    const invalidFields = $fields.toArray()
      .map((el) => $(el))
      .filter(($field) => {
        $field.data('touched', true);
        return !validateField($field);
      });

    if (invalidFields.length) {
      const $first = invalidFields[0];
      $first.trigger('focus').removeClass('shake');
      // Relance de l'animation de secousse
      void $first[0].offsetWidth;
      $first.addClass('shake');
      return;
    }

    // Succès : message dans un modal puis réinitialisation
    const formData = Object.fromEntries(new FormData($form[0]));
    const courseTitle = $('#formation option:selected').text().split('—')[0].trim();
    $('#modal-succes-message').text(
      `Merci ${formData.prenom.trim()} ! Votre demande d'inscription à « ${courseTitle} » a bien été enregistrée. `
      + `Une confirmation sera envoyée à ${formData.email.trim()}.`
    );
    bootstrap.Modal.getOrCreateInstance('#modal-succes').show();

    $form[0].reset();
  });

  // Réinitialisation : on retire aussi les états visuels
  $form.on('reset', () => {
    setTimeout(() => {
      $fields.removeClass('is-valid is-invalid shake').removeAttr('aria-invalid').removeData('touched');
      $form.find('.invalid-feedback').not('#formation-erreur:has(button)').text('');
      updateMotivationCounter();
    }, 0);
  });
};

/* ==========================================================================
   5. Démarrage : on détecte la page courante
   ========================================================================== */
$(() => {
  $('.current-year').text(new Date().getFullYear());

  if ($('#projets-grille').length) initHomePage();
  if ($('#form-inscription').length) initRegistrationPage();
});
