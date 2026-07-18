import fs from "fs";

async function scrapeYoutubeChannel() {
  const url = "https://www.youtube.com/@MoviedomeIT/videos";
  console.log(`Fetching ${url}...`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8"
      }
    });

    const html = await response.text();
    console.log(`HTML loaded: ${html.length} bytes.`);

    // Let's write a regex that matches videoIds in the HTML
    // Inside ytInitialData or general script, videos are represented as videoId and titles
    const videoIdMatches = [...html.matchAll(/"videoId":"([^"]+)"/g)];
    const uniqueIds = Array.from(new Set(videoIdMatches.map(m => m[1])));
    console.log(`Found ${uniqueIds.length} unique video IDs in raw HTML.`);

    // Let's search for videoRenderer JSON snippets
    // E.g. {"videoRenderer":{"videoId":"xxxx","thumbnail":...
    const videoRendererRegex = /"videoRenderer":\s*(\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\})/g;
    const renderers: any[] = [];
    let match;
    while ((match = videoRendererRegex.exec(html)) !== null) {
      try {
        const renderer = JSON.parse(match[1]);
        renderers.push(renderer);
      } catch (e) {
        // Snippet was incomplete, try parsing simple properties from regex
      }
    }

    console.log(`Found ${renderers.length} videoRenderer blocks via regex.`);

    // If renderers.length is 0, let's parse using a smart RegExp for videoId and title
    const extracted: any[] = [];
    
    if (renderers.length > 0) {
      for (const r of renderers) {
        const videoId = r.videoId;
        if (!videoId) continue;
        if (extracted.some(x => x.sourceUrl.includes(videoId))) continue;

        const title = r.title?.runs?.[0]?.text || r.title?.simpleText || "Film Completo";
        const description = r.descriptionSnippet?.runs?.[0]?.text || "Film completo in italiano distribuito legalmente su YouTube da Moviedome Italia.";
        const durationText = r.lengthText?.simpleText || "01:30:00";
        
        const parts = durationText.split(":").map(Number);
        let durationMinutes = 90;
        if (parts.length === 3) {
          durationMinutes = parts[0] * 60 + parts[1];
        } else if (parts.length === 2) {
          durationMinutes = parts[0];
        }

        extracted.push({
          id: `moviedome_${videoId}`,
          title,
          description,
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          iframeCode: `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
          sector: "Cinema Italiano",
          language: "it",
          embedAllowed: true,
          qualityScore: 95,
          reliability: "High",
          status: "approved",
          durationMinutes,
          isVertical: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Fallback if no renderers could be fully JSON-parsed but we have video IDs
    if (extracted.length === 0 && uniqueIds.length > 0) {
      console.log("Fallback to smart regex parsing for titles...");
      // Let's find matches of: {"title":{"runs":[{"text":"TITLE"}]},"videoId":"ID"
      // or "title":{"accessibility":{"accessibilityData":{"label":"TITLE"}}},"videoId":"ID"
      // We can scan the HTML for titles associated with videoIds
      const blocks = html.split('"videoRenderer":');
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const idMatch = block.match(/"videoId":"([^"]+)"/);
        if (!idMatch) continue;
        const videoId = idMatch[1];
        if (extracted.some(x => x.sourceUrl.includes(videoId))) continue;

        // Try extracting title
        let title = "Film Completo";
        const titleRunMatch = block.match(/"title":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/);
        const simpleTitleMatch = block.match(/"title":\s*\{\s*"simpleText":\s*"([^"]+)"/);
        if (titleRunMatch) {
          title = titleRunMatch[1];
        } else if (simpleTitleMatch) {
          title = simpleTitleMatch[1];
        } else {
          // Try to search for label or accessibility text
          const labelMatch = block.match(/"label":\s*"([^"]+)"/);
          if (labelMatch) {
            title = labelMatch[1].split(" da ")[0]; // Clean up youtube accessibility label
          }
        }

        // Try extracting length
        let durationMinutes = 90;
        const lengthMatch = block.match(/"lengthText":\s*\{\s*"simpleText":\s*"([^"]+)"/);
        if (lengthMatch) {
          const parts = lengthMatch[1].split(":").map(Number);
          if (parts.length === 3) {
            durationMinutes = parts[0] * 60 + parts[1];
          } else if (parts.length === 2) {
            durationMinutes = parts[0];
          }
        }

        extracted.push({
          id: `moviedome_${videoId}`,
          title: JSON.parse(`"${title}"`), // Unescape unicode chars
          description: "Film completo in italiano distribuito legalmente su YouTube da Moviedome Italia.",
          sourceType: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          iframeCode: `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
          sector: "Cinema Italiano",
          language: "it",
          embedAllowed: true,
          qualityScore: 95,
          reliability: "High",
          status: "approved",
          durationMinutes,
          isVertical: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    console.log(`Extracted ${extracted.length} movies!`);
    console.log(JSON.stringify(extracted.slice(0, 3), null, 2));

    fs.writeFileSync("moviedome_scraped.json", JSON.stringify(extracted, null, 2));
  } catch (error) {
    console.error("Scraping failed:", error);
  }
}

scrapeYoutubeChannel();
