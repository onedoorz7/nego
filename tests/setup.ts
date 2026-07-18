import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the SQLite store at a throwaway dir so tests never touch dev data.
process.env.NEGO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nego-test-"));
