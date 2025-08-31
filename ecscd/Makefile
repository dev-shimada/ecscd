# Makefile for ECS Continuous Deployment Tool

# Variables
IMAGE_NAME = ecscd
IMAGE_TAG = latest
REGISTRY = your-registry.com
FULL_IMAGE_NAME = $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

.PHONY: help build build-dev run run-dev test clean push deploy

help: ## Show this help message
	@echo "$(GREEN)ECS Continuous Deployment Tool - Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

build: ## Build production Docker image
	@echo "$(GREEN)Building production image...$(NC)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@echo "$(GREEN)Production image built successfully!$(NC)"

build-dev: ## Build development Docker image
	@echo "$(GREEN)Building development image...$(NC)"
	docker build -f Dockerfile.dev -t $(IMAGE_NAME):dev .
	@echo "$(GREEN)Development image built successfully!$(NC)"

run: build ## Run production container
	@echo "$(GREEN)Starting production container...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Container started! Access at http://localhost:3000$(NC)"

run-dev: ## Run development container with hot reload
	@echo "$(GREEN)Starting development container...$(NC)"
	docker-compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)Development container started! Access at http://localhost:3000$(NC)"

test: ## Run tests
	@echo "$(GREEN)Running tests...$(NC)"
	npm test

lint: ## Run ESLint
	@echo "$(GREEN)Running ESLint...$(NC)"
	npm run lint

build-check: ## Build and check for errors
	@echo "$(GREEN)Building and checking for errors...$(NC)"
	npm run build

clean: ## Clean up Docker containers and images
	@echo "$(YELLOW)Cleaning up containers...$(NC)"
	docker-compose down -v --remove-orphans || true
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans || true
	@echo "$(YELLOW)Removing images...$(NC)"
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true
	docker rmi $(IMAGE_NAME):dev || true
	@echo "$(GREEN)Cleanup completed!$(NC)"

prune: ## Remove unused Docker resources
	@echo "$(YELLOW)Pruning Docker system...$(NC)"
	docker system prune -f
	docker volume prune -f
	@echo "$(GREEN)Docker system pruned!$(NC)"

logs: ## Show container logs
	@echo "$(GREEN)Showing container logs...$(NC)"
	docker-compose logs -f

logs-dev: ## Show development container logs
	@echo "$(GREEN)Showing development container logs...$(NC)"
	docker-compose -f docker-compose.dev.yml logs -f

health: ## Check container health
	@echo "$(GREEN)Checking container health...$(NC)"
	@curl -f http://localhost:3000/api/health || echo "$(RED)Health check failed$(NC)"

shell: ## Get shell access to running container
	@echo "$(GREEN)Accessing container shell...$(NC)"
	docker-compose exec ecscd /bin/bash

shell-dev: ## Get shell access to development container
	@echo "$(GREEN)Accessing development container shell...$(NC)"
	docker-compose -f docker-compose.dev.yml exec ecscd-dev /bin/bash

tag: build ## Tag image for registry
	@echo "$(GREEN)Tagging image for registry...$(NC)"
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(FULL_IMAGE_NAME)
	@echo "$(GREEN)Image tagged as $(FULL_IMAGE_NAME)$(NC)"

push: tag ## Push image to registry
	@echo "$(GREEN)Pushing image to registry...$(NC)"
	docker push $(FULL_IMAGE_NAME)
	@echo "$(GREEN)Image pushed successfully!$(NC)"

# Database management
db-migrate: ## Run database migrations (if any)
	@echo "$(GREEN)Running database migrations...$(NC)"
	docker-compose exec ecscd node scripts/migrate.js || echo "$(YELLOW)No migrations to run$(NC)"

db-seed: ## Seed database with sample data
	@echo "$(GREEN)Seeding database...$(NC)"
	docker-compose exec ecscd node scripts/seed.js || echo "$(YELLOW)No seed data to insert$(NC)"

# AWS specific commands
aws-create-table: ## Create DynamoDB table
	@echo "$(GREEN)Creating DynamoDB table...$(NC)"
	node scripts/create-dynamodb-table.js

# Development helpers
dev-setup: ## Set up development environment
	@echo "$(GREEN)Setting up development environment...$(NC)"
	npm install
	cp .env.example .env
	@echo "$(YELLOW)Please edit .env file with your configuration$(NC)"
	@echo "$(GREEN)Development setup completed!$(NC)"

format: ## Format code with Prettier
	@echo "$(GREEN)Formatting code...$(NC)"
	npm run format || echo "$(YELLOW)No format script found$(NC)"

# Multi-platform build (for different architectures)
build-multi: ## Build multi-platform image (linux/amd64,linux/arm64)
	@echo "$(GREEN)Building multi-platform image...$(NC)"
	docker buildx build --platform linux/amd64,linux/arm64 -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Security scanning
security-scan: build ## Run security scan on Docker image
	@echo "$(GREEN)Running security scan...$(NC)"
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy image $(IMAGE_NAME):$(IMAGE_TAG) || echo "$(YELLOW)Trivy not available$(NC)"

# Size optimization check
image-size: build ## Show image size information
	@echo "$(GREEN)Image size information:$(NC)"
	docker images $(IMAGE_NAME):$(IMAGE_TAG)
	@echo "$(GREEN)Image layers:$(NC)"
	docker history $(IMAGE_NAME):$(IMAGE_TAG)

# Quick start for new users
quick-start: dev-setup build-dev run-dev ## Quick start for development
	@echo "$(GREEN)Quick start completed!$(NC)"
	@echo "$(GREEN)Application is running at http://localhost:3000$(NC)"
	@echo "$(YELLOW)Don't forget to configure your .env file!$(NC)"