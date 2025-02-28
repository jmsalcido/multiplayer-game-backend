terraform {
  required_version = ">= 1.4"  # Adjust as needed for your Terraform version in 2025

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
  }
}