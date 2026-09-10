export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    const url = req.url;

    // 1. CẤU HÌNH MANIFEST (Thông tin hiện trên Stremio)
    if (url === '/' || url.endsWith('manifest.json')) {
        return res.status(200).json({
            id: "com.nguonc.customaddon",
            version: "1.0.0",
            name: "Addon Nguonc Tự Làm",
            description: "Nguồn phim NguonC chạy trên Vercel cá nhân",
            resources: ["stream"],
            types: ["movie", "series"],
            idPrefixes: ["tt"]
        });
    }

    // 2. XỬ LÝ LẤY LINK PHIM KHI NGƯỜI DÙNG BẤM XEM
    if (url.includes('/stream/')) {
        const parts = url.split('/');
        const idParam = parts[parts.length - 1].replace('.json', ''); // Ví dụ: tt123456 hoặc tt123456:1:1
        const imdbId = idParam.split(':')[0]; // Chỉ lấy mã phim gốc

        let streams = [];

        try {
            // Gọi đến API gốc của Nguonc
            const response = await fetch(`https://nguonc.com{imdbId}`);
            const data = await response.json();

            if (data && data.status && data.movie && data.movie.episodes) {
                const episodesData = data.movie.episodes;

                episodesData.forEach(server => {
                    server.server_data.forEach(ep => {
                        // Nếu là phim bộ (series), kiểm tra xem có đúng số tập Stremio đang yêu cầu không
                        if (idParam.includes(':')) {
                            const currentEpNum = idParam.split(':')[2]; // Số tập người dùng bấm
                            if (ep.name !== currentEpNum) return; // Không trùng thì bỏ qua
                        }

                        // Thêm link phim vào danh sách phát
                        streams.push({
                            name: `NguonC\n${server.server_name}`,
                            title: ep.name,
                            url: ep.link_m3u8
                        });
                    });
                });
            }
        } catch (error) {
            console.error("Lỗi kết nối API:", error);
        }

        return res.status(200).json({ streams: streams });
    }

    return res.status(404).json({ error: "Not found" });
}
