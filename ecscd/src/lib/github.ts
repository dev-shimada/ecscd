import { Octokit } from '@octokit/rest';
import { GitHubRepository } from '@/types/ecs';

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if ('content' in response.data && response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf8');
      }

      return null;
    } catch (error) {
      console.error('Error fetching file content:', error);
      return null;
    }
  }

  async getLatestCommit(
    owner: string,
    repo: string,
    branch: string = 'main'
  ): Promise<{ sha: string; message: string; author: string; date: Date } | null> {
    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: 1
      });

      if (response.data.length === 0) {
        return null;
      }

      const commit = response.data[0];
      
      return {
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || 'Unknown',
        date: new Date(commit.commit.author?.date || Date.now())
      };
    } catch (error) {
      console.error('Error fetching latest commit:', error);
      return null;
    }
  }

  async getCommitsBetween(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<Array<{ sha: string; message: string; author: string; date: Date }>> {
    try {
      const response = await this.octokit.rest.repos.compareCommits({
        owner,
        repo,
        base,
        head
      });

      return response.data.commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || 'Unknown',
        date: new Date(commit.commit.author?.date || Date.now())
      }));
    } catch (error) {
      console.error('Error fetching commits between:', error);
      return [];
    }
  }

  async getBranches(owner: string, repo: string): Promise<string[]> {
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner,
        repo
      });

      return response.data.map(branch => branch.name);
    } catch (error) {
      console.error('Error fetching branches:', error);
      return [];
    }
  }

  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    secret?: string
  ): Promise<boolean> {
    try {
      await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret,
          insecure_ssl: '0'
        },
        events: ['push', 'pull_request'],
        active: true
      });

      return true;
    } catch (error) {
      console.error('Error creating webhook:', error);
      return false;
    }
  }

  async validateRepository(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return true;
    } catch (error) {
      console.error('Error validating repository:', error);
      return false;
    }
  }
}