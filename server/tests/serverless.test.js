import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../netlify/functions/api.js';
import { runMigrations, getDb } from '../src/db/db.js';
import storage from '../src/services/storage.js';

describe('PulseBoard Netlify Serverless Architecture & Security Tests', () => {
  before(async () => {
    await getDb();
    await runMigrations();
  });

  const createContext = () => ({
    callbackWaitsForEmptyEventLoop: true,
  });

  test('Serverless 1: Netlify handler successfully handles GET /api/health and normalizes path', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/.netlify/functions/api/health',
      headers: {
        host: 'pulseboard.netlify.app',
      },
    };

    const res = await handler(event, createContext());
    assert.strictEqual(res.statusCode, 200);

    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.database.status, 'connected');
    assert.ok(body.storage.provider);
    assert.strictEqual(body.database.password, undefined);
    assert.strictEqual(body.database.url, undefined);
  });

  test('Serverless 2: Netlify handler handles registration, login, and issues same-origin Lax cookie', async () => {
    const email = `serverless_${Date.now()}@pulseboard.io`;
    const password = 'StrongServerlessPassword123!';

    // Register
    const regEvent = {
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({
        name: 'Serverless User',
        email,
        password,
      }),
    };

    const regRes = await handler(regEvent, createContext());
    assert.strictEqual(regRes.statusCode, 201);
    const regBody = JSON.parse(regRes.body);
    assert.strictEqual(regBody.user.email, email);

    // Extract cookie from multiValueHeaders or set-cookie header
    const cookieHeader = regRes.headers?.['set-cookie'] || regRes.multiValueHeaders?.['set-cookie']?.[0] || '';
    assert.ok(cookieHeader.includes('pulseboard.sid='));
    assert.ok(cookieHeader.toLowerCase().includes('httponly'));

    // Extract sid value
    const match = cookieHeader.match(/pulseboard\.sid=([^;]+)/);
    assert.ok(match, 'Expected pulseboard.sid cookie');
    const sidCookie = `pulseboard.sid=${match[1]}`;

    // Login with same credentials
    const loginEvent = {
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/login',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ email, password }),
    };

    const loginRes = await handler(loginEvent, createContext());
    assert.strictEqual(loginRes.statusCode, 200);
  });

  test('Serverless 3: Session persists across separate serverless function invocations via shared store', async () => {
    const email = `persist_${Date.now()}@pulseboard.io`;
    const password = 'PersistPassword123!';

    // 1. First invocation: Register
    const regRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'Persist User', email, password }),
    }, createContext());

    const cookieHeader = regRes.headers?.['set-cookie'] || regRes.multiValueHeaders?.['set-cookie']?.[0] || '';
    const sidMatch = cookieHeader.match(/pulseboard\.sid=([^;]+)/);
    const cookieString = `pulseboard.sid=${sidMatch[1]}`;

    // 2. Second invocation (different event and context): Fetch authenticated profile
    const meRes = await handler({
      httpMethod: 'GET',
      path: '/.netlify/functions/api/auth/me',
      headers: {
        cookie: cookieString,
      },
    }, createContext());

    assert.strictEqual(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.strictEqual(meBody.user.email, email);

    // 3. Third invocation: Create task
    const taskRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/tasks',
      headers: {
        'content-type': 'application/json',
        cookie: cookieString,
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({
        title: 'Serverless Architecture Task',
        priority: 'high',
      }),
    }, createContext());

    assert.strictEqual(taskRes.statusCode, 201);
    const taskBody = JSON.parse(taskRes.body);
    assert.strictEqual(taskBody.task.title, 'Serverless Architecture Task');

    // 4. Fourth invocation: List tasks
    const listRes = await handler({
      httpMethod: 'GET',
      path: '/.netlify/functions/api/tasks',
      headers: {
        cookie: cookieString,
      },
    }, createContext());

    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    assert.ok(listBody.tasks.some(t => t.id === taskBody.task.id));

    // 5. Fifth invocation: Logout invalidates session
    const logoutRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/logout',
      headers: {
        cookie: cookieString,
        origin: 'https://pulseboard.netlify.app',
      },
    }, createContext());
    assert.strictEqual(logoutRes.statusCode, 200);

    // 6. Sixth invocation: Reusing expired/invalidated cookie returns 401
    const postLogoutRes = await handler({
      httpMethod: 'GET',
      path: '/.netlify/functions/api/auth/me',
      headers: {
        cookie: cookieString,
      },
    }, createContext());
    assert.strictEqual(postLogoutRes.statusCode, 401);
  });

  test('Serverless 4: CSRF & origin verification rejects state-changing requests from untrusted origins', async () => {
    const maliciousOriginEvent = {
      httpMethod: 'POST',
      path: '/.netlify/functions/api/tasks',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker-controlled-site.com',
      },
      body: JSON.stringify({
        title: 'Unauthorized CSRF Task',
      }),
    };

    const res = await handler(maliciousOriginEvent, createContext());
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, 'Forbidden');
  });

  test('Serverless 5: Direct upload signature endpoint produces valid signature parameters', async () => {
    const email = `sign_test_${Date.now()}@pulseboard.io`;
    const regRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'Sign User', email, password: 'Password123!' }),
    }, createContext());

    const cookieHeader = regRes.headers?.['set-cookie'] || regRes.multiValueHeaders?.['set-cookie']?.[0] || '';
    const sidMatch = cookieHeader.match(/pulseboard\.sid=([^;]+)/);
    const cookie = `pulseboard.sid=${sidMatch[1]}`;

    const signRes = await handler({
      httpMethod: 'GET',
      path: '/.netlify/functions/api/settings/profile-picture/signature',
      headers: { cookie },
    }, createContext());

    assert.strictEqual(signRes.statusCode, 200);
    const signBody = JSON.parse(signRes.body);

    if (signBody.directUploadSupported) {
      assert.ok(signBody.signature);
      assert.ok(signBody.apiKey);
      assert.ok(signBody.publicId);
      assert.strictEqual(signBody.folder, 'avatars');
      assert.strictEqual(signBody.apiSecret, undefined, 'apiSecret must NEVER be returned to the client');
    } else {
      assert.strictEqual(signBody.directUploadSupported, false);
    }
  });

  test('Serverless 6: Direct upload commit strictly enforces ownership and rejects cross-user asset tampering', async () => {
    // User A
    const userARes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'User A', email: `usera_${Date.now()}@pulseboard.io`, password: 'Password123!' }),
    }, createContext());
    const cookieA = `pulseboard.sid=${(userARes.headers?.['set-cookie'] || userARes.multiValueHeaders?.['set-cookie']?.[0]).match(/pulseboard\.sid=([^;]+)/)[1]}`;

    // User B tries to claim an asset belonging to User A
    const userBRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'User B', email: `userb_${Date.now()}@pulseboard.io`, password: 'Password123!' }),
    }, createContext());
    const cookieB = `pulseboard.sid=${(userBRes.headers?.['set-cookie'] || userBRes.multiValueHeaders?.['set-cookie']?.[0]).match(/pulseboard\.sid=([^;]+)/)[1]}`;

    // User B attempts to commit an avatar with publicId from User A's ID namespace
    const fakeTamperedCommit = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/settings/profile-picture',
      headers: {
        'content-type': 'application/json',
        cookie: cookieB,
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({
        publicId: 'avatars/avatar_someoneelse_12345_abc',
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      }),
    }, createContext());

    assert.strictEqual(fakeTamperedCommit.statusCode, 403, 'Cross-user publicId must be rejected with 403 Forbidden');
  });

  test('Serverless 7: Direct upload commit rejects untrusted image domains', async () => {
    const userRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'Domain User', email: `domain_${Date.now()}@pulseboard.io`, password: 'Password123!' }),
    }, createContext());
    const userObj = JSON.parse(userRes.body).user;
    const cookie = `pulseboard.sid=${(userRes.headers?.['set-cookie'] || userRes.multiValueHeaders?.['set-cookie']?.[0]).match(/pulseboard\.sid=([^;]+)/)[1]}`;

    const sanitizedUserId = userObj.id.replace(/[^a-zA-Z0-9]/g, '');
    const untrustedDomainRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/settings/profile-picture',
      headers: {
        'content-type': 'application/json',
        cookie,
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({
        publicId: `avatars/avatar_${sanitizedUserId}_12345_abc`,
        avatarUrl: 'https://malicious-external-site.com/image.jpg',
      }),
    }, createContext());

    assert.strictEqual(untrustedDomainRes.statusCode, 400, 'Non-Cloudinary image URLs must be rejected');
  });

  test('Serverless 8: Concurrent requests succeed without exhausting connection pool', async () => {
    const email = `concurrent_${Date.now()}@pulseboard.io`;
    const regRes = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/register',
      headers: {
        'content-type': 'application/json',
        origin: 'https://pulseboard.netlify.app',
      },
      body: JSON.stringify({ name: 'Concurrent User', email, password: 'Password123!' }),
    }, createContext());

    const cookie = `pulseboard.sid=${(regRes.headers?.['set-cookie'] || regRes.multiValueHeaders?.['set-cookie']?.[0]).match(/pulseboard\.sid=([^;]+)/)[1]}`;

    // Fire 6 concurrent requests to the serverless handler
    const requests = Array.from({ length: 6 }, (_, i) =>
      handler({
        httpMethod: 'GET',
        path: '/.netlify/functions/api/settings',
        headers: { cookie },
      }, createContext())
    );

    const responses = await Promise.all(requests);
    for (const res of responses) {
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.settings);
    }
  });
});
