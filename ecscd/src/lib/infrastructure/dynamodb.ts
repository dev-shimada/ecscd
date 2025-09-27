import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { IDatabase } from "./interface/database";
import { ApplicationDomain } from "../domain/application";

interface ApplicationsModel {
  name: string;
  git_repo: string;
  git_branch: string;
  git_path: string;
  ecs_cluster: string;
  ecs_service: string;
  aws_region: string;
  aws_role_arn: string;
  aws_external_id: string;
  created_at: string;
  updated_at: string;
}

export class DynamoDB implements IDatabase {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(region: string, tableName: string = "ECSCD") {
    const dynamoDBClient = new DynamoDBClient({ region });
    this.client = DynamoDBDocumentClient.from(dynamoDBClient);
    this.tableName = tableName;
  }

  async getApplications(): Promise<ApplicationDomain[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
      });

      const response = await this.client.send(command);
      const items = response.Items || [];

      const applications: ApplicationDomain[] = await Promise.all(
        items.map((item) =>
          this.mapItemToApplication(item as ApplicationsModel)
        )
      );

      return applications.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      throw new Error(`Failed to get applications: ${error}`);
    }
  }

  async createApplication(application: ApplicationDomain): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          name: application.name,
          git_repo: application.gitConfig.repo,
          git_branch: application.gitConfig.branch,
          git_path: application.gitConfig.path,
          ecs_cluster: application.ecsConfig.cluster,
          ecs_service: application.ecsConfig.service,
          aws_region: application.awsConfig.region,
          aws_role_arn: application.awsConfig.roleArn,
          aws_external_id: application.awsConfig.externalId,
          created_at: application.createdAt.toISOString(),
          updated_at: application.updatedAt.toISOString(),
        },
        ConditionExpression: "attribute_not_exists(#name)",
        ExpressionAttributeNames: {
          "#name": "name",
        },
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        throw new Error(
          `Application with name '${application.name}' already exists`
        );
      }
      throw new Error(`Failed to create application: ${error}`);
    }
  }

  async updateApplication(application: ApplicationDomain): Promise<void> {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          name: application.name,
        },
        UpdateExpression: `SET
          git_repo = :git_repo,
          git_branch = :git_branch,
          git_path = :git_path,
          ecs_cluster = :ecs_cluster,
          ecs_service = :ecs_service,
          aws_region = :aws_region,
          aws_role_arn = :aws_role_arn,
          updated_at = :updated_at`,
        ExpressionAttributeValues: {
          ":git_repo": application.gitConfig.repo,
          ":git_branch": application.gitConfig.branch,
          ":git_path": application.gitConfig.path,
          ":ecs_cluster": application.ecsConfig.cluster,
          ":ecs_service": application.ecsConfig.service,
          ":aws_region": application.awsConfig.region,
          ":aws_role_arn": application.awsConfig.roleArn,
          ":updated_at": application.updatedAt.toISOString(),
        },
        ConditionExpression: "attribute_exists(#name)",
        ExpressionAttributeNames: {
          "#name": "name",
        },
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        throw new Error(
          `Application with name '${application.name}' does not exist`
        );
      }
      throw new Error(`Failed to update application: ${error}`);
    }
  }

  async deleteApplication(name: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          name: name,
        },
        ConditionExpression: "attribute_exists(#name)",
        ExpressionAttributeNames: {
          "#name": "name",
        },
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        throw new Error(`Application with name '${name}' does not exist`);
      }
      throw new Error(`Failed to delete application: ${error}`);
    }
  }

  private async mapItemToApplication(
    item: ApplicationsModel
  ): Promise<ApplicationDomain> {
    return {
      name: item.name,
      sync: { status: "Synced" },
      gitConfig: {
        repo: item.git_repo,
        branch: item.git_branch,
        path: item.git_path,
      },
      ecsConfig: {
        cluster: item.ecs_cluster,
        service: item.ecs_service,
      },
      awsConfig: {
        region: item.aws_region,
        roleArn: item.aws_role_arn,
        externalId: item.aws_external_id,
      },
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    };
  }
}
