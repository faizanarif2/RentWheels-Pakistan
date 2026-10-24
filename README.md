# RentWheels Pakistan

RentWheels is an educational full stack car rental demo. Visitors can browse a fictional fleet, filter by city and category, choose dates, submit a demo booking, receive a reference, and look up its summary. It does not make real reservations or process payments. Cars and daily rates are illustrative.

## Technology and architecture

- **Frontend:** React, Vite, JavaScript, React Router, Lucide icons and custom responsive CSS.
- **Backend:** Node.js, Express, PostgreSQL and the `pg` connection pool.
- **Deployment:** Nginx serves the built React app and forwards `/api` requests to Express. Docker Compose runs Nginx, the API and PostgreSQL.
- **Testing:** Python Selenium browser journey.

```text
Browser → Nginx (port 8080) → Express API → PostgreSQL
                                  ↕
                      PostgreSQL named volume
```

The browser talks to an API when it needs data. The Express API validates requests and runs parameterized SQL queries against PostgreSQL. PostgreSQL stores the inventory and bookings. The frontend never uses browser storage as its booking database.

## Check that records are saved

After submitting a demo booking in the website, run these commands in PowerShell from the project folder. They read the database inside the running PostgreSQL container:

```powershell
docker compose ps
docker compose exec db psql -U rentwheels -d rentwheels -c "SELECT COUNT(*) AS cars FROM cars;" -c "SELECT COUNT(*) AS bookings FROM bookings;" -c "SELECT booking_reference, car_id, pickup_date, return_date, total_days, total_price, status FROM bookings ORDER BY created_at DESC LIMIT 5;"
```

To open an interactive PostgreSQL prompt instead, run `docker compose exec db psql -U rentwheels -d rentwheels`. At the `rentwheels=#` prompt, use `\dt` to list tables, `SELECT * FROM cars;` to inspect sample vehicles, or `SELECT booking_reference, pickup_date, return_date, total_price, status FROM bookings;` to inspect bookings. Type `\q` to exit. These commands do not alter or delete records.

To demonstrate persistence, create a booking, note the result above, run `docker compose down`, then start the project again with `docker compose up -d` and rerun the query. The booking remains because `docker compose down` retains `postgres_data`.

## Vehicle photos

Car photos are stored locally in `frontend/public/cars/`, so cards load without an external image service. Attribution and source links are in [frontend/public/cars/ATTRIBUTION.md](frontend/public/cars/ATTRIBUTION.md). The photos are illustrative and may not show the exact trim listed in the demo inventory.

## Project structure

```text
backend/src/       Express app, routes, database pool and error handling
database/          PostgreSQL schema, indexes and sample fleet
frontend/src/      React pages, shared components, API helper and CSS
frontend/public/   Local car photos and hero illustration
selenium/          Browser test and Python dependency list
compose.yaml       Local multi-container setup
```

## Run with Docker Desktop on Windows

Install Docker Desktop with the Linux container engine enabled. In PowerShell, from this project directory:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Open **http://localhost:8080**. The API health endpoint is at **http://localhost:8080/api/health**. The first start builds the frontend and backend images, starts PostgreSQL, waits for its health check, and initializes the database. The initial SQL script runs only when PostgreSQL creates a new, empty data directory.

Useful commands:

```powershell
docker compose logs -f
docker compose logs -f api
docker compose ps
docker compose down
```

`docker compose down` stops and removes the containers and network while preserving the `postgres_data` named volume. To permanently delete the database and all bookings stored in that volume, run `docker compose down -v`. **This irreversibly deletes the local database data.** It does not delete files from your source tree.

The committed `.env.example` is a local demo configuration. For real deployment, use a strong secret and supply it through your deployment secret manager. Do not commit `.env` or AWS credentials.

## Development without Docker

Install Node.js 20 or newer and run PostgreSQL locally. Create a database, then apply `database/init.sql` using `psql` or another PostgreSQL client. In one PowerShell window:

```powershell
Copy-Item .env.example .env
$env:DATABASE_URL = "postgres://rentwheels:your-password@localhost:5432/rentwheels"
$env:DB_SSL = "false"
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix backend
```

In another PowerShell window, run `npm run dev --prefix frontend`. Vite serves the frontend on **http://localhost:5173** and forwards `/api` requests to the API on port 3000. Docker Compose is the simplest complete local run because it includes all three services.

The root `npm run dev` command starts the API and Vite together after all dependencies are installed. Database initialization is separate in this development mode.

## Main API routes

