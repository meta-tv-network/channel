async function main() {
  const res = await fetch('https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/italy.md');
  const text = await res.text();
  
  // Find "<h2>Regional DVB-T</h2>" section
  const sectionStart = text.indexOf('<h2>Regional DVB-T</h2>');
  if (sectionStart === -1) {
    console.log('Section not found');
    return;
  }
  
  // Print 2000 characters after the section header
  console.log(text.substring(sectionStart, sectionStart + 2000));
}

main().catch(console.error);
