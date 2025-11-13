// src/lib/planStore.ts
import 'server-only';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type Plan = {
  id: string;
  title: string;
  content: string;      // 생성된 계획 원문
  meta?: Record<string, any>; // 목적지/날짜 등 폼값
  createdAt: number;
  updatedAt: number;
};

const dataDir = join(process.cwd(), 'data');
const dbFile = join(dataDir, 'plans.json');

function ensure() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbFile)) writeFileSync(dbFile, JSON.stringify({ plans: [] }, null, 2), 'utf8');
}

function load(): { plans: Plan[] } {
  ensure();
  return JSON.parse(readFileSync(dbFile, 'utf8'));
}

function save(data: { plans: Plan[] }) {
  writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

export const planStore = {
  list(): Plan[] {
    return load().plans.sort((a, b) => b.createdAt - a.createdAt);
  },
  create(input: { title: string; content: string; meta?: Record<string, any> }): Plan {
    const now = Date.now();
    const id = crypto.randomUUID();
    const data = load();
    const plan: Plan = { id, title: input.title, content: input.content, meta: input.meta, createdAt: now, updatedAt: now };
    data.plans.push(plan);
    save(data);
    return plan;
  },
};
