#!/usr/bin/env python3
"""Buat user admin di DB. Hash scrypt kompatibel dengan src/lib/password.ts."""
import base64
import hashlib
import os
import secrets
import subprocess
import sys

email = sys.argv[1] if len(sys.argv) > 1 else "admin@balitacenter.id"
password = sys.argv[2] if len(sys.argv) > 2 else secrets.token_urlsafe(9)
full_name = sys.argv[3] if len(sys.argv) > 3 else "Administrator"
role = sys.argv[4] if len(sys.argv) > 4 else "super_admin"

# Node scryptSync default: N=16384, r=8, p=1, dklen=64
salt = os.urandom(16)
digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
stored = f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

sql = f"""
INSERT INTO users (full_name, email, password_hash, role, is_active, created_at, updated_at)
VALUES ('{full_name}', '{email.lower()}', '{stored}', '{role}', true, now(), now())
ON CONFLICT (email) DO UPDATE
   SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = now()
RETURNING email, role;
"""

result = subprocess.run(
    ["sudo", "docker", "exec", "-i", "-u", "postgres", "balita-db",
     "psql", "-v", "ON_ERROR_STOP=1", "-d", "balita_center"],
    input=sql, capture_output=True, text=True)

print(result.stdout.strip() or result.stderr.strip())
if result.returncode == 0:
    print(f"EMAIL={email.lower()}")
    print(f"PASSWORD={password}")
