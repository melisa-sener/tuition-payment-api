# Tuition Payment API

A simple university tuition payment system built with **Node.js**, **Express**, **PostgreSQL (Neon)**, and **Azure App Service**.  
The API supports two roles — **Admin** and **Bank** — with secure JWT authentication and an API Gateway.

---

## Live Deployment

**API Gateway (Azure App Service):**  
https://tuition-payment-api-ffcxa5dsbac0azf5.swedencentral-01.azurewebsites.net

**Swagger UI:**  
https://tuition-payment-api-ffcxa5dsbac0azf5.swedencentral-01.azurewebsites.net/swagger

**GitHub Repository:**  
https://github.com/melisa-sener/tuition-payment-api

---

## Login Credentials

### **Admin**
```json
{ "username": "admin1", "password": "adminpass" }
```

### **Bank**
```json
{ "username": "bank1", "password": "bankpass" }

```

---

## Features

### **Admin Capabilities**
- Login using JWT  
- Add tuition record  
- Add batch tuition records  
- Query any student’s tuition information  
- List unpaid tuition (with pagination)

### **Bank Capabilities**
- Login using JWT  
- Query specific student tuition  
- Submit tuition payment  
- Cannot access admin-only endpoints

### **Other Features**
- Gateway-level rate limiting  
- Full request/response logging  
- OpenAPI 3.0 documentation (Swagger UI)  
- Deployed on Azure App Service  
- Neon PostgreSQL cloud database

---  

## Tech Stack

- **Node.js** (JavaScript runtime)
- **Express.js** (REST API framework)
- **Azure App Service** (cloud deployment)
- **Neon PostgreSQL** (serverless cloud database)
- **JWT Authentication** (secure login for Admin & Bank roles)
- **http-proxy-middleware** (custom API Gateway)
- **Express Rate Limit** (throttle abusive requests)
- **Swagger / OpenAPI 3.0** (auto-generated API documentation)

---

## System Architecture

            ┌──────────────────────────────┐
            │        Client / Tester       │
            └──────────────────────────────┘
                         │
                         ▼
            ┌──────────────────────────────┐
            │   API Gateway (port 4000)    │
            │  - Logging                   │
            │  - Rate Limiting             │
            │  - Reverse Proxy to API      │
            └──────────────────────────────┘
                         │
                         ▼
            ┌──────────────────────────────┐
            │   Tuition API (port 3000)    │
            │  - Admin Endpoints           │
            │  - Bank Endpoints            │
            │  - JWT Authentication        │
            └──────────────────────────────┘
                         │
                         ▼
            ┌──────────────────────────────┐
            │ Neon PostgreSQL (Cloud DB)   │
            │  - tuitions table            │
            └──────────────────────────────┘


## Environment Variables

Set the following variables in **Azure → App Service → Environment Variables**:

| Variable         | Description                                   |
|------------------|-----------------------------------------------|
| `PORT`           | Port for the main API (default: 3000)         |
| `GATEWAY_PORT`   | Port for the API Gateway (default: 4000)      |
| `DATABASE_URL`   | Neon PostgreSQL connection string             |

Make sure Azure restarts the app after updating environment variables.

---

## API Endpoints 

### **Auth**
| Method | Endpoint               | Description            |
|--------|------------------------|------------------------|
| POST   | `/api/v1/auth/login`   | Login (Admin / Bank)   |


### **Admin Endpoints**
| Method | Endpoint                                                      | Description                         |
|--------|---------------------------------------------------------------|-------------------------------------|
| GET    | `/api/v1/tuition/unpaid?term=...&page=...&limit=...`          | List unpaid tuition with pagination |
| GET    | `/api/v1/tuition/:studentNo`                                  | Query any student's tuition         |
| POST   | `/api/v1/tuition`                                             | Add single tuition record           |
| POST   | `/api/v1/tuition/batch`                                       | Add batch tuition records           |


### **Bank Endpoints**
| Method | Endpoint                             | Description                   |
|--------|--------------------------------------|-------------------------------|
| GET    | `/api/v1/bank/tuition/:studentNo`    | Query a student's tuition     |
| POST   | `/api/v1/tuition/pay`                | Submit tuition payment        |

---

## System Architecture

Client → API Gateway (4000) → Tuition API (3000) → Neon PostgreSQL

### Architecture Diagram

        ┌──────────────────────────────┐
        │        Client / Tester       │
        └──────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  API Gateway (port 4000)     │
        │  - Logging                   │
        │  - Rate Limiting             │
        │  - Reverse Proxy to API      │
        └──────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  Tuition API (port 3000)     │
        │  - Admin Endpoints           │
        │  - Bank Endpoints            │
        │  - JWT Authentication        │
        └──────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ Neon PostgreSQL (Cloud DB)   │
        │  - tuitions table            │
        └──────────────────────────────┘

