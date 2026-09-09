# ==============================================================================
# Terraform: 1-Click AWS S3 + CloudFront Infrastructure as Code (IaC)
# 3D Neon Snake Arcade
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Region for S3 and CloudFront resources"
}

variable "project_name" {
  type        = string
  default     = "3d-neon-snake-arcade"
  description = "Project name prefix for AWS resources"
}

# 1. S3 Bucket (Private, accessed exclusively via CloudFront)
resource "aws_s3_bucket" "game_bucket" {
  bucket_prefix = "${var.project_name}-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "game_bucket_block" {
  bucket = aws_s3_bucket.game_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for 3D Snake Arcade S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 3. CloudFront CDN Distribution
resource "aws_cloudfront_distribution" "game_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "3D Neon Snake Arcade CDN"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.game_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.game_bucket.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.game_bucket.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# 4. S3 Bucket Policy allowing CloudFront Read Access
resource "aws_s3_bucket_policy" "allow_cloudfront" {
  bucket = aws_s3_bucket.game_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.game_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.game_cdn.arn
          }
        }
      }
    ]
  })
}

# 5. Outputs
output "s3_bucket_name" {
  value       = aws_s3_bucket.game_bucket.id
  description = "Name of the created S3 bucket"
}

output "cloudfront_domain" {
  value       = "https://${aws_cloudfront_distribution.game_cdn.domain_name}"
  description = "Live CloudFront HTTPS URL for the 3D Snake Game"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.game_cdn.id
  description = "CloudFront Distribution ID for cache invalidation"
}
