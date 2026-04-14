import fs from "node:fs/promises";
import path from "node:path";
import type { AssistantSession, BoardDocument, BrandProfile } from "./types.ts";

interface Storage {
  listBrandProfiles(): Promise<BrandProfile[]>;
  getBrandProfile(id: string): Promise<BrandProfile | null>;
  saveBrandProfile(profile: BrandProfile): Promise<void>;
  listBoards(): Promise<BoardDocument[]>;
  getBoard(id: string): Promise<BoardDocument | null>;
  saveBoard(board: BoardDocument): Promise<void>;
  listAssistantSessions(): Promise<AssistantSession[]>;
  getAssistantSession(id: string): Promise<AssistantSession | null>;
  saveAssistantSession(session: AssistantSession): Promise<void>;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function listJsonDirectory<T>(dirPath: string): Promise<T[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const loaded = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonFile<T>(path.join(dirPath, entry.name)))
    );

    return loaded.filter(Boolean) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export function createStorage(rootDir: string): Storage {
  const brandsDir = path.join(rootDir, "workspace", "brands");
  const boardsDir = path.join(rootDir, "workspace", "boards");
  const sessionsDir = path.join(rootDir, "workspace", "sessions");

  return {
    async listBrandProfiles() {
      const profiles = await listJsonDirectory<BrandProfile>(brandsDir);
      return profiles.sort((a, b) => a.name.localeCompare(b.name));
    },

    async getBrandProfile(id: string) {
      return readJsonFile<BrandProfile>(path.join(brandsDir, `${id}.json`));
    },

    async saveBrandProfile(profile: BrandProfile) {
      await writeJsonFile(path.join(brandsDir, `${profile.id}.json`), profile);
    },

    async listBoards() {
      const boards = await listJsonDirectory<BoardDocument>(boardsDir);
      return boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getBoard(id: string) {
      return readJsonFile<BoardDocument>(path.join(boardsDir, `${id}.json`));
    },

    async saveBoard(board: BoardDocument) {
      await writeJsonFile(path.join(boardsDir, `${board.id}.json`), board);
    },

    async listAssistantSessions() {
      const sessions = await listJsonDirectory<AssistantSession>(sessionsDir);
      return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getAssistantSession(id: string) {
      return readJsonFile<AssistantSession>(path.join(sessionsDir, `${id}.json`));
    },

    async saveAssistantSession(session: AssistantSession) {
      await writeJsonFile(path.join(sessionsDir, `${session.id}.json`), session);
    }
  };
}
