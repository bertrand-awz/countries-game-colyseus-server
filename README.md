<div align="center">

[English](README.md) | [Français](README.fr.md)

[![Made with TypeScript][typescript-shield]][typescript-url]
[![Runs on Node.js][nodejs-shield]][nodejs-url]
[![Powered by Colyseus][colyseus-shield]][colyseus-url]
[![HTTP with Express][express-shield]][express-url]
[![Powered by Docker][docker-shield]][docker-url]

</div>

<div align="center">
  <a href="./">
    <img src="assets/img/countries-game.png" alt="Countries Game logo" width="140" height="140">
  </a>

  <h1 align="center">
    Countries Game — Game Server
  </h1>
</div>

Countries Game is a multiplayer geography game where players take turns naming countries before time
runs out. Built with TypeScript and Colyseus, this server manages rooms, answer validation, scores and
real-time game synchronization.

It also provides the geographic data used by the
[web application](https://github.com/bertrand-awz/countries-game-webapp). Answers can be validated in
French, English, German, Spanish or Japanese, depending on the game settings.

## Prerequisites

To run the server or contribute to the project, install Node.js 22 (version 22.13.0 or later in the
22.x series) with npm.

Docker is optional and lets you build and run the server using the `Dockerfile`.

Games are stored in memory, and geographic data is included in `src/data/json/`. No database is
required to start the server.

---

## Useful commands

Run the following commands from the server project's root directory.

### 1. Install dependencies

```bash
npm ci
```

### 2. Build the project

```bash
npm run build
```

This command cleans the `build/` directory, compiles the TypeScript code into it and copies the JSON
data imported by the server.

### 3. Start the server

To develop with automatic restarts when files change:

```bash
npm run dev
```

To run the compiled application in production mode:

```bash
npm run build
NODE_ENV=production npm start
```

The server listens on `http://localhost:2567` by default. Use the `PORT` environment variable to
choose a different port:

```bash
PORT=3000 npm run dev
```

To check that the server is responding, open `http://localhost:2567/api/heartbeat` in a browser.
The registered Colyseus room is named `countries_game`.

| HTTP endpoint             | Description                     |
| ------------------------- | ------------------------------- |
| `GET /api/heartbeat`      | Server health check.            |
| `GET /api/map/continents` | List of continents.             |
| `GET /api/map/countries`  | Country geometries for the map. |

To play, also start the web application with `VITE_GAME_SERVER_URL=http://localhost:2567`.

### 4. Run unit tests

```bash
npm test
```

The Mocha tests are located in `test/` and cover country name validation and game rules, among other
behaviors.

### 5. Check and apply code style

The project uses ESLint for code analysis and Prettier for formatting.

To check the code and its formatting:

```bash
npm run lint
npm run format:check
```

To apply automatic fixes and formatting:

```bash
npm run lint:fix
npm run format
```

### 6. Run with Docker

From the server project's root directory, build the image and start the container in the background:

```bash
docker build -t countries-game-server .
docker run --rm -d --name countries-game-server \
  -p 127.0.0.1:2567:2567 countries-game-server
```

The `Dockerfile` installs dependencies, builds the project and starts the server in production mode.
The server is available on the host machine at `http://localhost:2567`. Open
`http://localhost:2567/api/heartbeat` to check that it is responding.

To stop the container:

```bash
docker stop countries-game-server
```

The `--rm` option removes the container when it stops. To start it again, rerun the `docker run`
command.

### 7. Regenerate game data

The JSON files are already included in the project. To update them, run the following scripts in this
order:

```bash
npm run extract:answers
npm run extract:continents
npm run extract:public-map
npm run generate:country-scores
```

They regenerate validation data, continents, map data and scores in `src/data/json/`. Some scripts
download external data and require an Internet connection. Rebuild the server afterward to use the
updated data in production.

---

## Project structure

| Location            | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `src/index.ts`      | Server entry point.                              |
| `src/app.config.ts` | Room and HTTP route registration.                |
| `src/rooms/`        | Colyseus rooms, messages and synchronized state. |
| `src/game/`         | Game rules, turns, validation and scoring.       |
| `src/services/`     | Access to geographic and validation data.        |
| `src/data/`         | Country, continent and scoring data.             |
| `src/scripts/`      | Data extraction and generation.                  |
| `test/`             | Unit tests.                                      |

---

## Contributing

After making changes, run the tests, style checks and build using the commands above. If you change
Colyseus messages, synchronized state or HTTP routes, also check how they are used by the web
application.

Keep the English and French README files in sync when updating the documentation.

<!-- BADGES LINKS -->
<!-- Colyseus symbol: https://github.com/colyseus/colyseus/blob/master/media/logo.svg -->

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
