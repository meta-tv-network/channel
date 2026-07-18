import fs from "fs";

async function scrapeDDG() {
  const query = "site:youtube.com/watch \"Moviedome Italia\"";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log(`Fetching DuckDuckGo search results: ${url}...`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    const html = await response.text();
    console.log(`HTML loaded: ${html.length} bytes.`);

    // Find YouTube links in duckduckgo search results page
    // Links are usually of the format: r.search.yahoo.com or duckduckgo redirect or direct link: //youtube.com/watch?v=...
    const youtubeUrlRegex = /(?:https?:)?\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g;
    const ids: string[] = [];
    let match;
    while ((match = youtubeUrlRegex.exec(html)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }

    // Also look for watch links in duckduckgo redirection links: uddg=https://www.youtube.com/watch?v=XXXX
    const uddgRegex = /uddg=https?(?:%3A|:)(?:%2F|\/)(?:%2F|\/)www\.youtube\.com(?:%2F|\/)watch(?:%3F|\?)v(?:%3D|=)([a-zA-Z0-9_-]+)/g;
    while ((match = uddgRegex.exec(html)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }

    console.log(`Found ${ids.length} unique Moviedome YouTube video IDs:`, ids);

    // Let's scrape title and snippet from ddg page
    // A search result row is inside: <div class="result body"> ... <a class="result__url" href="..."> ... <a class="result__snippet" ...>
    const results: any[] = [];
    const blocks = html.split('<div class="result style-snippet');
    
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      
      // Get the link
      const linkMatch = block.match(/href="([^"]+youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)[^"]*)"/) || 
                        block.match(/uddg=([^&]+youtube\.com[^&]+v(?:%3D|=)([a-zA-Z0-9_-]+)[^&]*)/);
      if (!linkMatch) continue;
      
      const videoId = linkMatch[2];
      
      // Get the title
      const titleMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
                         block.match(/class="result__title"[^>]*>([\s\S]*?)<\/a>/) ||
                         block.match(/<a[^>]+class="result__url"[^>]*>([\s\S]*?)<\/a>/);
                         
      let title = "Film Completo - Moviedome";
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      }
      
      // Get snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      let snippet = "Film completo gratis e legale in italiano distribuito da Moviedome.";
      if (snippetMatch) {
        snippet = snippetMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      // Clean title
      title = title.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
      snippet = snippet.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

      if (!results.some(r => r.videoId === videoId)) {
        results.push({ videoId, title, snippet });
      }
    }

    console.log(`Extracted ${results.length} structured movie results:`, results);
    fs.writeFileSync("moviedome_ddg.json", JSON.stringify(results, null, 2));

  } catch (error) {
    console.error("DDG search failed:", error);
  }
}

scrapeDDG();
