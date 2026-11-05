# Self-hosting Mira

Mira is self-hosted: one person in the household runs the server, and everyone's phones sync through it. This guide is for that person. It covers what the server stores, how to back it up, and how to reach it securely from outside your home network.

To install and start the server, see [Deploy the server](../README.md#deploy-the-server) in the README.

## What the server stores

Everything lives in one folder: `/data` inside the container (the `mira-data` volume), or `MIRA_DATA_DIR` when you run the server without a container.

| File | What it is |
| --- | --- |
| `mira.db` | The household: lists, items, groups and profiles. |
| `mira.db-wal`, `mira.db-shm` | SQLite's write-ahead log. They belong to `mira.db` and can hold recent changes that aren't in `mira.db` yet. |

The household password isn't in this folder. It comes from `MIRA_PASSWORD` or `MIRA_PASSWORD_FILE`.

## Backups

Back up the database regularly, for example nightly. Don't copy `mira.db` while the server is running: the newest changes may still be in `mira.db-wal`, and a plain file copy can catch the database halfway through a write.

### Back up while the server runs

SQLite's `VACUUM INTO` writes a consistent copy of the live database. The container has no `sqlite3` tool, but its Node can run it:

```sh
# Docker (use `podman` in place of `docker` for Podman)
docker exec mira node -e "new (require('node:sqlite').DatabaseSync)('/data/mira.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker cp mira:/data/backup.db "mira-$(date +%F).db"
docker exec mira rm /data/backup.db
```

Node prints an "experimental feature" warning. It's harmless.

Without a container, run the same `node -e` line on the host, pointing at your `MIRA_DATA_DIR`.

To run it nightly, put those three lines in a script and call it from a systemd timer or cron. Keep a few days of copies, and keep at least one somewhere other than the server's disk.

### Or: stop the server and copy the folder

```sh
docker stop mira
docker run --rm -v mira-data:/data -v "$PWD":/backup alpine tar czf "/backup/mira-$(date +%F).tgz" -C /data .
docker start mira
```

### Restore

1. Stop the server.
2. Replace `mira.db` in the data folder with your backup, and delete `mira.db-wal` and `mira.db-shm` if they exist. Leftover WAL files from the old database would be applied on top of the restored one.
3. Start the server.

Phones keep their own copy of the household. When they reconnect they sync it back to the server, so changes made after the backup come back too, as long as some phone still has them.

### If the server's data is lost with no backup

Every phone holds a full copy of the household. A fresh, empty server with the same password receives that copy from the first phone that syncs. This should work by design but hasn't been tested yet, so treat it as a last resort and keep real backups.

## Reaching the server securely

On your home network, plain `http://` is fine: the app talks straight to the server, and nothing leaves the house.

Use HTTPS as soon as the server is reachable from anywhere else. The app sends the household password every time it connects, and over plain HTTP anyone between the phone and the server can read it. Browsers also only install the web app (PWA) and run it offline over HTTPS.

Pick one of these:

### Tailscale (simplest when everyone is on your tailnet)

```sh
tailscale serve --bg 8787
```

The server is then at `https://<machine-name>.<your-tailnet>.ts.net`, only to devices on your tailnet, with a certificate Tailscale manages. Enter that address in the app.

### Caddy (a public domain you own)

Point a DNS record at the machine, open ports 80 and 443, and use this `Caddyfile`:

```
mira.example.com {
	reverse_proxy localhost:8787
}
```

Caddy gets and renews the certificate itself, and passes the app's WebSocket through without extra config.

### Cloudflare Tunnel (no open ports)

Run `cloudflared` with a tunnel whose public hostname points at `http://localhost:8787`. Cloudflare provides the certificate and forwards WebSockets.

Whichever you choose, keep port 8787 closed to the internet. Only the proxy should reach it.

## Updating the server

```sh
git pull
docker compose up -d --build        # or: podman build ... then systemctl --user restart mira
```

Your data stays in the `mira-data` volume across rebuilds. Take a backup first.
