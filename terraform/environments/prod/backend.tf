terraform {
  backend "s3" {
    bucket = "tepache-terraform-state-bucket"
    key    = "node-multiplayer-game/terraform.tfstate"
    region = "us-west-2"
  }
}