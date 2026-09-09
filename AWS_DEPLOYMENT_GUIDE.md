# 🚀 AWS Cloud Deployment & DevOps Guide: 3D Neon Snake Arcade

> Complete reference for hosting **3D Neon Snake Arcade** on Amazon Web Services (AWS) using **AWS CLI**, **Docker**, **CodeRabbit**, **Terraform (IaC)**, and **GitHub Actions**.

---

## 📑 Table of Contents
1. [Can I Host This on AWS? (Architecture Overview)](#1-can-i-host-this-on-aws-architecture-overview)
2. [Hosting Strategy Comparison & Pricing](#2-hosting-strategy-comparison--pricing)
3. [Method 1: AWS S3 + CloudFront (Recommended - $0/mo Free Tier)](#3-method-1-aws-s3--cloudfront-recommended---0mo-free-tier)
4. [Method 2: Docker on AWS App Runner / ECS](#4-method-2-docker-on-aws-app-runner--ecs)
5. [Method 3: 1-Click Terraform IaC Provisioning](#5-method-3-1-click-terraform-iac-provisioning)
6. [AWS CLI Setup & Command Reference](#6-aws-cli-setup--command-reference)
7. [CodeRabbit CLI & CI Integration](#7-coderabbit-cli--ci-integration)
8. [Automated GitHub Actions CI/CD Deployment](#8-automated-github-actions-cicd-deployment)

---

## 1. Can I Host This on AWS? (Architecture Overview)

**YES, absolutely!** 

Because **3D Neon Snake Arcade** is built using vanilla WebGL/Three.js and pure ES6 (without needing a heavyweight runtime or database), you have two distinct deployment patterns:

```
                         ┌──────────────────────────────────────────────┐
                         │              AWS Route 53 (DNS)              │
                         └──────────────────────┬───────────────────────┘
                                                │
                                                ▼
                         ┌──────────────────────────────────────────────┐
                         │          AWS CloudFront CDN (Edge)           │
                         │   (Global Caching + Free SSL/TLS via ACM)    │
                         └──────────────┬───────────────────────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
    [Option A: Static Serverless]               [Option B: Containerized]
   ┌─────────────────────────────┐             ┌─────────────────────────────┐
   │       Amazon S3 Bucket      │             │  AWS App Runner / ECS Fargate│
   │ (HTML5, JS, Assets via OAC) │             │ (Alpine Nginx Docker Image) │
   └─────────────────────────────┘             └─────────────────────────────┘
```

---

## 2. Hosting Strategy Comparison & Pricing

| Feature | S3 + CloudFront (Recommended) | Docker (App Runner / ECS) | AWS Amplify |
| :--- | :--- | :--- | :--- |
| **Best For** | Ultra-fast client-side game, zero server maintenance | When unified Docker container workflow is required | Fast GitOps web app hosting |
| **Monthly Cost** | **$0.00 / month** (AWS Free Tier: 5GB S3, 1TB CloudFront data transfer free forever) | ~$5 - $10 / month (vCPU + RAM compute hours) | Free tier eligible (1,000 build mins/mo, 15GB served) |
| **Global Latency** | **< 10ms** (Cached across 450+ CloudFront edge locations) | Regional container latency + CDN | Built-in CDN |
| **SSL Certificate** | Free automated SSL via AWS Certificate Manager (ACM) | Automated SSL managed by AWS | Free SSL included |
| **Deployment Speed** | Instant S3 sync (`~5 seconds`) | Docker build & container spin-up (`~2-3 minutes`) | Git push auto-build (`~2 minutes`) |

---

## 3. Method 1: AWS S3 + CloudFront (Recommended - $0/mo Free Tier)

This repository includes a ready-to-run automation script: `devops/aws/deploy-s3-cloudfront.sh`.

### Automated 1-Command Deployment:
```bash
# Set your target bucket and optional CloudFront distribution ID
export S3_BUCKET="my-snake-game-bucket-prod"
export CLOUDFRONT_DIST_ID="E123456789ABCD" # Optional, leave empty if not created yet
export AWS_REGION="us-east-1"

# Run automated deployment
npm run aws:deploy
# or: bash devops/aws/deploy-s3-cloudfront.sh
```

### What the script does automatically:
1. **Validates AWS CLI**: Ensures your environment is configured.
2. **Creates S3 Bucket**: Sets up the bucket if it doesn't already exist.
3. **Applies HTTP Cache Headers**:
   - `index.html`: `Cache-Control: max-age=0, no-cache, no-store, must-revalidate` (Users immediately get fresh updates).
   - `.js`, `.css`, audio assets: `Cache-Control: public, max-age=86400` (1-day edge caching for instant loading).
4. **Invalidates CloudFront**: Purges cached edges so new releases go live globally in seconds.

---

## 4. Method 2: Docker on AWS App Runner / ECS

If your infrastructure team mandates Docker containers:

### Step 1: Build and Test Locally
```bash
# Build using docker compose
npm run docker:build
npm run docker:up

# Test on http://localhost:8080
curl -I http://localhost:8080
```

### Step 2: Push to Amazon ECR (Elastic Container Registry)
```bash
# 1. Authenticate Docker with AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# 2. Create ECR repository
aws ecr create-repository --repository-name snake-game-3d --region us-east-1

# 3. Tag and push container image
docker tag snake-game:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/snake-game-3d:v1.1.0
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/snake-game-3d:v1.1.0
```

### Step 3: Launch on AWS App Runner
1. Go to **AWS Console > App Runner > Create Service**.
2. Source: **Container Registry > Amazon ECR**.
3. Select `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/snake-game-3d:v1.1.0`.
4. Port: `80`.
5. Click **Deploy**. AWS gives you an HTTPS URL with auto-scaling and zero server management!

---

## 5. Method 3: 1-Click Terraform IaC Provisioning

All AWS infrastructure can be spun up or destroyed with a single command using `devops/aws/main.tf`.

### Provision AWS Infrastructure:
```bash
cd devops/aws

# Initialize Terraform AWS provider
terraform init

# Review execution plan
terraform plan -var="bucket_name=my-snake-game-webgl-production"

# Apply and create S3 + CloudFront + OAC + Security Policy
terraform apply -var="bucket_name=my-snake-game-webgl-production" -auto-approve
```

Terraform outputs your **CloudFront Domain Name** (e.g. `https://d1234abcd.cloudfront.net`) and **S3 Bucket Name**.

### Tear Down Infrastructure:
```bash
terraform destroy -var="bucket_name=my-snake-game-webgl-production" -auto-approve
```

---

## 6. AWS CLI Setup & Command Reference

### Installing AWS CLI on Linux:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

### Configuring AWS Credentials:
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Output format: json
```

### Useful AWS CLI Commands:
| Task | Command |
| :--- | :--- |
| **List S3 Buckets** | `aws s3 ls` |
| **Sync Local Files to S3** | `aws s3 sync . s3://<bucket-name> --exclude ".git/*"` |
| **Purge CloudFront Cache** | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| **Check Caller Identity** | `aws sts get-caller-identity` |

---

## 7. CodeRabbit CLI & CI Integration

CodeRabbit provides AI-driven code review, detecting performance bottlenecks, security flaws, and architectural regressions.

### 1. Local CodeRabbit Gate:
We have built an automated local audit script mimicking CodeRabbit rules:
```bash
npm run coderabbit:review
# or: bash scripts/coderabbit-check.sh
```
This runs:
- WebGL Context Disposal check (ensures zero GPU memory leaks).
- Web Audio API user-gesture unlock verification.
- CSS specificity & viewport containment check.
- Complete Node.js Unit & Headless Chrome E2E test execution.

### 2. GitHub CodeRabbit Integration:
1. Install [CodeRabbit GitHub App](https://coderabbit.ai) on your repository.
2. Add `.coderabbit.yaml` in your project root:
```yaml
version: "2"
reviews:
  profile: "chill"
  request_changes_workflow: false
  high_level_summary: true
  auto_review:
    enabled: true
    drafts: false
chat:
  auto_reply: true
```
Every Pull Request will now automatically receive line-by-line AI code reviews!

---

## 8. Automated GitHub Actions CI/CD Deployment

We have created `devops/workflows/deploy-aws.yml` ready for continuous deployment.

### Setting up GitHub Secrets:
In your GitHub repository (`Settings > Secrets and variables > Actions`), add:
- `AWS_ACCESS_KEY_ID`: Your IAM user access key
- `AWS_SECRET_ACCESS_KEY`: Your IAM secret key
- `AWS_REGION`: e.g. `us-east-1`
- `S3_BUCKET_NAME`: Your target S3 bucket name
- `CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID

On every push to `main`, GitHub Actions will:
1. Checkout code
2. Run Unit and E2E browser tests
3. Authenticate with AWS via OIDC / Credentials
4. Sync build assets to S3 with caching policies
5. Invalidate CloudFront edge cache globally

🎮 **Your game is now production-grade, globally distributed, and DevOps ready!**
