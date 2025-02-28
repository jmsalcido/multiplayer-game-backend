variable "aws_access_key_id" {
  description = "AWS Access Key ID for dev"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key for dev"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "github_token" {
  description = "GitHub Personal Access Token with admin rights to the repository"
  type        = string
  sensitive   = true
}