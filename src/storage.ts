import fs from "node:fs/promises";
import path from "node:path";
import type { AssistantSession, BoardDocument, BrandProfile, CalendarSlot, ContentPillar } from "./types.ts";

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
  listCalendarSlots(): Promise<CalendarSlot[]>;
  getCalendarSlot(id: string): Promise<CalendarSlot | null>;
  saveCalendarSlot(slot: CalendarSlot): Promise<void>;
  deleteCalendarSlot(id: string): Promise<void>;
  listContentPillars(): Promise<ContentPillar[]>;
  getContentPillar(id: string): Promise<ContentPillar | null>;
  saveContentPillar(pillar: ContentPillar): Promise<void>;
  deleteContentPillar(id: string): Promise<void>;
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
  const calendarDir = path.join(rootDir, "workspace", "calendar");
  const pillarsDir = path.join(rootDir, "workspace", "pillars");

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
    },

    async listCalendarSlots() {
      const slots = await listJsonDirectory<CalendarSlot>(calendarDir);
      return slots.sort((a, b) => a.date.localeCompare(b.date));
    },

    async getCalendarSlot(id: string) {
      return readJsonFile<CalendarSlot>(path.join(calendarDir, `${id}.json`));
    },

    async saveCalendarSlot(slot: CalendarSlot) {
      await writeJsonFile(path.join(calendarDir, `${slot.id}.json`), slot);
    },

    async deleteCalendarSlot(id: string) {
      try {
        await fs.unlink(path.join(calendarDir, `${id}.json`));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },

    async listContentPillars() {
      const pillars = await listJsonDirectory<ContentPillar>(pillarsDir);
      return pillars.sort((a, b) => a.name.localeCompare(b.name));
    },

    async getContentPillar(id: string) {
      return readJsonFile<ContentPillar>(path.join(pillarsDir, `${id}.json`));
    },

    async saveContentPillar(pillar: ContentPillar) {
      await writeJsonFile(path.join(pillarsDir, `${pillar.id}.json`), pillar);
    },

    async deleteContentPillar(id: string) {
      try {
        await fs.unlink(path.join(pillarsDir, `${id}.json`));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  };
}
