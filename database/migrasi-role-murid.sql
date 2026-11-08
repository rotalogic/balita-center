-- Tambah peran "murid" (belum ada di seed): hanya boleh lihat data sendiri + RSVP kegiatan.
INSERT INTO roles (code, name, description)
VALUES ('murid', 'Murid / Siswa', 'Akun murid: melihat data sendiri dan RSVP kegiatan')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.code IN ('child.view_own', 'events.rsvp')
 WHERE r.code = 'murid'
ON CONFLICT DO NOTHING;

SELECT r.code || ' → ' || string_agg(p.code, ', ' ORDER BY p.code)
  FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id
  JOIN permissions p ON p.id = rp.permission_id
 WHERE r.code = 'murid'
 GROUP BY r.code;
