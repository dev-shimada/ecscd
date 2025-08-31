#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ECS Continuous Deployment Tool...${NC}"

# Check required environment variables
required_vars=()

if [ "$DATABASE_TYPE" = "dynamodb" ]; then
    required_vars+=("AWS_REGION" "DYNAMODB_TABLE_NAME")
    if [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$AWS_ROLE_ARN" ]; then
        echo -e "${YELLOW}Warning: Neither AWS_ACCESS_KEY_ID nor AWS_ROLE_ARN is set for DynamoDB${NC}"
    fi
elif [ "$DATABASE_TYPE" = "sqlite" ] || [ -z "$DATABASE_TYPE" ]; then
    # Default to SQLite
    export DATABASE_TYPE="sqlite"
    export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/app/data/ecscd.db}"
    
    # Ensure data directory exists and has correct permissions
    mkdir -p "$(dirname "$SQLITE_DB_PATH")"
    
    echo -e "${GREEN}Using SQLite database at: $SQLITE_DB_PATH${NC}"
fi

# Check for required variables
missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    printf ' - %s\n' "${missing_vars[@]}"
    exit 1
fi

# Initialize database if using DynamoDB
if [ "$DATABASE_TYPE" = "dynamodb" ]; then
    echo -e "${GREEN}Using DynamoDB: $DYNAMODB_TABLE_NAME in $AWS_REGION${NC}"
    
    # Optional: Create table if it doesn't exist (uncomment if needed)
    # echo "Checking if DynamoDB table exists..."
    # node /app/scripts/create-dynamodb-table.js || echo "Table creation failed or already exists"
fi

# Health check before starting
echo -e "${GREEN}Performing initial health check...${NC}"
if [ "$DATABASE_TYPE" = "sqlite" ]; then
    # Test SQLite database access
    sqlite3 "$SQLITE_DB_PATH" "SELECT 1;" > /dev/null 2>&1 || {
        echo -e "${YELLOW}Creating new SQLite database...${NC}"
        sqlite3 "$SQLITE_DB_PATH" "SELECT 1;" > /dev/null 2>&1
    }
fi

echo -e "${GREEN}Configuration validated successfully!${NC}"
echo -e "${GREEN}Database Type: $DATABASE_TYPE${NC}"
echo -e "${GREEN}Node Environment: ${NODE_ENV:-development}${NC}"
echo -e "${GREEN}Starting application on port ${PORT:-3000}...${NC}"

# Execute the main command
exec "$@"