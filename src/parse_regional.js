async function main() {
  const res = await fetch('https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/italy.md');
  const text = await res.text();
  
  // Find "<h2>Regional DVB-T</h2>"
  const startIdx = text.indexOf('<h2>Regional DVB-T</h2>');
  if (startIdx === -1) {
    console.error('Regional DVB-T section not found');
    return;
  }
  
  // Find the next section (starts with <h2 or is end of file)
  let endIdx = text.indexOf('<h2', startIdx + 20);
  if (endIdx === -1) {
    endIdx = text.length;
  }
  
  const regionalText = text.substring(startIdx, endIdx);
  const lines = regionalText.split('\n');
  
  const channels = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('| #   |') || trimmed.includes('|:---:|')) {
      continue;
    }
    
    // Split columns
    const cols = trimmed.split('|').map(c => c.trim());
    // Col structure:
    // cols[0] is empty (since line starts with |)
    // cols[1] -> # (LCN)
    // cols[2] -> Channel name
    // cols[3] -> Link [>](url)
    // cols[4] -> Logo <img src="url" />
    // cols[5] -> EPG ID or other (may be empty or has EPG)
    
    if (cols.length < 5) continue;
    
    const name = cols[2];
    const rawLink = cols[3];
    const rawLogo = cols[4];
    
    if (!name || name === 'Channel') continue;
    
    // Extract stream link from markdown link [>](url) or direct url
    let link = '';
    const linkMatch = rawLink.match(/\[>\]\((.*?)\)/);
    if (linkMatch && linkMatch[1]) {
      link = linkMatch[1].trim();
    } else {
      link = rawLink.trim();
    }
    
    // Extract logo from image tag
    let logo = '';
    const logoMatch = rawLogo.match(/src="(.*?)"/);
    if (logoMatch && logoMatch[1]) {
      logo = logoMatch[1].trim();
    }
    
    // Fallback if logo is missing or is empty
    if (!logo) {
      logo = `https://images.unsplash.com/photo-1542204172-e7052809a86f?w=150&h=150&fit=crop`; // default elegant card
    }
    
    if (name && link) {
      channels.push({
        id: 'reg_' + Math.random().toString(36).substr(2, 9),
        name: name.replace(/Ⓖ/g, '').trim(),
        streamUrl: link,
        logoUrl: logo,
        lcn: cols[1] && cols[1] !== '0' ? parseInt(cols[1], 10) : null
      });
    }
  }
  
  console.log(`Successfully parsed ${channels.length} regional channels.`);
  const fs = await import('fs');
  fs.writeFileSync('./src/regional_channels.json', JSON.stringify(channels, null, 2), 'utf-8');
}

main().catch(console.error);
