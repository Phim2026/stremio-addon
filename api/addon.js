export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    const url = req.url || '';

    // =========================
    // 1. MANIFEST
    // =========================
    if (url === '/' || url.endsWith('/manifest.json')) {
        return res.status(200).json({
            id: "com.nguonc.customaddon",
            version: "1.1.0",
            name: "Addon NguonC Tự Làm",
            description: "NguonC chạy qua Vercel cá nhân",
            resources: ["stream"],
            types: ["movie", "series"],
            idPrefixes: ["tt"]
        });
    }

    // =========================
    // 2. STREAM
    // =========================
    if (url.includes('/stream/')) {

        const parts = url.split('/');

        // Ví dụ:
        // /stream/movie/tt123456.json
        // /stream/series/tt123456:1:2.json

        const type = parts[parts.indexOf('stream') + 1];

        const idParam = parts[parts.length - 1]
            .replace('.json', '');

        const idParts = idParam.split(':');

        const imdbId = idParts[0];

        const season = idParts[1] || null;
        const episode = idParts[2] || null;

        let streams = [];

        try {

            // =========================
            // LẤY TÊN PHIM TỪ CINEMETA
            // =========================

            const metaUrl =
                `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;

            const metaResponse = await fetch(metaUrl);

            if (!metaResponse.ok) {
                throw new Error(
                    `Cinemeta error: ${metaResponse.status}`
                );
            }

            const metaData = await metaResponse.json();

            const movieName = metaData?.meta?.name;

            if (!movieName) {
                throw new Error("Không lấy được tên phim từ Cinemeta");
            }

            // =========================
            // TÌM PHIM TRÊN NGUONC
            // =========================

            const searchUrl =
                `https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(movieName)}`;

            const searchResponse = await fetch(searchUrl);

            if (!searchResponse.ok) {
                throw new Error(
                    `NguonC search error: ${searchResponse.status}`
                );
            }

            const searchData = await searchResponse.json();

            const items = searchData?.items || [];

            if (!items.length) {
                return res.status(200).json({
                    streams: []
                });
            }

            // =========================
            // CHỌN KẾT QUẢ PHÙ HỢP NHẤT
            // =========================

            let selectedMovie = items[0];

            const normalizedName = movieName
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, ' ')
                .trim();

            const exactMatch = items.find(item => {

                const name =
                    (item.name || '')
                        .toLowerCase()
                        .replace(/[^\p{L}\p{N}]+/gu, ' ')
                        .trim();

                const origin =
                    (item.origin_name || '')
                        .toLowerCase()
                        .replace(/[^\p{L}\p{N}]+/gu, ' ')
                        .trim();

                return (
                    name === normalizedName ||
                    origin === normalizedName
                );
            });

            if (exactMatch) {
                selectedMovie = exactMatch;
            }

            const slug = selectedMovie.slug;

            if (!slug) {
                throw new Error("Không tìm thấy slug phim trên NguonC");
            }

            // =========================
            // LẤY CHI TIẾT PHIM
            // =========================

            const detailUrl =
                `https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`;

            const detailResponse = await fetch(detailUrl);

            if (!detailResponse.ok) {
                throw new Error(
                    `NguonC detail error: ${detailResponse.status}`
                );
            }

            const detailData = await detailResponse.json();

            const movie = detailData?.movie;

            if (!movie || !movie.episodes) {
                return res.status(200).json({
                    streams: []
                });
            }

            // =========================
            // DUYỆT SERVER + EPISODE
            // =========================

            for (const server of movie.episodes) {

                const serverData = server.server_data || [];

                for (const ep of serverData) {

                    // Phim bộ:
                    // Stremio gửi ttID:season:episode

                    if (type === 'series') {

                        const wantedEpisode =
                            Number(episode);

                        const epName =
                            String(ep.name || '');

                        // Ví dụ NguonC có:
                        // "Tập 1"
                        // "1"
                        // "Episode 1"

                        const numberMatch =
                            epName.match(/\d+/);

                        const epNumber =
                            numberMatch
                                ? Number(numberMatch[0])
                                : null;

                        if (
                            wantedEpisode &&
                            epNumber !== wantedEpisode
                        ) {
                            continue;
                        }
                    }

                    if (!ep.link_m3u8) {
                        continue;
                    }

                    streams.push({
                        name: `NguonC`,
                        title: `${movie.name || movieName} - ${ep.name || 'Tập'}`,
                        url: ep.link_m3u8
                    });
                }
            }

        } catch (error) {

            console.error(
                "Addon NguonC error:",
                error
            );

            return res.status(200).json({
                streams: []
            });
        }

        return res.status(200).json({
            streams
        });
    }

    return res.status(404).json({
        error: "Not found"
    });
}
