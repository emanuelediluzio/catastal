const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Mobile viewport (iPhone 12/13 size roughly)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // Wait for tiles to load
  await new Promise(r => setTimeout(r, 6000));
  
  // Optional: open the left panel to show off the mobile side sheet
  // await page.click('#collapseLeftBtn');
  // await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: 'public/screenshot_mobile.jpg', type: 'jpeg', quality: 80 });
  
  await browser.close();
})();
