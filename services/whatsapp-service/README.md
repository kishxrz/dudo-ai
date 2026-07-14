# Dudo WhatsApp Integration Service

This is a standalone multi-tenant microservice for managing persistent WhatsApp connections using `whatsapp-web.js` and Puppeteer. It is designed to be hosted on Railway.

## Configuration & Environment Variables

Make sure the following variables are configured in your Railway project settings:

* `PORT`: The port the service runs on (provided by Railway dynamically).
* `WHATSAPP_SERVICE_SECRET`: A secure token to protect the service endpoints. Must match Dudo's `WHATSAPP_SERVICE_SECRET`.
* `WHATSAPP_SESSION_PATH`: Absolute path to mount the Railway persistent Volume (e.g. `/data/whatsapp-sessions`).
* `DUDO_BASE_URL`: The production URL of the main Dudo Next.js app (e.g. `https://dudo.vercel.app`).
* `WHATSAPP_INTERNAL_SECRET`: Secure secret token to sign requests sent to Dudo's internal webhook. Must match Dudo's `WHATSAPP_INTERNAL_SECRET`.

## Deployment on Railway

1. Add a new service on Railway.
2. Select Github repository and set the root directory to `services/whatsapp-service`.
3. Create a persistent Volume named `data` and mount it to `/data`.
4. Configure all environment variables listed above.