---

## Data Model

### **Table: `tuitions`**

| Column        | Type      | Description                |
|---------------|-----------|----------------------------|
| id            | SERIAL PK | Unique record ID           |
| student_no    | VARCHAR   | Student number             |
| term          | VARCHAR   | Academic term              |
| tuition_total | NUMERIC   | Total tuition amount       |
| amount_paid   | NUMERIC   | Amount paid so far         |

### ER Diagram

```text
+--------------------------------------------------+
|                    tuitions                      |
+--------------------------------------------------+
| id            SERIAL PRIMARY KEY                 |
| student_no    VARCHAR                            |
| term          VARCHAR                            |
| tuition_total NUMERIC                            |
| amount_paid   NUMERIC                            |
+--------------------------------------------------+
```

---

## Design Decisions

- A single `tuitions` table was used to keep the database simple and avoid unnecessary relations.
- All write operations (create, batch create) were restricted to the **Admin** role for security.
- **Bank** role is limited to querying and paying tuition, preventing unauthorized data changes.
- Requests go through an **API Gateway** that handles logging and rate limiting, keeping the main API clean.
- JWT-based authentication was chosen for simplicity and statelessness.
- Pagination is included for the unpaid tuition list to support large datasets.
- The API was deployed on Azure App Service, and the database was hosted on Neon PostgreSQL to meet the cloud deployment requirement.

---

## Assumptions

- Each student has at most **one tuition record per term**.
- Partial payments are allowed and reduce the remaining balance.
- `amount_paid` is never allowed to exceed `tuition_total`.
- The Admin role is trusted and responsible for inserting correct tuition data.
- Bank users can only query and pay tuition but cannot modify tuition records directly.
- Students retrieve their own tuition info without authentication (public endpoint).
- Terms follow the format `YEAR-SEASON` (e.g., `2024-FALL`).

---

## Issues Encountered

- Swagger UI on Azure did not send the Authorization header correctly at first, which required adjusting how the token was passed.
- Azure Zip Deploy placed files inside an additional folder, requiring file relocation to `/home/site/wwwroot/` through Kudu.
- Neon PostgreSQL caused connection issues when pooling was enabled, so pooling was disabled for stability.
- The API Gateway initially forwarded the wrong URLs, which caused CORS and routing issues until the server URLs in Swagger were updated.
- Some endpoints returned localhost URLs in Swagger on Azure and needed server configuration adjustments.

---

## Run Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Start the main API (port 3000)
```bash
node index.js
```

### 3. Start the API Gateway (port 4000)
```bash
node gateway.js
```

### 4. Open Swagger UI
http://localhost:4000/swagger

### 5. Local environment variables
Make sure you have a .env file (local only) containing:
DATABASE_URL=your-neon-postgres-connection-string

---

## Deployment Notes (Azure)

- The application was deployed using **Azure App Service (Linux)**.
- Deployment was done via **Kudu Zip Deploy**.
- After uploading, project files needed to be moved into /home/site/wwwroot/
- - Environment variables were added in:

**Azure Portal → App Service → Configuration → Application Settings**

### Required Azure Environment Variables
- `PORT`  
- `GATEWAY_PORT`  
- `DATABASE_URL`  
- `JWT_SECRET`

### Deployment Steps
1. Zip the project folder (excluding `node_modules`).
2. Open the Azure App → `Advanced Tools (Kudu)` → `Zip Deploy`.
3. Upload the zip file.
4. Move extracted files into `/home/site/wwwroot/`.
5. Restart the App Service.
6. Verify deployment using:
 - `/api/v1/health`
 - `/swagger`

### Production URLs
- **API Gateway:**  
https://tuition-payment-api-ffcxa5dsbac0azf5.swedencentral-01.azurewebsites.net

- **Swagger UI:**  
https://tuition-payment-api-ffcxa5dsbac0azf5.swedencentral-01.azurewebsites.net/swagger

---

## Project Video

**Video Link:**  
https://drive.google.com/file/d/1zyv4SJDy5I6dwTPPyW8_c5K6GxlM8M6j/view?usp=sharing

---

## Summary

The Tuition Payment API implements a complete tuition management workflow with two authenticated roles — **Admin** and **Bank** — supported by a cloud-hosted backend on Azure and a Neon PostgreSQL database.

The project includes:
- JWT-based authentication  
- Admin and Bank authorization flows  
- Full CRUD-like tuition operations  
- Payment processing  
- Unpaid tuition listing with pagination  
- API Gateway with logging and rate limiting  
- Swagger/OpenAPI documentation  
- Deployment to Azure App Service

All functional, security, and deployment requirements of the SE4458 Midterm Assignment were successfully completed.
