/**
 * ============================================
 *  War Thunder API Server (Enhanced with CRUD)
 *  Organized by Maanvik Poddar
 * ============================================
 */

require('dotenv').config();
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: { 
        message: "Invalid JSON format",
        details: "Request body must be valid JSON"
      }
    });
  }
  next(err);
});

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
    return JSON.parse(fsSync.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error.message);
    return null;
  }
};

/** Save JSON data to file safely */
const saveJSON = async (filePath, data) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const tempPath = fullPath + '.tmp';
    
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, fullPath);
    
    console.log(`✅ Saved data to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving ${filePath}:`, error.message);
    return false;
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

/** Generate next ID for a nation's aircraft */
const getNextAircraftId = (nation) => {
  const nationAircraft = dataCache.vehicles.aircraft[nation] || [];
  if (nationAircraft.length === 0) return 1;
  return Math.max(...nationAircraft.map(a => a.id || 0)) + 1;
};

/** Validate aircraft data */
const validateAircraftData = (data, isUpdate = false) => {
  const errors = [];
  
  if (!isUpdate) {
    if (!data.aircraftid || typeof data.aircraftid !== 'string' || data.aircraftid.trim() === '') {
      errors.push('aircraftid is required and must be a non-empty string');
    }
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
  }
  
  // Optional field validations
  if (data.rank !== undefined && (typeof data.rank !== 'number' || data.rank < 1 || data.rank > 8)) {
    errors.push('rank must be a number between 1 and 8');
  }
  
  if (data.br !== undefined && (typeof data.br !== 'number' || data.br < 1.0 || data.br > 15.0)) {
    errors.push('br (battle rating) must be a number between 1.0 and 15.0');
  }
  
  if (data.crew !== undefined && (typeof data.crew !== 'number' || data.crew < 1)) {
    errors.push('crew must be a positive number');
  }
  
  return errors;
};

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
  if (!apiDoc)
    return res.status(500).json({ 
      error: { message: "API documentation not available", details: null }
    });
  res.json(apiDoc);
});

/* ============================================
 *  NATION ROUTES (READ ONLY)
 * ============================================ */

app.get("/api/nations", (req, res) => {
  if (!dataCache.nations)
    return res.status(500).json({ 
      error: { message: "Nations data not loaded", details: null }
    });
  res.json(dataCache.nations);
});

app.get("/api/nations/:id", (req, res) => {
  const { id } = req.params;
  const nations = dataCache.nations;

  if (!nations)
    return res.status(500).json({ 
      error: { message: "Nations data not loaded", details: null }
    });

  const nation = nations.find((n) => n.id === id);
  if (!nation) 
    return res.status(404).json({ 
      error: { message: "Nation not found", details: `Nation '${id}' does not exist` }
    });

  res.json(nation);
});

/* ============================================
 *  AIRCRAFT ROUTES (FULL CRUD)
 * ============================================ */

// GET all aircraft (with pagination and search)
app.get("/api/vehicles/aviation/aircraft", (req, res) => {
  const { aircraft = {} } = dataCache.vehicles;
  let allAircraft = Object.values(aircraft).flat();

  // Search filter
  const searchQuery = req.query.q;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    allAircraft = allAircraft.filter(a => 
      a.name?.toLowerCase().includes(query) ||
      a.aircraftid?.toLowerCase().includes(query) ||
      a.nation?.toLowerCase().includes(query)
    );
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedAircraft = allAircraft.slice(startIndex, endIndex);

  res.json({
    total: allAircraft.length,
    page,
    limit,
    totalPages: Math.ceil(allAircraft.length / limit),
    aircraft: paginatedAircraft,
  });
});

