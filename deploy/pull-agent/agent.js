/**
 * Scoliologic Wiki - GitOps Pull Agent
 * 
 * Автоматически проверяет GitHub репозиторий на наличие изменений
 * и обновляет приложение с возможностью отката при ошибках.
 * 
 * Функции:
 * - Периодическая проверка GitHub репозитория
 * - Автоматический git pull при обнаружении изменений
 * - Проверка изменений в package.json для пересборки
 * - Автоматическое применение миграций БД
 * - Перезапуск приложения после обновления
 * - Откат при ошибках деплоя
 * - Уведомления в Telegram/Slack
 * - Веб-интерфейс для статуса и истории
 * - GitHub Webhook для мгновенного деплоя при push
 */

import express from 'express';
import cron from 'node-cron';
import Docker from 'dockerode';
import simpleGit from 'simple-git';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

// ============================================
// CONFIGURATION
// ============================================

const config = {
  // Git settings
  repoUrl: process.env.GIT_REPO_URL || 'https://github.com/sileade/scoliologic-wiki.git',
  branch: process.env.GIT_BRANCH || 'main',
  token: process.env.GIT_TOKEN || '',
  repoPath: process.env.REPO_PATH || '/app/repo',
  
  // Pull interval in seconds
  pullInterval: parseInt(process.env.PULL_INTERVAL || '300', 10),
  
  // Docker settings
  appContainer: process.env.APP_CONTAINER || 'wiki-app',
  composeFile: process.env.COMPOSE_FILE || 'docker-compose.full.yml',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Backup settings
  keepBackups: parseInt(process.env.KEEP_BACKUPS || '5', 10),
  rollbackOnFailure: process.env.ROLLBACK_ON_FAILURE !== 'false',
  backupPath: process.env.BACKUP_PATH || '/app/backups',
  
  // Notifications
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  
  // Server
  port: parseInt(process.env.PORT || '8080', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Webhook settings
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  webhookEnabled: process.env.WEBHOOK_ENABLED !== 'false',
  webhookEvents: (process.env.WEBHOOK_EVENTS || 'push,release').split(',').map(e => e.trim()),
};

// ============================================
// LOGGING
// ============================================

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pull-agent' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new DailyRotateFile({
      filename: '/app/logs/pull-agent-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// ============================================
// STATE
// ============================================

const state = {
  lastCheck: null,
  lastUpdate: null,
  lastCommit: null,
  status: 'idle', // idle, checking, updating, error
  error: null,
  history: [],
  isRunning: false,
  stats: {
    totalChecks: 0,
    totalUpdates: 0,
    totalErrors: 0,
    totalRollbacks: 0,
    totalWebhooks: 0,
    webhookErrors: 0
  },
  webhook: {
    lastReceived: null,
    lastEvent: null,
    lastSender: null
  }
};

// Load state from file on startup
async function loadState() {
  try {
    const data = await fs.readFile('/app/data/state.json', 'utf-8');
    const saved = JSON.parse(data);
    Object.assign(state, saved);
    logger.info('State loaded from file');
  } catch (error) {
    logger.info('No saved state found, starting fresh');
  }
}

// Save state to file
async function saveState() {
  try {
    await fs.writeFile('/app/data/state.json', JSON.stringify(state, null, 2));
  } catch (error) {
    logger.error('Failed to save state:', error);
  }
}

// ============================================
// DOCKER CLIENT
// ============================================

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// ============================================
// GIT CLIENT
// ============================================

function getGit() {
  const gitOptions = {
    baseDir: config.repoPath,
    binary: 'git',
    maxConcurrentProcesses: 1,
  };
  
  // Add authentication if token provided
  if (config.token) {
    const authUrl = config.repoUrl.replace(
      'https://',
      `https://${config.token}@`
    );
    gitOptions.config = [`url.${authUrl}.insteadOf=${config.repoUrl}`];
  }
  
  return simpleGit(gitOptions);
}

// ============================================
// NOTIFICATIONS
// ============================================

async function sendTelegramNotification(message) {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );
    
    if (!response.ok) {
      logger.warn('Failed to send Telegram notification:', await response.text());
    }
  } catch (error) {
    logger.error('Telegram notification error:', error);
  }
}

async function sendSlackNotification(message, isError = false) {
  if (!config.slackWebhookUrl) return;
  
  try {
    const response = await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        attachments: [{
          color: isError ? 'danger' : 'good',
          text: message
        }]
      })
    });
    
    if (!response.ok) {
      logger.warn('Failed to send Slack notification:', await response.text());
    }
  } catch (error) {
    logger.error('Slack notification error:', error);
  }
}

async function notify(message, isError = false) {
  logger.info(`Notification: ${message}`);
  await Promise.all([
    sendTelegramNotification(isError ? `⚠️ ${message}` : `✅ ${message}`),
    sendSlackNotification(message, isError)
  ]);
}

// ============================================
// BACKUP & RESTORE
// ============================================

