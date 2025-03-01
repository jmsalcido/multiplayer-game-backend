variable "repository" {
  description = "GitHub repository name in the format owner/repo"
  type        = string
}

variable "aws_access_key_id" {
  description = "AWS Access Key ID"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "aws_eb_application" {
  description = "Elastic Beanstalk application name"
  type        = string
}

variable "aws_eb_environment" {
  description = "Elastic Beanstalk environment name"
  type        = string
}

variable "backend_url" {
  description = "The publicly accessible backend URL for the Elastic Beanstalk environment"
  type        = string
}

variable "s3_bucket_name" {
  description = "The S3 bucket name to host the client"
  type        = string
}