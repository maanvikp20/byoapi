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

/** Determine file path for each vehicle collection */
const filePathForCategory = {
  aircraft: "data/vehicles/aviation/aircraft.json",
  helicopters: "data/vehicles/aviation/helicopters.json",
  tanks: "data/vehicles/ground/tanks.json",
  bluewater: "data/vehicles/naval/bluewater.json",
  coastal: "data/vehicles/naval/coastal.json",
};

/** Determine unique id field name per category */
const idFieldForCategory = {
  aircraft: "aircraftid",
  helicopters: "helicopterid",
  tanks: "tankid",
  bluewater: "shipid",
  coastal: "shipid",
};

/** Generate next numeric ID for a nation in a given category */
const getNextIdForCategory = (category, nation) => {
  const collection = dataCache.vehicles[category] || {};
  const nationItems = collection[nation] || [];
  if (!Array.isArray(nationItems) || nationItems.length === 0) return 1;
  return Math.max(...nationItems.map(i => i.id || 0)) + 1;
};

/** Generic validation for create/update.
 *  For create: require idField and name.
 *  For update: optional but validate types (rank, br, crew).
 */
const validateGenericData = (category, data, isUpdate = false) => {
  const errors = [];
  const idField = idFieldForCategory[category] || "id_field";

  if (!isUpdate) {
    if (!data[idField] || typeof data[idField] !== 'string' || data[idField].trim() === '') {
      errors.push(`${idField} is required and must be a non-empty string`);
    }
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
  }

  // Optional numeric validations (if present)
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
 *  ROUTE FACTORY - to avoid repetition
 *  Produces nation-scoped CRUD endpoints for a category
 * ============================================ */

const mountCRUDForCategory = (category, opts = {}) => {
  const basePath = `/api/vehicles/${opts.group || category}/${category}`;

  // GET all (flattened) with optional search + pagination
  app.get(`${basePath}`, (req, res) => {
    const collection = dataCache.vehicles[category] || {};
    let allItems = Object.values(collection).flat();

    const q = req.query.q;
    if (q) {
      const query = q.toLowerCase();
      allItems = allItems.filter(i =>
        (i.name && i.name.toLowerCase().includes(query)) ||
        (i[idFieldForCategory[category]] && i[idFieldForCategory[category]].toLowerCase().includes(query)) ||
        (i.nation && i.nation.toLowerCase().includes(query))
      );
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const startIndex = (page - 1) * limit;
    const paginated = allItems.slice(startIndex, startIndex + limit);

    res.json({
      total: allItems.length,
      page,
      limit,
      totalPages: Math.ceil(allItems.length / limit),
      [category]: paginated
    });
  });

  // GET by nation
  app.get(`${basePath}/:nation`, (req, res) => {
    const { nation } = req.params;
    const collection = dataCache.vehicles[category];

    if (!collection)
      return res.status(500).json({ error: { message: `${category} data not loaded`, details: null } });

    const nationItems = collection[nation];
    if (!nationItems)
      return res.status(404).json({
        error: {
          message: `No ${category} found for nation: ${nation}`,
          details: { available_nations: Object.keys(collection || {}) }
        }
      });

    res.json({ nation, count: nationItems.length, [category]: nationItems });
  });

  // GET specific by nation + id or numeric id
  app.get(`${basePath}/:nation/:identifier`, (req, res) => {
    const { nation, identifier } = req.params;
    const collection = dataCache.vehicles[category];
    if (!collection) return res.status(500).json({ error: { message: `${category} data not loaded`, details: null } });

    const nationItems = collection[nation];
    if (!nationItems) return res.status(404).json({ error: { message: `Nation not found: ${nation}`, details: null } });

    const isNumeric = !isNaN(identifier);
    const searchId = isNumeric ? parseInt(identifier) : identifier;
    const idField = idFieldForCategory[category];

    const item = nationItems.find(i => i[idField] === identifier || i.id === searchId) || null;

    if (!item) return res.status(404).json({
      error: {
        message: `${category.slice(0, -1)} not found with identifier: ${identifier}`,
        details: `Use either ${idField} (string) or numeric id`
      }
    });

    res.json(item);
  });

  // POST - create new in nation
  app.post(`${basePath}/:nation`, async (req, res) => {
    const { nation } = req.params;
    const collection = dataCache.vehicles[category];

    if (!collection) return res.status(500).json({ error: { message: `${category} data not loaded`, details: null } });

    if (!collection[nation]) collection[nation] = [];

    const idField = idFieldForCategory[category];
    const { [idField]: incomingId, name } = req.body;

    // Basic required checks (mirrors validateGenericData but clearer for create)
    if (!incomingId || typeof incomingId !== 'string' || incomingId.trim() === '' || !name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        error: {
          message: "Missing required fields",
          details: `Both '${idField}' and 'name' are required and must be non-empty strings`
        }
      });
    }

    // Duplicate check
    const exists = collection[nation].find(i => i[idField] === incomingId);
    if (exists) {
      return res.status(409).json({
        error: { message: `${category.slice(0, -1)} already exists`, details: `An item with '${idField}' '${incomingId}' already exists in ${nation}` }
      });
    }

    // create
    const newItem = {
      id: getNextIdForCategory(category, nation),
      nation,
      ...req.body
    };

    collection[nation].push(newItem);

    const saved = await saveJSON(filePathForCategory[category], collection);
    if (!saved) {
      // rollback
      collection[nation].pop();
      return res.status(500).json({ error: { message: `Failed to save ${category}`, details: null } });
    }

    console.log(`✅ Created ${category.slice(0, -1)}: ${incomingId} in ${nation}`);
    res.status(201).json(newItem);
  });

  // PATCH - update
  app.patch(`${basePath}/:nation/:identifier`, async (req, res) => {
    const { nation, identifier } = req.params;
    const collection = dataCache.vehicles[category];

    if (!collection || !collection[nation]) return res.status(404).json({ error: { message: `Nation not found: ${nation}`, details: null } });

    // validate update body
    const validationErrors = validateGenericData(category, req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: { message: "Validation failed", details: validationErrors } });
    }

    const nationItems = collection[nation];
    const isNumeric = !isNaN(identifier);
    const searchId = isNumeric ? parseInt(identifier) : identifier;
    const idField = idFieldForCategory[category];

    const index = nationItems.findIndex(i => i[idField] === identifier || i.id === searchId);
    if (index === -1) return res.status(404).json({ error: { message: `${category.slice(0, -1)} not found with identifier: ${identifier}`, details: null } });

    const original = { ...nationItems[index] };

    // Merge updates but preserve id, nation, and idField (unique string id)
    const updated = {
      ...nationItems[index],
      ...req.body,
      id: nationItems[index].id,
      nation: nationItems[index].nation,
      [idField]: nationItems[index][idField]
    };

    nationItems[index] = updated;

    const saved = await saveJSON(filePathForCategory[category], collection);
    if (!saved) {
      // rollback
      nationItems[index] = original;
      return res.status(500).json({ error: { message: `Failed to update ${category.slice(0, -1)}`, details: null } });
    }

    console.log(`✅ Updated ${category.slice(0, -1)}: ${identifier} in ${nation}`);
    res.json(updated);
  });

  // DELETE - remove item
  app.delete(`${basePath}/:nation/:identifier`, async (req, res) => {
    const { nation, identifier } = req.params;
    const collection = dataCache.vehicles[category];

    if (!collection || !collection[nation]) return res.status(404).json({ error: { message: `Nation not found: ${nation}`, details: null } });

    const nationItems = collection[nation];
    const isNumeric = !isNaN(identifier);
    const searchId = isNumeric ? parseInt(identifier) : identifier;
    const idField = idFieldForCategory[category];

    const index = nationItems.findIndex(i => i[idField] === identifier || i.id === searchId);
    if (index === -1) return res.status(404).json({ error: { message: `${category.slice(0, -1)} not found with identifier: ${identifier}`, details: null } });

    const deleted = nationItems.splice(index, 1)[0];

    const saved = await saveJSON(filePathForCategory[category], collection);
    if (!saved) {
      // rollback
      nationItems.splice(index, 0, deleted);
      return res.status(500).json({ error: { message: `Failed to delete ${category.slice(0, -1)}`, details: null } });
    }

    console.log(`✅ Deleted ${category.slice(0, -1)}: ${identifier} from ${nation}`);
    // send 204 (no content) to match aircraft behavior
    res.status(204).send();
  });
};

