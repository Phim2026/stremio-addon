export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    const url = req.url || '';

    // MANIFEST
    if (url === '/' || url.endsWith('/manifest.json')) {
        return res.status(200).json({
            id: "com.nguonc.customaddon",
            version: "1.2.0",
            name: "Addon NguonC Tự Làm",
            description: "NguonC chạy qua Vercel",
            resources: ["stream"],
            types: ["movie", "series"],
            idPrefixes: ["tt"]
        });
    }

    // STREAM
    if (url.includes('/stream/')) {

        const parts = url.split('/');
        const type = parts[parts.indexOf('stream') + 1];

        const idParam = parts[parts.length - 1]
            .replace('.json', '');

        const idParts = idParam.split(':');
        const imdbId = idParts[0];
        const episodeNumber = idParts[2] || null;

        try {
            // Lấy tên phim từ Cinemeta
            const metaResponse = await fetch(
                `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`
            );

            if (!metaResponse.ok) {
                return res.status(200).json({ streams: [] });
            }

            const metaData = await metaResponse.json();
            const movieName = metaData?.meta?.name;

            if (!movieName) {
                return res.status(200).json({ streams: [] });
            }

            // Tìm phim trên NguonC
            const searchResponse = await fetch(
                `https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(movieName)}`
            );

            if (!searchResponse.ok) {
                return res.status(200).json({ streams: [] });
            }

            const searchData = await searchResponse.json();
            const items = searchData?.items || [];

            if (!items.length) {
                return res.status(200).json({ streams: [] });
            }

            // Ưu tiên tên tiếng Anh / tên gốc trùng
            const normalized = movieName.toLowerCase().trim();

            let selected = items.find(item =>
                (item.original_name || '').toLowerCase().trim() === normalized
            );

            if (!selected) {
                selected = items.find(item =>
                    (item.name || '').toLowerCase().trim() === normalized
                );
            }

            if (!selected) {
                selected = items[0];
            }

            if (!selected.slug) {
                return res.status(200).json({ streams: [] });
            }

            // Lấy chi tiết phim
            const detailResponse = await fetch(
                `https://phim.nguonc.com/api/film/${selected.slug}`
            );

            if (!detailResponse.ok) {
                return res.status(200).json({ streams: [] });
            }

            const detailData = await detailResponse.json();
            const episodes = detailData?.movie?.episodes || [];

            const streams = [];

            for (const server of episodes) {

                const episodeItems = server.items || [];

                for (const ep of episodeItems) {

                    if (!ep.embed) continue;

                    // Phim lẻ
                    if (type === 'movie') {
                        streams.push({
                            name: `NguonC`,
                            title: `${server.server_name} - ${ep.name}`,
                            externalUrl: ep.embed
                        });
                    }

                    // Phim bộ
                    else {
                        const epText = String(ep.name || '');
                        const numberMatch = epText.match(/\d+/);

                        const epNum = numberMatch
                            ? Number(numberMatch[0])
                            : null;

                        if (
                            !episodeNumber ||
                            epNum === Number(episodeNumber)
                        ) {
                            streams.push({
                                name: `NguonC`,
                                title: `${server.server_name} - ${ep.name}`,
                                externalUrl: ep.embed
                            });
                        }
                    }
                }
            }

            return res.status(200).json({
                streams
            });

        } catch (error) {

            console.error("NguonC error:", error);

            return res.status(200).json({
                streams: []
            });
        }
    }

    return res.status(404).json({
        error: "Not found"
    });
}
