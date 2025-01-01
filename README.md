# AWS Fargate CDK Template

A streamlined AWS CDK template for deploying containerized applications on AWS Fargate with secure networking configurations and ECR pull-through capabilities.

## Features

- AWS Fargate cluster setup with VPC configuration
- ECR pull-through repository for secure container access
- VPC Endpoints for enhanced security
- IPAM (IP Address Management) pool integration
- Support for containerized web applications
- Optimized for Elixir Phoenix deployments

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK CLI:
```bash
npm install -g cdk
```

## Architecture

The template consists of three main stacks:

**Platform Stack**
- Creates VPC with private/public subnets
- Sets up IPAM pool
- Configures Fargate cluster
- Establishes VPC endpoints

**Service Repository Stack**
- Creates ECR repository
- Configures pull-through authentication
- Sets up repository policies

**Service Stack**
- Deploys Fargate service
- Configures load balancing
- Manages container deployment

## Deployment

### 1. Deploy Platform Stack

```bash
REPO_NAME="webapp" \
DOCKERHUB_USERNAME="your-username" \
DOCKERHUB_TOKEN="your-token" \
CREATE_IPAM=true \
cdk deploy FargatePlatform --region us-east-1
```

### 2. Create Repository

```bash
REPO_NAME="webapp" \
DOCKERHUB_USERNAME="your-username" \
DOCKERHUB_TOKEN="your-token" \
CREATE_IPAM=true \
cdk deploy ServiceRepoStack --region us-east-1
```

### 3. Deploy Service

```bash
REPO_NAME="webapp" \
DOCKERHUB_USERNAME="your-username" \
DOCKERHUB_TOKEN="your-token" \
CREATE_IPAM=true \
cdk deploy ServiceStack --region us-east-1
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| REPO_NAME | Name of your ECR repository | Yes |
| DOCKERHUB_USERNAME | DockerHub username | Yes |
| DOCKERHUB_TOKEN | DockerHub access token | Yes |
| CREATE_IPAM | Enable IPAM creation | Yes |

## Security Considerations

- VPC endpoints reduce exposure to public internet
- Private subnets for container workloads
- ECR pull-through authentication for secure image access
- IPAM for centralized IP address management

## Cost Considerations

- VPC endpoints incur additional charges
- IPAM pool usage costs
- Fargate compute costs
- ECR storage and data transfer costs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.