Hardcoded admin credentials (development only)

This project seeds an admin user with the following credentials for development convenience:

- email: admin@chatapp.com
- password: qwerty12

Notes:
- The admin is created by `server/seed.js`. The seed file now hardcodes the admin email and password.
- The admin login endpoint (`POST /api/auth/admin/login`) also accepts the hardcoded email/password pair and will create an admin user in the database if one does not already exist.
- These hardcoded credentials are intended for local development only. Do NOT use them in production.

How to create the admin (local dev):

1. Ensure your Postgres database is running and `DATABASE_URL` (or equivalent) is configured in your environment.
2. Run the seed script from the project root:

   node server/seed.js

How to login as admin (example):

- POST /api/auth/admin/login with JSON body:
  {
    "email": "admin@chatapp.com",
    "password": "qwerty12"
  }

If the database is not running, the seed script will fail with a connection error (ECONNREFUSED). If you prefer not to run the seed, the `adminLogin` controller will create the admin on first successful login with the hardcoded pair.

If you want to change the credentials, edit `server/seed.js` and `server/controllers/auth.controller.js` to update the hardcoded values.
