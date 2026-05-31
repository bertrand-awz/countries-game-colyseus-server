import {
    defineServer,
    defineRoom,
    monitor,
    playground,
    createRouter,
    createEndpoint,
} from "colyseus";

import { CountriesGameRoom } from "#rooms/CountriesGameRoom.js";
import { buildContinentsTranslations, continentsDetails } from "#data/continents.js";
import { countriesMapService } from "#services/CountriesMapService.js";

const publicContinents = continentsDetails.map((continent) => ({
    id: continent.code,
    countriesNumber: continent.numberOfCountries,
}));

const server = defineServer({
    rooms: {
        countries_game: defineRoom(CountriesGameRoom),
    },

    routes: createRouter({
        api_heartbeat: createEndpoint("/api/heartbeat", { method: "GET" }, async (_ctx) => {
            return {
                message: "Yes, your heart is beating. You're not dead yet. You're still alive :)",
            };
        }),

        game_details: createEndpoint("/api/details", { method: "GET" }, async () => {
            return {
                continents: continentsDetails,
                translations: buildContinentsTranslations(),
            };
        }),

        continents: createEndpoint("/api/continents", { method: "GET" }, async () => {
            return publicContinents;
        }),
    }),

    express: (app) => {
        app.get("/api/countries", async (_req, res, next) => {
            try {
                console.time("GET /api/countries");

                const features = countriesMapService.getCountriesMapFeatures();

                const body = JSON.stringify(features);

                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.setHeader("Content-Length", Buffer.byteLength(body));
                res.status(200).end(body);

                console.timeEnd("GET /api/countries");
            } catch (error) {
                next(error);
            }
        });

        app.get("/api/map", async (_req, res, next) => {
            try {
                console.time("GET /api/map");

                const features = countriesMapService.getCountriesMapFeatures();

                const body = JSON.stringify(features);

                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.setHeader("Content-Length", Buffer.byteLength(body));
                res.status(200).end(body);

                console.timeEnd("GET /api/map");
            } catch (error) {
                next(error);
            }
        });

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    },
});

export default server;
