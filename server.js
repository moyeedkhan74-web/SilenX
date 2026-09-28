const path = require('path');
const fs = require('fs');

const backendDist = path.join(__dirname, 'backend/dist/server.js');
if (fs.existsSync(backendDist)) {
  require(backendDist);
} else {
  console.error('[Root Server] backend/dist/server.js not found. Ensure backend build step ran successfully.');
  process.exit(1);
}

