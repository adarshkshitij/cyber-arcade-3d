#!/usr/bin/env bash
# ==============================================================================
# AWS S3 + CloudFront Automated Deployment Script
# 3D Neon Snake Arcade
# ==============================================================================

set -e

# Configuration (Pass via environment or edit below)
BUCKET_NAME="${AWS_S3_BUCKET:-}"
DISTRIBUTION_ID="${AWS_CLOUDFRONT_DIST_ID:-}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Error: AWS_S3_BUCKET environment variable is not set."
  echo "   Usage: AWS_S3_BUCKET=my-snake-game-bucket AWS_CLOUDFRONT_DIST_ID=E123456789ABCD bash devops/aws/deploy-s3-cloudfront.sh"
  exit 1
fi

echo "🚀 [1/3] Deploying 3D Neon Snake Arcade to AWS S3: s3://$BUCKET_NAME..."

# Sync HTML files with no-cache (ensures users immediately see updates)
echo "   📄 Syncing index.html (no-cache)..."
aws s3 sync . "s3://$BUCKET_NAME" \
  --region "$REGION" \
  --exclude "*" \
  --include "index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# Sync Static Assets (CSS, JS, PNG) with 1-day caching
echo "   ⚡ Syncing static assets (1-day cache)..."
aws s3 sync . "s3://$BUCKET_NAME" \
  --region "$REGION" \
  --exclude "*" \
  --include "*.js" \
  --include "*.css" \
  --include "*.png" \
  --include "*.json" \
  --cache-control "public, max-age=86400"

echo "✅ S3 Sync Completed Successfully!"

# CloudFront Cache Invalidation
if [ -n "$DISTRIBUTION_ID" ]; then
  echo "🌐 [2/3] Invalidating CloudFront edge cache: $DISTRIBUTION_ID..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)
  echo "   ✅ Invalidation created: $INVALIDATION_ID"
else
  echo "ℹ️  [2/3] AWS_CLOUDFRONT_DIST_ID not set. Skipping CloudFront cache invalidation."
fi

echo "🎉 [3/3] Deployment complete! Your 3D Snake Game is live on AWS."
