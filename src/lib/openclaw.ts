import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import type { AgentDescriptor } from "../types";

interface OpenClawConfig {
  agents?: Array<Record<string, unknown>>;
}

const CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

export const canonicalizePath = async (inputPath: string): Promise<string> => {
  const resolved = path.resolve(inputPath);
  try {
    return await fs.realpath(resolved);
  } catch {
    return resolved;
  }
};

export const validatePath = async (filePath: string, allowlist: string[]): Promise<boolean> => {
  const candidate = await canonicalizePath(filePath);
  const normalizedAllowlist = await Promise.all(allowlist.map((entry) => canonicalizePath(entry)));

  return normalizedAllowlist.some((allowed) => candidate === allowed || candidate.startsWith(`${allowed}${path.sep}`));
};

export const parseConfig = (raw: string): AgentDescriptor[] => {
  const parsed = JSON.parse(raw) as OpenClawConfig;
  if (!parsed.agents || !Array.isArray(parsed.agents)) {
    return [];
  }

  const agents: AgentDescriptor[] = [];

  for (const agent of parsed.agents) {
    const id = String(agent.id ?? "").trim();
    if (!id) continue;

    const capabilities = Array.isArray(agent.capabilities)
      ? agent.capabilities.map((cap) => String(cap))
      : [];

    agents.push({
      id,
      name: String(agent.name ?? id),
      model: String(agent.model ?? "unknown"),
      capabilities,
      description: agent.description ? String(agent.description) : undefined,
    });
  }

  return agents;
};

export const getAgents = async (): Promise<AgentDescriptor[]> => {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    return parseConfig(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    if (error instanceof SyntaxError) {
      console.error("Invalid openclaw.json format", error);
      return [];
    }

    console.error("Failed to read openclaw config", error);
    return [];
  }
};
