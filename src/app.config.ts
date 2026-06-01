import {createEndpoint, createRouter, defineRoom, defineServer, monitor, playground,} from "colyseus";

import {CountriesGameRoom} from "#rooms/CountriesGameRoom.js";
import continentsJSON from "#data/json/continents.json" with {type: "json"};
import {countriesMapService} from "#services/CountriesMapService.js";


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

        continents: createEndpoint("/api/map/continents", { method: "GET" }, async () => {
            console.time("GET /api/map/continents");
            return continentsJSON;
        }),
    }),

    express: (app) => {
        app.get("/api/map/countries", async (_req, res, next) => {
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
