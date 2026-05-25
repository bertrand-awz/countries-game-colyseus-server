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

const server = defineServer({
    rooms: {
        countries_game: defineRoom(CountriesGameRoom),
    },

    routes: createRouter({
        api_heartbeat: createEndpoint("/api/heartbeat", { method: "GET" }, async (ctx) => {
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

        game_map: createEndpoint("/api/map", { method: "GET" }, async () => {
            return countriesMapService.getCountriesMapFeatures();
        }),
    }),

    express: (app) => {
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
