async function getTitles() {
  const ids = [
    'O0yPPLAeyuU', 'xfku74ciz_k', '_twHgWjUC-8', 'aSaEPFQkyLk', 'ZdG9j_050cM',
    'qESuSVmZnNw', '13TDUWanbm8', '6yIi8I81HOA', 'vLvE8WjvCA0', 'Rj3epGzokt4',
    'Xxxp4ZOyfTA', 'osyXLuUPWy4', 'dkt500HDJVs', 'WezLoM4KVdM', '24gn-3Ukgdw',
    '9wYOgKWjWi0', '5uuVy-6qqOY', 'LvGLbM2Q4Ts', '7Tdd5L6mMJE', '5kt-ZtaYytU'
  ];

  console.log(`Querying ${ids.length} IDs via oEmbed...`);

  for (const id of ids) {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log(`ID: ${id}`);
        console.log(`Title: ${data.title}`);
        console.log(`Author: ${data.author_name}`);
        console.log("-----------------------------------");
      } else {
        console.log(`ID ${id} failed: ${res.status}`);
      }
    } catch (e) {
      console.error(`Error for ${id}:`, e);
    }
  }
}

getTitles();
