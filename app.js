/**
 * ============================================
 *  War Thunder API Server
 *  Organized by Maanvik Poddar
 * ============================================
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

/* ============================================
 *  DATA CACHE
 * ============================================ */
let dataCache = {
  nations: null,
  vehicles: {
    aircraft: null,
    helicopters: null,
    tanks: null,
    bluewater: null,
    coastal: null,
  },
  lastLoaded: null,
};

/* ============================================
 *  HELPERS
 * ============================================ */

/** Safely load and parse JSON files */
const loadJSON = (filePath) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error.message);
    return null;
  }
};

/** Load all data files into cache on startup */
function preloadData() {
  console.log("🔄 Loading data...");

  try {
    dataCache.nations = loadJSON("data/nations/nations.json");

    dataCache.vehicles.aircraft = loadJSON("data/vehicles/aviation/aircraft.json");
    dataCache.vehicles.helicopters = loadJSON("data/vehicles/aviation/helicopters.json");

    dataCache.vehicles.tanks = loadJSON("data/vehicles/ground/tanks.json");

    dataCache.vehicles.bluewater = loadJSON("data/vehicles/naval/bluewater.json");
    dataCache.vehicles.coastal = loadJSON("data/vehicles/naval/coastal.json");

    dataCache.lastLoaded = new Date();
    console.log("✅ Data loaded successfully");
  } catch (error) {
    console.error("❌ Error loading data:", error.message);
  }
}

/* ============================================
 *  MIDDLEWARE
 * ============================================ */
app.use(express.static(path.join(__dirname, "public")));

/* ============================================
 *  ROUTES
 * ============================================ */

/* ---------- PAGE ROUTES ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

/* ============================================
 *  API DOCUMENTATION ROUTE
 * ============================================ */
app.get("/api", (req, res) => {
  const apiDoc = loadJSON("data/api.json");
  if (!apiDoc) return res.status(500).json({ error: "API documentation not available" });
  res.json(apiDoc);
});

/* ============================================
 *  NATION ROUTES
 * ============================================ */

app.get("/api/nations", (req, res) => {
  if (!dataCache.nations) return res.status(500).json({ error: "Nations data not loaded" });
  res.json(dataCache.nations);
});

app.get("/api/nations/:id", (req, res) => {
  const { id } = req.params;
  const nations = dataCache.nations;

  if (!nations) return res.status(500).json({ error: "Nations data not loaded" });

  const nation = nations.find((n) => n.id === id);
  if (!nation) return res.status(404).json({ error: "Nation not found" });

  res.json(nation);
});

/* ============================================
 *  AVIATION (Combined: Aircraft + Helicopters)
 * ============================================ */

// All aviation vehicles
app.get("/api/vehicles/aviation", (req, res) => {
  const { aircraft = {}, helicopters = {} } = dataCache.vehicles;

  const combinedAviation = {
    aircraft: Object.values(aircraft).flat().map((a) => ({ ...a, type: "aircraft" })),
    helicopters: Object.values(helicopters).flat().map((h) => ({ ...h, type: "helicopter" })),
  };

  res.json({
    total: combinedAviation.aircraft.length + combinedAviation.helicopters.length,
    aircraft_count: combinedAviation.aircraft.length,
    helicopter_count: combinedAviation.helicopters.length,
    vehicles: [...combinedAviation.aircraft, ...combinedAviation.helicopters],
  });
});

app.get("/api/vehicles/aviation/aircraft", (req, res) => {
  const { aircraft = {} } = dataCache.vehicles;
  const allAircraft = Object.values(aircraft).flat();

  res.json({
    total: allAircraft.length,
    aircraft: allAircraft,
  });
});

app.get("/api/vehicles/aviation/helicopters", (req, res) => {
  const { helicopters = {} } = dataCache.vehicles;
  const allHelicopters = Object.values(helicopters).flat();

  res.json({
    total: allHelicopters.length,
    helicopters: allHelicopters,
  });
});

// Aviation by nation
app.get("/api/vehicles/aviation/:nation", (req, res) => {
  const { nation } = req.params;
  const { aircraft = {}, helicopters = {} } = dataCache.vehicles;

  const nationAircraft = aircraft[nation] || [];
  const nationHelicopters = helicopters[nation] || [];

  if (nationAircraft.length === 0 && nationHelicopters.length === 0) {
    return res.status(404).json({
      error: `No aviation vehicles found for nation: ${nation}`,
      available_nations: {
        aircraft: Object.keys(aircraft),
        helicopters: Object.keys(helicopters),
      },
    });
  }

  const combinedNationAviation = [
    ...nationAircraft.map((a) => ({ ...a, type: "aircraft" })),
    ...nationHelicopters.map((h) => ({ ...h, type: "helicopter" })),
  ];

  res.json({
    nation,
    total: combinedNationAviation.length,
    aircraft_count: nationAircraft.length,
    helicopter_count: nationHelicopters.length,
    vehicles: combinedNationAviation,
  });
});

/* ============================================
 *  AIRCRAFT ROUTES
 * ============================================ */

// Aircraft by nation
app.get("/api/vehicles/aviation/aircraft/:nation", (req, res) => {
  const { nation } = req.params;
  const { aircraft } = dataCache.vehicles;

  if (!aircraft) return res.status(500).json({ error: "Aircraft data not loaded" });

  const nationAircraft = aircraft[nation];
  if (!nationAircraft)
    return res.status(404).json({
      error: `No aircraft found for nation: ${nation}`,
      available_nations: Object.keys(aircraft),
    });

  res.json({ nation, count: nationAircraft.length, aircraft: nationAircraft });
});

