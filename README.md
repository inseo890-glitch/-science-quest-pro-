# SCIENCE QUEST PRO — Full Project

A complete starter full-stack science quiz app with:
- Responsive quiz UI
- Registration and login
- Server-side score saving and leaderboard
- Protected admin dashboard
- SQLite persistence
- Render deployment support

## Run locally
1. Install Node.js 22.
2. Copy `.env.example` to `.env`.
3. Set a long random `JWT_SECRET` and a private `ADMIN_PASSWORD`.
4. Run `npm install`, then `npm start`.
5. Open `http://localhost:3000`.

## Upload to GitHub using the website
1. Extract this ZIP into a folder.
2. Open your GitHub repository, choose **Add file → Upload files**.
3. Upload the extracted project's files and folders (`package.json`, `.env.example`, `public/`, `server/`, `.gitignore`, and this README) into the repository root. Do not upload the ZIP file itself.
4. Commit the changes to the branch used by Render.

## Render
- Build command: `npm install`
- Start command: `npm start`
- Set environment variables `JWT_SECRET` and `ADMIN_PASSWORD` in Render.
- `DATABASE_PATH` defaults to `./data/science-quest.sqlite`. On Render's ephemeral filesystem, data may reset after redeploy/restart. For persistent data, attach a Render disk and set `DATABASE_PATH` to a path on that disk (for example `/var/data/science-quest.sqlite`).

## Admin
Open `/developer.html` and enter the `ADMIN_PASSWORD` set in Render. The admin password is not stored in the browser.

## Note
This is a newly assembled full project starter, not a byte-for-byte reconstruction of any previous repository. If you have custom features or original content in your old repository, merge them after making a backup.
