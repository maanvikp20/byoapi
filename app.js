const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 5000;

app.use(express.static(path.join(__dirname, 'public')));

// Helper function to load JSON safely
const loadJSON = (filePath) => JSON.parse(fs.readFileSync(path.join(__dirname, filePath), 'utf8'));

// Home routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// ===== Nations =====
app.get('/api/nations', (req, res) => {
  const nations = loadJSON('data/nations/nations.json');
  res.json(nations);
});

app.get('/api/nations/:id', (req, res) => {
  const nations = loadJSON('data/nations/nations.json');
  const nation = nations.find(n => n.id === req.params.id);
  if (!nation) return res.status(404).json({ error: 'Nation not found' });
  res.json(nation);
});

// ===== Vehicles =====

// Aviation
app.get('/api/vehicles/aviation/aircraft', (req, res) => {
  const data = loadJSON('data/vehicles/aviation/aircraft.json');
  res.json(data);
});

app.get('/api/vehicles/aviation/helicopters', (req, res) => {
  const data = loadJSON('data/vehicles/aviation/helicopters.json');
  res.json(data);
});

// Ground
app.get('/api/vehicles/ground/tanks', (req, res) => {
  const data = loadJSON('data/vehicles/ground/tanks.json');
  res.json(data);
});

// Naval
app.get('/api/vehicles/naval/bluewater', (req, res) => {
  const data = loadJSON('data/vehicles/naval/bluewater.json');
  res.json(data);
});

app.get('/api/vehicles/naval/coastal', (req, res) => {
  const data = loadJSON('data/vehicles/naval/coastal.json');
  res.json(data);
});

// ===== Combined Vehicle Endpoint =====
app.get('/api/vehicles', (req, res) => {
  const vehicles = {
    aviation: {
      aircraft: loadJSON('data/vehicles/aviation/aircraft.json'),
      helicopters: loadJSON('data/vehicles/aviation/helicopters.json')
    },
    ground: {
      tanks: loadJSON('data/vehicles/ground/tanks.json')
    },
    naval: {
      bluewater: loadJSON('data/vehicles/naval/bluewater.json'),
      coastal: loadJSON('data/vehicles/naval/coastal.json')
    }
  };
  res.json(vehicles);
});

// ===== Nations with Vehicles =====
app.get('/api/nations/:id/vehicles', (req, res) => {
  const nations = loadJSON('data/nations/nations.json');
  const nation = nations.find(n => n.id === req.params.id);
  if (!nation) return res.status(404).json({ error: 'Nation not found' });

  const allVehicles = {
    aviation: {
      aircraft: loadJSON('data/vehicles/aviation/aircraft.json'),
      helicopters: loadJSON('data/vehicles/aviation/helicopters.json')
    },
    ground: {
      tanks: loadJSON('data/vehicles/ground/tanks.json')
    },
    naval: {
      bluewater: loadJSON('data/vehicles/naval/bluewater.json'),
      coastal: loadJSON('data/vehicles/naval/coastal.json')
    }
  };

  // Optionally filter vehicles by nation
  const nationVehicles = {};
  for (const category in allVehicles) {
    nationVehicles[category] = {};
    for (const type in allVehicles[category]) {
      nationVehicles[category][type] = allVehicles[category][type].filter(v => v.nation === nation.id);
    }
  }

  res.json({
    nation: nation.name,
    vehicles: nationVehicles
  });
});

// ===== Server =====
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});