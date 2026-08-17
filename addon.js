const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const API = "https://phim.nguonc.com/api";

const manifest = {
    id: "com.phim2026.nguonc",
    version: "1.0.0",
    name: "Phim 2026 - NguonC",
    description: "NguonC Vietnamese movie addon",
    resources: [
        "catalog",
        "meta",
        "stream"
    ],
    types: [
        "movie",
        "series"
    ],
    catalogs: [
        {
            type: "series",
            id: "nguonc",
            name: "NguonC",
            extra: [
                {
                    name: "search",
                    isRequired: false
                },
                {
                    name: "skip",
                    isRequired: false
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

async function getJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("API error: " + response.status);
    }

    return await response.json();
}


// =========================
// CATALOG
// =========================

builder.defineCatalogHandler(async (args) => {
    try {
        let data;

        if (args.extra && args.extra.search) {
            const keyword = encodeURIComponent(args.extra.search);

            data = await getJSON(
                `${API}/films/search?keyword=${keyword}`
            );
        } else {
            const skip = Number(args.extra?.skip || 0);
            const page = Math.floor(skip / 10) + 1;

            data = await getJSON(
                `${API}/films/phim-moi-cap-nhat?page=${page}`
            );
        }

        const items = data.items || [];

        return {
            metas: items.map((film) => ({
                id: `nguonc:${film.slug}`,
                type: "series",
                name: film.name,
                poster: film.thumb_url || film.poster_url
            }))
        };

    } catch (error) {
        console.error("Catalog error:", error);
        return {
            metas: []
        };
    }
});


// =========================
// META + EPISODES
// =========================

builder.defineMetaHandler(async (args) => {
    try {
        if (!args.id.startsWith("nguonc:")) {
            return {
                meta: null
            };
        }

        const slug = args.id.replace("nguonc:", "");

        const data = await getJSON(
            `${API}/film/${encodeURIComponent(slug)}`
        );

        const movie = data.movie;

        if (!movie) {
            return {
                meta: null
            };
        }

        const videos = [];

        for (const server of movie.episodes || []) {

            for (const ep of server.items || []) {

                videos.push({
                    id: `${args.id}:${server.server_name}:${ep.name}`,
                    title: `Tập ${ep.name} - ${server.server_name}`,
                    season: 1,
                    episode: Number(ep.name),
                    thumbnail: movie.thumb_url || movie.poster_url
                });

            }
        }

        return {
            meta: {
                id: args.id,
                type: "series",
                name: movie.name,
                poster: movie.poster_url || movie.thumb_url,

                description: movie.description
                    ? movie.description.replace(/<[^>]*>/g, "")
                    : "",

                releaseInfo: movie.created
                    ? movie.created.substring(0, 4)
                    : "",

                videos
            }
        };

    } catch (error) {
        console.error("Meta error:", error);

        return {
            meta: null
        };
    }
});


// =========================
// STREAM
// =========================

builder.defineStreamHandler(async (args) => {

    try {

        if (!args.id.startsWith("nguonc:")) {
            return {
                streams: []
            };
        }

        const parts = args.id.split(":");

        const slug = parts[1];

        const serverName = parts[2];

        const episode = parts[3];

        const data = await getJSON(
            `${API}/film/${encodeURIComponent(slug)}`
        );

        const movie = data.movie;

        if (!movie) {
            return {
                streams: []
            };
        }

        for (const server of movie.episodes || []) {

            if (server.server_name !== serverName) {
                continue;
            }

            for (const ep of server.items || []) {

                if (ep.name === episode) {

                    return {
                        streams: [
                            {
                                name: `NguonC - ${serverName}`,
                                title: `Tập ${episode}`,
                                url: ep.embed
                            }
                        ]
                    };

                }

            }
        }

        return {
            streams: []
        };

    } catch (error) {

        console.error("Stream error:", error);

        return {
            streams: []
        };

    }

});


// =========================
// START SERVER
// =========================

serveHTTP(builder.getInterface(), {
    port: Number(process.env.PORT) || 7000,
    host: "0.0.0.0"
});