// GET aircraft by nation
app.get("/api/vehicles/aviation/aircraft/:nation", (req, res) => {
  const { nation } = req.params;
  const { aircraft } = dataCache.vehicles;

  if (!aircraft)
    return res.status(500).json({ 
      error: { message: "Aircraft data not loaded", details: null }
    });

  const nationAircraft = aircraft[nation];
  if (!nationAircraft)
    return res.status(404).json({
      error: { 
        message: `No aircraft found for nation: ${nation}`,
        details: { available_nations: Object.keys(aircraft) }
      }
    });

  res.json({ nation, count: nationAircraft.length, aircraft: nationAircraft });
});

// GET specific aircraft
app.get("/api/vehicles/aviation/aircraft/:nation/:identifier", (req, res) => {
  const { nation, identifier } = req.params;
  const nationAircraft = dataCache.vehicles.aircraft?.[nation];

  if (!nationAircraft)
    return res.status(404).json({ 
      error: { message: `Nation not found: ${nation}`, details: null }
    });

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const aircraft = nationAircraft.find(
    (a) => a.aircraftid === identifier || a.id === searchId
  ) || null;

  if (!aircraft)
    return res.status(404).json({
      error: { 
        message: `Aircraft not found with identifier: ${identifier}`,
        details: "Use either aircraftid (e.g., 'p-26a-34m2') or numeric id (e.g., '1')"
      }
    });

  res.json(aircraft);
});

// POST - Create new aircraft
app.post("/api/vehicles/aviation/aircraft/:nation", async (req, res) => {
  const { nation } = req.params;
  const { aircraft } = dataCache.vehicles;

  if (!aircraft)
    return res.status(500).json({ 
      error: { message: "Aircraft data not loaded", details: null }
    });

  if (!aircraft[nation]) {
    aircraft[nation] = [];
  }

  // Validate required fields - THIS IS THE IMPORTANT PART
  const { aircraftid, name } = req.body;
  
  if (!aircraftid || !name) {
    return res.status(400).json({
      error: { 
        message: "Missing required fields",
        details: "Both 'aircraftid' and 'name' are required"
      }
    });
  }

  // Trim values to check for empty strings
  if (aircraftid.trim() === '' || name.trim() === '') {
    return res.status(400).json({
      error: { 
        message: "Missing required fields",
        details: "Both 'aircraftid' and 'name' must be non-empty"
      }
    });
  }

  // Check for duplicate aircraftid
  const exists = aircraft[nation].find(a => a.aircraftid === aircraftid);
  if (exists) {
    return res.status(409).json({
      error: { 
        message: "Aircraft already exists",
        details: `An aircraft with aircraftid '${aircraftid}' already exists in ${nation}`
      }
    });
  }

  // Create new aircraft
  const newAircraft = {
    id: getNextAircraftId(nation),
    aircraftid,
    name,
    nation,
    ...req.body
  };

  aircraft[nation].push(newAircraft);
  
  // Save to file
  const saved = await saveJSON("data/vehicles/aviation/aircraft.json", aircraft);
  
  if (!saved) {
    return res.status(500).json({
      error: { message: "Failed to save aircraft", details: null }
    });
  }

  console.log(`✅ Created aircraft: ${aircraftid} in ${nation}`);
  res.status(201).json(newAircraft);
});

