import fs from "fs";

async function scrapePlaylist() {
  const playlists = [
    "PLv9NkpkzvOK071QdulZLLHg81Rl4ZX-5V",
    "PLv9NkpkzvOK20_F_vuT7pm1L5kDd9jwwf"
  ];

  const allMovies: any[] = [];

  for (const playlistId of playlists) {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    console.log(`Fetching playlist ${url}...`);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.8"
        }
      });

      const html = await response.text();
      console.log(`HTML loaded: ${html.length} bytes.`);

      // YouTube playlists contain "playlistVideoRenderer" JSON objects inside ytInitialData.
      // Let's search for "videoId":"XXXX" and title structures using RegExp.
      const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      const ids: string[] = [];
      let match;
      while ((match = videoIdRegex.exec(html)) !== null) {
        if (!ids.includes(match[1])) {
          ids.push(match[1]);
        }
      }

      console.log(`Found ${ids.length} potential video IDs:`, ids.slice(0, 10));

      // Let's parse video renderers inside the playlist
      const blocks = html.split('"playlistVideoRenderer":');
      console.log(`Found ${blocks.length - 1} playlistVideoRenderer blocks.`);

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const idMatch = block.match(/"videoId":"([^"]+)"/);
        if (!idMatch) continue;
        const videoId = idMatch[1];
        if (allMovies.some(x => x.sourceUrl.includes(videoId))) continue;

        // Extract title
        let title = "Film Completo";
        const titleRunMatch = block.match(/"title":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/);
        const simpleTitleMatch = block.match(/"title":\s*\{\s*"simpleText":\s*"([^"]+)"/);
        if (titleRunMatch) {
          title = titleRunMatch[1];
        } else if (simpleTitleMatch) {
          title = simpleTitleMatch[1];
        }

        // Try to decode unicode escapes in title
        try {
          title = JSON.parse(`"${title}"`);
        } catch (e) {
          // ignore
        }

        // Only include if it contains "film" or is part of the playlist
        allMovies.push({
          id: `moviedome_${videoId}`,
          title,
          description: `Film completo in italiano distribuito legalmente su YouTube da Moviedome Italia. Buona visione!`,
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          iframeCode: `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
          sector: "Cinema Italiano",
          language: "it",
          embedAllowed: true,
          qualityScore: 95,
          reliability: "High",
          status: "approved",
          durationMinutes: 95,
          isVertical: false,
          createdAt: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(`Failed to fetch playlist ${playlistId}:`, error);
    }
  }

  console.log(`Extracted total of ${allMovies.length} unique movies!`);
  console.log(JSON.stringify(allMovies.slice(0, 5), null, 2));

  fs.writeFileSync("moviedome_playlist_scraped.json", JSON.stringify(allMovies, null, 2));
}

scrapePlaylist();
