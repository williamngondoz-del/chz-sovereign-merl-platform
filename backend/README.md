# Coalition Health Zambia (CHZ) — Modular Django + PostgreSQL Production Blueprint

This directory holds the 1:1 production backend architecture aligning with **EMCA Consultancy's CHZ Technical Proposal**:

- **Framework**: Django 5.1 + Django REST Framework + `django-otp` (TOTP/FIDO2 MFA) + `django-axes` (brute-force rate limiting)
- **Database**: PostgreSQL 16 (ACID transactions, unique constraints on `(programme, province, indicator_code, quarter)`, append-only trigger on `AuditEvent`)
- **Private Storage**: S3 / MinIO private bucket with server-side AES-256-KMS encryption and short-lived presigned downloads mediated strictly through RBAC views
- **Public CMS Feed**: Read-only materialized view / serialized endpoint `/api/v1/public/factsheets.json` exposing ONLY DPA-cleared (`n >= 10`, PII-free, MERL-locked) `PublishedSnapshot` rows with ETag cache invalidation on instant withdrawal

## Files
- `chz_merl/models.py` — Relational models for all 6 workstreams + append-only SHA-256 `AuditEvent`
- `chz_merl/permissions.py` — 6-Role RBAC least-privilege DRF permissions (including `IT Admin`) + MFA verification check
- `chz_merl/dpa_guard.py` — Zambia Data Protection Act No. 3 of 2021 small-cell & Zambian NRC/phone PII guard + formula-safe CSV sanitizer
- `scripts/backup_restore.sh` — Encrypted `pg_dump` backup, SHA-256 verification, and Gate 3 staging restore verification script
