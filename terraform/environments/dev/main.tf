terraform {
  required_version = ">= 1.4"
}

provider "aws" {
  region = "us-west-2"
}

provider "github" {
  owner = "jmsalcido"
  token = var.github_token
}

module "dynamodb" {
  source      = "../../modules/aws_dynamodb"
  table_name  = "PlayerSessions-dev"
  read_capacity  = 5
  write_capacity = 5
  tags = {
    Environment = "dev"
  }
}

module "ebs" {
  source                 = "../../modules/aws_ebs"
  application_name       = "MultiplayerGameBackend-dev"
  application_description = "Dev environment for Multiplayer Game Backend"
  environment_name       = "MultiplayerGameBackend-env-dev"
  solution_stack_name    = "64bit Amazon Linux 2023 v6.4.3 running Node.js 22"
  instance_type          = "t3.micro"
  environment_type       = "LoadBalanced"
  tags = {
    Environment = "dev"
  }
}

module "s3_bucket" {
  source         = "../../modules/aws_s3_bucket"
  bucket_name    = "jmsalcido-multiplayer-game-client-dev"  # Must be globally unique
  index_document = "phaser-client.html"
  error_document = "error.html"
  object_key     = "phaser-client.html"
  object_source  = "${path.module}/../../../phaser-client.html"
  region         = var.aws_region
}

module "github_secrets" {
  source                = "../../modules/github_secrets"
  repository            = "multiplayer-game-backend"
  aws_access_key_id     = var.aws_access_key_id
  aws_secret_access_key = var.aws_secret_access_key
  aws_region            = var.aws_region
  aws_eb_application    = module.ebs.application_name
  aws_eb_environment    = module.ebs.environment_name
  backend_url           = module.ebs.endpoint_url
  s3_bucket_name        = module.s3_bucket.bucket_name
}