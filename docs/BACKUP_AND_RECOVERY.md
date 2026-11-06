# Backup and Recovery (MySQL / MariaDB)

## Hostinger managed database
- hPanel > Websites > Backups: enable automatic backups for your plan and note the retention window.
- Before every deploy that adds a migration, export the database from hPanel > Databases > phpMyAdmin > Export (Quick, SQL), or run:

```bash
mysqldump --single-transaction --routines --default-character-set=utf8mb4 -h DB_HOST -u DB_USER -p DB_NAME > lumina-$(date +%F).sql
```

Store dumps off the server and encrypt them (they contain guest data).

## Restore drill
```bash
mysql --default-character-set=utf8mb4 -h DB_HOST -u DB_USER -p DB_NAME < lumina-YYYY-MM-DD.sql
```
Restore into an empty database, point a staging copy of the app at it, log in, and confirm reservations and invoices load. Run this drill at least quarterly.

## Secrets
Back up `AUTH_ENCRYPTION_KEY` and `INTEGRATION_ENCRYPTION_KEY` separately from database dumps. Without them, stored AI provider keys and integration credentials cannot be decrypted after a restore.
