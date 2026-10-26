# Lumina PMS — Enterprise Backup & Disaster Recovery Architecture

This runbook defines the disaster recovery (DR), automated backup lifecycle, and cryptographic data protection policies for Lumina Property Management System.

---

## 1. Recovery Time & Point Objectives (RTO / RPO)

- **Recovery Point Objective (RPO):** < 5 minutes (via continuous Write-Ahead Logging / WAL archiving).
- **Recovery Time Objective (RTO):** < 30 minutes (full automated database restoration to standby target).

---

## 2. Backup Strategy & Scheduling

### A. Nightly Logical Snapshots (`pg_dump`)
Automated nightly logical backups capture the entire relational schema, table data, and multi-tenant indexes.

```bash
# Automated nightly export command
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL}" \
  --file="/backups/lumina_pms_$(date +%Y%m%d_%H%M%S).dump"
```

### B. Point-In-Time Recovery (PITR) & WAL Archiving
PostgreSQL WAL (Write-Ahead Log) segments are continuously archived to secure object storage (e.g. AWS S3 / Google Cloud Storage with versioning and immutable object locking).

`postgresql.conf` configuration:
```ini
wal_level = replica
archive_mode = on
archive_command = 'gzip < %p | aws s3 cp - s3://lumina-pms-wal-archive/%f.gz'
archive_timeout = 300
```

---

## 3. Encryption at Rest & Key Management

1. **Database Storage Encryption:**
   - Underlying EBS / persistent volumes must be encrypted with AWS KMS / GCP Cloud KMS customer-managed keys (CMK) using AES-256-XTS.
2. **Application-Level Envelope Encryption:**
   - Sensitive third-party credentials (Stripe keys, OTA credentials, AI provider keys) are encrypted at the application layer using hardware-accelerated **AES-256-GCM** before database insertion (`lib/ai/encryption.ts`).
3. **Backup File Encryption:**
   - Dump files are encrypted using GPG / OpenSSL prior to network transmission:
   ```bash
   openssl enc -aes-256-cbc -salt -in backup.dump -out backup.dump.enc -pass file:/etc/lumina/backup.key
   ```

---

## 4. Disaster Recovery & Restoration Runbook

### Step 1: Provision Clean PostgreSQL Target
```bash
# Initialize clean cluster with same PostgreSQL version (v15+)
pg_createcluster 15 main
systemctl start postgresql@15-main
```

### Step 2: Restore Logical Dump
```bash
# Decrypt dump
openssl enc -d -aes-256-cbc -in backup.dump.enc -out backup.dump -pass file:/etc/lumina/backup.key

# Create database and restore
createdb lumina_pms
pg_restore \
  --dbname=lumina_pms \
  --clean \
  --if-exists \
  --no-owner \
  --single-transaction \
  backup.dump
```

### Step 3: Run Database Migrations Check
```bash
# Verify schema matches application expectations
npx prisma migrate status
```

### Step 4: Verification Smoke Test
```bash
# Verify data integrity and multi-tenancy constraints
npm test
```

---

## 5. Automated Backup Retention & Purge Policy

| Tier | Retention Period | Storage Class |
| :--- | :--- | :--- |
| Hourly WAL Segments | 7 days | Standard S3 / Hot Storage |
| Daily Logical Dumps | 30 days | S3 Infrequent Access (IA) |
| Weekly Snapshots | 90 days | S3 Glacier Flexible Retrieval |
| Monthly Historical Dumps | 7 years | S3 Glacier Deep Archive (Compliance) |

Automated application log purging is governed by the Data Retention Service (`lib/retention.ts`), which purges operational activity logs and webhook delivery events older than 90 days.