/* ============================================
 *  PAGE ROUTES
 * ============================================ */
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
 *  MOUNT CRUD FOR EACH CATEGORY
 *  - aircraft already exists in your original and had specific routes;
 *    but for consistency we mount CRUD for each category using the factory.
 * ============================================ */

mountCRUDForCategory("aircraft", { group: "aviation" });
mountCRUDForCategory("helicopters", { group: "aviation" });
mountCRUDForCategory("tanks", { group: "ground" });
mountCRUDForCategory("bluewater", { group: "naval" });
mountCRUDForCategory("coastal", { group: "naval" });

/* ============================================
 *  OVERVIEW / README-LIKE ENDPOINTS
 * ============================================ */

// Aviation overview - combined aircraft + helicopters
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

// Naval overview - combined bluewater + coastal
app.get("/api/vehicles/naval", (req, res) => {
  const { bluewater = {}, coastal = {} } = dataCache.vehicles;

  const allBluewater = Object.values(bluewater).flat().map(s => ({ ...s, type: "bluewater" }));
  const allCoastal = Object.values(coastal).flat().map(s => ({ ...s, type: "coastal" }));

  res.json({
    total: allBluewater.length + allCoastal.length,
    bluewater_count: allBluewater.length,
    coastal_count: allCoastal.length,
    ships: [...allBluewater, ...allCoastal]
  });
});

// Ground overview - tanks
app.get("/api/vehicles/ground", (req, res) => {
  const { tanks = {} } = dataCache.vehicles;
  const allTanks = Object.values(tanks).flat();
  res.json({ total: allTanks.length, tanks: allTanks });
});

// All vehicles overview
app.get("/api/vehicles", (req, res) => {
  const { aircraft = {}, helicopters = {}, tanks = {}, bluewater = {}, coastal = {} } = dataCache.vehicles;

  const allAircraft = Object.values(aircraft).flat();
  const allHelicopters = Object.values(helicopters).flat();
  const allTanks = Object.values(tanks).flat();
  const allBluewater = Object.values(bluewater).flat();
  const allCoastal = Object.values(coastal).flat();

  res.json({
    total: allAircraft.length + allHelicopters.length + allTanks.length + allBluewater.length + allCoastal.length,
    aviation: allAircraft.length + allHelicopters.length,
    ground: allTanks.length,
    naval: allBluewater.length + allCoastal.length,
    data: {
      aircraft: allAircraft,
      helicopters: allHelicopters,
      tanks: allTanks,
      bluewater: allBluewater,
      coastal: allCoastal
    }
  });
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
`);
});