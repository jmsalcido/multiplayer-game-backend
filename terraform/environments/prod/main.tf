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
  table_name  = "PlayerSessions-prod"
  read_capacity  = 10
  write_capacity = 10
  tags = {
    Environment = "prod"
  }
}

module "ebs" {
  source                 = "../../modules/aws_ebs"
  application_name       = "MultiplayerGameBackend-prod"
  application_description = "Production environment for Multiplayer Game Backend"
  environment_name       = "MultiplayerGameBackend-env-prod"
  solution_stack_name    = "64bit Amazon Linux 2023 v6.4.3 running Node.js 22"
  instance_type          = "t3.micro"  # You might choose a larger instance for prod
  environment_type       = "LoadBalanced"
  tags = {
    Environment = "prod"
  }
}

module "github_secrets" {
  source                = "../../modules/github_secrets"
  repository            = "jmsalcido/multiplayer-game-backend"
  aws_access_key_id     = var.aws_access_key_id
  aws_secret_access_key = var.aws_secret_access_key
  aws_region            = var.aws_region
  aws_eb_application    = module.ebs.application_name
  aws_eb_environment    = module.ebs.environment_name
}