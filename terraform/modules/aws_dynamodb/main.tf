resource "aws_dynamodb_table" "player_sessions" {
  name           = var.table_name
  billing_mode   = "PROVISIONED"
  read_capacity  = var.read_capacity
  write_capacity = var.write_capacity
  hash_key       = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  tags = var.tags
}