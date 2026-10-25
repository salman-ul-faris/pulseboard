import { Router } from 'express';
import { checkHealth } from '../db/db.js';
import { isStorageCloudConfigured } from '../services/storage.js';

const router = Router();

router.get('/', async (req, res) => {
  const dbHealth = await checkHealth();
  const uptime = process.uptime();

  const isHealthy = dbHealth.ok;
  const status = isHealthy ? 'healthy' : 'degraded';

  return res.status(isHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    service: 'pulseboard-api',
    database: {
      status: dbHealth.status,
      engine: dbHealth.engine,
    },
    storage: {
      provider: isStorageCloudConfigured() ? 'cloudinary' : 'local',
      cloudConfigured: isStorageCloudConfigured(),
    },
  });
});

export default router;
