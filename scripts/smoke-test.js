/* eslint-disable no-console */

const urls = [
  'http://localhost:3001/',
  'http://localhost:3001/heap',
  'http://localhost:3001/stories',
  'http://localhost:3001/backups',
  'http://localhost:3001/moment/does-not-exist'
];

(async () => {
  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'GET' });
      const text = await res.text();
      console.log(`${u} -> ${res.status}`);
      console.log(text.slice(0, 400).replace(/\n/g, ' '));
      console.log('----');
    } catch (e) {
      console.log(`${u} -> ERROR: ${e.message}`);
      console.log('----');
    }
  }
})();
