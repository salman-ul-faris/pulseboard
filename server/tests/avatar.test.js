import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { runMigrations, query } from '../src/db/db.js';
import storage from '../src/services/storage.js';

let app;
let validPngBuffer;
let validJpegBuffer;

test.before(async () => {
  await runMigrations();
  app = createApp();

  // Generate authentic raster test image buffers
  validPngBuffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 56, g: 242, b: 165 },
    },
  }).png().toBuffer();

  validJpegBuffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 84, g: 200, b: 232 },
    },
  }).jpeg().toBuffer();
});

test('Avatar 1: Authenticated user can upload a valid image', async () => {
  const agent = request.agent(app);
  const email = `avatar_user1_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Avatar User 1',
    email,
    password: 'Password123!',
  });

  const res = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'test-avatar.png');

  assert.equal(res.status, 200);
  assert.ok(res.body.avatarUrl);
  assert.equal(res.body.message, 'Profile picture updated successfully');
});

test('Avatar 2: Stored image reference persists after reloading profile and me endpoint', async () => {
  const agent = request.agent(app);
  const email = `avatar_persist_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Persist User',
    email,
    password: 'Password123!',
  });

  const uploadRes = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'profile.png');
  const uploadedUrl = uploadRes.body.avatarUrl;

  // Verify in GET /api/settings
  const settingsRes = await agent.get('/api/settings');
  assert.equal(settingsRes.status, 200);
  assert.equal(settingsRes.body.settings.avatarUrl, uploadedUrl);

  // Verify in GET /api/auth/me
  const meRes = await agent.get('/api/auth/me');
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.avatarUrl, uploadedUrl);
});

test('Avatar 3: Authenticated user can replace an existing image', async () => {
  const agent = request.agent(app);
  const email = `avatar_replace_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Replace User',
    email,
    password: 'Password123!',
  });

  // First upload
  const firstRes = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'first.png');
  const firstUrl = firstRes.body.avatarUrl;

  // Replace with second upload
  const secondRes = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validJpegBuffer, 'second.jpeg');
  const secondUrl = secondRes.body.avatarUrl;

  assert.equal(secondRes.status, 200);
  assert.notEqual(firstUrl, secondUrl);

  // Verify second image persists
  const meRes = await agent.get('/api/auth/me');
  assert.equal(meRes.body.user.avatarUrl, secondUrl);
});

test('Avatar 4: Authenticated user can remove their picture and restore default avatar', async () => {
  const agent = request.agent(app);
  const email = `avatar_remove_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Remove User',
    email,
    password: 'Password123!',
  });

  // Upload first
  await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'to-remove.png');

  // Remove avatar
  const deleteRes = await agent.delete('/api/settings/profile-picture');
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.avatarUrl, null);

  // Verify me and settings return null
  const meRes = await agent.get('/api/auth/me');
  assert.equal(meRes.body.user.avatarUrl, null);

  const settingsRes = await agent.get('/api/settings');
  assert.equal(settingsRes.body.settings.avatarUrl, null);
});

test('Avatar 5: Unauthenticated upload is rejected with 401', async () => {
  const res = await request(app)
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'unauth.png');

  assert.equal(res.status, 401);
});

test('Avatar 6: Invalid file signatures (fake image) are rejected with 400', async () => {
  const agent = request.agent(app);
  const email = `avatar_fake_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Fake Signature User',
    email,
    password: 'Password123!',
  });

  // Text file disguised as png
  const fakePngBuffer = Buffer.from('Plain text disguised as an image file payload');
  const res = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', fakePngBuffer, 'malicious.png');

  assert.equal(res.status, 400);
  assert.match(res.body.message, /not a supported raster image/i);
});

test('Avatar 7: SVG, executable, and unsupported formats are rejected with 400', async () => {
  const agent = request.agent(app);
  const email = `avatar_svg_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'SVG Tester',
    email,
    password: 'Password123!',
  });

  // Raw SVG XML payload
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
  const res = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', svgBuffer, 'exploit.svg');

  assert.equal(res.status, 400);
});

test('Avatar 8: Files exceeding the 5MB size limit are rejected with 400', async () => {
  const agent = request.agent(app);
  const email = `avatar_large_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'Oversized User',
    email,
    password: 'Password123!',
  });

  // 5.5 MB dummy buffer
  const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
  const res = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', largeBuffer, 'huge.png');

  assert.equal(res.status, 400);
});

test('Avatar 9: One user cannot modify or delete another user profile picture', async () => {
  const user1 = request.agent(app);
  const user2 = request.agent(app);

  await user1.post('/api/auth/register').send({
    name: 'Target User',
    email: `target_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  await user2.post('/api/auth/register').send({
    name: 'Attacker User',
    email: `attacker_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // User 1 uploads picture
  const uploadRes = await user1
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'target.png');
  const user1Url = uploadRes.body.avatarUrl;

  // User 2 deletes their own avatar (should not affect User 1)
  await user2.delete('/api/settings/profile-picture');

  // Verify User 1 avatar is untouched
  const checkUser1 = await user1.get('/api/auth/me');
  assert.equal(checkUser1.body.user.avatarUrl, user1Url);
});

test('Avatar 10: Upload and storage errors do not expose secrets or stack traces', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    name: 'Stack Trace Checker',
    email: `sec_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // Send request with no file attached
  const res = await agent.post('/api/settings/profile-picture');
  assert.equal(res.status, 400);
  assert.equal(res.body.stack, undefined);
  assert.equal(res.body.secret, undefined);
  assert.ok(res.body.message);
});

test('Avatar 11: Failed replacement does not destroy the previous working picture', async () => {
  const agent = request.agent(app);
  const email = `fail_safe_${Date.now()}@pulseboard.io`;

  await agent.post('/api/auth/register').send({
    name: 'FailSafe User',
    email,
    password: 'Password123!',
  });

  // Successful initial upload
  const firstRes = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', validPngBuffer, 'initial.png');
  const initialUrl = firstRes.body.avatarUrl;

  // Attempt replacement with corrupt file
  const corruptBuffer = Buffer.from('not an image');
  const failedRes = await agent
    .post('/api/settings/profile-picture')
    .attach('avatar', corruptBuffer, 'corrupt.png');

  assert.equal(failedRes.status, 400);

  // Verify the previous working picture is still active and intact
  const meRes = await agent.get('/api/auth/me');
  assert.equal(meRes.body.user.avatarUrl, initialUrl);
});
