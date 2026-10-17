import test from 'node:test'; import assert from 'node:assert/strict';
process.env.ADMIN_EMAILS=' Admin@Example.com ';
process.env.FREE_ACCESS_EMAILS='a@example.com, B@example.com,,';
const m=await import('../lib/accessEmails.ts');
test('admin from ADMIN_EMAILS, case/space-insensitive',()=>{ assert.ok(m.isAdminEmail('admin@example.com')); assert.ok(!m.isAdminEmail('a@example.com')); assert.ok(!m.isAdminEmail('')); });
test('free access from FREE_ACCESS_EMAILS (comma-separated)',()=>{ assert.ok(m.isFreeAccessEmail('a@example.com')); assert.ok(m.isFreeAccessEmail(' b@EXAMPLE.com')); assert.ok(!m.isFreeAccessEmail('admin@example.com')); assert.ok(!m.isFreeAccessEmail(null)); });
test('unset env grants nobody',()=>{ delete process.env.FREE_ACCESS_EMAILS; delete process.env.ADMIN_EMAILS; assert.ok(!m.isFreeAccessEmail('a@example.com')); assert.ok(!m.isAdminEmail('admin@example.com')); });