async function createBackup(commitHash) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(config.backupPath, `backup-${timestamp}-${commitHash.slice(0, 8)}`);
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    
    // Backup current code state
    await execAsync(`cp -r ${config.repoPath}/.git ${backupDir}/`);
    await execAsync(`cp ${config.repoPath}/package.json ${backupDir}/`);
    await execAsync(`cp ${config.repoPath}/pnpm-lock.yaml ${backupDir}/ 2>/dev/null || true`);
    
    // Save current commit hash
    await fs.writeFile(path.join(backupDir, 'commit.txt'), commitHash);
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    logger.info(`Backup created: ${backupDir}`);
    return backupDir;
  } catch (error) {
    logger.error('Failed to create backup:', error);
    throw error;
  }
}

async function cleanupOldBackups() {
  try {
    const entries = await fs.readdir(config.backupPath, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
      .map(e => ({
        name: e.name,
        path: path.join(config.backupPath, e.name)
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
    
    // Remove old backups
    for (let i = config.keepBackups; i < backups.length; i++) {
      await fs.rm(backups[i].path, { recursive: true });
      logger.info(`Removed old backup: ${backups[i].name}`);
    }
  } catch (error) {
    logger.warn('Failed to cleanup old backups:', error);
  }
}

async function rollback(backupDir) {
  try {
    logger.info(`Rolling back to: ${backupDir}`);
    
    // Get commit hash from backup
    const commitHash = await fs.readFile(path.join(backupDir, 'commit.txt'), 'utf-8');
    
    // Reset to previous commit
    const git = getGit();
    await git.reset(['--hard', commitHash.trim()]);
    
    // Rebuild and restart
    await rebuildApp();
    
    state.stats.totalRollbacks++;
    await notify(`🔄 Rollback completed to commit ${commitHash.slice(0, 8)}`);
    
    return true;
  } catch (error) {
    logger.error('Rollback failed:', error);
    await notify(`❌ Rollback failed: ${error.message}`, true);
    return false;
  }
}

// ============================================
// DEPLOYMENT
// ============================================

async function checkForUpdates() {
  if (state.isRunning) {
    logger.info('Update check already in progress, skipping');
    return false;
  }
  
  state.isRunning = true;
  state.status = 'checking';
  state.lastCheck = new Date().toISOString();
  state.stats.totalChecks++;
  
  try {
    const git = getGit();
    
    // Fetch latest changes
    await git.fetch(['origin', config.branch]);
    
    // Get current and remote commit hashes
    const localCommit = await git.revparse(['HEAD']);
    const remoteCommit = await git.revparse([`origin/${config.branch}`]);
    
    logger.info(`Local: ${localCommit.slice(0, 8)}, Remote: ${remoteCommit.slice(0, 8)}`);
    
    if (localCommit.trim() !== remoteCommit.trim()) {
      logger.info('Updates available, starting deployment');
      await performUpdate(localCommit.trim(), remoteCommit.trim());
      return true;
    } else {
      logger.debug('No updates available');
      state.status = 'idle';
      return false;
    }
  } catch (error) {
    logger.error('Error checking for updates:', error);
    state.status = 'error';
    state.error = error.message;
    state.stats.totalErrors++;
    await notify(`❌ Update check failed: ${error.message}`, true);
    return false;
  } finally {
    state.isRunning = false;
    await saveState();
  }
}

async function performUpdate(oldCommit, newCommit) {
  state.status = 'updating';
  const startTime = Date.now();
  let backupDir = null;
  
  try {
    // Create backup before update
    backupDir = await createBackup(oldCommit);
    
    const git = getGit();
    
    // Pull changes
    logger.info('Pulling changes...');
    await git.pull('origin', config.branch);
    
    // Get commit info
    const log = await git.log({ maxCount: 1 });
    const commitInfo = log.latest;
    
    // Check if package.json changed
    const diff = await git.diff([oldCommit, newCommit, '--name-only']);
    const needsRebuild = diff.includes('package.json') || diff.includes('pnpm-lock.yaml');
    
    if (needsRebuild) {
      logger.info('Dependencies changed, rebuilding...');
      await rebuildApp();
    } else {
      logger.info('Only code changes, restarting app...');
      await restartApp();
    }
    
    // Run database migrations
    if (config.databaseUrl) {
      logger.info('Running database migrations...');
      await runMigrations();
    }
    
    // Verify app is healthy
    await waitForHealthy();
    
    // Update state
    const duration = Date.now() - startTime;
    state.lastUpdate = new Date().toISOString();
    state.lastCommit = newCommit;
    state.status = 'idle';
    state.error = null;
    state.stats.totalUpdates++;
    
    // Add to history
    state.history.unshift({
      timestamp: new Date().toISOString(),
      oldCommit: oldCommit.slice(0, 8),
      newCommit: newCommit.slice(0, 8),
      message: commitInfo?.message || 'Unknown',
      author: commitInfo?.author_name || 'Unknown',
      duration,
      success: true
    });
    
    // Keep only last 50 entries
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50);
    }
    
    await notify(
      `🚀 Deployment successful!\n` +
      `Commit: ${newCommit.slice(0, 8)}\n` +
      `Author: ${commitInfo?.author_name || 'Unknown'}\n` +
      `Message: ${commitInfo?.message || 'No message'}\n` +
      `Duration: ${(duration / 1000).toFixed(1)}s`
    );
    
    logger.info(`Update completed in ${duration}ms`);
    
  } catch (error) {
    logger.error('Update failed:', error);
    state.status = 'error';
    state.error = error.message;
    state.stats.totalErrors++;
    
    // Add to history
    state.history.unshift({
      timestamp: new Date().toISOString(),
      oldCommit: oldCommit.slice(0, 8),
      newCommit: newCommit.slice(0, 8),
      error: error.message,
      success: false
    });
    
    await notify(`❌ Deployment failed: ${error.message}`, true);
    
    // Rollback if enabled
    if (config.rollbackOnFailure && backupDir) {
      logger.info('Attempting rollback...');
      await rollback(backupDir);
    }
  }
  
  await saveState();
}

async function rebuildApp() {
  logger.info('Rebuilding application...');
  
  try {
    // Build new image
    await execAsync(
      `cd ${config.repoPath} && docker compose -f ${config.composeFile} build app`,
      { timeout: 600000 } // 10 minutes timeout
    );
    
    // Restart with new image
    await execAsync(
      `cd ${config.repoPath} && docker compose -f ${config.composeFile} up -d app`,
      { timeout: 120000 }
    );
    
    logger.info('Rebuild completed');
  } catch (error) {
    logger.error('Rebuild failed:', error);
    throw error;
  }
}

async function restartApp() {
  logger.info('Restarting application...');
  
  try {
    const container = docker.getContainer(config.appContainer);
    await container.restart({ t: 30 });
    logger.info('Restart completed');
  } catch (error) {
    logger.error('Restart failed:', error);
    throw error;
  }
}

async function runMigrations() {
  try {
    await execAsync(
      `cd ${config.repoPath} && docker compose -f ${config.composeFile} exec -T app pnpm db:push`,
      { timeout: 120000 }
    );
    logger.info('Migrations completed');
  } catch (error) {
    logger.warn('Migration warning:', error.message);
    // Don't throw - migrations might not be needed
  }
}

async function waitForHealthy(maxAttempts = 30, interval = 5000) {
  logger.info('Waiting for app to be healthy...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const container = docker.getContainer(config.appContainer);
      const info = await container.inspect();
      
      if (info.State.Health?.Status === 'healthy') {
        logger.info('App is healthy');
        return true;
      }
      
      if (info.State.Status !== 'running') {
        throw new Error(`Container is ${info.State.Status}`);
      }
    } catch (error) {
      logger.debug(`Health check attempt ${i + 1}/${maxAttempts} failed:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('App failed to become healthy');
}

// ============================================
// WEB SERVER
// ============================================

const app = express();

// Raw body parser for webhook signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ============================================
// WEBHOOK HELPERS
// ============================================

function verifyWebhookSignature(payload, signature) {
  if (!config.webhookSecret) {
    logger.warn('Webhook secret not configured, skipping signature verification');
    return true;
  }
  
  if (!signature) {
    logger.warn('No signature provided in webhook request');
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Signature verification error:', error);
    return false;
  }
}

function parseWebhookPayload(body) {
  try {
    return JSON.parse(body.toString());
  } catch (error) {
    logger.error('Failed to parse webhook payload:', error);
    return null;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agentStatus: state.status,
    lastCheck: state.lastCheck,
    lastUpdate: state.lastUpdate
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: state.status,
    lastCheck: state.lastCheck,
    lastUpdate: state.lastUpdate,
    lastCommit: state.lastCommit,
    error: state.error,
    stats: state.stats,
    webhook: {
      enabled: config.webhookEnabled,
      hasSecret: !!config.webhookSecret,
      events: config.webhookEvents,
      lastReceived: state.webhook.lastReceived,
      lastEvent: state.webhook.lastEvent,
      lastSender: state.webhook.lastSender
    },
    config: {
      repoUrl: config.repoUrl,
      branch: config.branch,
      pullInterval: config.pullInterval,
      rollbackOnFailure: config.rollbackOnFailure,
      webhookEnabled: config.webhookEnabled
    }
  });
});

// History endpoint
app.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  res.json(state.history.slice(0, limit));
});

// ============================================
// GITHUB WEBHOOK ENDPOINT
// ============================================

app.post('/webhook', async (req, res) => {
  // Check if webhook is enabled
  if (!config.webhookEnabled) {
    logger.warn('Webhook received but webhooks are disabled');
    return res.status(403).json({ error: 'Webhooks are disabled' });
  }
  
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];
  
  logger.info(`Webhook received: event=${event}, delivery=${deliveryId}`);
  
  // Verify signature
  if (!verifyWebhookSignature(req.body, signature)) {
    logger.warn('Webhook signature verification failed');
    state.stats.webhookErrors++;
    await saveState();
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse payload
  const payload = parseWebhookPayload(req.body);
  if (!payload) {
    state.stats.webhookErrors++;
    await saveState();
    return res.status(400).json({ error: 'Invalid payload' });
  }
  
  // Update webhook state
  state.webhook.lastReceived = new Date().toISOString();
  state.webhook.lastEvent = event;
  state.webhook.lastSender = payload.sender?.login || 'unknown';
  state.stats.totalWebhooks++;
  
  // Check if event is in allowed list
  if (!config.webhookEvents.includes(event)) {
    logger.info(`Ignoring event type: ${event}`);
    await saveState();
    return res.json({ message: 'Event ignored', event });
  }
  
  // Handle different event types
  switch (event) {
    case 'push':
      return handlePushEvent(payload, res);
    case 'release':
      return handleReleaseEvent(payload, res);
    case 'ping':
      return handlePingEvent(payload, res);
    default:
      logger.info(`Unhandled event type: ${event}`);
      await saveState();
      return res.json({ message: 'Event received but not handled', event });
  }
});

async function handlePushEvent(payload, res) {
  const branch = payload.ref?.replace('refs/heads/', '');
  const pusher = payload.pusher?.name || 'unknown';
  const commits = payload.commits?.length || 0;
  const headCommit = payload.head_commit;
  
  logger.info(`Push event: branch=${branch}, pusher=${pusher}, commits=${commits}`);
  
  // Check if push is to our branch
  if (branch !== config.branch) {
    logger.info(`Ignoring push to branch ${branch} (watching ${config.branch})`);
    await saveState();
    return res.json({ 
      message: 'Push ignored - different branch', 
      receivedBranch: branch,
      watchingBranch: config.branch
    });
  }
  
  // Check if already running
  if (state.isRunning) {
    logger.warn('Update already in progress, queuing webhook trigger');
    await saveState();
    return res.status(202).json({ 
      message: 'Update already in progress, will check after current update',
      status: 'queued'
    });
  }
  
  // Acknowledge webhook immediately
  res.json({ 
    message: 'Webhook received, starting deployment',
    branch,
    pusher,
    commits,
    commit: headCommit?.id?.slice(0, 8),
    commitMessage: headCommit?.message
  });
  
  // Notify about webhook trigger
  await notify(
    `📥 Webhook received!\n` +
    `Branch: ${branch}\n` +
    `Pusher: ${pusher}\n` +
    `Commits: ${commits}\n` +
    `Message: ${headCommit?.message || 'No message'}`
  );
  
  // Trigger update in background
  logger.info('Triggering update from webhook');
  checkForUpdates();
}

async function handleReleaseEvent(payload, res) {
  const action = payload.action;
  const release = payload.release;
  const tagName = release?.tag_name;
  const releaseName = release?.name;
  
  logger.info(`Release event: action=${action}, tag=${tagName}, name=${releaseName}`);
  
  // Only handle published releases
  if (action !== 'published') {
    logger.info(`Ignoring release action: ${action}`);
    await saveState();
    return res.json({ message: 'Release action ignored', action });
  }
  
  // Check if already running
  if (state.isRunning) {
    await saveState();
    return res.status(202).json({ 
      message: 'Update already in progress',
      status: 'queued'
    });
  }
  
  // Acknowledge webhook
  res.json({ 
    message: 'Release webhook received, starting deployment',
    tag: tagName,
    name: releaseName
  });
  
  // Notify about release
  await notify(
    `🎉 New release published!\n` +
    `Tag: ${tagName}\n` +
    `Name: ${releaseName}\n` +
    `Starting deployment...`
  );
  
  // Trigger update
  checkForUpdates();
}

async function handlePingEvent(payload, res) {
  const zen = payload.zen;
  const hookId = payload.hook_id;
  
  logger.info(`Ping event received: hook_id=${hookId}, zen="${zen}"`);
  
  await notify(`👋 Webhook configured successfully!\nHook ID: ${hookId}`);
  await saveState();
  
  res.json({ 
    message: 'Pong! Webhook configured successfully',
    hookId,
    zen,
    agent: 'Scoliologic Wiki Pull Agent',
    version: '1.0.0'
  });
}

// Manual trigger endpoint (check for updates and deploy if available)
app.post('/trigger', async (req, res) => {
  if (state.isRunning) {
    return res.status(409).json({ error: 'Update already in progress' });
  }
  
  logger.info('Manual update triggered');
  res.json({ message: 'Update triggered', action: 'check_and_deploy' });
  
  // Run update in background
  checkForUpdates();
});

// Manual pull only endpoint (git pull without deploy)
app.post('/pull', async (req, res) => {
  if (state.isRunning) {
    return res.status(409).json({ error: 'Operation already in progress' });
  }
  
  state.isRunning = true;
  state.status = 'checking';
  logger.info('Manual pull triggered');
  
  try {
    const git = getGit();
    
    // Fetch and pull latest changes
    await git.fetch(['origin', config.branch]);
    const pullResult = await git.pull('origin', config.branch);
    
    // Get current commit
    const currentCommit = await git.revparse(['HEAD']);
    state.lastCommit = currentCommit.trim();
    state.lastCheck = new Date().toISOString();
    state.status = 'idle';
    
    logger.info(`Pull completed: ${pullResult.summary.changes} changes`);
    res.json({ 
      message: 'Pull completed', 
      action: 'pull_only',
      commit: currentCommit.trim().slice(0, 8),
      changes: pullResult.summary
    });
  } catch (error) {
    state.status = 'error';
    state.error = error.message;
    logger.error('Pull failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    state.isRunning = false;
    await saveState();
  }
});

// Manual deploy only endpoint (rebuild and restart without pull)
app.post('/deploy', async (req, res) => {
  if (state.isRunning) {
    return res.status(409).json({ error: 'Operation already in progress' });
  }
  
  const { rebuild = false } = req.body || {};
  
  state.isRunning = true;
  state.status = 'updating';
  logger.info(`Manual deploy triggered (rebuild: ${rebuild})`);
  
  const startTime = Date.now();
  
  try {
    const git = getGit();
    const currentCommit = await git.revparse(['HEAD']);
    
    // Create backup before deploy
    const backupDir = await createBackup(currentCommit.trim());
    
    if (rebuild) {
      logger.info('Rebuilding application...');
      await rebuildApp();
    } else {
      logger.info('Restarting application...');
      await restartApp();
    }
    
    // Run migrations
    if (config.databaseUrl) {
      logger.info('Running database migrations...');
      await runMigrations();
    }
    
    // Wait for healthy
    await waitForHealthy();
    
    const duration = Date.now() - startTime;
    state.lastUpdate = new Date().toISOString();
    state.status = 'idle';
    state.error = null;
    state.stats.totalUpdates++;
    
    // Add to history
    state.history.unshift({
      timestamp: new Date().toISOString(),
      oldCommit: currentCommit.trim().slice(0, 8),
      newCommit: currentCommit.trim().slice(0, 8),
      message: rebuild ? 'Manual rebuild' : 'Manual restart',
      author: 'Manual',
      duration,
      success: true,
      manual: true
    });
    
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50);
    }
    
    await notify(
      `🛠️ Manual deployment completed!\n` +
      `Action: ${rebuild ? 'Rebuild' : 'Restart'}\n` +
      `Commit: ${currentCommit.trim().slice(0, 8)}\n` +
      `Duration: ${(duration / 1000).toFixed(1)}s`
    );
    
    logger.info(`Deploy completed in ${duration}ms`);
    res.json({ 
      message: 'Deploy completed', 
      action: rebuild ? 'rebuild' : 'restart',
      commit: currentCommit.trim().slice(0, 8),
      duration
    });
    
  } catch (error) {
    state.status = 'error';
    state.error = error.message;
    state.stats.totalErrors++;
    
    state.history.unshift({
      timestamp: new Date().toISOString(),
      error: error.message,
      success: false,
      manual: true
    });
    
    logger.error('Deploy failed:', error);
    await notify(`❌ Manual deployment failed: ${error.message}`, true);
    res.status(500).json({ error: error.message });
  } finally {
    state.isRunning = false;
    await saveState();
  }
});

// Force rebuild endpoint
app.post('/rebuild', async (req, res) => {
  // Redirect to deploy with rebuild=true
  req.body = { rebuild: true };
  
  if (state.isRunning) {
    return res.status(409).json({ error: 'Operation already in progress' });
  }
  
  state.isRunning = true;
  state.status = 'updating';
  logger.info('Manual rebuild triggered');
  
  const startTime = Date.now();
  
  try {
    const git = getGit();
    const currentCommit = await git.revparse(['HEAD']);
    
    // Create backup before rebuild
    await createBackup(currentCommit.trim());
    
    // Full rebuild
    await rebuildApp();
    
    // Run migrations
    if (config.databaseUrl) {
      await runMigrations();
    }
    
    // Wait for healthy
    await waitForHealthy();
    
    const duration = Date.now() - startTime;
    state.lastUpdate = new Date().toISOString();
    state.status = 'idle';
    state.error = null;
    state.stats.totalUpdates++;
    
    state.history.unshift({
      timestamp: new Date().toISOString(),
      oldCommit: currentCommit.trim().slice(0, 8),
      newCommit: currentCommit.trim().slice(0, 8),
      message: 'Manual full rebuild',
      author: 'Manual',
      duration,
      success: true,
      manual: true
    });
    
    await notify(
      `🛠️ Manual rebuild completed!\n` +
      `Commit: ${currentCommit.trim().slice(0, 8)}\n` +
      `Duration: ${(duration / 1000).toFixed(1)}s`
    );
    
    res.json({ 
      message: 'Rebuild completed', 
      commit: currentCommit.trim().slice(0, 8),
      duration
    });
    
  } catch (error) {
    state.status = 'error';
    state.error = error.message;
    state.stats.totalErrors++;
    logger.error('Rebuild failed:', error);
    await notify(`❌ Manual rebuild failed: ${error.message}`, true);
    res.status(500).json({ error: error.message });
  } finally {
    state.isRunning = false;
    await saveState();
  }
});

// Manual rollback endpoint
app.post('/rollback', async (req, res) => {
  const { backupName } = req.body;
  
  if (!backupName) {
    return res.status(400).json({ error: 'backupName required' });
  }
  
  const backupDir = path.join(config.backupPath, backupName);
  
  try {
    await fs.access(backupDir);
  } catch {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  logger.info(`Manual rollback triggered to: ${backupName}`);
  res.json({ message: 'Rollback triggered' });
  
  // Run rollback in background
  rollback(backupDir);
});

// List backups endpoint
app.get('/backups', async (req, res) => {
  try {
    const entries = await fs.readdir(config.backupPath, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
      .map(e => e.name)
      .sort()
      .reverse();
    
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs endpoint
app.get('/logs', async (req, res) => {
  const lines = parseInt(req.query.lines || '100', 10);
  
  try {
    const { stdout } = await execAsync(
      `tail -n ${lines} /app/logs/pull-agent-*.log 2>/dev/null || echo "No logs available"`
    );
    res.type('text/plain').send(stdout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple web UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scoliologic Wiki - Pull Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #60a5fa; }
    .card { background: #1e293b; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; }
    .card h2 { font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .status { display: flex; align-items: center; gap: 0.5rem; font-size: 1.25rem; }
    .status-dot { width: 12px; height: 12px; border-radius: 50%; }
    .status-idle { background: #22c55e; }
    .status-checking { background: #eab308; animation: pulse 1s infinite; }
    .status-updating { background: #3b82f6; animation: pulse 1s infinite; }
    .status-error { background: #ef4444; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #60a5fa; }
    .stat-label { font-size: 0.875rem; color: #94a3b8; }
    .history { max-height: 400px; overflow-y: auto; }
    .history-item { padding: 0.75rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    .history-item:last-child { border-bottom: none; }
    .history-commit { font-family: monospace; color: #60a5fa; }
    .history-success { color: #22c55e; }
    .history-error { color: #ef4444; }
    .btn { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem; margin-right: 0.5rem; margin-bottom: 0.5rem; transition: all 0.2s; }
    .btn:hover { background: #2563eb; transform: translateY(-1px); }
    .btn:disabled { background: #475569; cursor: not-allowed; transform: none; }
    .btn-primary { background: #22c55e; }
    .btn-primary:hover { background: #16a34a; }
    .btn-secondary { background: #6366f1; }
    .btn-secondary:hover { background: #4f46e5; }
    .btn-warning { background: #f59e0b; }
    .btn-warning:hover { background: #d97706; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .action-status { font-size: 0.875rem; color: #94a3b8; min-height: 1.5rem; }
    .action-status.success { color: #22c55e; }
    .action-status.error { color: #ef4444; }
    .action-status.loading { color: #eab308; }
    .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.875rem; }
    .info-label { color: #94a3b8; }
    .info-value { color: #e2e8f0; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Scoliologic Wiki - Pull Agent</h1>
    
    <div class="card">
      <h2>Статус</h2>
      <div class="status" id="status">
        <div class="status-dot status-idle"></div>
        <span>Загрузка...</span>
      </div>
    </div>
    
    <div class="card">
      <h2>Статистика</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" id="stat-checks">0</div>
          <div class="stat-label">Проверок</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="stat-updates">0</div>
          <div class="stat-label">Обновлений</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="stat-errors">0</div>
          <div class="stat-label">Ошибок</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="stat-rollbacks">0</div>
          <div class="stat-label">Откатов</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="stat-webhooks">0</div>
          <div class="stat-label">Webhooks</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>Информация</h2>
      <div class="info" id="info">
        <div class="info-label">Репозиторий:</div>
        <div class="info-value">-</div>
        <div class="info-label">Ветка:</div>
        <div class="info-value">-</div>
        <div class="info-label">Интервал:</div>
        <div class="info-value">-</div>
        <div class="info-label">Последняя проверка:</div>
        <div class="info-value">-</div>
        <div class="info-label">Последнее обновление:</div>
        <div class="info-value">-</div>
        <div class="info-label">Текущий коммит:</div>
        <div class="info-value">-</div>
      </div>
    </div>
    
    <div class="card">
      <h2>🔗 GitHub Webhook</h2>
      <div class="info" id="webhook-info">
        <div class="info-label">Статус:</div>
        <div class="info-value" id="webhook-status">-</div>
        <div class="info-label">URL:</div>
        <div class="info-value" id="webhook-url">-</div>
        <div class="info-label">События:</div>
        <div class="info-value" id="webhook-events">-</div>
        <div class="info-label">Последний webhook:</div>
        <div class="info-value" id="webhook-last">-</div>
        <div class="info-label">Отправитель:</div>
        <div class="info-value" id="webhook-sender">-</div>
      </div>
      <div style="margin-top: 1rem; padding: 0.75rem; background: #334155; border-radius: 0.375rem; font-size: 0.75rem;">
        <strong>Настройка в GitHub:</strong><br>
        1. Settings → Webhooks → Add webhook<br>
        2. Payload URL: <code id="webhook-payload-url">http://your-server:8080/webhook</code><br>
        3. Content type: <code>application/json</code><br>
        4. Secret: <code>значение WEBHOOK_SECRET</code><br>
        5. Events: Push events, Releases
      </div>
    </div>
    
    <div class="card">
      <h2>Действия</h2>
      <div class="actions">
        <button class="btn" id="pull-btn" onclick="manualPull()">📥 Pull</button>
        <button class="btn btn-primary" id="trigger-btn" onclick="triggerUpdate()">🚀 Pull & Deploy</button>
        <button class="btn btn-secondary" id="deploy-btn" onclick="manualDeploy()">🔄 Restart</button>
        <button class="btn btn-warning" id="rebuild-btn" onclick="manualRebuild()">🛠️ Rebuild</button>
      </div>
      <div class="action-status" id="action-status"></div>
    </div>
    
    <div class="card">
      <h2>История деплоев</h2>
      <div class="history" id="history">
        <div class="history-item">Загрузка...</div>
      </div>
    </div>
  </div>
  
  <script>
    async function fetchStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        const statusEl = document.getElementById('status');
        const dotClass = 'status-' + data.status;
        const statusText = {
          idle: 'Ожидание',
          checking: 'Проверка...',
          updating: 'Обновление...',
          error: 'Ошибка: ' + (data.error || 'Неизвестная')
        }[data.status] || data.status;
        
        statusEl.innerHTML = '<div class="status-dot ' + dotClass + '"></div><span>' + statusText + '</span>';
        
        document.getElementById('stat-checks').textContent = data.stats.totalChecks;
        document.getElementById('stat-updates').textContent = data.stats.totalUpdates;
        document.getElementById('stat-errors').textContent = data.stats.totalErrors;
        document.getElementById('stat-rollbacks').textContent = data.stats.totalRollbacks;
        document.getElementById('stat-webhooks').textContent = data.stats.totalWebhooks || 0;
        
        const info = document.getElementById('info');
        info.innerHTML = [
          ['Репозиторий:', data.config.repoUrl],
          ['Ветка:', data.config.branch],
          ['Интервал:', data.config.pullInterval + ' сек'],
          ['Последняя проверка:', data.lastCheck ? new Date(data.lastCheck).toLocaleString('ru') : '-'],
          ['Последнее обновление:', data.lastUpdate ? new Date(data.lastUpdate).toLocaleString('ru') : '-'],
          ['Текущий коммит:', data.lastCommit ? data.lastCommit.slice(0, 8) : '-']
        ].map(([label, value]) => 
          '<div class="info-label">' + label + '</div><div class="info-value">' + value + '</div>'
        ).join('');
        
        const isIdle = data.status === 'idle';
        ['pull-btn', 'trigger-btn', 'deploy-btn', 'rebuild-btn'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.disabled = !isIdle;
        });
        
        // Clear action status when idle
        if (isIdle) {
          const statusEl = document.getElementById('action-status');
          if (statusEl && statusEl.classList.contains('loading')) {
            statusEl.textContent = '';
            statusEl.className = 'action-status';
          }
        }
        
        // Update webhook info
        if (data.webhook) {
          document.getElementById('webhook-status').innerHTML = data.webhook.enabled 
            ? '<span style="color:#22c55e">✅ Включен</span>' + (data.webhook.hasSecret ? ' (защищён)' : ' <span style="color:#f59e0b">(без секрета!)</span>')
            : '<span style="color:#ef4444">❌ Выключен</span>';
          document.getElementById('webhook-url').textContent = window.location.origin + '/webhook';
          document.getElementById('webhook-payload-url').textContent = window.location.origin + '/webhook';
          document.getElementById('webhook-events').textContent = data.webhook.events?.join(', ') || '-';
          document.getElementById('webhook-last').textContent = data.webhook.lastReceived 
            ? new Date(data.webhook.lastReceived).toLocaleString('ru') + ' (' + data.webhook.lastEvent + ')'
            : 'Ещё не получали';
          document.getElementById('webhook-sender').textContent = data.webhook.lastSender || '-';
        }
      } catch (e) {
        console.error('Failed to fetch status:', e);
      }
    }
    
    async function fetchHistory() {
      try {
        const res = await fetch('/history?limit=10');
        const data = await res.json();
        
        const historyEl = document.getElementById('history');
        if (data.length === 0) {
          historyEl.innerHTML = '<div class="history-item">История пуста</div>';
          return;
        }
        
        historyEl.innerHTML = data.map(item => {
          const date = new Date(item.timestamp).toLocaleString('ru');
          const status = item.success 
            ? '<span class="history-success">✓</span>' 
            : '<span class="history-error">✗ ' + (item.error || '') + '</span>';
          return '<div class="history-item">' +
            '<span><span class="history-commit">' + item.oldCommit + ' → ' + item.newCommit + '</span> ' + (item.message || '') + '</span>' +
            '<span>' + status + ' ' + date + '</span>' +
          '</div>';
        }).join('');
      } catch (e) {
        console.error('Failed to fetch history:', e);
      }
    }
    
    function setActionStatus(message, type = '') {
      const el = document.getElementById('action-status');
      el.textContent = message;
      el.className = 'action-status ' + type;
    }
    
    function disableAllButtons(disabled) {
      ['pull-btn', 'trigger-btn', 'deploy-btn', 'rebuild-btn'].forEach(id => {
        document.getElementById(id).disabled = disabled;
      });
    }
    
    async function manualPull() {
      try {
        disableAllButtons(true);
        setActionStatus('📥 Выполняется git pull...', 'loading');
        const res = await fetch('/pull', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setActionStatus('✅ Pull завершён: ' + data.commit, 'success');
        } else {
          setActionStatus('❌ Ошибка: ' + data.error, 'error');
        }
      } catch (e) {
        setActionStatus('❌ Ошибка соединения', 'error');
      } finally {
        setTimeout(() => { disableAllButtons(false); fetchStatus(); }, 2000);
      }
    }
    
    async function triggerUpdate() {
      try {
        disableAllButtons(true);
        setActionStatus('🚀 Проверка обновлений и деплой...', 'loading');
        await fetch('/trigger', { method: 'POST' });
        setActionStatus('🚀 Обновление запущено, ожидайте...', 'loading');
        setTimeout(fetchStatus, 1000);
      } catch (e) {
        setActionStatus('❌ Ошибка соединения', 'error');
        disableAllButtons(false);
      }
    }
    
    async function manualDeploy() {
      try {
        disableAllButtons(true);
        setActionStatus('🔄 Перезапуск приложения...', 'loading');
        const res = await fetch('/deploy', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rebuild: false })
        });
        const data = await res.json();
        if (res.ok) {
          setActionStatus('✅ Перезапуск завершён за ' + (data.duration/1000).toFixed(1) + 'с', 'success');
        } else {
          setActionStatus('❌ Ошибка: ' + data.error, 'error');
        }
      } catch (e) {
        setActionStatus('❌ Ошибка соединения', 'error');
      } finally {
        setTimeout(() => { disableAllButtons(false); fetchStatus(); fetchHistory(); }, 2000);
      }
    }
    
    async function manualRebuild() {
      if (!confirm('Полная пересборка может занять несколько минут. Продолжить?')) return;
      
      try {
        disableAllButtons(true);
        setActionStatus('🛠️ Полная пересборка приложения...', 'loading');
        const res = await fetch('/rebuild', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setActionStatus('✅ Пересборка завершена за ' + (data.duration/1000).toFixed(1) + 'с', 'success');
        } else {
          setActionStatus('❌ Ошибка: ' + data.error, 'error');
        }
      } catch (e) {
        setActionStatus('❌ Ошибка соединения', 'error');
      } finally {
        setTimeout(() => { disableAllButtons(false); fetchStatus(); fetchHistory(); }, 2000);
      }
    }
    
    // Initial fetch
    fetchStatus();
    fetchHistory();
    
    // Auto-refresh
    setInterval(fetchStatus, 5000);
    setInterval(fetchHistory, 30000);
  </script>
</body>
</html>
  `);
});

// ============================================
// MAIN
// ============================================

async function main() {
  logger.info('Starting Pull Agent...');
  logger.info(`Repository: ${config.repoUrl}`);
  logger.info(`Branch: ${config.branch}`);
  logger.info(`Pull interval: ${config.pullInterval}s`);
  
  // Load saved state
  await loadState();
  
  // Ensure repo exists
  try {
    await fs.access(path.join(config.repoPath, '.git'));
    logger.info('Repository found');
  } catch {
    logger.info('Repository not found, cloning...');
    const git = simpleGit();
    await git.clone(config.repoUrl, config.repoPath, ['--branch', config.branch]);
    logger.info('Repository cloned');
  }
  
  // Start web server
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Web server listening on port ${config.port}`);
  });
  
  // Schedule periodic checks
  const cronExpression = `*/${Math.max(1, Math.floor(config.pullInterval / 60))} * * * *`;
  logger.info(`Scheduling checks with cron: ${cronExpression}`);
  
  cron.schedule(cronExpression, () => {
    logger.info('Scheduled check triggered');
    checkForUpdates();
  });
  
  // Initial check
  setTimeout(() => {
    logger.info('Running initial check...');
    checkForUpdates();
  }, 10000);
  
  logger.info('Pull Agent started successfully');
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