All API routes use the `/api` prefix and return JSON. Errors have this shape: `{"error":{"code":"...","message":"..."}}`.

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Checks application process and PostgreSQL connection. |
| `GET /api/cars?city=Lahore&category=Economy&maxPrice=10000&pickupDate=2026-11-01&returnDate=2026-11-03&sort=price_asc` | Filters active vehicles; date availability is checked in SQL. Filters are optional. `sort` accepts `price_asc` or `price_desc`. |
| `GET /api/cars/1` | Returns one active vehicle by numeric ID or slug. |
| `POST /api/bookings` | Validates booking input, checks overlap and saves the server-calculated estimate. |
| `GET /api/bookings/RW-012345ABCDEF` | Looks up one booking summary by its unpredictable reference. |

Example booking body:

```json
{
  "carId": 1,
  "customerName": "Demo Traveller",
  "phone": "03001234567",
  "email": "traveller@example.com",
  "pickupCity": "Lahore",
  "pickupDate": "2026-11-01",
  "returnDate": "2026-11-03"
}
```

The booking response contains a generated reference such as `RW-012345ABCDEF`; the exact value is random. The lookup response includes vehicle, dates, duration, price and status. It does not return contact details or list all bookings.

## Database and booking rules

`cars` has one row per sample vehicle. `bookings.car_id` references `cars.id`, so a vehicle can have multiple bookings over time. The schema defines date, status, price and reference constraints plus indexes for common filters and availability checks. Seed inserts use `ON CONFLICT (slug) DO NOTHING`, so re-running the seed does not duplicate the sample vehicles.

Bookings with `pending` or `confirmed` status block overlapping dates. A booking overlaps if its pickup is before the existing return and its return is after the existing pickup. The return date is exclusive: November 1 to November 3 counts as two rental days, and adjacent bookings can share a boundary date. The API locks the car row in a transaction before checking and inserting, serializing competing reservations for the same car.

PostgreSQL initialization scripts in `/docker-entrypoint-initdb.d` run only on the first initialization of an empty data directory. For later schema changes, create a new numbered migration, document and apply it to the existing database; do not assume editing `init.sql` will modify an existing volume. Back up data before applying production migrations.

The local named volume preserves PostgreSQL data on that Docker host when containers are replaced. It does not synchronize data between two EC2 instances. In the planned cloud design, both app instances should use one shared managed PostgreSQL database, such as Amazon RDS, through runtime environment variables. Set `DB_SSL=true` for a database endpoint requiring TLS. Keep credentials in a deployment secret store.

## Run the Selenium journey

Start the Docker Compose application first. Install Python and Chrome/Chromium. In PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r selenium\requirements.txt
$env:BASE_URL = "http://localhost:8080"
python selenium\test_app.py
```

Selenium Manager can resolve the local Chrome driver. To use a remote Selenium service, set `$env:SELENIUM_REMOTE_URL` to its WebDriver endpoint. Set `$env:HEADLESS = "false"` to watch the browser. The test checks the actual site, opens a car, sends a future dated booking, reads its generated reference and retrieves the summary.

## Concepts for the lab viva

- **Frontend and backend:** the frontend is the website rendered in the browser; the backend handles API requests and business rules.
- **API and database:** an API is the defined way programs exchange requests and responses; the database stores durable records.
- **Dockerfile and image:** a Dockerfile is the recipe; an image is the built, reusable package made from that recipe.
- **Image and container:** an image is the template; a container is a running instance of it.
- **Compose and `docker run`:** Compose describes and starts related services together; `docker run` starts an individual container with options supplied on that command.
- **Container filesystem and named volume:** a container's writable layer is temporary when the container is removed; the PostgreSQL named volume keeps database files separately on that Docker host.
- **Local PostgreSQL and RDS:** the Compose PostgreSQL service is for development and a single host; a shared RDS endpoint is the suitable database target for multiple application instances.

## Later AWS deployment

Build the same application images for Linux, publish them to a container registry, and run the web/API stack on each EC2 application instance behind an Application Load Balancer. Configure health checks to reach `/api/health`, provide the same `DATABASE_URL` to both instances, and use one shared PostgreSQL database endpoint. Configure passwords through a secret manager, enable database TLS where required, and use the ALB security group and database security group to restrict traffic. This repository does not create AWS resources.

## Troubleshooting

- If Docker commands cannot connect, start Docker Desktop and confirm it is using Linux containers.
- If port 8080 is occupied, change the left side of the `ports` mapping for `web` in `compose.yaml` and open that port instead.
- If the API is unhealthy, use `docker compose logs api db` and check the database URL and password.
- If a database seed or schema change does not appear after editing `init.sql`, the existing named volume was already initialized. Apply a deliberate migration; deleting the volume will erase its data.
- If a booking reports unavailable dates, choose different dates or another car. Availability conflicts are enforced by the database-backed API.
- If Selenium cannot open Chrome, install a compatible Chrome/Chromium browser or set `SELENIUM_REMOTE_URL` to a running Selenium endpoint.
