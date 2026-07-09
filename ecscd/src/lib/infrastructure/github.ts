import { Octokit } from "@octokit/rest";
import { GitTaskDefinitionSource } from "../domain/application";
import {
  GitTaskDefinitionResult,
  IGithub,
} from "./interface/github";
import { toTaskDefinitionSpec } from "./task-definition-normalizer";

export class GitHub implements IGithub {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  async getTaskDefinition(
    source: GitTaskDefinitionSource
  ): Promise<GitTaskDefinitionResult> {
    const repoUrl = source.repo || "";
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(\.git)?$/);
    if (!match) {
      return {
        status: "Error",
        error: { type: "InvalidRepositoryUrl", url: repoUrl },
      };
    }
    const owner = match[1];
    const repo = match[2];
    const path = source.path || "";
    const branch = source.branch || "";

    let latestSha: string;
    try {
      const sha = await this.getLatestCommitSha(owner, repo, branch);
      if (!sha) {
        return {
          status: "Error",
          error: { type: "CommitNotFound", branch },
        };
      }
      latestSha = sha;
    } catch (error) {
      return toFetchError(error);
    }

    let contentResponse;
    try {
      contentResponse = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: latestSha,
      });
    } catch (error) {
      return toFetchError(error);
    }

    if (
      !("content" in contentResponse.data) ||
      !contentResponse.data.content
    ) {
      return {
        status: "Error",
        error: { type: "FileNotFound", path },
      };
    }

    const fileContent = Buffer.from(
      contentResponse.data.content,
      "base64"
    ).toString("utf8");

    return parseTaskDefinition(fileContent);
  }

  private async getLatestCommitSha(
    owner: string,
    repo: string,
    branch: string
  ): Promise<string | null> {
    const response = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: branch || "main",
      per_page: 1,
    });
    if (response.data.length === 0) {
      return null;
    }
    return response.data[0].sha;
  }
}

function parseTaskDefinition(content: string): GitTaskDefinitionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      status: "Error",
      error: {
        type: "InvalidTaskDefinition",
        reason:
          error instanceof Error ? error.message : "JSON parse failed",
      },
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      status: "Error",
      error: {
        type: "InvalidTaskDefinition",
        reason: "Task definition must be a JSON object.",
      },
    };
  }

  return {
    status: "Success",
    taskDefinition: toTaskDefinitionSpec(parsed as Record<string, unknown>),
  };
}

function toFetchError(error: unknown): GitTaskDefinitionResult {
  return {
    status: "Error",
    error: {
      type: "FetchFailed",
      reason: error instanceof Error ? error.message : "Unknown fetch error",
    },
  };
}
