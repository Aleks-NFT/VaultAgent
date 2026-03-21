const express = require('express');
const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
app.get('/scan/free', (req, res) => {
  res.json({
    vaults: [
      {name: "vPUNK", mc: 104154, vol: 210, signal
cat > mock-mcp.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/scan/free', (req, res) => {
  res.json({
    vaults: [
      {name: "vPUNK", mc: 104154, vol: 210, signal: "NEUTRAL"},
      {name: "vLADY", mc: 103473, vol: 43, signal: "NEUTRAL"},
      {name: "vDEATH", mc: 41723, vol: 10, signal: "STRONG"}
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(4021, () => {
  console.log('🚀 Mock MCP on http://localhost:4021');
});
