# DTEmpire Adventure — Web Dashboard

Self-hosted Flask web application for the DTEmpire Adventure game. Play via browser with Discord OAuth2 login, email OTP, leaderboards, dungeons, pets, guilds, and more.

## Features

- **Discord OAuth2 Login** — One-click authentication
- **Email OTP Login** — Alternative login via SMTP
- **Game Dashboard** — Profile, inventory, stats, leaderboard
- **Dungeons & Tower** — Turn-based combat, progression
- **Pets & Skills** — Collect, train, battle pets
- **Guilds & Jobs** — Cooperative play, daily tasks
- **PWA Support** — Installable, offline-capable
- **R2/S3 Backups** — Automatic encrypted player backups

## Quick Start (Docker)

```bash
# Clone
git clone https://github.com/hyperdargo/DTEmpire-Adventure.git
cd DTEmpire-Adventure

# Configure
cp .env.example .env
# Edit .env with your values (see Configuration below)

# Run
docker compose up -d
```

Access at `http://localhost:8081`

## Manual Install

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit .env
gunicorn --bind 0.0.0.0:8081 web.app:app
```

## Configuration

Required variables in `.env`:

| Variable | Description |
|----------|-------------|
| `WEB_SECRET_KEY` | Flask session secret (generate with `secrets.token_hex(32)`) |
| `DISCORD_CLIENT_ID` | Discord OAuth2 application Client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 application Client Secret |
| `DISCORD_REDIRECT_URI` | OAuth2 redirect (e.g. `https://your-domain.com/callback`) |
| `DISCORD_HOME_GUILD_ID` | Your Discord server ID for member verification |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_EMAIL` | Sender email address |
| `SMTP_PASSWORD` | SMTP password / App Password |

Optional:

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Webhook for web→Discord notifications |
| `ADVENTURE_R2_ENDPOINT` | R2/S3 endpoint for backups |
| `ADVENTURE_R2_ACCESS_KEY_ID` | R2 access key |
| `ADVENTURE_R2_SECRET_ACCESS_KEY` | R2 secret key |
| `ADVENTURE_R2_BUCKET` | R2 bucket name |
| `ADVENTURE_BACKUP_FERNET_KEY` | Encryption key for backups (32 bytes base64) |
| `WEB_PORT` | Port (default 8081) |
| `WEB_RELOADER` | Enable Flask reloader (0/1) |

## Discord OAuth2 Setup

1. Go to https://discord.com/developers/applications
2. Create application → OAuth2 → Add redirect: `https://your-domain.com/callback`
3. Enable `identify` and `email` scopes
4. Copy Client ID / Secret to `.env`

## R2 Backup Setup (Optional)

```bash
# Generate Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add to `.env` as `ADVENTURE_BACKUP_FERNET_KEY`. Backups run automatically after player saves (5-min throttle).

## Project Structure

```
DTEmpire-Adventure/
├── web/
│   ├── app.py              # Main Flask application
│   ├── game_data.py        # Game data definitions
│   ├── game_logic.py       # Game logic helpers
│   ├── static/             # Static assets (logo, icons, JS)
│   └── templates/          # Jinja2 templates
├── data/
│   ├── version.json        # Game version info
│   └── guild_shops.json    # Guild shop data
├── requirements.txt        # Python dependencies
├── .env.example            # Template for environment variables
├── Dockerfile              # Container image
├── docker-compose.yml      # Docker Compose
��── .gitignore
```

## Health Check

`GET /health` — Returns `{"status": "ok"}` for container health checks.

## License

MIT — See LICENSE for details.