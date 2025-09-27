import { Octokit } from "@octokit/rest";
import { RegisterTaskDefinitionCommandInput } from "@aws-sdk/client-ecs";
import { ApplicationDomain } from "../domain/application";
import { IGithub } from "./interface/github";

export class GitHub implements IGithub {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  async getFileContent(
    application: ApplicationDomain
  ): Promise<RegisterTaskDefinitionCommandInput | null> {
    try {
      // リポジトリurl から owner, repoを取得
      const repoUrl = application.gitConfig?.repo || "";
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(\.git)?$/);
      if (!match) {
        throw new Error("Invalid GitHub repository URL");
      }
      const owner = match[1];
      const repo = match[2];
      const path = application.gitConfig?.path || "";
      const branch = application.gitConfig?.branch || "";

      const latestCommit = await this.getLatestCommit(owner, repo, branch);
      if (!latestCommit) {
        console.warn("No commits found for the specified branch.");
        return null;
      }

      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: latestCommit.sha,
      });

      if ("content" in response.data && response.data.content) {
        const fileContent = Buffer.from(
          response.data.content,
          "base64"
        ).toString("utf8");
        return this.parseServiceDeployment(fileContent);
      }

      return null;
    } catch (error) {
      console.error("Error fetching file content:", error);
      return null;
    }
  }
  private async getLatestCommit(
    owner: string,
    repo: string,
    branch: string = "main"
  ): Promise<{
    sha: string;
    message: string;
    author: string;
    date: Date;
  } | null> {
    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: 1,
      });
      if (response.data.length === 0) {
        return null;
      }
      const commit = response.data[0];
      return {
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: new Date(commit.commit.author?.date || Date.now()),
      };
    } catch (error) {
      console.error("Error fetching latest commit:", error);
      return null;
    }
  }
  private async parseServiceDeployment(
    content: string
  ): Promise<RegisterTaskDefinitionCommandInput | null> {
    try {
      const parsed = JSON.parse(content);
      // Add validation logic if necessary
      return parsed as RegisterTaskDefinitionCommandInput;
    } catch (error) {
      console.error("Error parsing service deployment content:", error);
      return null;
    }
  }
}
