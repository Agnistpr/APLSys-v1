import { app } from "electron";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { Client } from "pg";
import net from "net";

// Paths
const isDev = !app.isPackaged;
const PG_DIR = isDev
  ? path.join(process.cwd(), 'backend', 'pg')
  : path.join(process.resourcesPath, 'pg');
const BIN = path.join(PG_DIR, 'bin');
const DATA_DIR = isDev
  ? path.join(process.cwd(), 'db-data')
  : path.join(app.getPath('userData'), 'db-data');
const LOG_FILE = path.join(DATA_DIR, 'log.txt');
const sqlFile = isDev
  ? path.join(process.cwd(), 'aplsys_db.sql')
  : path.join(process.resourcesPath, 'aplsys_db.sql');

let dbClient;

export function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('db initializing');

    try {
      console.log('Initializing PostgreSQL data directory...');
      execSync(`"${path.join(BIN, 'initdb')}" --username=client --auth=trust -D "${DATA_DIR}"`, {
        env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
        stdio: 'inherit'
      });

      console.log('Starting PostgreSQL to run initial SQL...');
      execSync(`"${path.join(BIN, 'pg_ctl')}" start -D "${DATA_DIR}" -l "${LOG_FILE}"`, {
        env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
        stdio: 'inherit'
      });

      console.log('Setting password for client user...');
      execSync(`"${path.join(BIN, 'psql')}" -U client -d postgres -c "ALTER ROLE client WITH PASSWORD '@PLSys';"`, {
        env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
        stdio: 'inherit'
      });

      console.log('Executing aplsys_db.sql...');
      execSync(`"${path.join(BIN, 'psql')}" -U client -d postgres -f "${sqlFile}"`, {
        env: { ...process.env, PATH: `${BIN};${process.env.PATH}`, PGPASSWORD: '@PLSys' },
        stdio: 'inherit'
      });
      console.log('SQL file executed successfully.');

      console.log('Stopping PostgreSQL...');
      execSync(`"${path.join(BIN, 'pg_ctl')}" stop -D "${DATA_DIR}" -m fast`, {
        env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
        stdio: 'inherit'
      });

    } catch (err) {
      console.error('Database initialization failed:', err);
    }
  } else {
    console.log('db already initialized');
  }
}

export function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close(() => resolve(false));
      })
      .listen(port);
  });
}

export function startDatabase() {
  console.log('starting db');
  execSync(`"${path.join(BIN, 'pg_ctl')}" start -D "${DATA_DIR}" -l "${LOG_FILE}"`, {
    env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
    stdio: 'inherit',
  });
}

export function stopDatabase() {
  console.log('stopping db');
  try {
    execSync(`"${path.join(BIN, 'pg_ctl')}" stop -D "${DATA_DIR}" -m fast`, {
      env: { ...process.env, PATH: `${BIN};${process.env.PATH}` },
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('pg stop error:', err.message);
  }
}

export async function closeDatabaseConnection() {
  if (dbClient) {
    try {
      await dbClient.end();
      console.log("Database connection closed.");
    } catch (err) {
      console.warn("Error closing DB connection:", err.message);
    } finally {
      dbClient = null;
    }
  }
}

export function connectToDatabase() {
  dbClient = new Client({
    user: 'client',
    host: 'localhost',
    database: 'postgres',
    password: '@PLSys',
    port: 5432,
  });

  dbClient.connect()
    .then(() => console.log('SQL connected'))
    .catch(err => console.error('Failed to connect to DB:', err));
}

export { dbClient };