// Specific aircraft
app.get("/api/vehicles/aviation/aircraft/:nation/:identifier", (req, res) => {
  const { nation, identifier } = req.params;
  const nationAircraft = dataCache.vehicles.aircraft?.[nation];

  if (!nationAircraft) return res.status(404).json({ error: `Nation not found: ${nation}` });

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const aircraft =
    nationAircraft.find((a) => a.aircraftid === identifier || a.id === searchId) || null;

  if (!aircraft)
    return res.status(404).json({
      error: `Aircraft not found with identifier: ${identifier}`,
      hint: "Use either aircraftid (e.g., 'ah-1g') or numeric id (e.g., '1')",
    });

  res.json(aircraft);
});

/* ============================================
 *  HELICOPTER ROUTES
 * ============================================ */

// Helicopters by nation
app.get("/api/vehicles/aviation/helicopters/:nation", (req, res) => {
  const { nation } = req.params;
  const { helicopters } = dataCache.vehicles;

  if (!helicopters) return res.status(500).json({ error: "Helicopters data not loaded" });

  const nationHelicopters = helicopters[nation];
  if (!nationHelicopters)
    return res.status(404).json({
      error: `No helicopters found for nation: ${nation}`,
      available_nations: Object.keys(helicopters),
    });

  res.json({ nation, count: nationHelicopters.length, helicopters: nationHelicopters });
});

// Specific helicopter
app.get("/api/vehicles/aviation/helicopters/:nation/:identifier", (req, res) => {
  const { nation, identifier } = req.params;
  const nationHelicopters = dataCache.vehicles.helicopters?.[nation];

  if (!nationHelicopters) return res.status(404).json({ error: `Nation not found: ${nation}` });

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const helicopter =
    nationHelicopters.find((h) => h.helicopterid === identifier || h.id === searchId) || null;

  if (!helicopter)
    return res.status(404).json({
      error: `Helicopter not found with identifier: ${identifier}`,
      hint: "Use either helicopterid (e.g., 'ah-1g') or numeric id (e.g., '1')",
    });

  res.json(helicopter);
});

/* ============================================
 *  GROUND VEHICLE ROUTES
 * ============================================ */

// All tanks
app.get("/api/vehicles/ground/tanks", (req, res) => {
  const { tanks } = dataCache.vehicles;
  if (!tanks) return res.status(500).json({ error: "Tanks data not loaded" });
  res.json(tanks);
});

// Tanks by nation
app.get("/api/vehicles/ground/tanks/:nation", (req, res) => {
  const { nation } = req.params;
  const { tanks } = dataCache.vehicles;

  if (!tanks) return res.status(500).json({ error: "Tanks data not loaded" });

  const nationTanks = tanks[nation];
  if (!nationTanks)
    return res.status(404).json({
      error: `No tanks found for nation: ${nation}`,
      available_nations: Object.keys(tanks),
    });

  res.json({ nation, count: nationTanks.length, tanks: nationTanks });
});

// Specific tank
app.get("/api/vehicles/ground/tanks/:nation/:identifier", (req, res) => {
  const { nation, identifier } = req.params;
  const nationTanks = dataCache.vehicles.tanks?.[nation];

  if (!nationTanks) return res.status(404).json({ error: `Nation not found: ${nation}` });

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const tank = nationTanks.find((t) => t.tankid === identifier || t.id === searchId) || null;

  if (!tank)
    return res.status(404).json({
      error: `Tank not found with identifier: ${identifier}`,
      hint: "Use either tankid (e.g., 'm2a4') or numeric id (e.g., '1')",
    });

  res.json(tank);
});

/* ============================================
 *  NAVAL ROUTES
 * ============================================ */

// Combined naval (bluewater + coastal)
app.get("/api/vehicles/naval", (req, res) => {
  const { bluewater = [], coastal = [] } = dataCache.vehicles;

  const allNaval = [
    ...bluewater.map((v) => ({ ...v, vessel_type: "bluewater" })),
    ...coastal.map((v) => ({ ...v, vessel_type: "coastal" })),
  ];

  res.json({
    total: allNaval.length,
    bluewater_count: bluewater.length,
    coastal_count: coastal.length,
    vessels: allNaval,
  });
});

// Bluewater
app.get("/api/vehicles/naval/bluewater", (req, res) => {
  const { bluewater } = dataCache.vehicles;
  if (!bluewater) return res.status(500).json({ error: "Bluewater data not loaded" });
  res.json(bluewater);
});

// Coastal
app.get("/api/vehicles/naval/coastal", (req, res) => {
  const { coastal } = dataCache.vehicles;
  if (!coastal) return res.status(500).json({ error: "Coastal data not loaded" });
  res.json(coastal);
});

/* ============================================
 *  ERROR HANDLING
 * ============================================ */
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
  });
});

/* ============================================
 *  SERVER INIT
 * ============================================ */
preloadData();

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   War Thunder API Server               ║
╠════════════════════════════════════════╣
║   Port: ${PORT}                           ║
║   Status: Running                      ║
╚════════════════════════════════════════╝

URLs:
  → http://localhost:${PORT}
`);
});