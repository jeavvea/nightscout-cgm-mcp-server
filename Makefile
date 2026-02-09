# Makefile for Nightscout MCP Server
# Build and run containerized application with podman for linux/amd64
# Usage: make <target>
# Run 'make help' to see all available targets

.PHONY: help build run stop clean push ecr-login

# Variables
AWS_REGION = eu-west-1
REGISTRY = 123456789012.dkr.ecr.eu-west-1.amazonaws.com
REPO_NAME = mcp-server
IMAGE_NAME = nightscout-mcp-server
IMAGE_TAG := $(shell date +%Y%m%d-%H%M)
PLATFORM = linux/amd64
PORT = 8000
FULL_IMAGE_NAME = $(REGISTRY)/$(REPO_NAME):$(IMAGE_TAG)

help:
	@echo "Nightscout MCP Server - Makefile Commands"
	@echo "=========================================="
	@echo "  make build    - Build the container image with podman"
	@echo "  make run      - Run the container locally"
	@echo "  make stop     - Stop the running container"
	@echo "  make clean    - Remove the container and image"
	@echo "  make push     - Build and push image to ECR registry"
	@echo "  make logs     - Show container logs"
	@echo "  make ecr-login - Authenticate with AWS ECR"
	@echo ""
	@echo "Variables:"
	@echo "  AWS_REGION    = $(AWS_REGION)"
	@echo "  REGISTRY      = $(REGISTRY)"
	@echo "  REPO_NAME     = $(REPO_NAME)"
	@echo "  IMAGE_NAME    = $(IMAGE_NAME)"
	@echo "  IMAGE_TAG     = $(IMAGE_TAG)"
	@echo "  PLATFORM      = $(PLATFORM)"
	@echo "  PORT          = $(PORT)"

build:
	@echo "Building $(IMAGE_NAME):$(IMAGE_TAG) for $(PLATFORM)..."
	podman build --platform=$(PLATFORM) -t $(IMAGE_NAME):$(IMAGE_TAG) .

run:
	@echo "Running $(IMAGE_NAME):$(IMAGE_TAG)..."
	podman run -d \
		--name $(IMAGE_NAME) \
		--platform=$(PLATFORM) \
		-p $(PORT):8000 \
		--env-file .env \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "Container started on http://localhost:$(PORT)"

stop:
	@echo "Stopping $(IMAGE_NAME)..."
	-podman stop $(IMAGE_NAME)
	-podman rm $(IMAGE_NAME)

clean: stop
	@echo "Removing image $(IMAGE_NAME):$(IMAGE_TAG)..."
	-podman rmi $(IMAGE_NAME):$(IMAGE_TAG)

push: build
	@echo "Logging in to AWS ECR..."
	aws ecr get-login-password --region $(AWS_REGION) | podman login --username AWS --password-stdin $(REGISTRY)
	@echo "Tagging and pushing to $(FULL_IMAGE_NAME)..."
	podman tag $(IMAGE_NAME):$(IMAGE_TAG) $(FULL_IMAGE_NAME)
	podman push $(FULL_IMAGE_NAME)

	
logs:
	@echo "Showing logs for $(IMAGE_NAME)..."
	podman logs -f $(IMAGE_NAME)

rebuild: clean build

restart: stop run
