const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const API = "https://phim.nguonc.com/api";

const manifest = {
    id: "com.phim2026.nguonc",
    version: "1.0.0",
    name: "Phim 2026",
    description: "Addon catalog phim",
    resources: ["catalog", "meta"],
    types: ["movie", "series"],
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

    return response.json();
}

builder.defineCatalogHandler(async (args) => {
    try {
        let data;

        if (args.extra && args.extra.search) {
            const keyword = encodeURIComponent(args.extra.search);
            data = await getJSON(
                `${API}/films/search?keyword=${keyword}`
            );
        } else {
            const page = Math.floor((args.extra?.skip || 0) / 10) + 1;

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
        console.error(error);
        return { metas: [] };
    }
});

builder.defineMetaHandler(async (args) => {
    try {
        if (!args.id.startsWith("nguonc:")) {
            return { meta: null };
        }

        const slug = args.id.replace("nguonc:", "");

        const data = await getJSON(
            `${API}/film/${encodeURIComponent(slug)}`
        );

        const movie = data.movie;

        if (!movie) {
            return { meta: null };
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
                genres: [],
                videos: (movie.episodes || [])
                    .flatMap(server =>
                        (server.items || []).map(ep => ({
                            id: `${args.id}:${server.server_name}:${ep.name}`,
                            title: `Tập ${ep.name} - ${server.server_name}`,
                            season: 1,
                            episode: Number(ep.name)
                        }))
                    )
            }
        };
    } catch (error) {
        console.error(error);
        return { meta: null };
    }
});

serveHTTP(builder.getInterface(), {
    port: process.env.PORT || 7000
});
