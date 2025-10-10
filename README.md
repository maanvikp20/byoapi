# War Thunder API

A RESTful API providing comprehensive data about War Thunder vehicles, including aircraft, helicopters, tanks, and naval vessels.

## 🚀 Features

- **Full CRUD Operations** for aircraft
- **Pagination & Search** capabilities
- **Safe Data Persistence** with atomic file writes
- **Comprehensive Error Handling**
- **Multiple Vehicle Categories** (aircraft, helicopters, tanks, naval)
- **Nation-based Organization**

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## 🛠️ Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd war-thunder-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5000` (or your configured PORT)

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Response Format

**Success Response:**
```json
{
  "data": { /* resource data */ }
}
```

**Error Response:**
```json
{
  "error": {
    "message": "Human-readable error message",
    "details": "Additional context or null"
  }
}
```

---

## 🛩️ Aircraft Endpoints (CRUD)

### 1. List All Aircraft
```http
GET /api/vehicles/aviation/aircraft
```

**Query Parameters:**
- `q` (string) - Search query (searches name, aircraftid, nation)
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50)

**Example Request:**
```bash
curl "http://localhost:5000/api/vehicles/aviation/aircraft?q=mustang&page=1&limit=10"
```

**Success Response (200):**
```json
{
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15,
  "aircraft": [
    {
      "id": 1,
      "aircraftid": "p-51d-5",
      "name": "P-51D-5 Mustang",
      "nation": "usa",
      "rank": 3,
      "br": 4.0
    }
  ]
}
```

---

### 2. Get Aircraft by Nation
```http
GET /api/vehicles/aviation/aircraft/:nation
```

**Path Parameters:**
- `nation` (string) - Nation code (usa, germany, ussr, britain, japan, china, italy, france, sweden, israel)

**Example Request:**
```bash
curl http://localhost:5000/api/vehicles/aviation/aircraft/usa
```

**Success Response (200):**
```json
{
  "nation": "usa",
  "count": 45,
  "aircraft": [...]
}
```

**Error Response (404):**
```json
{
  "error": {
    "message": "No aircraft found for nation: invalid_nation",
    "details": {
      "available_nations": ["usa", "germany", "ussr", ...]
    }
  }
}
```

---

### 3. Get Specific Aircraft
```http
GET /api/vehicles/aviation/aircraft/:nation/:identifier
```

**Path Parameters:**
- `nation` (string) - Nation code
- `identifier` (string|number) - Either `aircraftid` or numeric `id`

**Example Requests:**
```bash
# By aircraftid
curl http://localhost:5000/api/vehicles/aviation/aircraft/usa/p-26a-34m2

# By numeric id
curl http://localhost:5000/api/vehicles/aviation/aircraft/usa/1
```

**Success Response (200):**
```json
{
  "id": 1,
  "aircraftid": "p-26a-34m2",
  "name": "P-26A-34 M2",
  "nation": "usa",
  "rank": 1,
  "br": 1.0,
  "type": "fighter",
  "crew": 1
}
```

**Error Response (404):**
```json
{
  "error": {
    "message": "Aircraft not found with identifier: invalid_id",
    "details": "Use either aircraftid (e.g., 'p-26a-34m2') or numeric id (e.g., '1')"
  }
}
```

---

### 4. Create New Aircraft
```http
POST /api/vehicles/aviation/aircraft/:nation
```

**Path Parameters:**
- `nation` (string) - Nation code

**Request Body (JSON):**
```json
{
  "aircraftid": "f-22-raptor",
  "name": "F-22 Raptor",
  "rank": 8,
  "br": 13.0,
  "type": "fighter",
  "crew": 1
}
```

**Required Fields:**
- `aircraftid` (string) - Unique aircraft identifier
- `name` (string) - Display name

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/vehicles/aviation/aircraft/usa \
  -H "Content-Type: application/json" \
  -d '{
    "aircraftid": "f-22-raptor",
    "name": "F-22 Raptor",
    "rank": 8,
    "br": 13.0
  }'
