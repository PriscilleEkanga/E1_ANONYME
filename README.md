
## Pages

- `index.html` : accueil, section Projets (API 1) et section Formations (API 2), avec recherche en temps réel, filtres combinables et modals de détail
- `inscription.html` : formulaire d'inscription avec validation en temps réel


## API utilisées

- Projets : `https://webcraft-api.vercel.app/data/projects.json`
- Formations : `https://webcraft-api.vercel.app/data/courses.json`

Les deux API sont chargées avec `fetch()` et `async/await`, avec gestion d'erreur (`try / catch`), un loader CSS pendant le chargement et un message d'erreur si une API est inaccessible.

## Utilisation de l'intelligence artificielle

J'ai utilisé un outil d'IA comme aide pour la partie **animations en JavaScript** du fichier `js/main.js` :

- l'apparition des éléments au scroll (`observeReveal`, avec `IntersectionObserver`)
- la pluie de confettis après une inscription réussie (`launchConfetti`)
- l'effet de secousse sur le premier champ invalide du formulaire (classe `shake`)

J'ai relu, compris et adapté ce code à mon projet. Le reste du travail (structure HTML, mise en page, chargement des API, filtres, modals et validation du formulaire) a été réalisé par mes soins.