// PATCH - Update aircraft
app.patch("/api/vehicles/aviation/aircraft/:nation/:identifier", async (req, res) => {
  const { nation, identifier } = req.params;
  const { aircraft } = dataCache.vehicles;

  if (!aircraft || !aircraft[nation])
    return res.status(404).json({ 
      error: { message: `Nation not found: ${nation}`, details: null }
    });

  // Validate update data
  const validationErrors = validateAircraftData(req.body, true);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: { 
        message: "Validation failed",
        details: validationErrors
      }
    });
  }

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const aircraftIndex = aircraft[nation].findIndex(
    (a) => a.aircraftid === identifier || a.id === searchId
  );

  if (aircraftIndex === -1)
    return res.status(404).json({
      error: { 
        message: `Aircraft not found with identifier: ${identifier}`,
        details: null
      }
    });

  // Store original for rollback
  const originalAircraft = { ...aircraft[nation][aircraftIndex] };

  // Update aircraft (partial update)
  const updatedAircraft = {
    ...aircraft[nation][aircraftIndex],
    ...req.body,
    id: aircraft[nation][aircraftIndex].id, // Preserve ID
    nation: aircraft[nation][aircraftIndex].nation, // Preserve nation
    aircraftid: aircraft[nation][aircraftIndex].aircraftid // Preserve aircraftid
  };

  aircraft[nation][aircraftIndex] = updatedAircraft;

  // Save to file
  const saved = await saveJSON("data/vehicles/aviation/aircraft.json", aircraft);
  
  if (!saved) {
    // Rollback
    aircraft[nation][aircraftIndex] = originalAircraft;
    return res.status(500).json({
      error: { message: "Failed to update aircraft", details: null }
    });
  }

  console.log(`✅ Updated aircraft: ${identifier} in ${nation}`);
  res.json(updatedAircraft);
});

// DELETE - Remove aircraft
app.delete("/api/vehicles/aviation/aircraft/:nation/:identifier", async (req, res) => {
  const { nation, identifier } = req.params;
  const { aircraft } = dataCache.vehicles;

  if (!aircraft || !aircraft[nation])
    return res.status(404).json({ 
      error: { message: `Nation not found: ${nation}`, details: null }
    });

  const isNumeric = !isNaN(identifier);
  const searchId = isNumeric ? parseInt(identifier) : identifier;

  const aircraftIndex = aircraft[nation].findIndex(
    (a) => a.aircraftid === identifier || a.id === searchId
  );

  if (aircraftIndex === -1)
    return res.status(404).json({
      error: { 
        message: `Aircraft not found with identifier: ${identifier}`,
        details: null
      }
    });

  // Remove aircraft
  const deletedAircraft = aircraft[nation].splice(aircraftIndex, 1)[0];

  // Save to file
  const saved = await saveJSON("data/vehicles/aviation/aircraft.json", aircraft);
  
  if (!saved) {
    // Rollback
    aircraft[nation].splice(aircraftIndex, 0, deletedAircraft);
    return res.status(500).json({
      error: { message: "Failed to delete aircraft", details: null }
    });
  }

  console.log(`✅ Deleted aircraft: ${identifier} from ${nation}`);
  res.status(204).send();
});

/* ============================================
 *  REMAINING READ-ONLY ROUTES
 * ============================================ */

// Aviation overview
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

// Helicopters
app.get("/api/vehicles/aviation/helicopters", (req, res) => {
  const { helicopters = {} } = dataCache.vehicles;
  const allHelicopters = Object.values(helicopters).flat();
  res.json({ total: allHelicopters.length, helicopters: allHelicopters });
});

app.get("/api/vehicles/aviation/helicopters/:nation", (req, res) => {
  const { nation } = req.params;
  const { helicopters } = dataCache.vehicles;

  if (!helicopters)
    return res.status(500).json({ 
      error: { message: "Helicopters data not loaded", details: null }
    });

  const nationHelicopters = helicopters[nation];
  if (!nationHelicopters)
    return res.status(404).json({
      error: { 
        message: `No helicopters found for nation: ${nation}`,
        details: { available_nations: Object.keys(helicopters) }
      }
    });

  res.json({ nation, count: nationHelicopters.length, helicopters: nationHelicopters });
});

/* ============================================
 *  ERROR HANDLING
 * ============================================ */
app.use((req, res) => {
  res.status(404).json({
    error: { 
      message: "Endpoint not found",
      details: `Path '${req.path}' does not exist`
    }
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: { 
      message: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : null
    }
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
║   Environment: ${process.env.NODE_ENV || 'development'}       ║
╚════════════════════════════════════════╝

URLs:
  → http://localhost:${PORT}
  → http://localhost:${PORT}/api

📚 Documentation: See README.md
🧪 Testing: Import postman_collection.json
`);
});