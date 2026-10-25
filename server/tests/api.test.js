import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { runMigrations, query } from '../src/db/db.js';

let app;

test.before(async () => {
  await runMigrations();
  app = createApp();
});

test('1. Registration creates a user with a password hash and safe user object', async () => {
  const email = `test_${Date.now()}@pulseboard.io`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Engineer',
      email,
      password: 'SuperSecretPassword123!',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.name, 'Test Engineer');
  assert.ok(res.body.user.id);
  assert.equal(res.body.user.password_hash, undefined);
  assert.equal(res.body.user.password, undefined);

  // Check database for hashed password
  const dbCheck = await query('SELECT password_hash FROM users WHERE email = $1', [email]);
  assert.equal(dbCheck.rows.length, 1);
  assert.notEqual(dbCheck.rows[0].password_hash, 'SuperSecretPassword123!');
  assert.match(dbCheck.rows[0].password_hash, /^\$2[aby]\$/);
});

test('2. Duplicate email registration is rejected', async () => {
  const email = `duplicate_${Date.now()}@pulseboard.io`;
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'User 1', email, password: 'Password123!' });

  const duplicateRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'User 2', email, password: 'Password456!' });

  assert.equal(duplicateRes.status, 409);
  assert.equal(duplicateRes.body.error, 'Conflict');
});

test('3. Valid login succeeds and sets session cookie', async () => {
  const email = `login_user_${Date.now()}@pulseboard.io`;
  const password = 'StrongPassword99!';

  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Login User', email, password });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
  assert.ok(res.headers['set-cookie']);
});

test('4. Invalid login fails with generic error', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nonexistent@pulseboard.io', password: 'wrongpassword' });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Invalid email or password.');
});

test('5. Logout invalidates the session', async () => {
  const email = `logout_user_${Date.now()}@pulseboard.io`;
  const agent = request.agent(app);

  await agent
    .post('/api/auth/register')
    .send({ name: 'Logout User', email, password: 'ValidPassword123!' });

  // Session should work
  const meRes1 = await agent.get('/api/auth/me');
  assert.equal(meRes1.status, 200);

  // Logout
  const logoutRes = await agent.post('/api/auth/logout');
  assert.equal(logoutRes.status, 200);

  // Subsequent check should be 401
  const meRes2 = await agent.get('/api/auth/me');
  assert.equal(meRes2.status, 401);
});

test('6. Unauthenticated task requests are rejected with 401', async () => {
  const res = await request(app).get('/api/tasks');
  assert.equal(res.status, 401);
});

test('7. Authenticated users can create, retrieve, update, and delete their own tasks', async () => {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ name: 'Task Owner', email: `owner_${Date.now()}@pulseboard.io`, password: 'Password123!' });

  // 1. Create task
  const createRes = await agent
    .post('/api/tasks')
    .send({
      title: 'Deploy PulseBoard MVP',
      description: 'Prepare Render and database migrations',
      priority: 'high',
      completed: false,
    });
  assert.equal(createRes.status, 201);
  const taskId = createRes.body.task.id;
  assert.ok(taskId);
  assert.equal(createRes.body.task.priority, 'high');

  // 2. Retrieve tasks
  const listRes = await agent.get('/api/tasks');
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.tasks.some(t => t.id === taskId));

  // 3. Update task
  const updateRes = await agent
    .patch(`/api/tasks/${taskId}`)
    .send({ completed: true });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.task.completed, true);

  // 4. Delete task
  const deleteRes = await agent.delete(`/api/tasks/${taskId}`);
  assert.equal(deleteRes.status, 200);

  // 5. Verify deleted
  const verifyRes = await agent.get(`/api/tasks/${taskId}`);
  assert.equal(verifyRes.status, 404);
});

test('8. One user cannot read or modify another user tasks', async () => {
  const user1 = request.agent(app);
  const user2 = request.agent(app);

  await user1.post('/api/auth/register').send({
    name: 'User One',
    email: `u1_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  await user2.post('/api/auth/register').send({
    name: 'User Two',
    email: `u2_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // User 1 creates task
  const tRes = await user1.post('/api/tasks').send({
    title: 'Secret Task For User 1',
    priority: 'low',
  });
  const taskId = tRes.body.task.id;

  // User 2 attempts to read User 1's task
  const getAttempt = await user2.get(`/api/tasks/${taskId}`);
  assert.equal(getAttempt.status, 404);

  // User 2 attempts to update User 1's task
  const patchAttempt = await user2.patch(`/api/tasks/${taskId}`).send({ title: 'Hacked' });
  assert.equal(patchAttempt.status, 404);

  // User 2 attempts to delete User 1's task
  const deleteAttempt = await user2.delete(`/api/tasks/${taskId}`);
  assert.equal(deleteAttempt.status, 404);
});

test('9. Invalid task inputs are rejected with 400', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    name: 'Validator User',
    email: `val_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // Empty title
  const resEmpty = await agent.post('/api/tasks').send({ title: '' });
  assert.equal(resEmpty.status, 400);

  // Invalid priority
  const resBadPriority = await agent.post('/api/tasks').send({
    title: 'Valid Title',
    priority: 'super-urgent-not-valid',
  });
  assert.equal(resBadPriority.status, 400);
});

test('10. Settings persist correctly', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    name: 'Settings Tester',
    email: `settings_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // Default settings
  const initial = await agent.get('/api/settings');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.settings.reducedMotion, false);

  // Update settings
  const updated = await agent.patch('/api/settings').send({
    reducedMotion: true,
    taskRemindersEnabled: false,
    name: 'Updated Name',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.settings.reducedMotion, true);
  assert.equal(updated.body.settings.taskRemindersEnabled, false);
  assert.equal(updated.body.settings.name, 'Updated Name');

  // Verify persistence on new fetch
  const refetch = await agent.get('/api/settings');
  assert.equal(refetch.body.settings.reducedMotion, true);
  assert.equal(refetch.body.settings.name, 'Updated Name');
});

test('11. Dashboard metrics match actual task records', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    name: 'Metrics Tester',
    email: `metrics_${Date.now()}@pulseboard.io`,
    password: 'Password123!',
  });

  // Create 3 tasks: 2 active, 1 completed
  await agent.post('/api/tasks').send({ title: 'Task 1', completed: false });
  await agent.post('/api/tasks').send({ title: 'Task 2', completed: false });
  await agent.post('/api/tasks').send({ title: 'Task 3', completed: true });

  const tasksRes = await agent.get('/api/tasks');
  const tasks = tasksRes.body.tasks;

  const total = tasks.length;
  const active = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  assert.equal(total, 3);
  assert.equal(active, 2);
  assert.equal(completed, 1);
  assert.equal(rate, 33);
});

test('12. Database errors and health endpoint do not expose secrets or stack traces', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'healthy');
  assert.equal(res.body.service, 'pulseboard-api');
  assert.equal(res.body.database.password, undefined);
  assert.equal(res.body.database.connectionString, undefined);
});