```

**Success Response (201):**
```json
{
  "id": 46,
  "aircraftid": "f-22-raptor",
  "name": "F-22 Raptor",
  "nation": "usa",
  "rank": 8,
  "br": 13.0
}
```

**Error Responses:**

**400 - Missing Required Fields:**
```json
{
  "error": {
    "message": "Missing required fields",
    "details": "Both 'aircraftid' and 'name' are required"
  }
}
```

**409 - Duplicate Aircraft:**
```json
{
  "error": {
    "message": "Aircraft already exists",
    "details": "An aircraft with aircraftid 'f-22-raptor' already exists in usa"
  }
}
```

---

### 5. Update Aircraft (Partial)
```http
PATCH /api/vehicles/aviation/aircraft/:nation/:identifier
```

**Path Parameters:**
- `nation` (string) - Nation code
- `identifier` (string|number) - Either `aircraftid` or numeric `id`

**Request Body (JSON):**
```json
{
  "br": 13.3,
  "type": "multirole"
}
```

**Example Request:**
```bash
curl -X PATCH http://localhost:5000/api/vehicles/aviation/aircraft/usa/f-22-raptor \
  -H "Content-Type: application/json" \
  -d '{"br": 13.3}'
```

**Success Response (200):**
```json
{
  "id": 46,
  "aircraftid": "f-22-raptor",
  "name": "F-22 Raptor",
  "nation": "usa",
  "rank": 8,
  "br": 13.3
}
```

**Error Response (404):**
```json
{
  "error": {
    "message": "Aircraft not found with identifier: invalid_id",
    "details": null
  }
}
```

---

### 6. Delete Aircraft
```http
DELETE /api/vehicles/aviation/aircraft/:nation/:identifier
```

**Path Parameters:**
- `nation` (string) - Nation code
- `identifier` (string|number) - Either `aircraftid` or numeric `id`

**Example Request:**
```bash
curl -X DELETE http://localhost:5000/api/vehicles/aviation/aircraft/usa/f-22-raptor
```

**Success Response (204 No Content)**

**Error Response (404):**
```json
{
  "error": {
    "message": "Aircraft not found with identifier: invalid_id",
    "details": null
  }
}
```

---

## 🌍 Nations Endpoints (Read-Only)

### 1. List All Nations
```http
GET /api/nations
```

**Success Response (200):**
```json
[
  {
    "id": "usa",
    "name": "USA",
    "fullName": "United States of America",
    "flag": "🇺🇸"
  }
]
```

---

### 2. Get Specific Nation
```http
GET /api/nations/:id
```

**Example Request:**
```bash
curl http://localhost:5000/api/nations/usa
```

**Success Response (200):**
```json
{
  "id": "usa",
  "name": "USA",
  "fullName": "United States of America",
  "flag": "🇺🇸"
}
```

---

## 🚁 Other Vehicle Endpoints (Read-Only)

### Aviation Overview
```http
GET /api/vehicles/aviation
```

### Helicopters
```http
GET /api/vehicles/aviation/helicopters
GET /api/vehicles/aviation/helicopters/:nation
```

---

## 📊 HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | Success (GET, PATCH) |
| 201  | Created (POST) |
| 204  | No Content (DELETE) |
| 400  | Bad Request (validation error) |
| 404  | Not Found |
| 409  | Conflict (duplicate resource) |
| 500  | Internal Server Error |

---

## 🧪 Testing

### Using Postman
Import the included `postman_collection.json` file to test all endpoints with pre-configured requests.

### Using cURL
Examples provided in each endpoint section above.

### Using the Web Interface
Navigate to `http://localhost:5000` to use the interactive API explorer.

---

## 📁 Project Structure

```
war-thunder-api/
├── data/
│   ├── nations/
│   │   └── nations.json
│   ├── vehicles/
│   │   ├── aviation/
│   │   │   ├── aircraft.json
│   │   │   └── helicopters.json
│   │   ├── ground/
│   │   │   └── tanks.json
│   │   └── naval/
│   │       ├── bluewater.json
│   │       └── coastal.json
│   └── api.json
├── public/
│   ├── index.html
│   └── about.html
├── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🔒 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment (development/production) | development |

---

## 🛡️ Data Persistence

The API uses atomic file writes to ensure data integrity:

1. Writes to temporary file (`.tmp`)
2. Renames to actual file (atomic operation)
3. Prevents corruption during concurrent writes

---

## 🚨 Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Human-readable message",
    "details": "Additional context or null"
  }
}
```

Common error scenarios:
- **Missing required fields** → 400
- **Resource not found** → 404
- **Duplicate resource** → 409
- **Server errors** → 500

---

## 👨‍💻 Development

### Running in Development Mode
```bash
npm run dev
```

### Code Structure
- `server.js` - Main application file
- `data/` - JSON data files
- `public/` - Static frontend files

---

## 📝 License

This project is for educational purposes. War Thunder and all related content are trademarks of Gaijin Entertainment.

---

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

## 👤 Author

**Maanvik Poddar**

---

## 📞 Support

For issues or questions:
1. Check this README
2. Test with Postman collection
3. Review error messages carefully
4. Check server logs

---

**Happy coding! ✈️**