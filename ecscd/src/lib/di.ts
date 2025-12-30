import { Application } from "./infrastructure/application";
import { ApplicationUsecase } from "./usecase/application";
import { DeploymentUsecase } from "./usecase/deployment";
import { Deployment } from "./infrastructure/deployment";
import { AWS } from "./infrastructure/aws";
import { GitHub } from "./infrastructure/github";
import { SQLite } from "./infrastructure/sqlite";
import { DynamoDB } from "./infrastructure/dynamodb";
import { IDatabase } from "./infrastructure/interface/database";
import { Filter } from "./infrastructure/filter";
import { FilterUsecase } from "./usecase/filter";

function createDatabase(): IDatabase {
  const dbType = process.env.DATABASE_TYPE || "sqlite";

  switch (dbType.toLowerCase()) {
    case "dynamodb":
      const region = process.env.AWS_REGION || "us-east-1";
      const tableName = process.env.DYNAMODB_TABLE_NAME || "ECSCD";
      return new DynamoDB(region, tableName);
    case "sqlite":
    default:
      const dbPath = process.env.SQLITE_DB_PATH || "./ecscd.db";
      return new SQLite(dbPath);
  }
}

const db = createDatabase();
const ar = new Application(db);
const dr = new Deployment(
  new AWS(),
  new GitHub(process.env.GITHUB_TOKEN || "")
);
const fr = new Filter(db);

export const au = new ApplicationUsecase(ar, dr);
export const du = new DeploymentUsecase(dr);
export const fu = new FilterUsecase(fr);
