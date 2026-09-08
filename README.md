<div align="center">

[![Made with TypeScript][typescript-shield]][typescript-url]
[![Runs on Node.js][nodejs-shield]][nodejs-url]
[![Powered by Colyseus][colyseus-shield]][colyseus-url]
[![HTTP with Express][express-shield]][express-url]
[![Powered by Docker][docker-shield]][docker-url]

</div>

<div align="center">
  <a href="./">
    <img src="assets/img/countries-game.png" alt="Logo Countries Game" width="140" height="140">
  </a>

  <h1 align="center">
    Countries Game — Serveur de jeu
  </h1>
</div>

Countries Game est un jeu de géographie multijoueur dans lequel les joueurs nomment des pays à tour de
rôle avant la fin du temps imparti. Ce serveur, développé en TypeScript avec Colyseus, gère les salles,
la validation des réponses, les scores et la synchronisation des parties en temps réel.

Il fournit également les données géographiques utilisées par
[l'application web](https://github.com/bertrand-awz/countries-game-webapp). Les réponses peuvent être
validées en français, en anglais, en allemand, en espagnol ou en japonais, selon les paramètres de la
partie.

## Prérequis

Pour exécuter le serveur ou contribuer au projet, installez Node.js 22, version 22.13.0 ou ultérieure
dans cette branche, avec npm.

Docker est optionnel et permet de construire et démarrer le serveur à partir du `Dockerfile`.

Les parties sont conservées en mémoire et les données géographiques sont fournies dans
`src/data/json/`. Aucune base de données n'est nécessaire au démarrage.

---

## Commandes à connaître

Les commandes suivantes s'exécutent à la racine du projet serveur.

### 1. Installer les dépendances

```bash
npm ci
```

### 2. Compiler le projet

```bash
npm run build
```

Cette commande nettoie le dossier `build/`, puis y compile le code TypeScript et y copie les données
JSON importées par le serveur.

### 3. Démarrer le serveur

Pour développer avec un redémarrage automatique lors des modifications :

```bash
npm run dev
```

Pour exécuter la version compilée en mode production :

```bash
npm run build
NODE_ENV=production npm start
```

Le serveur écoute par défaut sur `http://localhost:2567`. La variable d'environnement `PORT` permet
de choisir un autre port :

```bash
PORT=3000 npm run dev
```

Pour vérifier que le serveur répond, ouvrez `http://localhost:2567/api/heartbeat` dans un navigateur.
La salle Colyseus enregistrée porte le nom `countries_game`.

| Route HTTP                | Description                        |
| ------------------------- | ---------------------------------- |
| `GET /api/heartbeat`      | Vérification du fonctionnement.    |
| `GET /api/map/continents` | Liste des continents.              |
| `GET /api/map/countries`  | Géométries des pays pour la carte. |

Pour jouer, démarrez également l'application web avec
`VITE_GAME_SERVER_URL=http://localhost:2567`.

### 4. Lancer les tests unitaires

```bash
npm test
```

Les tests Mocha se trouvent dans `test/` et couvrent notamment la validation des noms de pays et les
règles du jeu.

### 5. Vérifier et appliquer le style

Le projet utilise ESLint pour l'analyse du code et Prettier pour le formatage.

Pour vérifier le code et son formatage :

```bash
npm run lint
npm run format:check
```

Pour appliquer les corrections automatiques et le formatage :

```bash
npm run lint:fix
npm run format
```

### 6. Démarrer avec Docker

Depuis la racine du projet serveur, construisez l'image et démarrez le conteneur en arrière-plan :

```bash
docker build -t countries-game-server .
docker run --rm -d --name countries-game-server \
  -p 127.0.0.1:2567:2567 countries-game-server
```

Le `Dockerfile` installe les dépendances, compile le projet et démarre le serveur en mode production.
Le serveur est accessible sur la machine hôte à l'adresse `http://localhost:2567`. Ouvrez
`http://localhost:2567/api/heartbeat` pour vérifier qu'il répond.

Pour arrêter le conteneur :

```bash
docker stop countries-game-server
```

L'option `--rm` supprime le conteneur à son arrêt. Pour le relancer, réexécutez la commande `docker run`.

### 7. Régénérer les données du jeu

Les fichiers JSON sont déjà inclus dans le projet. Pour les mettre à jour, exécutez les scripts
suivants dans cet ordre :

```bash
npm run extract:answers
npm run extract:continents
npm run extract:public-map
npm run generate:country-scores
```

Ils reconstruisent les données de validation, les continents, la carte et les scores dans
`src/data/json/`. Certains scripts téléchargent des données externes et nécessitent une connexion
Internet. Recompilez ensuite le serveur pour utiliser les nouvelles données en production.

---

## Structure du projet

| Emplacement         | Rôle                                              |
| ------------------- | ------------------------------------------------- |
| `src/index.ts`      | Point d'entrée du serveur.                        |
| `src/app.config.ts` | Enregistrement de la salle et des routes HTTP.    |
| `src/rooms/`        | Salles Colyseus, messages et états synchronisés.  |
| `src/game/`         | Règles du jeu, tours, validation et scores.       |
| `src/services/`     | Accès aux données géographiques et de validation. |
| `src/data/`         | Données des pays, des continents et des scores.   |
| `src/scripts/`      | Extraction et génération des données.             |
| `test/`             | Tests unitaires.                                  |

---

## Comment contribuer au projet

Après vos modifications, lancez les tests, les vérifications de style et la compilation avec les
commandes ci-dessus. Si vous modifiez les messages Colyseus, les états synchronisés ou les routes HTTP,
vérifiez également leur utilisation dans l'application web.

<!-- BADGES LINKS -->
<!-- Symbole Colyseus : https://github.com/colyseus/colyseus/blob/master/media/logo.svg -->

[typescript-shield]: https://img.shields.io/badge/Made%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=3178C6
[typescript-url]: https://www.typescriptlang.org/
[nodejs-shield]: https://img.shields.io/badge/Runs%20on-Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=5FA04E
[nodejs-url]: https://nodejs.org/
[colyseus-shield]: assets/img/colyseus-badge.svg
[colyseus-url]: https://colyseus.io/
[express-shield]: https://img.shields.io/badge/HTTP%20with-Express-000000?style=for-the-badge&logo=express&logoColor=white
[express-url]: https://expressjs.com/
[docker-shield]: https://img.shields.io/badge/Powered%20by-Docker-blue?style=for-the-badge&logo=docker
[docker-url]: https://www.docker.com/
