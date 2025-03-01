resource "github_actions_secret" "aws_access_key_id" {
  repository      = var.repository
  secret_name     = "AWS_ACCESS_KEY_ID"
  plaintext_value = var.aws_access_key_id
}

resource "github_actions_secret" "aws_secret_access_key" {
  repository      = var.repository
  secret_name     = "AWS_SECRET_ACCESS_KEY"
  plaintext_value = var.aws_secret_access_key
}

resource "github_actions_secret" "aws_region" {
  repository      = var.repository
  secret_name     = "AWS_REGION"
  plaintext_value = var.aws_region
}

resource "github_actions_secret" "aws_eb_application" {
  repository      = var.repository
  secret_name     = "AWS_EB_APPLICATION"
  plaintext_value = var.aws_eb_application
}

resource "github_actions_secret" "aws_eb_environment" {
  repository      = var.repository
  secret_name     = "AWS_EB_ENVIRONMENT"
  plaintext_value = var.aws_eb_environment
}

resource "github_actions_secret" "backend_url" {
  repository      = var.repository
  secret_name     = "BACKEND_URL"
  plaintext_value = var.backend_url
}

resource "github_actions_secret" "s3_bucket" {
  repository      = var.repository
  secret_name     = "S3_BUCKET"
  plaintext_value = var.s3_bucket_name
}