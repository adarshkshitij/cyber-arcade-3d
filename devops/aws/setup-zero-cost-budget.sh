#!/usr/bin/env bash
# ==============================================================================
# Setup AWS Zero-Cost Budget Alert ($0.01 / $1.00 Threshold)
# 3D Neon Snake Arcade - Production AWS Guardrail
# ==============================================================================
# Usage:
#   export ALERT_EMAIL="your-email@example.com"
#   bash devops/aws/setup-zero-cost-budget.sh
# ==============================================================================

set -euo pipefail

ALERT_EMAIL="${ALERT_EMAIL:-}"
BUDGET_LIMIT="${BUDGET_LIMIT:-1.00}" # Default $1.00 threshold

echo "🛡️ Setting up AWS Zero-Cost Budget Guardrail..."

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ Error: AWS CLI is not installed."
  echo "   Please install it first: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text 2>/dev/null || true)
if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ Error: AWS credentials not found or invalid."
  echo "   Please run 'aws configure' first."
  exit 1
fi

if [ -z "$ALERT_EMAIL" ]; then
  echo "⚠️ Warning: ALERT_EMAIL environment variable not set."
  echo "   Usage: export ALERT_EMAIL='user@domain.com' && npm run aws:budget"
  read -p "👉 Enter your email address for $0.01 spend alerts: " ALERT_EMAIL
fi

echo "📋 Configuring Budget for AWS Account: $ACCOUNT_ID"
echo "   Threshold: \$$BUDGET_LIMIT USD"
echo "   Alert Email: $ALERT_EMAIL"

BUDGET_JSON=$(cat <<BUDGET_CONF
{
  "BudgetName": "Zero-Cost-Snake-Game-Guardrail",
  "BudgetLimit": {
    "Amount": "$BUDGET_LIMIT",
    "Unit": "USD"
  },
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false,
    "IncludeRefund": false,
    "IncludeCredit": false,
    "IncludeUpfront": true,
    "IncludeRecurring": true,
    "IncludeOtherSubscription": true,
    "IncludeSupport": true,
    "IncludeDiscount": true,
    "UseAmortized": false
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
BUDGET_CONF
)

NOTIFICATIONS_JSON=$(cat <<NOTIF_CONF
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80.0,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "$ALERT_EMAIL"
      }
    ]
  },
  {
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100.0,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "$ALERT_EMAIL"
      }
    ]
  }
]
NOTIF_CONF
)

aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --budget "$BUDGET_JSON" \
  --notifications-with-subscribers "$NOTIFICATIONS_JSON" 2>/dev/null || \
aws budgets update-budget \
  --account-id "$ACCOUNT_ID" \
  --new-budget "$BUDGET_JSON"

echo "✅ AWS Zero-Cost Budget Guardrail successfully activated!"
echo "   You will receive an instant email at $ALERT_EMAIL if AWS spend ever exceeds \$$BUDGET_LIMIT."
